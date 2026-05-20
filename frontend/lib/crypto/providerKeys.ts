import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const SECRET_RAW = process.env.PROVIDER_KEY_SECRET;

if (!SECRET_RAW || SECRET_RAW.length < 32) {
  throw new Error('PROVIDER_KEY_SECRET must be 32+ characters');
}

// Type-safe validated secret
const SECRET: string = SECRET_RAW;

/**
 * Encrypts an API key using AES-256-CBC
 * Returns format: iv:encrypted
 */
export function encryptKey(plaintext: string): string {
  const iv = randomBytes(16);
  const cipher = createCipheriv('aes-256-cbc', Buffer.from(SECRET.slice(0, 32)), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

/**
 * Decrypts an API key encrypted with encryptKey
 */
export function decryptKey(ciphertext: string): string {
  const [ivHex, encHex] = ciphertext.split(':');
  const decipher = createDecipheriv(
    'aes-256-cbc',
    Buffer.from(SECRET.slice(0, 32)),
    Buffer.from(ivHex, 'hex')
  );
  return Buffer.concat([
    decipher.update(Buffer.from(encHex, 'hex')),
    decipher.final(),
  ]).toString('utf8');
}

/**
 * Returns the last 4 characters of an API key for display
 */
export function keyHint(plaintext: string): string {
  return plaintext.slice(-4);
}
