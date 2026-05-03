const { ethers } = require('ethers');
const tokenCatalog = require('../config/tokenCatalog');
const prisma = require('../db/prisma');
const cryptoUtil = require('./cryptoUtil');
const balanceService = require('./balanceService');
const swapService = require('./swapService');

// Base Sepolia Uniswap V3 SwapRouter address
const UNISWAP_V3_ROUTER_ADDRESS = '0x2E54B6A9c659276BfF3073636a92541dA61Df467';

// ERC20 ABI for approve and allowance functions
const ERC20_ABI = [
  'function approve(address spender, uint256 amount) public returns (bool)',
  'function allowance(address owner, address spender) public view returns (uint256)',
  'function balanceOf(address account) public view returns (uint256)',
  'function decimals() public view returns (uint8)',
];

// Uniswap V3 SwapRouter ABI (partial, for exactInputSingle)
const UNISWAP_V3_ROUTER_ABI = [
  'function exactInputSingle((address,address,uint24,address,uint256,uint256,uint256,uint160) params) external payable returns (uint256)',
  'function exactOutputSingle((address,address,uint24,address,uint256,uint256,uint256,uint160) params) external payable returns (uint256)',
  'function unwrapWETH9(uint256 amountMinimum, address recipient) external payable',
];

/**
 * Get Uniswap V3 SwapRouter instance
 * @param {ethers.JsonRpcProvider} provider - Ethers provider instance
 * @returns {ethers.Contract} Uniswap V3 SwapRouter contract instance
 */
function getUniswapRouter(provider) {
  if (!provider) {
    throw new Error('Provider is required');
  }

  return new ethers.Contract(UNISWAP_V3_ROUTER_ADDRESS, UNISWAP_V3_ROUTER_ABI, provider);
}

/**
 * Check ERC20 token allowance
 * @param {ethers.JsonRpcProvider} provider - Ethers provider instance
 * @param {string} walletAddress - Token owner wallet address
 * @param {string} tokenAddress - ERC20 token contract address
 * @param {string} spenderAddress - Spender address (typically Uniswap router)
 * @returns {Promise<BigInt>} Allowance amount in wei
 */
async function checkERC20Allowance(provider, walletAddress, tokenAddress, spenderAddress) {
  if (!provider || !walletAddress || !tokenAddress || !spenderAddress) {
    throw new Error('Provider, walletAddress, tokenAddress, and spenderAddress are required');
  }

  if (!ethers.isAddress(walletAddress)) {
    throw new Error('Invalid wallet address');
  }

  if (!ethers.isAddress(tokenAddress)) {
    throw new Error('Invalid token address');
  }

  if (!ethers.isAddress(spenderAddress)) {
    throw new Error('Invalid spender address');
  }

  try {
    const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
    const allowance = await tokenContract.allowance(walletAddress, spenderAddress);
    return allowance;
  } catch (err) {
    const error = new Error(`Failed to check ERC20 allowance: ${err.message}`);
    error.statusCode = 502;
    throw error;
  }
}

/**
 * Approve ERC20 token spending
 * @param {ethers.Wallet} wallet - Signer wallet (must have private key)
 * @param {string} tokenAddress - ERC20 token contract address
 * @param {string} spenderAddress - Spender address (typically Uniswap router)
 * @param {BigInt | string} amount - Amount to approve in wei
 * @returns {Promise<{hash: string, status: string}>} Transaction hash and status
 */
async function approveERC20Token(wallet, tokenAddress, spenderAddress, amount) {
  if (!wallet || !tokenAddress || !spenderAddress || !amount) {
    throw new Error('Wallet, tokenAddress, spenderAddress, and amount are required');
  }

  if (!ethers.isAddress(tokenAddress)) {
    throw new Error('Invalid token address');
  }

  if (!ethers.isAddress(spenderAddress)) {
    throw new Error('Invalid spender address');
  }

  try {
    const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, wallet);
    const tx = await tokenContract.approve(spenderAddress, amount);
    const receipt = await tx.wait();

    if (!receipt || receipt.status !== 1) {
      const error = new Error('Approval transaction failed');
      error.statusCode = 500;
      throw error;
    }

    return {
      hash: receipt.hash,
      status: 'SUCCESS',
    };
  } catch (err) {
    if (err.statusCode) {
      throw err;
    }
    const error = new Error(`Approval transaction failed: ${err.message}`);
    error.statusCode = 500;
    throw error;
  }
}

/**
 * Get token metadata from catalog
 * @param {string} tokenSymbol - Token symbol (e.g., 'USDC', 'WETH')
 * @returns {Object} Token metadata (address, decimals, etc.)
 */
function getTokenMetadata(tokenSymbol) {
  const catalog = tokenCatalog.getTokenCatalog ? tokenCatalog.getTokenCatalog() : tokenCatalog;
  const tokens = catalog.tokens || catalog;
  const token = tokens.find((t) => t.symbol.toUpperCase() === tokenSymbol.toUpperCase());

  if (!token) {
    const error = new Error(`Token not found: ${tokenSymbol}`);
    error.statusCode = 400;
    throw error;
  }

  return token;
}

/**
 * Validate token pair (must be USDC and WETH only)
 * @param {string} tokenIn - Input token symbol
 * @param {string} tokenOut - Output token symbol
 * @throws {Error} If pair is invalid
 */

/**
 * Execute approval flow before swap (Phase 6)
 * @param {ethers.Wallet} wallet - Signer wallet
 * @param {string} tokenIn - Input token symbol
 * @param {BigInt} amountIn - Amount to approve in wei
 * @returns {Promise<Object>} Approval result {needsApproval, txHash, status}
 */
  async function executeApprovalFlow(wallet, tokenIn, amountIn) {
    if (!wallet || !tokenIn || !amountIn) {
      throw new Error('wallet, tokenIn, and amountIn are required');
    }

    try {
      // Skip approval for ETH (native token)
      if (tokenIn.toUpperCase() === 'ETH') {
        return {
          needsApproval: false,
          status: 'SKIPPED_ETH',
        };
      }

      const tokenMeta = getTokenMetadata(tokenIn);
      const provider = getProvider();

      // Check current allowance
      const currentAllowance = await checkERC20Allowance(
        provider,
        wallet.address,
        tokenMeta.address,
        UNISWAP_V3_ROUTER_ADDRESS
      );

      // If sufficient allowance exists, skip approval
      if (currentAllowance >= amountIn) {
        return {
          needsApproval: false,
          currentAllowance: currentAllowance.toString(),
          status: 'SUFFICIENT_ALLOWANCE',
        };
      }

      // Approve with amount + 10% buffer for slippage variations
      const approveAmount = (amountIn * BigInt(110)) / BigInt(100);

      const approvalResult = await approveERC20Token(wallet, tokenMeta.address, UNISWAP_V3_ROUTER_ADDRESS, approveAmount);

      return {
        needsApproval: true,
        txHash: approvalResult.hash,
        status: 'APPROVED',
      };
    } catch (err) {
      if (err.statusCode) {
        throw err;
      }
      const error = new Error(`Approval execution failed: ${err.message}`);
      error.statusCode = 500;
      throw error;
    }
  }

  /**
   * Execute swap transaction on Uniswap V3 (Phase 7)
   * @param {ethers.Wallet} wallet - Signer wallet
   * @param {Object} swapData - Swap data from buildSwapTransaction
   * @param {string} agentId - Agent ID for logging
   * @returns {Promise<Object>} Execution result {txHash, status, receipt}
   */
  async function executeSwapTransaction(wallet, swapData, agentId) {
    if (!wallet || !swapData || !agentId) {
      throw new Error('wallet, swapData, and agentId are required');
    }

    try {
      const provider = getProvider();
      const router = new ethers.Contract(
        UNISWAP_V3_ROUTER_ADDRESS,
        UNISWAP_V3_ROUTER_ABI,
        wallet
      );

      const swapParams = swapData.params;

      // Send swap transaction
      const tx = await router.exactInputSingle(swapParams);
      const receipt = await tx.wait();

      if (!receipt || receipt.status !== 1) {
        const error = new Error('Swap transaction failed on-chain');
        error.statusCode = 500;
        throw error;
      }

      // Log transaction to database
      const logResult = await swapService.logSwapTransaction({
        agentId,
        walletAddress: wallet.address,
        tokenIn: swapData.tokenIn.symbol,
        tokenOut: swapData.tokenOut.symbol,
        amount: swapData.amountIn.toString(),
        txHash: receipt.hash,
        status: 'SUCCESS',
      });

      return {
        txHash: receipt.hash,
        status: 'SUCCESS',
        receipt,
        logId: logResult.transactionId,
      };
    } catch (err) {
      if (err.statusCode) {
        throw err;
      }
      const error = new Error(`Swap execution failed: ${err.message}`);
      error.statusCode = 500;
      throw error;
    }
  }

  
  /**
   * Calculate minimum output with 3% slippage
   * @param {BigInt} outputAmount - Expected output amount in wei
   * @param {number} slippagePercent - Slippage percentage (default 3%)
   * @returns {BigInt} Minimum output amount with slippage applied
   */
  function calculateMinimumOutput(outputAmount, slippagePercent = 3) {
    const slippageFactor = BigInt(100 - slippagePercent);
    const minOutput = (outputAmount * slippageFactor) / BigInt(100);
    return minOutput;
  }

  /**
   * Build Uniswap V3 swap transaction (for exactInputSingle)
   * @param {string} tokenIn - Input token symbol (e.g., 'USDC', 'WETH')
   * @param {string} tokenOut - Output token symbol (e.g., 'WETH', 'USDC')
   * @param {BigInt | string | number} amountIn - Input amount in wei
   * @param {string} walletAddress - Wallet address performing swap
   * @param {Object} options - Additional options
   * @param {number} options.slippage - Slippage percentage (default 3%)
   * @param {number} options.fee - Uniswap pool fee tier (default 500 = 0.05%)
   * @returns {Promise<Object>} Transaction data ready for execution
   */
  async function buildSwapTransaction(tokenIn, tokenOut, amountIn, walletAddress, options = {}) {
    if (!tokenIn || !tokenOut || !amountIn || !walletAddress) {
      throw new Error('tokenIn, tokenOut, amountIn, and walletAddress are required');
    }

    try {
      // Validate token pair
      validateTokenPair(tokenIn, tokenOut);

      const { slippage = 3, fee = 500 } = options;

      const tokenInMeta = getTokenMetadata(tokenIn);
      const tokenOutMeta = getTokenMetadata(tokenOut);

      const amountInBigInt = BigInt(amountIn.toString());

      // For now, use a simple swap ratio calculation
      // In production, this would call Uniswap quoter or on-chain pricing
      let expectedOutput;

      if (tokenIn.toUpperCase() === 'USDC' && tokenOutMeta.symbol.toUpperCase() === 'WETH') {
        // USDC has 6 decimals, WETH has 18
        // Approximate ratio: 1 USDC ≈ 0.0004 WETH (at ~2500 USD/ETH)
        // More precise: use (USDC amount / 2500) * 10^12
        expectedOutput = (amountInBigInt * BigInt(10 ** 12)) / BigInt(2500);
      } else if (tokenIn.toUpperCase() === 'WETH' && tokenOutMeta.symbol.toUpperCase() === 'USDC') {
        // WETH to USDC: reverse ratio
        // ~2500 USDC per ETH
        expectedOutput = (amountInBigInt * BigInt(2500)) / BigInt(10 ** 12);
      } else {
        throw new Error('Unsupported token pair for swap building');
      }

      const minOutput = calculateMinimumOutput(expectedOutput, slippage);

      // Build Uniswap V3 exactInputSingle params
      // See: https://docs.uniswap.org/contracts/v3/reference/core/SwapRouter#exactinputsingle
      const swapParams = {
        tokenIn: tokenInMeta.address,
        tokenOut: tokenOutMeta.address,
        fee, // Pool fee tier (500 = 0.05%, 3000 = 0.3%, 10000 = 1%)
        recipient: walletAddress,
        deadline: Math.floor(Date.now() / 1000) + 300, // 5 minutes
        amountIn: amountInBigInt,
        amountOutMinimum: minOutput,
        sqrtPriceLimitX96: 0, // No price limit
      };

      return {
        params: swapParams,
        tokenIn: tokenInMeta,
        tokenOut: tokenOutMeta,
        amountIn: amountInBigInt,
        expectedOutput,
        minOutput,
      };
    } catch (err) {
      if (err.statusCode) {
        throw err;
      }
      const error = new Error(`Failed to build swap transaction: ${err.message}`);
      error.statusCode = 400;
      throw error;
    }
  }

  /**
   * Validate swap balance before execution
   * @param {string} walletAddress - Wallet address to check
   * @param {string} tokenIn - Input token symbol (e.g., 'USDC', 'WETH')
   * @param {BigInt | string | number} amount - Amount to swap in wei
   * @returns {Promise<Object>} Current balance object {ETH, USDC}
   */
  async function validateSwapBalance(walletAddress, tokenIn, amount) {
    if (!walletAddress || !tokenIn || !amount) {
      throw new Error('walletAddress, tokenIn, and amount are required');
    }

    if (!ethers.isAddress(walletAddress)) {
      throw new Error('Invalid wallet address');
    }

    try {
      const tokenMeta = getTokenMetadata(tokenIn);
      const amountBigInt = BigInt(amount.toString());

      // For WETH, check ETH balance; for USDC, check token balance
      let balance;
      if (tokenIn.toUpperCase() === 'WETH') {
        const ethBalance = await balanceService.getEthBalance(walletAddress);
        // Convert ETH to wei for comparison
        const ethBalanceWei = ethers.parseEther(ethBalance.toString());
        balance = ethBalanceWei;

        if (balance < amountBigInt) {
          const error = new Error(
            `Insufficient ETH balance. Required: ${ethers.formatEther(amountBigInt)} ETH, Available: ${ethBalance} ETH`
          );
          error.statusCode = 400;
          throw error;
        }
      } else if (tokenIn.toUpperCase() === 'USDC') {
        const usdcBalance = await balanceService.getTokenBalance(
          walletAddress,
          tokenMeta.address,
          tokenMeta.decimals
        );
        // Convert token balance to wei for comparison
        const usdcBalanceWei = ethers.parseUnits(usdcBalance.toString(), tokenMeta.decimals);
        balance = usdcBalanceWei;

        if (balance < amountBigInt) {
          const error = new Error(
            `Insufficient ${tokenIn} balance. Required: ${ethers.formatUnits(amountBigInt, tokenMeta.decimals)} ${tokenIn}, Available: ${usdcBalance} ${tokenIn}`
          );
          error.statusCode = 400;
          throw error;
        }
      }

      // Fetch full balance snapshot for response
      const balanceSnapshot = await balanceService.getVaultBalances(walletAddress);
      return balanceSnapshot;
    } catch (err) {
      if (err.statusCode) {
        throw err;
      }
      const error = new Error(`Balance validation failed: ${err.message}`);
      error.statusCode = 502;
      throw error;
    }
  }

  /**
   * Get provider instance (for swap execution)
   * @returns {ethers.JsonRpcProvider} Ethers provider instance
   */
  function getProvider() {
    const rpcUrl = process.env.RPC_URL || tokenCatalog.rpcUrl;

    if (!rpcUrl) {
      throw new Error('RPC_URL is not configured');
    }

    return new ethers.JsonRpcProvider(rpcUrl);
  }

  /**
   * Reconstruct vault wallet from encrypted private key
   * @param {BigInt | string} vaultId - Vault Prisma ID
   * @returns {Promise<ethers.Wallet>} Reconstructed wallet with signer
   */
  async function reconstructVaultWallet(vaultId) {
    if (!vaultId) {
      throw new Error('Vault ID is required');
    }

    try {
      const vault = await prisma.vault.findUnique({
        where: { id: vaultId },
      });

      if (!vault) {
        const error = new Error('Vault not found');
        error.statusCode = 404;
        throw error;
      }

      const provider = getProvider();
      const decryptedPrivateKey = cryptoUtil.decrypt(vault.encryptedPrivateKey);
      const wallet = new ethers.Wallet(decryptedPrivateKey, provider);

      // Validate wallet address matches vault
      if (wallet.address.toLowerCase() !== vault.walletAddress.toLowerCase()) {
        throw new Error('Wallet address mismatch with vault');
      }

      return wallet;
    } catch (err) {
      if (err.statusCode) {
        throw err;
      }
      const error = new Error(`Failed to reconstruct vault wallet: ${err.message}`);
      error.statusCode = 500;
      throw error;
    }
  }

function validateTokenPair(tokenIn, tokenOut) {
  const validPairs = [
    ['USDC', 'WETH'],
    ['WETH', 'USDC'],
  ];

  const tokenInUpper = tokenIn.toUpperCase();
  const tokenOutUpper = tokenOut.toUpperCase();

  const isValid = validPairs.some(([in_, out]) => in_ === tokenInUpper && out === tokenOutUpper);

  if (!isValid) {
    const error = new Error(`Invalid token pair: ${tokenIn} -> ${tokenOut}. Only USDC <-> WETH swaps are supported.`);
    error.statusCode = 400;
    throw error;
  }
}

module.exports = {
  UNISWAP_V3_ROUTER_ADDRESS,
  ERC20_ABI,
  UNISWAP_V3_ROUTER_ABI,
  getProvider,
  getUniswapRouter,
  checkERC20Allowance,
  approveERC20Token,
  reconstructVaultWallet,
  validateSwapBalance,
  buildSwapTransaction,
  calculateMinimumOutput,
  executeApprovalFlow,
  executeSwapTransaction,
  getTokenMetadata,
  validateTokenPair,
};
