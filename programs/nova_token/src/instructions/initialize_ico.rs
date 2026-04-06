use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface, transfer_checked, TransferChecked};

use crate::constants::{ICO_SEED, ICO_TOKEN_VAULT_SEED, TOKEN_DECIMALS};
use crate::state::{IcoConfig, IcoPhase};

#[derive(Accounts)]
pub struct InitializeIco<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        init,
        payer = authority,
        space = IcoConfig::LEN,
        seeds = [ICO_SEED],
        bump,
    )]
    pub ico_config: Account<'info, IcoConfig>,

    pub token_mint: InterfaceAccount<'info, Mint>,

    /// Authority's token account (source of ICO tokens)
    #[account(
        mut,
        constraint = authority_token_account.owner == authority.key(),
        constraint = authority_token_account.mint == token_mint.key(),
    )]
    pub authority_token_account: InterfaceAccount<'info, TokenAccount>,

    /// ICO token vault (PDA-controlled)
    #[account(
        init,
        payer = authority,
        token::mint = token_mint,
        token::authority = ico_config,
        seeds = [ICO_TOKEN_VAULT_SEED, token_mint.key().as_ref()],
        bump,
    )]
    pub ico_token_vault: InterfaceAccount<'info, TokenAccount>,

    /// CHECK: Treasury account to receive SOL
    pub treasury: UncheckedAccount<'info>,

    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<InitializeIco>,
    tokens_for_sale: u64,
    start_time: i64,
    end_time: i64,
) -> Result<()> {
    let ico_config = &mut ctx.accounts.ico_config;

    ico_config.authority = ctx.accounts.authority.key();
    ico_config.token_mint = ctx.accounts.token_mint.key();
    ico_config.treasury = ctx.accounts.treasury.key();
    ico_config.phase = IcoPhase::NotStarted;
    ico_config.total_tokens_for_sale = tokens_for_sale;
    ico_config.tokens_sold = 0;
    ico_config.sol_raised = 0;
    ico_config.start_time = start_time;
    ico_config.end_time = end_time;
    ico_config.bump = ctx.bumps.ico_config;

    // Transfer tokens to ICO vault
    let cpi_accounts = TransferChecked {
        from: ctx.accounts.authority_token_account.to_account_info(),
        mint: ctx.accounts.token_mint.to_account_info(),
        to: ctx.accounts.ico_token_vault.to_account_info(),
        authority: ctx.accounts.authority.to_account_info(),
    };

    let cpi_ctx = CpiContext::new(
        ctx.accounts.token_program.key(),
        cpi_accounts,
    );
    transfer_checked(cpi_ctx, tokens_for_sale, TOKEN_DECIMALS)?;

    msg!("ICO initialized with {} tokens for sale", tokens_for_sale);
    msg!("Start time: {}, End time: {}", start_time, end_time);

    Ok(())
}
