/**
 * OPSKL SAFE DIAGNOSTIC LOGGER
 * Sanitizes and redacts sensitive data (tokens, passwords, PII, service secrets) before logging.
 */

const SENSITIVE_KEYS = new Set([
  'password',
  'token',
  'secret',
  'service_role',
  'authorization',
  'cookie',
  'anon_key',
  'service_role_key',
  'private_key',
  'otp',
  'pin',
  'cvv',
]);

export function redactSensitiveData(obj: any): any {
  if (obj === null || obj === undefined) return obj;

  if (typeof obj === 'string') {
    // Redact JWT-like strings
    if (obj.startsWith('ey') && obj.includes('.')) {
      return '[REDACTED_JWT_TOKEN]';
    }
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => redactSensitiveData(item));
  }

  if (typeof obj === 'object') {
    const sanitized: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      const lowerKey = key.toLowerCase();
      if (SENSITIVE_KEYS.has(lowerKey) || lowerKey.includes('secret') || lowerKey.includes('password')) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = redactSensitiveData(value);
      }
    }
    return sanitized;
  }

  return obj;
}

export const logger = {
  info(message: string, context?: Record<string, any>): void {
    const sanitized = context ? redactSensitiveData(context) : undefined;
    console.log(`[OPSKL INFO] ${message}`, sanitized ? JSON.stringify(sanitized) : '');
  },

  warn(message: string, context?: Record<string, any>): void {
    const sanitized = context ? redactSensitiveData(context) : undefined;
    console.warn(`[OPSKL WARN] ${message}`, sanitized ? JSON.stringify(sanitized) : '');
  },

  error(message: string, error?: Error | unknown, context?: Record<string, any>): void {
    const sanitized = context ? redactSensitiveData(context) : undefined;
    let errMessage = '';
    if (error instanceof Error) {
      errMessage = error.message;
    } else if (typeof error === 'object' && error !== null) {
      const anyErr = error as any;
      errMessage = anyErr.message || anyErr.error_description || anyErr.msg || JSON.stringify(error);
      if (anyErr.details) errMessage += ` (${anyErr.details})`;
      if (anyErr.hint) errMessage += ` [Hint: ${anyErr.hint}]`;
    } else {
      errMessage = String(error || '');
    }
    console.error(`[OPSKL ERROR] ${message} — ${errMessage}`, sanitized ? JSON.stringify(sanitized) : '');
  },

  debug(message: string, context?: Record<string, any>): void {
    if (process.env.NODE_ENV !== 'production') {
      const sanitized = context ? redactSensitiveData(context) : undefined;
      console.debug(`[OPSKL DEBUG] ${message}`, sanitized ? JSON.stringify(sanitized) : '');
    }
  },
};
