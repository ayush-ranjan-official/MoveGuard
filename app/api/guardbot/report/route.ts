/**
 * GuardBot Auto-Report API
 *
 * POST /api/guardbot/report
 *
 * Automatically submits a vulnerability report when threat is detected:
 * 1. Pays submission fee via x402 (server-side)
 * 2. Submits vulnerability report to bounty vault
 * 3. Returns pending bounty information
 *
 * This demonstrates the autonomous bounty-earning behavior.
 */

import { NextRequest, NextResponse } from 'next/server';
import { signAndSubmitTransaction, submitReport, getDeployerAddress } from '@/lib/signer';
import { moveToOctas } from '@/lib/x402';
import { getTotalReports } from '@/lib/movement';
import type { ReportRequest, ReportResponse, ActivityLogEntry } from '@/lib/guardbot/types';
import { AGENT_PRICING, BOUNTY_REWARDS } from '@/lib/guardbot/types';

function generateActivityId(): string {
  return `activity_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

function getSeverityFromThreatLevel(threatLevel: number): {
  severity: 'low' | 'medium' | 'high' | 'critical';
  severityNum: number;
  bounty: string;
} {
  if (threatLevel >= 90) {
    return { severity: 'critical', severityNum: 4, bounty: BOUNTY_REWARDS.critical };
  } else if (threatLevel >= 70) {
    return { severity: 'high', severityNum: 3, bounty: BOUNTY_REWARDS.high };
  } else if (threatLevel >= 50) {
    return { severity: 'medium', severityNum: 2, bounty: BOUNTY_REWARDS.medium };
  }
  return { severity: 'low', severityNum: 1, bounty: BOUNTY_REWARDS.low };
}

export async function POST(request: NextRequest): Promise<NextResponse<ReportResponse>> {
  const activities: ActivityLogEntry[] = [];

  try {
    const body: ReportRequest = await request.json();
    const {
      protocolAddress,
      protocolName,
      threatLevel,
      attackType,
      confidence,
      indicators,
      recommendation,
    } = body;

    if (!protocolAddress || !attackType || threatLevel === undefined) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields: protocolAddress, attackType, threatLevel',
        activities: [],
      }, { status: 400 });
    }

    console.log(`guardbot-report: Auto-reporting vulnerability for ${protocolAddress}`);

    // Determine severity based on threat level
    const { severity, severityNum, bounty } = getSeverityFromThreatLevel(threatLevel);

    // Step 1: Pay submission fee via x402
    const feeAmount = AGENT_PRICING.reportSubmission;
    const feeOctas = moveToOctas(feeAmount);

    console.log(`guardbot-report: Paying ${feeAmount} MOVE submission fee`);

    const feeResult = await signAndSubmitTransaction({
      function: '0x1::aptos_account::transfer',
      functionArguments: [getDeployerAddress(), feeOctas.toString()],
    });

    if (!feeResult.success) {
      activities.push({
        id: generateActivityId(),
        timestamp: Date.now(),
        type: 'error',
        message: `Fee payment failed: ${feeResult.error}`,
        severity: 'error',
      });

      return NextResponse.json({
        success: false,
        error: `Submission fee payment failed: ${feeResult.error}`,
        activities,
      }, { status: 500 });
    }

    // Add fee payment activity
    activities.push({
      id: generateActivityId(),
      timestamp: Date.now(),
      type: 'payment',
      message: `Paid ${feeAmount} MOVE submission fee`,
      txHash: feeResult.hash,
      amountMove: feeAmount,
      severity: 'success',
    });

    console.log(`guardbot-report: Fee paid - ${feeResult.hash}`);

    // Step 2: Submit vulnerability report on-chain
    const title = `[GuardBot] ${attackType} Vulnerability Detected`;
    const description = `
Automated vulnerability report by GuardBot Agent.

Attack Type: ${attackType}
Threat Level: ${threatLevel}%
Confidence: ${confidence}%

Indicators:
${indicators.map(i => `- ${i}`).join('\n')}

Recommendation: ${recommendation}

Protocol: ${protocolName || 'Unknown'}
Address: ${protocolAddress}

This report was automatically generated and submitted by an autonomous security agent.
    `.trim();

    const submitResult = await submitReport(
      protocolAddress,
      title,
      description,
      severityNum
    );

    if (!submitResult.success) {
      // Fee was paid but submission failed
      activities.push({
        id: generateActivityId(),
        timestamp: Date.now(),
        type: 'error',
        message: `Report submission failed: ${submitResult.error}`,
        severity: 'error',
      });

      return NextResponse.json({
        success: false,
        error: `Report submission failed (fee was paid): ${submitResult.error}`,
        feeTx: feeResult.hash,
        activities,
      }, { status: 500 });
    }

    // Add report submission activity
    activities.push({
      id: generateActivityId(),
      timestamp: Date.now(),
      type: 'report',
      message: `Vulnerability report submitted (${severity} severity)`,
      txHash: submitResult.hash,
      protocolAddress,
      severity: 'success',
    });

    // Add pending bounty activity
    activities.push({
      id: generateActivityId(),
      timestamp: Date.now(),
      type: 'bounty',
      message: `Pending bounty: ${bounty} MOVE (${severity} severity)`,
      amountMove: bounty,
      severity: 'success',
    });

    // Get the actual on-chain report ID (total_reports after submission = latest report ID)
    const reportId = await getTotalReports();

    console.log(`guardbot-report: Report submitted - ${submitResult.hash}`);
    console.log(`guardbot-report: On-chain report ID: ${reportId}`);
    console.log(`guardbot-report: Pending bounty - ${bounty} MOVE`);

    return NextResponse.json({
      success: true,
      reportId, // Include actual on-chain report ID
      submissionTx: submitResult.hash,
      feeTx: feeResult.hash,
      pendingBounty: {
        amount: bounty,
        amountOctas: moveToOctas(bounty).toString(),
        severity,
      },
      activities,
    });

  } catch (error) {
    console.error('guardbot-report: Error:', error);

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
    endpoint: '/api/guardbot/report',
    description: 'GuardBot auto-report API - Submits vulnerability reports',
    pricing: {
      submissionFee: AGENT_PRICING.reportSubmission + ' MOVE',
    },
    bountyRewards: BOUNTY_REWARDS,
  });
}
