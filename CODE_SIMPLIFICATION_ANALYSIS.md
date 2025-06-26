# Code Simplification Analysis

## Overview
With the new detailed conversation instructions (5,080 characters vs 493), the AI can handle many scenarios that were previously managed by complex code. This analysis identifies opportunities for significant code reduction.

## Current Complex Systems

### 1. Intent Classification (`intentClassifier.js` - 1,569 lines)
**Current Complexity:**
- 8 predefined intents with complex classification logic
- Fallback pattern matching when OpenAI fails
- Conversation context management
- Follow-up detection and handling
- Confidence scoring and routing decisions

**What the AI Can Now Handle:**
- **Intent Detection**: The detailed instructions include conversation structure guidance
- **Emergency Protocols**: 911 escalation is now in the AI instructions
- **Follow-up Detection**: AI can naturally handle conversation flow
- **Cultural Sensitivity**: Built into the AI instructions
- **Safety Planning**: Comprehensive guidelines in the prompt

**Simplification Potential: 60-70% reduction**

### 2. Query Rewriting (`enhancedQueryRewriter.js` - 157 lines)
**Current Complexity:**
- Conversational filler removal
- Location detection and validation
- Query enhancement for shelter searches
- US-specific optimizations
- Site restrictions and relevance improvements

**What the AI Can Now Handle:**
- **Natural Language Processing**: AI can understand and clean queries naturally
- **Location Context**: Instructions include location handling guidelines
- **Query Optimization**: AI can craft better search queries
- **Relevance Assessment**: AI can determine what's relevant

**Simplification Potential: 80-90% reduction**

### 3. Response Routing (`response.js` - 2,139 lines)
**Current Complexity:**
- Confidence-based routing (Tavily vs GPT)
- Complex response formatting
- Result filtering and scoring
- Multiple response formats
- Caching and performance optimization

**What the AI Can Now Handle:**
- **Response Generation**: AI can generate appropriate responses directly
- **Context Awareness**: AI understands conversation context
- **Formatting**: AI can format responses appropriately
- **Relevance**: AI can determine what's relevant to share

**Simplification Potential: 40-50% reduction**

### 4. Conversation Management (`conversationManagement.test.js` - 25 tests)
**Current Complexity:**
- Conversation flow management
- Re-engagement logic
- End-of-call handling
- Context tracking

**What the AI Can Now Handle:**
- **Conversation Flow**: Instructions include structured conversation guidelines
- **Re-engagement**: AI can naturally re-engage users
- **Call Closure**: Professional call ending is in the instructions

**Simplification Potential: 70-80% reduction**

## Proposed Simplified Architecture

### Option 1: AI-First Approach (Recommended)
```javascript
// Simplified response generation
static async getResponse(input, context = {}) {
  // Check cache first
  const cachedResponse = this.getCachedResponse(input);
  if (cachedResponse) return cachedResponse;

  // Let AI handle everything
  const response = await this.generateGPTResponse(input, 'gpt-3.5-turbo', {
    conversationContext: context,
    userQuery: input
  });

  // Cache and return
  this.cacheResponse(input, response);
  return response;
}
```

**Benefits:**
- **90% code reduction** in intent classification and query rewriting
- **Simpler maintenance** - single source of truth
- **Better responses** - AI handles context naturally
- **Lower latency** - fewer processing steps

**Cost Impact:**
- **Higher GPT usage** but better quality
- **Estimated cost**: $5-10/month vs $1-3/month
- **Value**: Significantly better user experience

### Option 2: Hybrid Approach
```javascript
// Keep Tavily for factual queries, AI for everything else
static async getResponse(input, context = {}) {
  // Simple pattern matching for shelter searches
  if (this.isShelterSearch(input)) {
    return this.handleShelterSearch(input);
  }
  
  // AI for everything else
  return this.generateGPTResponse(input, 'gpt-3.5-turbo', context);
}
```

**Benefits:**
- **50% code reduction**
- **Cost optimization** - Tavily for factual queries
- **Balanced approach**

## Specific Simplification Opportunities

### 1. Remove Intent Classification
**Current:** 1,569 lines of complex logic
**Simplified:** Let AI determine intent naturally
**Savings:** ~1,200 lines

### 2. Simplify Query Rewriting
**Current:** 157 lines of query enhancement
**Simplified:** Basic cleaning only
**Savings:** ~120 lines

### 3. Streamline Response Routing
**Current:** Complex confidence-based routing
**Simplified:** AI-first with Tavily fallback
**Savings:** ~800 lines

### 4. Remove Conversation Management
**Current:** Complex flow management
**Simplified:** AI handles conversation flow
**Savings:** ~300 lines

## Implementation Strategy

### Phase 1: Proof of Concept (1 week)
1. **Test AI-only approach** with current detailed instructions
2. **Compare response quality** with existing system
3. **Measure cost impact** and user satisfaction
4. **Validate emergency protocols** work correctly

### Phase 2: Gradual Migration (2-3 weeks)
1. **Start with non-critical paths** (general questions, follow-ups)
2. **Keep Tavily for shelter searches** initially
3. **Monitor performance** and user feedback
4. **Gradually expand AI usage**

### Phase 3: Full Simplification (1 week)
1. **Remove intent classification** complexity
2. **Simplify query rewriting** to basic cleaning
3. **Streamline response routing**
4. **Update tests** for simplified architecture

## Risk Assessment

### Low Risk
- **Emergency protocols** are in AI instructions
- **Cultural sensitivity** is built into the prompt
- **Safety planning** is comprehensive
- **Conversation structure** is well-defined

### Medium Risk
- **Cost increase** from higher GPT usage
- **Response consistency** needs monitoring
- **Performance** may be slightly slower

### Mitigation Strategies
- **A/B testing** before full migration
- **Cost monitoring** and alerts
- **Fallback mechanisms** for critical functions
- **Gradual rollout** with monitoring

## Conclusion

**The detailed AI instructions enable significant code simplification:**

- **Potential reduction:** 2,000+ lines of complex logic
- **Maintenance benefit:** Single source of truth for conversation handling
- **Quality improvement:** More natural, context-aware responses
- **Cost trade-off:** $5-10/month for dramatically simpler codebase

**Recommendation:** Start with Phase 1 proof of concept to validate the AI-first approach, then proceed with gradual migration based on results. 

export async function rewriteQuery(query, intent, callSid = null) {
  if (!query || typeof query !== 'string') {
    return query || '';
  }

  let rewrittenQuery = query.trim();
  const lowerQuery = rewrittenQuery.toLowerCase();

  try {
    // Use geocoding-based location detection
    const locationInfo = await detectLocationWithGeocoding(query);

    // Add location context if present and US
    if (locationInfo && locationInfo.location && locationInfo.isUS) {
      // Add shelter-specific terms for shelter intent
      if (intent === 'find_shelter') {
        // Make the query more specific to domestic violence shelters
        if (!/\b(domestic violence|abuse|victim|survivor)\b/i.test(rewrittenQuery)) {
          rewrittenQuery = `domestic violence shelter ${rewrittenQuery}`;
        }
        if (!/\bshelter\b/i.test(rewrittenQuery)) {
          rewrittenQuery = `${rewrittenQuery} shelter`;
        }
        
        // Check if location is already mentioned to avoid duplication
        const hasLocation = new RegExp(`\\b${locationInfo.location.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(rewrittenQuery);
        if (!hasLocation) {
          rewrittenQuery = `${rewrittenQuery} ${locationInfo.location}`;
        }
        
        // Add specific request for shelter information
        rewrittenQuery += ' "shelter name" "address" "phone number" "contact information"';
        
        // Add minimal site restrictions to focus on relevant domains
        rewrittenQuery += ' site:org OR site:gov';
        
        // Add specific terms to improve relevance
        rewrittenQuery += ' "domestic violence"';
      } else {
        // For other intents, just add location context
        if (!rewrittenQuery.includes(locationInfo.location)) {
          rewrittenQuery = `${rewrittenQuery} in ${locationInfo.location}`;
        }
      }
    } else if (locationInfo && locationInfo.location && !locationInfo.isUS) {
      // For non-US locations, preserve the location but don't add US-specific enhancements
      // Optionally, you could return a message here if you want to block non-US queries
      // For now, just keep the original query as-is
    }
  } catch (error) {
    logger.error('Error in location detection during query rewriting:', error);
    // Continue with the original query if location detection fails
  }

  // Add intent-specific enhancements for other intents
  switch (intent) {
    case 'general_information':
      if (!lowerQuery.includes('information') && !lowerQuery.includes('resources')) {
        rewrittenQuery = `${rewrittenQuery} information resources guide`;
      }
      break;
    case 'other_resources':
      if (!lowerQuery.includes('resources') && !lowerQuery.includes('support')) {
        rewrittenQuery = `${rewrittenQuery} support resources assistance`;
      }
      break;
  }

  // Ensure we always return a valid string
  return rewrittenQuery || query || '';
} 