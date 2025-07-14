/**
 * SSML Templates for Domestic Violence Support Assistant
 * Provides empathetic, human-like voice responses using Speech Synthesis Markup Language
 */

import logger from './logger.js';

/**
 * SSML Template Configuration
 */
const SSML_CONFIG = {
  // Voice characteristics for different emotional contexts
  voices: {
    empathetic: { rate: 'x-slow', pitch: '+2st' },
    calm: { rate: 'slow', pitch: '+1st' },
    clear: { rate: 'medium', pitch: '0st' },
    urgent: { rate: 'fast', pitch: '+1st' }
  },
  
  // Pause durations for natural conversation flow
  pauses: {
    short: '300ms',
    medium: '500ms',
    long: '800ms',
    veryLong: '1200ms'
  }
};

/**
 * Wrap text in SSML speak tags with optional prosody
 * @param {string} text - The text to wrap
 * @param {Object} prosody - Prosody settings (rate, pitch)
 * @returns {string} SSML-wrapped text
 */
function wrapInSSML(text, prosody = null) {
  if (!text || typeof text !== 'string') {
    return text;
  }

  let ssmlText = text.trim();
  
  if (prosody) {
    const { rate, pitch } = prosody;
    const prosodyAttrs = [];
    if (rate) prosodyAttrs.push(`rate="${rate}"`);
    if (pitch) prosodyAttrs.push(`pitch="${pitch}"`);
    
    if (prosodyAttrs.length > 0) {
      ssmlText = `<prosody ${prosodyAttrs.join(' ')}>${ssmlText}</prosody>`;
    }
  }
  
  return `<speak>${ssmlText}</speak>`;
}

/**
 * Add a pause break
 * @param {string} duration - Pause duration (e.g., '500ms')
 * @returns {string} SSML break tag
 */
function addPause(duration = '500ms') {
  return `<break time="${duration}"/>`;
}

/**
 * Emergency and Crisis Response Templates
 */
export const emergencyTemplates = {
  /**
   * Immediate danger assessment
   */
  immediateDanger: (userResponse = '') => {
    const text = `I hear how difficult this is for you. ${addPause('600ms')} 
                  You're taking a very brave step by reaching out. ${addPause('400ms')} 
                  Are you in immediate danger right now?`;
    
    return wrapInSSML(text, SSML_CONFIG.voices.empathetic);
  },

  /**
   * 911 guidance
   */
  call911: () => {
    const text = `This sounds like an emergency situation. ${addPause('500ms')} 
                  <prosody rate="slow" pitch="+2st">Please call 911 immediately.</prosody> ${addPause('800ms')} 
                  Your safety is the most important thing right now. ${addPause('400ms')} 
                  Can you call 911, or would you like me to help you find another way to get help?`;
    
    return wrapInSSML(text);
  },

  /**
   * Safety planning
   */
  safetyPlanning: () => {
    const text = `I want you to know that you're not alone. ${addPause('600ms')} 
                  <prosody rate="slow" pitch="+2st">Your safety matters.</prosody> ${addPause('500ms')} 
                  Let me help you find resources that can support you. ${addPause('400ms')} 
                  What kind of help are you looking for today?`;
    
    return wrapInSSML(text, SSML_CONFIG.voices.empathetic);
  }
};

/**
 * Welcome and Introduction Templates
 */
export const welcomeTemplates = {
  /**
   * Initial welcome message
   */
  initialWelcome: () => {
    const text = `<prosody rate="x-slow" pitch="+2st">Hello, and thank you for reaching out.</prosody> ${addPause('800ms')} 
                  <prosody rate="x-slow">I'm here to help you find support and resources.</prosody> ${addPause('600ms')} 
                  <prosody rate="x-slow" pitch="+1st">Are you in immediate danger right now?</prosody> ${addPause('500ms')} 
                  <prosody rate="x-slow">If so, please call 911.</prosody> ${addPause('600ms')} 
                  <prosody rate="x-slow">Otherwise, what brings you to call today?</prosody>`;
    
    return wrapInSSML(text);
  },

  /**
   * Follow-up welcome (when user returns)
   */
  followUpWelcome: () => {
    const text = `Welcome back. ${addPause('400ms')} 
                  I'm here to continue helping you. ${addPause('300ms')} 
                  What can I assist you with today?`;
    
    return wrapInSSML(text, SSML_CONFIG.voices.calm);
  }
};

/**
 * Location and Resource Templates
 */
export const locationTemplates = {
  /**
   * Location prompt
   */
  locationPrompt: () => {
    const text = `I'd be happy to help you find shelter and resources. ${addPause('400ms')} 
                  <prosody rate="slow" pitch="+1st">Could you please tell me which city or area you're looking for?</prosody> ${addPause('500ms')} 
                  For example, you could say "San Francisco" or "I'm in Austin, Texas."`;
    
    return wrapInSSML(text, SSML_CONFIG.voices.calm);
  },

  /**
   * Location clarification
   */
  locationClarification: (partialLocation) => {
    const text = `I heard you mention ${partialLocation}. ${addPause('400ms')} 
                  <prosody rate="slow" pitch="+1st">Could you help me understand which area you mean?</prosody> ${addPause('500ms')} 
                  For example, are you looking for resources in ${partialLocation} city, or a nearby area?`;
    
    return wrapInSSML(text, SSML_CONFIG.voices.calm);
  },

  /**
   * Resource found response
   */
  resourcesFound: (count, location) => {
    const text = `I found <prosody rate="slow">${count} resources</prosody> in ${location}. ${addPause('400ms')} 
                  <prosody rate="medium" pitch="+1st">Let me share the details with you.</prosody>`;
    
    return wrapInSSML(text, SSML_CONFIG.voices.clear);
  },

  /**
   * No resources found
   */
  noResourcesFound: (location) => {
    const text = `I searched for resources in ${location}, but I couldn't find any shelters in that specific area. ${addPause('600ms')} 
                  <prosody rate="slow" pitch="+2st">Don't worry, there are still ways I can help you.</prosody> ${addPause('400ms')} 
                  Would you like me to search for resources in nearby areas, or help you find other types of support?`;
    
    return wrapInSSML(text, SSML_CONFIG.voices.empathetic);
  }
};

/**
 * Resource Information Templates
 */
export const resourceTemplates = {
  /**
   * Shelter information
   */
  shelterInfo: (shelterName, details) => {
    const text = `The <prosody rate="slow">${shelterName}</prosody> is located at ${details.address}. ${addPause('400ms')} 
                  <prosody pitch="+1st">Their phone number is ${details.phone}.</prosody> ${addPause('300ms')} 
                  ${details.petFriendly ? 'They do accept pets.' : 'They do not accept pets.'} ${addPause('400ms')} 
                  Would you like me to tell you more about this shelter, or would you like to hear about the next one?`;
    
    return wrapInSSML(text, SSML_CONFIG.voices.clear);
  },

  /**
   * Legal services information
   */
  legalServicesInfo: (serviceName, details) => {
    const text = `${serviceName} provides legal assistance for domestic violence cases. ${addPause('400ms')} 
                  <prosody pitch="+1st">You can reach them at ${details.phone}.</prosody> ${addPause('300ms')} 
                  They offer help with restraining orders, custody issues, and other legal matters. ${addPause('400ms')} 
                  Would you like me to send you their complete contact information?`;
    
    return wrapInSSML(text, SSML_CONFIG.voices.clear);
  },

  /**
   * Counseling services information
   */
  counselingInfo: (serviceName, details) => {
    const text = `${serviceName} offers counseling and emotional support. ${addPause('400ms')} 
                  <prosody pitch="+1st">Their phone number is ${details.phone}.</prosody> ${addPause('300ms')} 
                  They provide individual and group therapy sessions. ${addPause('400ms')} 
                  Many people find talking to a counselor very helpful during difficult times. ${addPause('500ms')} 
                  Would you like me to tell you more about their services?`;
    
    return wrapInSSML(text, SSML_CONFIG.voices.empathetic);
  }
};

/**
 * Follow-up Question Templates
 */
export const followUpTemplates = {
  /**
   * General follow-up
   */
  generalFollowUp: () => {
    const text = `<prosody rate="slow" pitch="+2st">Is there anything else I can help you with?</prosody> ${addPause('500ms')} 
                  Or would you like me to tell you more about any of the resources I mentioned?`;
    
    return wrapInSSML(text, SSML_CONFIG.voices.empathetic);
  },

  /**
   * Specific resource follow-up
   */
  specificResourceFollowUp: (resourceName) => {
    const text = `Would you like me to tell you more about <prosody rate="slow">${resourceName}</prosody>? ${addPause('400ms')} 
                  <prosody pitch="+1st">I can share their address, phone number, or other details.</prosody>`;
    
    return wrapInSSML(text, SSML_CONFIG.voices.calm);
  },

  /**
   * Contact information follow-up
   */
  contactInfoFollowUp: () => {
    const text = `<prosody rate="slow" pitch="+2st">Would you like me to send you the contact information via text message?</prosody> ${addPause('500ms')} 
                  That way you'll have it handy when you need it.`;
    
    return wrapInSSML(text, SSML_CONFIG.voices.empathetic);
  },

  /**
   * Location follow-up
   */
  locationFollowUp: () => {
    const text = `I'd be happy to help you find resources in a different area. ${addPause('400ms')} 
                  <prosody rate="slow" pitch="+1st">Could you tell me which city or region you'd like me to search?</prosody>`;
    
    return wrapInSSML(text, SSML_CONFIG.voices.calm);
  }
};

/**
 * Error and Fallback Templates
 */
export const errorTemplates = {
  /**
   * General error
   */
  generalError: () => {
    const text = `I'm sorry, I'm having trouble processing your request right now. ${addPause('500ms')} 
                  <prosody rate="slow" pitch="+2st">Please try again in a moment.</prosody> ${addPause('400ms')} 
                  If you're in immediate danger, please call 911.`;
    
    return wrapInSSML(text, SSML_CONFIG.voices.empathetic);
  },

  /**
   * Speech recognition error
   */
  speechRecognitionError: () => {
    const text = `I didn't catch that clearly. ${addPause('400ms')} 
                  <prosody rate="slow" pitch="+1st">Could you please repeat what you said?</prosody> ${addPause('300ms')} 
                  Or you can try saying it a different way.`;
    
    return wrapInSSML(text, SSML_CONFIG.voices.calm);
  },

  /**
   * Network error
   */
  networkError: () => {
    const text = `I'm having trouble connecting to my resources right now. ${addPause('500ms')} 
                  <prosody rate="slow" pitch="+2st">Please try again in a few moments.</prosody> ${addPause('400ms')} 
                  If you need immediate help, please call the National Domestic Violence Hotline at 1-800-799-7233.`;
    
    return wrapInSSML(text, SSML_CONFIG.voices.empathetic);
  }
};

/**
 * Conversation End Templates
 */
export const conversationTemplates = {
  /**
   * Graceful conversation end
   */
  conversationEnd: () => {
    const text = `Thank you for reaching out today. ${addPause('500ms')} 
                  <prosody rate="slow" pitch="+2st">Remember, you're not alone, and help is always available.</prosody> ${addPause('600ms')} 
                  Take care and stay safe.`;
    
    return wrapInSSML(text, SSML_CONFIG.voices.empathetic);
  },

  /**
   * SMS confirmation
   */
  smsConfirmation: () => {
    const text = `I'll send you the resource information via text message. ${addPause('400ms')} 
                  <prosody rate="slow" pitch="+1st">You should receive it shortly.</prosody> ${addPause('500ms')} 
                  Thank you for reaching out, and take care.`;
    
    return wrapInSSML(text, SSML_CONFIG.voices.calm);
  }
};

/**
 * Utility function to apply SSML to any text response
 * @param {string} text - The text to convert to SSML
 * @param {string} templateType - The type of template to use
 * @param {Object} context - Additional context for the response
 * @returns {string} SSML-formatted text
 */
export function applySSMLTemplate(text, templateType = 'general', context = {}) {
  if (!text || typeof text !== 'string') {
    return text;
  }

  // For general responses, apply basic SSML formatting
  if (templateType === 'general') {
    return wrapInSSML(text, SSML_CONFIG.voices.calm);
  }

  // For specific template types, use the appropriate template
  const templates = {
    emergency: emergencyTemplates,
    welcome: welcomeTemplates,
    location: locationTemplates,
    resource: resourceTemplates,
    followUp: followUpTemplates,
    error: errorTemplates,
    conversation: conversationTemplates
  };

  const templateGroup = templates[templateType];
  if (!templateGroup) {
    logger.warn(`Unknown SSML template type: ${templateType}, using general formatting`);
    return wrapInSSML(text, SSML_CONFIG.voices.calm);
  }

  // If we have a specific template function, use it
  if (context.templateFunction && templateGroup[context.templateFunction]) {
    return templateGroup[context.templateFunction](...Object.values(context.params || {}));
  }

  // Otherwise, apply basic SSML formatting
  return wrapInSSML(text, SSML_CONFIG.voices.calm);
}

/**
 * Check if text is already wrapped in SSML
 * @param {string} text - The text to check
 * @returns {boolean} True if text is already SSML
 */
export function isSSML(text) {
  return text && typeof text === 'string' && text.trim().startsWith('<speak>');
}

/**
 * Remove SSML tags from text (for logging or processing)
 * @param {string} ssmlText - The SSML text to clean
 * @returns {string} Clean text without SSML tags
 */
export function removeSSML(ssmlText) {
  if (!ssmlText || typeof ssmlText !== 'string') {
    return ssmlText;
  }

  return ssmlText
    .replace(/<speak>/gi, '')
    .replace(/<\/speak>/gi, '')
    .replace(/<prosody[^>]*>/gi, '')
    .replace(/<\/prosody>/gi, '')
    .replace(/<break[^>]*>/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export default {
  emergencyTemplates,
  welcomeTemplates,
  locationTemplates,
  resourceTemplates,
  followUpTemplates,
  errorTemplates,
  conversationTemplates,
  applySSMLTemplate,
  isSSML,
  removeSSML
}; 