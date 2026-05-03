/**
 * 0G Compute Service
 *
 * Integrates with 0G Network via the OpenAI-compatible Router API.
 * Uses system prompts to instruct an LLM to act as a DeFi agent
 * and make trading decisions, returning structured JSON.
 *
 * Interface:
 *   getDecision({ balances, lockedBalance, availableBalance, amount, token, history })
 *   → { action, tokenIn, tokenOut, amount, confidence, reason }
 */

const { OpenAI } = require('openai');

const SUPPORTED_ACTIONS = ['SWAP', 'ADD_LIQUIDITY'];
const ALLOWED_TOKENS = ['USDC', 'WETH', 'ETH'];

// Initialize OpenAI client using 0G testnet router
const client = new OpenAI({
    baseURL: process.env.ZERO_G_BASE_URL,
    apiKey: process.env.ZERO_G_API_KEY,
});

/**
 * Validate that a decision object returned by compute is well-formed.
 * Throws an error if the decision is invalid.
 * @param {Object} decision
 * @returns {void}
 */
function validateDecisionShape(decision) {
    if (!decision || typeof decision !== 'object') {
        throw Object.assign(new Error('0G Compute returned empty decision'), { statusCode: 502 });
    }
    if (!SUPPORTED_ACTIONS.includes(decision.action)) {
        throw Object.assign(
            new Error(`0G Compute returned unsupported action: ${decision.action}`),
            { statusCode: 502 }
        );
    }
    if (!decision.tokenIn || !ALLOWED_TOKENS.includes(decision.tokenIn.toUpperCase())) {
        throw Object.assign(
            new Error(`0G Compute returned invalid tokenIn: ${decision.tokenIn}`),
            { statusCode: 502 }
        );
    }
    if (!decision.tokenOut || !ALLOWED_TOKENS.includes(decision.tokenOut.toUpperCase())) {
        throw Object.assign(
            new Error(`0G Compute returned invalid tokenOut: ${decision.tokenOut}`),
            { statusCode: 502 }
        );
    }
    if (decision.tokenIn === decision.tokenOut) {
        throw Object.assign(new Error('0G Compute returned same tokenIn and tokenOut'), { statusCode: 502 });
    }
    if (!decision.amount || Number(decision.amount) <= 0) {
        throw Object.assign(new Error('0G Compute returned zero or missing amount'), { statusCode: 502 });
    }
}

/**
 * Get a trading decision from 0G Compute.
 *
 * @param {Object} params
 * @param {Object} params.balances         - { ETH, USDC } on-chain balances
 * @param {Object} params.lockedBalance    - { ETH?, USDC? } currently locked in escrow
 * @param {Object} params.availableBalance - { ETH, USDC } free balance (balance - locked)
 * @param {string|number} params.amount    - The escrow-locked amount available for this decision
 * @param {string} params.token            - Token the amount is denominated in
 * @param {Array}  params.history          - Recent swap transactions (optional)
 * @returns {Promise<{action, tokenIn, tokenOut, amount, confidence, reason}>}
 */
async function getDecision({ balances, lockedBalance, availableBalance, amount, token, history = [] }) {
    if (!process.env.ZERO_G_API_KEY || !process.env.ZERO_G_BASE_URL || !process.env.ZERO_G_MODEL) {
        console.warn('[0G-COMPUTE] Missing config, falling back to stub logic.');
        return getStubDecision(availableBalance, amount, token);
    }

    const systemPrompt = `You are an autonomous DeFi trading agent. Your job is to analyze wallet balances and make a single trading decision.
You must respond ONLY in valid JSON format. Do not include markdown formatting like \`\`\`json.
The JSON must perfectly match this schema:
{
  "action": "SWAP",
  "tokenIn": "USDC" or "WETH" or "ETH",
  "tokenOut": "USDC" or "WETH" or "ETH",
  "amount": <number, must be <= escrowAmount>,
  "confidence": <number between 0 and 1>,
  "reason": "<short string explaining the logic>"
}`;

    const userPrompt = `
Current Context:
- Available Balances: ${JSON.stringify(availableBalance)}
- Escrow Amount Locked for this trade: ${amount} ${token}
- Allowed Tokens: ${ALLOWED_TOKENS.join(', ')}

Please provide your trading decision.
`;

    try {
        const response = await client.chat.completions.create({
            model: process.env.ZERO_G_MODEL,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ]
        });

        const content = response.choices[0]?.message?.content;
        if (!content) {
            throw new Error('No content returned from 0G model');
        }

        // Clean up markdown if the model hallucinates it despite instructions
        const cleanContent = content.replace(/```json/g, '').replace(/```/g, '').trim();
        
        const decision = JSON.parse(cleanContent);
        
        // Ensure the amount is forced to string for consistency with downstream logic
        if (decision.amount) {
            decision.amount = String(decision.amount);
        }

        validateDecisionShape(decision);
        return decision;
    } catch (err) {
        console.error('[0G-COMPUTE] Error calling model or parsing JSON, falling back to stub:', err.message);
        return getStubDecision(availableBalance, amount, token);
    }
}

/**
 * Fallback stub logic in case the AI call fails or is unconfigured.
 */
function getStubDecision(availableBalance, amount, token) {
    let action = 'SWAP';
    let tokenIn;
    let tokenOut;

    const usdcAvailable = Number(availableBalance?.USDC || 0);
    const ethAvailable = Number(availableBalance?.ETH || 0);

    if (usdcAvailable > 0 && token?.toUpperCase() === 'USDC') {
        tokenIn = 'USDC';
        tokenOut = 'WETH';
    } else if (ethAvailable > 0) {
        tokenIn = 'WETH';
        tokenOut = 'USDC';
    } else {
        tokenIn = token?.toUpperCase() === 'USDC' ? 'USDC' : 'WETH';
        tokenOut = tokenIn === 'USDC' ? 'WETH' : 'USDC';
    }

    const decision = {
        action,
        tokenIn,
        tokenOut,
        amount: String(amount),
        confidence: 0.75,
        reason: '[FALLBACK] Heuristic: diversify to counterpart token',
    };

    validateDecisionShape(decision);
    return decision;
}

module.exports = {
    getDecision,
    validateDecisionShape,
    SUPPORTED_ACTIONS,
    ALLOWED_TOKENS,
};
