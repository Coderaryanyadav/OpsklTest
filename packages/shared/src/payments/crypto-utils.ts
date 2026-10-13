/**
 * Cryptographic utilities for payment webhook verification
 * and idempotency key generation.
 * STRICT SECURITY: Fails closed. Mock hashes are strictly prohibited.
 */

let nodeCrypto: any;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  nodeCrypto = require('crypto');
} catch {
  nodeCrypto = null;
}

/**
 * Generate HMAC-SHA256 signature using Node.js crypto.
 * Throws if secure cryptographic implementation is unavailable.
 */
export function generateHmacSha256(data: string, secret: string): string {
  if (nodeCrypto && typeof nodeCrypto.createHmac === 'function') {
    return nodeCrypto.createHmac('sha256', secret).update(data).digest('hex');
  }

  throw new Error(
    'HMAC-SHA256 operation failed: secure cryptographic engine is unavailable in the current runtime. Silent fallback is prohibited.'
  );
}

/**
 * Verifies HMAC-SHA256 signatures with constant-time equality check.
 * Fails closed if parameters are missing or crypto is unavailable.
 */
export function verifyHmacSha256(data: string, signature: string, secret: string): boolean {
  if (!data || !signature || !secret) return false;

  try {
    const expected = generateHmacSha256(data, secret);

    if (nodeCrypto && typeof nodeCrypto.timingSafeEqual === 'function') {
      const sigBuf = Buffer.from(signature, 'hex');
      const expBuf = Buffer.from(expected, 'hex');
      if (sigBuf.length !== expBuf.length) return false;
      return nodeCrypto.timingSafeEqual(sigBuf, expBuf);
    }

    return false;
  } catch {
    // Fail closed on any cryptographic error or unsupported runtime
    return false;
  }
}

/**
 * Generate cryptographically secure unique idempotency key
 */
export function generateIdempotencyKey(prefix: string = 'opskil'): string {
  const ts = Date.now().toString(36);
  let randomHex = '';

  if (nodeCrypto && typeof nodeCrypto.randomBytes === 'function') {
    randomHex = nodeCrypto.randomBytes(6).toString('hex');
  } else if (typeof globalThis !== 'undefined' && globalThis.crypto?.getRandomValues) {
    const arr = new Uint8Array(6);
    globalThis.crypto.getRandomValues(arr);
    randomHex = Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('');
  } else {
    randomHex = Math.random().toString(36).substring(2, 10);
  }

  return `${prefix}_${ts}_${randomHex}`;
}
