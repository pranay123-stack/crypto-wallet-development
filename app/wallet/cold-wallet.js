/**
 * NovaCoin Cold Wallet
 *
 * An OFFLINE cold wallet implementation for secure key storage and signing.
 * This wallet is designed to be used on an air-gapped machine.
 *
 * SECURITY BEST PRACTICES:
 * 1. Generate keys on an air-gapped (offline) computer
 * 2. Never connect the cold wallet machine to the internet
 * 3. Transfer transactions via QR codes or USB drives
 * 4. Verify transaction details before signing
 */

const {
    Keypair,
    PublicKey,
    Transaction,
    VersionedTransaction,
} = require('@solana/web3.js');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bs58 = require('bs58');

class ColdWallet {
    constructor() {
        this.keypair = null;
        this.walletPath = path.join(__dirname, '.cold-wallet');
    }

    /**
     * Generate a new cold wallet keypair
     * Uses cryptographically secure random generation
     * @returns {object} Wallet information (public key only for display)
     */
    generateWallet() {
        // Generate using secure random bytes
        const randomBytes = crypto.randomBytes(32);
        this.keypair = Keypair.fromSeed(randomBytes);

        console.log('='.repeat(60));
        console.log('NEW COLD WALLET GENERATED');
        console.log('='.repeat(60));
        console.log('Public Key:', this.keypair.publicKey.toBase58());
        console.log('');
        console.log('IMPORTANT: Save your wallet securely before closing!');
        console.log('Use the saveWallet() method with a strong password.');
        console.log('='.repeat(60));

        return {
            publicKey: this.keypair.publicKey.toBase58(),
        };
    }

    /**
     * Generate wallet from mnemonic seed phrase (BIP39-style)
     * @param {string} seedPhrase - Space-separated seed words
     */
    fromSeedPhrase(seedPhrase) {
        // Hash the seed phrase to get consistent 32 bytes
        const hash = crypto.createHash('sha256').update(seedPhrase).digest();
        this.keypair = Keypair.fromSeed(hash);

        console.log('Wallet restored from seed phrase');
        console.log('Public Key:', this.keypair.publicKey.toBase58());

        return this.keypair.publicKey.toBase58();
    }

    /**
     * Save wallet with strong encryption
     * @param {string} password - Strong password (min 12 characters recommended)
     * @param {string} filename - Optional filename
     */
    saveWallet(password, filename = 'cold-wallet.enc') {
        if (!this.keypair) {
            throw new Error('No wallet loaded');
        }

        if (password.length < 8) {
            throw new Error('Password must be at least 8 characters');
        }

        // Strong key derivation
        const salt = crypto.randomBytes(64);
        const key = crypto.pbkdf2Sync(password, salt, 210000, 32, 'sha512');
        const iv = crypto.randomBytes(16);

        // Encrypt secret key
        const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
        let encrypted = cipher.update(Buffer.from(this.keypair.secretKey));
        encrypted = Buffer.concat([encrypted, cipher.final()]);
        const authTag = cipher.getAuthTag();

        // Create checksum for integrity verification
        const checksum = crypto
            .createHash('sha256')
            .update(this.keypair.secretKey)
            .digest('hex')
            .slice(0, 8);

        const walletData = {
            version: 2,
            type: 'cold-wallet',
            salt: salt.toString('hex'),
            iv: iv.toString('hex'),
            authTag: authTag.toString('hex'),
            encrypted: encrypted.toString('hex'),
            publicKey: this.keypair.publicKey.toBase58(),
            checksum: checksum,
            createdAt: new Date().toISOString(),
        };

        if (!fs.existsSync(this.walletPath)) {
            fs.mkdirSync(this.walletPath, { recursive: true, mode: 0o700 });
        }

        const filePath = path.join(this.walletPath, filename);
        fs.writeFileSync(filePath, JSON.stringify(walletData, null, 2), {
            mode: 0o600,
        });

        console.log('Cold wallet saved to:', filePath);
        console.log('Public Key:', this.keypair.publicKey.toBase58());

        return filePath;
    }

    /**
     * Load wallet from encrypted file
     * @param {string} password - Password used to encrypt
     * @param {string} filename - Optional filename
     */
    loadWallet(password, filename = 'cold-wallet.enc') {
        const filePath = path.join(this.walletPath, filename);

        if (!fs.existsSync(filePath)) {
            throw new Error(`Wallet file not found: ${filePath}`);
        }

        const walletData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

        // Derive key
        const salt = Buffer.from(walletData.salt, 'hex');
        const iterations = walletData.version === 2 ? 210000 : 100000;
        const algorithm = walletData.version === 2 ? 'sha512' : 'sha256';
        const key = crypto.pbkdf2Sync(password, salt, iterations, 32, algorithm);

        const iv = Buffer.from(walletData.iv, 'hex');
        const authTag = Buffer.from(walletData.authTag, 'hex');
        const encrypted = Buffer.from(walletData.encrypted, 'hex');

        // Decrypt
        const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
        decipher.setAuthTag(authTag);

        let decrypted;
        try {
            decrypted = decipher.update(encrypted);
            decrypted = Buffer.concat([decrypted, decipher.final()]);
        } catch (error) {
            throw new Error('Invalid password or corrupted wallet file');
        }

        // Verify checksum if present
        if (walletData.checksum) {
            const checksum = crypto
                .createHash('sha256')
                .update(decrypted)
                .digest('hex')
                .slice(0, 8);

            if (checksum !== walletData.checksum) {
                throw new Error('Wallet checksum mismatch - file may be corrupted');
            }
        }

        this.keypair = Keypair.fromSecretKey(decrypted);
        console.log('Cold wallet loaded');
        console.log('Public Key:', this.keypair.publicKey.toBase58());

        return this.keypair.publicKey.toBase58();
    }

    /**
     * Sign a serialized transaction (offline)
     * @param {string} serializedTx - Base64 encoded transaction
     * @returns {string} Base64 encoded signed transaction
     */
    signTransaction(serializedTx) {
        if (!this.keypair) {
            throw new Error('No wallet loaded');
        }

        // Decode the transaction
        const txBuffer = Buffer.from(serializedTx, 'base64');

        try {
            // Try as legacy transaction first
            const transaction = Transaction.from(txBuffer);

            // Display transaction details for verification
            console.log('='.repeat(60));
            console.log('TRANSACTION DETAILS - VERIFY BEFORE SIGNING');
            console.log('='.repeat(60));
            console.log('Recent Blockhash:', transaction.recentBlockhash);
            console.log('Fee Payer:', transaction.feePayer?.toBase58());
            console.log('Instructions:', transaction.instructions.length);

            transaction.instructions.forEach((ix, i) => {
                console.log(`\nInstruction ${i + 1}:`);
                console.log('  Program:', ix.programId.toBase58());
                console.log('  Accounts:', ix.keys.length);
                ix.keys.forEach((key, j) => {
                    console.log(
                        `    ${j + 1}. ${key.pubkey.toBase58()} (signer: ${key.isSigner}, writable: ${key.isWritable})`
                    );
                });
            });

            console.log('='.repeat(60));

            // Sign the transaction
            transaction.partialSign(this.keypair);

            // Return serialized signed transaction
            const signedTx = transaction.serialize({
                requireAllSignatures: false,
            });

            return signedTx.toString('base64');
        } catch (error) {
            // Try as versioned transaction
            const versionedTx = VersionedTransaction.deserialize(txBuffer);

            console.log('='.repeat(60));
            console.log('VERSIONED TRANSACTION - VERIFY BEFORE SIGNING');
            console.log('='.repeat(60));
            console.log('Recent Blockhash:', bs58.encode(versionedTx.message.recentBlockhash));
            console.log('='.repeat(60));

            versionedTx.sign([this.keypair]);

            return Buffer.from(versionedTx.serialize()).toString('base64');
        }
    }

    /**
     * Sign arbitrary data (for message signing)
     * @param {string|Buffer} data - Data to sign
     * @returns {string} Base58 encoded signature
     */
    signData(data) {
        if (!this.keypair) {
            throw new Error('No wallet loaded');
        }

        const message = typeof data === 'string' ? Buffer.from(data) : data;
        const signature = require('tweetnacl').sign.detached(message, this.keypair.secretKey);

        return bs58.encode(signature);
    }

    /**
     * Get public key
     * @returns {string} Public key in base58
     */
    getPublicKey() {
        if (!this.keypair) {
            throw new Error('No wallet loaded');
        }
        return this.keypair.publicKey.toBase58();
    }

    /**
     * Create a paper backup (encoded secret key for writing down)
     * WARNING: Handle with extreme care!
     * @returns {string} Encoded backup data
     */
    createPaperBackup() {
        if (!this.keypair) {
            throw new Error('No wallet loaded');
        }

        console.log('='.repeat(60));
        console.log('PAPER BACKUP - KEEP THIS SECURE!');
        console.log('='.repeat(60));
        console.log('Public Key:', this.keypair.publicKey.toBase58());
        console.log('');
        console.log('Secret Key (Base58):');
        console.log(bs58.encode(this.keypair.secretKey));
        console.log('');
        console.log('WARNING: Anyone with this key can access your funds!');
        console.log('Store in a secure location (e.g., safety deposit box)');
        console.log('='.repeat(60));

        return {
            publicKey: this.keypair.publicKey.toBase58(),
            secretKey: bs58.encode(this.keypair.secretKey),
        };
    }

    /**
     * Restore from paper backup
     * @param {string} secretKeyBase58 - Base58 encoded secret key
     */
    restoreFromBackup(secretKeyBase58) {
        const secretKey = bs58.decode(secretKeyBase58);
        this.keypair = Keypair.fromSecretKey(secretKey);

        console.log('Wallet restored from backup');
        console.log('Public Key:', this.keypair.publicKey.toBase58());

        return this.keypair.publicKey.toBase58();
    }
}

module.exports = { ColdWallet };

// CLI usage
if (require.main === module) {
    const wallet = new ColdWallet();
    const args = process.argv.slice(2);
    const command = args[0];

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
            break;

        case 'sign':
            if (!args[1] || !args[2]) {
                console.error('Usage: sign <password> <base64_transaction>');
                process.exit(1);
            }
            wallet.loadWallet(args[1]);
            const signed = wallet.signTransaction(args[2]);
            console.log('\nSigned Transaction (Base64):');
            console.log(signed);
            break;

        case 'backup':
            if (!args[1]) {
                console.error('Password required');
                process.exit(1);
            }
            wallet.loadWallet(args[1]);
            wallet.createPaperBackup();
            break;

        case 'restore':
            if (!args[1]) {
                console.error('Usage: restore <base58_secret_key>');
                process.exit(1);
            }
            wallet.restoreFromBackup(args[1]);
            if (args[2]) {
                wallet.saveWallet(args[2]);
            }
            break;

        default:
            console.log('NovaCoin Cold Wallet (Offline Signing)');
            console.log('');
            console.log('Commands:');
            console.log('  generate [password]        - Generate new cold wallet');
            console.log('  load <password>            - Load existing wallet');
            console.log('  sign <password> <tx>       - Sign a transaction (base64)');
            console.log('  backup <password>          - Create paper backup');
            console.log('  restore <secret> [pass]    - Restore from backup');
    }
}
