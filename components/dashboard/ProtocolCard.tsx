'use client';

import { motion } from 'framer-motion';
import { Shield, ShieldOff, Zap, Clock, DollarSign } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import type { ProtectedProtocol } from '@/lib/types';
import { formatAddress, octasToMove } from '@/lib/movement';
import { THREAT_THRESHOLDS } from '@/lib/constants';

interface ProtocolCardProps {
  protocol: ProtectedProtocol;
  streamBalance?: number;
  onPause?: () => void;
  onUnpause?: () => void;
  onAddFunds?: () => void;
}

export function ProtocolCard({
  protocol,
  streamBalance,
  onPause,
  onUnpause,
  onAddFunds,
}: ProtocolCardProps) {
  const getThreatStatus = (level: number) => {
    if (level >= THREAT_THRESHOLDS.critical) return 'critical';
    if (level >= THREAT_THRESHOLDS.warning) return 'warning';
    return 'safe';
  };

  const threatStatus = getThreatStatus(protocol.threatLevel);

  const statusColors = {
    safe: 'text-green-400 bg-green-500/10 border-green-500/30',
    warning: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30',
    critical: 'text-red-400 bg-red-500/10 border-red-500/30',
    paused: 'text-purple-400 bg-purple-500/10 border-purple-500/30',
  };

  const currentStatus = protocol.isPaused ? 'paused' : threatStatus;

  // registeredAt is now stored as "days ago" to avoid hydration issues
  const daysSinceRegistration = protocol.registeredAt;

  // Calculate estimated blocks remaining (assuming ~0.001 MOVE per block)
  const blocksRemaining = streamBalance ? Math.floor(streamBalance / 100000) : 0;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ scale: 1.02 }}
      transition={{ duration: 0.2 }}
    >
      <Card
        className={cn(
          'p-5 border transition-all duration-300',
          statusColors[currentStatus],
          protocol.isPaused && 'ring-2 ring-purple-500/50'
        )}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                'p-2 rounded-lg',
                protocol.protectionActive
                  ? 'bg-green-500/20'
                  : 'bg-gray-500/20'
              )}
            >
              {protocol.isPaused ? (
                <ShieldOff className="w-5 h-5 text-purple-400" />
              ) : (
                <Shield
                  className={cn(
                    'w-5 h-5',
                    protocol.protectionActive
                      ? 'text-green-400'
                      : 'text-gray-400'
                  )}
                />
              )}
            </div>
            <div>
              <h3 className="font-semibold text-foreground">{protocol.name}</h3>
              <p className="text-xs font-mono text-muted-foreground">
                {formatAddress(protocol.contractAddress)}
              </p>
            </div>
          </div>
          <Badge
            variant="outline"
            className={cn(
              'uppercase text-xs',
              protocol.isPaused
                ? 'border-purple-500/50 text-purple-400'
                : protocol.protectionActive
                ? 'border-green-500/50 text-green-400'
                : 'border-gray-500/50 text-gray-400'
            )}
          >
            {protocol.isPaused
              ? 'PAUSED'
              : protocol.protectionActive
              ? 'PROTECTED'
              : 'INACTIVE'}
          </Badge>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="p-3 rounded-lg bg-background/50">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <Zap className="w-3 h-3" />
              Threat Level
            </div>
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  'text-xl font-bold',
                  threatStatus === 'critical'
                    ? 'text-red-400'
                    : threatStatus === 'warning'
                    ? 'text-yellow-400'
                    : 'text-green-400'
                )}
              >
                {protocol.threatLevel}%
              </span>
              <Progress
                value={protocol.threatLevel}
                className={cn(
                  'h-2 flex-1',
                  threatStatus === 'critical'
                    ? '[&>div]:bg-red-500'
                    : threatStatus === 'warning'
                    ? '[&>div]:bg-yellow-500'
                    : '[&>div]:bg-green-500'
                )}
              />
            </div>
          </div>

          <div className="p-3 rounded-lg bg-background/50">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <DollarSign className="w-3 h-3" />
              Stream Balance
            </div>
            <div className="text-xl font-bold text-foreground">
              {streamBalance !== undefined ? octasToMove(streamBalance) : '—'} <span className="text-sm font-normal text-muted-foreground">MOVE</span>
            </div>
          </div>
        </div>

        {/* Protection info */}
        <div className="flex items-center justify-between text-xs text-muted-foreground mb-4">
          <div className="flex items-center gap-1" suppressHydrationWarning>
            <Clock className="w-3 h-3" />
            Protected for {daysSinceRegistration} days
          </div>
          <div suppressHydrationWarning>~{blocksRemaining.toLocaleString()} blocks remaining</div>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          {protocol.isPaused ? (
            <Button
              size="sm"
              onClick={onUnpause}
              className="flex-1 bg-purple-600 hover:bg-purple-700"
            >
              Resume Protection
            </Button>
          ) : (
            <Button
              size="sm"
              variant="destructive"
              onClick={onPause}
              className="flex-1"
            >
              Emergency Pause
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={onAddFunds}
            className="flex-1"
          >
            Add Funds
          </Button>
        </div>
      </Card>
    </motion.div>
  );
}
