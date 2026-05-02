const walletService = require('./walletService');
const { ensureAgentVault, getAgentVaultByAgentId } = require('./agentVaultService');

/**
 * Provisions a secure internal wallet for an agent
 * Idempotent: if wallet already exists, returns existing address
 * @param {string} agentId - Agent ID (must exist in database)
 * @returns {Object} { agentId, internalWalletAddress }
 * @throws {Error} If agent not found or provisioning fails
 */
async function provisionWalletForAgent(agentId) {
  try {
    if (!agentId || typeof agentId !== 'string') {
      const error = new Error('Invalid agentId: must be a non-empty string');
      error.statusCode = 400;
      throw error;
    }

    const result = await ensureAgentVault(agentId);

    console.log(`[keyProvisioning] Wallet successfully provisioned for agent ${agentId}`);

    return {
      agentId: result.agent.id,
      internalWalletAddress: result.vault.walletAddress,
    };
  } catch (error) {
    console.error(`[keyProvisioning] Error provisioning wallet for agent ${agentId}:`, error.message);
    if (!error.statusCode) {
      error.statusCode = 500;
    }
    throw error;
  }
}

/**
 * Retrieves and decrypts the internal wallet for an agent
 * For internal use only - enables autonomous transaction signing
 * @param {string} agentId - Agent ID
 * @returns {Object} ethers.Wallet instance ready for signing
 * @throws {Error} If agent/wallet not found or decryption fails
 */
async function getInternalWallet(agentId) {
  try {
    if (!agentId || typeof agentId !== 'string') {
      const error = new Error('Invalid agentId: must be a non-empty string');
      error.statusCode = 400;
      throw error;
    }

    const result = await getAgentVaultByAgentId(agentId);

    if (!result || !result.vault) {
      const error = new Error(`Agent ${agentId} has no provisioned internal wallet`);
      error.statusCode = 400;
      throw error;
    }

    console.log(`[keyProvisioning] Retrieving internal wallet for agent ${agentId}`);

    const wallet = walletService.getWallet(result.vault.encryptedPrivateKey);

    // Verify address matches
    if (wallet.address !== result.vault.walletAddress) {
      const error = new Error('Wallet address mismatch: decrypted key does not match stored address');
      error.statusCode = 500;
      throw error;
    }

    console.log(`[keyProvisioning] Internal wallet retrieved for agent ${agentId}`);

    return wallet;
  } catch (error) {
    console.error(`[keyProvisioning] Error retrieving internal wallet for agent ${agentId}:`, error.message);
    if (!error.statusCode) {
      error.statusCode = 500;
    }
    throw error;
  }
}

module.exports = {
  provisionWalletForAgent,
  getInternalWallet,
};
