import { Opacus } from 'opacus-agent-sdk';

/**
 * AgentService handles the integration with EthCredit ecosystem powered by 0G Network.
 */
export const AgentService = {
  /**
   * Bootstraps an agent on the EthCredit network.
   * This issues a DID and routes the agent to the nearest 0G Nitro node.
   */
  async bootstrapAgent(apiKey) {
    try {
      console.log('Bootstrapping agent with EthCredit infrastructure...');
      const { did, token } = await Opacus.autoConnect({ apiKey });
      console.log('EthCredit agent bootstrapped successfully!');
      return { did, token };
    } catch (error) {
      console.error('Failed to bootstrap agent:', error);
      throw error;
    }
  },

  /**
   * Search for other agents in the 0G global registry.
   */
  async findAgents(query) {
    try {
      // Mocking discovery call for now as per REST API docs
      // const response = await fetch(`${OPACUS_API}/discovery/search?q=${query}`);
      return [
        { did: 'did:opacus:v1:0x123', name: 'PriceOracle', score: 98 },
        { did: 'did:opacus:v1:0x456', name: 'LiquidityBot', score: 95 },
      ];
    } catch (error) {
      console.error('Discovery failed:', error);
      return [];
    }
  }
};
