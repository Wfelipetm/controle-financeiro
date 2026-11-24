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
    const classe = () => js(`document.getElementById('sbIc').className`);
    await js(`localStorage.setItem('cf_tour_visto','1')`);
    await sleep(1500);
    await js(`(()=>{const F=document.querySelector('#formLogin');F.elements.usuario.value='acai.gisele';F.elements.senha.value='senho123456';F.requestSubmit();})()`); await sleep(1500);
    const versao = () => js(`document.getElementById('sbVersao').textContent`);
    const cartao = () => js(`(()=>{const c=document.getElementById('updCard');return c.hidden?'':c.textContent})()`);
    ok((await texto()) === 'Modo de teste', 'fora do app instalado mostra "Modo de teste"');
    await manda({ estado: 'atualizado' });
    ok((await texto()) === 'Atualizado' && (await classe()).includes('ok') && (await versao()) === '1.0.0', 'atualizado: linha "Versão 1.0.0" e "Atualizado" com ícone verde');
    ok(await js(`!!document.querySelector('#sbIc svg')`), 'ícone desenhado (svg)');
    fs.writeFileSync(path.join(OUT, 'versao-ok.png'), (await win.webContents.capturePage()).toPNG());
    ok((await cartao()) === '', 'sem aviso quando está atualizado');
    await manda({ estado: 'verificando' }); ok((await texto()).includes('Verificando'), 'verificando');
    await manda({ estado: 'baixando', versao: '1.0.1', pct: 40 });
    ok((await texto()) === 'Baixando 40%', 'baixando mostra a porcentagem');
    ok((await cartao()).includes('Nova versão 1.0.1 encontrada'), 'aviso aparece assim que encontra a nova versão');
    await manda({ estado: 'erro' }); ok((await texto()) === 'Sem conexão', 'erro de verificação');
    await manda({ estado: 'pronta', versao: '1.0.1' });
    ok((await texto()).includes('pronta') && (await classe()).includes('pronta'), 'pronta: destaque roxo');
    ok((await cartao()).includes('Nova versão 1.0.1 pronta') && (await cartao()).includes('Atualizar agora'), 'cartão com botão "Atualizar agora"');
    fs.writeFileSync(path.join(OUT, 'update-cartao.png'), (await win.webContents.capturePage()).toPNG());
    await js(`document.querySelector('#updCard [data-action=updDepois]').click()`); await sleep(300);
    ok((await cartao()) === '', '"Depois" fecha o cartão');
    await manda({ estado: 'pronta', versao: '1.0.1' });
    ok((await cartao()) === '', 'o mesmo aviso não reaparece depois de dispensado');
    await manda({ estado: 'pronta', versao: '1.0.2' });
    ok((await cartao()).includes('1.0.2'), 'versão mais nova mostra o aviso de novo');
    await js(`document.getElementById('sbUpd').click()`); await sleep(500);
    ok(await js(`!!document.querySelector('.modal') && document.querySelector('.modal').textContent.includes('Reiniciar e atualizar')`), 'clicar na caixa de versão pronta abre a confirmação');
    await js(`[...document.querySelectorAll('.modal button')].find(b=>b.textContent.includes('Agora não')).click()`); await sleep(300);
    ok(await js(`!document.querySelector('.modal')`), '"Agora não" fecha sem instalar');
    await js(`document.getElementById('sidebar').click()`); await sleep(500);
    ok(await js(`getComputedStyle(document.querySelector('.ver-tx')).display==='none' && document.getElementById('sbIc').getBoundingClientRect().width>0`), 'menu recolhido mostra só o ícone da versão');
    await js(`document.querySelector('[data-action=logout]').click()`); await sleep(500);
    ok(await js(`document.getElementById('updCard').hidden`), 'cartão some na tela de login');
  } catch (e) { console.log('ERRO', e); falhas.push(String(e)); }
  console.log(falhas.length ? 'RESULTADO: FALHOU' : 'RESULTADO: TUDO OK');
  app.exit(falhas.length ? 1 : 0);
});
