import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fallbackResponse } from '../lib/fallbackResponder.js';

// Mock OpenAI
vi.mock('openai', () => {
  const mockOpenAI = {
    chat: {
      completions: {
        create: vi.fn()
      }
    }
  };
  
  return {
    OpenAI: vi.fn().mockImplementation(() => mockOpenAI)
  };
});

describe('Fallback Responder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should generate response for shelter intent', async () => {
    const mockResponse = {
      choices: [{
        message: {
          content: 'I understand you need immediate shelter. The National Domestic Violence Hotline (1-800-799-7233) can help you find a safe place right now.'
        }
      }]
    };

    const { OpenAI } = await import('openai');
    const openaiInstance = new OpenAI();
    openaiInstance.chat.completions.create.mockResolvedValue(mockResponse);

    const result = await fallbackResponse('find_shelter', 'I need shelter');
    
    expect(result).toContain('1-800-799-7233');
    expect(result).toContain('shelter');
  });

  it('should generate response for legal services intent', async () => {
    const mockResponse = {
      choices: [{
        message: {
          content: 'I can help you find legal assistance for domestic violence cases. Here are some resources...'
        }
      }]
    };

    const { OpenAI } = await import('openai');
    const openaiInstance = new OpenAI();
    openaiInstance.chat.completions.create.mockResolvedValue(mockResponse);

    const result = await fallbackResponse('legal_services', 'I need legal help');
    
    expect(result).toContain('legal');
  });

  it('should handle API errors gracefully', async () => {
    const { OpenAI } = await import('openai');
    const openaiInstance = new OpenAI();
    openaiInstance.chat.completions.create.mockRejectedValue(new Error('API Error'));

    const result = await fallbackResponse('find_shelter', 'I need shelter');
    
    expect(result).toContain('1-800-799-7233');
    expect(result).toContain('National Domestic Violence Hotline');
  });

  it('should include few-shot examples in the prompt', async () => {
    const { OpenAI } = await import('openai');
    const openaiInstance = new OpenAI();
    openaiInstance.chat.completions.create.mockResolvedValue({
      choices: [{ message: { content: 'test response' } }]
    });

    await fallbackResponse('test query', 'find_shelter');

    const messages = openaiInstance.chat.completions.create.mock.calls[0][0].messages;
    expect(messages).toHaveLength(4); // system + 2 few-shot + user query
    expect(messages[1].role).toBe('user');
    expect(messages[2].role).toBe('assistant');
  });

  it('should work with all intent types', async () => {
    const { OpenAI } = await import('openai');
    const openaiInstance = new OpenAI();
    const mockResponse = {
      choices: [{ message: { content: 'test response' } }]
    };

    openaiInstance.chat.completions.create.mockResolvedValue(mockResponse);

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
    const { OpenAI } = await import('openai');
    const openaiInstance = new OpenAI();
    openaiInstance.chat.completions.create.mockResolvedValue({
      choices: [{ message: { content: 'test response' } }]
    });

    await fallbackResponse('test query', 'find_shelter');

    const maxTokens = openaiInstance.chat.completions.create.mock.calls[0][0].max_tokens;
    expect(maxTokens).toBe(250);
  });
}); 