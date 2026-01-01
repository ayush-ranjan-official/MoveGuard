'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  X,
  Activity,
  AlertTriangle,
  Shield,
  Zap,
  RefreshCw,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { ProtectedProtocol, ThreatAssessment } from '@/lib/types';
import { formatAddress } from '@/lib/movement';

const ATTACK_TYPES = [
  {
    id: 'flash_loan',
    name: 'Flash Loan Attack',
    description: 'Uncollateralized loans exploiting price manipulation',
    icon: Zap,
    color: 'text-yellow-400',
    bg: 'bg-yellow-500/10',
  },
  {
    id: 'oracle',
    name: 'Oracle Manipulation',
    description: 'Price feed manipulation to exploit DeFi protocols',
    icon: RefreshCw,
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
  },
  {
    id: 'sandwich',
    name: 'Sandwich Attack',
    description: 'Front/back-running transactions for profit extraction',
    icon: AlertTriangle,
    color: 'text-orange-400',
    bg: 'bg-orange-500/10',
  },
  {
    id: 'reentrancy',
    name: 'Reentrancy Attack',
    description: 'Recursive calls to drain contract funds',
    icon: Shield,
    color: 'text-red-400',
    bg: 'bg-red-500/10',
  },
];

interface ThreatAnalysisModalProps {
  isOpen: boolean;
  onClose: () => void;
  protocols: ProtectedProtocol[];
  onAnalyze: (attackType: string, protocolAddress: string) => Promise<ThreatAssessment | null>;
  onPause: (protocolAddress: string) => void;
  isAnalyzing: boolean;
}

export function ThreatAnalysisModal({
  isOpen,
  onClose,
  protocols,
  onAnalyze,
  onPause: _onPause,
  isAnalyzing,
}: ThreatAnalysisModalProps) {
  const [selectedProtocol, setSelectedProtocol] = useState<string>(
    protocols[0]?.contractAddress || ''
  );
  const [selectedAttack, setSelectedAttack] = useState<string>('flash_loan');
  const [result, setResult] = useState<ThreatAssessment | null>(null);
  const [autoPaused, setAutoPaused] = useState(false);

  const handleAnalyze = async () => {
    if (!selectedProtocol || !selectedAttack) return;

    setResult(null);
    setAutoPaused(false);

    const assessment = await onAnalyze(selectedAttack, selectedProtocol);
    setResult(assessment);

    // Check if API already triggered auto-pause (assessment includes autoPauseTriggered)
    const apiAutoPaused = (assessment as ThreatAssessment & { autoPauseTriggered?: boolean })?.autoPauseTriggered;

    if (apiAutoPaused) {
      // API already paused on-chain, just update local state
      console.log('Auto-pause already triggered by API');
      setAutoPaused(true);
    } else if (assessment && assessment.threatLevel >= 75) {
      // High threat but API didn't pause (maybe protocol was already paused)
      const protocol = protocols.find(p => p.contractAddress === selectedProtocol);
      if (protocol?.isPaused) {
        // Already paused
        setAutoPaused(true);
      }
    }
  };

  const handleClose = () => {
    setResult(null);
    setAutoPaused(false);
    onClose();
  };

  if (!isOpen) return null;

  const selectedProtocolData = protocols.find(
    (p) => p.contractAddress === selectedProtocol
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-card border border-border rounded-lg p-6 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Shield className="w-6 h-6 text-purple-500" />
            Threat Analysis
          </h2>
          <button
            onClick={handleClose}
            className="text-muted-foreground hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Protocol Selection */}
        <div className="mb-6">
          <label className="block text-sm font-medium mb-2">
            Select Protocol to Analyze
          </label>
          {protocols.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No protocols registered. Register a protocol first.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-2">
              {protocols.map((protocol) => (
                <button
                  key={protocol.contractAddress}
                  onClick={() => setSelectedProtocol(protocol.contractAddress)}
                  className={cn(
                    'p-3 rounded-lg border text-left transition-all',
                    selectedProtocol === protocol.contractAddress
                      ? 'border-purple-500 bg-purple-500/10'
                      : 'border-border bg-background/50 hover:border-purple-500/50'
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{protocol.name}</p>
                      <p className="text-xs font-mono text-muted-foreground">
                        {formatAddress(protocol.contractAddress)}
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className={cn(
                        protocol.isPaused
                          ? 'border-purple-500/50 text-purple-400'
                          : 'border-green-500/50 text-green-400'
                      )}
                    >
                      {protocol.isPaused ? 'PAUSED' : 'ACTIVE'}
                    </Badge>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Attack Type Selection */}
        <div className="mb-6">
          <label className="block text-sm font-medium mb-2">
            Select Attack Type to Simulate
          </label>
          <div className="grid grid-cols-2 gap-3">
            {ATTACK_TYPES.map((attack) => {
              const Icon = attack.icon;
              return (
                <button
                  key={attack.id}
                  onClick={() => setSelectedAttack(attack.id)}
                  className={cn(
                    'p-4 rounded-lg border text-left transition-all',
                    selectedAttack === attack.id
                      ? 'border-purple-500 bg-purple-500/10'
                      : 'border-border bg-background/50 hover:border-purple-500/50'
                  )}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <div className={cn('p-1.5 rounded', attack.bg)}>
                      <Icon className={cn('w-4 h-4', attack.color)} />
                    </div>
                    <span className="font-medium text-sm">{attack.name}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {attack.description}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Analyze Button */}
        <div className="mb-6">
          <Button
            onClick={handleAnalyze}
            disabled={isAnalyzing || !selectedProtocol || protocols.length === 0}
            className="w-full gap-2 bg-purple-600 hover:bg-purple-700"
          >
            {isAnalyzing ? (
              <>
                <Activity className="w-4 h-4 animate-spin" />
                Analyzing with ATXP AI...
              </>
            ) : (
              <>
                <Zap className="w-4 h-4" />
                Run AI Threat Analysis
              </>
            )}
          </Button>
          <p className="text-xs text-center text-muted-foreground mt-2">
            Powered by ATXP AI - Real-time threat detection
          </p>
        </div>

        {/* Results */}
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card
              className={cn(
                'p-4 border',
                result.threatLevel >= 75
                  ? 'bg-red-500/10 border-red-500/30'
                  : result.threatLevel >= 50
                  ? 'bg-yellow-500/10 border-yellow-500/30'
                  : 'bg-green-500/10 border-green-500/30'
              )}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold flex items-center gap-2">
                  <AlertTriangle
                    className={cn(
                      'w-5 h-5',
                      result.threatLevel >= 75
                        ? 'text-red-400'
                        : result.threatLevel >= 50
                        ? 'text-yellow-400'
                        : 'text-green-400'
                    )}
                  />
                  AI Analysis Result
                  <Badge className="bg-purple-500/20 text-purple-400 text-[10px]">
                    ATXP AI
                  </Badge>
                </h3>
                <div
                  className={cn(
                    'text-2xl font-bold',
                    result.threatLevel >= 75
                      ? 'text-red-400'
                      : result.threatLevel >= 50
                      ? 'text-yellow-400'
                      : 'text-green-400'
                  )}
                >
                  {result.threatLevel}%
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">
                    Attack Type
                  </p>
                  <Badge variant="outline">{result.attackType}</Badge>
                </div>

                <div>
                  <p className="text-xs text-muted-foreground mb-1">
                    Recommendation
                  </p>
                  <p className="text-sm">{result.recommendation}</p>
                </div>

                {result.indicators && result.indicators.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">
                      Threat Indicators
                    </p>
                    <ul className="text-sm space-y-1">
                      {result.indicators.map((indicator, i) => (
                        <li key={i} className="flex items-start gap-1">
                          <span className="text-muted-foreground">•</span>
                          <span>{indicator}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="flex items-center gap-4 text-xs text-muted-foreground pt-2 border-t border-current/20">
                  <span>Confidence: {result.confidence}%</span>
                  {result.threatLevel >= 75 && (
                    <span className="text-red-400">Auto-pause recommended</span>
                  )}
                </div>
              </div>

              {/* Auto-pause notification */}
              {autoPaused && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="mt-4 p-3 rounded-lg bg-purple-500/20 border border-purple-500/30"
                >
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-purple-400" />
                    <span className="text-sm text-purple-300">
                      Protocol &quot;{selectedProtocolData?.name}&quot; has been
                      automatically paused due to critical threat level.
                    </span>
                  </div>
                </motion.div>
              )}
            </Card>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
