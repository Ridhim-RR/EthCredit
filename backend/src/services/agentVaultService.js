const crypto = require('node:crypto');
const { ethers } = require('ethers');
const prisma = require('../db/prisma');
const walletService = require('./walletService');
const balanceService = require('./balanceService');

const EXPECTED_MESSAGE = 'Create EthCredit Agent';

function normalizeBalance(balance) {
  if (!balance || typeof balance !== 'object' || Array.isArray(balance)) {
    const ethValue = typeof balance === 'number' ? balance : 0;
    return { ETH: ethValue, USDC: 0 };
  }

  return {
    ETH: Number(balance.ETH || 0),
    USDC: Number(balance.USDC || 0),
  };
}

function normalizeMetadata(metadata) {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return {};
  }

  return metadata;
}

function createAgentId(seed) {
  return crypto
    .createHash('sha256')
    .update(`${seed}:${Date.now()}:${crypto.randomUUID()}`)
    .digest('hex');
}

function createDid(seed) {
  return `did:ethcredit:v1:${seed.toLowerCase()}`;
}

function verifySignature(message, signature, walletAddress) {
  if (!ethers.isHexString(signature, 65)) {
    return false;
  }

  const recoveredAddress = ethers.verifyMessage(message, signature);
  return recoveredAddress.toLowerCase() === walletAddress.toLowerCase();
}

async function ensureAgentVault(agentId) {
  const agent = await prisma.agent.findUnique({
    where: { id: agentId },
    include: { vault: true },
  });

  if (!agent) {
    const error = new Error(`Agent not found: ${agentId}`);
    error.statusCode = 404;
    throw error;
  }

  if (agent.vault) {
    return { agent, vault: agent.vault };
  }

  const wallet = walletService.createWallet();
  const encryptedPrivateKey = walletService.encryptPrivateKey(wallet.privateKey);

  const result = await prisma.$transaction(async (tx) => {
    const vault = await tx.vault.create({
      data: {
        agentId: agent.id,
        walletAddress: wallet.address,
        encryptedPrivateKey,
        balance: { ETH: 0, USDC: 0 },
      },
    });

    const updatedAgent = await tx.agent.update({
      where: { id: agent.id },
      data: {
        internalWalletAddress: vault.walletAddress,
        encryptedPrivateKey: vault.encryptedPrivateKey,
      },
    });

    return { agent: updatedAgent, vault };
  });

  return result;
}

async function createAgentWithVault(data = {}) {
  const { walletAddress, message, signature, name, metadata } = data;
  const hasAuthFlow = Boolean(walletAddress || message || signature);
  let identityWalletAddress = walletAddress;

  if (hasAuthFlow) {
    if (!walletAddress || !message || !signature) {
      const error = new Error('Invalid input');
      error.statusCode = 400;
      throw error;
    }

    if (!ethers.isAddress(walletAddress)) {
      const error = new Error('Invalid wallet address');
      error.statusCode = 400;
      throw error;
    }

    if (message !== EXPECTED_MESSAGE) {
      const error = new Error('Invalid message');
      error.statusCode = 400;
      throw error;
    }

    if (!verifySignature(message, signature, walletAddress)) {
      const error = new Error('Invalid signature');
      error.statusCode = 401;
      throw error;
    }
  } else {
    const generatedIdentityWallet = walletService.createWallet();
    identityWalletAddress = generatedIdentityWallet.address;
  }

  const existingAgent = await prisma.agent.findUnique({
    where: { walletAddress: identityWalletAddress },
    include: { vault: true },
  });

  if (existingAgent) {
    if (!existingAgent.vault) {
      await ensureAgentVault(existingAgent.id);
    }

    const agentWithVault = await prisma.agent.findUnique({
      where: { id: existingAgent.id },
      include: { vault: true },
    });

    return agentWithVault;
  }

  const agentId = createAgentId(identityWalletAddress);
  const did = createDid(identityWalletAddress || agentId);
  const vaultWallet = walletService.createWallet();
  const encryptedPrivateKey = walletService.encryptPrivateKey(vaultWallet.privateKey);
  const resolvedMetadata = {
    ...normalizeMetadata(metadata),
    createdVia: hasAuthFlow ? 'wallet-signature' : 'agent-register',
    timestamp: new Date().toISOString(),
  };

  return prisma.$transaction(async (tx) => {
    const agent = await tx.agent.create({
      data: {
        did,
        agentId,
        walletAddress: identityWalletAddress,
        name: name || `Agent-${agentId.substring(0, 8)}`,
        status: 'active',
        reputationScore: 0,
        metadata: resolvedMetadata,
        internalWalletAddress: vaultWallet.address,
        encryptedPrivateKey,
      },
    });

    const vault = await tx.vault.create({
      data: {
        agentId: agent.id,
        walletAddress: vaultWallet.address,
        encryptedPrivateKey,
        balance: { ETH: 0, USDC: 0 },
      },
    });

    return { ...agent, vault };
  });
}

async function getAgentVaultByAgentId(agentId) {
  const agent = await prisma.agent.findUnique({
    where: { id: agentId },
    include: { vault: true },
  });

  if (!agent) {
    return null;
  }

  return agent.vault ? { agent, vault: { ...agent.vault, balance: normalizeBalance(agent.vault.balance) } } : null;
}

async function getAgentVaultByAgentIdentifier(agentIdentifier) {
  // Lookup by the public `agentId` field (not the Prisma PK `id`).
  const agent = await prisma.agent.findUnique({
    where: { agentId: agentIdentifier },
    include: { vault: true },
  });

  if (!agent) {
    return null;
  }

  return agent.vault ? { agent, vault: { ...agent.vault, balance: normalizeBalance(agent.vault.balance) } } : null;
}

async function refreshAgentVaultBalanceByAgentIdentifier(agentIdentifier) {
  const result = await getAgentVaultByAgentIdentifier(agentIdentifier);
  
  if (!result?.agent) {
    const error = new Error('Agent not found');
    error.statusCode = 404;
    throw error;
  }
  
  let vault = result.vault;
  if (!vault) {
    // Auto-provision vault if agent exists but vault is missing (legacy data)
    const ensured = await ensureAgentVault(result.agent.id);
    vault = ensured.vault;
  }

  try {
    const refreshedBalance = await balanceService.getVaultBalances(vault.walletAddress);

    const updatedVault = await prisma.vault.update({
      where: { id: vault.id },
      data: { balance: refreshedBalance },
    });

    return {
      walletAddress: updatedVault.walletAddress,
      balance: normalizeBalance(updatedVault.balance),
    };
  } catch (err) {
    const error = new Error(`Failed to refresh vault balance: ${err.message}`);
    error.statusCode = err.statusCode || 502;
    throw error;
  }
}

module.exports = {
  EXPECTED_MESSAGE,
  normalizeBalance,
  createAgentId,
  createDid,
  verifySignature,
  ensureAgentVault,
  createAgentWithVault,
  getAgentVaultByAgentId,
  getAgentVaultByAgentIdentifier,
  refreshAgentVaultBalanceByAgentIdentifier,
};