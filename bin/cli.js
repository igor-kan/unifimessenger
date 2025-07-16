#!/usr/bin/env node

const { Command } = require('commander');
const chalk = require('chalk');
const inquirer = require('inquirer');
const path = require('path');
const fs = require('fs');
const WebSocket = require('ws');
const axios = require('axios');
const moment = require('moment');

const program = new Command();
const config = require('../config/config');
const logger = require('../src/utils/logger');

program
  .name('unifimessenger')
  .description('Universal messenger CLI with AI capabilities')
  .version('1.0.0');

let wsClient = null;
let serverUrl = 'ws://localhost:3000';

function connectToServer() {
  return new Promise((resolve, reject) => {
    wsClient = new WebSocket(serverUrl);
    
    wsClient.on('open', () => {
      console.log(chalk.green('✓ Connected to UnifiMessenger server'));
      resolve();
    });
    
    wsClient.on('error', (error) => {
      console.log(chalk.red('✗ Failed to connect to server'));
      reject(error);
    });
    
    wsClient.on('message', (data) => {
      const message = JSON.parse(data);
      handleServerMessage(message);
    });
  });
}

function handleServerMessage(message) {
  switch (message.type) {
    case 'message':
      displayMessage(message.data);
      break;
    case 'status':
      displayStatus(message.data);
      break;
    case 'error':
      console.log(chalk.red('Error:'), message.data);
      break;
    default:
      console.log('Unknown message type:', message.type);
  }
}

function displayMessage(message) {
  const timestamp = moment(message.timestamp).format('HH:mm:ss');
  const platform = chalk.blue(`[${message.platform.toUpperCase()}]`);
  const channel = chalk.gray(`#${message.channelName}`);
  const author = chalk.yellow(message.author.username);
  const content = message.content;
  
  console.log(`${timestamp} ${platform} ${channel} ${author}: ${content}`);
}

function displayStatus(status) {
  const color = status.status === 'connected' ? 'green' : 'red';
  console.log(chalk[color](`${status.platform}: ${status.status}`));
}

async function sendCommand(command, data) {
  if (!wsClient || wsClient.readyState !== WebSocket.OPEN) {
    try {
      await connectToServer();
    } catch (error) {
      console.log(chalk.red('Failed to connect to server. Is the server running?'));
      process.exit(1);
    }
  }
  
  wsClient.send(JSON.stringify({
    type: 'command',
    command: command,
    data: data
  }));
}

program
  .command('start')
  .description('Start the UnifiMessenger server')
  .action(async () => {
    console.log(chalk.blue('Starting UnifiMessenger server...'));
    
    try {
      const { spawn } = require('child_process');
      const serverProcess = spawn('node', [path.join(__dirname, '../src/index.js')], {
        stdio: 'inherit'
      });
      
      serverProcess.on('close', (code) => {
        console.log(chalk.red(`Server exited with code ${code}`));
      });
      
      process.on('SIGINT', () => {
        serverProcess.kill('SIGINT');
        process.exit(0);
      });
      
    } catch (error) {
      console.log(chalk.red('Failed to start server:', error.message));
      process.exit(1);
    }
  });

program
  .command('send')
  .description('Send a message to a platform')
  .argument('<platform>', 'Platform (telegram, slack, discord, email)')
  .argument('<channel>', 'Channel ID or recipient')
  .argument('<message>', 'Message content')
  .option('-f, --file <file>', 'Send file attachment')
  .option('-r, --reply <messageId>', 'Reply to message')
  .option('-t, --thread <threadId>', 'Send in thread')
  .action(async (platform, channel, message, options) => {
    console.log(chalk.blue(`Sending message to ${platform}:${channel}`));
    
    const messageData = {
      platform,
      channelId: channel,
      content: message,
      options: {
        file: options.file,
        replyTo: options.reply,
        threadId: options.thread
      }
    };
    
    await sendCommand('send_message', messageData);
  });

program
  .command('list')
  .description('List messages or channels')
  .option('-p, --platform <platform>', 'Filter by platform')
  .option('-c, --channel <channel>', 'Filter by channel')
  .option('-l, --limit <limit>', 'Limit number of results', '50')
  .option('-s, --since <time>', 'Show messages since time')
  .option('--channels', 'List channels instead of messages')
  .action(async (options) => {
    if (options.channels) {
      console.log(chalk.blue('Listing channels...'));
      await sendCommand('list_channels', { platform: options.platform });
    } else {
      console.log(chalk.blue('Listing messages...'));
      await sendCommand('list_messages', {
        platform: options.platform,
        channelId: options.channel,
        limit: parseInt(options.limit),
        since: options.since
      });
    }
  });

program
  .command('ai')
  .description('AI agent commands')
  .option('-m, --mode <mode>', 'AI mode (chat, cross-channel, translate)', 'chat')
  .option('-c, --channel <channel>', 'Channel to enable AI')
  .option('-p, --platform <platform>', 'Platform for AI')
  .option('--prompt <prompt>', 'Custom AI prompt')
  .option('--disable', 'Disable AI for channel')
  .action(async (options) => {
    console.log(chalk.blue('AI agent configuration...'));
    
    const aiConfig = {
      mode: options.mode,
      channel: options.channel,
      platform: options.platform,
      prompt: options.prompt,
      disable: options.disable
    };
    
    await sendCommand('ai_config', aiConfig);
  });

program
  .command('status')
  .description('Show connection status')
  .action(async () => {
    console.log(chalk.blue('Checking status...'));
    await sendCommand('status', {});
  });

program
  .command('config')
  .description('Configure settings')
  .option('-s, --set <key=value>', 'Set configuration value')
  .option('-g, --get <key>', 'Get configuration value')
  .option('-l, --list', 'List all configuration')
  .action(async (options) => {
    if (options.set) {
      const [key, value] = options.set.split('=');
      console.log(chalk.blue(`Setting ${key} = ${value}`));
      await sendCommand('config_set', { key, value });
    } else if (options.get) {
      console.log(chalk.blue(`Getting ${options.get}`));
      await sendCommand('config_get', { key: options.get });
    } else if (options.list) {
      console.log(chalk.blue('Listing configuration...'));
      await sendCommand('config_list', {});
    }
  });

program
  .command('audio')
  .description('Audio processing commands')
  .option('-t, --transcribe <file>', 'Transcribe audio file')
  .option('-s, --synthesize <text>', 'Synthesize text to audio')
  .option('-v, --voice <voice>', 'Voice for synthesis', 'rachel')
  .option('-o, --output <file>', 'Output file path')
  .action(async (options) => {
    if (options.transcribe) {
      console.log(chalk.blue(`Transcribing audio: ${options.transcribe}`));
      await sendCommand('audio_transcribe', {
        file: options.transcribe,
        output: options.output
      });
    } else if (options.synthesize) {
      console.log(chalk.blue(`Synthesizing text: ${options.synthesize}`));
      await sendCommand('audio_synthesize', {
        text: options.synthesize,
        voice: options.voice,
        output: options.output
      });
    }
  });

program
  .command('interactive')
  .alias('i')
  .description('Start interactive mode')
  .action(async () => {
    console.log(chalk.blue('Starting interactive mode...'));
    
    try {
      await connectToServer();
      await startInteractiveMode();
    } catch (error) {
      console.log(chalk.red('Failed to start interactive mode:', error.message));
      process.exit(1);
    }
  });

async function startInteractiveMode() {
  console.log(chalk.green('UnifiMessenger Interactive Mode'));
  console.log(chalk.gray('Type "help" for commands, "exit" to quit'));
  
  while (true) {
    try {
      const { action } = await inquirer.prompt([
        {
          type: 'input',
          name: 'action',
          message: chalk.blue('unifimessenger>'),
          prefix: ''
        }
      ]);
      
      if (action === 'exit' || action === 'quit') {
        break;
      }
      
      if (action === 'help') {
        showInteractiveHelp();
        continue;
      }
      
      if (action === 'clear') {
        console.clear();
        continue;
      }
      
      if (action.startsWith('send ')) {
        await handleInteractiveSend(action);
        continue;
      }
      
      if (action.startsWith('list')) {
        await handleInteractiveList(action);
        continue;
      }
      
      if (action.startsWith('ai ')) {
        await handleInteractiveAI(action);
        continue;
      }
      
      if (action === 'status') {
        await sendCommand('status', {});
        continue;
      }
      
      console.log(chalk.red('Unknown command. Type "help" for available commands.'));
      
    } catch (error) {
      if (error.isTtyError) {
        console.log(chalk.red('Interactive mode not supported in this environment'));
        break;
      }
      console.log(chalk.red('Error:', error.message));
    }
  }
  
  console.log(chalk.blue('Goodbye!'));
  process.exit(0);
}

function showInteractiveHelp() {
  console.log(chalk.yellow('Available commands:'));
  console.log('  send <platform> <channel> <message>  - Send a message');
  console.log('  list [messages|channels]             - List messages or channels');
  console.log('  ai <mode> [options]                  - Configure AI agent');
  console.log('  status                               - Show connection status');
  console.log('  clear                                - Clear screen');
  console.log('  help                                 - Show this help');
  console.log('  exit                                 - Exit interactive mode');
}

async function handleInteractiveSend(action) {
  const parts = action.split(' ');
  if (parts.length < 4) {
    console.log(chalk.red('Usage: send <platform> <channel> <message>'));
    return;
  }
  
  const platform = parts[1];
  const channel = parts[2];
  const message = parts.slice(3).join(' ');
  
  await sendCommand('send_message', {
    platform,
    channelId: channel,
    content: message
  });
}

async function handleInteractiveList(action) {
  const parts = action.split(' ');
  const type = parts[1] || 'messages';
  
  if (type === 'channels') {
    await sendCommand('list_channels', {});
  } else {
    await sendCommand('list_messages', { limit: 20 });
  }
}

async function handleInteractiveAI(action) {
  const parts = action.split(' ');
  const mode = parts[1] || 'chat';
  
  await sendCommand('ai_config', { mode });
}

program
  .command('setup')
  .description('Setup wizard for configuration')
  .action(async () => {
    console.log(chalk.blue('UnifiMessenger Setup Wizard'));
    
    try {
      await runSetupWizard();
    } catch (error) {
      console.log(chalk.red('Setup failed:', error.message));
      process.exit(1);
    }
  });

async function runSetupWizard() {
  const questions = [
    {
      type: 'input',
      name: 'telegramToken',
      message: 'Telegram Bot Token (optional):',
      validate: (input) => {
        if (!input) return true;
        return input.length > 10 || 'Invalid token format';
      }
    },
    {
      type: 'input',
      name: 'slackBotToken',
      message: 'Slack Bot Token (optional):',
      validate: (input) => {
        if (!input) return true;
        return input.startsWith('xoxb-') || 'Should start with xoxb-';
      }
    },
    {
      type: 'input',
      name: 'slackAppToken',
      message: 'Slack App Token (optional):',
      validate: (input) => {
        if (!input) return true;
        return input.startsWith('xapp-') || 'Should start with xapp-';
      }
    },
    {
      type: 'input',
      name: 'discordToken',
      message: 'Discord Bot Token (optional):',
      validate: (input) => {
        if (!input) return true;
        return input.length > 50 || 'Invalid token format';
      }
    },
    {
      type: 'input',
      name: 'openaiKey',
      message: 'OpenAI API Key (optional):',
      validate: (input) => {
        if (!input) return true;
        return input.startsWith('sk-') || 'Should start with sk-';
      }
    },
    {
      type: 'input',
      name: 'elevenlabsKey',
      message: 'ElevenLabs API Key (optional):'
    },
    {
      type: 'input',
      name: 'emailUser',
      message: 'Email Address (optional):'
    },
    {
      type: 'password',
      name: 'emailPass',
      message: 'Email Password (optional):'
    }
  ];
  
  const answers = await inquirer.prompt(questions);
  
  const envContent = Object.entries(answers)
    .filter(([key, value]) => value)
    .map(([key, value]) => {
      const envKey = key.replace(/([A-Z])/g, '_$1').toUpperCase();
      return `${envKey}=${value}`;
    })
    .join('\n');
  
  const envPath = path.join(process.cwd(), '.env');
  fs.writeFileSync(envPath, envContent);
  
  console.log(chalk.green('✓ Configuration saved to .env'));
  console.log(chalk.blue('You can now run: unifimessenger start'));
}

program.parse();

process.on('SIGINT', () => {
  if (wsClient) {
    wsClient.close();
  }
  console.log(chalk.blue('\nGoodbye!'));
  process.exit(0);
});