import express from 'express';
import logger from '../lib/logger.js';

const router = express.Router();

// In-memory storage for recent speech transcriptions (for debugging)
const recentTranscriptions = [];
const MAX_ENTRIES = 100;

// Add transcription to memory for monitoring
export function addTranscriptionEntry(entry) {
  recentTranscriptions.unshift({
    ...entry,
    timestamp: new Date().toISOString()
  });
  
  // Keep only the most recent entries
  if (recentTranscriptions.length > MAX_ENTRIES) {
    recentTranscriptions.splice(MAX_ENTRIES);
  }
}

/**
 * Get recent speech transcriptions for monitoring
 * @route GET /speech-monitor/recent
 * @returns {Object} Recent transcription entries
 */
router.get('/recent', (req, res) => {
  const limit = parseInt(req.query.limit) || 20;
  const entries = recentTranscriptions.slice(0, limit);
  
  res.json({
    total: recentTranscriptions.length,
    shown: entries.length,
    entries: entries
  });
});

/**
 * Get speech transcription statistics
 * @route GET /speech-monitor/stats
 * @returns {Object} Transcription statistics
 */
router.get('/stats', (req, res) => {
  if (recentTranscriptions.length === 0) {
    return res.json({
      total: 0,
      message: 'No transcriptions recorded yet'
    });
  }
  
  const stats = {
    total: recentTranscriptions.length,
    averageLength: 0,
    emptyCount: 0,
    suspiciousCount: 0,
    lengthDistribution: {},
    recentErrors: []
  };
  
  let totalLength = 0;
  let suspiciousEntries = [];
  
  for (const entry of recentTranscriptions) {
    const speech = entry.rawSpeechResult || '';
    const length = speech.length;
    
    totalLength += length;
    
    // Count empty transcriptions
    if (!speech.trim()) {
      stats.emptyCount++;
    }
    
    // Categorize by length
    if (length === 0) {
      stats.lengthDistribution['0'] = (stats.lengthDistribution['0'] || 0) + 1;
    } else if (length < 10) {
      stats.lengthDistribution['1-9'] = (stats.lengthDistribution['1-9'] || 0) + 1;
    } else if (length < 50) {
      stats.lengthDistribution['10-49'] = (stats.lengthDistribution['10-49'] || 0) + 1;
    } else if (length < 100) {
      stats.lengthDistribution['50-99'] = (stats.lengthDistribution['50-99'] || 0) + 1;
    } else {
      stats.lengthDistribution['100+'] = (stats.lengthDistribution['100+'] || 0) + 1;
    }
    
    // Check for suspicious patterns
    const words = speech.toLowerCase().split(/\s+/);
    const uniqueWords = new Set(words);
    const repetitionRatio = uniqueWords.size / words.length;
    
    if (words.length > 5 && repetitionRatio < 0.3) {
      suspiciousEntries.push({
        speech: speech,
        repetitionRatio: repetitionRatio,
        callSid: entry.CallSid,
        timestamp: entry.timestamp
      });
    }
    
    // Check for very short responses
    if (speech.length > 0 && speech.length < 5) {
      suspiciousEntries.push({
        speech: speech,
        type: 'very_short',
        callSid: entry.CallSid,
        timestamp: entry.timestamp
      });
    }
  }
  
  stats.averageLength = Math.round(totalLength / recentTranscriptions.length);
  stats.suspiciousCount = suspiciousEntries.length;
  stats.recentErrors = suspiciousEntries.slice(0, 10);
  
  res.json(stats);
});

/**
 * Clear recent transcriptions
 * @route DELETE /speech-monitor/clear
 * @returns {Object} Confirmation message
 */
router.delete('/clear', (req, res) => {
  const count = recentTranscriptions.length;
  recentTranscriptions.length = 0;
  
  logger.info('Speech monitor cleared', { entriesCleared: count });
  
  res.json({
    message: `Cleared ${count} transcription entries`,
    entriesCleared: count
  });
});

/**
 * Test speech transcription with sample data
 * @route POST /speech-monitor/test
 * @returns {Object} Test result
 */
router.post('/test', (req, res) => {
  const { speechResult, callSid, confidence } = req.body;
  
  if (!speechResult) {
    return res.status(400).json({ error: 'speechResult is required' });
  }
  
  const testEntry = {
    rawSpeechResult: speechResult,
    callSid: callSid || 'test-call',
    confidence: confidence || '0.8',
    speechModel: 'phone_call',
    enhanced: 'true',
    languageCode: 'en-US',
    isTest: true
  };
  
  addTranscriptionEntry(testEntry);
  
  logger.info('Speech monitor test entry added', testEntry);
  
  res.json({
    message: 'Test entry added successfully',
    entry: testEntry
  });
});

export default router; 