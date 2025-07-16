const EventEmitter = require('events');
const { v4: uuidv4 } = require('uuid');
const moment = require('moment');
const logger = require('../utils/logger');

class MessageManager extends EventEmitter {
  constructor() {
    super();
    this.messages = new Map();
    this.channels = new Map();
    this.integrations = new Map();
    this.aiAgents = new Map();
  }

  registerIntegration(platform, integration) {
    this.integrations.set(platform, integration);
    logger.info(`Registered integration for ${platform}`);
    
    integration.on('message', (message) => {
      this.handleIncomingMessage(platform, message);
    });
    
    integration.on('status', (status) => {
      this.emit('integration_status', { platform, status });
    });
  }

  handleIncomingMessage(platform, rawMessage) {
    const message = this.normalizeMessage(platform, rawMessage);
    
    this.messages.set(message.id, message);
    
    logger.info(`Received message from ${platform}: ${message.content}`);
    
    this.emit('message', message);
    
    if (this.shouldProcessWithAI(message)) {
      this.processWithAI(message);
    }
  }

  normalizeMessage(platform, rawMessage) {
    const baseMessage = {
      id: uuidv4(),
      platform,
      timestamp: moment().toISOString(),
      processed: false,
      reactions: [],
      attachments: []
    };

    switch (platform) {
      case 'telegram':
        return {
          ...baseMessage,
          content: rawMessage.text || rawMessage.caption || '[Media]',
          author: {
            id: rawMessage.from.id,
            username: rawMessage.from.username,
            firstName: rawMessage.from.first_name,
            lastName: rawMessage.from.last_name
          },
          channelId: rawMessage.chat.id,
          channelName: rawMessage.chat.title || rawMessage.chat.first_name,
          messageId: rawMessage.message_id,
          type: this.getMessageType(rawMessage)
        };
      
      case 'slack':
        return {
          ...baseMessage,
          content: rawMessage.text || '[Media]',
          author: {
            id: rawMessage.user,
            username: rawMessage.username
          },
          channelId: rawMessage.channel,
          channelName: rawMessage.channel_name,
          messageId: rawMessage.ts,
          type: rawMessage.subtype || 'message'
        };
      
      case 'discord':
        return {
          ...baseMessage,
          content: rawMessage.content || '[Media]',
          author: {
            id: rawMessage.author.id,
            username: rawMessage.author.username,
            discriminator: rawMessage.author.discriminator
          },
          channelId: rawMessage.channel.id,
          channelName: rawMessage.channel.name,
          messageId: rawMessage.id,
          type: rawMessage.type
        };
      
      default:
        return {
          ...baseMessage,
          content: rawMessage.content || rawMessage.text || '[Unknown]',
          author: rawMessage.author || { id: 'unknown', username: 'Unknown' },
          channelId: rawMessage.channelId || 'unknown',
          channelName: rawMessage.channelName || 'Unknown',
          messageId: rawMessage.id || uuidv4(),
          type: 'message'
        };
    }
  }

  getMessageType(message) {
    if (message.photo) return 'photo';
    if (message.video) return 'video';
    if (message.audio) return 'audio';
    if (message.voice) return 'voice';
    if (message.document) return 'document';
    if (message.sticker) return 'sticker';
    return 'text';
  }

  shouldProcessWithAI(message) {
    return message.content.includes('@ai') || 
           message.content.startsWith('/ai') ||
           this.aiAgents.has(message.channelId);
  }

  async processWithAI(message) {
    try {
      const aiAgent = this.aiAgents.get(message.channelId) || this.aiAgents.get('global');
      
      if (!aiAgent) {
        logger.warn('No AI agent available for processing');
        return;
      }

      const response = await aiAgent.processMessage(message);
      
      if (response) {
        await this.sendMessage(message.platform, message.channelId, response);
      }
    } catch (error) {
      logger.error('Error processing message with AI:', error);
    }
  }

  async sendMessage(platform, channelId, content, options = {}) {
    const integration = this.integrations.get(platform);
    
    if (!integration) {
      throw new Error(`No integration found for platform: ${platform}`);
    }

    try {
      const result = await integration.sendMessage(channelId, content, options);
      
      const message = this.normalizeMessage(platform, {
        text: content,
        from: { id: 'bot', username: 'UnifiMessenger' },
        chat: { id: channelId },
        message_id: result.messageId || uuidv4()
      });

      this.messages.set(message.id, message);
      this.emit('message_sent', message);
      
      logger.info(`Sent message to ${platform}:${channelId}: ${content}`);
      
      return result;
    } catch (error) {
      logger.error(`Failed to send message to ${platform}:${channelId}:`, error);
      throw error;
    }
  }

  async sendCrossChannelMessage(content, options = {}) {
    const results = [];
    
    for (const [platform, integration] of this.integrations) {
      try {
        const channels = options.channels || this.getActiveChannels(platform);
        
        for (const channelId of channels) {
          const result = await this.sendMessage(platform, channelId, content, options);
          results.push({ platform, channelId, result });
        }
      } catch (error) {
        logger.error(`Failed to send cross-channel message to ${platform}:`, error);
        results.push({ platform, error: error.message });
      }
    }
    
    return results;
  }

  getActiveChannels(platform) {
    const channels = [];
    
    for (const [messageId, message] of this.messages) {
      if (message.platform === platform && !channels.includes(message.channelId)) {
        channels.push(message.channelId);
      }
    }
    
    return channels;
  }

  getMessages(filters = {}) {
    let messages = Array.from(this.messages.values());
    
    if (filters.platform) {
      messages = messages.filter(msg => msg.platform === filters.platform);
    }
    
    if (filters.channelId) {
      messages = messages.filter(msg => msg.channelId === filters.channelId);
    }
    
    if (filters.author) {
      messages = messages.filter(msg => 
        msg.author.username === filters.author || 
        msg.author.id === filters.author
      );
    }
    
    if (filters.since) {
      messages = messages.filter(msg => 
        moment(msg.timestamp).isAfter(moment(filters.since))
      );
    }
    
    if (filters.limit) {
      messages = messages.slice(-filters.limit);
    }
    
    return messages.sort((a, b) => 
      moment(a.timestamp).isBefore(moment(b.timestamp)) ? -1 : 1
    );
  }

  getChannels() {
    const channels = new Map();
    
    for (const message of this.messages.values()) {
      const key = `${message.platform}:${message.channelId}`;
      
      if (!channels.has(key)) {
        channels.set(key, {
          platform: message.platform,
          id: message.channelId,
          name: message.channelName,
          lastMessage: message.timestamp,
          messageCount: 0
        });
      }
      
      channels.get(key).messageCount++;
      
      if (moment(message.timestamp).isAfter(moment(channels.get(key).lastMessage))) {
        channels.get(key).lastMessage = message.timestamp;
      }
    }
    
    return Array.from(channels.values());
  }

  registerAIAgent(id, agent) {
    this.aiAgents.set(id, agent);
    logger.info(`Registered AI agent: ${id}`);
  }

  getStats() {
    const stats = {
      totalMessages: this.messages.size,
      platforms: this.integrations.size,
      channels: this.getChannels().length,
      aiAgents: this.aiAgents.size,
      messagesByPlatform: {}
    };

    for (const message of this.messages.values()) {
      stats.messagesByPlatform[message.platform] = 
        (stats.messagesByPlatform[message.platform] || 0) + 1;
    }

    return stats;
  }
}

module.exports = MessageManager;