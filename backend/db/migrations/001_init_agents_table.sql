-- Create agents table
CREATE TABLE agents (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'active',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create index on status for list queries
CREATE INDEX idx_agents_status ON agents(status);

-- Create index on name for lookups
CREATE INDEX idx_agents_name ON agents(name);

-- Create migration tracking table (optional, for manual tracking)
CREATE TABLE _migrations (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  executed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Mark this migration as executed
INSERT INTO _migrations (name) VALUES ('001_init_agents_table');
