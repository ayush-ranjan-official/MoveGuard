// Core types for MoveGuard V2

export type RegistrationType = 'subscription' | 'bounty';

export interface ProtectedProtocol {
  name: string;
  contractAddress: string;
  admin: string;
  isPaused: boolean;
  threatLevel: number;
  protectionActive: boolean;
  registeredAt: number;
  lastThreatCheck: number;
  registrationType: RegistrationType;  // 'subscription' for payment stream, 'bounty' for vault-based
  bountyDeposit?: number;              // Amount deposited to vault (in octas) - for bounty type
  vaultTxHash?: string;                // Transaction hash of vault funding - for bounty type
}

export interface PaymentStream {
  protocolAddress: string;
  payer: string;
  balance: number;
  ratePerBlock: number;
  lastDeductionBlock: number;
  totalPaid: number;
  isActive: boolean;
}

export interface ThreatAssessment {
  threatLevel: number; // 0-100
  attackType: string | null;
  confidence: number;
  recommendation: string;
  indicators: string[];
  timestamp: number;
}

export interface Transaction {
  hash: string;
  from: string;
  to: string;
  value: string;
  functionName?: string;
  timestamp: number;
  gasUsed?: string;
}

export interface VulnerabilityReport {
  id: number;
  reporter: string;
  protocolAddress: string;
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'pending' | 'validated' | 'rejected' | 'paid';
  bountyAmount: number;
  submittedAt: number;
  txHash?: string;
  paymentTxHash?: string;
  payoutAddress?: string;          // Researcher's wallet for bounty payout
  submissionFeeTxHash?: string;    // x402 submission fee transaction
}

export interface BountyInfo {
  low: number;
  medium: number;
  high: number;
  critical: number;
}

export type ThreatStatus = 'safe' | 'warning' | 'critical' | 'paused';

export interface DashboardStats {
  totalProtocols: number;
  activeProtections: number;
  threatsDetected: number;
  attacksPrevented: number;
  totalValueProtected: string;
}

export interface ResearcherStats {
  totalSubmissions: number;
  validatedReports: number;
  totalEarned: number;
  pendingReports: number;
}
