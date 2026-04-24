const { BatchService, BatchOperationType, BatchStatus } = require('../services/batchService');
const DIDService = require('../services/didService');

// Mock DIDService
jest.mock('../services/didService');
jest.mock('../services/stellarService');

describe('BatchService', () => {
  let batchService;
  let mockDidService;

  beforeEach(() => {
    batchService = new BatchService();
    mockDidService = new DIDService();
    
    // Clear all batches before each test
    batchService.activeBatches.clear();
  });

  describe('executeBatch', () => {
    test('should execute a successful batch of operations', async () => {
      const operations = [
        BatchService.createDIDOperation({ serviceEndpoint: 'https://example.com' }),
        BatchService.issueCredentialOperation({
          issuerDid: 'did:stellar:test1',
          subjectDid: 'did:stellar:test2',
          claims: { name: 'John Doe' }
        })
      ];

      // Mock successful operations
      mockDidService.createDID.mockResolvedValue({
        did: 'did:stellar:test1',
        account: { publicKey: 'test1' }
      });
      
      mockDidService.createVerifiableCredential.mockResolvedValue({
        id: 'cred-123',
        issuer: 'did:stellar:test1',
        subject: 'did:stellar:test2'
      });

      batchService.didService = mockDidService;

      const result = await batchService.executeBatch('test-batch', operations);

      expect(result.success).toBe(true);
      expect(result.batchId).toBe('test-batch');
      expect(result.results).toHaveLength(2);
      expect(result.summary.totalOperations).toBe(2);
      expect(result.summary.successfulOperations).toBe(2);
      expect(result.summary.failedOperations).toBe(0);
    });

    test('should handle batch failure and rollback', async () => {
      const operations = [
        BatchService.createDIDOperation({ serviceEndpoint: 'https://example.com' }),
        BatchService.issueCredentialOperation({
          issuerDid: 'did:stellar:test1',
          subjectDid: 'did:stellar:test2',
          claims: { name: 'John Doe' }
        })
      ];

      // Mock first operation success, second failure
      mockDidService.createDID.mockResolvedValue({
        did: 'did:stellar:test1',
        account: { publicKey: 'test1' }
      });
      
      mockDidService.createVerifiableCredential.mockRejectedValue(
        new Error('Credential creation failed')
      );

      batchService.didService = mockDidService;

      await expect(batchService.executeBatch('test-batch', operations))
        .rejects.toThrow('Credential creation failed');

      const batchStatus = batchService.getBatchStatus('test-batch');
      expect(batchStatus.status).toBe(BatchStatus.ROLLED_BACK);
    });

    test('should skip rollback when disabled', async () => {
      const operations = [
        BatchService.createDIDOperation({ serviceEndpoint: 'https://example.com' })
      ];

      mockDidService.createDID.mockRejectedValue(
        new Error('DID creation failed')
      );

      batchService.didService = mockDidService;

      await expect(batchService.executeBatch('test-batch', operations, { rollbackOnError: false }))
        .rejects.toThrow('DID creation failed');

      const batchStatus = batchService.getBatchStatus('test-batch');
      expect(batchStatus.status).toBe(BatchStatus.FAILED);
    });
  });

  describe('executeOperation', () => {
    test('should execute CREATE_DID operation', async () => {
      const operation = BatchService.createDIDOperation({ serviceEndpoint: 'https://example.com' });
      const batch = {
        id: 'test-batch',
        operations: [operation],
        status: BatchStatus.IN_PROGRESS,
        results: [],
        rollbackData: []
      };

      mockDidService.createDID.mockResolvedValue({
        did: 'did:stellar:test1',
        account: { publicKey: 'test1' }
      });

      batchService.didService = mockDidService;

      const result = await batchService.executeOperation(operation, batch);

      expect(result.status).toBe('SUCCESS');
      expect(result.type).toBe(BatchOperationType.CREATE_DID);
      expect(result.result.did).toBe('did:stellar:test1');
      expect(batch.rollbackData).toHaveLength(1);
    });

    test('should execute UPDATE_DID operation', async () => {
      const operation = BatchService.updateDIDOperation(
        'did:stellar:test1',
        { serviceEndpoint: 'https://updated.com' },
        'secret-key'
      );
      const batch = {
        id: 'test-batch',
        operations: [operation],
        status: BatchStatus.IN_PROGRESS,
        results: [],
        rollbackData: []
      };

      const currentState = {
        didDocument: { id: 'did:stellar:test1', serviceEndpoint: 'https://old.com' }
      };

      mockDidService.resolveDID.mockResolvedValue(currentState);
      mockDidService.updateDID.mockResolvedValue({
        didDocument: { id: 'did:stellar:test1', serviceEndpoint: 'https://updated.com' }
      });

      batchService.didService = mockDidService;

      const result = await batchService.executeOperation(operation, batch);

      expect(result.status).toBe('SUCCESS');
      expect(result.type).toBe(BatchOperationType.UPDATE_DID);
      expect(result.result.previousState).toBe(currentState);
      expect(batch.rollbackData).toHaveLength(1);
    });

    test('should handle operation failure', async () => {
      const operation = BatchService.createDIDOperation({ serviceEndpoint: 'https://example.com' });
      const batch = {
        id: 'test-batch',
        operations: [operation],
        status: BatchStatus.IN_PROGRESS,
        results: [],
        rollbackData: []
      };

      mockDidService.createDID.mockRejectedValue(new Error('Creation failed'));

      batchService.didService = mockDidService;

      const result = await batchService.executeOperation(operation, batch);

      expect(result.status).toBe('FAILED');
      expect(result.error).toBe('Creation failed');
      expect(batch.rollbackData).toHaveLength(0);
    });
  });

  describe('rollbackBatch', () => {
    test('should rollback a failed batch', async () => {
      const batch = {
        id: 'test-batch',
        operations: [],
        status: BatchStatus.FAILED,
        results: [],
        rollbackData: [
          { type: BatchOperationType.CREATE_DID, data: { did: 'did:stellar:test1' } },
          { type: BatchOperationType.ISSUE_CREDENTIAL, credentialId: 'cred-123' }
        ],
        error: 'Test error'
      };

      batchService.activeBatches.set('test-batch', batch);

      const result = await batchService.rollbackBatch('test-batch');

      expect(result.success).toBe(true);
      expect(batch.status).toBe(BatchStatus.ROLLED_BACK);
    });

    test('should throw error for non-existent batch', async () => {
      await expect(batchService.rollbackBatch('non-existent'))
        .rejects.toThrow('Batch non-existent not found');
    });

    test('should throw error for batch that is not failed', async () => {
      const batch = {
        id: 'test-batch',
        operations: [],
        status: BatchStatus.COMPLETED,
        results: [],
        rollbackData: []
      };

      batchService.activeBatches.set('test-batch', batch);

      await expect(batchService.rollbackBatch('test-batch'))
        .rejects.toThrow('Cannot rollback batch with status: COMPLETED');
    });
  });

  describe('getBatchStatus', () => {
    test('should return batch status', () => {
      const batch = {
        id: 'test-batch',
        status: BatchStatus.IN_PROGRESS,
        startTime: '2023-01-01T00:00:00.000Z',
        endTime: null,
        error: null,
        operations: [{}, {}],
        results: [
          { status: 'SUCCESS' },
          { status: 'FAILED' }
        ]
      };

      batchService.activeBatches.set('test-batch', batch);

      const status = batchService.getBatchStatus('test-batch');

      expect(status.id).toBe('test-batch');
      expect(status.status).toBe(BatchStatus.IN_PROGRESS);
      expect(status.operationCount).toBe(2);
      expect(status.completedOperations).toBe(1);
      expect(status.failedOperations).toBe(1);
    });

    test('should throw error for non-existent batch', () => {
      expect(() => batchService.getBatchStatus('non-existent'))
        .toThrow('Batch non-existent not found');
    });
  });

  describe('generateBatchSummary', () => {
    test('should generate correct batch summary', () => {
      const batch = {
        operations: [{}, {}, {}],
        results: [
          { status: 'SUCCESS' },
          { status: 'SUCCESS' },
          { status: 'FAILED' }
        ],
        startTime: '2023-01-01T00:00:00.000Z',
        endTime: '2023-01-01T00:01:00.000Z'
      };

      const summary = batchService.generateBatchSummary(batch);

      expect(summary.totalOperations).toBe(3);
      expect(summary.successfulOperations).toBe(2);
      expect(summary.failedOperations).toBe(1);
      expect(summary.successRate).toBe(66.66666666666666);
      expect(summary.duration).toBe(60000);
    });
  });

  describe('operation helpers', () => {
    test('should create correct operation objects', () => {
      const didOp = BatchService.createDIDOperation({ serviceEndpoint: 'https://example.com' });
      expect(didOp.type).toBe(BatchOperationType.CREATE_DID);
      expect(didOp.data.serviceEndpoint).toBe('https://example.com');

      const updateOp = BatchService.updateDIDOperation('did:test', { name: 'test' }, 'secret');
      expect(updateOp.type).toBe(BatchOperationType.UPDATE_DID);
      expect(updateOp.data.did).toBe('did:test');
      expect(updateOp.data.updates.name).toBe('test');
      expect(updateOp.data.secretKey).toBe('secret');

      const issueOp = BatchService.issueCredentialOperation({
        issuerDid: 'did:issuer',
        subjectDid: 'did:subject',
        claims: { name: 'John' }
      });
      expect(issueOp.type).toBe(BatchOperationType.ISSUE_CREDENTIAL);
      expect(issueOp.data.issuerDid).toBe('did:issuer');

      const revokeOp = BatchService.revokeCredentialOperation('cred-123', 'did:issuer', 'test');
      expect(revokeOp.type).toBe(BatchOperationType.REVOKE_CREDENTIAL);
      expect(revokeOp.data.credentialId).toBe('cred-123');
      expect(revokeOp.data.reason).toBe('test');

      const bridgeDidOp = BatchService.bridgeDIDOperation('did:test', '0x123', 'pubkey', 'endpoint');
      expect(bridgeDidOp.type).toBe(BatchOperationType.BRIDGE_DID);
      expect(bridgeDidOp.data.did).toBe('did:test');

      const bridgeCredOp = BatchService.bridgeCredentialOperation('cred-123', 'issuer', 'subject', 'type', 12345, 'hash');
      expect(bridgeCredOp.type).toBe(BatchOperationType.BRIDGE_CREDENTIAL);
      expect(bridgeCredOp.data.credentialId).toBe('cred-123');
    });
  });
});
