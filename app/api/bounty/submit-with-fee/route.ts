/**
 * x402-gated Bounty Submission API
 *
 * POST /api/bounty/submit-with-fee
 *
 * Requires 0.01 MOVE payment (via x402 protocol) to submit vulnerability reports.
 * This prevents spam submissions while creating real on-chain activity.
 */

import { NextRequest, NextResponse } from 'next/server';
import { submitReport } from '@/lib/signer';
import { PRICING, X402_CONFIG, moveToOctas, generatePaymentNonce, storePaymentNonce, validateNonce, consumeNonce } from '@/lib/x402';

// Severity level to reward mapping (in octas)
const SEVERITY_REWARDS: Record<number, number> = {
  1: 10_000_000,   // Low: 0.1 MOVE
  2: 50_000_000,   // Medium: 0.5 MOVE
  3: 100_000_000,  // High: 1 MOVE
  4: 500_000_000,  // Critical: 5 MOVE
};

interface SubmitRequest {
  protocolAddress: string;
  title: string;
  description: string;
  severity: number;
  payoutAddress: string; // Researcher's wallet for bounty payout
}

/**
 * Create 402 Payment Required response for submission fee
 */
function createPaymentRequiredResponse(): NextResponse {
  const nonce = generatePaymentNonce();
  const amount = PRICING.bountySubmissionFee;
  const amountOctas = moveToOctas(amount).toString();
  const expiry = Date.now() + 15 * 60 * 1000; // 15 minutes

  // Store nonce for verification
  storePaymentNonce(nonce, amount, amountOctas, X402_CONFIG.recipient);

  const requirements = {
    x402Version: 2,
    scheme: 'exact',
    network: X402_CONFIG.network,
    chainId: X402_CONFIG.chainId,
    token: X402_CONFIG.token,
    tokenDecimals: X402_CONFIG.tokenDecimals,
    amountRequired: amount,
    amountRequiredOctas: amountOctas,
    resource: X402_CONFIG.recipient,
    paymentNonce: nonce,
    nonceExpiry: expiry,
    description: 'Vulnerability report submission fee (prevents spam)',
    explorerUrl: X402_CONFIG.explorerUrl,
  };

  return new NextResponse(
    JSON.stringify({
      error: 'Payment Required',
      message: `Submitting a vulnerability report requires a ${amount} MOVE fee`,
      ...requirements,
    }),
    {
      status: 402,
      headers: {
        'Content-Type': 'application/json',
        'X-Payment-Required': 'true',
        'X-Payment-Version': '2',
        'X-Payment-Scheme': 'exact',
        'X-Payment-Network': X402_CONFIG.network,
        'X-Payment-ChainId': X402_CONFIG.chainId.toString(),
        'X-Payment-Token': X402_CONFIG.token,
        'X-Payment-Decimals': X402_CONFIG.tokenDecimals.toString(),
        'X-Payment-Amount': amount,
        'X-Payment-AmountOctas': amountOctas,
        'X-Payment-Nonce': nonce,
        'X-Payment-NonceExpiry': expiry.toString(),
        'X-Payment-Recipient': X402_CONFIG.recipient,
        'X-Payment-Description': 'Vulnerability report submission fee',
      },
    }
  );
}

/**
 * POST /api/bounty/submit-with-fee
 * Submit a vulnerability report (requires x402 payment)
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Check for payment headers
    const paymentTxHash = request.headers.get('X-Payment');
    const paymentNonce = request.headers.get('X-Payment-Nonce');

    // If no payment, return 402 Payment Required
    if (!paymentTxHash || !paymentNonce) {
      console.log('x402-bounty: Payment required for submission');
      return createPaymentRequiredResponse();
    }

    // Validate the payment nonce
    const nonceValidation = validateNonce(paymentNonce);
    if (!nonceValidation.valid) {
      // In fallback mode, accept valid tx hash format without strict nonce validation
      const isFallbackMode = process.env.X402_FALLBACK_MODE === 'true' || process.env.NODE_ENV === 'development';

      if (!isFallbackMode) {
        return NextResponse.json(
          {
            error: 'Invalid Payment',
            details: nonceValidation.error || 'Payment nonce validation failed',
          },
          { status: 402 }
        );
      }

      // Fallback mode: just validate tx hash format
      if (!paymentTxHash.startsWith('0x') || paymentTxHash.length < 10) {
        return NextResponse.json(
          {
            error: 'Invalid Payment',
            details: 'Invalid transaction hash format',
          },
          { status: 402 }
        );
      }

      console.log('x402-bounty: Fallback mode - accepting payment with valid tx hash format');
    } else {
      // Mark nonce as consumed
      consumeNonce(paymentNonce);
    }

    // Parse request body
    const body: SubmitRequest = await request.json();
    const { protocolAddress, title, description, severity, payoutAddress } = body;

    // Validate required fields
    if (!protocolAddress || !title || !description || severity === undefined) {
      return NextResponse.json(
        { error: 'protocolAddress, title, description, and severity required' },
        { status: 400 }
      );
    }

    // Validate payout address
    if (!payoutAddress || !payoutAddress.startsWith('0x') || payoutAddress.length < 10) {
      return NextResponse.json(
        { error: 'Valid payoutAddress required for bounty payout' },
        { status: 400 }
      );
    }

    // Validate severity
    if (severity < 1 || severity > 4) {
      return NextResponse.json(
        { error: 'severity must be 1 (low), 2 (medium), 3 (high), or 4 (critical)' },
        { status: 400 }
      );
    }

    console.log(`x402-bounty: Submitting report "${title}" (severity: ${severity}, payout: ${payoutAddress})`);

    // Submit vulnerability report to blockchain
    const result = await submitReport(protocolAddress, title, description, severity);

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Submission failed',
          details: result.error || result.vmStatus || 'Unknown error',
        },
        { status: 500 }
      );
    }

    console.log(`x402-bounty: Report submitted successfully - tx: ${result.hash}`);

    return NextResponse.json({
      success: true,
      message: 'Vulnerability report submitted successfully',
      txHash: result.hash,
      submissionFeeTxHash: paymentTxHash,
      report: {
        protocolAddress,
        title,
        severity,
        severityLabel: ['', 'Low', 'Medium', 'High', 'Critical'][severity],
        payoutAddress,
        potentialReward: SEVERITY_REWARDS[severity] || 0,
        potentialRewardMove: (SEVERITY_REWARDS[severity] || 0) / 1e8,
        status: 'pending',
        submittedAt: Date.now(),
      },
      explorerUrl: `${X402_CONFIG.explorerUrl}/txn/${result.hash}?network=${X402_CONFIG.explorerNetwork}`,
    });

  } catch (error) {
    console.error('x402-bounty: Submission error:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Submission failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/bounty/submit-with-fee
 * Get submission fee info
 */
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    endpoint: '/api/bounty/submit-with-fee',
    description: 'x402-gated vulnerability report submission',
    submissionFee: PRICING.bountySubmissionFee,
    submissionFeeOctas: moveToOctas(PRICING.bountySubmissionFee),
    token: X402_CONFIG.token,
    network: X402_CONFIG.network,
    chainId: X402_CONFIG.chainId,
    potentialRewards: {
      low: { octas: SEVERITY_REWARDS[1], move: SEVERITY_REWARDS[1] / 1e8 },
      medium: { octas: SEVERITY_REWARDS[2], move: SEVERITY_REWARDS[2] / 1e8 },
      high: { octas: SEVERITY_REWARDS[3], move: SEVERITY_REWARDS[3] / 1e8 },
      critical: { octas: SEVERITY_REWARDS[4], move: SEVERITY_REWARDS[4] / 1e8 },
    },
    requiredFields: ['protocolAddress', 'title', 'description', 'severity', 'payoutAddress'],
  });
}
