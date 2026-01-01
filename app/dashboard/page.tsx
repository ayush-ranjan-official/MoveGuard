'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Shield,
  Zap,
  AlertTriangle,
  DollarSign,
  Activity,
  RotateCcw,
  Plus,
  X,
  ExternalLink,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ThreatMonitor } from '@/components/dashboard/ThreatMonitor';
import { ProtocolCard } from '@/components/dashboard/ProtocolCard';
import { PaymentStream } from '@/components/dashboard/PaymentStream';
import { EmergencyPauseButton } from '@/components/dashboard/PauseButton';
import { ThreatAnalysisModal } from '@/components/dashboard/ThreatAnalysisModal';
import { Navbar } from '@/components/shared/Navbar';
import { X402PaymentModal, X402PaymentSuccess } from '@/components/shared/X402PaymentModal';
import { BountyRegistrationModal } from '@/components/shared/BountyRegistrationModal';
import { useProtocols } from '@/hooks/useProtocols';
import { useBountyProtocols } from '@/hooks/useBountyProtocols';
import { useThreats } from '@/hooks/useThreats';
import { usePaymentStream } from '@/hooks/usePaymentStream';
import { useX402Payment } from '@/hooks/useX402Payment';
import { cn } from '@/lib/utils';
import { MODULE_ADDRESS, THREAT_THRESHOLDS } from '@/lib/constants';
import { PRICING } from '@/lib/x402';
import type { ThreatStatus, ThreatAssessment } from '@/lib/types';

// Helper to get status from threat level
function getStatusFromThreatLevel(level: number): ThreatStatus {
  if (level >= THREAT_THRESHOLDS.critical) return 'critical';
  if (level >= THREAT_THRESHOLDS.warning) return 'warning';
  return 'safe';
}

// Stats Card Component
function StatsCard({
  label,
  value,
  icon: Icon,
  trend,
  trendUp,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  trend?: string;
  trendUp?: boolean;
}) {
  return (
    <Card className="p-4 bg-card border-border">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold mt-1">{value}</p>
          {trend && (
            <p
              className={cn(
                'text-xs mt-1',
                trendUp ? 'text-green-400' : 'text-red-400'
              )}
            >
              {trend}
            </p>
          )}
        </div>
        <div className="p-2 rounded-lg bg-purple-500/10">
          <Icon className="w-5 h-5 text-purple-500" />
        </div>
      </div>
    </Card>
  );
}

// Register Protocol Modal
function RegisterProtocolModal({
  isOpen,
  onClose,
  onRegister,
  isLoading,
}: {
  isOpen: boolean;
  onClose: () => void;
  onRegister: (name: string, address: string) => Promise<void>;
  isLoading: boolean;
}) {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onRegister(name, address);
    setName('');
    setAddress('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-card border border-border rounded-lg p-6 w-full max-w-md mx-4"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Register Protocol</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Protocol Name</label>
            <Input
              placeholder="e.g., My DeFi Protocol"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Contract Address</label>
            <Input
              placeholder="0x..."
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="font-mono text-sm"
              required
            />
            <p className="text-xs text-muted-foreground mt-1">
              Enter the address of the contract you want to protect
            </p>
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading || !name || !address}
              className="flex-1 bg-purple-600 hover:bg-purple-700"
            >
              {isLoading ? (
                <Activity className="w-4 h-4 animate-spin" />
              ) : (
                'Register'
              )}
            </Button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

export default function DashboardPage() {
  const {
    protocols,
    pauseProtocol,
    unpauseProtocol,
    updateThreatLevel,
    registerProtocol,
    lastTxHash,
    updateProtocolPausedState,
  } = useProtocols();
  const { registerBountyProtocol } = useBountyProtocols();
  const {
    isLoading: isThreatLoading,
    isScanning,
    latestAssessment,
    simulateAttack,
    clearThreat,
    updateAssessment,
  } = useThreats();
  const { stream, createStream, addFunds, isLoading: isStreamLoading } = usePaymentStream(undefined, MODULE_ADDRESS);

  // x402 Payment handling for threat analysis
  const {
    state: paymentState,
    makeRequest: makeX402Request,
    executePayment,
    simulatePayment,
    cancelPayment,
  } = useX402Payment<{
    assessment: ThreatAssessment;
    mode: string;
    autoPause?: { triggered: boolean; txHash?: string };
  }>();

  const [attackInProgress, setAttackInProgress] = useState(false);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [showBountyRegisterModal, setShowBountyRegisterModal] = useState(false);
  const [isBountyRegistering, setIsBountyRegistering] = useState(false);
  const [showThreatModal, setShowThreatModal] = useState(false);
  const [pendingAnalysis, setPendingAnalysis] = useState<{
    attackType: string;
    protocolAddress: string;
  } | null>(null);

  // Handle protocol registration (subscription-based)
  const handleRegisterProtocol = async (name: string, address: string) => {
    setIsRegistering(true);
    try {
      await registerProtocol(name, address);
    } finally {
      setIsRegistering(false);
    }
  };

  // Handle bounty protocol registration
  const handleBountyRegister = async (name: string, address: string, amount: number) => {
    setIsBountyRegistering(true);
    try {
      const result = await registerBountyProtocol(name, address, amount);
      console.log('Bounty protocol registered:', result);
      alert(`Protocol registered for bounty protection!\nVault funded: ${result.fundTxHash?.slice(0, 20)}...`);
      setShowBountyRegisterModal(false);
    } catch (error) {
      console.error('Failed to register bounty protocol:', error);
      throw error; // Let modal handle the error
    } finally {
      setIsBountyRegistering(false);
    }
  };

  // Handle threat analysis from modal - uses real ATXP AI with x402 payment
  const handleThreatAnalysis = async (attackType: string, protocolAddress: string) => {
    setAttackInProgress(true);
    setPendingAnalysis({ attackType, protocolAddress });

    // Make request through x402 payment flow
    const validAttackType = attackType as 'flash_loan' | 'oracle' | 'sandwich' | 'reentrancy';

    try {
      // Try direct request - x402 middleware may require payment
      const result = await makeX402Request<{
        assessment: ThreatAssessment;
        mode: string;
        autoPause?: { triggered: boolean; txHash?: string };
      }>('/api/threats/analyze', {
        method: 'POST',
        body: JSON.stringify({
          attackType: validAttackType,
          protocolAddress,
          protocolContext: protocolAddress ? `Protocol address: ${protocolAddress}` : undefined,
        }),
      });

      // If null, payment modal is shown - wait for payment completion
      if (!result) {
        console.log('x402: Payment required for threat analysis');
        return null;
      }

      // Process successful response
      const assessment = result.assessment;

      // Update threat level for the analyzed protocol
      if (assessment) {
        updateThreatLevel(protocolAddress, assessment.threatLevel);

        // If API auto-paused, sync local state
        if (result.autoPause?.triggered) {
          updateProtocolPausedState(protocolAddress, true, result.autoPause.txHash);
        }
      }

      setPendingAnalysis(null);
      return assessment;
    } catch (error) {
      console.error('Threat analysis error:', error);
      // Fallback to regular analysis (bypasses payment in development)
      const assessment = await simulateAttack(validAttackType, protocolAddress);

      if (assessment) {
        updateThreatLevel(protocolAddress, assessment.threatLevel);
        const extendedAssessment = assessment as typeof assessment & { autoPauseTriggered?: boolean; autoPauseTxHash?: string };
        if (extendedAssessment.autoPauseTriggered) {
          updateProtocolPausedState(protocolAddress, true, extendedAssessment.autoPauseTxHash);
        }
      }

      setPendingAnalysis(null);
      return assessment;
    }
  };

  // Handle x402 payment completion
  const handlePaymentComplete = async () => {
    // Use executePayment to retry the original request with payment proof
    // The generic type is defined on the hook, so executePayment returns the typed result
    const result = await executePayment();

    // Process the result if we got one
    if (result && result.assessment) {
      const assessment = result.assessment;

      if (pendingAnalysis) {
        updateThreatLevel(pendingAnalysis.protocolAddress, assessment.threatLevel);

        if (result.autoPause?.triggered) {
          updateProtocolPausedState(pendingAnalysis.protocolAddress, true, result.autoPause.txHash);
        }
      }

      updateAssessment(assessment);
      setPendingAnalysis(null);
      setAttackInProgress(false);
    } else if (pendingAnalysis) {
      // Fallback if executePayment didn't return a result
      const { attackType, protocolAddress } = pendingAnalysis;
      const validAttackType = attackType as 'flash_loan' | 'oracle' | 'sandwich' | 'reentrancy';
      const assessment = await simulateAttack(validAttackType, protocolAddress);

      if (assessment) {
        updateThreatLevel(protocolAddress, assessment.threatLevel);
        const extendedAssessment = assessment as typeof assessment & { autoPauseTriggered?: boolean; autoPauseTxHash?: string };
        if (extendedAssessment.autoPauseTriggered) {
          updateProtocolPausedState(protocolAddress, true, extendedAssessment.autoPauseTxHash);
        }
      }

      setPendingAnalysis(null);
      setAttackInProgress(false);
    }
  };

  // Handle creating/activating payment stream
  const [isProcessingStream, setIsProcessingStream] = useState(false);
  const handleActivateStream = async () => {
    console.log('🟢 handleActivateStream CLICKED');
    console.log('protocols:', protocols.length, protocols);
    if (protocols.length === 0) {
      console.log('No protocols to create stream for');
      alert('No protocol registered. Please register a protocol first.');
      return;
    }
    if (isProcessingStream || isStreamLoading) {
      console.log('Already processing stream operation, ignoring');
      return;
    }
    setIsProcessingStream(true);
    try {
      const protocol = protocols[0];
      console.log('Creating payment stream for:', protocol.name, protocol.contractAddress);
      const result = await createStream(protocol.contractAddress, 0.1); // 0.1 MOVE initial
      console.log('createStream result:', result);
      if (result.success) {
        console.log('Stream created:', result.txHash);
        alert(`Payment stream created! TX: ${result.txHash?.slice(0, 20)}...`);
      } else {
        console.error('Stream creation failed');
        alert('Failed to create payment stream. Check console for details.');
      }
    } catch (error) {
      console.error('Error creating stream:', error);
      alert(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsProcessingStream(false);
    }
  };

  // Handle adding funds to stream
  const handleAddFunds = async () => {
    console.log('🟢 handleAddFunds CLICKED');
    console.log('isProcessingStream:', isProcessingStream, 'isStreamLoading:', isStreamLoading);
    if (isProcessingStream || isStreamLoading) {
      console.log('⚠️ Already processing stream operation, ignoring');
      alert('Please wait - another operation is in progress');
      return;
    }
    setIsProcessingStream(true);
    console.log('Adding 0.1 MOVE to stream...');
    try {
      const result = await addFunds(0.1); // Add 0.1 MOVE
      if (result.success) {
        console.log('Funds added:', result.txHash);
        alert(`Funds added! TX: ${result.txHash?.slice(0, 20)}...`);
      } else {
        console.error('Failed to add funds');
        alert('Failed to add funds. Check console for details.');
      }
    } catch (error) {
      console.error('Error adding funds:', error);
      alert(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsProcessingStream(false);
    }
  };

  // Reset state
  const handleReset = () => {
    setAttackInProgress(false);
    clearThreat();
    protocols.forEach((p) => {
      if (p.isPaused) {
        unpauseProtocol(p.contractAddress);
      }
    });
  };

  // Calculate stats
  const activeProtections = protocols.filter((p) => p.protectionActive).length;
  const pausedProtocols = protocols.filter((p) => p.isPaused).length;
  const avgThreatLevel =
    protocols.length > 0
      ? Math.round(
          protocols.reduce((acc, p) => acc + p.threatLevel, 0) / protocols.length
        )
      : 0;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold">Protocol Dashboard</h1>
            <p className="text-muted-foreground mt-1">
              Monitor and protect your DeFi protocols in real-time
            </p>
          </div>

          {/* Controls */}
          <div className="flex flex-wrap items-center gap-3">
            <Button
              onClick={() => setShowRegisterModal(true)}
              className="gap-2 bg-purple-600 hover:bg-purple-700"
            >
              <Plus className="w-4 h-4" />
              Register Protocol
            </Button>
            <Button
              onClick={() => setShowBountyRegisterModal(true)}
              className="gap-2 bg-green-600 hover:bg-green-700"
            >
              <Shield className="w-4 h-4" />
              Bounty Protection
            </Button>
            <Button
              onClick={() => setShowThreatModal(true)}
              disabled={protocols.length === 0}
              className="gap-2 bg-red-600 hover:bg-red-700"
            >
              <Zap className="w-4 h-4" />
              Analyze Threats
              <Badge variant="outline" className="ml-1 text-xs bg-red-500/20 border-red-500/30">
                {PRICING.threatAnalysis} MOVE
              </Badge>
            </Button>
            <Button
              variant="outline"
              onClick={handleReset}
              className="gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              Reset
            </Button>
          </div>
        </div>

        {/* Last Transaction */}
        {lastTxHash && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-3 rounded-lg bg-green-500/10 border border-green-500/30"
          >
            <div className="flex items-center gap-2 text-sm">
              <span className="text-green-400">Last transaction:</span>
              <a
                href={`https://explorer.movementnetwork.xyz/?network=bardock+testnet&txn=${lastTxHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-orange-400 hover:underline flex items-center gap-1 font-mono text-xs"
              >
                {lastTxHash.slice(0, 10)}...{lastTxHash.slice(-8)}
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </motion.div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatsCard
            label="Protected Protocols"
            value={activeProtections}
            icon={Shield}
            trend={`${protocols.length} registered`}
            trendUp
          />
          <StatsCard
            label="Active Threats"
            value={pausedProtocols}
            icon={AlertTriangle}
            trend={pausedProtocols > 0 ? 'Action required' : 'All clear'}
            trendUp={pausedProtocols === 0}
          />
          <StatsCard
            label="Avg Threat Level"
            value={`${avgThreatLevel}%`}
            icon={Zap}
            trend={avgThreatLevel > 50 ? 'Elevated' : 'Normal'}
            trendUp={avgThreatLevel < 50}
          />
          <StatsCard
            label="Stream Balance"
            value={stream ? `${(stream.balance / 1e8).toFixed(2)} MOVE` : '0 MOVE'}
            icon={DollarSign}
            trend="$0.001/block"
            trendUp
          />
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Threat Monitor */}
          <div className="lg:col-span-2 space-y-6">
            <ThreatMonitor
              threats={protocols.map(p => ({
                protocolName: p.name,
                protocolAddress: p.contractAddress,
                threatLevel: p.threatLevel,
                lastCheck: new Date(),
                status: getStatusFromThreatLevel(p.threatLevel),
                indicators: [],
              }))}
              isScanning={isScanning}
              latestAssessment={latestAssessment}
            />

            {/* Protocol Cards */}
            <div>
              <h2 className="text-xl font-bold mb-4">Protected Protocols</h2>
              {protocols.length === 0 ? (
                <Card className="p-8 bg-card border-border text-center">
                  <Shield className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Protocols Registered</h3>
                  <p className="text-muted-foreground mb-4">
                    Register your first protocol to start monitoring and protection
                  </p>
                  <Button
                    onClick={() => setShowRegisterModal(true)}
                    className="gap-2 bg-purple-600 hover:bg-purple-700"
                  >
                    <Plus className="w-4 h-4" />
                    Register Protocol
                  </Button>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {protocols.map((protocol) => (
                    <ProtocolCard
                      key={protocol.contractAddress}
                      protocol={protocol}
                      streamBalance={stream?.balance}
                      onPause={() => pauseProtocol(protocol.contractAddress)}
                      onUnpause={() => unpauseProtocol(protocol.contractAddress)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Column - Payment & Controls */}
          <div className="space-y-6">
            {/* Payment Stream */}
            <PaymentStream
              protocolName={protocols[0]?.name || 'No Protocol'}
              balance={stream?.balance || 0}
              ratePerBlock={stream?.ratePerBlock || 100000}
              isActive={stream?.isActive || false}
              isLoading={isProcessingStream || isStreamLoading}
              onAddFunds={handleAddFunds}
              onActivate={handleActivateStream}
            />

            {/* Emergency Pause */}
            <Card className="p-4 bg-card border-border">
              <h3 className="text-lg font-semibold mb-4">Emergency Controls</h3>
              <EmergencyPauseButton
                onTrigger={() => {
                  protocols.forEach((p) => {
                    if (!p.isPaused) {
                      pauseProtocol(p.contractAddress);
                    }
                  });
                }}
                isActive={protocols.some((p) => !p.isPaused)}
              />
            </Card>

            {/* Attack Simulation Status */}
            {attackInProgress && latestAssessment && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <Card className="p-4 bg-red-500/10 border-red-500/30">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="w-5 h-5 text-red-500 animate-pulse" />
                    <h3 className="font-semibold text-red-400">
                      Attack Detected!
                    </h3>
                  </div>
                  <Badge className="bg-red-500/20 text-red-400 mb-2">
                    {latestAssessment.attackType}
                  </Badge>
                  <p className="text-sm text-red-300/80">
                    {latestAssessment.recommendation}
                  </p>
                  <div className="mt-3 flex items-center gap-4 text-xs text-red-400/60">
                    <span>Threat: {latestAssessment.threatLevel}%</span>
                    <span>Confidence: {latestAssessment.confidence}%</span>
                  </div>
                </Card>
              </motion.div>
            )}
          </div>
        </div>
      </main>

      {/* Register Modal (Subscription-based) */}
      <RegisterProtocolModal
        isOpen={showRegisterModal}
        onClose={() => setShowRegisterModal(false)}
        onRegister={handleRegisterProtocol}
        isLoading={isRegistering}
      />

      {/* Bounty Registration Modal */}
      <BountyRegistrationModal
        isOpen={showBountyRegisterModal}
        onClose={() => setShowBountyRegisterModal(false)}
        onRegister={handleBountyRegister}
        isLoading={isBountyRegistering}
      />

      {/* Threat Analysis Modal */}
      <ThreatAnalysisModal
        isOpen={showThreatModal}
        onClose={() => {
          setShowThreatModal(false);
          setAttackInProgress(false);
        }}
        protocols={protocols}
        onAnalyze={handleThreatAnalysis}
        onPause={pauseProtocol}
        isAnalyzing={isThreatLoading || paymentState.isPending}
      />

      {/* x402 Payment Modal */}
      <X402PaymentModal
        open={paymentState.showModal}
        requirements={paymentState.requirements}
        isPending={paymentState.isPending}
        onPay={handlePaymentComplete}
        onCancel={() => {
          cancelPayment();
          setPendingAnalysis(null);
          setAttackInProgress(false);
        }}
      />

      {/* x402 Payment Success Toast */}
      {paymentState.lastPayment?.success && (
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 50 }}
          className="fixed bottom-4 right-4 z-50 max-w-sm"
        >
          <X402PaymentSuccess
            txHash={paymentState.lastPayment.txHash || ''}
            amount={PRICING.threatAnalysis}
          />
        </motion.div>
      )}
    </div>
  );
}
