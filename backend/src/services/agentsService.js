/**
 * Agent service layer for database operations.
 * Encapsulates all agent-related queries and business logic.
 */

const prisma = require('../db/prisma');

/**
 * Fetch all agents from the database.
 * Optionally filter by status.
 */
async function listAgents(status = null) {
  try {
    const where = status ? { status } : {};
    const agents = await prisma.agent.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
    
    // Alias reputationScore to score for frontend compatibility
    return agents.map(agent => ({
      ...agent,
      score: agent.reputationScore
    }));
  } catch (err) {
    console.error('Error listing agents:', err.message);
    throw err;
  }
}

/**
 * Bootstrap or retrieve the default agent.
 * Uses upsert pattern: updates existing agent with name 'default' or creates it.
 */
async function bootstrapAgent() {
  try {
    const agent = await prisma.agent.upsert({
      where: { name: 'default' },
      update: { status: 'active', updatedAt: new Date() },
      create: {
        name: 'default',
        status: 'active',
        metadata: {
          source: 'bootstrap',
          initialized: new Date().toISOString(),
        },
      },
    });
    return agent;
  } catch (err) {
    console.error('Error bootstrapping agent:', err.message);
    throw err;
  }
}

/**
 * Fetch a single agent by ID.
 */
async function getAgentById(id) {
  try {
    const agent = await prisma.agent.findUnique({
      where: { id },
    });
    return agent;
  } catch (err) {
    console.error('Error fetching agent:', err.message);
    throw err;
  }
}

/**
 * Create a new agent with metadata.
 */
async function createAgent(name, metadata = {}) {
  try {
    const agent = await prisma.agent.create({
      data: {
        name,
        status: 'active',
        metadata,
      },
    });
    return agent;
  } catch (err) {
    console.error('Error creating agent:', err.message);
    throw err;
  }
}

module.exports = {
  listAgents,
  bootstrapAgent,
  getAgentById,
  createAgent,
};
