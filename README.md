# NovaCoin - Solana Crypto Wallet & ICO Platform

A comprehensive Solana-based cryptocurrency project featuring:
- **SPL Token Smart Contract** (NovaCoin - NOVA)
- **Hot Wallet** - Online wallet for daily transactions
- **Cold Wallet** - Offline signing for secure storage
- **Payment Gateway** - Accept SOL/NOVA payments
- **ICO Platform** - Token sale with multiple phases

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    NovaCoin Ecosystem                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────┐    │
│  │  Hot Wallet  │  │  Cold Wallet │  │  NovaCoin Token    │    │
│  │  (Online)    │  │  (Offline)   │  │  Smart Contract    │    │
│  │              │  │              │  │  (Anchor/Rust)     │    │
│  └──────────────┘  └──────────────┘  └────────────────────┘    │
│         │                │                    │                 │
│         ▼                ▼                    ▼                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                   Solana Blockchain                       │  │
│  │                      (Devnet)                             │  │
│  └──────────────────────────────────────────────────────────┘  │
│         │                                     │                 │
│         ▼                                     ▼                 │
│  ┌──────────────┐                   ┌──────────────────┐       │
│  │   Payment    │                   │   ICO Frontend   │       │
│  │   Gateway    │                   │   (Web UI)       │       │
│  └──────────────┘                   └──────────────────┘       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Token Details

| Property | Value |
|----------|-------|
| **Name** | NovaCoin |
| **Symbol** | NOVA |
| **Decimals** | 9 |
| **Total Supply** | 1,000,000,000 (1 Billion) |
| **Network** | Solana (Devnet/Mainnet) |

## ICO Configuration

### Sale Phases

| Phase | Rate | Description |
|-------|------|-------------|
| Seed Round | 50,000 NOVA/SOL | Early investors |
| Private Sale | 40,000 NOVA/SOL | Pre-launch sale |
| Public Sale | 30,000 NOVA/SOL | Open to everyone |

### Purchase Limits

- **Minimum**: 0.1 SOL
- **Maximum**: 100 SOL per transaction

## Project Structure

```
nova_token/
├── programs/nova_token/          # Smart Contract (Anchor/Rust)
│   └── src/
│       ├── lib.rs               # Program entry point
│       ├── constants.rs         # Token configuration
│       ├── state.rs             # Account structures
│       ├── error.rs             # Custom errors
│       └── instructions/
│           ├── initialize.rs    # Create token mint
│           ├── initialize_ico.rs# Setup ICO
│           ├── buy_tokens.rs    # Purchase tokens
│           ├── set_phase.rs     # Admin: change phase
│           └── withdraw_funds.rs# Withdraw unsold tokens
│
├── app/
│   ├── wallet/
│   │   ├── hot-wallet.js        # Online wallet
│   │   └── cold-wallet.js       # Offline signing
│   ├── payment/
│   │   └── payment-gateway.js   # Payment processing
│   └── frontend/
│       ├── ico-client.js        # ICO client library
│       └── index.html           # Token sale UI
│
├── target/deploy/
│   └── nova_token.so            # Compiled program
│
└── package.json                 # Dependencies
```

## Prerequisites

- **Node.js** >= 18.0.0
- **Rust** (latest stable)
- **Solana CLI** >= 1.18.0
- **Anchor** >= 0.30.0

## Installation

### 1. Install Solana CLI

```bash
sh -c "$(curl -sSfL https://release.anza.xyz/stable/install)"
export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"
```

### 2. Install Anchor

```bash
cargo install --git https://github.com/coral-xyz/anchor avm --force
avm install latest
avm use latest
```

### 3. Clone & Setup Project

```bash
git clone https://github.com/pranay123-stack/crypto-wallet-development.git
cd crypto-wallet-development/nova_token
npm install
```

### 4. Configure Solana

```bash
# Set to devnet
solana config set --url devnet

# Create wallet (if needed)
solana-keygen new

# Get devnet SOL
solana airdrop 2
```

## Building & Deployment

### Build the Smart Contract

```bash
anchor build
```

### Deploy to Devnet

```bash
anchor deploy --provider.cluster devnet
```

### Update Program ID

After deployment, update the program ID in:
- `programs/nova_token/src/lib.rs`
- `Anchor.toml`

```rust
// In lib.rs
declare_id!("YOUR_DEPLOYED_PROGRAM_ID");
```

## Usage

### Hot Wallet

Online wallet for daily transactions with encrypted storage.

```bash
# Generate new wallet
npm run hot-wallet generate <password>

# Load existing wallet
npm run hot-wallet load <password>

# Get devnet airdrop
npm run hot-wallet airdrop <password> [amount]

# Send SOL
npm run hot-wallet send <password> <to_address> <amount>
```

**Features:**
- AES-256-GCM encryption
- PBKDF2 key derivation
- SOL and token transfers
- Balance checking

### Cold Wallet

Offline signing wallet for secure key storage.

```bash
# Generate new cold wallet
npm run cold-wallet generate <password>

# Create paper backup
npm run cold-wallet backup <password>

# Sign transaction offline
npm run cold-wallet sign <password> <base64_transaction>

# Restore from backup
npm run cold-wallet restore <base58_secret_key> [password]
```

**Security Features:**
- Stronger encryption (SHA-512, 210,000 iterations)
- Checksum verification
- Paper backup support
- Air-gapped signing

### Payment Gateway

Accept SOL and NOVA token payments.

```bash
npm run payment-gateway
```

**API Endpoints:**

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/payments` | Create payment request |
| GET | `/api/payments/:id` | Check payment status |
| GET | `/api/payments` | List pending payments |
| POST | `/api/payments/:id/cancel` | Cancel payment |
| POST | `/api/payments/:id/forward` | Forward funds to merchant |

**Example:**

```javascript
// Create payment
const response = await fetch('/api/payments', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    orderId: 'ORDER-123',
    amount: 0.5,
    currency: 'SOL'
  })
});

const { paymentAddress, paymentUri } = await response.json();
```

### ICO Frontend

Open `app/frontend/index.html` in a browser or serve via:

```bash
npx serve app/frontend
```

**Features:**
- Phantom wallet integration
- Real-time ICO stats
- Purchase interface
- Transaction history

## Smart Contract Instructions

### Initialize Token

Creates the NovaCoin token mint.

```javascript
await program.methods
  .initialize()
  .accounts({
    authority: wallet.publicKey,
    mint: mintKeypair.publicKey,
    tokenProgram: TOKEN_PROGRAM_ID,
    systemProgram: SystemProgram.programId,
  })
  .signers([mintKeypair])
  .rpc();
```

### Initialize ICO

Set up the token sale with allocation.

```javascript
await program.methods
  .initializeIco(
    new BN(tokensForSale),
    new BN(startTime),
    new BN(endTime)
  )
  .accounts({
    authority: wallet.publicKey,
    icoConfig: icoConfigPDA,
    tokenMint: mintAddress,
    authorityTokenAccount: authorityATA,
    icoTokenVault: vaultPDA,
    treasury: treasuryAddress,
    tokenProgram: TOKEN_PROGRAM_ID,
    systemProgram: SystemProgram.programId,
  })
  .rpc();
```

### Buy Tokens

Purchase tokens during active ICO phase.

```javascript
await program.methods
  .buyTokens(new BN(solAmount * LAMPORTS_PER_SOL))
  .accounts({
    buyer: wallet.publicKey,
    icoConfig: icoConfigPDA,
    tokenMint: mintAddress,
    icoTokenVault: vaultPDA,
    buyerTokenAccount: buyerATA,
    purchaseRecord: purchaseRecordPDA,
    treasury: treasuryAddress,
    tokenProgram: TOKEN_PROGRAM_ID,
    associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
    systemProgram: SystemProgram.programId,
  })
  .rpc();
```

### Set Phase (Admin)

Change ICO phase (0=NotStarted, 1=Seed, 2=Private, 3=Public, 4=Ended).

```javascript
await program.methods
  .setPhase(2) // Private Sale
  .accounts({
    authority: wallet.publicKey,
    icoConfig: icoConfigPDA,
  })
  .rpc();
```

## Security Considerations

### Hot Wallet
- Only keep funds needed for immediate use
- Use strong passwords (12+ characters)
- Regularly rotate wallet keys

### Cold Wallet
- Generate keys on air-gapped machine
- Store paper backups in secure locations
- Verify transaction details before signing

### Smart Contract
- Authority-controlled ICO phases
- Overflow protection with checked math
- PDA-secured token vault

## Testing

```bash
# Run Anchor tests
anchor test

# Run specific test
anchor test --skip-local-validator
```

## Tokenomics

| Allocation | Percentage | Tokens |
|------------|------------|--------|
| ICO Sale | 40% | 400,000,000 |
| Team & Advisors | 20% | 200,000,000 |
| Development | 15% | 150,000,000 |
| Marketing | 15% | 150,000,000 |
| Reserve | 10% | 100,000,000 |

## License

MIT License

## Disclaimer

This project is for educational and development purposes. Always conduct proper security audits before deploying to mainnet. Cryptocurrency investments carry risk - do your own research.

---

Built with Anchor Framework on Solana
