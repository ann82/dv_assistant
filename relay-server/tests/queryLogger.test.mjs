import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { logQueryHandling, getQueryMetrics, getQueryStats } from '../lib/queryLogger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Mock fs
vi.mock('fs/promises', () => ({
  mkdir: vi.fn(),
  appendFile: vi.fn(),
  readFile: vi.fn()
}));

describe('Query Logger', () => {
  const testLogPath = path.join(__dirname, '../logs/query_metrics.jsonl');
  
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(async () => {
    // Clean up any test files
    try {
      await fs.unlink(testLogPath);
    } catch (error) {
      // Ignore errors if file doesn't exist
    }
  });

  it('should log query handling metrics to file', async () => {
    const testEntry = {
      query: 'test query',
      intent: 'find_shelter',
      usedGPT: false,
      score: 0.8
    };

    await logQueryHandling(testEntry);

    expect(fs.mkdir).toHaveBeenCalled();
    expect(fs.appendFile).toHaveBeenCalledWith(
      expect.stringContaining('query_metrics.jsonl'),
      expect.stringContaining(JSON.stringify(testEntry)),
      'utf8'
    );
  });

  it('should handle file writing errors gracefully', async () => {
    const testEntry = {
      query: 'test query',
      intent: 'find_shelter',
      usedGPT: false,
      score: 0.8
    };

    // Mock file writing error
    fs.appendFile.mockRejectedValueOnce(new Error('Write error'));

    await logQueryHandling(testEntry);

    // Should not throw error
    expect(fs.appendFile).toHaveBeenCalled();
  });

  it('should retrieve query metrics with filters', async () => {
    const mockLogs = [
      {
        timestamp: '2024-01-01T00:00:00.000Z',
        query: 'test 1',
        intent: 'find_shelter',
        usedGPT: false,
        score: 0.8
      },
      {
        timestamp: '2024-01-02T00:00:00.000Z',
        query: 'test 2',
        intent: 'get_information',
        usedGPT: true,
        score: 0.3
      }
    ];

    fs.readFile.mockResolvedValueOnce(mockLogs.map(log => JSON.stringify(log)).join('\n'));

    const results = await getQueryMetrics({
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-01-02'),
      intent: 'find_shelter'
    });

    expect(results).toHaveLength(1);
    expect(results[0].query).toBe('test 1');
  });

  it('should calculate query statistics correctly', async () => {
    const mockLogs = [
      {
        timestamp: '2024-01-01T00:00:00.000Z',
        query: 'test 1',
        intent: 'find_shelter',
        usedGPT: false,
        score: 0.8
      },
      {
        timestamp: '2024-01-01T00:00:00.000Z',
        query: 'test 2',
        intent: 'find_shelter',
        usedGPT: true,
        score: 0.3
      },
      {
        timestamp: '2024-01-01T00:00:00.000Z',
        query: 'test 3',
        intent: 'get_information',
        usedGPT: true,
        score: 0.5,
        error: 'API error'
      }
    ];

    fs.readFile.mockResolvedValueOnce(mockLogs.map(log => JSON.stringify(log)).join('\n'));

    const stats = await getQueryStats();

    expect(stats.totalQueries).toBe(3);
    expect(stats.gptUsage).toBe(2);
    expect(stats.intentDistribution['find_shelter']).toBe(2);
    expect(stats.intentDistribution['get_information']).toBe(1);
    expect(stats.averageScore).toBeCloseTo(0.53, 2);
    expect(stats.errorRate).toBeCloseTo(0.33, 2);
  });

  it('should handle file reading errors gracefully', async () => {
    fs.readFile.mockRejectedValueOnce(new Error('Read error'));

    const results = await getQueryMetrics();
    expect(Array.isArray(results)).toBe(true);
  });
}); 