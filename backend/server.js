const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const prisma = require('./src/db/prisma');
const agentsRouter = require('./routes/agents');
const swapRouter = require('./routes/swap');

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

app.use('/agents', agentsRouter);
app.use('/swap', swapRouter);

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
