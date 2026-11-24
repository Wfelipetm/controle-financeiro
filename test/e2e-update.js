// Teste de tela: estados da atualização automática na caixa de versão  (electron test/e2e-update.js)
const { app, BrowserWindow } = require('electron');
const fs = require('fs'); const os = require('os'); const path = require('path');
process.env.CF_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'cf-e2e-upd-'));
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'cf-ud-')));
require('../src/main.js');
const OUT = process.env.SHOTS || os.tmpdir();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const falhas = [];
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FALHA ') + m); if (!c) falhas.push(m); };
app.whenReady().then(async () => {
  try {
    let win; for (let i = 0; i < 50 && !win; i++) { await sleep(200); win = BrowserWindow.getAllWindows()[0]; }
    const js = (c) => win.webContents.executeJavaScript(c);
    const manda = async (u) => { win.webContents.send('update:status', { atual: '1.0.0', ...u }); await sleep(300); };
    const texto = () => js(`document.getElementById('sbUpdTx').textContent`);
    const classe = () => js(`document.getElementById('sbDot').className`);
    await js(`localStorage.setItem('cf_tour_visto','1')`);
    await sleep(1500);
    await js(`(()=>{const F=document.querySelector('#formLogin');F.elements.usuario.value='acai.gisele';F.elements.senha.value='senho123456';F.requestSubmit();})()`); await sleep(1500);
    ok((await texto()).includes('modo teste'), 'fora do app instalado mostra "modo teste"');
    await manda({ estado: 'atualizado' }); ok((await texto()).includes('Atualizado') && (await classe()).includes('ok'), 'atualizado: ponto verde');
    await manda({ estado: 'verificando' }); ok((await texto()).includes('Verificando'), 'verificando');
    await manda({ estado: 'baixando', versao: '1.0.1', pct: 40 }); ok((await texto()).includes('1.0.1') && (await texto()).includes('40%'), 'baixando mostra versão e porcentagem');
    await manda({ estado: 'erro' }); ok((await texto()).includes('não foi possível'), 'erro de verificação');
    await manda({ estado: 'pronta', versao: '1.0.1' });
    ok((await texto()).includes('pronta') && (await classe()).includes('pronta'), 'pronta: destaque roxo');
    ok(await js(`document.getElementById('toast').textContent.includes('1.0.1')`), 'aviso (toast) de nova versão');
    await js(`document.getElementById('sbUpd').click()`); await sleep(500);
    ok(await js(`!!document.querySelector('.modal') && document.querySelector('.modal').textContent.includes('Reiniciar e atualizar')`), 'clicar abre a confirmação para reiniciar');
    fs.writeFileSync(path.join(OUT, 'update-modal.png'), (await win.webContents.capturePage()).toPNG());
    await js(`[...document.querySelectorAll('.modal button')].find(b=>b.textContent.includes('Agora não')).click()`); await sleep(300);
    ok(await js(`!document.querySelector('.modal')`), '"Agora não" fecha sem instalar');
  } catch (e) { console.log('ERRO', e); falhas.push(String(e)); }
  console.log(falhas.length ? 'RESULTADO: FALHOU' : 'RESULTADO: TUDO OK');
  app.exit(falhas.length ? 1 : 0);
});
