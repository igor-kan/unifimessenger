# UnifiMessenger

A comprehensive all-in-one messenger application that unifies multiple chat platforms with AI capabilities, CLI interface, and modern GUI.

## Features

- **Multi-Platform Support**: Telegram, Slack, Discord, WhatsApp, Facebook Messenger, Instagram, Email
- **AI Agents**: Cross-channel communication with intelligent responses
- **Audio Support**: Voice message transcription and synthesis
- **CLI Interface**: Command-line tools for power users
- **GUI Application**: Modern Electron-based desktop app
- **Unified Inbox**: All messages in one place
- **Real-time Sync**: Cross-device synchronization
- **Security**: End-to-end encryption where supported

## Quick Start

### Installation

```bash
npm install -g unifimessenger
```

### Configuration

Create a `.env` file with your API keys:

```bash
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
SLACK_BOT_TOKEN=your_slack_bot_token
DISCORD_BOT_TOKEN=your_discord_bot_token
OPENAI_API_KEY=your_openai_api_key
ELEVENLABS_API_KEY=your_elevenlabs_api_key
EMAIL_USER=your_email
EMAIL_PASSWORD=your_email_password
```

### Usage

#### CLI Mode
```bash
# Start the CLI interface
unifimessenger cli

# Send a message
unifimessenger send telegram "Hello World"

# List messages
unifimessenger list --platform telegram

# Start AI agent
unifimessenger ai --mode cross-channel
```

#### GUI Mode
```bash
# Start the GUI application
unifimessenger gui
```

#### Server Mode
```bash
# Start the backend server
unifimessenger start
```

## Architecture

- **Backend**: Node.js/Express server with WebSocket support
- **Frontend**: React-based GUI with Electron wrapper
- **CLI**: Commander.js-based command-line interface
- **AI**: OpenAI GPT integration with custom agents
- **Audio**: Whisper for transcription, ElevenLabs for synthesis
- **Database**: SQLite with Sequelize ORM

## Supported Platforms

- ✅ Telegram
- ✅ Slack
- ✅ Discord
- ⚠️ WhatsApp (via web scraping)
- ⚠️ Facebook Messenger (limited)
- ⚠️ Instagram (limited)
- ✅ Email (IMAP/SMTP)

## Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Run tests
npm test

# Build for production
npm run build
```

## License

MIT License - see LICENSE file for details