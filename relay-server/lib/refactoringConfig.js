/**
 * Refactoring Configuration
 * 
 * This file manages the refactoring approach and allows easy switching between
 * different response handlers during the migration process.
 */

// Available response handler approaches
export const RESPONSE_HANDLERS = {
  LEGACY: 'legacy',           // Current complex system (intentClassifier + response.js)
  SIMPLIFIED: 'simplified',   // AI-first approach (SimplifiedResponseHandler)
  HYBRID: 'hybrid'           // AI-first with Tavily fallback (HybridResponseHandler)
};

// Current active approach
// Change this to switch between approaches during testing/migration
export const ACTIVE_HANDLER = RESPONSE_HANDLERS.HYBRID;

// Feature flags for gradual migration
export const FEATURE_FLAGS = {
  // Enable simplified intent classification (remove complex logic)
  SIMPLIFIED_INTENT_CLASSIFICATION: true,
  
  // Enable simplified query rewriting (basic cleaning only)
  SIMPLIFIED_QUERY_REWRITING: true,
  
  // Enable simplified response routing (AI-first)
  SIMPLIFIED_RESPONSE_ROUTING: true,
  
  // Enable conversation context simplification
  SIMPLIFIED_CONVERSATION_CONTEXT: true,
  
  // Enable emergency query detection in simplified handlers
  EMERGENCY_DETECTION: true,
  
  // Enable caching in simplified handlers
  CACHING_ENABLED: true,
  
  // Enable fallback mechanisms
  FALLBACK_ENABLED: true
};

// Migration phases configuration
export const MIGRATION_PHASES = {
  PHASE_1: {
    name: 'Proof of Concept',
    description: 'Test AI-only approach with current detailed instructions',
    duration: '1 week',
    handlers: [RESPONSE_HANDLERS.SIMPLIFIED],
    features: {
      SIMPLIFIED_INTENT_CLASSIFICATION: false,
      SIMPLIFIED_QUERY_REWRITING: false,
      SIMPLIFIED_RESPONSE_ROUTING: true,
      SIMPLIFIED_CONVERSATION_CONTEXT: false,
      EMERGENCY_DETECTION: true,
      CACHING_ENABLED: true,
      FALLBACK_ENABLED: true
    }
  },
  
  PHASE_2: {
    name: 'Gradual Migration',
    description: 'Start with non-critical paths, keep Tavily for shelter searches',
    duration: '2-3 weeks',
    handlers: [RESPONSE_HANDLERS.HYBRID],
    features: {
      SIMPLIFIED_INTENT_CLASSIFICATION: false,
      SIMPLIFIED_QUERY_REWRITING: true,
      SIMPLIFIED_RESPONSE_ROUTING: true,
      SIMPLIFIED_CONVERSATION_CONTEXT: true,
      EMERGENCY_DETECTION: true,
      CACHING_ENABLED: true,
      FALLBACK_ENABLED: true
    }
  },
  
  PHASE_3: {
    name: 'Full Simplification',
    description: 'Remove intent classification complexity, simplify everything',
    duration: '1 week',
    handlers: [RESPONSE_HANDLERS.SIMPLIFIED, RESPONSE_HANDLERS.HYBRID],
    features: {
      SIMPLIFIED_INTENT_CLASSIFICATION: true,
      SIMPLIFIED_QUERY_REWRITING: true,
      SIMPLIFIED_RESPONSE_ROUTING: true,
      SIMPLIFIED_CONVERSATION_CONTEXT: true,
      EMERGENCY_DETECTION: true,
      CACHING_ENABLED: true,
      FALLBACK_ENABLED: true
    }
  }
};

// Performance monitoring configuration
export const PERFORMANCE_CONFIG = {
  // Enable performance monitoring for simplified handlers
  ENABLE_MONITORING: true,
  
  // Response time thresholds (in milliseconds)
  RESPONSE_TIME_THRESHOLDS: {
    EXCELLENT: 1000,  // < 1 second
    GOOD: 2000,       // < 2 seconds
    ACCEPTABLE: 5000, // < 5 seconds
    SLOW: 10000       // > 10 seconds
  },
  
  // Cost monitoring thresholds
  COST_THRESHOLDS: {
    DAILY_LIMIT: 10,    // $10/day
    MONTHLY_LIMIT: 100, // $100/month
    PER_QUERY_LIMIT: 0.05 // $0.05/query
  },
  
  // Cache performance targets
  CACHE_TARGETS: {
    HIT_RATE: 0.3,      // 30% cache hit rate
    SIZE_LIMIT: 1000,   // Max 1000 cached items
    TTL: 3600000        // 1 hour cache TTL
  }
};

// Testing configuration
export const TESTING_CONFIG = {
  // Enable A/B testing between handlers
  ENABLE_AB_TESTING: false,
  
  // A/B testing traffic split
  AB_TESTING_SPLIT: {
    LEGACY: 0.5,      // 50% legacy
    HYBRID: 0.3,      // 30% hybrid
    SIMPLIFIED: 0.2   // 20% simplified
  },
  
  // Test scenarios for validation
  TEST_SCENARIOS: [
    'shelter_search',
    'legal_help',
    'counseling_services',
    'emergency_help',
    'general_information',
    'follow_up_questions',
    'off_topic_queries',
    'conversation_flow'
  ],
  
  // Quality metrics to track
  QUALITY_METRICS: [
    'response_relevance',
    'response_accuracy',
    'conversation_continuity',
    'emergency_detection',
    'user_satisfaction',
    'response_time',
    'cost_per_query'
  ]
};

// Rollback configuration
export const ROLLBACK_CONFIG = {
  // Enable automatic rollback on errors
  ENABLE_AUTO_ROLLBACK: true,
  
  // Error thresholds for rollback
  ERROR_THRESHOLDS: {
    ERROR_RATE: 0.05,        // 5% error rate
    RESPONSE_TIME: 10000,    // 10 second response time
    COST_SPIKE: 0.10         // $0.10 per query
  },
  
  // Rollback strategy
  ROLLBACK_STRATEGY: {
    IMMEDIATE: 'immediate',   // Rollback immediately on threshold breach
    GRADUAL: 'gradual',       // Gradually reduce traffic to problematic handler
    MANUAL: 'manual'          // Manual rollback only
  }
};

/**
 * Get the current active response handler
 * @returns {string} Active handler name
 */
export function getActiveHandler() {
  return ACTIVE_HANDLER;
}

/**
 * Check if a feature flag is enabled
 * @param {string} flag - Feature flag name
 * @returns {boolean} True if enabled
 */
export function isFeatureEnabled(flag) {
  return FEATURE_FLAGS[flag] === true;
}

/**
 * Get current migration phase
 * @returns {Object} Current phase configuration
 */
export function getCurrentPhase() {
  // Determine current phase based on active handler and feature flags
  if (ACTIVE_HANDLER === RESPONSE_HANDLERS.SIMPLIFIED && 
      !isFeatureEnabled('SIMPLIFIED_INTENT_CLASSIFICATION')) {
    return MIGRATION_PHASES.PHASE_1;
  } else if (ACTIVE_HANDLER === RESPONSE_HANDLERS.HYBRID) {
    return MIGRATION_PHASES.PHASE_2;
  } else if (ACTIVE_HANDLER === RESPONSE_HANDLERS.SIMPLIFIED && 
             isFeatureEnabled('SIMPLIFIED_INTENT_CLASSIFICATION')) {
    return MIGRATION_PHASES.PHASE_3;
  }
  
  return MIGRATION_PHASES.PHASE_2; // Default to phase 2
}

/**
 * Get handler class name based on active handler
 * @returns {string} Handler class name
 */
export function getHandlerClassName() {
  switch (ACTIVE_HANDLER) {
    case RESPONSE_HANDLERS.SIMPLIFIED:
      return 'SimplifiedResponseHandler';
    case RESPONSE_HANDLERS.HYBRID:
      return 'HybridResponseHandler';
    case RESPONSE_HANDLERS.LEGACY:
    default:
      return 'ResponseGenerator'; // Legacy handler
  }
}

/**
 * Get handler import path based on active handler
 * @returns {string} Import path
 */
export function getHandlerImportPath() {
  switch (ACTIVE_HANDLER) {
    case RESPONSE_HANDLERS.SIMPLIFIED:
      return './simplifiedResponseHandler.js';
    case RESPONSE_HANDLERS.HYBRID:
      return './hybridResponseHandler.js';
    case RESPONSE_HANDLERS.LEGACY:
    default:
      return './response.js'; // Legacy handler
  }
}

/**
 * Check if performance monitoring is enabled
 * @returns {boolean} True if enabled
 */
export function isPerformanceMonitoringEnabled() {
  return PERFORMANCE_CONFIG.ENABLE_MONITORING;
}

/**
 * Check if A/B testing is enabled
 * @returns {boolean} True if enabled
 */
export function isABTestingEnabled() {
  return TESTING_CONFIG.ENABLE_AB_TESTING;
}

/**
 * Get A/B testing traffic split
 * @returns {Object} Traffic split configuration
 */
export function getABTestingSplit() {
  return TESTING_CONFIG.AB_TESTING_SPLIT;
}

/**
 * Check if auto rollback is enabled
 * @returns {boolean} True if enabled
 */
export function isAutoRollbackEnabled() {
  return ROLLBACK_CONFIG.ENABLE_AUTO_ROLLBACK;
}

/**
 * Get error thresholds for rollback
 * @returns {Object} Error thresholds
 */
export function getErrorThresholds() {
  return ROLLBACK_CONFIG.ERROR_THRESHOLDS;
}

/**
 * Get response time threshold for a given quality level
 * @param {string} quality - Quality level (EXCELLENT, GOOD, ACCEPTABLE, SLOW)
 * @returns {number} Threshold in milliseconds
 */
export function getResponseTimeThreshold(quality) {
  return PERFORMANCE_CONFIG.RESPONSE_TIME_THRESHOLDS[quality];
}

/**
 * Get cost threshold for a given period
 * @param {string} period - Period (DAILY_LIMIT, MONTHLY_LIMIT, PER_QUERY_LIMIT)
 * @returns {number} Cost threshold
 */
export function getCostThreshold(period) {
  return PERFORMANCE_CONFIG.COST_THRESHOLDS[period];
}

/**
 * Get cache performance targets
 * @returns {Object} Cache targets
 */
export function getCacheTargets() {
  return PERFORMANCE_CONFIG.CACHE_TARGETS;
}

/**
 * Get test scenarios for validation
 * @returns {Array} Test scenarios
 */
export function getTestScenarios() {
  return TESTING_CONFIG.TEST_SCENARIOS;
}

/**
 * Get quality metrics to track
 * @returns {Array} Quality metrics
 */
export function getQualityMetrics() {
  return TESTING_CONFIG.QUALITY_METRICS;
} 