import express from 'express';
import { config } from '../lib/config.js';
import twilio from 'twilio';
import { validateTwilioRequest } from '../lib/twilio.js';
import path from 'path';
import fs from 'fs/promises';
import fsSync from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();
const twilioClient = twilio(config.TWILIO_ACCOUNT_SID, config.TWILIO_AUTH_TOKEN);

// Store WebSocket server instance
let wsServer = null;

// Method to set WebSocket server instance
router.setWebSocketServer = (server) => {
  wsServer = server;
};

// Function to fetch and log Twilio call details
async function logTwilioCallDetails(callSid) {
  try {
    // Fetch call details
    const call = await twilioClient.calls(callSid).fetch();
    console.log('Twilio Call Details:', {
      sid: call.sid,
      status: call.status,
      direction: call.direction,
      duration: call.duration,
      startTime: call.startTime,
      endTime: call.endTime,
      price: call.price,
      priceUnit: call.priceUnit
    });

    // Fetch call recordings
    const recordings = await twilioClient.recordings.list({ callSid });
    if (recordings.length > 0) {
      console.log('Call Recordings:', recordings.map(r => ({
        sid: r.sid,
        duration: r.duration,
        status: r.status,
        uri: r.uri
      })));
    }

    // Fetch call logs using the correct API
    const logs = await twilioClient.calls(callSid).fetch();
    console.log('Call Logs:', {
      timestamp: new Date().toISOString(),
      status: logs.status,
      duration: logs.duration,
      errorCode: logs.errorCode,
      errorMessage: logs.errorMessage,
      answeredBy: logs.answeredBy,
      parentCallSid: logs.parentCallSid
    });

  } catch (error) {
    console.error('Error fetching Twilio call details:', error);
    // Log additional error details for debugging
    if (error.code) {
      console.error('Twilio Error Code:', error.code);
    }
    if (error.moreInfo) {
      console.error('Twilio Error Info:', error.moreInfo);
    }
  }
}

// Clean up audio files
async function cleanupAudioFile(audioPath) {
  try {
    if (fsSync.existsSync(audioPath)) {
      await fs.unlink(audioPath);
      console.log('Cleaned up audio file:', audioPath);
    }
  } catch (error) {
    console.error('Error cleaning up audio file:', error);
  }
}

// Apply validation to all Twilio routes
router.use(validateTwilioRequest);

router.post('/voice', (req, res) => {
  try {
    console.log('Voice Route - Request Body:', req.body);
    console.log('Voice Route - CallSid:', req.body.CallSid);
    
    // Log Twilio call details when call starts
    logTwilioCallDetails(req.body.CallSid);
    
    const domain = req.get('host');
    const twiml = new twilio.twiml.VoiceResponse();

    // Add welcome message
    twiml.say({
      voice: 'Polly.Amy',
      language: 'en-US'
    }, 'Welcome to the Domestic Violence Support Assistant. I\'m here to help you.');

    // Add a pause to let the user respond
    twiml.pause({ length: 1 });

    // Configure speech recognition
    const gather = twiml.gather({
      input: 'speech',
      action: '/twilio/voice/process',
      method: 'POST',
      speechTimeout: 'auto',
      speechModel: 'phone_call',
      enhanced: 'true',
      language: 'en-US'
    });

    // Add a prompt for the user
    gather.say({
      voice: 'Polly.Amy',
      language: 'en-US'
    }, 'How can I help you today?');

    // Register the call with WebSocket server
    if (wsServer) {
      wsServer.registerCall(req.body.CallSid);
    }

    // Start media stream
    const connect = twiml.connect();
    connect.stream({
      url: `wss://${domain}/twilio-stream`,
      track: 'inbound_track'
    });

    const twimlString = twiml.toString();
    console.log('Generated TwiML:', twimlString);
    
    res.type('text/xml');
    res.send(twimlString);
  } catch (error) {
    console.error('Error in Twilio voice route:', error);
    res.status(500).send('Error processing voice request');
  }
});

// Handle call status updates
router.post('/status', async (req, res) => {
  try {
    const callSid = req.body.CallSid;
    const callStatus = req.body.CallStatus;

    console.log(`Call ${callSid} status: ${callStatus}`);

    // Log Twilio call details when status changes
    await logTwilioCallDetails(callSid);

    // Handle different call statuses
    switch (callStatus) {
      case 'completed':
      case 'failed':
      case 'busy':
      case 'no-answer':
        // Clean up audio files for this call
        if (wsServer && wsServer.audioService) {
          const audioDir = path.join(__dirname, '..', 'public', 'audio');
          fsSync.readdir(audioDir, (err, files) => {
            if (err) {
              console.error('Error reading audio directory:', err);
              return;
            }
            files.forEach(file => {
              if (file.endsWith('.mp3')) {
                const filePath = path.join(audioDir, file);
                cleanupAudioFile(filePath);
              }
            });
          });
        }
        break;
      case 'in-progress':
        // Log call start
        break;
      default:
        console.log(`Unhandled call status: ${callStatus}`);
    }

    res.status(200).send('OK');
  } catch (error) {
    console.error('Error handling call status:', error);
    res.status(500).send('Error processing call status');
  }
});

// Handle call recordings
router.post('/recording', (req, res) => {
  try {
    const recordingSid = req.body.RecordingSid;
    const recordingUrl = req.body.RecordingUrl;
    const callSid = req.body.CallSid;

    console.log(`Recording completed for call ${callSid}`);
    console.log(`Recording SID: ${recordingSid}`);
    console.log(`Recording URL: ${recordingUrl}`);

    res.status(200).send('OK');
  } catch (error) {
    console.error('Error handling recording:', error);
    res.status(500).send('Error processing recording');
  }
});

// Handle speech results
router.post('/voice/process', async (req, res) => {
  try {
    console.log('Processing speech result:', {
      callSid: req.body.CallSid,
      speechResult: req.body.SpeechResult,
      confidence: req.body.Confidence
    });

    if (!wsServer || !wsServer.audioService) {
      throw new Error('WebSocket server or audio service not initialized');
    }

    const twiml = new twilio.twiml.VoiceResponse();
    
    // Get GPT response for the speech result
    console.log('Getting GPT response...');
    const gptResponse = await wsServer.audioService.getGptReply(req.body.SpeechResult);
    console.log('GPT Response:', gptResponse);

    if (!gptResponse || !gptResponse.text) {
      throw new Error('Invalid GPT response');
    }

    // Truncate response if it's too long (Twilio has a limit)
    const maxResponseLength = 1000; // Adjust this value based on testing
    let truncatedText = gptResponse.text;
    if (truncatedText.length > maxResponseLength) {
      // First, try to find the last complete resource entry
      const resourceMatches = truncatedText.match(/\d+\.\s+\*\*[^*]+\*\*:.*?(?=\n\n|\d+\.\s+\*\*|$)/gs);
      if (resourceMatches) {
        // Find the last complete resource that fits within the limit
        let totalLength = 0;
        let lastCompleteResource = '';
        for (const resource of resourceMatches) {
          if (totalLength + resource.length <= maxResponseLength) {
            totalLength += resource.length;
            lastCompleteResource = resource;
          } else {
            break;
          }
        }
        
        // If we found a complete resource, use it
        if (lastCompleteResource) {
          const lastResourceIndex = truncatedText.lastIndexOf(lastCompleteResource) + lastCompleteResource.length;
          truncatedText = truncatedText.substring(0, lastResourceIndex);
        } else {
          // If no complete resource fits, find the last complete sentence
          const lastPeriod = truncatedText.substring(0, maxResponseLength).lastIndexOf('.');
          if (lastPeriod > 0) {
            truncatedText = truncatedText.substring(0, lastPeriod + 1);
          } else {
            // If no period found, find the last space
            const lastSpace = truncatedText.substring(0, maxResponseLength).lastIndexOf(' ');
            if (lastSpace > 0) {
              truncatedText = truncatedText.substring(0, lastSpace) + "...";
            } else {
              truncatedText = truncatedText.substring(0, maxResponseLength) + "...";
            }
          }
        }
      } else {
        // If no resource pattern found, fall back to sentence-based truncation
        const lastPeriod = truncatedText.substring(0, maxResponseLength).lastIndexOf('.');
        if (lastPeriod > 0) {
          truncatedText = truncatedText.substring(0, lastPeriod + 1);
        } else {
          const lastSpace = truncatedText.substring(0, maxResponseLength).lastIndexOf(' ');
          if (lastSpace > 0) {
            truncatedText = truncatedText.substring(0, lastSpace) + "...";
          } else {
            truncatedText = truncatedText.substring(0, maxResponseLength) + "...";
          }
        }
      }
    }

    // Generate TTS for the response
    console.log('Generating TTS...');
    const ttsResponse = await wsServer.audioService.generateTTS(truncatedText);
    console.log('TTS Response:', ttsResponse);

    if (!ttsResponse || !ttsResponse.audioPath) {
      throw new Error('Invalid TTS response');
    }

    // Get the full URL for the audio file
    const domain = req.get('host');
    const audioUrl = `https://${domain}${ttsResponse.audioPath}`;
    console.log('Audio URL:', audioUrl);

    // Verify the audio file exists using the fullPath from the TTS response
    const audioPath = ttsResponse.fullPath || path.join(process.cwd(), 'public', 'audio', path.basename(ttsResponse.audioPath));
    console.log('Checking audio file at:', audioPath);
    
    if (!fsSync.existsSync(audioPath)) {
      console.error('Audio file not found. Available paths:', {
        fullPath: ttsResponse.fullPath,
        audioPath: ttsResponse.audioPath,
        checkedPath: audioPath,
        cwd: process.cwd()
      });
      throw new Error('Audio file not found: ' + audioPath);
    }

    // First play the response
    twiml.play(audioUrl);

    // Add a pause to let the user respond
    twiml.pause({ length: 2 });

    // Then set up the next gather
    const gather = twiml.gather({
      input: 'speech',
      action: '/twilio/voice/process',
      method: 'POST',
      speechTimeout: 'auto',
      speechModel: 'phone_call',
      enhanced: 'true',
      language: 'en-US',
      timeout: 10
    });

    gather.say({
      voice: 'Polly.Amy',
      language: 'en-US'
    }, 'How else can I help you?');

    const twimlString = twiml.toString();
    console.log('Generated TwiML:', twimlString);
    
    res.type('text/xml');
    res.send(twimlString);
  } catch (error) {
    console.error('Error processing speech result:', error);
    console.error('Error stack:', error.stack);
    
    // Generate error TwiML
    const twiml = new twilio.twiml.VoiceResponse();
    twiml.say({
      voice: 'Polly.Amy',
      language: 'en-US'
    }, 'I apologize, but I encountered an error. Please try again.');

    // Add a pause
    twiml.pause({ length: 1 });

    // Set up the next gather
    const gather = twiml.gather({
      input: 'speech',
      action: '/twilio/voice/process',
      method: 'POST',
      speechTimeout: 'auto',
      speechModel: 'phone_call',
      enhanced: 'true',
      language: 'en-US'
    });

    gather.say({
      voice: 'Polly.Amy',
      language: 'en-US'
    }, 'How can I help you?');

    const twimlString = twiml.toString();
    console.log('Error TwiML:', twimlString);
    
    res.type('text/xml');
    res.send(twimlString);
  }
});

export default router; 