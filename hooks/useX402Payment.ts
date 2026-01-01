'use client';

import { useState, useCallback } from 'react';
import {
  X402_CONFIG,
  isPaymentRequired,
  getPaymentInfoFromHeaders,
  formatPrice,
  formatPriceWithSymbol,
  getExplorerTxUrl,
} from '@/lib/x402';

export interface PaymentRequirements {
  required: boolean;
  amount?: string;
  amountOctas?: string;
  network?: string;
  chainId?: number;
  token?: string;
  tokenDecimals?: number;
  nonce?: string;
  nonceExpiry?: number;
  recipient?: string;
  description?: string;
}

export interface PaymentResult {
  success: boolean;
  txHash?: string;
  explorerUrl?: string;
  gasUsed?: string;
  from?: string;
  to?: string;
  amount?: string;
  amountOctas?: string;
  error?: string;
}

// Payment step tracking for progress UI
export type PaymentStep =
  | 'idle'
  | 'requesting'
  | 'signing'
  | 'broadcasting'
  | 'confirming'
  | 'retrying'
  | 'complete'
  | 'error';

export interface X402PaymentState {
  isPending: boolean;
  showModal: boolean;
  requirements: PaymentRequirements | null;
  pendingRequest: {
    url: string;
    options: RequestInit;
  } | null;
  lastPayment: PaymentResult | null;
  paymentStep: PaymentStep;
  stepError?: string;
}

interface UseX402PaymentReturn<T = unknown> {
  state: X402PaymentState;
  makeRequest: <R>(url: string, options?: RequestInit) => Promise<R | null>;
  executePayment: () => Promise<T | null>;
  simulatePayment: () => Promise<T | null>; // Legacy - calls executePayment
  cancelPayment: () => void;
  formatAmount: (amount: string) => string;
  formatAmountWithSymbol: (amount: string) => string;
  getExplorerUrl: (txHash: string) => string;
}

/**
 * React hook for handling x402 micropayments on Movement Network
 *
 * Handles the full payment flow:
 * 1. Makes request to protected endpoint
 * 2. Detects 402 Payment Required response
 * 3. Shows payment modal with requirements
 * 4. Executes real MOVE transfer via /api/x402/pay
 * 5. After payment, retries request with X-Payment header
 */
export function useX402Payment<T = unknown>(): UseX402PaymentReturn<T> {
  const [state, setState] = useState<X402PaymentState>({
    isPending: false,
    showModal: false,
    requirements: null,
    pendingRequest: null,
    lastPayment: null,
    paymentStep: 'idle',
  });

  /**
   * Make a request to a potentially x402-protected endpoint
   * Returns null if payment is required (modal will be shown)
   */
  const makeRequest = useCallback(async <T,>(
    url: string,
    options: RequestInit = {}
  ): Promise<T | null> => {
    setState(prev => ({
      ...prev,
      isPending: true,
      lastPayment: null,
      paymentStep: 'requesting',
    }));

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      // Check for 402 Payment Required
      if (isPaymentRequired(response)) {
        console.log('x402: Payment required for', url);

        // Extract payment info from response headers
        const paymentInfo = getPaymentInfoFromHeaders(response);

        // Also try to get from response body
        let bodyInfo: Record<string, unknown> = {};
        try {
          bodyInfo = await response.clone().json();
        } catch {
          // Ignore body parse errors
        }

        const requirements: PaymentRequirements = {
          required: true,
          amount: paymentInfo.amount || (bodyInfo.amountRequired as string),
          amountOctas: paymentInfo.amountOctas || (bodyInfo.amountRequiredOctas as string),
          network: paymentInfo.network || (bodyInfo.network as string) || X402_CONFIG.network,
          chainId: paymentInfo.chainId || (bodyInfo.chainId as number) || X402_CONFIG.chainId,
          token: paymentInfo.token || (bodyInfo.token as string) || X402_CONFIG.token,
          tokenDecimals: paymentInfo.tokenDecimals || (bodyInfo.tokenDecimals as number) || X402_CONFIG.tokenDecimals,
          nonce: paymentInfo.nonce || (bodyInfo.paymentNonce as string),
          nonceExpiry: paymentInfo.nonceExpiry || (bodyInfo.nonceExpiry as number),
          recipient: paymentInfo.recipient || (bodyInfo.resource as string),
          description: paymentInfo.description || (bodyInfo.description as string),
        };

        setState(prev => ({
          ...prev,
          isPending: false,
          showModal: true,
          requirements,
          pendingRequest: { url, options },
          paymentStep: 'idle',
        }));

        return null;
      }

      // Successful response (not 402)
      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || `Request failed: ${response.status}`);
      }

      const data = await response.json();

      setState(prev => ({
        ...prev,
        isPending: false,
        showModal: false,
        requirements: null,
        pendingRequest: null,
        paymentStep: 'complete',
      }));

      return data as T;
    } catch (error) {
      console.error('x402: Request error:', error);
      setState(prev => ({
        ...prev,
        isPending: false,
        paymentStep: 'error',
        stepError: error instanceof Error ? error.message : 'Request failed',
        lastPayment: {
          success: false,
          error: error instanceof Error ? error.message : 'Request failed',
        },
      }));
      throw error;
    }
  }, []);

  /**
   * Execute a real MOVE transfer via the server-assisted payment API
   * This makes a real on-chain transaction on Movement Bardock Testnet
   * Returns the response data from the protected endpoint after payment
   */
  const executePayment = useCallback(async (): Promise<T | null> => {
    if (!state.pendingRequest || !state.requirements) {
      console.error('x402: No pending request to pay for');
      return null;
    }

    setState(prev => ({ ...prev, isPending: true, paymentStep: 'signing' }));

    try {
      const { amount, amountOctas, nonce, recipient } = state.requirements;

      if (!amount || !nonce || !recipient) {
        throw new Error('Missing payment requirements');
      }

      // Step 1: Call the payment API to execute real MOVE transfer
      console.log('x402: Initiating real MOVE transfer via /api/x402/pay');

      setState(prev => ({ ...prev, paymentStep: 'broadcasting' }));

      const paymentResponse = await fetch('/api/x402/pay', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount,
          amountOctas,
          nonce,
          recipient,
        }),
      });

      const paymentResult = await paymentResponse.json();

      if (!paymentResponse.ok || !paymentResult.success) {
        throw new Error(paymentResult.details || paymentResult.error || 'Payment failed');
      }

      const txHash = paymentResult.txHash;
      console.log(`x402: Real payment executed - tx: ${txHash}`);

      // Step 2: Waiting for confirmation (tx is already confirmed by API)
      setState(prev => ({ ...prev, paymentStep: 'confirming' }));

      // Small delay to show confirming state
      await new Promise(resolve => setTimeout(resolve, 500));

      // Step 3: Retry the original request with payment headers
      setState(prev => ({ ...prev, paymentStep: 'retrying' }));

      const { url, options } = state.pendingRequest;

      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
          'X-Payment': txHash,
          'X-Payment-Nonce': nonce,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.details || `Payment rejected: ${response.status}`);
      }

      // Parse response data to return to caller
      const responseData = await response.json() as T;

      // Success!
      setState(prev => ({
        ...prev,
        isPending: false,
        showModal: false,
        requirements: null,
        pendingRequest: null,
        paymentStep: 'complete',
        lastPayment: {
          success: true,
          txHash,
          explorerUrl: paymentResult.explorerUrl,
          gasUsed: paymentResult.gasUsed,
          from: paymentResult.from,
          to: paymentResult.to,
          amount: paymentResult.amount,
          amountOctas: paymentResult.amountOctas,
        },
      }));

      console.log('x402: Payment flow complete - tx:', txHash);

      return responseData;

    } catch (error) {
      console.error('x402: Payment failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Payment failed';

      // Close modal and show error
      setState(prev => ({
        ...prev,
        isPending: false,
        showModal: false,
        requirements: null,
        pendingRequest: null,
        paymentStep: 'error',
        stepError: errorMessage,
        lastPayment: {
          success: false,
          error: errorMessage,
        },
      }));

      console.error('x402 Payment Error:', errorMessage);
      return null;
    }
  }, [state.pendingRequest, state.requirements]);

  /**
   * Legacy method - now calls executePayment for real transactions
   * Kept for backwards compatibility
   */
  const simulatePayment = useCallback(async (): Promise<T | null> => {
    return executePayment();
  }, [executePayment]);

  /**
   * Cancel the payment flow
   */
  const cancelPayment = useCallback((): void => {
    setState(prev => ({
      ...prev,
      showModal: false,
      requirements: null,
      pendingRequest: null,
      isPending: false,
      paymentStep: 'idle',
      stepError: undefined,
    }));
  }, []);

  return {
    state,
    makeRequest,
    executePayment,
    simulatePayment,
    cancelPayment,
    formatAmount: formatPrice,
    formatAmountWithSymbol: formatPriceWithSymbol,
    getExplorerUrl: getExplorerTxUrl,
  };
}

/**
 * Helper to check if an error is a payment required error
 */
export function isX402Error(error: unknown): boolean {
  if (error instanceof Response) {
    return error.status === 402;
  }
  if (error instanceof Error) {
    return error.message.includes('402') || error.message.includes('Payment Required');
  }
  return false;
}

/**
 * Get remaining time until nonce expires
 */
export function getNonceTimeRemaining(nonceExpiry: number): {
  expired: boolean;
  minutes: number;
  seconds: number;
} {
  const remaining = nonceExpiry - Date.now();

  if (remaining <= 0) {
    return { expired: true, minutes: 0, seconds: 0 };
  }

  const minutes = Math.floor(remaining / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000);

  return { expired: false, minutes, seconds };
}

/**
 * Payment step labels for UI display
 */
export const PAYMENT_STEP_LABELS: Record<PaymentStep, string> = {
  idle: 'Ready',
  requesting: 'Requesting...',
  signing: 'Signing transaction...',
  broadcasting: 'Broadcasting to Movement...',
  confirming: 'Confirming on-chain...',
  retrying: 'Completing request...',
  complete: 'Complete!',
  error: 'Error',
};

export default useX402Payment;
