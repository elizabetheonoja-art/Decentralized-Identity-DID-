# Stellar DID Contract Makefile

# Default target
.PHONY: all
all: build

# Install Soroban CLI if not present
.PHONY: install
install:
	@echo "Installing Soroban CLI..."
	curl -L https://github.com/stellar/soroban/releases/latest/download/soroban-cli-linux-x86_64.tar.gz | tar xz
	sudo mv soroban /usr/local/bin/
	soroban --version

# Build the contract
.PHONY: build
build:
	@echo "Building Stellar DID contract..."
	cargo build --target wasm32-unknown-unknown --release
	@echo "Contract built successfully!"

# Optimize the WASM file
.PHONY: optimize
optimize: build
	@echo "Optimizing WASM..."
	wasm-opt target/wasm32-unknown-unknown/release/stellar_did_contract.wasm -Oz -o target/wasm32-unknown-unknown/release/stellar_did_contract_opt.wasm
	@echo "WASM optimized!"

# Run tests
.PHONY: test
test:
	@echo "Running contract tests..."
	cargo test

# Deploy contract to testnet
.PHONY: deploy-testnet
deploy-testnet: optimize
	@echo "Deploying to testnet..."
	soroban contract deploy \
		--wasm target/wasm32-unknown-unknown/release/stellar_did_contract_opt.wasm \
		--source $(DEPLOYER_SECRET) \
		--network testnet

# Deploy contract to futurenet
.PHONY: deploy-futurenet
deploy-futurenet: optimize
	@echo "Deploying to futurenet..."
	soroban contract deploy \
		--wasm target/wasm32-unknown-unknown/release/stellar_did_contract_opt.wasm \
		--source $(DEPLOYER_SECRET) \
		--network futurenet

# Initialize contract
.PHONY: init-contract
init-contract:
	@echo "Initializing contract..."
	soroban contract invoke \
		--id $(CONTRACT_ID) \
		--source $(DEPLOYER_SECRET) \
		--network $(NETWORK) \
		-- \
		__init \
		--version "1.0.0" \
		--network "$(NETWORK)" \
		--owner $(OWNER_ADDRESS)

# Register a DID
.PHONY: register-did
register-did:
	@echo "Registering DID..."
	soroban contract invoke \
		--id $(CONTRACT_ID) \
		--source $(OWNER_SECRET) \
		--network $(NETWORK) \
		-- \
		register_did \
		--did "$(DID)" \
		--public_key "$(PUBLIC_KEY)" \
		--service_endpoint "$(SERVICE_ENDPOINT)" \
		--owner $(OWNER_ADDRESS)

# Resolve a DID
.PHONY: resolve-did
resolve-did:
	@echo "Resolving DID..."
	soroban contract invoke \
		--id $(CONTRACT_ID) \
		--source $(USER_SECRET) \
		--network $(NETWORK) \
		-- \
		resolve_did \
		--did "$(DID)"

# Issue a credential
.PHONY: issue-credential
issue-credential:
	@echo "Issuing credential..."
	soroban contract invoke \
		--id $(CONTRACT_ID) \
		--source $(ISSUER_SECRET) \
		--network $(NETWORK) \
		-- \
		issue_credential \
		--issuer "$(ISSUER_DID)" \
		--subject "$(SUBJECT_DID)" \
		--credential_type "$(CREDENTIAL_TYPE)" \
		--claims_hash "$(CLAIMS_HASH)" \
		--expires $(EXPIRES) \
		--issuer_address $(ISSUER_ADDRESS)

# Verify a credential
.PHONY: verify-credential
verify-credential:
	@echo "Verifying credential..."
	soroban contract invoke \
		--id $(CONTRACT_ID) \
		--source $(USER_SECRET) \
		--network $(NETWORK) \
		-- \
		verify_credential \
		--credential_id "$(CREDENTIAL_ID)"

# Get contract info
.PHONY: contract-info
contract-info:
	@echo "Getting contract info..."
	soroban contract invoke \
		--id $(CONTRACT_ID) \
		--source $(USER_SECRET) \
		--network $(NETWORK) \
		-- \
		get_contract_info

# Clean build artifacts
.PHONY: clean
clean:
	@echo "Cleaning build artifacts..."
	cargo clean
	rm -rf target/

# Format code
.PHONY: fmt
fmt:
	@echo "Formatting code..."
	cargo fmt

# Check code
.PHONY: check
check:
	@echo "Checking code..."
	cargo check
	cargo clippy -- -D warnings

# Generate documentation
.PHONY: docs
docs:
	@echo "Generating documentation..."
	cargo doc --open

# Size analysis
.PHONY: size
size: build
	@echo "Contract size analysis:"
	@ls -lh target/wasm32-unknown-unknown/release/stellar_did_contract.wasm
	@echo "WASM sections:"
	wasm-objdump -h target/wasm32-unknown-unknown/release/stellar_did_contract.wasm

# Help
.PHONY: help
help:
	@echo "Stellar DID Contract - Available Commands:"
	@echo ""
	@echo "Build & Test:"
	@echo "  make build          - Build the contract"
	@echo "  make optimize       - Build and optimize WASM"
	@echo "  make test           - Run tests"
	@echo "  make clean          - Clean build artifacts"
	@echo ""
	@echo "Deployment:"
	@echo "  make deploy-testnet - Deploy to testnet"
	@echo "  make deploy-futurenet - Deploy to futurenet"
	@echo "  make init-contract  - Initialize deployed contract"
	@echo ""
	@echo "Operations (requires environment variables):"
	@echo "  make register-did   - Register a new DID"
	@echo "  make resolve-did    - Resolve an existing DID"
	@echo "  make issue-credential - Issue a verifiable credential"
	@echo "  make verify-credential - Verify a credential"
	@echo "  make contract-info  - Get contract information"
	@echo ""
	@echo "Development:"
	@echo "  make fmt            - Format code"
	@echo "  make check          - Run code quality checks"
	@echo "  make docs           - Generate documentation"
	@echo "  make size           - Analyze contract size"
	@echo "  make help           - Show this help"
	@echo ""
	@echo "Environment Variables Required:"
	@echo "  DEPLOYER_SECRET    - Secret key for deployment"
	@echo "  CONTRACT_ID        - Deployed contract ID"
	@echo "  NETWORK            - testnet or futurenet"
	@echo "  OWNER_ADDRESS      - Contract owner address"
	@echo "  OWNER_SECRET       - Contract owner secret"
	@echo "  USER_SECRET        - User secret for operations"
