const express = require('express');
const { BatchService, BatchOperationType, BatchStatus } = require('../services/batchService');

const router = express.Router();
const batchService = new BatchService();

/**
 * POST /api/batch/execute
 * Execute a batch of operations with atomic execution and rollback
 */
router.post('/execute', async (req, res) => {
  try {
    const { operations, rollbackOnError = true } = req.body;

    if (!operations || !Array.isArray(operations)) {
      return res.status(400).json({
        success: false,
        error: 'Operations array is required'
      });
    }

    if (operations.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'At least one operation is required'
      });
    }

    // Validate operations
    for (const operation of operations) {
      if (!operation.type || !Object.values(BatchOperationType).includes(operation.type)) {
        return res.status(400).json({
          success: false,
          error: `Invalid operation type: ${operation.type}`
        });
      }
    }

    const batchId = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const result = await batchService.executeBatch(batchId, operations, { rollbackOnError });

    res.status(201).json({
      success: true,
      data: result,
      message: 'Batch executed successfully'
    });

  } catch (error) {
    console.error('Batch execution error:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/batch/:batchId/status
 * Get the status of a batch operation
 */
router.get('/:batchId/status', (req, res) => {
  try {
    const { batchId } = req.params;
    
    const status = batchService.getBatchStatus(batchId);
    
    res.json({
      success: true,
      data: status,
      message: 'Batch status retrieved successfully'
    });

  } catch (error) {
    console.error('Get batch status error:', error);
    res.status(404).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/batch/:batchId/rollback
 * Manually rollback a failed batch operation
 */
router.post('/:batchId/rollback', async (req, res) => {
  try {
    const { batchId } = req.params;
    
    const result = await batchService.rollbackBatch(batchId);
    
    res.json({
      success: true,
      data: result,
      message: 'Batch rolled back successfully'
    });

  } catch (error) {
    console.error('Batch rollback error:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/batch/did/create-batch
 * Create multiple DIDs in a batch
 */
router.post('/did/create-batch', async (req, res) => {
  try {
    const { didConfigs } = req.body;

    if (!didConfigs || !Array.isArray(didConfigs)) {
      return res.status(400).json({
        success: false,
        error: 'didConfigs array is required'
      });
    }

    const operations = didConfigs.map(config => 
      BatchService.createDIDOperation(config)
    );

    const batchId = `did_create_batch_${Date.now()}`;
    
    const result = await batchService.executeBatch(batchId, operations);

    res.status(201).json({
      success: true,
      data: result,
      message: `${result.summary.successfulOperations} DIDs created successfully`
    });

  } catch (error) {
    console.error('Batch DID creation error:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/batch/did/update-batch
 * Update multiple DIDs in a batch
 */
router.post('/did/update-batch', async (req, res) => {
  try {
    const { updates } = req.body;

    if (!updates || !Array.isArray(updates)) {
      return res.status(400).json({
        success: false,
        error: 'updates array is required'
      });
    }

    const operations = updates.map(update => 
      BatchService.updateDIDOperation(update.did, update.updates, update.secretKey)
    );

    const batchId = `did_update_batch_${Date.now()}`;
    
    const result = await batchService.executeBatch(batchId, operations);

    res.json({
      success: true,
      data: result,
      message: `${result.summary.successfulOperations} DIDs updated successfully`
    });

  } catch (error) {
    console.error('Batch DID update error:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/batch/credentials/issue-batch
 * Issue multiple credentials in a batch
 */
router.post('/credentials/issue-batch', async (req, res) => {
  try {
    const { credentials } = req.body;

    if (!credentials || !Array.isArray(credentials)) {
      return res.status(400).json({
        success: false,
        error: 'credentials array is required'
      });
    }

    const operations = credentials.map(credential => 
      BatchService.issueCredentialOperation(credential)
    );

    const batchId = `credential_issue_batch_${Date.now()}`;
    
    const result = await batchService.executeBatch(batchId, operations);

    res.status(201).json({
      success: true,
      data: result,
      message: `${result.summary.successfulOperations} credentials issued successfully`
    });

  } catch (error) {
    console.error('Batch credential issuance error:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/batch/credentials/revoke-batch
 * Revoke multiple credentials in a batch
 */
router.post('/credentials/revoke-batch', async (req, res) => {
  try {
    const { revocations } = req.body;

    if (!revocations || !Array.isArray(revocations)) {
      return res.status(400).json({
        success: false,
        error: 'revocations array is required'
      });
    }

    const operations = revocations.map(revocation => 
      BatchService.revokeCredentialOperation(
        revocation.credentialId, 
        revocation.issuerDid, 
        revocation.reason
      )
    );

    const batchId = `credential_revoke_batch_${Date.now()}`;
    
    const result = await batchService.executeBatch(batchId, operations);

    res.json({
      success: true,
      data: result,
      message: `${result.summary.successfulOperations} credentials revoked successfully`
    });

  } catch (error) {
    console.error('Batch credential revocation error:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/batch/bridge/did-batch
 * Bridge multiple DIDs to Ethereum in a batch
 */
router.post('/bridge/did-batch', async (req, res) => {
  try {
    const { dids } = req.body;

    if (!dids || !Array.isArray(dids)) {
      return res.status(400).json({
        success: false,
        error: 'dids array is required'
      });
    }

    const operations = dids.map(did => 
      BatchService.bridgeDIDOperation(
        did.did,
        did.ownerAddress,
        did.publicKey,
        did.serviceEndpoint
      )
    );

    const batchId = `did_bridge_batch_${Date.now()}`;
    
    const result = await batchService.executeBatch(batchId, operations);

    res.status(201).json({
      success: true,
      data: result,
      message: `${result.summary.successfulOperations} DIDs bridged successfully`
    });

  } catch (error) {
    console.error('Batch DID bridging error:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/batch/bridge/credential-batch
 * Bridge multiple credentials to Ethereum in a batch
 */
router.post('/bridge/credential-batch', async (req, res) => {
  try {
    const { credentials } = req.body;

    if (!credentials || !Array.isArray(credentials)) {
      return res.status(400).json({
        success: false,
        error: 'credentials array is required'
      });
    }

    const operations = credentials.map(credential => 
      BatchService.bridgeCredentialOperation(
        credential.credentialId,
        credential.issuer,
        credential.subject,
        credential.credentialType,
        credential.expires,
        credential.dataHash
      )
    );

    const batchId = `credential_bridge_batch_${Date.now()}`;
    
    const result = await batchService.executeBatch(batchId, operations);

    res.status(201).json({
      success: true,
      data: result,
      message: `${result.summary.successfulOperations} credentials bridged successfully`
    });

  } catch (error) {
    console.error('Batch credential bridging error:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/batch/mixed
 * Execute a mixed batch of different operation types
 */
router.post('/mixed', async (req, res) => {
  try {
    const { operations } = req.body;

    if (!operations || !Array.isArray(operations)) {
      return res.status(400).json({
        success: false,
        error: 'operations array is required'
      });
    }

    // Convert operation objects to proper format
    const formattedOperations = operations.map(op => {
      switch (op.type) {
        case 'CREATE_DID':
          return BatchService.createDIDOperation(op.data);
        case 'UPDATE_DID':
          return BatchService.updateDIDOperation(op.data.did, op.data.updates, op.data.secretKey);
        case 'ISSUE_CREDENTIAL':
          return BatchService.issueCredentialOperation(op.data);
        case 'REVOKE_CREDENTIAL':
          return BatchService.revokeCredentialOperation(op.data.credentialId, op.data.issuerDid, op.data.reason);
        case 'BRIDGE_DID':
          return BatchService.bridgeDIDOperation(op.data.did, op.data.ownerAddress, op.data.publicKey, op.data.serviceEndpoint);
        case 'BRIDGE_CREDENTIAL':
          return BatchService.bridgeCredentialOperation(op.data.credentialId, op.data.issuer, op.data.subject, op.data.credentialType, op.data.expires, op.data.dataHash);
        default:
          throw new Error(`Unsupported operation type: ${op.type}`);
      }
    });

    const batchId = `mixed_batch_${Date.now()}`;
    
    const result = await batchService.executeBatch(batchId, formattedOperations);

    res.status(201).json({
      success: true,
      data: result,
      message: 'Mixed batch executed successfully'
    });

  } catch (error) {
    console.error('Mixed batch execution error:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
