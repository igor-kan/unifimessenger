const { Telegraf } = require('telegraf');
const BaseIntegration = require('../core/BaseIntegration');
const logger = require('../utils/logger');

class TelegramIntegration extends BaseIntegration {
  constructor(config) {
    super('telegram', config);
    this.bot = null;
    this.chats = new Map();
  }

  async connect() {
    try {
      if (!this.config.botToken) {
        throw new Error('Telegram bot token is required');
      }

      this.bot = new Telegraf(this.config.botToken);
      
      this.bot.on('message', (ctx) => {
        this.handleMessage(ctx);
      });

      this.bot.on('edited_message', (ctx) => {
        this.handleMessage(ctx, true);
      });

      this.bot.catch((err, ctx) => {
        logger.error('Telegram bot error:', err);
        this.emitError(err);
      });

      await this.bot.launch();
      
      this.emitStatus('connected');
      logger.info('Telegram integration connected successfully');
      
      process.once('SIGINT', () => this.bot.stop('SIGINT'));
      process.once('SIGTERM', () => this.bot.stop('SIGTERM'));
      
    } catch (error) {
      logger.error('Failed to connect to Telegram:', error);
      this.emitError(error);
      throw error;
    }
  }

  async disconnect() {
    if (this.bot) {
      await this.bot.stop();
      this.bot = null;
    }
    this.emitStatus('disconnected');
    logger.info('Telegram integration disconnected');
  }

  handleMessage(ctx, isEdit = false) {
    const message = ctx.message || ctx.editedMessage;
    
    if (!message) return;

    this.chats.set(message.chat.id, {
      id: message.chat.id,
      type: message.chat.type,
      title: message.chat.title,
      username: message.chat.username,
      firstName: message.chat.first_name,
      lastName: message.chat.last_name
    });

    const processedMessage = {
      ...message,
      isEdit,
      platform: 'telegram'
    };

    this.emitMessage(processedMessage);
  }

  async sendMessage(chatId, content, options = {}) {
    if (!this.bot) {
      throw new Error('Telegram bot not connected');
    }

    try {
      const sendOptions = {
        parse_mode: options.parseMode || 'HTML',
        disable_web_page_preview: options.disableWebPagePreview || false,
        reply_to_message_id: options.replyToMessageId,
        ...options.extra
      };

      let result;

      if (options.type === 'photo' && options.photo) {
        result = await this.bot.telegram.sendPhoto(chatId, options.photo, {
          caption: content,
          ...sendOptions
        });
      } else if (options.type === 'audio' && options.audio) {
        result = await this.bot.telegram.sendAudio(chatId, options.audio, {
          caption: content,
          ...sendOptions
        });
      } else if (options.type === 'voice' && options.voice) {
        result = await this.bot.telegram.sendVoice(chatId, options.voice, {
          caption: content,
          ...sendOptions
        });
      } else if (options.type === 'document' && options.document) {
        result = await this.bot.telegram.sendDocument(chatId, options.document, {
          caption: content,
          ...sendOptions
        });
      } else {
        result = await this.bot.telegram.sendMessage(chatId, content, sendOptions);
      }

      logger.info(`Sent message to Telegram chat ${chatId}`);
      
      return {
        messageId: result.message_id,
        chatId: result.chat.id,
        timestamp: result.date,
        platform: 'telegram'
      };
    } catch (error) {
      logger.error('Failed to send Telegram message:', error);
      throw error;
    }
  }

  async getChannels() {
    return Array.from(this.chats.values());
  }

  async getMessages(chatId, options = {}) {
    try {
      const limit = options.limit || 100;
      const offset = options.offset || 0;
      
      const updates = await this.bot.telegram.getUpdates({
        offset: -limit,
        limit: limit
      });

      const messages = updates
        .filter(update => update.message && update.message.chat.id === parseInt(chatId))
        .map(update => ({
          ...update.message,
          platform: 'telegram'
        }));

      return messages;
    } catch (error) {
      logger.error('Failed to get Telegram messages:', error);
      throw error;
    }
  }

  async getChatInfo(chatId) {
    try {
      const chat = await this.bot.telegram.getChat(chatId);
      return {
        id: chat.id,
        type: chat.type,
        title: chat.title,
        username: chat.username,
        description: chat.description,
        memberCount: chat.members_count,
        platform: 'telegram'
      };
    } catch (error) {
      logger.error('Failed to get Telegram chat info:', error);
      throw error;
    }
  }

  async sendTypingAction(chatId) {
    try {
      await this.bot.telegram.sendChatAction(chatId, 'typing');
    } catch (error) {
      logger.error('Failed to send typing action:', error);
    }
  }

  async editMessage(chatId, messageId, newContent, options = {}) {
    try {
      const result = await this.bot.telegram.editMessageText(
        chatId,
        messageId,
        null,
        newContent,
        {
          parse_mode: options.parseMode || 'HTML',
          disable_web_page_preview: options.disableWebPagePreview || false,
          ...options.extra
        }
      );

      logger.info(`Edited message ${messageId} in Telegram chat ${chatId}`);
      return result;
    } catch (error) {
      logger.error('Failed to edit Telegram message:', error);
      throw error;
    }
  }

  async deleteMessage(chatId, messageId) {
    try {
      await this.bot.telegram.deleteMessage(chatId, messageId);
      logger.info(`Deleted message ${messageId} in Telegram chat ${chatId}`);
    } catch (error) {
      logger.error('Failed to delete Telegram message:', error);
      throw error;
    }
  }

  async getUserInfo(userId) {
    try {
      const user = await this.bot.telegram.getChat(userId);
      return {
        id: user.id,
        username: user.username,
        firstName: user.first_name,
        lastName: user.last_name,
        bio: user.bio,
        platform: 'telegram'
      };
    } catch (error) {
      logger.error('Failed to get Telegram user info:', error);
      throw error;
    }
  }

  validateConfig() {
    return !!(this.config.botToken);
  }

  async healthCheck() {
    const baseCheck = await super.healthCheck();
    
    try {
      if (this.bot) {
        const me = await this.bot.telegram.getMe();
        return {
          ...baseCheck,
          botInfo: {
            id: me.id,
            username: me.username,
            firstName: me.first_name
          },
          chatsCount: this.chats.size
        };
      }
    } catch (error) {
      return {
        ...baseCheck,
        error: error.message
      };
    }
    
    return baseCheck;
  }
}

module.exports = TelegramIntegration;