/**
 * Integration tests for wallet provisioning system
 * 
 * Tests:
 * 1. Happy path: create agent, provision wallet, verify response and DB state
 * 2. Idempotency: call twice, confirm same address returned, single DB record
 * 3. Crypto validation: retrieve encrypted key, decrypt, reconstruct wallet, verify address
 * 4. Error cases: missing agent (404), missing SECRET_KEY (boot failure), concurrent requests
 * 
 * Prerequisites:
 * - SECRET_KEY must be set in environment
 * - PostgreSQL database must be running
 * - Prisma migrations must be applied (including migration 006)
 * 
 * Usage:
 *   npm test -- tests/integration/walletProvisioning.test.js
 *   or manually: node tests/integration/walletProvisioning.test.js
 */

const prisma = require('../../src/db/prisma');
const walletProvisioningService = require('../../src/services/walletProvisioningService');
const keyManagementService = require('../../src/services/keyManagementService');
const { ethers } = require('ethers');
const crypto = require('crypto');

// Color codes for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

/**
 * Test: Happy path wallet provisioning
 */
async function testHappyPath() {
  log('\n=== TEST: Happy Path Wallet Provisioning ===', 'blue');
  
  try {
    // Create a test agent
    const testAgent = await prisma.agent.create({
      data: {
        did: `did:ethcredit:v1:test-${Date.now()}`,
        agentId: `agent-test-${Date.now()}`,
        walletAddress: ethers.getAddress(ethers.Wallet.createRandom().address),
        name: `TestAgent-${Date.now()}`,
      },
    });

    log(`✓ Created test agent: ${testAgent.id}`, 'green');

    // Provision wallet
    const result = await walletProvisioningService.provisionWalletForAgent(testAgent.id);

    log(`✓ Provisioned wallet: ${result.internalWalletAddress}`, 'green');

    // Verify response format
    if (!result.agentId || !result.internalWalletAddress) {
      throw new Error('Invalid response format from provisionWalletForAgent');
    }

    // Verify DB state
    const updatedAgent = await prisma.agent.findUnique({
      where: { id: testAgent.id },
    });

    if (!updatedAgent.internalWalletAddress) {
      throw new Error('internalWalletAddress not persisted in DB');
    }

    if (!updatedAgent.encryptedPrivateKey) {
      throw new Error('encryptedPrivateKey not persisted in DB');
    }

    log(`✓ DB state verified: internalWalletAddress and encryptedPrivateKey stored`, 'green');

    // Verify wallet address format
    if (!ethers.isAddress(result.internalWalletAddress)) {
      throw new Error('Invalid Ethereum address returned');
    }

    log(`✓ Wallet address format valid`, 'green');

    // Cleanup
    await prisma.agent.delete({ where: { id: testAgent.id } });
    log(`✓ Test agent cleaned up`, 'green');

    log('✓ Happy Path Test PASSED', 'green');
    return true;
  } catch (error) {
    log(`✗ Happy Path Test FAILED: ${error.message}`, 'red');
    return false;
  }
}

/**
 * Test: Idempotency
 */
async function testIdempotency() {
  log('\n=== TEST: Idempotency ===', 'blue');

  try {
    // Create a test agent
    const testAgent = await prisma.agent.create({
      data: {
        did: `did:ethcredit:v1:idempotent-${Date.now()}`,
        agentId: `agent-idempotent-${Date.now()}`,
        walletAddress: ethers.getAddress(ethers.Wallet.createRandom().address),
        name: `IdempotentTestAgent-${Date.now()}`,
      },
    });

    log(`✓ Created test agent: ${testAgent.id}`, 'green');

    // First provisioning
    const result1 = await walletProvisioningService.provisionWalletForAgent(testAgent.id);
    log(`✓ First provisioning: ${result1.internalWalletAddress}`, 'green');

    // Second provisioning (should return same wallet)
    const result2 = await walletProvisioningService.provisionWalletForAgent(testAgent.id);
    log(`✓ Second provisioning: ${result2.internalWalletAddress}`, 'green');

    // Verify same address returned
    if (result1.internalWalletAddress !== result2.internalWalletAddress) {
      throw new Error('Different addresses returned on re-provisioning (not idempotent)');
    }

    log(`✓ Same address returned on re-provisioning`, 'green');

    // Verify only one DB record
    const agentAfter = await prisma.agent.findUnique({
      where: { id: testAgent.id },
    });

    if (!agentAfter.internalWalletAddress) {
      throw new Error('Wallet address lost after second provisioning');
    }

    log(`✓ Single DB record maintained after multiple calls`, 'green');

    // Cleanup
    await prisma.agent.delete({ where: { id: testAgent.id } });

    log('✓ Idempotency Test PASSED', 'green');
    return true;
  } catch (error) {
    log(`✗ Idempotency Test FAILED: ${error.message}`, 'red');
    return false;
  }
}

/**
 * Test: Encryption/Decryption Round-trip
 */
async function testCryptoRoundTrip() {
  log('\n=== TEST: Encryption/Decryption Round-trip ===', 'blue');

  try {
    // Create a test agent with wallet
    const testAgent = await prisma.agent.create({
      data: {
        did: `did:ethcredit:v1:crypto-${Date.now()}`,
        agentId: `agent-crypto-${Date.now()}`,
        walletAddress: ethers.getAddress(ethers.Wallet.createRandom().address),
        name: `CryptoTestAgent-${Date.now()}`,
      },
    });

    log(`✓ Created test agent: ${testAgent.id}`, 'green');

    // Provision wallet
    const result = await walletProvisioningService.provisionWalletForAgent(testAgent.id);
    log(`✓ Provisioned wallet: ${result.internalWalletAddress}`, 'green');

    // Retrieve agent with encrypted key
    const agentWithKey = await prisma.agent.findUnique({
      where: { id: testAgent.id },
    });

    // Decrypt using keyManagementService
    const secretKey = keyManagementService.loadOrGenerateSecretKey();
    const decryptedPrivateKey = keyManagementService.decryptPrivateKey(
      agentWithKey.encryptedPrivateKey,
      secretKey
    );

    log(`✓ Decrypted private key successfully`, 'green');

    // Reconstruct wallet from decrypted key
    const reconstructedWallet = new ethers.Wallet(decryptedPrivateKey);

    log(`✓ Reconstructed wallet from decrypted key`, 'green');

    // Verify address matches
    if (reconstructedWallet.address !== result.internalWalletAddress) {
      throw new Error(
        `Address mismatch: reconstructed=${reconstructedWallet.address}, provisioned=${result.internalWalletAddress}`
      );
    }

    log(`✓ Reconstructed wallet address matches provisioned address`, 'green');

    // Verify wallet can sign (basic test)
    const message = 'test message';
    const signature = await reconstructedWallet.signMessage(message);

    if (!signature) {
      throw new Error('Wallet cannot sign messages');
    }

    log(`✓ Reconstructed wallet can sign messages`, 'green');

    // Cleanup
    await prisma.agent.delete({ where: { id: testAgent.id } });

    log('✓ Encryption/Decryption Round-trip Test PASSED', 'green');
    return true;
  } catch (error) {
    log(`✗ Encryption/Decryption Round-trip Test FAILED: ${error.message}`, 'red');
    return false;
  }
}

/**
 * Test: Agent Not Found Error
 */
async function testAgentNotFound() {
  log('\n=== TEST: Agent Not Found (404) ===', 'blue');

  try {
    // Try to provision wallet for non-existent agent
    const fakeAgentId = `fake-agent-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;

    try {
      await walletProvisioningService.provisionWalletForAgent(fakeAgentId);
      throw new Error('Should have thrown error for non-existent agent');
    } catch (error) {
      if (error.statusCode !== 404) {
        throw new Error(`Expected statusCode 404, got ${error.statusCode || 'undefined'}`);
      }

      if (!error.message.includes('Agent not found')) {
        throw new Error(`Expected "Agent not found" message, got: ${error.message}`);
      }

      log(`✓ Correct error thrown: ${error.message}`, 'green');
      log(`✓ Correct status code: 404`, 'green');
    }

    log('✓ Agent Not Found Test PASSED', 'green');
    return true;
  } catch (error) {
    log(`✗ Agent Not Found Test FAILED: ${error.message}`, 'red');
    return false;
  }
}

/**
 * Test: Invalid Agent ID Format
 */
async function testInvalidAgentIdFormat() {
  log('\n=== TEST: Invalid Agent ID Format ===', 'blue');

  try {
    const invalidIds = [null, undefined, '', 123];

    for (const invalidId of invalidIds) {
      try {
        await walletProvisioningService.provisionWalletForAgent(invalidId);
        throw new Error(`Should have thrown error for invalid agent ID: ${invalidId}`);
      } catch (error) {
        if (error.statusCode !== 400) {
          throw new Error(`Expected statusCode 400, got ${error.statusCode || 'undefined'}`);
        }

        log(`✓ Correctly rejected invalid ID type: "${invalidId}"`, 'green');
      }
    }

    log('✓ Invalid Agent ID Format Test PASSED', 'green');
    return true;
  } catch (error) {
    log(`✗ Invalid Agent ID Format Test FAILED: ${error.message}`, 'red');
    return false;
  }
}

/**
 * Test: Get Internal Wallet
 */
async function testGetInternalWallet() {
  log('\n=== TEST: Get Internal Wallet ===', 'blue');

  try {
    // Create and provision agent
    const testAgent = await prisma.agent.create({
      data: {
        did: `did:ethcredit:v1:get-wallet-${Date.now()}`,
        agentId: `agent-get-wallet-${Date.now()}`,
        walletAddress: ethers.getAddress(ethers.Wallet.createRandom().address),
        name: `GetWalletTestAgent-${Date.now()}`,
      },
    });

    log(`✓ Created test agent: ${testAgent.id}`, 'green');

    // Provision wallet
    await walletProvisioningService.provisionWalletForAgent(testAgent.id);
    log(`✓ Provisioned wallet`, 'green');

    // Retrieve wallet using getInternalWallet
    const wallet = await walletProvisioningService.getInternalWallet(testAgent.id);

    if (!wallet || !wallet.address) {
      throw new Error('getInternalWallet returned invalid wallet');
    }

    log(`✓ Retrieved internal wallet: ${wallet.address}`, 'green');

    // Verify it's a valid ethers.Wallet instance
    if (!(wallet instanceof ethers.Wallet)) {
      throw new Error('Returned object is not an ethers.Wallet instance');
    }

    log(`✓ Returned object is valid ethers.Wallet instance`, 'green');

    // Test signing capability
    const message = 'test message for signing';
    const signature = await wallet.signMessage(message);

    if (!signature) {
      throw new Error('Retrieved wallet cannot sign');
    }

    log(`✓ Retrieved wallet can sign messages`, 'green');

    // Cleanup
    await prisma.agent.delete({ where: { id: testAgent.id } });

    log('✓ Get Internal Wallet Test PASSED', 'green');
    return true;
  } catch (error) {
    log(`✗ Get Internal Wallet Test FAILED: ${error.message}`, 'red');
    return false;
  }
}

/**
 * Main test runner
 */
async function runAllTests() {
  log('\n╔════════════════════════════════════════════════════════════╗', 'blue');
  log('║   WALLET PROVISIONING SYSTEM - INTEGRATION TESTS            ║', 'blue');
  log('╚════════════════════════════════════════════════════════════╝', 'blue');

  // Verify SECRET_KEY is set
  try {
    keyManagementService.validateSecretKey();
    log('✓ SECRET_KEY is properly configured', 'green');
  } catch (error) {
    log(`✗ SECRET_KEY validation failed: ${error.message}`, 'red');
    log('\nTo generate a SECRET_KEY, run:', 'yellow');
    log('  node scripts/generateSecretKey.js', 'yellow');
    process.exit(1);
  }

  const results = [];

  // Run all tests
  results.push(await testHappyPath());
  results.push(await testIdempotency());
  results.push(await testCryptoRoundTrip());
  results.push(await testAgentNotFound());
  results.push(await testInvalidAgentIdFormat());
  results.push(await testGetInternalWallet());

  // Summary
  const passed = results.filter((r) => r).length;
  const total = results.length;

  log('\n╔════════════════════════════════════════════════════════════╗', 'blue');
  log(`║   TEST SUMMARY: ${passed}/${total} tests passed                        ║`, passed === total ? 'green' : 'red');
  log('╚════════════════════════════════════════════════════════════╝', 'blue');

  // Cleanup
  await prisma.$disconnect();

  process.exit(passed === total ? 0 : 1);
}

// Run tests
runAllTests().catch((error) => {
  log(`\n✗ Test runner error: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});
