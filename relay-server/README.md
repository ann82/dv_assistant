# Relay Server

This server handles incoming requests from Twilio, processes them, and returns appropriate responses.

## Features

- **Twilio Integration:** Handles incoming calls and messages from Twilio.
- **Intent Classification:** Classifies user intents using the `IntentExtractor`.
- **Entity Extraction:** Extracts locations and topics from user queries using the `EntityExtractor`.
- **Context Management:** Manages conversation context to handle follow-up questions.
- **Relevance Checking:** Ensures queries are relevant to the domain.
- **Tavily API Integration:** Fetches relevant information using the Tavily API.
- **Fallback to GPT:** Provides a fallback mechanism using GPT for responses when the Tavily API fails.

## Recent Updates

- **Enhanced Conversation Context:** Added comprehensive conversation context management for better follow-up question handling.
- **Intent-Based Query Rewriting:** Improved query rewriting based on intent classification and conversation context.
- **Location Context Preservation:** Enhanced location extraction and preservation across conversation turns.
- **Emergency Response Handling:** Added specific handling for emergency situations and urgent requests.
- **TypeScript Migration:** Core components have been migrated to TypeScript for better type safety and maintainability.
- **Response Handling Improvements:** Enhanced response generation for irrelevant queries with proper domain-specific responses.
- **Follow-up Question Handling:** The `ResponseGenerator` now correctly handles follow-up questions by using the stored context from previous interactions.
- **Location Extraction Enhancement:** The `EntityExtractor` has been updated to handle trailing punctuation in location extraction.
- **Import Statement Updates:** Updated import statements in `ResponseGenerator.ts` to include the `.js` extension for all modules.
- **Logging Enhancements:** Added logging to `RelevanceChecker` and `EntityExtractor` for better debugging and diagnostics.

## Installation

1. Clone the repository.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Build TypeScript files:
   ```bash
   npm run build
   ```
4. Start the server:
   ```bash
   npm start
   ```

## Development

The project uses TypeScript for better type safety and maintainability. Key development commands:

```bash
# Run tests
npm test

# Watch mode for tests
npm run test:watch

# Generate test coverage
npm run test:coverage

# Build TypeScript files
npm run build
```

## Conversation Context Features

The server now includes enhanced conversation context management:

- **Context Preservation:** Maintains conversation history for up to 5 interactions
- **Follow-up Detection:** Automatically detects and handles follow-up questions
- **Intent Tracking:** Tracks user intents across conversation turns
- **Location Memory:** Remembers location context for subsequent queries
- **Emergency Prioritization:** Special handling for emergency situations
- **Service-Specific Context:** Maintains context for different types of services (shelters, legal, counseling)

## License

This project is licensed under the MIT License. 