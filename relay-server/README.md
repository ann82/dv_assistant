# Relay Server

## Overview
The Relay Server is responsible for handling incoming requests, processing speech input, and interacting with external APIs to provide relevant resources and information.

## Features
- **Speech Processing**: Converts speech input to text and extracts relevant information.
- **Location Extraction**: Intelligently extracts location information from user input.
- **Resource Retrieval**: Uses the Tavily API to fetch relevant resources based on user queries.
- **Response Formatting**: Formats responses to be clear and user-friendly.
- **Error Handling**: Robust error handling and logging for better debugging.

## Recent Updates
- **Enhanced Location Extraction**: Improved extraction of location information from speech input, including handling of complex mentions and removal of leading articles.
- **Improved Prompts**: More natural and empathetic prompts for user interaction.
- **Comprehensive Testing**: Added tests for location extraction and prompt generation to ensure reliability.

## Getting Started
1. **Installation**:
   ```bash
   npm install
   ```

2. **Running the Server**:
   ```bash
   npm start
   ```

3. **Running Tests**:
   ```bash
   npm test
   ```

## Configuration
- Ensure environment variables are set for API keys and other configurations.
- Check `config.js` for detailed configuration options.

## Contributing
- Fork the repository.
- Create a feature branch.
- Submit a pull request.

## License
This project is licensed under the MIT License. 