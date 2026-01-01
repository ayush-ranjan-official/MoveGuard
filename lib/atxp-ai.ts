// ATXP AI Integration for threat detection
// Uses OpenAI-compatible SDK with ATXP gateway
import OpenAI from 'openai';
import { ATXP_CONFIG } from './constants';
import type { Transaction, ThreatAssessment } from './types';

// Extract connection_token from ATXP_CONNECTION URL if it's a URL format
function getAtxpApiKey(): string {
  const connection = process.env.ATXP_CONNECTION || '';
  if (connection.includes('connection_token=')) {
    try {
      const url = new URL(connection);
      return url.searchParams.get('connection_token') || connection;
    } catch {
      return connection;
    }
  }
  return connection;
}

// Initialize OpenAI client with ATXP gateway
const openai = new OpenAI({
  apiKey: getAtxpApiKey(),
  baseURL: ATXP_CONFIG.baseUrl,
});

// Threat detection system prompt
const THREAT_DETECTION_PROMPT = `You are MoveGuard AI, a DeFi security analyst specialized in detecting blockchain exploits and attacks on the Movement network.

Your task is to analyze transaction patterns and identify potential security threats.

Known DeFi Attack Patterns:

1. FLASH LOAN ATTACK
   - Large borrow from lending protocol (>$100K equivalent)
   - Multiple DEX interactions in same transaction
   - Price manipulation indicators
   - Loan repayment at end of transaction
   - Indicators: sudden large borrows, rapid swaps, price deviations

2. ORACLE MANIPULATION
   - Unusual price feed updates
   - Large trades immediately before/after oracle update
   - Price deviation >5% from market average
   - Indicators: TWAP manipulation, spot price attacks

3. SANDWICH ATTACK
   - Front-running: large buy before user transaction
   - User transaction executes at worse price
   - Back-running: large sell after user transaction
   - Indicators: MEV patterns, transaction ordering

4. GOVERNANCE ATTACK
   - Large token acquisition before proposal
   - Flash loan to acquire voting power
   - Immediate vote on critical proposal
   - Indicators: sudden voting power concentration

5. REENTRANCY (less common in Move but check for)
   - Multiple calls to withdraw/transfer functions
   - State not updated before external calls
   - Indicators: recursive call patterns

6. PRICE MANIPULATION
   - Low liquidity pool exploitation
   - Coordinated trading across DEXes
   - Indicators: unusual volume spikes, price divergence

Analyze the provided transactions and return ONLY valid JSON in this exact format:
{
  "threatLevel": <number 0-100>,
  "attackType": <string or null if no attack detected>,
  "confidence": <number 0-100>,
  "recommendation": <string with specific action to take>,
  "indicators": [<array of specific suspicious patterns found>]
}

Be conservative but vigilant. False negatives are worse than false positives for security.`;

// Analyze transactions for threats
export async function analyzeTransactions(
  transactions: Transaction[],
  protocolContext?: string
): Promise<ThreatAssessment> {
  try {
    const response = await openai.chat.completions.create({
      model: ATXP_CONFIG.model,
      messages: [
        { role: 'system', content: THREAT_DETECTION_PROMPT },
        {
          role: 'user',
          content: `${protocolContext ? `Protocol Context: ${protocolContext}\n\n` : ''}Recent Transactions (analyze for potential exploits):
${JSON.stringify(transactions, null, 2)}

Analyze these transactions and return your threat assessment.`,
        },
      ],
      temperature: 0.3, // Lower temperature for more consistent analysis
      max_tokens: 1024,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from AI');
    }

    // Parse JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Invalid JSON response from AI');
    }

    const assessment = JSON.parse(jsonMatch[0]) as ThreatAssessment;
    return {
      ...assessment,
      timestamp: Date.now(),
    };
  } catch (error) {
    console.error('Error analyzing transactions:', error);
    // Return safe default on error
    return {
      threatLevel: 0,
      attackType: null,
      confidence: 0,
      recommendation: 'Unable to analyze - manual review recommended',
      indicators: ['Analysis error - please retry'],
      timestamp: Date.now(),
    };
  }
}

// Attack scenario prompts for real AI analysis
const ATTACK_SCENARIOS: Record<string, string> = {
  flash_loan: `Analyze this simulated flash loan attack scenario on Movement network:

A transaction was detected with the following pattern:
- Flash loan initiated: 500,000 USDC borrowed from lending protocol
- Immediate swap: USDC → MOVE on DEX pool with low liquidity
- Price impact observed: Significant movement in MOVE/USDC pair
- Multiple DEX interactions within same transaction block
- Loan repayment at end of transaction with extracted profit

This pattern resembles known flash loan exploits like Euler Finance (March 2023) and bZx attacks.

Analyze this scenario and provide your threat assessment. Consider the severity, attack vector, and recommended response.`,

  oracle: `Analyze this simulated oracle manipulation scenario on Movement network:

A suspicious pattern was detected:
- Large trade executed on low-liquidity DEX pool
- Oracle price feed updated 2 blocks later with 12% deviation from market average
- Second large trade executed immediately after oracle update
- Price divergence between spot and TWAP detected
- Unusual volume spike correlating with oracle updates

This pattern resembles known oracle exploits like Mango Markets and Harvest Finance attacks.

Analyze this scenario and provide your threat assessment.`,

  sandwich: `Analyze this simulated sandwich attack scenario on Movement network:

MEV activity detected in mempool:
- Pending user swap transaction: 10,000 MOVE → USDC identified
- Front-run transaction detected: Large buy order placed before user tx
- User transaction expected to execute at worse price due to slippage
- Back-run transaction prepared: Large sell order after user tx
- Estimated victim loss: ~$400-600 in slippage

This is a classic sandwich/MEV attack pattern targeting DEX users.

Analyze this scenario and provide your threat assessment.`,

  reentrancy: `Analyze this simulated reentrancy attack scenario on Movement network:

Suspicious call pattern detected:
- Withdraw function called on vault contract
- Before state update, external call made
- Recursive calls to withdraw detected (depth: 5 calls)
- State variable not updated until after external calls complete
- Pattern matches classic reentrancy vulnerability exploitation

While Move language has built-in protections, this pattern indicates potential vulnerability or workaround attempt. Similar to TheDAO hack pattern.

Analyze this scenario and provide your threat assessment.`,
};

// Analyze attack scenario using real ATXP AI
export async function analyzeAttackScenario(
  attackType: 'flash_loan' | 'oracle' | 'sandwich' | 'reentrancy' = 'flash_loan',
  protocolContext?: string
): Promise<ThreatAssessment> {
  try {
    const scenario = ATTACK_SCENARIOS[attackType] || ATTACK_SCENARIOS.flash_loan;

    const response = await openai.chat.completions.create({
      model: ATXP_CONFIG.model,
      messages: [
        { role: 'system', content: THREAT_DETECTION_PROMPT },
        {
          role: 'user',
          content: `${protocolContext ? `Protocol Context: ${protocolContext}\n\n` : ''}${scenario}`,
        },
      ],
      temperature: 0.4, // Slightly higher for varied responses
      max_tokens: 1024,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from AI');
    }

    // Parse JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Invalid JSON response from AI');
    }

    const assessment = JSON.parse(jsonMatch[0]) as ThreatAssessment;
    return {
      ...assessment,
      timestamp: Date.now(),
    };
  } catch (error) {
    console.error('Error analyzing attack scenario:', error);
    // Fallback to basic assessment on error
    return {
      threatLevel: 75,
      attackType: attackType.toUpperCase().replace('_', ' ') + ' ATTACK',
      confidence: 60,
      recommendation: 'AI analysis encountered an error - manual review recommended. Precautionary pause advised.',
      indicators: ['AI analysis error - using fallback assessment', `Attack type: ${attackType}`],
      timestamp: Date.now(),
    };
  }
}

// Legacy simulation function (kept for fallback if ATXP not configured)
export async function simulateAttackDetection(
  attackType: 'flash_loan' | 'oracle' | 'sandwich' | 'reentrancy' = 'flash_loan'
): Promise<ThreatAssessment> {
  // If ATXP is configured, use real AI
  if (isAtxpConfigured()) {
    return analyzeAttackScenario(attackType);
  }

  // Fallback to hardcoded responses only if ATXP not configured
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

// Check if ATXP is configured
export function isAtxpConfigured(): boolean {
  return Boolean(process.env.ATXP_CONNECTION);
}
