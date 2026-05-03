const prisma = require('../db/prisma');

/**
 * Escrow Service
 * - lockEscrow: atomically lock funds in a vault and create an escrow record
 * - releaseEscrow: mark escrow released and decrement locked balance
 * - refundEscrow: mark escrow refunded and decrement locked balance
 * - getEscrow: fetch escrow by id
 * Note: amounts are stored as strings in the Escrow table. Vault balance/lockedBalance JSON is expected
 * to hold numeric values (numbers) for tokens, consistent with existing Vault.balance shape.
 */

async function lockEscrow({ agentId, userId = null, token, amount }) {
  if (!agentId || !token || amount == null) throw new Error('Missing parameters for lockEscrow');
  if (Number(amount) <= 0) {
    throw Object.assign(new Error('Escrow amount must be greater than zero'), { statusCode: 400 });
  }

  return await prisma.$transaction(async (tx) => {
    const vault = await tx.vault.findUnique({ where: { agentId } });
    if (!vault) throw Object.assign(new Error('Vault not found for agent'), { statusCode: 404 });

    // read balances
    const balanceJson = vault.balance || {};
    const lockedJson = vault.lockedBalance || {};

    const available = Number(balanceJson[token] || 0) - Number(lockedJson[token] || 0);
    if (Number(amount) > available) {
      const err = new Error('Insufficient available balance to lock');
      err.statusCode = 400;
      throw err;
    }

    // update lockedBalance
    const newLocked = { ...lockedJson };
    newLocked[token] = Number(newLocked[token] || 0) + Number(amount);

    await tx.vault.update({ where: { agentId }, data: { lockedBalance: newLocked } });

    const escrow = await tx.escrow.create({
      data: {
        agentId,
        userId,
        token,
        amount: String(amount),
        status: 'LOCKED',
      },
    });

    return escrow;
  });
}

async function _updateLockedBalance(tx, agentId, token, amountDelta) {
  const vault = await tx.vault.findUnique({ where: { agentId } });
  if (!vault) throw Object.assign(new Error('Vault not found for agent'), { statusCode: 404 });

  const lockedJson = vault.lockedBalance || {};
  const newLocked = { ...lockedJson };
  newLocked[token] = Number(newLocked[token] || 0) + Number(amountDelta);
  if (newLocked[token] <= 0) {
    delete newLocked[token];
  }

  await tx.vault.update({ where: { agentId }, data: { lockedBalance: newLocked } });
}

async function releaseEscrow(escrowId, opts = {}) {
  const { txHash = null } = opts;
  return await prisma.$transaction(async (tx) => {
    const escrow = await tx.escrow.findUnique({ where: { id: escrowId } });
    if (!escrow) throw Object.assign(new Error('Escrow not found'), { statusCode: 404 });
    if (escrow.status !== 'LOCKED') {
      const err = new Error('Escrow not in LOCKED state');
      err.statusCode = 400;
      throw err;
    }

    // decrement locked balance and set status
    await _updateLockedBalance(tx, escrow.agentId, escrow.token, -Number(escrow.amount));

    const updated = await tx.escrow.update({ where: { id: escrowId }, data: { status: 'RELEASED', txHash } });
    return updated;
  });
}

async function refundEscrow(escrowId, reason = null) {
  return await prisma.$transaction(async (tx) => {
    const escrow = await tx.escrow.findUnique({ where: { id: escrowId } });
    if (!escrow) throw Object.assign(new Error('Escrow not found'), { statusCode: 404 });
    if (escrow.status !== 'LOCKED') {
      const err = new Error('Escrow not in LOCKED state');
      err.statusCode = 400;
      throw err;
    }

    await _updateLockedBalance(tx, escrow.agentId, escrow.token, -Number(escrow.amount));

    const updated = await tx.escrow.update({ where: { id: escrowId }, data: { status: 'REFUNDED' } });
    return updated;
  });
}

async function getEscrow(escrowId) {
  return prisma.escrow.findUnique({ where: { id: escrowId } });
}

module.exports = {
  lockEscrow,
  releaseEscrow,
  refundEscrow,
  getEscrow,
};
