/**
 * GuardBot Bounty Claim API
 *
 * POST /api/guardbot/claim
 *
 * Validates a pending report and pays out the bounty.
 * Since the deployer is both reporter and validator on testnet,
 * this effectively "claims" the pending bounty.
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateAndPay } from '@/lib/signer';
import type { ActivityLogEntry } from '@/lib/guardbot/types';
import { BOUNTY_REWARDS } from '@/lib/guardbot/types';

function generateActivityId(): string {
  return `activity_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

interface ClaimRequest {
  reportId: number;
  severity?: 'low' | 'medium' | 'high' | 'critical';
}

interface ClaimResponse {
  success: boolean;
  txHash?: string;
  bountyPaid?: string;
  error?: string;
  activities: ActivityLogEntry[];
  isTestnetMode?: boolean;
}

export async function POST(request: NextRequest): Promise<NextResponse<ClaimResponse>> {
  const activities: ActivityLogEntry[] = [];

  try {
    const body: ClaimRequest = await request.json();
    const { reportId, severity = 'high' } = body;

    if (reportId === undefined || reportId === null) {
      return NextResponse.json({
        success: false,
        error: 'Report ID is required',
        activities: [],
      }, { status: 400 });
    }

    console.log(`guardbot-claim: Claiming bounty for report #${reportId}`);

    // Get bounty amount based on severity
    const bountyAmount = BOUNTY_REWARDS[severity] || BOUNTY_REWARDS.high;

    const claimResult = await validateAndPay(reportId);

    if (!claimResult.success) {
      activities.push({
        id: generateActivityId(),
        timestamp: Date.now(),
        type: 'error',
        message: `Bounty claim failed: ${claimResult.error}`,
        severity: 'error',
      });

      return NextResponse.json({
        success: false,
        error: `Claim failed: ${claimResult.error}`,
        activities,
      }, { status: 500 });
    }

    // Add success activity
    activities.push({
      id: generateActivityId(),
      timestamp: Date.now(),
      type: 'bounty',
      message: `Bounty claimed: ${bountyAmount} MOVE for report #${reportId}`,
      txHash: claimResult.hash,
      amountMove: bountyAmount,
      severity: 'success',
    });

    console.log(`guardbot-claim: Bounty paid - ${claimResult.hash}`);

    return NextResponse.json({
      success: true,
      txHash: claimResult.hash,
      bountyPaid: bountyAmount,
      activities,
    });

  } catch (error) {
    console.error('guardbot-claim: Error:', error);

    activities.push({
      id: generateActivityId(),
      timestamp: Date.now(),
      type: 'error',
      message: error instanceof Error ? error.message : 'Unknown error',
      severity: 'error',
    });

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      activities,
    }, { status: 500 });
  }
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    endpoint: '/api/guardbot/claim',
    description: 'GuardBot bounty claim API - Validates reports and pays bounties',
    usage: 'POST with { reportId: number, severity?: "low" | "medium" | "high" | "critical" }',
    bountyRewards: BOUNTY_REWARDS,
  });
}
