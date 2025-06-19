import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import twilioRoutes from '../routes/twilio.js';

describe('Twilio Routes', () => {
  let app;

  beforeEach(() => {
    // Create Express app
    app = express();
    app.use(express.json());
    app.use('/twilio', twilioRoutes);
    // Clear all mocks
    vi.clearAllMocks();
  });

  describe('POST /twilio/voice', () => {
    it('should handle incoming call', async () => {
      global.mockTwilioVoiceHandler.validateTwilioRequest.mockReturnValue(true);
      global.mockTwilioVoiceHandler.handleIncomingCall.mockResolvedValue({ success: true });

      const response = await request(app)
        .post('/twilio/voice')
        .send({ CallSid: 'test-call-sid' });

      expect(response.status).toBe(200);
      expect(global.mockTwilioVoiceHandler.handleIncomingCall).toHaveBeenCalled();
    });

    it('should handle invalid request', async () => {
      global.mockTwilioVoiceHandler.validateTwilioRequest.mockReturnValue(false);

      const response = await request(app)
        .post('/twilio/voice')
        .send({ CallSid: 'test-call-sid' });

      expect(response.status).toBe(403);
      expect(global.mockTwilioVoiceHandler.handleIncomingCall).not.toHaveBeenCalled();
    });
  });
}); 