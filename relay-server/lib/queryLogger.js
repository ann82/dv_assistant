import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import logger from './logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// In-memory storage for queries when file writing is not available
const inMemoryLogs = [];
const MAX_IN_MEMORY_LOGS = 1000;

// Log file path
const LOG_FILE_PATH = path.join(__dirname, '../logs/query_metrics.jsonl');

/**
 * Log query handling metrics for evaluation
 * @param {Object} input - Query handling metrics
 * @param {string} input.query - Original user query
 * @param {string} input.intent - Detected intent
 * @param {boolean} input.usedGPT - Whether GPT was used
 * @param {number} input.score - Relevance score (if available)
 * @param {string} [input.error] - Error message (if any)
 */
export async function logQueryHandling(input) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    ...input
  };

  try {
    // Ensure logs directory exists
    await fs.mkdir(path.dirname(LOG_FILE_PATH), { recursive: true });
    
    // Append to log file
    await fs.appendFile(
      LOG_FILE_PATH,
      JSON.stringify(logEntry) + '\n',
      'utf8'
    );

    logger.info('Query metrics logged:', {
      query: input.query,
      intent: input.intent,
      usedGPT: input.usedGPT,
      score: input.score
    });

  } catch (error) {
    // If file writing fails, store in memory
    logger.warn('Failed to write to log file, using in-memory storage:', error);
    
    inMemoryLogs.push(logEntry);
    
    // Keep only the most recent logs
    if (inMemoryLogs.length > MAX_IN_MEMORY_LOGS) {
      inMemoryLogs.shift();
    }
  }
}

/**
 * Get query handling metrics for analysis
 * @param {Object} options - Query options
 * @param {Date} [options.startDate] - Start date for filtering
 * @param {Date} [options.endDate] - End date for filtering
 * @param {string} [options.intent] - Filter by intent
 * @returns {Promise<Array>} Array of log entries
 */
export async function getQueryMetrics(options = {}) {
  try {
    // Read log file
    const logContent = await fs.readFile(LOG_FILE_PATH, 'utf8');
    let logs = logContent
      .trim()
      .split('\n')
      .map(line => JSON.parse(line));

    // Apply filters
    if (options.startDate) {
      logs = logs.filter(log => new Date(log.timestamp) >= options.startDate);
    }
    if (options.endDate) {
      logs = logs.filter(log => new Date(log.timestamp) <= options.endDate);
    }
    if (options.intent) {
      logs = logs.filter(log => log.intent === options.intent);
    }

    return logs;

  } catch (error) {
    // If file reading fails, return in-memory logs
    logger.warn('Failed to read log file, returning in-memory logs:', error);
    return inMemoryLogs;
  }
}

/**
 * Get summary statistics for query handling
 * @returns {Promise<Object>} Summary statistics
 */
export async function getQueryStats() {
  const logs = await getQueryMetrics();
  
  const stats = {
    totalQueries: logs.length,
    gptUsage: logs.filter(log => log.usedGPT).length,
    intentDistribution: {},
    averageScore: 0,
    errorRate: 0
  };

  // Calculate intent distribution
  logs.forEach(log => {
    stats.intentDistribution[log.intent] = (stats.intentDistribution[log.intent] || 0) + 1;
  });

  // Calculate average score (excluding undefined scores)
  const scores = logs.filter(log => log.score !== undefined).map(log => log.score);
  if (scores.length > 0) {
    stats.averageScore = scores.reduce((a, b) => a + b, 0) / scores.length;
  }

  // Calculate error rate
  stats.errorRate = logs.filter(log => log.error).length / logs.length;

  return stats;
} 