/**
 * Simple SQL migration runner.
 * Executes SQL files in db/migrations/ in sequence.
 * Usage: node scripts/migrate.js
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const migrationsDir = path.join(__dirname, '..', 'db', 'migrations');

async function runMigrations() {
  try {
    const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();
    
    if (files.length === 0) {
      console.log('No migration files found.');
      await pool.end();
      return;
    }

    console.log(`Found ${files.length} migration file(s).`);

    for (const file of files) {
      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, 'utf-8');
      
      try {
        await pool.query(sql);
        console.log(`✓ Executed: ${file}`);
      } catch (err) {
        if (err.message.includes('already exists') || err.message.includes('duplicate key')) {
          console.log(`⊘ Skipped (already applied): ${file}`);
        } else {
          console.error(`✗ Failed: ${file}`);
          throw err;
        }
      }
    }

    console.log('Migrations completed successfully.');
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigrations();
