import { OpenAI } from 'openai';
import { config } from '../lib/config.js';

export class CallSummaryService {
  constructor(openaiClient = new OpenAI({ apiKey: config.OPENAI_API_KEY })) {
    this.openai = openaiClient;
    this.callHistory = new Map();
  }

  addToHistory(callSid, message) {
    if (!this.callHistory.has(callSid)) {
      this.callHistory.set(callSid, []);
    }
    this.callHistory.get(callSid).push(message);
  }

  async generateSummary(callSid) {
    try {
      const history = this.callHistory.get(callSid) || [];
      if (history.length === 0) {
        return 'No conversation history available.';
      }

      const prompt = `Please provide a concise summary of this conversation, focusing on key points and any resources or information provided. Format it in a clear, professional manner:

${history.map(msg => `${msg.role}: ${msg.content}`).join('\n')}

Summary:`;

      const response = await this.openai.chat.completions.create({
        model: config.GPT35_MODEL,
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant that summarizes conversations. Focus on key points, resources provided, and any action items.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 500,
        temperature: 0.7
      });

      const summary = response.choices[0].message.content;
      return summary;
    } catch (error) {
      console.error('Error generating call summary:', error);
      return 'Error generating call summary.';
    } finally {
      // Clean up history after generating summary
      this.callHistory.delete(callSid);
    }
  }
} 