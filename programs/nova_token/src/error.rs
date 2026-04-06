use anchor_lang::prelude::*;

#[error_code]
pub enum NovaError {
    #[msg("ICO is not currently active")]
    IcoNotActive,

    #[msg("ICO has already ended")]
    IcoEnded,

    #[msg("Purchase amount is below minimum")]
    BelowMinPurchase,

    #[msg("Purchase amount exceeds maximum")]
    ExceedsMaxPurchase,

    #[msg("Insufficient tokens remaining in ICO")]
    InsufficientTokens,

    #[msg("Invalid ICO phase")]
    InvalidPhase,

    #[msg("Unauthorized access")]
    Unauthorized,

    #[msg("ICO has not ended yet")]
    IcoNotEnded,

    #[msg("Arithmetic overflow")]
    Overflow,

    #[msg("Invalid token amount")]
    InvalidAmount,
}
