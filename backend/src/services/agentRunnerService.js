/**
 * Agent Runner Service
 *
 * Core orchestrator for the runAgent pipeline.
 *
 * Pipeline:
 *  1. Fetch vault state (balance, lockedBalance, availableBalance)
 *  2. Decide amount (30% of USDC or user-provided)
 *  3. Lock escrow
 *  4. Call 0G Compute → get action decision
 *  5. Validate decision against escrow
 *  6. Execute swap via Uniswap V3
 *  7. Log to 0G Storage
 *  8. Release (success) or Refund (failure) escrow
 */

const prisma = require('../db/prisma');
const agentVaultService = require('./agentVaultService');
const balanceService = require('./balanceService');
const escrowService = require('./escrowService');
const zeroGCompute = require('./zeroGComputeService');
const zeroGStorage = require('./zeroGStorageService');
const swapExecutionService = require('./swapExecutionService');

// ─── Constants ────────────────────────────────────────────────────────────────

const ALLOWED_TOKENS = ['USDC', 'WETH'];
const SUPPORTED_ACTIONS = ['SWAP'];
// Default amount fraction: use 30% of available balance
const DEFAULT_FRACTION = 0.3;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Build a safe error with an optional HTTP status code.
 */
function makeError(message, statusCode = 400) {
    return Object.assign(new Error(message), { statusCode });
}

/**
 * Compute available balance per token from vault.
 * available[token] = balance[token] - lockedBalance[token]
 */
function computeAvailable(balance, lockedBalance) {
    const available = {};
    for (const token of ALLOWED_TOKENS) {
        available[token] = Math.max(0, Number(balance[token] || 0) - Number(lockedBalance[token] || 0));
    }
    return available;
}

// ─── Main Orchestrator ────────────────────────────────────────────────────────

/**
 * Run a full agent decision-execution cycle.
 *
 * @param {string} agentId   - The agent's public agentId (not the Prisma `id`)
 * @param {Object} [opts]
 * @param {string|number} [opts.amount]  - Override amount (in human units, e.g. "50" USDC)
 * @param {string}        [opts.token]   - Override token ("USDC" | "WETH"). Default: "USDC"
 * @param {boolean}       [opts.dryRun]  - If true, skip escrow+swap, return decision only
 *
 * @returns {Promise<RunResult>}
 */
async function runAgent(agentId, opts = {}) {
    const startedAt = new Date();
    const token = (opts.token || 'USDC').toUpperCase();

    if (!agentId) throw makeError('agentId is required', 400);
    if (!ALLOWED_TOKENS.includes(token)) {
        throw makeError(`Unsupported token: ${token}. Allowed: ${ALLOWED_TOKENS.join(', ')}`, 400);
    }

    // ── Phase 1: Fetch vault state ───────────────────────────────────────────────
    const vaultData = await agentVaultService.getAgentVaultByAgentIdentifier(agentId);
    if (!vaultData || !vaultData.vault) {
        throw makeError(`Agent or vault not found: ${agentId}`, 404);
    }

    const { agent, vault } = vaultData;
    const internalAgentId = agent.id; // Prisma PK — used for escrow

    // Refresh on-chain balance
    let liveBalances;
    try {
        liveBalances = await balanceService.getVaultBalances(vault.walletAddress);
    } catch (err) {
        throw makeError(`Failed to fetch vault balances: ${err.message}`, 502);
    }

    const lockedBalance = vault.lockedBalance || {};
    const available = computeAvailable(liveBalances, lockedBalance);

    // ── Phase 2: Decide amount ───────────────────────────────────────────────────
    let amount;
    if (opts.amount != null) {
        amount = Number(opts.amount);
    } else {
        // Default: 30% of available balance for the chosen token
        amount = Number((available[token] * DEFAULT_FRACTION).toFixed(6));
    }

    if (!Number.isFinite(amount) || amount <= 0) {
        throw makeError(
            `Insufficient available ${token} balance. Available: ${available[token]}`,
            400
        );
    }
    if (amount > available[token]) {
        throw makeError(
            `Requested amount (${amount}) exceeds available ${token} balance (${available[token]})`,
            400
        );
    }

    // ── Dry-run exit ─────────────────────────────────────────────────────────────
    if (opts.dryRun) {
        // Return the plan without side effects
        const dryDecision = await zeroGCompute.getDecision({
            balances: liveBalances,
            lockedBalance,
            availableBalance: available,
            amount,
            token,
            history: [],
        });

        return {
            agentId,
            dryRun: true,
            status: 'DRY_RUN',
            decidedAmount: amount,
            token,
            decision: dryDecision,
            balances: liveBalances,
            available,
            timing: buildTiming(startedAt),
        };
    }

    // ── Phase 3: Lock escrow ─────────────────────────────────────────────────────
    let escrow;
    try {
        escrow = await escrowService.lockEscrow({
            agentId: internalAgentId,
            token,
            amount: String(amount),
        });
    } catch (err) {
        // Escrow lock failure — no cleanup needed (nothing locked yet)
        throw makeError(`Escrow lock failed: ${err.message}`, err.statusCode || 500);
    }

    // From this point forward, ALL failure paths must refund the escrow.
    const escrowId = escrow.id;

    // ── Phase 4: 0G Compute ──────────────────────────────────────────────────────
    let decision;
    try {
        // Fetch recent history for context (last 10 swaps)
        const history = await prisma.swapTransaction.findMany({
            where: { agentId: internalAgentId },
            orderBy: { createdAt: 'desc' },
            take: 10,
            select: { tokenIn: true, tokenOut: true, amount: true, status: true, createdAt: true },
        });

        decision = await zeroGCompute.getDecision({
            balances: liveBalances,
            lockedBalance,
            availableBalance: available,
            amount,
            token,
            history,
        });
    } catch (err) {
        await safeRefund(escrowId, 'Phase 4 — 0G Compute failure');
        throw makeError(`0G Compute failed: ${err.message}`, err.statusCode || 502);
    }

    // ── Phase 5: Validate decision ───────────────────────────────────────────────
    try {
        validateDecision(decision, escrow);
    } catch (err) {
        await safeRefund(escrowId, 'Phase 5 — decision validation failure');
        throw err;
    }

    // ── Phase 6: Execute swap ──────────────────────────────────────────────────
    let txHash;
    try {
        txHash = await executeDecision(decision, vault, internalAgentId);
    } catch (err) {
        await safeRefund(escrowId, 'Phase 6 — execution failure');
        throw makeError(`Swap execution failed: ${err.message}`, err.statusCode || 500);
    }

    // ── Phase 7: 0G Storage ──────────────────────────────────────────────────────
    let storageHash;
    try {
        const payload = {
            type: "SWAP",
            agentId,
            escrowId,
            decision,
            txHash: txHash || null,
            timestamp: new Date().toISOString()
        };

        const logResult = await zeroGStorage.upload(payload);
        storageHash = logResult.rootHash;

        // Save into DB
        await prisma.transactionLog.create({
            data: {
                agentId: internalAgentId, // using internal Prisma ID
                type: 'SWAP',
                txHash: logResult.txHash || '',
                rootHash: logResult.rootHash || '',
                payload
            }
        });

        // Persist storageHash on the escrow record (best-effort)
        await prisma.escrow.update({
            where: { id: escrowId },
            data: { storageHash },
        });
    } catch (err) {
        // Non-fatal: swap already on-chain, log warning and continue to release
        console.error('[agentRunner] 0G Storage logging failed (non-fatal):', err.message);
    }

    // ── Phase 8: Release escrow ───────────────────────────────────────────────
    try {
        await escrowService.releaseEscrow(escrowId, { txHash });
    } catch (err) {
        // Swap already succeeded — log but don't throw
        console.error('[agentRunner] Escrow release failed (non-fatal):', err.message);
    }

    const completedAt = new Date();

    return {
        agentId,
        internalAgentId,
        escrowId,
        action: decision.action,
        tokenIn: decision.tokenIn,
        tokenOut: decision.tokenOut,
        amount,
        token,
        txHash,
        storageHash: storageHash || null,
        status: 'SUCCESS',
        decision,
        balances: liveBalances,
        timing: buildTiming(startedAt, completedAt),
    };
}

// ─── Internal Helpers ─────────────────────────────────────────────────────────

/**
 * Validate a compute decision against the locked escrow.
 * Throws if invalid.
 */
function validateDecision(decision, escrow) {
    // Amount cap: decision must not exceed what was escrowed
    if (Number(decision.amount) > Number(escrow.amount)) {
        throw makeError(
            `Decision amount (${decision.amount}) exceeds escrowed amount (${escrow.amount})`,
            400
        );
    }

    // Action must be supported
    if (!SUPPORTED_ACTIONS.includes(decision.action)) {
        throw makeError(`Unsupported action: ${decision.action}. Supported: ${SUPPORTED_ACTIONS.join(', ')}`, 400);
    }

    // Tokens must be allowed
    const ti = decision.tokenIn?.toUpperCase();
    const to = decision.tokenOut?.toUpperCase();
    if (!ALLOWED_TOKENS.includes(ti)) {
        throw makeError(`Decision tokenIn not allowed: ${ti}`, 400);
    }
    if (!ALLOWED_TOKENS.includes(to)) {
        throw makeError(`Decision tokenOut not allowed: ${to}`, 400);
    }
    if (ti === to) {
        throw makeError(`tokenIn and tokenOut must differ`, 400);
    }

    // Validate against Uniswap supported pairs
    try {
        swapExecutionService.validateTokenPair(ti, to);
    } catch (err) {
        throw makeError(`Decision pair not supported by Uniswap: ${ti}→${to}`, 400);
    }
}

/**
 * Execute a SWAP decision and return the on-chain txHash.
 */
async function executeDecision(decision, vault, agentId) {
    const amountBigInt = BigInt(
        // Convert from human-readable (e.g. "50" USDC) to wei
        // USDC = 6 decimals, WETH/ETH = 18 decimals
        toWei(decision.amount, decision.tokenIn)
    );

    // Build swap transaction data
    const swapTxData = await swapExecutionService.buildSwapTransaction(
        decision.tokenIn,
        decision.tokenOut,
        amountBigInt,
        vault.walletAddress
    );

    // Reconstruct vault wallet (uses encrypted private key)
    const wallet = await swapExecutionService.reconstructVaultWallet(vault.id);

    // ERC20 approval flow (skipped for ETH/WETH native)
    await swapExecutionService.executeApprovalFlow(wallet, decision.tokenIn, amountBigInt);

    // Execute on-chain swap
    const result = await swapExecutionService.executeSwapTransaction(wallet, swapTxData, agentId);

    return result.txHash;
}

/**
 * Convert a human-readable amount string to wei BigInt string.
 * USDC = 6 decimals, WETH/ETH = 18 decimals.
 */
function toWei(amount, token) {
    const decimals = token.toUpperCase() === 'USDC' ? 6 : 18;
    // Use integer math to avoid float precision issues
    const [int, frac = ''] = String(amount).split('.');
    const fracPadded = (frac + '0'.repeat(decimals)).substring(0, decimals);
    return BigInt(int) * BigInt(10 ** decimals) + BigInt(fracPadded);
}

/**
 * Safely refund an escrow — logs error if refund itself fails.
 */
async function safeRefund(escrowId, reason) {
    try {
        await escrowService.refundEscrow(escrowId);
        console.log(`[agentRunner] Escrow ${escrowId} refunded. Reason: ${reason}`);
    } catch (err) {
        console.error(`[agentRunner] CRITICAL: Escrow ${escrowId} refund failed after ${reason}:`, err.message);
    }
}

/**
 * Build a timing object.
 */
function buildTiming(startedAt, completedAt = new Date()) {
    return {
        startedAt: startedAt.toISOString(),
        completedAt: completedAt.toISOString(),
        durationMs: completedAt - startedAt,
    };
}

module.exports = {
    runAgent,
};
