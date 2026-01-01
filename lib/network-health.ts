/**
 * Network Health Check Utility
 * Detects when Movement testnet is offline and enables fallback mode
 */

import { MOVEMENT_CONFIG } from './constants';

let lastHealthCheck: { isOnline: boolean; checkedAt: number } | null = null;
const HEALTH_CHECK_CACHE_MS = 10000; // Cache for 10 seconds

/**
 * Check if Movement testnet is online
 */
export async function checkNetworkHealth(): Promise<boolean> {
  // Return cached result if recent
  if (lastHealthCheck && Date.now() - lastHealthCheck.checkedAt < HEALTH_CHECK_CACHE_MS) {
    return lastHealthCheck.isOnline;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(MOVEMENT_CONFIG.testnet.fullnode, {
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const isOnline = response.ok;
    lastHealthCheck = { isOnline, checkedAt: Date.now() };
    return isOnline;
  } catch {
    lastHealthCheck = { isOnline: false, checkedAt: Date.now() };
    return false;
  }
}

/**
 * Generate a simulated transaction hash for offline mode
 */
export function generateSimulatedTxHash(): string {
  const chars = '0123456789abcdef';
  let hash = '0x';
  for (let i = 0; i < 64; i++) {
    hash += chars[Math.floor(Math.random() * chars.length)];
  }
  return hash;
}

/**
 * Simulated transaction result for offline mode
 */
export interface SimulatedTxResult {
  hash: string;
  success: boolean;
  gasUsed: string;
  vmStatus: string;
  isSimulated: true;
  error?: string;
}

/**
 * Create a simulated successful transaction
 */
export function createSimulatedTx(): SimulatedTxResult {
  return {
    hash: generateSimulatedTxHash(),
    success: true,
    gasUsed: '500',
    vmStatus: 'Executed successfully (Offline Mode)',
    isSimulated: true,
  };
}
