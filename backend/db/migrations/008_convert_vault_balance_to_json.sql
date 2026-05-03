-- Convert vaults.balance from numeric to JSONB for multi-token balances.
-- Existing numeric balance is mapped to ETH and USDC is initialized to 0.

ALTER TABLE vaults
  ALTER COLUMN balance DROP DEFAULT;

ALTER TABLE vaults
  ALTER COLUMN balance TYPE JSONB
  USING (
    CASE
      WHEN balance IS NULL THEN jsonb_build_object('ETH', 0, 'USDC', 0)
      ELSE jsonb_build_object('ETH', balance, 'USDC', 0)
    END
  );

ALTER TABLE vaults
  ALTER COLUMN balance SET DEFAULT '{"ETH":0,"USDC":0}'::jsonb;

UPDATE vaults
SET balance = jsonb_build_object('ETH', 0, 'USDC', 0)
WHERE balance IS NULL;
