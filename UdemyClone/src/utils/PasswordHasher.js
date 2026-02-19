import crypto from 'crypto';

const SALT_LENGTH = 16;
const ITERATIONS = 100_000;
const KEY_LENGTH = 64;
const DIGEST = 'sha512';

/**
 * Securely hashes passwords using PBKDF2 with a random salt.
 */
export function hashPassword(plainText) {
  const salt = crypto.randomBytes(SALT_LENGTH).toString('hex');
  const hash = crypto.pbkdf2Sync(plainText, salt, ITERATIONS, KEY_LENGTH, DIGEST).toString('hex');
  return `${salt}:${hash}`;
}

/**
 * Verifies a plain-text password against a stored hash.
 */
export function verifyPassword(plainText, stored) {
  const [salt, originalHash] = stored.split(':');
  const hash = crypto.pbkdf2Sync(plainText, salt, ITERATIONS, KEY_LENGTH, DIGEST).toString('hex');
  return hash === originalHash;
}
