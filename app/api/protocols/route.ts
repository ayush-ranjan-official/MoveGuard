import { NextRequest, NextResponse } from 'next/server';
import {
  registerProtocol,
  triggerPause,
  unpauseProtocol,
  updateThreatLevel,
  setProtectionStatus,
  getDeployerAddress,
} from '@/lib/signer';
import {
  isProtocolPaused,
  getThreatLevel,
  isProtectionActive,
} from '@/lib/movement';

// Validate hex address format
function isValidHexAddress(address: string): boolean {
  if (!address || !address.startsWith('0x') || address.length < 10) {
    return false;
  }
  // Check if all characters after 0x are valid hex digits
  const hexPart = address.slice(2);
  return /^[0-9a-fA-F]+$/.test(hexPart);
}

type ProtocolAction =
  | 'register'
  | 'pause'
  | 'unpause'
  | 'update_threat'
  | 'set_protection'
  | 'get_status';

interface ProtocolRequest {
  action: ProtocolAction;
  // For register
  name?: string;
  contractAddress?: string;
  // For pause/update_threat/set_protection
  protocolAdmin?: string;
  threatType?: string;
  severity?: number;
  confidence?: number;
  // For set_protection
  active?: boolean;
}

/**
 * POST /api/protocols
 * Manage protocol registration, pause, unpause, and threat levels
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ProtocolRequest;
    const { action } = body;

    console.log(`Protocol action: ${action}`, body);

    switch (action) {
      case 'register': {
        const { name, contractAddress } = body;
        if (!name || !contractAddress) {
          return NextResponse.json(
            { error: 'Name and contractAddress required' },
            { status: 400 }
          );
        }

        // Validate hex address format
        if (!isValidHexAddress(contractAddress)) {
          return NextResponse.json(
            { error: `Invalid contractAddress: ${contractAddress}. Must be a valid hex address.` },
            { status: 400 }
          );
        }

        const result = await registerProtocol(name, contractAddress);
        return NextResponse.json({
          success: result.success,
          action: 'register',
          name,
          contractAddress,
          txHash: result.hash,
          error: result.error,
        });
      }

      case 'pause': {
        const { protocolAdmin, threatType, severity, confidence } = body;
        if (!protocolAdmin) {
          return NextResponse.json(
            { error: 'protocolAdmin required' },
            { status: 400 }
          );
        }

        // Validate hex address format
        if (!isValidHexAddress(protocolAdmin)) {
          return NextResponse.json(
            { error: `Invalid protocolAdmin address: ${protocolAdmin}. Must be a valid hex address.` },
            { status: 400 }
          );
        }

        const result = await triggerPause(
          protocolAdmin,
          threatType || 'AI_DETECTED_THREAT',
          severity || 85,
          confidence || 90
        );

        return NextResponse.json({
          success: result.success,
          action: 'pause',
          protocolAdmin,
          threatType: threatType || 'AI_DETECTED_THREAT',
          severity: severity || 85,
          txHash: result.hash,
          error: result.error,
        });
      }

      case 'unpause': {
        const result = await unpauseProtocol();
        return NextResponse.json({
          success: result.success,
          action: 'unpause',
          txHash: result.hash,
          error: result.error,
        });
      }

      case 'update_threat': {
        const { protocolAdmin, severity } = body;
        if (!protocolAdmin || severity === undefined) {
          return NextResponse.json(
            { error: 'protocolAdmin and severity required' },
            { status: 400 }
          );
        }

        if (!isValidHexAddress(protocolAdmin)) {
          return NextResponse.json(
            { error: `Invalid protocolAdmin address: ${protocolAdmin}` },
            { status: 400 }
          );
        }

        const result = await updateThreatLevel(protocolAdmin, severity);
        return NextResponse.json({
          success: result.success,
          action: 'update_threat',
          protocolAdmin,
          newLevel: severity,
          txHash: result.hash,
          error: result.error,
        });
      }

      case 'set_protection': {
        const { protocolAdmin, active } = body;
        if (!protocolAdmin || active === undefined) {
          return NextResponse.json(
            { error: 'protocolAdmin and active required' },
            { status: 400 }
          );
        }

        if (!isValidHexAddress(protocolAdmin)) {
          return NextResponse.json(
            { error: `Invalid protocolAdmin address: ${protocolAdmin}` },
            { status: 400 }
          );
        }

        const result = await setProtectionStatus(protocolAdmin, active);
        return NextResponse.json({
          success: result.success,
          action: 'set_protection',
          protocolAdmin,
          active,
          txHash: result.hash,
          error: result.error,
        });
      }

      case 'get_status': {
        const { protocolAdmin } = body;
        if (!protocolAdmin) {
          return NextResponse.json(
            { error: 'protocolAdmin required' },
            { status: 400 }
          );
        }

        if (!isValidHexAddress(protocolAdmin)) {
          return NextResponse.json(
            { error: `Invalid protocolAdmin address: ${protocolAdmin}` },
            { status: 400 }
          );
        }

        const [paused, threatLvl, protectionActive] = await Promise.all([
          isProtocolPaused(protocolAdmin),
          getThreatLevel(protocolAdmin),
          isProtectionActive(protocolAdmin),
        ]);

        return NextResponse.json({
          success: true,
          action: 'get_status',
          protocolAdmin,
          status: {
            isPaused: paused,
            threatLevel: threatLvl,
            protectionActive,
          },
        });
      }

      default:
        return NextResponse.json(
          { error: `Invalid action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Protocol API error:', error);
    return NextResponse.json(
      {
        error: 'Protocol operation failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/protocols
 * Get protocol API status
 */
export async function GET() {
  try {
    const deployerAddress = getDeployerAddress();

    return NextResponse.json({
      status: 'Protocol API operational',
      deployerAddress,
      oracleAddress: deployerAddress,
      actions: [
        'register',
        'pause',
        'unpause',
        'update_threat',
        'set_protection',
        'get_status',
      ],
    });
  } catch {
    return NextResponse.json(
      { error: 'Failed to get API status' },
      { status: 500 }
    );
  }
}
