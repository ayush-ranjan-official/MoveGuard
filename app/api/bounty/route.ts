import { NextRequest, NextResponse } from 'next/server';
import {
  submitReport,
  validateAndPay,
  rejectReport,
  fundVault,
  getDeployerAddress,
} from '@/lib/signer';
import { getBountyReport, getBountyVaultBalance, getVaultStats, getReportInfo, getReportStatus } from '@/lib/movement';

type BountyAction = 'submit' | 'validate' | 'reject' | 'fund' | 'get_report' | 'get_vault_balance' | 'get_vault_stats' | 'get_report_info' | 'get_report_status';

interface BountyRequest {
  action: BountyAction;
  // For submit
  protocolAddress?: string;
  title?: string;
  description?: string;
  severity?: number;
  // For validate/reject (uses report ID)
  reportId?: number;
  reporterAddress?: string; // Kept for backwards compat with get_report_* functions
  reason?: string;
  // For fund
  amount?: number;
}

// Severity level to reward mapping (in octas)
const SEVERITY_REWARDS: Record<number, number> = {
  1: 10_000_000,   // Low: 0.1 MOVE
  2: 50_000_000,   // Medium: 0.5 MOVE
  3: 100_000_000,  // High: 1 MOVE
  4: 500_000_000,  // Critical: 5 MOVE
};

/**
 * POST /api/bounty
 * Handle bounty system operations
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as BountyRequest;
    const { action } = body;

    console.log(`Bounty action: ${action}`, body);

    switch (action) {
      case 'submit': {
        const { protocolAddress, title, description, severity } = body;
        if (!protocolAddress || !title || !description || severity === undefined) {
          return NextResponse.json(
            { error: 'protocolAddress, title, description, and severity required' },
            { status: 400 }
          );
        }

        // Submit vulnerability report to blockchain
        console.log(`Submitting report: ${title} (severity: ${severity})`);
        const result = await submitReport(protocolAddress, title, description, severity);

        return NextResponse.json({
          success: result.success,
          action: 'submit',
          txHash: result.hash,
          report: {
            protocolAddress,
            title,
            severity,
            potentialReward: SEVERITY_REWARDS[severity] || 0,
            potentialRewardMove: (SEVERITY_REWARDS[severity] || 0) / 1e8,
            status: 'pending',
            submittedAt: Date.now(),
          },
          error: result.error,
        });
      }

      case 'validate': {
        const { reportId } = body;
        if (reportId === undefined || reportId === null) {
          return NextResponse.json(
            { error: 'reportId required' },
            { status: 400 }
          );
        }

        // Validate report and trigger payout from vault
        console.log(`Validating and paying report #${reportId}`);
        const result = await validateAndPay(reportId);

        return NextResponse.json({
          success: result.success,
          action: 'validate',
          txHash: result.hash,
          reportId,
          message: result.success ? 'Bounty paid from vault successfully' : result.error,
          error: result.error,
        });
      }

      case 'reject': {
        const { reportId, reason } = body;
        if (reportId === undefined || reportId === null || !reason) {
          return NextResponse.json(
            { error: 'reportId and reason required' },
            { status: 400 }
          );
        }

        // Reject the report
        console.log(`Rejecting report #${reportId}, reason: ${reason}`);
        const result = await rejectReport(reportId, reason);

        return NextResponse.json({
          success: result.success,
          action: 'reject',
          txHash: result.hash,
          reportId,
          reason,
          error: result.error,
        });
      }

      case 'fund': {
        const { amount } = body;
        if (amount === undefined || amount <= 0) {
          return NextResponse.json(
            { error: 'Valid amount required' },
            { status: 400 }
          );
        }

        // Fund the bounty vault
        console.log(`Funding vault with: ${amount} octas`);
        const result = await fundVault(amount);

        return NextResponse.json({
          success: result.success,
          action: 'fund',
          txHash: result.hash,
          amount,
          amountMove: amount / 1e8,
          error: result.error,
        });
      }

      case 'get_report': {
        const { reporterAddress } = body;
        if (!reporterAddress) {
          return NextResponse.json(
            { error: 'reporterAddress required' },
            { status: 400 }
          );
        }

        try {
          const report = await getBountyReport(reporterAddress);
          return NextResponse.json({
            success: true,
            action: 'get_report',
            report,
          });
        } catch (error) {
          return NextResponse.json({
            success: false,
            action: 'get_report',
            error: error instanceof Error ? error.message : 'Report not found',
          });
        }
      }

      case 'get_vault_balance': {
        try {
          const balance = await getBountyVaultBalance();
          return NextResponse.json({
            success: true,
            action: 'get_vault_balance',
            balance,
            balanceMove: balance / 1e8,
          });
        } catch (error) {
          return NextResponse.json({
            success: false,
            action: 'get_vault_balance',
            balance: 0,
            error: error instanceof Error ? error.message : 'Failed to get balance',
          });
        }
      }

      case 'get_vault_stats': {
        try {
          const stats = await getVaultStats();
          return NextResponse.json({
            success: true,
            action: 'get_vault_stats',
            balance: stats.balance,
            balanceMove: stats.balance / 1e8,
            totalPaidOut: stats.totalPaidOut,
            totalPaidOutMove: stats.totalPaidOut / 1e8,
            validatedReports: stats.validatedReports,
          });
        } catch (error) {
          return NextResponse.json({
            success: false,
            action: 'get_vault_stats',
            error: error instanceof Error ? error.message : 'Failed to get vault stats',
          });
        }
      }

      case 'get_report_info': {
        const { reporterAddress } = body;
        if (!reporterAddress) {
          return NextResponse.json(
            { error: 'reporterAddress required' },
            { status: 400 }
          );
        }

        try {
          const info = await getReportInfo(reporterAddress);
          if (!info) {
            return NextResponse.json({
              success: false,
              action: 'get_report_info',
              error: 'Report not found',
            });
          }
          return NextResponse.json({
            success: true,
            action: 'get_report_info',
            report: {
              id: info.id,
              protocolAddress: info.protocolAddress,
              severity: info.severity,
              status: info.status,
              bountyAmount: info.bountyAmount,
              bountyAmountMove: info.bountyAmount / 1e8,
            },
          });
        } catch (error) {
          return NextResponse.json({
            success: false,
            action: 'get_report_info',
            error: error instanceof Error ? error.message : 'Failed to get report info',
          });
        }
      }

      case 'get_report_status': {
        const { reporterAddress } = body;
        if (!reporterAddress) {
          return NextResponse.json(
            { error: 'reporterAddress required' },
            { status: 400 }
          );
        }

        try {
          const status = await getReportStatus(reporterAddress);
          const statusLabels: Record<number, string> = {
            0: 'pending',
            1: 'validated',
            2: 'rejected',
            3: 'paid',
            255: 'not_found',
          };
          return NextResponse.json({
            success: status !== 255,
            action: 'get_report_status',
            status,
            statusLabel: statusLabels[status] || 'unknown',
          });
        } catch (error) {
          return NextResponse.json({
            success: false,
            action: 'get_report_status',
            error: error instanceof Error ? error.message : 'Failed to get report status',
          });
        }
      }

      default:
        return NextResponse.json(
          { error: `Invalid action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Bounty API error:', error);
    return NextResponse.json(
      {
        error: 'Bounty operation failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/bounty
 * Get bounty system status
 */
export async function GET() {
  try {
    const validatorAddress = getDeployerAddress();

    let vaultBalance = 0;
    try {
      vaultBalance = await getBountyVaultBalance();
    } catch {
      // Vault may not be initialized
    }

    return NextResponse.json({
      status: 'Bounty API operational',
      validatorAddress,
      vaultBalance,
      vaultBalanceMove: vaultBalance / 1e8,
      severityRewards: {
        low: { octas: SEVERITY_REWARDS[1], move: SEVERITY_REWARDS[1] / 1e8 },
        medium: { octas: SEVERITY_REWARDS[2], move: SEVERITY_REWARDS[2] / 1e8 },
        high: { octas: SEVERITY_REWARDS[3], move: SEVERITY_REWARDS[3] / 1e8 },
        critical: { octas: SEVERITY_REWARDS[4], move: SEVERITY_REWARDS[4] / 1e8 },
      },
      actions: ['submit', 'validate', 'reject', 'fund', 'get_report', 'get_vault_balance', 'get_vault_stats', 'get_report_info', 'get_report_status'],
    });
  } catch {
    return NextResponse.json(
      { error: 'Failed to get bounty API status' },
      { status: 500 }
    );
  }
}
