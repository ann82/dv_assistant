import Fastify from 'fastify';
import http from 'http';
import WebSocket from 'ws';
import dotenv from 'dotenv';
import url from 'url';
import { instructions } from '../utils/conversation_config.js';
import fastifyFormBody from '@fastify/formbody';
import fastifyWebsocket from '@fastify/websocket';


// Load environment variables from .env file
dotenv.config();

// Retrieve the OpenAI API key from environment variables.
const OPENAI_API_KEY  = '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';

if (!OPENAI_API_KEY) {
    console.error('Missing OpenAI API key. Please set it in the .env file.');
    process.exit(1);
}

// Constants
const SYSTEM_MESSAGE = 'You are a helpful and bubbly AI assistant who loves to chat about anything the user is interested about and is prepared to offer them facts. You have a penchant for dad jokes, owl jokes, and rickrolling – subtly. Always stay positive, but work in a joke when appropriate.';
const VOICE = 'alloy';
const PORT = process.env.PORT || 5050; // Allow dynamic port assignment
const SHOW_TIMING_MATH = false;


// Create Fastify instance
const fastify = Fastify();
fastify.register(fastifyFormBody);
fastify.register(fastifyWebsocket);

// Root Route
fastify.get('/', async (request, reply) => {
    reply.send({ message: 'Twilio Media Stream Server is running!' });
});

// Route for Twilio to handle incoming calls
fastify.all('/incoming-call', async (request, reply) => {
    const twimlResponse = `<?xml version="1.0" encoding="UTF-8"?>
                          <Response>
                              <Say>Please wait while we connect your call to the Harbor Domestic Violence Helpline AI voice assistant</Say>
                              <Pause length="1"/>
                              <Say>O.K. you can start talking!</Say>
                              <Connect>
                                  <Stream url="wss://${request.headers.host}/media-stream" />
                              </Connect>
                          </Response>`;

    reply.type('text/xml').send(twimlResponse);
});

// WebSocket route for media-stream
fastify.get('/media-stream', { websocket: true }, (connection, req) => {
    console.log('Client connected');

    // Connection-specific state
    let streamSid = null;
    let latestMediaTimestamp = 0;
    let lastAssistantItem = null;
    let markQueue = [];
    let responseStartTimestampTwilio = null;

    const openAiWs = new WebSocket('wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01', {
        headers: {
            Authorization: `Bearer ${OPENAI_API_KEY}`,
            "OpenAI-Beta": "realtime=v1"
        }
    });

    const initializeSession = () => {
        const sessionUpdate = {
            type: 'session.update',
            session: {
                turn_detection: { type: 'server_vad' },
                input_audio_format: 'g711_ulaw',
                output_audio_format: 'g711_ulaw',
                voice: VOICE,
                instructions: instructions,
                modalities: ["text", "audio"],
                temperature: 0.8,
            }
        };

        console.log('Sending session update:', JSON.stringify(sessionUpdate));
        openAiWs.send(JSON.stringify(sessionUpdate));
    };

    openAiWs.on('open', () => {
        console.log('Connected to the OpenAI Realtime API');
        setTimeout(initializeSession, 100);
    });

    openAiWs.on('message', (data) => {
        try {
            const response = JSON.parse(data.toString());

            if (response.type === 'response.audio.delta' && response.delta) {
                const audioDelta = {
                    event: 'media',
                    streamSid: streamSid,
                    media: { payload: Buffer.from(response.delta, 'base64').toString('base64') }
                };
                connection.socket.send(JSON.stringify(audioDelta));

                if (!responseStartTimestampTwilio) {
                    responseStartTimestampTwilio = latestMediaTimestamp;
                    if (SHOW_TIMING_MATH) console.log(`Setting start timestamp for new response: ${responseStartTimestampTwilio}ms`);
                }

                if (response.item_id) {
                    lastAssistantItem = response.item_id;
                }
            }

            if (response.type === 'input_audio_buffer.speech_started') {
                if (markQueue.length > 0 && responseStartTimestampTwilio != null) {
                    const elapsedTime = latestMediaTimestamp - responseStartTimestampTwilio;
                    if (SHOW_TIMING_MATH) console.log(`Calculating elapsed time for truncation: ${latestMediaTimestamp} - ${responseStartTimestampTwilio} = ${elapsedTime}ms`);

                    if (lastAssistantItem) {
                        const truncateEvent = {
                            type: 'conversation.item.truncate',
                            item_id: lastAssistantItem,
                            content_index: 0,
                            audio_end_ms: elapsedTime
                        };
                        if (SHOW_TIMING_MATH) console.log('Sending truncation event:', JSON.stringify(truncateEvent));
                        openAiWs.send(JSON.stringify(truncateEvent));
                    }

                    connection.socket.send(JSON.stringify({
                        event: 'clear',
                        streamSid: streamSid
                    }));

                    markQueue = [];
                    lastAssistantItem = null;
                    responseStartTimestampTwilio = null;
                }
            }
        } catch (error) {
            console.error('Error processing OpenAI message:', error, 'Raw message:', data);
        }
    });

    connection.socket.on('message', (message) => {
        try {
            const data = JSON.parse(message);

            switch (data.event) {
                case 'media':
                    latestMediaTimestamp = data.media.timestamp;
                    if (SHOW_TIMING_MATH) console.log(`Received media message with timestamp: ${latestMediaTimestamp}ms`);
                    if (openAiWs.readyState === WebSocket.OPEN) {
                        const audioAppend = {
                            type: 'input_audio_buffer.append',
                            audio: data.media.payload
                        };
                        openAiWs.send(JSON.stringify(audioAppend));
                    }
                    break;
                case 'start':
                    streamSid = data.start.streamSid;
                    console.log('Incoming stream has started', streamSid);

                    responseStartTimestampTwilio = null;
                    latestMediaTimestamp = 0;
                    break;
                case 'mark':
                    if (markQueue.length > 0) {
                        markQueue.shift();
                    }
                    break;
                default:
                    console.log('Received non-media event:', data.event);
                    break;
            }
        } catch (error) {
            console.error('Error parsing message:', error, 'Message:', message);
        }
    });

    connection.socket.on('close', () => {
        if (openAiWs.readyState === WebSocket.OPEN) openAiWs.close();
        console.log('Client disconnected.');
    });

    openAiWs.on('close', () => {
        console.log('Disconnected from the OpenAI Realtime API');
    });

    openAiWs.on('error', (error) => {
        console.error('Error in the OpenAI WebSocket:', error);
    });
});

// Start the server
fastify.listen({ port: PORT }, (err) => {
    if (err) {
        console.error(err);
        process.exit(1);
    }
    console.log(`Server is listening on port ${PORT}`);
});
