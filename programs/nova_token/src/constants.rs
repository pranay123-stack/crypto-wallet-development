use anchor_lang::prelude::*;

// Token Configuration
pub const TOKEN_NAME: &str = "NovaCoin";
pub const TOKEN_SYMBOL: &str = "NOVA";
pub const TOKEN_DECIMALS: u8 = 9;
pub const TOTAL_SUPPLY: u64 = 1_000_000_000_000_000_000; // 1 billion tokens (with 9 decimals)

// ICO Configuration
pub const ICO_SEED: &[u8] = b"ico_config";
pub const TREASURY_SEED: &[u8] = b"treasury";
pub const ICO_TOKEN_VAULT_SEED: &[u8] = b"ico_vault";

// ICO Phases (tokens per SOL, accounting for decimals)
pub const SEED_ROUND_RATE: u64 = 50_000_000_000_000;      // 50,000 NOVA per SOL
pub const PRIVATE_SALE_RATE: u64 = 40_000_000_000_000;    // 40,000 NOVA per SOL
pub const PUBLIC_SALE_RATE: u64 = 30_000_000_000_000;     // 30,000 NOVA per SOL

// Minimum/Maximum purchase limits (in lamports)
pub const MIN_PURCHASE: u64 = 100_000_000;    // 0.1 SOL
pub const MAX_PURCHASE: u64 = 100_000_000_000; // 100 SOL

#[constant]
pub const SEED: &str = "anchor";
