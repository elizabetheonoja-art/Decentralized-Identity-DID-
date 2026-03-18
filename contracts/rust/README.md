# 🦀 Stellar DID Smart Contract (Rust/Soroban)

A production-ready Decentralized Identity (DID) smart contract built with Rust and Soroban for the Stellar network.

## 🚀 Features

### **DID Management**
- ✅ Register new DIDs
- ✅ Resolve DID documents
- ✅ Update DID documents
- ✅ Deactivate DIDs
- ✅ Authorization control

### **Verifiable Credentials**
- ✅ Issue verifiable credentials
- ✅ Verify credentials
- ✅ Revoke credentials
- ✅ Expiration handling
- ✅ Claims hash verification

### **Security & Performance**
- ✅ Access control with owner verification
- ✅ Efficient storage patterns
- ✅ WASM optimization
- ✅ Comprehensive error handling
- ✅ Full test coverage

## 📁 Contract Structure

```
contracts/rust/
├── 📦 Cargo.toml          # Dependencies and configuration
├── 🦀 src/
│   ├── 📄 lib.rs          # Main contract implementation
│   └── 🧪 tests.rs        # Comprehensive test suite
├── 🔧 Makefile            # Build and deployment automation
└── 📖 README.md           # This documentation
```

## 🛠️ Prerequisites

1. **Rust Toolchain**
   ```bash
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   rustup target add wasm32-unknown-unknown
   ```

2. **Soroban CLI**
   ```bash
   make install
   ```

3. **WASM Tools** (for optimization)
   ```bash
   # Ubuntu/Debian
   sudo apt-get install binaryen
   
   # macOS
   brew install binaryen
   
   # Or download from https://github.com/WebAssembly/binaryen
   ```

## 🚀 Quick Start

### **1. Build the Contract**
```bash
make build
```

### **2. Run Tests**
```bash
make test
```

### **3. Optimize WASM**
```bash
make optimize
```

### **4. Deploy to Testnet**
```bash
# Set environment variables
export DEPLOYER_SECRET="your-secret-key"
export NETWORK="testnet"

# Deploy contract
make deploy-testnet
```

### **5. Initialize Contract**
```bash
export CONTRACT_ID="deployed-contract-id"
export OWNER_ADDRESS="your-stellar-address"

make init-contract
```

## 📖 API Reference

### **DID Operations**

#### `register_did`
Register a new decentralized identity.

```rust
pub fn register_did(
    env: Env,
    did: Bytes,
    public_key: Bytes,
    service_endpoint: Option<String>,
    owner: Address,
) -> Result<(), Error>
```

**Parameters:**
- `did`: DID identifier (bytes)
- `public_key`: Stellar public key
- `service_endpoint`: Optional service endpoint URL
- `owner`: Contract owner address

#### `resolve_did`
Resolve a DID document.

```rust
pub fn resolve_did(env: Env, did: Bytes) -> Result<DIDDocument, Error>
```

#### `update_did`
Update an existing DID document.

```rust
pub fn update_did(
    env: Env,
    did: Bytes,
    public_key: Option<Bytes>,
    service_endpoint: Option<String>,
    updater: Address,
) -> Result<(), Error>
```

#### `deactivate_did`
Deactivate a DID.

```rust
pub fn deactivate_did(env: Env, did: Bytes, deactivator: Address) -> Result<(), Error>
```

### **Credential Operations**

#### `issue_credential`
Issue a new verifiable credential.

```rust
pub fn issue_credential(
    env: Env,
    issuer: Bytes,
    subject: Bytes,
    credential_type: String,
    claims_hash: Bytes,
    expires: Option<u64>,
    issuer_address: Address,
) -> Result<Bytes, Error>
```

#### `verify_credential`
Verify a credential's validity.

```rust
pub fn verify_credential(env: Env, credential_id: Bytes) -> Result<VerifiableCredential, Error>
```

#### `revoke_credential`
Revoke a credential.

```rust
pub fn revoke_credential(
    env: Env,
    credential_id: Bytes,
    revoker_address: Address,
) -> Result<(), Error>
```

### **Utility Functions**

#### `get_contract_info`
Get contract metadata.

```rust
pub fn get_contract_info(env: Env) -> Result<ContractInfo, Error>
```

#### `did_exists`
Check if a DID exists.

```rust
pub fn did_exists(env: Env, did: Bytes) -> bool
```

#### `credential_exists`
Check if a credential exists.

```rust
pub fn credential_exists(env: Env, credential_id: Bytes) -> bool
```

## 🔧 Data Structures

### **DIDDocument**
```rust
pub struct DIDDocument {
    pub did: Bytes,
    pub owner: Address,
    pub public_key: Bytes,
    pub service_endpoint: Option<String>,
    pub created: u64,
    pub updated: u64,
    pub active: bool,
}
```

### **VerifiableCredential**
```rust
pub struct VerifiableCredential {
    pub id: Bytes,
    pub issuer: Bytes,
    pub subject: Bytes,
    pub credential_type: String,
    pub claims_hash: Bytes,
    pub issued: u64,
    pub expires: Option<u64>,
    pub revoked: bool,
}
```

## 🧪 Testing

Run the comprehensive test suite:

```bash
# Run all tests
make test

# Run specific test
cargo test test_register_and_resolve_did

# Run tests with output
cargo test -- --nocapture
```

### **Test Coverage**
- ✅ Contract initialization
- ✅ DID registration and resolution
- ✅ DID updates and deactivation
- ✅ Authorization controls
- ✅ Credential issuance and verification
- ✅ Credential revocation
- ✅ Error handling
- ✅ Edge cases

## 🚀 Deployment

### **Environment Variables**
```bash
# Required for deployment
export DEPLOYER_SECRET="your-deployer-secret-key"
export NETWORK="testnet"  # or "futurenet"

# Required for operations
export CONTRACT_ID="deployed-contract-id"
export OWNER_ADDRESS="contract-owner-address"
export OWNER_SECRET="contract-owner-secret"
export USER_SECRET="user-secret-key"
```

### **Deployment Commands**
```bash
# Deploy to testnet
make deploy-testnet

# Deploy to futurenet
make deploy-futurenet

# Initialize contract
make init-contract
```

## 📊 Usage Examples

### **Register a DID**
```bash
export DID="did:stellar:GABCDEFGHIJKLMNOPQRSTUVWXYZ"
export PUBLIC_KEY="GABCDEFGHIJKLMNOPQRSTUVWXYZ"
export SERVICE_ENDPOINT="https://example.com/did"

make register-did
```

### **Issue a Credential**
```bash
export ISSUER_DID="did:stellar:GABCDEFGHIJKLMNOPQRSTUVWXYZ"
export SUBJECT_DID="did:stellar:BCDEFGHIJKLMNOPQRSTUVWXYZABCDEF"
export CREDENTIAL_TYPE="UniversityDegree"
export CLAIMS_HASH="hash_of_claims_data"
export EXPIRES="1704067200"  # Unix timestamp

make issue-credential
```

### **Verify a Credential**
```bash
export CREDENTIAL_ID="credential-id-from-issue"

make verify-credential
```

## 🔒 Security Considerations

### **Access Control**
- Only DID owners can update/deactivate their DIDs
- Only credential issuers can revoke credentials
- Contract owner can initialize but not modify individual DIDs

### **Data Privacy**
- Claims are stored as hashes, not raw data
- Service endpoints are optional
- No personal data stored directly on-chain

### **Attack Mitigation**
- Input validation for all parameters
- Authorization checks on all mutating operations
- Proper error handling without information leakage

## 📈 Performance

### **Optimization Features**
- WASM optimization with `wasm-opt`
- Efficient storage patterns
- Minimal computational overhead
- Gas-optimized operations

### **Size Analysis**
```bash
make size
```

### **Benchmarking**
```bash
# Run with Soroban CLI for gas estimation
soroban contract invoke \
  --id $CONTRACT_ID \
  --network $NETWORK \
  --source $USER_SECRET \
  -- \
  resolve_did \
  --did "test-did"
```

## 🔄 Integration

### **Backend Integration**
```javascript
// Example JavaScript integration
const { Contract } = require('@stellar/stellar-sdk');

const contract = new Contract({
  contractId: 'CONTRACT_ID',
  networkPassphrase: 'Test SDF Network ; September 2015',
  rpcUrl: 'https://horizon-testnet.stellar.org',
});

// Resolve DID
const result = await contract.call('resolve_did', {
  did: 'did:stellar:G...'
});
```

### **Frontend Integration**
```typescript
// TypeScript example
interface DIDDocument {
  did: string;
  owner: string;
  public_key: string;
  service_endpoint?: string;
  created: number;
  updated: number;
  active: boolean;
}

async function resolveDID(did: string): Promise<DIDDocument> {
  // Contract call implementation
}
```

## 🐛 Debugging

### **Common Issues**
1. **Build Errors**: Ensure `wasm32-unknown-unknown` target is installed
2. **Deployment Failures**: Check network and secret key configuration
3. **Authorization Errors**: Verify address ownership and permissions

### **Debug Commands**
```bash
# Check contract logs
soroban contract logs --id $CONTRACT_ID --network $NETWORK

# Inspect WASM
wasm-objdump -d target/wasm32-unknown-unknown/release/stellar_did_contract.wasm

# Run with debug output
RUST_LOG=debug cargo test
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests: `make test`
5. Run checks: `make check`
6. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details.

## 🙏 Acknowledgments

- **Stellar Development Foundation** - Soroban platform
- **Rust Community** - Tooling and ecosystem
- **W3C DID Working Group** - DID standards

---

**Built with 🦀 Rust for the Stellar network**
