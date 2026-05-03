'use client';
import { useState, useEffect } from 'react';
import { AgentService } from '@/services/agentService';

export default function AgentsPage() {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [createdAgentId, setCreatedAgentId] = useState('');
  const [createError, setCreateError] = useState('');

  const fetchAgents = async () => {
    setLoading(true);
    const data = await AgentService.findAgents();
    setAgents(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchAgents();
  }, []);

  const handleCreateAgent = async () => {
    try {
      setCreating(true);
      setCreateError('');
      setCreatedAgentId('');

      const result = await AgentService.createAgent();
      setCreatedAgentId(result.agentId);
      
      // Refresh the list to show the new agent
      await fetchAgents();
    } catch (error) {
      setCreateError(error.message || 'Failed to create agent');
    } finally {
      setCreating(false);
    }
  };

  return (
    <main className="premium-container">
      <section className="hero" style={{ paddingBottom: '2rem' }}>
        <h1>Agent Registry</h1>
        <p>Discover and interact with autonomous agents on the 0G Network.</p>
        <div style={{ marginTop: '2rem' }}>
          <button className="btn-primary" onClick={handleCreateAgent} disabled={creating}>
            {creating ? 'Creating...' : 'Create Agent'}
          </button>
          {createdAgentId && (
            <p style={{ marginTop: '1rem', color: 'var(--success-text)', fontSize: '0.875rem', fontWeight: '500' }}>
              Created agent ID: {createdAgentId}
            </p>
          )}
          {createError && (
            <p style={{ marginTop: '1rem', color: 'crimson', fontSize: '0.875rem', fontWeight: '500' }}>
              {createError}
            </p>
          )}
        </div>
      </section>

      <div className="grid-3" style={{ marginTop: '1rem', marginBottom: '6rem' }}>
        {loading ? (
          <p>Loading agents...</p>
        ) : (
          agents.map((agent) => (
            <div key={agent.did} className="bento-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                <h2 style={{ fontSize: '1.25rem', marginBottom: 0 }}>{agent.name}</h2>
                <span className="badge" style={{ marginTop: 0 }}>
                  Score: {agent.score}
                </span>
              </div>
              <div style={{ marginBottom: '1.5rem' }}>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '600' }}>
                  Decentralized ID
                </p>
                <p style={{ fontSize: '0.875rem', wordBreak: 'break-all', fontFamily: 'monospace', background: 'var(--cream)', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border)', color: 'var(--void)' }}>
                  {agent.did}
                </p>
              </div>
              <div style={{ marginTop: 'auto', display: 'flex', gap: '0.75rem' }}>
                <button className="btn-secondary" style={{ flex: 1, padding: '0.5rem', fontSize: '0.875rem' }}>View Logs</button>
                <button className="btn-primary" style={{ flex: 1, padding: '0.5rem', fontSize: '0.875rem' }}>Commission</button>
              </div>
            </div>
          ))
        )}
      </div>
    </main>
  );
}
