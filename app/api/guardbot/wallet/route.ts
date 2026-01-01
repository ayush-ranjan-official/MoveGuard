/**
 * GuardBot Wallet API
 *
 * GET /api/guardbot/wallet - Get agent wallet info
 * POST /api/guardbot/wallet - Initialize or fund agent wallet
 *
 * Manages the agent's wallet state and funding.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAgentWallet, createAgentWallet } from '@/lib/guardbot/agent-wallet';
import { fundVault } from '@/lib/signer';
import type { WalletResponse, ActivityLogEntry } from '@/lib/guardbot/types';

function generateActivityId(): string {
  return `activity_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

/**
 * GET /api/guardbot/wallet
 * Returns current agent wallet information
 */
export async function GET(): Promise<NextResponse<WalletResponse>> {
  try {
    const wallet = await getAgentWallet();

    if (!wallet) {
      return NextResponse.json({
        success: false,
        error: 'Agent wallet not initialized. POST to create.',
      });
    }

    return NextResponse.json({
      success: true,
      wallet,
    });
  } catch (error) {
    console.error('guardbot-wallet: GET error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

/**
 * POST /api/guardbot/wallet
 * Initialize or fund the agent wallet
 */
export async function POST(request: NextRequest): Promise<NextResponse<WalletResponse & { activities?: ActivityLogEntry[] }>> {
  const activities: ActivityLogEntry[] = [];

  try {
    const body = await request.json().catch(() => ({}));
    const { action } = body;

    if (action === 'create' || !action) {
      // Create/initialize agent wallet
      console.log('guardbot-wallet: Creating agent wallet');

      const wallet = await createAgentWallet();

      activities.push({
        id: generateActivityId(),
        timestamp: Date.now(),
        type: 'wallet',
        message: `Agent wallet created: ${wallet.address.slice(0, 8)}...${wallet.address.slice(-4)}`,
        severity: 'success',
      });

      activities.push({
        id: generateActivityId(),
        timestamp: Date.now(),
        type: 'info',
        message: `Balance: ${wallet.balanceMove} MOVE`,
        severity: 'info',
      });

      return NextResponse.json({
        success: true,
        wallet,
        activities,
      });
    }

    if (action === 'fund_vault') {
      // Fund the bounty vault with MOVE
      const { amount = 500000000 } = body; // Default 5 MOVE in octas
      console.log(`guardbot-wallet: Funding bounty vault with ${amount} octas`);

      const result = await fundVault(amount);

      if (!result.success) {
        activities.push({
          id: generateActivityId(),
          timestamp: Date.now(),
          type: 'error',
          message: `Failed to fund vault: ${result.error}`,
          severity: 'error',
        });

        return NextResponse.json({
          success: false,
          error: result.error,
          activities,
        }, { status: 500 });
      }

      activities.push({
        id: generateActivityId(),
        timestamp: Date.now(),
        type: 'info',
        message: `Funded bounty vault with ${(amount / 100000000).toFixed(2)} MOVE`,
        severity: 'success',
      });

      return NextResponse.json({
        success: true,
        txHash: result.hash,
        activities,
      });
    }

    // Unknown action
    return NextResponse.json({
      success: false,
      error: `Unknown action: ${action}`,
      activities: [],
    }, { status: 400 });

  } catch (error) {
    console.error('guardbot-wallet: POST error:', error);

    activities.push({
      id: generateActivityId(),
      timestamp: Date.now(),
      type: 'error',
      message: error instanceof Error ? error.message : 'Unknown error',
      severity: 'error',
    });

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      activities,
    }, { status: 500 });
  }
}
