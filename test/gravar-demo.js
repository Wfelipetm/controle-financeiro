// Grava um vídeo de demonstração do sistema, com dados fictícios e legendas.
// Uso: electron test/gravar-demo.js   (saída: demo/Controle Financeiro - Demonstracao.mp4)
// Usa uma pasta de dados temporária: não mexe nos dados reais.
const { app, BrowserWindow, dialog, session } = require('electron');
const fs = require('fs'); const os = require('os'); const path = require('path');

const DADOS = fs.mkdtempSync(path.join(os.tmpdir(), 'cf-demo-'));
process.env.CF_DATA_DIR = DADOS;
const EXPORTS = fs.mkdtempSync(path.join(os.tmpdir(), 'cf-demo-export-'));
// janelas nativas de "salvar como" não aparecem no vídeo: devolvemos um caminho temporário
dialog.showSaveDialog = async (_w, opts) => ({ canceled: false, filePath: path.join(EXPORTS, path.basename((opts && opts.defaultPath) || 'arquivo')) });
// pasta própria do Electron (localStorage, bloqueio de instância): não mistura com o app instalado
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'cf-ud-')));
require('../src/main.js');

const SAIDA = path.join(__dirname, '..', 'demo', 'Controle Financeiro - Demonstracao.mp4');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

app.whenReady().then(async () => {
  let win;
  try {
    for (let i = 0; i < 50 && !win; i++) { await sleep(200); win = BrowserWindow.getAllWindows()[0]; }
    win.setSize(1280, 720); win.center();
    session.defaultSession.setDisplayMediaRequestHandler((_req, cb) => cb({ video: win.webContents.mainFrame }), { useSystemPicker: false });
    const js = (c) => win.webContents.executeJavaScript(c, true);
    await sleep(1500);

    // ---- ferramentas dentro da página: cursor, legenda, digitação ----
    await js(`(() => {
      try { localStorage.setItem('cf_tour_visto', '1'); } catch (_) {}
      const cur = document.createElement('div');
      cur.style.cssText = 'position:fixed;z-index:9999;width:24px;height:24px;margin:-12px 0 0 -12px;border-radius:50%;background:rgba(192,132,252,.6);border:3px solid #fff;box-shadow:0 3px 10px rgba(0,0,0,.45);left:640px;top:420px;transition:left .8s cubic-bezier(.4,0,.2,1),top .8s cubic-bezier(.4,0,.2,1),transform .15s;pointer-events:none';
      const cap = document.createElement('div');
      cap.style.cssText = 'position:fixed;z-index:9998;left:50%;bottom:30px;transform:translateX(-50%);max-width:82%;background:rgba(30,8,62,.92);color:#fff;padding:.85rem 1.6rem;border-radius:14px;font:600 1.3rem "Segoe UI",Arial,sans-serif;text-align:center;box-shadow:0 8px 30px rgba(0,0,0,.4);opacity:0;transition:opacity .35s;pointer-events:none;border:1px solid rgba(192,132,252,.6)';
      document.body.append(cur, cap);
      const wait = (ms) => new Promise((r) => setTimeout(r, ms));
      const D = {
        wait,
        say: async (t) => { if (!t) { cap.style.opacity = 0; return; } cap.textContent = t; cap.style.opacity = 1; },
        el: (s) => (typeof s === 'string' ? document.querySelector(s) : s),
        byText: (sel, txt) => [...document.querySelectorAll(sel)].find((e) => e.textContent.trim().startsWith(txt)),
        move: async (s) => { const e = D.el(s); if (!e) throw new Error('não achei: ' + s); const r = e.getBoundingClientRect(); cur.style.left = (r.left + Math.min(r.width / 2, 90)) + 'px'; cur.style.top = (r.top + r.height / 2) + 'px'; await wait(900); },
        click: async (s) => { const e = D.el(s); await D.move(e); cur.style.transform = 'scale(.7)'; await wait(160); e.click(); cur.style.transform = 'scale(1)'; await wait(350); },
        type: async (s, txt, ms = 85) => { const e = D.el(s); await D.move(e); e.focus(); e.value = ''; for (const ch of txt) { e.value += ch; e.dispatchEvent(new Event('input', { bubbles: true })); await wait(ms); } await wait(250); },
        pick: async (s, v) => { const e = D.el(s); await D.move(e); e.value = v; e.dispatchEvent(new Event('change', { bubbles: true })); await wait(450); },
      };
      window.D = D;
    })()`);

    // ---- gravação ----
    await js(`(async () => {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 30 }, audio: false });
      const tipo = MediaRecorder.isTypeSupported('video/mp4;codecs=avc1') ? 'video/mp4;codecs=avc1' : 'video/webm;codecs=vp9';
      window.__chunks = []; window.__tipo = tipo;
      const rec = new MediaRecorder(stream, { mimeType: tipo, videoBitsPerSecond: 6000000 });
      rec.ondataavailable = (e) => { if (e.data.size) window.__chunks.push(e.data); };
      rec.start(1000); window.__rec = rec; window.__stream = stream;
    })()`);
    await sleep(800);
    const D = (c) => js(c);

    // 1) abertura e login
    await D(`D.say('Controle Financeiro: organize, controle e planeje')`); await sleep(3200);
    await D(`D.say('Acesso protegido por usuário e senha')`);
    await D(`D.type('#lUser', 'acai.gisele')`);
    await D(`D.type('#lPass', 'senho123456', 110)`);
    await D(`D.click('#lBtn')`); await sleep(1800);

    // 2) cadastro de estabelecimentos
    await D(`D.say('Comece cadastrando os seus estabelecimentos')`); await sleep(2600);
    await D(`D.click('[data-action=seedPadrao]')`); await sleep(1800);
    // dados de exemplo dos outros estabelecimentos (mês atual e anterior)
    await D(`(async () => {
      const st = await window.api.getState(); const es = st.data.estabelecimentos; const hoje = new Date();
      const iso = (m, d) => { const x = new Date(hoje.getFullYear(), hoje.getMonth() - m, d); return x.toISOString().slice(0, 10); };
      const mov = [[1,0,2,'entrada','2.350,00','Pix'],[1,0,6,'saida','780,40','Boleto'],[1,0,9,'entrada','1.890,90','Cartão Crédito'],
        [2,0,3,'entrada','960,00','Dinheiro'],[2,0,12,'saida','410,00','Transferência'],[3,0,5,'entrada','4.120,00','Pix'],[3,0,14,'saida','1.250,00','Boleto'],
        [4,0,8,'entrada','2.780,00','Cartão Débito'],[4,0,16,'saida','530,90','Dinheiro'],
        [1,1,4,'entrada','1.700,00','Pix'],[1,1,18,'saida','620,00','Dinheiro'],[3,1,10,'entrada','3.300,00','Pix'],[3,1,22,'saida','890,00','Transferência']];
      for (const [i, m, d, tipo, valor, forma] of mov) await window.api.op('addLanc', { estabId: es[i].id, data: iso(m, d), tipo, valor, forma });
      __cf.S.data = (await window.api.getState()).data; __cf.render();
    })()`);
    await sleep(1200);

    // 3) lançamentos
    await D(`D.say('Cada estabelecimento tem a sua página')`);
    await D(`D.click(D.byText('#nav .nav-btn .nav-tx', 'Estabelecimentos').closest('button'))`); await sleep(1800);
    await D(`D.click('#estabLista .estab-open')`); await sleep(1500);
    await D(`D.say('Registre uma entrada: valor e forma de pagamento')`);
    await D(`D.type('#fValor', '1.250,00')`);
    await D(`D.pick('#fForma', 'Pix')`);
    await D(`D.click('#formLanc button[type=submit]')`); await sleep(2200);
    await D(`D.say('E também as saídas, em poucos segundos')`);
    await D(`D.click('label[for=tSai]')`);
    await D(`D.type('#fValor', '320,00')`);
    await D(`D.pick('#fForma', 'Dinheiro')`);
    await D(`D.click('#formLanc button[type=submit]')`); await sleep(2200);
    await D(`D.click('label[for=tEnt]')`);
    await D(`D.type('#fValor', '780,50')`);
    await D(`D.pick('#fForma', 'Cartão Débito')`);
    await D(`D.click('#formLanc button[type=submit]')`); await sleep(2400);
    await D(`D.say('Total de entradas, saídas e saldo atualizados na hora')`); await sleep(3200);

    // 4) resumo
    await D(`D.say('No Resumo Mensal você vê todos os estabelecimentos juntos')`);
    await D(`D.click(D.byText('#nav .nav-btn .nav-tx', 'Resumo Mensal').closest('button'))`); await sleep(3200);
    await D(`D.say('Navegue entre os meses para comparar')`);
    await D(`D.click('[data-action=prevMes]')`); await sleep(2000);
    await D(`D.click('[data-action=prevMes]')`); await sleep(2000);
    await D(`D.click('[data-action=mesAtual]')`); await sleep(1800);

    // 5) exportações
    await D(`D.say('Exporte o relatório para Excel ou PDF')`);
    await D(`D.click('[data-action=exportExcel]')`); await sleep(3000);
    await D(`D.click('[data-action=exportPdf]')`); await sleep(3500);

    // 6) gerenciar
    await D(`D.say('Adicione ou renomeie estabelecimentos quando quiser')`);
    await D(`D.click(D.byText('#nav .nav-btn .nav-tx', 'Estabelecimentos').closest('button'))`); await sleep(1500);
    await D(`D.type('#fEstab', 'Quiosque')`);
    await D(`D.click('#formEstab button[type=submit]')`); await sleep(2800);

    // 7) backup
    await D(`D.say('Seus dados ficam no computador, com cópia de segurança')`);
    await D(`D.click('[data-action=backupSave]')`); await sleep(3200);

    // 8) tour e despedida
    await D(`D.say('Em dúvida? O Tour guiado explica cada parte do sistema')`);
    await D(`D.click('[data-action=tour]')`); await sleep(3600);
    await D(`D.click('#tourProx')`); await sleep(2600);
    await D(`D.click('#tourX')`); await sleep(1000);
    await D(`D.say('Controle Financeiro: simples, rápido e seguro')`);
    await D(`D.click('[data-action=logout]')`); await sleep(3800);

    // ---- encerra e salva ----
    const b64 = await js(`new Promise((res) => {
      window.__rec.onstop = async () => {
        window.__stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(window.__chunks, { type: window.__tipo });
        const buf = new Uint8Array(await blob.arrayBuffer()); let s = '';
        for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
        res(btoa(s));
      };
      window.__rec.stop();
    })`);
    const tipo = await js('window.__tipo');
    const destino = tipo.startsWith('video/mp4') ? SAIDA : SAIDA.replace(/\.mp4$/, '.webm');
    fs.mkdirSync(path.dirname(destino), { recursive: true });
    fs.writeFileSync(destino, Buffer.from(b64, 'base64'));
    console.log('VIDEO:', destino, (fs.statSync(destino).size / 1048576).toFixed(1) + ' MB');
    app.exit(0);
  } catch (e) {
    console.log('ERRO', e && e.message ? e.message : e);
    app.exit(1);
  }
});
