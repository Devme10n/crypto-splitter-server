const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

function generateKeyPair() {
    // Generates an object where the keys are stored in properties `privateKey` and `publicKey`
    const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
        modulusLength: 4096,  // the length of your key in bits
        publicKeyEncoding: {
            type: 'pkcs1',   // "pkcs1" (traditional RSA) or "spki" (Simpler format)
            format: 'pem'    // The most common format for public keys
        },
        privateKeyEncoding: {
            type: 'pkcs1',   // "pkcs1" (traditional RSA) or "pkcs8" (Alternative format)
            format: 'pem',   // The most common format for private keys
            cipher: 'aes-256-cbc',   // Optional encryption for the private key
            passphrase: 'passphrase'   // Passphrase for the encryption of the private key
        }
    });

    // Create the public key file
    const publicKeyPath = path.join(__dirname, 'public_key.pem');
    fs.writeFileSync(publicKeyPath, publicKey, { encoding: 'utf8' });
    console.log(`Public key saved to ${publicKeyPath}`);

    // Create the private key file
    const privateKeyPath = path.join(__dirname, 'private_key.pem');
    fs.writeFileSync(privateKeyPath, privateKey, { encoding: 'utf8' });
    console.log(`Private key saved to ${privateKeyPath}`);
}

// Generate the key pair
generateKeyPair();
