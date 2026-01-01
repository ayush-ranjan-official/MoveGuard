/**
 * Server-side transaction signing for MoveGuard
 * Uses deployer private key to sign all blockchain transactions
 */

import {
  Aptos,
  AptosConfig,
  Network,
  Ed25519PrivateKey,
  Account,
  InputEntryFunctionData,
  CommittedTransactionResponse,
} from '@aptos-labs/ts-sdk';
import { MOVEMENT_CONFIG, MODULE_ADDRESS } from './constants';

// Get deployer private key from environment
const DEPLOYER_PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY;

if (!DEPLOYER_PRIVATE_KEY) {
  console.warn('DEPLOYER_PRIVATE_KEY not set - transactions will fail');
}

// Initialize Aptos client for Movement network
const config = new AptosConfig({
  network: Network.CUSTOM,
  fullnode: MOVEMENT_CONFIG.testnet.fullnode,
  indexer: MOVEMENT_CONFIG.testnet.indexer,
});

export const aptos = new Aptos(config);

// Cached deployer account
let deployerAccount: Account | null = null;

/**
 * Get deployer account from private key
 */
export function getDeployerAccount(): Account {
  if (!DEPLOYER_PRIVATE_KEY) {
    throw new Error('DEPLOYER_PRIVATE_KEY environment variable not set');
  }

  if (!deployerAccount) {
    const privateKey = new Ed25519PrivateKey(DEPLOYER_PRIVATE_KEY);
    deployerAccount = Account.fromPrivateKey({ privateKey });
  }

  return deployerAccount;
}

/**
 * Get deployer address
 */
export function getDeployerAddress(): string {
  return getDeployerAccount().accountAddress.toString();
}

/**
 * Transaction result interface
 */
export interface TransactionResult {
  hash: string;
  success: boolean;
  gasUsed?: string;
  vmStatus?: string;
  error?: string;
}

// Transaction lock to prevent concurrent transactions
let transactionInProgress = false;
let lastTransactionTime = 0;
const MIN_TX_INTERVAL = 5000; // Minimum 5 seconds between transactions
const RETRY_DELAY = 3000; // 3 seconds before retry
const MAX_RETRIES = 3;
const MEMPOOL_COOLDOWN = 10000; // 10 seconds after mempool conflict

/**
 * Sign and submit a transaction with retry logic for sequence number and mempool issues
 */
export async function signAndSubmitTransaction(
  payload: InputEntryFunctionData
): Promise<TransactionResult> {
  // Wait if another transaction is in progress
  while (transactionInProgress) {
    console.log('Waiting for previous transaction to complete...');
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // Ensure minimum interval between transactions to avoid mempool conflicts
  const timeSinceLastTx = Date.now() - lastTransactionTime;
  if (timeSinceLastTx < MIN_TX_INTERVAL && lastTransactionTime > 0) {
    const waitTime = MIN_TX_INTERVAL - timeSinceLastTx;
    console.log(`Waiting ${waitTime}ms before next transaction to avoid mempool conflicts...`);
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }

  transactionInProgress = true;
  let lastError = '';

  try {
    const account = getDeployerAccount();

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        console.log(`Transaction attempt ${attempt}/${MAX_RETRIES}`);

        // Build the transaction (fetches fresh sequence number)
        const transaction = await aptos.transaction.build.simple({
          sender: account.accountAddress,
          data: payload,
        });

        // Sign and submit
        const pendingTx = await aptos.signAndSubmitTransaction({
          signer: account,
          transaction,
        });

        console.log(`Transaction submitted: ${pendingTx.hash}`);

        // Wait for confirmation with extended timeout for slower RPC endpoints
        const result = await aptos.waitForTransaction({
          transactionHash: pendingTx.hash,
          options: {
            timeoutSecs: 90, // Extended to 90 seconds for slow RPCs
            checkSuccess: true,
          },
        }) as CommittedTransactionResponse;

        console.log(`Transaction confirmed: ${result.success ? 'SUCCESS' : 'FAILED'}`);
        lastTransactionTime = Date.now();

        return {
          hash: pendingTx.hash,
          success: result.success,
          gasUsed: result.gas_used?.toString(),
          vmStatus: result.vm_status,
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        lastError = errorMessage;

        // Check if it's a sequence number error - retry after delay
        if (errorMessage.includes('SEQUENCE_NUMBER_TOO_OLD') ||
            errorMessage.includes('SEQUENCE_NUMBER_TOO_NEW')) {
          console.log(`Sequence number error, waiting ${RETRY_DELAY}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
          continue;
        }

        // Check if it's a mempool conflict - wait longer before retry
        if (errorMessage.includes('already in mempool') ||
            errorMessage.includes('invalid_transaction_update')) {
          console.log(`Mempool conflict detected, waiting ${MEMPOOL_COOLDOWN}ms for mempool to clear...`);
          await new Promise(resolve => setTimeout(resolve, MEMPOOL_COOLDOWN));
          continue;
        }

        // Check if transaction timed out - it might still be pending
        if (errorMessage.includes('timed out') || errorMessage.includes('pending state')) {
          console.log(`Transaction timeout, waiting ${MEMPOOL_COOLDOWN}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, MEMPOOL_COOLDOWN));
          continue;
        }

        // For other errors, don't retry
        throw error;
      }
    }

    // All retries exhausted
    lastTransactionTime = Date.now();
    return {
      hash: '',
      success: false,
      error: `Transaction failed after ${MAX_RETRIES} attempts: ${lastError}`,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Transaction failed:', errorMessage);
    lastTransactionTime = Date.now();

    return {
      hash: '',
      success: false,
      error: errorMessage,
    };
  } finally {
    transactionInProgress = false;
  }
}

/**
 * Contract module paths
 */
export const CONTRACTS = {
  guardian: `${MODULE_ADDRESS}::guardian`,
  paymentStream: `${MODULE_ADDRESS}::payment_stream`,
  bountyVault: `${MODULE_ADDRESS}::bounty_vault`,
} as const;

// ============================================
// GUARDIAN CONTRACT FUNCTIONS
// ============================================

/**
 * Initialize the guardian registry (one-time setup)
 */
export async function initializeGuardian(oracleAddress: string): Promise<TransactionResult> {
  return signAndSubmitTransaction({
    function: `${CONTRACTS.guardian}::initialize`,
    functionArguments: [oracleAddress],
  });
}

/**
 * Register a protocol for protection
 */
export async function registerProtocol(
  name: string,
  contractAddress: string
): Promise<TransactionResult> {
  return signAndSubmitTransaction({
    function: `${CONTRACTS.guardian}::register_protocol`,
    functionArguments: [name, contractAddress],
  });
}

/**
 * Trigger pause on a protocol (oracle only)
 */
export async function triggerPause(
  protocolAdmin: string,
  threatType: string,
  severity: number,
  confidence: number
): Promise<TransactionResult> {
  return signAndSubmitTransaction({
    function: `${CONTRACTS.guardian}::trigger_pause`,
    functionArguments: [protocolAdmin, threatType, severity, confidence],
  });
}

/**
 * Unpause a protocol (admin only)
 */
export async function unpauseProtocol(): Promise<TransactionResult> {
  return signAndSubmitTransaction({
    function: `${CONTRACTS.guardian}::unpause`,
    functionArguments: [],
  });
}

/**
 * Update threat level (oracle only)
 */
export async function updateThreatLevel(
  protocolAdmin: string,
  newLevel: number
): Promise<TransactionResult> {
  return signAndSubmitTransaction({
    function: `${CONTRACTS.guardian}::update_threat_level`,
    functionArguments: [protocolAdmin, newLevel],
  });
}

/**
 * Set protection status
 */
export async function setProtectionStatus(
  protocolAdmin: string,
  active: boolean
): Promise<TransactionResult> {
  return signAndSubmitTransaction({
    function: `${CONTRACTS.guardian}::set_protection_status`,
    functionArguments: [protocolAdmin, active],
  });
}

// ============================================
// PAYMENT STREAM CONTRACT FUNCTIONS
// ============================================

/**
 * Initialize the treasury (one-time setup)
 */
export async function initializeTreasury(): Promise<TransactionResult> {
  return signAndSubmitTransaction({
    function: `${CONTRACTS.paymentStream}::initialize_treasury`,
    functionArguments: [],
  });
}

/**
 * Create a payment stream
 */
export async function createStream(
  protocolAddress: string,
  initialDeposit: number
): Promise<TransactionResult> {
  return signAndSubmitTransaction({
    function: `${CONTRACTS.paymentStream}::create_stream`,
    functionArguments: [protocolAddress, initialDeposit],
  });
}

/**
 * Add funds to a stream
 */
export async function addFunds(amount: number): Promise<TransactionResult> {
  return signAndSubmitTransaction({
    function: `${CONTRACTS.paymentStream}::add_funds`,
    functionArguments: [amount],
  });
}

/**
 * Process deductions (keeper function)
 */
export async function processDeductions(payerAddress: string): Promise<TransactionResult> {
  return signAndSubmitTransaction({
    function: `${CONTRACTS.paymentStream}::process_deductions`,
    functionArguments: [payerAddress],
  });
}

/**
 * Close a stream
 */
export async function closeStream(): Promise<TransactionResult> {
  return signAndSubmitTransaction({
    function: `${CONTRACTS.paymentStream}::close_stream`,
    functionArguments: [],
  });
}

// ============================================
// BOUNTY VAULT CONTRACT FUNCTIONS
// ============================================

/**
 * Initialize the bounty vault (one-time setup)
 */
export async function initializeBountyVault(
  validator: string,
  initialFunding: number
): Promise<TransactionResult> {
  return signAndSubmitTransaction({
    function: `${CONTRACTS.bountyVault}::initialize_vault`,
    functionArguments: [validator, initialFunding],
  });
}

/**
 * Submit a vulnerability report
 */
export async function submitReport(
  protocolAddress: string,
  title: string,
  description: string,
  severity: number
): Promise<TransactionResult> {
  return signAndSubmitTransaction({
    function: `${CONTRACTS.bountyVault}::submit_report`,
    functionArguments: [protocolAddress, title, description, severity],
  });
}

/**
 * Validate and pay a bounty (validator only)
 * @param reportId - The report ID to validate and pay
 */
export async function validateAndPay(reportId: number): Promise<TransactionResult> {
  return signAndSubmitTransaction({
    function: `${CONTRACTS.bountyVault}::validate_and_pay`,
    functionArguments: [reportId.toString()],
  });
}

/**
 * Reject a report (validator only)
 * @param reportId - The report ID to reject
 * @param reason - Reason for rejection
 */
export async function rejectReport(
  reportId: number,
  reason: string
): Promise<TransactionResult> {
  console.log(`Rejecting report #${reportId}: ${reason}`);
  return signAndSubmitTransaction({
    function: `${CONTRACTS.bountyVault}::reject_report`,
    functionArguments: [reportId.toString(), reason],
  });
}

/**
 * Fund the bounty vault
 */
export async function fundVault(amount: number): Promise<TransactionResult> {
  return signAndSubmitTransaction({
    function: `${CONTRACTS.bountyVault}::fund_vault`,
    functionArguments: [amount],
  });
}

// ============================================
// INITIALIZATION STATUS CHECK
// ============================================

/**
 * Check if contracts are initialized
 */
export async function checkInitializationStatus(): Promise<{
  guardian: boolean;
  treasury: boolean;
  bountyVault: boolean;
}> {
  const deployerAddr = getDeployerAddress();

  try {
    const resources = await aptos.getAccountResources({
      accountAddress: deployerAddr,
    });

    const guardian = resources.some(r =>
      r.type.includes('guardian::GuardianRegistry')
    );
    const treasury = resources.some(r =>
      r.type.includes('payment_stream::Treasury')
    );
    const bountyVault = resources.some(r =>
      r.type.includes('bounty_vault::BountyVault')
    );

    return { guardian, treasury, bountyVault };
  } catch {
    return { guardian: false, treasury: false, bountyVault: false };
  }
}
