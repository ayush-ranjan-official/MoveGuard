'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import type { ActivityLogEntry, ActivityType, ActivitySeverity } from '@/lib/guardbot/types';

const MAX_LOG_ENTRIES = 100;

interface UseActivityLogReturn {
  activities: ActivityLogEntry[];
  addActivity: (activity: Omit<ActivityLogEntry, 'id' | 'timestamp'>) => ActivityLogEntry;
  clearActivities: () => void;
  getLatestActivity: () => ActivityLogEntry | null;
  getActivitiesByType: (type: ActivityType) => ActivityLogEntry[];
}

export function useActivityLog(): UseActivityLogReturn {
  const [activities, setActivities] = useState<ActivityLogEntry[]>([]);
  const idCounter = useRef(0);

  const addActivity = useCallback((
    activity: Omit<ActivityLogEntry, 'id' | 'timestamp'>
  ): ActivityLogEntry => {
    const newActivity: ActivityLogEntry = {
      ...activity,
      id: `activity_${Date.now()}_${++idCounter.current}`,
      timestamp: Date.now(),
    };

    setActivities((prev) => {
      const updated = [newActivity, ...prev];
      // Keep only the most recent entries
      return updated.slice(0, MAX_LOG_ENTRIES);
    });

    return newActivity;
  }, []);

  const clearActivities = useCallback(() => {
    setActivities([]);
  }, []);

  const getLatestActivity = useCallback((): ActivityLogEntry | null => {
    return activities[0] || null;
  }, [activities]);

  const getActivitiesByType = useCallback((type: ActivityType): ActivityLogEntry[] => {
    return activities.filter((a) => a.type === type);
  }, [activities]);

  return {
    activities,
    addActivity,
    clearActivities,
    getLatestActivity,
    getActivitiesByType,
  };
}

// Activity helper functions
export function createPaymentActivity(
  amount: string,
  txHash: string,
  description: string = 'Payment sent'
): Omit<ActivityLogEntry, 'id' | 'timestamp'> {
  return {
    type: 'payment',
    message: `${description}: ${amount} MOVE`,
    txHash,
    amountMove: amount,
    severity: 'success',
  };
}

export function createAnalysisActivity(
  protocolAddress: string,
  threatLevel: number
): Omit<ActivityLogEntry, 'id' | 'timestamp'> {
  const severity: ActivitySeverity =
    threatLevel >= 70 ? 'error' :
    threatLevel >= 50 ? 'warning' : 'info';

  return {
    type: 'analysis',
    message: `Analysis complete: Threat Level ${threatLevel}%`,
    protocolAddress,
    threatLevel,
    severity,
  };
}

export function createThreatActivity(
  attackType: string,
  threatLevel: number,
  confidence: number
): Omit<ActivityLogEntry, 'id' | 'timestamp'> {
  return {
    type: 'threat',
    message: `THREAT DETECTED: ${attackType} (${threatLevel}% threat, ${confidence}% confidence)`,
    threatLevel,
    severity: 'error',
  };
}

export function createReportActivity(
  txHash: string,
  feeAmount: string
): Omit<ActivityLogEntry, 'id' | 'timestamp'> {
  return {
    type: 'report',
    message: `Vulnerability report submitted (fee: ${feeAmount} MOVE)`,
    txHash,
    amountMove: feeAmount,
    severity: 'success',
  };
}

export function createBountyActivity(
  amount: string,
  severity: string
): Omit<ActivityLogEntry, 'id' | 'timestamp'> {
  return {
    type: 'bounty',
    message: `Pending bounty: ${amount} MOVE (${severity} severity)`,
    amountMove: amount,
    severity: 'success',
  };
}

export function createErrorActivity(
  message: string
): Omit<ActivityLogEntry, 'id' | 'timestamp'> {
  return {
    type: 'error',
    message,
    severity: 'error',
  };
}

export function createInfoActivity(
  message: string
): Omit<ActivityLogEntry, 'id' | 'timestamp'> {
  return {
    type: 'info',
    message,
    severity: 'info',
  };
}

export function createWalletActivity(
  message: string,
  address?: string
): Omit<ActivityLogEntry, 'id' | 'timestamp'> {
  return {
    type: 'wallet',
    message,
    severity: 'success',
  };
}
