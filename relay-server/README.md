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

- **Follow-up Question Handling:** The `ResponseGenerator` now correctly handles follow-up questions by using the stored context from previous interactions. This ensures that follow-up questions do not require a new location extraction.
- **Location Extraction Enhancement:** The `EntityExtractor` has been updated to handle trailing punctuation in location extraction, ensuring accurate extraction of locations like 'New York'.

## Installation

1. Clone the repository.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the server:
   ```bash
   npm start
   ```

## Testing

Run the tests using:
```bash
npm test
```

## License

This project is licensed under the MIT License. 