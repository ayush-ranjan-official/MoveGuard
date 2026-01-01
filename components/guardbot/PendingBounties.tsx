'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Gift, Loader2, CheckCircle, Coins } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useState } from 'react';
import { cn } from '@/lib/utils';

interface PendingBounty {
  reportId: number;
  amount: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  submittedAt: number;
}

interface PendingBountiesProps {
  bounties: PendingBounty[];
  onClaim: (reportId: number, severity: 'low' | 'medium' | 'high' | 'critical') => Promise<boolean>;
}

const severityColors: Record<string, { bg: string; text: string; border: string }> = {
  low: { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/30' },
  medium: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', border: 'border-yellow-500/30' },
  high: { bg: 'bg-orange-500/20', text: 'text-orange-400', border: 'border-orange-500/30' },
  critical: { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/30' },
};

export function PendingBounties({ bounties, onClaim }: PendingBountiesProps) {
  const [claimingId, setClaimingId] = useState<number | null>(null);
  const [claimedIds, setClaimedIds] = useState<Set<number>>(new Set());

  const handleClaim = async (bounty: PendingBounty) => {
    setClaimingId(bounty.reportId);
    try {
      const success = await onClaim(bounty.reportId, bounty.severity);
      if (success) {
        setClaimedIds(prev => new Set([...Array.from(prev), bounty.reportId]));
      }
    } finally {
      setClaimingId(null);
    }
  };

  const totalPending = bounties
    .filter(b => !claimedIds.has(b.reportId))
    .reduce((sum, b) => sum + parseFloat(b.amount), 0);

  const pendingBounties = bounties.filter(b => !claimedIds.has(b.reportId));

  if (bounties.length === 0) {
    return null;
  }

  return (
    <Card className="p-4 bg-gradient-to-br from-green-900/20 via-card to-emerald-900/20 border-green-500/30">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-green-500/20">
            <Gift className="w-5 h-5 text-green-400" />
          </div>
          <div>
            <h3 className="font-semibold text-sm">Pending Bounties</h3>
            <p className="text-xs text-muted-foreground">
              {pendingBounties.length} report{pendingBounties.length !== 1 ? 's' : ''} awaiting claim
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold text-green-400">{totalPending.toFixed(2)} MOVE</p>
          <p className="text-xs text-muted-foreground">Total pending</p>
        </div>
      </div>

      <div className="space-y-2">
        <AnimatePresence>
          {bounties.map((bounty) => {
            const isClaiming = claimingId === bounty.reportId;
            const isClaimed = claimedIds.has(bounty.reportId);
            const colors = severityColors[bounty.severity];

            return (
              <motion.div
                key={bounty.reportId}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: isClaimed ? 0.5 : 1, y: 0 }}
                exit={{ opacity: 0, height: 0 }}
                className={cn(
                  'flex items-center justify-between p-3 rounded-lg border',
                  colors.bg,
                  colors.border,
                  isClaimed && 'opacity-50'
                )}
              >
                <div className="flex items-center gap-3">
                  <Coins className={cn('w-4 h-4', colors.text)} />
                  <div>
                    <p className="text-sm font-medium">
                      Report #{bounty.reportId}
                    </p>
                    <div className="flex items-center gap-2">
                      <Badge className={cn('text-[10px]', colors.bg, colors.text)}>
                        {bounty.severity.toUpperCase()}
                      </Badge>
                      <span className={cn('text-sm font-bold', colors.text)}>
                        {bounty.amount} MOVE
                      </span>
                    </div>
                  </div>
                </div>

                {isClaimed ? (
                  <div className="flex items-center gap-2 text-green-400">
                    <CheckCircle className="w-4 h-4" />
                    <span className="text-sm">Claimed!</span>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    onClick={() => handleClaim(bounty)}
                    disabled={isClaiming}
                    className="bg-green-600 hover:bg-green-700 text-white"
                  >
                    {isClaiming ? (
                      <>
                        <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                        Claiming...
                      </>
                    ) : (
                      'Claim Bounty'
                    )}
                  </Button>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {pendingBounties.length > 0 && (
        <p className="text-xs text-muted-foreground mt-3 text-center">
          Click &quot;Claim Bounty&quot; to withdraw to your wallet
        </p>
      )}
    </Card>
  );
}
