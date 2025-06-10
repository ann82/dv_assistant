export class IntentExtractor {
    constructor() {
        this.intents = ['find_shelter', 'get_info', 'legal_help'];
    }
    classifyIntent(query) {
        const lowerQuery = query.toLowerCase();
        for (const intent of this.intents) {
            if (lowerQuery.includes(intent)) {
                return intent;
            }
        }
        return 'unknown';
    }
}
//# sourceMappingURL=IntentExtractor.js.map