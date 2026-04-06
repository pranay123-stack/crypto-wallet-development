use anchor_lang::prelude::*;

use crate::constants::ICO_SEED;
use crate::error::NovaError;
use crate::state::{IcoConfig, IcoPhase};

#[derive(Accounts)]
pub struct SetPhase<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [ICO_SEED],
        bump = ico_config.bump,
        constraint = ico_config.authority == authority.key() @ NovaError::Unauthorized,
    )]
    pub ico_config: Account<'info, IcoConfig>,
}

pub fn handler(ctx: Context<SetPhase>, new_phase: u8) -> Result<()> {
    let ico_config = &mut ctx.accounts.ico_config;

    let phase = match new_phase {
        0 => IcoPhase::NotStarted,
        1 => IcoPhase::SeedRound,
        2 => IcoPhase::PrivateSale,
        3 => IcoPhase::PublicSale,
        4 => IcoPhase::Ended,
        _ => return Err(NovaError::InvalidPhase.into()),
    };

    ico_config.phase = phase;

    msg!("ICO phase updated to: {:?}", new_phase);

    Ok(())
}
