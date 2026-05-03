const { ethers } = require('ethers');
require('dotenv').config();

const RPC_URL = process.env.RPC_URL || 'https://sepolia.base.org';
const FACTORY_ADDR = '0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24';
const QUOTER_ADDR = '0xC5290058841028F1614F3A6F0F5816cAd0df5E27';

const WETH = '0x4200000000000000000000000000000000000006';
const USDC = '0x036CbD53842c5426634e7929541eC2318f3dCF7e';

const FACTORY_ABI = [
  'function getPool(address tokenA, address tokenB, uint24 fee) view returns (address)'
];

const QUOTER_ABI = [
  'function quoteExactInputSingle((address tokenIn, address tokenOut, uint256 amountIn, uint24 fee, uint160 sqrtPriceLimitX96) params) external returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)'
];

const POOL_ABI = [
  'function liquidity() view returns (uint128)',
  'function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)'
];

async function checkPools() {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const factory = new ethers.Contract(FACTORY_ADDR, FACTORY_ABI, provider);
  const quoter = new ethers.Contract(QUOTER_ADDR, QUOTER_ABI, provider);

  const fees = [500, 3000, 10000];
  
  console.log(`Checking WETH/USDC pools on ${RPC_URL}...`);
  console.log(`WETH: ${WETH}`);
  console.log(`USDC: ${USDC}`);
  console.log('---');

  for (const fee of fees) {
    try {
      const poolAddr = await factory.getPool(WETH, USDC, fee);
      console.log(`Fee Tier: ${fee / 10000}%`);
      console.log(`Pool Address: ${poolAddr}`);

      if (poolAddr === ethers.ZeroAddress) {
        console.log('Status: Does not exist');
      } else {
        const poolContract = new ethers.Contract(poolAddr, POOL_ABI, provider);
        const liquidity = await poolContract.liquidity();
        const slot0 = await poolContract.slot0();
        
        console.log(`Liquidity: ${liquidity.toString()}`);
        console.log(`sqrtPriceX96: ${slot0.sqrtPriceX96.toString()}`);
        
        if (liquidity > 0n) {
          try {
            // Try to get a quote for 0.01 WETH (10^16 wei)
            const amountIn = ethers.parseEther('0.01');
            const quote = await quoter.quoteExactInputSingle.staticCall({
              tokenIn: WETH,
              tokenOut: USDC,
              amountIn: amountIn,
              fee: fee,
              sqrtPriceLimitX96: 0
            });
            console.log(`Quote for 0.01 WETH: ${ethers.formatUnits(quote.amountOut, 6)} USDC`);
          } catch (quoteErr) {
            console.log(`Quote Failed: ${quoteErr.shortMessage || quoteErr.message}`);
          }
        } else {
          console.log('Status: Pool exists but has ZERO liquidity');
        }
      }
    } catch (err) {
      console.error(`Error checking fee tier ${fee}:`, err.message);
    }
    console.log('---');
  }
}

checkPools().catch(console.error);
