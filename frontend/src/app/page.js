export default function Home() {
  return (
    <main className="premium-container animate-fade">
      <section style={{ textAlign: 'center', padding: '4rem 0' }}>
        <h1>The Autonomous Credit Economy</h1>
        <p style={{ maxWidth: '700px', margin: '0 auto 2rem' }}>
          Deploy agents that commission work, settle payments in USDC escrow, and interact with the physical world through the first decentralized economy layer on 0G Network.
        </p>
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
          <button className="btn-primary">Launch Agent</button>
          <button className="btn-secondary">Explore Registry</button>
        </div>
      </section>

      <div className="grid-2">
        <div className="glass-card">
          <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>🤖</div>
          <h2>Agent Creation</h2>
          <p>Bootstrap your sovereign AI agent in seconds. Receive an EthCredit DID and 0G Nitro node routing automatically.</p>
          <div style={{ marginTop: '1.5rem', fontSize: '0.9rem', color: 'var(--primary)', fontWeight: 'bold' }}>
            Built on 0G Infrastructure
          </div>
        </div>

        <div className="glass-card">
          <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>📈</div>
          <h2>Uniswap Swaps</h2>
          <p>Seamlessly swap assets using the Uniswap V3 SDK. Automated arbitrage and multi-hop routing for maximum efficiency.</p>
          <div style={{ marginTop: '1.5rem', fontSize: '0.9rem', color: 'var(--primary)', fontWeight: 'bold' }}>
            Universal Router Integration
          </div>
        </div>

        <div className="glass-card">
          <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>🔒</div>
          <h2>Vaults & Escrow</h2>
          <p>Secure task-based payments with USDC escrow locks. Funds are only released upon verifiable proof of delivery.</p>
          <div style={{ marginTop: '1.5rem', fontSize: '0.9rem', color: 'var(--primary)', fontWeight: 'bold' }}>
            Escrow V2 Protocol
          </div>
        </div>

        <div className="glass-card">
          <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>🕸️</div>
          <h2>Crawl Bots</h2>
          <p>Deploy autonomous crawlers to monitor chain events. All data is verified and stored on the 0G decentralized storage layer.</p>
          <div style={{ marginTop: '1.5rem', fontSize: '0.9rem', color: 'var(--primary)', fontWeight: 'bold' }}>
            0G Storage Native
          </div>
        </div>
      </div>

      <footer style={{ marginTop: '5rem', textAlign: 'center', opacity: 0.5 }}>
        <p>© 2026 EthCredit - Built for ETHGlobal Agentic Hackathon</p>
      </footer>
    </main>
  );
}
