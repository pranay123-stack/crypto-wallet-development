/**
 * NovaCoin Payment Gateway
 *
 * A payment processing system for accepting SOL and NOVA token payments.
 * Supports webhook notifications, payment verification, and order management.
 */

const {
    Connection,
    PublicKey,
    Keypair,
    Transaction,
    SystemProgram,
    LAMPORTS_PER_SOL,
} = require('@solana/web3.js');
const {
    getAssociatedTokenAddress,
    getAccount,
    TOKEN_PROGRAM_ID,
} = require('@solana/spl-token');
const crypto = require('crypto');
const EventEmitter = require('events');

class PaymentGateway extends EventEmitter {
    /**
     * Create a new PaymentGateway instance
     * @param {object} config - Configuration options
     */
    constructor(config = {}) {
        super();

        this.config = {
            network: config.network || 'devnet',
            merchantWallet: config.merchantWallet,
            novaMint: config.novaMint,
            webhookSecret: config.webhookSecret || crypto.randomBytes(32).toString('hex'),
            confirmations: config.confirmations || 1,
            paymentTimeout: config.paymentTimeout || 30 * 60 * 1000, // 30 minutes
        };

        const endpoints = {
            'devnet': 'https://api.devnet.solana.com',
            'testnet': 'https://api.testnet.solana.com',
            'mainnet-beta': 'https://api.mainnet-beta.solana.com',
        };

        this.connection = new Connection(endpoints[this.config.network], 'confirmed');
        this.pendingPayments = new Map();
        this.completedPayments = new Map();

        // Start payment monitoring
        this._startMonitoring();
    }

    /**
     * Create a new payment request
     * @param {object} options - Payment options
     * @returns {object} Payment details
     */
    async createPayment(options) {
        const {
            orderId,
            amount,
            currency = 'SOL', // 'SOL' or 'NOVA'
            metadata = {},
            expiresIn = this.config.paymentTimeout,
        } = options;

        if (!orderId || !amount) {
            throw new Error('orderId and amount are required');
        }

        // Generate unique payment address (derived from merchant wallet)
        const paymentId = crypto.randomBytes(16).toString('hex');
        const paymentKeypair = Keypair.generate();

        const payment = {
            paymentId,
            orderId,
            amount,
            currency,
            paymentAddress: paymentKeypair.publicKey.toBase58(),
            merchantWallet: this.config.merchantWallet,
            status: 'pending',
            createdAt: Date.now(),
            expiresAt: Date.now() + expiresIn,
            metadata,
            signatures: [],
        };

        // Store payment keypair for later forwarding
        payment._keypair = Array.from(paymentKeypair.secretKey);

        this.pendingPayments.set(paymentId, payment);

        // Generate payment URI for wallets
        const paymentUri = this._generatePaymentUri(payment);

        this.emit('paymentCreated', {
            paymentId,
            orderId,
            paymentAddress: payment.paymentAddress,
            amount,
            currency,
            paymentUri,
        });

        return {
            paymentId,
            orderId,
            paymentAddress: payment.paymentAddress,
            amount,
            currency,
            expiresAt: payment.expiresAt,
            paymentUri,
            qrData: paymentUri,
        };
    }

    /**
     * Check payment status
     * @param {string} paymentId - Payment ID
     * @returns {object} Payment status
     */
    async getPaymentStatus(paymentId) {
        let payment = this.pendingPayments.get(paymentId);

        if (!payment) {
            payment = this.completedPayments.get(paymentId);
        }

        if (!payment) {
            throw new Error('Payment not found');
        }

        // Check for new transactions
        if (payment.status === 'pending') {
            await this._checkPaymentReceived(payment);
        }

        return {
            paymentId: payment.paymentId,
            orderId: payment.orderId,
            status: payment.status,
            amount: payment.amount,
            currency: payment.currency,
            receivedAmount: payment.receivedAmount || 0,
            paymentAddress: payment.paymentAddress,
            signatures: payment.signatures,
            createdAt: payment.createdAt,
            expiresAt: payment.expiresAt,
            completedAt: payment.completedAt,
        };
    }

    /**
     * Verify webhook signature
     * @param {string} payload - Raw request body
     * @param {string} signature - Signature from header
     * @returns {boolean} Whether signature is valid
     */
    verifyWebhookSignature(payload, signature) {
        const expectedSignature = crypto
            .createHmac('sha256', this.config.webhookSecret)
            .update(payload)
            .digest('hex');

        return crypto.timingSafeEqual(
            Buffer.from(signature),
            Buffer.from(expectedSignature)
        );
    }

    /**
     * Create signed webhook payload
     * @param {object} data - Webhook data
     * @returns {object} Payload with signature
     */
    createWebhookPayload(data) {
        const payload = JSON.stringify(data);
        const signature = crypto
            .createHmac('sha256', this.config.webhookSecret)
            .update(payload)
            .digest('hex');

        return { payload, signature };
    }

    /**
     * Get all pending payments
     * @returns {Array} Pending payments
     */
    getPendingPayments() {
        return Array.from(this.pendingPayments.values()).map((p) => ({
            paymentId: p.paymentId,
            orderId: p.orderId,
            amount: p.amount,
            currency: p.currency,
            status: p.status,
            createdAt: p.createdAt,
            expiresAt: p.expiresAt,
        }));
    }

    /**
     * Cancel a pending payment
     * @param {string} paymentId - Payment ID
     */
    cancelPayment(paymentId) {
        const payment = this.pendingPayments.get(paymentId);

        if (!payment) {
            throw new Error('Payment not found or already completed');
        }

        payment.status = 'cancelled';
        this.completedPayments.set(paymentId, payment);
        this.pendingPayments.delete(paymentId);

        this.emit('paymentCancelled', {
            paymentId: payment.paymentId,
            orderId: payment.orderId,
        });

        return { status: 'cancelled' };
    }

    /**
     * Forward received funds to merchant wallet
     * @param {string} paymentId - Payment ID
     * @returns {string} Transaction signature
     */
    async forwardFunds(paymentId) {
        const payment = this.completedPayments.get(paymentId);

        if (!payment || payment.status !== 'completed') {
            throw new Error('Payment not found or not completed');
        }

        if (payment.forwarded) {
            throw new Error('Funds already forwarded');
        }

        const paymentKeypair = Keypair.fromSecretKey(
            Uint8Array.from(payment._keypair)
        );

        const merchantPubkey = new PublicKey(this.config.merchantWallet);

        if (payment.currency === 'SOL') {
            // Forward SOL
            const balance = await this.connection.getBalance(paymentKeypair.publicKey);
            const rentExempt = await this.connection.getMinimumBalanceForRentExemption(0);
            const transferAmount = balance - rentExempt - 5000; // Leave rent + fee

            if (transferAmount <= 0) {
                throw new Error('Insufficient balance to forward');
            }

            const transaction = new Transaction().add(
                SystemProgram.transfer({
                    fromPubkey: paymentKeypair.publicKey,
                    toPubkey: merchantPubkey,
                    lamports: transferAmount,
                })
            );

            const signature = await this.connection.sendTransaction(transaction, [
                paymentKeypair,
            ]);

            await this.connection.confirmTransaction(signature);

            payment.forwarded = true;
            payment.forwardSignature = signature;

            this.emit('fundsForwarded', {
                paymentId,
                signature,
                amount: transferAmount / LAMPORTS_PER_SOL,
            });

            return signature;
        }

        // For tokens, would need additional logic
        throw new Error('Token forwarding not implemented');
    }

    // Private methods

    /**
     * Start monitoring for incoming payments
     */
    _startMonitoring() {
        // Check payments every 10 seconds
        setInterval(async () => {
            for (const [paymentId, payment] of this.pendingPayments) {
                // Check for expiration
                if (Date.now() > payment.expiresAt) {
                    payment.status = 'expired';
                    this.completedPayments.set(paymentId, payment);
                    this.pendingPayments.delete(paymentId);

                    this.emit('paymentExpired', {
                        paymentId: payment.paymentId,
                        orderId: payment.orderId,
                    });

                    continue;
                }

                // Check for payment
                await this._checkPaymentReceived(payment);
            }
        }, 10000);
    }

    /**
     * Check if payment has been received
     * @param {object} payment - Payment object
     */
    async _checkPaymentReceived(payment) {
        try {
            const paymentPubkey = new PublicKey(payment.paymentAddress);

            if (payment.currency === 'SOL') {
                const balance = await this.connection.getBalance(paymentPubkey);
                const expectedLamports = payment.amount * LAMPORTS_PER_SOL;

                if (balance >= expectedLamports) {
                    payment.status = 'completed';
                    payment.receivedAmount = balance / LAMPORTS_PER_SOL;
                    payment.completedAt = Date.now();

                    this.completedPayments.set(payment.paymentId, payment);
                    this.pendingPayments.delete(payment.paymentId);

                    this.emit('paymentCompleted', {
                        paymentId: payment.paymentId,
                        orderId: payment.orderId,
                        amount: payment.amount,
                        receivedAmount: payment.receivedAmount,
                        currency: payment.currency,
                    });
                } else if (balance > 0) {
                    payment.status = 'partial';
                    payment.receivedAmount = balance / LAMPORTS_PER_SOL;

                    this.emit('paymentPartial', {
                        paymentId: payment.paymentId,
                        orderId: payment.orderId,
                        expectedAmount: payment.amount,
                        receivedAmount: payment.receivedAmount,
                    });
                }
            } else if (payment.currency === 'NOVA' && this.config.novaMint) {
                // Check token balance
                const tokenAccount = await getAssociatedTokenAddress(
                    new PublicKey(this.config.novaMint),
                    paymentPubkey
                );

                try {
                    const accountInfo = await getAccount(this.connection, tokenAccount);
                    const receivedAmount = Number(accountInfo.amount);

                    if (receivedAmount >= payment.amount) {
                        payment.status = 'completed';
                        payment.receivedAmount = receivedAmount;
                        payment.completedAt = Date.now();

                        this.completedPayments.set(payment.paymentId, payment);
                        this.pendingPayments.delete(payment.paymentId);

                        this.emit('paymentCompleted', {
                            paymentId: payment.paymentId,
                            orderId: payment.orderId,
                            amount: payment.amount,
                            receivedAmount: payment.receivedAmount,
                            currency: payment.currency,
                        });
                    }
                } catch {
                    // Token account doesn't exist yet
                }
            }
        } catch (error) {
            console.error('Error checking payment:', error.message);
        }
    }

    /**
     * Generate Solana Pay URI
     * @param {object} payment - Payment object
     * @returns {string} Payment URI
     */
    _generatePaymentUri(payment) {
        const params = new URLSearchParams();
        params.set('amount', payment.amount.toString());

        if (payment.currency === 'NOVA' && this.config.novaMint) {
            params.set('spl-token', this.config.novaMint);
        }

        params.set('reference', payment.paymentId);
        params.set('label', `Order ${payment.orderId}`);

        return `solana:${payment.paymentAddress}?${params.toString()}`;
    }
}

module.exports = { PaymentGateway };

// Example usage and demo server
if (require.main === module) {
    const express = require('express');
    const app = express();

    app.use(express.json());

    // Initialize gateway
    const gateway = new PaymentGateway({
        network: 'devnet',
        merchantWallet: 'YOUR_MERCHANT_WALLET_ADDRESS',
    });

    // Event listeners
    gateway.on('paymentCreated', (data) => {
        console.log('Payment created:', data);
    });

    gateway.on('paymentCompleted', (data) => {
        console.log('Payment completed:', data);
        // Here you would update your database and fulfill the order
    });

    gateway.on('paymentExpired', (data) => {
        console.log('Payment expired:', data);
    });

    // API endpoints
    app.post('/api/payments', async (req, res) => {
        try {
            const payment = await gateway.createPayment(req.body);
            res.json(payment);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    });

    app.get('/api/payments/:paymentId', async (req, res) => {
        try {
            const status = await gateway.getPaymentStatus(req.params.paymentId);
            res.json(status);
        } catch (error) {
            res.status(404).json({ error: error.message });
        }
    });

    app.get('/api/payments', (req, res) => {
        res.json(gateway.getPendingPayments());
    });

    app.post('/api/payments/:paymentId/cancel', (req, res) => {
        try {
            const result = gateway.cancelPayment(req.params.paymentId);
            res.json(result);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    });

    app.post('/api/payments/:paymentId/forward', async (req, res) => {
        try {
            const signature = await gateway.forwardFunds(req.params.paymentId);
            res.json({ signature });
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    });

    const PORT = process.env.PORT || 3001;
    app.listen(PORT, () => {
        console.log(`Payment Gateway running on port ${PORT}`);
        console.log(`Network: ${gateway.config.network}`);
    });
}
