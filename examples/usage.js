/**
 * Stellar DID Platform Usage Examples
 * 
 * This file demonstrates how to use the Stellar DID Platform
 * for various identity and credential operations.
 */

const DIDService = require('../src/services/didService');

// Initialize the service
const didService = new DIDService();

async function example1_createAndResolveDID() {
    console.log('\n=== Example 1: Create and Resolve DID ===');
    
    try {
        // Create a new DID
        console.log('Creating new DID...');
        const didResult = await didService.createDID({
            serviceEndpoint: 'https://example.com/identity-hub'
        });
        
        console.log('DID created successfully!');
        console.log('DID:', didResult.did);
        console.log('Public Key:', didResult.account.publicKey);
        
        // Resolve the DID
        console.log('\nResolving DID...');
        const resolved = await didService.resolveDID(didResult.did);
        
        console.log('DID resolved successfully!');
        console.log('Document:', JSON.stringify(resolved.didDocument, null, 2));
        
        return didResult;
    } catch (error) {
        console.error('Error:', error.message);
    }
}

async function example2_issueAndVerifyCredential() {
    console.log('\n=== Example 2: Issue and Verify Verifiable Credential ===');
    
    try {
        // Create issuer and subject DIDs
        console.log('Creating issuer DID...');
        const issuer = await didService.createDID();
        
        console.log('Creating subject DID...');
        const subject = await didService.createDID();
        
        // Issue a university degree credential
        console.log('Issuing university degree credential...');
        const credential = await didService.createVerifiableCredential(
            issuer.did,
            subject.did,
            {
                degree: 'Bachelor of Science',
                major: 'Computer Science',
                university: 'Stellar University',
                graduationDate: '2023-06-15',
                gpa: '3.8'
            },
            {
                type: ['UniversityDegreeCredential'],
                expirationDate: '2030-06-15'
            }
        );
        
        console.log('Credential issued!');
        console.log('Credential ID:', credential.id);
        
        // Verify the credential
        console.log('\nVerifying credential...');
        const verification = await didService.verifyCredential(credential);
        
        console.log('Verification result:', verification);
        
        return { issuer, subject, credential, verification };
    } catch (error) {
        console.error('Error:', error.message);
    }
}

async function example3_professionalLicense() {
    console.log('\n=== Example 3: Professional License Credential ===');
    
    try {
        // Create medical board and doctor DIDs
        console.log('Creating medical board DID...');
        const medicalBoard = await didService.createDID({
            serviceEndpoint: 'https://medical-board.example.com/verification'
        });
        
        console.log('Creating doctor DID...');
        const doctor = await didService.createDID();
        
        // Issue medical license
        console.log('Issuing medical license...');
        const medicalLicense = await didService.createVerifiableCredential(
            medicalBoard.did,
            doctor.did,
            {
                licenseType: 'Medical Doctor',
            licenseNumber: 'MD123456',
            issuingBoard: 'State Medical Board',
            issuedDate: '2020-01-15',
            expirationDate: '2025-01-15',
            status: 'Active',
            specializations: ['Family Medicine', 'Emergency Medicine']
            },
            {
                type: ['ProfessionalLicenseCredential', 'MedicalLicenseCredential']
            }
        );
        
        console.log('Medical license issued!');
        console.log('License details:', JSON.stringify(medicalLicense, null, 2));
        
        // Verify the license
        const verification = await didService.verifyCredential(medicalLicense);
        console.log('License verification:', verification);
        
        return { medicalBoard, doctor, medicalLicense, verification };
    } catch (error) {
        console.error('Error:', error.message);
    }
}

async function example4_ageVerification() {
    console.log('\n=== Example 4: Privacy-Preserving Age Verification ===');
    
    try {
        // Create government agency and user DIDs
        console.log('Creating government agency DID...');
        const government = await didService.createDID();
        
        console.log('Creating user DID...');
        const user = await didService.createDID();
        
        // Issue age verification credential (without revealing birth date)
        console.log('Issuing age verification credential...');
        const ageCredential = await didService.createVerifiableCredential(
            government.did,
            user.did,
            {
                isOver18: true,
                isOver21: true,
                isOver65: false,
                verificationMethod: 'Government ID Verification',
                verifiedCountry: 'US'
            },
            {
                type: ['AgeVerificationCredential']
            }
        );
        
        console.log('Age verification credential issued!');
        console.log('User can prove they are over 21 without revealing birth date');
        
        // Verify the age credential
        const verification = await didService.verifyCredential(ageCredential);
        console.log('Age verification:', verification);
        
        return { government, user, ageCredential, verification };
    } catch (error) {
        console.error('Error:', error.message);
    }
}

async function example5_employmentVerification() {
    console.log('\n=== Example 5: Employment Verification ===');
    
    try {
        // Create company and employee DIDs
        console.log('Creating company DID...');
        const company = await didService.createDID({
            serviceEndpoint: 'https://hr.company.example.com/verify'
        });
        
        console.log('Creating employee DID...');
        const employee = await didService.createDID();
        
        // Issue employment verification
        console.log('Issuing employment verification...');
        const employmentCredential = await didService.createVerifiableCredential(
            company.did,
            employee.did,
            {
                employer: 'Tech Company Inc.',
                position: 'Senior Blockchain Developer',
                department: 'Engineering',
                startDate: '2021-03-01',
                currentEmployee: true,
                employmentType: 'Full-time',
                location: 'San Francisco, CA'
            },
            {
                type: ['EmploymentCredential']
            }
        );
        
        console.log('Employment verification issued!');
        
        // Verify employment
        const verification = await didService.verifyCredential(employmentCredential);
        console.log('Employment verification:', verification);
        
        return { company, employee, employmentCredential, verification };
    } catch (error) {
        console.error('Error:', error.message);
    }
}

async function example6_batchOperations() {
    console.log('\n=== Example 6: Batch Credential Operations ===');
    
    try {
        // Create university and multiple student DIDs
        console.log('Creating university DID...');
        const university = await didService.createDID();
        
        console.log('Creating student DIDs...');
        const students = [];
        for (let i = 1; i <= 3; i++) {
            const student = await didService.createDID();
            students.push(student);
        }
        
        // Issue credentials to all students
        console.log('Issuing credentials to all students...');
        const credentials = [];
        
        for (let i = 0; i < students.length; i++) {
            const credential = await didService.createVerifiableCredential(
                university.did,
                students[i].did,
                {
                    studentId: `STU${String(i + 1).padStart(4, '0')}`,
                    degree: 'Bachelor of Science',
                    major: ['Computer Science', 'Data Science', 'Cybersecurity'][i],
                    university: 'Stellar University',
                    graduationDate: '2023-06-15',
                    honors: i === 0 ? 'Cum Laude' : null
                },
                {
                    type: ['UniversityDegreeCredential']
                }
            );
            credentials.push(credential);
        }
        
        console.log(`Issued ${credentials.length} credentials`);
        
        // Verify all credentials
        console.log('Verifying all credentials...');
        const verifications = await Promise.all(
            credentials.map(cred => didService.verifyCredential(cred))
        );
        
        const validCount = verifications.filter(v => v.verified).length;
        console.log(`Verified ${validCount}/${credentials.length} credentials successfully`);
        
        return { university, students, credentials, verifications };
    } catch (error) {
        console.error('Error:', error.message);
    }
}

async function example7_didAuthentication() {
    console.log('\n=== Example 7: DID Authentication ===');
    
    try {
        // Create user DID
        console.log('Creating user DID...');
        const user = await didService.createDID();
        
        // Create authentication token
        console.log('Creating authentication token...');
        const token = didService.createAuthToken(user.did, '1h');
        
        console.log('Authentication token created!');
        console.log('Token:', token);
        
        // Verify the token
        console.log('\nVerifying authentication token...');
        const verification = didService.verifyAuthToken(token);
        
        console.log('Token verification:', verification);
        
        return { user, token, verification };
    } catch (error) {
        console.error('Error:', error.message);
    }
}

// Run all examples
async function runAllExamples() {
    console.log('🚀 Stellar DID Platform - Usage Examples');
    console.log('==========================================');
    
    await example1_createAndResolveDID();
    await example2_issueAndVerifyCredential();
    await example3_professionalLicense();
    await example4_ageVerification();
    await example5_employmentVerification();
    await example6_batchOperations();
    await example7_didAuthentication();
    
    console.log('\n✅ All examples completed!');
}

// Run examples if this file is executed directly
if (require.main === module) {
    runAllExamples().catch(console.error);
}

module.exports = {
    example1_createAndResolveDID,
    example2_issueAndVerifyCredential,
    example3_professionalLicense,
    example4_ageVerification,
    example5_employmentVerification,
    example6_batchOperations,
    example7_didAuthentication,
    runAllExamples
};
