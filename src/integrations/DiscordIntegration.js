const { Client, GatewayIntentBits, Collection } = require('discord.js');
const BaseIntegration = require('../core/BaseIntegration');
const logger = require('../utils/logger');

class DiscordIntegration extends BaseIntegration {
  constructor(config) {
    super('discord', config);
    this.client = null;
    this.guilds = new Map();
    this.channels = new Map();
    this.users = new Map();
  }

  async connect() {
    try {
      if (!this.config.botToken) {
        throw new Error('Discord bot token is required');
      }

      this.client = new Client({
        intents: [
          GatewayIntentBits.Guilds,
          GatewayIntentBits.GuildMessages,
          GatewayIntentBits.MessageContent,
          GatewayIntentBits.DirectMessages,
          GatewayIntentBits.GuildMembers,
          GatewayIntentBits.GuildPresences
        ]
      });

      this.client.on('ready', () => {
        this.emitStatus('connected');
        logger.info(`Discord integration connected as ${this.client.user.tag}`);
        this.loadGuildsAndChannels();
      });

      this.client.on('messageCreate', (message) => {
        this.handleMessage(message);
      });

      this.client.on('messageUpdate', (oldMessage, newMessage) => {
        this.handleMessage(newMessage, true);
      });

      this.client.on('error', (error) => {
        logger.error('Discord client error:', error);
        this.emitError(error);
      });

      this.client.on('disconnect', () => {
        this.emitStatus('disconnected');
        logger.info('Discord integration disconnected');
      });

      this.client.on('reconnecting', () => {
        this.emitStatus('reconnecting');
        logger.info('Discord integration reconnecting');
      });

      await this.client.login(this.config.botToken);
      
    } catch (error) {
      logger.error('Failed to connect to Discord:', error);
      this.emitError(error);
      throw error;
    }
  }

  async disconnect() {
    if (this.client) {
      await this.client.destroy();
      this.client = null;
    }
    this.emitStatus('disconnected');
    logger.info('Discord integration disconnected');
  }

  handleMessage(message, isEdit = false) {
    if (!message || message.author.bot) {
      return;
    }

    const processedMessage = {
      id: message.id,
      content: message.content,
      author: {
        id: message.author.id,
        username: message.author.username,
        discriminator: message.author.discriminator,
        avatar: message.author.displayAvatarURL()
      },
      channel: {
        id: message.channel.id,
        name: message.channel.name,
        type: message.channel.type
      },
      guild: message.guild ? {
        id: message.guild.id,
        name: message.guild.name
      } : null,
      timestamp: message.createdAt,
      editedTimestamp: message.editedAt,
      mentions: message.mentions.users.map(user => ({
        id: user.id,
        username: user.username
      })),
      attachments: message.attachments.map(attachment => ({
        id: attachment.id,
        url: attachment.url,
        filename: attachment.name,
        size: attachment.size,
        contentType: attachment.contentType
      })),
      embeds: message.embeds,
      reactions: message.reactions.cache.map(reaction => ({
        emoji: reaction.emoji.name,
        count: reaction.count
      })),
      isEdit,
      platform: 'discord'
    };

    this.emitMessage(processedMessage);
  }

  async sendMessage(channelId, content, options = {}) {
    if (!this.client) {
      throw new Error('Discord client not connected');
    }

    try {
      const channel = await this.client.channels.fetch(channelId);
      
      if (!channel) {
        throw new Error(`Channel ${channelId} not found`);
      }

      const sendOptions = {
        content: content,
        embeds: options.embeds,
        files: options.files,
        components: options.components,
        allowedMentions: options.allowedMentions,
        tts: options.tts || false,
        ephemeral: options.ephemeral || false
      };

      if (options.replyTo) {
        sendOptions.reply = {
          messageReference: options.replyTo,
          failIfNotExists: false
        };
      }

      const result = await channel.send(sendOptions);

      logger.info(`Sent message to Discord channel ${channelId}`);
      
      return {
        messageId: result.id,
        channelId: result.channel.id,
        timestamp: result.createdAt,
        platform: 'discord'
      };
    } catch (error) {
      logger.error('Failed to send Discord message:', error);
      throw error;
    }
  }

  async getChannels() {
    await this.loadGuildsAndChannels();
    return Array.from(this.channels.values());
  }

  async loadGuildsAndChannels() {
    try {
      const guilds = await this.client.guilds.fetch();
      
      for (const [guildId, guild] of guilds) {
        const fullGuild = await guild.fetch();
        
        this.guilds.set(guildId, {
          id: fullGuild.id,
          name: fullGuild.name,
          icon: fullGuild.iconURL(),
          memberCount: fullGuild.memberCount,
          owner: fullGuild.ownerId,
          platform: 'discord'
        });

        const channels = await fullGuild.channels.fetch();
        
        for (const [channelId, channel] of channels) {
          if (channel.type === 0 || channel.type === 1) { // TEXT or DM
            this.channels.set(channelId, {
              id: channel.id,
              name: channel.name,
              type: channel.type === 0 ? 'text' : 'dm',
              guildId: fullGuild.id,
              guildName: fullGuild.name,
              topic: channel.topic,
              nsfw: channel.nsfw,
              position: channel.position,
              platform: 'discord'
            });
          }
        }
      }

      logger.info(`Loaded ${this.guilds.size} Discord guilds and ${this.channels.size} channels`);
    } catch (error) {
      logger.error('Failed to load Discord guilds and channels:', error);
      throw error;
    }
  }

  async getMessages(channelId, options = {}) {
    try {
      const channel = await this.client.channels.fetch(channelId);
      
      if (!channel) {
        throw new Error(`Channel ${channelId} not found`);
      }

      const messages = await channel.messages.fetch({
        limit: options.limit || 100,
        before: options.before,
        after: options.after,
        around: options.around
      });

      return messages.map(msg => ({
        id: msg.id,
        content: msg.content,
        author: {
          id: msg.author.id,
          username: msg.author.username,
          discriminator: msg.author.discriminator,
          avatar: msg.author.displayAvatarURL()
        },
        channel: {
          id: msg.channel.id,
          name: msg.channel.name,
          type: msg.channel.type
        },
        timestamp: msg.createdAt,
        editedTimestamp: msg.editedAt,
        attachments: msg.attachments.map(att => ({
          id: att.id,
          url: att.url,
          filename: att.name,
          size: att.size
        })),
        embeds: msg.embeds,
        platform: 'discord'
      }));
    } catch (error) {
      logger.error('Failed to get Discord messages:', error);
      throw error;
    }
  }

  async getChannelInfo(channelId) {
    try {
      const channel = await this.client.channels.fetch(channelId);
      
      return {
        id: channel.id,
        name: channel.name,
        type: channel.type,
        topic: channel.topic,
        nsfw: channel.nsfw,
        position: channel.position,
        guild: channel.guild ? {
          id: channel.guild.id,
          name: channel.guild.name
        } : null,
        platform: 'discord'
      };
    } catch (error) {
      logger.error('Failed to get Discord channel info:', error);
      throw error;
    }
  }

  async getUserInfo(userId) {
    try {
      const user = await this.client.users.fetch(userId);
      
      return {
        id: user.id,
        username: user.username,
        discriminator: user.discriminator,
        avatar: user.displayAvatarURL(),
        bot: user.bot,
        system: user.system,
        createdAt: user.createdAt,
        platform: 'discord'
      };
    } catch (error) {
      logger.error('Failed to get Discord user info:', error);
      throw error;
    }
  }

  async editMessage(channelId, messageId, newContent, options = {}) {
    try {
      const channel = await this.client.channels.fetch(channelId);
      const message = await channel.messages.fetch(messageId);
      
      const result = await message.edit({
        content: newContent,
        embeds: options.embeds,
        components: options.components,
        files: options.files,
        allowedMentions: options.allowedMentions
      });

      logger.info(`Edited message ${messageId} in Discord channel ${channelId}`);
      return result;
    } catch (error) {
      logger.error('Failed to edit Discord message:', error);
      throw error;
    }
  }

  async deleteMessage(channelId, messageId) {
    try {
      const channel = await this.client.channels.fetch(channelId);
      const message = await channel.messages.fetch(messageId);
      
      await message.delete();
      
      logger.info(`Deleted message ${messageId} in Discord channel ${channelId}`);
    } catch (error) {
      logger.error('Failed to delete Discord message:', error);
      throw error;
    }
  }

  async addReaction(channelId, messageId, emoji) {
    try {
      const channel = await this.client.channels.fetch(channelId);
      const message = await channel.messages.fetch(messageId);
      
      await message.react(emoji);
      
      logger.info(`Added reaction ${emoji} to message ${messageId} in Discord channel ${channelId}`);
    } catch (error) {
      logger.error('Failed to add Discord reaction:', error);
      throw error;
    }
  }

  async setPresence(status, activity) {
    try {
      await this.client.user.setPresence({
        status: status,
        activities: activity ? [{
          name: activity.name,
          type: activity.type || 0
        }] : []
      });
      
      logger.info(`Set Discord presence: ${status}`);
    } catch (error) {
      logger.error('Failed to set Discord presence:', error);
      throw error;
    }
  }

  validateConfig() {
    return !!(this.config.botToken);
  }

  async healthCheck() {
    const baseCheck = await super.healthCheck();
    
    try {
      if (this.client && this.client.user) {
        return {
          ...baseCheck,
          botInfo: {
            id: this.client.user.id,
            username: this.client.user.username,
            discriminator: this.client.user.discriminator,
            avatar: this.client.user.displayAvatarURL()
          },
          guildsCount: this.guilds.size,
          channelsCount: this.channels.size,
          ping: this.client.ws.ping
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

module.exports = DiscordIntegration;