'use client';

import { motion } from 'framer-motion';
import { Play, Square, RotateCcw, Zap, Settings } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { AgentState, AgentStatus } from '@/lib/guardbot/types';

interface AgentControlsProps {
  agentState: AgentState;
  status: AgentStatus;
  isAutoMode: boolean;
  onStartAgent: () => Promise<void>;
  onStopAgent: () => void;
  onToggleAutoMode: () => void;
  onReset: () => void;
}

export function AgentControls({
  agentState,
  status,
  isAutoMode,
  onStartAgent,
  onStopAgent,
  onToggleAutoMode,
  onReset,
}: AgentControlsProps) {
  const isRunning = agentState.isRunning;
  const isActive = ['monitoring', 'analyzing', 'reporting', 'initializing'].includes(status);

  const stepLabels = [
    'Ready to start',
    'Creating wallet...',
    'Monitoring protocol...',
    'Running analysis...',
    'Detecting threats...',
    'Monitoring complete!',
  ];

  return (
    <Card className="p-4 bg-card border-border">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-bold">Agent Controls</h3>
          <p className="text-xs text-muted-foreground">
            Control autonomous security monitoring
          </p>
        </div>
        <Badge
          className={cn(
            isRunning
              ? 'bg-green-500/20 text-green-400'
              : 'bg-gray-500/20 text-gray-400'
          )}
        >
          {isRunning ? 'Running' : 'Ready'}
        </Badge>
      </div>

      {/* Progress */}
      {(isRunning || agentState.completedAt) && (
        <div className="mb-4">
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="text-muted-foreground">
              Step {agentState.currentStep}/{agentState.totalSteps}
            </span>
            <span className={cn(
              agentState.completedAt ? 'text-green-400' : 'text-muted-foreground'
            )}>
              {stepLabels[agentState.currentStep]}
            </span>
          </div>
          <div className="w-full h-2 bg-background rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-purple-500 to-blue-500"
              initial={{ width: 0 }}
              animate={{
                width: `${(agentState.currentStep / agentState.totalSteps) * 100}%`,
              }}
              transition={{ duration: 0.5 }}
            />
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center gap-2">
        {!isRunning ? (
          <Button
            onClick={onStartAgent}
            disabled={isActive}
            className="flex-1 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 gap-2"
          >
            <Play className="w-4 h-4" />
            Start Monitoring
          </Button>
        ) : (
          <Button
            onClick={onStopAgent}
            variant="destructive"
            className="flex-1 gap-2"
          >
            <Square className="w-4 h-4" />
            Stop Agent
          </Button>
        )}

        <Button
          variant="outline"
          size="icon"
          onClick={onReset}
          disabled={isRunning}
          title="Reset Agent"
        >
          <RotateCcw className="w-4 h-4" />
        </Button>
      </div>

      {/* Auto Mode Toggle */}
      <div className="mt-4 pt-4 border-t border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm">Auto-Report Mode</span>
          </div>
          <button
            onClick={onToggleAutoMode}
            className={cn(
              'relative w-11 h-6 rounded-full transition-colors',
              isAutoMode ? 'bg-purple-600' : 'bg-muted'
            )}
          >
            <motion.div
              className="absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm"
              animate={{ left: isAutoMode ? 'calc(100% - 20px)' : '4px' }}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            />
          </button>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Automatically submit reports when threats are detected
        </p>
      </div>

      {/* Info */}
      <div className="mt-4 p-3 rounded-lg bg-purple-500/10 border border-purple-500/20">
        <div className="flex items-start gap-2">
          <Zap className="w-4 h-4 text-purple-400 mt-0.5" />
          <div className="text-xs text-purple-300">
            <p className="font-medium mb-1">GuardBot capabilities:</p>
            <ul className="space-y-0.5 text-purple-300/70">
              <li>Wallet creation via Privy</li>
              <li>x402 payments for analysis</li>
              <li>AI threat detection</li>
              <li>Auto vulnerability reporting</li>
              <li>Bounty earning potential</li>
            </ul>
          </div>
        </div>
      </div>
    </Card>
  );
}
