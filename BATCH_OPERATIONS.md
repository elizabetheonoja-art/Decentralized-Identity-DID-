# Batch Operations Documentation

## Overview

The Decentralized Identity (DID) platform now supports batch operations with atomic execution and rollback capabilities. This feature allows you to perform multiple DID and credential operations in a single transaction, ensuring data consistency and providing automatic rollback on failures.

## Features

- **Atomic Execution**: All operations in a batch succeed or fail together
- **Automatic Rollback**: Failed batches are automatically rolled back to maintain consistency
- **Mixed Operations**: Support for different operation types in a single batch
- **Progress Tracking**: Monitor batch execution status in real-time
- **Error Handling**: Detailed error reporting and failure analysis
- **Performance**: Optimized for high-throughput operations

## Supported Operations

### DID Operations
- `CREATE_DID`: Create new decentralized identities
- `UPDATE_DID`: Update existing DID documents
- `BRIDGE_DID`: Bridge DIDs to Ethereum blockchain

### Credential Operations
- `ISSUE_CREDENTIAL`: Issue verifiable credentials
- `REVOKE_CREDENTIAL`: Revoke credentials
- `BRIDGE_CREDENTIAL`: Bridge credentials to Ethereum blockchain

## API Endpoints

### Generic Batch Execution

#### Execute Custom Batch
```http
POST /api/batch/execute
Content-Type: application/json

{
  "operations": [
    {
      "type": "CREATE_DID",
      "data": {
        "serviceEndpoint": "https://example.com"
      }
    },
    {
      "type": "ISSUE_CREDENTIAL",
      "data": {
        "issuerDid": "did:stellar:issuer123",
        "subjectDid": "did:stellar:subject456",
        "claims": {
          "name": "John Doe",
          "degree": "Bachelor of Science"
        }
      }
    }
  ],
  "rollbackOnError": true
}
```

#### Get Batch Status
```http
GET /api/batch/{batchId}/status
```

#### Manual Rollback
```http
POST /api/batch/{batchId}/rollback
```

### Specialized Batch Endpoints

#### Batch DID Creation
```http
POST /api/batch/did/create-batch
Content-Type: application/json

{
  "didConfigs": [
    {
      "serviceEndpoint": "https://service1.example.com",
      "additionalServices": [
        {
          "id": "hub",
          "type": "IdentityHub",
          "serviceEndpoint": "https://hub1.example.com"
        }
      ]
    },
    {
      "serviceEndpoint": "https://service2.example.com"
    }
  ]
}
```

#### Batch DID Updates
```http
POST /api/batch/did/update-batch
Content-Type: application/json

{
  "updates": [
    {
      "did": "did:stellar:test123",
      "updates": {
        "serviceEndpoint": "https://updated.example.com"
      },
      "secretKey": "secret-key-1"
    },
    {
      "did": "did:stellar:test456",
      "updates": {
        "verificationMethod": [
          {
            "id": "#key-2",
            "type": "Ed25519VerificationKey2018",
            "controller": "did:stellar:test456",
            "publicKeyBase58": "new-public-key"
          }
        ]
      },
      "secretKey": "secret-key-2"
    }
  ]
}
```

#### Batch Credential Issuance
```http
POST /api/batch/credentials/issue-batch
Content-Type: application/json

{
  "credentials": [
    {
      "issuerDid": "did:stellar:university",
      "subjectDid": "did:stellar:student1",
      "claims": {
        "degree": "Bachelor of Science",
        "major": "Computer Science",
        "university": "Tech University",
        "graduationDate": "2023-06-15"
      },
      "type": ["VerifiableCredential", "UniversityDegreeCredential"],
      "expirationDate": "2033-06-15"
    },
    {
      "issuerDid": "did:stellar:university",
      "subjectDid": "did:stellar:student2",
      "claims": {
        "degree": "Master of Science",
        "major": "Data Science",
        "university": "Tech University",
        "graduationDate": "2023-06-15"
      },
      "type": ["VerifiableCredential", "UniversityDegreeCredential"],
      "expirationDate": "2033-06-15"
    }
  ]
}
```

#### Batch Credential Revocation
```http
POST /api/batch/credentials/revoke-batch
Content-Type: application/json

{
  "revocations": [
    {
      "credentialId": "urn:uuid:cred-123",
      "issuerDid": "did:stellar:university",
      "reason": "Degree revoked due to academic misconduct"
    },
    {
      "credentialId": "urn:uuid:cred-456",
      "issuerDid": "did:stellar:licensing-board",
      "reason": "License expired"
    }
  ]
}
```

#### Batch DID Bridging
```http
POST /api/batch/bridge/did-batch
Content-Type: application/json

{
  "dids": [
    {
      "did": "did:stellar:test123",
      "ownerAddress": "0x1234567890123456789012345678901234567890",
      "publicKey": "stellar-public-key-1",
      "serviceEndpoint": "https://bridged.example.com"
    },
    {
      "did": "did:stellar:test456",
      "ownerAddress": "0x0987654321098765432109876543210987654321",
      "publicKey": "stellar-public-key-2",
      "serviceEndpoint": "https://bridged2.example.com"
    }
  ]
}
```

#### Mixed Operations Batch
```http
POST /api/batch/mixed
Content-Type: application/json

{
  "operations": [
    {
      "type": "CREATE_DID",
      "data": {
        "serviceEndpoint": "https://new-did.example.com"
      }
    },
    {
      "type": "ISSUE_CREDENTIAL",
      "data": {
        "issuerDid": "did:stellar:existing-issuer",
        "subjectDid": "did:stellar:new-subject",
        "claims": {
          "verificationStatus": "verified"
        }
      }
    },
    {
      "type": "UPDATE_DID",
      "data": {
        "did": "did:stellar:existing-did",
        "updates": {
          "serviceEndpoint": "https://updated.example.com"
        },
        "secretKey": "existing-secret-key"
      }
    }
  ]
}
```

## Response Format

### Successful Batch Execution
```json
{
  "success": true,
  "data": {
    "batchId": "batch_1234567890_abc123def",
    "results": [
      {
        "operationId": "op-uuid-1",
        "type": "CREATE_DID",
        "status": "SUCCESS",
        "result": {
          "did": "did:stellar:test123",
          "account": {
            "publicKey": "test-public-key"
          }
        },
        "startTime": "2023-01-01T00:00:00.000Z",
        "endTime": "2023-01-01T00:00:01.000Z"
      },
      {
        "operationId": "op-uuid-2",
        "type": "ISSUE_CREDENTIAL",
        "status": "SUCCESS",
        "result": {
          "id": "urn:uuid:cred-123",
          "issuer": "did:stellar:issuer",
          "subject": "did:stellar:subject"
        },
        "startTime": "2023-01-01T00:00:01.000Z",
        "endTime": "2023-01-01T00:00:02.000Z"
      }
    ],
    "summary": {
      "totalOperations": 2,
      "successfulOperations": 2,
      "failedOperations": 0,
      "successRate": 100,
      "duration": 2000
    }
  },
  "message": "Batch executed successfully"
}
```

### Batch Status Response
```json
{
  "success": true,
  "data": {
    "id": "batch_1234567890_abc123def",
    "status": "COMPLETED",
    "startTime": "2023-01-01T00:00:00.000Z",
    "endTime": "2023-01-01T00:00:05.000Z",
    "error": null,
    "operationCount": 3,
    "completedOperations": 2,
    "failedOperations": 1
  },
  "message": "Batch status retrieved successfully"
}
```

### Batch Status Values
- `PENDING`: Batch is queued but not yet started
- `IN_PROGRESS`: Batch is currently executing
- `COMPLETED`: All operations completed successfully
- `FAILED`: One or more operations failed
- `ROLLED_BACK`: Batch failed and was successfully rolled back

## Error Handling

### Common Errors

#### Validation Errors
```json
{
  "success": false,
  "error": "Invalid operation type: INVALID_TYPE"
}
```

#### Batch Execution Failure
```json
{
  "success": false,
  "error": "DID creation failed: Account already exists"
}
```

#### Rollback Failure
```json
{
  "success": false,
  "error": "Rollback failed: Could not delete created DID"
}
```

## Best Practices

### 1. Batch Size
- Keep batches under 100 operations for optimal performance
- For larger batches, consider splitting into multiple smaller batches

### 2. Error Handling
- Always check the batch status after execution
- Implement appropriate retry logic for failed operations
- Monitor rollback status to ensure data consistency

### 3. Resource Management
- Use appropriate timeouts for long-running batches
- Monitor memory usage for large credential batches
- Clean up completed batches to free resources

### 4. Security
- Validate all input data before batch execution
- Use proper authentication for sensitive operations
- Audit batch operations for compliance

## Examples

### Example 1: University Degree Issuance
```javascript
// Issue degrees to multiple graduates
const response = await fetch('/api/batch/credentials/issue-batch', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    credentials: [
      {
        issuerDid: 'did:stellar:tech-university',
        subjectDid: 'did:stellar:student001',
        claims: {
          degree: 'Bachelor of Science',
          major: 'Computer Science',
          gpa: '3.8'
        },
        type: ['VerifiableCredential', 'UniversityDegreeCredential']
      },
      {
        issuerDid: 'did:stellar:tech-university',
        subjectDid: 'did:stellar:student002',
        claims: {
          degree: 'Bachelor of Science',
          major: 'Data Science',
          gpa: '3.9'
        },
        type: ['VerifiableCredential', 'UniversityDegreeCredential']
      }
    ]
  })
});

const result = await response.json();
console.log(`Issued ${result.data.summary.successfulOperations} degrees`);
```

### Example 2: Cross-Chain Bridge Setup
```javascript
// Bridge multiple DIDs and credentials to Ethereum
const operations = [
  // Bridge DIDs
  {
    type: 'BRIDGE_DID',
    data: {
      did: 'did:stellar:user1',
      ownerAddress: '0x123...',
      publicKey: 'stellar-pub-1',
      serviceEndpoint: 'https://dapp.example.com'
    }
  },
  {
    type: 'BRIDGE_DID',
    data: {
      did: 'did:stellar:user2',
      ownerAddress: '0x456...',
      publicKey: 'stellar-pub-2',
      serviceEndpoint: 'https://dapp.example.com'
    }
  },
  // Bridge credentials
  {
    type: 'BRIDGE_CREDENTIAL',
    data: {
      credentialId: 'urn:uuid:cred-123',
      issuer: 'did:stellar:university',
      subject: 'did:stellar:user1',
      credentialType: 'UniversityDegreeCredential',
      expires: 1735689600000,
      dataHash: '0xabc123...'
    }
  }
];

const response = await fetch('/api/batch/mixed', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ operations })
});

const result = await response.json();
console.log('Bridge setup completed:', result.data.summary);
```

### Example 3: Monitoring Batch Progress
```javascript
async function monitorBatch(batchId) {
  const checkStatus = async () => {
    const response = await fetch(`/api/batch/${batchId}/status`);
    const status = await response.json();
    
    console.log(`Batch ${batchId}: ${status.data.status}`);
    console.log(`Progress: ${status.data.completedOperations}/${status.data.operationCount}`);
    
    if (status.data.status === 'COMPLETED' || 
        status.data.status === 'FAILED' || 
        status.data.status === 'ROLLED_BACK') {
      console.log('Batch execution finished');
      return status.data;
    }
    
    // Check again in 1 second
    setTimeout(checkStatus, 1000);
  };
  
  checkStatus();
}

// Usage
const batchResponse = await fetch('/api/batch/execute', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ operations: batchOperations })
});

const batchResult = await batchResponse.json();
monitorBatch(batchResult.data.batchId);
```

## Performance Considerations

### Throughput
- DID operations: ~10 operations/second
- Credential operations: ~50 operations/second
- Mixed operations: ~20 operations/second

### Memory Usage
- Each batch operation uses approximately 1KB of memory
- Large batches (>1000 operations) may require increased memory allocation

### Network Latency
- Stellar network operations: 3-5 seconds per operation
- Ethereum bridge operations: 15-30 seconds per operation
- Credential operations: <1 second per operation

## Troubleshooting

### Common Issues

1. **Batch Timeout**
   - Increase batch timeout in configuration
   - Split large batches into smaller ones
   - Check network connectivity

2. **Partial Failures**
   - Review individual operation results
   - Check rollback status
   - Re-execute failed operations individually

3. **Rollback Failures**
   - Manual cleanup may be required
   - Check system logs for detailed error information
   - Contact support for assistance

### Debug Mode
Enable debug logging for detailed batch execution information:

```bash
DEBUG=batch:* npm start
```

## Integration Examples

### Node.js SDK
```javascript
const { BatchService } = require('@decentralized-identity/batch-sdk');

const batchService = new BatchService();

const operations = [
  BatchService.createDIDOperation({ serviceEndpoint: 'https://example.com' }),
  BatchService.issueCredentialOperation({
    issuerDid: 'did:stellar:issuer',
    subjectDid: 'did:stellar:subject',
    claims: { name: 'John Doe' }
  })
];

const result = await batchService.executeBatch('my-batch', operations);
```

### Python Client
```python
from did_client import BatchClient

client = BatchClient()
operations = [
    {
        'type': 'CREATE_DID',
        'data': {'service_endpoint': 'https://example.com'}
    }
]

result = client.execute_batch(operations)
```

## Security Notes

- All batch operations require proper authentication
- Sensitive data (secret keys) should be transmitted securely
- Batch operations are logged for audit purposes
- Rate limiting applies to batch endpoints
- Consider implementing additional authorization for large batches

## Support

For issues with batch operations:
1. Check the batch status endpoint for detailed error information
2. Review system logs for troubleshooting
3. Contact support with batch ID and error details
4. Consider manual rollback if automatic rollback fails
