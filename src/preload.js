const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  authStatus: () => ipcRenderer.invoke('auth:status'),
  login: (usuario, senha, guardar) => ipcRenderer.invoke('auth:login', usuario, senha, !!guardar),
  updateStatus: () => ipcRenderer.invoke('update:status'),
  updateCheck: () => ipcRenderer.invoke('update:check'),
  updateInstall: () => ipcRenderer.invoke('update:install'),
  onUpdate: (cb) => ipcRenderer.on('update:status', (_e, u) => cb(u)),
  lembrado: () => ipcRenderer.invoke('auth:lembrado'),
  logout: () => ipcRenderer.invoke('auth:logout'),
  getState: () => ipcRenderer.invoke('state:get'),
  op: (name, payload) => ipcRenderer.invoke('op', name, payload),
  exportExcel: (periodo) => ipcRenderer.invoke('export:excel', periodo),
  exportPdf: (periodo) => ipcRenderer.invoke('export:pdf', periodo),
  backupSave: () => ipcRenderer.invoke('backup:save'),
  backupRestore: () => ipcRenderer.invoke('backup:restore'),
  importXlsx: () => ipcRenderer.invoke('import:xlsx'),
  showInFolder: (p) => ipcRenderer.invoke('shell:showInFolder', p),
  openDataFolder: () => ipcRenderer.invoke('shell:openDataFolder'),
});
