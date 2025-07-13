/**
 * Sensitive Data Redaction Utility
 * Provides comprehensive redaction of sensitive information from logs
 */

/**
 * Patterns for sensitive data that should be redacted
 */
export const SENSITIVE_PATTERNS = {
  // API Keys and Tokens (match only the value)
  OPENAI_API_KEY: /(sk-[a-zA-Z0-9]{48})/g,
  TWILIO_ACCOUNT_SID: /(AC[a-zA-Z0-9]{32})/g,
  TWILIO_AUTH_TOKEN: /([a-zA-Z0-9]{32})/g,
  TAVILY_API_KEY: /([a-zA-Z0-9]{32,})/g,
  // Generic key-value patterns
  PASSWORDS: /(password|passwd|pwd)["'\s]*[:=]["'\s]*([^\s,}]+)/gi,
  TOKENS: /(token|access_token|refresh_token)["'\s]*[:=]["'\s]*([^\s,}]+)/gi,
  API_KEYS: /(api[_-]?key|apikey)["'\s]*[:=]["'\s]*([^\s,}]+)/gi,
  SECRETS: /(secret|private_key)["'\s]*[:=]["'\s]*([^\s,}]+)/gi,
  // JWT tokens (match only the value)
  JWT_TOKENS: /(eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+)/g,
  CREDIT_CARDS: /(\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b)/g,
  SSN: /(\b\d{3}-\d{2}-\d{4}\b)/g,
  IP_ADDRESSES: /(\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b)/g,
  EMAIL_ADDRESSES: /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g,
  PHONE_NUMBERS: /(\+?1?[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})/g,
  DB_CONNECTION_STRINGS: /((mongodb|postgresql|mysql|redis):\/\/[^@]+@[\S,}]+)/g,
  AUTH_HEADERS: /((Bearer|Basic)\s+[a-zA-Z0-9._-]+)/gi
};

export const REDACTION_CONFIG = {
  enabled: {
    openai_api_key: true,
    twilio_account_sid: true,
    twilio_auth_token: true,
    tavily_api_key: true,
    passwords: true,
    tokens: true,
    apiKeys: true,
    secrets: true,
    jwtTokens: true,
    creditCards: true,
    ssn: true,
    ipAddresses: false,
    emailAddresses: false,
    phoneNumbers: true,
    dbConnectionStrings: true,
    authHeaders: true
  },
  replacementText: '[REDACTED]',
  partialRedaction: {
    phoneNumbers: {
      enabled: true,
      pattern: /(\+?1?[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})/g,
      replacement: (match, p1, area, mid, last) => {
        return (area ? area : '') + '-***-' + last;
      }
    },
    emailAddresses: {
      enabled: false,
      pattern: /([a-zA-Z0-9._%+-]+)@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g,
      replacement: (match, username, domain) => {
        const maskedUsername = username.length > 2 
          ? username[0] + '*'.repeat(username.length - 2) + username[username.length - 1]
          : username;
        return `${maskedUsername}@${domain}`;
      }
    }
  }
};

function redactKeyValueString(text, keyPattern, replacement) {
  return text.replace(new RegExp(`(${keyPattern})["'\s]*[:=]["'\s]*([^\s,}]+)`, 'gi'), (m, k, v) => `${k}: ${replacement}`);
}

function normalizeConfigKey(key) {
  // Convert e.g. PASSWORDS -> passwords, OPENAI_API_KEY -> openaiApiKey, IP_ADDRESSES -> ipAddresses
  return key.toLowerCase().replace(/_([a-z])/g, (_, c) => c.toUpperCase()).replace(/^([a-z])/, (m) => m.toLowerCase());
}

export function redactString(text, config = REDACTION_CONFIG) {
  if (typeof text !== 'string') return text;
  let redacted = text;
  // Redact Authorization header values (Bearer/Basic)
  if (config.enabled.authHeaders !== false) {
    redacted = redacted.replace(/(Bearer|Basic)\s+[a-zA-Z0-9._-]+/gi, config.replacementText);
  }
  // Redact key-value pairs for password, token, apiKey, secret
  redacted = redactKeyValueString(redacted, 'password|passwd|pwd', config.replacementText);
  redacted = redactKeyValueString(redacted, 'token|access_token|refresh_token', config.replacementText);
  redacted = redactKeyValueString(redacted, 'api[_-]?key|apikey', config.replacementText);
  redacted = redactKeyValueString(redacted, 'secret|private_key', config.replacementText);
  // Redact specific patterns (values only)
  Object.entries(SENSITIVE_PATTERNS).forEach(([key, pattern]) => {
    const configKey = normalizeConfigKey(key);
    if (key === 'EMAIL_ADDRESSES' && !config.enabled.emailAddresses) {
      return; // skip email redaction if not enabled
    }
    if (config.enabled[configKey] !== false) {
      if (key === 'PHONE_NUMBERS' && config.partialRedaction.phoneNumbers.enabled) {
        redacted = redacted.replace(pattern, config.partialRedaction.phoneNumbers.replacement);
      } else if (key === 'EMAIL_ADDRESSES' && config.partialRedaction.emailAddresses.enabled) {
        redacted = redacted.replace(pattern, config.partialRedaction.emailAddresses.replacement);
      } else if (key === 'AUTH_HEADERS') {
        // Already handled above
      } else if (key === 'PASSWORDS' || key === 'TOKENS' || key === 'API_KEYS' || key === 'SECRETS') {
        // Redact value-only for these patterns
        redacted = redacted.replace(pattern, (m, k, v) => `${k}: ${config.replacementText}`);
      } else {
        redacted = redacted.replace(pattern, config.replacementText);
      }
    }
  });
  return redacted;
}

export function redactObject(data, config = REDACTION_CONFIG, seen = new Set()) {
  if (data && typeof data === 'object') {
    if (seen.has(data)) return '[CIRCULAR_REFERENCE]';
    seen.add(data);
  }
  if (typeof data === 'string') return redactString(data, config);
  if (Array.isArray(data)) return data.map(item => redactObject(item, config, seen));
  if (data && typeof data === 'object') {
    const redacted = {};
    for (const [key, value] of Object.entries(data)) {
      // Check if key itself is sensitive
      const isSensitiveKey = ['password', 'passwd', 'pwd', 'token', 'access_token', 'refresh_token', 
                              'api_key', 'apikey', 'secret', 'private_key', 'authorization', 'auth', 'key'].some(sensitiveKey => 
        key.toLowerCase().includes(sensitiveKey.toLowerCase())
      );
      // Special case: email key
      if (key.toLowerCase().includes('email') && !config.enabled.emailAddresses) {
        redacted[key] = value;
      } else if (isSensitiveKey) {
        redacted[key] = config.replacementText;
      } else {
        redacted[key] = redactObject(value, config, seen);
      }
    }
    return redacted;
  }
  return data;
}

/**
 * Redact sensitive data from request objects
 * @param {Object} req - Express request object
 * @param {Object} config - Redaction configuration
 * @returns {Object} Redacted request object
 */
export function redactRequest(req, config = REDACTION_CONFIG) {
  if (!req) return req;
  
  return {
    method: req.method,
    url: redactString(req.originalUrl || req.url, config),
    path: req.path,
    headers: redactObject(req.headers, config),
    body: redactObject(req.body, config),
    query: redactObject(req.query, config),
    params: redactObject(req.params, config),
    ip: config.enabled.ipAddresses ? '[REDACTED]' : req.ip,
    userAgent: req.get ? req.get('User-Agent') : req.headers['user-agent']
  };
}

/**
 * Redact sensitive data from response objects
 * @param {Object} res - Express response object
 * @param {Object} config - Redaction configuration
 * @returns {Object} Redacted response object
 */
export function redactResponse(res, config = REDACTION_CONFIG) {
  if (!res) return res;
  
  return {
    statusCode: res.statusCode,
    headers: redactObject(res.getHeaders ? res.getHeaders() : {}, config),
    // Note: response body is typically not logged for security reasons
  };
}

/**
 * Redact sensitive data from error objects
 * @param {Error} error - Error object
 * @param {Object} config - Redaction configuration
 * @returns {Object} Redacted error object
 */
export function redactError(error, config = REDACTION_CONFIG) {
  if (!error) return error;
  
  return {
    name: error.name,
    message: redactString(error.message, config),
    stack: redactString(error.stack, config),
    code: error.code,
    statusCode: error.statusCode
  };
}

/**
 * Create a redaction function with custom configuration
 * @param {Object} customConfig - Custom redaction configuration
 * @returns {Function} Redaction function
 */
export function createRedactionFunction(customConfig = {}) {
  const config = { ...REDACTION_CONFIG, ...customConfig };
  
  return function redact(data) {
    return redactObject(data, config);
  };
}

/**
 * Redact sensitive data from log data
 * @param {Object} logData - Log data to redact
 * @param {Object} config - Redaction configuration
 * @returns {Object} Redacted log data
 */
export function redactLogData(logData, config = REDACTION_CONFIG) {
  return redactObject(logData, config);
}

/**
 * Check if a string contains sensitive data
 * @param {string} text - Text to check
 * @param {Object} config - Redaction configuration
 * @returns {boolean} True if sensitive data is detected
 */
export function containsSensitiveData(text, config = REDACTION_CONFIG) {
  if (typeof text !== 'string') {
    return false;
  }
  return Object.entries(SENSITIVE_PATTERNS).some(([key, pattern]) => {
    const configKey = normalizeConfigKey(key);
    if (key === 'EMAIL_ADDRESSES' && !config.enabled.emailAddresses) {
      return false;
    }
    // Only check patterns that are enabled in config
    if (config.enabled[configKey] !== false) {
      return pattern.test(text);
    }
    return false;
  });
}

/**
 * Get a summary of redacted data for audit purposes
 * @param {any} originalData - Original data
 * @param {any} redactedData - Redacted data
 * @returns {Object} Summary of redactions
 */
export function getRedactionSummary(originalData, redactedData, config = REDACTION_CONFIG) {
  const summary = {
    redactions: 0,
    types: new Set(),
    fields: []
  };
  function compareData(original, redacted, path = '', keyName = '') {
    if (typeof original !== typeof redacted) {
      summary.redactions++;
      summary.fields.push(path);
      return;
    }
    if (typeof original === 'string' && original !== redacted) {
      summary.redactions++;
      summary.fields.push(path);
      // Detect redaction type
      Object.entries(SENSITIVE_PATTERNS).forEach(([key, pattern]) => {
        const configKey = normalizeConfigKey(key);
        if (key === 'EMAIL_ADDRESSES' && !config.enabled.emailAddresses) {
          return;
        }
        if (config.enabled[configKey] !== false && pattern.test(original)) {
          summary.types.add(key);
        }
      });
      // Also check for password-like key names
      if (['password', 'passwd', 'pwd'].some(pwKey => keyName && keyName.toLowerCase().includes(pwKey))) {
        summary.types.add('PASSWORDS');
      }
    } else if (Array.isArray(original)) {
      original.forEach((item, index) => {
        compareData(item, redacted[index], `${path}[${index}]`);
      });
    } else if (original && typeof original === 'object') {
      Object.keys(original).forEach(key => {
        compareData(original[key], redacted[key], path ? `${path}.${key}` : key, key);
      });
    }
  }
  compareData(originalData, redactedData);
  return {
    redactions: summary.redactions,
    types: Array.from(summary.types),
    fields: summary.fields
  };
} 