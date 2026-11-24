// Gera a prévia do sistema para o navegador: preview/index.html (um único arquivo).
// Usa o mesmo HTML, CSS e JS do aplicativo, com uma API simulada na memória (dados de exemplo).
// Uso: node tools/preview-web.js
const fs = require('fs');
const path = require('path');

const raiz = path.join(__dirname, '..');
const R = (f) => fs.readFileSync(path.join(raiz, 'src', 'renderer', f), 'utf8');
const svgUri = (f) => 'data:image/svg+xml;base64,' + fs.readFileSync(path.join(raiz, 'src', 'renderer', 'img', f)).toString('base64');
const uris = { 'brand-mark.svg': svgUri('brand-mark.svg'), 'finance-illustration.svg': svgUri('finance-illustration.svg'), 'background-waves.svg': svgUri('background-waves.svg') };
const trocaImgs = (s) => s.replace(/img\/([\w-]+\.svg)/g, (_m, n) => uris[n]);

// corpo da página (sem <head>, sem <script src>)
let corpo = R('index.html').split('<body>')[1].split('</body>')[0];
corpo = corpo.replace(/<script src="[^"]+"><\/script>\s*/g, '');
corpo = trocaImgs(corpo);
corpo = corpo.replace('<span>Controle Financeiro</span></header>', '<span>Controle Financeiro</span><em class="prev-tag">Prévia no navegador · dados de exemplo</em></header>');
corpo = corpo.replace('<p id="lAjuda"', '<p class="prev-hint">Nesta prévia, qualquer usuário e senha entram.</p>\n        <p id="lAjuda"');

const css = trocaImgs(R('style.css')) + `
/* ----- ajustes só da prévia ----- */
body { overflow: auto; }
.prev-tag { margin-left: auto; margin-right: 1rem; font-style: normal; font-size: .75rem; padding: .15rem .6rem; border-radius: 999px; background: rgba(192,132,252,.25); color: #F1E6FF; white-space: nowrap; }
.prev-hint { margin: .6rem 0 0; text-align: center; font-size: .8rem; color: #CDB5F0; }
#login, #app { min-height: 560px; }
@media (max-width: 760px) {
  #main { padding: 1rem; }
  .table-wrap { overflow-x: auto; }
  .banner { padding: .8rem; }
  .banner h1 { font-size: 1.2rem; }
  .banner-actions { width: 100%; }
  #main { overflow-x: hidden; }
  .kpi .v { font-size: 1.3rem; }
  .prev-tag { display: none; }
  #toast { max-width: 92vw; }
  .modal { width: 92vw; }
}
`;

const mock = `
(function () {
  const C = window.Core;
  const guardar = (f) => { try { return f(); } catch (_) { return null; } };
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const iso = (mesesAtras, dia) => { const h = new Date(); const d = new Date(h.getFullYear(), h.getMonth() - mesesAtras, dia); const p = (n) => String(n).padStart(2, '0'); return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()); };

  // dados de exemplo
  let data = C.emptyData();
  ['Projeto', 'Invictus', 'Delivery', 'Loja', 'Contecnica'].forEach((n) => C.addEstab(data, n));
  const mov = [
    [0,0,3,'entrada','1.250,00','Pix'],[0,0,5,'saida','320,00','Dinheiro'],[0,0,9,'entrada','780,50','Cartão Débito'],
    [1,0,2,'entrada','2.350,00','Pix'],[1,0,6,'saida','780,40','Boleto'],[1,0,9,'entrada','1.890,90','Cartão Crédito'],
    [2,0,3,'entrada','960,00','Dinheiro'],[2,0,12,'saida','410,00','Transferência'],
    [3,0,5,'entrada','4.120,00','Pix'],[3,0,14,'saida','1.250,00','Boleto'],
    [4,0,8,'entrada','2.780,00','Cartão Débito'],[4,0,16,'saida','530,90','Dinheiro'],
    [0,1,4,'entrada','1.700,00','Pix'],[0,1,18,'saida','620,00','Dinheiro'],[3,1,10,'entrada','3.300,00','Pix'],[3,1,22,'saida','890,00','Transferência'],
  ];
  mov.forEach(([i, m, d, tipo, valor, forma]) => C.addLanc(data, { estabId: data.estabelecimentos[i].id, data: iso(m, d), tipo, valor, forma }));

  const OPS = {
    addEstab: (d, p) => C.addEstab(d, p.nome),
    addEstabs: (d, p) => { let criados = 0; for (const nome of p.nomes || []) { if (!d.estabelecimentos.some((e) => C.norm(e.nome) === C.norm(nome))) { C.addEstab(d, nome); criados++; } } return { criados }; },
    renameEstab: (d, p) => C.renameEstab(d, p.id, p.nome),
    removeEstab: (d, p) => C.removeEstab(d, p.id),
    addLanc: (d, p) => C.addLanc(d, p),
    updateLanc: (d, p) => C.updateLanc(d, p.id, p),
    deleteLanc: (d, p) => C.deleteLanc(d, p.id),
  };
  let logado = false;
  let bk = null; // backup automático simulado
  const bkStatus = () => ({ ok: true, pasta: bk ? bk.pasta : null, ultimo: bk ? bk.ultimo : null, erro: null, aviso: null, ligado: !!bk });
  const SEM_ARQUIVO = { ok: false, error: 'Na prévia não dá para salvar ou abrir arquivos. No aplicativo instalado isso funciona normalmente.' };
  const ok = (v) => Promise.resolve(v);

  window.api = {
    authStatus: () => ok({ logado }),
    login: (usuario, senha, lembrar) => {
      if (!String(usuario || '').trim() || !String(senha || '')) return ok({ ok: false, error: 'Usuário ou senha incorretos.' });
      logado = true;
      guardar(() => { if (lembrar) localStorage.setItem('prev_acesso', JSON.stringify({ usuario, senha })); else localStorage.removeItem('prev_acesso'); });
      return ok({ ok: true });
    },
    lembrado: () => ok(guardar(() => JSON.parse(localStorage.getItem('prev_acesso'))) || null),
    logout: () => { logado = false; return ok({ ok: true }); },
    getState: () => ok(logado ? { data: clone(data), recovered: null, dataDir: '(prévia)', version: '1.0.0' } : { ok: false, auth: true, error: 'Faça login para continuar.' }),
    op: (name, payload) => {
      const fn = OPS[name]; if (!fn) return ok({ ok: false, error: 'Operação desconhecida.' });
      const antes = clone(data);
      try { const result = fn(data, payload || {}); return ok({ ok: true, data: clone(data), result }); }
      catch (e) { data = antes; return ok({ ok: false, error: e.message }); }
    },
    exportExcel: () => ok(SEM_ARQUIVO), exportPdf: () => ok(SEM_ARQUIVO), backupSave: () => ok(SEM_ARQUIVO),
    backupRestore: () => ok(SEM_ARQUIVO), importXlsx: () => ok(SEM_ARQUIVO),
    updateStatus: () => ok({ estado: 'atualizado', atual: '1.0.0', versao: null, pct: 0 }),
    updateCheck: () => ok({ estado: 'atualizado', atual: '1.0.0', versao: null, pct: 0 }),
    updateInstall: () => ok({ ok: false }), onUpdate: () => {},
    backupStatus: () => ok(bkStatus()),
    backupEscolher: () => { bk = { pasta: 'G:\Meu Drive\Financeiro (exemplo)', ultimo: new Date().toISOString(), erro: null }; return ok(bkStatus()); },
    backupAgora: () => { if (bk) bk.ultimo = new Date().toISOString(); return ok(bkStatus()); },
    backupRemover: () => { bk = null; return ok(bkStatus()); },
    showInFolder: () => ok(),
  };
})();
`;

const html = `<title>Controle Financeiro</title>
<style>
${css}
</style>
${corpo}
<script>${R('core.js')}</script>
<script>${mock}</script>
<script>${R('app.js')}</script>
<script>${R('tour.js')}</script>
<script>try { if (window.innerWidth < 760 && window.__cf) window.__cf.setSidebar(true, false); } catch (_) {}</script>
`;
fs.mkdirSync(path.join(raiz, 'preview'), { recursive: true });
fs.writeFileSync(path.join(raiz, 'preview', 'index.html'), html);
console.log('preview/index.html', (html.length / 1024).toFixed(0) + ' KB');
