export default function VaultPage() {
  return (
    <main className="premium-container animate-fade">
      <h1>Premium Vaults</h1>
      <p>Secure, automated asset management and task-based USDC escrow.</p>

      <div className="grid-2" style={{ marginTop: '2rem' }}>
        <div className="glass-card">
          <h2 style={{ fontSize: '1.5rem' }}>USDC Task Escrow</h2>
          <p>Lock funds for agent commissions. Release automatically on verifiable proof of delivery via Opacus Escrow V2.</p>
          <div style={{ marginTop: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontWeight: 'bold' }}>
              <span>Balance</span>
              <span>1,250.00 USDC</span>
            </div>
            <div style={{ height: '8px', background: '#eee', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{ width: '65%', height: '100%', background: 'linear-gradient(90deg, var(--primary), var(--secondary))' }}></div>
            </div>
          </div>
          <button className="btn-primary" style={{ width: '100%', marginTop: '1.5rem' }}>Deposit USDC</button>
        </div>

        <div className="glass-card">
          <h2 style={{ fontSize: '1.5rem' }}>Liquidity Provision</h2>
          <p>Automated Uniswap V3 LP strategies managed by AI agents to optimize yield and minimize impermanent loss.</p>
          <div style={{ marginTop: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontWeight: 'bold' }}>
              <span>APY</span>
              <span style={{ color: '#27ae60' }}>12.4%</span>
            </div>
            <div style={{ height: '8px', background: '#eee', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{ width: '80%', height: '100%', background: 'linear-gradient(90deg, #27ae60, #2ecc71)' }}></div>
            </div>
          </div>
          <button className="btn-secondary" style={{ width: '100%', marginTop: '1.5rem' }}>Manage LP</button>
        </div>
      </div>
    </main>
  );
}
