pub mod constants;
pub mod error;
pub mod instructions;
pub mod state;

use anchor_lang::prelude::*;

pub use constants::*;
pub use error::*;
pub use instructions::*;
pub use state::*;

declare_id!("DQXzUhFzKaHJMPLz4Fy57nmkLSJbTvrjbeXwhHxbPNUx");

#[program]
pub mod nova_token {
    use super::*;

    /// Initialize the NovaCoin token with metadata
    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        instructions::initialize::handler(ctx)
    }

    /// Initialize the ICO with token allocation and timing
    pub fn initialize_ico(
        ctx: Context<InitializeIco>,
        tokens_for_sale: u64,
        start_time: i64,
        end_time: i64,
    ) -> Result<()> {
        instructions::initialize_ico::handler(ctx, tokens_for_sale, start_time, end_time)
    }

    /// Buy tokens during an active ICO phase
    pub fn buy_tokens(ctx: Context<BuyTokens>, sol_amount: u64) -> Result<()> {
        instructions::buy_tokens::handler(ctx, sol_amount)
    }

    /// Set the current ICO phase (admin only)
    /// 0 = NotStarted, 1 = SeedRound, 2 = PrivateSale, 3 = PublicSale, 4 = Ended
    pub fn set_phase(ctx: Context<SetPhase>, new_phase: u8) -> Result<()> {
        instructions::set_phase::handler(ctx, new_phase)
    }

    /// Withdraw remaining tokens after ICO ends (admin only)
    pub fn withdraw_funds(ctx: Context<WithdrawFunds>) -> Result<()> {
        instructions::withdraw_funds::handler(ctx)
    }
}
