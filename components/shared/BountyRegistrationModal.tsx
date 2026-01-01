'use client';

import { useState } from 'react';
import { Loader2, Shield, AlertTriangle, ExternalLink, Coins, CheckCircle } from 'lucide-react';
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
import { Input } from '@/components/ui/input';
import { MIN_BOUNTY_DEPOSIT } from '@/lib/constants';

interface BountyRegistrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRegister: (name: string, address: string, amount: number) => Promise<void>;
  isLoading: boolean;
}

const MIN_MOVE = MIN_BOUNTY_DEPOSIT / 100_000_000; // 1 MOVE

export function BountyRegistrationModal({
  isOpen,
  onClose,
  onRegister,
  isLoading,
}: BountyRegistrationModalProps) {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [amount, setAmount] = useState(MIN_MOVE.toString());
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setError(null);

    // Validate inputs
    if (!name.trim()) {
      setError('Protocol name is required');
      return;
    }

    if (!address.trim()) {
      setError('Contract address is required');
      return;
    }

    if (!address.startsWith('0x') || address.length < 10) {
      setError('Invalid contract address format (must start with 0x)');
      return;
    }

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum < MIN_MOVE) {
      setError(`Minimum deposit is ${MIN_MOVE} MOVE`);
      return;
    }

    // Convert MOVE to octas
    const amountOctas = Math.floor(amountNum * 100_000_000);

    try {
      await onRegister(name.trim(), address.trim(), amountOctas);
      // Reset form on success
      setName('');
      setAddress('');
      setAmount(MIN_MOVE.toString());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      setError(null);
      onClose();
    }
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <AlertDialogContent className="sm:max-w-lg bg-card border-border">
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
            <div className="p-2 rounded-lg bg-green-500/20">
              <Shield className="w-6 h-6 text-green-400" />
            </div>
            <AlertDialogTitle className="text-xl">Register for Bounty Protection</AlertDialogTitle>
          </div>
          <AlertDialogDescription className="text-muted-foreground">
            Register your protocol for bounty-based security protection. Your deposit funds the bounty vault for vulnerability rewards.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-4 py-4">
          {/* Protocol Name */}
          <div className="space-y-2">
            <label htmlFor="protocol-name" className="block text-sm font-medium">Protocol Name</label>
            <Input
              id="protocol-name"
              placeholder="e.g., MyDeFi Protocol"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isLoading}
              className="bg-background"
            />
          </div>

          {/* Contract Address */}
          <div className="space-y-2">
            <label htmlFor="contract-address" className="block text-sm font-medium">Contract Address</label>
            <Input
              id="contract-address"
              placeholder="0x..."
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              disabled={isLoading}
              className="bg-background font-mono text-sm"
            />
          </div>

          {/* Deposit Amount */}
          <div className="space-y-2">
            <label htmlFor="deposit-amount" className="block text-sm font-medium">Deposit Amount (MOVE)</label>
            <div className="relative">
              <Input
                id="deposit-amount"
                type="number"
                min={MIN_MOVE}
                step="0.1"
                placeholder={MIN_MOVE.toString()}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                disabled={isLoading}
                className="bg-background pr-16"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                MOVE
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Minimum deposit: {MIN_MOVE} MOVE. These funds will be used to pay bounty rewards.
            </p>
          </div>

          {/* Error Display */}
          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {/* Info Box */}
          <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20">
            <div className="flex items-start gap-3">
              <Coins className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-green-400 mb-1">How Bounty Protection Works</p>
                <ul className="text-muted-foreground text-xs space-y-1">
                  <li className="flex items-center gap-1">
                    <CheckCircle className="w-3 h-3 text-green-400" />
                    GuardBot monitors your protocol for vulnerabilities
                  </li>
                  <li className="flex items-center gap-1">
                    <CheckCircle className="w-3 h-3 text-green-400" />
                    Researchers can submit vulnerability reports
                  </li>
                  <li className="flex items-center gap-1">
                    <CheckCircle className="w-3 h-3 text-green-400" />
                    Valid reports are rewarded from your deposited funds
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        <AlertDialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isLoading}
            className="w-full sm:w-auto"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isLoading}
            className="w-full sm:w-auto bg-green-600 hover:bg-green-700"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Registering...
              </>
            ) : (
              <>
                <Shield className="w-4 h-4 mr-2" />
                Register & Deposit {amount || MIN_MOVE} MOVE
              </>
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export default BountyRegistrationModal;
