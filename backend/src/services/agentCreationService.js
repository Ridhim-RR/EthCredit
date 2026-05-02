const prisma = require('../db/prisma');
const { createAgentWithVault } = require('./agentVaultService');

async function createAgentRecord({ walletAddress, message, signature }) {
  const agent = await createAgentWithVault({ walletAddress, message, signature });

  return {
    did: agent.did,
    agentId: agent.agentId,
    walletAddress: agent.walletAddress,
    reputationScore: agent.reputationScore,
    createdAt: agent.createdAt.toISOString(),
  };
}

async function listAgents() {
  const agents = await prisma.agent.findMany({
    orderBy: { createdAt: 'desc' },
  });

  return agents.map(agent => ({
    did: agent.did,
    agentId: agent.agentId,
    walletAddress: agent.walletAddress,
    reputationScore: agent.reputationScore,
    createdAt: agent.createdAt.toISOString(),
  }));
}

async function getAgentByDid(did) {
  const agent = await prisma.agent.findUnique({
    where: { did },
  });

  if (!agent) {
    return null;
  }

  return {
    did: agent.did,
    agentId: agent.agentId,
    walletAddress: agent.walletAddress,
    reputationScore: agent.reputationScore,
    createdAt: agent.createdAt.toISOString(),
  };
}

module.exports = {
  createAgentRecord,
  listAgents,
  getAgentByDid,
};
