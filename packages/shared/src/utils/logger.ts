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
  'code',
  'lat',
  'lng',
  'latitude',
  'longitude',
  'email',
  'phone',
  'upi',
  'upi_id',
  'upiid',
  'aadhaar',
  'pan',
  'gstin',
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

function sanitizeErrorMessage(msg: string): string {
  if (!msg) return msg;
  // Redact connection strings with embedded passwords: postgresql://user:pass@host
  let out = msg.replace(/(postgres(?:ql)?:\/\/[^:]+:)([^@]+)(@)/gi, '$1[REDACTED_PASSWORD]$3');
  // Redact raw JWT tokens
  out = out.replace(/ey[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g, '[REDACTED_JWT_TOKEN]');
  return out;
}

export const logger = {
  info(message: string, context?: Record<string, any>): void {
    const sanitized = context ? redactSensitiveData(context) : undefined;
    console.log(`[OPSKL INFO] ${message}`, sanitized ? JSON.stringify(sanitized) : '');
  },

  warn(message: string, errorOrContext?: any, context?: Record<string, any>): void {
    let sanitizedContext: any = undefined;
    let extra = '';
    if (context) {
      sanitizedContext = redactSensitiveData(context);
      extra = errorOrContext instanceof Error ? ` — ${sanitizeErrorMessage(errorOrContext.message)}` : ` — ${sanitizeErrorMessage(String(errorOrContext))}`;
    } else if (errorOrContext) {
      if (errorOrContext instanceof Error) {
        extra = ` — ${sanitizeErrorMessage(errorOrContext.message)}`;
      } else if (typeof errorOrContext === 'object') {
        sanitizedContext = redactSensitiveData(errorOrContext);
      } else {
        extra = ` — ${sanitizeErrorMessage(String(errorOrContext))}`;
      }
    }
    console.warn(`[OPSKL WARN] ${message}${extra}`, sanitizedContext ? JSON.stringify(sanitizedContext) : '');
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
    const safeErrMessage = sanitizeErrorMessage(errMessage);
    console.error(`[OPSKL ERROR] ${message} — ${safeErrMessage}`, sanitized ? JSON.stringify(sanitized) : '');
  },

  debug(message: string, context?: Record<string, any>): void {
    if (process.env.NODE_ENV !== 'production') {
      const sanitized = context ? redactSensitiveData(context) : undefined;
      console.debug(`[OPSKL DEBUG] ${message}`, sanitized ? JSON.stringify(sanitized) : '');
    }
  },
};
