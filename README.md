# Domestic Violence Support Assistant

A voice-based AI assistant designed to provide immediate support and resources for individuals experiencing domestic violence. The system uses natural language processing to understand queries and provide relevant information about shelters, resources, and support services.

## Features

- **Voice Interface**: Easy-to-use voice-based interaction system
- **Real-time Response**: Quick and accurate responses to user queries
- **Resource Location**: Helps users find nearby shelters and support services
- **Confidence-based Routing**: Intelligent routing of queries based on confidence scores
- **Multi-source Information**: Combines information from multiple sources for comprehensive responses
- **Conversation Summary**: Optional text message summary of the conversation and resources
- **Enhanced Logging**: Detailed logging for better monitoring and debugging
- **Robust Error Handling**: Improved error handling and recovery mechanisms

## Query Types and Confidence Scoring

The system uses a confidence-based scoring system to route queries to the most appropriate information source:

### High Confidence Queries (Tavily API)
These queries will be routed to the Tavily API for factual information:

- "Where is the nearest domestic violence shelter?"
- "Find a women's shelter near me"
- "Locate the closest safe house in my area"

### Medium Confidence Queries (Hybrid Approach)
These queries will use both Tavily and GPT:
- "What services do shelters offer?"
- "How can I find help with domestic violence?"
- "What resources are available for victims?"

### Low Confidence Queries (GPT)
These queries will use GPT for conversational responses:
- "I need help"
- "What should I do?"
- "Can you tell me about shelters?"

## Technical Architecture

The system consists of several key components:

1. **Voice Interface (Twilio)**
   - Handles incoming calls
   - Manages voice interactions
   - Provides text-to-speech capabilities
   - Sends follow-up SMS summaries

2. **Response Generator**
   - Analyzes user queries for confidence scoring
   - Routes queries to appropriate information sources
   - Combines information from multiple sources
   - Generates natural, helpful responses

3. **Information Sources**
   - Tavily API for factual information
   - GPT for conversational responses
   - Hybrid approach for complex queries

4. **WebSocket Server**
   - Manages real-time communication
   - Handles concurrent call sessions
   - Provides robust error recovery

## Setup and Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/ann82/dv_assistant.git
   cd dv_assistant
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure environment variables:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. Start the server:
   ```bash
   npm start
   ```

## Environment Variables

Required environment variables:
- `TWILIO_ACCOUNT_SID`: Your Twilio account SID
- `TWILIO_AUTH_TOKEN`: Your Twilio auth token
- `TWILIO_PHONE_NUMBER`: Your Twilio phone number
- `OPENAI_API_KEY`: Your OpenAI API key
- `TAVILY_API_KEY`: Your Tavily API key
- `WS_PORT`: WebSocket server port (default: 8080)

## Testing

- All core and integration tests pass as of the latest update.
- Some legacy and integration tests have been removed or consolidated for maintainability.
- To run tests:
  ```bash
  npm test
  ```

## Recent Improvements

- Enhanced confidence scoring for better query routing
- Improved pattern matching for shelter-related queries
- Added detailed logging for better monitoring
- Enhanced WebSocket error handling and recovery
- Increased response timeouts for better reliability
- Added connection timeouts to prevent hanging calls
- Improved error messages and user feedback
- Added comprehensive query examples and documentation
- **Note:** Some integration and performance tests have been removed or consolidated for maintainability.

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Twilio for voice and SMS capabilities
- OpenAI for GPT integration
- Tavily for search capabilities
- All contributors and supporters of the project