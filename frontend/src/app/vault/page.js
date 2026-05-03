'use client';

import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import VaultService from '@/services/vaultService';
import { ERC20_ABI, USDC_ADDRESS } from '@/services/abis';

export default function VaultPage() {
  const [vaults, setVaults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [depositing, setDepositing] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [amounts, setAmounts] = useState({}); // { [vaultId]: string }

  const fetchVaults = async () => {
    try {
      setLoading(true);
      const data = await VaultService.listVaults();
      setVaults(data);
    } catch (err) {
      console.error('Failed to load vaults:', err);
      setError('Failed to load vaults from registry.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVaults();
  }, []);

  const handleDeposit = async (vault) => {
    try {
      const amountStr = amounts[vault.id];
      if (!amountStr || isNaN(amountStr) || Number(amountStr) <= 0) {
        alert('Please enter a valid USDC amount');
        return;
      }

      setDepositing(vault.id);
      setError('');

      if (!globalThis.window?.ethereum) {
        throw new Error('MetaMask is required to deposit.');
      }

      const provider = new ethers.BrowserProvider(globalThis.window.ethereum);
      const signer = await provider.getSigner();
      
      const usdcContract = new ethers.Contract(USDC_ADDRESS, ERC20_ABI, signer);
      const decimals = 6;
      const amount = ethers.parseUnits(amountStr, decimals);

      const tx = await usdcContract.transfer(vault.walletAddress, amount);
      await tx.wait();

      setSuccess(`Successfully deposited ${amountStr} USDC to ${vault.agentName}`);
      setAmounts(prev => ({ ...prev, [vault.id]: '' }));
      await fetchVaults();

      // Clear success message after 5 seconds
      setTimeout(() => setSuccess(''), 5000);
    } catch (err) {
      console.error('Deposit error:', err);
      setError(err.message || 'Deposit failed');
    } finally {
      setDepositing(null);
    }
  };

  return (
    <main className="premium-container">
      <section className="hero" style={{ paddingBottom: '1rem' }}>
        <div className="terminal-line">
          <span className="prompt">ethcredit@0g-network:~$</span>
          <span className="cmd">./inspect_vaults.sh</span>
        </div>
        <h1>SECURE_ESCROW_VAULTS</h1>
        <p>Automated asset management and task-based USDC escrow locks.</p>
      </section>

      {error && (
        <div style={{ marginBottom: '2rem', padding: '1rem', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', color: '#fca5a5', animation: 'fade-in 0.3s ease-out' }}>
          <span style={{ marginRight: '0.8rem' }}>⚠️</span> {error}
        </div>
      )}

      {success && (
        <div style={{ marginBottom: '2rem', padding: '1rem', background: 'rgba(34, 197, 94, 0.1)', border: '1px solid #4ade80', color: '#4ade80', animation: 'fade-in 0.3s ease-out' }}>
          <span style={{ marginRight: '0.8rem' }}>✓</span> {success}
        </div>
      )}

      {loading ? (
        <div style={{ padding: '4rem', textAlign: 'center', opacity: 0.5 }}>
          SCANNING VAULT REGISTRY...
        </div>
      ) : (
        <div className="grid-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '2rem' }}>
          {vaults.map((vault) => (
            <div className="webtui-panel" key={vault.id}>
              <div className="panel-header">
                <span>
                  <span className={`status-indicator ${vault.status === 'active' ? 'active' : ''}`} 
                        style={{ background: vault.status === 'active' ? 'var(--success-text)' : '#ef4444' }}></span> 
                  {vault.agentName.toUpperCase()}
                </span>
                <span>USDC-NATIVE</span>
              </div>
              <p style={{ marginBottom: '1.5rem', fontSize: '0.85rem' }}>
                Managed agentic vault for automated DeFi operations. 
                <br/>
                <span style={{ fontFamily: 'monospace', opacity: 0.6 }}>{vault.walletAddress}</span>
              </p>
              
              <div style={{ background: 'var(--cream)', border: '1px solid var(--border)', padding: '1.2rem', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.8rem', color: 'var(--text-muted)' }}>
                  <span>VAULT_BALANCE</span>
                  <span style={{ color: 'var(--void)', fontWeight: 'bold' }}>
                    {Number(vault.balance?.USDC || 0).toLocaleString()} USDC
                  </span>
                </div>
                <div style={{ height: '4px', background: 'var(--border)', width: '100%', position: 'relative' }}>
                  <div style={{ 
                    width: `${Math.min(100, ((vault.balance?.USDC || 0) / 2000) * 100)}%`, 
                    height: '100%', 
                    background: 'var(--accent-cyan)', 
                    boxShadow: 'var(--accent-glow)' 
                  }}></div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.8rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  <span>{((vault.balance?.USDC || 0) / 2000 * 100).toFixed(1)}% CAPACITY</span>
                  <span>LOCKED: {Number(vault.lockedBalance?.USDC || 0).toLocaleString()} USDC</span>
                </div>
              </div>

              {/* Amount Input */}
              <div style={{ marginBottom: '1.5rem' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Deposit Amount (USDC)</div>
                <input 
                  type="text" 
                  placeholder="0.00"
                  value={amounts[vault.id] || ''}
                  onChange={(e) => setAmounts(prev => ({ ...prev, [vault.id]: e.target.value }))}
                  style={{ 
                    width: '100%', 
                    background: 'rgba(0,0,0,0.3)', 
                    border: '1px solid var(--border)', 
                    color: '#fff', 
                    padding: '0.8rem',
                    fontFamily: 'monospace',
                    fontSize: '1rem',
                    outline: 'none'
                  }}
                  onFocus={(e) => e.target.style.borderColor = 'var(--accent-cyan)'}
                  onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
                />
              </div>
              
              <div style={{ marginTop: 'auto', display: 'flex', gap: '1rem' }}>
                <button 
                  className="btn-primary" 
                  style={{ flex: 1 }}
                  onClick={() => handleDeposit(vault)}
                  disabled={depositing === vault.id}
                >
                  {depositing === vault.id ? 'PENDING...' : 'DEPOSIT_USDC()'}
                </button>
                <button className="btn-secondary" style={{ flex: 1 }} disabled>WITHDRAW()</button>
              </div>
            </div>
          ))}

          {vaults.length === 0 && (
            <div style={{ gridColumn: '1 / -1', padding: '4rem', textAlign: 'center', background: 'rgba(255,255,255,0.02)', border: '1px dashed var(--border)' }}>
              NO ACTIVE VAULTS DETECTED. CREATE AN AGENT TO INITIALIZE A VAULT.
            </div>
          )}
        </div>
      )}
    </main>
  );
}
