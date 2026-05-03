const { ethers } = require('ethers');
const swapExecutionService = require('../src/services/swapExecutionService');
require('dotenv').config();

async function testIntegration() {
  console.log('Testing SwapExecutionService Quoter Integration...');
  
  const tokenIn = 'WETH';
  const tokenOut = 'USDC';
  const amountIn = ethers.parseEther('0.05'); // 0.05 WETH
  const walletAddress = '0x000000000000000000000000000000000000dead';

  try {
    const swapData = await swapExecutionService.buildSwapTransaction(
      tokenIn,
      tokenOut,
      amountIn,
      walletAddress,
      { fee: 3000 } // 0.3% tier
    );

    console.log('--- Result ---');
    console.log(`Input: ${ethers.formatEther(swapData.amountIn)} ${swapData.tokenIn.symbol}`);
    console.log(`Expected Output: ${ethers.formatUnits(swapData.expectedOutput, swapData.tokenOut.decimals)} ${swapData.tokenOut.symbol}`);
    console.log(`Min Output (3% slippage): ${ethers.formatUnits(swapData.minOutput, swapData.tokenOut.decimals)} ${swapData.tokenOut.symbol}`);
    console.log('Swap Params Built Successfully!');
  } catch (err) {
    console.error('Integration Test Failed:', err.message);
  }
}

testIntegration().catch(console.error);
