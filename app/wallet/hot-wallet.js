/**
 * NovaCoin Hot Wallet
 *
 * A hot wallet implementation for managing online transactions.
 * WARNING: Hot wallets are connected to the internet and should only
 * hold funds needed for immediate operations.
 */

const {
    Connection,
    Keypair,
    PublicKey,
    Transaction,
    SystemProgram,
    LAMPORTS_PER_SOL,
    sendAndConfirmTransaction,
} = require('@solana/web3.js');
const {
    getOrCreateAssociatedTokenAccount,
    transfer,
    getAccount,
    TOKEN_PROGRAM_ID,
} = require('@solana/spl-token');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class HotWallet {
    /**
     * Create a new HotWallet instance
     * @param {string} network - 'devnet', 'testnet', or 'mainnet-beta'
     */
    constructor(network = 'devnet') {
        const endpoints = {
            'devnet': 'https://api.devnet.solana.com',
            'testnet': 'https://api.testnet.solana.com',
            'mainnet-beta': 'https://api.mainnet-beta.solana.com',
        };

        this.network = network;
        this.connection = new Connection(endpoints[network], 'confirmed');
        this.keypair = null;
        this.walletPath = path.join(__dirname, '.wallet');
    }

    /**
     * Generate a new wallet keypair
     * @returns {PublicKey} The public key of the new wallet
     */
    generateWallet() {
        this.keypair = Keypair.generate();
        console.log('New wallet generated');
        console.log('Public Key:', this.keypair.publicKey.toBase58());
        return this.keypair.publicKey;
    }

    /**
     * Import wallet from secret key
     * @param {Uint8Array|number[]} secretKey - The secret key bytes
     */
    importFromSecretKey(secretKey) {
        this.keypair = Keypair.fromSecretKey(Uint8Array.from(secretKey));
        console.log('Wallet imported');
        console.log('Public Key:', this.keypair.publicKey.toBase58());
        return this.keypair.publicKey;
    }

    /**
     * Save wallet to encrypted file
     * @param {string} password - Password to encrypt the wallet
     * @param {string} filename - Optional filename
     */
    saveWallet(password, filename = 'hot-wallet.enc') {
        if (!this.keypair) {
            throw new Error('No wallet loaded');
        }

        // Derive encryption key from password
        const salt = crypto.randomBytes(32);
        const key = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256');
        const iv = crypto.randomBytes(16);

        // Encrypt the secret key
        const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
        let encrypted = cipher.update(Buffer.from(this.keypair.secretKey));
        encrypted = Buffer.concat([encrypted, cipher.final()]);
        const authTag = cipher.getAuthTag();

        // Save to file
        const walletData = {
            salt: salt.toString('hex'),
            iv: iv.toString('hex'),
            authTag: authTag.toString('hex'),
            encrypted: encrypted.toString('hex'),
            publicKey: this.keypair.publicKey.toBase58(),
        };

        if (!fs.existsSync(this.walletPath)) {
            fs.mkdirSync(this.walletPath, { recursive: true });
        }

        const filePath = path.join(this.walletPath, filename);
        fs.writeFileSync(filePath, JSON.stringify(walletData, null, 2));
        console.log('Wallet saved to:', filePath);
    }

    /**
     * Load wallet from encrypted file
     * @param {string} password - Password to decrypt the wallet
     * @param {string} filename - Optional filename
     */
    loadWallet(password, filename = 'hot-wallet.enc') {
        const filePath = path.join(this.walletPath, filename);

        if (!fs.existsSync(filePath)) {
            throw new Error(`Wallet file not found: ${filePath}`);
        }

        const walletData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

        // Derive key from password
        const salt = Buffer.from(walletData.salt, 'hex');
        const key = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256');
        const iv = Buffer.from(walletData.iv, 'hex');
        const authTag = Buffer.from(walletData.authTag, 'hex');
        const encrypted = Buffer.from(walletData.encrypted, 'hex');

        // Decrypt
        const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
        decipher.setAuthTag(authTag);
        let decrypted = decipher.update(encrypted);
        decrypted = Buffer.concat([decrypted, decipher.final()]);

        this.keypair = Keypair.fromSecretKey(decrypted);
        console.log('Wallet loaded');
        console.log('Public Key:', this.keypair.publicKey.toBase58());
        return this.keypair.publicKey;
    }

    /**
     * Get SOL balance
     * @returns {Promise<number>} Balance in SOL
     */
    async getBalance() {
        if (!this.keypair) {
            throw new Error('No wallet loaded');
        }

        const balance = await this.connection.getBalance(this.keypair.publicKey);
        return balance / LAMPORTS_PER_SOL;
    }

    /**
     * Get token balance for a specific mint
     * @param {string} mintAddress - Token mint address
     * @returns {Promise<number>} Token balance
     */
    async getTokenBalance(mintAddress) {
        if (!this.keypair) {
            throw new Error('No wallet loaded');
        }

        try {
            const tokenAccount = await getOrCreateAssociatedTokenAccount(
                this.connection,
                this.keypair,
                new PublicKey(mintAddress),
                this.keypair.publicKey
            );

            const accountInfo = await getAccount(this.connection, tokenAccount.address);
            return Number(accountInfo.amount);
        } catch (error) {
            console.error('Error getting token balance:', error.message);
            return 0;
        }
    }

    /**
     * Send SOL to another address
     * @param {string} toAddress - Recipient address
     * @param {number} amount - Amount in SOL
     * @returns {Promise<string>} Transaction signature
     */
    async sendSOL(toAddress, amount) {
        if (!this.keypair) {
            throw new Error('No wallet loaded');
        }

        const transaction = new Transaction().add(
            SystemProgram.transfer({
                fromPubkey: this.keypair.publicKey,
                toPubkey: new PublicKey(toAddress),
                lamports: amount * LAMPORTS_PER_SOL,
            })
        );

        const signature = await sendAndConfirmTransaction(
            this.connection,
            transaction,
            [this.keypair]
        );

        console.log('SOL sent! Signature:', signature);
        return signature;
    }

    /**
     * Send tokens to another address
     * @param {string} mintAddress - Token mint address
     * @param {string} toAddress - Recipient address
     * @param {number} amount - Amount of tokens (in smallest unit)
     * @returns {Promise<string>} Transaction signature
     */
    async sendTokens(mintAddress, toAddress, amount) {
        if (!this.keypair) {
            throw new Error('No wallet loaded');
        }

        const mint = new PublicKey(mintAddress);
        const toPublicKey = new PublicKey(toAddress);

        // Get or create sender's token account
        const fromTokenAccount = await getOrCreateAssociatedTokenAccount(
            this.connection,
            this.keypair,
            mint,
            this.keypair.publicKey
        );

        // Get or create recipient's token account
        const toTokenAccount = await getOrCreateAssociatedTokenAccount(
            this.connection,
            this.keypair,
            mint,
            toPublicKey
        );

        // Transfer tokens
        const signature = await transfer(
            this.connection,
            this.keypair,
            fromTokenAccount.address,
            toTokenAccount.address,
            this.keypair.publicKey,
            amount
        );

        console.log('Tokens sent! Signature:', signature);
        return signature;
    }

    /**
     * Request airdrop (devnet only)
     * @param {number} amount - Amount in SOL
     * @returns {Promise<string>} Transaction signature
     */
    async requestAirdrop(amount = 1) {
        if (this.network !== 'devnet') {
            throw new Error('Airdrop only available on devnet');
        }

        if (!this.keypair) {
            throw new Error('No wallet loaded');
        }

        const signature = await this.connection.requestAirdrop(
            this.keypair.publicKey,
            amount * LAMPORTS_PER_SOL
        );

        await this.connection.confirmTransaction(signature);
        console.log('Airdrop received! Signature:', signature);
        return signature;
    }

    /**
     * Get public key as string
     * @returns {string} Public key in base58
     */
    getPublicKey() {
        if (!this.keypair) {
            throw new Error('No wallet loaded');
        }
        return this.keypair.publicKey.toBase58();
    }

    /**
     * Export secret key (use with caution!)
     * @returns {number[]} Secret key as array
     */
    exportSecretKey() {
        if (!this.keypair) {
            throw new Error('No wallet loaded');
        }
        console.warn('WARNING: Never share your secret key!');
        return Array.from(this.keypair.secretKey);
    }
}

module.exports = { HotWallet };

// CLI usage
if (require.main === module) {
    const wallet = new HotWallet('devnet');

    const args = process.argv.slice(2);
    const command = args[0];

    (async () => {
        switch (command) {
            case 'generate':
                wallet.generateWallet();
                if (args[1]) {
                    wallet.saveWallet(args[1]);
                }
                break;

            case 'load':
                if (!args[1]) {
                    console.error('Password required');
                    process.exit(1);
                }
                wallet.loadWallet(args[1]);
                const balance = await wallet.getBalance();
                console.log('Balance:', balance, 'SOL');
                break;

            case 'airdrop':
                if (!args[1]) {
                    console.error('Password required');
                    process.exit(1);
                }
                wallet.loadWallet(args[1]);
                await wallet.requestAirdrop(args[2] ? parseFloat(args[2]) : 1);
                break;

            case 'send':
                if (!args[1] || !args[2] || !args[3]) {
                    console.error('Usage: send <password> <to_address> <amount>');
                    process.exit(1);
                }
                wallet.loadWallet(args[1]);
                await wallet.sendSOL(args[2], parseFloat(args[3]));
                break;

            default:
                console.log('NovaCoin Hot Wallet');
                console.log('Commands:');
                console.log('  generate [password]     - Generate new wallet');
                console.log('  load <password>         - Load wallet and show balance');
                console.log('  airdrop <password> [amount] - Request airdrop (devnet)');
                console.log('  send <password> <to> <amount> - Send SOL');
        }
    })();
}
