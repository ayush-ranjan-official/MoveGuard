/**
 * Shared Protocol Registry
 *
 * Provides localStorage-based persistence for registered protocols.
 * Used across Dashboard, GuardBot, and Researcher pages.
 */

import { MODULE_ADDRESS } from './constants';
import type { RegistrationType } from './types';

export interface RegisteredProtocol {
  name: string;
  contractAddress: string;
  registeredAt: number;
  threatLevel?: number;
  isPaused?: boolean;
  registrationType: RegistrationType;  // 'subscription' or 'bounty'
  bountyDeposit?: number;              // Amount deposited to vault (in octas) - for bounty type
  vaultTxHash?: string;                // Transaction hash of vault funding - for bounty type
}

// Storage key for localStorage
const STORAGE_KEY = 'moveguard_registered_protocols';

// Default protocol: VulnerableVault for testing (bounty-based for GuardBot demo)
const DEFAULT_PROTOCOLS: RegisteredProtocol[] = [
  {
    name: 'VulnerableVault',
    contractAddress: MODULE_ADDRESS,
    registeredAt: Date.now() - 86400000, // 1 day ago
    threatLevel: 0,
    isPaused: false,
    registrationType: 'bounty',
  },
];

/**
 * Check if we're in a browser environment
 */
function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

/**
 * Get all registered protocols from localStorage
 */
export function getRegisteredProtocols(): RegisteredProtocol[] {
  if (!isBrowser()) {
    return DEFAULT_PROTOCOLS;
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const protocols = JSON.parse(stored) as RegisteredProtocol[];
      // Ensure default protocols are included
      const addresses = protocols.map(p => p.contractAddress.toLowerCase());
      for (const defaultProtocol of DEFAULT_PROTOCOLS) {
        if (!addresses.includes(defaultProtocol.contractAddress.toLowerCase())) {
          protocols.unshift(defaultProtocol);
        }
      }
      return protocols;
    }
  } catch (error) {
    console.error('Failed to load protocols from localStorage:', error);
  }

  return DEFAULT_PROTOCOLS;
}

/**
 * Save protocols to localStorage
 */
function saveProtocols(protocols: RegisteredProtocol[]): void {
  if (!isBrowser()) return;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(protocols));
  } catch (error) {
    console.error('Failed to save protocols to localStorage:', error);
  }
}

/**
 * Add a new protocol to the registry
 */
export function addRegisteredProtocol(protocol: RegisteredProtocol): void {
  const protocols = getRegisteredProtocols();

  // Check if already exists
  const existingIndex = protocols.findIndex(
    p => p.contractAddress.toLowerCase() === protocol.contractAddress.toLowerCase()
  );

  if (existingIndex >= 0) {
    // Update existing
    protocols[existingIndex] = { ...protocols[existingIndex], ...protocol };
  } else {
    // Add new
    protocols.push(protocol);
  }

  saveProtocols(protocols);
}

/**
 * Update a protocol in the registry
 */
export function updateRegisteredProtocol(
  contractAddress: string,
  updates: Partial<RegisteredProtocol>
): void {
  const protocols = getRegisteredProtocols();

  const index = protocols.findIndex(
    p => p.contractAddress.toLowerCase() === contractAddress.toLowerCase()
  );

  if (index >= 0) {
    protocols[index] = { ...protocols[index], ...updates };
    saveProtocols(protocols);
  }
}

/**
 * Remove a protocol from the registry
 */
export function removeRegisteredProtocol(contractAddress: string): void {
  const protocols = getRegisteredProtocols();

  const filtered = protocols.filter(
    p => p.contractAddress.toLowerCase() !== contractAddress.toLowerCase()
  );

  saveProtocols(filtered);
}

/**
 * Check if a protocol is registered
 */
export function isProtocolRegistered(contractAddress: string): boolean {
  const protocols = getRegisteredProtocols();
  return protocols.some(
    p => p.contractAddress.toLowerCase() === contractAddress.toLowerCase()
  );
}

/**
 * Get a specific protocol by address
 */
export function getProtocolByAddress(contractAddress: string): RegisteredProtocol | null {
  const protocols = getRegisteredProtocols();
  return protocols.find(
    p => p.contractAddress.toLowerCase() === contractAddress.toLowerCase()
  ) || null;
}

/**
 * Clear all registered protocols (keeps defaults)
 */
export function clearRegisteredProtocols(): void {
  saveProtocols(DEFAULT_PROTOCOLS);
}

/**
 * Get only subscription-based protocols
 */
export function getSubscriptionProtocols(): RegisteredProtocol[] {
  const protocols = getRegisteredProtocols();
  return protocols.filter(p => p.registrationType === 'subscription' || !p.registrationType);
}

/**
 * Get only bounty-based protocols
 */
export function getBountyProtocols(): RegisteredProtocol[] {
  const protocols = getRegisteredProtocols();
  return protocols.filter(p => p.registrationType === 'bounty');
}
