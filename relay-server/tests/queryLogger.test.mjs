import { describe, it, expect, vi, beforeEach } from 'vitest';
import { logQueryHandling, getQueryMetrics, getQueryStats } from '../lib/queryLogger.js';

// Mock fs/promises properly
vi.mock('fs/promises', () => {
  const mkdir = vi.fn();
  const appendFile = vi.fn();
  const readFile = vi.fn();
  return {
    mkdir,
    appendFile,
    readFile,
    default: { mkdir, appendFile, readFile }
  };
});

describe('Query Logger', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should log query handling metrics to file', async () => {
    const testEntry = {
      query: 'find shelter',
      intent: 'find_shelter',
      usedGPT: false,
      score: 0.8
    };

    await logQueryHandling(testEntry);

    const { mkdir, appendFile } = await import('fs/promises');
    expect(mkdir).toHaveBeenCalled();
    expect(appendFile).toHaveBeenCalledWith(
      expect.stringContaining('query_metrics.jsonl'),
      expect.stringContaining('find shelter'),
      'utf8'
    );
  });

  it('should handle file writing errors gracefully and use in-memory logs', async () => {
    const testEntry = {
      query: 'test query',
      intent: 'find_shelter',
      usedGPT: true,
      score: 0.5
    };

    // Mock file writing error
    const { appendFile } = await import('fs/promises');
    appendFile.mockRejectedValueOnce(new Error('Write error'));

    await logQueryHandling(testEntry);

    expect(appendFile).toHaveBeenCalled();
    // Now, simulate file read error to force in-memory log usage
    const { readFile } = await import('fs/promises');
    readFile.mockRejectedValueOnce(new Error('Read error'));
    const results = await getQueryMetrics();
    expect(results.some(r => r.query === 'test query')).toBe(true);
  });

  it('should retrieve query metrics with filters', async () => {
    const mockLogs = [
      {
        timestamp: '2023-01-01T00:00:00Z',
        query: 'find shelter',
        intent: 'find_shelter',
        usedGPT: false,
        score: 0.8
      },
      {
        timestamp: '2023-01-01T01:00:00Z',
        query: 'legal help',
        intent: 'legal_services',
        usedGPT: true,
        score: 0.3
      }
    ];

    const { readFile } = await import('fs/promises');
    readFile.mockResolvedValueOnce(mockLogs.map(log => JSON.stringify(log)).join('\n'));

    const results = await getQueryMetrics({
      intent: 'find_shelter',
      startDate: new Date('2023-01-01'),
      endDate: new Date('2023-01-02')
    });

    expect(results).toHaveLength(1);
    expect(results[0].intent).toBe('find_shelter');
  });

  it('should calculate query statistics correctly', async () => {
    const mockLogs = [
      {
        timestamp: '2023-01-01T00:00:00Z',
        query: 'find shelter',
        intent: 'find_shelter',
        usedGPT: false,
        score: 0.8
      },
      {
        timestamp: '2023-01-01T01:00:00Z',
        query: 'legal help',
        intent: 'legal_services',
        usedGPT: true,
        score: 0.3
      },
      {
        timestamp: '2023-01-01T02:00:00Z',
        query: 'counseling',
        intent: 'counseling_services',
        usedGPT: false,
        score: 0.9
      }
    ];

    const { readFile } = await import('fs/promises');
    readFile.mockResolvedValueOnce(mockLogs.map(log => JSON.stringify(log)).join('\n'));

    const stats = await getQueryStats();

    expect(stats.totalQueries).toBe(3);
    expect(stats.gptUsage).toBe(1);
    expect(stats.averageScore).toBeCloseTo(0.67, 2);
    expect(stats.intentDistribution).toHaveProperty('find_shelter', 1);
  });

  it('should handle file reading errors gracefully and return in-memory logs', async () => {
    const { readFile } = await import('fs/promises');
    readFile.mockRejectedValueOnce(new Error('Read error'));

    const results = await getQueryMetrics();

    expect(Array.isArray(results)).toBe(true);
  });
}); 