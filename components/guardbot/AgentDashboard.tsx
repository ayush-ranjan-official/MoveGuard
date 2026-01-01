'use client';

import { motion } from 'framer-motion';
import { Bot, Shield, Zap, DollarSign, ExternalLink } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AgentWalletCard } from './AgentWalletCard';
import { ActivityLog } from './ActivityLog';
import { MonitoringPanel } from './MonitoringPanel';
import { AgentControls } from './AgentControls';
import { PendingBounties } from './PendingBounties';
import { useGuardBot } from '@/hooks/useGuardBot';
import { cn } from '@/lib/utils';

export function AgentDashboard() {
  const {
    status,
    wallet,
    activities,
    stats,
    isAutoMode,
    agentState,
    pendingBounties,
    initializeAgent,
    monitorProtocol,
    claimBounty,
    startAgent,
    stopAgent,
    toggleAutoMode,
    clearActivities,
    resetAgent,
  } = useGuardBot();

  const isCreating = status === 'initializing';

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-8"
      >
        <div className="inline-flex items-center gap-3 mb-4">
          <div className="relative">
            <div className="p-4 rounded-2xl bg-gradient-to-br from-purple-500/20 to-blue-500/20 border border-purple-500/30">
              <Bot className="w-10 h-10 text-purple-400" />
            </div>
            <motion.div
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ repeat: Infinity, duration: 2 }}
              className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-green-500 border-2 border-background"
            />
          </div>
        </div>
        <h1 className="text-3xl font-bold mb-2">
          Guard<span className="text-purple-400">Bot</span> Agent
        </h1>
        <p className="text-muted-foreground max-w-xl mx-auto">
          Autonomous AI security agent that monitors DeFi protocols,
          pays for threat analysis via x402, and earns bounties automatically.
        </p>

        {/* Feature Badges */}
        <div className="flex flex-wrap justify-center gap-2 mt-4">
          <FeatureBadge icon={Shield} label="AI-Powered Security" />
          <FeatureBadge icon={Zap} label="x402 Micropayments" />
          <FeatureBadge icon={DollarSign} label="Auto Bounty Earning" />
        </div>
      </motion.div>

      {/* Stats Overview */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
      >
        <StatsOverview stats={stats} />
      </motion.div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column */}
        <div className="space-y-6">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
          >
            <AgentWalletCard
              wallet={wallet}
              status={status}
              onCreateWallet={initializeAgent}
              isCreating={isCreating}
            />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
          >
            <AgentControls
              agentState={agentState}
              status={status}
              isAutoMode={isAutoMode}
              onStartAgent={startAgent}
              onStopAgent={stopAgent}
              onToggleAutoMode={toggleAutoMode}
              onReset={resetAgent}
            />
          </motion.div>

          {pendingBounties.length > 0 && (
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.35 }}
            >
              <PendingBounties
                bounties={pendingBounties}
                onClaim={claimBounty}
              />
            </motion.div>
          )}
        </div>

        {/* Center Column - Activity Log */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="lg:col-span-1"
        >
          <ActivityLog
            activities={activities}
            onClear={clearActivities}
            maxHeight="500px"
          />
        </motion.div>

        {/* Right Column */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.5 }}
        >
          <MonitoringPanel
            stats={stats}
            status={status}
            onMonitor={monitorProtocol}
          />
        </motion.div>
      </div>

      {/* Bottom Info */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
      >
        <Card className="p-6 bg-gradient-to-r from-purple-900/20 via-card to-blue-900/20 border-purple-500/20">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div>
              <h3 className="font-bold text-lg mb-1">How GuardBot Works</h3>
              <p className="text-sm text-muted-foreground max-w-xl">
                GuardBot autonomously monitors DeFi protocols, pays for AI-powered threat analysis
                via x402 micropayments, and earns bounties by reporting vulnerabilities.
                All transactions are on-chain and verifiable.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <a
                href="https://explorer.movementnetwork.xyz?network=bardock+testnet"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-sm transition-colors"
              >
                View on Explorer
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          </div>
        </Card>
      </motion.div>
    </div>
  );
}

function FeatureBadge({ icon: Icon, label }: { icon: typeof Shield; label: string }) {
  return (
    <Badge className="bg-purple-500/10 text-purple-300 border-purple-500/30 gap-1">
      <Icon className="w-3 h-3" />
      {label}
    </Badge>
  );
}

function StatsOverview({ stats }: { stats: ReturnType<typeof useGuardBot>['stats'] }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <StatBox
        label="Total Spent"
        value={`${stats.totalPaymentsMove} MOVE`}
        subtext="x402 payments"
        color="orange"
      />
      <StatBox
        label="Pending Earnings"
        value={`${stats.totalEarningsMove} MOVE`}
        subtext="From bounties"
        color="green"
      />
      <StatBox
        label="Threats Found"
        value={stats.threatsDetected}
        subtext="Vulnerabilities"
        color="red"
      />
      <StatBox
        label="Reports Sent"
        value={stats.reportsSubmitted}
        subtext="Auto-submitted"
        color="purple"
      />
    </div>
  );
}

function StatBox({
  label,
  value,
  subtext,
  color,
}: {
  label: string;
  value: string | number;
  subtext: string;
  color: 'orange' | 'green' | 'red' | 'purple';
}) {
  const colors = {
    orange: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
    green: 'text-green-400 bg-green-500/10 border-green-500/20',
    red: 'text-red-400 bg-red-500/10 border-red-500/20',
    purple: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
  };

  return (
    <Card className={cn('p-4 border', colors[color].split(' ').slice(1).join(' '))}>
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className={cn('text-2xl font-bold', colors[color].split(' ')[0])}>
        {value}
      </p>
      <p className="text-xs text-muted-foreground">{subtext}</p>
    </Card>
  );
}
