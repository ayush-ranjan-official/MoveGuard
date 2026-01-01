/**
 * Bounty Payout API
 *
 * POST /api/bounty/payout
 *
 * Validates a pending vulnerability report and triggers bounty payout
 * from the protocol's bounty vault to the researcher.
 *
 * The on-chain validate_and_pay() function handles:
 * 1. Validating the report status
 * 2. Extracting bounty from vault balance
 * 3. Depositing bounty to reporter's wallet
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateAndPay, getDeployerAddress } from '@/lib/signer';
import { X402_CONFIG, octasToMove, getExplorerTxUrl } from '@/lib/x402';
import { aptos } from '@/lib/signer';
import { MODULES } from '@/lib/constants';

// Severity level to reward mapping (in octas)
const SEVERITY_REWARDS: Record<number, number> = {
  1: 10_000_000,   // Low: 0.1 MOVE
  2: 50_000_000,   // Medium: 0.5 MOVE
  3: 100_000_000,  // High: 1 MOVE
  4: 500_000_000,  // Critical: 5 MOVE
};

interface PayoutRequest {
  reportId: number;
  reporterAddress?: string; // Optional for display purposes
}

interface PayoutResponse {
  success: boolean;
  paymentTxHash?: string;
  validationTxHash?: string;
  paymentExplorerUrl?: string;
  validationExplorerUrl?: string;
  amount?: string;
  amountOctas?: string;
  severity?: string;
  from?: string;
  to?: string;
  error?: string;
  details?: string;
}

/**
 * Helper to get report info by ID from the vault
 */
async function getReportById(reportId: number): Promise<{
  id: number;
  reporter: string;
  protocolAddress: string;
  severity: number;
  status: number;
  bountyAmount: number;
} | null> {
  try {
    const result = await aptos.view({
      payload: {
        function: `${MODULES.bountyVault}::get_report_by_id`,
        functionArguments: [reportId],
      },
    });
    return {
      id: result[0] as number,
      reporter: result[1] as string,
      protocolAddress: result[2] as string,
      severity: result[3] as number,
      status: result[4] as number,
      bountyAmount: result[5] as number,
    };
  } catch (error) {
    console.error('Error getting report by ID:', error);
    return null;
  }
}

/**
 * POST /api/bounty/payout
 * Validate a report and pay the bounty from vault to researcher
 */
export async function POST(request: NextRequest): Promise<NextResponse<PayoutResponse>> {
  try {
    const body: PayoutRequest = await request.json();
    const { reportId } = body;

    // Validate required fields
    if (reportId === undefined || reportId === null) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields',
          details: 'reportId is required',
        },
        { status: 400 }
      );
    }

    console.log(`bounty-payout: Processing payout for report #${reportId}`);

    // Get report info from vault
    const reportInfo = await getReportById(reportId);
    if (!reportInfo) {
      return NextResponse.json(
        {
          success: false,
          error: 'Report not found',
          details: `No vulnerability report found with ID ${reportId}`,
        },
        { status: 404 }
      );
    }

    // Check report status (0 = pending)
    if (reportInfo.status !== 0) {
      const statusLabels: Record<number, string> = {
        1: 'already validated',
        2: 'rejected',
        3: 'already paid',
      };
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid report status',
          details: `Report is ${statusLabels[reportInfo.status] || 'in an invalid state'}`,
        },
        { status: 400 }
      );
    }

    // Get severity info
    const bountyAmountOctas = reportInfo.bountyAmount;
    const bountyAmountMove = octasToMove(bountyAmountOctas);
    const severityLabels = ['', 'Low', 'Medium', 'High', 'Critical'];
    const severityLabel = severityLabels[reportInfo.severity] || 'Unknown';

    console.log(`bounty-payout: Severity ${severityLabel}, Bounty ${bountyAmountMove} MOVE`);

    // Call validate_and_pay on-chain
    // This extracts bounty from vault balance and deposits to reporter
    console.log(`bounty-payout: Calling validate_and_pay for report #${reportId}`);
    const payoutResult = await validateAndPay(reportId);

    if (!payoutResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Payout failed',
          details: payoutResult.error || payoutResult.vmStatus || 'On-chain payout failed. Vault may have insufficient balance.',
        },
        { status: 500 }
      );
    }

    console.log(`bounty-payout: Payout complete - tx: ${payoutResult.hash}`);

    return NextResponse.json({
      success: true,
      paymentTxHash: payoutResult.hash,
      paymentExplorerUrl: getExplorerTxUrl(payoutResult.hash),
      amount: bountyAmountMove,
      amountOctas: bountyAmountOctas.toString(),
      severity: severityLabel,
      from: 'Bounty Vault',
      to: reportInfo.reporter,
    });

  } catch (error) {
    console.error('bounty-payout: Error:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Payout failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/bounty/payout
 * Get payout API info
 */
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    endpoint: '/api/bounty/payout',
    description: 'Validate a vulnerability report and pay bounty from vault to researcher',
    note: 'Bounties are paid from the protocol\'s funded bounty vault, not from the deployer account',
    token: X402_CONFIG.token,
    network: X402_CONFIG.network,
    chainId: X402_CONFIG.chainId,
    validatorAddress: getDeployerAddress(),
    bountyAmounts: {
      low: { octas: SEVERITY_REWARDS[1], move: SEVERITY_REWARDS[1] / 1e8 },
      medium: { octas: SEVERITY_REWARDS[2], move: SEVERITY_REWARDS[2] / 1e8 },
      high: { octas: SEVERITY_REWARDS[3], move: SEVERITY_REWARDS[3] / 1e8 },
      critical: { octas: SEVERITY_REWARDS[4], move: SEVERITY_REWARDS[4] / 1e8 },
    },
    requiredFields: ['reportId'],
  });
}
