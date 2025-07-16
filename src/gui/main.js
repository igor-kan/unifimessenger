const { app, BrowserWindow, Menu, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const isDev = process.env.NODE_ENV === 'development';
const Store = require('electron-store');

const store = new Store();

let mainWindow;
let messageManager;

function createWindow() {
  const windowState = store.get('windowState', {
    width: 1200,
    height: 800,
    x: undefined,
    y: undefined
  });

  mainWindow = new BrowserWindow({
    width: windowState.width,
    height: windowState.height,
    x: windowState.x,
    y: windowState.y,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, 'assets', 'icon.png'),
    show: false,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default'
  });

  const htmlPath = isDev 
    ? 'http://localhost:3001' 
    : `file://${path.join(__dirname, 'renderer', 'index.html')}`;

  mainWindow.loadURL(htmlPath);

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    
    if (isDev) {
      mainWindow.webContents.openDevTools();
    }
  });

  mainWindow.on('close', () => {
    const bounds = mainWindow.getBounds();
    store.set('windowState', bounds);
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  setupMenu();
  setupIPC();
}

function setupMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'New Message',
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            mainWindow.webContents.send('menu:new-message');
          }
        },
        {
          label: 'Search',
          accelerator: 'CmdOrCtrl+F',
          click: () => {
            mainWindow.webContents.send('menu:search');
          }
        },
        { type: 'separator' },
        {
          label: 'Settings',
          accelerator: 'CmdOrCtrl+,',
          click: () => {
            mainWindow.webContents.send('menu:settings');
          }
        },
        { type: 'separator' },
        {
          label: 'Quit',
          accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
          click: () => {
            app.quit();
          }
        }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectall' }
      ]
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Reload',
          accelerator: 'CmdOrCtrl+R',
          click: () => {
            mainWindow.webContents.reload();
          }
        },
        {
          label: 'Force Reload',
          accelerator: 'CmdOrCtrl+Shift+R',
          click: () => {
            mainWindow.webContents.reloadIgnoringCache();
          }
        },
        {
          label: 'Toggle Developer Tools',
          accelerator: 'F12',
          click: () => {
            mainWindow.webContents.toggleDevTools();
          }
        },
        { type: 'separator' },
        { role: 'resetzoom' },
        { role: 'zoomin' },
        { role: 'zoomout' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Platforms',
      submenu: [
        {
          label: 'Connect Telegram',
          click: () => {
            mainWindow.webContents.send('platform:connect', 'telegram');
          }
        },
        {
          label: 'Connect Slack',
          click: () => {
            mainWindow.webContents.send('platform:connect', 'slack');
          }
        },
        {
          label: 'Connect Discord',
          click: () => {
            mainWindow.webContents.send('platform:connect', 'discord');
          }
        },
        { type: 'separator' },
        {
          label: 'Platform Status',
          click: () => {
            mainWindow.webContents.send('platform:status');
          }
        }
      ]
    },
    {
      label: 'AI',
      submenu: [
        {
          label: 'Enable AI Assistant',
          type: 'checkbox',
          checked: store.get('ai.enabled', false),
          click: (menuItem) => {
            store.set('ai.enabled', menuItem.checked);
            mainWindow.webContents.send('ai:toggle', menuItem.checked);
          }
        },
        {
          label: 'Cross-Channel Mode',
          type: 'checkbox',
          checked: store.get('ai.crossChannel', false),
          click: (menuItem) => {
            store.set('ai.crossChannel', menuItem.checked);
            mainWindow.webContents.send('ai:cross-channel', menuItem.checked);
          }
        },
        { type: 'separator' },
        {
          label: 'AI Settings',
          click: () => {
            mainWindow.webContents.send('ai:settings');
          }
        }
      ]
    },
    {
      label: 'Audio',
      submenu: [
        {
          label: 'Voice Recording',
          type: 'checkbox',
          checked: store.get('audio.recording', true),
          click: (menuItem) => {
            store.set('audio.recording', menuItem.checked);
            mainWindow.webContents.send('audio:recording', menuItem.checked);
          }
        },
        {
          label: 'Auto Transcribe',
          type: 'checkbox',
          checked: store.get('audio.autoTranscribe', true),
          click: (menuItem) => {
            store.set('audio.autoTranscribe', menuItem.checked);
            mainWindow.webContents.send('audio:auto-transcribe', menuItem.checked);
          }
        },
        { type: 'separator' },
        {
          label: 'Audio Settings',
          click: () => {
            mainWindow.webContents.send('audio:settings');
          }
        }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'close' }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'About UnifiMessenger',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'About UnifiMessenger',
              message: 'UnifiMessenger v1.0.0',
              detail: 'Universal multi-platform messenger with AI capabilities\n\nBuilt with Electron and Node.js'
            });
          }
        },
        {
          label: 'Documentation',
          click: () => {
            shell.openExternal('https://github.com/unifimessenger/unifimessenger#readme');
          }
        },
        {
          label: 'Report Issue',
          click: () => {
            shell.openExternal('https://github.com/unifimessenger/unifimessenger/issues');
          }
        }
      ]
    }
  ];

  if (process.platform === 'darwin') {
    template.unshift({
      label: app.getName(),
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services', submenu: [] },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideothers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    });

    template[4].submenu.push(
      { type: 'separator' },
      {
        label: 'Bring All to Front',
        role: 'front'
      }
    );
  }

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

function setupIPC() {
  ipcMain.handle('store:get', (event, key, defaultValue) => {
    return store.get(key, defaultValue);
  });

  ipcMain.handle('store:set', (event, key, value) => {
    store.set(key, value);
  });

  ipcMain.handle('store:delete', (event, key) => {
    store.delete(key);
  });

  ipcMain.handle('store:clear', () => {
    store.clear();
  });

  ipcMain.handle('dialog:show-open', async (event, options) => {
    const result = await dialog.showOpenDialog(mainWindow, options);
    return result;
  });

  ipcMain.handle('dialog:show-save', async (event, options) => {
    const result = await dialog.showSaveDialog(mainWindow, options);
    return result;
  });

  ipcMain.handle('dialog:show-message', async (event, options) => {
    const result = await dialog.showMessageBox(mainWindow, options);
    return result;
  });

  ipcMain.handle('app:get-version', () => {
    return app.getVersion();
  });

  ipcMain.handle('app:get-path', (event, name) => {
    return app.getPath(name);
  });

  ipcMain.handle('shell:open-external', (event, url) => {
    shell.openExternal(url);
  });

  ipcMain.handle('platform:connect', async (event, platform, config) => {
    try {
      if (!messageManager) {
        const MessageManager = require('../core/MessageManager');
        messageManager = new MessageManager();
      }
      
      const result = await connectPlatform(platform, config);
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('platform:disconnect', async (event, platform) => {
    try {
      const result = await disconnectPlatform(platform);
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('platform:status', async () => {
    try {
      const status = await getPlatformStatus();
      return { success: true, data: status };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('message:send', async (event, messageData) => {
    try {
      if (!messageManager) {
        throw new Error('Message manager not initialized');
      }
      
      const result = await messageManager.sendMessage(
        messageData.platform,
        messageData.channelId,
        messageData.content,
        messageData.options || {}
      );
      
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('message:list', async (event, filters) => {
    try {
      if (!messageManager) {
        throw new Error('Message manager not initialized');
      }
      
      const messages = messageManager.getMessages(filters);
      return { success: true, data: messages };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('channel:list', async (event, platform) => {
    try {
      if (!messageManager) {
        throw new Error('Message manager not initialized');
      }
      
      const channels = messageManager.getChannels();
      const filteredChannels = platform 
        ? channels.filter(ch => ch.platform === platform)
        : channels;
      
      return { success: true, data: filteredChannels };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('ai:process', async (event, message) => {
    try {
      if (!messageManager) {
        throw new Error('Message manager not initialized');
      }
      
      const result = await messageManager.processWithAI(message);
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('audio:transcribe', async (event, audioPath) => {
    try {
      const AudioManager = require('../audio/AudioManager');
      const audioManager = new AudioManager({
        tempDir: app.getPath('temp')
      });
      
      const result = await audioManager.transcribeAudio(audioPath);
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('audio:synthesize', async (event, text, options) => {
    try {
      const AudioManager = require('../audio/AudioManager');
      const audioManager = new AudioManager({
        tempDir: app.getPath('temp'),
        elevenlabsApiKey: store.get('api.elevenlabs')
      });
      
      const result = await audioManager.synthesizeText(text, options);
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('window:minimize', () => {
    mainWindow.minimize();
  });

  ipcMain.handle('window:maximize', () => {
    if (mainWindow.isMaximized()) {
      mainWindow.restore();
    } else {
      mainWindow.maximize();
    }
  });

  ipcMain.handle('window:close', () => {
    mainWindow.close();
  });
}

async function connectPlatform(platform, config) {
  if (!messageManager) {
    const MessageManager = require('../core/MessageManager');
    messageManager = new MessageManager();
  }

  let Integration;
  switch (platform) {
    case 'telegram':
      Integration = require('../integrations/TelegramIntegration');
      break;
    case 'slack':
      Integration = require('../integrations/SlackIntegration');
      break;
    case 'discord':
      Integration = require('../integrations/DiscordIntegration');
      break;
    default:
      throw new Error(`Unsupported platform: ${platform}`);
  }

  const integration = new Integration(config);
  await integration.connect();
  messageManager.registerIntegration(platform, integration);

  integration.on('message', (message) => {
    mainWindow.webContents.send('message:received', message);
  });

  integration.on('status', (status) => {
    mainWindow.webContents.send('platform:status-update', { platform, status });
  });

  return { platform, status: 'connected' };
}

async function disconnectPlatform(platform) {
  if (!messageManager) {
    throw new Error('Message manager not initialized');
  }

  const integration = messageManager.integrations.get(platform);
  if (integration) {
    await integration.disconnect();
    messageManager.integrations.delete(platform);
  }

  return { platform, status: 'disconnected' };
}

async function getPlatformStatus() {
  if (!messageManager) {
    return {};
  }

  const status = {};
  for (const [platform, integration] of messageManager.integrations) {
    status[platform] = {
      connected: integration.isConnected(),
      health: await integration.healthCheck()
    };
  }

  return status;
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  if (messageManager) {
    messageManager.integrations.forEach(async (integration) => {
      await integration.disconnect();
    });
  }
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  if (mainWindow) {
    mainWindow.webContents.send('error', error.message);
  }
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
  if (mainWindow) {
    mainWindow.webContents.send('error', reason);
  }
});