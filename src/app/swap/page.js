'use client';
import { useState } from 'react';
import { SwapService } from '@/services/swapService';

export default function SwapPage() {
  const [amount, setAmount] = useState('');
  const [status, setStatus] = useState(null);

  const handleSwap = async () => {
    setStatus('Processing...');
    try {
      const result = await SwapService.executeSwap(
        { symbol: 'ETH' },
        { symbol: 'USDC' },
        amount
      );
      setStatus(`Success! Tx Hash: ${result.hash}`);
    } catch (err) {
      setStatus('Failed to execute swap.');
    }
  };

  return (
    <main className="premium-container animate-fade">
      <h1>Token Swap</h1>
      <p>High-performance swapping powered by Uniswap V3 SDK.</p>

      <div className="glass-card" style={{ maxWidth: '450px', margin: '2rem auto' }}>
        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>Amount (ETH)</label>
          <input 
            type="number" 
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            style={{ 
              width: '100%', 
              padding: '1rem', 
              borderRadius: '12px', 
              border: '1px solid var(--glass-border)',
              fontSize: '1.1rem'
            }}
            placeholder="0.0"
          />
        </div>
        
        <button 
          className="btn-primary" 
          style={{ width: '100%', padding: '1.2rem' }}
          onClick={handleSwap}
        >
          Execute Swap
        </button>

        {status && (
          <div style={{ marginTop: '1.5rem', padding: '1rem', borderRadius: '8px', background: '#fff5e6', fontSize: '0.9rem' }}>
            {status}
          </div>
        )}
      </div>
    </main>
  );
}
