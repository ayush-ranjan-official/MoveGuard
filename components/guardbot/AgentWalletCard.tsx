'use client';

import { motion } from 'framer-motion';
import { Wallet, ExternalLink, Shield, Loader2, Sparkles } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { AgentWallet, AgentStatus } from '@/lib/guardbot/types';
import { X402_CONFIG } from '@/lib/x402';

interface AgentWalletCardProps {
  wallet: AgentWallet | null;
  status: AgentStatus;
  onCreateWallet: () => Promise<void>;
  isCreating?: boolean;
}

export function AgentWalletCard({
  wallet,
  status,
  onCreateWallet,
  isCreating = false,
}: AgentWalletCardProps) {
  const explorerUrl = wallet
    ? `${X402_CONFIG.explorerUrl}/account/${wallet.address}?network=${X402_CONFIG.explorerNetwork}`
    : null;

  const formatAddress = (address: string) => {
    return `${address.slice(0, 8)}...${address.slice(-6)}`;
  };

  return (
    <Card className="p-6 bg-gradient-to-br from-purple-900/20 via-card to-blue-900/20 border-purple-500/30">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="p-3 rounded-xl bg-purple-500/20 border border-purple-500/30">
              <Shield className="w-6 h-6 text-purple-400" />
            </div>
            {wallet && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-green-500 border-2 border-background"
              />
            )}
          </div>
          <div>
            <h3 className="text-lg font-bold flex items-center gap-2">
              Agent Wallet
              <Badge className="bg-purple-500/20 text-purple-300 text-[10px]">
                Privy Embedded
              </Badge>
            </h3>
            <p className="text-xs text-muted-foreground">
              Autonomous security agent wallet
            </p>
          </div>
        </div>

        {/* Status Badge */}
        <StatusBadge status={status} />
      </div>

      {/* Wallet Content */}
      {wallet ? (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          {/* Address */}
          <div className="p-3 rounded-lg bg-background/50 border border-border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Wallet Address</p>
                <p className="font-mono text-sm">{formatAddress(wallet.address)}</p>
              </div>
              {explorerUrl && (
                <a
                  href={explorerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 rounded-lg hover:bg-muted transition-colors"
                >
                  <ExternalLink className="w-4 h-4 text-muted-foreground" />
                </a>
              )}
            </div>
          </div>

          {/* Balance */}
          <div className="p-4 rounded-lg bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-purple-500/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Available Balance</p>
                <p className="text-2xl font-bold text-purple-400">
                  {parseFloat(wallet.balanceMove).toFixed(4)} <span className="text-base font-normal">MOVE</span>
                </p>
              </div>
              <div className="p-3 rounded-full bg-purple-500/20">
                <Wallet className="w-5 h-5 text-purple-400" />
              </div>
            </div>
          </div>

          {/* Network Info */}
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              Movement Testnet
            </span>
            <span>Chain ID: {X402_CONFIG.chainId}</span>
          </div>

          {/* Privy Branding */}
          <div className="pt-3 border-t border-border flex items-center justify-center gap-2">
            <Sparkles className="w-3 h-3 text-purple-400" />
            <span className="text-xs text-muted-foreground">
              Powered by <span className="text-purple-400 font-medium">Privy</span> Embedded Wallets
            </span>
          </div>
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-6"
        >
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-purple-500/10 flex items-center justify-center">
            <Wallet className="w-8 h-8 text-purple-400/50" />
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Create an embedded wallet to power your GuardBot agent
          </p>
          <Button
            onClick={onCreateWallet}
            disabled={isCreating}
            className="bg-purple-600 hover:bg-purple-700 gap-2"
          >
            {isCreating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Creating Wallet...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Create Agent Wallet
              </>
            )}
          </Button>
          <p className="text-xs text-muted-foreground mt-3">
            No seed phrase needed - Privy handles security
          </p>
        </motion.div>
      )}
    </Card>
  );
}

function StatusBadge({ status }: { status: AgentStatus }) {
  const config: Record<AgentStatus, { color: string; bg: string; label: string }> = {
    idle: { color: 'text-gray-400', bg: 'bg-gray-500/20', label: 'Idle' },
    initializing: { color: 'text-blue-400', bg: 'bg-blue-500/20', label: 'Initializing' },
    monitoring: { color: 'text-yellow-400', bg: 'bg-yellow-500/20', label: 'Monitoring' },
    analyzing: { color: 'text-purple-400', bg: 'bg-purple-500/20', label: 'Analyzing' },
    reporting: { color: 'text-orange-400', bg: 'bg-orange-500/20', label: 'Reporting' },
    paused: { color: 'text-gray-400', bg: 'bg-gray-500/20', label: 'Paused' },
    error: { color: 'text-red-400', bg: 'bg-red-500/20', label: 'Error' },
  };

  const { color, bg, label } = config[status];
  const isActive = ['monitoring', 'analyzing', 'reporting', 'initializing'].includes(status);

  return (
    <Badge className={cn('gap-1', bg, color)}>
      {isActive && (
        <span className="relative flex h-2 w-2">
          <span className={cn('animate-ping absolute inline-flex h-full w-full rounded-full opacity-75', bg)} />
          <span className={cn('relative inline-flex rounded-full h-2 w-2', color.replace('text-', 'bg-'))} />
        </span>
      )}
      {label}
    </Badge>
  );
}
