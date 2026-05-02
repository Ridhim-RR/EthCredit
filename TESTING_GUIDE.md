# EthCredit Agent Flow Testing Guide

Complete step-by-step guide to test the agent creation and vault provisioning flow using Postman and curl.

---

## Prerequisites Setup

### 1. Start the Backend Server
```bash
cd /home/ridhim/Documents/EthCredit/backend
npm run dev
```
Expected output: `Server running on port 5000`

### 2. Generate SECRET_KEY (if not already done)
```bash
node scripts/generateSecretKey.js
```
Copy the output and add to `.env`:
```
SECRET_KEY=<paste-the-output-here>
```

### 3. Run Database Migration
```bash
npm run db:migrate
```
Verify the `vaults` table was created.

---

## Testing Flow - Step by Step

### STEP 1: Create Agent with Backend-Generated Wallet

This creates an agent and automatically provisions a vault with an encrypted wallet.

**Using cURL:**
```bash
curl -X POST http://localhost:5000/agent/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "TestAgent-001",
    "metadata": {
      "purpose": "data_crawling",
      "region": "us-east-1"
    }
  }'
```

**Expected Response (200 OK):**
```json
{
  "success": true,
  "agent": {
    "id": "agent_abc123xyz",
    "name": "TestAgent-001",
    "did": "did:ethcredit:v1:0x...",
    "internalWalletAddress": "0xF9b1A18f1587A902A9BAf078d25bd431F3D785cA",
    "createdAt": "2026-05-02T10:30:00Z"
  },
  "vault": {
    "id": "vault_123",
    "walletAddress": "0xF9b1A18f1587A902A9BAf078d25bd431F3D785cA",
    "balance": 0,
    "createdAt": "2026-05-02T10:30:00Z"
  }
}
```

**Save the Response:**
- Copy `agentId` (the public identifier returned in the creation response) → Use as `{AGENT_ID}` in next steps
- Copy `vault.walletAddress` → Use as `{WALLET_ADDRESS}`

---

### STEP 2: Retrieve Agent Vault Details

Get the wallet address and balance for the created agent.

**Using cURL:**
```bash
curl -X GET http://localhost:5000/agent/{AGENT_ID}/vault \
  -H "Content-Type: application/json"
```

**Replace `{AGENT_ID}` with the actual agent ID from STEP 1**

Example with real ID (public `agentId`):
```bash
curl -X GET http://localhost:5000/agent/c689d1e75122fae01279640a6cec3ef31f30484f4f18123b2bd4c3525af7ebb1/vault \
  -H "Content-Type: application/json"
```

**Observed Response (200 OK):**
```json
{
  "walletAddress": "0x51db55d416aDBaE6D18F9Cfc390AA6fAAA6140fd",
  "balance": 0
}
```

---

### STEP 3: Create Agent with Signature Verification (Optional Flow)

This flow requires generating a signature from an existing wallet (e.g., MetaMask).

#### 3a. Generate Signature (Using ethers.js)

First, create a script to generate a signature:

```javascript
// File: sign-message.js
const ethers = require('ethers');

// Use any wallet - for testing you can use a random one
const wallet = ethers.Wallet.createRandom();
const message = "Register agent on EthCredit";

const signature = await wallet.signMessage(message);

console.log('Wallet Address:', wallet.address);
console.log('Message:', message);
console.log('Signature:', signature);
```

Run it:
```bash
node sign-message.js
```

Output will show:
```
Wallet Address: 0x...
Message: Register agent on EthCredit
Signature: 0x...
```

#### 3b. Send Registration with Signature

**Using cURL:**
```bash
curl -X POST http://localhost:5000/register-agent \
  -H "Content-Type: application/json" \
  -d '{
    "walletAddress": "0x...",
    "message": "Register agent on EthCredit",
    "signature": "0x..."
  }'
```

**Example:**
```bash
curl -X POST http://localhost:5000/register-agent \
  -H "Content-Type: application/json" \
  -d '{
    "walletAddress": "0xF9b1A18f1587A902A9BAf078d25bd431F3D785cA",
    "message": "Register agent on EthCredit",
    "signature": "0x1234567890abcdef..."
  }'
```

**Expected Response (200 OK):**
```json
{
  "success": true,
  "agent": {
    "id": "agent_sig123xyz",
    "did": "did:ethcredit:v1:0x...",
    "internalWalletAddress": "0x...",
    "createdAt": "2026-05-02T10:30:00Z"
  },
  "vault": {
    "id": "vault_456",
    "walletAddress": "0x...",
    "balance": 0
  }
}
```

---

## Complete Postman Collection

Import this JSON into Postman to test all endpoints at once.

### Import Steps:
1. Open Postman
2. Click **Import** (top left)
3. Select **Paste Raw Text**
4. Copy-paste the JSON below
5. Click **Import**

### Postman Collection JSON:

```json
{
  "info": {
    "name": "EthCredit Agent Flow",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": [
    {
      "name": "1. Create Agent (Backend-Generated)",
      "request": {
        "method": "POST",
        "url": "http://localhost:5000/agent/register",
        "header": [
          {
            "key": "Content-Type",
            "value": "application/json"
          }
        ],
        "body": {
          "mode": "raw",
          "raw": "{\n  \"name\": \"TestAgent-001\",\n  \"metadata\": {\n    \"purpose\": \"data_crawling\",\n    \"region\": \"us-east-1\"\n  }\n}"
        }
      },
      "response": []
    },
    {
      "name": "2. Get Agent Vault",
      "request": {
        "method": "GET",
        "url": "http://localhost:5000/agent/{{AGENT_ID}}/vault",
        "header": [
          {
            "key": "Content-Type",
            "value": "application/json"
          }
        ]
      },
      "response": []
    },
    {
      "name": "3. Create Agent (Signature-Verified)",
      "request": {
        "method": "POST",
        "url": "http://localhost:5000/register-agent",
        "header": [
          {
            "key": "Content-Type",
            "value": "application/json"
          }
        ],
        "body": {
          "mode": "raw",
          "raw": "{\n  \"walletAddress\": \"0x...\",\n  \"message\": \"Register agent on EthCredit\",\n  \"signature\": \"0x...\"\n}"
        }
      },
      "response": []
    }
  ],
  "variable": [
    {
      "key": "AGENT_ID",
      "value": "",
      "type": "string"
    }
  ]
}
```

---

## Error Scenarios & Troubleshooting

### Error 1: Agent Not Found (404)
```bash
curl -X GET http://localhost:5000/agent/invalid_id/vault
```

**Response:**
```json
{
  "error": "Agent not found",
  "statusCode": 404
}
```

**Fix:** Ensure you're using a valid `{AGENT_ID}` from a successful creation.

---

### Error 2: Invalid Signature (400)
```bash
curl -X POST http://localhost:5000/register-agent \
  -H "Content-Type: application/json" \
  -d '{
    "walletAddress": "0x123...",
    "message": "Wrong message",
    "signature": "0xabc..."
  }'
```

**Response:**
```json
{
  "error": "Invalid signature or wallet mismatch",
  "statusCode": 400
}
```

**Fix:** Ensure signature was generated from the correct wallet address and exact message.

---

### Error 3: Missing SECRET_KEY (500)
```json
{
  "error": "Encryption key not configured",
  "statusCode": 500
}
```

**Fix:** Run `node scripts/generateSecretKey.js` and add SECRET_KEY to `.env`.

---

### Error 4: Database Connection Error (500)
```json
{
  "error": "Database connection failed",
  "statusCode": 500
}
```

**Fix:**
- Verify PostgreSQL is running
- Check DATABASE_URL in `.env`
- Run `npm run db:migrate` to ensure schema exists

---

## Full Testing Workflow (Copy-Paste Ready)

### Terminal 1: Backend Server
```bash
cd /home/ridhim/Documents/EthCredit/backend
npm run dev
```

### Terminal 2: Run All Tests in Sequence

```bash
# Test 1: Create Agent
AGENT_RESPONSE=$(curl -X POST http://localhost:5000/agent/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "TestAgent-001",
    "metadata": {"purpose": "data_crawling"}
  }')

echo "Create Agent Response:"
echo "$AGENT_RESPONSE" | jq .

# Extract Agent ID
  AGENT_ID=$(echo "$AGENT_RESPONSE" | jq -r '.agentId')
echo "Extracted Agent ID: $AGENT_ID"
    {
      "key": "AGENT_ID",
      "value": "",
      "type": "string",
      "description": "Public agentId returned by create response (use as {{AGENT_ID}})"
    }

# Test 3: Create Multiple Agents
echo -e "\n\nCreate Second Agent:"
curl -X POST http://localhost:5000/agent/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "TestAgent-002",
    "metadata": {"purpose": "swap_execution"}
  }' | jq .
```

---

## Variables to Track

As you test, save these values for reference:

| Variable | Value | Where From |
|----------|-------|-----------|
| `BASE_URL` | `http://localhost:5000` | Server URL |
| `AGENT_ID` | `agent_abc123xyz` | Response from Step 1 |
| `WALLET_ADDRESS` | `0xF9b1A18f...` | Response from Step 1 or Step 2 |
| `SECRET_KEY` | Base64 string | Generated via `generateSecretKey.js` |

---

## Advanced Testing

### Test Idempotency (Creating Same Agent Twice)

```bash
# First creation
curl -X POST http://localhost:5000/agent/register \
  -H "Content-Type: application/json" \
  -d '{"name": "IdempotencyTest", "metadata": {}}'

# Second creation with same data
# Should return different agent (new ID)
curl -X POST http://localhost:5000/agent/register \
  -H "Content-Type: application/json" \
  -d '{"name": "IdempotencyTest", "metadata": {}}'
```

Both should succeed with different `agentId` values.

---

### Test Wallet Encryption (Verify Crypto Works)

```bash
npm run test:agent-vault
```

This runs the integration test that verifies:
- ✓ Wallet is encrypted in database
- ✓ Wallet can be decrypted
- ✓ Decrypted wallet correctly reconstructs the address

---

## Postman Environment Setup (Optional)

For easier testing, set up environment variables in Postman:

1. Click **Environments** (gear icon)
2. Click **Create new environment**
3. Add these variables:

```
BASE_URL: http://localhost:5000
AGENT_ID: (leave empty, will populate after first request)
WALLET_ADDRESS: (leave empty, will populate after first request)
SECRET_KEY: (your generated key)
```

Then use `{{BASE_URL}}` in requests instead of hardcoding URLs.

---

## Quick Reference Commands

```bash
# Start backend
npm run dev

# Generate encryption key
node scripts/generateSecretKey.js

# Run migrations
npm run db:migrate

# Run integration tests
npm run test:agent-vault

# Create agent (bash one-liner)
curl -X POST http://localhost:5000/agent/register \
  -H "Content-Type: application/json" \
  -d '{"name": "Agent1", "metadata": {}}'

# Get agent vault (replace AGENT_ID)
curl -X GET http://localhost:5000/agent/AGENT_ID/vault
```

---

## Next Steps After Testing

Once all endpoints work:

1. ✅ Verify wallet addresses are valid Ethereum addresses
2. ✅ Confirm encrypted private keys are stored in database
3. ✅ Test with real USDC transfers to the vault address
4. ✅ Implement wallet signing endpoint (`POST /agent/:id/sign-transaction`)
5. ✅ Connect swap flow to agent vaults

---

## Debugging Tips

**Issue: "Cannot GET /agent/register"**
- Ensure backend is running (`npm run dev`)
- Check server output for route registration

**Issue: "Field 'agents.internalWalletAddress' doesn't exist"**
- Run migration: `npm run db:migrate`
- Verify Prisma generated client: `npx prisma generate`

**Issue: "SECRET_KEY not configured"**
- Generate with: `node scripts/generateSecretKey.js`
- Add to `.env` file (not committed to git)

**Issue: JSON parsing errors in response**
- Ensure backend didn't crash: check server terminal
- Verify Content-Type header is set to `application/json`

