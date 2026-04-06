use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenInterface};

use crate::constants::TOKEN_DECIMALS;

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        init,
        payer = authority,
        mint::decimals = TOKEN_DECIMALS,
        mint::authority = authority,
        mint::freeze_authority = authority,
    )]
    pub mint: InterfaceAccount<'info, Mint>,

    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<Initialize>) -> Result<()> {
    msg!("Initializing NovaCoin Token");
    msg!("Token Mint: {}", ctx.accounts.mint.key());
    msg!("Authority: {}", ctx.accounts.authority.key());
    Ok(())
}
