'use client';

import { useState, useEffect, useCallback } from 'react';
import type { ProtectedProtocol } from '@/lib/types';
import { MODULE_ADDRESS } from '@/lib/constants';
import {
  isProtocolPaused,
  getThreatLevel,
  isProtectionActive,
} from '@/lib/movement';
import {
  addRegisteredProtocol,
  getSubscriptionProtocols,
  updateRegisteredProtocol,
} from '@/lib/protocol-registry';

// Always use real blockchain when MODULE_ADDRESS is configured
const USE_REAL_BLOCKCHAIN = MODULE_ADDRESS !== '0x0' && MODULE_ADDRESS !== '';

interface ApiResponse {
  success: boolean;
  txHash?: string;
  error?: string;
}

export function useProtocols() {
  const [protocols, setProtocols] = useState<ProtectedProtocol[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUsingBlockchain, setIsUsingBlockchain] = useState(false);
  const [lastTxHash, setLastTxHash] = useState<string | null>(null);

  // Check for existing protocol on blockchain and load if exists
  useEffect(() => {
    async function initProtocols() {
      try {
        if (!USE_REAL_BLOCKCHAIN) {
          console.log('Blockchain not configured - starting with empty protocols');
          setProtocols([]);
          setIsLoading(false);
          return;
        }

        console.log('Checking for existing protocols on blockchain...');
        setIsUsingBlockchain(true);

        // Check if deployer has an existing protocol registered
        const [paused, threatLvl, active] = await Promise.all([
          isProtocolPaused(MODULE_ADDRESS),
          getThreatLevel(MODULE_ADDRESS),
          isProtectionActive(MODULE_ADDRESS),
        ]);

        // If any status is returned (even false), protocol might exist
        // Check by trying to get status from API
        const response = await fetch('/api/protocols', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'get_status',
            protocolAdmin: MODULE_ADDRESS,
          }),
        });
        const data = await response.json();

        if (data.success && data.status) {
          console.log('Found existing protocol on blockchain');
          // Add existing protocol to list
          setProtocols([{
            name: 'MoveGuard Protocol',
            contractAddress: MODULE_ADDRESS,
            admin: MODULE_ADDRESS,
            isPaused: data.status.isPaused,
            threatLevel: data.status.threatLevel || 0,
            protectionActive: data.status.protectionActive,
            registeredAt: Date.now(),
            lastThreatCheck: Date.now(),
            registrationType: 'subscription',
          }]);
        } else {
          console.log('No existing protocols found - starting empty');
          setProtocols([]);
        }
      } catch (error) {
        console.error('Error initializing protocols:', error);
        setProtocols([]);
      } finally {
        setIsLoading(false);
      }
    }

    initProtocols();
  }, []);

  // Pause protocol - calls real API for subscription protocols only
  const pauseProtocol = useCallback(async (address: string, threatType?: string, severity?: number, confidence?: number) => {
    console.log(`Pausing protocol: ${address}`);

    // Find the protocol to check its type
    const protocol = protocols.find(p => p.contractAddress === address);
    const isBountyProtocol = protocol?.registrationType === 'bounty';

    // For subscription protocols, try to pause on-chain
    if (!isBountyProtocol) {
      try {
        const response = await fetch('/api/protocols', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'pause',
            protocolAdmin: address,
            threatType: threatType || 'MANUAL_PAUSE',
            severity: severity || 100,
            confidence: confidence || 100,
          }),
        });

        const data: ApiResponse = await response.json();

        if (response.ok && data.success) {
          console.log('Pause transaction confirmed:', data.txHash);
          setLastTxHash(data.txHash || null);
        } else {
          console.warn('On-chain pause failed, updating locally:', data.error);
        }
      } catch (error) {
        console.warn('On-chain pause failed, updating locally:', error);
      }
    } else {
      console.log('Bounty protocol - pausing locally only');
    }

    // Update local state (always)
    setProtocols((prev) =>
      prev.map((p) =>
        p.contractAddress === address ? { ...p, isPaused: true } : p
      )
    );

    // Sync with shared registry
    updateRegisteredProtocol(address, { isPaused: true });
  }, [protocols]);

  // Unpause protocol - calls real API for subscription protocols only
  const unpauseProtocol = useCallback(async (address: string) => {
    console.log(`Unpausing protocol: ${address}`);

    // Find the protocol to check its type
    const protocol = protocols.find(p => p.contractAddress === address);
    const isBountyProtocol = protocol?.registrationType === 'bounty';

    // For subscription protocols, try to unpause on-chain
    if (!isBountyProtocol) {
      try {
        const response = await fetch('/api/protocols', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'unpause',
          }),
        });

        const data: ApiResponse = await response.json();

        if (response.ok && data.success) {
          console.log('Unpause transaction confirmed:', data.txHash);
          setLastTxHash(data.txHash || null);
        } else {
          console.warn('On-chain unpause failed, updating locally:', data.error);
        }
      } catch (error) {
        console.warn('On-chain unpause failed, updating locally:', error);
      }
    } else {
      console.log('Bounty protocol - unpausing locally only');
    }

    // Update local state (always)
    setProtocols((prev) =>
      prev.map((p) =>
        p.contractAddress === address
          ? { ...p, isPaused: false, threatLevel: 12 }
          : p
      )
    );

    // Sync with shared registry
    updateRegisteredProtocol(address, { isPaused: false, threatLevel: 12 });
  }, [protocols]);

  // Update threat level - calls real API for subscription protocols only
  const updateThreatLevel = useCallback(
    async (address: string, threatLevel: number) => {
      console.log(`Updating threat level for ${address}: ${threatLevel}`);

      // Find the protocol to check its type
      const protocol = protocols.find(p => p.contractAddress === address);
      const isBountyProtocol = protocol?.registrationType === 'bounty';

      // For bounty protocols, only update locally (no on-chain registration)
      if (isBountyProtocol) {
        console.log('Bounty protocol - updating locally only');
      } else {
        // For subscription protocols, try to update on-chain
        try {
          const response = await fetch('/api/protocols', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'update_threat',
              protocolAdmin: address,
              severity: threatLevel,
            }),
          });

          const data: ApiResponse = await response.json();

          if (!response.ok || !data.success) {
            // Don't throw for on-chain errors - just log and continue with local update
            console.warn('On-chain update failed, updating locally:', data.error);
          } else {
            console.log('Threat level update confirmed:', data.txHash);
            setLastTxHash(data.txHash || null);
          }
        } catch (error) {
          console.warn('On-chain threat update failed, updating locally:', error);
        }
      }

      // Update local state (always, regardless of on-chain result)
      setProtocols((prev) =>
        prev.map((p) =>
          p.contractAddress === address
            ? {
                ...p,
                threatLevel,
                isPaused: threatLevel >= 75 ? true : p.isPaused,
                lastThreatCheck: Date.now(),
              }
            : p
        )
      );

      // Sync with shared registry
      updateRegisteredProtocol(address, {
        threatLevel,
        isPaused: threatLevel >= 75 ? true : undefined,
      });
    },
    [protocols]
  );

  // Register protocol - calls real API
  const registerProtocol = useCallback(
    async (name: string, contractAddress: string) => {
      console.log(`Registering protocol: ${name} at ${contractAddress}`);

      try {
        const response = await fetch('/api/protocols', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'register',
            name,
            contractAddress,
          }),
        });

        const data: ApiResponse = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.error || 'Failed to register protocol');
        }

        console.log('Register transaction confirmed:', data.txHash);
        setLastTxHash(data.txHash || null);

        const newProtocol: ProtectedProtocol = {
          name,
          contractAddress,
          admin: contractAddress,
          isPaused: false,
          threatLevel: 5,
          protectionActive: false, // Not active until payment stream created
          registeredAt: Date.now(),
          lastThreatCheck: Date.now(),
          registrationType: 'subscription', // Dashboard registration is subscription-based
        };

        // Persist to shared registry for GuardBot and Researcher access
        addRegisteredProtocol({
          name,
          contractAddress,
          registeredAt: Date.now(),
          threatLevel: 5,
          isPaused: false,
          registrationType: 'subscription', // Dashboard registration is subscription-based
        });

        setProtocols((prev) => [...prev, newProtocol]);
        return { ...newProtocol, txHash: data.txHash };
      } catch (error) {
        console.error('Error registering protocol:', error);
        throw error;
      }
    },
    []
  );

  // Set protection status - calls real API
  const setProtectionStatus = useCallback(
    async (address: string, active: boolean) => {
      console.log(`Setting protection status for ${address}: ${active}`);

      try {
        const response = await fetch('/api/protocols', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'set_protection',
            protocolAdmin: address,
            active,
          }),
        });

        const data: ApiResponse = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.error || 'Failed to set protection status');
        }

        console.log('Protection status update confirmed:', data.txHash);
        setLastTxHash(data.txHash || null);

        // Update local state
        setProtocols((prev) =>
          prev.map((p) =>
            p.contractAddress === address
              ? { ...p, protectionActive: active }
              : p
          )
        );

        return data;
      } catch (error) {
        console.error('Error setting protection status:', error);
        throw error;
      }
    },
    []
  );

  // Refresh protocol data from blockchain
  const refreshProtocols = useCallback(async () => {
    if (!USE_REAL_BLOCKCHAIN) return;

    try {
      const refreshedProtocols = await Promise.all(
        protocols.map(async (protocol) => {
          try {
            const [paused, threatLvl, active] = await Promise.all([
              isProtocolPaused(protocol.contractAddress),
              getThreatLevel(protocol.contractAddress),
              isProtectionActive(protocol.contractAddress),
            ]);

            return {
              ...protocol,
              isPaused: paused,
              threatLevel: threatLvl || protocol.threatLevel,
              protectionActive: active,
              lastThreatCheck: Date.now(),
            };
          } catch {
            return protocol;
          }
        })
      );

      setProtocols(refreshedProtocols);
    } catch (error) {
      console.error('Error refreshing protocols:', error);
    }
  }, [protocols]);

  // Get protocol status from blockchain
  const getProtocolStatus = useCallback(async (address: string) => {
    try {
      const response = await fetch('/api/protocols', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'get_status',
          protocolAdmin: address,
        }),
      });

      const data = await response.json();
      return data.status;
    } catch (error) {
      console.error('Error getting protocol status:', error);
      return null;
    }
  }, []);

  // Update local protocol state (when API already made blockchain call)
  const updateProtocolPausedState = useCallback((address: string, isPaused: boolean, txHash?: string) => {
    setProtocols((prev) =>
      prev.map((p) =>
        p.contractAddress === address ? { ...p, isPaused } : p
      )
    );
    if (txHash) {
      setLastTxHash(txHash);
    }
  }, []);

  return {
    protocols,
    isLoading,
    isUsingBlockchain,
    lastTxHash,
    pauseProtocol,
    unpauseProtocol,
    updateThreatLevel,
    registerProtocol,
    setProtectionStatus,
    refreshProtocols,
    getProtocolStatus,
    updateProtocolPausedState,
  };
}
