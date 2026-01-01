'use client';

import { useState, useCallback } from 'react';
import type { ThreatAssessment, Transaction } from '@/lib/types';

// Fallback safe assessment for error cases
function getSafeAssessment(): ThreatAssessment {
  return {
    threatLevel: Math.floor(Math.random() * 15) + 5,
    attackType: null,
    confidence: 95,
    recommendation: 'No threats detected. System operating normally.',
    indicators: [],
    timestamp: Date.now(),
  };
}

export function useThreats() {
  const [isLoading, setIsLoading] = useState(false);
  const [isScanning, setIsScanning] = useState(true);
  const [latestAssessment, setLatestAssessment] = useState<ThreatAssessment | null>(
    null
  );
  const [attackHistory, setAttackHistory] = useState<ThreatAssessment[]>([]);
  const [isUsingRealAI, setIsUsingRealAI] = useState(false);

  // Analyze transactions using real ATXP AI (via API route)
  const analyzeTransactions = useCallback(
    async (transactions: Transaction[], protocolContext?: string) => {
      setIsLoading(true);
      try {
        const response = await fetch('/api/threats/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ transactions, protocolContext }),
        });

        if (!response.ok) throw new Error('Analysis failed');

        const data = await response.json();
        const assessment = data.assessment as ThreatAssessment;
        setIsUsingRealAI(data.mode === 'real');

        setLatestAssessment(assessment);
        setAttackHistory((prev) => [assessment, ...prev].slice(0, 10));
        return assessment;
      } catch (error) {
        console.error('Threat analysis error:', error);
        const fallback = getSafeAssessment();
        fallback.recommendation = 'Analysis unavailable - manual review recommended';
        return fallback;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  // Analyze attack scenario using real ATXP AI
  // Returns assessment with autoPause info if API triggered on-chain pause
  const simulateAttack = useCallback(
    async (
      type: 'flash_loan' | 'oracle' | 'sandwich' | 'reentrancy' = 'flash_loan',
      protocolAddress?: string
    ): Promise<ThreatAssessment & { autoPauseTriggered?: boolean; autoPauseTxHash?: string }> => {
      setIsLoading(true);
      try {
        const response = await fetch('/api/threats/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            attackType: type,
            protocolAddress,
            protocolContext: protocolAddress ? `Protocol address: ${protocolAddress}` : undefined,
          }),
        });

        if (!response.ok) throw new Error('Analysis failed');

        const data = await response.json();
        const assessment = data.assessment as ThreatAssessment;
        setIsUsingRealAI(data.mode === 'real');

        // Check if API already triggered auto-pause
        const autoPauseTriggered = data.autoPause?.triggered || false;
        const autoPauseTxHash = data.autoPause?.txHash;

        console.log(`ATXP AI Analysis complete (mode: ${data.mode}):`, assessment);
        if (autoPauseTriggered) {
          console.log(`Auto-pause triggered by API: ${autoPauseTxHash}`);
        }

        setLatestAssessment(assessment);
        setAttackHistory((prev) => [assessment, ...prev].slice(0, 10));

        return { ...assessment, autoPauseTriggered, autoPauseTxHash };
      } catch (error) {
        console.error('AI analysis error:', error);
        // Fallback to basic assessment on error
        const fallbackAssessment: ThreatAssessment = {
          threatLevel: 75,
          attackType: type.toUpperCase().replace('_', ' ') + ' ATTACK',
          confidence: 50,
          recommendation: 'AI analysis unavailable - manual review recommended',
          indicators: ['Network error - using fallback assessment'],
          timestamp: Date.now(),
        };
        setIsUsingRealAI(false);
        setLatestAssessment(fallbackAssessment);
        setAttackHistory((prev) => [fallbackAssessment, ...prev].slice(0, 10));
        return fallbackAssessment;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const clearThreat = useCallback(() => {
    setLatestAssessment(getSafeAssessment());
  }, []);

  const toggleScanning = useCallback(() => {
    setIsScanning((prev) => !prev);
  }, []);

  // Allow external updates to assessment (e.g., from x402 payment flow)
  const updateAssessment = useCallback((assessment: ThreatAssessment) => {
    setLatestAssessment(assessment);
    setAttackHistory((prev) => [assessment, ...prev].slice(0, 10));
  }, []);

  return {
    isLoading,
    isScanning,
    isUsingRealAI,
    latestAssessment,
    attackHistory,
    simulateAttack,
    analyzeTransactions,
    clearThreat,
    toggleScanning,
    updateAssessment,
  };
}
