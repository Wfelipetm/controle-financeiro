const { app, BrowserWindow, ipcMain, dialog, shell, Menu, safeStorage } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const ExcelJS = require('exceljs');
const Core = require('./renderer/core.js');
const { Store } = require('./store.js');
const { parseWorkbook, mergeInto } = require('./importer.js');
const { exportarExcel, relatorioHTML } = require('./exporter.js');
const { Auth } = require('./auth.js');
const { Lembrar } = require('./lembrar.js');
let autoUpdater = null;
try { ({ autoUpdater } = require('electron-updater')); } catch (_) { /* sem atualizador */ }

const dataDir = process.env.CF_DATA_DIR || app.getPath('userData');
const store = new Store(dataDir);
let win = null;
const auth = new Auth();
const lembrar = new Lembrar(dataDir, safeStorage);

// ---------- operações sobre os dados ----------
const OPS = {
  addEstab: (d, p) => Core.addEstab(d, p.nome),
  addEstabs: (d, p) => {
    let criados = 0;
    for (const nome of p.nomes || []) {
      if (!d.estabelecimentos.some((e) => Core.norm(e.nome) === Core.norm(nome))) { Core.addEstab(d, nome); criados++; }
    }
    return { criados };
  },
  renameEstab: (d, p) => Core.renameEstab(d, p.id, p.nome),
  removeEstab: (d, p) => Core.removeEstab(d, p.id),
  addLanc: (d, p) => Core.addLanc(d, p),
  updateLanc: (d, p) => Core.updateLanc(d, p.id, p),
  deleteLanc: (d, p) => Core.deleteLanc(d, p.id),
};

function createWindow() {
  win = new BrowserWindow({
    width: 1240, height: 820, minWidth: 980, minHeight: 640,
    title: 'Controle Financeiro',
    icon: path.join(__dirname, 'renderer', 'img', 'icon.png'),
    backgroundColor: '#2E1065',
    // barra de título própria (roxa); o Windows continua desenhando minimizar/maximizar/fechar
    titleBarStyle: 'hidden',
    titleBarOverlay: { color: '#2E1065', symbolColor: '#FFFFFF', height: 36 },
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  win.once('ready-to-show', () => win.show());
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (e) => e.preventDefault());
  win.on('closed', () => { win = null; auth.logout(); });
}

function pushAndSave(fn) {
  try {
    const result = fn(store.data);
    store.save();
    return { ok: true, data: store.data, result };
  } catch (err) {
    store.reload(); // volta ao que está gravado no disco
    const msg = err && err.code ? 'Não foi possível salvar os dados no computador. Verifique se o disco não está cheio.' : err.message;
    return { ok: false, error: msg };
  }
}

// ---------- atualização automática ----------
// estado: dev | atualizado | verificando | baixando | pronta | erro
const upd = { estado: app.isPackaged ? 'atualizado' : 'dev', versao: null, pct: 0 };
function enviarUpdate(patch) {
  Object.assign(upd, patch);
  if (win && !win.isDestroyed()) win.webContents.send('update:status', { ...upd, atual: app.getVersion() });
}
function verificarAtualizacao() {
  if (!autoUpdater || !app.isPackaged) return Promise.resolve();
  if (upd.estado === 'baixando' || upd.estado === 'pronta') return Promise.resolve();
  return autoUpdater.checkForUpdates().catch(() => enviarUpdate({ estado: 'erro' }));
}
function iniciarAtualizador() {
  if (!autoUpdater || !app.isPackaged) return;
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;   // se ela só fechar o app, instala ao sair
  autoUpdater.on('checking-for-update', () => enviarUpdate({ estado: 'verificando' }));
  autoUpdater.on('update-available', (i) => enviarUpdate({ estado: 'baixando', versao: i.version, pct: 0 }));
  autoUpdater.on('update-not-available', () => enviarUpdate({ estado: 'atualizado', versao: null }));
  autoUpdater.on('download-progress', (p) => enviarUpdate({ estado: 'baixando', pct: Math.round(p.percent || 0) }));
  autoUpdater.on('update-downloaded', (i) => enviarUpdate({ estado: 'pronta', versao: i.version }));
  autoUpdater.on('error', () => enviarUpdate({ estado: 'erro' }));
  setTimeout(verificarAtualizacao, 8000);
  setInterval(verificarAtualizacao, 4 * 60 * 60 * 1000);
}

function registrarIPC() {
  // login/logout são públicos; todo o resto só responde com o usuário logado
  ipcMain.handle('auth:status', () => ({ logado: auth.logado }));
  ipcMain.handle('auth:login', (_e, usuario, senha, guardar) => {
    const r = auth.login(usuario, senha);
    if (r.ok) { if (guardar) lembrar.salvar(usuario, senha); else lembrar.apagar(); }
    return r;
  });
  ipcMain.handle('auth:lembrado', () => lembrar.carregar());
  ipcMain.handle('auth:logout', () => { auth.logout(); return { ok: true }; });
  const protegido = (fn) => (e, ...args) => (auth.logado ? fn(e, ...args) : { ok: false, auth: true, error: 'Faça login para continuar.' });
  const handle = (canal, fn) => ipcMain.handle(canal, protegido(fn));

  handle('state:get', () => ({ data: store.data, recovered: store.recovered, dataDir, version: app.getVersion() }));

  handle('op', (_e, name, payload) => {
    const fn = OPS[name];
    if (!fn) return { ok: false, error: 'Operação desconhecida.' };
    return pushAndSave((d) => fn(d, payload || {}));
  });

  handle('export:excel', async (_e, { mes, ano }) => {
    const label = Core.periodoLabel(mes, ano).replace(/ /g, '-');
    const r = await dialog.showSaveDialog(win, {
      title: 'Salvar planilha Excel',
      defaultPath: path.join(app.getPath('documents'), `Controle Financeiro - ${label}.xlsx`),
      filters: [{ name: 'Planilha Excel', extensions: ['xlsx'] }],
    });
    if (r.canceled || !r.filePath) return { ok: false, canceled: true };
    try { await exportarExcel(store.data, mes, ano, r.filePath); return { ok: true, path: r.filePath }; }
    catch (err) { return { ok: false, error: 'Não foi possível salvar o arquivo. Ele pode estar aberto no Excel; feche-o e tente de novo.' }; }
  });

  handle('export:pdf', async (_e, { mes, ano }) => {
    const label = Core.periodoLabel(mes, ano).replace(/ /g, '-');
    const r = await dialog.showSaveDialog(win, {
      title: 'Salvar relatório em PDF',
      defaultPath: path.join(app.getPath('documents'), `Controle Financeiro - ${label}.pdf`),
      filters: [{ name: 'PDF', extensions: ['pdf'] }],
    });
    if (r.canceled || !r.filePath) return { ok: false, canceled: true };
    const tmp = path.join(os.tmpdir(), `cf-relatorio-${Date.now()}.html`);
    let hidden = null;
    try {
      fs.writeFileSync(tmp, relatorioHTML(store.data, mes, ano), 'utf8');
      hidden = new BrowserWindow({ show: false, webPreferences: { sandbox: true, contextIsolation: true } });
      await hidden.loadFile(tmp);
      const pdf = await hidden.webContents.printToPDF({ pageSize: 'A4', printBackground: true });
      fs.writeFileSync(r.filePath, pdf);
      return { ok: true, path: r.filePath };
    } catch (err) {
      return { ok: false, error: 'Não foi possível gerar o PDF. Se o arquivo estiver aberto, feche-o e tente de novo.' };
    } finally {
      if (hidden) hidden.destroy();
      try { fs.unlinkSync(tmp); } catch (_) { /* ignora */ }
    }
  });

  handle('backup:save', async () => {
    const r = await dialog.showSaveDialog(win, {
      title: 'Salvar cópia de segurança',
      defaultPath: path.join(app.getPath('documents'), `Copia de seguranca - ${Core.todayISO()}.json`),
      filters: [{ name: 'Cópia de segurança', extensions: ['json'] }],
    });
    if (r.canceled || !r.filePath) return { ok: false, canceled: true };
    try { store.save(); fs.copyFileSync(store.file, r.filePath); return { ok: true, path: r.filePath }; }
    catch (err) { return { ok: false, error: 'Não foi possível salvar a cópia nesse local.' }; }
  });

  handle('backup:restore', async () => {
    const r = await dialog.showOpenDialog(win, {
      title: 'Escolher cópia de segurança',
      defaultPath: app.getPath('documents'),
      filters: [{ name: 'Cópia de segurança', extensions: ['json'] }],
      properties: ['openFile'],
    });
    if (r.canceled || !r.filePaths.length) return { ok: false, canceled: true };
    let obj;
    try { obj = JSON.parse(fs.readFileSync(r.filePaths[0], 'utf8')); } catch (_) { obj = null; }
    if (!Core.validateData(obj)) return { ok: false, error: 'Esse arquivo não é uma cópia de segurança válida deste programa.' };
    const conf = await dialog.showMessageBox(win, {
      type: 'warning', buttons: ['Restaurar', 'Cancelar'], defaultId: 1, cancelId: 1,
      title: 'Restaurar cópia',
      message: 'Restaurar esta cópia?',
      detail: `Ela tem ${obj.estabelecimentos.length} estabelecimento(s) e ${obj.lancamentos.length} lançamento(s). Os dados atuais serão substituídos (uma cópia deles é guardada antes, por segurança).`,
    });
    if (conf.response !== 0) return { ok: false, canceled: true };
    try { store.snapshot('restaurar'); store.replace(obj); return { ok: true, data: store.data }; }
    catch (err) { store.reload(); return { ok: false, error: 'Não foi possível restaurar a cópia.' }; }
  });

  handle('import:xlsx', async () => {
    const r = await dialog.showOpenDialog(win, {
      title: 'Escolher a planilha para importar',
      defaultPath: app.getPath('documents'),
      filters: [{ name: 'Planilha Excel', extensions: ['xlsx'] }],
      properties: ['openFile'],
    });
    if (r.canceled || !r.filePaths.length) return { ok: false, canceled: true };
    let parsed;
    try {
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.readFile(r.filePaths[0]);
      parsed = parseWorkbook(wb);
    } catch (err) {
      return { ok: false, error: 'Não consegui abrir essa planilha. Confira se é um arquivo .xlsx e se não está aberto em outro programa.' };
    }
    if (!parsed.grupos.length) return { ok: false, error: 'Não encontrei abas de lançamentos nessa planilha (precisa ter as colunas Data, Entrada e Saída).' };
    const res = pushAndSave((d) => mergeInto(d, parsed));
    return res.ok ? { ok: true, data: res.data, resumo: res.result } : res;
  });

  handle('update:status', () => ({ ok: true, ...upd, atual: app.getVersion() }));
  handle('update:check', async () => { await verificarAtualizacao(); return { ok: true, ...upd, atual: app.getVersion() }; });
  handle('update:install', () => {
    if (upd.estado !== 'pronta' || !autoUpdater) return { ok: false, error: 'Nenhuma atualização pronta para instalar.' };
    setImmediate(() => autoUpdater.quitAndInstall(true, true)); // silencioso e reabre o app
    return { ok: true };
  });

  handle('shell:showInFolder', (_e, p) => { if (typeof p === 'string') shell.showItemInFolder(p); });
  handle('shell:openDataFolder', () => shell.openPath(dataDir));
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
  app.whenReady().then(() => {
    Menu.setApplicationMenu(null);
    store.load();
    try { store.dailyBackup(); } catch (_) { /* cópia automática é um extra */ }
    registrarIPC();
    createWindow();
    iniciarAtualizador();
    app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
  });
  app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
}
