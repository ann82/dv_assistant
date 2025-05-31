import fs from 'fs';
import path from 'path';
import { config } from './config.js';

class CostLogger {
  constructor() {
    this.logFile = path.join(process.cwd(), 'cost_logs.json');
    this.initializeLogFile();
  }

  initializeLogFile() {
    if (!fs.existsSync(this.logFile)) {
      fs.writeFileSync(this.logFile, JSON.stringify({
        logs: [],
        totalCost: 0,
        lastUpdated: new Date().toISOString()
      }, null, 2));
    }
  }

  async logCost({
    timestamp = new Date().toISOString(),
    model,
    inputTokens,
    outputTokens,
    whisperUsed = false,
    transcriptLength = 0,
    responseLength = 0,
    ttsCharacters = 0
  }) {
    try {
      // Read existing logs
      const data = JSON.parse(fs.readFileSync(this.logFile, 'utf8'));
      
      // Calculate cost based on model and tokens
      const cost = this.calculateCost(model, inputTokens, outputTokens, whisperUsed);
      
      // Create log entry
      const logEntry = {
        timestamp,
        model,
        inputTokens,
        outputTokens,
        whisperUsed,
        transcriptLength,
        responseLength,
        ttsCharacters,
        cost
      };

      // Update logs and total cost
      data.logs.push(logEntry);
      data.totalCost += cost;
      data.lastUpdated = timestamp;

      // Write back to file
      fs.writeFileSync(this.logFile, JSON.stringify(data, null, 2));

      // Log to console for immediate feedback
      console.log(`💰 Cost Log:`, {
        model,
        inputTokens,
        outputTokens,
        whisperUsed,
        cost: cost.toFixed(4),
        totalCost: data.totalCost.toFixed(4)
      });

      return logEntry;
    } catch (error) {
      console.error('Error logging cost:', error);
      return null;
    }
  }

  calculateCost(model, inputTokens, outputTokens, whisperUsed) {
    let cost = 0;

    // GPT-4o costs
    if (model === config.GPT4_MODEL) {
      cost += (inputTokens / 1000) * 0.01;  // $0.01 per 1K input tokens
      cost += (outputTokens / 1000) * 0.03; // $0.03 per 1K output tokens
    }
    // GPT-3.5 costs
    else if (model === config.GPT35_MODEL) {
      cost += (inputTokens / 1000) * 0.0005;  // $0.0005 per 1K input tokens
      cost += (outputTokens / 1000) * 0.0015; // $0.0015 per 1K output tokens
    }

    // Whisper costs (if used)
    if (whisperUsed) {
      cost += 0.006; // $0.006 per minute of audio
    }

    return cost;
  }

  getStats() {
    try {
      const data = JSON.parse(fs.readFileSync(this.logFile, 'utf8'));
      return {
        totalCost: data.totalCost,
        totalCalls: data.logs.length,
        lastUpdated: data.lastUpdated,
        recentLogs: data.logs.slice(-10) // Last 10 logs
      };
    } catch (error) {
      console.error('Error getting cost stats:', error);
      return null;
    }
  }
}

export const costLogger = new CostLogger(); 