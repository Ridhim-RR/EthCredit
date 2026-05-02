const express = require('express');
const walletProvisioningService = require('../src/services/walletProvisioningService');

const router = express.Router();

/**
 * POST /agent/:agentId/provision-wallet
 * Provisions a secure internal wallet for an agent
 * Idempotent: if wallet already exists, returns existing wallet address
 * 
 * Response:
 * - 200: { agentId, internalWalletAddress }
 * - 404: { error: "Agent not found" }
 * - 500: { error: "Server error message" }
 */
router.post('/agent/:agentId/provision-wallet', async (req, res) => {
  const { agentId } = req.params;

  try {
    // Basic validation
    if (!agentId || typeof agentId !== 'string' || agentId.trim() === '') {
      return res.status(400).json({
        error: 'Invalid agentId: must be a non-empty string',
      });
    }

    // Call service to provision wallet
    const result = await walletProvisioningService.provisionWalletForAgent(agentId);

    // Return only agentId and wallet address (never return encrypted key or private key)
    return res.status(200).json({
      agentId: result.agentId,
      internalWalletAddress: result.internalWalletAddress,
    });
  } catch (error) {
    // Log error safely (no sensitive data)
    console.error(
      '[walletProvisioning] Error provisioning wallet:',
      error.message,
      `for agentId: ${agentId}`
    );

    // Determine HTTP status code
    const statusCode = error.statusCode || 500;

    // Return error response
    return res.status(statusCode).json({
      error: error.message,
    });
  }
});

module.exports = router;
