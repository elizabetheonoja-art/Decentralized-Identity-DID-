const express = require('express');
const Joi = require('joi');
const ContractService = require('../services/contractService');
const { authMiddleware } = require('../middleware');
const logger = require('../utils/logger');

const router = express.Router();
const contractService = new ContractService();

// Validation schemas
const deployContractSchema = Joi.object({
  deployerSecret: Joi.string().required().min(56).max(56)
});

const registerDIDSchema = Joi.object({
  did: Joi.string().required().pattern(/^did:stellar:G[A-Z0-9]{55}$/),
  publicKey: Joi.string().required().min(56).max(56),
  serviceEndpoint: Joi.string().uri().optional(),
  signerSecret: Joi.string().required().min(56).max(56)
});

const updateDIDSchema = Joi.object({
  did: Joi.string().required().pattern(/^did:stellar:G[A-Z0-9]{55}$/),
  updates: Joi.object({
    publicKey: Joi.string().min(56).max(56).optional(),
    serviceEndpoint: Joi.string().uri().optional()
  }).required(),
  signerSecret: Joi.string().required().min(56).max(56)
});

const issueCredentialSchema = Joi.object({
  issuerDID: Joi.string().required().pattern(/^did:stellar:G[A-Z0-9]{55}$/),
  subjectDID: Joi.string().required().pattern(/^did:stellar:G[A-Z0-9]{55}$/),
  credentialType: Joi.string().required(),
  claims: Joi.object().required(),
  signerSecret: Joi.string().required().min(56).max(56)
});

/**
 * POST /api/v1/contracts/deploy
 * Deploy DID registry contract
 */
router.post('/deploy', async (req, res) => {
  try {
    const { error, value } = deployContractSchema.validate(req.body);
    
    if (error) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.details.map(d => d.message)
      });
    }

    const { deployerSecret } = value;
    
    logger.info('Deploying DID registry contract');
    
    const result = await contractService.deployContract(deployerSecret);
    
    res.status(201).json({
      success: true,
      data: result,
      message: 'Contract deployed successfully'
    });
  } catch (error) {
    logger.error('Contract deployment error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/v1/contracts/register-did
 * Register a new DID on the blockchain
 */
router.post('/register-did', async (req, res) => {
  try {
    const { error, value } = registerDIDSchema.validate(req.body);
    
    if (error) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.details.map(d => d.message)
      });
    }

    const { did, publicKey, serviceEndpoint, signerSecret } = value;
    
    logger.info('Registering DID on blockchain', { did });
    
    const result = await contractService.registerDID(
      did,
      publicKey,
      serviceEndpoint,
      signerSecret
    );
    
    res.status(201).json({
      success: true,
      data: result,
      message: 'DID registered successfully'
    });
  } catch (error) {
    logger.error('DID registration error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * PUT /api/v1/contracts/update-did
 * Update DID document on blockchain
 */
router.put('/update-did', async (req, res) => {
  try {
    const { error, value } = updateDIDSchema.validate(req.body);
    
    if (error) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.details.map(d => d.message)
      });
    }

    const { did, updates, signerSecret } = value;
    
    logger.info('Updating DID on blockchain', { did });
    
    const result = await contractService.updateDID(did, updates, signerSecret);
    
    res.json({
      success: true,
      data: result,
      message: 'DID updated successfully'
    });
  } catch (error) {
    logger.error('DID update error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/v1/contracts/issue-credential
 * Issue verifiable credential on blockchain
 */
router.post('/issue-credential', async (req, res) => {
  try {
    const { error, value } = issueCredentialSchema.validate(req.body);
    
    if (error) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.details.map(d => d.message)
      });
    }

    const { issuerDID, subjectDID, credentialType, claims, signerSecret } = value;
    
    logger.info('Issuing credential on blockchain', {
      issuerDID,
      subjectDID,
      credentialType
    });
    
    const result = await contractService.issueCredential(
      issuerDID,
      subjectDID,
      credentialType,
      claims,
      signerSecret
    );
    
    res.status(201).json({
      success: true,
      data: result,
      message: 'Credential issued successfully'
    });
  } catch (error) {
    logger.error('Credential issuance error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/v1/contracts/revoke-credential
 * Revoke credential on blockchain
 */
router.post('/revoke-credential', async (req, res) => {
  try {
    const { credentialId, signerSecret } = req.body;
    
    if (!credentialId || !signerSecret) {
      return res.status(400).json({
        success: false,
        error: 'credentialId and signerSecret are required'
      });
    }
    
    logger.info('Revoking credential on blockchain', { credentialId });
    
    const result = await contractService.revokeCredential(credentialId, signerSecret);
    
    res.json({
      success: true,
      data: result,
      message: 'Credential revoked successfully'
    });
  } catch (error) {
    logger.error('Credential revocation error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/v1/contracts/did/:did
 * Get DID document from blockchain
 */
router.get('/did/:did', async (req, res) => {
  try {
    const { did } = req.params;
    
    // Validate DID format
    if (!did.match(/^did:stellar:G[A-Z0-9]{55}$/)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid DID format'
      });
    }
    
    logger.debug('Getting DID from blockchain', { did });
    
    const didDocument = await contractService.getDID(did);
    
    if (!didDocument) {
      return res.status(404).json({
        success: false,
        error: 'DID not found'
      });
    }
    
    res.json({
      success: true,
      data: didDocument,
      message: 'DID retrieved successfully'
    });
  } catch (error) {
    logger.error('Get DID error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/v1/contracts/credential/:credentialId
 * Get credential from blockchain
 */
router.get('/credential/:credentialId', async (req, res) => {
  try {
    const { credentialId } = req.params;
    
    logger.debug('Getting credential from blockchain', { credentialId });
    
    const credential = await contractService.getCredential(credentialId);
    
    if (!credential) {
      return res.status(404).json({
        success: false,
        error: 'Credential not found'
      });
    }
    
    res.json({
      success: true,
      data: credential,
      message: 'Credential retrieved successfully'
    });
  } catch (error) {
    logger.error('Get credential error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/v1/contracts/owner-dids/:publicKey
 * Get all DIDs for an owner
 */
router.get('/owner-dids/:publicKey', async (req, res) => {
  try {
    const { publicKey } = req.params;
    
    // Validate Stellar address
    if (!contractService.validateStellarAddress(publicKey)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid Stellar public key'
      });
    }
    
    logger.debug('Getting owner DIDs', { publicKey });
    
    const dids = await contractService.getOwnerDIDs(publicKey);
    
    res.json({
      success: true,
      data: dids,
      count: dids.length,
      message: 'Owner DIDs retrieved successfully'
    });
  } catch (error) {
    logger.error('Get owner DIDs error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/v1/contracts/verify-credential
 * Verify credential on blockchain
 */
router.post('/verify-credential', async (req, res) => {
  try {
    const { credentialId } = req.body;
    
    if (!credentialId) {
      return res.status(400).json({
        success: false,
        error: 'credentialId is required'
      });
    }
    
    logger.info('Verifying credential on blockchain', { credentialId });
    
    const verification = await contractService.verifyCredential(credentialId);
    
    res.json({
      success: true,
      data: verification,
      message: verification.valid ? 
        'Credential verified successfully' : 
        'Credential verification failed'
    });
  } catch (error) {
    logger.error('Credential verification error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/v1/contracts/info
 * Get contract information
 */
router.get('/info', async (req, res) => {
  try {
    logger.debug('Getting contract information');
    
    const info = await contractService.getContractInfo();
    
    res.json({
      success: true,
      data: info,
      message: 'Contract information retrieved successfully'
    });
  } catch (error) {
    logger.error('Get contract info error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/v1/contracts/create-account
 * Create new Stellar account
 */
router.post('/create-account', async (req, res) => {
  try {
    logger.info('Creating new Stellar account');
    
    const account = await contractService.createAccount();
    
    res.status(201).json({
      success: true,
      data: account,
      message: 'Account created successfully'
    });
  } catch (error) {
    logger.error('Create account error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/v1/contracts/fund-account
 * Fund testnet account
 */
router.post('/fund-account', async (req, res) => {
  try {
    const { publicKey } = req.body;
    
    if (!publicKey) {
      return res.status(400).json({
        success: false,
        error: 'publicKey is required'
      });
    }
    
    logger.info('Funding testnet account', { publicKey });
    
    const result = await contractService.fundTestnetAccount(publicKey);
    
    res.json({
      success: true,
      data: result,
      message: 'Account funded successfully'
    });
  } catch (error) {
    logger.error('Fund account error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/v1/contracts/account/:publicKey
 * Get account information
 */
router.get('/account/:publicKey', async (req, res) => {
  try {
    const { publicKey } = req.params;
    
    logger.debug('Getting account information', { publicKey });
    
    const account = await contractService.getAccount(publicKey);
    
    res.json({
      success: true,
      data: account,
      message: 'Account information retrieved successfully'
    });
  } catch (error) {
    logger.error('Get account error:', error);
    res.status(404).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
