const express = require('express');
const router = express.Router();
const agentRunnerService = require('../src/services/agentRunnerService');
const zeroGStorage = require('../src/services/zeroGStorageService');
const prisma = require('../src/db/prisma');

/**
 * POST /agent/run
 *
 * Trigger the full agent decision-execution pipeline:
 *   fetch vault → decide amount → lock escrow → 0G compute → validate
 *   → execute swap → log to 0G storage → release/refund escrow
 *
 * Body:
 *   agentId  {string}  required - The agent's public agentId
 *   amount   {number}  optional - Override decision amount (human-readable, e.g. 50 for 50 USDC)
 *   token    {string}  optional - Token to use ("USDC" | "WETH"). Default: "USDC"
 *   dryRun   {boolean} optional - If true, return decision without executing or locking escrow
 */
router.post('/run', async (req, res) => {
    try {
        const { agentId, amount, token, dryRun } = req.body;

        if (!agentId) {
            return res.status(400).json({ success: false, error: 'agentId is required' });
        }

        const result = await agentRunnerService.runAgent(agentId, {
            amount,
            token,
            dryRun: Boolean(dryRun),
        });

        const statusCode = result.status === 'SUCCESS' || result.status === 'DRY_RUN' ? 200 : 202;
        res.status(statusCode).json({ success: true, ...result });
    } catch (err) {
        const statusCode = err.statusCode || 500;
        console.error('[POST /agent/run] Error:', err.message);
        res.status(statusCode).json({ success: false, error: err.message });
    }
});

});

/**
 * GET /transactions/:agentId
 *
 * Fetch all transaction logs for the specified agent.
 */
router.get('/transactions/:agentId', async (req, res) => {
    try {
        const { agentId } = req.params;
        const logs = await prisma.transactionLog.findMany({
            where: { agentId }
        });
        res.status(200).json({ success: true, logs });
    } catch (err) {
        console.error('[GET /transactions/:agentId] Error:', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * GET /transactions/data/:rootHash
 *
 * Download raw transaction log payload directly from 0G Storage by rootHash.
 */
router.get('/transactions/data/:rootHash', async (req, res) => {
    try {
        const { rootHash } = req.params;
        const payload = await zeroGStorage.download(rootHash);
        res.status(200).json({ success: true, payload });
    } catch (err) {
        console.error('[GET /transactions/data/:rootHash] Error:', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
