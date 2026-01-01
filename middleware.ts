import { NextRequest, NextResponse } from 'next/server';

/**
 * x402 Payment Middleware for MoveGuard (Movement Network)
 *
 * Protects specific API routes with MOVE token micropayments.
 * Uses on-chain verification on Movement Bardock Testnet.
 */

// Environment configuration
const RECIPIENT_ADDRESS = process.env.X402_RECIPIENT_ADDRESS;
const MOVEMENT_RPC = process.env.NEXT_PUBLIC_MOVEMENT_RPC || 'https://testnet.movementnetwork.xyz/v1';
const X402_FALLBACK_MODE = process.env.X402_FALLBACK_MODE === 'true' || process.env.NODE_ENV === 'development';

// Movement Network configuration
const MOVEMENT_CONFIG = {
  network: 'movement-bardock-testnet',
  chainId: 250,
  token: 'MOVE',
  tokenDecimals: 8,
  explorerUrl: 'https://explorer.movementnetwork.xyz',
  explorerNetwork: 'bardock+testnet',
};

// Pricing configuration (in MOVE tokens)
const ROUTE_PRICING: Record<string, { price: string; priceOctas: string; description: string }> = {
  '/api/threats/analyze': {
    price: '0.001',
    priceOctas: '100000', // 0.001 MOVE = 100,000 octas
    description: 'AI-powered threat analysis',
  },
  '/api/protocols': {
    price: '0.005',
    priceOctas: '500000', // 0.005 MOVE = 500,000 octas
    description: 'Premium protocol registration',
  },
};

// Routes that should be protected (POST only)
const PROTECTED_ROUTES = ['/api/threats/analyze', '/api/protocols'];

// Actions within /api/protocols that require payment
const PAID_PROTOCOL_ACTIONS = ['register'];

// In-memory nonce storage for middleware
// Note: In production, use a distributed cache like Redis
const paymentNonces = new Map<string, {
  amount: string;
  amountOctas: string;
  expiry: number;
  consumed: boolean;
}>();

/**
 * Generate a random nonce
 */
function generateNonce(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Store a nonce for later verification
 */
function storeNonce(nonce: string, amount: string, amountOctas: string): void {
  paymentNonces.set(nonce, {
    amount,
    amountOctas,
    expiry: Date.now() + 15 * 60 * 1000, // 15 minutes
    consumed: false,
  });

  // Cleanup old nonces periodically
  const now = Date.now();
  Array.from(paymentNonces.entries()).forEach(([key, value]) => {
    if (now > value.expiry) {
      paymentNonces.delete(key);
    }
  });
}

/**
 * Validate and consume a nonce
 */
function validateAndConsumeNonce(nonce: string): {
  valid: boolean;
  amountOctas?: string;
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

  // Mark as consumed
  stored.consumed = true;
  setTimeout(() => paymentNonces.delete(nonce), 60000);

  return { valid: true, amountOctas: stored.amountOctas };
}

/**
 * Generate 402 Payment Required response for Movement
 */
function createPaymentRequiredResponse(
  price: string,
  priceOctas: string,
  description: string
): NextResponse {
  const nonce = generateNonce();
  const expiry = Date.now() + 15 * 60 * 1000;

  // Store nonce for verification
  storeNonce(nonce, price, priceOctas);

  const requirements = {
    x402Version: 2,
    scheme: 'exact',
    network: MOVEMENT_CONFIG.network,
    chainId: MOVEMENT_CONFIG.chainId,
    token: MOVEMENT_CONFIG.token,
    tokenDecimals: MOVEMENT_CONFIG.tokenDecimals,
    amountRequired: price,
    amountRequiredOctas: priceOctas,
    resource: RECIPIENT_ADDRESS || '',
    paymentNonce: nonce,
    nonceExpiry: expiry,
    description,
    explorerUrl: MOVEMENT_CONFIG.explorerUrl,
  };

  return new NextResponse(
    JSON.stringify({
      error: 'Payment Required',
      message: `This endpoint requires a payment of ${price} MOVE`,
      ...requirements,
    }),
    {
      status: 402,
      headers: {
        'Content-Type': 'application/json',
        'X-Payment-Required': 'true',
        'X-Payment-Version': '2',
        'X-Payment-Scheme': 'exact',
        'X-Payment-Network': MOVEMENT_CONFIG.network,
        'X-Payment-ChainId': MOVEMENT_CONFIG.chainId.toString(),
        'X-Payment-Token': MOVEMENT_CONFIG.token,
        'X-Payment-Decimals': MOVEMENT_CONFIG.tokenDecimals.toString(),
        'X-Payment-Amount': price,
        'X-Payment-AmountOctas': priceOctas,
        'X-Payment-Nonce': nonce,
        'X-Payment-NonceExpiry': expiry.toString(),
        'X-Payment-Recipient': RECIPIENT_ADDRESS || '',
        'X-Payment-Description': description,
      },
    }
  );
}

/**
 * Check if running in fallback mode
 * Fallback mode is enabled when:
 * - X402_FALLBACK_MODE=true is set
 * - Running in development (NODE_ENV=development)
 * - No recipient address is configured
 */
function isFallbackMode(): boolean {
  if (X402_FALLBACK_MODE) return true;
  return !RECIPIENT_ADDRESS || RECIPIENT_ADDRESS === '0x0' || RECIPIENT_ADDRESS === '';
}

/**
 * Verify payment on Movement blockchain
 */
async function verifyPaymentOnMovement(
  txHash: string,
  nonce: string,
  expectedAmountOctas: string
): Promise<{ valid: boolean; error?: string }> {
  // Fallback mode - accept real Movement tx hashes (66 chars: 0x + 64 hex)
  // This allows server-assisted payments to work without on-chain verification delay
  if (isFallbackMode()) {
    console.log('x402: Fallback mode - validating payment hash format');

    // Validate tx hash format
    if (!txHash || !txHash.startsWith('0x')) {
      return { valid: false, error: 'Invalid transaction hash format' };
    }

    // Real Movement transactions have 66-character hashes (0x + 64 hex)
    // Accept both real (66 chars) and simulated (>=10 chars) hashes
    if (txHash.length === 66) {
      // This is a real transaction hash from server-assisted payment
      console.log('x402: Fallback mode - accepting real Movement tx hash');
      return { valid: true };
    } else if (txHash.length >= 10) {
      // Legacy simulated format - still accept for backwards compatibility
      console.log('x402: Fallback mode - accepting simulated tx hash');
      return { valid: true };
    }

    return { valid: false, error: 'Invalid transaction hash format' };
  }

  // Production mode - validate nonce first
  const nonceResult = validateAndConsumeNonce(nonce);
  if (!nonceResult.valid) {
    return { valid: false, error: nonceResult.error };
  }

  try {
    // Query transaction from Movement RPC
    const response = await fetch(`${MOVEMENT_RPC}/transactions/by_hash/${txHash}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      if (response.status === 404) {
        return { valid: false, error: 'Transaction not found on Movement blockchain' };
      }
      return { valid: false, error: `RPC error: ${response.status}` };
    }

    const tx = await response.json();

    // Check if transaction is pending
    if (tx.type === 'pending_transaction') {
      return { valid: false, error: 'Transaction is still pending' };
    }

    // Check if transaction was successful
    if (tx.success === false) {
      return { valid: false, error: 'Transaction failed on-chain' };
    }

    // For transfer transactions, verify the payload
    const payload = tx.payload;
    if (payload?.function === '0x1::aptos_account::transfer' ||
        payload?.function === '0x1::coin::transfer') {
      const [recipient, amount] = payload.arguments || [];

      // Verify recipient
      if (recipient && RECIPIENT_ADDRESS && !recipient.toLowerCase().includes(RECIPIENT_ADDRESS.toLowerCase().replace('0x', ''))) {
        return { valid: false, error: 'Payment sent to wrong recipient' };
      }

      // Verify amount
      if (amount && BigInt(amount) < BigInt(expectedAmountOctas)) {
        return { valid: false, error: `Insufficient payment: got ${amount}, need ${expectedAmountOctas}` };
      }
    }

    // Transaction looks valid
    console.log(`x402: Payment verified on Movement - tx: ${txHash}`);
    return { valid: true };

  } catch (error) {
    console.error('x402: Verification error:', error);
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Verification failed',
    };
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const method = request.method;

  // Only protect POST requests
  if (method !== 'POST') {
    return NextResponse.next();
  }

  // Check if this route is protected
  const matchedRoute = PROTECTED_ROUTES.find((route) => pathname.startsWith(route));
  if (!matchedRoute) {
    return NextResponse.next();
  }

  // For /api/protocols, only require payment for specific actions
  if (matchedRoute === '/api/protocols') {
    try {
      const clonedRequest = request.clone();
      const body = await clonedRequest.json();

      if (!PAID_PROTOCOL_ACTIONS.includes(body.action)) {
        return NextResponse.next();
      }
    } catch {
      return NextResponse.next();
    }
  }

  // Get pricing for this route
  const pricing = ROUTE_PRICING[matchedRoute];
  if (!pricing) {
    return NextResponse.next();
  }

  // Check for payment headers
  const txHash = request.headers.get('X-Payment');
  const nonce = request.headers.get('X-Payment-Nonce');

  // If no payment, return 402
  if (!txHash || !nonce) {
    console.log(`x402: Payment required for ${pathname}`);
    return createPaymentRequiredResponse(pricing.price, pricing.priceOctas, pricing.description);
  }

  // Verify the payment on Movement
  const verification = await verifyPaymentOnMovement(txHash, nonce, pricing.priceOctas);

  if (!verification.valid) {
    console.log(`x402: Invalid payment for ${pathname}:`, verification.error);
    return new NextResponse(
      JSON.stringify({
        error: 'Invalid Payment',
        details: verification.error || 'Payment verification failed',
      }),
      {
        status: 402,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  // Payment valid - allow request through
  console.log(`x402: Payment verified for ${pathname} (tx: ${txHash})`);

  const response = NextResponse.next();
  response.headers.set('X-Payment-Verified', 'true');
  response.headers.set('X-Payment-TxHash', txHash);
  response.headers.set('X-Payment-Amount', pricing.price);

  return response;
}

// Configure which routes the middleware runs on
export const config = {
  matcher: [
    '/api/threats/analyze',
    '/api/protocols',
  ],
};
