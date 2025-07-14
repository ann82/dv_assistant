#!/usr/bin/env node

import fs from 'fs/promises';
import path from 'path';

/**
 * Speech Transcription Monitor
 * 
 * This script analyzes logs to monitor speech transcription quality and identify patterns
 * that might indicate hallucination or poor transcription accuracy.
 */

class SpeechTranscriptionMonitor {
  constructor() {
    this.logFile = path.join(process.cwd(), 'logs', 'app.log');
    this.results = {
      totalRequests: 0,
      emptyTranscriptions: 0,
      lowConfidenceTranscriptions: 0,
      suspiciousPatterns: [],
      commonErrors: {},
      averageLength: 0,
      lengthDistribution: {}
    };
  }

  async analyzeLogs() {
    console.log('🔍 Analyzing speech transcription logs...\n');
    
    try {
      const logContent = await fs.readFile(this.logFile, 'utf8');
      const lines = logContent.split('\n');
      
      let speechEntries = [];
      
      // Parse log entries
      for (const line of lines) {
        if (line.includes('🔊 SPEECH TRANSCRIPTION DEBUG')) {
          try {
            const jsonStart = line.indexOf('{');
            if (jsonStart !== -1) {
              const jsonPart = line.substring(jsonStart);
              const entry = JSON.parse(jsonPart);
              speechEntries.push(entry);
            }
          } catch (error) {
            // Skip malformed JSON
          }
        }
      }
      
      console.log(`📊 Found ${speechEntries.length} speech transcription entries\n`);
      
      if (speechEntries.length === 0) {
        console.log('❌ No speech transcription entries found in logs');
        console.log('💡 Make sure to run some voice calls first to generate logs');
        return;
      }
      
      // Analyze entries
      this.analyzeEntries(speechEntries);
      
      // Generate report
      this.generateReport();
      
    } catch (error) {
      console.error('❌ Error reading log file:', error.message);
      console.log('💡 Make sure the log file exists and is readable');
    }
  }

  analyzeEntries(entries) {
    let totalLength = 0;
    const lengths = [];
    
    for (const entry of entries) {
      this.results.totalRequests++;
      
      // Check for empty transcriptions
      if (!entry.rawSpeechResult || entry.rawSpeechResult.trim() === '') {
        this.results.emptyTranscriptions++;
      }
      
      // Check for low confidence (if available)
      if (entry.confidence && parseFloat(entry.confidence) < 0.7) {
        this.results.lowConfidenceTranscriptions++;
      }
      
      // Analyze speech length
      if (entry.rawSpeechResult) {
        const length = entry.rawSpeechResult.length;
        lengths.push(length);
        totalLength += length;
        
        // Categorize by length
        if (length === 0) {
          this.results.lengthDistribution['0'] = (this.results.lengthDistribution['0'] || 0) + 1;
        } else if (length < 10) {
          this.results.lengthDistribution['1-9'] = (this.results.lengthDistribution['1-9'] || 0) + 1;
        } else if (length < 50) {
          this.results.lengthDistribution['10-49'] = (this.results.lengthDistribution['10-49'] || 0) + 1;
        } else if (length < 100) {
          this.results.lengthDistribution['50-99'] = (this.results.lengthDistribution['50-99'] || 0) + 1;
        } else {
          this.results.lengthDistribution['100+'] = (this.results.lengthDistribution['100+'] || 0) + 1;
        }
      }
      
      // Check for suspicious patterns
      this.checkSuspiciousPatterns(entry);
      
      // Track common errors
      this.trackCommonErrors(entry);
    }
    
    // Calculate average length
    this.results.averageLength = lengths.length > 0 ? Math.round(totalLength / lengths.length) : 0;
  }

  checkSuspiciousPatterns(entry) {
    const speech = entry.rawSpeechResult || '';
    
    // Check for repetitive patterns
    const words = speech.toLowerCase().split(/\s+/);
    const uniqueWords = new Set(words);
    const repetitionRatio = uniqueWords.size / words.length;
    
    if (words.length > 5 && repetitionRatio < 0.3) {
      this.results.suspiciousPatterns.push({
        type: 'high_repetition',
        speech: speech,
        repetitionRatio: repetitionRatio,
        callSid: entry.CallSid,
        timestamp: entry.timestamp
      });
    }
    
    // Check for nonsensical patterns
    const nonsensicalPatterns = [
      /^[a-z]+\s+\1\s+\1\s+\1/i, // Repeated words
      /^(um|uh|er|ah)\s+(um|uh|er|ah)\s+(um|uh|er|ah)/i, // Repeated fillers
      /^[a-z]{1,2}\s+[a-z]{1,2}\s+[a-z]{1,2}/i, // Very short words
    ];
    
    for (const pattern of nonsensicalPatterns) {
      if (pattern.test(speech)) {
        this.results.suspiciousPatterns.push({
          type: 'nonsensical_pattern',
          speech: speech,
          pattern: pattern.source,
          callSid: entry.CallSid,
          timestamp: entry.timestamp
        });
        break;
      }
    }
    
    // Check for very short responses that might be incomplete
    if (speech.length > 0 && speech.length < 5) {
      this.results.suspiciousPatterns.push({
        type: 'very_short',
        speech: speech,
        length: speech.length,
        callSid: entry.CallSid,
        timestamp: entry.timestamp
      });
    }
  }

  trackCommonErrors(entry) {
    const speech = entry.rawSpeechResult || '';
    
    // Track common transcription errors
    const commonErrors = [
      { pattern: /\b(um|uh|er|ah)\b/gi, name: 'filler_words' },
      { pattern: /\b(like|you know|i mean)\b/gi, name: 'speech_fillers' },
      { pattern: /[^a-zA-Z0-9\s]/g, name: 'special_characters' },
      { pattern: /\b[a-z]{1,2}\b/gi, name: 'very_short_words' }
    ];
    
    for (const error of commonErrors) {
      const matches = speech.match(error.pattern);
      if (matches) {
        this.results.commonErrors[error.name] = (this.results.commonErrors[error.name] || 0) + matches.length;
      }
    }
  }

  generateReport() {
    console.log('📋 SPEECH TRANSCRIPTION ANALYSIS REPORT');
    console.log('=====================================\n');
    
    // Summary statistics
    console.log('📊 SUMMARY STATISTICS:');
    console.log(`   Total speech requests: ${this.results.totalRequests}`);
    console.log(`   Empty transcriptions: ${this.results.emptyTranscriptions} (${this.getPercentage(this.results.emptyTranscriptions, this.results.totalRequests)}%)`);
    console.log(`   Low confidence transcriptions: ${this.results.lowConfidenceTranscriptions}`);
    console.log(`   Average speech length: ${this.results.averageLength} characters\n`);
    
    // Length distribution
    console.log('📏 LENGTH DISTRIBUTION:');
    for (const [range, count] of Object.entries(this.results.lengthDistribution)) {
      console.log(`   ${range}: ${count} (${this.getPercentage(count, this.results.totalRequests)}%)`);
    }
    console.log('');
    
    // Suspicious patterns
    if (this.results.suspiciousPatterns.length > 0) {
      console.log('⚠️  SUSPICIOUS PATTERNS DETECTED:');
      for (const pattern of this.results.suspiciousPatterns.slice(0, 10)) { // Show first 10
        console.log(`   ${pattern.type.toUpperCase()}: "${pattern.speech}" (Call: ${pattern.callSid})`);
      }
      if (this.results.suspiciousPatterns.length > 10) {
        console.log(`   ... and ${this.results.suspiciousPatterns.length - 10} more`);
      }
      console.log('');
    }
    
    // Common errors
    if (Object.keys(this.results.commonErrors).length > 0) {
      console.log('🔍 COMMON TRANSCRIPTION PATTERNS:');
      for (const [error, count] of Object.entries(this.results.commonErrors)) {
        console.log(`   ${error}: ${count} occurrences`);
      }
      console.log('');
    }
    
    // Recommendations
    console.log('💡 RECOMMENDATIONS:');
    
    if (this.results.emptyTranscriptions > this.results.totalRequests * 0.1) {
      console.log('   ⚠️  High rate of empty transcriptions - check audio quality and speech settings');
    }
    
    if (this.results.suspiciousPatterns.length > 0) {
      console.log('   ⚠️  Suspicious patterns detected - consider adjusting speech model or timeout settings');
    }
    
    if (this.results.averageLength < 20) {
      console.log('   ⚠️  Very short average speech length - may indicate incomplete transcriptions');
    }
    
    console.log('   ✅ Consider enabling enhanced speech recognition for better accuracy');
    console.log('   ✅ Adjust speechTimeout to allow for longer pauses');
    console.log('   ✅ Use phone_call speech model for better call quality handling');
  }

  getPercentage(part, total) {
    return total > 0 ? Math.round((part / total) * 100) : 0;
  }
}

// Run the analysis
const monitor = new SpeechTranscriptionMonitor();
monitor.analyzeLogs().catch(console.error); 