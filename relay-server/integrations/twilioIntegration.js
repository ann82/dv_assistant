import twilio from 'twilio';
import logger from '../lib/logger.js';
import { v4 as uuidv4 } from 'uuid';

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const phoneNumber = process.env.TWILIO_PHONE_NUMBER;

if (!accountSid || !authToken || !phoneNumber) {
  logger.error('Twilio credentials not found in environment variables');
  throw new Error('Twilio credentials not found in environment variables');
}

const twilioClient = twilio(accountSid, authToken);

/**
 * Log Twilio integration operation with consistent format
 * @param {string} operation - Operation being performed
 * @param {Object} data - Data to log
 * @param {string} level - Log level (info, warn, error, debug)
 * @param {string} requestId - Optional request ID for tracking
 */
function logTwilioOperation(operation, data = {}, level = 'info', requestId = null) {
  const logData = {
    integration: 'Twilio',
    operation,
    requestId: requestId || uuidv4(),
    timestamp: new Date().toISOString(),
    ...data
  };
  
  logger[level](`Twilio Integration - ${operation}:`, logData);
}

export const TwilioIntegration = {
  sendSMS: async (to, body, requestId = null) => {
    const operationId = requestId || uuidv4();
    
    try {
      logTwilioOperation('sendSMS.start', { to, bodyLength: body?.length }, 'info', operationId);
      
      const message = await twilioClient.messages.create({
        body,
        from: phoneNumber,
        to
      });
      
      logTwilioOperation('sendSMS.success', { 
        to, 
        sid: message.sid, 
        status: message.status,
        bodyLength: body?.length 
      }, 'info', operationId);
      
      return message;
    } catch (error) {
      logTwilioOperation('sendSMS.error', { 
        to, 
        error: error.message, 
        errorCode: error.code,
        bodyLength: body?.length 
      }, 'error', operationId);
      
      logger.error('Error sending SMS via Twilio:', {
        error: error.message,
        code: error.code,
        status: error.status,
        requestId: operationId
      });
      throw error;
    }
  },

  makeCall: async (to, twimlUrl, requestId = null) => {
    const operationId = requestId || uuidv4();
    
    try {
      logTwilioOperation('makeCall.start', { to, twimlUrl }, 'info', operationId);
      
      const call = await twilioClient.calls.create({
        url: twimlUrl,
        to,
        from: phoneNumber
      });
      
      logTwilioOperation('makeCall.success', { 
        to, 
        sid: call.sid, 
        status: call.status,
        twimlUrl 
      }, 'info', operationId);
      
      return call;
    } catch (error) {
      logTwilioOperation('makeCall.error', { 
        to, 
        error: error.message, 
        errorCode: error.code,
        twimlUrl 
      }, 'error', operationId);
      
      logger.error('Error making call via Twilio:', {
        error: error.message,
        code: error.code,
        status: error.status,
        requestId: operationId
      });
      throw error;
    }
  },

  fetchCallDetails: async (callSid, requestId = null) => {
    const operationId = requestId || uuidv4();
    
    try {
      logTwilioOperation('fetchCallDetails.start', { callSid }, 'info', operationId);
      
      const call = await twilioClient.calls(callSid).fetch();
      
      logTwilioOperation('fetchCallDetails.success', {
        callSid: call.sid,
        status: call.status,
        from: call.from,
        to: call.to,
        duration: call.duration,
        startTime: call.startTime,
        endTime: call.endTime
      }, 'info', operationId);
      
      return call;
    } catch (error) {
      logTwilioOperation('fetchCallDetails.error', { 
        callSid, 
        error: error.message, 
        errorCode: error.code 
      }, 'error', operationId);
      
      logger.error('Error fetching Twilio call details:', {
        callSid,
        error: error.message,
        code: error.code,
        status: error.status,
        requestId: operationId
      });
      return null;
    }
  },

  // Add more Twilio-related methods as needed
}; 