const express = require('express');
const router = express.Router();
const prisma = require('../src/db/prisma');
const balanceService = require('../src/services/balanceService');

/**
 * GET /api/vaults/list
 * Retrieve all agent vaults with live on-chain balances.
 */
router.get('/list', async (req, res) => {
  try {
    const vaults = await prisma.vault.findMany({
      include: {
        agent: {
          select: {
            name: true,
            agentId: true,
            status: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Fetch live balances for all vaults in parallel
    const vaultsWithLiveBalances = await Promise.all(vaults.map(async (v) => {
      try {
        const liveBalances = await balanceService.getVaultBalances(v.walletAddress);
        return { ...v, balance: liveBalances };
      } catch (err) {
        console.warn(`Failed to fetch live balance for vault ${v.walletAddress}:`, err.message);
        return v; // Fallback to DB balance if RPC fails
      }
    }));

    res.json({
      success: true,
      vaults: vaultsWithLiveBalances
        .filter(v => v.agent) // Skip any vaults with missing agent data (fixes DB inconsistency crash)
        .map(v => ({
          id: v.id,
          agentName: v.agent.name,
          agentId: v.agent.agentId,
          walletAddress: v.walletAddress,
          balance: v.balance,
          lockedBalance: v.lockedBalance,
          status: v.agent.status
        }))
    });
  } catch (err) {
    console.error('Error fetching vaults:', err);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch vaults',
      details: err.message
    });
  }
});

module.exports = router;
