// relay-server/lib/patternConfig.js

// Pattern categories with weights and regex patterns
export const patternCategories = {
  location: {
    weight: 3.0,
    patterns: [
      /where (?:is|are|can I find)/i,
      /find (?:a|an|the|some|any)/i,
      /locate (?:a|an|the|some|any)/i,
      /search for/i,
      /look for/i,
      /nearest/i,
      /closest/i,
      /near(?:by| me)?/i
    ]
  },
  information: {
    weight: 1.5,
    patterns: [
      /what (?:is|are)/i,
      /when (?:is|are)/i,
      /how (?:to|do|can)/i,
      /tell me about/i,
      /information about/i,
      /details about/i
    ]
  },
  resource: {
    weight: 2.0,
    patterns: [
      /help (?:with|for|me|finding|locating|searching|a|an|the|some|any)/i,
      /need (?:help|assistance|support)/i,
      /looking for (?:help|assistance|support)/i,
      /resources (?:for|about)/i,
      /services (?:for|about)/i
    ]
  },
  shelter: {
    weight: 4.0,
    patterns: [
      /shelter(?:s)? (?:near|in|around|close to)/i,
      /domestic violence (?:shelter|resource|help|support)/i,
      /safe (?:place|house|shelter)/i,
      /emergency (?:shelter|housing|accommodation)/i,
      /temporary (?:housing|shelter|accommodation)/i,
      /women(?:'s)? shelter/i,
      /family shelter/i,
      /homeless shelter/i,
      /crisis shelter/i,
      /abuse shelter/i,
      /victim shelter/i
    ]
  },
  contact: {
    weight: 1.2,
    patterns: [
      /contact (?:information|details|number|phone)/i,
      /phone (?:number|contact)/i,
      /address (?:of|for)/i,
      /how to (?:contact|reach|call)/i
    ]
  },
  general: {
    weight: 0.5,
    patterns: [
      /find/i,
      /search/i,
      /locate/i,
      /where/i,
      /what/i,
      /when/i,
      /how/i
    ]
  }
};

// Shelter keywords with weights
export const shelterKeywords = [
  { word: 'shelter', weight: 3.0 },
  { word: 'domestic violence', weight: 4.0 },
  { word: 'safe house', weight: 3.0 },
  { word: 'emergency housing', weight: 3.0 },
  { word: 'temporary housing', weight: 3.0 },
  { word: 'refuge', weight: 3.0 },
  { word: 'sanctuary', weight: 3.0 },
  { word: 'crisis center', weight: 3.5 },
  { word: 'women\'s shelter', weight: 3.5 },
  { word: 'family shelter', weight: 3.5 },
  { word: 'abuse shelter', weight: 3.5 }
]; 