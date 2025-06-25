import React from 'react';
import { useEffect, useRef, useCallback, useState } from 'react';
import { RealtimeClient } from '@openai/realtime-api-beta';
import { ItemType } from '@openai/realtime-api-beta/dist/lib/client.js';
import { WavRecorder, WavStreamPlayer } from '../lib/wavtools/index.js';
import { SpeechHandler } from '../lib/speech';
import { instructions } from '../utils/conversation_config.js';
import { WavRenderer } from '../utils/wav_renderer';
import { X, Edit, Zap, ArrowUp, ArrowDown } from 'react-feather';
import { Button } from '../components/button/Button';
import { Map } from '../components/Map';
import './ConsolePage.scss';

/**
 * Running a local relay server will allow you to hide your API key
 * and run custom logic on the server
 *
 * Set the local relay server address to:
 * REACT_APP_LOCAL_RELAY_SERVER_URL=http://localhost:8081
 *
 * This will also require you to set OPENAI_API_KEY= in a `.env` file
 * You can run it with `npm run relay`, in parallel with `npm start`
 */
const LOCAL_RELAY_SERVER_URL: string =
  process.env.REACT_APP_LOCAL_RELAY_SERVER_URL || '';

// Add Tavily API key from environment
const TAVILY_API_KEY = process.env.REACT_APP_TAVILY_API_KEY || '';

/**
 * Type for result from get_weather() function call
 */
interface Coordinates {
  lat: number;
  lng: number;
  location?: string;
  allows_children?: string;
}

/**
 * Type for all event logs
 */
interface RealtimeEvent {
  time: string;
  source: 'client' | 'server';
  count?: number;
  event: { [key: string]: any };
}

// Add interface for shelter search results
interface ShelterSearchResult {
  name: string;
  address: string;
  phone: string;
  description: string;
  distance?: string;
  services?: string[];
}

// Add interface for location
interface UserLocation {
  latitude: number;
  longitude: number;
  city?: string;
  state?: string;
  country?: string;
}

// Add interface for cache entry
interface ShelterCacheEntry {
  results: ShelterSearchResult[];
  timestamp: number;
  location: string;
  services?: string[];
}

// Add cache implementation
const SHELTER_CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

class ShelterCache {
  private cache: { [key: string]: ShelterCacheEntry } = {};

  private getKey(location: string, services?: string[]): string {
    return `${location}:${services?.sort().join(',') || ''}`;
  }

  private isEntryValid(entry: ShelterCacheEntry): boolean {
    return Date.now() - entry.timestamp < SHELTER_CACHE_EXPIRY;
  }

  get(location: string, services?: string[]): ShelterSearchResult[] | null {
    const key = this.getKey(location, services);
    const entry = this.cache[key];
    if (entry && this.isEntryValid(entry)) {
      console.log('📦 Using cached results for:', location);
      return entry.results;
    }
    return null;
  }

  set(location: string, results: ShelterSearchResult[], services?: string[]): void {
    const key = this.getKey(location, services);
    this.cache[key] = {
      results,
      timestamp: Date.now(),
      location,
      services
    };
    console.log('📦 Cached results for:', location);
  }

  // Add method to clear expired entries
  clearExpired(): void {
    const now = Date.now();
    Object.keys(this.cache).forEach(key => {
      if (now - this.cache[key].timestamp >= SHELTER_CACHE_EXPIRY) {
        delete this.cache[key];
        console.log('🗑️ Cleared expired cache entry for:', this.cache[key].location);
      }
    });
  }
}

// Initialize cache
const shelterCache = new ShelterCache();

// Add cache helper functions with explicit return types
const getCachedResults = (location: string, services?: string[]): ShelterSearchResult[] | null => {
  return shelterCache.get(location, services);
};

const setCachedResults = (location: string, results: ShelterSearchResult[], services?: string[]): void => {
  shelterCache.set(location, results, services);
};

// Add periodic cleanup of expired cache entries
setInterval(() => {
  shelterCache.clearExpired();
}, SHELTER_CACHE_EXPIRY);

export function ConsolePage() {
  /**
   * Ask user for API Key
   * If we're using the local relay server, we don't need this
   */
  const apiKey = LOCAL_RELAY_SERVER_URL
    ? ''
    : localStorage.getItem('tmp::voice_api_key') ||
      prompt('OpenAI API Key') ||
      '';
  if (apiKey !== '') {
    localStorage.setItem('tmp::voice_api_key', apiKey);
  }

  /**
   * Instantiate:
   * - WavRecorder (speech input)
   * - RealtimeClient (API client)
   */
  const wavRecorderRef = useRef<WavRecorder>(
    new WavRecorder({ sampleRate: 24000 })
  );
  const clientRef = useRef<RealtimeClient>(
    new RealtimeClient(
      LOCAL_RELAY_SERVER_URL
        ? { url: LOCAL_RELAY_SERVER_URL }
        : {
            apiKey: apiKey,
            dangerouslyAllowAPIKeyInBrowser: true,
          }
    )
  );

  /**
   * References for
   * - Rendering audio visualization (canvas)
   * - Autoscrolling event logs
   * - Timing delta for event log displays
   */
  const clientCanvasRef = useRef<HTMLCanvasElement>(null);
  const serverCanvasRef = useRef<HTMLCanvasElement>(null);
  const eventsScrollHeightRef = useRef(0);
  const eventsScrollRef = useRef<HTMLDivElement>(null);
  const startTimeRef = useRef<string>(new Date().toISOString());

  /**
   * All of our variables for displaying application state
   * - items are all conversation items (dialog)
   * - realtimeEvents are event logs, which can be expanded
   * - memoryKv is for set_memory() function
   * - coords, marker are for get_weather() function
   */
  const [items, setItems] = useState<ItemType[]>([]);
  const [realtimeEvents, setRealtimeEvents] = useState<RealtimeEvent[]>([]);
  const [expandedEvents, setExpandedEvents] = useState<{
    [key: string]: boolean;
  }>({});
  const [isConnected, setIsConnected] = useState(false);
  const [vadState, setVadState] = useState<'listening' | 'processing' | 'error' | null>(null);
  const [memoryKv, setMemoryKv] = useState<{ [key: string]: any }>({});
  const [coords, setCoords] = useState<Coordinates | null>({
    lat: 37.775593,
    lng: -122.418137,
  });
  const [marker, setMarker] = useState<Coordinates | null>(null);
  const [rateLimited, setRateLimited] = useState(false);
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);

  // Add speech handler
  const speechHandlerRef = useRef<SpeechHandler>(new SpeechHandler());

  /**
   * Utility for formatting the timing of logs
   */
  const formatTime = useCallback((timestamp: string) => {
    const startTime = startTimeRef.current;
    const t0 = new Date(startTime).valueOf();
    const t1 = new Date(timestamp).valueOf();
    const delta = t1 - t0;
    const hs = Math.floor(delta / 10) % 100;
    const s = Math.floor(delta / 1000) % 60;
    const m = Math.floor(delta / 60_000) % 60;
    const pad = (n: number) => {
      let s = n + '';
      while (s.length < 2) {
        s = '0' + s;
      }
      return s;
    };
    return `${pad(m)}:${pad(s)}.${pad(hs)}`;
  }, []);

  /**
   * When you click the API key
   */
  const resetAPIKey = useCallback(() => {
    const apiKey = prompt('OpenAI API Key');
    if (apiKey !== null) {
      localStorage.clear();
      localStorage.setItem('tmp::voice_api_key', apiKey);
      window.location.reload();
    }
  }, []);

  /**
   * Connect to conversation:
   * WavRecorder taks speech input, RealtimeClient is API client
   */
  const connectConversation = useCallback(async () => {
    const client = clientRef.current;
    const wavRecorder = wavRecorderRef.current;

    try {
      // Set state variables
      startTimeRef.current = new Date().toISOString();
      setIsConnected(true);
      setRealtimeEvents([]);
      setItems(client.conversation.getItems());
      setVadState('listening'); // Set initial VAD state

      // Connect to microphone
      await wavRecorder.begin();

      // Connect to realtime API
      await client.connect();
      
      // Set VAD mode explicitly
      client.updateSession({ turn_detection: { type: 'server_vad' } });
      
      // Start VAD recording immediately
      await wavRecorder.record((data) => {
        client.appendInputAudio(data.mono);
        setVadState('processing'); // Update state when processing audio
      });

      client.sendUserMessageContent([
        {
          type: `input_text`,
          text: `Hello! I am an AI assistant trained to help you and your information is protected. How can I help you?`,
        },
      ]);
    } catch (error) {
      console.error('Error during connection:', error);
      setVadState('error');
      // Handle connection errors appropriately
    }
  }, []);

  /**
   * Disconnect and reset conversation state
   */
  const disconnectConversation = useCallback(async () => {
    setIsConnected(false);
    setRealtimeEvents([]);
    setItems([]);
    setMemoryKv({});
    setCoords({
      lat: 37.775593,
      lng: -122.418137,
    });
    setMarker(null);

    // Stop speech synthesis
    speechHandlerRef.current.stop();

    const client = clientRef.current;
    client.disconnect();

    const wavRecorder = wavRecorderRef.current;
    await wavRecorder.end();
  }, []);

  const deleteConversationItem = useCallback(async (id: string) => {
    const client = clientRef.current;
    client.deleteItem(id);
  }, []);

  /**
   * Auto-scroll the event logs
   */
  useEffect(() => {
    if (eventsScrollRef.current) {
      const eventsEl = eventsScrollRef.current;
      const scrollHeight = eventsEl.scrollHeight;
      // Only scroll if height has just changed
      if (scrollHeight !== eventsScrollHeightRef.current) {
        eventsEl.scrollTop = scrollHeight;
        eventsScrollHeightRef.current = scrollHeight;
      }
    }
  }, [realtimeEvents]);

  /**
   * Auto-scroll the conversation logs
   */
  useEffect(() => {
    const conversationEls = [].slice.call(
      document.body.querySelectorAll('[data-conversation-content]')
    );
    for (const el of conversationEls) {
      const conversationEl = el as HTMLDivElement;
      conversationEl.scrollTop = conversationEl.scrollHeight;
    }
  }, [items]);

  /**
   * Set up render loops for the visualization canvas
   */
  useEffect(() => {
    let isLoaded = true;

    const wavRecorder = wavRecorderRef.current;
    const clientCanvas = clientCanvasRef.current;
    let clientCtx: CanvasRenderingContext2D | null = null;

    const render = () => {
      if (isLoaded) {
        if (clientCanvas) {
          if (!clientCanvas.width || !clientCanvas.height) {
            clientCanvas.width = clientCanvas.offsetWidth;
            clientCanvas.height = clientCanvas.offsetHeight;
          }
          clientCtx = clientCtx || clientCanvas.getContext('2d');
          if (clientCtx) {
            clientCtx.clearRect(0, 0, clientCanvas.width, clientCanvas.height);
            const result = wavRecorder.recording
              ? wavRecorder.getFrequencies('voice')
              : { values: new Float32Array([0]) };
            WavRenderer.drawBars(
              clientCanvas,
              clientCtx,
              result.values,
              '#0099ff',
              10,
              0,
              8
            );
          }
        }
        window.requestAnimationFrame(render);
      }
    };
    render();

    return () => {
      isLoaded = false;
    };
  }, []);

  /**
   * Move getCurrentLocation inside the component
   */
  const getCurrentLocation = useCallback(() => {
    return new Promise<UserLocation>((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation is not supported by your browser'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          
          // Reverse geocode to get city name
          try {
            const response = await fetch(
              `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`
            );
            const data = await response.json();
            
            resolve({
              latitude,
              longitude,
              city: data.address?.city || data.address?.town,
              state: data.address?.state,
              country: data.address?.country
            });
          } catch (error) {
            // If reverse geocoding fails, still return coordinates
            resolve({ latitude, longitude });
          }
        },
        (error) => {
          reject(error);
        }
      );
    });
  }, []);

  /**
   * Core RealtimeClient and audio capture setup
   * Set all of our instructions, tools, events and more
   */
  useEffect(() => {
    // Get refs
    const client = clientRef.current;
    const shelters = [
      { id: 1, name: 'La Casa de las Madres',lat: 37.7610277, lng: -122.4690144, location: 'San Francisco', allows_children: true },
      { id: 2, name: 'Asian Womens Shelter', lat: 37.7614492, lng: -122.4227025, location: 'San Francisco',  allows_children: false },
      { id: 3, name: 'Riley Center, St Vincent de Paul', lat: 37.7766628, lng: -122.4107561, location: 'San Francisco', allows_children: true },
      { id: 4, name: 'A Womans Place', lat: 37.7785507, lng: -123.4629249, location: 'San Francisco', allows_children: false },
  
    ];
    const urls=['https://www.thehotline.org/','https://www.womensv.org/'];

    // Set instructions
    client.updateSession({ instructions: instructions });
    // Set transcription, otherwise we don't get user transcriptions back
    client.updateSession({ input_audio_transcription: { model: 'whisper-1' } });

    // Add tools
    client.addTool(
      {
        name: 'set_memory',
        description: 'Saves important data about the user into memory.',
        parameters: {
          type: 'object',
          properties: {
            key: {
              type: 'string',
              description:
                'The key of the memory value. Always use lowercase and underscores, no other characters.',
            },
            value: {
              type: 'string',
              description: 'Value can be anything represented as a string',
            },
          },
          required: ['key', 'value'],
        },
      },
      async ({ key, value }: { [key: string]: any }) => {
        setMemoryKv((memoryKv) => {
          const newKv = { ...memoryKv };
          newKv[key] = value;
          return newKv;
        });
        return { ok: true };
      }
    );
    client.addTool(
      {
        name: 'get_list_of_shelters',
        description:
          'Retrieves the list of shelters by location for the user.',
        parameters: {
          type: 'object',
          properties: {
            location: {
              type: 'string',
              description: 'Name of the location',
            },
            allows_children: {
              type: 'string',
              description: 'Does the location allow children?',
            },
          },
          required: ['location', 'allows_children'],
        },
      },
      async ({location, allows_children }: { [key: string]: any }) => {
        // Use shelters variable initialized outside of this code
        const filteredShelters = Object.entries(shelters).filter(([
        , { location: location, allows_children: shelterAllowsChildren }
        ]) => {
        return allows_children == null || shelterAllowsChildren === allows_children;
        });
    
        if (filteredShelters.length > 0) {
          const [, { lat: shelterLat, lng: shelterLng }] = filteredShelters[0];
          setMarker({ lat: shelterLat, lng: shelterLng, location });
          setCoords({ lat: shelterLat, lng: shelterLng, location });
        }
    
        return filteredShelters;
      }
    );
    client.addTool(
      {
        name: 'fetch_resources_from_urls',
        description:
          'Fetches resources from multiple URLs and returns their content.',
        parameters: {
          type: 'object',
          properties: {
            urls: {
              type: 'array',
              items: {
                type: 'string',
              },
              description: 'List of URLs to fetch resources from',
            },
          },
          required: ['urls'],
        },
      },
      async ({ urls }: { [key: string]: any }) => {
        const fetchPromises = urls.map(async (url: string) => {
          try {
            const response = await fetch(url);
            if (!response.ok) {
              throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
            }
            const data = await response.text();
            return { url, data };
          } catch (error) {
            return { url, error: error instanceof Error ? error.message : 'Unknown error' };
          }
        });
    
        const results = await Promise.all(fetchPromises);
        return results;
      }
    );
    
    // Add search_shelters tool
    client.addTool(
      {
        name: 'search_shelters',
        description: 'Searches for domestic violence shelters and support services in a given location.',
        parameters: {
          type: 'object',
          properties: {
            location: {
              type: 'string',
              description: 'City or location to search for shelters. If not provided, will use user\'s current location.',
            },
            services: {
              type: 'array',
              items: {
                type: 'string',
              },
              description: 'Specific services needed (e.g., emergency housing, counseling, legal aid)',
            },
            useCurrentLocation: {
              type: 'boolean',
              description: 'Whether to use the user\'s current location instead of the provided location',
            },
          },
          required: [],
        },
      },
      async ({ location, services, useCurrentLocation }: { 
        location?: string; 
        services?: string[]; 
        useCurrentLocation?: boolean 
      }) => {
        if (!TAVILY_API_KEY) {
          console.error('❌ Tavily API key is not configured');
          throw new Error('Tavily API key is not configured');
        }

        try {
          let searchLocation = location || '';
          
          // If useCurrentLocation is true or no location provided, get current location
          if (useCurrentLocation || !location) {
            try {
              console.log('📍 Attempting to get current location...');
              const currentLocation = await getCurrentLocation();
              console.log('📍 Current location obtained:', {
                city: currentLocation.city,
                state: currentLocation.state,
                country: currentLocation.country,
                coordinates: `${currentLocation.latitude},${currentLocation.longitude}`
              });
              setUserLocation(currentLocation);
              searchLocation = currentLocation.city || `${currentLocation.latitude},${currentLocation.longitude}`;
            } catch (error) {
              console.error('❌ Error getting location:', error);
              setLocationError('Could not get your current location. Please specify a location.');
              throw new Error('Could not get current location. Please specify a location.');
            }
          }

          // Check cache first
          const cachedResults = getCachedResults(searchLocation, services);
          if (cachedResults) {
            console.log('📦 Using cached results for:', searchLocation);
            return cachedResults;
          }

          // Build search query
          let query = `domestic violence shelters in ${searchLocation}`;
          if (services && services.length > 0) {
            query += ` that offer ${services.join(', ')}`;
          }

          // Make API request to Tavily
          console.log('🔍 Searching for shelters with query:', query);
          const response = await fetch('https://api.tavily.com/search', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${TAVILY_API_KEY}`
            },
            body: JSON.stringify({
              query,
              search_depth: 'advanced',
              max_results: 10,
              include_answer: true,
              include_raw_content: false
            })
          });

          if (!response.ok) {
            throw new Error(`Failed to search shelters: ${response.statusText}`);
          }

          const data = await response.json();
          
          // Process results
          const results: ShelterSearchResult[] = data.results.map((result: any) => ({
            name: result.title,
            address: result.url,
            phone: result.raw_content ? (result.raw_content.match(/phone:?\s*([\d-]+)/i)?.[1] || 'Not available') : 'Not available',
            description: result.content,
            services: services || [],
            distance: result.raw_content ? (result.raw_content.match(/distance:?\s*([\d.]+)\s*(miles|km)/i)?.[0] || undefined) : undefined
          }));

          // Cache results
          setCachedResults(searchLocation, results, services);

          return results;
        } catch (error) {
          console.error('❌ Error searching shelters:', error);
          throw new Error(`Failed to search shelters: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }
    );
    
    // handle realtime events from client + server for event logging
    client.on('realtime.event', (realtimeEvent: RealtimeEvent) => {
      setRealtimeEvents((realtimeEvents) => {
        const lastEvent = realtimeEvents[realtimeEvents.length - 1];
        if (lastEvent?.event.type === realtimeEvent.event.type) {
          // if we receive multiple events in a row, aggregate them for display purposes
          lastEvent.count = (lastEvent.count || 0) + 1;
          return realtimeEvents.slice(0, -1).concat(lastEvent);
        } else {
          return realtimeEvents.concat(realtimeEvent);
        }
      });
    });
    client.on('error', (event: any) => console.error(event));
    client.on('conversation.interrupted', async () => {
      await client.cancelResponse('', 0);
    });
    client.on('conversation.updated', async ({ item, delta }: any) => {
      const items = client.conversation.getItems();
      if (item.status === 'completed' && item.role === 'assistant') {
        // Only speak important responses
        const text = item.formatted.text || item.formatted.transcript;
        if (text && 
            !text.includes('function_call_output') && 
            !text.includes('tool') && 
            !text.includes('I apologize') && 
            !text.includes('encountered an error')) {
          try {
            await speechHandlerRef.current.speak(text);
          } catch (error) {
            console.error('Error speaking text:', error);
          }
        }
      }
      setItems(items);
    });

    setItems(client.conversation.getItems());

    // Set initial turn detection mode to VAD
    client.updateSession({ turn_detection: { type: 'server_vad' } });

    // Add error handler for rate limits
    client.on('error', async (error: any) => {
      if (error.message?.includes('429')) {
        console.warn('🔥 Rate limited (429) – restarting session after cooldown...');
        setRateLimited(true);
        await disconnectConversation();
        await new Promise((r) => setTimeout(r, 10000)); // 10 sec backoff
        setRateLimited(false);
        await connectConversation();
      }
    });

    return () => {
      // cleanup; resets to defaults
      client.reset();
    };
  }, [getCurrentLocation]);

  // Initialize speech handler
  useEffect(() => {
    const initSpeech = async () => {
      try {
        await speechHandlerRef.current.init();
      } catch (error) {
        console.error('Error initializing speech:', error);
      }
    };
    initSpeech();
  }, []);

  /**
   * Render the application
   */
  return (
    <div data-component="ConsolePage">
      {rateLimited && (
        <div className="rate-limit-alert">
          ⚠️ You're being rate-limited. Retrying shortly...
        </div>
      )}
      <div className="content-top">
        <div className="content-title">
          <img src="/openai-logomark.svg" />
          <span>Harbor - Realtime Domestic Violence Support Agent</span>
        </div>
        <div className="content-api-key">
          {!LOCAL_RELAY_SERVER_URL && (
            <Button
              icon={Edit}
              iconPosition="end"
              buttonStyle="flush"
              label={`api key: ${apiKey.slice(0, 3)}...`}
              onClick={() => resetAPIKey()}
            />
          )}
        </div>
      </div>
      <div className="content-main">
        <div className="content-logs">
          {isConnected && (
            <div className={`vad-status ${vadState}`}>
              {vadState === 'listening' && 'Listening for voice...'}
              {vadState === 'processing' && 'Processing voice...'}
              {vadState === 'error' && 'Error: Please check microphone access'}
            </div>
          )}
          <div className="content-block events">
            <div className="visualization">
              <div className="visualization-entry client">
                <canvas ref={clientCanvasRef} />
              </div>
            </div>
            <div className="content-block-title">events</div>
            <div className="content-block-body" ref={eventsScrollRef}>
              {!realtimeEvents.length && `awaiting connection...`}
              {realtimeEvents.map((realtimeEvent, i) => {
                const count = realtimeEvent.count;
                const event = { ...realtimeEvent.event };
                if (event.type === 'input_audio_buffer.append') {
                  event.audio = `[trimmed: ${event.audio.length} bytes]`;
                } else if (event.type === 'response.audio.delta') {
                  event.delta = `[trimmed: ${event.delta.length} bytes]`;
                }
                return (
                  <div className="event" key={event.event_id}>
                    <div className="event-timestamp">
                      {formatTime(realtimeEvent.time)}
                    </div>
                    <div className="event-details">
                      <div
                        className="event-summary"
                        onClick={() => {
                          const id = event.event_id;
                          const expanded = { ...expandedEvents };
                          if (expanded[id]) {
                            delete expanded[id];
                          } else {
                            expanded[id] = true;
                          }
                          setExpandedEvents(expanded);
                        }}
                      >
                        <div
                          className={`event-source ${
                            event.type === 'error'
                              ? 'error'
                              : realtimeEvent.source
                          }`}
                        >
                          {realtimeEvent.source === 'client' ? (
                            <ArrowUp />
                          ) : (
                            <ArrowDown />
                          )}
                          <span>
                            {event.type === 'error'
                              ? 'error!'
                              : realtimeEvent.source}
                          </span>
                        </div>
                        <div className="event-type">
                          {event.type}
                          {count && ` (${count})`}
                        </div>
                      </div>
                      {!!expandedEvents[event.event_id] && (
                        <div className="event-payload">
                          {JSON.stringify(event, null, 2)}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="content-block conversation">
            <div className="content-block-title">conversation</div>
            <div className="content-block-body" data-conversation-content>
              {!items.length && `awaiting connection...`}
              {items.map((conversationItem, i) => {
                return (
                  <div className="conversation-item" key={conversationItem.id}>
                    <div className={`speaker ${conversationItem.role || ''}`}>
                      <div>
                        {conversationItem.role === 'assistant' ? 'Harbor' : 'You'}
                      </div>
                      <div
                        className="close"
                        onClick={() => deleteConversationItem(conversationItem.id)}
                      >
                        <X />
                      </div>
                    </div>
                    <div className={`speaker-content`}>
                      {conversationItem.type === 'function_call_output' && (
                        <div>{conversationItem.formatted.output}</div>
                      )}
                      {!!conversationItem.formatted.tool && (
                        <div>
                          {conversationItem.formatted.tool.name}(
                          {conversationItem.formatted.tool.arguments})
                        </div>
                      )}
                      {!conversationItem.formatted.tool &&
                        conversationItem.role === 'user' && (
                          <div>
                            {conversationItem.formatted.transcript ||
                              (conversationItem.formatted.audio?.length
                                ? '(awaiting transcript)'
                                : conversationItem.formatted.text ||
                                  '(item sent)')}
                          </div>
                        )}
                      {!conversationItem.formatted.tool &&
                        conversationItem.role === 'assistant' && (
                          <div>
                            {conversationItem.formatted.transcript ||
                              conversationItem.formatted.text ||
                              '(truncated)'}
                          </div>
                        )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="content-actions">
            <div className="spacer" />
            <Button
              label={isConnected ? 'disconnect' : 'connect'}
              iconPosition={isConnected ? 'end' : 'start'}
              icon={isConnected ? X : Zap}
              buttonStyle={isConnected ? 'regular' : 'action'}
              onClick={
                isConnected ? disconnectConversation : connectConversation
              }
            />
          </div>
        </div>
        <div className="content-right">
          <div className="content-block map">
            <div className="content-block-title">get_list_of_shelters()</div>
            <div className="content-block-title bottom">
              {marker?.location || 'not yet retrieved'}
            </div>
            <div className="content-block-body full">
              {coords && (
                <Map
                  center={[coords.lat, coords.lng]}
                  location={coords.location}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}