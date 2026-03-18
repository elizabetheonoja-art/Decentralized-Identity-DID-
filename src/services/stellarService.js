const StellarSDK = require('stellar-sdk');
const dotenv = require('dotenv');

dotenv.config();

class StellarService {
  constructor() {
    this.server = new StellarSDK.Horizon.Server(
      process.env.STELLAR_HORIZON_URL || 'https://horizon-testnet.stellar.org'
    );
    
    // Set network
    if (process.env.STELLAR_NETWORK === 'PUBLIC') {
      StellarSDK.Network.usePublicNetwork();
    } else {
      StellarSDK.Network.useTestNetwork();
    }
  }

  /**
   * Create a new Stellar account
   */
  async createAccount() {
    const pair = StellarSDK.Keypair.random();
    return {
      publicKey: pair.publicKey(),
      secretKey: pair.secret(),
      address: pair.publicKey()
    };
  }

  /**
   * Fund a testnet account using friendbot
   */
  async fundTestnetAccount(publicKey) {
    if (process.env.STELLAR_NETWORK !== 'TESTNET') {
      throw new Error('Friendbot only available on testnet');
    }

    try {
      const response = await fetch(`https://friendbot.stellar.org?addr=${publicKey}`);
      const result = await response.json();
      return result;
    } catch (error) {
      throw new Error(`Failed to fund account: ${error.message}`);
    }
  }

  /**
   * Get account information
   */
  async getAccount(publicKey) {
    try {
      const account = await this.server.loadAccount(publicKey);
      return account;
    } catch (error) {
      throw new Error(`Account not found: ${error.message}`);
    }
  }

  /**
   * Create a transaction with DID document in memo
   */
  async createDIDTransaction(secretKey, didDocument) {
    try {
      const keypair = StellarSDK.Keypair.fromSecret(secretKey);
      const account = await this.server.loadAccount(keypair.publicKey());

      // Convert DID document to JSON string
      const didDocumentString = JSON.stringify(didDocument);
      
      // Check if document fits in memo (28 bytes max for text memo)
      if (didDocumentString.length > 28) {
        // For larger documents, we'll use manage_data operations
        return await this.createDIDWithDataOperation(keypair, didDocument);
      }

      const transaction = new StellarSDK.TransactionBuilder(account, {
        fee: StellarSDK.BASE_FEE,
        networkPassphrase: StellarSDK.Network.current().networkPassphrase()
      })
        .addOperation(StellarSDK.Operation.payment({
          destination: keypair.publicKey(), // Self-payment to create transaction
          asset: StellarSDK.Asset.native(),
          amount: '0.00001' // Minimum amount
        }))
        .addMemo(StellarSDK.Memo.text(didDocumentString))
        .setTimeout(30)
        .build();

      transaction.sign(keypair);
      return transaction;
    } catch (error) {
      throw new Error(`Failed to create DID transaction: ${error.message}`);
    }
  }

  /**
   * Store DID document using manage_data operations
   */
  async createDIDWithDataOperation(keypair, didDocument) {
    try {
      const account = await this.server.loadAccount(keypair.publicKey());
      
      // Split DID document into chunks if needed
      const didString = JSON.stringify(didDocument);
      const chunks = this.splitIntoChunks(didString, 64); // 64 bytes per data entry
      
      let transaction = new StellarSDK.TransactionBuilder(account, {
        fee: StellarSDK.BASE_FEE * chunks.length,
        networkPassphrase: StellarSDK.Network.current().networkPassphrase()
      });

      // Add manage_data operations for each chunk
      chunks.forEach((chunk, index) => {
        transaction = transaction.addOperation(
          StellarSDK.Operation.manageData({
            name: `did_${index.toString().padStart(3, '0')}`,
            value: chunk
          })
        );
      });

      // Add a marker operation to indicate this is a DID document
      transaction = transaction.addOperation(
        StellarSDK.Operation.manageData({
          name: 'did_marker',
          value: 'stellar_did_v1'
        })
      );

      transaction = transaction.setTimeout(30).build();
      transaction.sign(keypair);
      
      return transaction;
    } catch (error) {
      throw new Error(`Failed to create DID with data operations: ${error.message}`);
    }
  }

  /**
   * Submit transaction to Stellar network
   */
  async submitTransaction(transaction) {
    try {
      const result = await this.server.submitTransaction(transaction);
      return result;
    } catch (error) {
      throw new Error(`Transaction failed: ${error.message}`);
    }
  }

  /**
   * Resolve DID document from Stellar account
   */
  async resolveDID(publicKey) {
    try {
      const account = await this.server.loadAccount(publicKey);
      
      // Check for DID marker
      const didMarker = account.data_attr?.did_marker;
      
      if (didMarker === 'stellar_did_v1') {
        // Reconstruct DID document from data entries
        return await this.reconstructDIDFromData(account);
      } else {
        // Try to get from transaction memos
        return await this.getDIDFromTransactions(publicKey);
      }
    } catch (error) {
      throw new Error(`Failed to resolve DID: ${error.message}`);
    }
  }

  /**
   * Reconstruct DID document from data entries
   */
  async reconstructDIDFromData(account) {
    const dataEntries = account.data_attr || {};
    const chunks = [];
    
    // Collect all DID chunks
    Object.keys(dataEntries).forEach(key => {
      if (key.startsWith('did_') && key !== 'did_marker') {
        const index = parseInt(key.replace('did_', ''));
        chunks[index] = dataEntries[key];
      }
    });
    
    // Sort and join chunks
    const sortedChunks = chunks.filter(chunk => chunk !== undefined).sort((a, b) => {
      const indexA = Object.keys(dataEntries).find(key => dataEntries[key] === a).replace('did_', '');
      const indexB = Object.keys(dataEntries).find(key => dataEntries[key] === b).replace('did_', '');
      return parseInt(indexA) - parseInt(indexB);
    });
    
    const didString = sortedChunks.join('');
    
    try {
      return JSON.parse(didString);
    } catch (error) {
      throw new Error('Invalid DID document format');
    }
  }

  /**
   * Get DID document from transaction memos
   */
  async getIDFromTransactions(publicKey) {
    try {
      const transactions = await this.server
        .transactions()
        .forAccount(publicKey)
        .order('desc')
        .limit(10)
        .call();

      for (const tx of transactions.records) {
        if (tx.memo && tx.memo.memo_type === 'text') {
          try {
            const didDocument = JSON.parse(tx.memo.memo);
            return didDocument;
          } catch (error) {
            // Not a valid JSON, continue searching
            continue;
          }
        }
      }
      
      throw new Error('No DID document found in transactions');
    } catch (error) {
      throw new Error(`Failed to get DID from transactions: ${error.message}`);
    }
  }

  /**
   * Split string into chunks of specified size
   */
  splitIntoChunks(str, chunkSize) {
    const chunks = [];
    for (let i = 0; i < str.length; i += chunkSize) {
      chunks.push(str.slice(i, i + chunkSize));
    }
    return chunks;
  }

  /**
   * Verify transaction signature
   */
  verifyTransactionSignature(transaction, publicKey) {
    try {
      return StellarSDK.Keypair.fromPublicKey(publicKey).verify(transaction.hash(), transaction.signature);
    } catch (error) {
      return false;
    }
  }
}

module.exports = StellarService;
