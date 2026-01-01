'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  getBountyProtocols,
  addRegisteredProtocol,
  type RegisteredProtocol,
} from '@/lib/protocol-registry';

/**
 * Hook to manage bounty-based protocols
 * Used by GuardBot and Researcher pages
 */
export function useBountyProtocols() {
  const [protocols, setProtocols] = useState<RegisteredProtocol[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load bounty protocols from registry
  const loadProtocols = useCallback(() => {
    try {
      const bountyProtocols = getBountyProtocols();
      setProtocols(bountyProtocols);
    } catch (error) {
      console.error('Failed to load bounty protocols:', error);
      setProtocols([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadProtocols();
  }, [loadProtocols]);

  // Refresh protocols from registry
  const refresh = useCallback(() => {
    loadProtocols();
  }, [loadProtocols]);

  // Register a new bounty protocol via API
  const registerBountyProtocol = useCallback(async (
    name: string,
    contractAddress: string,
    depositAmount: number // in octas
  ): Promise<{ fundTxHash: string }> => {
    const response = await fetch('/api/bounty/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        contractAddress,
        depositAmount,
      }),
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.error || 'Failed to register bounty protocol');
    }

    // Add to local registry
    addRegisteredProtocol({
      name,
      contractAddress,
      registeredAt: Date.now(),
      threatLevel: 0,
      isPaused: false,
      registrationType: 'bounty',
      bountyDeposit: depositAmount,
      vaultTxHash: data.fundTxHash,
    });

    // Refresh to get updated list
    loadProtocols();

    return {
      fundTxHash: data.fundTxHash,
    };
  }, [loadProtocols]);

  return {
    protocols,
    isLoading,
    refresh,
    registerBountyProtocol,
  };
}

export default useBountyProtocols;
