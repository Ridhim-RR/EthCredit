-- Create vaults table for backend-controlled agent wallets
CREATE TABLE IF NOT EXISTS vaults (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  agent_id TEXT NOT NULL UNIQUE REFERENCES agents(id) ON DELETE CASCADE,
  wallet_address TEXT NOT NULL UNIQUE,
  encrypted_private_key TEXT NOT NULL,
  balance DOUBLE PRECISION NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for common lookups
CREATE INDEX IF NOT EXISTS idx_vaults_agent_id ON vaults(agent_id);
CREATE INDEX IF NOT EXISTS idx_vaults_wallet_address ON vaults(wallet_address);

-- Mark migration as applied
INSERT INTO _migrations (name) VALUES ('007_create_vaults_table')
ON CONFLICT (name) DO NOTHING;