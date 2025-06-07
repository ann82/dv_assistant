import { describe, it, expect, vi, beforeEach } from 'vitest';
import { rerankByRelevance } from '../lib/relevanceScorer.js';

// Mock OpenAI
vi.mock('openai', () => ({
  OpenAI: vi.fn().mockImplementation(() => ({
    embeddings: {
      create: vi.fn()
    }
  }))
}));

describe('Relevance Scoring', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockResults = [
    {
      title: 'Domestic Violence Shelter in New York',
      summary: 'Emergency shelter and support services for domestic violence survivors',
      url: 'https://example.com/shelter1'
    },
    {
      title: 'General Housing Resources',
      summary: 'Information about various housing options',
      url: 'https://example.com/housing'
    },
    {
      title: 'Domestic Violence Support Services',
      summary: 'Counseling and support for survivors',
      url: 'https://example.com/support'
    }
  ];

  const mockEmbeddings = {
    query: Array(1536).fill(0.1),
    result1: Array(1536).fill(0.2),
    result2: Array(1536).fill(0.05),
    result3: Array(1536).fill(0.15)
  };

  it('should rerank results by relevance', async () => {
    const openai = (await import('openai')).OpenAI;
    
    // Mock embedding responses
    openai.mock.results[0].value.embeddings.create
      .mockResolvedValueOnce({ data: [{ embedding: mockEmbeddings.query }] })
      .mockResolvedValueOnce({ data: [{ embedding: mockEmbeddings.result1 }] })
      .mockResolvedValueOnce({ data: [{ embedding: mockEmbeddings.result2 }] })
      .mockResolvedValueOnce({ data: [{ embedding: mockEmbeddings.result3 }] });

    const query = 'domestic violence shelter';
    const rerankedResults = await rerankByRelevance(query, mockResults);

    expect(rerankedResults).toHaveLength(3);
    expect(rerankedResults[0].title).toBe('Domestic Violence Shelter in New York');
    expect(rerankedResults[0].relevanceScore).toBeGreaterThan(rerankedResults[1].relevanceScore);
  });

  it('should only process top 5 results', async () => {
    const openai = (await import('openai')).OpenAI;
    const manyResults = Array(10).fill(mockResults[0]);
    
    const rerankedResults = await rerankByRelevance('test query', manyResults);
    expect(rerankedResults).toHaveLength(5);
  });

  it('should handle API errors gracefully', async () => {
    const openai = (await import('openai')).OpenAI;
    openai.mock.results[0].value.embeddings.create.mockRejectedValue(new Error('API Error'));

    const rerankedResults = await rerankByRelevance('test query', mockResults);
    expect(rerankedResults).toEqual(mockResults);
  });

  it('should combine title and summary for embedding', async () => {
    const openai = (await import('openai')).OpenAI;
    openai.mock.results[0].value.embeddings.create.mockResolvedValue({ 
      data: [{ embedding: mockEmbeddings.query }] 
    });

    await rerankByRelevance('test query', [mockResults[0]]);

    // Check that the second call includes both title and summary
    const secondCall = openai.mock.results[0].value.embeddings.create.mock.calls[1];
    expect(secondCall[0].input).toContain(mockResults[0].title);
    expect(secondCall[0].input).toContain(mockResults[0].summary);
  });
}); 