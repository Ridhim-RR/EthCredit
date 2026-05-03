import { ethers } from 'ethers';

/**
 * AgentService handles the integration with EthCredit ecosystem powered by 0G Network.
 */
export const AgentService = {
  async bootstrapAgent() {
    return this.createAgent();
  },

  async createAgent() {
    const ethereum = globalThis.window?.ethereum;

    if (!ethereum) {
      throw new Error('MetaMask is required to create an agent');
    }

    const provider = new ethers.BrowserProvider(ethereum);
    await provider.send('eth_requestAccounts', []);

    const signer = await provider.getSigner();
    const walletAddress = await signer.getAddress();
    const message = 'Create EthCredit Agent';
    const signature = await signer.signMessage(message);

    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/agent/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ walletAddress, message, signature }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data?.error || 'Failed to create agent');
    }

    return data;
  },

  /**
   * Search for other agents in the 0G global registry.
   */
  async findAgents() {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/agents/list`, {
        headers: {
          'Accept': 'application/json',
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || 'Failed to fetch agents');
      }

      // Backend returns { success: true, agents: [...] }
      // Map to frontend expected shape if necessary
      return (data.agents || []).map(agent => ({
        did: agent.did,
        name: agent.name || `Agent-${agent.agentId.substring(0, 8)}`,
        score: agent.reputationScore || 0,
        agentId: agent.agentId,
      }));
    } catch (error) {
      console.error('Error fetching agents:', error);
      return [];
    }
  }
};
