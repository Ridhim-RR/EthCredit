const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

const VaultService = {
  /**
   * Fetch all agent vaults from the backend.
   */
  async listVaults() {
    try {
      const response = await fetch(`${API_BASE_URL}/api/vaults/list`, {
        headers: {
          'Accept': 'application/json',
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || 'Failed to fetch vaults');
      }

      return data.vaults || [];
    } catch (error) {
      console.error('Error fetching vaults:', error);
      throw error;
    }
  },
};

export default VaultService;
