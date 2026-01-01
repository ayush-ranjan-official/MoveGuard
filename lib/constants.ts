// MoveGuard V2 Constants

// Available RPC endpoints for Movement Bardock Testnet
// If one is slow/unreliable, try another by updating NEXT_PUBLIC_MOVEMENT_RPC in .env
export const MOVEMENT_RPC_ENDPOINTS = {
  official: 'https://testnet.movementnetwork.xyz/v1',
  ankr: 'https://rpc.ankr.com/http/movement_bardock/v1',
  blockpi: 'https://movement.blockpi.network/rpc/v1/public/v1',
  sentio: 'https://rpc.sentio.xyz/movement/v1',
  lava: 'https://movement.lava.build/',
  nodeops: 'https://movement-rpc.nodeops.network/v1',
} as const;

// Movement Network Configuration
// Default: Official testnet RPC (can be overridden via NEXT_PUBLIC_MOVEMENT_RPC env var)
export const MOVEMENT_CONFIG = {
  testnet: {
    chainId: 250,
    name: 'Movement Bardock Testnet',
    fullnode: process.env.NEXT_PUBLIC_MOVEMENT_RPC || MOVEMENT_RPC_ENDPOINTS.official,
    indexer: process.env.NEXT_PUBLIC_MOVEMENT_INDEXER || 'https://hasura.testnet.movementnetwork.xyz/v1/graphql',
    faucet: 'https://faucet.testnet.movementnetwork.xyz/',
    explorer: 'https://explorer.movementnetwork.xyz/?network=bardock+testnet',
  },
} as const;

// Contract addresses (will be updated after deployment)
export const MODULE_ADDRESS = process.env.NEXT_PUBLIC_MODULE_ADDRESS || '0x0';

// Contract module names
export const MODULES = {
  guardian: `${MODULE_ADDRESS}::guardian`,
  paymentStream: `${MODULE_ADDRESS}::payment_stream`,
  bountyVault: `${MODULE_ADDRESS}::bounty_vault`,
} as const;

// Payment configuration
export const PAYMENT_CONFIG = {
  ratePerBlock: 100000, // 0.001 MOVE per block (in octas)
  minDeposit: 10000000, // 0.1 MOVE minimum
  decimals: 8,
} as const;

// Bounty amounts in octas (1 MOVE = 10^8 octas)
export const BOUNTY_AMOUNTS = {
  low: 10_000_000,      // 0.1 MOVE
  medium: 50_000_000,   // 0.5 MOVE
  high: 100_000_000,    // 1 MOVE
  critical: 500_000_000, // 5 MOVE
} as const;

// Minimum deposit for bounty-based protocol registration (1 MOVE)
export const MIN_BOUNTY_DEPOSIT = 100_000_000; // 1 MOVE in octas

// Threat level thresholds
export const THREAT_THRESHOLDS = {
  safe: 25,
  warning: 50,
  critical: 75,
} as const;

// x402 Configuration
export const X402_CONFIG = {
  facilitator: process.env.NEXT_PUBLIC_X402_FACILITATOR || 'https://facilitator.x402.org',
  network: 'base-sepolia',
  prices: {
    threatAnalysis: '$0.001',
    protectionStream: '$0.001',
  },
} as const;

// ATXP AI Configuration
export const ATXP_CONFIG = {
  baseUrl: 'https://llm.atxp.ai/v1',
  model: 'gpt-4.1',
} as const;

// Test data - Using valid hex addresses for blockchain interaction
// These are example addresses on Movement testnet
// Using static timestamps to avoid hydration mismatch (days ago from a fixed reference)
const _DAY_MS = 86400000;
export const MOCK_PROTOCOLS = [
  {
    name: 'Echelon Lending',
    contractAddress: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
    admin: MODULE_ADDRESS,
    isPaused: false,
    threatLevel: 12,
    protectionActive: true,
    registeredAt: 7, // days ago - will be calculated on client
    lastThreatCheck: 0,
  },
  {
    name: 'Meridian DEX',
    contractAddress: '0x2345678901abcdef2345678901abcdef2345678901abcdef2345678901abcdef',
    admin: MODULE_ADDRESS,
    isPaused: false,
    threatLevel: 8,
    protectionActive: true,
    registeredAt: 14, // days ago
    lastThreatCheck: 0,
  },
  {
    name: 'Movement Vault',
    contractAddress: '0x3456789012abcdef3456789012abcdef3456789012abcdef3456789012abcdef',
    admin: MODULE_ADDRESS,
    isPaused: false,
    threatLevel: 5,
    protectionActive: true,
    registeredAt: 3, // days ago
    lastThreatCheck: 0,
  },
];
