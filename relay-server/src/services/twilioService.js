export class TwilioService {
  constructor(client) {
    this.client = client;
  }

  async createCall(to, url) {
    try {
      const call = await this.client.calls.create({
        to,
        from: process.env.TWILIO_PHONE_NUMBER,
        url
      });
      return call;
    } catch (error) {
      throw new Error(error.message || 'Call failed');
    }
  }
} 