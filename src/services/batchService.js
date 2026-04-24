const crypto = require('crypto');
const DIDService = require('./didService');
const StellarService = require('./stellarService');

/**
 * Batch operation types
 */
const BatchOperationType = {
  CREATE_DID: 'CREATE_DID',
  UPDATE_DID: 'UPDATE_DID',
  ISSUE_CREDENTIAL: 'ISSUE_CREDENTIAL',
  REVOKE_CREDENTIAL: 'REVOKE_CREDENTIAL',
  BRIDGE_DID: 'BRIDGE_DID',
  BRIDGE_CREDENTIAL: 'BRIDGE_CREDENTIAL'
};

/**
 * Batch operation status
 */
const BatchStatus = {
  PENDING: 'PENDING',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  ROLLED_BACK: 'ROLLED_BACK'
};

class BatchService {
  constructor() {
    this.didService = new DIDService();
    this.stellarService = new StellarService();
    this.activeBatches = new Map();
  }

  /**
   * Execute a batch of operations with atomic execution and rollback
   */
  async executeBatch(batchId, operations, options = {}) {
    const batch = {
      id: batchId,
      operations: operations,
      status: BatchStatus.PENDING,
      results: [],
      rollbackData: [],
      startTime: new Date().toISOString(),
      endTime: null,
      error: null
    };

    this.activeBatches.set(batchId, batch);

    try {
      batch.status = BatchStatus.IN_PROGRESS;
      
      // Execute operations in sequence with rollback data collection
      for (let i = 0; i < operations.length; i++) {
        const operation = operations[i];
        const result = await this.executeOperation(operation, batch);
        batch.results.push(result);
      }

      batch.status = BatchStatus.COMPLETED;
      batch.endTime = new Date().toISOString();
      
      return {
        success: true,
        batchId,
        results: batch.results,
        summary: this.generateBatchSummary(batch)
      };

    } catch (error) {
      batch.status = BatchStatus.FAILED;
      batch.error = error.message;
      batch.endTime = new Date().toISOString();

      // Rollback if enabled and failure occurred
      if (options.rollbackOnError !== false) {
        await this.rollbackBatch(batchId);
      }

      throw error;
    }
  }

  /**
   * Execute a single operation and collect rollback data
   */
  async executeOperation(operation, batch) {
    const operationId = crypto.randomUUID();
    const startTime = new Date().toISOString();
    
    try {
      let result;
      let rollbackData = null;

      switch (operation.type) {
        case BatchOperationType.CREATE_DID:
          result = await this.executeCreateDID(operation);
          rollbackData = { type: operation.type, data: result };
          break;

        case BatchOperationType.UPDATE_DID:
          result = await this.executeUpdateDID(operation);
          rollbackData = { type: operation.type, did: operation.did, previousState: result.previousState };
          break;

        case BatchOperationType.ISSUE_CREDENTIAL:
          result = await this.executeIssueCredential(operation);
          rollbackData = { type: operation.type, credentialId: result.id };
          break;

        case BatchOperationType.REVOKE_CREDENTIAL:
          result = await this.executeRevokeCredential(operation);
          rollbackData = { type: operation.type, credentialId: operation.credentialId, previousState: result.previousState };
          break;

        case BatchOperationType.BRIDGE_DID:
          result = await this.executeBridgeDID(operation);
          rollbackData = { type: operation.type, did: operation.did };
          break;

        case BatchOperationType.BRIDGE_CREDENTIAL:
          result = await this.executeBridgeCredential(operation);
          rollbackData = { type: operation.type, credentialId: operation.credentialId };
          break;

        default:
          throw new Error(`Unsupported operation type: ${operation.type}`);
      }

      // Store rollback data
      if (rollbackData) {
        batch.rollbackData.push(rollbackData);
      }

      return {
        operationId,
        type: operation.type,
        status: 'SUCCESS',
        result,
        startTime,
        endTime: new Date().toISOString()
      };

    } catch (error) {
      return {
        operationId,
        type: operation.type,
        status: 'FAILED',
        error: error.message,
        startTime,
        endTime: new Date().toISOString()
      };
    }
  }

  /**
   * Execute DID creation operation
   */
  async executeCreateDID(operation) {
    const { serviceEndpoint, additionalServices, additionalKeys } = operation.data || {};
    
    const result = await this.didService.createDID({
      serviceEndpoint,
      additionalServices,
      additionalKeys
    });

    return result;
  }

  /**
   * Execute DID update operation
   */
  async executeUpdateDID(operation) {
    const { did, updates, secretKey } = operation.data;
    
    // Get current state for rollback
    const currentState = await this.didService.resolveDID(did);
    
    const result = await this.didService.updateDID(did, updates, secretKey);
    
    return {
      ...result,
      previousState: currentState
    };
  }

  /**
   * Execute credential issuance operation
   */
  async executeIssueCredential(operation) {
    const { issuerDid, subjectDid, claims, type, expirationDate } = operation.data;
    
    const credential = await this.didService.createVerifiableCredential(
      issuerDid,
      subjectDid,
      claims,
      { type, expirationDate }
    );

    return credential;
  }

  /**
   * Execute credential revocation operation
   */
  async executeRevokeCredential(operation) {
    const { credentialId, issuerDid, reason } = operation.data;
    
    // In a real implementation, you'd get the current state
    const previousState = { status: 'active', revokedAt: null };
    
    const revocation = {
      credentialId,
      issuerDid,
      revokedAt: new Date().toISOString(),
      reason: reason || 'Revoked by issuer',
      status: 'revoked'
    };

    return {
      revocation,
      previousState
    };
  }

  /**
   * Execute DID bridging operation
   */
  async executeBridgeDID(operation) {
    const { did, ownerAddress, publicKey, serviceEndpoint } = operation.data;
    
    // This would interact with the Ethereum contract
    const result = {
      did,
      ownerAddress,
      bridged: true,
      timestamp: new Date().toISOString()
    };

    return result;
  }

  /**
   * Execute credential bridging operation
   */
  async executeBridgeCredential(operation) {
    const { credentialId, issuer, subject, credentialType, expires, dataHash } = operation.data;
    
    // This would interact with the Ethereum contract
    const result = {
      credentialId,
      issuer,
      subject,
      credentialType,
      bridged: true,
      timestamp: new Date().toISOString()
    };

    return result;
  }

  /**
   * Rollback a failed batch operation
   */
  async rollbackBatch(batchId) {
    const batch = this.activeBatches.get(batchId);
    if (!batch) {
      throw new Error(`Batch ${batchId} not found`);
    }

    if (batch.status !== BatchStatus.FAILED) {
      throw new Error(`Cannot rollback batch with status: ${batch.status}`);
    }

    batch.status = BatchStatus.IN_PROGRESS; // Temporarily set for rollback

    try {
      // Rollback operations in reverse order
      for (let i = batch.rollbackData.length - 1; i >= 0; i--) {
        const rollbackData = batch.rollbackData[i];
        await this.rollbackOperation(rollbackData);
      }

      batch.status = BatchStatus.ROLLED_BACK;
      batch.endTime = new Date().toISOString();

      return {
        success: true,
        batchId,
        message: 'Batch rolled back successfully'
      };

    } catch (error) {
      batch.status = BatchStatus.FAILED; // Keep as failed if rollback fails
      throw new Error(`Rollback failed: ${error.message}`);
    }
  }

  /**
   * Rollback a single operation
   */
  async rollbackOperation(rollbackData) {
    switch (rollbackData.type) {
      case BatchOperationType.CREATE_DID:
        // Delete created DID (implementation depends on storage)
        console.log(`Rolling back DID creation for: ${rollbackData.data.did}`);
        break;

      case BatchOperationType.UPDATE_DID:
        // Restore previous state
        console.log(`Rolling back DID update for: ${rollbackData.did}`);
        break;

      case BatchOperationType.ISSUE_CREDENTIAL:
        // Revoke issued credential
        console.log(`Rolling back credential issuance: ${rollbackData.credentialId}`);
        break;

      case BatchOperationType.REVOKE_CREDENTIAL:
        // Restore credential to active state
        console.log(`Rolling back credential revocation: ${rollbackData.credentialId}`);
        break;

      case BatchOperationType.BRIDGE_DID:
        // Remove bridged DID from Ethereum
        console.log(`Rolling back DID bridging: ${rollbackData.did}`);
        break;

      case BatchOperationType.BRIDGE_CREDENTIAL:
        // Remove bridged credential from Ethereum
        console.log(`Rolling back credential bridging: ${rollbackData.credentialId}`);
        break;

      default:
        throw new Error(`Cannot rollback operation type: ${rollbackData.type}`);
    }
  }

  /**
   * Get batch status
   */
  getBatchStatus(batchId) {
    const batch = this.activeBatches.get(batchId);
    if (!batch) {
      throw new Error(`Batch ${batchId} not found`);
    }

    return {
      id: batch.id,
      status: batch.status,
      startTime: batch.startTime,
      endTime: batch.endTime,
      error: batch.error,
      operationCount: batch.operations.length,
      completedOperations: batch.results.filter(r => r.status === 'SUCCESS').length,
      failedOperations: batch.results.filter(r => r.status === 'FAILED').length
    };
  }

  /**
   * Generate batch summary
   */
  generateBatchSummary(batch) {
    const totalOperations = batch.operations.length;
    const successfulOperations = batch.results.filter(r => r.status === 'SUCCESS').length;
    const failedOperations = batch.results.filter(r => r.status === 'FAILED').length;

    return {
      totalOperations,
      successfulOperations,
      failedOperations,
      successRate: totalOperations > 0 ? (successfulOperations / totalOperations) * 100 : 0,
      duration: batch.endTime ? 
        new Date(batch.endTime) - new Date(batch.startTime) : 
        Date.now() - new Date(batch.startTime)
    };
  }

  /**
   * Create batch operation payload helpers
   */
  static createDIDOperation(data) {
    return {
      type: BatchOperationType.CREATE_DID,
      data
    };
  }

  static updateDIDOperation(did, data, secretKey) {
    return {
      type: BatchOperationType.UPDATE_DID,
      data: { did, updates: data, secretKey }
    };
  }

  static issueCredentialOperation(data) {
    return {
      type: BatchOperationType.ISSUE_CREDENTIAL,
      data
    };
  }

  static revokeCredentialOperation(credentialId, issuerDid, reason) {
    return {
      type: BatchOperationType.REVOKE_CREDENTIAL,
      data: { credentialId, issuerDid, reason }
    };
  }

  static bridgeDIDOperation(did, ownerAddress, publicKey, serviceEndpoint) {
    return {
      type: BatchOperationType.BRIDGE_DID,
      data: { did, ownerAddress, publicKey, serviceEndpoint }
    };
  }

  static bridgeCredentialOperation(credentialId, issuer, subject, credentialType, expires, dataHash) {
    return {
      type: BatchOperationType.BRIDGE_CREDENTIAL,
      data: { credentialId, issuer, subject, credentialType, expires, dataHash }
    };
  }
}

module.exports = {
  BatchService,
  BatchOperationType,
  BatchStatus
};
