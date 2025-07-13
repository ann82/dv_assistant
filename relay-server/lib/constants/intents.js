/**
 * Intent Classification Constants
 * Constants used for intent classification and processing
 */

// Intent Types
export const INTENTS = {
  // Primary intents
  FIND_SHELTER: 'find_shelter',
  SAFETY_PLAN: 'safety_plan',
  EMERGENCY: 'emergency',
  LEGAL_HELP: 'legal_help',
  COUNSELING: 'counseling',
  SUPPORT_GROUP: 'support_group',
  
  // Secondary intents
  FOLLOW_UP: 'follow_up',
  LOCATION: 'location',
  PETS: 'pets',
  CHILDREN: 'children',
  TRANSPORTATION: 'transportation',
  FINANCIAL: 'financial',
  
  // System intents
  OFF_TOPIC: 'off_topic',
  GREETING: 'greeting',
  GOODBYE: 'goodbye',
  THANK_YOU: 'thank_you',
  REPEAT: 'repeat',
  CLARIFICATION: 'clarification'
};

// Intent Categories
export const INTENT_CATEGORIES = {
  PRIMARY: [
    INTENTS.FIND_SHELTER,
    INTENTS.SAFETY_PLAN,
    INTENTS.EMERGENCY,
    INTENTS.LEGAL_HELP,
    INTENTS.COUNSELING,
    INTENTS.SUPPORT_GROUP
  ],
  SECONDARY: [
    INTENTS.FOLLOW_UP,
    INTENTS.LOCATION,
    INTENTS.PETS,
    INTENTS.CHILDREN,
    INTENTS.TRANSPORTATION,
    INTENTS.FINANCIAL
  ],
  SYSTEM: [
    INTENTS.OFF_TOPIC,
    INTENTS.GREETING,
    INTENTS.GOODBYE,
    INTENTS.THANK_YOU,
    INTENTS.REPEAT,
    INTENTS.CLARIFICATION
  ]
};

// Confidence Levels
export const CONFIDENCE_LEVELS = {
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low'
};

// Confidence Thresholds
export const CONFIDENCE_THRESHOLDS = {
  HIGH: 0.8,
  MEDIUM: 0.6,
  LOW: 0.4
};

// Intent Priority Levels
export const INTENT_PRIORITIES = {
  [INTENTS.EMERGENCY]: 1,
  [INTENTS.SAFETY_PLAN]: 2,
  [INTENTS.FIND_SHELTER]: 3,
  [INTENTS.LEGAL_HELP]: 4,
  [INTENTS.COUNSELING]: 5,
  [INTENTS.SUPPORT_GROUP]: 6,
  [INTENTS.FOLLOW_UP]: 7,
  [INTENTS.LOCATION]: 8,
  [INTENTS.PETS]: 9,
  [INTENTS.CHILDREN]: 10,
  [INTENTS.TRANSPORTATION]: 11,
  [INTENTS.FINANCIAL]: 12,
  [INTENTS.GREETING]: 13,
  [INTENTS.THANK_YOU]: 14,
  [INTENTS.REPEAT]: 15,
  [INTENTS.CLARIFICATION]: 16,
  [INTENTS.GOODBYE]: 17,
  [INTENTS.OFF_TOPIC]: 18
};

// Intent Response Types
export const RESPONSE_TYPES = {
  IMMEDIATE: 'immediate',
  SEARCH_BASED: 'search_based',
  CONVERSATIONAL: 'conversational',
  REDIRECT: 'redirect',
  END_CALL: 'end_call'
};

// Intent to Response Type Mapping
export const INTENT_RESPONSE_MAPPING = {
  [INTENTS.EMERGENCY]: RESPONSE_TYPES.IMMEDIATE,
  [INTENTS.SAFETY_PLAN]: RESPONSE_TYPES.IMMEDIATE,
  [INTENTS.FIND_SHELTER]: RESPONSE_TYPES.SEARCH_BASED,
  [INTENTS.LEGAL_HELP]: RESPONSE_TYPES.SEARCH_BASED,
  [INTENTS.COUNSELING]: RESPONSE_TYPES.SEARCH_BASED,
  [INTENTS.SUPPORT_GROUP]: RESPONSE_TYPES.SEARCH_BASED,
  [INTENTS.FOLLOW_UP]: RESPONSE_TYPES.SEARCH_BASED,
  [INTENTS.LOCATION]: RESPONSE_TYPES.CONVERSATIONAL,
  [INTENTS.PETS]: RESPONSE_TYPES.CONVERSATIONAL,
  [INTENTS.CHILDREN]: RESPONSE_TYPES.CONVERSATIONAL,
  [INTENTS.TRANSPORTATION]: RESPONSE_TYPES.SEARCH_BASED,
  [INTENTS.FINANCIAL]: RESPONSE_TYPES.SEARCH_BASED,
  [INTENTS.GREETING]: RESPONSE_TYPES.CONVERSATIONAL,
  [INTENTS.THANK_YOU]: RESPONSE_TYPES.CONVERSATIONAL,
  [INTENTS.REPEAT]: RESPONSE_TYPES.CONVERSATIONAL,
  [INTENTS.CLARIFICATION]: RESPONSE_TYPES.CONVERSATIONAL,
  [INTENTS.GOODBYE]: RESPONSE_TYPES.END_CALL,
  [INTENTS.OFF_TOPIC]: RESPONSE_TYPES.REDIRECT
};

// Intent Keywords (for pattern matching)
export const INTENT_KEYWORDS = {
  [INTENTS.FIND_SHELTER]: [
    'shelter', 'safe place', 'refuge', 'haven', 'emergency housing',
    'domestic violence shelter', 'women shelter', 'crisis center',
    'where can i go', 'need a place', 'escape', 'leave'
  ],
  [INTENTS.SAFETY_PLAN]: [
    'safety plan', 'safety planning', 'how to stay safe', 'protect myself',
    'escape plan', 'emergency plan', 'what if', 'if something happens',
    'preparation', 'ready', 'plan ahead'
  ],
  [INTENTS.EMERGENCY]: [
    'emergency', 'urgent', 'right now', 'immediate', 'danger',
    'help now', '911', 'police', 'call police', 'in danger',
    'afraid', 'scared', 'fear', 'threat', 'violence'
  ],
  [INTENTS.LEGAL_HELP]: [
    'legal', 'lawyer', 'attorney', 'court', 'restraining order',
    'protection order', 'divorce', 'custody', 'rights', 'legal aid',
    'legal services', 'law', 'legal advice'
  ],
  [INTENTS.COUNSELING]: [
    'counseling', 'therapy', 'therapist', 'counselor', 'mental health',
    'emotional support', 'talk to someone', 'professional help',
    'psychological', 'trauma', 'healing', 'recovery'
  ],
  [INTENTS.SUPPORT_GROUP]: [
    'support group', 'group therapy', 'peer support', 'others like me',
    'community', 'meet people', 'share', 'not alone', 'similar experiences'
  ]
};

// Intent Fallback Responses
export const INTENT_FALLBACK_RESPONSES = {
  [INTENTS.OFF_TOPIC]: "I'm here specifically to help with domestic violence support and resources. How can I assist you with that?",
  [INTENTS.CLARIFICATION]: "I didn't quite understand. Could you please rephrase that or tell me more about what you need help with?",
  [INTENTS.REPEAT]: "Let me repeat that information for you.",
  [INTENTS.GREETING]: "Hello! I'm here to help you with domestic violence support and resources. How can I assist you today?",
  [INTENTS.THANK_YOU]: "You're very welcome. Is there anything else I can help you with?",
  [INTENTS.GOODBYE]: "Thank you for reaching out. Please know that help is always available. Take care and stay safe."
};

// Intent Processing Options
export const INTENT_PROCESSING_OPTIONS = {
  [INTENTS.EMERGENCY]: {
    requiresImmediateResponse: true,
    bypassSearch: true,
    priority: 'high',
    maxResponseTime: 5000
  },
  [INTENTS.SAFETY_PLAN]: {
    requiresImmediateResponse: true,
    bypassSearch: true,
    priority: 'high',
    maxResponseTime: 10000
  },
  [INTENTS.FIND_SHELTER]: {
    requiresImmediateResponse: false,
    bypassSearch: false,
    priority: 'medium',
    maxResponseTime: 15000
  },
  [INTENTS.FOLLOW_UP]: {
    requiresImmediateResponse: false,
    bypassSearch: false,
    priority: 'medium',
    maxResponseTime: 10000
  }
};

// Default Intent Processing Options
export const DEFAULT_INTENT_OPTIONS = {
  requiresImmediateResponse: false,
  bypassSearch: false,
  priority: 'normal',
  maxResponseTime: 15000
};

/**
 * Get intent processing options for a specific intent
 * @param {string} intent - Intent type
 * @returns {Object} Processing options
 */
export function getIntentProcessingOptions(intent) {
  return INTENT_PROCESSING_OPTIONS[intent] || DEFAULT_INTENT_OPTIONS;
}

/**
 * Get confidence level from confidence score
 * @param {number} confidence - Confidence score (0-1)
 * @returns {string} Confidence level
 */
export function getConfidenceLevel(confidence) {
  if (confidence >= CONFIDENCE_THRESHOLDS.HIGH) {
    return CONFIDENCE_LEVELS.HIGH;
  } else if (confidence >= CONFIDENCE_THRESHOLDS.MEDIUM) {
    return CONFIDENCE_LEVELS.MEDIUM;
  } else {
    return CONFIDENCE_LEVELS.LOW;
  }
}

/**
 * Check if intent is high priority
 * @param {string} intent - Intent type
 * @returns {boolean} Whether intent is high priority
 */
export function isHighPriorityIntent(intent) {
  const priority = INTENT_PRIORITIES[intent];
  return priority <= 3; // Emergency, Safety Plan, Find Shelter
}

/**
 * Get response type for intent
 * @param {string} intent - Intent type
 * @returns {string} Response type
 */
export function getResponseTypeForIntent(intent) {
  return INTENT_RESPONSE_MAPPING[intent] || RESPONSE_TYPES.CONVERSATIONAL;
} 