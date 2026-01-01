// Movement SDK configuration for MoveGuard V2
import { Aptos, AptosConfig, Network } from '@aptos-labs/ts-sdk';
import { MOVEMENT_CONFIG, MODULE_ADDRESS, MODULES } from './constants';

// Initialize Aptos client for Movement
const config = new AptosConfig({
  network: Network.CUSTOM,
  fullnode: MOVEMENT_CONFIG.testnet.fullnode,
  indexer: MOVEMENT_CONFIG.testnet.indexer,
});

export const aptos = new Aptos(config);

// Helper to format addresses
export function formatAddress(address: string): string {
  if (!address) return '';
  if (address.length <= 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

// Helper to convert octas to MOVE
export function octasToMove(octas: number | string): string {
  const value = typeof octas === 'string' ? parseInt(octas) : octas;
  return (value / 1e8).toFixed(4);
}

// Helper to convert MOVE to octas
export function moveToOctas(move: number): number {
  return Math.floor(move * 1e8);
}

// View function to check if protocol is paused
export async function isProtocolPaused(protocolAddress: string): Promise<boolean> {
  if (!protocolAddress || protocolAddress.length < 10) {
    return false; // Skip invalid addresses
  }
  try {
    const result = await aptos.view({
      payload: {
        function: `${MODULES.guardian}::is_protocol_paused`,
        functionArguments: [protocolAddress],
      },
    });
    return result[0] as boolean;
  } catch {
    // Protocol may not be registered - this is expected
    return false;
  }
}

// View function to get threat level
export async function getThreatLevel(protocolAddress: string): Promise<number> {
  if (!protocolAddress || protocolAddress.length < 10) {
    return 0; // Skip invalid addresses
  }
  try {
    const result = await aptos.view({
      payload: {
        function: `${MODULES.guardian}::get_threat_level`,
        functionArguments: [protocolAddress],
      },
    });
    return result[0] as number;
  } catch {
    // Protocol may not be registered - this is expected
    return 0;
  }
}

// View function to check protection status
export async function isProtectionActive(protocolAddress: string): Promise<boolean> {
  if (!protocolAddress || protocolAddress.length < 10) {
    return false; // Skip invalid addresses
  }
  try {
    const result = await aptos.view({
      payload: {
        function: `${MODULES.guardian}::is_protection_active`,
        functionArguments: [protocolAddress],
      },
    });
    return result[0] as boolean;
  } catch {
    // Protocol may not be registered - this is expected
    return false;
  }
}

// Helper to check if address is valid hex (not mock)
function isValidAddress(address: string): boolean {
  if (!address || !address.startsWith('0x') || address.length < 10) {
    return false;
  }
  // Check if all characters after 0x are valid hex digits
  const hexPart = address.slice(2);
  return /^[0-9a-fA-F]+$/.test(hexPart);
}

// View function to get payment stream balance
export async function getStreamBalance(payerAddress: string): Promise<number> {
  if (!isValidAddress(payerAddress)) {
    return 0; // Skip mock addresses silently
  }
  try {
    const result = await aptos.view({
      payload: {
        function: `${MODULES.paymentStream}::get_stream_balance`,
        functionArguments: [payerAddress],
      },
    });
    return result[0] as number;
  } catch {
    // Stream may not exist for this address - this is expected
    return 0;
  }
}

// View function to check if stream is active
export async function isStreamActive(payerAddress: string): Promise<boolean> {
  if (!isValidAddress(payerAddress)) {
    return false; // Skip mock addresses silently
  }
  try {
    const result = await aptos.view({
      payload: {
        function: `${MODULES.paymentStream}::is_stream_active`,
        functionArguments: [payerAddress],
      },
    });
    return result[0] as boolean;
  } catch {
    // Stream may not exist for this address - this is expected
    return false;
  }
}

// View function to get bounty vault balance
export async function getVaultBalance(): Promise<number> {
  try {
    const result = await aptos.view({
      payload: {
        function: `${MODULES.bountyVault}::get_vault_balance`,
        functionArguments: [],
      },
    });
    return result[0] as number;
  } catch (error) {
    console.error('Error getting vault balance:', error);
    return 0;
  }
}

// Alias for bounty vault balance
export const getBountyVaultBalance = getVaultBalance;

// View function to get vault stats (balance, total_paid_out, validated_reports)
export async function getVaultStats(): Promise<{
  balance: number;
  totalPaidOut: number;
  validatedReports: number;
}> {
  try {
    const result = await aptos.view({
      payload: {
        function: `${MODULES.bountyVault}::get_vault_stats`,
        functionArguments: [],
      },
    });
    return {
      balance: result[0] as number,
      totalPaidOut: result[1] as number,
      validatedReports: result[2] as number,
    };
  } catch (error) {
    console.error('Error getting vault stats:', error);
    return { balance: 0, totalPaidOut: 0, validatedReports: 0 };
  }
}

// View function to get total reports count (used to determine next report ID)
export async function getTotalReports(): Promise<number> {
  try {
    const result = await aptos.view({
      payload: {
        function: `${MODULES.bountyVault}::get_total_reports`,
        functionArguments: [],
      },
    });
    return result[0] as number;
  } catch (error) {
    console.error('Error getting total reports:', error);
    return 0;
  }
}

// View function to get report status
// Returns: 0=pending, 1=validated, 2=rejected, 3=paid, 255=not found
export async function getReportStatus(reporterAddress: string): Promise<number> {
  if (!isValidAddress(reporterAddress)) {
    return 255; // Not found for invalid addresses
  }
  try {
    const result = await aptos.view({
      payload: {
        function: `${MODULES.bountyVault}::get_report_status`,
        functionArguments: [reporterAddress],
      },
    });
    return result[0] as number;
  } catch (error) {
    console.error('Error getting report status:', error);
    return 255; // Not found
  }
}

// View function to get full report info
export async function getReportInfo(reporterAddress: string): Promise<{
  id: number;
  protocolAddress: string;
  severity: number;
  status: number;
  bountyAmount: number;
} | null> {
  if (!isValidAddress(reporterAddress)) {
    return null;
  }
  try {
    const result = await aptos.view({
      payload: {
        function: `${MODULES.bountyVault}::get_report_info`,
        functionArguments: [reporterAddress],
      },
    });
    return {
      id: result[0] as number,
      protocolAddress: result[1] as string,
      severity: result[2] as number,
      status: result[3] as number,
      bountyAmount: result[4] as number,
    };
  } catch {
    // Report may not exist - this is expected
    return null;
  }
}

// View function to get bounty report details
export async function getBountyReport(reporterAddress: string): Promise<{
  protocolAddress: string;
  title: string;
  description: string;
  severity: number;
  status: string;
  reward: number;
} | null> {
  if (!isValidAddress(reporterAddress)) {
    return null;
  }
  try {
    const result = await aptos.view({
      payload: {
        function: `${MODULES.bountyVault}::get_report`,
        functionArguments: [reporterAddress],
      },
    });
    // Parse the result based on contract structure
    if (result && result.length > 0) {
      const data = result[0] as {
        protocol_address: string;
        title: string;
        description: string;
        severity: number;
        status: number;
        reward: number;
      };
      return {
        protocolAddress: data.protocol_address,
        title: data.title,
        description: data.description,
        severity: data.severity,
        status: data.status === 0 ? 'pending' : data.status === 1 ? 'validated' : 'rejected',
        reward: data.reward,
      };
    }
    return null;
  } catch (error) {
    console.error('Error getting bounty report:', error);
    return null;
  }
}

// Build register protocol transaction
export function buildRegisterProtocolTx(
  senderAddress: string,
  protocolName: string,
  contractAddress: string
) {
  return {
    sender: senderAddress,
    data: {
      function: `${MODULES.guardian}::register_protocol`,
      functionArguments: [protocolName, contractAddress],
    },
  };
}

// Build create payment stream transaction
export function buildCreateStreamTx(
  senderAddress: string,
  protocolAddress: string,
  initialDeposit: number
) {
  return {
    sender: senderAddress,
    data: {
      function: `${MODULES.paymentStream}::create_stream`,
      functionArguments: [protocolAddress, initialDeposit],
    },
  };
}

// Build add funds to stream transaction
export function buildAddFundsTx(
  senderAddress: string,
  protocolAddress: string,
  amount: number
) {
  return {
    sender: senderAddress,
    data: {
      function: `${MODULES.paymentStream}::add_funds`,
      functionArguments: [protocolAddress, amount],
    },
  };
}

// Build submit vulnerability report transaction
export function buildSubmitReportTx(
  senderAddress: string,
  protocolAddress: string,
  title: string,
  description: string,
  severity: number
) {
  return {
    sender: senderAddress,
    data: {
      function: `${MODULES.bountyVault}::submit_report`,
      functionArguments: [protocolAddress, title, description, severity],
    },
  };
}

// Build unpause protocol transaction (admin only)
export function buildUnpauseTx(
  senderAddress: string,
  protocolAddress: string
) {
  return {
    sender: senderAddress,
    data: {
      function: `${MODULES.guardian}::unpause`,
      functionArguments: [protocolAddress],
    },
  };
}

// Get account balance in MOVE
export async function getAccountBalance(address: string): Promise<string> {
  try {
    const resources = await aptos.getAccountResources({ accountAddress: address });
    const coinResource = resources.find(
      (r) => r.type === '0x1::coin::CoinStore<0x1::aptos_coin::AptosCoin>'
    );
    if (coinResource) {
      const balance = (coinResource.data as { coin: { value: string } }).coin.value;
      return octasToMove(balance);
    }
    return '0';
  } catch (error) {
    console.error('Error getting balance:', error);
    return '0';
  }
}

// Export config for external use
export { MOVEMENT_CONFIG, MODULE_ADDRESS, MODULES };
