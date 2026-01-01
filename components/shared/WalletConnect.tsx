'use client';

import { usePrivy, useWallets } from '@privy-io/react-auth';
import { Button } from '@/components/ui/button';
import { LogOut, Wallet, Loader2 } from 'lucide-react';
import { formatAddress } from '@/lib/movement';
import { getPrivyAppId } from '@/lib/privy';

export function WalletConnect() {
  const privyAppId = getPrivyAppId();

  // If Privy is not configured, show a disabled button
  if (!privyAppId) {
    return (
      <Button
        disabled
        className="gap-2 bg-purple-600/50 text-white/70 cursor-not-allowed"
      >
        <Wallet className="h-4 w-4" />
        Wallet (Not Configured)
      </Button>
    );
  }

  return <WalletConnectInner />;
}

function WalletConnectInner() {
  const { login, logout, authenticated, ready, user } = usePrivy();
  const { wallets } = useWallets();

  // Find the embedded wallet
  const embeddedWallet = wallets.find((w) => w.walletClientType === 'privy');
  const walletAddress = embeddedWallet?.address || user?.wallet?.address;

  if (!ready) {
    return (
      <Button variant="outline" disabled className="gap-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading...
      </Button>
    );
  }

  if (!authenticated) {
    return (
      <Button
        onClick={login}
        className="gap-2 bg-purple-600 hover:bg-purple-700 text-white"
      >
        <Wallet className="h-4 w-4" />
        Connect Wallet
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <div className="hidden sm:flex items-center gap-2 px-3 py-2 bg-muted rounded-lg">
        <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
        <span className="text-sm font-mono text-muted-foreground">
          {walletAddress ? formatAddress(walletAddress) : 'Connected'}
        </span>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={logout}
        className="gap-2 text-muted-foreground hover:text-foreground"
      >
        <LogOut className="h-4 w-4" />
        <span className="hidden sm:inline">Disconnect</span>
      </Button>
    </div>
  );
}
