import { describe, it, expect, vi, beforeEach } from 'vitest';
import { rerankByRelevance } from '../lib/relevanceScorer.js';

// Mock OpenAI
vi.mock('openai', () => {
  const mockOpenAI = {
    embeddings: {
      create: vi.fn()
    }
  };
  
  return {
    OpenAI: vi.fn().mockImplementation(() => mockOpenAI)
  };
});

describe('Relevance Scoring', () => {
  const mockResults = [
    {
      title: 'Domestic Violence Shelter',
      summary: 'Emergency shelter for domestic violence survivors',
      url: 'https://example.com/shelter1'
    },
    {
      title: 'Legal Aid Services',
      summary: 'Free legal assistance for domestic violence cases',
      url: 'https://example.com/legal1'
    },
    {
      title: 'General Information',
      summary: 'General information about various topics',
      url: 'https://example.com/general1'
    }
  ];

  const mockEmbeddings = {
    query: [0.1, 0.2, 0.3],
    result1: [0.1, 0.2, 0.3], // High similarity
    result2: [0.2, 0.3, 0.4], // Medium similarity
    result3: [0.8, 0.9, 1.0]  // Low similarity
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should rerank results by relevance', async () => {
    // Mock embedding responses
    const { OpenAI } = await import('openai');
    const openaiInstance = new OpenAI();
    openaiInstance.embeddings.create
      .mockResolvedValueOnce({ data: [{ embedding: mockEmbeddings.query }] })
      .mockResolvedValueOnce({ data: [{ embedding: mockEmbeddings.result1 }] })
      .mockResolvedValueOnce({ data: [{ embedding: mockEmbeddings.result2 }] })
      .mockResolvedValueOnce({ data: [{ embedding: mockEmbeddings.result3 }] });

    const rerankedResults = await rerankByRelevance('find shelter', mockResults);

    expect(rerankedResults).toHaveLength(3);
    expect(rerankedResults[0].relevanceScore).toBeGreaterThan(rerankedResults[1].relevanceScore);
    expect(rerankedResults[1].relevanceScore).toBeGreaterThan(rerankedResults[2].relevanceScore);
  });

  it('should only process top 5 results', async () => {
    const manyResults = Array.from({ length: 10 }, (_, i) => ({
      title: `Result ${i}`,
      summary: `Summary ${i}`,
      url: `https://example.com/result${i}`
    }));

    const { OpenAI } = await import('openai');
    const openaiInstance = new OpenAI();
    openaiInstance.embeddings.create.mockResolvedValue({ data: [{ embedding: [0.1, 0.2, 0.3] }] });

    const rerankedResults = await rerankByRelevance('test query', manyResults);
    expect(rerankedResults).toHaveLength(5);
  });

  it('should handle API errors gracefully', async () => {
    const { OpenAI } = await import('openai');
    const openaiInstance = new OpenAI();
    openaiInstance.embeddings.create.mockRejectedValue(new Error('API Error'));

    const rerankedResults = await rerankByRelevance('test query', mockResults);
    expect(rerankedResults).toEqual(mockResults);
  });

  it('should combine title and summary for embedding', async () => {
    const { OpenAI } = await import('openai');
    const openaiInstance = new OpenAI();
    openaiInstance.embeddings.create.mockResolvedValue({ 
      data: [{ embedding: mockEmbeddings.query }] 
    });

    await rerankByRelevance('test query', mockResults);

    // Check that the embedding was called with combined text
    const calls = openaiInstance.embeddings.create.mock.calls;
    expect(calls.length).toBeGreaterThan(1);
    
    // First call should be the query
    expect(calls[0][0].input).toBe('test query');
    
    // Subsequent calls should be result combinations
    expect(calls[1][0].input).toContain('Domestic Violence Shelter');
    expect(calls[1][0].input).toContain('Emergency shelter for domestic violence survivors');
  });
}); 