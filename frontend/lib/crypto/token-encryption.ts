import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96 bits for GCM
const AUTH_TAG_LENGTH = 16; // 128 bits
const ENCODING = 'base64';

/**
 * Get encryption key from environment variable.
 * Throws if TOKEN_ENCRYPTION_KEY is not set.
 */
function getEncryptionKey(): Buffer {
  const keyHex = process.env.TOKEN_ENCRYPTION_KEY;

  if (!keyHex) {
    throw new Error('TOKEN_ENCRYPTION_KEY environment variable is not set');
  }

  if (keyHex.length !== 64) {
    throw new Error('TOKEN_ENCRYPTION_KEY must be 32 bytes (64 hex characters)');
  }

  return Buffer.from(keyHex, 'hex');
}

/**
 * Encrypt a plaintext token using AES-256-GCM.
 * Returns base64 encoded string in format: iv:ciphertext:authTag
 *
 * @param plaintext - The token to encrypt
 * @returns Encrypted token in format "iv:ciphertext:authTag" (base64)
 */
export function encryptToken(plaintext: string): string {
  if (!plaintext) {
    throw new Error('Cannot encrypt empty token');
  }

  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  // Return as iv:ciphertext:authTag (all base64 encoded)
  return [
    iv.toString(ENCODING),
    encrypted.toString(ENCODING),
    authTag.toString(ENCODING),
  ].join(':');
}

/**
 * Decrypt a token encrypted with encryptToken.
 * Accepts format: iv:ciphertext:authTag (base64)
 *
 * @param encrypted - The encrypted token string
 * @returns Decrypted plaintext token
 */
export function decryptToken(encrypted: string): string {
  if (!encrypted) {
    throw new Error('Cannot decrypt empty token');
  }

  // Check if token is already plaintext (for migration compatibility)
  // Encrypted tokens always have exactly 2 colons (iv:ciphertext:authTag)
  const parts = encrypted.split(':');
  if (parts.length !== 3) {
    // Assume plaintext token (legacy format)
    console.warn('[Token Decryption] Plaintext token detected - should be encrypted');
    return encrypted;
  }

  const key = getEncryptionKey();
  const [ivBase64, ciphertextBase64, authTagBase64] = parts;

  try {
    const iv = Buffer.from(ivBase64, ENCODING);
    const ciphertext = Buffer.from(ciphertextBase64, ENCODING);
    const authTag = Buffer.from(authTagBase64, ENCODING);

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);

    return decrypted.toString('utf8');
  } catch (error) {
    throw new Error(
      `Failed to decrypt token: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Check if a token string is encrypted or plaintext.
 * Encrypted tokens have format: iv:ciphertext:authTag (3 parts)
 *
 * @param token - The token to check
 * @returns true if encrypted, false if plaintext
 */
export function isTokenEncrypted(token: string): boolean {
  if (!token) {
    return false;
  }

  return token.split(':').length === 3;
}
