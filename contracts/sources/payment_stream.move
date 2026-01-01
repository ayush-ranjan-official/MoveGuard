/// MoveGuard Payment Stream Module
/// Handles x402-style micropayment streams for pay-per-block protection
module moveguard::payment_stream {
    use std::signer;
    use aptos_framework::coin;
    use aptos_framework::aptos_coin::AptosCoin;
    use aptos_framework::timestamp;
    use aptos_framework::event;

    // ==================== Error Codes ====================

    const E_INSUFFICIENT_BALANCE: u64 = 1;
    const E_STREAM_NOT_FOUND: u64 = 2;
    const E_NOT_AUTHORIZED: u64 = 3;
    const E_STREAM_ALREADY_EXISTS: u64 = 4;
    const E_STREAM_INACTIVE: u64 = 5;
    const E_TREASURY_NOT_INITIALIZED: u64 = 6;

    // ==================== Constants ====================

    /// Cost per block for protection (in octas, 1 MOVE = 10^8 octas)
    /// $0.001 per block equivalent
    const RATE_PER_BLOCK: u64 = 100000; // 0.001 MOVE per block

    /// Minimum deposit required
    const MIN_DEPOSIT: u64 = 10000000; // 0.1 MOVE minimum

    // ==================== Structs ====================

    /// Payment stream for a protected protocol
    struct PaymentStream has key {
        protocol_address: address,
        payer: address,
        balance: u64,
        rate_per_block: u64,
        last_deduction_time: u64,
        total_paid: u64,
        is_active: bool,
        created_at: u64,
    }

    /// Treasury to collect payments
    struct Treasury has key {
        balance: coin::Coin<AptosCoin>,
        total_collected: u64,
        total_streams: u64,
    }

    // ==================== Events ====================

    #[event]
    struct StreamCreated has drop, store {
        protocol_address: address,
        payer: address,
        initial_deposit: u64,
        rate_per_block: u64,
        timestamp: u64,
    }

    #[event]
    struct PaymentReceived has drop, store {
        protocol_address: address,
        amount: u64,
        new_balance: u64,
        timestamp: u64,
    }

    #[event]
    struct StreamActivated has drop, store {
        protocol_address: address,
        timestamp: u64,
    }

    #[event]
    struct StreamDeactivated has drop, store {
        protocol_address: address,
        reason: vector<u8>,
        timestamp: u64,
    }

    #[event]
    struct FeesDeducted has drop, store {
        protocol_address: address,
        amount_deducted: u64,
        remaining_balance: u64,
        timestamp: u64,
    }

    // ==================== Initialization ====================

    /// Initialize treasury (called once by deployer)
    public entry fun initialize_treasury(deployer: &signer) {
        let deployer_addr = signer::address_of(deployer);
        assert!(!exists<Treasury>(deployer_addr), E_STREAM_ALREADY_EXISTS);

        let treasury = Treasury {
            balance: coin::zero<AptosCoin>(),
            total_collected: 0,
            total_streams: 0,
        };
        move_to(deployer, treasury);
    }

    // ==================== Stream Management ====================

    /// Create a payment stream for a protocol
    public entry fun create_stream(
        payer: &signer,
        protocol_address: address,
        initial_deposit: u64,
    ) acquires Treasury {
        let payer_address = signer::address_of(payer);
        let now = timestamp::now_seconds();

        // Validate deposit amount
        assert!(initial_deposit >= MIN_DEPOSIT, E_INSUFFICIENT_BALANCE);

        // Ensure stream doesn't already exist
        assert!(!exists<PaymentStream>(payer_address), E_STREAM_ALREADY_EXISTS);

        // Transfer initial deposit to treasury
        let payment = coin::withdraw<AptosCoin>(payer, initial_deposit);
        let treasury = borrow_global_mut<Treasury>(@moveguard);
        coin::merge(&mut treasury.balance, payment);
        treasury.total_collected = treasury.total_collected + initial_deposit;
        treasury.total_streams = treasury.total_streams + 1;

        // Create stream
        let stream = PaymentStream {
            protocol_address,
            payer: payer_address,
            balance: initial_deposit,
            rate_per_block: RATE_PER_BLOCK,
            last_deduction_time: now,
            total_paid: initial_deposit,
            is_active: true,
            created_at: now,
        };

        move_to(payer, stream);

        event::emit(StreamCreated {
            protocol_address,
            payer: payer_address,
            initial_deposit,
            rate_per_block: RATE_PER_BLOCK,
            timestamp: now,
        });

        event::emit(StreamActivated {
            protocol_address,
            timestamp: now,
        });
    }

    /// Add funds to existing stream (x402 payment endpoint)
    public entry fun add_funds(
        payer: &signer,
        amount: u64,
    ) acquires PaymentStream, Treasury {
        let payer_address = signer::address_of(payer);

        assert!(exists<PaymentStream>(payer_address), E_STREAM_NOT_FOUND);

        let stream = borrow_global_mut<PaymentStream>(payer_address);
        assert!(stream.payer == payer_address, E_NOT_AUTHORIZED);

        // Transfer funds to treasury
        let payment = coin::withdraw<AptosCoin>(payer, amount);
        let treasury = borrow_global_mut<Treasury>(@moveguard);
        coin::merge(&mut treasury.balance, payment);
        treasury.total_collected = treasury.total_collected + amount;

        // Update stream balance
        stream.balance = stream.balance + amount;
        stream.total_paid = stream.total_paid + amount;

        let now = timestamp::now_seconds();

        // Reactivate if was deactivated
        if (!stream.is_active && stream.balance > RATE_PER_BLOCK) {
            stream.is_active = true;
            event::emit(StreamActivated {
                protocol_address: stream.protocol_address,
                timestamp: now,
            });
        };

        event::emit(PaymentReceived {
            protocol_address: stream.protocol_address,
            amount,
            new_balance: stream.balance,
            timestamp: now,
        });
    }

    /// Keeper function: deduct fees (called periodically by keeper/cron)
    public entry fun process_deductions(
        _keeper: &signer,
        payer_address: address,
    ) acquires PaymentStream {
        assert!(exists<PaymentStream>(payer_address), E_STREAM_NOT_FOUND);

        let stream = borrow_global_mut<PaymentStream>(payer_address);

        if (!stream.is_active) {
            return
        };

        let now = timestamp::now_seconds();

        // Calculate time elapsed (using seconds as proxy for blocks)
        // In production, would use actual block numbers
        let time_elapsed = now - stream.last_deduction_time;
        let amount_due = time_elapsed * stream.rate_per_block;

        if (stream.balance >= amount_due) {
            // Deduct fees
            stream.balance = stream.balance - amount_due;
            stream.last_deduction_time = now;

            event::emit(FeesDeducted {
                protocol_address: stream.protocol_address,
                amount_deducted: amount_due,
                remaining_balance: stream.balance,
                timestamp: now,
            });
        } else {
            // Insufficient balance - deactivate protection
            stream.is_active = false;

            event::emit(StreamDeactivated {
                protocol_address: stream.protocol_address,
                reason: b"insufficient_balance",
                timestamp: now,
            });
        }
    }

    /// Close stream and withdraw remaining balance
    public entry fun close_stream(
        payer: &signer,
    ) acquires PaymentStream, Treasury {
        let payer_address = signer::address_of(payer);

        assert!(exists<PaymentStream>(payer_address), E_STREAM_NOT_FOUND);

        // Move out and destruct stream
        let PaymentStream {
            protocol_address: _,
            payer: _,
            balance,
            rate_per_block: _,
            last_deduction_time: _,
            total_paid: _,
            is_active: _,
            created_at: _,
        } = move_from<PaymentStream>(payer_address);

        // Return remaining balance to payer if any
        if (balance > 0) {
            let treasury = borrow_global_mut<Treasury>(@moveguard);
            let refund = coin::extract(&mut treasury.balance, balance);
            coin::deposit(payer_address, refund);
        };
    }

    // ==================== View Functions ====================

    #[view]
    public fun get_stream_balance(payer_address: address): u64 acquires PaymentStream {
        if (!exists<PaymentStream>(payer_address)) {
            return 0
        };
        let stream = borrow_global<PaymentStream>(payer_address);
        stream.balance
    }

    #[view]
    public fun is_stream_active(payer_address: address): bool acquires PaymentStream {
        if (!exists<PaymentStream>(payer_address)) {
            return false
        };
        let stream = borrow_global<PaymentStream>(payer_address);
        stream.is_active
    }

    #[view]
    public fun get_rate_per_block(): u64 {
        RATE_PER_BLOCK
    }

    #[view]
    public fun get_min_deposit(): u64 {
        MIN_DEPOSIT
    }

    #[view]
    public fun get_stream_info(payer_address: address): (address, u64, u64, bool, u64) acquires PaymentStream {
        let stream = borrow_global<PaymentStream>(payer_address);
        (
            stream.protocol_address,
            stream.balance,
            stream.rate_per_block,
            stream.is_active,
            stream.total_paid,
        )
    }

    #[view]
    public fun get_treasury_stats(): (u64, u64) acquires Treasury {
        let treasury = borrow_global<Treasury>(@moveguard);
        (coin::value(&treasury.balance), treasury.total_collected)
    }
}
