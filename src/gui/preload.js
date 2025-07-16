const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  store: {
    get: (key, defaultValue) => ipcRenderer.invoke('store:get', key, defaultValue),
    set: (key, value) => ipcRenderer.invoke('store:set', key, value),
    delete: (key) => ipcRenderer.invoke('store:delete', key),
    clear: () => ipcRenderer.invoke('store:clear')
  },

  dialog: {
    showOpen: (options) => ipcRenderer.invoke('dialog:show-open', options),
    showSave: (options) => ipcRenderer.invoke('dialog:show-save', options),
    showMessage: (options) => ipcRenderer.invoke('dialog:show-message', options)
  },

  app: {
    getVersion: () => ipcRenderer.invoke('app:get-version'),
    getPath: (name) => ipcRenderer.invoke('app:get-path', name)
  },

  shell: {
    openExternal: (url) => ipcRenderer.invoke('shell:open-external', url)
  },

  platform: {
    connect: (platform, config) => ipcRenderer.invoke('platform:connect', platform, config),
    disconnect: (platform) => ipcRenderer.invoke('platform:disconnect', platform),
    getStatus: () => ipcRenderer.invoke('platform:status')
  },

  message: {
    send: (messageData) => ipcRenderer.invoke('message:send', messageData),
    list: (filters) => ipcRenderer.invoke('message:list', filters),
    onReceived: (callback) => ipcRenderer.on('message:received', callback),
    removeReceived: (callback) => ipcRenderer.removeListener('message:received', callback)
  },

  channel: {
    list: (platform) => ipcRenderer.invoke('channel:list', platform)
  },

  ai: {
    process: (message) => ipcRenderer.invoke('ai:process', message),
    onToggle: (callback) => ipcRenderer.on('ai:toggle', callback),
    onCrossChannel: (callback) => ipcRenderer.on('ai:cross-channel', callback),
    onSettings: (callback) => ipcRenderer.on('ai:settings', callback)
  },

  audio: {
    transcribe: (audioPath) => ipcRenderer.invoke('audio:transcribe', audioPath),
    synthesize: (text, options) => ipcRenderer.invoke('audio:synthesize', text, options),
    onRecording: (callback) => ipcRenderer.on('audio:recording', callback),
    onAutoTranscribe: (callback) => ipcRenderer.on('audio:auto-transcribe', callback),
    onSettings: (callback) => ipcRenderer.on('audio:settings', callback)
  },

  window: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    maximize: () => ipcRenderer.invoke('window:maximize'),
    close: () => ipcRenderer.invoke('window:close')
  },

  menu: {
    onNewMessage: (callback) => ipcRenderer.on('menu:new-message', callback),
    onSearch: (callback) => ipcRenderer.on('menu:search', callback),
    onSettings: (callback) => ipcRenderer.on('menu:settings', callback)
  },

  events: {
    on: (channel, callback) => ipcRenderer.on(channel, callback),
    off: (channel, callback) => ipcRenderer.removeListener(channel, callback),
    once: (channel, callback) => ipcRenderer.once(channel, callback)
  }
});