CREATE TABLE IF NOT EXISTS "transaction_logs" (
    "id" TEXT NOT NULL,
    "agent_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "tx_hash" TEXT NOT NULL,
    "root_hash" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transaction_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "transaction_logs_agent_id_idx" ON "transaction_logs"("agent_id");
