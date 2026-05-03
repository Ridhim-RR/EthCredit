export const BASE_SEPOLIA_CHAIN_ID = Number(process.env.NEXT_PUBLIC_BASE_SEPOLIA_CHAIN_ID || 84532);
export const BASE_SEPOLIA_RPC_URL = process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org';
export const BASE_SEPOLIA_EXPLORER_BASE = process.env.NEXT_PUBLIC_BASE_SEPOLIA_EXPLORER_BASE || 'https://sepolia.basescan.org/tx/';
export const SEPOLIA_CHAIN_ID = BASE_SEPOLIA_CHAIN_ID;
export const SWAP_FEE_TIER = 3000;

export const ERC20_ABI = [
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 value) returns (bool)',
  'function transfer(address to, uint256 value) returns (bool)',
  'function decimals() view returns (uint8)',
  'function balanceOf(address owner) view returns (uint256)',
];

export const USDC_ADDRESS = '0x036CbD53842c5426634e7929541eC2318f3dCF7e';

export const UNISWAP_V3_SWAP_ROUTER_ABI = [
  'function exactInputSingle((address tokenIn,address tokenOut,uint24 fee,address recipient,uint256 amountIn,uint256 amountOutMinimum,uint160 sqrtPriceLimitX96) params) payable returns (uint256 amountOut)',
];