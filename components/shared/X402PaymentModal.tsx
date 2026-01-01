'use client';

import { Loader2, CreditCard, ExternalLink, Shield, Zap, CheckCircle, Circle, AlertTriangle } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { PaymentRequirements, PaymentStep } from '@/hooks/useX402Payment';
import { PAYMENT_STEP_LABELS } from '@/hooks/useX402Payment';
import { X402_CONFIG, formatPrice, getExplorerTxUrl } from '@/lib/x402';

interface X402PaymentModalProps {
  open: boolean;
  requirements: PaymentRequirements | null;
  isPending: boolean;
  paymentStep?: PaymentStep;
  onPay: () => void;
  onCancel: () => void;
}

// Payment progress steps configuration
const PROGRESS_STEPS: { key: PaymentStep; label: string }[] = [
  { key: 'signing', label: 'Sign' },
  { key: 'broadcasting', label: 'Send' },
  { key: 'confirming', label: 'Confirm' },
  { key: 'retrying', label: 'Complete' },
];

function getStepStatus(
  currentStep: PaymentStep,
  stepKey: PaymentStep
): 'pending' | 'active' | 'complete' {
  const stepOrder = ['idle', 'signing', 'broadcasting', 'confirming', 'retrying', 'complete'];
  const currentIndex = stepOrder.indexOf(currentStep);
  const stepIndex = stepOrder.indexOf(stepKey);

  if (currentStep === 'error') {
    return 'pending';
  }
  if (stepIndex < currentIndex) {
    return 'complete';
  }
  if (stepIndex === currentIndex) {
    return 'active';
  }
  return 'pending';
}

function PaymentProgress({ currentStep }: { currentStep: PaymentStep }) {
  const isProcessing = currentStep !== 'idle' && currentStep !== 'error';

  if (!isProcessing) {
    return null;
  }

  return (
    <div className="py-4">
      {/* Progress Steps */}
      <div className="flex items-center justify-between mb-3">
        {PROGRESS_STEPS.map((step, index) => {
          const status = getStepStatus(currentStep, step.key);

          return (
            <div key={step.key} className="flex items-center flex-1">
              {/* Step indicator */}
              <div className="flex flex-col items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                    status === 'complete'
                      ? 'bg-green-500/20 border-2 border-green-500'
                      : status === 'active'
                      ? 'bg-purple-500/20 border-2 border-purple-500 animate-pulse'
                      : 'bg-muted border-2 border-border'
                  }`}
                >
                  {status === 'complete' ? (
                    <CheckCircle className="w-4 h-4 text-green-400" />
                  ) : status === 'active' ? (
                    <Loader2 className="w-4 h-4 text-purple-400 animate-spin" />
                  ) : (
                    <Circle className="w-4 h-4 text-muted-foreground" />
                  )}
                </div>
                <span
                  className={`text-xs mt-1 ${
                    status === 'active'
                      ? 'text-purple-400 font-medium'
                      : status === 'complete'
                      ? 'text-green-400'
                      : 'text-muted-foreground'
                  }`}
                >
                  {step.label}
                </span>
              </div>

              {/* Connector line */}
              {index < PROGRESS_STEPS.length - 1 && (
                <div
                  className={`flex-1 h-0.5 mx-2 ${
                    getStepStatus(currentStep, PROGRESS_STEPS[index + 1].key) === 'complete' ||
                    getStepStatus(currentStep, step.key) === 'complete'
                      ? 'bg-green-500/50'
                      : 'bg-border'
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Current step label */}
      <div className="text-center">
        <span className="text-sm text-purple-400 font-medium">
          {PAYMENT_STEP_LABELS[currentStep]}
        </span>
      </div>
    </div>
  );
}

export function X402PaymentModal({
  open,
  requirements,
  isPending,
  paymentStep = 'idle',
  onPay,
  onCancel,
}: X402PaymentModalProps) {
  if (!requirements) return null;

  // Format MOVE amount (no $ sign for native token)
  const formattedAmount = requirements.amount
    ? formatPrice(requirements.amount)
    : '0.0000';

  const isProcessing = paymentStep !== 'idle' && paymentStep !== 'error';

  return (
    <AlertDialog open={open} onOpenChange={(isOpen) => !isOpen && !isPending && onCancel()}>
      <AlertDialogContent className="sm:max-w-md bg-card border-border">
        <AlertDialogHeader>
          {/* Testnet Mode Banner */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-orange-500/10 border border-orange-500/30 mb-3">
            <AlertTriangle className="w-4 h-4 text-orange-400" />
            <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30">
              TESTNET MODE
            </Badge>
            <span className="text-xs text-orange-300">
              Testnet tokens - no real funds
            </span>
          </div>

          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-purple-500/20">
              <CreditCard className="w-6 h-6 text-purple-400" />
            </div>
            <AlertDialogTitle className="text-xl">Payment Required</AlertDialogTitle>
          </div>
          <AlertDialogDescription className="text-muted-foreground">
            This action requires a micropayment via the x402 protocol.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {/* Payment Progress */}
        <PaymentProgress currentStep={paymentStep} />

        {/* Payment Details (hide when processing) */}
        {!isProcessing && (
          <div className="space-y-4 py-4">
            {/* Amount */}
            <div className="p-4 rounded-lg bg-background/50 border border-border">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">Amount</span>
                <div className="text-right">
                  <span className="text-2xl font-bold text-purple-400">{formattedAmount}</span>
                  <span className="text-sm text-purple-300 ml-1">{requirements.token || X402_CONFIG.token}</span>
                </div>
              </div>
              {requirements.description && (
                <p className="text-sm text-muted-foreground mt-2">
                  {requirements.description}
                </p>
              )}
            </div>

            {/* Network & Token Info */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg bg-background/50 border border-border">
                <div className="text-xs text-muted-foreground mb-1">Network</div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-orange-400 border-orange-500/30">
                    Movement Bardock
                  </Badge>
                </div>
              </div>
              <div className="p-3 rounded-lg bg-background/50 border border-border">
                <div className="text-xs text-muted-foreground mb-1">Token</div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-purple-400 border-purple-500/30">
                    {requirements.token || X402_CONFIG.token}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Security Notice */}
            <div className="flex items-start gap-3 p-3 rounded-lg bg-purple-500/10 border border-purple-500/20">
              <Shield className="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-purple-400">Real On-Chain Transaction</p>
                <p className="text-muted-foreground text-xs mt-1">
                  Payment will be verified on the{' '}
                  <a
                    href={X402_CONFIG.explorerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-orange-400 hover:underline inline-flex items-center gap-1"
                  >
                    Movement blockchain
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </p>
              </div>
            </div>
          </div>
        )}

        <AlertDialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={isPending}
            className="w-full sm:w-auto"
          >
            Cancel
          </Button>
          <Button
            onClick={onPay}
            disabled={isPending}
            className="w-full sm:w-auto bg-purple-600 hover:bg-purple-700"
          >
            {isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {paymentStep === 'signing' && 'Signing...'}
                {paymentStep === 'broadcasting' && 'Broadcasting...'}
                {paymentStep === 'confirming' && 'Confirming...'}
                {paymentStep === 'retrying' && 'Completing...'}
                {!['signing', 'broadcasting', 'confirming', 'retrying'].includes(paymentStep) && 'Processing...'}
              </>
            ) : (
              <>
                <Zap className="w-4 h-4 mr-2" />
                Pay {formattedAmount} MOVE
              </>
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/**
 * Payment success toast/notification component - Enhanced version
 */
interface PaymentSuccessProps {
  txHash: string;
  amount?: string;
  gasUsed?: string;
  from?: string;
  to?: string;
  explorerUrl?: string;
}

export function X402PaymentSuccess({
  txHash,
  amount,
  gasUsed,
  explorerUrl
}: PaymentSuccessProps) {
  // Movement explorer URL format
  const txExplorerUrl = explorerUrl || getExplorerTxUrl(txHash);

  // Truncate tx hash for display
  const truncatedHash = txHash ? `${txHash.slice(0, 10)}...${txHash.slice(-8)}` : '';

  return (
    <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/30">
      <div className="flex items-center gap-2 mb-3">
        <CheckCircle className="w-5 h-5 text-green-400" />
        <h3 className="font-semibold text-green-400">Payment Successful!</h3>
      </div>

      <p className="text-sm text-muted-foreground mb-3">
        Real transaction on Movement Bardock Testnet
      </p>

      <div className="space-y-2 text-sm">
        {amount && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Amount:</span>
            <span className="font-medium">{formatPrice(amount)} MOVE</span>
          </div>
        )}
        {gasUsed && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Gas Used:</span>
            <span className="font-mono text-xs">{gasUsed} octas</span>
          </div>
        )}
        {txHash && (
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Transaction:</span>
            <a
              href={txExplorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-orange-400 hover:underline inline-flex items-center gap-1 font-mono text-xs"
            >
              {truncatedHash}
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

export default X402PaymentModal;
