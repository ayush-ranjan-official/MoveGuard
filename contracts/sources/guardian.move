/// MoveGuard Guardian Module
/// Core protection logic for DeFi protocols on Movement
module moveguard::guardian {
    use std::signer;
    use std::string::String;
    use std::vector;
    use aptos_framework::event;
    use aptos_framework::timestamp;
    use aptos_framework::account;

    // ==================== Error Codes ====================

    /// Caller is not authorized to perform this action
    const E_NOT_AUTHORIZED: u64 = 1;
    /// Protocol not found in registry
    const E_PROTOCOL_NOT_FOUND: u64 = 2;
    /// Protocol is already paused
    const E_ALREADY_PAUSED: u64 = 3;
    /// Protocol is not paused
    const E_NOT_PAUSED: u64 = 4;
    /// Protection is not active (payment required)
    const E_PAYMENT_REQUIRED: u64 = 5;
    /// Protocol already registered
    const E_ALREADY_REGISTERED: u64 = 6;
    /// Guardian registry not initialized
    const E_NOT_INITIALIZED: u64 = 7;

    // ==================== Threat Severity Levels ====================

    const THREAT_LOW: u8 = 1;
    const THREAT_MEDIUM: u8 = 2;
    const THREAT_HIGH: u8 = 3;
    const THREAT_CRITICAL: u8 = 4;

    // ==================== Structs ====================

    /// Represents a DeFi protocol under MoveGuard protection
    struct ProtectedProtocol has key, store {
        name: String,
        contract_address: address,
        admin: address,
        is_paused: bool,
        threat_level: u8,
        protection_active: bool,
        registered_at: u64,
        last_threat_check: u64,
    }

    /// Global registry managing all protected protocols
    struct GuardianRegistry has key {
        protocols: vector<address>,
        oracle_address: address,
        total_threats_detected: u64,
        total_attacks_prevented: u64,
    }

    // ==================== Events ====================

    #[event]
    struct ProtocolRegistered has drop, store {
        protocol_address: address,
        name: String,
        admin: address,
        timestamp: u64,
    }

    #[event]
    struct ThreatDetected has drop, store {
        protocol_address: address,
        threat_type: String,
        severity: u8,
        confidence: u64,
        timestamp: u64,
    }

    #[event]
    struct ProtocolPaused has drop, store {
        protocol_address: address,
        reason: String,
        paused_by: address,
        timestamp: u64,
    }

    #[event]
    struct ProtocolUnpaused has drop, store {
        protocol_address: address,
        unpaused_by: address,
        timestamp: u64,
    }

    #[event]
    struct ProtectionStatusChanged has drop, store {
        protocol_address: address,
        active: bool,
        timestamp: u64,
    }

    // ==================== Initialization ====================

    /// Initialize the guardian registry (called once by deployer)
    public entry fun initialize(deployer: &signer, oracle_address: address) {
        let deployer_addr = signer::address_of(deployer);

        // Ensure not already initialized
        assert!(!exists<GuardianRegistry>(deployer_addr), E_ALREADY_REGISTERED);

        let registry = GuardianRegistry {
            protocols: vector::empty(),
            oracle_address,
            total_threats_detected: 0,
            total_attacks_prevented: 0,
        };
        move_to(deployer, registry);
    }

    // ==================== Protocol Management ====================

    /// Register a new protocol for MoveGuard protection
    public entry fun register_protocol(
        admin: &signer,
        name: String,
        contract_address: address,
    ) acquires GuardianRegistry {
        let admin_address = signer::address_of(admin);
        let now = timestamp::now_seconds();

        // Ensure protocol not already registered
        assert!(!exists<ProtectedProtocol>(contract_address), E_ALREADY_REGISTERED);

        let protocol = ProtectedProtocol {
            name,
            contract_address,
            admin: admin_address,
            is_paused: false,
            threat_level: 0,
            protection_active: false, // Activated when payment stream starts
            registered_at: now,
            last_threat_check: now,
        };

        // Store protocol at its contract address
        // Note: In production, this would be stored differently
        move_to(admin, protocol);

        // Add to registry
        let registry = borrow_global_mut<GuardianRegistry>(@moveguard);
        vector::push_back(&mut registry.protocols, contract_address);

        event::emit(ProtocolRegistered {
            protocol_address: contract_address,
            name,
            admin: admin_address,
            timestamp: now,
        });
    }

    /// Oracle triggers pause when threat detected
    public entry fun trigger_pause(
        oracle: &signer,
        protocol_admin: address,
        threat_type: String,
        severity: u8,
        confidence: u64,
    ) acquires GuardianRegistry, ProtectedProtocol {
        let oracle_address = signer::address_of(oracle);
        let registry = borrow_global_mut<GuardianRegistry>(@moveguard);

        // Verify caller is authorized oracle
        assert!(oracle_address == registry.oracle_address, E_NOT_AUTHORIZED);

        let protocol = borrow_global_mut<ProtectedProtocol>(protocol_admin);

        // Check protection is active (payment stream running)
        assert!(protocol.protection_active, E_PAYMENT_REQUIRED);
        assert!(!protocol.is_paused, E_ALREADY_PAUSED);

        // Pause the protocol
        protocol.is_paused = true;
        protocol.threat_level = severity;

        let now = timestamp::now_seconds();

        // Update registry stats
        registry.total_threats_detected = registry.total_threats_detected + 1;
        registry.total_attacks_prevented = registry.total_attacks_prevented + 1;

        event::emit(ThreatDetected {
            protocol_address: protocol.contract_address,
            threat_type,
            severity,
            confidence,
            timestamp: now,
        });

        event::emit(ProtocolPaused {
            protocol_address: protocol.contract_address,
            reason: threat_type,
            paused_by: oracle_address,
            timestamp: now,
        });
    }

    /// Admin unpause after threat review
    public entry fun unpause(
        admin: &signer,
    ) acquires ProtectedProtocol {
        let admin_address = signer::address_of(admin);
        let protocol = borrow_global_mut<ProtectedProtocol>(admin_address);

        // Verify caller is protocol admin
        assert!(admin_address == protocol.admin, E_NOT_AUTHORIZED);
        assert!(protocol.is_paused, E_NOT_PAUSED);

        protocol.is_paused = false;
        protocol.threat_level = 0;

        event::emit(ProtocolUnpaused {
            protocol_address: protocol.contract_address,
            unpaused_by: admin_address,
            timestamp: timestamp::now_seconds(),
        });
    }

    // ==================== Protection Status (called by payment_stream) ====================

    /// Update protection status (friend function for payment_stream module)
    public entry fun set_protection_status(
        caller: &signer,
        protocol_admin: address,
        active: bool,
    ) acquires ProtectedProtocol {
        let protocol = borrow_global_mut<ProtectedProtocol>(protocol_admin);
        protocol.protection_active = active;

        event::emit(ProtectionStatusChanged {
            protocol_address: protocol.contract_address,
            active,
            timestamp: timestamp::now_seconds(),
        });
    }

    /// Update threat level (for continuous monitoring)
    public entry fun update_threat_level(
        oracle: &signer,
        protocol_admin: address,
        new_level: u8,
    ) acquires GuardianRegistry, ProtectedProtocol {
        let oracle_address = signer::address_of(oracle);
        let registry = borrow_global<GuardianRegistry>(@moveguard);

        // Verify caller is authorized oracle
        assert!(oracle_address == registry.oracle_address, E_NOT_AUTHORIZED);

        let protocol = borrow_global_mut<ProtectedProtocol>(protocol_admin);
        protocol.threat_level = new_level;
        protocol.last_threat_check = timestamp::now_seconds();
    }

    // ==================== View Functions ====================

    #[view]
    public fun is_protocol_paused(protocol_admin: address): bool acquires ProtectedProtocol {
        if (!exists<ProtectedProtocol>(protocol_admin)) {
            return false
        };
        let protocol = borrow_global<ProtectedProtocol>(protocol_admin);
        protocol.is_paused
    }

    #[view]
    public fun get_threat_level(protocol_admin: address): u8 acquires ProtectedProtocol {
        if (!exists<ProtectedProtocol>(protocol_admin)) {
            return 0
        };
        let protocol = borrow_global<ProtectedProtocol>(protocol_admin);
        protocol.threat_level
    }

    #[view]
    public fun is_protection_active(protocol_admin: address): bool acquires ProtectedProtocol {
        if (!exists<ProtectedProtocol>(protocol_admin)) {
            return false
        };
        let protocol = borrow_global<ProtectedProtocol>(protocol_admin);
        protocol.protection_active
    }

    #[view]
    public fun get_protocol_info(protocol_admin: address): (String, address, bool, u8, bool) acquires ProtectedProtocol {
        let protocol = borrow_global<ProtectedProtocol>(protocol_admin);
        (
            protocol.name,
            protocol.contract_address,
            protocol.is_paused,
            protocol.threat_level,
            protocol.protection_active,
        )
    }

    #[view]
    public fun get_registry_stats(): (u64, u64) acquires GuardianRegistry {
        let registry = borrow_global<GuardianRegistry>(@moveguard);
        (registry.total_threats_detected, registry.total_attacks_prevented)
    }

    #[view]
    public fun get_protocol_count(): u64 acquires GuardianRegistry {
        let registry = borrow_global<GuardianRegistry>(@moveguard);
        vector::length(&registry.protocols)
    }
}
