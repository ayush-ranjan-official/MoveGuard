/// MoveGuard Bounty Vault Module V2
/// Handles researcher vulnerability reports and instant bounty payouts
/// Uses table storage to allow multiple reports per address
module moveguard::bounty_vault {
    use std::signer;
    use std::string::String;
    use aptos_framework::coin;
    use aptos_framework::aptos_coin::AptosCoin;
    use aptos_framework::timestamp;
    use aptos_framework::event;
    use aptos_std::table::{Self, Table};

    // ==================== Error Codes ====================

    const E_NOT_AUTHORIZED: u64 = 1;
    const E_INSUFFICIENT_VAULT_BALANCE: u64 = 2;
    const E_REPORT_NOT_FOUND: u64 = 3;
    const E_ALREADY_CLAIMED: u64 = 4;
    const E_VAULT_NOT_INITIALIZED: u64 = 5;
    const E_INVALID_SEVERITY: u64 = 6;

    // ==================== Severity Levels ====================

    const SEVERITY_LOW: u8 = 1;
    const SEVERITY_MEDIUM: u8 = 2;
    const SEVERITY_HIGH: u8 = 3;
    const SEVERITY_CRITICAL: u8 = 4;

    // ==================== Bounty Amounts (in octas) ====================

    const BOUNTY_LOW: u64 = 10_000_000;       // 0.1 MOVE
    const BOUNTY_MEDIUM: u64 = 50_000_000;    // 0.5 MOVE
    const BOUNTY_HIGH: u64 = 100_000_000;     // 1 MOVE
    const BOUNTY_CRITICAL: u64 = 500_000_000; // 5 MOVE

    // ==================== Report Status ====================

    const STATUS_PENDING: u8 = 0;
    const STATUS_VALIDATED: u8 = 1;
    const STATUS_REJECTED: u8 = 2;
    const STATUS_PAID: u8 = 3;

    // ==================== Structs ====================

    /// Vulnerability report submitted by researcher
    struct VulnerabilityReport has store, drop, copy {
        id: u64,
        reporter: address,
        protocol_address: address,
        title: String,
        description: String,
        severity: u8,
        status: u8,
        bounty_amount: u64,
        submitted_at: u64,
        resolved_at: u64,
    }

    /// Bounty vault holding funds for payouts - now with table storage
    struct BountyVault has key {
        balance: coin::Coin<AptosCoin>,
        total_paid_out: u64,
        total_reports: u64,
        validated_reports: u64,
        validator: address,
        reports: Table<u64, VulnerabilityReport>,  // report_id -> report
    }

    // ==================== Events ====================

    #[event]
    struct ReportSubmitted has drop, store {
        report_id: u64,
        reporter: address,
        protocol_address: address,
        severity: u8,
        potential_bounty: u64,
        timestamp: u64,
    }

    #[event]
    struct ReportValidated has drop, store {
        report_id: u64,
        reporter: address,
        severity: u8,
        timestamp: u64,
    }

    #[event]
    struct ReportRejected has drop, store {
        report_id: u64,
        reporter: address,
        reason: String,
        timestamp: u64,
    }

    #[event]
    struct BountyPaid has drop, store {
        report_id: u64,
        reporter: address,
        amount: u64,
        timestamp: u64,
    }

    #[event]
    struct VaultFunded has drop, store {
        funder: address,
        amount: u64,
        new_balance: u64,
        timestamp: u64,
    }

    // ==================== Initialization ====================

    /// Initialize bounty vault with initial funding
    public entry fun initialize_vault(
        deployer: &signer,
        validator: address,
        initial_funding: u64,
    ) {
        let deployer_addr = signer::address_of(deployer);
        assert!(!exists<BountyVault>(deployer_addr), E_ALREADY_CLAIMED);

        let funding = coin::withdraw<AptosCoin>(deployer, initial_funding);

        let vault = BountyVault {
            balance: funding,
            total_paid_out: 0,
            total_reports: 0,
            validated_reports: 0,
            validator,
            reports: table::new(),
        };

        move_to(deployer, vault);

        event::emit(VaultFunded {
            funder: deployer_addr,
            amount: initial_funding,
            new_balance: initial_funding,
            timestamp: timestamp::now_seconds(),
        });
    }

    // ==================== Report Management ====================

    /// Submit a vulnerability report - now stores in table, allows multiple per address
    public entry fun submit_report(
        reporter: &signer,
        protocol_address: address,
        title: String,
        description: String,
        severity: u8,
    ) acquires BountyVault {
        let reporter_address = signer::address_of(reporter);
        let now = timestamp::now_seconds();

        // Validate severity
        assert!(
            severity >= SEVERITY_LOW && severity <= SEVERITY_CRITICAL,
            E_INVALID_SEVERITY
        );

        // Get bounty amount based on severity
        let bounty_amount = get_bounty_for_severity(severity);

        // Get next report ID and store in table
        let vault = borrow_global_mut<BountyVault>(@moveguard);
        let report_id = vault.total_reports + 1;
        vault.total_reports = report_id;

        // Create report
        let report = VulnerabilityReport {
            id: report_id,
            reporter: reporter_address,
            protocol_address,
            title,
            description,
            severity,
            status: STATUS_PENDING,
            bounty_amount,
            submitted_at: now,
            resolved_at: 0,
        };

        // Store in table instead of at reporter address
        table::add(&mut vault.reports, report_id, report);

        event::emit(ReportSubmitted {
            report_id,
            reporter: reporter_address,
            protocol_address,
            severity,
            potential_bounty: bounty_amount,
            timestamp: now,
        });
    }

    /// Validator approves and triggers instant payout via x402
    public entry fun validate_and_pay(
        validator: &signer,
        report_id: u64,
    ) acquires BountyVault {
        let validator_address = signer::address_of(validator);
        let vault = borrow_global_mut<BountyVault>(@moveguard);

        // Verify caller is authorized validator
        assert!(validator_address == vault.validator, E_NOT_AUTHORIZED);

        // Get report from table
        assert!(table::contains(&vault.reports, report_id), E_REPORT_NOT_FOUND);
        let report = table::borrow_mut(&mut vault.reports, report_id);

        // Check status
        assert!(report.status == STATUS_PENDING, E_ALREADY_CLAIMED);

        let payout_amount = report.bounty_amount;
        let reporter_address = report.reporter;

        // Check vault has sufficient balance
        assert!(
            coin::value(&vault.balance) >= payout_amount,
            E_INSUFFICIENT_VAULT_BALANCE
        );

        // Extract payout from vault
        let payout = coin::extract(&mut vault.balance, payout_amount);

        // Send to reporter (instant x402-style payout)
        coin::deposit(reporter_address, payout);

        // Update report status
        report.status = STATUS_PAID;
        report.resolved_at = timestamp::now_seconds();

        // Update vault stats
        vault.total_paid_out = vault.total_paid_out + payout_amount;
        vault.validated_reports = vault.validated_reports + 1;

        event::emit(ReportValidated {
            report_id: report.id,
            reporter: reporter_address,
            severity: report.severity,
            timestamp: timestamp::now_seconds(),
        });

        event::emit(BountyPaid {
            report_id: report.id,
            reporter: reporter_address,
            amount: payout_amount,
            timestamp: timestamp::now_seconds(),
        });
    }

    /// Validator rejects a report
    public entry fun reject_report(
        validator: &signer,
        report_id: u64,
        reason: String,
    ) acquires BountyVault {
        let validator_address = signer::address_of(validator);
        let vault = borrow_global_mut<BountyVault>(@moveguard);

        // Verify caller is authorized validator
        assert!(validator_address == vault.validator, E_NOT_AUTHORIZED);

        // Get report from table
        assert!(table::contains(&vault.reports, report_id), E_REPORT_NOT_FOUND);
        let report = table::borrow_mut(&mut vault.reports, report_id);

        // Check status
        assert!(report.status == STATUS_PENDING, E_ALREADY_CLAIMED);

        let reporter_address = report.reporter;

        // Update status
        report.status = STATUS_REJECTED;
        report.resolved_at = timestamp::now_seconds();

        event::emit(ReportRejected {
            report_id: report.id,
            reporter: reporter_address,
            reason,
            timestamp: timestamp::now_seconds(),
        });
    }

    /// Fund the vault
    public entry fun fund_vault(
        funder: &signer,
        amount: u64,
    ) acquires BountyVault {
        let funder_address = signer::address_of(funder);
        let funding = coin::withdraw<AptosCoin>(funder, amount);

        let vault = borrow_global_mut<BountyVault>(@moveguard);
        coin::merge(&mut vault.balance, funding);

        event::emit(VaultFunded {
            funder: funder_address,
            amount,
            new_balance: coin::value(&vault.balance),
            timestamp: timestamp::now_seconds(),
        });
    }

    // ==================== Helper Functions ====================

    /// Get bounty amount for severity level
    fun get_bounty_for_severity(severity: u8): u64 {
        if (severity == SEVERITY_LOW) { BOUNTY_LOW }
        else if (severity == SEVERITY_MEDIUM) { BOUNTY_MEDIUM }
        else if (severity == SEVERITY_HIGH) { BOUNTY_HIGH }
        else { BOUNTY_CRITICAL }
    }

    // ==================== View Functions ====================

    #[view]
    public fun get_vault_balance(): u64 acquires BountyVault {
        let vault = borrow_global<BountyVault>(@moveguard);
        coin::value(&vault.balance)
    }

    #[view]
    public fun get_vault_stats(): (u64, u64, u64) acquires BountyVault {
        let vault = borrow_global<BountyVault>(@moveguard);
        (
            coin::value(&vault.balance),
            vault.total_paid_out,
            vault.validated_reports,
        )
    }

    #[view]
    public fun get_bounty_amounts(): (u64, u64, u64, u64) {
        (BOUNTY_LOW, BOUNTY_MEDIUM, BOUNTY_HIGH, BOUNTY_CRITICAL)
    }

    #[view]
    public fun get_report_by_id(report_id: u64): (u64, address, address, u8, u8, u64) acquires BountyVault {
        let vault = borrow_global<BountyVault>(@moveguard);
        assert!(table::contains(&vault.reports, report_id), E_REPORT_NOT_FOUND);
        let report = table::borrow(&vault.reports, report_id);
        (
            report.id,
            report.reporter,
            report.protocol_address,
            report.severity,
            report.status,
            report.bounty_amount,
        )
    }

    #[view]
    public fun get_total_reports(): u64 acquires BountyVault {
        let vault = borrow_global<BountyVault>(@moveguard);
        vault.total_reports
    }
}
