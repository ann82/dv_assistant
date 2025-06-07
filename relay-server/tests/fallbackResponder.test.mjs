import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fallbackResponse } from '../lib/fallbackResponder.js';

// Mock OpenAI
vi.mock('openai', () => ({
  OpenAI: vi.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: vi.fn()
      }
    }
  }))
}));

describe('Fallback Responder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should generate response for shelter intent', async () => {
    const openai = (await import('openai')).OpenAI;
    const mockResponse = {
      choices: [{
        message: {
          content: 'I understand you need immediate shelter. The National Domestic Violence Hotline (1-800-799-7233) can help you find a safe place right now.'
        }
      }]
    };

    openai.mock.results[0].value.chat.completions.create.mockResolvedValue(mockResponse);

    const response = await fallbackResponse('need shelter', 'find_shelter');
    expect(response).toContain('1-800-799-7233');
    expect(response).toContain('shelter');
  });

  it('should include few-shot examples in the prompt', async () => {
    const openai = (await import('openai')).OpenAI;
    openai.mock.results[0].value.chat.completions.create.mockResolvedValue({
      choices: [{ message: { content: 'test response' } }]
    });

    await fallbackResponse('test query', 'find_shelter');

    const messages = openai.mock.results[0].value.chat.completions.create.mock.calls[0][0].messages;
    expect(messages).toHaveLength(4); // system + 2 few-shot + user query
    expect(messages[1].role).toBe('user');
    expect(messages[2].role).toBe('assistant');
  });

  it('should handle API errors gracefully', async () => {
    const openai = (await import('openai')).OpenAI;
    openai.mock.results[0].value.chat.completions.create.mockRejectedValue(new Error('API Error'));

    const response = await fallbackResponse('test query', 'find_shelter');
    expect(response).toContain('1-800-799-7233');
    expect(response).toContain('having trouble');
  });

  it('should work with all intent types', async () => {
    const openai = (await import('openai')).OpenAI;
    const mockResponse = {
      choices: [{ message: { content: 'test response' } }]
    };

    openai.mock.results[0].value.chat.completions.create.mockResolvedValue(mockResponse);

    const intents = [
      'find_shelter',
      'get_support_resource',
      'get_contact_details',
      'get_information',
      'general_query'
    ];

    for (const intent of intents) {
      const response = await fallbackResponse('test query', intent);
      expect(response).toBeDefined();
    }
  });

  it('should limit response length', async () => {
    const openai = (await import('openai')).OpenAI;
    openai.mock.results[0].value.chat.completions.create.mockResolvedValue({
      choices: [{ message: { content: 'test response' } }]
    });

    await fallbackResponse('test query', 'find_shelter');

    const maxTokens = openai.mock.results[0].value.chat.completions.create.mock.calls[0][0].max_tokens;
    expect(maxTokens).toBe(250);
  });
}); 