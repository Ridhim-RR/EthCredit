const { ethers } = require('ethers');
const { getTokenCatalog } = require('../config/tokenCatalog');

const ERC20_BALANCE_ABI = [
  'function balanceOf(address account) view returns (uint256)',
  'function decimals() view returns (uint8)',
];

function roundBalance(value, precision = 8) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return Number(parsed.toFixed(precision));
}

function getRpcUrl() {
  const catalog = getTokenCatalog();
  return process.env.RPC_URL || catalog.rpcUrl;
}

function getProvider() {
  const rpcUrl = getRpcUrl();

  if (!rpcUrl) {
    const error = new Error('RPC URL not configured');
    error.statusCode = 500;
    throw error;
  }

  return new ethers.JsonRpcProvider(rpcUrl);
}

async function getEthBalance(address) {
  const provider = getProvider();
  const balanceWei = await provider.getBalance(address);
  return roundBalance(ethers.formatEther(balanceWei), 8);
}

async function getTokenBalance(address, tokenAddress, tokenDecimals) {
  const provider = getProvider();
  const contract = new ethers.Contract(tokenAddress, ERC20_BALANCE_ABI, provider);

  const [rawBalance, resolvedDecimals] = await Promise.all([
    contract.balanceOf(address),
    Number.isInteger(tokenDecimals) ? Promise.resolve(tokenDecimals) : contract.decimals(),
  ]);

  return roundBalance(ethers.formatUnits(rawBalance, resolvedDecimals), 6);
}

async function getVaultBalances(walletAddress) {
  const catalog = getTokenCatalog();
  const usdc = (catalog.tokens || []).find((token) => token.symbol === 'USDC');

  if (!usdc?.address) {
    const error = new Error('USDC token is not configured in token catalog');
    error.statusCode = 500;
    throw error;
  }

  const [ethBalance, usdcBalance] = await Promise.all([
    getEthBalance(walletAddress),
    getTokenBalance(walletAddress, usdc.address, usdc.decimals),
  ]);

  return {
    ETH: ethBalance,
    USDC: usdcBalance,
  };
}

module.exports = {
  getProvider,
  getEthBalance,
  getTokenBalance,
  getVaultBalances,
};
