const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('futpadel', {
  quit: () => ipcRenderer.invoke('app:quit'),
  platform: process.platform,
  isElectron: true,
});
