// Teste de tela: menu lateral recolhível e "lembrar meu acesso"  (electron test/e2e-menu.js)
const { app, BrowserWindow } = require('electron');
const fs = require('fs'); const os = require('os'); const path = require('path');
process.env.CF_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'cf-e2e-menu-'));
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
    const shot = async (n) => { await sleep(500); fs.writeFileSync(path.join(OUT, n + '.png'), (await win.webContents.capturePage()).toPNG()); };
    const entrar = (lembrar) => js(`(()=>{const F=document.querySelector('#formLogin');F.elements.usuario.value='acai.gisele';F.elements.senha.value='senho123456';document.getElementById('lLembrar').checked=${lembrar};F.requestSubmit();})()`);
    await js(`localStorage.setItem('cf_tour_visto','1')`);
    await sleep(1500);

    // --- lembrar acesso ---
    ok((await js(`document.getElementById('lUser').value`)) === '', 'começa sem nada guardado');
    await entrar(true); await sleep(1200);
    await js(`window.api.op('addEstabs',{nomes:['Projeto','Invictus','Delivery','Loja']}).then(()=>window.api.getState()).then(s=>{__cf.S.data=s.data;__cf.render();})`); await sleep(600);
    await shot('menu-1-aberto');
    await js(`document.querySelector('[data-action=logout]').click()`); await sleep(900);
    ok((await js(`document.getElementById('lUser').value`)) === 'acai.gisele', 'usuário volta preenchido');
    ok((await js(`document.getElementById('lPass').value`)) === 'senho123456', 'senha volta preenchida');
    ok(await js(`document.getElementById('lLembrar').checked`), 'caixa marcada');
    ok(!fs.readFileSync(path.join(process.env.CF_DATA_DIR, 'acesso.bin')).includes('senho123456'), 'arquivo guardado não tem a senha em texto');
    await shot('login-lembrado');
    await entrar(false); await sleep(1200);
    await js(`document.querySelector('[data-action=logout]').click()`); await sleep(900);
    ok((await js(`document.getElementById('lUser').value`)) === '', 'entrar sem marcar apaga o acesso guardado');
    ok(!fs.existsSync(path.join(process.env.CF_DATA_DIR, 'acesso.bin')), 'arquivo removido');

    // --- menu lateral ---
    await entrar(false); await sleep(1200);
    const larg = () => js(`Math.round(document.getElementById('sidebar').getBoundingClientRect().width)`);
    const aberto = await larg();
    ok(aberto > 200, `menu abre expandido (${aberto}px)`);
    await js(`document.querySelector('#nav .nav-btn:nth-child(2)').dispatchEvent(new MouseEvent('mouseover',{bubbles:true}))`); await sleep(500);
    ok((await larg()) === aberto, 'passar o mouse não muda o menu');
    await js(`document.querySelector('#nav .nav-btn').click()`); await sleep(400);
    ok((await larg()) === aberto, 'clicar em um botão do menu não recolhe o menu');
    ok(await js(`!document.getElementById('sbToggle')`), 'sem botão de seta');
    await js(`document.getElementById('sidebar').click()`); await sleep(600);
    const fechado = await larg();
    ok(fechado < 100, `clique no botão recolhe (${fechado}px)`);
    ok(await js(`getComputedStyle(document.querySelector('.nav-tx')).display==='none'`), 'textos somem quando recolhido');
    ok(await js(`document.getElementById('sidebar').getAttribute('aria-expanded')==='false'`), 'aria-expanded atualizado');
    ok(await js(`document.querySelectorAll('#nav .nav-btn').length === 2`), 'menu tem só Resumo e Estabelecimentos');
    ok(await js(`[...document.querySelectorAll('#nav .nav-btn')].every(b => b.title && b.querySelector('svg'))`), 'itens têm ícone e dica (title) no modo recolhido');
    await shot('menu-2-recolhido');
    await js(`document.querySelector('#nav [data-view=gerenciar]').click()`); await sleep(500);
    ok((await js(`__cf.S.view.name`)) === 'gerenciar', 'abrir Estabelecimentos com o menu recolhido');
    ok((await js(`document.querySelectorAll('#estabLista .estab-open').length`)) === 4, 'página lista os 4 estabelecimentos');
    await js(`document.querySelector('#estabLista .estab-open').click()`); await sleep(500);
    ok((await js(`__cf.S.view.name`)) === 'estab', 'abrir um estabelecimento pela lista');
    await js(`(async()=>{const s=await window.api.getState();for(const n of ['Aurora','Bela','Cacau','Doce']) await window.api.op('addEstab',{nome:n});__cf.S.data=(await window.api.getState()).data;__cf.S.view={name:'gerenciar',estabId:null};__cf.render();})()`); await sleep(600);
    ok(await js(`!!document.getElementById('fBusca')`), 'busca aparece com mais de 5 estabelecimentos');
    await js(`(()=>{const b=document.getElementById('fBusca');b.value='cac';b.dispatchEvent(new Event('input',{bubbles:true}));})()`); await sleep(300);
    ok((await js(`document.querySelectorAll('#estabLista .estab-open').length`)) === 1, 'busca filtra a lista');
    await js(`(()=>{const b=document.getElementById('fBusca');b.value='';b.dispatchEvent(new Event('input',{bubbles:true}));})()`);
    await js(`document.querySelector('#estabLista .estab-open').click()`); await sleep(500);
    ok(await js(`!!document.getElementById('selEstab') && document.querySelectorAll('#selEstab option').length === 8`), 'tela do estabelecimento tem o seletor para trocar');
    ok(await js(`!document.querySelector('.font-ctl')`), 'sem controle de tamanho da letra');
    await shot('menu-3-recolhido-estab');
    await js(`document.getElementById('sidebar').click()`); await sleep(600);
    ok((await larg()) === aberto, 'novo clique expande de volta');
    ok((await js(`localStorage.getItem('cf_sb_recolhido')`)) === '0', 'preferência guardada');
    await shot('menu-4-estab-aberto');
  } catch (e) { console.log('ERRO', e); falhas.push(String(e)); }
  console.log(falhas.length ? 'RESULTADO: FALHOU' : 'RESULTADO: TUDO OK');
  app.exit(falhas.length ? 1 : 0);
});
