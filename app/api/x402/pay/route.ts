/**
 * x402 Payment Execution API
 *
 * POST /api/x402/pay
 *
 * Executes a real MOVE token transfer on Movement Bardock Testnet
 * using the deployer wallet for server-assisted payment reliability.
 *
 * This enables real on-chain transactions visible on Movement explorer
 * without requiring users to have wallet extensions installed.
 */

import { NextRequest, NextResponse } from 'next/server';
import { signAndSubmitTransaction, getDeployerAddress, aptos } from '@/lib/signer';
import { X402_CONFIG, moveToOctas, getExplorerTxUrl } from '@/lib/x402';

// Request body interface
interface PaymentRequest {
  amount: string;        // Amount in MOVE (e.g., "0.001")
  amountOctas?: string;  // Amount in octas (optional, calculated if not provided)
  nonce: string;         // Payment nonce from 402 response
  recipient: string;     // Recipient address
}

// Response interface
interface PaymentResponse {
  success: boolean;
  txHash?: string;
  explorerUrl?: string;
  gasUsed?: string;
  from?: string;
  to?: string;
  amount?: string;
  amountOctas?: string;
  error?: string;
  details?: string;
}

export async function POST(request: NextRequest): Promise<NextResponse<PaymentResponse>> {
  try {
    // Parse request body
    const body: PaymentRequest = await request.json();
    const { amount, nonce, recipient } = body;

    // Validate required fields
    if (!amount || !nonce || !recipient) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields',
          details: 'amount, nonce, and recipient are required',
        },
        { status: 400 }
      );
    }

    // Validate recipient address format
    if (!recipient.startsWith('0x') || recipient.length < 10) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid recipient address',
          details: 'Recipient must be a valid Movement address starting with 0x',
        },
        { status: 400 }
      );
    }

    // Convert amount to octas
    const amountOctas = body.amountOctas || moveToOctas(amount).toString();
    const amountOctasNum = BigInt(amountOctas);

    if (amountOctasNum <= 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid amount',
          details: 'Amount must be greater than 0',
        },
        { status: 400 }
      );
    }

    console.log(`x402: Executing real MOVE transfer - ${amount} MOVE (${amountOctas} octas) to ${recipient}`);

    // Get deployer address for logging
    const from = getDeployerAddress();

    // Check deployer balance first
    try {
      const balance = await aptos.getAccountAPTAmount({
        accountAddress: from,
      });

      const requiredAmount = amountOctasNum + BigInt(10000); // Add some for gas
      if (BigInt(balance) < requiredAmount) {
        console.error(`x402: Insufficient balance - has ${balance}, needs ${requiredAmount}`);
        return NextResponse.json(
          {
            success: false,
            error: 'Insufficient balance',
            details: `Deployer wallet needs more testnet MOVE. Current: ${balance} octas`,
          },
          { status: 500 }
        );
      }
    } catch (balanceError) {
      console.warn('x402: Could not check balance, proceeding anyway:', balanceError);
    }

    // Execute the transfer using the native transfer function
    const result = await signAndSubmitTransaction({
      function: '0x1::aptos_account::transfer',
      functionArguments: [recipient, amountOctas],
    });

    if (!result.success) {
      console.error(`x402: Payment failed - ${result.error}`);
      return NextResponse.json(
        {
          success: false,
          error: 'Transaction failed',
          details: result.error || result.vmStatus || 'Unknown error',
        },
        { status: 500 }
      );
    }

    // Build explorer URL
    const explorerUrl = getExplorerTxUrl(result.hash);

    console.log(`x402: Payment successful - tx: ${result.hash}`);

    return NextResponse.json({
      success: true,
      txHash: result.hash,
      explorerUrl,
      gasUsed: result.gasUsed,
      from,
      to: recipient,
      amount,
      amountOctas,
    });

  } catch (error) {
    console.error('x402: Payment API error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return NextResponse.json(
      {
        success: false,
        error: 'Payment execution failed',
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}

// GET endpoint for checking payment API status
export async function GET(): Promise<NextResponse> {
  try {
    const deployerAddress = getDeployerAddress();

    // Get balance
    let balance = '0';
    try {
      const balanceResult = await aptos.getAccountAPTAmount({
        accountAddress: deployerAddress,
      });
      balance = balanceResult.toString();
    } catch {
      balance = 'unknown';
    }

    return NextResponse.json({
      status: 'operational',
      network: X402_CONFIG.network,
      chainId: X402_CONFIG.chainId,
      token: X402_CONFIG.token,
      deployerAddress,
      deployerBalance: balance,
      explorerUrl: X402_CONFIG.explorerUrl,
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: 'error',
        error: error instanceof Error ? error.message : 'Configuration error',
      },
      { status: 500 }
    );
  }
}
