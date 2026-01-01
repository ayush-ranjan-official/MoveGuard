'use client';

import { motion } from 'framer-motion';
import { CheckCircle, Clock, XCircle, DollarSign, Zap, Loader2, ExternalLink, Wallet } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { VulnerabilityReport } from '@/lib/types';
import { octasToMove, formatAddress } from '@/lib/movement';

interface BountyHistoryProps {
  reports: VulnerabilityReport[];
  onValidate?: (reporterAddress: string, payoutAddress: string) => Promise<void>;
  isValidating?: string | null;
}

const statusConfig = {
  pending: {
    icon: Clock,
    color: 'text-yellow-400',
    bg: 'bg-yellow-500/10',
    border: 'border-yellow-500/30',
    label: 'Pending Review',
  },
  validated: {
    icon: CheckCircle,
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/30',
    label: 'Validated',
  },
  rejected: {
    icon: XCircle,
    color: 'text-red-400',
    bg: 'bg-red-500/10',
    border: 'border-red-500/30',
    label: 'Rejected',
  },
  paid: {
    icon: DollarSign,
    color: 'text-green-400',
    bg: 'bg-green-500/10',
    border: 'border-green-500/30',
    label: 'Paid',
  },
};

const severityColors = {
  low: 'bg-blue-500/20 text-blue-400',
  medium: 'bg-yellow-500/20 text-yellow-400',
  high: 'bg-orange-500/20 text-orange-400',
  critical: 'bg-red-500/20 text-red-400',
};

export function BountyHistory({ reports, onValidate, isValidating }: BountyHistoryProps) {
  const totalEarned = reports
    .filter((r) => r.status === 'paid')
    .reduce((acc, r) => acc + r.bountyAmount, 0);

  const pendingCount = reports.filter((r) => r.status === 'pending').length;

  return (
    <Card className="p-6 bg-card border-border">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold">Bounty History</h2>
          <p className="text-sm text-muted-foreground">
            Your vulnerability submissions and rewards
          </p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-green-400">
            {octasToMove(totalEarned)} MOVE
          </div>
          <div className="text-xs text-muted-foreground">Total Earned</div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="p-3 rounded-lg bg-background/50 text-center">
          <div className="text-2xl font-bold">{reports.length}</div>
          <div className="text-xs text-muted-foreground">Submissions</div>
        </div>
        <div className="p-3 rounded-lg bg-background/50 text-center">
          <div className="text-2xl font-bold text-green-400">
            {reports.filter((r) => r.status === 'paid').length}
          </div>
          <div className="text-xs text-muted-foreground">Paid</div>
        </div>
        <div className="p-3 rounded-lg bg-background/50 text-center">
          <div className="text-2xl font-bold text-yellow-400">{pendingCount}</div>
          <div className="text-xs text-muted-foreground">Pending</div>
        </div>
      </div>

      {/* Reports List */}
      <div className="space-y-3">
        {reports.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No submissions yet. Submit your first vulnerability report!
          </div>
        ) : (
          reports.map((report, index) => (
            <motion.div
              key={report.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <ReportCard
                report={report}
                onValidate={onValidate}
                isValidating={isValidating === report.reporter}
              />
            </motion.div>
          ))
        )}
      </div>
    </Card>
  );
}

function ReportCard({
  report,
  onValidate,
  isValidating,
}: {
  report: VulnerabilityReport;
  onValidate?: (reporterAddress: string, payoutAddress: string) => Promise<void>;
  isValidating?: boolean;
}) {
  const status = statusConfig[report.status];
  const StatusIcon = status.icon;

  const handleValidate = async () => {
    if (onValidate && report.payoutAddress) {
      try {
        await onValidate(report.reporter, report.payoutAddress);
      } catch (error) {
        console.error('Validation failed:', error);
      }
    }
  };

  // Check if payout is possible (has payout address)
  const canPayout = report.status === 'pending' && report.payoutAddress;

  return (
    <div
      className={cn(
        'p-4 rounded-lg border transition-all',
        status.bg,
        status.border
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <StatusIcon className={cn('w-4 h-4', status.color)} />
            <h3 className="font-medium truncate">{report.title}</h3>
          </div>
          <p className="text-sm text-muted-foreground truncate">
            Protocol: {formatAddress(report.protocolAddress)}
          </p>
          <div className="flex items-center gap-2 mt-2">
            <Badge className={cn('text-xs', severityColors[report.severity])}>
              {report.severity.toUpperCase()}
            </Badge>
            <Badge variant="outline" className={cn('text-xs', status.color, status.border)}>
              {status.label}
            </Badge>
          </div>

          {/* Payout Address */}
          {report.payoutAddress && (
            <div className="mt-2 flex items-center gap-1 text-xs text-purple-400">
              <Wallet className="w-3 h-3" />
              <span>Payout: {formatAddress(report.payoutAddress)}</span>
            </div>
          )}

          {/* Transaction Links */}
          {report.txHash && (
            <div className="mt-2">
              <a
                href={`https://explorer.movementnetwork.xyz/txn/${report.txHash}?network=bardock+testnet`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-400 hover:underline flex items-center gap-1"
              >
                Submit TX <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          )}
          {report.submissionFeeTxHash && (
            <div className="mt-1">
              <a
                href={`https://explorer.movementnetwork.xyz/txn/${report.submissionFeeTxHash}?network=bardock+testnet`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-orange-400 hover:underline flex items-center gap-1"
              >
                Fee TX <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          )}
          {report.paymentTxHash && (
            <div className="mt-1">
              <a
                href={`https://explorer.movementnetwork.xyz/txn/${report.paymentTxHash}?network=bardock+testnet`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-green-400 hover:underline flex items-center gap-1"
              >
                Payment TX <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          )}
        </div>

        <div className="text-right flex flex-col items-end gap-2">
          <div className={cn('text-lg font-bold', status.color)}>
            {octasToMove(report.bountyAmount)} MOVE
          </div>
          <div className="text-xs text-muted-foreground">
            {new Date(report.submittedAt).toLocaleDateString()}
          </div>

          {/* Validate & Pay Button - Only show for pending reports with payout address */}
          {canPayout && onValidate && (
            <Button
              size="sm"
              onClick={handleValidate}
              disabled={isValidating}
              className="mt-2 bg-purple-600 hover:bg-purple-700 text-white"
            >
              {isValidating ? (
                <>
                  <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                  Paying...
                </>
              ) : (
                <>
                  <Zap className="w-3 h-3 mr-1" />
                  Validate & Pay
                </>
              )}
            </Button>
          )}
          {/* Show warning if no payout address */}
          {report.status === 'pending' && !report.payoutAddress && (
            <div className="mt-2 text-xs text-yellow-400">
              No payout address
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
