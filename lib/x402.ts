/**
 * x402 Payment Protocol Client for Movement Network
 *
 * Implements x402-style micropayments on Movement Bardock Testnet.
 * Uses on-chain verification instead of external facilitator.
 *
 * Network: Movement Bardock Testnet
 * Token: MOVE (native)
 */

import { randomBytes } from 'crypto';

// Environment configuration
const RECIPIENT_ADDRESS = process.env.X402_RECIPIENT_ADDRESS || process.env.NEXT_PUBLIC_MODULE_ADDRESS;

// Movement Network configuration
export const X402_CONFIG = {
  network: 'movement-bardock-testnet',
  chainId: 250,
  token: 'MOVE',
  tokenDecimals: 8,
  tokenType: '0x1::aptos_coin::AptosCoin',
  recipient: RECIPIENT_ADDRESS || '',
  explorerUrl: 'https://explorer.movementnetwork.xyz',
  explorerNetwork: 'bardock+testnet',
  rpcUrl: process.env.NEXT_PUBLIC_MOVEMENT_RPC || 'https://rpc.ankr.com/http/movement_bardock/v1',
} as const;

// Pricing tiers (in MOVE tokens)
export const PRICING = {
  threatAnalysis: '0.001',        // 0.001 MOVE per AI analysis
  protocolRegistration: '0.005',  // 0.005 MOVE per registration
  apiAccess: '0.0001',            // 0.0001 MOVE per generic API call
  bountySubmissionFee: '0.01',    // 0.01 MOVE to submit vulnerability report
} as const;

// Token conversion constants
export const MOVE_DECIMALS = 8;
export const OCTAS_PER_MOVE = 100_000_000;

/**
 * Convert MOVE to octas (smallest unit)
 */
export function moveToOctas(move: number | string): number {
  const value = typeof move === 'string' ? parseFloat(move) : move;
  return Math.floor(value * OCTAS_PER_MOVE);
}

/**
 * Convert octas to MOVE
 */
export function octasToMove(octas: number | string): string {
  const value = typeof octas === 'string' ? parseInt(octas) : octas;
  return (value / OCTAS_PER_MOVE).toFixed(8);
}

// Movement Payment Requirements
export interface MovementPaymentRequirements {
  x402Version: number;
  scheme: 'exact';
  network: string;
  chainId: number;
  token: string;
  tokenDecimals: number;
  amountRequired: string;          // Human-readable MOVE amount
  amountRequiredOctas: string;     // Amount in octas (smallest unit)
  resource: string;                // Recipient address
  paymentNonce: string;            // Unique nonce for this payment request
  nonceExpiry: number;             // Unix timestamp when nonce expires
  description?: string;
  explorerUrl: string;
}

// Payment verification result
export interface PaymentVerification {
  valid: boolean;
  amount?: string;
  amountOctas?: string;
  payer?: string;
  txHash?: string;
  error?: string;
}

// 402 Response from server
export interface X402Response {
  error: string;
  message?: string;
  x402Version?: number;
  scheme?: string;
  network?: string;
  chainId?: number;
  token?: string;
  tokenDecimals?: number;
  amountRequired?: string;
  amountRequiredOctas?: string;
  resource?: string;
  paymentNonce?: string;
  nonceExpiry?: number;
  description?: string;
  explorerUrl?: string;
}

// Nonce storage (in production, use Redis or database)
interface NonceData {
  amount: string;
  amountOctas: string;
  expiry: number;
  resource: string;
  consumed: boolean;
}

const paymentNonces = new Map<string, NonceData>();

/**
 * Generate a unique payment nonce
 */
export function generatePaymentNonce(): string {
  return randomBytes(16).toString('hex');
}

/**
 * Store a payment nonce for later verification
 */
export function storePaymentNonce(
  nonce: string,
  amount: string,
  amountOctas: string,
  resource: string,
  expiryMs: number = 15 * 60 * 1000 // 15 minutes default
): void {
  paymentNonces.set(nonce, {
    amount,
    amountOctas,
    expiry: Date.now() + expiryMs,
    resource,
    consumed: false,
  });
}

/**
 * Validate a payment nonce
 */
export function validateNonce(nonce: string): {
  valid: boolean;
  amount?: string;
  amountOctas?: string;
  resource?: string;
  error?: string;
} {
  const stored = paymentNonces.get(nonce);

  if (!stored) {
    return { valid: false, error: 'Invalid or unknown payment nonce' };
  }

  if (stored.consumed) {
    return { valid: false, error: 'Payment nonce already used' };
  }

  if (Date.now() > stored.expiry) {
    paymentNonces.delete(nonce);
    return { valid: false, error: 'Payment nonce expired' };
  }

  return {
    valid: true,
    amount: stored.amount,
    amountOctas: stored.amountOctas,
    resource: stored.resource,
  };
}

/**
 * Mark a nonce as consumed after successful verification
 */
export function consumeNonce(nonce: string): void {
  const stored = paymentNonces.get(nonce);
  if (stored) {
    stored.consumed = true;
    // Clean up after a delay
    setTimeout(() => paymentNonces.delete(nonce), 60000);
  }
}

/**
 * Clean up expired nonces (call periodically)
 */
export function cleanupExpiredNonces(): void {
  const now = Date.now();
  Array.from(paymentNonces.entries()).forEach(([nonce, data]) => {
    if (now > data.expiry) {
      paymentNonces.delete(nonce);
    }
  });
}

/**
 * Check if x402 is properly configured
 */
export function isX402Configured(): boolean {
  return !!(RECIPIENT_ADDRESS && RECIPIENT_ADDRESS !== '0x0');
}

/**
 * Generate payment requirements for Movement x402 protocol
 */
export function generateMovementPaymentRequirements(
  amountMove: string,
  description?: string
): MovementPaymentRequirements {
  const nonce = generatePaymentNonce();
  const amountOctas = moveToOctas(amountMove).toString();
  const expiry = Date.now() + (15 * 60 * 1000); // 15 minutes

  // Store nonce for later verification
  storePaymentNonce(nonce, amountMove, amountOctas, X402_CONFIG.recipient);

  return {
    x402Version: 2, // Version 2 for Movement support
    scheme: 'exact',
    network: X402_CONFIG.network,
    chainId: X402_CONFIG.chainId,
    token: X402_CONFIG.token,
    tokenDecimals: X402_CONFIG.tokenDecimals,
    amountRequired: amountMove,
    amountRequiredOctas: amountOctas,
    resource: X402_CONFIG.recipient,
    paymentNonce: nonce,
    nonceExpiry: expiry,
    description: description || 'MoveGuard API access payment',
    explorerUrl: X402_CONFIG.explorerUrl,
  };
}

/**
 * Create 402 Payment Required response for Movement (server-side)
 */
export function createPaymentRequiredResponse(
  amount: string,
  description?: string
): Response {
  const requirements = generateMovementPaymentRequirements(amount, description);

  return new Response(
    JSON.stringify({
      error: 'Payment Required',
      message: `This endpoint requires a payment of ${amount} MOVE`,
      ...requirements,
    }),
    {
      status: 402,
      headers: {
        'Content-Type': 'application/json',
        'X-Payment-Required': 'true',
        'X-Payment-Version': '2',
        'X-Payment-Scheme': requirements.scheme,
        'X-Payment-Network': requirements.network,
        'X-Payment-ChainId': requirements.chainId.toString(),
        'X-Payment-Token': requirements.token,
        'X-Payment-Decimals': requirements.tokenDecimals.toString(),
        'X-Payment-Amount': requirements.amountRequired,
        'X-Payment-AmountOctas': requirements.amountRequiredOctas,
        'X-Payment-Nonce': requirements.paymentNonce,
        'X-Payment-NonceExpiry': requirements.nonceExpiry.toString(),
        'X-Payment-Recipient': requirements.resource,
        'X-Payment-Description': requirements.description || '',
      },
    }
  );
}

/**
 * Parse 402 response to extract payment requirements (client-side)
 */
export function parsePaymentRequired(response: X402Response): MovementPaymentRequirements | null {
  if (!response.amountRequired && !response.amountRequiredOctas) {
    return null;
  }

  const amountRequired = response.amountRequired || octasToMove(response.amountRequiredOctas || '0');
  const amountRequiredOctas = response.amountRequiredOctas || moveToOctas(response.amountRequired || '0').toString();

  return {
    x402Version: response.x402Version || 2,
    scheme: 'exact',
    network: response.network || X402_CONFIG.network,
    chainId: response.chainId || X402_CONFIG.chainId,
    token: response.token || X402_CONFIG.token,
    tokenDecimals: response.tokenDecimals || X402_CONFIG.tokenDecimals,
    amountRequired,
    amountRequiredOctas,
    resource: response.resource || '',
    paymentNonce: response.paymentNonce || '',
    nonceExpiry: response.nonceExpiry || 0,
    description: response.description,
    explorerUrl: response.explorerUrl || X402_CONFIG.explorerUrl,
  };
}

/**
 * Check if a fetch response is a 402 Payment Required (client-side)
 */
export function isPaymentRequired(response: Response): boolean {
  return response.status === 402;
}

/**
 * Extract payment info from 402 response headers (client-side)
 */
export function getPaymentInfoFromHeaders(response: Response): {
  required: boolean;
  amount?: string;
  amountOctas?: string;
  network?: string;
  chainId?: number;
  token?: string;
  tokenDecimals?: number;
  nonce?: string;
  nonceExpiry?: number;
  recipient?: string;
  description?: string;
} {
  const required = response.headers.get('X-Payment-Required') === 'true';

  if (!required) {
    return { required: false };
  }

  return {
    required: true,
    amount: response.headers.get('X-Payment-Amount') || undefined,
    amountOctas: response.headers.get('X-Payment-AmountOctas') || undefined,
    network: response.headers.get('X-Payment-Network') || undefined,
    chainId: parseInt(response.headers.get('X-Payment-ChainId') || '0') || undefined,
    token: response.headers.get('X-Payment-Token') || undefined,
    tokenDecimals: parseInt(response.headers.get('X-Payment-Decimals') || '0') || undefined,
    nonce: response.headers.get('X-Payment-Nonce') || undefined,
    nonceExpiry: parseInt(response.headers.get('X-Payment-NonceExpiry') || '0') || undefined,
    recipient: response.headers.get('X-Payment-Recipient') || undefined,
    description: response.headers.get('X-Payment-Description') || undefined,
  };
}

/**
 * Format price for display (MOVE token)
 */
export function formatPrice(amount: string): string {
  const num = parseFloat(amount);
  if (num < 0.01) {
    return num.toFixed(4);
  }
  return num.toFixed(2);
}

/**
 * Format price with token symbol
 */
export function formatPriceWithSymbol(amount: string): string {
  return `${formatPrice(amount)} MOVE`;
}

/**
 * Get explorer URL for a transaction on Movement
 */
export function getExplorerTxUrl(txHash: string): string {
  return `${X402_CONFIG.explorerUrl}/txn/${txHash}?network=${X402_CONFIG.explorerNetwork}`;
}

/**
 * Get explorer URL for an address on Movement
 */
export function getExplorerAddressUrl(address: string): string {
  return `${X402_CONFIG.explorerUrl}/account/${address}?network=${X402_CONFIG.explorerNetwork}`;
}

// Export configuration for external use
export { RECIPIENT_ADDRESS };
