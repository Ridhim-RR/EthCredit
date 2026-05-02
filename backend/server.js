const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const prisma = require('./src/db/prisma');
const agentCreationRouter = require('./routes/agentCreation');
const agentsRouter = require('./routes/agents');
const swapRouter = require('./routes/swap');
const walletProvisioningRouter = require('./routes/walletProvisioning');
const agentRegistryRouter = require('./routes/agentRegistry');

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;

/**
 * Enhanced health check that includes database status.
 */
app.get('/health', async (req, res) => {
  try {
    // Test database connection
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', db: 'connected' });
  } catch (err) {
    console.error('Health check - DB connection failed:', err.message);
    res.status(503).json({ status: 'unhealthy', db: 'disconnected', error: err.message });
  }
});

/**
 * GET /routes
 * Debugging endpoint: list registered routes and methods
 */
app.get('/routes', (req, res) => {
  try {
    const routes = [];
    if (app._router?.stack) {
      app._router.stack.forEach((middleware) => {
        if (middleware.route) {
          // routes registered directly on the app
          const methods = Object.keys(middleware.route.methods).map((m) => m.toUpperCase());
          routes.push({ path: middleware.route.path, methods });
        } else if (middleware.name === 'router' && middleware.handle?.stack) {
          // router middleware
          middleware.handle.stack.forEach((handler) => {
            if (handler.route) {
              const methods = Object.keys(handler.route.methods).map((m) => m.toUpperCase());
              routes.push({ path: handler.route.path, methods });
            }
          });
        }
      });
    }

    res.json({ success: true, routes });
  } catch (err) {
    console.error('Failed to enumerate routes:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.use('/agents', agentsRouter);
app.use('/api/agent', agentCreationRouter);
app.use('/swap', swapRouter);
app.use('/', walletProvisioningRouter);
app.use('/', agentRegistryRouter);

/**
 * Initialize server with database readiness check.
 */
async function startServer() {
  try {
    // Test database connection before starting
    await prisma.$queryRaw`SELECT 1`;
    console.log('✓ Database connection successful');
  } catch (err) {
    console.error('✗ Failed to connect to database:', err.message);
    console.error('Make sure DATABASE_URL is set correctly and PostgreSQL is running.');
    process.exit(1);
  }

  const server = app.listen(PORT, () => {
    console.log(`✓ Backend server listening on port ${PORT}`);
  });

  // Graceful shutdown
  const shutdown = async (signal) => {
    console.log(`\n${signal} received, shutting down gracefully...`);
    server.close(async () => {
      await prisma.$disconnect();
      console.log('✓ Database disconnected');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

startServer();

module.exports = app;
