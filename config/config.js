const path = require('path');

const config = {
  server: {
    port: process.env.PORT || 3000,
    host: process.env.HOST || 'localhost',
    cors: {
      origin: process.env.CORS_ORIGIN || '*',
      credentials: true
    }
  },

  platforms: {
    telegram: {
      enabled: !!process.env.TELEGRAM_BOT_TOKEN,
      botToken: process.env.TELEGRAM_BOT_TOKEN,
      polling: true,
      webhook: {
        enabled: false,
        url: process.env.TELEGRAM_WEBHOOK_URL,
        port: process.env.TELEGRAM_WEBHOOK_PORT || 8443
      }
    },

    slack: {
      enabled: !!(process.env.SLACK_BOT_TOKEN && process.env.SLACK_APP_TOKEN),
      botToken: process.env.SLACK_BOT_TOKEN,
      appToken: process.env.SLACK_APP_TOKEN,
      signingSecret: process.env.SLACK_SIGNING_SECRET
    },

    discord: {
      enabled: !!process.env.DISCORD_BOT_TOKEN,
      botToken: process.env.DISCORD_BOT_TOKEN,
      clientId: process.env.DISCORD_CLIENT_ID,
      guildId: process.env.DISCORD_GUILD_ID
    },

    email: {
      enabled: !!(process.env.EMAIL_USER && process.env.EMAIL_PASSWORD),
      user: process.env.EMAIL_USER,
      password: process.env.EMAIL_PASSWORD,
      imap: {
        host: process.env.IMAP_HOST || 'imap.gmail.com',
        port: process.env.IMAP_PORT || 993,
        secure: process.env.IMAP_SECURE !== 'false'
      },
      smtp: {
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: process.env.SMTP_PORT || 587,
        secure: process.env.SMTP_SECURE === 'true'
      }
    }
  },

  ai: {
    enabled: !!process.env.OPENAI_API_KEY,
    provider: process.env.AI_PROVIDER || 'openai',
    openai: {
      apiKey: process.env.OPENAI_API_KEY,
      model: process.env.OPENAI_MODEL || 'gpt-4',
      maxTokens: parseInt(process.env.OPENAI_MAX_TOKENS) || 1000,
      temperature: parseFloat(process.env.OPENAI_TEMPERATURE) || 0.7
    },
    crossChannelMode: process.env.AI_CROSS_CHANNEL === 'true',
    autoRespond: process.env.AI_AUTO_RESPOND === 'true',
    systemPrompt: process.env.AI_SYSTEM_PROMPT
  },

  audio: {
    enabled: true,
    whisper: {
      model: process.env.WHISPER_MODEL || 'base',
      language: process.env.WHISPER_LANGUAGE || 'auto'
    },
    synthesis: {
      enabled: !!process.env.ELEVENLABS_API_KEY,
      provider: process.env.TTS_PROVIDER || 'elevenlabs',
      elevenlabs: {
        apiKey: process.env.ELEVENLABS_API_KEY,
        voice: process.env.ELEVENLABS_VOICE || 'rachel'
      }
    },
    tempDir: process.env.AUDIO_TEMP_DIR || './temp/audio',
    maxFileSize: parseInt(process.env.AUDIO_MAX_FILE_SIZE) || 50 * 1024 * 1024, // 50MB
    supportedFormats: ['wav', 'mp3', 'ogg', 'flac', 'm4a', 'webm']
  },

  database: {
    type: process.env.DB_TYPE || 'sqlite',
    sqlite: {
      path: process.env.DB_PATH || './data/unifimessenger.db'
    },
    postgres: {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME || 'unifimessenger',
      username: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD
    }
  },

  security: {
    jwt: {
      secret: process.env.JWT_SECRET || 'unifimessenger-secret-key',
      expiresIn: process.env.JWT_EXPIRES_IN || '7d'
    },
    encryption: {
      enabled: process.env.ENCRYPTION_ENABLED === 'true',
      algorithm: process.env.ENCRYPTION_ALGORITHM || 'aes-256-gcm',
      key: process.env.ENCRYPTION_KEY
    },
    rateLimit: {
      enabled: process.env.RATE_LIMIT_ENABLED !== 'false',
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW) || 15 * 60 * 1000, // 15 minutes
      max: parseInt(process.env.RATE_LIMIT_MAX) || 100 // 100 requests per window
    }
  },

  logging: {
    level: process.env.LOG_LEVEL || 'info',
    dir: process.env.LOG_DIR || './logs',
    maxFileSize: process.env.LOG_MAX_SIZE || '5m',
    maxFiles: parseInt(process.env.LOG_MAX_FILES) || 5,
    console: process.env.NODE_ENV !== 'production'
  },

  storage: {
    provider: process.env.STORAGE_PROVIDER || 'local',
    local: {
      path: process.env.STORAGE_PATH || './data/files'
    },
    s3: {
      bucket: process.env.AWS_S3_BUCKET,
      region: process.env.AWS_REGION || 'us-east-1',
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
  },

  features: {
    crossChannelMessaging: process.env.FEATURE_CROSS_CHANNEL === 'true',
    voiceMessages: process.env.FEATURE_VOICE !== 'false',
    fileSharing: process.env.FEATURE_FILES !== 'false',
    messageSync: process.env.FEATURE_SYNC !== 'false',
    notifications: process.env.FEATURE_NOTIFICATIONS !== 'false',
    searchHistory: process.env.FEATURE_SEARCH !== 'false'
  },

  gui: {
    enabled: process.env.GUI_ENABLED !== 'false',
    port: process.env.GUI_PORT || 3001,
    theme: process.env.GUI_THEME || 'auto',
    autoLaunch: process.env.GUI_AUTO_LAUNCH === 'true'
  },

  cli: {
    enabled: process.env.CLI_ENABLED !== 'false',
    interactive: process.env.CLI_INTERACTIVE !== 'false',
    colors: process.env.CLI_COLORS !== 'false'
  },

  tempDir: process.env.TEMP_DIR || './temp',
  dataDir: process.env.DATA_DIR || './data',
  configDir: process.env.CONFIG_DIR || './config'
};

const requiredEnvVars = [
  // No required env vars by default - all features are optional
];

const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingEnvVars.length > 0) {
  console.error('Missing required environment variables:');
  missingEnvVars.forEach(varName => {
    console.error(`- ${varName}`);
  });
  process.exit(1);
}

function validateConfig() {
  const errors = [];

  if (config.ai.enabled && !config.ai.openai.apiKey) {
    errors.push('OpenAI API key is required when AI is enabled');
  }

  if (config.audio.synthesis.enabled && !config.audio.synthesis.elevenlabs.apiKey) {
    errors.push('ElevenLabs API key is required when audio synthesis is enabled');
  }

  if (config.platforms.telegram.enabled && !config.platforms.telegram.botToken) {
    errors.push('Telegram bot token is required when Telegram is enabled');
  }

  if (config.platforms.slack.enabled && (!config.platforms.slack.botToken || !config.platforms.slack.appToken)) {
    errors.push('Slack bot token and app token are required when Slack is enabled');
  }

  if (config.platforms.discord.enabled && !config.platforms.discord.botToken) {
    errors.push('Discord bot token is required when Discord is enabled');
  }

  if (errors.length > 0) {
    console.warn('Configuration warnings:');
    errors.forEach(error => {
      console.warn(`- ${error}`);
    });
  }

  return errors.length === 0;
}

function getEnabledPlatforms() {
  return Object.entries(config.platforms)
    .filter(([name, platform]) => platform.enabled)
    .map(([name]) => name);
}

function getEnabledFeatures() {
  return Object.entries(config.features)
    .filter(([name, enabled]) => enabled)
    .map(([name]) => name);
}

module.exports = {
  ...config,
  validateConfig,
  getEnabledPlatforms,
  getEnabledFeatures
};