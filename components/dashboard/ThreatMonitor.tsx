'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle,
  Shield,
  Activity,
  Zap,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { ThreatAssessment, ThreatStatus } from '@/lib/types';
import { THREAT_THRESHOLDS } from '@/lib/constants';

interface ThreatData {
  protocolName: string;
  protocolAddress: string;
  threatLevel: number;
  lastCheck: Date;
  status: ThreatStatus;
  indicators: string[];
}

interface ThreatMonitorProps {
  threats?: ThreatData[];
  isScanning?: boolean;
  latestAssessment?: ThreatAssessment | null;
}

function getStatusFromThreatLevel(level: number): ThreatStatus {
  if (level >= THREAT_THRESHOLDS.critical) return 'critical';
  if (level >= THREAT_THRESHOLDS.warning) return 'warning';
  return 'safe';
}

const statusConfig = {
  safe: {
    bg: 'bg-green-500/10',
    border: 'border-green-500/30',
    text: 'text-green-400',
    icon: CheckCircle,
    label: 'SAFE',
  },
  warning: {
    bg: 'bg-yellow-500/10',
    border: 'border-yellow-500/30',
    text: 'text-yellow-400',
    icon: AlertTriangle,
    label: 'WARNING',
  },
  critical: {
    bg: 'bg-red-500/10',
    border: 'border-red-500/30',
    text: 'text-red-400',
    icon: XCircle,
    label: 'CRITICAL',
  },
  paused: {
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/30',
    text: 'text-purple-400',
    icon: Shield,
    label: 'PAUSED',
  },
};

export function ThreatMonitor({
  threats: initialThreats,
  isScanning = true,
  latestAssessment,
}: ThreatMonitorProps) {
  // Initialize with passed threats or empty array - no hardcoded protocols
  const [threats, setThreats] = useState<ThreatData[]>(() => {
    return initialThreats || [];
  });

  // Sync threats when initialThreats prop changes (from parent)
  useEffect(() => {
    if (initialThreats && initialThreats.length > 0) {
      setThreats(initialThreats.map(t => ({
        ...t,
        lastCheck: t.lastCheck || new Date(),
      })));
    } else {
      setThreats([]);
    }
  }, [initialThreats]);

  // Update threats when assessment changes
  useEffect(() => {
    if (latestAssessment && latestAssessment.threatLevel > 50 && threats.length > 0) {
      setThreats((prev) =>
        prev.map((t, i) =>
          i === 0
            ? {
                ...t,
                threatLevel: latestAssessment.threatLevel,
                status: getStatusFromThreatLevel(latestAssessment.threatLevel),
                indicators: latestAssessment.indicators,
                lastCheck: new Date(),
              }
            : t
        )
      );
    }
  }, [latestAssessment, threats.length]);

  // Update lastCheck timestamps periodically (no fake random data)
  useEffect(() => {
    if (!isScanning || threats.length === 0) return;

    const interval = setInterval(() => {
      setThreats((prev) =>
        prev.map((threat) => ({
          ...threat,
          lastCheck: new Date(),
        }))
      );
    }, 5000);

    return () => clearInterval(interval);
  }, [isScanning, threats.length]);

  return (
    <Card className="p-6 bg-card border-border">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Shield className="w-6 h-6 text-purple-500" />
          Threat Monitor
        </h2>
        <div className="flex items-center gap-2">
          <Activity
            className={cn(
              'w-4 h-4',
              isScanning ? 'text-green-500 animate-pulse' : 'text-gray-500'
            )}
          />
          <span className="text-sm text-muted-foreground">
            {isScanning ? 'Scanning...' : 'Paused'}
          </span>
        </div>
      </div>

      <div className="space-y-4">
        {threats.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Shield className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>No protocols registered yet</p>
            <p className="text-sm mt-1">Register a protocol to start monitoring</p>
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {threats.map((threat) => (
              <ThreatCard key={threat.protocolAddress} threat={threat} />
            ))}
          </AnimatePresence>
        )}
      </div>

      {latestAssessment && latestAssessment.threatLevel > 50 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-6 p-4 rounded-lg bg-red-500/10 border border-red-500/30"
        >
          <div className="flex items-start gap-3">
            <Zap className="w-5 h-5 text-red-400 mt-0.5" />
            <div>
              <h4 className="font-semibold text-red-400">
                AI Analysis: {latestAssessment.attackType}
              </h4>
              <p className="text-sm text-red-300/80 mt-1">
                {latestAssessment.recommendation}
              </p>
              <div className="mt-2 text-xs text-red-400/60">
                Confidence: {latestAssessment.confidence}%
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </Card>
  );
}

function ThreatCard({ threat }: { threat: ThreatData }) {
  const config = statusConfig[threat.status];
  const Icon = config.icon;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className={cn(
        'p-4 rounded-lg border transition-all duration-300',
        config.bg,
        config.border,
        threat.status === 'critical' && 'animate-pulse'
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Icon className={cn('w-5 h-5', config.text)} />
          <div>
            <h3 className={cn('font-semibold', config.text)}>
              {threat.protocolName}
            </h3>
            <p className="text-sm opacity-70 font-mono">
              {threat.protocolAddress}
            </p>
          </div>
        </div>
        <div className="text-right">
          <div className={cn('text-2xl font-bold', config.text)}>
            {threat.threatLevel}%
          </div>
          <Badge
            variant="outline"
            className={cn('text-xs uppercase', config.text, config.border)}
          >
            {config.label}
          </Badge>
        </div>
      </div>

      {threat.indicators.length > 0 && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="mt-3 pt-3 border-t border-current/20"
        >
          <div className="flex items-center gap-1 text-xs mb-2">
            <AlertTriangle className="w-3 h-3" />
            Threat Indicators:
          </div>
          <ul className="text-xs space-y-1 opacity-80">
            {threat.indicators.slice(0, 4).map((indicator, i) => (
              <li key={i} className="flex items-start gap-1">
                <span className="text-current">•</span>
                <span>{indicator}</span>
              </li>
            ))}
          </ul>
        </motion.div>
      )}

      <div className="mt-2 text-xs opacity-50" suppressHydrationWarning>
        Last check: {threat.lastCheck ? threat.lastCheck.toLocaleTimeString() : '--:--:--'}
      </div>
    </motion.div>
  );
}
