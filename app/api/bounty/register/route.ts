/**
 * Bounty Protocol Registration API
 *
 * POST /api/bounty/register
 *
 * Registers a protocol for bounty-based protection:
 * 1. Validates deposit amount (minimum 1 MOVE)
 * 2. Funds the bounty vault with the deposit
 * 3. Returns transaction hash and protocol info
 *
 * Note: Unlike subscription-based registration, bounty-based protection
 * only requires funding the vault. The guardian contract registration is
 * optional and may fail if a protocol is already registered with the same signer.
 */

import { NextRequest, NextResponse } from 'next/server';
import { fundVault } from '@/lib/signer';
import { MIN_BOUNTY_DEPOSIT } from '@/lib/constants';

interface RegisterRequest {
  name: string;
  contractAddress: string;
  depositAmount: number; // in octas
}

interface RegisterResponse {
  success: boolean;
  error?: string;
  fundTxHash?: string;
  protocol?: {
    name: string;
    contractAddress: string;
    depositAmount: number;
    registrationType: 'bounty';
  };
}

export async function POST(request: NextRequest): Promise<NextResponse<RegisterResponse>> {
  try {
    const body: RegisterRequest = await request.json();
    const { name, contractAddress, depositAmount } = body;

    // Validate required fields
    if (!name || !contractAddress || !depositAmount) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields: name, contractAddress, depositAmount',
      }, { status: 400 });
    }

    // Validate deposit amount
    if (depositAmount < MIN_BOUNTY_DEPOSIT) {
      const minMove = MIN_BOUNTY_DEPOSIT / 100_000_000;
      return NextResponse.json({
        success: false,
        error: `Deposit must be at least ${minMove} MOVE (${MIN_BOUNTY_DEPOSIT} octas)`,
      }, { status: 400 });
    }

    // Validate contract address format
    if (!contractAddress.startsWith('0x') || contractAddress.length < 10) {
      return NextResponse.json({
        success: false,
        error: 'Invalid contract address format',
      }, { status: 400 });
    }

    console.log(`bounty-register: Registering protocol "${name}" at ${contractAddress}`);
    console.log(`bounty-register: Deposit amount: ${depositAmount} octas (${depositAmount / 100_000_000} MOVE)`);

    // Fund the bounty vault with the deposit
    // Note: For bounty-based protection, we only need to fund the vault.
    // The protocol is tracked locally in the registry, not on-chain.
    const fundResult = await fundVault(depositAmount);

    if (!fundResult.success) {
      console.error(`bounty-register: Vault funding failed: ${fundResult.error}`);
      return NextResponse.json({
        success: false,
        error: `Vault funding failed: ${fundResult.error}`,
      }, { status: 500 });
    }

    console.log(`bounty-register: Vault funded - ${fundResult.hash}`);

    // Success - return transaction hash
    return NextResponse.json({
      success: true,
      fundTxHash: fundResult.hash,
      protocol: {
        name,
        contractAddress,
        depositAmount,
        registrationType: 'bounty',
      },
    });

  } catch (error) {
    console.error('bounty-register: Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

export async function GET(): Promise<NextResponse> {
  const minMove = MIN_BOUNTY_DEPOSIT / 100_000_000;
  return NextResponse.json({
    endpoint: '/api/bounty/register',
    description: 'Register a protocol for bounty-based protection',
    minDeposit: {
      move: minMove,
      octas: MIN_BOUNTY_DEPOSIT,
    },
    requiredFields: ['name', 'contractAddress', 'depositAmount'],
  });
}
