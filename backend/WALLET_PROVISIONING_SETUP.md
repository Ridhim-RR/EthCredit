# Backend Wallet Provisioning System - Setup Guide

This document guides you through setting up and verifying the secure agent wallet provisioning system.

## Overview

The wallet provisioning system enables each agent to have its own secure internal wallet for autonomous transaction signing. The system uses:
- **ethers.js** for wallet generation
- **tweetnacl.js** for NaCl-based private key encryption  
- **PostgreSQL** for encrypted private key storage
- **Prisma** as the ORM

## Prerequisites

- Node.js 16+ (to run the backend)
- PostgreSQL database running and accessible
- `DATABASE_URL` environment variable configured
- Git (to commit the new files)

## Setup Steps

### 1. Install dependencies

```bash
cd backend
npm install
```

This installs tweetnacl.js and all other dependencies defined in package.json.

### 2. Generate SECRET_KEY

Generate a secure 32-byte encryption key:

```bash
node scripts/generateSecretKey.js
```

Example output:
```
Generated new SECRET_KEY for wallet encryption:

SECRET_KEY=YXJ1cm5lZHNvY2tldHNyaWVoYWxsdGhhdWFza2Vkcmlx

Add this line to your .env file:
export SECRET_KEY="YXJ1cm5lZHNvY2tldHNyaWVoYWxsdGhhdWFza2Vkcmlx"
```

### 3. Update .env file

Copy the generated SECRET_KEY into your `.env` file:

```bash
# In backend/.env (replace with your generated key)
SECRET_KEY=YXJ1cm5lZHNvY2tldHNyaWVoYWxsdGhhdWFza2Vkcmlx
```

For development, you can also export it directly:

```bash
export SECRET_KEY="YXJ1cm5lZHNvY2tldHNyaWVoYWxsdGhhdWFza2Vkcmlx"
```

### 4. Run database migration

Apply the new schema changes to PostgreSQL:

```bash
npm run db:migrate
```

This runs the migration script which applies `006_add_internal_wallet_fields.sql`, adding:
- `internal_wallet_address` column (unique)
- `encrypted_private_key` column
- Index on `internal_wallet_address` for fast lookups

**Verify migration succeeded:**

```bash
psql -c "SELECT column_name FROM information_schema.columns WHERE table_name='agents' AND column_name IN ('internal_wallet_address', 'encrypted_private_key');"
```

Expected output:
```
       column_name
-----------------------
 internal_wallet_address
 encrypted_private_key
```

### 5. Start the backend server

```bash
npm run dev
```

You should see:
```
✓ Database connection successful
✓ Backend server listening on port 5000
```

### 6. Verify the new endpoint is registered

Check that the wallet provisioning endpoint is available:

```bash
curl http://localhost:5000/routes | jq '.routes[] | select(.path ~ "provision")'
```

Expected output:
```json
{
  "path": "/agent/:agentId/provision-wallet",
  "methods": ["POST"]
}
```

## Usage

### Provision a Wallet for an Agent

1. **Create an agent** (existing flow, no changes):

```bash
curl -X POST http://localhost:5000/api/agent/create \
  -H "Content-Type: application/json" \
  -d '{
    "walletAddress": "0x...",
    "message": "Create EthCredit Agent",
    "signature": "0x..."
  }'
```

Response (example):
```json
{
  "did": "did:ethcredit:v1:0x...",
  "agentId": "sha256hash",
  "walletAddress": "0x...",
  "reputationScore": 0,
  "createdAt": "2026-05-02T..."
}
```

2. **Provision an internal wallet**:

```bash
curl -X POST http://localhost:5000/agent/{agentId}/provision-wallet
```

Response (200 OK):
```json
{
  "agentId": "sha256hash",
  "internalWalletAddress": "0x..."
}
```

**Error cases:**

- **Agent not found** (404):
```json
{
  "error": "Agent not found: {agentId}"
}
```

- **Invalid agentId** (400):
```json
{
  "error": "Invalid agentId: must be a non-empty string"
}
```

### Idempotency

Calling the endpoint twice with the same agentId returns the same address:

```bash
# First call
curl -X POST http://localhost:5000/agent/{agentId}/provision-wallet
# Response: { "agentId": "...", "internalWalletAddress": "0x..." }

# Second call (same agentId)
curl -X POST http://localhost:5000/agent/{agentId}/provision-wallet
# Response: { "agentId": "...", "internalWalletAddress": "0x..." } # SAME ADDRESS
```

## Verification & Testing

### Run Integration Tests

```bash
node tests/integration/walletProvisioning.test.js
```

This runs comprehensive tests covering:
- ✓ Happy path wallet provisioning
- ✓ Idempotency (calling twice returns same wallet)
- ✓ Encryption/decryption round-trip
- ✓ Agent not found error handling
- ✓ Invalid agent ID format rejection
- ✓ Wallet retrieval and signing capability

Expected output:
```
╔════════════════════════════════════════════════════════════╗
║   WALLET PROVISIONING SYSTEM - INTEGRATION TESTS            ║
╚════════════════════════════════════════════════════════════╝

=== TEST: Happy Path Wallet Provisioning ===
✓ Created test agent: clp...
✓ Provisioned wallet: 0x...
✓ DB state verified: internalWalletAddress and encryptedPrivateKey stored
✓ Wallet address format valid
✓ Test agent cleaned up
✓ Happy Path Test PASSED

[... more tests ...]

╔════════════════════════════════════════════════════════════╗
║   TEST SUMMARY: 6/6 tests passed                           ║
╚════════════════════════════════════════════════════════════╝
```

### Manual Verification in Prisma Studio

```bash
npx prisma studio
```

1. Navigate to the Agent model
2. Find an agent with an `internalWalletAddress`
3. Verify `encryptedPrivateKey` is a non-empty base64 string
4. Note: Private key should always be encrypted, never shown in plain text

## Important Security Notes

### Private Key Management
- **Never expose**: Private keys are encrypted and never returned by any API endpoint
- **Encrypted storage**: All private keys are encrypted using NaCl sealed box before DB storage
- **Decryption only**: Private keys are only decrypted internally for signing operations
- **SECRET_KEY protection**: The SECRET_KEY is critical — store it securely:
  - For development: Use `.env` file (already in `.gitignore`)
  - For staging/production: Use AWS Secrets Manager, HashiCorp Vault, or similar

### Database Security
- Encrypted private keys are stored as TEXT in PostgreSQL
- The `internalWalletAddress` index allows fast lookups without exposing keys
- Ensure PostgreSQL uses SSL/TLS for network connections in production

### Future Enhancements
- Implement key rotation strategy (with versioning)
- Add encrypted backup to AWS S3 + KMS
- Implement audit logging for key provisioning
- Build wallet signing endpoint for autonomous transaction execution

## Troubleshooting

### Secret Key Not Set
```
Error: SECRET_KEY environment variable is not set
```

**Solution**: Generate and add SECRET_KEY to `.env`:
```bash
node scripts/generateSecretKey.js
```

### Migration Fails
```
Error: relation "agents" does not exist
```

**Solution**: Ensure previous migrations have run. Check `_migrations` table:
```bash
psql -c "SELECT name FROM _migrations ORDER BY name;"
```

### Wallet Provisioning Returns 404
```
{ "error": "Agent not found: {agentId}" }
```

**Solution**: Verify the agent exists. Create one first using the existing `/api/agent/create` endpoint.

### Database Connection Error
```
Error: Failed to connect to database
```

**Solution**: Verify `DATABASE_URL` is set and PostgreSQL is running:
```bash
echo $DATABASE_URL
psql $DATABASE_URL -c "SELECT 1"
```

## File Structure

```
backend/
├── .env                               # Add SECRET_KEY here
├── .env.example                       # Template for .env
├── package.json                       # Added tweetnacl.js dependency
├── server.js                          # Updated to wire wallet provisioning route
├── db/
│   └── migrations/
│       └── 006_add_internal_wallet_fields.sql  # NEW migration
├── routes/
│   └── walletProvisioning.js          # NEW route handler
├── src/
│   ├── services/
│   │   ├── keyManagementService.js    # NEW encryption utilities
│   │   └── walletProvisioningService.js # NEW wallet provisioning logic
│   └── db/
│       └── prisma.js                  # (no changes)
├── prisma/
│   └── schema.prisma                  # Updated: added new Agent fields
├── scripts/
│   └── generateSecretKey.js           # NEW helper script
└── tests/
    └── integration/
        └── walletProvisioning.test.js # NEW comprehensive tests
```

## Next Steps

Once wallet provisioning is verified:

1. **Implement wallet signing** (`POST /agent/:agentId/sign-transaction`)
   - Use `getInternalWallet()` to retrieve the agent's wallet
   - Sign transaction payloads
   - Return signed tx ready for broadcast

2. **Integrate with swaps**
   - Use agent's internal wallet for autonomous swap execution
   - Chain quote → execute → settlement

3. **Integrate with vaults**
   - Use internal wallet for LP position management
   - Sign vault strategy transactions

4. **Add audit logging**
   - Track all wallet provisioning events
   - Compliance and debugging

5. **Production hardening**
   - Use Secrets Manager for SECRET_KEY
   - Add encrypted backups
   - Implement key rotation

## References

- [tweetnacl.js Documentation](https://tweetnacl.js.org/)
- [ethers.js Wallet API](https://docs.ethers.org/v6/api/wallet/)
- [Prisma Documentation](https://www.prisma.io/docs/)
- [NaCl Box Sealed Encryption](https://nacl.cr.yp.to/box.html)

---

**Questions or issues?** Review the troubleshooting section above or check integration test output for detailed error messages.
