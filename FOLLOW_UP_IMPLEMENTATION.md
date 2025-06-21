# Follow-up Question Support Implementation

## Overview

This implementation adds comprehensive follow-up question support to the voice agent, allowing users to ask vague follow-up questions after receiving initial responses about shelters and resources.

## Features Implemented

### 1. Enhanced Conversation Context Tracking

**File: `relay-server/lib/intentClassifier.js`**

- **Added `lastQueryContext` object** to session memory with:
  - `intent`: e.g., "find_shelter"
  - `location`: e.g., "South Lake Tahoe" 
  - `results`: top 3 Tavily results
  - `timestamp`: for timeout logic
  - `smsResponse`: formatted SMS response
  - `voiceResponse`: formatted voice response

### 2. Follow-up Question Detection

**File: `relay-server/lib/intentClassifier.js`**

- **Enhanced `handleFollowUp()` function** that:
  - Detects vague queries using regex patterns
  - Checks context recency (within 5 minutes)
  - Handles specific follow-up types based on intent

**Vague Query Patterns Detected:**
- "What's the address?" / "Where is that located?"
- "Can you send that to me?" / "Can you text me?"
- "What's the number?" / "What's their phone?"
- "Tell me the address" / "Give me the details"

### 3. Specific Follow-up Handlers

**Shelter-specific follow-ups (`handleShelterFollowUp`):**

- **Send Details**: "Can you send that to me?"
  - Response: "I'll send you the shelter details via text message. You should receive them shortly."
  - Includes SMS response from previous results

- **Location Info**: "What's the address?" / "Where is that located?"
  - Response: "Here are the locations: [Shelter Name]: [URL]. Would you like me to send you the complete details?"
  - Extracts URLs from previous results

- **Phone Info**: "What's the number?" / "What's their phone?"
  - Response: "Here are the phone numbers: [Shelter Name]: [Phone]. Would you like me to send you the complete details?"
  - Extracts phone numbers from content using regex

### 4. Timeout Handling

**File: `relay-server/lib/intentClassifier.js`**

- **5-minute timeout** for `lastQueryContext`
- Automatically clears context after inactivity
- Prevents stale follow-up responses

### 5. Integration with Voice Processing

**Files: `relay-server/lib/twilioVoice.js`, `relay-server/routes/twilio.js`**

- **Updated `processSpeechInput()`** to use new follow-up logic
- **Enhanced context updates** to include Tavily results
- **Improved logging** for follow-up detection and handling

## Example Usage Scenarios

### Scenario 1: Shelter Search with Follow-ups

1. **Initial Query**: "Find me a shelter in San Francisco"
   - Response: "I found 2 shelters in San Francisco: La Casa de las Madres and Asian Women's Shelter. Would you like me to send you the details?"
   - Context stored with results and responses

2. **Follow-up**: "What's the address?"
   - Response: "Here are the locations: La Casa de las Madres: https://example.com/shelter1. Asian Women's Shelter: https://example.com/shelter2. Would you like me to send you the complete details?"

3. **Follow-up**: "Can you send that to me?"
   - Response: "I'll send you the shelter details via text message. You should receive them shortly."
   - SMS sent with full details

### Scenario 2: Phone Number Request

1. **Initial Query**: "Find shelter in Oakland"
   - Response: "I found shelters in Oakland..."

2. **Follow-up**: "What's the number?"
   - Response: "Here are the phone numbers: [Shelter Name]: [Phone Number]. Would you like me to send you the complete details?"

## Technical Implementation Details

### Context Structure

```javascript
lastQueryContext = {
  intent: "find_shelter",
  location: "San Francisco", 
  results: [
    {
      title: "La Casa de las Madres",
      url: "https://example.com/shelter1",
      content: "Emergency shelter with phone 555-1234",
      score: 0.9
    }
  ],
  timestamp: 1703123456789,
  smsResponse: "Shelters in San Francisco:\n\n1. La Casa de las Madres...",
  voiceResponse: "I found 2 shelters in San Francisco..."
}
```

### Follow-up Response Structure

```javascript
{
  type: "send_details" | "location_info" | "phone_info" | "shelter_follow_up",
  intent: "find_shelter",
  response: "Voice response text",
  smsResponse: "SMS response text", 
  results: [/* Tavily results */]
}
```

### Regex Patterns for Vague Queries

```javascript
const vagueFollowUpPatterns = [
  /^(what|where|how|can|could)\s+(?:is|are|do|does|you)\s+(?:the|that|those|these|it|them)/i,
  /^(tell|give)\s+(?:me)?\s+(?:the|that|those|these)/i,
  /^(send|text|email)\s+(?:me)?\s+(?:that|those|these|it|them)/i,
  /^(what's|what is|where's|where is)\s+(?:the|that|those|these|it|them)/i,
  /^(can|could)\s+(?:you)?\s+(?:send|text|email|give)\s+(?:me)?/i
];
```

## Testing

**File: `relay-server/tests/followUp.test.js`**

Comprehensive test suite covering:
- ✅ Context storage and retrieval
- ✅ Timeout handling (5 minutes)
- ✅ Follow-up detection for various query types
- ✅ Phone number extraction
- ✅ Location information handling
- ✅ SMS response handling
- ✅ Edge cases and error conditions

## Files Modified

1. **`relay-server/lib/intentClassifier.js`**
   - Enhanced `updateConversationContext()` to store Tavily results
   - Added `handleFollowUp()` function
   - Added `handleShelterFollowUp()` function
   - Added timeout logic in `getConversationContext()`
   - Added helper functions for location and phone extraction

2. **`relay-server/lib/twilioVoice.js`**
   - Updated `processSpeechInput()` to use new follow-up logic
   - Enhanced context updates with Tavily results
   - Improved logging for follow-up detection

3. **`relay-server/routes/twilio.js`**
   - Updated `processSpeechResult()` to include Tavily results in context

4. **`relay-server/tests/followUp.test.js`** (new)
   - Comprehensive test suite for follow-up functionality

## Benefits

1. **Improved User Experience**: Users can ask natural follow-up questions without repeating context
2. **Reduced API Calls**: Follow-ups use cached results instead of new searches
3. **Better Context Awareness**: System maintains conversation state intelligently
4. **Timeout Safety**: Prevents stale responses after 5 minutes
5. **Comprehensive Coverage**: Handles address, phone, and general detail requests

## Future Enhancements

1. **Multi-turn Conversations**: Support for more complex conversation flows
2. **Intent-specific Follow-ups**: Custom handlers for legal services, counseling, etc.
3. **Context Merging**: Combine multiple related queries into unified context
4. **User Preferences**: Remember user preferences across conversations
5. **Advanced NLP**: Use more sophisticated NLP for better follow-up detection 