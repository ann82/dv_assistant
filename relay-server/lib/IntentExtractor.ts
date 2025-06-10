export class IntentExtractor {
  private intents: string[] = ['find_shelter', 'get_info', 'legal_help'];

  classifyIntent(query: string): string {
    const lowerQuery = query.toLowerCase();
    for (const intent of this.intents) {
      if (lowerQuery.includes(intent)) {
        return intent;
      }
    }
    return 'unknown';
  }
} 