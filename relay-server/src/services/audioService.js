export class AudioService {
  constructor() {
    this.streams = {};
  }

  addStream(streamId, stream) {
    this.streams[streamId] = stream;
  }

  removeStream(streamId) {
    delete this.streams[streamId];
  }

  getStream(streamId) {
    return this.streams[streamId];
  }
} 