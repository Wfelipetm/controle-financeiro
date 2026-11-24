// Teste de tela do tour guiado: electron test/e2e-tour.js  (usa pasta de dados temporária)
const { app, BrowserWindow } = require('electron');
const fs = require('fs'); const os = require('os'); const path = require('path');
process.env.CF_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'cf-e2e-tour-'));
// pasta própria do Electron (localStorage, bloqueio de instância): não mistura com o app instalado
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
    const shot = async (n) => { await sleep(450); fs.writeFileSync(path.join(OUT, n + '.png'), (await win.webContents.capturePage()).toPNG()); };
    const entrar = () => js(`(()=>{const F=document.querySelector('#formLogin');F.elements.usuario.value='acai.gisele';F.elements.senha.value='senho123456';F.requestSubmit();})()`);
    // passa por todos os passos; devolve info de cada um
    const percorrer = async (prefixo) => {
      const infos = [];
      for (let k = 0; k < 30; k++) {
        await sleep(350);
        for (let w = 0; w < 30 && !(await js(`(()=>{const c=document.getElementById('tourCard');return !!c && c.style.visibility==='visible'})()`)); w++) await sleep(100);
        const info = await js(`(()=>{const s=document.getElementById('tourSpot').getBoundingClientRect();const c=document.getElementById('tourCard').getBoundingClientRect();
          return {n:document.getElementById('tourN').textContent,t:document.getElementById('tourTitulo').textContent,spotW:Math.round(s.width),
          r:[c.left,c.top,c.right,c.bottom,innerWidth,innerHeight].map(Math.round).join(','),r:[c.left,c.top,c.right,c.bottom,innerWidth,innerHeight].map(Math.round).join(','),dentro:c.left>=0&&c.top>=0&&c.right<=innerWidth&&c.bottom<=innerHeight,prox:document.getElementById('tourProx').textContent}})()`);
        infos.push(info);
        if (prefixo) await shot(`${prefixo}-${String(k + 1).padStart(2, '0')}`);
        if (info.prox === 'Concluir') break;
        await js(`document.getElementById('tourProx').click()`);
      }
      return infos;
    };

    await sleep(1500);
    await entrar(); await sleep(1500);
    ok(await js(`!!document.getElementById('tour')`), 'tour abre sozinho no primeiro acesso');
    let infos = await percorrer('tour-vazio');
    ok(infos.length === 8, `sem dados: 8 passos (veio ${infos.length})`);
    ok(infos.every((x) => x.dentro), 'sem dados: cartão sempre dentro da janela' + (infos.every((x) => x.dentro) ? '' : ' (fora: ' + infos.filter((x) => !x.dentro).map((x) => x.t).join(' | ') + ')'));
    await js(`document.getElementById('tourProx').click()`); await sleep(500);
    ok(await js(`!document.getElementById('tour')`), 'concluir fecha o tour');

    await js(`document.querySelector('[data-action=logout]').click()`); await sleep(500);
    await entrar(); await sleep(1500);
    ok(await js(`!document.getElementById('tour')`), 'não abre sozinho de novo depois de visto');

    // cria dados e refaz o tour pelo botão
    await js(`(async()=>{await window.api.op('addEstabs',{nomes:['Projeto','Loja']});
      const st=await window.api.getState();const e=st.data.estabelecimentos[0];
      await window.api.op('addLanc',{estabId:e.id,data:new Date().toISOString().slice(0,10),tipo:'entrada',valor:'1.200,50',forma:'Pix'});
      __cf.S.data=(await window.api.getState()).data;__cf.render();})()`);
    await sleep(500);
    await js(`document.querySelector('[data-action=tour]').click()`);
    infos = await percorrer('tour-cheio');
    ok(infos.length === 12, `com dados: 12 passos (veio ${infos.length})`);
    ok(infos.every((x) => x.dentro), 'com dados: cartão sempre dentro da janela' + (infos.every((x) => x.dentro) ? '' : ' (fora: ' + infos.filter((x) => !x.dentro).map((x) => x.t).join(' | ') + ')'));
    const semDestaque = infos.filter((x) => x.spotW === 0).map((x) => x.t);
    ok(semDestaque.length === 2, `só abertura e fim sem destaque (sem destaque: ${semDestaque.join(' | ')})`);
    await js(`document.getElementById('tourX').click()`); await sleep(400);
    ok(await js(`!document.getElementById('tour') && __cf.S.view.name==='resumo'`), 'fechar volta à tela de origem');
    // teclado
    await js(`document.querySelector('[data-action=tour]').click()`); await sleep(500);
    await js(`document.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}))`); await sleep(400);
    ok((await js(`document.getElementById('tourN').textContent`)) === 'Passo 2 de 12', 'seta direita avança');
    await js(`document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))`); await sleep(400);
    ok(await js(`!document.getElementById('tour')`), 'Esc fecha o tour');
    const dados = await js(`window.api.getState().then(s=>s.data.lancamentos.length)`);
    ok(dados === 1, 'o tour não alterou os dados');
  } catch (e) { console.log('ERRO', e); falhas.push(String(e)); }
  console.log(falhas.length ? 'RESULTADO: FALHOU' : 'RESULTADO: TUDO OK');
  app.exit(falhas.length ? 1 : 0);
});
