/// VulnerableVault - A sample vault contract for MoveGuard threat detection testing
/// Contains INTENTIONAL security vulnerabilities for security analysis demonstration
module moveguard::vulnerable_vault {
    use std::signer;
    use aptos_framework::coin::{Self, Coin};
    use aptos_framework::aptos_coin::AptosCoin;

    /// Error codes
    const E_INSUFFICIENT_BALANCE: u64 = 1;
    const E_VAULT_NOT_FOUND: u64 = 2;

    /// VULNERABILITY 1: Hardcoded admin address - should be configurable
    const ADMIN: address = @0xdead;

    /// Vault resource storing user funds
    struct Vault has key {
        balance: Coin<AptosCoin>,
        total_deposits: u64,
    }

    /// VULNERABILITY 2: No initialization protection
    /// Missing: assert!(!exists<Vault>(signer::address_of(account)), E_ALREADY_INITIALIZED);
    /// Anyone can overwrite an existing vault
    public entry fun initialize(account: &signer) {
        move_to(account, Vault {
            balance: coin::zero<AptosCoin>(),
            total_deposits: 0,
        });
    }

    /// VULNERABILITY 3: Missing access control - signer parameter is UNUSED!
    /// This function allows ANYONE to withdraw funds to the hardcoded ADMIN address
    /// The _account parameter is never verified
    public entry fun emergency_withdraw(
        _account: &signer,  // UNUSED - Critical vulnerability!
        vault_addr: address,
        amount: u64
    ) acquires Vault {
        let vault = borrow_global_mut<Vault>(vault_addr);
        assert!(coin::value(&vault.balance) >= amount, E_INSUFFICIENT_BALANCE);
        let withdrawn = coin::extract(&mut vault.balance, amount);
        // Funds go to hardcoded ADMIN, not the caller
        coin::deposit(ADMIN, withdrawn);
    }

    /// VULNERABILITY 4: Integer overflow possible
    /// No checked arithmetic - total_deposits can overflow
    public entry fun deposit(account: &signer, amount: u64) acquires Vault {
        let addr = signer::address_of(account);
        assert!(exists<Vault>(addr), E_VAULT_NOT_FOUND);
        let vault = borrow_global_mut<Vault>(addr);
        // OVERFLOW: No checked_add, can wrap around
        vault.total_deposits = vault.total_deposits + amount;
        let coins = coin::withdraw<AptosCoin>(account, amount);
        coin::merge(&mut vault.balance, coins);
    }

    /// VULNERABILITY 5: State update AFTER transfer (reentrancy-like pattern)
    /// The balance state should be updated BEFORE the transfer
    public entry fun withdraw(account: &signer, amount: u64) acquires Vault {
        let addr = signer::address_of(account);
        assert!(exists<Vault>(addr), E_VAULT_NOT_FOUND);
        let vault = borrow_global_mut<Vault>(addr);
        assert!(coin::value(&vault.balance) >= amount, E_INSUFFICIENT_BALANCE);
        let withdrawn = coin::extract(&mut vault.balance, amount);
        // WRONG ORDER: Transfer happens BEFORE state update
        coin::deposit(addr, withdrawn);
        // State update should happen BEFORE transfer
        vault.total_deposits = vault.total_deposits - amount;
    }

    // VULNERABILITY 6: Public view function exposes internal state
    // Combined with other vulnerabilities, this aids attackers
    #[view]
    public fun get_balance(vault_addr: address): u64 acquires Vault {
        let vault = borrow_global<Vault>(vault_addr);
        coin::value(&vault.balance)
    }

    #[view]
    public fun get_total_deposits(vault_addr: address): u64 acquires Vault {
        let vault = borrow_global<Vault>(vault_addr);
        vault.total_deposits
    }
}
