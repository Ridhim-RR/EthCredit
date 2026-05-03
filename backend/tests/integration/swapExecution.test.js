/**
 * Integration tests for swap execution flow
 * Tests the complete flow: create agent -> fund vault -> execute swap -> verify DB
 */

const request = require('supertest');
const app = require('../../server');
const prisma = require('../../src/db/prisma');
const { validateTokenPair } = require('../../src/services/swapExecutionService');

describe('Swap Execution Flow (Backend-Driven)', () => {
  let agentId;
  let vaultData;

  // Skip these tests if running without proper RPC setup
  const skipIfNoRpc = process.env.RPC_URL ? describe : describe.skip;

  beforeAll(async () => {
    // Create a test agent with vault
    const response = await request(app)
      .post('/agent/register')
      .send({ name: 'Swap Test Agent' });

    expect(response.status).toBe(201);
    agentId = response.body.agentId;
    expect(agentId).toBeDefined();

    // Get vault data
    const vaultResponse = await request(app)
      .get(`/agent/${agentId}/vault`)
      .expect(200);

    vaultData = vaultResponse.body;
    expect(vaultData.walletAddress).toBeDefined();
  });

  afterAll(async () => {
    // Clean up
    if (agentId) {
      try {
        await prisma.agent.delete({
          where: { agentId },
        });
      } catch (err) {
        // Agent might not exist or have referential constraints
        console.log('Cleanup note:', err.message);
      }
    }
  });

  describe('POST /swap/execute - Validation', () => {
    it('should reject swap without agentId', async () => {
      const response = await request(app)
        .post('/swap/execute')
        .send({
          tokenIn: 'USDC',
          tokenOut: 'WETH',
          amount: '100000000', // 100 USDC in wei (6 decimals)
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('agentId');
    });

    it('should reject swap without amount', async () => {
      const response = await request(app)
        .post('/swap/execute')
        .send({
          agentId,
          tokenIn: 'USDC',
          tokenOut: 'WETH',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('amount');
    });

    it('should reject invalid token pair', async () => {
      const response = await request(app)
        .post('/swap/execute')
        .send({
          agentId,
          tokenIn: 'DAI',
          tokenOut: 'USDC',
          amount: '1000000',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Invalid token pair');
    });

    it('should reject nonexistent agent', async () => {
      const response = await request(app)
        .post('/swap/execute')
        .send({
          agentId: 'nonexistent_agent_id_12345',
          tokenIn: 'USDC',
          tokenOut: 'WETH',
          amount: '100000000',
        });

      expect(response.status).toBe(404);
      expect(response.body.error).toContain('not found');
    });
  });

  describe('POST /swap/execute - Balance Validation', () => {
    it('should reject swap with insufficient balance', async () => {
      const response = await request(app)
        .post('/swap/execute')
        .send({
          agentId,
          tokenIn: 'USDC',
          tokenOut: 'WETH',
          amount: '999999999999999999999', // Very large amount
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Insufficient');
    });
  });

  describe('POST /swap/quote', () => {
    it('should validate token pair in quote endpoint', async () => {
      const response = await request(app)
        .post('/swap/quote')
        .send({
          tokenIn: 'USDC',
          tokenOut: 'WETH',
          amount: '100000000',
        });

      expect(response.status).toBe(200);
      expect(response.body.tokenIn).toBe('USDC');
      expect(response.body.tokenOut).toBe('WETH');
    });

    it('should reject invalid token pair in quote', async () => {
      const response = await request(app)
        .post('/swap/quote')
        .send({
          tokenIn: 'LINK',
          tokenOut: 'DAI',
          amount: '1000000',
        });

      expect(response.status).toBe(400);
    });

    it('should reject quote without required fields', async () => {
      const response = await request(app)
        .post('/swap/quote')
        .send({
          tokenIn: 'USDC',
          // Missing tokenOut and amount
        });

      expect(response.status).toBe(400);
    });
  });

  describe('Swap Execution Building Blocks', () => {
    it('should validate USDC <-> WETH token pairs', () => {
      // Valid pairs
      expect(() => validateTokenPair('USDC', 'WETH')).not.toThrow();
      expect(() => validateTokenPair('WETH', 'USDC')).not.toThrow();

      // Invalid pairs
      expect(() => validateTokenPair('DAI', 'USDC')).toThrow();
      expect(() => validateTokenPair('LINK', 'WETH')).toThrow();
    });
  });

  describe('Vault Setup for Swaps', () => {
    it('should have created vault with encrypted key', async () => {
      const vault = await prisma.vault.findFirst({
        where: { agent: { agentId } },
      });

      expect(vault).toBeDefined();
      expect(vault.walletAddress).toBeDefined();
      expect(vault.encryptedPrivateKey).toBeDefined();
      expect(vault.balance).toBeDefined();
      // Balance should be JSON structure
      expect(typeof vault.balance).toBe('object');
    });

    it('should retrieve vault with normalized balance', async () => {
      const response = await request(app)
        .get(`/agent/${agentId}/vault`)
        .expect(200);

      expect(response.body.balance).toHaveProperty('ETH');
      expect(response.body.balance).toHaveProperty('USDC');
      expect(typeof response.body.balance.ETH).toBe('number');
      expect(typeof response.body.balance.USDC).toBe('number');
    });
  });

  describe('Transaction Logging', () => {
    it('should log swap transactions (manual endpoint)', async () => {
      const response = await request(app)
        .post('/swap/log')
        .send({
          walletAddress: vaultData.walletAddress,
          agentId,
          tokenIn: 'USDC',
          tokenOut: 'WETH',
          amount: '1000000',
          txHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
          status: 'success',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.transactionId).toBeDefined();
    });

    it('should reject transaction log without required fields', async () => {
      const response = await request(app)
        .post('/swap/log')
        .send({
          walletAddress: vaultData.walletAddress,
          // Missing tokenIn, tokenOut, amount
        });

      expect(response.status).toBe(400);
    });

    it('should retrieve swap history', async () => {
      // Log a transaction first
      await request(app)
        .post('/swap/log')
        .send({
          walletAddress: vaultData.walletAddress,
          agentId,
          tokenIn: 'USDC',
          tokenOut: 'WETH',
          amount: '1000000',
          status: 'success',
        });

      // Retrieve history
      const response = await request(app)
        .get(`/swap/history/${vaultData.walletAddress}?limit=10`)
        .expect(200);

      expect(response.body.transactions).toBeDefined();
      expect(Array.isArray(response.body.transactions)).toBe(true);
    });
  });

  describe('Token Catalog', () => {
    it('should return available tokens', async () => {
      const response = await request(app)
        .get('/swap/tokens')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(Array.isArray(response.body.data)).toBe(true);

      // Check USDC and WETH are available
      const usdc = response.body.data.find((t) => t.symbol === 'USDC');
      const weth = response.body.data.find((t) => t.symbol === 'WETH');

      expect(usdc).toBeDefined();
      expect(weth).toBeDefined();
      expect(usdc.address).toBeDefined();
      expect(weth.address).toBeDefined();
    });
  });
});
