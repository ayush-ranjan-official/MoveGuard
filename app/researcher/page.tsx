'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Bug, Award, TrendingUp, ExternalLink, CheckCircle, XCircle, RefreshCw, Loader2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Navbar } from '@/components/shared/Navbar';
import { VulnerabilityForm } from '@/components/researcher/VulnerabilityForm';
import { BountyHistory } from '@/components/researcher/BountyHistory';
import { X402PaymentModal } from '@/components/shared/X402PaymentModal';
import { useX402Payment } from '@/hooks/useX402Payment';
import type { VulnerabilityReport } from '@/lib/types';
import { BOUNTY_AMOUNTS, MODULE_ADDRESS } from '@/lib/constants';
import { octasToMove } from '@/lib/movement';

// Severity level mapping
const SEVERITY_MAP: Record<'low' | 'medium' | 'high' | 'critical', number> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

// Reverse severity mapping (number to string)
const SEVERITY_LABELS: Record<number, 'low' | 'medium' | 'high' | 'critical'> = {
  1: 'low',
  2: 'medium',
  3: 'high',
  4: 'critical',
};

// Status code to status string mapping
const STATUS_MAP: Record<number, 'pending' | 'validated' | 'rejected' | 'paid'> = {
  0: 'pending',
  1: 'validated',
  2: 'rejected',
  3: 'paid',
};

// Polling interval for status updates (10 seconds)
const POLL_INTERVAL = 10000;

// Response type from submit-with-fee endpoint
interface SubmissionResult {
  success: boolean;
  message?: string;
  txHash?: string;
  submissionFeeTxHash?: string;
  report?: {
    protocolAddress: string;
    title: string;
    severity: number;
    severityLabel: string;
    payoutAddress: string;
    potentialReward: number;
    potentialRewardMove: number;
    status: string;
    submittedAt: number;
  };
  explorerUrl?: string;
  error?: string;
  details?: string;
}

export default function ResearcherPage() {
  const [reports, setReports] = useState<VulnerabilityReport[]>([]);
  const [lastTxHash, setLastTxHash] = useState<string | null>(null);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [vaultBalance, setVaultBalance] = useState<number>(0);
  const [totalPaidOut, setTotalPaidOut] = useState<number>(0);
  const [validatedCount, setValidatedCount] = useState<number>(0);
  const [isLoadingReports, setIsLoadingReports] = useState(true);
  const [isValidating, setIsValidating] = useState<string | null>(null);
  const [validationTxHash, setValidationTxHash] = useState<string | null>(null);
  const [pendingSubmission, setPendingSubmission] = useState<{
    protocolAddress: string;
    title: string;
    description: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    payoutAddress: string;
  } | null>(null);

  // x402 payment hook for submission fee
  const {
    state: paymentState,
    makeRequest,
    executePayment,
    cancelPayment,
  } = useX402Payment();

  // Fetch vault stats and existing reports on mount
  useEffect(() => {
    async function loadInitialData() {
      setIsLoadingReports(true);
      try {
        // Fetch vault stats
        const statsResponse = await fetch('/api/bounty', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'get_vault_stats' }),
        });
        const statsData = await statsResponse.json();
        if (statsData.success) {
          setVaultBalance(statsData.balance || 0);
          setTotalPaidOut(statsData.totalPaidOut || 0);
          setValidatedCount(statsData.validatedReports || 0);
        }

        // Fetch existing report for deployer (reporter address = MODULE_ADDRESS for testing)
        if (MODULE_ADDRESS && MODULE_ADDRESS !== '0x0') {
          const reportResponse = await fetch('/api/bounty', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'get_report_info',
              reporterAddress: MODULE_ADDRESS,
            }),
          });
          const reportData = await reportResponse.json();

          if (reportData.success && reportData.report) {
            const existingReport: VulnerabilityReport = {
              id: reportData.report.id,
              reporter: MODULE_ADDRESS,
              protocolAddress: reportData.report.protocolAddress,
              title: 'Vulnerability Report', // Title not stored on-chain in get_report_info
              description: 'Report loaded from blockchain',
              severity: SEVERITY_LABELS[reportData.report.severity] || 'medium',
              status: STATUS_MAP[reportData.report.status] || 'pending',
              bountyAmount: reportData.report.bountyAmount,
              submittedAt: Date.now(), // Timestamp not available from this view
            };
            setReports([existingReport]);
          }
        }
      } catch (error) {
        console.error('Error loading initial data:', error);
      } finally {
        setIsLoadingReports(false);
      }
    }

    loadInitialData();
  }, []);

  // Poll for report status updates
  useEffect(() => {
    if (reports.length === 0) return;

    const checkReportStatuses = async () => {
      const updatedReports = await Promise.all(
        reports.map(async (report) => {
          // Only poll for pending reports
          if (report.status !== 'pending') return report;

          try {
            const response = await fetch('/api/bounty', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'get_report_status',
                reporterAddress: report.reporter,
              }),
            });
            const data = await response.json();

            if (data.success && data.statusLabel) {
              const newStatus = data.statusLabel as 'pending' | 'validated' | 'rejected' | 'paid';
              if (newStatus !== report.status) {
                console.log(`Report ${report.id} status changed: ${report.status} → ${newStatus}`);
                return { ...report, status: newStatus };
              }
            }
          } catch (error) {
            console.error('Error polling report status:', error);
          }
          return report;
        })
      );

      setReports(updatedReports);
    };

    const interval = setInterval(checkReportStatuses, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [reports]);

  // Refresh vault stats
  const refreshVaultStats = useCallback(async () => {
    try {
      const response = await fetch('/api/bounty', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get_vault_stats' }),
      });
      const data = await response.json();
      if (data.success) {
        setVaultBalance(data.balance || 0);
        setTotalPaidOut(data.totalPaidOut || 0);
        setValidatedCount(data.validatedReports || 0);
      }
    } catch (error) {
      console.error('Error refreshing vault stats:', error);
    }
  }, []);

  // Handle report submission with x402 payment
  const handleSubmit = async (data: {
    protocolAddress: string;
    title: string;
    description: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    payoutAddress: string;
  }) => {
    setSubmitStatus('idle');
    setLastTxHash(null);

    // Store pending submission for after payment
    setPendingSubmission(data);

    try {
      // Use x402 payment flow - this will trigger 402 response and open payment modal
      const result = await makeRequest<SubmissionResult>('/api/bounty/submit-with-fee', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          protocolAddress: data.protocolAddress,
          title: data.title,
          description: data.description,
          severity: SEVERITY_MAP[data.severity],
          payoutAddress: data.payoutAddress,
        }),
      });

      // If result is null, payment is required - modal will handle it
      if (!result) {
        return;
      }

      // Payment completed and submission successful
      console.log('Report submitted:', result.txHash);
      setLastTxHash(result.txHash || null);
      setSubmitStatus('success');
      setPendingSubmission(null);

      // Add to local reports with the deployer address as reporter
      const newReport: VulnerabilityReport = {
        id: reports.length + 1,
        reporter: MODULE_ADDRESS,
        protocolAddress: data.protocolAddress,
        title: data.title,
        description: data.description,
        severity: data.severity,
        status: 'pending',
        bountyAmount: BOUNTY_AMOUNTS[data.severity],
        submittedAt: Date.now(),
        txHash: result.txHash,
        payoutAddress: data.payoutAddress,
        submissionFeeTxHash: result.submissionFeeTxHash,
      };

      setReports((prev) => [newReport, ...prev]);
    } catch (error) {
      console.error('Error submitting report:', error);
      setSubmitStatus('error');
      setPendingSubmission(null);
      throw error;
    }
  };

  // Handle x402 payment completion
  const handlePaymentComplete = async () => {
    if (!pendingSubmission) return;

    try {
      // Payment was completed, now retry the submission with payment headers
      // The executePayment function will handle the retry automatically
      await executePayment();
    } catch (error) {
      console.error('Payment failed:', error);
      setSubmitStatus('error');
    }
  };

  // Handle x402 payment cancellation
  const handlePaymentCancel = () => {
    cancelPayment();
    setPendingSubmission(null);
  };

  // Handle report validation and payment
  const handleValidateReport = async (reporterAddress: string, payoutAddress: string) => {
    setIsValidating(reporterAddress);
    setValidationTxHash(null);

    try {
      // Use the new payout endpoint that transfers to researcher's wallet
      const response = await fetch('/api/bounty/payout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reporterAddress,
          payoutAddress,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || result.details || 'Failed to validate report');
      }

      console.log('Report validated and paid:', result.paymentTxHash);
      setValidationTxHash(result.paymentTxHash);

      // Update report status locally
      setReports((prev) =>
        prev.map((r) =>
          r.reporter === reporterAddress ? { ...r, status: 'paid', paymentTxHash: result.paymentTxHash } : r
        )
      );

      // Refresh vault stats after payment
      await refreshVaultStats();
    } catch (error) {
      console.error('Error validating report:', error);
      throw error;
    } finally {
      setIsValidating(null);
    }
  };

  // Calculate stats from local state (for UI responsiveness) and blockchain data
  const localTotalEarned = reports
    .filter((r) => r.status === 'paid')
    .reduce((acc, r) => acc + r.bountyAmount, 0);

  const localPendingRewards = reports
    .filter((r) => r.status === 'validated')
    .reduce((acc, r) => acc + r.bountyAmount, 0);

  // Use blockchain stats when available, fall back to local
  const displayTotalEarned = totalPaidOut > 0 ? totalPaidOut : localTotalEarned;
  const displayPendingRewards = localPendingRewards;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Researcher Portal</h1>
          <p className="text-muted-foreground mt-1">
            Submit vulnerabilities and earn bounties instantly via x402
          </p>
        </div>

        {/* Transaction Status */}
        {lastTxHash && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`mb-6 p-4 rounded-lg border ${
              submitStatus === 'success'
                ? 'bg-green-500/10 border-green-500/30'
                : 'bg-red-500/10 border-red-500/30'
            }`}
          >
            <div className="flex items-center gap-3">
              {submitStatus === 'success' ? (
                <CheckCircle className="w-5 h-5 text-green-400" />
              ) : (
                <XCircle className="w-5 h-5 text-red-400" />
              )}
              <div className="flex-1">
                <p className="font-medium">
                  {submitStatus === 'success'
                    ? 'Report submitted to blockchain!'
                    : 'Submission failed'}
                </p>
                <a
                  href={`https://explorer.movementnetwork.xyz/txn/${lastTxHash}?network=bardock+testnet`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-400 hover:underline flex items-center gap-1"
                >
                  View transaction <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          </motion.div>
        )}

        {/* Validation Success */}
        {validationTxHash && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 rounded-lg border bg-purple-500/10 border-purple-500/30"
          >
            <div className="flex items-center gap-3">
              <Award className="w-5 h-5 text-purple-400" />
              <div className="flex-1">
                <p className="font-medium text-purple-400">Bounty paid successfully!</p>
                <a
                  href={`https://explorer.movementnetwork.xyz/txn/${validationTxHash}?network=bardock+testnet`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-400 hover:underline flex items-center gap-1"
                >
                  View payment transaction <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          </motion.div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card className="p-4 bg-card border-border">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Paid Out</p>
                  <p className="text-2xl font-bold mt-1 text-green-400">
                    {octasToMove(displayTotalEarned)} MOVE
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {validatedCount} reports validated
                  </p>
                </div>
                <div className="p-2 rounded-lg bg-green-500/10">
                  <Award className="w-5 h-5 text-green-500" />
                </div>
              </div>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="p-4 bg-card border-border">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Pending Rewards</p>
                  <p className="text-2xl font-bold mt-1 text-yellow-400">
                    {octasToMove(displayPendingRewards)} MOVE
                  </p>
                </div>
                <div className="p-2 rounded-lg bg-yellow-500/10">
                  <TrendingUp className="w-5 h-5 text-yellow-500" />
                </div>
              </div>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card className="p-4 bg-card border-border">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Your Submissions</p>
                  <p className="text-2xl font-bold mt-1">
                    {isLoadingReports ? (
                      <Loader2 className="w-6 h-6 animate-spin" />
                    ) : (
                      reports.length
                    )}
                  </p>
                </div>
                <div className="p-2 rounded-lg bg-purple-500/10">
                  <Bug className="w-5 h-5 text-purple-500" />
                </div>
              </div>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <Card className="p-4 bg-card border-border">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Vault Balance</p>
                  <p className="text-2xl font-bold mt-1 text-blue-400">
                    {octasToMove(vaultBalance)} MOVE
                  </p>
                </div>
                <button
                  onClick={refreshVaultStats}
                  className="p-2 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 transition-colors"
                  title="Refresh vault stats"
                >
                  <RefreshCw className="w-5 h-5 text-blue-500" />
                </button>
              </div>
            </Card>
          </motion.div>
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
          >
            <VulnerabilityForm onSubmit={handleSubmit} />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
          >
            <BountyHistory
              reports={reports}
              onValidate={handleValidateReport}
              isValidating={isValidating}
            />
          </motion.div>
        </div>

        {/* Bounty Tiers */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
        >
          {[
            { severity: 'Low', amount: octasToMove(BOUNTY_AMOUNTS.low), color: 'blue' },
            { severity: 'Medium', amount: octasToMove(BOUNTY_AMOUNTS.medium), color: 'yellow' },
            { severity: 'High', amount: octasToMove(BOUNTY_AMOUNTS.high), color: 'orange' },
            { severity: 'Critical', amount: octasToMove(BOUNTY_AMOUNTS.critical), color: 'red' },
          ].map((item) => (
            <Card
              key={item.severity}
              className={`p-4 bg-${item.color}-500/5 border-${item.color}-500/20`}
            >
              <div className="text-center">
                <div className={`text-${item.color}-400 font-medium`}>
                  {item.severity} Severity
                </div>
                <div className="text-2xl font-bold mt-1">{item.amount} MOVE</div>
              </div>
            </Card>
          ))}
        </motion.div>
      </main>

      {/* x402 Payment Modal for submission fee */}
      <X402PaymentModal
        open={paymentState.showModal}
        requirements={paymentState.requirements}
        isPending={paymentState.isPending}
        paymentStep={paymentState.paymentStep}
        onPay={handlePaymentComplete}
        onCancel={handlePaymentCancel}
      />
    </div>
  );
}
