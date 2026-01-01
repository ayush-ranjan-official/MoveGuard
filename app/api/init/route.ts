import { NextRequest, NextResponse } from 'next/server';
import {
  initializeGuardian,
  initializeTreasury,
  initializeBountyVault,
  checkInitializationStatus,
  getDeployerAddress,
} from '@/lib/signer';

/**
 * POST /api/init
 * Initialize all MoveGuard contracts (one-time setup)
 *
 * Initializes:
 * 1. Guardian registry (oracle = deployer)
 * 2. Payment stream treasury
 * 3. Bounty vault (validator = deployer, initial funding = 1 MOVE)
 */
export async function POST(_request: NextRequest) {
  try {
    const deployerAddress = getDeployerAddress();
    console.log('Initializing contracts with deployer:', deployerAddress);

    // Check current status
    const status = await checkInitializationStatus();
    console.log('Current initialization status:', status);

    const results: {
      guardian?: { hash: string; success: boolean; skipped?: boolean };
      treasury?: { hash: string; success: boolean; skipped?: boolean };
      bountyVault?: { hash: string; success: boolean; skipped?: boolean };
    } = {};

    // Initialize Guardian (if not already initialized)
    if (!status.guardian) {
      console.log('Initializing Guardian with oracle:', deployerAddress);
      results.guardian = await initializeGuardian(deployerAddress);
      console.log('Guardian result:', results.guardian);
    } else {
      console.log('Guardian already initialized, skipping...');
      results.guardian = { hash: '', success: true, skipped: true };
    }

    // Initialize Treasury (if not already initialized)
    if (!status.treasury) {
      console.log('Initializing Treasury...');
      results.treasury = await initializeTreasury();
      console.log('Treasury result:', results.treasury);
    } else {
      console.log('Treasury already initialized, skipping...');
      results.treasury = { hash: '', success: true, skipped: true };
    }

    // Initialize Bounty Vault (if not already initialized)
    if (!status.bountyVault) {
      // Initial funding: 1 MOVE = 100,000,000 octas
      const initialFunding = 100_000_000;
      console.log(`Initializing Bounty Vault with validator: ${deployerAddress}, funding: ${initialFunding}`);
      results.bountyVault = await initializeBountyVault(deployerAddress, initialFunding);
      console.log('Bounty Vault result:', results.bountyVault);
    } else {
      console.log('Bounty Vault already initialized, skipping...');
      results.bountyVault = { hash: '', success: true, skipped: true };
    }

    // Check if all succeeded
    const allSuccess =
      results.guardian?.success &&
      results.treasury?.success &&
      results.bountyVault?.success;

    // Verify final status
    const finalStatus = await checkInitializationStatus();

    return NextResponse.json({
      success: allSuccess,
      deployerAddress,
      results,
      status: finalStatus,
      message: allSuccess
        ? 'All contracts initialized successfully'
        : 'Some contracts failed to initialize',
    });
  } catch (error) {
    console.error('Initialization error:', error);
    return NextResponse.json(
      {
        error: 'Failed to initialize contracts',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/init
 * Check initialization status
 */
export async function GET() {
  try {
    const status = await checkInitializationStatus();
    const deployerAddress = getDeployerAddress();

    return NextResponse.json({
      deployerAddress,
      status,
      fullyInitialized: status.guardian && status.treasury && status.bountyVault,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Failed to check initialization status',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
