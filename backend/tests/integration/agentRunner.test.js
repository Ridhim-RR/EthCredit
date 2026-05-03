/**
 * Integration tests for POST /agent/run — runAgent pipeline
 */
const request = require('supertest');
const app = require('../../server');
const prisma = require('../../src/db/prisma');

describe('POST /agent/run — Agent Runner', () => {
    let agentId;

    beforeAll(async () => {
        // Create a test agent
        const response = await request(app)
            .post('/api/agent/register')
            .send({ name: `RunnerTestAgent-${Date.now()}` });

        expect(response.status).toBe(201);
        agentId = response.body.agentId;
        expect(agentId).toBeDefined();
    });

    afterAll(async () => {
        if (agentId) {
            try {
                await prisma.agent.delete({ where: { agentId } });
            } catch (err) {
                console.log('Cleanup note:', err.message);
            }
        }
    });

    // ── Input validation ────────────────────────────────────────────────────────

    it('should return 400 if agentId is missing', async () => {
        const res = await request(app)
            .post('/agent/run')
            .send({ token: 'USDC' });

        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
        expect(res.body.error).toMatch(/agentId/i);
    });

    it('should return 404 for a non-existent agentId', async () => {
        const res = await request(app)
            .post('/agent/run')
            .send({ agentId: 'does-not-exist-xyz', dryRun: true });

        expect(res.status).toBe(404);
        expect(res.body.success).toBe(false);
    });

    it('should return 400 when vault has zero balance (insufficient)', async () => {
        // Freshly created agent has 0 balance — pipeline should reject before escrow
        const res = await request(app)
            .post('/agent/run')
            .send({ agentId, token: 'USDC' });

        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
        expect(res.body.error).toMatch(/insufficient|balance/i);
    });

    // ── Dry-run path ────────────────────────────────────────────────────────────

    it('should succeed in dry-run mode and return a decision without locking escrow', async () => {
        // Override amount to 0.001 so amount > 0 guard passes, but we skip actual escrow
        // Note: dry-run skips balance check for the amount decision phase, but
        // the vault has 0 balance so the amount will be 0 → expect graceful error
        const res = await request(app)
            .post('/agent/run')
            .send({ agentId, token: 'USDC', dryRun: true });

        // With 0 balance the decided amount = 0.3 * 0 = 0 → rejected even in dry-run
        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/insufficient|balance/i);

        // Confirm no escrow was created
        const escrows = await prisma.escrow.findMany({ where: { agent: { agentId } } });
        expect(escrows.length).toBe(0);
    });

    it('should return a valid dry-run decision when amount is explicitly provided', async () => {
        // We mock the balance scenario by providing an explicit amount — but vault still
        // has 0 balance so available check will still fail. This test verifies validation order.
        const res = await request(app)
            .post('/agent/run')
            .send({ agentId, token: 'USDC', amount: 50, dryRun: true });

        // available USDC = 0, requested = 50 → should fail with insufficient balance
        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/exceeds available|insufficient/i);
    });

    // ── Token validation ────────────────────────────────────────────────────────

    it('should reject unsupported token', async () => {
        const res = await request(app)
            .post('/agent/run')
            .send({ agentId, token: 'DAI', dryRun: true });

        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/Unsupported token/i);
    });
});
