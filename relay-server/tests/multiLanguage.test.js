import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getLanguageConfig, DEFAULT_LANGUAGE, getSupportedLanguages, isLanguageSupported } from '../lib/languageConfig.js';

describe('Multi-Language Support', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Language Configuration', () => {
    it('should return English config for en-US', () => {
      const config = getLanguageConfig('en-US');
      expect(config.name).toBe('English (US)');
      expect(config.twilioVoice).toBe('Polly.Amy');
      expect(config.twilioLanguage).toBe('en-US');
      expect(config.twilioSpeechRecognitionLanguage).toBe('en-US');
    });

    it('should return Spanish config for es-ES', () => {
      const config = getLanguageConfig('es-ES');
      expect(config.name).toBe('Español (España)');
      expect(config.twilioVoice).toBe('Polly.Conchita');
      expect(config.twilioLanguage).toBe('es-ES');
      expect(config.twilioSpeechRecognitionLanguage).toBe('es-ES');
    });

    it('should return French config for fr-FR', () => {
      const config = getLanguageConfig('fr-FR');
      expect(config.name).toBe('Français (France)');
      expect(config.twilioVoice).toBe('Polly.Celine');
      expect(config.twilioLanguage).toBe('fr-FR');
      expect(config.twilioSpeechRecognitionLanguage).toBe('fr-FR');
    });

    it('should return German config for de-DE', () => {
      const config = getLanguageConfig('de-DE');
      expect(config.name).toBe('Deutsch (Deutschland)');
      expect(config.twilioVoice).toBe('Polly.Marlene');
      expect(config.twilioLanguage).toBe('de-DE');
      expect(config.twilioSpeechRecognitionLanguage).toBe('de-DE');
    });

    it('should fallback to English for unsupported language', () => {
      const config = getLanguageConfig('zh-CN');
      expect(config.name).toBe('English (US)');
      expect(config.twilioVoice).toBe('Polly.Amy');
    });

    it('should handle language-only codes', () => {
      const config = getLanguageConfig('es');
      expect(config.name).toBe('Español (España)');
    });

    it('should handle case insensitive codes', () => {
      const config = getLanguageConfig('ES-ES');
      expect(config.name).toBe('Español (España)');
    });
  });

  describe('Language Detection', () => {
    it('should detect Spanish from text', async () => {
      const { TwilioVoiceHandler } = await import('../lib/twilioVoice.js');
      const handler = new TwilioVoiceHandler('test', 'test', '+1234567890');
      
      const spanishText = 'hola, necesito ayuda por favor';
      const detectedLang = handler.detectLanguageFromText(spanishText);
      expect(detectedLang).toBe('es-ES');
    });

    it('should detect French from text', async () => {
      const { TwilioVoiceHandler } = await import('../lib/twilioVoice.js');
      const handler = new TwilioVoiceHandler('test', 'test', '+1234567890');
      
      const frenchText = 'bonjour, j\'ai besoin d\'aide s\'il vous plaît';
      const detectedLang = handler.detectLanguageFromText(frenchText);
      expect(detectedLang).toBe('fr-FR');
    });

    it('should detect German from text', async () => {
      const { TwilioVoiceHandler } = await import('../lib/twilioVoice.js');
      const handler = new TwilioVoiceHandler('test', 'test', '+1234567890');
      
      const germanText = 'hallo, ich brauche hilfe bitte';
      const detectedLang = handler.detectLanguageFromText(germanText);
      expect(detectedLang).toBe('de-DE');
    });

    it('should return null for English text', async () => {
      const { TwilioVoiceHandler } = await import('../lib/twilioVoice.js');
      const handler = new TwilioVoiceHandler('test', 'test', '+1234567890');
      
      const englishText = 'hello, I need help please';
      const detectedLang = handler.detectLanguageFromText(englishText);
      expect(detectedLang).toBeNull();
    });
  });

  describe('Localized Prompts', () => {
    it('should return English welcome message', async () => {
      const { TwilioVoiceHandler } = await import('../lib/twilioVoice.js');
      const handler = new TwilioVoiceHandler('test', 'test', '+1234567890');
      
      const welcome = handler.getLocalizedPrompt('en-US', 'welcome');
      expect(welcome).toContain('Hello, and thank you for reaching out');
    });

    it('should return Spanish welcome message', async () => {
      const { TwilioVoiceHandler } = await import('../lib/twilioVoice.js');
      const handler = new TwilioVoiceHandler('test', 'test', '+1234567890');
      
      const welcome = handler.getLocalizedPrompt('es-ES', 'welcome');
      expect(welcome).toContain('Hola, y gracias por contactarnos');
    });

    it('should return French welcome message', async () => {
      const { TwilioVoiceHandler } = await import('../lib/twilioVoice.js');
      const handler = new TwilioVoiceHandler('test', 'test', '+1234567890');
      
      const welcome = handler.getLocalizedPrompt('fr-FR', 'welcome');
      expect(welcome).toContain('Bonjour, et merci de nous avoir contactés');
    });

    it('should return German welcome message', async () => {
      const { TwilioVoiceHandler } = await import('../lib/twilioVoice.js');
      const handler = new TwilioVoiceHandler('test', 'test', '+1234567890');
      
      const welcome = handler.getLocalizedPrompt('de-DE', 'welcome');
      expect(welcome).toContain('Hallo und vielen Dank, dass Sie sich gemeldet haben');
    });

    it('should return fallback for unknown prompt', async () => {
      const { TwilioVoiceHandler } = await import('../lib/twilioVoice.js');
      const handler = new TwilioVoiceHandler('test', 'test', '+1234567890');
      
      const fallback = handler.getLocalizedPrompt('en-US', 'unknownPrompt');
      expect(fallback).toContain('I\'m sorry, I didn\'t understand your request');
    });
  });

  describe('Supported Languages', () => {
    it('should return list of supported languages', () => {
      const languages = getSupportedLanguages();
      expect(languages).toContain('en-US');
      expect(languages).toContain('es-ES');
      expect(languages).toContain('fr-FR');
      expect(languages).toContain('de-DE');
    });

    it('should check if language is supported', () => {
      expect(isLanguageSupported('en-US')).toBe(true);
      expect(isLanguageSupported('es-ES')).toBe(true);
      expect(isLanguageSupported('zh-CN')).toBe(false);
    });
  });
}); 