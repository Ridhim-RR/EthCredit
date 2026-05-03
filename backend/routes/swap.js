const express = require('express');
const router = express.Router();
const { logSwapTransaction, getTransactionHistory, updateTransactionStatus } = require('../src/services/swapService');
const { getTokenCatalog } = require('../src/config/tokenCatalog');
const agentVaultService = require('../src/services/agentVaultService');
const swapExecutionService = require('../src/services/swapExecutionService');
const { ethers } = require('ethers');

/**
 * GET /swap/tokens
 * Return Base Sepolia token catalog for the frontend swap dropdowns.
 */
router.get('/tokens', async (req, res) => {
  try {
    // Return a stable JSON envelope so frontend can rely on `data` and `success`
    res.json({ success: true, data: getTokenCatalog() });
  } catch (err) {
    console.error('Error loading token catalog:', err.message);
    res.status(500).json({ error: err.message || 'Failed to load token catalog' });
  }
});

/**
 * POST /swap/log
 * Log a manual swap transaction (called after frontend executes swap via MetaMask)
 */
router.post('/log', async (req, res) => {
  try {
    const { walletAddress, agentId, tokenIn, tokenOut, amount, txHash, status } = req.body;

    // Validate required fields
    if (!walletAddress || !tokenIn || !tokenOut || !amount) {
      return res.status(400).json({
        error: 'Missing required fields: walletAddress, tokenIn, tokenOut, amount',
      });
    }

    const result = await logSwapTransaction({
      walletAddress,
      agentId,
      tokenIn,
      tokenOut,
      amount,
      txHash,
      status: status || 'pending',
    });

    res.json(result);
  } catch (err) {
    console.error('Error logging swap:', err.message);
    res.status(500).json({ error: err.message || 'Failed to log swap transaction' });
  }
});

/**
 * GET /swap/history/:walletAddress
 * Retrieve swap transaction history for a wallet
 */
router.get('/history/:walletAddress', async (req, res) => {
  try {
    const { walletAddress } = req.params;
    const { limit = 50 } = req.query;

    const transactions = await getTransactionHistory(walletAddress, Number.parseInt(limit, 10));
    res.json({ transactions });
  } catch (err) {
    console.error('Error fetching transaction history:', err.message);
    res.status(500).json({ error: err.message || 'Failed to fetch transaction history' });
  }
});

/**
 * PATCH /swap/:txId/status
 * Update transaction status after confirmation
 */
router.patch('/:txId/status', async (req, res) => {
  try {
    const { txId } = req.params;
    const { status, txHash } = req.body;

    if (!status) {
      return res.status(400).json({ error: 'Status is required' });
    }

    const transaction = await updateTransactionStatus(txId, status, txHash);
    res.json({ success: true, transaction });
  } catch (err) {
    console.error('Error updating transaction:', err.message);
    res.status(500).json({ error: err.message || 'Failed to update transaction' });
  }
});

/**
 * POST /swap/quote
 * Get quote for a swap (placeholder)
 */
router.post('/quote', async (req, res) => {
  try {
    const { tokenIn, tokenOut, amount } = req.body;

    if (!tokenIn || !tokenOut || !amount) {
      return res.status(400).json({
        error: 'Missing required fields: tokenIn, tokenOut, amount',
      });
    }

    // Validate token pair
    try {
      swapExecutionService.validateTokenPair(tokenIn, tokenOut);
    } catch (err) {
      return res.status(err.statusCode || 400).json({ error: err.message });
    }

    res.json({
      tokenIn,
      tokenOut,
      amountIn: amount,
      message: 'Quote service coming soon',
    });
  } catch (err) {
    console.error('Error getting swap quote:', err.message);
    res.status(500).json({ error: err.message || 'Failed to get swap quote' });
  }
});

/**
 * POST /swap/execute
 * Execute a backend-driven swap using vault wallet (Phases 5-7)
 */
router.post('/execute', async (req, res) => {
  try {
    const { agentId, tokenIn, tokenOut, amount } = req.body;

    // Phase 5: Validate input
    if (!agentId || !tokenIn || !tokenOut || !amount) {
      return res.status(400).json({
        error: 'Missing required fields: agentId, tokenIn, tokenOut, amount',
      });
    }

    // Phase 5: Validate token pair
    try {
      swapExecutionService.validateTokenPair(tokenIn, tokenOut);
    } catch (err) {
      return res.status(err.statusCode || 400).json({ error: err.message });
    }

    // Phase 5: Resolve agentId to vault
    let vaultData;
    try {
      vaultData = await agentVaultService.getAgentVaultByAgentIdentifier(agentId);

      if (!vaultData || !vaultData.vault) {
        return res.status(404).json({
          error: 'Agent or vault not found',
        });
      }
    } catch (err) {
      console.error('Error fetching vault:', err.message);
      return res.status(err.statusCode || 500).json({ error: err.message });
    }

    const vault = vaultData.vault;
    const walletAddress = vault.walletAddress;

    // Phase 5: Validate balance before proceeding
    let currentBalance;
    try {
      const amountBigInt = BigInt(amount.toString());
      currentBalance = await swapExecutionService.validateSwapBalance(walletAddress, tokenIn, amountBigInt);
    } catch (err) {
      console.error('Balance validation error:', err.message);
      return res.status(err.statusCode || 400).json({ error: err.message });
    }

    // Phase 4: Build swap transaction
    let swapTxData;
    try {
      const amountBigInt = BigInt(amount.toString());
      swapTxData = await swapExecutionService.buildSwapTransaction(
        tokenIn,
        tokenOut,
        amountBigInt,
        walletAddress
      );
    } catch (err) {
      console.error('Swap building error:', err.message);
      return res.status(err.statusCode || 400).json({ error: err.message });
    }

    // Phase 2: Reconstruct vault wallet
    let wallet;
    try {
      wallet = await swapExecutionService.reconstructVaultWallet(vault.id);
    } catch (err) {
      console.error('Wallet reconstruction error:', err.message);
      return res.status(err.statusCode || 500).json({ error: err.message });
    }

    // Phase 6: Execute approval flow (if needed)
    let approvalResult;
    try {
      const amountBigInt = BigInt(amount.toString());
      approvalResult = await swapExecutionService.executeApprovalFlow(wallet, tokenIn, amountBigInt);
    } catch (err) {
      console.error('Approval flow error:', err.message);
      return res.status(err.statusCode || 500).json({ error: err.message });
    }

    // Phase 7: Execute swap transaction
    let swapResult;
    try {
      swapResult = await swapExecutionService.executeSwapTransaction(wallet, swapTxData, agentId);
    } catch (err) {
      console.error('Swap execution error:', err.message);
      return res.status(err.statusCode || 500).json({ error: err.message });
    }

    // Success response
    res.json({
      status: 'SUCCESS',
      agentId,
      walletAddress,
      tokenIn,
      tokenOut,
      amount: amount.toString(),
      currentBalance,
      approval: approvalResult,
      txHash: swapResult.txHash,
      logId: swapResult.logId,
    });
  } catch (err) {
    console.error('Error executing swap:', err.message);
    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({ error: err.message || 'Failed to execute swap' });
  }
});

module.exports = router;
