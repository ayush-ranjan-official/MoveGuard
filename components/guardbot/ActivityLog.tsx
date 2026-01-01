'use client';

import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  DollarSign,
  Search,
  AlertTriangle,
  FileWarning,
  Gift,
  XCircle,
  Info,
  Wallet,
  ExternalLink,
  Trash2,
  WifiOff,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { ActivityLogEntry, ActivityType, ActivitySeverity } from '@/lib/guardbot/types';
import { X402_CONFIG } from '@/lib/x402';

interface ActivityLogProps {
  activities: ActivityLogEntry[];
  onClear?: () => void;
  maxHeight?: string;
}

const typeIcons: Record<ActivityType, typeof DollarSign> = {
  payment: DollarSign,
  analysis: Search,
  threat: AlertTriangle,
  report: FileWarning,
  bounty: Gift,
  error: XCircle,
  info: Info,
  wallet: Wallet,
  warning: WifiOff,
};

const severityColors: Record<ActivitySeverity, string> = {
  info: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
  warning: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30',
  success: 'text-green-400 bg-green-500/10 border-green-500/30',
  error: 'text-red-400 bg-red-500/10 border-red-500/30',
};

const typeColors: Record<ActivityType, string> = {
  payment: 'text-green-400',
  analysis: 'text-blue-400',
  threat: 'text-red-400',
  report: 'text-orange-400',
  bounty: 'text-purple-400',
  error: 'text-red-400',
  info: 'text-gray-400',
  wallet: 'text-purple-400',
  warning: 'text-yellow-400',
};

export function ActivityLog({ activities, onClear, maxHeight = '400px' }: ActivityLogProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to top when new activities added
  useEffect(() => {
    if (scrollRef.current && activities.length > 0) {
      scrollRef.current.scrollTop = 0;
    }
  }, [activities.length]);

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  };

  const getExplorerUrl = (txHash: string) => {
    return `${X402_CONFIG.explorerUrl}/txn/${txHash}?network=${X402_CONFIG.explorerNetwork}`;
  };

  return (
    <Card className="p-4 bg-card border-border">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-bold flex items-center gap-2">
            Live Activity Feed
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
            </span>
          </h3>
          <p className="text-xs text-muted-foreground">
            Real-time agent activity stream
          </p>
        </div>
        {onClear && activities.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClear}
            className="text-muted-foreground hover:text-foreground gap-1"
          >
            <Trash2 className="w-3 h-3" />
            Clear
          </Button>
        )}
      </div>

      {/* Activity List */}
      <div
        ref={scrollRef}
        className="space-y-2 overflow-y-auto pr-2"
        style={{ maxHeight }}
      >
        <AnimatePresence mode="popLayout" initial={false}>
          {activities.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-8 text-muted-foreground"
            >
              <Info className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No activity yet</p>
              <p className="text-xs">Start monitoring to see agent activity</p>
            </motion.div>
          ) : (
            activities.map((activity, index) => (
              <ActivityItem
                key={activity.id}
                activity={activity}
                index={index}
                formatTime={formatTime}
                getExplorerUrl={getExplorerUrl}
              />
            ))
          )}
        </AnimatePresence>
      </div>

      {/* Footer Stats */}
      {activities.length > 0 && (
        <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
          <span>{activities.length} events</span>
          <span>
            {activities.filter(a => a.type === 'payment').length} payments |{' '}
            {activities.filter(a => a.type === 'threat').length} threats |{' '}
            {activities.filter(a => a.type === 'report').length} reports
          </span>
        </div>
      )}
    </Card>
  );
}

function ActivityItem({
  activity,
  index,
  formatTime,
  getExplorerUrl,
}: {
  activity: ActivityLogEntry;
  index: number;
  formatTime: (timestamp: number) => string;
  getExplorerUrl: (txHash: string) => string;
}) {
  const Icon = typeIcons[activity.type];
  const severityClass = severityColors[activity.severity];
  const typeColor = typeColors[activity.type];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -20, scale: 0.95 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 20, scale: 0.95 }}
      transition={{ duration: 0.2, delay: index * 0.02 }}
      className={cn(
        'p-3 rounded-lg border transition-colors',
        severityClass
      )}
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className={cn('p-1.5 rounded-lg bg-background/50', typeColor)}>
          <Icon className="w-3.5 h-3.5" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{activity.message}</p>

          {/* Meta info */}
          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
            <span>{formatTime(activity.timestamp)}</span>

            {activity.amountMove && (
              <span className="text-green-400 font-medium">
                {activity.amountMove} MOVE
              </span>
            )}

            {activity.threatLevel !== undefined && (
              <span className={cn(
                'font-medium',
                activity.threatLevel >= 70 ? 'text-red-400' :
                activity.threatLevel >= 50 ? 'text-yellow-400' : 'text-green-400'
              )}>
                {activity.threatLevel}% threat
              </span>
            )}

            {activity.txHash && (
              <a
                href={getExplorerUrl(activity.txHash)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-blue-400 hover:underline"
              >
                View TX <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
