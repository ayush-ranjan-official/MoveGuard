// Privy configuration for MoveGuard V2
import type { PrivyClientConfig } from '@privy-io/react-auth';

// Movement Bardock Testnet chain definition
export const movementTestnet = {
  id: 250,
  name: 'Movement Bardock Testnet',
  network: 'movement-testnet',
  nativeCurrency: {
    decimals: 8,
    name: 'MOVE',
    symbol: 'MOVE',
  },
  rpcUrls: {
    default: {
      http: [process.env.NEXT_PUBLIC_MOVEMENT_RPC || 'https://rpc.ankr.com/http/movement_bardock/v1'],
    },
    public: {
      http: [process.env.NEXT_PUBLIC_MOVEMENT_RPC || 'https://rpc.ankr.com/http/movement_bardock/v1'],
    },
  },
  blockExplorers: {
    default: {
      name: 'Movement Explorer',
      url: 'https://explorer.movementnetwork.xyz/?network=bardock+testnet',
    },
  },
  testnet: true,
} as const;

// Privy configuration
export const privyConfig: PrivyClientConfig = {
  embeddedWallets: {
    ethereum: {
      createOnLogin: 'users-without-wallets',
    },
    showWalletUIs: true,
  },
  // OAuth providers (google, twitter) configured in Privy dashboard
  // These provide seamless onboarding without seed phrases
  loginMethods: ['email', 'google', 'twitter'],
  appearance: {
    theme: 'dark',
    accentColor: '#7C3AED',
    logo: '/logo.svg',
    showWalletLoginFirst: false,
  },
  // Note: For Movement (Aptos-based), we handle signing differently
  // Privy creates an EVM wallet, but we use Aptos SDK for Move transactions
};

// Helper to get Privy app ID
export function getPrivyAppId(): string {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  if (!appId) {
    console.warn('NEXT_PUBLIC_PRIVY_APP_ID not set. Auth will not work.');
    return '';
  }
  return appId;
}
