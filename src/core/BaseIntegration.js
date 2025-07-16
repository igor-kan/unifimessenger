const EventEmitter = require('events');
const logger = require('../utils/logger');

class BaseIntegration extends EventEmitter {
  constructor(platform, config) {
    super();
    this.platform = platform;
    this.config = config;
    this.connected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
  }

  async connect() {
    throw new Error('connect() method must be implemented by subclass');
  }

  async disconnect() {
    throw new Error('disconnect() method must be implemented by subclass');
  }

  async sendMessage(channelId, content, options = {}) {
    throw new Error('sendMessage() method must be implemented by subclass');
  }

  async getChannels() {
    throw new Error('getChannels() method must be implemented by subclass');
  }

  async getMessages(channelId, options = {}) {
    throw new Error('getMessages() method must be implemented by subclass');
  }

  async handleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.error(`Max reconnect attempts reached for ${this.platform}`);
      this.emit('error', new Error('Max reconnect attempts reached'));
      return;
    }

    this.reconnectAttempts++;
    logger.info(`Attempting to reconnect to ${this.platform} (attempt ${this.reconnectAttempts})`);

    setTimeout(async () => {
      try {
        await this.connect();
        this.reconnectAttempts = 0;
        logger.info(`Successfully reconnected to ${this.platform}`);
      } catch (error) {
        logger.error(`Reconnection failed for ${this.platform}:`, error);
        this.handleReconnect();
      }
    }, this.reconnectDelay * this.reconnectAttempts);
  }

  emitMessage(message) {
    this.emit('message', message);
  }

  emitStatus(status) {
    this.connected = status === 'connected';
    this.emit('status', status);
    logger.info(`${this.platform} status: ${status}`);
  }

  emitError(error) {
    this.emit('error', error);
    logger.error(`${this.platform} error:`, error);
  }

  isConnected() {
    return this.connected;
  }

  getConfig() {
    return this.config;
  }

  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
  }

  validateConfig() {
    return true;
  }

  async healthCheck() {
    return {
      platform: this.platform,
      connected: this.connected,
      lastActivity: new Date().toISOString(),
      config: this.validateConfig()
    };
  }
}

module.exports = BaseIntegration;