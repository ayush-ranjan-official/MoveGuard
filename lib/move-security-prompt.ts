/**
 * Move Smart Contract Security Analysis Prompt
 *
 * Specialized prompt for AI-powered vulnerability detection in Move contracts.
 * Designed for the Movement/Aptos ecosystem.
 */

export const MOVE_SECURITY_SYSTEM_PROMPT = `You are MoveGuard AI, an expert Move smart contract security auditor specializing in the Movement/Aptos ecosystem. Your task is to analyze Move source code for security vulnerabilities with high accuracy.

## Your Expertise

You have deep knowledge of:
- Move language semantics and resource model
- Common smart contract vulnerabilities adapted to Move
- Aptos/Movement framework security patterns
- DeFi-specific attack vectors

## Known Move Vulnerability Patterns

### 1. ACCESS CONTROL (Critical Severity)
- **Unused signer**: Parameter like \`_account: &signer\` that is never used for authorization
- **Missing signer verification**: No \`signer::address_of()\` check before privileged operations
- **Public functions that should be restricted**: Entry functions allowing unauthorized access
- **Missing friend declarations**: Modules that should be protected aren't

### 2. INITIALIZATION VULNERABILITIES (High Severity)
- **Missing exists<> check**: No \`exists<Resource>(addr)\` before \`move_to\`
- **Re-initialization attacks**: Contract can be initialized multiple times
- **Missing deployer validation**: Anyone can call initialize functions

### 3. ARITHMETIC ISSUES (Medium-High Severity)
- **Integer overflow/underflow**: Unchecked \`+\`, \`-\`, \`*\` operations without safe math
- **Division by zero**: Missing zero-value checks before division
- **Precision loss**: Incorrect decimal handling in financial calculations

### 4. RESOURCE SAFETY (High Severity)
- **State after transfer**: Balance/state updated AFTER external call or coin transfer
- **Reentrancy-like patterns**: External interactions before state finalization
- **Resource leaks**: Resources not properly handled or dropped
- **Dangling references**: Borrowing issues that could cause data corruption

### 5. HARDCODED VALUES (Medium Severity)
- **Hardcoded addresses**: \`const ADMIN: address = @0x...\` patterns
- **Hardcoded configuration**: Values that should be configurable are constants
- **Magic numbers**: Unexplained numeric constants in logic

### 6. COIN/TOKEN ISSUES (Critical Severity)
- **Missing balance checks**: Withdrawals without sufficient balance verification
- **Incorrect coin types**: Type confusion in generic coin operations
- **Missing slippage protection**: DEX operations without price bounds
- **Flash loan vulnerabilities**: State that can be manipulated within a transaction

## Analysis Guidelines

1. **Be thorough**: Check every function, especially public and entry functions
2. **Check authorization**: Verify every signer parameter is actually used
3. **Trace data flow**: Follow how values move through the contract
4. **Consider attack scenarios**: Think like an attacker looking for exploits
5. **Prioritize by impact**: Critical vulnerabilities that can drain funds first

## Response Format

You MUST respond with ONLY valid JSON in this exact format:

\`\`\`json
{
  "threatLevel": <number 0-100>,
  "confidence": <number 0-100>,
  "attackType": "<primary attack category or null>",
  "vulnerabilities": [
    {
      "name": "<vulnerability name>",
      "severity": "<critical|high|medium|low>",
      "location": "<function name or code location>",
      "description": "<clear description of what is wrong>",
      "exploit": "<how an attacker could exploit this>",
      "fix": "<recommended fix>"
    }
  ],
  "recommendation": "<overall security recommendation>",
  "indicators": ["<list>", "<of>", "<suspicious>", "<patterns>", "<found>"]
}
\`\`\`

## Threat Level Guidelines

- **0-25**: Safe - No significant vulnerabilities found
- **26-50**: Low Risk - Minor issues, informational findings
- **51-70**: Medium Risk - Vulnerabilities present but exploitation difficult
- **71-85**: High Risk - Serious vulnerabilities that should be fixed
- **86-100**: Critical - Immediate action required, funds at risk

Be conservative but thorough. False negatives are worse than false positives for security analysis.`;

/**
 * Build the analysis prompt with contract code
 */
export function buildAnalysisPrompt(
  sourceCode: string,
  protocolName?: string,
  protocolAddress?: string
): string {
  return `Analyze the following Move smart contract for security vulnerabilities.

${protocolName ? `Protocol Name: ${protocolName}` : ''}
${protocolAddress ? `Contract Address: ${protocolAddress}` : ''}

\`\`\`move
${sourceCode}
\`\`\`

Perform a comprehensive security analysis and return your findings as JSON.`;
}

/**
 * Vulnerability interface for structured responses
 */
export interface Vulnerability {
  name: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  location: string;
  description: string;
  exploit: string;
  fix: string;
}

/**
 * Full security analysis response
 */
export interface SecurityAnalysis {
  threatLevel: number;
  confidence: number;
  attackType: string | null;
  vulnerabilities: Vulnerability[];
  recommendation: string;
  indicators: string[];
}

/**
 * Parse AI response into structured SecurityAnalysis
 */
export function parseSecurityAnalysis(response: string): SecurityAnalysis | null {
  try {
    // Extract JSON from response (handle markdown code blocks)
    const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/) ||
                      response.match(/```\s*([\s\S]*?)\s*```/) ||
                      response.match(/(\{[\s\S]*\})/);

    if (!jsonMatch) {
      console.error('No JSON found in AI response');
      return null;
    }

    const parsed = JSON.parse(jsonMatch[1]);

    // Validate required fields
    if (typeof parsed.threatLevel !== 'number' ||
        !Array.isArray(parsed.vulnerabilities)) {
      console.error('Missing required fields in AI response');
      return null;
    }

    return {
      threatLevel: parsed.threatLevel,
      confidence: parsed.confidence || 80,
      attackType: parsed.attackType || null,
      vulnerabilities: parsed.vulnerabilities || [],
      recommendation: parsed.recommendation || 'Review findings and implement fixes.',
      indicators: parsed.indicators || [],
    };
  } catch (error) {
    console.error('Failed to parse security analysis:', error);
    return null;
  }
}

/**
 * Fallback analysis for known vulnerable contracts
 * Used when AI is unavailable but we know the contract has issues
 */
export const KNOWN_VULNERABILITIES: Record<string, SecurityAnalysis> = {
  'vulnerable_vault': {
    threatLevel: 92,
    confidence: 98,
    attackType: 'ACCESS_CONTROL_BYPASS',
    vulnerabilities: [
      {
        name: 'Missing Access Control',
        severity: 'critical',
        location: 'emergency_withdraw()',
        description: 'The _account signer parameter is never used for authorization. Anyone can call this function.',
        exploit: 'An attacker can call emergency_withdraw with any vault address to drain funds to the hardcoded ADMIN address.',
        fix: 'Add assert!(signer::address_of(account) == ADMIN, E_NOT_AUTHORIZED) or proper ownership check.',
      },
      {
        name: 'Hardcoded Admin Address',
        severity: 'medium',
        location: 'const ADMIN',
        description: 'Admin address is hardcoded as a constant (@0xdead), making it impossible to change.',
        exploit: 'If the admin key is compromised, there is no way to recover or transfer admin privileges.',
        fix: 'Store admin in a resource that can be updated by current admin.',
      },
      {
        name: 'No Initialization Protection',
        severity: 'high',
        location: 'initialize()',
        description: 'Missing exists<Vault> check allows re-initialization, potentially overwriting existing vault.',
        exploit: 'Attacker can call initialize() again to reset vault state and steal funds.',
        fix: 'Add assert!(!exists<Vault>(signer::address_of(account)), E_ALREADY_INITIALIZED).',
      },
      {
        name: 'State Update After Transfer',
        severity: 'high',
        location: 'withdraw()',
        description: 'Balance state is updated AFTER coin::deposit. This is a reentrancy-like anti-pattern.',
        exploit: 'In more complex scenarios, this ordering could allow state manipulation.',
        fix: 'Update vault.total_deposits BEFORE calling coin::deposit.',
      },
      {
        name: 'Integer Overflow Risk',
        severity: 'medium',
        location: 'deposit()',
        description: 'total_deposits uses unchecked addition that could overflow.',
        exploit: 'With enough deposits, total_deposits could wrap around to zero.',
        fix: 'Use checked arithmetic or verify total_deposits + amount does not overflow.',
      },
    ],
    recommendation: 'CRITICAL: This contract has multiple severe vulnerabilities. Do NOT use in production. The emergency_withdraw function can be called by anyone to drain all funds.',
    indicators: [
      '_account: &signer unused parameter',
      'const ADMIN: address = @0xdead hardcoded',
      'Missing exists<Vault> check in initialize',
      'coin::deposit before state update in withdraw',
      'Unchecked arithmetic in deposit',
    ],
  },
};

/**
 * Get fallback analysis for known vulnerable contracts
 */
export function getKnownVulnerabilities(moduleName: string): SecurityAnalysis | null {
  return KNOWN_VULNERABILITIES[moduleName] || null;
}
