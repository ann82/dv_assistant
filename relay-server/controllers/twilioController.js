import { TwilioIntegration } from '../integrations/twilioIntegration.js';
import logger from '../lib/logger.js';
import { logControllerOperation, logApiEndpoint } from '../middleware/logging.js';
import fs from 'fs/promises';
import fsSync from 'fs';
// Remove circular import - handlerManager will be injected
import { getIntent, rewriteQuery } from '../lib/intentClassifier.js';
import { extractLocation, generateLocationPrompt } from '../lib/speechProcessor.js';
import { UnifiedResponseHandler } from '../lib/unifiedResponseHandler.js';

// Create a factory function to create controller functions with injected dependencies
export function createTwilioController(handlerManager) {
  // Fetch and log Twilio call details
  async function fetchCallDetails(callSid) {
  logControllerOperation('fetchCallDetails', { callSid });
  return TwilioIntegration.fetchCallDetails(callSid);
}

  // Clean up audio files
  async function cleanupAudioFile(audioPath) {
  try {
    logControllerOperation('cleanupAudioFile', { audioPath });
    if (fsSync.existsSync(audioPath)) {
      await fs.unlink(audioPath);
      logControllerOperation('cleanupAudioFile.success', { audioPath });
    }
  } catch (error) {
    logControllerOperation('cleanupAudioFile.error', { audioPath, error: error.message }, 'error');
    logger.error('Error cleaning up audio file:', error);
  }
}

  // Helper function to determine request type (web vs Twilio)
  function getRequestType(req) {
  // Check if it's a Twilio request (has Twilio-specific headers or body fields)
  if (req.body.CallSid || req.body.From || req.headers['x-twilio-signature']) {
    return 'twilio';
  }
  
  // Check if it's a web request (has user-agent but no Twilio signature)
  if (req.headers['user-agent'] && !req.headers['x-twilio-signature']) {
    return 'web';
  }

  // Default to web if we can't determine the source
  return 'web';
}

  // Handle SMS consent logic
  async function handleSMSConsent(CallSid, SpeechResult, res) {
  const requestId = res.req?.requestContext?.requestId || 'unknown';
  logControllerOperation('handleSMSConsent', { CallSid, SpeechResult, requestId });
  
  const call = handlerManager.activeCalls.get(CallSid);
  if (!call) {
    logControllerOperation('handleSMSConsent.error', { CallSid, error: 'No active call found', requestId }, 'error');
    logger.error(`No active call found for CallSid: ${CallSid}`);
    const twiml = await handlerManager.generateTTSBasedTwiML("I'm sorry, I encountered an error. The call will now end.", false, null);
    const twimlResponse = new (await import('twilio')).twiml.VoiceResponse();
    const audioUrl = twiml.match(/<Play>([^<]+)<\/Play>/)?.[1];
    if (audioUrl) {
      twimlResponse.play(audioUrl);
    }
    twimlResponse.hangup();
    res.type('text/xml');
    return res.send(twimlResponse.toString());
  }
  
  // Process consent response (check if user said "yes")
  const hasConsent = SpeechResult.toLowerCase().includes('yes');
  call.hasConsent = hasConsent;
  handlerManager.activeCalls.set(CallSid, call);
  
  logControllerOperation('handleSMSConsent.processed', { CallSid, hasConsent, requestId });
  
  // Generate and send summary if consent was given
  if (hasConsent) {
    logControllerOperation('handleSMSConsent.generateSummary', { CallSid, requestId });
    const summary = await handlerManager.generateCallSummary(CallSid, call);
    // Use TwilioIntegration to send SMS
    await TwilioIntegration.sendSMS(call.from, summary);
    logControllerOperation('handleSMSConsent.smsSent', { CallSid, requestId });
  }
  
  // End the call with appropriate message
  const finalMessage = hasConsent ? 
    "Thank you. You will receive a text message with the summary and resources shortly." :
    "Thank you for reaching out. You're not alone, and help is always available. Take care and stay safe.";
  
  const twiml = await handlerManager.generateTTSBasedTwiML(finalMessage, false, null);
  // Create a new TwiML response with hangup
  const twimlResponse = new (await import('twilio')).twiml.VoiceResponse();
  const audioUrl = twiml.match(/<Play>([^<]+)<\/Play>/)?.[1];
  if (audioUrl) {
    twimlResponse.play(audioUrl);
  }
  twimlResponse.hangup();
  res.type('text/xml');
  res.send(twimlResponse.toString());
  
  // Clean up call data
  logControllerOperation('handleSMSConsent.cleanup', { CallSid, requestId });
  await handlerManager.cleanupCall(CallSid);
  logControllerOperation('handleSMSConsent.completed', { CallSid, hasConsent, requestId });
}

  // Handle consent endpoint
  async function handleConsent(CallSid, SpeechResult, res) {
  const requestId = res.req?.requestContext?.requestId || 'unknown';
  
  try {
    logControllerOperation('handleConsent', { CallSid, SpeechResult, requestId });

    if (!CallSid || !SpeechResult) {
      logControllerOperation('handleConsent.error', { error: 'Missing required parameters', requestId }, 'error');
      logger.error('Missing required parameters in consent response');
      return res.status(400).send('Missing required parameters');
    }

    const call = handlerManager.activeCalls.get(CallSid);
    if (!call) {
      logControllerOperation('handleConsent.error', { CallSid, error: 'No active call found', requestId }, 'error');
      logger.error(`No active call found for CallSid: ${CallSid}`);
      const twiml = await handlerManager.generateTTSBasedTwiML("I'm sorry, I encountered an error. The call will now end.", false, null);
      const twimlResponse = new (await import('twilio')).twiml.VoiceResponse();
      const audioUrl = twiml.match(/<Play>([^<]+)<\/Play>/)?.[1];
      if (audioUrl) {
        twimlResponse.play(audioUrl);
      }
      twimlResponse.hangup();
      res.type('text/xml');
      return res.send(twimlResponse.toString());
    }

    // Process consent response (check if user said "yes")
    const hasConsent = SpeechResult.toLowerCase().includes('yes');
    call.hasConsent = hasConsent;
    handlerManager.activeCalls.set(CallSid, call);

    logControllerOperation('handleConsent.processed', { CallSid, hasConsent, requestId });

    // Generate and send summary if consent was given
    if (hasConsent) {
      logControllerOperation('handleConsent.generateSummary', { CallSid, requestId });
      const summary = await handlerManager.generateCallSummary(CallSid, call);
      await handlerManager.sendSMSWithRetry(CallSid, call, summary);
      logControllerOperation('handleConsent.smsSent', { CallSid, requestId });
    }

    // End the call with appropriate message
    const finalMessage = hasConsent ? 
      "Thank you. You will receive a text message with the summary and resources shortly." :
      "Thank you for reaching out. You're not alone, and help is always available. Take care and stay safe.";
    
    const twiml = await handlerManager.generateTTSBasedTwiML(finalMessage, false, null);
    
    // Create a new TwiML response with hangup
    const twimlResponse = new (await import('twilio')).twiml.VoiceResponse();
    const audioUrl = twiml.match(/<Play>([^<]+)<\/Play>/)?.[1];
    if (audioUrl) {
      twimlResponse.play(audioUrl);
    }
    twimlResponse.hangup();

    res.type('text/xml');
    res.send(twimlResponse.toString());

    // Clean up call data
    logControllerOperation('handleConsent.cleanup', { CallSid, requestId });
    await handlerManager.cleanupCall(CallSid);
    logControllerOperation('handleConsent.completed', { CallSid, hasConsent, requestId });
    
  } catch (error) {
    logControllerOperation('handleConsent.error', { CallSid, error: error.message, requestId }, 'error');
    logger.error('Error processing consent response:', error);
    const twiml = await handlerManager.generateTTSBasedTwiML("I'm sorry, I encountered an error. The call will now end.", false, null);
    const twimlResponse = new (await import('twilio')).twiml.VoiceResponse();
    const audioUrl = twiml.match(/<Play>([^<]+)<\/Play>/)?.[1];
    if (audioUrl) {
      twimlResponse.play(audioUrl);
    }
    twimlResponse.hangup();
    res.type('text/xml');
    res.send(twimlResponse.toString());
  }
}

  // Handle SMS endpoint
  async function handleSMS(From, Body, res) {
  const requestId = res.req?.requestContext?.requestId || 'unknown';
  
  try {
    logControllerOperation('handleSMS', { from: From, body: Body, requestId });

    const twiml = new (await import('twilio')).twiml.MessagingResponse();
    
    const consentKeywords = ['yes', 'agree', 'consent', 'ok', 'okay', 'sure'];
    const isConsentMessage = consentKeywords.some(keyword => 
      Body.toLowerCase().includes(keyword)
    );

    const optOutKeywords = ['stop', 'unsubscribe', 'opt out', 'cancel'];
    const isOptOutMessage = optOutKeywords.some(keyword => 
      Body.toLowerCase().includes(keyword)
    );

    if (isOptOutMessage) {
      logControllerOperation('handleSMS.optOut', { from: From, requestId });
      twiml.message('You have been unsubscribed from follow-up messages. You will no longer receive SMS updates.');
    } else if (isConsentMessage) {
      logControllerOperation('handleSMS.consent', { from: From, requestId });
      twiml.message('Thank you for your consent. You will receive follow-up messages about your call summary and support resources.');
    } else {
      logControllerOperation('handleSMS.prompt', { from: From, requestId });
      twiml.message('Thank you for your message. Would you like to receive follow-up messages about your call summary and support resources? Please reply with "yes" to consent.');
    }

    res.type('text/xml');
    res.send(twiml.toString());
    logControllerOperation('handleSMS.completed', { from: From, requestId });
    
  } catch (error) {
    logControllerOperation('handleSMS.error', { from: From, error: error.message, requestId }, 'error');
    logger.error('Error handling SMS:', error);
    res.status(500).send('Error processing SMS');
  }
}

  // Handle call status updates
  async function handleCallStatus(CallSid, CallStatus, res) {
  const requestId = res.req?.requestContext?.requestId || 'unknown';
  
  try {
    if (!CallSid || !CallStatus) {
      logControllerOperation('handleCallStatus.error', { CallSid, CallStatus, error: 'Missing required parameters', requestId }, 'error');
      logger.error('Missing required parameters in status update:', { CallSid, CallStatus });
      return res.status(400).send('Missing required parameters');
    }

    logControllerOperation('handleCallStatus', { CallSid, CallStatus, requestId });

    // Clear conversation context when call ends
    if (CallStatus === 'completed' || CallStatus === 'failed' || CallStatus === 'busy' || CallStatus === 'no-answer') {
      handlerManager.clearConversationContext(CallSid);
      logControllerOperation('handleCallStatus.clearContext', { CallSid, CallStatus, requestId });
    }

    await handlerManager.handleCallStatusUpdate(CallSid, CallStatus);
    res.status(200).send('OK');
    logControllerOperation('handleCallStatus.completed', { CallSid, CallStatus, requestId });
  } catch (error) {
    logControllerOperation('handleCallStatus.error', { CallSid, CallStatus, error: error.message, requestId }, 'error');
    logger.error('Error handling call status update:', error);
    res.status(200).send('OK');
  }
}

  // Handle recording completion
  function handleRecording(recordingSid, recordingUrl, callSid, res) {
    try {
      logControllerOperation('handleRecording', { recordingSid, recordingUrl, callSid });
      logger.info(`Recording completed for call ${callSid}`);
      logger.info(`Recording SID: ${recordingSid}`);
      logger.info(`Recording URL: ${recordingUrl}`);

      res.status(200).send('OK');
      logControllerOperation('handleRecording.completed', { recordingSid, recordingUrl, callSid });
    } catch (error) {
      logControllerOperation('handleRecording.error', { recordingSid, recordingUrl, callSid, error: error.message }, 'error');
      logger.error('Error handling recording:', error);
      res.status(500).send('Error processing recording');
    }
  }

  // Handle interim speech results
  async function handleInterimSpeech(CallSid, SpeechResult, res) {
  try {
    if (CallSid && SpeechResult) {
      logControllerOperation('handleInterimSpeech', { CallSid, SpeechResult });
      logger.info('Received interim speech result:', { CallSid, SpeechResult });
      
      // Store interim result for potential use in final processing
      const call = handlerManager.activeCalls.get(CallSid);
      if (call) {
        call.interimSpeechResult = SpeechResult;
        handlerManager.activeCalls.set(CallSid, call);
      }
    }
    
    // Return empty TwiML response for interim results
    const twiml = new (await import('twilio')).twiml.VoiceResponse();
    res.type('text/xml');
    res.send(twiml.toString());
    logControllerOperation('handleInterimSpeech.completed', { CallSid });
    
  } catch (error) {
    logControllerOperation('handleInterimSpeech.error', { CallSid, error: error.message }, 'error');
    logger.error('Error handling interim speech result:', error);
    
    // Return empty TwiML response even on error
    const twiml = new (await import('twilio')).twiml.VoiceResponse();
    res.type('text/xml');
    res.send(twiml.toString());
  }
}

  // Main process function that routes to appropriate handler based on request type
  async function processSpeechResult(callSid, speechResult, requestId, requestType = 'web') {
    logger.info('processSpeechResult called', {
      requestId,
      callSid,
      text: speechResult
    });
    logControllerOperation('processSpeechResult', { callSid, speechResult, requestId, requestType });
    logger.info('Processing speech result:', {
      requestId,
      callSid,
      speechResult,
      requestType,
      timestamp: new Date().toISOString()
    });

    try {
      // STEP 1: Always classify intent first
      let intent = null;
      try {
        intent = await getIntent(speechResult);
        logger.info('Classified intent', {
          requestId,
          callSid,
          intent
        });
      } catch (intentError) {
        logger.error('Error classifying intent:', {
          requestId,
          callSid,
          error: intentError.message,
          stack: intentError.stack
        });
        intent = 'general_information'; // Fallback intent
      }

      // STEP 2: Get conversation context for follow-up detection
      let context = null;
      try {
        context = callSid ? await handlerManager.getConversationContext(callSid) : null;
        logger.info('Retrieved conversation context', {
          requestId,
          callSid,
          context: context
        });
      } catch (contextError) {
        logger.error('Error getting conversation context:', {
          requestId,
          callSid,
          error: contextError.message,
          stack: contextError.stack
        });
        // Continue without context
      }

      // STEP 3: Check for follow-up questions using context
      let followUpResponse = null;
      try {
        followUpResponse = context?.lastQueryContext ? await handleFollowUp(speechResult, context.lastQueryContext) : null;
        logger.info('Follow-up question check', {
          requestId,
          callSid,
          isFollowUp: !!followUpResponse
        });
      } catch (followUpError) {
        logger.error('Error checking follow-up:', {
          requestId,
          callSid,
          error: followUpError.message,
          stack: followUpError.stack
        });
        // Continue without follow-up handling
      }

      // If this is a follow-up question, handle it directly
      if (followUpResponse) {
        logger.info('Processing follow-up response:', {
          requestId,
          callSid,
          followUpType: followUpResponse.type,
          hasResults: !!followUpResponse.results,
          resultCount: followUpResponse.results?.length || 0
        });

        // Update conversation context with follow-up response
        if (callSid) {
          try {
            await handlerManager.updateConversationContext(callSid, followUpResponse.intent || context?.lastIntent || 'general_information', speechResult, {
              voiceResponse: followUpResponse.voiceResponse,
              smsResponse: followUpResponse.smsResponse
            }, followUpResponse.results && followUpResponse.results.length > 0 ? { results: followUpResponse.results } : null);
          } catch (updateError) {
            logger.error('Error updating conversation context for follow-up:', {
              requestId,
              callSid,
              error: updateError.message
            });
          }
        }

        // Return appropriate format based on request type
        if (requestType === 'web') {
          return followUpResponse.voiceResponse || followUpResponse.smsResponse || 'No response available';
        }
        return followUpResponse.voiceResponse || followUpResponse.smsResponse || 'No response available';
      }

      // STEP 4: Handle provide_location intent
      if (intent === 'provide_location') {
        let location = null;
        try {
          location = await extractLocation(speechResult);
          logger.info('Extracted location for provide_location intent', {
            requestId,
            callSid,
            intent,
            location
          });
        } catch (locationError) {
          logger.error('Error extracting location for provide_location:', {
            requestId,
            callSid,
            error: locationError.message,
            stack: locationError.stack
          });
        }
        // Save location in context
        if (callSid) {
          try {
            await handlerManager.updateConversationContext(callSid, intent, speechResult, {
              voiceResponse: null,
              smsResponse: null
            }, null);
            logger.info('Updated conversation context for provide_location', {
              requestId,
              callSid,
              intent,
              location
            });
          } catch (updateError) {
            logger.error('Error updating conversation context for provide_location:', {
              requestId,
              callSid,
              error: updateError.message
            });
          }
        }
        // Prompt user for their needs
        const prompt = "Thank you for sharing your location. What kind of help are you looking for? For example: emergency housing, legal help, or counseling?";
        if (requestType === 'web') {
          return prompt;
        }
        return prompt;
      }

      // STEP 4: Extract location or use saved context location for location-seeking intents
      let location = null;
      const locationSeekingIntents = ['find_shelter', 'legal_services', 'counseling_services', 'other_resources'];
      const isLocationSeekingIntent = locationSeekingIntents.includes(intent);
      
      if (isLocationSeekingIntent) {
        try {
          // First try to extract location from current speech
          location = await extractLocation(speechResult);
          logger.info('Extracted location for location-seeking intent', {
            requestId,
            callSid,
            intent,
            location
          });
          
          // If no location found in current speech, check conversation context for saved location
          if (!location && context?.lastQueryContext?.location) {
            location = context.lastQueryContext.location;
            logger.info('Using saved location from conversation context', {
              requestId,
              callSid,
              intent,
              savedLocation: location,
              contextLocation: context.lastQueryContext.location
            });
          }
        } catch (locationError) {
          logger.error('Error extracting location:', {
            requestId,
            callSid,
            error: locationError.message,
            stack: locationError.stack
          });
        }

        // If no location found for location-seeking intent, generate location prompt
        if (!location) {
          logger.info('No location found for location-seeking intent, generating prompt:', {
            requestId,
            callSid,
            intent,
            speechResult,
            hasContext: !!context,
            contextLocation: context?.lastQueryContext?.location
          });
          try {
            return await generateLocationPrompt();
          } catch (promptError) {
            logger.error('Error generating location prompt:', {
              requestId,
              callSid,
              error: promptError.message
            });
            return "I'd be happy to help you find shelter. Could you please tell me which city, state, and country you're looking for?";
          }
        }
      } else {
        logger.info('Skipping location extraction for non-location-seeking intent:', {
          requestId,
          callSid,
          intent
        });
      }

      // STEP 5: Rewrite query with context for better search results
      let rewrittenQuery = null;
      try {
        rewrittenQuery = await rewriteQuery(speechResult, intent, callSid);
        logger.info('Rewritten query', {
          requestId,
          callSid,
          rewrittenQuery
        });
      } catch (rewriteError) {
        logger.error('Error rewriting query:', {
          requestId,
          callSid,
          error: rewriteError.message,
          stack: rewriteError.stack
        });
        rewrittenQuery = speechResult; // Use original query as fallback
      }

      // Defensive check and logging before Tavily API call
      logger.info('Type and value of rewrittenQuery before Tavily:', {
        type: typeof rewrittenQuery,
        value: rewrittenQuery
      });
      if (typeof rewrittenQuery !== 'string') {
        logger.error('rewrittenQuery is not a string, attempting to convert or throw error', {
          rewrittenQuery
        });
        if (rewrittenQuery && typeof rewrittenQuery.toString === 'function') {
          rewrittenQuery = rewrittenQuery.toString();
        } else {
          throw new Error('rewrittenQuery must be a string');
        }
      }

      // STEP 6: Call Tavily API with rewritten query
      logger.info('Calling Tavily API:', {
        requestId,
        callSid,
        query: rewrittenQuery
      });
      
      let response = null;
      try {
        response = await UnifiedResponseHandler.getResponse(rewrittenQuery, context, requestType, { maxResults: 3 });
        logger.info('UnifiedResponseHandler.getResponse result', {
          requestId,
          callSid,
          response
        });
      } catch (responseError) {
        logger.error('Error getting response from UnifiedResponseHandler:', {
          requestId,
          callSid,
          error: responseError.message,
          stack: responseError.stack
        });
        throw responseError; // Re-throw this error as it's critical
      }

      // Format response based on request type (web vs Twilio have different formats)
      const formattedResponse = requestType === 'web' ? response.webResponse : response.voiceResponse;
      logger.info('Formatted response', {
        requestId,
        callSid,
        formattedResponse
      });

      // Update conversation context for follow-up questions
      if (callSid) {
        try {
          await handlerManager.updateConversationContext(callSid, intent, rewrittenQuery, formattedResponse, response);
          logger.info('Updated conversation context', {
            requestId,
            callSid,
            intent
          });
        } catch (updateError) {
          logger.error('Error updating conversation context:', {
            requestId,
            callSid,
            error: updateError.message
          });
        }
      }

      // Return appropriate format based on request type
      if (requestType === 'web') {
        return formattedResponse;
      }
      return formattedResponse;
    } catch (error) {
      logControllerOperation('processSpeechResult.error', { callSid, speechResult, requestId, error: error.message }, 'error');
      logger.error('Error processing speech result:', {
        requestId,
        callSid,
        error: error.message,
        stack: error.stack,
        speechResult
      });
      throw error;
    }
  }

  // Helper function to handle follow-up questions
  async function handleFollowUp(speechResult, lastQueryContext) {
    // This function should be implemented based on the existing follow-up logic
    // For now, returning null to indicate no follow-up handling
    return null;
  }

  // Return all controller functions
  return {
    fetchCallDetails,
    cleanupAudioFile,
    getRequestType,
    handleSMSConsent,
    handleConsent,
    handleSMS,
    handleCallStatus,
    handleRecording,
    handleInterimSpeech,
    processSpeechResult
  };
} 