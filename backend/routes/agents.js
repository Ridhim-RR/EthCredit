const express = require('express');
const router = express.Router();
const agentsService = require('../src/services/agentsService');

/**
 * GET /agents/bootstrap
 * Creates or retrieves the default agent.
 */
router.get('/bootstrap', async (req, res) => {
  try {
    const agent = await agentsService.bootstrapAgent();
    res.json({
      success: true,
      message: 'Agent bootstrapped successfully',
      agent,
    });
  } catch (err) {
    console.error('Bootstrap error:', err.message);
    res.status(500).json({
      success: false,
      error: 'Failed to bootstrap agent',
      message: err.message,
    });
  }
});

/**
 * GET /agents/list
 * Returns all active agents or specify status via query param.
 */
router.get('/list', async (req, res) => {
  try {
    const { status } = req.query;
    const agents = await agentsService.listAgents(status || null);
    res.json({
      success: true,
      agents,
      count: agents.length,
    });
  } catch (err) {
    console.error('List error:', err.message);
    res.status(500).json({
      success: false,
      error: 'Failed to list agents',
      message: err.message,
    });
  }
});

module.exports = router;
