const { OpenAI } = require('openai');
const logger = require('../utils/logger');

class AIAgent {
  constructor(config) {
    this.config = config;
    this.openai = new OpenAI({
      apiKey: config.apiKey
    });
    this.conversationHistory = new Map();
    this.systemPrompt = config.systemPrompt || this.getDefaultSystemPrompt();
    this.model = config.model || 'gpt-4';
    this.maxTokens = config.maxTokens || 1000;
    this.temperature = config.temperature || 0.7;
    this.crossChannelMode = config.crossChannelMode || false;
    this.channels = new Map();
  }

  getDefaultSystemPrompt() {
    return `You are UnifiMessenger AI, a helpful assistant that works across multiple messaging platforms including Telegram, Slack, Discord, and email. 

Your capabilities include:
- Responding to messages across different platforms
- Providing information and assistance
- Helping with cross-channel communication
- Translating messages between platforms
- Summarizing conversations
- Managing notifications and reminders

Be concise, helpful, and adapt your communication style to the platform being used. When working in cross-channel mode, you can relay messages between different platforms while maintaining context.

Current time: ${new Date().toISOString()}`;
  }

  async processMessage(message) {
    try {
      const conversationKey = `${message.platform}:${message.channelId}`;
      
      if (!this.conversationHistory.has(conversationKey)) {
        this.conversationHistory.set(conversationKey, []);
      }

      const history = this.conversationHistory.get(conversationKey);
      
      history.push({
        role: 'user',
        content: `[${message.platform}] ${message.author.username}: ${message.content}`,
        timestamp: message.timestamp,
        platform: message.platform,
        channelId: message.channelId
      });

      if (history.length > 20) {
        history.splice(0, history.length - 20);
      }

      if (this.shouldRespond(message)) {
        const response = await this.generateResponse(history, message);
        
        if (response) {
          history.push({
            role: 'assistant',
            content: response,
            timestamp: new Date().toISOString(),
            platform: message.platform,
            channelId: message.channelId
          });
          
          return response;
        }
      }
      
      return null;
    } catch (error) {
      logger.error('Error processing message with AI:', error);
      return 'Sorry, I encountered an error while processing your message.';
    }
  }

  shouldRespond(message) {
    const content = message.content.toLowerCase();
    
    const triggers = [
      '@ai',
      '/ai',
      'hey ai',
      'ai help',
      'unifimessenger',
      '@unifimessenger'
    ];
    
    return triggers.some(trigger => content.includes(trigger)) ||
           message.channelId.includes('ai') ||
           this.crossChannelMode;
  }

  async generateResponse(history, currentMessage) {
    try {
      const messages = [
        { role: 'system', content: this.systemPrompt },
        ...history.slice(-10).map(msg => ({
          role: msg.role,
          content: msg.content
        }))
      ];

      const completion = await this.openai.chat.completions.create({
        model: this.model,
        messages: messages,
        max_tokens: this.maxTokens,
        temperature: this.temperature,
        presence_penalty: 0.1,
        frequency_penalty: 0.1
      });

      const response = completion.choices[0].message.content.trim();
      
      logger.info(`Generated AI response for ${currentMessage.platform}:${currentMessage.channelId}`);
      
      return response;
    } catch (error) {
      logger.error('Error generating AI response:', error);
      throw error;
    }
  }

  async summarizeConversation(platform, channelId, messageCount = 50) {
    try {
      const conversationKey = `${platform}:${channelId}`;
      const history = this.conversationHistory.get(conversationKey) || [];
      
      if (history.length === 0) {
        return 'No conversation history found.';
      }

      const recentMessages = history.slice(-messageCount);
      
      const summaryPrompt = `Please provide a concise summary of this conversation:

${recentMessages.map(msg => `${msg.role}: ${msg.content}`).join('\n')}

Summary:`;

      const completion = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: 'You are a helpful assistant that summarizes conversations.' },
          { role: 'user', content: summaryPrompt }
        ],
        max_tokens: 500,
        temperature: 0.3
      });

      return completion.choices[0].message.content.trim();
    } catch (error) {
      logger.error('Error summarizing conversation:', error);
      return 'Sorry, I could not summarize the conversation.';
    }
  }

  async translateMessage(text, targetLanguage = 'en') {
    try {
      const prompt = `Translate the following text to ${targetLanguage}:

${text}

Translation:`;

      const completion = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: 'You are a professional translator.' },
          { role: 'user', content: prompt }
        ],
        max_tokens: 500,
        temperature: 0.3
      });

      return completion.choices[0].message.content.trim();
    } catch (error) {
      logger.error('Error translating message:', error);
      return 'Sorry, I could not translate the message.';
    }
  }

  async processCrossChannelMessage(fromMessage, targetPlatform, targetChannelId) {
    try {
      const contextPrompt = `You are relaying a message from ${fromMessage.platform} to ${targetPlatform}. 
      
Original message from ${fromMessage.author.username} on ${fromMessage.platform}: "${fromMessage.content}"

Please adapt this message appropriately for ${targetPlatform} while maintaining the original meaning. Consider the different communication styles and features of each platform.`;

      const completion = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: this.systemPrompt },
          { role: 'user', content: contextPrompt }
        ],
        max_tokens: 500,
        temperature: 0.5
      });

      const adaptedMessage = completion.choices[0].message.content.trim();
      
      logger.info(`Adapted message for cross-channel relay: ${fromMessage.platform} -> ${targetPlatform}`);
      
      return adaptedMessage;
    } catch (error) {
      logger.error('Error processing cross-channel message:', error);
      return `Message from ${fromMessage.author.username} on ${fromMessage.platform}: ${fromMessage.content}`;
    }
  }

  async generateSmartReply(message, context = {}) {
    try {
      const prompt = `Generate a smart reply to this message:

Message: "${message.content}"
From: ${message.author.username} on ${message.platform}
Context: ${JSON.stringify(context, null, 2)}

Generate 3 different reply options:
1. Professional/Formal
2. Casual/Friendly  
3. Brief/Quick

Reply options:`;

      const completion = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: 'You are a helpful assistant that generates smart reply options.' },
          { role: 'user', content: prompt }
        ],
        max_tokens: 300,
        temperature: 0.8
      });

      return completion.choices[0].message.content.trim();
    } catch (error) {
      logger.error('Error generating smart reply:', error);
      return 'Sorry, I could not generate reply options.';
    }
  }

  async analyzeMessageSentiment(message) {
    try {
      const prompt = `Analyze the sentiment of this message:

"${message.content}"

Provide:
1. Overall sentiment (positive/negative/neutral)
2. Confidence score (0-1)
3. Key emotional indicators
4. Suggested response tone

Analysis:`;

      const completion = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: 'You are a sentiment analysis expert.' },
          { role: 'user', content: prompt }
        ],
        max_tokens: 300,
        temperature: 0.3
      });

      return completion.choices[0].message.content.trim();
    } catch (error) {
      logger.error('Error analyzing message sentiment:', error);
      return 'Could not analyze sentiment.';
    }
  }

  addChannel(platform, channelId, config = {}) {
    const key = `${platform}:${channelId}`;
    this.channels.set(key, {
      platform,
      channelId,
      enabled: true,
      customPrompt: config.customPrompt,
      responseThreshold: config.responseThreshold || 0.5,
      ...config
    });
    
    logger.info(`Added AI channel: ${key}`);
  }

  removeChannel(platform, channelId) {
    const key = `${platform}:${channelId}`;
    this.channels.delete(key);
    this.conversationHistory.delete(key);
    
    logger.info(`Removed AI channel: ${key}`);
  }

  getChannelConfig(platform, channelId) {
    const key = `${platform}:${channelId}`;
    return this.channels.get(key);
  }

  clearHistory(platform, channelId) {
    const key = `${platform}:${channelId}`;
    this.conversationHistory.delete(key);
    
    logger.info(`Cleared AI history for: ${key}`);
  }

  getStats() {
    return {
      channels: this.channels.size,
      conversations: this.conversationHistory.size,
      totalMessages: Array.from(this.conversationHistory.values())
        .reduce((sum, history) => sum + history.length, 0),
      model: this.model,
      crossChannelMode: this.crossChannelMode
    };
  }
}

module.exports = AIAgent;