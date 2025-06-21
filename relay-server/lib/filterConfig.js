// Configuration for filtering Tavily search results
export const filterConfig = {
  // Patterns that indicate unwanted results (PDFs, government docs, etc.)
  unwantedPatterns: [
    { pattern: /\.pdf$/i, description: 'PDF files' },
    { pattern: /\[pdf\]/i, description: 'PDF indicators in title' },
    { pattern: /government/i, description: 'Government documents' },
    { pattern: /county.*resource.*guide/i, description: 'County resource guides' },
    { pattern: /community.*resource.*guide/i, description: 'Community resource guides' },
    { pattern: /resource.*directory/i, description: 'Resource directories' },
    { pattern: /help.*programs/i, description: 'Generic help programs' },
    { pattern: /wikipedia/i, description: 'Wikipedia articles' },
    { pattern: /\.gov/i, description: 'Government websites' },
    { pattern: /census/i, description: 'Census data' },
    { pattern: /statistics/i, description: 'Statistics pages' },
    { pattern: /research/i, description: 'Research papers' },
    { pattern: /study/i, description: 'Studies' },
    { pattern: /report/i, description: 'Reports' },
    { pattern: /news/i, description: 'News articles' },
    { pattern: /article/i, description: 'Generic articles' },
    { pattern: /blog/i, description: 'Blog posts' },
    { pattern: /forum/i, description: 'Forums' },
    { pattern: /discussion/i, description: 'Discussions' }
  ],

  // Patterns that indicate actual shelter organizations
  positivePatterns: [
    { pattern: /shelter/i, description: 'Shelter' },
    { pattern: /domestic.*violence.*center/i, description: 'Domestic violence center' },
    { pattern: /safe.*house/i, description: 'Safe house' },
    { pattern: /crisis.*center/i, description: 'Crisis center' },
    { pattern: /women.*center/i, description: "Women's center" },
    { pattern: /family.*services/i, description: 'Family services' },
    { pattern: /support.*services/i, description: 'Support services' },
    { pattern: /emergency.*shelter/i, description: 'Emergency shelter' },
    { pattern: /transitional.*housing/i, description: 'Transitional housing' },
    { pattern: /refuge/i, description: 'Refuge' },
    { pattern: /haven/i, description: 'Haven' },
    { pattern: /sanctuary/i, description: 'Sanctuary' },
    { pattern: /organization/i, description: 'Organization' },
    { pattern: /non.*profit/i, description: 'Non-profit' },
    { pattern: /charity/i, description: 'Charity' },
    { pattern: /foundation/i, description: 'Foundation' },
    { pattern: /association/i, description: 'Association' },
    { pattern: /alliance/i, description: 'Alliance' },
    { pattern: /coalition/i, description: 'Coalition' },
    { pattern: /network/i, description: 'Network' },
    { pattern: /hotline/i, description: 'Hotline' },
    { pattern: /helpline/i, description: 'Helpline' }
  ],

  // Domains to exclude from search
  excludeDomains: [
    'wikipedia.org',
    'gov',
    'census.gov', 
    'statistics.gov',
    'researchgate.net',
    'academia.edu',
    'scholar.google.com'
  ],

  // Title cleanup patterns
  titleCleanup: [
    { pattern: /^\[.*?\]\s*/, replacement: '' },  // Remove [PDF], [DOC], etc.
    { pattern: /\s*-\s*Domestic.*$/i, replacement: '' },  // Remove "- Domestic Shelters" suffix
    { pattern: /\s*-\s*.*$/i, replacement: '' }  // Remove other "-" suffixes
  ]
};

// Helper function to check if a result matches any pattern
export function matchesPattern(text, patterns) {
  return patterns.some(({ pattern }) => pattern.test(text));
}

// Helper function to clean up titles
export function cleanTitle(title) {
  let cleanTitle = title;
  filterConfig.titleCleanup.forEach(({ pattern, replacement }) => {
    cleanTitle = cleanTitle.replace(pattern, replacement);
  });
  return cleanTitle.trim();
} 