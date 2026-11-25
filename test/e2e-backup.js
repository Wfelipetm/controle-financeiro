// Teste de tela: cartão "Backup e segurança" e backup automático  (electron test/e2e-backup.js)
const { app, BrowserWindow, dialog } = require('electron');
const fs = require('fs'); const os = require('os'); const path = require('path');
process.env.CF_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'cf-e2e-bk-'));
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'cf-ud-')));
const NUVEM = fs.mkdtempSync(path.join(os.tmpdir(), 'cf-nuvem-'));
const SAIDAS = fs.mkdtempSync(path.join(os.tmpdir(), 'cf-saidas-'));
dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [NUVEM] });
dialog.showSaveDialog = async (_w, o) => ({ canceled: false, filePath: path.join(SAIDAS, path.basename((o && o.defaultPath) || 'arquivo')) });
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
    await js(`localStorage.setItem('cf_tour_visto','1'); localStorage.removeItem('cf_aviso_backup')`);
    await sleep(1500);
    await js(`(()=>{const F=document.querySelector('#formLogin');F.elements.usuario.value='acai.giselle';F.elements.senha.value='senho123456';F.requestSubmit();})()`); await sleep(1500);
    await js(`window.api.op('addEstabs',{nomes:['Projeto','Loja']}).then(()=>window.api.getState()).then(s=>{__cf.S.data=s.data;__cf.render();})`); await sleep(500);

    // aviso no Resumo
    ok(await js(`!!document.querySelector('.aviso') && document.querySelector('.aviso').textContent.includes('só neste computador')`), 'Resumo avisa que os dados estão só neste computador');
    await shot('bk-1-aviso');
    await js(`document.querySelector('[data-action=dispensarBackup]').click()`); await sleep(300);
    ok(await js(`!document.querySelector('.aviso')`), '"Depois" esconde o aviso');

    // cartão
    await js(`document.querySelector('#nav [data-view=gerenciar]').click()`); await sleep(500);
    ok(await js(`!document.querySelector('[data-action=openData]') && !document.body.textContent.includes('Abrir a pasta dos dados')`), 'sem o botão "Abrir a pasta dos dados"');
    ok(await js(`document.querySelectorAll('#cardBackup .bk').length === 3`), 'cartão tem as 3 opções (automático, manual, Excel)');
    ok(await js(`document.querySelector('#cardBackup .chip').textContent === 'Desligado'`), 'começa desligado');
    await shot('bk-2-desligado');

    // ligar
    await js(`document.querySelector('[data-action=backupPasta]').click()`); await sleep(1200);
    ok(await js(`document.querySelector('#cardBackup .chip').textContent === 'Ligado'`), 'escolher a pasta liga o backup');
    const sub = path.join(NUVEM, 'Controle Financeiro - Backup');
    const arqs = fs.existsSync(sub) ? fs.readdirSync(sub).filter((n) => /^dados-/.test(n)) : [];
    ok(arqs.length === 1, 'primeiro backup criado na pasta escolhida');
    ok(arqs.length === 1 && JSON.parse(fs.readFileSync(path.join(sub, arqs[0]), 'utf8')).estabelecimentos.length === 2, 'backup contém os dados atuais');
    ok(await js(`document.querySelector('.bk-info').textContent.includes(${JSON.stringify(NUVEM)})`), 'mostra a pasta e o último backup');
    ok(fs.existsSync(path.join(process.env.CF_DATA_DIR, 'backup-externo.json')), 'escolha guardada em arquivo de configuração');
    await shot('bk-3-ligado');

    // backup agora
    const antes = fs.statSync(path.join(sub, arqs[0])).mtimeMs; await sleep(50);
    await js(`document.querySelector('[data-action=backupAgora]').click()`); await sleep(800);
    ok(fs.statSync(path.join(sub, arqs[0])).mtimeMs >= antes, '"Fazer backup agora" regrava o arquivo do dia');

    // aviso de problema
    await js(`__cf.S.backup = Object.assign({}, __cf.S.backup, { aviso: 'erro', erro: 'A pasta não foi encontrada.' }); __cf.S.view={name:'resumo',estabId:null}; __cf.render();`); await sleep(300);
    ok(await js(`!!document.querySelector('.aviso-erro') && document.querySelector('.aviso-erro').textContent.includes('não está funcionando')`), 'aviso de erro aparece no Resumo');
    await shot('bk-4-erro');
    await js(`document.querySelector('.aviso-erro [data-action=irBackup]').click()`); await sleep(700);
    ok(await js(`__cf.S.view.name==='gerenciar'`), '"Ver backup" abre a página do backup');

    // exportar o ano
    await js(`document.querySelector('[data-action=exportAno]').click()`); await sleep(2500);
    ok(fs.readdirSync(SAIDAS).some((n) => n.endsWith('.xlsx')), '"Exportar o ano todo" gera a planilha');

    // desligar
    await js(`document.querySelector('[data-action=backupParar]').click()`); await sleep(400);
    await js(`[...document.querySelectorAll('.modal button')].find(b=>b.textContent.trim()==='Desligar').click()`); await sleep(600);
    ok(await js(`document.querySelector('#cardBackup .chip').textContent === 'Desligado'`), 'desligar volta ao estado inicial');
    ok(fs.readdirSync(sub).length === 1, 'arquivos já copiados continuam na pasta');
  } catch (e) { console.log('ERRO', e); falhas.push(String(e)); }
  console.log(falhas.length ? 'RESULTADO: FALHOU' : 'RESULTADO: TUDO OK');
  app.exit(falhas.length ? 1 : 0);
});
