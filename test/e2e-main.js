// Teste de tela: electron test/e2e-main.js  (usa pasta de dados temporária)
const { app, BrowserWindow } = require('electron');
const fs = require('fs'); const path = require('path');
process.env.CF_DATA_DIR = process.env.CF_DATA_DIR || fs.mkdtempSync('/tmp/cf-e2e-');
require('../src/main.js');
const OUT = process.env.SHOTS || '/tmp/shots';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
app.whenReady().then(async () => {
  try {
    let win; for (let i = 0; i < 50 && !win; i++) { await sleep(200); win = BrowserWindow.getAllWindows()[0]; }
    const js = (c) => win.webContents.executeJavaScript(c);
    const shot = async (n) => { await sleep(350); const img = await win.webContents.capturePage(); fs.writeFileSync(path.join(OUT, n + '.png'), img.toPNG()); };
    await sleep(1500);
    await shot('01-vazio');
    await js(`document.querySelector('[data-action=seedPadrao]').click()`); await sleep(500);
    await js(`document.querySelector('#nav [data-view=gerenciar]').click()`); await sleep(300);
    await js(`document.querySelector('#estabLista .estab-open').click()`); await sleep(300);
    // lança em outubro (fora do mês atual): deve pular para outubro
    const fill = (d, t, v, f) => js(`(()=>{const F=document.querySelector('#formLanc');F.elements.data.value='${d}';document.querySelector('#${t === 'entrada' ? 'tEnt' : 'tSai'}').checked=true;F.elements.valor.value='${v}';F.elements.forma.value='${f}';F.requestSubmit();})()`);
    await fill('2026-10-01', 'entrada', '1.200,50', 'Pix'); await sleep(500);
    await fill('2026-10-05', 'saida', '350', 'Dinheiro'); await sleep(500);
    await fill('2026-10-07', 'entrada', 'abc', 'Pix'); await sleep(400);
    await shot('02-estab-erro');
    await js(`document.querySelector('#fValor').value='80';document.querySelector('#formLanc').requestSubmit()`); await sleep(500);
    await shot('03-estab');
    const txt = await js(`document.querySelector('#main').innerText`);
    fs.writeFileSync(path.join(OUT, 'estab.txt'), txt);
    await js(`document.querySelector('#nav [data-action=nav][data-view=resumo]').click()`); await sleep(300);
    await shot('04-resumo');
    await js(`document.querySelector('#nav [data-view=gerenciar]').click()`); await sleep(300);
    await shot('05-gerenciar');
    const st = await js(`JSON.stringify({mes:window.__cf.S.mes,ano:window.__cf.S.ano,n:window.__cf.S.data.lancamentos.length})`);
    fs.writeFileSync(path.join(OUT, 'state.json'), st);
    console.log('E2E OK', st);
  } catch (e) { console.log('E2E FALHA', e); }
  app.exit(0);
});
