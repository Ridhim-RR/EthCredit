const { ethers } = require('ethers');
require('dotenv').config();

const RPC_URL = process.env.RPC_URL || 'https://sepolia.base.org';
const WALLET_ADDR = '0x9CAEE33dF9b2735247776e51f9Cc15E7dDf588E8';
const ROUTER_ADDR = '0x94cC0AaC535CCDB3C01d6787D6413C739ae12bc4';

const USDC = '0x036CbD53842c5426634e7929541eC2318f3dCF7e';
const WETH = '0x4200000000000000000000000000000000000006';

const ERC20_ABI = [
  'function balanceOf(address account) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function decimals() view returns (uint8)'
];

async function checkWallet() {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  
  console.log(`Checking Wallet: ${WALLET_ADDR}`);
  console.log(`Router: ${ROUTER_ADDR}`);
  console.log('---');

  const ethBalance = await provider.getBalance(WALLET_ADDR);
  console.log(`ETH Balance: ${ethers.formatEther(ethBalance)} ETH`);

  const tokens = [
    { name: 'USDC', address: USDC },
    { name: 'WETH', address: WETH }
  ];

  for (const token of tokens) {
    const contract = new ethers.Contract(token.address, ERC20_ABI, provider);
    const decimals = await contract.decimals();
    const balance = await contract.balanceOf(WALLET_ADDR);
    const allowance = await contract.allowance(WALLET_ADDR, ROUTER_ADDR);
    
    console.log(`${token.name}:`);
    console.log(`  Balance: ${ethers.formatUnits(balance, decimals)}`);
    console.log(`  Allowance to Router: ${ethers.formatUnits(allowance, decimals)}`);
  }
}

checkWallet().catch(console.error);
