const { ethers } = require("hardhat");

/**
 * Test utilities and helper functions for DID Registry testing
 */

class TestHelper {
    /**
     * Generate test DID string
     * @param {string} address - Ethereum address
     * @returns {string} DID string
     */
    static generateTestDID(address) {
        return `did:ethereum:${address}`;
    }

    /**
     * Generate test public key
     * @param {number} length - Key length in characters
     * @returns {string} Public key string
     */
    static generateTestPublicKey(length = 64) {
        return "0x" + "ABCDEF1234567890".repeat(Math.ceil(length / 16)).substring(0, length);
    }

    /**
     * Generate test service endpoint
     * @param {string} domain - Domain name
     * @returns {string} Service endpoint URL
     */
    static generateTestServiceEndpoint(domain = "example.com") {
        return `https://did.${domain}/endpoint`;
    }

    /**
     * Generate test credential data
     * @param {string} issuer - Issuer URL
     * @param {string} subject - Subject DID
     * @param {string} type - Credential type
     * @returns {object} Credential data object
     */
    static generateTestCredential(issuer, subject, type) {
        return {
            id: ethers.utils.keccak256(ethers.utils.toUtf8Bytes(`${issuer}-${subject}-${type}-${Date.now()}`)),
            issuer: issuer || `https://issuer-${Date.now()}.example.com`,
            subject: subject || this.generateTestDID(ethers.Wallet.createRandom().address),
            credentialType: type || "VerificationCredential",
            expires: Math.floor(Date.now() / 1000) + 86400, // 24 hours from now
            dataHash: ethers.utils.keccak256(ethers.utils.toUtf8Bytes(`credential-data-${Date.now()}`))
        };
    }

    /**
     * Generate test claim data
     * @param {number} topic - Claim topic
     * @param {address} issuer - Issuer address
     * @returns {object} Claim data object
     */
    static generateTestClaim(topic, issuer) {
        return {
            topic: topic || 1,
            scheme: 1,
            issuer: issuer || ethers.Wallet.createRandom().address,
            signature: ethers.utils.toUtf8Bytes(`signature-${Date.now()}`),
            data: ethers.utils.toUtf8Bytes(`claim-data-${Date.now()}`),
            uri: `https://claim-${Date.now()}.example.com`
        };
    }

    /**
     * Deploy contracts with proper setup
     * @param {object} signers - Contract signers
     * @returns {object} Deployed contracts
     */
    static async deployContracts(signers) {
        const [owner, admin, governor, guardian, auditor, issuer, recovery] = signers;

        // Deploy StateRecovery
        const StateRecoveryFactory = await ethers.getContractFactory("StateRecovery");
        const stateRecovery = await StateRecoveryFactory.deploy();
        await stateRecovery.deployed();

        // Deploy EthereumDIDRegistry
        const DIDRegistryFactory = await ethers.getContractFactory("EthereumDIDRegistry");
        const didRegistry = await DIDRegistryFactory.deploy();
        await didRegistry.deployed();

        // Deploy RecoveryGovernance
        const RecoveryGovernanceFactory = await ethers.getContractFactory("RecoveryGovernance");
        const recoveryGovernance = await RecoveryGovernanceFactory.deploy(stateRecovery.address);
        await recoveryGovernance.deployed();

        return {
            didRegistry,
            stateRecovery,
            recoveryGovernance,
            owner,
            admin,
            governor,
            guardian,
            auditor,
            issuer,
            recovery
        };
    }

    /**
     * Setup roles and permissions for contracts
     * @param {object} contracts - Deployed contracts
     * @param {object} signers - Contract signers
     */
    static async setupRolesAndPermissions(contracts, signers) {
        const { didRegistry, stateRecovery, recoveryGovernance } = contracts;
        const { admin, governor, guardian, auditor, issuer, recovery } = signers;

        // DID Registry roles
        await didRegistry.grantRole(await didRegistry.ADMIN_ROLE(), admin.address);
        await didRegistry.grantRole(await didRegistry.ISSUER_ROLE(), issuer.address);
        await didRegistry.grantRole(await didRegistry.RECOVERY_ROLE(), recovery.address);

        // State Recovery roles
        await stateRecovery.grantRole(await stateRecovery.RECOVERY_ROLE(), recovery.address);
        await stateRecovery.grantRole(await stateRecovery.EMERGENCY_ROLE(), recovery.address);
        await stateRecovery.grantRole(await stateRecovery.GOVERNANCE_ROLE(), governor.address);

        // Recovery Governance roles
        await recoveryGovernance.grantRole(await recoveryGovernance.GOVERNOR_ROLE(), governor.address);
        await recoveryGovernance.grantRole(await recoveryGovernance.GUARDIAN_ROLE(), guardian.address);
        await recoveryGovernance.grantRole(await recoveryGovernance.AUDITOR_ROLE(), auditor.address);

        // Set up contract relationships
        await didRegistry.setStateRecoveryContract(stateRecovery.address);
        await stateRecovery.setTargetContracts(didRegistry.address, ethers.constants.AddressZero);
        await recoveryGovernance.connect(governor).authorizeContract(stateRecovery.address);
        
        // Grant recovery contract permissions
        await didRegistry.grantRole(await didRegistry.RECOVERY_ROLE(), stateRecovery.address);
        await stateRecovery.grantRole(await stateRecovery.RECOVERY_ROLE(), didRegistry.address);
    }

    /**
     * Create a complete DID setup with claims and credentials
     * @param {object} contracts - Deployed contracts
     * @param {object} signers - Contract signers
     * @param {object} options - Configuration options
     * @returns {object} Created DID data
     */
    static async createCompleteDIDSetup(contracts, signers, options = {}) {
        const { didRegistry, stateRecovery, recoveryGovernance } = contracts;
        const { admin, issuer, user } = signers;

        const did = options.did || this.generateTestDID(user.address);
        const publicKey = options.publicKey || this.generateTestPublicKey();
        const serviceEndpoint = options.serviceEndpoint || this.generateTestServiceEndpoint();

        // Bridge DID
        await didRegistry.connect(admin).bridgeDID(did, user.address, publicKey, serviceEndpoint);

        // Add claims
        const claims = [];
        if (options.addClaims !== false) {
            for (let i = 0; i < (options.claimCount || 3); i++) {
                const claim = this.generateTestClaim(i + 1, issuer.address);
                await didRegistry.connect(user).addClaim(
                    claim.topic,
                    claim.scheme,
                    claim.issuer,
                    claim.signature,
                    claim.data,
                    claim.uri
                );
                claims.push(claim);
            }
        }

        // Add credentials
        const credentials = [];
        if (options.addCredentials !== false) {
            for (let i = 0; i < (options.credentialCount || 2); i++) {
                const credential = this.generateTestCredential(
                    `https://issuer-${i}.example.com`,
                    did,
                    `CredentialType${i}`
                );
                await didRegistry.connect(admin).bridgeCredential(
                    credential.id,
                    credential.issuer,
                    credential.subject,
                    credential.credentialType,
                    credential.expires,
                    credential.dataHash
                );
                credentials.push(credential);
            }
        }

        return {
            did,
            publicKey,
            serviceEndpoint,
            claims,
            credentials
        };
    }

    /**
     * Perform governed recovery
     * @param {object} contracts - Deployed contracts
     * @param {object} signers - Contract signers
     * @param {object} recoveryData - Recovery data
     * @param {string} reason - Recovery reason
     * @param {boolean} emergency - Whether it's an emergency recovery
     * @returns {object} Recovery result
     */
    static async performGovernedRecovery(contracts, signers, recoveryData, reason, emergency = false) {
        const { didRegistry, stateRecovery, recoveryGovernance } = contracts;
        const { governor, admin } = signers;

        // Enable recovery mode
        await didRegistry.connect(admin).enableRecoveryMode();

        // Activate emergency mode if needed
        if (emergency) {
            await recoveryGovernance.connect(governor).activateEmergencyMode(reason);
        }

        // Encode recovery data
        const encodedData = ethers.utils.defaultAbiCoder.encode(
            ["string", "address", "string", "string"],
            [recoveryData.did, recoveryData.newOwner, recoveryData.newPublicKey, recoveryData.newServiceEndpoint]
        );

        // Perform governed recovery
        const tx = await recoveryGovernance.connect(governor).governedRecovery(
            0, // DID_DOCUMENT
            encodedData,
            reason,
            emergency
        );

        const receipt = await tx.wait();
        const event = receipt.events.find(e => e.event === "RecoveryOperationLogged");

        return {
            transaction: tx,
            receipt,
            event,
            proposalId: event ? event.args.proposalId : null,
            successful: event ? event.args.successful : false
        };
    }

    /**
     * Wait for a specific number of blocks
     * @param {number} blockCount - Number of blocks to wait
     */
    static async waitForBlocks(blockCount) {
        for (let i = 0; i < blockCount; i++) {
            await ethers.provider.send("evm_mine");
        }
    }

    /**
     * Increase blockchain time
     * @param {number} seconds - Number of seconds to increase
     */
    static async increaseTime(seconds) {
        await ethers.provider.send("evm_increaseTime", [seconds]);
        await ethers.provider.send("evm_mine");
    }

    /**
     * Set specific block timestamp
     * @param {number} timestamp - Timestamp to set
     */
    static async setTimestamp(timestamp) {
        await ethers.provider.send("evm_setNextBlockTimestamp", [timestamp]);
        await ethers.provider.send("evm_mine");
    }

    /**
     * Get current block timestamp
     * @returns {number} Current block timestamp
     */
    static async getCurrentTimestamp() {
        const block = await ethers.provider.getBlock("latest");
        return block.timestamp;
    }

    /**
     * Calculate gas cost in ETH
     * @param {object} receipt - Transaction receipt
     * @returns {string} Gas cost in ETH
     */
    static calculateGasCost(receipt) {
        return ethers.utils.formatEther(receipt.gasUsed.mul(receipt.effectiveGasPrice));
    }

    /**
     * Verify event was emitted
     * @param {object} receipt - Transaction receipt
     * @param {string} eventName - Event name
     * @param {object} expectedArgs - Expected event arguments
     * @returns {boolean} Whether event was emitted with expected args
     */
    static verifyEvent(receipt, eventName, expectedArgs = {}) {
        const event = receipt.events.find(e => e.event === eventName);
        if (!event) return false;

        if (Object.keys(expectedArgs).length === 0) return true;

        for (const [key, value] of Object.entries(expectedArgs)) {
            if (event.args[key] !== value) {
                return false;
            }
        }

        return true;
    }

    /**
     * Generate test data for boundary testing
     * @returns {object} Boundary test data
     */
    static generateBoundaryTestData() {
        return {
            longString: "A".repeat(10000),
            emptyString: "",
            whitespaceString: "   \t\n\r   ",
            maxUint256: ethers.constants.MaxUint256,
            minUint256: 0,
            maxAddress: "0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF",
            minAddress: ethers.constants.AddressZero,
            longDID: "did:ethereum:" + "1".repeat(40),
            shortDID: "did:ethereum:0x1",
            invalidDID: "not-a-did",
            longPublicKey: "0x" + "A".repeat(64),
            shortPublicKey: "0x1",
            invalidPublicKey: "0xZZZ",
            longEndpoint: "https://" + "a".repeat(1000) + ".com",
            emptyEndpoint: ""
        };
    }

    /**
     * Create multiple signers for testing
     * @param {number} count - Number of signers to create
     * @returns {array} Array of signers
     */
    static async createSigners(count) {
        const signers = await ethers.getSigners();
        return signers.slice(0, Math.min(count, signers.length));
    }

    /**
     * Batch bridge multiple DIDs
     * @param {object} didRegistry - DID Registry contract
     * @param {object} admin - Admin signer
     * @param {array} dids - Array of DID data
     */
    static async batchBridgeDIDs(didRegistry, admin, dids) {
        const promises = dids.map(did => 
            didRegistry.connect(admin).bridgeDID(did.did, did.owner, did.publicKey, did.serviceEndpoint)
        );
        return Promise.all(promises);
    }

    /**
     * Batch add multiple claims
     * @param {object} didRegistry - DID Registry contract
     * @param {object} user - User signer
     * @param {array} claims - Array of claim data
     */
    static async batchAddClaims(didRegistry, user, claims) {
        const promises = claims.map(claim => 
            didRegistry.connect(user).addClaim(
                claim.topic,
                claim.scheme,
                claim.issuer,
                claim.signature,
                claim.data,
                claim.uri
            )
        );
        return Promise.all(promises);
    }

    /**
     * Validate DID document structure
     * @param {object} didDoc - DID document
     * @param {object} expected - Expected values
     * @returns {boolean} Whether DID document is valid
     */
    static validateDIDDocument(didDoc, expected = {}) {
        const requiredFields = ['owner', 'created', 'updated', 'active', 'publicKey', 'serviceEndpoint'];
        
        for (const field of requiredFields) {
            if (didDoc[field] === undefined) {
                return false;
            }
        }

        for (const [key, value] of Object.entries(expected)) {
            if (didDoc[key] !== value) {
                return false;
            }
        }

        return true;
    }

    /**
     * Validate credential structure
     * @param {object} credential - Credential object
     * @param {object} expected - Expected values
     * @returns {boolean} Whether credential is valid
     */
    static validateCredential(credential, expected = {}) {
        const requiredFields = ['id', 'issuer', 'subject', 'credentialType', 'issued', 'expires', 'dataHash', 'revoked'];
        
        for (const field of requiredFields) {
            if (credential[field] === undefined) {
                return false;
            }
        }

        for (const [key, value] of Object.entries(expected)) {
            if (credential[key] !== value) {
                return false;
            }
        }

        return true;
    }
}

module.exports = TestHelper;
