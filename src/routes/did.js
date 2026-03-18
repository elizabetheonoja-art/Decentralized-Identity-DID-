const express = require('express');
const DIDService = require('../services/didService');
const StellarService = require('../services/stellarService');

const router = express.Router();
const didService = new DIDService();
const stellarService = new StellarService();

/**
 * POST /api/did/create
 * Create a new DID on Stellar network
 */
router.post('/create', async (req, res) => {
  try {
    const { serviceEndpoint, additionalServices, additionalKeys } = req.body;
    
    const result = await didService.createDID({
      serviceEndpoint,
      additionalServices,
      additionalKeys
    });

    // Don't expose secret key in production
    if (process.env.NODE_ENV === 'production') {
      delete result.account.secretKey;
    }

    res.status(201).json({
      success: true,
      data: result,
      message: 'DID created successfully'
    });
  } catch (error) {
    console.error('Create DID error:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/did/resolve/:did
 * Resolve a DID to its document
 */
router.get('/resolve/:did', async (req, res) => {
  try {
    const { did } = req.params;
    
    const result = await didService.resolveDID(did);
    
    res.json({
      success: true,
      data: result,
      message: 'DID resolved successfully'
    });
  } catch (error) {
    console.error('Resolve DID error:', error);
    res.status(404).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * PUT /api/did/update/:did
 * Update a DID document
 */
router.put('/update/:did', async (req, res) => {
  try {
    const { did } = req.params;
    const { updates, secretKey } = req.body;
    
    if (!secretKey) {
      return res.status(400).json({
        success: false,
        error: 'Secret key is required for DID updates'
      });
    }

    const result = await didService.updateDID(did, updates, secretKey);
    
    res.json({
      success: true,
      data: result,
      message: 'DID updated successfully'
    });
  } catch (error) {
    console.error('Update DID error:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/did/authenticate
 * Authenticate with a DID and get JWT token
 */
router.post('/authenticate', async (req, res) => {
  try {
    const { did, secretKey } = req.body;
    
    // Verify the DID exists and the secret key matches
    const publicKey = didService.extractPublicKeyFromDID(did);
    const account = await stellarService.getAccount(publicKey);
    
    // In a real implementation, you would verify the secret key matches the account
    // For now, we'll just check the account exists
    
    const token = didService.createAuthToken(did);
    
    res.json({
      success: true,
      data: {
        token,
        did,
        expiresIn: '1h'
      },
      message: 'Authentication successful'
    });
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(401).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/did/verify-token
 * Verify a DID authentication token
 */
router.post('/verify-token', async (req, res) => {
  try {
    const { token } = req.body;
    
    const result = didService.verifyAuthToken(token);
    
    if (result.valid) {
      res.json({
        success: true,
        data: {
          valid: true,
          did: result.did
        },
        message: 'Token is valid'
      });
    } else {
      res.status(401).json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    console.error('Token verification error:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/did/account/:publicKey
 * Get Stellar account information
 */
router.get('/account/:publicKey', async (req, res) => {
  try {
    const { publicKey } = req.params;
    
    const account = await stellarService.getAccount(publicKey);
    
    res.json({
      success: true,
      data: {
        accountId: account.account_id(),
        sequence: account.sequence,
        balances: account.balances,
        data: account.data_attr,
        signers: account.signers,
        thresholds: account.thresholds
      },
      message: 'Account information retrieved successfully'
    });
  } catch (error) {
    console.error('Get account error:', error);
    res.status(404).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/did/transaction
 * Submit a signed transaction to Stellar
 */
router.post('/transaction', async (req, res) => {
  try {
    const { transactionXDR } = req.body;
    
    const transaction = StellarSDK.TransactionBuilder.fromXDR(
      transactionXDR,
      StellarSDK.Network.current().networkPassphrase()
    );
    
    const result = await stellarService.submitTransaction(transaction);
    
    res.json({
      success: true,
      data: result,
      message: 'Transaction submitted successfully'
    });
  } catch (error) {
    console.error('Submit transaction error:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/did/transactions/:publicKey
 * Get recent transactions for a DID
 */
router.get('/transactions/:publicKey', async (req, res) => {
  try {
    const { publicKey } = req.params;
    const { limit = 10 } = req.query;
    
    const transactions = await stellarService.server
      .transactions()
      .forAccount(publicKey)
      .order('desc')
      .limit(parseInt(limit))
      .call();
    
    res.json({
      success: true,
      data: {
        transactions: transactions.records,
        next: transactions.next
      },
      message: 'Transactions retrieved successfully'
    });
  } catch (error) {
    console.error('Get transactions error:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
