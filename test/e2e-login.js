// Teste de tela do login: electron test/e2e-login.js  (usa pasta de dados temporária)
const { app, BrowserWindow } = require('electron');
const fs = require('fs'); const os = require('os'); const path = require('path');
process.env.CF_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'cf-e2e-login-'));
// pasta própria do Electron (localStorage, bloqueio de instância): não mistura com o app instalado
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'cf-ud-')));
require('../src/main.js');
const OUT = process.env.SHOTS || os.tmpdir();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const falhas = [];
const ok = (cond, msg) => { console.log((cond ? 'OK   ' : 'FALHA ') + msg); if (!cond) falhas.push(msg); };
app.whenReady().then(async () => {
  try {
    let win; for (let i = 0; i < 50 && !win; i++) { await sleep(200); win = BrowserWindow.getAllWindows()[0]; }
    const js = (c) => win.webContents.executeJavaScript(c);
    const shot = async (n) => { await sleep(300); fs.writeFileSync(path.join(OUT, n + '.png'), (await win.webContents.capturePage()).toPNG()); };
    const entrar = (u, s) => js(`(()=>{const F=document.querySelector('#formLogin');F.elements.usuario.value=${JSON.stringify(u)};F.elements.senha.value=${JSON.stringify(s)};F.requestSubmit();})()`);
    await sleep(1500);
    ok(await js(`!document.getElementById('login').hidden && document.getElementById('app').hidden`), 'abre na tela de login, app escondido');
    await shot('login-1-inicial');
    const bloq = await js(`window.api.getState()`);
    ok(bloq && bloq.auth === true && !bloq.data, 'getState bloqueado sem login');
    const bloq2 = await js(`window.api.op('addEstab', { nome: 'X' })`);
    ok(bloq2.ok === false && bloq2.auth === true, 'op bloqueada sem login');
    await entrar('acai.giselle', 'errada'); await sleep(600);
    ok((await js(`document.getElementById('lErro').textContent`)) === 'Usuário ou senha incorretos.', 'senha errada mostra erro');
    await shot('login-2-erro');
    await entrar('Açai.Giselle', 'senho123456'); await sleep(800);
    ok(await js(`document.getElementById('login').hidden && !document.getElementById('app').hidden`), 'login correto mostra o app');
    ok((await js(`document.querySelector('#nav').children.length`)) > 0, 'menu lateral renderizado');
    await shot('login-3-app');
    await js(`document.querySelector('[data-action=logout]').click()`); await sleep(500);
    ok(await js(`!document.getElementById('login').hidden && document.getElementById('app').hidden`), 'sair volta para o login');
    const depois = await js(`window.api.getState()`);
    ok(depois.auth === true, 'getState bloqueado de novo após sair');
  } catch (e) { console.log('ERRO', e); falhas.push(String(e)); }
  console.log(falhas.length ? 'RESULTADO: FALHOU' : 'RESULTADO: TUDO OK');
  app.exit(falhas.length ? 1 : 0);
});
