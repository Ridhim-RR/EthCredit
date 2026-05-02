-- Add internal wallet fields to agents table for autonomous wallet provisioning
ALTER TABLE agents
ADD COLUMN IF NOT EXISTS internal_wallet_address VARCHAR(42) UNIQUE,
ADD COLUMN IF NOT EXISTS encrypted_private_key TEXT;

-- Create index on internal_wallet_address for lookups
CREATE INDEX IF NOT EXISTS idx_agents_internal_wallet_address ON agents(internal_wallet_address);

-- Mark migration as applied
INSERT INTO _migrations (name) VALUES ('006_add_internal_wallet_fields')
ON CONFLICT (name) DO NOTHING;
