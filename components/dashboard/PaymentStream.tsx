'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Coins, TrendingDown, Zap, RefreshCw, Loader2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { octasToMove } from '@/lib/movement';
import { PAYMENT_CONFIG } from '@/lib/constants';

interface PaymentStreamProps {
  protocolName: string;
  balance: number;
  ratePerBlock: number;
  isActive: boolean;
  isLoading?: boolean;
  onAddFunds?: () => void;
  onActivate?: () => void;
}

export function PaymentStream({
  protocolName,
  balance: propBalance,
  ratePerBlock = PAYMENT_CONFIG.ratePerBlock,
  isActive = true,
  isLoading = false,
  onAddFunds,
  onActivate,
}: PaymentStreamProps) {
  const [balance, setBalance] = useState(propBalance);
  const [blocksProcessed, setBlocksProcessed] = useState(0);

  // Sync local balance with prop when it changes (e.g., from blockchain refresh)
  useEffect(() => {
    setBalance(propBalance);
  }, [propBalance]);

  // Simulate balance decreasing - only when active and has balance
  useEffect(() => {
    if (!isActive || balance === 0) return;

    const interval = setInterval(() => {
      setBalance((prev) => {
        const newBalance = Math.max(0, prev - ratePerBlock);
        if (newBalance === 0) {
          clearInterval(interval);
        }
        return newBalance;
      });
      setBlocksProcessed((prev) => prev + 1);
    }, 2000); // Simulate a block every 2 seconds

    return () => clearInterval(interval);
  }, [isActive, ratePerBlock, balance]);

  const maxBalance = 100000000; // 1 MOVE max for visualization
  const percentRemaining = Math.min(100, (balance / maxBalance) * 100);

  // Estimate hours remaining
  const blocksRemaining = balance / ratePerBlock;
  const hoursRemaining = (blocksRemaining * 2) / 3600; // 2 seconds per block

  const isLowBalance = balance < 10000000; // Less than 0.1 MOVE

  return (
    <Card className={cn(
      'p-5 border transition-all duration-300',
      isLowBalance && isActive && 'border-yellow-500/50 bg-yellow-500/5'
    )}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={cn(
            'p-2 rounded-lg',
            isActive ? 'bg-green-500/20' : 'bg-gray-500/20'
          )}>
            <Coins className={cn(
              'w-5 h-5',
              isActive ? 'text-green-400' : 'text-gray-400'
            )} />
          </div>
          <div>
            <h3 className="font-semibold">Payment Stream</h3>
            <p className="text-xs text-muted-foreground">{protocolName}</p>
          </div>
        </div>
        <div className={cn(
          'flex items-center gap-1 px-2 py-1 rounded-full text-xs',
          isActive ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'
        )}>
          <div className={cn(
            'w-2 h-2 rounded-full',
            isActive ? 'bg-green-500 animate-pulse' : 'bg-gray-500'
          )} />
          {isActive ? 'Active' : 'Inactive'}
        </div>
      </div>

      {/* Balance Display */}
      <div className="mb-4">
        <div className="flex items-end justify-between mb-2">
          <div>
            <div className="text-3xl font-bold">
              {octasToMove(balance)}
              <span className="text-lg font-normal text-muted-foreground ml-1">MOVE</span>
            </div>
            <div className="text-xs text-muted-foreground">Current Balance</div>
          </div>
          <div className="text-right">
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <TrendingDown className="w-4 h-4 text-red-400" />
              <span className="text-red-400">-{octasToMove(ratePerBlock)}</span>
              <span>/block</span>
            </div>
          </div>
        </div>
        <Progress
          value={percentRemaining}
          className={cn(
            'h-3',
            isLowBalance ? '[&>div]:bg-yellow-500' : '[&>div]:bg-green-500'
          )}
        />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="p-3 rounded-lg bg-background/50">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <Zap className="w-3 h-3" />
            Blocks Remaining
          </div>
          <div className="text-lg font-semibold">
            ~{Math.floor(blocksRemaining).toLocaleString()}
          </div>
        </div>
        <div className="p-3 rounded-lg bg-background/50">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <RefreshCw className="w-3 h-3" />
            Time Remaining
          </div>
          <div className="text-lg font-semibold">
            {hoursRemaining > 24
              ? `~${Math.floor(hoursRemaining / 24)}d`
              : hoursRemaining > 1
              ? `~${Math.floor(hoursRemaining)}h`
              : `~${Math.floor(hoursRemaining * 60)}m`}
          </div>
        </div>
      </div>

      {/* Stream Stats */}
      <div className="flex items-center justify-between text-xs text-muted-foreground mb-4 p-2 rounded bg-background/30">
        <span>Blocks processed: {blocksProcessed}</span>
        <span>Rate: $0.001/block</span>
      </div>

      {/* Actions */}
      {isActive ? (
        <Button onClick={onAddFunds} disabled={isLoading} className="w-full bg-purple-600 hover:bg-purple-700">
          {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Coins className="w-4 h-4 mr-2" />}
          {isLoading ? 'Processing...' : 'Add Funds to Stream'}
        </Button>
      ) : (
        <div className="space-y-2">
          <Button onClick={onActivate} disabled={isLoading} className="w-full bg-green-600 hover:bg-green-700">
            {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Zap className="w-4 h-4 mr-2" />}
            {isLoading ? 'Creating Stream...' : 'Create Payment Stream'}
          </Button>
          <p className="text-xs text-center text-muted-foreground">
            Creates a stream with 0.1 MOVE initial deposit
          </p>
        </div>
      )}

      {isLowBalance && isActive && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-3 p-2 rounded bg-yellow-500/10 border border-yellow-500/30 text-xs text-yellow-400"
        >
          Low balance warning: Protection may pause soon if not topped up.
        </motion.div>
      )}
    </Card>
  );
}
