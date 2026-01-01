import { NextRequest, NextResponse } from 'next/server';
import { simulateAttackDetection, getSafeAssessment } from '@/lib/atxp-ai';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, attackType } = body as {
      action: 'attack' | 'reset';
      attackType?: 'flash_loan' | 'oracle' | 'sandwich' | 'reentrancy';
    };

    if (action === 'reset') {
      return NextResponse.json({
        success: true,
        assessment: getSafeAssessment(),
        message: 'Reset to safe state',
      });
    }

    if (action === 'attack') {
      const assessment = await simulateAttackDetection(attackType || 'flash_loan');
      return NextResponse.json({
        success: true,
        assessment,
        message: `Simulated ${attackType || 'flash_loan'} attack detected`,
        actions: {
          threatLevel: assessment.threatLevel,
          shouldPause: assessment.threatLevel >= 75,
          attackType: assessment.attackType,
        },
      });
    }

    return NextResponse.json(
      { error: 'Invalid action. Use "attack" or "reset"' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Simulation error:', error);
    return NextResponse.json(
      { error: 'Simulation failed' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'Attack simulation API is operational',
    availableActions: ['attack', 'reset'],
    availableAttackTypes: ['flash_loan', 'oracle', 'sandwich', 'reentrancy'],
    usage: {
      attack: 'POST with { action: "attack", attackType: "flash_loan" }',
      reset: 'POST with { action: "reset" }',
    },
  });
}
