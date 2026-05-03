import { ethers } from 'ethers';
import { ERC20_ABI, UNISWAP_V3_SWAP_ROUTER_ABI, BASE_SEPOLIA_CHAIN_ID, BASE_SEPOLIA_RPC_URL, BASE_SEPOLIA_EXPLORER_BASE, SWAP_FEE_TIER } from '@/services/abis';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
const ROUTER_ADDRESS = process.env.NEXT_PUBLIC_UNISWAP_ROUTER_ADDRESS || '';

async function getBrowserProvider() {
  const ethereum = globalThis.window?.ethereum;

  if (!ethereum) {
    throw new Error('MetaMask is required');
  }

  const provider = new ethers.BrowserProvider(ethereum);
  await provider.send('eth_requestAccounts', []);
  return provider;
}

async function ensureBaseSepoliaNetwork(provider) {
  const ethereum = globalThis.window?.ethereum;

  if (!ethereum) {
    throw new Error('MetaMask is required');
  }

  const baseSepoliaChainIdHex = `0x${BASE_SEPOLIA_CHAIN_ID.toString(16)}`;

  const getChainId = async () => {
    try {
      const network = await provider.getNetwork();
      return Number(network.chainId);
    } catch (error) {
      console.warn('Unable to read current wallet network before switching:', error?.message || error);
      return null;
    }
  };

  const currentChainId = await getChainId();
  if (currentChainId === BASE_SEPOLIA_CHAIN_ID) {
    return new ethers.BrowserProvider(ethereum);
  }

  try {
    await ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: baseSepoliaChainIdHex }],
    });
  } catch (switchError) {
    if (switchError?.code === 4902) {
      await ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [{
          chainId: baseSepoliaChainIdHex,
          chainName: 'Base Sepolia',
          rpcUrls: [BASE_SEPOLIA_RPC_URL],
          nativeCurrency: {
            name: 'Base ETH',
            symbol: 'ETH',
            decimals: 18,
          },
          blockExplorerUrls: ['https://sepolia.basescan.org'],
        }],
      });

      await ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: baseSepoliaChainIdHex }],
      });
    } else {
      throw new Error(`Please switch MetaMask to Base Sepolia (chainId ${BASE_SEPOLIA_CHAIN_ID}). Current chainId: ${currentChainId ?? 'unknown'}`);
    }
  }

  // Recreate a fresh BrowserProvider so ethers does not keep the stale Sepolia network snapshot.
  const refreshedProvider = new ethers.BrowserProvider(ethereum);
  const refreshedNetwork = await refreshedProvider.getNetwork();

  if (Number(refreshedNetwork.chainId) !== BASE_SEPOLIA_CHAIN_ID) {
    throw new Error(`MetaMask did not finish switching to Base Sepolia. Current chainId: ${refreshedNetwork.chainId.toString()}`);
  }

  return refreshedProvider;
}

async function fetchAgentAction() {
  const response = await fetch(`${API_BASE_URL}/api/agent/action`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error || 'Failed to fetch agent action');
  }

  return data;
}

async function approveTokenIfNeeded({ signer, tokenAddress, spenderAddress, amountIn }) {
  const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, signer);
  const ownerAddress = await signer.getAddress();
  const allowance = await tokenContract.allowance(ownerAddress, spenderAddress);

  if (allowance >= amountIn) {
    return {
      skipped: true,
      txHash: null,
      receipt: null,
    };
  }

  const tx = await tokenContract.approve(spenderAddress, amountIn);
  const receipt = await tx.wait();

  if (receipt?.status !== 1) {
    throw new Error('Token approval failed');
  }

  return {
    skipped: false,
    txHash: tx.hash,
    receipt,
  };
}

async function assertTokenContract(provider, tokenAddress, tokenLabel) {
  const code = await provider.getCode(tokenAddress);

  if (code === '0x') {
    throw new Error(`${tokenLabel} is not deployed on Sepolia: ${tokenAddress}`);
  }

  return true;
}

async function getTokenDecimals(signer, tokenAddress, tokenLabel) {
  try {
    const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, signer);
    const decimals = await tokenContract.decimals();
    return Number(decimals);
  } catch (error) {
    throw new Error(`Unable to read ${tokenLabel} decimals on Sepolia at ${tokenAddress}. Check that the address is a deployed ERC20 contract. Original error: ${error?.message || 'unknown error'}`);
  }
}

async function executeExactInputSingle({ signer, tokenIn, tokenOut, amountIn, routerAddress }) {
  const recipient = await signer.getAddress();
  const routerContract = new ethers.Contract(routerAddress, UNISWAP_V3_SWAP_ROUTER_ABI, signer);
  const deadline = Math.floor(Date.now() / 1000) + 60 * 10;

  const tx = await routerContract.exactInputSingle({
    tokenIn,
    tokenOut,
    fee: SWAP_FEE_TIER,
    recipient,
    amountIn,
    amountOutMinimum: 0n,
    sqrtPriceLimitX96: 0n,
  });

  const receipt = await tx.wait();

  if (receipt?.status !== 1) {
    throw new Error('Swap transaction failed');
  }

  return {
    txHash: tx.hash,
    receipt,
  };
}

export async function runAgentSwap() {
  if (!ethers.isAddress(ROUTER_ADDRESS)) {
    throw new Error('Missing Uniswap V3 router address. Set NEXT_PUBLIC_UNISWAP_ROUTER_ADDRESS.');
  }

  const action = await fetchAgentAction();

  if (action?.action !== 'swap') {
    throw new Error('Agent returned an unsupported action');
  }

  if (!ethers.isAddress(action.tokenIn) || !ethers.isAddress(action.tokenOut)) {
    throw new Error('Agent returned invalid token addresses');
  }

  let provider = await getBrowserProvider();
  provider = await ensureBaseSepoliaNetwork(provider);
  await assertTokenContract(provider, action.tokenIn, 'Agent tokenIn');
  await assertTokenContract(provider, action.tokenOut, 'Agent tokenOut');

  const signer = await provider.getSigner();
  const decimals = await getTokenDecimals(signer, action.tokenIn, 'Agent tokenIn');
  const amountIn = ethers.parseUnits(String(action.amount), decimals);

  const approval = await approveTokenIfNeeded({
    signer,
    tokenAddress: action.tokenIn,
    spenderAddress: ROUTER_ADDRESS,
    amountIn,
  });

  const swap = await executeExactInputSingle({
    signer,
    tokenIn: action.tokenIn,
    tokenOut: action.tokenOut,
    amountIn,
    routerAddress: ROUTER_ADDRESS,
  });

  return {
    action,
    walletAddress: await signer.getAddress(),
    routerAddress: ROUTER_ADDRESS,
    approval,
    swap,
    explorerBaseUrl: BASE_SEPOLIA_EXPLORER_BASE,
  };
}

/**
 * Fetch a live quote for the given token pair and amount.
 */
async function getQuote({ tokenIn, tokenOut, amount }) {
  try {
    const response = await fetch(`${API_BASE_URL}/swap/quote`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ tokenIn, tokenOut, amount }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data?.error || 'Failed to get quote');
    }

    return data;
  } catch (err) {
    console.error('Error fetching quote:', err.message);
    throw err;
  }
}

/**
 * Log a manual swap transaction to the backend database
 * Called after user executes swap through MetaMask
 */
async function logSwapTransaction({ walletAddress, agentId, tokenIn, tokenOut, amount, txHash, status = 'success' }) {
  try {
    const response = await fetch(`${API_BASE_URL}/swap/log`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        walletAddress,
        agentId: agentId || 'user',
        tokenIn,
        tokenOut,
        amount: amount.toString(),
        txHash,
        status,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data?.error || 'Failed to log swap transaction');
    }

    return data;
  } catch (err) {
    console.error('Error logging swap:', err.message);
    throw err;
  }
}

/**
 * Execute a manual swap: user selects tokens and amount, approves in MetaMask, executes on Uniswap V3
 */
async function executeManualSwap({ tokenIn, tokenOut, amount, agentId }) {
  if (!ethers.isAddress(ROUTER_ADDRESS)) {
    throw new Error('Missing Uniswap V3 router address. Set NEXT_PUBLIC_UNISWAP_ROUTER_ADDRESS.');
  }

  if (!ethers.isAddress(tokenIn) || !ethers.isAddress(tokenOut)) {
    throw new Error('Invalid token addresses');
  }

  if (!amount || Number(amount) <= 0) {
    throw new Error('Invalid amount');
  }

  let provider = await getBrowserProvider();
  provider = await ensureBaseSepoliaNetwork(provider);
  await assertTokenContract(provider, tokenIn, 'Token In');
  await assertTokenContract(provider, tokenOut, 'Token Out');

  const signer = await provider.getSigner();
  const walletAddress = await signer.getAddress();

  const decimals = await getTokenDecimals(signer, tokenIn, 'Token In');
  const amountIn = ethers.parseUnits(String(amount), decimals);

  // Approve token if needed
  const approval = await approveTokenIfNeeded({
    signer,
    tokenAddress: tokenIn,
    spenderAddress: ROUTER_ADDRESS,
    amountIn,
  });

  // Execute swap
  const swap = await executeExactInputSingle({
    signer,
    tokenIn,
    tokenOut,
    amountIn,
    routerAddress: ROUTER_ADDRESS,
  });

  // Log to backend
  const logResult = await logSwapTransaction({
    walletAddress,
    agentId,
    tokenIn,
    tokenOut,
    amount,
    txHash: swap.txHash,
    status: 'success',
  });

  return {
    success: true,
    walletAddress,
    tokenIn,
    tokenOut,
    amount,
    approval,
    swap,
    explorerBaseUrl: BASE_SEPOLIA_EXPLORER_BASE,
    dbTransaction: logResult,
  };
}

export const SwapService = {
  fetchAgentAction,
  approveTokenIfNeeded,
  assertTokenContract,
  getTokenDecimals,
  executeExactInputSingle,
  runAgentSwap,
  getQuote,
  logSwapTransaction,
  executeManualSwap,
};

export default SwapService;
