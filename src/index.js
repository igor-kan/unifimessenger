const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();

const MessageManager = require('./core/MessageManager');
const TelegramIntegration = require('./integrations/TelegramIntegration');
const SlackIntegration = require('./integrations/SlackIntegration');
const DiscordIntegration = require('./integrations/DiscordIntegration');
const AIAgent = require('./ai/AIAgent');
const AudioManager = require('./audio/AudioManager');
const logger = require('./utils/logger');
const config = require('../config/config');

class UnifiMessengerServer {
  constructor() {
    this.app = express();
    this.server = http.createServer(this.app);
    this.wss = new WebSocket.Server({ server: this.server });
    this.messageManager = new MessageManager();
    this.aiAgent = null;
    this.audioManager = null;
    this.clients = new Set();
    
    this.setupMiddleware();
    this.setupRoutes();
    this.setupWebSocket();
    this.setupMessageManager();
    this.initializeComponents();
  }

  setupMiddleware() {
    this.app.use(helmet());
    this.app.use(cors());
    this.app.use(express.json({ limit: '50mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '50mb' }));
    this.app.use(express.static(path.join(__dirname, 'gui/renderer')));
  }

  setupRoutes() {
    this.app.get('/', (req, res) => {
      res.sendFile(path.join(__dirname, 'gui/renderer/index.html'));
    });

    this.app.get('/api/status', (req, res) => {
      res.json({
        status: 'running',
        version: '1.0.0',
        platforms: Array.from(this.messageManager.integrations.keys()),
        stats: this.messageManager.getStats(),
        ai: this.aiAgent ? this.aiAgent.getStats() : null,
        audio: this.audioManager ? this.audioManager.getStats() : null
      });
    });

    this.app.get('/api/platforms', (req, res) => {
      const platforms = {};
      for (const [name, integration] of this.messageManager.integrations) {
        platforms[name] = {
          connected: integration.isConnected(),
          health: integration.healthCheck()
        };
      }
      res.json(platforms);
    });

    this.app.post('/api/platforms/:platform/connect', async (req, res) => {
      try {
        const { platform } = req.params;
        const config = req.body;
        
        await this.connectPlatform(platform, config);
        
        res.json({ success: true, message: `Connected to ${platform}` });
      } catch (error) {
        logger.error(`Failed to connect to ${req.params.platform}:`, error);
        res.status(500).json({ success: false, error: error.message });
      }
    });

    this.app.post('/api/platforms/:platform/disconnect', async (req, res) => {
      try {
        const { platform } = req.params;
        
        await this.disconnectPlatform(platform);
        
        res.json({ success: true, message: `Disconnected from ${platform}` });
      } catch (error) {
        logger.error(`Failed to disconnect from ${req.params.platform}:`, error);
        res.status(500).json({ success: false, error: error.message });
      }
    });

    this.app.get('/api/messages', (req, res) => {
      const filters = {
        platform: req.query.platform,
        channelId: req.query.channel,
        author: req.query.author,
        since: req.query.since,
        limit: parseInt(req.query.limit) || 50
      };
      
      const messages = this.messageManager.getMessages(filters);
      res.json(messages);
    });

    this.app.post('/api/messages/send', async (req, res) => {
      try {
        const { platform, channelId, content, options } = req.body;
        
        const result = await this.messageManager.sendMessage(
          platform,
          channelId,
          content,
          options || {}
        );
        
        res.json({ success: true, data: result });
      } catch (error) {
        logger.error('Failed to send message:', error);
        res.status(500).json({ success: false, error: error.message });
      }
    });

    this.app.get('/api/channels', (req, res) => {
      const channels = this.messageManager.getChannels();
      const filtered = req.query.platform 
        ? channels.filter(ch => ch.platform === req.query.platform)
        : channels;
      
      res.json(filtered);
    });

    this.app.post('/api/ai/process', async (req, res) => {
      try {
        if (!this.aiAgent) {
          throw new Error('AI agent not initialized');
        }
        
        const { message } = req.body;
        const response = await this.aiAgent.processMessage(message);
        
        res.json({ success: true, response });
      } catch (error) {
        logger.error('Failed to process AI message:', error);
        res.status(500).json({ success: false, error: error.message });
      }
    });

    this.app.post('/api/audio/transcribe', async (req, res) => {
      try {
        if (!this.audioManager) {
          throw new Error('Audio manager not initialized');
        }
        
        const { audioPath, options } = req.body;
        const result = await this.audioManager.transcribeAudio(audioPath, options);
        
        res.json({ success: true, data: result });
      } catch (error) {
        logger.error('Failed to transcribe audio:', error);
        res.status(500).json({ success: false, error: error.message });
      }
    });

    this.app.post('/api/audio/synthesize', async (req, res) => {
      try {
        if (!this.audioManager) {
          throw new Error('Audio manager not initialized');
        }
        
        const { text, options } = req.body;
        const result = await this.audioManager.synthesizeText(text, options);
        
        res.json({ success: true, data: result });
      } catch (error) {
        logger.error('Failed to synthesize audio:', error);
        res.status(500).json({ success: false, error: error.message });
      }
    });
  }

  setupWebSocket() {
    this.wss.on('connection', (ws) => {
      this.clients.add(ws);
      logger.info('WebSocket client connected');
      
      ws.on('message', async (data) => {
        try {
          const message = JSON.parse(data);
          await this.handleWebSocketMessage(ws, message);
        } catch (error) {
          logger.error('WebSocket message error:', error);
          ws.send(JSON.stringify({
            type: 'error',
            data: error.message
          }));
        }
      });
      
      ws.on('close', () => {
        this.clients.delete(ws);
        logger.info('WebSocket client disconnected');
      });
      
      ws.send(JSON.stringify({
        type: 'status',
        data: { connected: true, platforms: Array.from(this.messageManager.integrations.keys()) }
      }));
    });
  }

  async handleWebSocketMessage(ws, message) {
    const { type, command, data } = message;
    
    if (type !== 'command') {
      return;
    }
    
    switch (command) {
      case 'send_message':
        const result = await this.messageManager.sendMessage(
          data.platform,
          data.channelId,
          data.content,
          data.options || {}
        );
        ws.send(JSON.stringify({ type: 'message_sent', data: result }));
        break;
        
      case 'list_messages':
        const messages = this.messageManager.getMessages(data);
        ws.send(JSON.stringify({ type: 'messages', data: messages }));
        break;
        
      case 'list_channels':
        const channels = this.messageManager.getChannels();
        const filtered = data.platform 
          ? channels.filter(ch => ch.platform === data.platform)
          : channels;
        ws.send(JSON.stringify({ type: 'channels', data: filtered }));
        break;
        
      case 'status':
        const status = {};
        for (const [platform, integration] of this.messageManager.integrations) {
          status[platform] = {
            connected: integration.isConnected(),
            health: await integration.healthCheck()
          };
        }
        ws.send(JSON.stringify({ type: 'status', data: status }));
        break;
        
      case 'ai_config':
        if (this.aiAgent) {
          if (data.mode) {
            this.aiAgent.crossChannelMode = data.mode === 'cross-channel';
          }
          if (data.channel && data.platform) {
            if (data.disable) {
              this.aiAgent.removeChannel(data.platform, data.channel);
            } else {
              this.aiAgent.addChannel(data.platform, data.channel, {
                customPrompt: data.prompt
              });
            }
          }
        }
        ws.send(JSON.stringify({ type: 'ai_configured', data: data }));
        break;
        
      case 'audio_transcribe':
        if (this.audioManager) {
          const transcription = await this.audioManager.transcribeAudio(data.file, data.options);
          ws.send(JSON.stringify({ type: 'audio_transcribed', data: transcription }));
        }
        break;
        
      case 'audio_synthesize':
        if (this.audioManager) {
          const synthesis = await this.audioManager.synthesizeText(data.text, data.options);
          ws.send(JSON.stringify({ type: 'audio_synthesized', data: synthesis }));
        }
        break;
        
      default:
        ws.send(JSON.stringify({
          type: 'error',
          data: `Unknown command: ${command}`
        }));
    }
  }

  setupMessageManager() {
    this.messageManager.on('message', (message) => {
      this.broadcastToClients({
        type: 'message',
        data: message
      });
    });
    
    this.messageManager.on('message_sent', (message) => {
      this.broadcastToClients({
        type: 'message_sent',
        data: message
      });
    });
    
    this.messageManager.on('integration_status', (status) => {
      this.broadcastToClients({
        type: 'integration_status',
        data: status
      });
    });
  }

  broadcastToClients(message) {
    const data = JSON.stringify(message);
    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    }
  }

  async initializeComponents() {
    try {
      if (process.env.OPENAI_API_KEY) {
        this.aiAgent = new AIAgent({
          apiKey: process.env.OPENAI_API_KEY,
          model: process.env.OPENAI_MODEL || 'gpt-4',
          crossChannelMode: process.env.AI_CROSS_CHANNEL === 'true'
        });
        
        this.messageManager.registerAIAgent('global', this.aiAgent);
        logger.info('AI Agent initialized');
      }
      
      this.audioManager = new AudioManager({
        tempDir: config.tempDir || './temp/audio',
        whisperModel: process.env.WHISPER_MODEL || 'base',
        elevenlabsApiKey: process.env.ELEVENLABS_API_KEY
      });
      
      logger.info('Audio Manager initialized');
      
      await this.autoConnectPlatforms();
      
    } catch (error) {
      logger.error('Failed to initialize components:', error);
    }
  }

  async autoConnectPlatforms() {
    const platforms = [
      {
        name: 'telegram',
        condition: process.env.TELEGRAM_BOT_TOKEN,
        config: { botToken: process.env.TELEGRAM_BOT_TOKEN },
        Integration: TelegramIntegration
      },
      {
        name: 'slack',
        condition: process.env.SLACK_BOT_TOKEN && process.env.SLACK_APP_TOKEN,
        config: { 
          botToken: process.env.SLACK_BOT_TOKEN,
          appToken: process.env.SLACK_APP_TOKEN
        },
        Integration: SlackIntegration
      },
      {
        name: 'discord',
        condition: process.env.DISCORD_BOT_TOKEN,
        config: { botToken: process.env.DISCORD_BOT_TOKEN },
        Integration: DiscordIntegration
      }
    ];
    
    for (const platform of platforms) {
      if (platform.condition) {
        try {
          await this.connectPlatform(platform.name, platform.config);
          logger.info(`Auto-connected to ${platform.name}`);
        } catch (error) {
          logger.error(`Failed to auto-connect to ${platform.name}:`, error);
        }
      }
    }
  }

  async connectPlatform(platformName, config) {
    let Integration;
    
    switch (platformName) {
      case 'telegram':
        Integration = TelegramIntegration;
        break;
      case 'slack':
        Integration = SlackIntegration;
        break;
      case 'discord':
        Integration = DiscordIntegration;
        break;
      default:
        throw new Error(`Unsupported platform: ${platformName}`);
    }
    
    const integration = new Integration(config);
    await integration.connect();
    this.messageManager.registerIntegration(platformName, integration);
    
    logger.info(`Connected to ${platformName}`);
  }

  async disconnectPlatform(platformName) {
    const integration = this.messageManager.integrations.get(platformName);
    if (integration) {
      await integration.disconnect();
      this.messageManager.integrations.delete(platformName);
      logger.info(`Disconnected from ${platformName}`);
    }
  }

  start(port = 3000) {
    this.server.listen(port, () => {
      logger.info(`UnifiMessenger server started on port ${port}`);
      console.log(`\n🚀 UnifiMessenger Server Running`);
      console.log(`📡 HTTP Server: http://localhost:${port}`);
      console.log(`🔌 WebSocket: ws://localhost:${port}`);
      console.log(`📊 Status: http://localhost:${port}/api/status`);
      console.log(`\n💡 Use the CLI: npx unifimessenger --help`);
      console.log(`🖥️  GUI: unifimessenger gui\n`);
    });
  }

  async stop() {
    logger.info('Stopping UnifiMessenger server...');
    
    for (const [platform, integration] of this.messageManager.integrations) {
      try {
        await integration.disconnect();
        logger.info(`Disconnected from ${platform}`);
      } catch (error) {
        logger.error(`Error disconnecting from ${platform}:`, error);
      }
    }
    
    this.wss.close();
    this.server.close();
    
    logger.info('UnifiMessenger server stopped');
  }
}

const server = new UnifiMessengerServer();

if (require.main === module) {
  const port = process.env.PORT || 3000;
  server.start(port);
}

process.on('SIGINT', async () => {
  console.log('\nReceived SIGINT, shutting down gracefully...');
  await server.stop();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\nReceived SIGTERM, shutting down gracefully...');
  await server.stop();
  process.exit(0);
});

module.exports = UnifiMessengerServer;