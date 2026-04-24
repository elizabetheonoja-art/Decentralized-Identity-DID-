const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("EthereumDIDRegistry Contract Tests", function () {
    let didRegistry;
    let stateRecovery;
    let owner, admin, issuer, recovery, user1, user2, user3, attacker;
    
    // Test constants
    const TEST_DID = "did:ethereum:0x1234567890123456789012345678901234567890";
    const TEST_DID_2 = "did:ethereum:0x9876543210987654321098765432109876543210";
    const TEST_PUBLIC_KEY = "0xABCDEF1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890";
    const TEST_SERVICE_ENDPOINT = "https://did.example.com/endpoint";
    const TEST_CREDENTIAL_ID = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("test-credential"));

    beforeEach(async function () {
        [owner, admin, issuer, recovery, user1, user2, user3, attacker] = await ethers.getSigners();
        
        // Deploy StateRecovery first
        const StateRecoveryFactory = await ethers.getContractFactory("StateRecovery");
        stateRecovery = await StateRecoveryFactory.deploy();
        await stateRecovery.deployed();
        
        // Deploy EthereumDIDRegistry
        const DIDRegistryFactory = await ethers.getContractFactory("EthereumDIDRegistry");
        didRegistry = await DIDRegistryFactory.deploy();
        await didRegistry.deployed();
        
        // Setup roles
        await didRegistry.grantRole(await didRegistry.ADMIN_ROLE(), admin.address);
        await didRegistry.grantRole(await didRegistry.ISSUER_ROLE(), issuer.address);
        await didRegistry.grantRole(await didRegistry.RECOVERY_ROLE(), recovery.address);
        
        // Set state recovery contract
        await didRegistry.setStateRecoveryContract(stateRecovery.address);
        
        // Setup state recovery to call DID registry
        await stateRecovery.setTargetContracts(didRegistry.address, ethers.constants.AddressZero);
        await stateRecovery.grantRole(await stateRecovery.RECOVERY_ROLE(), didRegistry.address);
    });

    describe("Contract Initialization", function () {
        it("Should deploy with correct owner", async function () {
            expect(await didRegistry._admin()).to.equal(owner.address);
        });

        it("Should set correct role constants", async function () {
            const adminRole = await didRegistry.ADMIN_ROLE();
            const issuerRole = await didRegistry.ISSUER_ROLE();
            const recoveryRole = await didRegistry.RECOVERY_ROLE();
            
            expect(adminRole).to.equal(ethers.utils.keccak256(ethers.utils.toUtf8Bytes("ADMIN_ROLE")));
            expect(issuerRole).to.equal(ethers.utils.keccak256(ethers.utils.toUtf8Bytes("ISSUER_ROLE")));
            expect(recoveryRole).to.equal(ethers.utils.keccak256(ethers.utils.toUtf8Bytes("RECOVERY_ROLE")));
        });

        it("Should initialize with correct recovery mode state", async function () {
            expect(await didRegistry.recoveryMode()).to.be.false;
            expect(await didRegistry.stateRecoveryContract()).to.equal(stateRecovery.address);
        });
    });

    describe("Role Management", function () {
        it("Should allow admin to grant roles", async function () {
            await didRegistry.connect(admin).grantRole(await didRegistry.ISSUER_ROLE(), user1.address);
            expect(await didRegistry.hasRole(await didRegistry.ISSUER_ROLE(), user1.address)).to.be.true;
        });

        it("Should prevent non-admin from granting roles", async function () {
            await expect(
                didRegistry.connect(attacker).grantRole(await didRegistry.ISSUER_ROLE(), user1.address)
            ).to.be.revertedWith("AccessControl: caller missing role");
        });

        it("Should allow role-based access control", async function () {
            expect(await didRegistry.hasRole(await didRegistry.ADMIN_ROLE(), admin.address)).to.be.true;
            expect(await didRegistry.hasRole(await didRegistry.ISSUER_ROLE(), issuer.address)).to.be.true;
            expect(await didRegistry.hasRole(await didRegistry.RECOVERY_ROLE(), recovery.address)).to.be.true;
            expect(await didRegistry.hasRole(await didRegistry.ADMIN_ROLE(), attacker.address)).to.be.false;
        });
    });

    describe("DID Bridging", function () {
        it("Should allow admin to bridge DID", async function () {
            const tx = await didRegistry.connect(admin).bridgeDID(
                TEST_DID,
                user1.address,
                TEST_PUBLIC_KEY,
                TEST_SERVICE_ENDPOINT
            );
            
            const receipt = await tx.wait();
            const event = receipt.events.find(e => e.event === "DIDBridged");
            
            expect(event.args.did).to.equal(TEST_DID);
            expect(event.args.owner).to.equal(user1.address);
            expect(event.args.publicKey).to.equal(TEST_PUBLIC_KEY);
            
            // Verify DID document
            const didDoc = await didRegistry.getDIDDocument(TEST_DID);
            expect(didDoc.owner).to.equal(user1.address);
            expect(didDoc.publicKey).to.equal(TEST_PUBLIC_KEY);
            expect(didDoc.serviceEndpoint).to.equal(TEST_SERVICE_ENDPOINT);
            expect(didDoc.active).to.be.true;
            expect(didDoc.created).to.be.gt(0);
            expect(didDoc.updated).to.equal(didDoc.created);
        });

        it("Should prevent bridging duplicate DID", async function () {
            await didRegistry.connect(admin).bridgeDID(TEST_DID, user1.address, TEST_PUBLIC_KEY, TEST_SERVICE_ENDPOINT);
            
            await expect(
                didRegistry.connect(admin).bridgeDID(TEST_DID, user2.address, TEST_PUBLIC_KEY, TEST_SERVICE_ENDPOINT)
            ).to.be.revertedWith("DID already exists on this chain");
        });

        it("Should prevent non-admin from bridging DID", async function () {
            await expect(
                didRegistry.connect(attacker).bridgeDID(TEST_DID, user1.address, TEST_PUBLIC_KEY, TEST_SERVICE_ENDPOINT)
            ).to.be.revertedWith("AccessControl: caller missing role");
        });

        it("Should handle empty service endpoint", async function () {
            await didRegistry.connect(admin).bridgeDID(TEST_DID_2, user2.address, TEST_PUBLIC_KEY, "");
            
            const didDoc = await didRegistry.getDIDDocument(TEST_DID_2);
            expect(didDoc.serviceEndpoint).to.equal("");
        });
    });

    describe("Credential Bridging", function () {
        it("Should allow admin to bridge credential", async function () {
            const expires = Math.floor(Date.now() / 1000) + 86400; // 24 hours from now
            const dataHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("credential data"));
            
            const tx = await didRegistry.connect(admin).bridgeCredential(
                TEST_CREDENTIAL_ID,
                "https://issuer.example.com",
                "did:example:subject",
                "VerificationCredential",
                expires,
                dataHash
            );
            
            const receipt = await tx.wait();
            const event = receipt.events.find(e => e.event === "CredentialBridged");
            
            expect(event.args.id).to.equal(TEST_CREDENTIAL_ID);
            expect(event.args.issuer).to.equal("https://issuer.example.com");
            expect(event.args.subject).to.equal("did:example:subject");
            
            // Verify credential
            const credential = await didRegistry.getCredential(TEST_CREDENTIAL_ID);
            expect(credential.id).to.equal(TEST_CREDENTIAL_ID);
            expect(credential.issuer).to.equal("https://issuer.example.com");
            expect(credential.subject).to.equal("did:example:subject");
            expect(credential.credentialType).to.equal("VerificationCredential");
            expect(credential.expires).to.equal(expires);
            expect(credential.dataHash).to.equal(dataHash);
            expect(credential.revoked).to.be.false;
        });

        it("Should prevent bridging duplicate credential", async function () {
            await didRegistry.connect(admin).bridgeCredential(
                TEST_CREDENTIAL_ID,
                "https://issuer.example.com",
                "did:example:subject",
                "VerificationCredential",
                1234567890,
                ethers.utils.keccak256("data")
            );
            
            await expect(
                didRegistry.connect(admin).bridgeCredential(
                    TEST_CREDENTIAL_ID,
                    "https://other-issuer.example.com",
                    "did:example:other-subject",
                    "OtherCredential",
                    1234567890,
                    ethers.utils.keccak256("other-data")
                )
            ).to.be.revertedWith("Credential already exists");
        });

        it("Should prevent non-admin from bridging credential", async function () {
            await expect(
                didRegistry.connect(attacker).bridgeCredential(
                    TEST_CREDENTIAL_ID,
                    "https://issuer.example.com",
                    "did:example:subject",
                    "VerificationCredential",
                    1234567890,
                    ethers.utils.keccak256("data")
                )
            ).to.be.revertedWith("AccessControl: caller missing role");
        });
    });

    describe("ERC725 Implementation", function () {
        beforeEach(async function () {
            // Bridge a DID first for ERC725 tests
            await didRegistry.connect(admin).bridgeDID(TEST_DID, user1.address, TEST_PUBLIC_KEY, TEST_SERVICE_ENDPOINT);
        });

        it("Should allow DID owner to set data", async function () {
            const key = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("test-key"));
            const value = ethers.utils.toUtf8Bytes("test-value");
            
            const tx = await didRegistry.connect(user1).setData(key, value);
            const receipt = await tx.wait();
            const event = receipt.events.find(e => e.event === "DataChanged");
            
            expect(event.args.key).to.equal(key);
            expect(event.args.value).to.equal(value);
            
            // Verify data was set
            const storedValue = await didRegistry.connect(user1).getData(key);
            expect(storedValue).to.equal(value);
        });

        it("Should prevent non-DID owner from setting data", async function () {
            const key = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("test-key"));
            const value = ethers.utils.toUtf8Bytes("test-value");
            
            await expect(
                didRegistry.connect(attacker).setData(key, value)
            ).to.be.revertedWith("No DID found for caller address");
        });

        it("Should allow DID owner to get data", async function () {
            const key = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("test-key"));
            const value = ethers.utils.toUtf8Bytes("test-value");
            
            await didRegistry.connect(user1).setData(key, value);
            
            const retrievedValue = await didRegistry.connect(user1).getData(key);
            expect(retrievedValue).to.equal(value);
        });

        it("Should allow DID owner to execute calls", async function () {
            // Deploy a simple target contract for execution testing
            const TargetFactory = await ethers.getContractFactory("ReentrancyGuard");
            const target = await TargetFactory.deploy();
            await target.deployed();
            
            const callData = target.interface.encodeFunctionData("reentrancyGuardEntered");
            
            const tx = await didRegistry.connect(user1).execute(
                0, // operation type
                target.address,
                0, // value
                callData
            );
            
            const receipt = await tx.wait();
            const event = receipt.events.find(e => e.event === "Executed");
            
            expect(event.args.operationType).to.equal(0);
            expect(event.args.target).to.equal(target.address);
            expect(event.args.value).to.equal(0);
        });

        it("Should prevent non-DID owner from executing calls", async function () {
            const TargetFactory = await ethers.getContractFactory("ReentrancyGuard");
            const target = await TargetFactory.deploy();
            await target.deployed();
            
            const callData = target.interface.encodeFunctionData("reentrancyGuardEntered");
            
            await expect(
                didRegistry.connect(attacker).execute(0, target.address, 0, callData)
            ).to.be.revertedWith("No DID found for caller address");
        });

        it("Should handle failed execution", async function () {
            const callData = "0x12345678"; // Invalid function selector
            
            await expect(
                didRegistry.connect(user1).execute(0, user1.address, 0, callData)
            ).to.be.revertedWith("Execution failed");
        });
    });

    describe("ERC735 Implementation", function () {
        beforeEach(async function () {
            // Bridge a DID first for ERC735 tests
            await didRegistry.connect(admin).bridgeDID(TEST_DID, user1.address, TEST_PUBLIC_KEY, TEST_SERVICE_ENDPOINT);
        });

        it("Should allow DID owner to add claim", async function () {
            const topic = 1;
            const scheme = 1;
            const signature = ethers.utils.toUtf8Bytes("signature");
            const data = ethers.utils.toUtf8Bytes("claim data");
            const uri = "https://claim.example.com";
            
            const tx = await didRegistry.connect(user1).addClaim(topic, scheme, issuer.address, signature, data, uri);
            const receipt = await tx.wait();
            const event = receipt.events.find(e => e.event === "ClaimAdded");
            
            expect(event.args.topic).to.equal(topic);
            expect(event.args.scheme).to.equal(scheme);
            expect(event.args.issuer).to.equal(issuer.address);
            
            // Verify claim was added
            const claimId = ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(
                ["address", "uint256"],
                [issuer.address, topic]
            ));
            
            const claim = await didRegistry.connect(user1).getClaim(claimId);
            expect(claim.topic).to.equal(topic);
            expect(claim.scheme).to.equal(scheme);
            expect(claim.issuer).to.equal(issuer.address);
        });

        it("Should allow issuer to add claim", async function () {
            const topic = 2;
            const scheme = 1;
            const signature = ethers.utils.toUtf8Bytes("issuer signature");
            const data = ethers.utils.toUtf8Bytes("issuer claim data");
            const uri = "https://issuer-claim.example.com";
            
            const tx = await didRegistry.connect(issuer).addClaim(topic, scheme, issuer.address, signature, data, uri);
            const receipt = await tx.wait();
            const event = receipt.events.find(e => e.event === "ClaimAdded");
            
            expect(event.args.issuer).to.equal(issuer.address);
        });

        it("Should prevent unauthorized claim addition", async function () {
            const topic = 3;
            const scheme = 1;
            const signature = ethers.utils.toUtf8Bytes("signature");
            const data = ethers.utils.toUtf8Bytes("claim data");
            const uri = "https://claim.example.com";
            
            await expect(
                didRegistry.connect(attacker).addClaim(topic, scheme, issuer.address, signature, data, uri)
            ).to.be.revertedWith("No DID found for caller address");
        });

        it("Should allow DID owner to remove claim", async function () {
            const topic = 1;
            const scheme = 1;
            const signature = ethers.utils.toUtf8Bytes("signature");
            const data = ethers.utils.toUtf8Bytes("claim data");
            const uri = "https://claim.example.com";
            
            // Add a claim first
            const addTx = await didRegistry.connect(user1).addClaim(topic, scheme, issuer.address, signature, data, uri);
            const addReceipt = await addTx.wait();
            const addEvent = addReceipt.events.find(e => e.event === "ClaimAdded");
            const claimId = addEvent.args.claimId;
            
            // Remove the claim
            const tx = await didRegistry.connect(user1).removeClaim(claimId);
            const receipt = await tx.wait();
            const event = receipt.events.find(e => e.event === "ClaimRemoved");
            
            expect(event.args.claimId).to.equal(claimId);
            expect(event.args.topic).to.equal(topic);
        });

        it("Should prevent non-DID owner from removing claim", async function () {
            const topic = 1;
            const scheme = 1;
            const signature = ethers.utils.toUtf8Bytes("signature");
            const data = ethers.utils.toUtf8Bytes("claim data");
            const uri = "https://claim.example.com";
            
            // Add a claim first
            const addTx = await didRegistry.connect(user1).addClaim(topic, scheme, issuer.address, signature, data, uri);
            const addReceipt = await addTx.wait();
            const addEvent = addReceipt.events.find(e => e.event === "ClaimAdded");
            const claimId = addEvent.args.claimId;
            
            // Try to remove with unauthorized user
            await expect(
                didRegistry.connect(attacker).removeClaim(claimId)
            ).to.be.revertedWith("No DID found for caller address");
        });

        it("Should get claims by topic", async function () {
            const topic = 1;
            const scheme = 1;
            const signature = ethers.utils.toUtf8Bytes("signature");
            const data = ethers.utils.toUtf8Bytes("claim data");
            const uri = "https://claim.example.com";
            
            // Add multiple claims with same topic
            await didRegistry.connect(user1).addClaim(topic, scheme, issuer.address, signature, data, uri);
            await didRegistry.connect(user1).addClaim(topic, scheme, user2.address, signature, data, uri);
            
            const claimIds = await didRegistry.connect(user1).getClaimIdsByTopic(topic);
            expect(claimIds.length).to.equal(2);
        });
    });

    describe("Recovery Mode", function () {
        it("Should allow admin to enable recovery mode", async function () {
            await didRegistry.connect(admin).enableRecoveryMode();
            expect(await didRegistry.recoveryMode()).to.be.true;
        });

        it("Should allow admin to disable recovery mode", async function () {
            await didRegistry.connect(admin).enableRecoveryMode();
            await didRegistry.connect(admin).disableRecoveryMode();
            expect(await didRegistry.recoveryMode()).to.be.false;
        });

        it("Should prevent non-admin from enabling recovery mode", async function () {
            await expect(
                didRegistry.connect(attacker).enableRecoveryMode()
            ).to.be.revertedWith("AccessControl: caller missing role");
        });

        it("Should prevent non-admin from disabling recovery mode", async function () {
            await expect(
                didRegistry.connect(attacker).disableRecoveryMode()
            ).to.be.revertedWith("AccessControl: caller missing role");
        });

        it("Should prevent operations when not in recovery mode", async function () {
            await expect(
                didRegistry.connect(recovery).recoverDIDDocument(TEST_DID, user1.address, TEST_PUBLIC_KEY, TEST_SERVICE_ENDPOINT)
            ).to.be.revertedWith("Contract is not in recovery mode");
        });
    });

    describe("Recovery Functions", function () {
        beforeEach(async function () {
            await didRegistry.connect(admin).enableRecoveryMode();
        });

        it("Should allow recovery contract to recover DID document", async function () {
            const tx = await didRegistry.connect(recovery).recoverDIDDocument(
                TEST_DID,
                user1.address,
                TEST_PUBLIC_KEY,
                TEST_SERVICE_ENDPOINT
            );
            
            const receipt = await tx.wait();
            const event = receipt.events.find(e => e.event === "DIDUpdated");
            
            expect(event.args.did).to.equal(TEST_DID);
            
            // Verify DID document was recovered
            const didDoc = await didRegistry.getDIDDocument(TEST_DID);
            expect(didDoc.owner).to.equal(user1.address);
            expect(didDoc.publicKey).to.equal(TEST_PUBLIC_KEY);
            expect(didDoc.serviceEndpoint).to.equal(TEST_SERVICE_ENDPOINT);
            expect(didDoc.active).to.be.true;
        });

        it("Should allow recovery contract to recover credential", async function () {
            const tx = await didRegistry.connect(recovery).recoverCredential(
                TEST_CREDENTIAL_ID,
                "https://recovered-issuer.example.com",
                "did:recovered:subject",
                "RecoveredCredential",
                1234567890,
                ethers.utils.keccak256("recovered data")
            );
            
            const receipt = await tx.wait();
            const event = receipt.events.find(e => e.event === "CredentialBridged");
            
            expect(event.args.id).to.equal(TEST_CREDENTIAL_ID);
            expect(event.args.issuer).to.equal("https://recovered-issuer.example.com");
            
            // Verify credential was recovered
            const credential = await didRegistry.getCredential(TEST_CREDENTIAL_ID);
            expect(credential.issuer).to.equal("https://recovered-issuer.example.com");
            expect(credential.subject).to.equal("did:recovered:subject");
            expect(credential.credentialType).to.equal("RecoveredCredential");
        });

        it("Should allow recovery contract to recover ownership mapping", async function () {
            // First bridge a DID to user1
            await didRegistry.connect(admin).bridgeDID(TEST_DID, user1.address, TEST_PUBLIC_KEY, TEST_SERVICE_ENDPOINT);
            
            // Then transfer ownership to user2
            await didRegistry.connect(recovery).recoverOwnershipMapping(user1.address, user2.address, TEST_DID);
            
            // Verify ownership was transferred
            const didDoc = await didRegistry.getDIDDocument(TEST_DID);
            expect(didDoc.owner).to.equal(user2.address);
        });

        it("Should allow recovery contract to recover role assignment", async function () {
            await didRegistry.connect(recovery).recoverRoleAssignment(
                await didRegistry.ISSUER_ROLE(),
                user1.address,
                true
            );
            
            expect(await didRegistry.hasRole(await didRegistry.ISSUER_ROLE(), user1.address)).to.be.true;
        });

        it("Should prevent non-recovery contract from calling recovery functions", async function () {
            await expect(
                didRegistry.connect(attacker).recoverDIDDocument(TEST_DID, user1.address, TEST_PUBLIC_KEY, TEST_SERVICE_ENDPOINT)
            ).to.be.revertedWith("Only recovery contract can call this function");
        });
    });

    describe("State Validation", function () {
        it("Should validate state integrity", async function () {
            const [isValid, issue] = await didRegistry.validateStateIntegrity();
            expect(isValid).to.be.true;
            expect(issue).to.equal("No issues found");
        });

        it("Should provide state summary", async function () {
            const [totalDIDs, totalCredentials, totalOwners, isInRecoveryMode] = await didRegistry.getStateSummary();
            expect(isInRecoveryMode).to.be.false;
            // Note: These are placeholder values in the current implementation
            expect(totalDIDs).to.equal(0);
            expect(totalCredentials).to.equal(0);
            expect(totalOwners).to.equal(0);
        });
    });

    describe("Edge Cases and Error Conditions", function () {
        it("Should handle empty DID string", async function () {
            await expect(
                didRegistry.connect(recovery).recoverDIDDocument("", user1.address, TEST_PUBLIC_KEY, TEST_SERVICE_ENDPOINT)
            ).to.be.revertedWith("DID cannot be empty");
        });

        it("Should handle zero address for owner", async function () {
            await expect(
                didRegistry.connect(recovery).recoverDIDDocument(TEST_DID, ethers.constants.AddressZero, TEST_PUBLIC_KEY, TEST_SERVICE_ENDPOINT)
            ).to.be.revertedWith("New owner cannot be zero address");
        });

        it("Should handle empty public key", async function () {
            await expect(
                didRegistry.connect(recovery).recoverDIDDocument(TEST_DID, user1.address, "", TEST_SERVICE_ENDPOINT)
            ).to.be.revertedWith("Public key cannot be empty");
        });

        it("Should handle zero credential ID", async function () {
            await expect(
                didRegistry.connect(recovery).recoverCredential(
                    ethers.constants.HashZero,
                    "https://issuer.example.com",
                    "did:example:subject",
                    "Credential",
                    1234567890,
                    ethers.utils.keccak256("data")
                )
            ).to.be.revertedWith("Credential ID cannot be zero");
        });

        it("Should handle empty issuer", async function () {
            await expect(
                didRegistry.connect(recovery).recoverCredential(
                    TEST_CREDENTIAL_ID,
                    "",
                    "did:example:subject",
                    "Credential",
                    1234567890,
                    ethers.utils.keccak256("data")
                )
            ).to.be.revertedWith("Issuer cannot be empty");
        });

        it("Should handle empty subject", async function () {
            await expect(
                didRegistry.connect(recovery).recoverCredential(
                    TEST_CREDENTIAL_ID,
                    "https://issuer.example.com",
                    "",
                    "Credential",
                    1234567890,
                    ethers.utils.keccak256("data")
                )
            ).to.be.revertedWith("Subject cannot be empty");
        });

        it("Should prevent operations when not in recovery mode", async function () {
            await didRegistry.connect(admin).disableRecoveryMode();
            
            await expect(
                didRegistry.connect(recovery).recoverDIDDocument(TEST_DID, user1.address, TEST_PUBLIC_KEY, TEST_SERVICE_ENDPOINT)
            ).to.be.revertedWith("Contract is not in recovery mode");
        });

        it("Should handle non-existent DID operations", async function () {
            const nonExistentDID = "did:ethereum:0x9999999999999999999999999999999999999999";
            
            const didDoc = await didRegistry.getDIDDocument(nonExistentDID);
            expect(didDoc.owner).to.equal(ethers.constants.AddressZero);
            expect(didDoc.created).to.equal(0);
            expect(didDoc.updated).to.equal(0);
            expect(didDoc.active).to.be.false;
        });

        it("Should handle non-existent credential operations", async function () {
            const nonExistentCredential = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("non-existent"));
            
            const credential = await didRegistry.getCredential(nonExistentCredential);
            expect(credential.id).to.equal(ethers.constants.HashZero);
            expect(credential.issued).to.equal(0);
            expect(credential.expires).to.equal(0);
            expect(credential.revoked).to.be.false;
        });
    });
});
