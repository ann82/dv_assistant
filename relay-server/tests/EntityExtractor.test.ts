import { describe, it, expect } from 'vitest';
import { EntityExtractor } from '../lib/EntityExtractor';

describe('EntityExtractor', () => {
  const entityExtractor = new EntityExtractor();

  it('should extract location from query', () => {
    const query = 'I need a shelter in San Jose';
    const location = entityExtractor.extractLocation(query);
    expect(location).toBe('San Jose');
  });

  it('should extract location with trailing punctuation', () => {
    const query = "I'm looking for shelter homes near New York.";
    const location = entityExtractor.extractLocation(query);
    expect(location).toBe('New York');
  });

  it('should return null if no location found', () => {
    const query = 'I need help';
    const location = entityExtractor.extractLocation(query);
    expect(location).toBeNull();
  });

  it('should extract topic from query', () => {
    const query = "I'm looking for legal help";
    const topic = entityExtractor.extractTopic(query);
    expect(topic).toBe('legal help');
  });

  it('should return null if no topic found', () => {
    const query = 'I need help';
    const topic = entityExtractor.extractTopic(query);
    expect(topic).toBeNull();
  });
}); 