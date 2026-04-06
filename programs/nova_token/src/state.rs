use anchor_lang::prelude::*;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum IcoPhase {
    NotStarted,
    SeedRound,
    PrivateSale,
    PublicSale,
    Ended,
}

impl Default for IcoPhase {
    fn default() -> Self {
        IcoPhase::NotStarted
    }
}

#[account]
#[derive(Default)]
pub struct IcoConfig {
    /// Authority who can manage the ICO
    pub authority: Pubkey,
    /// Token mint address
    pub token_mint: Pubkey,
    /// Treasury wallet for receiving SOL
    pub treasury: Pubkey,
    /// Current ICO phase
    pub phase: IcoPhase,
    /// Total tokens allocated for ICO
    pub total_tokens_for_sale: u64,
    /// Tokens already sold
    pub tokens_sold: u64,
    /// Total SOL raised (in lamports)
    pub sol_raised: u64,
    /// Start timestamp
    pub start_time: i64,
    /// End timestamp
    pub end_time: i64,
    /// Bump seed for PDA
    pub bump: u8,
}

impl IcoConfig {
    pub const LEN: usize = 8 + // discriminator
        32 + // authority
        32 + // token_mint
        32 + // treasury
        1 +  // phase
        8 +  // total_tokens_for_sale
        8 +  // tokens_sold
        8 +  // sol_raised
        8 +  // start_time
        8 +  // end_time
        1;   // bump

    pub fn get_token_rate(&self) -> u64 {
        match self.phase {
            IcoPhase::SeedRound => crate::constants::SEED_ROUND_RATE,
            IcoPhase::PrivateSale => crate::constants::PRIVATE_SALE_RATE,
            IcoPhase::PublicSale => crate::constants::PUBLIC_SALE_RATE,
            _ => 0,
        }
    }
}

#[account]
#[derive(Default)]
pub struct PurchaseRecord {
    /// Buyer's wallet
    pub buyer: Pubkey,
    /// Total SOL spent (in lamports)
    pub total_sol_spent: u64,
    /// Total tokens purchased
    pub total_tokens_purchased: u64,
    /// Bump seed
    pub bump: u8,
}

impl PurchaseRecord {
    pub const LEN: usize = 8 + // discriminator
        32 + // buyer
        8 +  // total_sol_spent
        8 +  // total_tokens_purchased
        1;   // bump
}
