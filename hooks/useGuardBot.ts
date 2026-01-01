'use client';

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useActivityLog } from './useActivityLog';
import { getBountyProtocols } from '@/lib/protocol-registry';
import type {
  AgentStatus,
  AgentWallet,
  MonitoringSession,
  GuardBotStats,
  ActivityLogEntry,
  MonitorResponse,
  ReportResponse,
  AgentState,
} from '@/lib/guardbot/types';
import { THREAT_THRESHOLDS } from '@/lib/guardbot/types';

interface PendingBounty {
  reportId: number;
  amount: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  submittedAt: number;
}

interface UseGuardBotReturn {
  // State
  status: AgentStatus;
  wallet: AgentWallet | null;
  sessions: MonitoringSession[];
  activities: ActivityLogEntry[];
  stats: GuardBotStats;
  isAutoMode: boolean;
  isAgentActive: boolean;
  agentState: AgentState;
  pendingBounties: PendingBounty[];

  // Actions
  initializeAgent: () => Promise<void>;
  monitorProtocol: (protocolAddress: string, protocolName?: string) => Promise<MonitorResponse | null>;
  claimBounty: (reportId: number, severity?: 'low' | 'medium' | 'high' | 'critical') => Promise<boolean>;
  startAgent: () => Promise<void>;
  stopAgent: () => void;
  toggleAutoMode: () => void;
  clearActivities: () => void;
  resetAgent: () => void;
}

const initialStats: GuardBotStats = {
  totalPayments: 0,
  totalPaymentsMove: '0',
  totalEarnings: 0,
  totalEarningsMove: '0',
  protocolsMonitored: 0,
  threatsDetected: 0,
  reportsSubmitted: 0,
  successfulBounties: 0,
};

const initialAgentState: AgentState = {
  isRunning: false,
  currentStep: 0,
  totalSteps: 5,
  startedAt: null,
  completedAt: null,
};

// Fallback test protocols for when no bounty protocols are registered
const FALLBACK_PROTOCOLS = [
  { address: '0x1234deadbeef5678000000000000000000000000000000000000000000000001', name: 'VulnerableSwap DEX' },
  { address: '0xabcd1234abcd5678000000000000000000000000000000000000000000000002', name: 'TestLend Protocol' },
  { address: '0x9876bad543210000000000000000000000000000000000000000000000000003', name: 'RiskyVault Finance' },
];

export function useGuardBot(): UseGuardBotReturn {
  // Load bounty protocols from registry, falling back to test protocols
  const monitoredProtocols = useMemo(() => {
    const bountyProtocols = getBountyProtocols();
    if (bountyProtocols.length > 0) {
      return bountyProtocols.map(p => ({
        address: p.contractAddress,
        name: p.name,
      }));
    }
    return FALLBACK_PROTOCOLS;
  }, []);
  const [status, setStatus] = useState<AgentStatus>('idle');
  const [wallet, setWallet] = useState<AgentWallet | null>(null);
  const [sessions, setSessions] = useState<MonitoringSession[]>([]);
  const [stats, setStats] = useState<GuardBotStats>(initialStats);
  const [isAutoMode, setIsAutoMode] = useState(false);
  const [isAgentActive, setIsAgentActive] = useState(false);
  const [agentState, setAgentState] = useState<AgentState>(initialAgentState);
  const [pendingBounties, setPendingBounties] = useState<PendingBounty[]>([]);
  const nextReportId = useRef(1);

  const { activities, addActivity, clearActivities: clearActivityLog } = useActivityLog();
  const agentRunning = useRef(false);
  const isAgentActiveRef = useRef(false); // Ref to avoid stale closure

  // Initialize agent wallet
  const initializeAgent = useCallback(async () => {
    setStatus('initializing');

    try {
      const response = await fetch('/api/guardbot/wallet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create' }),
      });

      const data = await response.json();

      if (data.success && data.wallet) {
        setWallet(data.wallet);

        // Add wallet activities
        if (data.activities) {
          data.activities.forEach((a: ActivityLogEntry) => addActivity(a));
        }

        setStatus('idle');
      } else {
        addActivity({
          type: 'error',
          message: data.error || 'Failed to initialize agent',
          severity: 'error',
        });
        setStatus('error');
      }
    } catch (error) {
      addActivity({
        type: 'error',
        message: error instanceof Error ? error.message : 'Initialization failed',
        severity: 'error',
      });
      setStatus('error');
    }
  }, [addActivity]);

  // Monitor a protocol
  const monitorProtocol = useCallback(async (
    protocolAddress: string,
    protocolName?: string
  ): Promise<MonitorResponse | null> => {
    setStatus('monitoring');

    addActivity({
      type: 'info',
      message: `Starting analysis of ${protocolName || protocolAddress.slice(0, 10)}...`,
      severity: 'info',
      protocolAddress,
    });

    try {
      // Call monitor API
      setStatus('analyzing');
      const response = await fetch('/api/guardbot/monitor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ protocolAddress, protocolName }),
      });

      const data: MonitorResponse = await response.json();

      // Add all activities from response
      if (data.activities) {
        data.activities.forEach((a: ActivityLogEntry) => addActivity(a));
      }

      if (data.success && data.analysis) {
        // Update stats
        setStats(prev => ({
          ...prev,
          totalPayments: prev.totalPayments + parseFloat(data.payment?.amount || '0'),
          totalPaymentsMove: (parseFloat(prev.totalPaymentsMove) + parseFloat(data.payment?.amount || '0')).toFixed(4),
          protocolsMonitored: prev.protocolsMonitored + 1,
          threatsDetected: prev.threatsDetected + (data.analysis!.threatLevel >= THREAT_THRESHOLDS.critical ? 1 : 0),
        }));

        // If threat level is high, auto-submit report if in auto mode
        if (data.analysis.threatLevel >= THREAT_THRESHOLDS.report && data.analysis.attackType) {
          if (isAutoMode || isAgentActiveRef.current) {
            setStatus('reporting');
            await submitAutoReport(protocolAddress, protocolName || 'Unknown', data.analysis);
          }
        }

        setStatus('idle');
        return data;
      } else {
        setStatus('error');
        return null;
      }
    } catch (error) {
      addActivity({
        type: 'error',
        message: error instanceof Error ? error.message : 'Monitoring failed',
        severity: 'error',
      });
      setStatus('error');
      return null;
    }
  }, [addActivity, isAutoMode, isAgentActive]);

  // Auto-submit vulnerability report
  const submitAutoReport = async (
    protocolAddress: string,
    protocolName: string,
    analysis: NonNullable<MonitorResponse['analysis']>
  ) => {
    try {
      const response = await fetch('/api/guardbot/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          protocolAddress,
          protocolName,
          threatLevel: analysis.threatLevel,
          attackType: analysis.attackType,
          confidence: analysis.confidence,
          indicators: analysis.indicators,
          recommendation: analysis.recommendation,
        }),
      });

      const data: ReportResponse = await response.json();

      // Add all activities from response
      if (data.activities) {
        data.activities.forEach((a: ActivityLogEntry) => addActivity(a));
      }

      if (data.success && data.pendingBounty) {
        // Use actual on-chain report ID from API response
        const reportId = data.reportId || nextReportId.current++;
        const severity = data.pendingBounty.severity as 'low' | 'medium' | 'high' | 'critical';

        console.log(`useGuardBot: Pending bounty for on-chain report #${reportId}`);

        // Add to pending bounties with actual on-chain report ID
        setPendingBounties(prev => [...prev, {
          reportId,
          amount: data.pendingBounty!.amount,
          severity,
          submittedAt: Date.now(),
        }]);

        setStats(prev => ({
          ...prev,
          totalPayments: prev.totalPayments + 0.01, // submission fee
          totalPaymentsMove: (parseFloat(prev.totalPaymentsMove) + 0.01).toFixed(4),
          reportsSubmitted: prev.reportsSubmitted + 1,
        }));
      }
    } catch (error) {
      addActivity({
        type: 'error',
        message: error instanceof Error ? error.message : 'Report submission failed',
        severity: 'error',
      });
    }
  };

  // Refresh wallet balance
  const refreshWalletBalance = useCallback(async () => {
    if (!wallet) return;

    try {
      const response = await fetch('/api/guardbot/wallet');
      const data = await response.json();

      if (data.success && data.wallet) {
        setWallet(data.wallet);
      }
    } catch (error) {
      console.error('Failed to refresh wallet:', error);
    }
  }, [wallet]);

  // Claim a pending bounty
  const claimBounty = useCallback(async (
    reportId: number,
    severity: 'low' | 'medium' | 'high' | 'critical' = 'high'
  ): Promise<boolean> => {
    try {
      addActivity({
        type: 'info',
        message: `Claiming bounty for report #${reportId}...`,
        severity: 'info',
      });

      const response = await fetch('/api/guardbot/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportId, severity }),
      });

      const data = await response.json();

      // Add activities from response
      if (data.activities) {
        data.activities.forEach((a: ActivityLogEntry) => addActivity(a));
      }

      if (data.success) {
        const bountyAmount = parseFloat(data.bountyPaid || '0');

        // Remove from pending bounties
        setPendingBounties(prev => prev.filter(b => b.reportId !== reportId));

        // Update stats with earnings
        setStats(prev => ({
          ...prev,
          totalEarnings: prev.totalEarnings + bountyAmount,
          totalEarningsMove: (parseFloat(prev.totalEarningsMove) + bountyAmount).toFixed(2),
          successfulBounties: prev.successfulBounties + 1,
        }));

        // Update wallet balance locally (add bounty to current balance)
        setWallet(prev => {
          if (!prev) return prev;
          const newBalance = prev.balance + (bountyAmount * 100000000); // Convert MOVE to octas
          const newBalanceMove = (newBalance / 100000000).toFixed(8);

          // Add activity showing balance increase
          addActivity({
            type: 'wallet',
            message: `Wallet balance increased by ${bountyAmount} MOVE → ${newBalanceMove} MOVE`,
            severity: 'success',
          });

          return {
            ...prev,
            balance: newBalance,
            balanceMove: newBalanceMove,
            lastUpdated: Date.now(),
          };
        });

        // Also refresh from server (will show real balance when network is online)
        refreshWalletBalance();

        return true;
      }

      // Check for permanent failures - remove these from pending bounties
      const errorMsg = data.error || '';
      if (errorMsg.includes('E_ALREADY_CLAIMED') ||
          errorMsg.includes('E_REPORT_NOT_FOUND') ||
          errorMsg.includes('STATUS_PAID')) {
        // Report already claimed or doesn't exist - remove from pending
        console.log(`Removing report #${reportId} from pending - already claimed or not found`);
        setPendingBounties(prev => prev.filter(b => b.reportId !== reportId));
      } else if (errorMsg.includes('E_INSUFFICIENT_VAULT_BALANCE')) {
        // Vault is empty - keep in pending but log warning
        console.log(`Report #${reportId} claim failed - vault needs funding`);
        addActivity({
          type: 'warning',
          message: `Vault needs more funding for bounty claims`,
          severity: 'warning',
        });
      }

      return false;
    } catch (error) {
      addActivity({
        type: 'error',
        message: error instanceof Error ? error.message : 'Bounty claim failed',
        severity: 'error',
      });
      return false;
    }
  }, [addActivity, refreshWalletBalance]);

  // Track pending bounties with ref for access in async callbacks
  const pendingBountiesRef = useRef<PendingBounty[]>([]);

  // Sync ref with state
  useEffect(() => {
    pendingBountiesRef.current = pendingBounties;
  }, [pendingBounties]);

  // Start agent monitoring sequence
  const startAgent = useCallback(async () => {
    if (agentRunning.current) return;
    agentRunning.current = true;
    isAgentActiveRef.current = true; // Set ref to avoid stale closure in monitorProtocol
    setIsAgentActive(true);

    // Clear pending bounties from previous runs to start fresh
    setPendingBounties([]);

    setAgentState({
      isRunning: true,
      currentStep: 0,
      totalSteps: 6, // Now 6 steps including bounty claim
      startedAt: Date.now(),
      completedAt: null,
    });

    try {
      // Step 1: Initialize wallet
      setAgentState(prev => ({ ...prev, currentStep: 1 }));
      addActivity({
        type: 'info',
        message: 'Starting GuardBot monitoring sequence...',
        severity: 'info',
      });

      if (!wallet) {
        await initializeAgent();
        await delay(3000); // Wait for wallet initialization
      }

      if (!agentRunning.current) return;

      // Step 2: Monitor protocols from registry
      setAgentState(prev => ({ ...prev, currentStep: 2 }));
      addActivity({
        type: 'info',
        message: `Monitoring ${monitoredProtocols.length} registered protocol(s)...`,
        severity: 'info',
      });

      // Monitor up to 3 protocols
      const protocolsToMonitor = monitoredProtocols.slice(0, 3);

      for (let i = 0; i < protocolsToMonitor.length; i++) {
        if (!agentRunning.current) return;

        const protocol = protocolsToMonitor[i];
        setAgentState(prev => ({ ...prev, currentStep: 2 + i }));

        if (i === protocolsToMonitor.length - 1) {
          // Last protocol - mark as high-risk scan
          addActivity({
            type: 'info',
            message: `Scanning ${protocol.name} for vulnerabilities...`,
            severity: 'warning',
          });
        }

        await monitorProtocol(protocol.address, protocol.name);
        await delay(MIN_OPERATION_DELAY); // Wait for RPC stability
      }

      // Pad step count if fewer than 3 protocols
      const stepAfterMonitoring = 2 + Math.max(protocolsToMonitor.length, 3) - 1;

      if (!agentRunning.current) return;

      // Claim bounties step
      const claimStep = stepAfterMonitoring + 1;
      setAgentState(prev => ({ ...prev, currentStep: claimStep }));

      // Wait a moment for state to update with any new pending bounties
      await delay(2000);

      const bounteesToClaim = pendingBountiesRef.current;
      if (bounteesToClaim.length > 0) {
        addActivity({
          type: 'info',
          message: `Claiming ${bounteesToClaim.length} pending bounties...`,
          severity: 'info',
        });

        for (const bounty of bounteesToClaim) {
          if (!agentRunning.current) return;

          addActivity({
            type: 'bounty',
            message: `Claiming bounty: ${bounty.amount} MOVE (${bounty.severity} severity)...`,
            severity: 'info',
          });

          await claimBounty(bounty.reportId, bounty.severity);
          await delay(MIN_OPERATION_DELAY); // Wait between claims
        }
      } else {
        addActivity({
          type: 'info',
          message: 'No pending bounties to claim',
          severity: 'info',
        });
      }

      if (!agentRunning.current) return;

      // Final step: Monitoring complete
      const finalStep = claimStep + 1;
      setAgentState(prev => ({
        ...prev,
        currentStep: finalStep,
        isRunning: false,
        completedAt: Date.now(),
      }));

      addActivity({
        type: 'info',
        message: 'Monitoring complete! GuardBot is ready for autonomous security monitoring.',
        severity: 'success',
      });

    } catch (error) {
      addActivity({
        type: 'error',
        message: error instanceof Error ? error.message : 'Monitoring failed',
        severity: 'error',
      });
    } finally {
      agentRunning.current = false;
      setStatus('idle');
    }
  }, [wallet, initializeAgent, monitorProtocol, claimBounty, addActivity, monitoredProtocols]);

  const stopAgent = useCallback(() => {
    agentRunning.current = false;
    isAgentActiveRef.current = false; // Reset ref
    setIsAgentActive(false);
    setAgentState(initialAgentState);
    setStatus('idle');
    addActivity({
      type: 'info',
      message: 'Agent stopped',
      severity: 'info',
    });
  }, [addActivity]);

  const toggleAutoMode = useCallback(() => {
    setIsAutoMode(prev => {
      const newValue = !prev;
      addActivity({
        type: 'info',
        message: `Auto-mode ${newValue ? 'enabled' : 'disabled'}`,
        severity: 'info',
      });
      return newValue;
    });
  }, [addActivity]);

  const clearActivities = useCallback(() => {
    clearActivityLog();
  }, [clearActivityLog]);

  const resetAgent = useCallback(() => {
    agentRunning.current = false;
    isAgentActiveRef.current = false; // Reset ref
    setStatus('idle');
    setWallet(null);
    setSessions([]);
    setStats(initialStats);
    setIsAutoMode(false);
    setIsAgentActive(false);
    setAgentState(initialAgentState);
    setPendingBounties([]); // Clear pending bounties on reset
    clearActivityLog();
  }, [clearActivityLog]);

  return {
    status,
    wallet,
    sessions,
    activities,
    stats,
    isAutoMode,
    isAgentActive,
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
  };
}

// Delay function with longer default for RPC stability
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Minimum delay between blockchain operations to avoid mempool conflicts
const MIN_OPERATION_DELAY = 8000; // 8 seconds between operations
