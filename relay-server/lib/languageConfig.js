/**
 * Multi-Language Configuration for Domestic Violence Support Assistant
 * 
 * This module provides language-specific configurations for:
 * - Twilio TTS voices and ASR settings
 * - Localized prompts and messages
 * - Language detection and fallback
 */

// Supported languages with their configurations
export const SUPPORTED_LANGUAGES = {
  'en-US': {
    name: 'English (US)',
    twilioVoice: 'Polly.Amy',
    openaiVoice: 'nova',
    twilioLanguage: 'en-US',
    twilioSpeechRecognitionLanguage: 'en-US',
    fallback: null,
    prompts: {
      welcome: `Hello, and thank you for reaching out. I'm here to listen and help you find the support and resources you need. Your safety is my top priority. Are you in immediate danger right now? If so, please call 911. Otherwise, I'm here to help you find shelters, counseling, legal services, or any other support you might need. What brings you to call today?`,
      incompleteLocation: `I'd be happy to help you find shelter. Could you please tell me which city, state, and country you're looking for? For example, you could say 'near San Francisco, California, USA' or 'in London, England, UK'.`,
      currentLocation: `I understand you want resources near your current location. To help you find the closest shelters, could you please tell me which city, state, and country you're in? For example, you could say 'I'm in San Francisco, California, USA' or 'near London, England, UK'.`,
      locationPrompt: `To help you find the right resources, could you please tell me which city, state, and country you're looking for? For example, you could say 'San Francisco, California, USA' or 'London, England, UK'.`,
      moreSpecificLocation: `I found a location, but I need more specific information to help you effectively. Could you please include the state or province and country? For example, instead of just 'San Francisco', please say 'San Francisco, California, USA'.`,
      confirmLocation: `I found a location you mentioned earlier: {{location}}. Would you like me to search for resources in that area? Please say yes or no.`,
      usePreviousLocation: `I found a location you mentioned earlier: {{location}}. Would you like me to use that location for your search, or would you prefer to provide a different location?`,
      emergency: `This is an emergency situation. Please call 911 immediately. You can also call the National Domestic Violence Hotline at 1-800-799-7233 for immediate assistance. They are available 24/7 and can help you with safety planning and emergency resources.`,
      fallback: `I'm sorry, I didn't understand your request. Could you please rephrase that or ask for help finding shelters, legal services, or general information about domestic violence?`,
      error: `I'm sorry, I encountered an error processing your request. Please try again.`,
      processingError: `I'm sorry, I couldn't process your request. Please try rephrasing your question with a specific location.`
    }
  },
  'es-ES': {
    name: 'Español (España)',
    twilioVoice: 'Polly.Conchita',
    openaiVoice: 'shimmer',
    twilioLanguage: 'es-ES',
    twilioSpeechRecognitionLanguage: 'es-ES',
    fallback: 'en-US',
    prompts: {
      welcome: `Hola, y gracias por contactarnos. Estoy aquí para escuchar y ayudarte a encontrar el apoyo y los recursos que necesitas. Tu seguridad es mi prioridad principal. ¿Estás en peligro inmediato en este momento? Si es así, por favor llama al 911. De lo contrario, estoy aquí para ayudarte a encontrar refugios, asesoramiento, servicios legales o cualquier otro apoyo que puedas necesitar. ¿Qué te trae a llamar hoy?`,
      incompleteLocation: `Me encantaría ayudarte a encontrar un refugio. ¿Podrías decirme en qué ciudad, estado y país estás buscando? Por ejemplo, podrías decir 'cerca de San Francisco, California, Estados Unidos' o 'en Londres, Inglaterra, Reino Unido'.`,
      currentLocation: `Entiendo que quieres recursos cerca de tu ubicación actual. Para ayudarte a encontrar los refugios más cercanos, ¿podrías decirme en qué ciudad, estado y país te encuentras? Por ejemplo, podrías decir 'estoy en San Francisco, California, Estados Unidos' o 'cerca de Londres, Inglaterra, Reino Unido'.`,
      locationPrompt: `Para ayudarte a encontrar los recursos adecuados, ¿podrías decirme en qué ciudad, estado y país estás buscando? Por ejemplo, podrías decir 'San Francisco, California, Estados Unidos' o 'Londres, Inglaterra, Reino Unido'.`,
      moreSpecificLocation: `Encontré una ubicación, pero necesito información más específica para ayudarte efectivamente. ¿Podrías incluir el estado o provincia y el país? Por ejemplo, en lugar de solo 'San Francisco', por favor di 'San Francisco, California, Estados Unidos'.`,
      confirmLocation: `Encontré una ubicación que mencionaste anteriormente: {{location}}. ¿Te gustaría que busque recursos en esa área? Por favor, di sí o no.`,
      usePreviousLocation: `Encontré una ubicación que mencionaste anteriormente: {{location}}. ¿Te gustaría usar esa ubicación para tu búsqueda, o prefieres proporcionar una ubicación diferente?`,
      emergency: `Esta es una situación de emergencia. Por favor llama al 911 inmediatamente. También puedes llamar a la Línea Nacional de Violencia Doméstica al 1-800-799-7233 para asistencia inmediata. Están disponibles las 24 horas y pueden ayudarte con la planificación de seguridad y recursos de emergencia.`,
      fallback: `Lo siento, no entendí tu solicitud. ¿Podrías reformularla o pedir ayuda para encontrar refugios, servicios legales o información general sobre violencia doméstica?`,
      error: `Lo siento, encontré un error al procesar tu solicitud. Por favor intenta de nuevo.`,
      processingError: `Lo siento, no pude procesar tu solicitud. Por favor intenta reformular tu pregunta con una ubicación específica.`
    }
  },
  'fr-FR': {
    name: 'Français (France)',
    twilioVoice: 'Polly.Celine',
    openaiVoice: 'echo',
    twilioLanguage: 'fr-FR',
    twilioSpeechRecognitionLanguage: 'fr-FR',
    fallback: 'en-US',
    prompts: {
      welcome: `Bonjour, et merci de nous avoir contactés. Je suis ici pour écouter et vous aider à trouver le soutien et les ressources dont vous avez besoin. Votre sécurité est ma priorité absolue. Êtes-vous en danger immédiat en ce moment ? Si c'est le cas, veuillez appeler le 911. Sinon, je suis ici pour vous aider à trouver des refuges, des conseils, des services juridiques ou tout autre soutien dont vous pourriez avoir besoin. Qu'est-ce qui vous amène à appeler aujourd'hui ?`,
      incompleteLocation: `Je serais ravi de vous aider à trouver un refuge. Pourriez-vous me dire dans quelle ville, état et pays vous cherchez ? Par exemple, vous pourriez dire 'près de San Francisco, Californie, États-Unis' ou 'à Londres, Angleterre, Royaume-Uni'.`,
      currentLocation: `Je comprends que vous voulez des ressources près de votre emplacement actuel. Pour vous aider à trouver les refuges les plus proches, pourriez-vous me dire dans quelle ville, état et pays vous vous trouvez ? Par exemple, vous pourriez dire 'je suis à San Francisco, Californie, États-Unis' ou 'près de Londres, Angleterre, Royaume-Uni'.`,
      locationPrompt: `Pour vous aider à trouver les bonnes ressources, pourriez-vous me dire dans quelle ville, état et pays vous cherchez ? Par exemple, vous pourriez dire 'San Francisco, Californie, États-Unis' ou 'Londres, Angleterre, Royaume-Uni'.`,
      moreSpecificLocation: `J'ai trouvé un emplacement, mais j'ai besoin d'informations plus spécifiques pour vous aider efficacement. Pourriez-vous inclure l'état ou la province et le pays ? Par exemple, au lieu de simplement 'San Francisco', veuillez dire 'San Francisco, Californie, États-Unis'.`,
      confirmLocation: `J'ai trouvé une localisation que vous avez mentionnée précédemment : {{location}}. Voulez-vous que je cherche des ressources dans cette région ? Dites oui ou non.`,
      usePreviousLocation: `J'ai trouvé une localisation que vous avez mentionnée précédemment : {{location}}. Voulez-vous utiliser cette localisation pour votre recherche, ou préférez-vous fournir une autre localisation ?`,
      emergency: `C'est une situation d'urgence. Veuillez appeler le 911 immédiatement. Vous pouvez également appeler la Ligne Nationale de Violence Domestique au 1-800-799-7233 pour une assistance immédiate. Ils sont disponibles 24h/24 et peuvent vous aider avec la planification de sécurité et les ressources d'urgence.`,
      fallback: `Je suis désolé, je n'ai pas compris votre demande. Pourriez-vous la reformuler ou demander de l'aide pour trouver des refuges, des services juridiques ou des informations générales sur la violence domestique ?`,
      error: `Je suis désolé, j'ai rencontré une erreur en traitant votre demande. Veuillez réessayer.`,
      processingError: `Je suis désolé, je n'ai pas pu traiter votre demande. Veuillez essayer de reformuler votre question avec un emplacement spécifique.`
    }
  },
  'de-DE': {
    name: 'Deutsch (Deutschland)',
    twilioVoice: 'Polly.Marlene',
    openaiVoice: 'onyx',
    twilioLanguage: 'de-DE',
    twilioSpeechRecognitionLanguage: 'de-DE',
    fallback: 'en-US',
    prompts: {
      welcome: `Hallo und vielen Dank, dass Sie sich gemeldet haben. Ich bin hier, um zuzuhören und Ihnen zu helfen, die Unterstützung und Ressourcen zu finden, die Sie benötigen. Ihre Sicherheit hat für mich oberste Priorität. Sind Sie derzeit in unmittelbarer Gefahr? Wenn ja, rufen Sie bitte 911 an. Ansonsten bin ich hier, um Ihnen zu helfen, Unterkünfte, Beratung, Rechtsdienstleistungen oder jede andere Unterstützung zu finden, die Sie benötigen könnten. Was bringt Sie dazu, heute anzurufen?`,
      incompleteLocation: `Ich helfe Ihnen gerne dabei, eine Unterkunft zu finden. Könnten Sie mir bitte sagen, in welcher Stadt, welchem Bundesland und welchem Land Sie suchen? Zum Beispiel könnten Sie sagen 'in der Nähe von San Francisco, Kalifornien, USA' oder 'in London, England, Großbritannien'.`,
      currentLocation: `Ich verstehe, dass Sie Ressourcen in der Nähe Ihres aktuellen Standorts möchten. Um Ihnen zu helfen, die nächsten Unterkünfte zu finden, könnten Sie mir bitte sagen, in welcher Stadt, welchem Bundesland und welchem Land Sie sich befinden? Zum Beispiel könnten Sie sagen 'ich bin in San Francisco, Kalifornien, USA' oder 'in der Nähe von London, England, Großbritannien'.`,
      locationPrompt: `Um Ihnen zu helfen, die richtigen Ressourcen zu finden, könnten Sie mir bitte sagen, in welcher Stadt, welchem Bundesland und welchem Land Sie suchen? Zum Beispiel könnten Sie sagen 'San Francisco, Kalifornien, USA' oder 'London, England, Großbritannien'.`,
      moreSpecificLocation: `Ich habe einen Standort gefunden, aber ich brauche spezifischere Informationen, um Ihnen effektiv zu helfen. Könnten Sie bitte das Bundesland oder die Provinz und das Land einschließen? Zum Beispiel, anstatt nur 'San Francisco' zu sagen, sagen Sie bitte 'San Francisco, Kalifornien, USA'.`,
      confirmLocation: `Ich habe eine Standort, die Sie zuvor erwähnt haben: {{location}}. Möchten Sie, dass ich Ressourcen in dieser Region suche? Bitte sagen Sie ja oder nein.`,
      usePreviousLocation: `Ich habe eine Standort, die Sie zuvor erwähnt haben: {{location}}. Möchten Sie diese Standort für Ihre Suche verwenden, oder möchten Sie eine andere Standort angeben?`,
      emergency: `Dies ist eine Notfallsituation. Bitte rufen Sie sofort 911 an. Sie können auch die Nationale Hotline für häusliche Gewalt unter 1-800-799-7233 für sofortige Hilfe anrufen. Sie sind rund um die Uhr verfügbar und können Ihnen bei der Sicherheitsplanung und Notfallressourcen helfen.`,
      fallback: `Es tut mir leid, ich habe Ihre Anfrage nicht verstanden. Könnten Sie sie bitte umformulieren oder um Hilfe beim Finden von Unterkünften, Rechtsdienstleistungen oder allgemeinen Informationen über häusliche Gewalt bitten?`,
      error: `Es tut mir leid, ich habe einen Fehler bei der Verarbeitung Ihrer Anfrage festgestellt. Bitte versuchen Sie es erneut.`,
      processingError: `Es tut mir leid, ich konnte Ihre Anfrage nicht verarbeiten. Bitte versuchen Sie, Ihre Frage mit einem spezifischen Standort umzuformulieren.`
    }
  }
};

// Default language
export const DEFAULT_LANGUAGE = 'en-US';

/**
 * Get language configuration
 * @param {string} languageCode - The language code (e.g., 'en-US', 'es-ES')
 * @returns {Object} Language configuration
 */
export function getLanguageConfig(languageCode) {
  const normalizedCode = languageCode?.toLowerCase().replace('_', '-');
  
  // Try exact match first
  if (SUPPORTED_LANGUAGES[normalizedCode]) {
    return SUPPORTED_LANGUAGES[normalizedCode];
  }
  
  // Try language-only match (e.g., 'en' for 'en-US')
  const languageOnly = normalizedCode?.split('-')[0];
  for (const [code, config] of Object.entries(SUPPORTED_LANGUAGES)) {
    if (code.startsWith(languageOnly + '-')) {
      return config;
    }
  }
  
  // Fallback to default
  return SUPPORTED_LANGUAGES[DEFAULT_LANGUAGE];
}

/**
 * Get supported language codes
 * @returns {Array} Array of supported language codes
 */
export function getSupportedLanguages() {
  return Object.keys(SUPPORTED_LANGUAGES);
}

/**
 * Get language name by code
 * @param {string} languageCode - The language code
 * @returns {string} Language name
 */
export function getLanguageName(languageCode) {
  const config = getLanguageConfig(languageCode);
  return config.name;
}

/**
 * Check if language is supported
 * @param {string} languageCode - The language code
 * @returns {boolean} True if supported
 */
export function isLanguageSupported(languageCode) {
  return !!SUPPORTED_LANGUAGES[languageCode];
}

/**
 * Get fallback language for a given language
 * @param {string} languageCode - The language code
 * @returns {string} Fallback language code
 */
export function getFallbackLanguage(languageCode) {
  const config = getLanguageConfig(languageCode);
  return config.fallback || DEFAULT_LANGUAGE;
} 