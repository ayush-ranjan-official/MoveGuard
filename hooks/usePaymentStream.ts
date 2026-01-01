'use client';

import { useState, useCallback, useEffect } from 'react';
import type { PaymentStream } from '@/lib/types';
import { PAYMENT_CONFIG, MODULE_ADDRESS } from '@/lib/constants';
import { moveToOctas } from '@/lib/movement';

// Check if we should use real blockchain calls
const USE_REAL_BLOCKCHAIN = MODULE_ADDRESS !== '0x0' && MODULE_ADDRESS !== '';
const POLL_INTERVAL = 6000; // Poll blockchain every 6 seconds

interface UsePaymentStreamReturn {
  stream: PaymentStream | null;
  isLoading: boolean;
  isUsingBlockchain: boolean;
  lastTxHash: string | null;
  createStream: (protocolAddress: string, initialDeposit: number) => Promise<{ success: boolean; txHash?: string }>;
  addFunds: (amount: number) => Promise<{ success: boolean; txHash?: string }>;
  processDeductions: () => Promise<{ success: boolean; txHash?: string }>;
  closeStream: () => Promise<{ success: boolean; txHash?: string }>;
  refreshBalance: () => Promise<void>;
}

export function usePaymentStream(
  protocolAddress?: string,
  payerAddress?: string
): UsePaymentStreamReturn {
  const [stream, setStream] = useState<PaymentStream | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isUsingBlockchain, setIsUsingBlockchain] = useState(USE_REAL_BLOCKCHAIN);
  const [lastTxHash, setLastTxHash] = useState<string | null>(null);

  // Validate if address is a real hex address
  const isValidHexAddress = (addr: string | undefined) => {
    if (!addr || !addr.startsWith('0x') || addr.length < 10) return false;
    return /^[0-9a-fA-F]+$/.test(addr.slice(2));
  };

  // Fetch balance from blockchain API
  const refreshBalance = useCallback(async () => {
    if (!payerAddress || !isValidHexAddress(payerAddress)) return;

    try {
      const response = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'get_balance',
          payerAddress,
        }),
      });

      const data = await response.json();

      if (data.success) {
        console.log(`Balance refreshed: ${data.balance} octas (${data.balanceMove} MOVE), active: ${data.isActive}`);

        // Initialize or update stream based on blockchain data
        setStream((prev) => {
          // If we have blockchain data, create/update the stream
          if (data.balance > 0 || data.isActive) {
            return {
              protocolAddress: protocolAddress || payerAddress,
              payer: payerAddress,
              balance: data.balance || 0,
              ratePerBlock: PAYMENT_CONFIG.ratePerBlock,
              lastDeductionBlock: Date.now(),
              totalPaid: prev?.totalPaid || data.balance || 0,
              isActive: data.isActive || false,
            };
          }
          // If no blockchain data and no previous stream, return null
          if (!prev) return null;
          // Otherwise update existing stream
          return {
            ...prev,
            balance: data.balance || 0,
            isActive: data.isActive || false,
            lastDeductionBlock: Date.now(),
          };
        });
      }
    } catch (error) {
      console.error('Error refreshing balance:', error);
    }
  }, [payerAddress, protocolAddress]);

  // Poll balance from blockchain
  useEffect(() => {
    if (!USE_REAL_BLOCKCHAIN || !payerAddress || !isValidHexAddress(payerAddress)) return;

    console.log('Starting blockchain balance polling for:', payerAddress);

    // Initial fetch
    refreshBalance();

    // Set up polling interval
    const interval = setInterval(refreshBalance, POLL_INTERVAL);

    return () => clearInterval(interval);
  }, [payerAddress, refreshBalance]);

  // Create a new payment stream
  const createStream = useCallback(
    async (address: string, initialDeposit: number): Promise<{ success: boolean; txHash?: string }> => {
      setIsLoading(true);
      try {
        console.log(`Creating stream for ${address} with ${initialDeposit} MOVE`);

        const response = await fetch('/api/payments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'create_stream',
            protocolAddress: address,
            amount: moveToOctas(initialDeposit),
          }),
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.error || 'Failed to create stream');
        }

        console.log('Stream created:', data.txHash);
        setLastTxHash(data.txHash || null);

        const newStream: PaymentStream = {
          protocolAddress: address,
          payer: payerAddress || address,
          balance: moveToOctas(initialDeposit),
          ratePerBlock: PAYMENT_CONFIG.ratePerBlock,
          lastDeductionBlock: Date.now(),
          totalPaid: moveToOctas(initialDeposit),
          isActive: true,
        };

        setStream(newStream);

        return { success: true, txHash: data.txHash };
      } catch (error) {
        console.error('Error creating stream:', error);
        return { success: false };
      } finally {
        setIsLoading(false);
      }
    },
    [payerAddress]
  );

  // Add funds to the stream
  const addFunds = useCallback(async (amount: number): Promise<{ success: boolean; txHash?: string }> => {
    setIsLoading(true);
    try {
      console.log(`Adding ${amount} MOVE to stream`);

      const response = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add_funds',
          amount: moveToOctas(amount),
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to add funds');
      }

      console.log('Funds added:', data.txHash);
      setLastTxHash(data.txHash || null);

      // Update local state
      setStream((prev) => {
        if (!prev) return prev;
        const addedAmount = moveToOctas(amount);
        return {
          ...prev,
          balance: prev.balance + addedAmount,
          totalPaid: prev.totalPaid + addedAmount,
          isActive: true,
        };
      });

      // Refresh from blockchain after a short delay
      setTimeout(refreshBalance, 2000);

      return { success: true, txHash: data.txHash };
    } catch (error) {
      console.error('Error adding funds:', error);
      return { success: false };
    } finally {
      setIsLoading(false);
    }
  }, [refreshBalance]);

  // Process deductions (keeper function)
  const processDeductions = useCallback(async (): Promise<{ success: boolean; txHash?: string }> => {
    if (!payerAddress || !isValidHexAddress(payerAddress)) {
      console.warn('No valid payer address for deductions');
      return { success: false };
    }

    setIsLoading(true);
    try {
      console.log('Processing deductions for:', payerAddress);

      const response = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'process_deductions',
          payerAddress,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to process deductions');
      }

      console.log('Deductions processed:', data.txHash);
      setLastTxHash(data.txHash || null);

      // Refresh balance after processing
      await refreshBalance();

      return { success: true, txHash: data.txHash };
    } catch (error) {
      console.error('Error processing deductions:', error);
      return { success: false };
    } finally {
      setIsLoading(false);
    }
  }, [payerAddress, refreshBalance]);

  // Close the stream
  const closeStream = useCallback(async (): Promise<{ success: boolean; txHash?: string }> => {
    setIsLoading(true);
    try {
      console.log('Closing stream');

      const response = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'close_stream',
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to close stream');
      }

      console.log('Stream closed:', data.txHash);
      setLastTxHash(data.txHash || null);

      setStream(null);

      return { success: true, txHash: data.txHash };
    } catch (error) {
      console.error('Error closing stream:', error);
      return { success: false };
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    stream,
    isLoading,
    isUsingBlockchain,
    lastTxHash,
    createStream,
    addFunds,
    processDeductions,
    closeStream,
    refreshBalance,
  };
}
