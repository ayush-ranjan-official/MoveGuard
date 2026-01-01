// Client-safe threat simulation functions (no API keys)
// These are mock functions for testing and simulation purposes
import type { ThreatAssessment } from './types';

// Simulate attack detection for testing purposes
export async function simulateAttackDetection(
  attackType: 'flash_loan' | 'oracle' | 'sandwich' | 'reentrancy' = 'flash_loan'
): Promise<ThreatAssessment> {
  // Add realistic delay
  await new Promise((resolve) => setTimeout(resolve, 1500));

  const attacks: Record<string, ThreatAssessment> = {
    flash_loan: {
      threatLevel: 94,
      attackType: 'FLASH_LOAN_ATTACK',
      confidence: 89,
      recommendation: 'IMMEDIATE PAUSE RECOMMENDED - Large flash loan detected with suspicious DEX interactions matching known exploit patterns',
      indicators: [
        'Flash loan of 500,000 USDC initiated from Echelon',
        'Multiple rapid swaps across Meridian pools in single tx',
        'Price impact exceeds 8% threshold on MOVE/USDC pair',
        'Pattern matches Euler Finance exploit signature (March 2023)',
        'Loan repayment structured to extract profit',
      ],
      timestamp: Date.now(),
    },
    oracle: {
      threatLevel: 87,
      attackType: 'ORACLE_MANIPULATION',
      confidence: 82,
      recommendation: 'PAUSE RECOMMENDED - Oracle price deviation detected with coordinated trading activity',
      indicators: [
        'TWAP oracle updated with 12% price deviation',
        'Large trade executed 2 blocks before oracle update',
        'Price feed diverges from Chainlink reference',
        'Pattern matches Mango Markets exploit',
      ],
      timestamp: Date.now(),
    },
    sandwich: {
      threatLevel: 72,
      attackType: 'SANDWICH_ATTACK',
      confidence: 91,
      recommendation: 'ALERT - Sandwich attack in progress targeting user swap',
      indicators: [
        'Front-run transaction detected in mempool',
        'Target user swap for 10,000 MOVE identified',
        'Back-run transaction prepared',
        'Estimated user loss: $450',
      ],
      timestamp: Date.now(),
    },
    reentrancy: {
      threatLevel: 96,
      attackType: 'REENTRANCY_PATTERN',
      confidence: 78,
      recommendation: 'CRITICAL - Recursive call pattern detected, immediate action required',
      indicators: [
        'Recursive withdraw calls detected (depth: 5)',
        'State update bypass attempted',
        'Target contract: vault withdrawal function',
        'Similar to DAO hack pattern',
      ],
      timestamp: Date.now(),
    },
  };

  return attacks[attackType] || attacks.flash_loan;
}

// Generate safe assessment
export function getSafeAssessment(): ThreatAssessment {
  return {
    threatLevel: Math.floor(Math.random() * 15) + 5, // 5-20 range
    attackType: null,
    confidence: 95,
    recommendation: 'No threats detected. System operating normally.',
    indicators: [],
    timestamp: Date.now(),
  };
}
