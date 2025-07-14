import { BaseHandler } from '../base/BaseHandler.js';
import { getLanguageConfig, DEFAULT_LANGUAGE } from '../../lib/languageConfig.js';
import logger from '../../lib/logger.js';

/**
 * SpeechHandler - Handles speech processing operations
 * Extends BaseHandler for common functionality and focuses on speech-specific operations
 */
export class SpeechHandler extends BaseHandler {
  constructor(services = {}, dependencies = {}) {
    super(services, 'SpeechHandler');
    this._deps = dependencies;
  }

  /**
   * Get required services for this handler
   * @returns {Array} Array of required service names
   */
  getRequiredServices() {
    return ['tts', 'context'];
  }

  /**
   * Validate request structure
   * @param {Object} request - Request to validate
   */
  async validateRequest(request) {
    if (!request) {
      logger.info('SpeechHandler.validateRequest: missing request', { request });
      throw new Error('Request is required');
    }
    
    if (!request.text && !request.audio) {
      logger.info('SpeechHandler.validateRequest: missing text/audio', { request });
      throw new Error('Request must contain either text or audio');
    }
  }

  /**
   * Process speech input
   * @param {Object} request - Request containing speech data
   * @returns {Promise<Object>} Processing result
   */
  async processSpeech(request) {
    logger.info('SpeechHandler.processSpeech: start', { request });
    const result = await this.processRequest(request, 'speech processing', async (req) => {
      const { text, audio, languageCode = DEFAULT_LANGUAGE, contextId } = req;

      // Preprocess speech text
      const processedText = this.preprocessSpeech(text);
      
      // Check if speech is garbled
      if (this.isGarbled(processedText)) {
        return this.createErrorResponse('Speech appears to be garbled or unclear', 'GARBLED_SPEECH');
      }

      // Extract key information
      const extractedInfo = this.extractSpeechInfo(processedText, languageCode);
      
      // Check if this is a find_shelter intent and handle location requirements
      if (extractedInfo.intent === 'find_shelter') {
        const locationCheckResult = await this.processFindShelterWithLocationCheck(processedText, contextId, languageCode);
        if (locationCheckResult.needsLocationPrompt) {
          return {
            processedText,
            extractedInfo,
            needsLocationPrompt: true,
            locationPrompt: locationCheckResult.locationPrompt,
            languageCode,
            confidence: this.calculateConfidence(processedText, extractedInfo)
          };
        }
        // Update extractedInfo with validated location
        extractedInfo.location = locationCheckResult.validLocation;
      }
      
      // Update context if provided
      if (contextId) {
        await this.services.context.updateConversationContext(contextId, {
          interaction: {
            query: processedText,
            extractedInfo,
            timestamp: Date.now()
          }
        });
      }

      // Generate TTS if requested
      let audioUrl = null;
      if (req.generateAudio) {
        const ttsOptions = {
          language: languageCode,
          voice: 'nova' // Default voice for speech processing
        };
        const ttsResult = await this.services.tts.generateSpeech(processedText, ttsOptions);
        if (ttsResult.success) {
          audioUrl = ttsResult.data.audioUrl;
        }
      }

      return {
        processedText,
        extractedInfo,
        audioUrl,
        languageCode,
        confidence: this.calculateConfidence(processedText, extractedInfo)
      };
    });
    logger.info('SpeechHandler.processSpeech: end', { request, result });
    return result;
  }

  /**
   * Process find_shelter intent with strict location validation
   * @param {string} speechText - Processed speech text
   * @param {string} contextId - Context ID for conversation history
   * @param {string} languageCode - Language code
   * @returns {Object} Result with location validation and prompt if needed
   */
  async processFindShelterWithLocationCheck(speechText, contextId, languageCode) {
    logger.info('Processing find_shelter intent with location check:', { speechText, contextId, languageCode });
    
    // Step 1: Check previous context for valid location
    let validLocation = null;
    if (contextId) {
      try {
        const context = await this.services.context.getConversationContext(contextId);
        if (context && context.location) {
          logger.info('Found location in previous context:', { contextLocation: context.location });
          
          // Validate the context location strictly
          const { detectLocationWithGeocoding } = await import('../../lib/enhancedLocationDetector.js');
          const locationData = await detectLocationWithGeocoding(context.location);
          
          if (locationData && locationData.isComplete) {
            validLocation = locationData.location;
            logger.info('Context location is valid:', { validLocation });
          } else {
            logger.info('Context location is not complete:', { contextLocation: context.location, locationData });
          }
        }
      } catch (error) {
        logger.error('Error checking context for location:', error);
      }
    }
    
    // Step 2: If no valid location in context, check current speech
    if (!validLocation) {
      try {
        const { detectLocationWithGeocoding } = await import('../../lib/enhancedLocationDetector.js');
        const locationData = await detectLocationWithGeocoding(speechText);
        
        if (locationData && locationData.isComplete) {
          validLocation = locationData.location;
          logger.info('Found valid location in current speech:', { validLocation });
        } else {
          logger.info('No valid location found in current speech:', { speechText, locationData });
        }
      } catch (error) {
        logger.error('Error extracting location from current speech:', error);
      }
    }
    
    // Step 3: If no valid location found, return location prompt
    if (!validLocation) {
      const languageConfig = getLanguageConfig(languageCode);
      const locationPrompt = languageConfig.prompts.location || 'Can you tell me your location so I can find nearby shelters?';
      
      logger.info('No valid location found, returning location prompt:', { locationPrompt });
      return {
        needsLocationPrompt: true,
        locationPrompt,
        validLocation: null
      };
    }
    
    // Step 4: Valid location found, proceed normally
    logger.info('Valid location found, proceeding with shelter search:', { validLocation });
    return {
      needsLocationPrompt: false,
      locationPrompt: null,
      validLocation
    };
  }

  /**
   * Preprocess speech input
   * @param {string} speechText - Raw speech text
   * @returns {string} Processed speech text
   */
  preprocessSpeech(speechText) {
    if (!speechText) return '';

    let processed = speechText.trim();

    // Remove common speech artifacts
    processed = processed.replace(/\b(um|uh|er|ah|like|you know|i mean)\b/gi, '');
    
    // Remove extra whitespace
    processed = processed.replace(/\s+/g, ' ');
    
    // Remove trailing punctuation
    processed = processed.replace(/[.!?]+$/, '');
    
    // Convert to lowercase for consistency
    processed = processed.toLowerCase();

    return processed.trim();
  }

  /**
   * Check if speech is garbled
   * @param {string} speech - Speech text
   * @returns {boolean} Whether speech is garbled
   */
  isGarbled(speech) {
    if (!speech || speech.length < 3) return true;
    
    // Check for excessive repetition
    const words = speech.split(' ');
    const uniqueWords = new Set(words);
    const repetitionRatio = uniqueWords.size / words.length;
    
    if (repetitionRatio < 0.3) return true;
    
    // Check for excessive special characters
    const specialCharRatio = (speech.match(/[^a-zA-Z0-9\s]/g) || []).length / speech.length;
    if (specialCharRatio > 0.5) return true;
    
    return false;
  }

  /**
   * Extract key information from speech
   * @param {string} speech - Speech text
   * @param {string} languageCode - Language code
   * @returns {Object} Extracted information
   */
  extractSpeechInfo(speech, languageCode) {
    const words = this.extractKeyWords(speech);
    const location = this.extractLocation(speech);
    const intent = this.detectIntent(speech);
    const urgency = this.detectUrgency(speech);
    const language = this.detectLanguage(speech, languageCode);

    return {
      words,
      location,
      intent,
      urgency,
      language,
      wordCount: speech.split(' ').length,
      timestamp: Date.now()
    };
  }

  /**
   * Extract key words from speech
   * @param {string} speech - Speech text
   * @returns {Array} Array of key words
   */
  extractKeyWords(speech) {
    if (!speech) return [];
    
    const words = speech.toLowerCase().split(/\s+/);
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
      'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did',
      'will', 'would', 'could', 'should', 'may', 'might', 'can', 'this', 'that', 'these', 'those',
      'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them',
      'um', 'uh', 'er', 'ah', 'like', 'you know', 'i mean'
    ]);
    
    return words
      .filter(word => word.length > 2 && !stopWords.has(word))
      .slice(0, 10); // Limit to 10 key words
  }

  /**
   * Extract location from speech
   * @param {string} speech - Speech text
   * @returns {string|null} Extracted location or null
   */
  extractLocation(speech) {
    if (!speech) return null;

    // Simple location extraction patterns
    const locationPatterns = [
      /(?:in|at|near|around)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/g,
      /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*),\s*[A-Z]{2}/g,
      /(?:city\s+of|town\s+of)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/g
    ];

    for (const pattern of locationPatterns) {
      const match = speech.match(pattern);
      if (match) {
        return match[1] || match[0];
      }
    }

    return null;
  }

  /**
   * Detect intent from speech
   * @param {string} speech - Speech text
   * @returns {string} Detected intent
   */
  detectIntent(speech) {
    if (!speech) return 'unknown';

    const speechLower = speech.toLowerCase();

    // Emergency detection
    if (speechLower.includes('emergency') || speechLower.includes('911') || speechLower.includes('help now')) {
      return 'emergency';
    }

    // Shelter search
    if (speechLower.includes('shelter') || speechLower.includes('safe place') || speechLower.includes('refuge')) {
      return 'find_shelter';
    }

    // Legal help
    if (speechLower.includes('legal') || speechLower.includes('lawyer') || speechLower.includes('court')) {
      return 'legal_help';
    }

    // Counseling
    if (speechLower.includes('counseling') || speechLower.includes('therapy') || speechLower.includes('support group')) {
      return 'counseling';
    }

    // General help
    if (speechLower.includes('help') || speechLower.includes('need') || speechLower.includes('assistance')) {
      return 'general_help';
    }

    return 'unknown';
  }

  /**
   * Detect urgency level
   * @param {string} speech - Speech text
   * @returns {string} Urgency level
   */
  detectUrgency(speech) {
    if (!speech) return 'low';

    const speechLower = speech.toLowerCase();

    // High urgency indicators
    if (speechLower.includes('now') || speechLower.includes('immediate') || speechLower.includes('urgent')) {
      return 'high';
    }

    // Medium urgency indicators
    if (speechLower.includes('soon') || speechLower.includes('quick') || speechLower.includes('fast')) {
      return 'medium';
    }

    return 'low';
  }

  /**
   * Detect language from text
   * @param {string} text - Text to analyze
   * @param {string} defaultLanguage - Default language code
   * @returns {string} Detected language code
   */
  detectLanguage(text, defaultLanguage = DEFAULT_LANGUAGE) {
    if (!text) return defaultLanguage;

    const normalizedText = text.toLowerCase();
    
    // Spanish detection
    const spanishWords = ['hola', 'gracias', 'por favor', 'ayuda', 'necesito', 'donde', 'como', 'que'];
    const spanishCount = spanishWords.filter(word => normalizedText.includes(word)).length;
    
    // French detection
    const frenchWords = ['bonjour', 'merci', 's\'il vous plaît', 'aide', 'besoin', 'où', 'comment', 'quoi'];
    const frenchCount = frenchWords.filter(word => normalizedText.includes(word)).length;
    
    // German detection
    const germanWords = ['hallo', 'danke', 'bitte', 'hilfe', 'brauche', 'wo', 'wie', 'was'];
    const germanCount = germanWords.filter(word => normalizedText.includes(word)).length;

    // Threshold for detection (at least 2 words)
    const threshold = 2;
    
    if (spanishCount >= threshold) return 'es-ES';
    if (frenchCount >= threshold) return 'fr-FR';
    if (germanCount >= threshold) return 'de-DE';
    
    return defaultLanguage;
  }

  /**
   * Calculate confidence score for speech processing
   * @param {string} speech - Speech text
   * @param {Object} extractedInfo - Extracted information
   * @returns {number} Confidence score (0-1)
   */
  calculateConfidence(speech, extractedInfo) {
    if (!speech || speech.length < 3) return 0;

    let confidence = 0.5; // Base confidence

    // Word count factor
    const wordCount = extractedInfo.wordCount;
    if (wordCount >= 5) confidence += 0.2;
    else if (wordCount >= 3) confidence += 0.1;

    // Intent detection factor
    if (extractedInfo.intent !== 'unknown') confidence += 0.2;

    // Location detection factor
    if (extractedInfo.location) confidence += 0.1;

    // Language detection factor
    if (extractedInfo.language !== DEFAULT_LANGUAGE) confidence += 0.1;

    // Garbled speech penalty
    if (this.isGarbled(speech)) confidence -= 0.3;

    return Math.max(0, Math.min(1, confidence));
  }

  /**
   * Generate speech response
   * @param {Object} request - Request containing response data
   * @returns {Promise<Object>} Response with audio
   */
  async generateSpeechResponse(request) {
    return this.processRequest(request, 'speech response generation', async (req) => {
      const { text, languageCode = DEFAULT_LANGUAGE, voice = null } = req;

      if (!text) {
        throw new Error('Text is required for speech response generation');
      }

      // Generate TTS
      const ttsOptions = {
        language: languageCode,
        voice: voice || 'nova'
      };
      const ttsResult = await this.services.tts.generateSpeech(text, ttsOptions);
      
      if (!ttsResult.success) {
        throw new Error(`TTS generation failed: ${ttsResult.error}`);
      }

      return {
        text,
        audioUrl: ttsResult.data.audioUrl,
        languageCode,
        voice: ttsResult.data.voice,
        duration: ttsResult.data.duration,
        timestamp: Date.now()
      };
    });
  }

  /**
   * Batch process multiple speech inputs
   * @param {Object} request - Request containing array of speech inputs
   * @returns {Promise<Object>} Batch processing results
   */
  async batchProcessSpeech(request) {
    return this.processRequest(request, 'batch speech processing', async (req) => {
      const { inputs, contextId } = req;

      if (!Array.isArray(inputs) || inputs.length === 0) {
        throw new Error('Inputs must be a non-empty array');
      }

      const results = [];
      const errors = [];

      for (let i = 0; i < inputs.length; i++) {
        try {
          const result = await this.processSpeech({
            text: inputs[i].text,
            languageCode: inputs[i].languageCode || DEFAULT_LANGUAGE,
            contextId
          });
          results.push(result);
        } catch (error) {
          errors.push({
            index: i,
            error: error.message,
            input: inputs[i]
          });
        }
      }

      return {
        results,
        errors,
        totalProcessed: results.length,
        totalErrors: errors.length,
        successRate: results.length / inputs.length
      };
    });
  }

  /**
   * Get speech processing statistics
   * @returns {Object} Processing statistics
   */
  getProcessingStats() {
    return {
      handlerName: this.handlerName,
      totalRequests: this.requestCount || 0,
      averageProcessingTime: this.averageProcessingTime || 0,
      errorRate: this.errorRate || 0,
      lastProcessed: this.lastProcessed || null
    };
  }
} 