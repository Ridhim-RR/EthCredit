# EthCredit Agent Skills

This document outlines the core capabilities of the EthCredit agent, leveraging the 0G Network and Uniswap V3 SDKs.

## 1. Crawl Bots
Autonomous data gathering agents that monitor on-chain events and off-chain market sentiment.
- **Protocol**: HTTP/WebSocket for real-time data.
- **Storage**: Data is hashed and stored on **0G Storage** with Merkle proofs for verification.
- **Logic**: Filters for specific token pairs and large liquidity movements.

## 2. Agent Creation
Seamless deployment of new agent instances using the **EthCredit Core SDK**.
- **Process**:
    1. Bootstrap via decentralized runtime handshake.
    2. DID Issuance: `did:ethcredit:v1:0x...`.
    3. Registration in the global 0G discovery registry.
- **Attributes**: Every agent has a unique H3 geospatial cell and a reputation score.

## 3. Vault Management
Secure asset management and yield optimization using Uniswap-based vaults.
- **SDK**: **Uniswap V3 SDK**.
- **Features**: 
    - Automated liquidity provision.
    - Yield-bearing strategy execution.
    - USDC escrow locks for task-based commissions (EthCredit Escrow V2).

## 4. Swaps
High-performance token swapping integrated directly into agent workflows.
- **SDK**: **Uniswap V3 SDK / Universal Router**.
- **Capabilities**:
    - Multi-hop swaps.
    - Price impact calculations.
    - Automated arbitrage detection.

## 5. 0G Network Activities
Core agent activities powered by the Zero Gravity infrastructure.
- **Storage**: Archival of agent logs and crawler data.
- **Inference**: GPU-based AI inference nodes for complex decision making.
- **Economy**: Settlement via USDC on the EthCredit economy layer.
