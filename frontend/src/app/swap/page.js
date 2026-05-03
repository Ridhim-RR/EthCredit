'use client';
/* eslint-disable @next/next/no-img-element */
import { useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { SwapService } from '@/services/swapService';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

function TokenDropdown({ label, fieldId, selectedToken, tokens, isOpen, onToggle, onSelect }) {
  return (
    <div style={{ marginBottom: '0.75rem', position: 'relative' }}>
      <button
        type="button"
        id={fieldId}
        onClick={onToggle}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.75rem',
          padding: '0.9rem',
          borderRadius: '10px',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          background: 'rgba(0, 0, 0, 0.3)',
          color: '#fff',
          cursor: 'pointer',
        }}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <span style={{ fontSize: '0.9rem', opacity: 0.8 }}>{label}</span>
        {selectedToken ? (
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <img
              src={selectedToken.logoURI}
              alt={selectedToken.symbol}
              width={24}
              height={24}
              style={{ borderRadius: '999px', objectFit: 'cover', background: '#fff' }}
            />
            <span style={{ fontWeight: 600 }}>{selectedToken.name}</span>
            <span style={{ opacity: 0.7 }}>({selectedToken.symbol})</span>
          </span>
        ) : (
          <span style={{ opacity: 0.7 }}>Select token</span>
        )}
      </button>

      {isOpen && (
        <div
          style={{
            position: 'absolute',
            zIndex: 10,
            top: 'calc(100% + 0.5rem)',
            left: 0,
            right: 0,
            maxHeight: '260px',
            overflowY: 'auto',
            borderRadius: '12px',
            border: '1px solid rgba(255, 255, 255, 0.14)',
            background: 'rgba(10, 12, 24, 0.98)',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.35)',
          }}
        >
          {tokens.map((token) => (
            <button
              type="button"
              key={token.address}
              onClick={() => onSelect(token)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.85rem 1rem',
                border: 'none',
                borderBottom: '1px solid rgba(255,255,255,0.06)',
                background: 'transparent',
                color: '#fff',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <img
                src={token.logoURI}
                alt={token.symbol}
                width={28}
                height={28}
                style={{ borderRadius: '999px', objectFit: 'cover', background: '#fff' }}
              />
              <div style={{ display: 'grid' }}>
                <span style={{ fontWeight: 600 }}>{token.name}</span>
                <span style={{ fontSize: '0.85rem', opacity: 0.72 }}>{token.symbol}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

TokenDropdown.propTypes = {
  label: PropTypes.string.isRequired,
  fieldId: PropTypes.string.isRequired,
  selectedToken: PropTypes.shape({
    address: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    symbol: PropTypes.string.isRequired,
    logoURI: PropTypes.string.isRequired,
  }),
  tokens: PropTypes.arrayOf(
    PropTypes.shape({
      address: PropTypes.string.isRequired,
      name: PropTypes.string.isRequired,
      symbol: PropTypes.string.isRequired,
      logoURI: PropTypes.string.isRequired,
    })
  ).isRequired,
  isOpen: PropTypes.bool.isRequired,
  onToggle: PropTypes.func.isRequired,
  onSelect: PropTypes.func.isRequired,
};

export default function SwapPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState(null);
  const [catalog, setCatalog] = useState(null);
  const [openDropdown, setOpenDropdown] = useState(null);

  const [tokenInAddress, setTokenInAddress] = useState('');
  const [tokenOutAddress, setTokenOutAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [quote, setQuote] = useState(null);
  const [quoting, setQuoting] = useState(false);

  const tokenByAddress = useMemo(() => {
    return (catalog?.tokens || []).reduce((accumulator, token) => {
      accumulator[token.address.toLowerCase()] = token;
      return accumulator;
    }, {});
  }, [catalog]);

  const tokenIn = tokenInAddress ? tokenByAddress[tokenInAddress.toLowerCase()] : null;
  const tokenOut = tokenOutAddress ? tokenByAddress[tokenOutAddress.toLowerCase()] : null;

  useEffect(() => {
    if (!amount || Number(amount) <= 0 || !tokenInAddress || !tokenOutAddress) {
      setQuote(null);
      return;
    }

    const timer = setTimeout(async () => {
      setQuoting(true);
      try {
        const result = await SwapService.getQuote({
          tokenIn: tokenInAddress,
          tokenOut: tokenOutAddress,
          amount,
        });
        setQuote(result);
      } catch (err) {
        console.error('Quote error:', err);
      } finally {
        setQuoting(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [amount, tokenInAddress, tokenOutAddress]);

  const quickPairs = useMemo(() => {
    const weth = (catalog?.tokens || []).find((token) => token.symbol === 'WETH');
    const usdc = (catalog?.tokens || []).find((token) => token.symbol === 'USDC');

    if (weth && usdc) {
      return [
        { in: weth.address, out: usdc.address, label: 'WETH → USDC' },
        { in: usdc.address, out: weth.address, label: 'USDC → WETH' },
      ];
    }

    return [];
  }, [catalog]);

  useEffect(() => {
    let cancelled = false;

    const loadTokenCatalog = async () => {
      setCatalogLoading(true);
      setCatalogError(null);

      try {
        const response = await fetch(`${API_BASE_URL}/swap/tokens`, {
          headers: {
            Accept: 'application/json',
          },
        });

        const payload = await response.json();

        // Support both old shape (catalog) and new envelope { success, data }
        const data = payload?.success && payload?.data ? payload.data : payload;

        if (!response.ok) {
          throw new Error(data?.error || 'Failed to load token catalog');
        }

        if (!cancelled) {
          setCatalog(data);
          if (data?.tokens?.length >= 2) {
            setTokenInAddress(data.tokens[0].address);
            setTokenOutAddress(data.tokens[1].address);
          }
        }
      } catch (loadError) {
        if (!cancelled) {
          setCatalogError(loadError?.message || 'Failed to load token catalog');
        }
      } finally {
        if (!cancelled) {
          setCatalogLoading(false);
        }
      }
    };

    loadTokenCatalog();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const onDocumentClick = (event) => {
      if (event.target?.closest?.('[data-token-selector]')) {
        return;
      }

      setOpenDropdown(null);
    };

    document.addEventListener('click', onDocumentClick);
    return () => document.removeEventListener('click', onDocumentClick);
  }, []);

  useEffect(() => {
    const ethereum = globalThis.window?.ethereum;

    if (!ethereum?.on) {
      return undefined;
    }

    const handleChainChanged = () => {
      // Refresh the page so the swap form and ethers provider rehydrate with the new network snapshot.
      globalThis.window.location.reload();
    };

    ethereum.on('chainChanged', handleChainChanged);

    return () => {
      if (ethereum.removeListener) {
        ethereum.removeListener('chainChanged', handleChainChanged);
      }
    };
  }, []);

  const setPairFromAddresses = (nextTokenIn, nextTokenOut) => {
    setTokenInAddress(nextTokenIn);
    setTokenOutAddress(nextTokenOut);
  };

  const handleSwap = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      if (!amount || Number(amount) <= 0) {
        throw new Error('Please enter a valid amount');
      }

      if (!catalog?.tokens?.length) {
        throw new Error('Token catalog is not loaded yet');
      }

      const tokenInAddr = tokenIn?.address;
      const tokenOutAddr = tokenOut?.address;

      if (!tokenInAddr || !tokenOutAddr) {
        throw new Error('Please select both tokens from the Base Sepolia catalog');
      }

      if (tokenInAddr === tokenOutAddr) {
        throw new Error('Token In and Token Out cannot be the same');
      }

      const swapResult = await SwapService.executeManualSwap({
        tokenIn: tokenInAddr,
        tokenOut: tokenOutAddr,
        amount,
      });

      setResult(swapResult);
      setAmount('');
      // Reload history
      // fetchHistory(swapResult.walletAddress);
    } catch (err) {
      console.error('Swap error:', err);
      setError(err?.message || 'Failed to execute swap');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="premium-container animate-fade">
      <h1>Manual Swap</h1>
      <p>Select token pair, enter amount, and execute swap through your MetaMask wallet on Base Sepolia.</p>

      <div className="glass-card" style={{ maxWidth: '500px', margin: '2rem auto' }}>
        {catalogLoading && <p style={{ marginBottom: '1rem', opacity: 0.75 }}>Loading Base Sepolia token catalog...</p>}

        {catalogError && (
          <div style={{ marginBottom: '1rem', padding: '0.9rem', borderRadius: '10px', background: '#fff1f0', color: '#8c1d18' }}>
            {catalogError}
          </div>
        )}

        {catalog?.chain && (
          <div style={{ marginBottom: '1rem', fontSize: '0.92rem', opacity: 0.8 }}>
            Network: <strong>{catalog.chain}</strong> ({catalog.chainId})
          </div>
        )}

        {/* Quick pairs */}
        {quickPairs.length > 0 && (
          <div style={{ marginBottom: '1.5rem' }}>
            <p style={{ fontSize: '0.9rem', marginBottom: '0.5rem', opacity: 0.8 }}>Quick Pairs:</p>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {quickPairs.map((pair) => {
                const isActive = tokenInAddress === pair.in && tokenOutAddress === pair.out;

                return (
                  <button
                    key={`${pair.in}-${pair.out}`}
                    style={{
                      padding: '0.5rem 1rem',
                      borderRadius: '6px',
                      border: isActive ? '2px solid #6366f1' : '1px solid rgba(255, 255, 255, 0.2)',
                      background: isActive ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                      color: '#fff',
                      cursor: 'pointer',
                      fontSize: '0.9rem',
                    }}
                    onClick={() => setPairFromAddresses(pair.in, pair.out)}
                  >
                    {pair.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Token In */}
        <div data-token-selector>
          <TokenDropdown
            label="From"
            fieldId="token-in"
            selectedToken={tokenIn}
            tokens={catalog?.tokens || []}
            isOpen={openDropdown === 'tokenIn'}
            onToggle={() => setOpenDropdown((current) => (current === 'tokenIn' ? null : 'tokenIn'))}
            onSelect={(token) => {
              setTokenInAddress(token.address);
              setOpenDropdown(null);
            }}
          />
        </div>

        {/* Amount */}
        <div style={{ marginBottom: '0.5rem' }}>
          <label htmlFor="amount" style={{ display: 'block', marginBottom: '0.3rem', fontSize: '0.9rem', opacity: 0.8 }}>
            Amount:
          </label>
          <input
            id="amount"
            type="number"
            placeholder="0.0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            style={{
              width: '100%',
              padding: '0.8rem',
              borderRadius: '8px',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              background: 'rgba(0, 0, 0, 0.3)',
              color: '#fff',
              fontSize: '1rem',
            }}
          />
        </div>

        <div data-token-selector>
          <TokenDropdown
            label="To"
            fieldId="token-out"
            selectedToken={tokenOut}
            tokens={catalog?.tokens || []}
            isOpen={openDropdown === 'tokenOut'}
            onToggle={() => setOpenDropdown((current) => (current === 'tokenOut' ? null : 'tokenOut'))}
            onSelect={(token) => {
              setTokenOutAddress(token.address);
              setOpenDropdown(null);
            }}
          />
        </div>

        {/* Quote Display */}
        <div style={{ marginBottom: '1.5rem', minHeight: '3.8rem', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          {quoting ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', opacity: 0.6 }}>
              <div className="spinner-small" />
              <p style={{ fontSize: '0.9rem', margin: 0 }}>Scanning liquidity pools...</p>
            </div>
          ) : quote ? (
            <div style={{ 
              padding: '1rem', 
              borderRadius: '12px', 
              background: 'rgba(99, 102, 241, 0.08)', 
              border: '1px solid rgba(99, 102, 241, 0.3)',
              boxShadow: '0 0 15px rgba(99, 102, 241, 0.1)',
              animation: 'fade-in 0.3s ease-out'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.85rem', opacity: 0.6 }}>Estimated Output</span>
                <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', borderRadius: '4px', background: 'rgba(34, 197, 94, 0.15)', color: '#4ade80', fontWeight: '600' }}>BEST PRICE</span>
              </div>
              <p style={{ fontSize: '1.25rem', fontWeight: '700', margin: '0.25rem 0 0 0', color: '#fff', letterSpacing: '0.02em' }}>
                {quote?.amountOutFormatted ? Number(quote.amountOutFormatted).toFixed(6) : '0.000000'} <span style={{ fontSize: '0.9rem', opacity: 0.7 }}>{tokenOut?.symbol}</span>
              </p>
            </div>
          ) : amount && (
            <p style={{ fontSize: '0.9rem', opacity: 0.5, margin: 0, textAlign: 'center' }}>Select a valid pair to see conversion</p>
          )}
        </div>

        {/* Execute Button */}
        <button
          className="btn-primary"
          style={{ 
            width: '100%', 
            padding: '1.25rem', 
            fontSize: '1rem', 
            fontWeight: 'bold', 
            letterSpacing: '0.05em',
            boxShadow: '0 4px 20px rgba(99, 102, 241, 0.3)'
          }}
          onClick={handleSwap}
          disabled={loading || !amount || quoting}
        >
          {loading ? (
            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem' }}>
              <div className="spinner-small" style={{ borderColor: 'white', borderTopColor: 'transparent' }} />
              EXECUTING ON-CHAIN...
            </span>
          ) : 'EXECUTE SWAP'}
        </button>

        {/* Error Message */}
        {error && (
          <div style={{ marginTop: '1.5rem', padding: '1rem', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#fca5a5', fontSize: '0.95rem' }}>
            <span style={{ marginRight: '0.5rem' }}>⚠️</span> {error}
          </div>
        )}

        {/* Success Result */}
        {result && (
          <div style={{ 
            marginTop: '2rem', 
            padding: '1.5rem', 
            borderRadius: '16px', 
            background: 'rgba(10, 12, 24, 0.6)', 
            border: '1px solid rgba(34, 197, 94, 0.3)',
            boxShadow: '0 0 30px rgba(34, 197, 94, 0.1)',
            fontSize: '0.95rem', 
            display: 'grid', 
            gap: '1rem',
            animation: 'slide-up 0.4s ease-out'
          }}>
            <div style={{ color: '#4ade80', fontWeight: 'bold', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.5rem' }}>
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '20px', height: '20px', borderRadius: '50%', background: '#4ade80', color: '#000', fontSize: '0.75rem' }}>✓</span>
              SWAP COMPLETED SUCCESSFULLY
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div style={{ padding: '0.75rem', borderRadius: '8px', background: 'rgba(255,255,255,0.03)' }}>
                <div style={{ fontSize: '0.7rem', opacity: 0.5, textTransform: 'uppercase', marginBottom: '0.2rem' }}>Sent</div>
                <div style={{ fontWeight: '600' }}>{result.amount} {tokenIn?.symbol}</div>
              </div>
              <div style={{ padding: '0.75rem', borderRadius: '8px', background: 'rgba(255,255,255,0.03)' }}>
                <div style={{ fontSize: '0.7rem', opacity: 0.5, textTransform: 'uppercase', marginBottom: '0.2rem' }}>Received</div>
                <div style={{ fontWeight: '600' }}>{quote?.amountOutFormatted ? Number(quote.amountOutFormatted).toFixed(6) : '---'} {tokenOut?.symbol}</div>
              </div>
            </div>

            <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)', display: 'grid', gap: '0.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Wallet:</span>
                <span style={{ fontFamily: 'monospace', color: '#fff' }}>{result.walletAddress.slice(0, 6)}...{result.walletAddress.slice(-4)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Transaction:</span>
                <a
                  href={`${result.explorerBaseUrl}${result.swap.txHash}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: '#6366f1', textDecoration: 'none', borderBottom: '1px dashed #6366f1', fontFamily: 'monospace' }}
                >
                  {result.swap.txHash.slice(0, 10)}...
                </a>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
