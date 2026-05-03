'use client';

import { useState, useEffect } from 'react';
import { AgentService } from '@/services/agentService';

export default function AgentsPage() {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [createdAgentId, setCreatedAgentId] = useState('');
  const [createError, setCreateError] = useState('');

  // Logs modal state
  const [showLogs, setShowLogs] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

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

  const handleViewLogs = async (agent) => {
    try {
      setSelectedAgent(agent);
      setShowLogs(true);
      setLoadingLogs(true);
      setLogs([]);
      const data = await AgentService.getAgentTransactions(agent.agentId);
      setLogs(data);
    } catch (error) {
      console.error('Error fetching logs:', error);
    } finally {
      setLoadingLogs(false);
    }
  };

  return (
    <main className="premium-container">
      <section className="hero" style={{ paddingBottom: '1rem' }}>
        <div className="terminal-line">
          <span className="prompt">ethcredit@0g-network:~$</span>
          <span className="cmd">./list_agents.sh</span>
        </div>
        <h1>AGENT_REGISTRY</h1>
        <p>Discover and interact with autonomous agents on the 0G Network.</p>
        
        <div style={{ marginTop: '2rem', padding: '1.5rem', background: 'rgba(99, 102, 241, 0.05)', border: '1px solid var(--border)', borderRadius: '12px' }}>
          <button 
            className="btn-primary" 
            onClick={handleCreateAgent}
            disabled={creating}
          >
            {creating ? 'INITIALIZING AGENT...' : 'CREATE NEW AGENT'}
          </button>
          
          {createdAgentId && (
            <p style={{ marginTop: '1rem', color: 'var(--success-text)', fontSize: '0.875rem', fontWeight: '500' }}>
              ✓ Agent created: {createdAgentId.substring(0, 12)}...
            </p>
          )}
          {createError && (
            <p style={{ marginTop: '1rem', color: '#fca5a5', fontSize: '0.875rem', fontWeight: '500' }}>
              ⚠️ {createError}
            </p>
          )}
        </div>
      </section>

      <div className="grid-3" style={{ marginTop: '1rem', marginBottom: '6rem' }}>
        {loading ? (
          <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '4rem', opacity: 0.5 }}>
            SCANNING 0G REGISTRY...
          </div>
        ) : (
          agents.map((agent) => (
            <div key={agent.did} className="webtui-panel" style={{ minHeight: '300px' }}>
              <div className="panel-header">
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span className="status-indicator"></span> 
                  {agent.name.toUpperCase()}
                </span>
                <span style={{ color: 'var(--accent-cyan)', fontWeight: 'bold' }}>SCORE: {agent.score}</span>
              </div>
              
              <div style={{ marginBottom: '1.5rem' }}>
                <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '600' }}>
                  Decentralized ID
                </p>
                <p style={{ fontSize: '0.875rem', wordBreak: 'break-all', fontFamily: 'monospace', background: 'rgba(0,0,0,0.3)', padding: '0.75rem', border: '1px solid var(--border)', color: 'var(--void)' }}>
                  {agent.did}
                </p>
              </div>

              <div style={{ marginTop: 'auto', display: 'flex', gap: '0.75rem' }}>
                <button 
                  className="btn-secondary" 
                  style={{ flex: 1, fontSize: '0.8rem' }}
                  onClick={() => handleViewLogs(agent)}
                >
                  VIEW LOGS
                </button>
                <button className="btn-primary" style={{ flex: 1, fontSize: '0.8rem' }}>COMMISSION</button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Logs Modal */}
      {showLogs && (
        <div style={{ 
          position: 'fixed', 
          top: 0, 
          left: 0, 
          width: '100%', 
          height: '100%', 
          background: 'rgba(0,0,0,0.85)', 
          backdropFilter: 'blur(8px)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem'
        }}>
          <div style={{ 
            width: '100%', 
            maxWidth: '800px', 
            background: 'var(--sand)', 
            border: '1px solid var(--accent-cyan)',
            boxShadow: '0 0 40px rgba(6, 182, 212, 0.15)',
            maxHeight: '80vh',
            display: 'flex',
            flexDirection: 'column',
            position: 'relative'
          }}>
            <div style={{ padding: '1.25rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div className="status-indicator"></div>
                <h3 style={{ margin: 0, fontSize: '1rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                  TRANSACTION_LOGS: {selectedAgent?.name}
                </h3>
              </div>
              <button 
                onClick={() => setShowLogs(false)}
                style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '1.5rem', cursor: 'pointer', opacity: 0.6 }}
              >
                ×
              </button>
            </div>

            <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1 }}>
              {loadingLogs ? (
                <div style={{ textAlign: 'center', padding: '3rem', opacity: 0.5 }}>
                  <div className="spinner-small" style={{ margin: '0 auto 1rem' }}></div>
                  RETRIEVING DATA FROM 0G STORAGE...
                </div>
              ) : logs.length > 0 ? (
                <div style={{ display: 'grid', gap: '1rem' }}>
                  {logs.map((log, i) => (
                    <div key={i} style={{ 
                      padding: '1rem', 
                      background: 'rgba(255,255,255,0.02)', 
                      border: '1px solid var(--border)',
                      fontFamily: 'monospace'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                        <span style={{ color: 'var(--accent-cyan)' }}>[{log.type}]</span>
                        <span style={{ opacity: 0.5, fontSize: '0.8rem' }}>{new Date(log.createdAt).toLocaleString()}</span>
                      </div>
                      <div style={{ fontSize: '0.85rem', display: 'grid', gap: '0.4rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ opacity: 0.6 }}>TX_HASH:</span>
                          <a 
                            href={`https://sepolia.basescan.org/tx/${log.txHash}`} 
                            target="_blank" 
                            rel="noreferrer"
                            style={{ color: 'var(--accent-cyan)', textDecoration: 'none' }}
                          >
                            {log.txHash.slice(0, 12)}...
                          </a>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ opacity: 0.6 }}>0G_ROOT:</span>
                          <span style={{ color: 'var(--accent-teal)' }}>{log.rootHash.slice(0, 12)}...</span>
                        </div>
                        <div style={{ marginTop: '0.5rem', padding: '0.5rem', background: 'rgba(0,0,0,0.2)', fontSize: '0.75rem', color: '#888' }}>
                          PAYLOAD: {JSON.stringify(log.payload)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '3rem', opacity: 0.4 }}>
                  NO TRANSACTION RECORDS FOUND FOR THIS AGENT.
                </div>
              )}
            </div>

            <div style={{ padding: '1rem', background: 'rgba(0,0,0,0.2)', borderTop: '1px solid var(--border)', textAlign: 'right' }}>
              <button 
                className="btn-secondary" 
                onClick={() => setShowLogs(false)}
                style={{ fontSize: '0.8rem', padding: '0.5rem 1.5rem' }}
              >
                CLOSE_TERMINAL
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
