import { NextRequest, NextResponse } from 'next/server';
import { analyzeTransactions, analyzeAttackScenario, isAtxpConfigured } from '@/lib/atxp-ai';
import { triggerPause } from '@/lib/signer';
import type { Transaction, ThreatAssessment } from '@/lib/types';

// Auto-pause threshold
const AUTO_PAUSE_THRESHOLD = 75;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      transactions,
      protocolContext,
      attackType,
      protocolAddress  // Address to pause if threat detected
    } = body as {
      transactions?: Transaction[];
      protocolContext?: string;
      attackType?: 'flash_loan' | 'oracle' | 'sandwich' | 'reentrancy';
      protocolAddress?: string;
    };

    let assessment: ThreatAssessment;
    let mode: 'real' | 'fallback' = 'real';

    // Check if ATXP is configured
    if (!isAtxpConfigured()) {
      console.log('ATXP not configured - using fallback assessment');
      assessment = {
        threatLevel: 75,
        attackType: (attackType || 'flash_loan').toUpperCase().replace('_', ' ') + ' ATTACK',
        confidence: 50,
        recommendation: 'ATXP AI not configured. Configure ATXP_CONNECTION env var for real AI analysis.',
        indicators: ['Fallback mode - no AI analysis available'],
        timestamp: Date.now(),
      };
      mode = 'fallback';
    } else if (transactions && transactions.length > 0) {
      // Real AI analysis with actual transactions
      console.log('Using real ATXP AI with transaction data');
      assessment = await analyzeTransactions(transactions, protocolContext);
      mode = 'real';
    } else if (attackType) {
      // Real AI analysis with attack scenario
      console.log(`Using real ATXP AI for ${attackType} scenario analysis`);
      assessment = await analyzeAttackScenario(attackType, protocolContext);
      mode = 'real';
    } else {
      // Default to flash loan scenario
      console.log('Using real ATXP AI for default flash_loan scenario');
      assessment = await analyzeAttackScenario('flash_loan', protocolContext);
      mode = 'real';
    }

    // AI-triggered automatic pause when threat level is high
    let pauseResult: { triggered: boolean; txHash?: string; error?: string } = { triggered: false };

    if (assessment.threatLevel >= AUTO_PAUSE_THRESHOLD && protocolAddress) {
      console.log(`HIGH THREAT DETECTED (${assessment.threatLevel}%) - Auto-pausing protocol: ${protocolAddress}`);

      try {
        const result = await triggerPause(
          protocolAddress,
          assessment.attackType || 'AI_DETECTED_THREAT',
          assessment.threatLevel,
          assessment.confidence
        );

        pauseResult = {
          triggered: true,
          txHash: result.hash,
          error: result.success ? undefined : result.error,
        };

        console.log(`Auto-pause ${result.success ? 'SUCCESS' : 'FAILED'}: ${result.hash || result.error}`);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';

        // Check if already paused - this is not a failure
        if (errorMsg.includes('E_ALREADY_PAUSED') || errorMsg.includes('already paused')) {
          console.log('Protocol is already paused - no action needed');
          pauseResult = {
            triggered: true, // Treat as success since protocol is paused
            error: undefined,
          };
        } else {
          console.error('Failed to trigger auto-pause:', error);
          pauseResult = {
            triggered: false,
            error: errorMsg,
          };
        }
      }
    }

    return NextResponse.json({
      success: true,
      assessment,
      mode,
      atxpConfigured: isAtxpConfigured(),
      timestamp: Date.now(),
      // Auto-pause information
      autoPause: {
        threshold: AUTO_PAUSE_THRESHOLD,
        threatLevelMet: assessment.threatLevel >= AUTO_PAUSE_THRESHOLD,
        protocolAddress,
        ...pauseResult,
      },
    });
  } catch (error) {
    console.error('Threat analysis error:', error);
    return NextResponse.json(
      {
        error: 'Failed to analyze threats',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'Threat analysis API is operational',
    configured: isAtxpConfigured(),
    mode: isAtxpConfigured() ? 'real_ai' : 'fallback',
    autoPauseThreshold: AUTO_PAUSE_THRESHOLD,
    supportedAttackTypes: ['flash_loan', 'oracle', 'sandwich', 'reentrancy'],
    features: {
      realTimeAnalysis: isAtxpConfigured(),
      aiProvider: 'ATXP (OpenAI-compatible)',
      autoPause: true,
      blockchainIntegration: true,
    },
  });
}
