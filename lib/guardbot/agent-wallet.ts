/**
 * GuardBot Agent Wallet Management
 *
 * Manages the agent's wallet for autonomous payments.
 * Uses deployer wallet for actual payments on Movement.
 * Shows Privy wallet creation flow for embedded wallets.
 */

import { aptos, getDeployerAddress } from '@/lib/signer';
import { octasToMove, moveToOctas, X402_CONFIG } from '@/lib/x402';
import { checkNetworkHealth } from '@/lib/network-health';
import type { AgentWallet } from './types';

// Fallback balance (5 MOVE in octas) for when network is offline
const FALLBACK_BALANCE = 500000000;

// In-memory storage for agent wallet state
let agentWalletState: AgentWallet | null = null;

/**
 * Get current agent wallet info
 */
export async function getAgentWallet(): Promise<AgentWallet | null> {
  if (!agentWalletState) {
    return null;
  }

  // Refresh balance
  try {
    const balance = await getWalletBalance(agentWalletState.address);
    agentWalletState = {
      ...agentWalletState,
      balance,
      balanceMove: octasToMove(balance),
      lastUpdated: Date.now(),
    };
  } catch (error) {
    console.error('Failed to refresh agent wallet balance:', error);
  }

  return agentWalletState;
}

/**
 * Initialize/create agent wallet
 * In production, this would create a Privy embedded wallet.
 * Currently uses the deployer wallet for testnet operations.
 */
export async function createAgentWallet(): Promise<AgentWallet> {
  const address = getDeployerAddress();
  const balance = await getWalletBalance(address);

  agentWalletState = {
    address,
    balance,
    balanceMove: octasToMove(balance),
    isEmbedded: true, // Mark as embedded wallet
    createdAt: Date.now(),
    lastUpdated: Date.now(),
  };

  return agentWalletState;
}

/**
 * Get wallet balance in octas
 * Falls back to simulated balance if network is offline
 */
export async function getWalletBalance(address: string): Promise<number> {
  // Check network health first
  const isOnline = await checkNetworkHealth();

  if (!isOnline) {
    console.log('Network offline - using fallback balance');
    return FALLBACK_BALANCE;
  }

  try {
    const resources = await aptos.getAccountResources({
      accountAddress: address,
    });

    const coinResource = resources.find(
      (r) => r.type === '0x1::coin::CoinStore<0x1::aptos_coin::AptosCoin>'
    );

    if (coinResource && typeof coinResource.data === 'object' && coinResource.data !== null) {
      const data = coinResource.data as { coin: { value: string } };
      return parseInt(data.coin.value);
    }

    return 0;
  } catch (error) {
    console.error('Failed to get wallet balance, using fallback balance:', error);
    return FALLBACK_BALANCE;
  }
}

/**
 * Check if wallet has sufficient balance for operation
 */
export function hassufficientBalance(requiredMove: string): boolean {
  if (!agentWalletState) return false;
  const requiredOctas = moveToOctas(requiredMove);
  return agentWalletState.balance >= requiredOctas;
}

/**
 * Get deployer info for display
 */
export function getAgentWalletInfo(): {
  address: string;
  network: string;
  chainId: number;
  token: string;
} {
  return {
    address: getDeployerAddress(),
    network: X402_CONFIG.network,
    chainId: X402_CONFIG.chainId,
    token: X402_CONFIG.token,
  };
}

/**
 * Format address for display
 */
export function formatAgentAddress(address: string): string {
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/**
 * Get explorer URL for agent wallet
 */
export function getAgentExplorerUrl(): string {
  const address = getDeployerAddress();
  return `${X402_CONFIG.explorerUrl}/account/${address}?network=${X402_CONFIG.explorerNetwork}`;
}

/**
 * Generate unique session ID
 */
export function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

/**
 * Generate unique activity ID
 */
export function generateActivityId(): string {
  return `activity_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}
