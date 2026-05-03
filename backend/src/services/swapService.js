const prisma = require('../db/prisma');

/**
 * Log a manual swap transaction to the database
 * Called after user executes swap through MetaMask
 */
async function logSwapTransaction(swapData) {
  const { walletAddress, agentId, tokenIn, tokenOut, amount, txHash, status = 'pending' } = swapData;

  if (!walletAddress || !tokenIn || !tokenOut || !amount) {
    throw new Error('Missing required fields: walletAddress, tokenIn, tokenOut, amount');
  }

  try {
    const transaction = await prisma.swapTransaction.create({
      data: {
        agentId: agentId || 'default',
        walletAddress,
        tokenIn,
        tokenOut,
        amount: amount.toString(),
        txHash: txHash || null,
        status,
        source: agentId ? 'agent' : 'manual',
      },
    });

    // Increment agent reputation score if swap was successful
    if (agentId && agentId !== 'default' && status === 'SUCCESS') {
      try {
        await prisma.agent.update({
          where: { id: agentId },
          data: {
            reputationScore: {
              increment: 10
            }
          }
        });
        console.log(`[swapService] Incremented reputation score for agent ${agentId} (+10)`);
      } catch (err) {
        console.warn(`[swapService] Failed to increment reputation score for agent ${agentId}:`, err.message);
      }
    }

    return {
      success: true,
      transactionId: transaction.id,
      transaction,
    };
  } catch (error) {
    console.error('Error logging swap transaction:', error);
    throw new Error(`Failed to log swap transaction: ${error.message}`);
  }
}

/**
 * Get transaction history for a wallet
 */
async function getTransactionHistory(walletAddress, limit = 50) {
  try {
    const transactions = await prisma.swapTransaction.findMany({
      where: { walletAddress },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return transactions;
  } catch (error) {
    console.error('Error fetching transaction history:', error);
    throw new Error(`Failed to fetch transaction history: ${error.message}`);
  }
}

/**
 * Update transaction status after confirmation
 */
async function updateTransactionStatus(txId, status, txHash = null) {
  try {
    const transaction = await prisma.swapTransaction.update({
      where: { id: txId },
      data: {
        status,
        ...(txHash && { txHash }),
        updatedAt: new Date(),
      },
    });

    return transaction;
  } catch (error) {
    console.error('Error updating transaction:', error);
    throw new Error(`Failed to update transaction: ${error.message}`);
  }
}

module.exports = {
  logSwapTransaction,
  getTransactionHistory,
  updateTransactionStatus,
};
