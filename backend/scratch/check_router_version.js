const { ethers } = require('ethers');
require('dotenv').config();

const RPC_URL = process.env.RPC_URL || 'https://sepolia.base.org';
const ROUTER_ADDR = '0x94cC0AaC535CCDB3C01d6787D6413C739ae12bc4';

const ABI_7_PARAMS = [
  'function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96) params) external payable returns (uint256)'
];

const ABI_8_PARAMS = [
  'function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96) params) external payable returns (uint256)'
];

async function checkSelector() {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  
  const sel7 = ethers.id('exactInputSingle((address,address,uint24,address,uint256,uint256,uint160))').slice(0, 10);
  const sel8 = ethers.id('exactInputSingle((address,address,uint24,address,uint256,uint256,uint256,uint160))').slice(0, 10);
  
  console.log(`Selector 7 params: ${sel7}`);
  console.log(`Selector 8 params: ${sel8}`);
  
  const code = await provider.getCode(ROUTER_ADDR);
  
  // Check if selector exists in bytecode
  if (code.includes(sel7.slice(2))) {
    console.log(`RESULT: Contract ${ROUTER_ADDR} HAS the 7-param selector (${sel7})`);
  } else {
    console.log(`RESULT: Contract ${ROUTER_ADDR} DOES NOT HAVE the 7-param selector`);
  }
  
  if (code.includes(sel8.slice(2))) {
    console.log(`RESULT: Contract ${ROUTER_ADDR} HAS the 8-param selector (${sel8})`);
  } else {
    console.log(`RESULT: Contract ${ROUTER_ADDR} DOES NOT HAVE the 8-param selector`);
  }
}

checkSelector().catch(console.error);
