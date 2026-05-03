const express = require('express');
const router = express.Router();
const escrowService = require('../src/services/escrowService');

// POST /escrow/lock
// body: { agentId, userId?, token, amount }
router.post('/lock', async (req, res) => {
  try {
    const { agentId, userId, token, amount } = req.body;
    const escrow = await escrowService.lockEscrow({ agentId, userId, token, amount });
    res.json({ success: true, escrow });
  } catch (err) {
    console.error('Escrow lock error:', err.message);
    res.status(err.statusCode || 500).json({ success: false, error: err.message });
  }
});

// POST /escrow/release
// body: { escrowId, txHash? }
router.post('/release', async (req, res) => {
  try {
    const { escrowId, txHash } = req.body;
    const updated = await escrowService.releaseEscrow(escrowId, { txHash });
    res.json({ success: true, escrow: updated });
  } catch (err) {
    console.error('Escrow release error:', err.message);
    res.status(err.statusCode || 500).json({ success: false, error: err.message });
  }
});

// POST /escrow/refund
// body: { escrowId }
router.post('/refund', async (req, res) => {
  try {
    const { escrowId } = req.body;
    const updated = await escrowService.refundEscrow(escrowId);
    res.json({ success: true, escrow: updated });
  } catch (err) {
    console.error('Escrow refund error:', err.message);
    res.status(err.statusCode || 500).json({ success: false, error: err.message });
  }
});

// GET /escrow/:id
router.get('/:id', async (req, res) => {
  try {
    const escrow = await escrowService.getEscrow(req.params.id);
    if (!escrow) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true, escrow });
  } catch (err) {
    console.error('Escrow get error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
