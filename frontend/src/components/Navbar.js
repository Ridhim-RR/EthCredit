'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';

export default function Navbar() {
  const [account, setAccount] = useState(null);
  const pathname = usePathname();

  useEffect(() => {
    checkConnection();
    if (globalThis.window?.ethereum) {
      globalThis.window.ethereum.on('accountsChanged', (accounts) => {
        if (accounts.length > 0) {
          setAccount(accounts[0]);
        } else {
          setAccount(null);
        }
      });
    }
  }, []);

  const checkConnection = async () => {
    if (globalThis.window?.ethereum) {
      try {
        const accounts = await globalThis.window.ethereum.request({ method: 'eth_accounts' });
        if (accounts.length > 0) {
          setAccount(accounts[0]);
        }
      } catch (err) {
        console.error('Connection check failed:', err);
      }
    }
  };

  const connectWallet = async () => {
    if (globalThis.window?.ethereum) {
      try {
        const accounts = await globalThis.window.ethereum.request({ method: 'eth_requestAccounts' });
        if (accounts.length > 0) {
          setAccount(accounts[0]);
        }
      } catch (err) {
        console.error('User rejected connection');
      }
    } else {
      alert('Please install MetaMask to use EthCredit.');
    }
  };

  return (
    <nav>
      <div className="logo">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="24" height="24" fill="none" stroke="#06b6d4" strokeWidth="2" />
          <path d="M7 17V7L17 17H7Z" fill="#06b6d4" />
          <path d="M17 7V17" stroke="#14b8a6" strokeWidth="2" strokeLinecap="square" />
        </svg>
        EthCredit_Terminal
      </div>
      <div className="nav-links">
        <a href="/" className={pathname === '/' ? 'active' : ''}>Dashboard</a>
        <a href="/agents" className={pathname === '/agents' ? 'active' : ''}>Agents</a>
        <a href="/swap" className={pathname === '/swap' ? 'active' : ''}>Swap</a>
        <a href="/vault" className={pathname === '/vault' ? 'active' : ''}>Vault</a>
      </div>
      <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
        <span style={{ fontSize: '0.75rem', color: 'var(--success-text)', marginRight: '1rem' }}>
          <span className="status-indicator"></span>
          NODE_ONLINE
        </span>
        <button 
          className="btn-primary" 
          onClick={connectWallet}
          style={{ minWidth: '160px' }}
        >
          {account ? `[ ${account.slice(0, 6)}...${account.slice(-4)} ]` : '[ CONNECT_WALLET ]'}
        </button>
      </div>
    </nav>
  );
}
