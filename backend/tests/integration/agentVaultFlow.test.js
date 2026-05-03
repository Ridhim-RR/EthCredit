const { ethers } = require('ethers');
const prisma = require('../../src/db/prisma');
const walletService = require('../../src/services/walletService');

const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';

async function requestJson(path, options = {}) {
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
    },
    ...options,
  });

  const text = await response.text();
  let body = null;

  if (text) {
    try {
      body = JSON.parse(text);
    } catch (error) {
      body = { raw: text, parseError: error.message };
    }
  }

  return { status: response.status, body };
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function testAgentRegisterFlow() {
  const name = `VaultTest-${Date.now()}`;
  const metadata = { source: 'integration-test', mode: 'agent-register' };

  const createResponse = await requestJson('/agent/register', {
    method: 'POST',
    body: JSON.stringify({ name, metadata }),
  });

  assert(createResponse.status === 200, `Expected 200 from /agent/register, got ${createResponse.status}`);
  assert(createResponse.body?.agentId, 'agentId missing from /agent/register response');
  assert(createResponse.body?.did, 'did missing from /agent/register response');
  assert(createResponse.body?.walletAddress, 'walletAddress missing from /agent/register response');
  assert(ethers.isAddress(createResponse.body.walletAddress), 'walletAddress is not a valid address');

  const agent = await prisma.agent.findUnique({
    where: { agentId: createResponse.body.agentId },
    include: { vault: true },
  });

  assert(agent, 'Agent row not found after /agent/register');
  assert(agent.vault, 'Vault row not found after /agent/register');
  assert(agent.vault.walletAddress, 'Vault walletAddress missing');
  assert(agent.vault.encryptedPrivateKey, 'Vault encryptedPrivateKey missing');

  const reconstructedWallet = walletService.getWallet(agent.vault.encryptedPrivateKey);
  assert(
    reconstructedWallet.address === agent.vault.walletAddress,
    'Reconstructed wallet address does not match stored vault walletAddress'
  );

  const vaultResponse = await requestJson(`/agent/${agent.agentId}/vault`, {
    method: 'GET',
  });

  assert(vaultResponse.status === 200, `Expected 200 from /agent/:id/vault, got ${vaultResponse.status}`);
  assert(vaultResponse.body?.walletAddress === agent.vault.walletAddress, 'Vault API returned the wrong walletAddress');
  assert(typeof vaultResponse.body?.balance === 'object', 'Vault API did not return balance as an object');
  assert(typeof vaultResponse.body?.balance?.ETH === 'number', 'Vault API missing ETH balance number');
  assert(typeof vaultResponse.body?.balance?.USDC === 'number', 'Vault API missing USDC balance number');

  const refreshResponse = await requestJson(`/agent/${agent.agentId}/refresh-balance`, {
    method: 'POST',
  });

  // RPC can fail in local/offline environments; this still validates route behavior.
  if (refreshResponse.status === 200) {
    assert(
      refreshResponse.body?.walletAddress === agent.vault.walletAddress,
      'Refresh API returned the wrong walletAddress'
    );
    assert(typeof refreshResponse.body?.balance?.ETH === 'number', 'Refresh API missing ETH balance');
    assert(typeof refreshResponse.body?.balance?.USDC === 'number', 'Refresh API missing USDC balance');
  } else {
    assert(
      refreshResponse.status === 500 || refreshResponse.status === 502,
      `Expected 200 or RPC error from refresh endpoint, got ${refreshResponse.status}`
    );
    assert(typeof refreshResponse.body?.error === 'string', 'Refresh error response missing error message');
  }

  await prisma.agent.delete({ where: { id: agent.id } });

  return {
    name: 'agent/register flow',
    agentId: createResponse.body.agentId,
    walletAddress: createResponse.body.walletAddress,
  };
}

async function testRegisterAgentAlias() {
  const userWallet = ethers.Wallet.createRandom();
  const message = 'Create EthCredit Agent';
  const signature = await userWallet.signMessage(message);

  const createResponse = await requestJson('/register-agent', {
    method: 'POST',
    body: JSON.stringify({
      walletAddress: userWallet.address,
      message,
      signature,
    }),
  });

  assert(createResponse.status === 200, `Expected 200 from /register-agent, got ${createResponse.status}`);
  assert(createResponse.body?.agentId, 'agentId missing from /register-agent response');
  assert(createResponse.body?.did, 'did missing from /register-agent response');
  assert(!('walletAddress' in createResponse.body), '/register-agent should not expose walletAddress');

  const agent = await prisma.agent.findUnique({
    where: { agentId: createResponse.body.agentId },
    include: { vault: true },
  });

  assert(agent, 'Agent row not found after /register-agent');
  assert(agent.vault, 'Vault row not found after /register-agent');
  assert(agent.vault.walletAddress, 'Vault walletAddress missing after /register-agent');
  assert(agent.vault.encryptedPrivateKey, 'Vault encryptedPrivateKey missing after /register-agent');

  const decryptedWallet = walletService.getWallet(agent.vault.encryptedPrivateKey);
  assert(decryptedWallet.address === agent.vault.walletAddress, 'Decrypted wallet does not match vault walletAddress');

  await prisma.agent.delete({ where: { id: agent.id } });

  return {
    name: 'register-agent alias',
    agentId: createResponse.body.agentId,
    did: createResponse.body.did,
  };
}

async function main() {
  try {
    const health = await requestJson('/health');
    assert(health.status === 200 || health.status === 503, 'Health endpoint did not respond');

    const results = [
      await testAgentRegisterFlow(),
      await testRegisterAgentAlias(),
    ];

    console.log('Integration tests passed:');
    for (const result of results) {
      console.log(`- ${result.name}`);
    }
    await prisma.$disconnect();
    process.exit(0);
  } catch (error) {
    console.error('Integration tests failed:');
    console.error(error.message);
    await prisma.$disconnect();
    process.exit(1);
  }
}

main();
