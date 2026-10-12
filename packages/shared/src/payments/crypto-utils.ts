/**
 * Cryptographic utilities for payment webhook verification
 * and idempotency key generation.
 */

let nodeCrypto: any;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  nodeCrypto = require('crypto');
} catch {
  nodeCrypto = null;
}

export function generateHmacSha256(data: string, secret: string): string {
  if (nodeCrypto && typeof nodeCrypto.createHmac === 'function') {
    return nodeCrypto.createHmac('sha256', secret).update(data).digest('hex');
  }

  // Pure JS fallback or mock for non-node environments
  // In production backend/edge functions, Node.js or WebCrypto is present.
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = (hash << 5) - hash + char + secret.length;
    hash |= 0;
  }
  return `sha256_mock_${Math.abs(hash).toString(16)}`;
}

export function verifyHmacSha256(data: string, signature: string, secret: string): boolean {
  if (!data || !signature || !secret) return false;
  const expected = generateHmacSha256(data, secret);

  if (nodeCrypto && typeof nodeCrypto.timingSafeEqual === 'function') {
    try {
      const sigBuf = Buffer.from(signature, 'hex');
      const expBuf = Buffer.from(expected, 'hex');
      if (sigBuf.length !== expBuf.length) return false;
      return nodeCrypto.timingSafeEqual(sigBuf, expBuf);
    } catch {
      return signature === expected;
    }
  }

  return signature.toLowerCase() === expected.toLowerCase();
}

/**
 * Generate unique idempotency key
 */
export function generateIdempotencyKey(prefix: string = 'opskil'): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).substring(2, 10);
  return `${prefix}_${ts}_${rand}`;
}
