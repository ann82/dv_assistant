import logger from './logger.js';

/**
 * Transcription Validation System
 * Detects and handles speech recognition errors to improve location extraction
 */

// Common speech recognition error patterns
const TRANSCRIPTION_ERRORS = {
  // Location-related errors
  locationErrors: [
    { pattern: /\bI\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s+\d+)\b/g, fix: 'I\'m at $1' },
    { pattern: /\bI\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b/g, fix: 'I\'m at $1' },
    { pattern: /\bI\s+(?!am\s+at\s+)([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s+(?:Station|Street|Avenue|Road|Drive|Lane|Place|Boulevard|Highway|Freeway|Interstate|Center|Plaza|Mall|Building|Complex|District|Neighborhood|Park|Area|Region|County|City|Town|State|Province|Country))\b/gi, fix: 'I\'m at $1' },
    { pattern: /\bI\s+([A-Z][a-z]*\s+\d+)\b/g, fix: 'I\'m at $1' },
    // FIXED: More specific pattern to avoid matching "I live in [location]"
    { pattern: /\bI\s+(?!live\s+in\s+)(?!am\s+)([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s+(?:near|around|close\s+to|in|at))\b/gi, fix: 'I\'m $1' },
  ],
  
  // Common speech recognition errors
  generalErrors: [
    { pattern: /\bI\s+need\s+help\s+find\b/gi, fix: 'I need help finding' },
    { pattern: /\bI\s+want\s+to\s+find\b/gi, fix: 'I want to find' },
    { pattern: /\bI\s+am\s+looking\s+for\b/gi, fix: 'I am looking for' },
    { pattern: /\bI\s+am\s+searching\s+for\b/gi, fix: 'I am searching for' },
    { pattern: /\bI\s+am\s+at\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b/g, fix: 'I\'m at $1' },
    { pattern: /\bI\s+am\s+near\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b/g, fix: 'I\'m near $1' },
  ]
};

// Confidence thresholds for validation
const CONFIDENCE_THRESHOLDS = {
  HIGH: 0.8,
  MEDIUM: 0.6,
  LOW: 0.4,
  VERY_LOW: 0.2
};

/**
 * Validate and correct transcription errors
 * @param {string} transcription - The raw transcription from speech recognition
 * @param {number} confidence - The confidence score from Twilio (0-1)
 * @param {string} callSid - Call SID for logging
 * @returns {Object} Validation result with corrected text and metadata
 */
export function validateTranscription(transcription, confidence = null, callSid = null) {
  if (!transcription || typeof transcription !== 'string') {
    return {
      original: transcription,
      corrected: transcription,
      confidence: confidence,
      confidenceLevel: getConfidenceLevel(confidence),
      hasErrors: false,
      corrections: [],
      isValid: false
    };
  }

  const original = transcription.trim();
  let corrected = original;
  const corrections = [];
  let hasErrors = false;

  // Log validation start
  logger.info('🔍 TRANSCRIPTION VALIDATION - Starting validation', {
    callSid,
    original,
    confidence,
    confidenceLevel: getConfidenceLevel(confidence),
    timestamp: new Date().toISOString()
  });

  // Apply location-specific error corrections
  for (const error of TRANSCRIPTION_ERRORS.locationErrors) {
    const matches = corrected.match(error.pattern);
    if (matches) {
      const before = corrected;
      corrected = corrected.replace(error.pattern, error.fix);
      if (before !== corrected) {
        corrections.push({
          type: 'location_error',
          pattern: error.pattern.toString(),
          fix: error.fix,
          before: before,
          after: corrected
        });
        hasErrors = true;
        logger.info('🔍 TRANSCRIPTION VALIDATION - Location error corrected', {
          callSid,
          pattern: error.pattern.toString(),
          fix: error.fix,
          before: before,
          after: corrected,
          timestamp: new Date().toISOString()
        });
      }
    }
  }

  // Apply general error corrections
  for (const error of TRANSCRIPTION_ERRORS.generalErrors) {
    const matches = corrected.match(error.pattern);
    if (matches) {
      const before = corrected;
      corrected = corrected.replace(error.pattern, error.fix);
      if (before !== corrected) {
        corrections.push({
          type: 'general_error',
          pattern: error.pattern.toString(),
          fix: error.fix,
          before: before,
          after: corrected
        });
        hasErrors = true;
        logger.info('🔍 TRANSCRIPTION VALIDATION - General error corrected', {
          callSid,
          pattern: error.pattern.toString(),
          fix: error.fix,
          before: before,
          after: corrected,
          timestamp: new Date().toISOString()
        });
      }
    }
  }

  // Additional validation based on confidence score
  let confidenceIssues = [];
  if (confidence !== null) {
    if (confidence < CONFIDENCE_THRESHOLDS.VERY_LOW) {
      confidenceIssues.push('very_low_confidence');
    } else if (confidence < CONFIDENCE_THRESHOLDS.LOW) {
      confidenceIssues.push('low_confidence');
    }
  }

  // Check for suspicious patterns that might indicate transcription errors
  const suspiciousPatterns = [
    /\bI\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s+\d+\b/g, // "I Station 2" pattern
    /\bI\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s+(?:Station|Street|Avenue|Road|Drive|Lane|Place|Boulevard|Highway|Freeway|Interstate|Center|Plaza|Mall|Building|Complex|District|Neighborhood|Park|Area|Region|County|City|Town|State|Province|Country)\b/gi,
    /\bI\s+[A-Z][a-z]*\s+\d+\b/g // "I Building 5" pattern
  ];

  const suspiciousMatches = suspiciousPatterns.some(pattern => pattern.test(corrected));
  if (suspiciousMatches && !hasErrors) {
    confidenceIssues.push('suspicious_location_pattern');
    logger.warn('🔍 TRANSCRIPTION VALIDATION - Suspicious location pattern detected', {
      callSid,
      transcription: corrected,
      confidence,
      timestamp: new Date().toISOString()
    });
  }

  const result = {
    original: original,
    corrected: corrected,
    confidence: confidence,
    confidenceLevel: getConfidenceLevel(confidence),
    hasErrors: hasErrors,
    corrections: corrections,
    confidenceIssues: confidenceIssues,
    isValid: confidence === null || confidence >= CONFIDENCE_THRESHOLDS.LOW,
    shouldReprompt: confidence !== null && confidence < CONFIDENCE_THRESHOLDS.VERY_LOW
  };

  // Log validation result
  logger.info('🔍 TRANSCRIPTION VALIDATION - Validation complete', {
    callSid,
    original: original,
    corrected: corrected,
    confidence: confidence,
    confidenceLevel: getConfidenceLevel(confidence),
    hasErrors: hasErrors,
    correctionCount: corrections.length,
    confidenceIssues: confidenceIssues,
    isValid: result.isValid,
    shouldReprompt: result.shouldReprompt,
    timestamp: new Date().toISOString()
  });

  return result;
}

/**
 * Get confidence level from confidence score
 * @param {number} confidence - Confidence score (0-1)
 * @returns {string} Confidence level
 */
function getConfidenceLevel(confidence) {
  if (confidence === null || confidence === undefined) {
    return 'unknown';
  }
  
  if (confidence >= CONFIDENCE_THRESHOLDS.HIGH) {
    return 'high';
  } else if (confidence >= CONFIDENCE_THRESHOLDS.MEDIUM) {
    return 'medium';
  } else if (confidence >= CONFIDENCE_THRESHOLDS.LOW) {
    return 'low';
  } else {
    return 'very_low';
  }
}

/**
 * Generate reprompt message for low confidence transcriptions
 * @param {string} originalTranscription - The original transcription
 * @param {number} confidence - The confidence score
 * @returns {string} Reprompt message
 */
export function generateRepromptMessage(originalTranscription, confidence) {
  const confidenceLevel = getConfidenceLevel(confidence);
  
  if (confidenceLevel === 'very_low') {
    return "I'm having trouble understanding. Could you please repeat that more clearly?";
  } else if (confidenceLevel === 'low') {
    return "I think you said something about a location. Could you please repeat the location name more clearly?";
  } else {
    return "Could you please repeat that? I want to make sure I understand correctly.";
  }
}

/**
 * Check if transcription contains location information
 * @param {string} transcription - The transcription to check
 * @returns {boolean} True if contains location information
 */
export function containsLocationInfo(transcription) {
  if (!transcription) return false;
  
  const locationPatterns = [
    /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s+(?:Station|Street|Avenue|Road|Drive|Lane|Place|Boulevard|Highway|Freeway|Interstate|Center|Plaza|Mall|Building|Complex|District|Neighborhood|Park|Area|Region|County|City|Town|State|Province|Country)\b/gi,
    /\b[A-Z][a-z]*\s+\d+\b/g,
    /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g
  ];
  
  return locationPatterns.some(pattern => pattern.test(transcription));
}

/**
 * Extract potential location from transcription
 * @param {string} transcription - The transcription to analyze
 * @returns {string|null} Extracted location or null
 */
export function extractPotentialLocation(transcription) {
  if (!transcription) return null;
  
  // Look for location patterns
  const locationPatterns = [
    /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s+(?:Station|Street|Avenue|Road|Drive|Lane|Place|Boulevard|Highway|Freeway|Interstate|Center|Plaza|Mall|Building|Complex|District|Neighborhood|Park|Area|Region|County|City|Town|State|Province|Country)\b/gi,
    /\b[A-Z][a-z]*\s+\d+\b/g,
    /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g
  ];
  
  for (const pattern of locationPatterns) {
    const match = transcription.match(pattern);
    if (match && match[0]) {
      return match[0].trim();
    }
  }
  
  return null;
} 