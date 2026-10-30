const crypto = require('crypto');

/**
 * Verify an ECDSA P-256 signature against record data.
 *
 * The Flutter app signs with SHA256withECDSA and encodes the signature
 * as base64. The public key is stored as base64 DER (SubjectPublicKeyInfo).
 *
 * @param {object} recordData - The JSON record fields to verify (sorted keys).
 * @param {string} signatureBase64 - Base64-encoded DER signature.
 * @param {string} publicKeyBase64 - Base64-encoded DER public key.
 * @returns {boolean} Whether the signature is valid.
 */
function verifySignature(recordData, signatureBase64, publicKeyBase64) {
  try {
    // Reconstruct the exact bytes that were signed:
    // sorted JSON keys, then SHA-256 of that string, then ECDSA sign.
    // But Node's verify does the hashing for us when we specify 'sha256'.
    const sortedKeys = Object.keys(recordData).sort();
    const canonicalObj = {};
    for (const key of sortedKeys) {
      canonicalObj[key] = recordData[key];
    }
    const dataString = JSON.stringify(canonicalObj);

    const publicKeyDer = Buffer.from(publicKeyBase64, 'base64');
    const publicKey = crypto.createPublicKey({
      key: publicKeyDer,
      format: 'der',
      type: 'spki',
    });

    const signature = Buffer.from(signatureBase64, 'base64');

    const verifier = crypto.createVerify('SHA256');
    verifier.update(dataString);
    return verifier.verify(publicKey, signature);
  } catch (err) {
    console.error('Signature verification error:', err.message);
    return false;
  }
}

module.exports = { verifySignature };
