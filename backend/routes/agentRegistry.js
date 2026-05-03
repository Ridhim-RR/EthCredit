const express = require('express');
const {
  createAgentWithVault,
  getAgentVaultByAgentId,
  getAgentVaultByAgentIdentifier,
  refreshAgentVaultBalanceByAgentIdentifier,
} = require('../src/services/agentVaultService');

const router = express.Router();

router.post('/register-agent', async (req, res) => {
  try {
    const { walletAddress, message, signature } = req.body || {};
    const agent = await createAgentWithVault({ walletAddress, message, signature });

    return res.json({
      agentId: agent.agentId,
      did: agent.did,
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ error: error.message || 'Failed to register agent' });
  }
});

router.post('/agent/register', async (req, res) => {
  try {
    const { name, metadata } = req.body || {};
    const agent = await createAgentWithVault({ name, metadata });

    return res.json({
      agentId: agent.agentId,
      did: agent.did,
      walletAddress: agent.vault?.walletAddress,
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ error: error.message || 'Failed to register agent' });
  }
});

router.get('/agent/:id/vault', async (req, res) => {
  try {
    const { id: agentId } = req.params;
    const result = await getAgentVaultByAgentIdentifier(agentId);

    if (!result?.vault) {
      return res.status(404).json({ error: 'Vault not found' });
    }

    return res.json({
      walletAddress: result.vault.walletAddress,
      balance: result.vault.balance,
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ error: error.message || 'Failed to fetch vault' });
  }
});

router.post('/agent/:id/refresh-balance', async (req, res) => {
  try {
    const { id: agentId } = req.params;
    const refreshed = await refreshAgentVaultBalanceByAgentIdentifier(agentId);

    return res.json({
      walletAddress: refreshed.walletAddress,
      balance: refreshed.balance,
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ error: error.message || 'Failed to refresh balance' });
  }
});

// Public convenience route: lookup vault by public `agentId` (the value returned on create)
router.get('/agent/by-agent-id/:agentId/vault', async (req, res) => {
  try {
    const { agentId } = req.params;
    const result = await getAgentVaultByAgentIdentifier(agentId);

    if (!result?.vault) {
      return res.status(404).json({ error: 'Vault not found' });
    }

    return res.json({
      walletAddress: result.vault.walletAddress,
      balance: result.vault.balance,
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ error: error.message || 'Failed to fetch vault' });
  }
});

module.exports = router;