// Teste de tela: alterar usuário e senha.  electron test/e2e-conta.js  (pastas temporárias)
const { app, BrowserWindow } = require('electron');
const fs = require('fs'); const os = require('os'); const path = require('path');
process.env.CF_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'cf-e2e-conta-'));
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
    const preencher = (atual, user, nova, nova2) => js(`(()=>{const v=(i,x)=>{document.getElementById(i).value=x};v('cAtual',${JSON.stringify(atual)});v('cUser',${JSON.stringify(user)});v('cNova',${JSON.stringify(nova)});v('cNova2',${JSON.stringify(nova2)});document.getElementById('formConta').requestSubmit();})()`);
    await sleep(1500);
    const sem = await js(`window.api.contaAlterar('a','b','c')`);
    ok(sem.ok === false && sem.auth === true, 'alterar bloqueado sem login');
    await entrar('acai.giselle', 'senho123456'); await sleep(900);
    ok((await js(`document.getElementById('sbUsuario').textContent`)) === 'acai.giselle', 'barra lateral mostra o usuário');
    ok((await js(`document.querySelector('.sb-name b').textContent`)) === 'Açaí Giselle', 'nome com dois L');
    await js(`document.querySelector('[data-action=conta]').click()`); await sleep(300);
    ok(await js(`!!document.getElementById('formConta')`), 'abre o formulário ao clicar no nome');
    await shot('conta-1-form');
    await preencher('errada', 'giselle', '', ''); await sleep(500);
    ok(/senha atual/.test(await js(`document.getElementById('cErro').textContent`)), 'senha atual errada mostra erro');
    await preencher('senho123456', 'giselle', 'abc123', 'diferente'); await sleep(300);
    ok(/não são iguais/.test(await js(`document.getElementById('cErro').textContent`)), 'senhas novas diferentes mostram erro');
    await shot('conta-2-erro');
    await preencher('senho123456', 'Açaí Giselle', 'novaSenha1', 'novaSenha1'); await sleep(300);
    ok(/espaços/.test(await js(`document.getElementById('cErro').textContent`)), 'usuário com espaço é recusado');
    await preencher('senho123456', 'acai.giselle2', 'novaSenha1', 'novaSenha1'); await sleep(900);
    ok(await js(`!document.getElementById('formConta')`), 'salva e fecha o formulário');
    ok((await js(`document.getElementById('sbUsuario').textContent`)) === 'acai.giselle2', 'barra lateral mostra o usuário novo');
    await js(`document.querySelector('[data-action=logout]').click()`); await sleep(500);
    await entrar('acai.giselle', 'senho123456'); await sleep(700);
    ok(!!(await js(`document.getElementById('lErro').textContent`)), 'acesso antigo não entra mais');
    await entrar('acai.giselle2', 'novaSenha1'); await sleep(900);
    ok(await js(`!document.getElementById('app').hidden`), 'acesso novo entra');
    await js(`window.__cf.handleAction({ dataset: { action: 'x' } })`).catch(() => {});
    await js(`document.querySelector('[data-view=gerenciar]').click()`); await sleep(300);
    ok(await js(`!!document.getElementById('cardAcesso')`), 'cartão "Acesso ao sistema" na tela de estabelecimentos');
    await shot('conta-3-cartao');
  } catch (e) { console.log('ERRO', e); falhas.push(String(e)); }
  console.log(falhas.length ? 'RESULTADO: FALHOU' : 'RESULTADO: TUDO OK');
  app.exit(falhas.length ? 1 : 0);
});
