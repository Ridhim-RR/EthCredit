-- Add locked_balance column to vaults and create escrows table

-- Add locked_balance to existing vaults table
ALTER TABLE vaults
  ADD COLUMN IF NOT EXISTS locked_balance JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Create escrows table
CREATE TABLE IF NOT EXISTS escrows (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  user_id TEXT,
  token TEXT NOT NULL,
  amount TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'LOCKED',
  tx_hash TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_escrows_agent_id ON escrows(agent_id);
CREATE INDEX IF NOT EXISTS idx_escrows_status ON escrows(status);

-- Mark migration as applied
INSERT INTO _migrations (name) VALUES ('009_create_escrow_and_locked_balance')
ON CONFLICT (name) DO NOTHING;
