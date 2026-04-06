use anchor_lang::prelude::*;
use anchor_lang::system_program;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface, transfer_checked, TransferChecked};

use crate::constants::{ICO_SEED, ICO_TOKEN_VAULT_SEED, MAX_PURCHASE, MIN_PURCHASE, TOKEN_DECIMALS};
use crate::error::NovaError;
use crate::state::{IcoConfig, IcoPhase, PurchaseRecord};

#[derive(Accounts)]
pub struct BuyTokens<'info> {
    #[account(mut)]
    pub buyer: Signer<'info>,

    #[account(
        mut,
        seeds = [ICO_SEED],
        bump = ico_config.bump,
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
        init_if_needed,
        payer = buyer,
        associated_token::mint = token_mint,
        associated_token::authority = buyer,
    )]
    pub buyer_token_account: InterfaceAccount<'info, TokenAccount>,

    #[account(
        init_if_needed,
        payer = buyer,
        space = PurchaseRecord::LEN,
        seeds = [b"purchase", buyer.key().as_ref()],
        bump,
    )]
    pub purchase_record: Account<'info, PurchaseRecord>,

    /// CHECK: Treasury to receive SOL
    #[account(
        mut,
        constraint = treasury.key() == ico_config.treasury @ NovaError::Unauthorized
    )]
    pub treasury: UncheckedAccount<'info>,

    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<BuyTokens>, sol_amount: u64) -> Result<()> {
    let ico_config = &mut ctx.accounts.ico_config;
    let purchase_record = &mut ctx.accounts.purchase_record;

    // Validate ICO is active
    require!(
        ico_config.phase != IcoPhase::NotStarted && ico_config.phase != IcoPhase::Ended,
        NovaError::IcoNotActive
    );

    // Validate purchase amount
    require!(sol_amount >= MIN_PURCHASE, NovaError::BelowMinPurchase);
    require!(sol_amount <= MAX_PURCHASE, NovaError::ExceedsMaxPurchase);

    // Calculate tokens to receive
    let token_rate = ico_config.get_token_rate();
    require!(token_rate > 0, NovaError::InvalidPhase);

    // tokens = (sol_amount * token_rate) / LAMPORTS_PER_SOL
    let tokens_to_receive = sol_amount
        .checked_mul(token_rate)
        .ok_or(NovaError::Overflow)?
        .checked_div(1_000_000_000) // LAMPORTS_PER_SOL
        .ok_or(NovaError::Overflow)?;

    // Check sufficient tokens available
    let tokens_remaining = ico_config
        .total_tokens_for_sale
        .checked_sub(ico_config.tokens_sold)
        .ok_or(NovaError::Overflow)?;
    require!(tokens_to_receive <= tokens_remaining, NovaError::InsufficientTokens);

    // Transfer SOL to treasury
    system_program::transfer(
        CpiContext::new(
            ctx.accounts.system_program.key(),
            system_program::Transfer {
                from: ctx.accounts.buyer.to_account_info(),
                to: ctx.accounts.treasury.to_account_info(),
            },
        ),
        sol_amount,
    )?;

    // Transfer tokens to buyer (using PDA authority)
    let seeds = &[ICO_SEED, &[ico_config.bump]];
    let signer_seeds = &[&seeds[..]];

    let cpi_accounts = TransferChecked {
        from: ctx.accounts.ico_token_vault.to_account_info(),
        mint: ctx.accounts.token_mint.to_account_info(),
        to: ctx.accounts.buyer_token_account.to_account_info(),
        authority: ico_config.to_account_info(),
    };

    transfer_checked(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.key(),
            cpi_accounts,
            signer_seeds,
        ),
        tokens_to_receive,
        TOKEN_DECIMALS,
    )?;

    // Update ICO state
    ico_config.tokens_sold = ico_config
        .tokens_sold
        .checked_add(tokens_to_receive)
        .ok_or(NovaError::Overflow)?;
    ico_config.sol_raised = ico_config
        .sol_raised
        .checked_add(sol_amount)
        .ok_or(NovaError::Overflow)?;

    // Update purchase record
    if purchase_record.buyer == Pubkey::default() {
        purchase_record.buyer = ctx.accounts.buyer.key();
        purchase_record.bump = ctx.bumps.purchase_record;
    }
    purchase_record.total_sol_spent = purchase_record
        .total_sol_spent
        .checked_add(sol_amount)
        .ok_or(NovaError::Overflow)?;
    purchase_record.total_tokens_purchased = purchase_record
        .total_tokens_purchased
        .checked_add(tokens_to_receive)
        .ok_or(NovaError::Overflow)?;

    msg!(
        "Purchase successful: {} SOL for {} NOVA tokens",
        sol_amount,
        tokens_to_receive
    );

    Ok(())
}
