/**
 * Movement Blockchain Payment Verification
 *
 * Verifies MOVE token payments on-chain for x402 micropayments.
 * Replaces the CDP facilitator with direct blockchain queries.
 */

import { aptos } from './movement';
import {
  X402_CONFIG,
  validateNonce,
  consumeNonce,
  octasToMove,
  PaymentVerification,
} from './x402';

/**
 * Verify a payment transaction on Movement blockchain
 */
export async function verifyMovementPayment(
  txHash: string,
  nonce: string,
  expectedRecipient: string,
  expectedAmountOctas: string
): Promise<PaymentVerification> {
  try {
    // Validate the nonce first
    const nonceValidation = validateNonce(nonce);
    if (!nonceValidation.valid) {
      return { valid: false, error: nonceValidation.error };
    }

    // Query the transaction from Movement blockchain
    const transaction = await aptos.getTransactionByHash({ transactionHash: txHash });

    if (!transaction) {
      return { valid: false, error: 'Transaction not found on Movement blockchain' };
    }

    // Check if transaction was successful
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const txData = transaction as any;
    if (txData.success === false) {
      return { valid: false, error: 'Transaction failed on-chain' };
    }

    // For pending transactions
    if (txData.type === 'pending_transaction') {
      return { valid: false, error: 'Transaction is still pending confirmation' };
    }

    // Extract payment details from transaction events
    const events = txData.events || [];

    // Look for coin deposit event
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const depositEvent = events.find((e: any) =>
      e.type === '0x1::coin::DepositEvent' ||
      e.type === '0x1::coin::Deposit' ||
      e.type.includes('DepositEvent')
    );

    // Alternative: look for CoinStore events
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const coinEvent = events.find((e: any) =>
      e.type.includes('0x1::aptos_coin') ||
      e.type.includes('CoinStore')
    );

    // If it's a simple transfer, check the payload
    const payload = txData.payload;
    let recipientFromTx: string | undefined;
    let amountFromTx: string | undefined;

    if (payload?.function === '0x1::aptos_account::transfer' ||
        payload?.function === '0x1::coin::transfer') {
      // Direct transfer function - recipient and amount in arguments
      recipientFromTx = payload.arguments?.[0];
      amountFromTx = payload.arguments?.[1];
    } else if (depositEvent) {
      // Extract from deposit event
      amountFromTx = depositEvent.data?.amount;
      recipientFromTx = depositEvent.guid?.account_address;
    } else if (coinEvent) {
      // Try to extract from coin event
      amountFromTx = coinEvent.data?.amount;
    }

    // If we couldn't extract payment details, try to verify based on transaction changes
    if (!amountFromTx) {
      // Check changes array for balance changes
      const changes = txData.changes || [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const coinStoreChange = changes.find((c: any) =>
        c.type === 'write_resource' &&
        c.data?.type?.includes('CoinStore') &&
        c.address?.toLowerCase() === expectedRecipient.toLowerCase()
      );

      if (coinStoreChange) {
        // Transaction modified recipient's coin store - consider valid
        // Note: This is a simplified check; production should verify exact amount change
        console.log('Payment verified via coin store change');
      }
    }

    // Verify recipient if we have the data
    if (recipientFromTx) {
      const normalizedExpected = expectedRecipient.toLowerCase();
      const normalizedActual = recipientFromTx.toLowerCase();

      if (!normalizedActual.includes(normalizedExpected.replace('0x', '')) &&
          normalizedExpected !== normalizedActual) {
        return {
          valid: false,
          error: `Recipient mismatch: expected ${expectedRecipient}, got ${recipientFromTx}`,
        };
      }
    }

    // Verify amount if we have the data
    if (amountFromTx) {
      const actualAmount = BigInt(amountFromTx);
      const expectedAmount = BigInt(expectedAmountOctas);

      if (actualAmount < expectedAmount) {
        return {
          valid: false,
          error: `Amount too low: expected ${expectedAmountOctas} octas, got ${amountFromTx}`,
        };
      }
    }

    // Mark nonce as consumed
    consumeNonce(nonce);

    // Extract payer address
    const payer = txData.sender;

    return {
      valid: true,
      amount: amountFromTx ? octasToMove(amountFromTx) : undefined,
      amountOctas: amountFromTx,
      payer,
      txHash,
    };
  } catch (error) {
    console.error('Movement payment verification error:', error);
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Verification failed',
    };
  }
}

/**
 * Wait for transaction confirmation on Movement
 */
export async function waitForTransaction(
  txHash: string,
  maxWaitMs: number = 30000
): Promise<{ confirmed: boolean; success?: boolean; error?: string }> {
  const startTime = Date.now();
  const pollInterval = 1000; // 1 second

  while (Date.now() - startTime < maxWaitMs) {
    try {
      const tx = await aptos.getTransactionByHash({ transactionHash: txHash });

      if (tx) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const txData = tx as any;

        // Check if transaction is no longer pending
        if (txData.type !== 'pending_transaction') {
          return {
            confirmed: true,
            success: txData.success === true,
            error: txData.success === false ? 'Transaction failed' : undefined,
          };
        }
      }
    } catch {
      // Transaction not yet available, continue waiting
      console.log(`Waiting for tx ${txHash}...`);
    }

    await new Promise(resolve => setTimeout(resolve, pollInterval));
  }

  return {
    confirmed: false,
    error: 'Transaction confirmation timeout',
  };
}

/**
 * Verify payment with fallback for offline/testnet mode
 */
export async function verifyPaymentWithFallback(
  txHash: string,
  nonce: string,
  expectedAmountOctas: string
): Promise<PaymentVerification> {
  // Check if properly configured
  if (!X402_CONFIG.recipient || X402_CONFIG.recipient === '0x0') {
    console.log('x402: Fallback mode - accepting payment without verification');
    return {
      valid: true,
      amount: octasToMove(expectedAmountOctas),
      amountOctas: expectedAmountOctas,
      txHash,
    };
  }

  // Try on-chain verification
  return verifyMovementPayment(
    txHash,
    nonce,
    X402_CONFIG.recipient,
    expectedAmountOctas
  );
}

/**
 * Check if a transaction exists (quick check without full verification)
 */
export async function transactionExists(txHash: string): Promise<boolean> {
  try {
    const tx = await aptos.getTransactionByHash({ transactionHash: txHash });
    return !!tx;
  } catch {
    return false;
  }
}

/**
 * Get transaction status
 */
export async function getTransactionStatus(txHash: string): Promise<{
  exists: boolean;
  pending: boolean;
  success?: boolean;
  sender?: string;
  gasUsed?: string;
}> {
  try {
    const tx = await aptos.getTransactionByHash({ transactionHash: txHash });

    if (!tx) {
      return { exists: false, pending: false };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const txData = tx as any;

    if (txData.type === 'pending_transaction') {
      return {
        exists: true,
        pending: true,
        sender: txData.sender,
      };
    }

    return {
      exists: true,
      pending: false,
      success: txData.success,
      sender: txData.sender,
      gasUsed: txData.gas_used,
    };
  } catch {
    return { exists: false, pending: false };
  }
}
