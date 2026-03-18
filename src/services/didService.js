const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const StellarService = require('./stellarService');

class DIDService {
  constructor() {
    this.stellarService = new StellarService();
    this.didMethod = 'stellar';
  }

  /**
   * Create a new DID on Stellar network
   */
  async createDID(options = {}) {
    try {
      // Create Stellar account
      const account = await this.stellarService.createAccount();
      
      // Fund testnet account if needed
      if (process.env.STELLAR_NETWORK === 'TESTNET') {
        await this.stellarService.fundTestnetAccount(account.publicKey);
      }

      // Create DID document
      const didDocument = await this.createDIDDocument(account.publicKey, options);
      
      // Store DID document on Stellar
      const transaction = await this.stellarService.createDIDTransaction(
        account.secretKey, 
        didDocument
      );
      
      const result = await this.stellarService.submitTransaction(transaction);

      return {
        did: `did:${this.didMethod}:${account.publicKey}`,
        didDocument,
        account: {
          publicKey: account.publicKey,
          secretKey: account.secretKey // Only return secret in development
        },
        transaction: result
      };
    } catch (error) {
      throw new Error(`Failed to create DID: ${error.message}`);
    }
  }

  /**
   * Resolve a DID to its document
   */
  async resolveDID(did) {
    try {
      // Parse DID to get Stellar account
      const publicKey = this.extractPublicKeyFromDID(did);
      
      // Get DID document from Stellar
      const didDocument = await this.stellarService.resolveDID(publicKey);
      
      return {
        didDocument,
        didDocumentMetadata: {
          created: didDocument.created,
          updated: didDocument.updated,
          versionId: didDocument.versionId || '1'
        },
        resolverMetadata: {
          driverId: 'stellar-did-driver',
          driverVersion: '1.0.0',
          generatedTime: new Date().toISOString()
        }
      };
    } catch (error) {
      throw new Error(`Failed to resolve DID: ${error.message}`);
    }
  }

  /**
   * Update DID document
   */
  async updateDID(did, updates, secretKey) {
    try {
      const publicKey = this.extractPublicKeyFromDID(did);
      
      // Get current DID document
      const current = await this.resolveDID(did);
      const updatedDocument = {
        ...current.didDocument,
        ...updates,
        updated: new Date().toISOString(),
        versionId: this.generateVersionId()
      };

      // Create and submit update transaction
      const transaction = await this.stellarService.createDIDTransaction(
        secretKey,
        updatedDocument
      );
      
      const result = await this.stellarService.submitTransaction(transaction);

      return {
        didDocument: updatedDocument,
        transaction: result
      };
    } catch (error) {
      throw new Error(`Failed to update DID: ${error.message}`);
    }
  }

  /**
   * Create DID document structure
   */
  async createDIDDocument(publicKey, options = {}) {
    const did = `did:${this.didMethod}:${publicKey}`;
    const timestamp = new Date().toISOString();
    
    const document = {
      '@context': [
        'https://www.w3.org/ns/did/v1',
        'https://w3id.org/security/v1'
      ],
      id: did,
      verificationMethod: [
        {
          id: `${did}#key-1`,
          type: 'Ed25519VerificationKey2018',
          controller: did,
          publicKeyBase58: publicKey
        }
      ],
      authentication: [
        `${did}#key-1`
      ],
      assertionMethod: [
        `${did}#key-1`
      ],
      service: [],
      created: timestamp,
      updated: timestamp,
      versionId: '1'
    };

    // Add optional services
    if (options.serviceEndpoint) {
      document.service.push({
        id: `${did}#hub`,
        type: 'IdentityHub',
        serviceEndpoint: options.serviceEndpoint
      });
    }

    if (options.additionalServices) {
      document.service.push(...options.additionalServices);
    }

    // Add additional verification methods
    if (options.additionalKeys) {
      document.verificationMethod.push(...options.additionalKeys);
    }

    return document;
  }

  /**
   * Extract Stellar public key from DID
   */
  extractPublicKeyFromDID(did) {
    if (!did.startsWith(`did:${this.didMethod}:`)) {
      throw new Error(`Invalid DID method. Expected did:${this.didMethod}:`);
    }
    
    const publicKey = did.split(`did:${this.didMethod}:`)[1];
    
    if (!publicKey || publicKey.length !== 56) {
      throw new Error('Invalid Stellar public key in DID');
    }
    
    return publicKey;
  }

  /**
   * Generate version ID for DID updates
   */
  generateVersionId() {
    return crypto.randomBytes(16).toString('hex');
  }

  /**
   * Create verifiable credential
   */
  async createVerifiableCredential(issuerDid, subjectDid, claims, options = {}) {
    try {
      const timestamp = new Date().toISOString();
      
      const credential = {
        '@context': [
          'https://www.w3.org/2018/credentials/v1',
          'https://www.w3.org/2018/credentials/examples/v1'
        ],
        id: `urn:uuid:${crypto.randomUUID()}`,
        type: ['VerifiableCredential', ...(options.type || [])],
        issuer: issuerDid,
        issuanceDate: timestamp,
        credentialSubject: {
          id: subjectDid,
          ...claims
        }
      };

      // Add expiration if specified
      if (options.expirationDate) {
        credential.expirationDate = options.expirationDate;
      }

      // Sign the credential
      const signedCredential = await this.signCredential(credential, issuerDid);
      
      return signedCredential;
    } catch (error) {
      throw new Error(`Failed to create verifiable credential: ${error.message}`);
    }
  }

  /**
   * Sign a verifiable credential
   */
  async signCredential(credential, issuerDid, secretKey = null) {
    try {
      // In a real implementation, you would use the issuer's private key to sign
      // For now, we'll create a JWT-based proof
      
      const payload = {
        credential,
        iat: Math.floor(Date.now() / 1000),
        iss: issuerDid
      };

      const proof = {
        type: 'JwtProof2020',
        jwt: jwt.sign(payload, process.env.JWT_SECRET || 'default-secret', {
          algorithm: 'HS256',
          expiresIn: '1y'
        })
      };

      return {
        ...credential,
        proof
      };
    } catch (error) {
      throw new Error(`Failed to sign credential: ${error.message}`);
    }
  }

  /**
   * Verify a verifiable credential
   */
  async verifyCredential(credential) {
    try {
      if (!credential.proof || !credential.proof.jwt) {
        throw new Error('Credential missing proof');
      }

      const decoded = jwt.verify(credential.proof.jwt, process.env.JWT_SECRET || 'default-secret');
      
      // Verify the credential matches the JWT payload
      const credentialCopy = { ...credential };
      delete credentialCopy.proof;
      
      if (JSON.stringify(decoded.credential) !== JSON.stringify(credentialCopy)) {
        throw new Error('Credential content does not match JWT payload');
      }

      // Verify the DID exists
      await this.resolveDID(decoded.iss);

      return {
        verified: true,
        issuer: decoded.iss,
        subject: decoded.credential.credentialSubject.id,
        issuanceDate: decoded.credential.issuanceDate,
        expirationDate: decoded.credential.expirationDate
      };
    } catch (error) {
      return {
        verified: false,
        error: error.message
      };
    }
  }

  /**
   * Create DID authentication token
   */
  createAuthToken(did, expiresIn = '1h') {
    return jwt.sign(
      { did },
      process.env.JWT_SECRET || 'default-secret',
      { expiresIn }
    );
  }

  /**
   * Verify DID authentication token
   */
  verifyAuthToken(token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default-secret');
      return { valid: true, did: decoded.did };
    } catch (error) {
      return { valid: false, error: error.message };
    }
  }
}

module.exports = DIDService;
