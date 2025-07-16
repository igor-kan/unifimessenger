const { WebClient } = require('@slack/web-api');
const { SocketModeClient } = require('@slack/socket-mode');
const BaseIntegration = require('../core/BaseIntegration');
const logger = require('../utils/logger');

class SlackIntegration extends BaseIntegration {
  constructor(config) {
    super('slack', config);
    this.webClient = null;
    this.socketClient = null;
    this.channels = new Map();
    this.users = new Map();
  }

  async connect() {
    try {
      if (!this.config.botToken || !this.config.appToken) {
        throw new Error('Slack bot token and app token are required');
      }

      this.webClient = new WebClient(this.config.botToken);
      this.socketClient = new SocketModeClient({
        appToken: this.config.appToken,
        webClient: this.webClient
      });

      this.socketClient.on('message', async (args) => {
        await this.handleMessage(args);
      });

      this.socketClient.on('app_mention', async (args) => {
        await this.handleMessage(args);
      });

      this.socketClient.on('error', (error) => {
        logger.error('Slack socket error:', error);
        this.emitError(error);
      });

      this.socketClient.on('ready', () => {
        this.emitStatus('connected');
        logger.info('Slack integration connected successfully');
      });

      this.socketClient.on('disconnect', () => {
        this.emitStatus('disconnected');
        logger.info('Slack integration disconnected');
      });

      await this.socketClient.start();
      
      await this.loadChannels();
      await this.loadUsers();
      
    } catch (error) {
      logger.error('Failed to connect to Slack:', error);
      this.emitError(error);
      throw error;
    }
  }

  async disconnect() {
    if (this.socketClient) {
      await this.socketClient.disconnect();
      this.socketClient = null;
    }
    this.webClient = null;
    this.emitStatus('disconnected');
    logger.info('Slack integration disconnected');
  }

  async handleMessage(args) {
    const { event, ack } = args;
    
    if (ack) {
      await ack();
    }

    if (!event || event.subtype === 'bot_message') {
      return;
    }

    const channel = this.channels.get(event.channel);
    const user = this.users.get(event.user);

    const message = {
      text: event.text,
      user: event.user,
      channel: event.channel,
      ts: event.ts,
      thread_ts: event.thread_ts,
      username: user ? user.name : 'Unknown',
      channel_name: channel ? channel.name : 'Unknown',
      platform: 'slack'
    };

    this.emitMessage(message);
  }

  async sendMessage(channelId, content, options = {}) {
    if (!this.webClient) {
      throw new Error('Slack client not connected');
    }

    try {
      const sendOptions = {
        channel: channelId,
        text: content,
        thread_ts: options.threadTs,
        as_user: options.asUser || false,
        username: options.username,
        icon_emoji: options.iconEmoji,
        icon_url: options.iconUrl,
        unfurl_links: options.unfurlLinks !== false,
        unfurl_media: options.unfurlMedia !== false,
        ...options.extra
      };

      if (options.blocks) {
        sendOptions.blocks = options.blocks;
      }

      if (options.attachments) {
        sendOptions.attachments = options.attachments;
      }

      const result = await this.webClient.chat.postMessage(sendOptions);

      logger.info(`Sent message to Slack channel ${channelId}`);
      
      return {
        messageId: result.ts,
        channelId: result.channel,
        timestamp: result.ts,
        platform: 'slack'
      };
    } catch (error) {
      logger.error('Failed to send Slack message:', error);
      throw error;
    }
  }

  async getChannels() {
    await this.loadChannels();
    return Array.from(this.channels.values());
  }

  async loadChannels() {
    try {
      const result = await this.webClient.conversations.list({
        types: 'public_channel,private_channel,im,mpim',
        limit: 1000
      });

      for (const channel of result.channels) {
        this.channels.set(channel.id, {
          id: channel.id,
          name: channel.name,
          type: channel.is_channel ? 'channel' : 
                channel.is_group ? 'group' : 
                channel.is_im ? 'im' : 'mpim',
          isPrivate: channel.is_private,
          isMember: channel.is_member,
          topic: channel.topic ? channel.topic.value : '',
          purpose: channel.purpose ? channel.purpose.value : '',
          memberCount: channel.num_members,
          platform: 'slack'
        });
      }

      logger.info(`Loaded ${this.channels.size} Slack channels`);
    } catch (error) {
      logger.error('Failed to load Slack channels:', error);
      throw error;
    }
  }

  async loadUsers() {
    try {
      const result = await this.webClient.users.list({
        limit: 1000
      });

      for (const user of result.members) {
        this.users.set(user.id, {
          id: user.id,
          name: user.name,
          realName: user.real_name,
          displayName: user.profile.display_name,
          email: user.profile.email,
          isBot: user.is_bot,
          isActive: !user.deleted,
          timezone: user.tz,
          avatar: user.profile.image_72,
          platform: 'slack'
        });
      }

      logger.info(`Loaded ${this.users.size} Slack users`);
    } catch (error) {
      logger.error('Failed to load Slack users:', error);
      throw error;
    }
  }

  async getMessages(channelId, options = {}) {
    try {
      const result = await this.webClient.conversations.history({
        channel: channelId,
        limit: options.limit || 100,
        cursor: options.cursor,
        oldest: options.oldest,
        latest: options.latest
      });

      const messages = result.messages.map(msg => ({
        ...msg,
        platform: 'slack',
        username: this.users.get(msg.user)?.name || 'Unknown',
        channel_name: this.channels.get(channelId)?.name || 'Unknown'
      }));

      return messages;
    } catch (error) {
      logger.error('Failed to get Slack messages:', error);
      throw error;
    }
  }

  async getChannelInfo(channelId) {
    try {
      const result = await this.webClient.conversations.info({
        channel: channelId
      });

      return {
        ...result.channel,
        platform: 'slack'
      };
    } catch (error) {
      logger.error('Failed to get Slack channel info:', error);
      throw error;
    }
  }

  async getUserInfo(userId) {
    try {
      const result = await this.webClient.users.info({
        user: userId
      });

      return {
        ...result.user,
        platform: 'slack'
      };
    } catch (error) {
      logger.error('Failed to get Slack user info:', error);
      throw error;
    }
  }

  async editMessage(channelId, messageTs, newContent, options = {}) {
    try {
      const result = await this.webClient.chat.update({
        channel: channelId,
        ts: messageTs,
        text: newContent,
        blocks: options.blocks,
        attachments: options.attachments,
        ...options.extra
      });

      logger.info(`Edited message ${messageTs} in Slack channel ${channelId}`);
      return result;
    } catch (error) {
      logger.error('Failed to edit Slack message:', error);
      throw error;
    }
  }

  async deleteMessage(channelId, messageTs) {
    try {
      await this.webClient.chat.delete({
        channel: channelId,
        ts: messageTs
      });

      logger.info(`Deleted message ${messageTs} in Slack channel ${channelId}`);
    } catch (error) {
      logger.error('Failed to delete Slack message:', error);
      throw error;
    }
  }

  async addReaction(channelId, messageTs, emoji) {
    try {
      await this.webClient.reactions.add({
        channel: channelId,
        timestamp: messageTs,
        name: emoji
      });

      logger.info(`Added reaction ${emoji} to message ${messageTs} in Slack channel ${channelId}`);
    } catch (error) {
      logger.error('Failed to add Slack reaction:', error);
      throw error;
    }
  }

  async uploadFile(channelId, file, options = {}) {
    try {
      const result = await this.webClient.files.upload({
        channels: channelId,
        file: file,
        filename: options.filename,
        filetype: options.filetype,
        title: options.title,
        initial_comment: options.initialComment,
        thread_ts: options.threadTs
      });

      logger.info(`Uploaded file to Slack channel ${channelId}`);
      return result;
    } catch (error) {
      logger.error('Failed to upload file to Slack:', error);
      throw error;
    }
  }

  validateConfig() {
    return !!(this.config.botToken && this.config.appToken);
  }

  async healthCheck() {
    const baseCheck = await super.healthCheck();
    
    try {
      if (this.webClient) {
        const authTest = await this.webClient.auth.test();
        return {
          ...baseCheck,
          teamInfo: {
            id: authTest.team_id,
            name: authTest.team,
            userId: authTest.user_id,
            user: authTest.user
          },
          channelsCount: this.channels.size,
          usersCount: this.users.size
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

module.exports = SlackIntegration;