use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface, transfer_checked, TransferChecked};

use crate::constants::{ICO_SEED, ICO_TOKEN_VAULT_SEED, TOKEN_DECIMALS};
use crate::error::NovaError;
use crate::state::{IcoConfig, IcoPhase};

#[derive(Accounts)]
pub struct WithdrawFunds<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [ICO_SEED],
        bump = ico_config.bump,
        constraint = ico_config.authority == authority.key() @ NovaError::Unauthorized,
    )]
    pub ico_config: Account<'info, IcoConfig>,

    pub token_mint: InterfaceAccount<'info, Mint>,

    #[account(
        mut,
        seeds = [ICO_TOKEN_VAULT_SEED, token_mint.key().as_ref()],
        bump,
    )]
    pub ico_token_vault: InterfaceAccount<'info, TokenAccount>,

    #[account(
        mut,
        constraint = authority_token_account.owner == authority.key(),
        constraint = authority_token_account.mint == token_mint.key(),
    )]
    pub authority_token_account: InterfaceAccount<'info, TokenAccount>,

    pub token_program: Interface<'info, TokenInterface>,
}

pub fn handler(ctx: Context<WithdrawFunds>) -> Result<()> {
    let ico_config = &ctx.accounts.ico_config;

    // Only allow withdrawal after ICO ends
    require!(ico_config.phase == IcoPhase::Ended, NovaError::IcoNotEnded);

    let remaining_tokens = ctx.accounts.ico_token_vault.amount;

    if remaining_tokens > 0 {
        // Transfer remaining tokens back to authority
        let seeds = &[ICO_SEED, &[ico_config.bump]];
        let signer_seeds = &[&seeds[..]];

        let cpi_accounts = TransferChecked {
            from: ctx.accounts.ico_token_vault.to_account_info(),
            mint: ctx.accounts.token_mint.to_account_info(),
            to: ctx.accounts.authority_token_account.to_account_info(),
            authority: ctx.accounts.ico_config.to_account_info(),
        };

        transfer_checked(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.key(),
                cpi_accounts,
                signer_seeds,
            ),
            remaining_tokens,
            TOKEN_DECIMALS,
        )?;

        msg!("Withdrawn {} unsold tokens", remaining_tokens);
    }

    msg!("ICO completed. Total SOL raised: {} lamports", ico_config.sol_raised);
    msg!("Total tokens sold: {}", ico_config.tokens_sold);

    Ok(())
}
