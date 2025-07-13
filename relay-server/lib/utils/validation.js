/**
 * Validation Utilities
 * Common validation functions used throughout the application
 */

/**
 * Validate email address format
 * @param {string} email - Email to validate
 * @returns {boolean} Whether email is valid
 */
export function isValidEmail(email) {
  if (!email || typeof email !== 'string') {
    return false;
  }
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate phone number format (basic validation)
 * @param {string} phone - Phone number to validate
 * @returns {boolean} Whether phone number is valid
 */
export function isValidPhone(phone) {
  if (!phone || typeof phone !== 'string') {
    return false;
  }
  
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '');
  
  // Check if it's a valid length (7-15 digits)
  return digits.length >= 7 && digits.length <= 15;
}

/**
 * Validate URL format
 * @param {string} url - URL to validate
 * @returns {boolean} Whether URL is valid
 */
export function isValidUrl(url) {
  if (!url || typeof url !== 'string') {
    return false;
  }
  
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate that a value is not empty
 * @param {any} value - Value to validate
 * @returns {boolean} Whether value is not empty
 */
export function isNotEmpty(value) {
  if (value === null || value === undefined) {
    return false;
  }
  
  if (typeof value === 'string') {
    return value.trim().length > 0;
  }
  
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  
  if (typeof value === 'object') {
    return Object.keys(value).length > 0;
  }
  
  return true;
}

/**
 * Validate that a value is a positive number
 * @param {any} value - Value to validate
 * @returns {boolean} Whether value is a positive number
 */
export function isPositiveNumber(value) {
  const num = Number(value);
  return !isNaN(num) && num > 0;
}

/**
 * Validate that a value is within a range
 * @param {any} value - Value to validate
 * @param {number} min - Minimum value (inclusive)
 * @param {number} max - Maximum value (inclusive)
 * @returns {boolean} Whether value is within range
 */
export function isInRange(value, min, max) {
  const num = Number(value);
  return !isNaN(num) && num >= min && num <= max;
}

/**
 * Validate that a value is one of the allowed values
 * @param {any} value - Value to validate
 * @param {Array} allowedValues - Array of allowed values
 * @returns {boolean} Whether value is allowed
 */
export function isAllowedValue(value, allowedValues) {
  if (!Array.isArray(allowedValues)) {
    return false;
  }
  
  return allowedValues.includes(value);
}

/**
 * Validate object has required properties
 * @param {Object} obj - Object to validate
 * @param {Array} requiredProps - Array of required property names
 * @returns {Object} Validation result with isValid and missingProps
 */
export function hasRequiredProperties(obj, requiredProps) {
  if (!obj || typeof obj !== 'object') {
    return {
      isValid: false,
      missingProps: requiredProps
    };
  }
  
  const missingProps = requiredProps.filter(prop => !(prop in obj));
  
  return {
    isValid: missingProps.length === 0,
    missingProps
  };
}

/**
 * Validate object properties match expected types
 * @param {Object} obj - Object to validate
 * @param {Object} schema - Schema object with property names as keys and types as values
 * @returns {Object} Validation result with isValid and errors
 */
export function validateObjectTypes(obj, schema) {
  if (!obj || typeof obj !== 'object') {
    return {
      isValid: false,
      errors: ['Object is required']
    };
  }
  
  const errors = [];
  
  for (const [prop, expectedType] of Object.entries(schema)) {
    if (prop in obj) {
      const value = obj[prop];
      const actualType = Array.isArray(value) ? 'array' : typeof value;
      
      if (actualType !== expectedType) {
        errors.push(`Property '${prop}' should be ${expectedType}, got ${actualType}`);
      }
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Sanitize string input (remove dangerous characters)
 * @param {string} input - Input string to sanitize
 * @returns {string} Sanitized string
 */
export function sanitizeString(input) {
  if (!input || typeof input !== 'string') {
    return '';
  }
  
  return input
    .trim()
    .replace(/[<>]/g, '') // Remove angle brackets
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, '') // Remove event handlers
    .substring(0, 1000); // Limit length
}

/**
 * Validate and sanitize user input
 * @param {Object} input - Input object to validate and sanitize
 * @param {Object} rules - Validation rules object
 * @returns {Object} Validation result with isValid, sanitized data, and errors
 */
export function validateAndSanitizeInput(input, rules) {
  const errors = [];
  const sanitized = {};
  
  for (const [field, rule] of Object.entries(rules)) {
    const value = input[field];
    
    // Check if field is required
    if (rule.required && !isNotEmpty(value)) {
      errors.push(`Field '${field}' is required`);
      continue;
    }
    
    // Skip validation if field is empty and not required
    if (!isNotEmpty(value)) {
      continue;
    }
    
    // Type validation
    if (rule.type && typeof value !== rule.type) {
      errors.push(`Field '${field}' should be ${rule.type}`);
      continue;
    }
    
    // Custom validation
    if (rule.validate) {
      const validationResult = rule.validate(value);
      if (!validationResult.isValid) {
        errors.push(`Field '${field}': ${validationResult.error}`);
        continue;
      }
    }
    
    // Sanitization
    if (rule.sanitize) {
      sanitized[field] = rule.sanitize(value);
    } else if (typeof value === 'string') {
      sanitized[field] = sanitizeString(value);
    } else {
      sanitized[field] = value;
    }
  }
  
  return {
    isValid: errors.length === 0,
    sanitized,
    errors
  };
}

/**
 * Create a validation rule object
 * @param {Object} options - Validation options
 * @returns {Object} Validation rule object
 */
export function createValidationRule(options = {}) {
  return {
    required: options.required || false,
    type: options.type || 'string',
    validate: options.validate || null,
    sanitize: options.sanitize || null,
    ...options
  };
} 