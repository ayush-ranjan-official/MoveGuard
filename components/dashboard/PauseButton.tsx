'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldOff, Shield, AlertTriangle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';

interface PauseButtonProps {
  protocolName: string;
  isPaused: boolean;
  onPause: () => Promise<void>;
  onUnpause: () => Promise<void>;
  className?: string;
}

export function PauseButton({
  protocolName,
  isPaused,
  onPause,
  onUnpause,
  className,
}: PauseButtonProps) {
  const [showDialog, setShowDialog] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleAction = async () => {
    setIsLoading(true);
    try {
      if (isPaused) {
        await onUnpause();
      } else {
        await onPause();
      }
    } finally {
      setIsLoading(false);
      setShowDialog(false);
    }
  };

  return (
    <>
      <Button
        variant={isPaused ? 'default' : 'destructive'}
        size="lg"
        onClick={() => setShowDialog(true)}
        disabled={isLoading}
        className={cn(
          'gap-2 font-semibold transition-all',
          isPaused
            ? 'bg-purple-600 hover:bg-purple-700'
            : 'bg-red-600 hover:bg-red-700',
          className
        )}
      >
        {isLoading ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : isPaused ? (
          <Shield className="w-5 h-5" />
        ) : (
          <ShieldOff className="w-5 h-5" />
        )}
        {isPaused ? 'Resume Protection' : 'Emergency Pause'}
      </Button>

      <AlertDialog open={showDialog} onOpenChange={setShowDialog}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              {isPaused ? (
                <>
                  <Shield className="w-5 h-5 text-purple-500" />
                  Resume Protection
                </>
              ) : (
                <>
                  <AlertTriangle className="w-5 h-5 text-red-500" />
                  Emergency Pause
                </>
              )}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {isPaused ? (
                <>
                  Are you sure you want to resume protection for{' '}
                  <strong>{protocolName}</strong>? This will re-enable all
                  contract functions.
                </>
              ) : (
                <>
                  Are you sure you want to pause{' '}
                  <strong>{protocolName}</strong>? This will immediately halt
                  all contract operations to prevent potential exploit damage.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleAction}
              className={cn(
                isPaused
                  ? 'bg-purple-600 hover:bg-purple-700'
                  : 'bg-red-600 hover:bg-red-700'
              )}
            >
              {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {isPaused ? 'Resume' : 'Pause Now'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// Large emergency pause button for dashboard
export function EmergencyPauseButton({
  onTrigger,
  isActive = true,
}: {
  onTrigger: () => void;
  isActive?: boolean;
}) {
  const [isPressed, setIsPressed] = useState(false);

  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onMouseDown={() => setIsPressed(true)}
      onMouseUp={() => setIsPressed(false)}
      onMouseLeave={() => setIsPressed(false)}
      onClick={onTrigger}
      disabled={!isActive}
      className={cn(
        'relative p-8 rounded-2xl border-4 transition-all duration-300',
        'flex flex-col items-center justify-center gap-3',
        isActive
          ? 'border-red-500/50 bg-red-500/10 hover:bg-red-500/20 cursor-pointer'
          : 'border-gray-500/50 bg-gray-500/10 cursor-not-allowed opacity-50',
        isPressed && isActive && 'bg-red-500/30'
      )}
    >
      <AnimatePresence>
        {isActive && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ repeat: Infinity, duration: 2 }}
            className="absolute inset-0 rounded-2xl border-2 border-red-500/30"
          />
        )}
      </AnimatePresence>

      <ShieldOff
        className={cn(
          'w-12 h-12',
          isActive ? 'text-red-500' : 'text-gray-500'
        )}
      />
      <span
        className={cn(
          'text-lg font-bold uppercase',
          isActive ? 'text-red-500' : 'text-gray-500'
        )}
      >
        Emergency Pause
      </span>
      <span className="text-xs text-muted-foreground">
        Click to pause all protected protocols
      </span>
    </motion.button>
  );
}
