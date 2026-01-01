/**
 * GuardBot Agent Types
 *
 * Types for the autonomous security agent that monitors DeFi protocols,
 * pays for threat analysis via x402, and earns bounties.
 */

export type AgentStatus = 'idle' | 'initializing' | 'monitoring' | 'analyzing' | 'reporting' | 'paused' | 'error';

export interface AgentWallet {
  address: string;
  balance: number;
  balanceMove: string;
  isEmbedded: boolean;
  createdAt: number;
  lastUpdated: number;
}

export interface MonitoringSession {
  id: string;
  protocolAddress: string;
  protocolName: string;
  startedAt: number;
  lastCheck: number;
  checksCompleted: number;
  threatsDetected: number;
  reportsSubmitted: number;
  totalSpent: number;
  isActive: boolean;
}

export type ActivityType = 'payment' | 'analysis' | 'threat' | 'report' | 'bounty' | 'error' | 'info' | 'wallet' | 'warning';
export type ActivitySeverity = 'info' | 'warning' | 'success' | 'error';

export interface ActivityLogEntry {
  id: string;
  timestamp: number;
  type: ActivityType;
  message: string;
  txHash?: string;
  amount?: number;
  amountMove?: string;
  severity: ActivitySeverity;
  protocolAddress?: string;
  threatLevel?: number;
}

export interface GuardBotState {
  status: AgentStatus;
  wallet: AgentWallet | null;
  activeSessions: MonitoringSession[];
  activityLog: ActivityLogEntry[];
  stats: GuardBotStats;
  isAutoMode: boolean;
  isAgentActive: boolean;
}

export interface GuardBotStats {
  totalPayments: number;
  totalPaymentsMove: string;
  totalEarnings: number;
  totalEarningsMove: string;
  protocolsMonitored: number;
  threatsDetected: number;
  reportsSubmitted: number;
  successfulBounties: number;
}

// API Request/Response types
export interface MonitorRequest {
  protocolAddress: string;
  protocolName?: string;
}

export interface MonitorResponse {
  success: boolean;
  sessionId?: string;
  analysis?: {
    threatLevel: number;
    attackType: string | null;
    confidence: number;
    recommendation: string;
    indicators: string[];
  };
  payment?: {
    txHash: string;
    amount: string;
    amountOctas: string;
  };
  activities: ActivityLogEntry[];
  error?: string;
}

export interface ReportRequest {
  protocolAddress: string;
  protocolName: string;
  threatLevel: number;
  attackType: string;
  confidence: number;
  indicators: string[];
  recommendation: string;
}

export interface ReportResponse {
  success: boolean;
  reportId?: number;
  submissionTx?: string;
  feeTx?: string;
  pendingBounty?: {
    amount: string;
    amountOctas: string;
    severity: string;
  };
  activities: ActivityLogEntry[];
  error?: string;
}

export interface WalletResponse {
  success: boolean;
  wallet?: AgentWallet;
  fundingTx?: string;
  error?: string;
}

// Agent sequence types
export interface AgentStep {
  id: string;
  name: string;
  description: string;
  duration: number; // ms
  action: () => Promise<void>;
}

export interface AgentState {
  isRunning: boolean;
  currentStep: number;
  totalSteps: number;
  startedAt: number | null;
  completedAt: number | null;
}

// Constants
export const AGENT_PRICING = {
  threatAnalysis: '0.001',      // Cost per analysis
  reportSubmission: '0.01',     // Cost to submit vulnerability
} as const;

export const BOUNTY_REWARDS = {
  low: '0.1',
  medium: '0.5',
  high: '1',
  critical: '5',
} as const;

export const THREAT_THRESHOLDS = {
  safe: 30,
  warning: 50,
  critical: 70,
  report: 70,  // Auto-report if above this
} as const;
