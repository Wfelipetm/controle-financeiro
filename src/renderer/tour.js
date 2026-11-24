// Tour guiado: destaca cada área do sistema e explica para que serve.
// Não altera nenhum dado; só navega entre as telas e volta para onde estava.
(function () {
  'use strict';
  const KEY = 'cf_tour_visto';
  const $ = (s) => document.querySelector(s);
  let cf = null;          // window.__cf (estado e render do app)
  let passos = [];        // passos que valem para o estado atual
  let i = 0;
  let ativo = false;
  let viewOriginal = null;
  let menuRecolhido = false;
  let els = null;

  const temEstab = () => cf.S.data.estabelecimentos.length > 0;
  const irPara = (v) => { cf.S.view = v; cf.S.editId = null; cf.S.formError = ''; cf.S.estabError = ''; cf.render(); };

  function definirPassos() {
    const primeiro = temEstab() ? cf.S.data.estabelecimentos[0].id : null;
    return [
      { view: { name: 'resumo', estabId: null }, titulo: 'Bem-vindo(a) ao Controle Financeiro!',
        texto: 'Este rápido passeio mostra, de ponta a ponta, como registrar as entradas e saídas de cada estabelecimento e acompanhar o saldo. Use as setas do teclado ou os botões para avançar.' },
      { view: { name: 'resumo', estabId: null }, alvo: '#nav', lado: 'direita', titulo: 'Menu lateral',
        texto: '"Resumo Mensal" mostra todos os estabelecimentos juntos. Em "Estabelecimentos" você abre cada um deles para lançar as movimentações. Clique em uma área vazia do menu para recolher ou abrir.' },
      { view: { name: 'resumo', estabId: null }, alvo: '.period', quando: temEstab, titulo: 'Escolha o período',
        texto: 'Troque o mês e o ano, use as setas para ir ao mês anterior ou seguinte, ou escolha "Ano todo". O botão "Mês atual" volta para hoje.' },
      { view: { name: 'resumo', estabId: null }, alvo: '.banner-actions', titulo: 'Exportar relatórios',
        texto: 'Gere uma planilha em Excel ou um PDF do período que está na tela, para guardar, imprimir ou enviar.' },
      { view: { name: 'resumo', estabId: null }, alvo: '.table-wrap', quando: temEstab, titulo: 'Resumo por estabelecimento',
        texto: 'Aqui aparecem o total de entradas, o total de saídas e o saldo de cada estabelecimento no período, com o total geral no final. Clique em uma linha para abrir aquele estabelecimento.' },
      { view: { name: 'estab', estabId: primeiro }, alvo: '#formLanc', quando: temEstab, titulo: 'Lançar entrada ou saída',
        texto: 'Informe a data, escolha Entrada ou Saída, digite o valor (exemplo: 1.200,50) e a forma de pagamento. Aperte Enter ou o botão para salvar.' },
      { view: { name: 'estab', estabId: primeiro }, alvo: '.table-wrap, .card.empty', quando: temEstab, titulo: 'Lançamentos do mês',
        texto: 'Todos os lançamentos do período aparecem aqui. Use "Editar" para corrigir um valor e "Excluir" para apagar um lançamento feito por engano.' },
      { view: { name: 'gerenciar', estabId: null }, alvo: '#formEstab', titulo: 'Cadastrar estabelecimentos',
        texto: 'Digite o nome e clique em "Adicionar" para criar um novo estabelecimento. Na lista abaixo, clique no nome para abrir, ou use Renomear e Remover. Com muitos estabelecimentos, use a busca.' },
      { view: { name: 'gerenciar', estabId: null }, alvo: '#main .card:last-child', titulo: 'Backup e segurança',
        texto: 'Seus dados ficam neste computador. Aqui você liga o backup automático em uma pasta do Google Drive ou do OneDrive, salva uma cópia manual ou exporta o ano todo para Excel.' },
      { view: { name: 'resumo', estabId: null }, alvo: '#sideArquivos', lado: 'direita', titulo: 'Planilha e cópias de segurança',
        texto: '"Importar planilha" traz dados de uma planilha Excel. "Salvar cópia de segurança" grava tudo em um arquivo, e "Restaurar cópia" volta os dados a partir dele. Faça uma cópia de vez em quando!' },
      { view: { name: 'resumo', estabId: null }, alvo: '[data-action="logout"]', lado: 'direita', titulo: 'Sair do sistema',
        texto: 'Quando terminar, clique em "Sair" para fechar a sessão. Na próxima vez será preciso entrar de novo com usuário e senha.' },
      { view: { name: 'resumo', estabId: null }, titulo: 'Tudo pronto!',
        texto: 'Agora é só começar. Se quiser rever este passeio, clique em "Tour guiado" no menu lateral.' },
    ];
  }

  function montar() {
    const wrap = document.createElement('div');
    wrap.id = 'tour';
    wrap.innerHTML = `<div id="tourShield"></div><div id="tourSpot"></div>
      <div id="tourCard" role="dialog" aria-modal="true" aria-labelledby="tourTitulo">
        <button class="tour-x" id="tourX" aria-label="Fechar o tour" title="Fechar o tour">×</button>
        <div class="tour-n" id="tourN"></div>
        <h3 id="tourTitulo"></h3><p id="tourTexto"></p>
        <div class="tour-dots" id="tourDots"></div>
        <div class="tour-btns"><button class="tour-skip" id="tourPular">Pular tour</button><span style="flex:1"></span>
          <button class="tour-b light" id="tourVolta">Voltar</button><button class="tour-b" id="tourProx">Próximo</button></div>
      </div>`;
    document.body.appendChild(wrap);
    els = { wrap, spot: $('#tourSpot'), card: $('#tourCard') };
    $('#tourX').onclick = $('#tourPular').onclick = () => fechar(true);
    $('#tourVolta').onclick = () => ir(i - 1);
    $('#tourProx').onclick = () => (i >= passos.length - 1 ? fechar(true) : ir(i + 1));
  }

  function posicionar() {
    if (!ativo) return;
    const p = passos[i];
    const card = els.card; const spot = els.spot;
    const vw = window.innerWidth, vh = window.innerHeight, M = 14;
    let alvo = null;
    if (p.alvo) {
      alvo = document.querySelector(p.alvo);
      if (alvo && alvo.getBoundingClientRect().width === 0) alvo = null;
    }
    card.style.visibility = 'hidden';
    if (!alvo) {
      spot.style.cssText = 'left:50%;top:50%;width:0;height:0;';
      card.style.left = Math.max(M, (vw - card.offsetWidth) / 2) + 'px';
      card.style.top = Math.max(M, (vh - card.offsetHeight) / 2) + 'px';
      card.style.visibility = 'visible';
      return;
    }
    if (alvo.scrollIntoView) alvo.scrollIntoView({ block: 'nearest' });
    const r = alvo.getBoundingClientRect();
    const pad = 6;
    spot.style.left = (r.left - pad) + 'px'; spot.style.top = (r.top - pad) + 'px';
    spot.style.width = (r.width + pad * 2) + 'px'; spot.style.height = (r.height + pad * 2) + 'px';
    const cw = card.offsetWidth, ch = card.offsetHeight;
    let x, y;
    if (p.lado === 'direita' && r.right + M + cw < vw) { x = r.right + pad + M; y = r.top; }
    else if (r.bottom + pad + M + ch < vh) { x = r.left; y = r.bottom + pad + M; }
    else if (r.top - pad - M - ch > 0) { x = r.left; y = r.top - pad - M - ch; }
    else { x = r.right + pad + M; y = r.top; }
    x = Math.min(Math.max(M, x), vw - cw - M);
    y = Math.min(Math.max(M, y), vh - ch - M);
    card.style.left = x + 'px'; card.style.top = y + 'px';
    card.style.visibility = 'visible';
  }

  function ir(n) {
    i = Math.max(0, Math.min(passos.length - 1, n));
    const p = passos[i];
    if (p.view) irPara(p.view);
    $('#tourN').textContent = `Passo ${i + 1} de ${passos.length}`;
    $('#tourTitulo').textContent = p.titulo;
    $('#tourTexto').textContent = p.texto;
    $('#tourDots').innerHTML = passos.map((_, k) => `<i class="${k === i ? 'on' : ''}"></i>`).join('');
    $('#tourVolta').style.visibility = i === 0 ? 'hidden' : 'visible';
    $('#tourProx').textContent = i === passos.length - 1 ? 'Concluir' : 'Próximo';
    $('#tourPular').style.visibility = i === passos.length - 1 ? 'hidden' : 'visible';
    posicionar();                       // já no lugar certo, sem esperar a próxima pintura
    requestAnimationFrame(() => { posicionar(); $('#tourProx').focus(); });
  }

  function teclado(e) {
    if (!ativo) return;
    if (e.key === 'Escape') { e.preventDefault(); fechar(true); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); if (i < passos.length - 1) ir(i + 1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); ir(i - 1); }
  }

  function fechar(marcar) {
    if (!ativo) return;
    ativo = false;
    document.removeEventListener('keydown', teclado, true);
    window.removeEventListener('resize', posicionar);
    if (els) els.wrap.remove();
    els = null;
    if (marcar) { try { localStorage.setItem(KEY, '1'); } catch (_) { /* sem armazenamento */ } }
    if (viewOriginal && cf.S.data) irPara(viewOriginal);
    viewOriginal = null;
    if (menuRecolhido && cf.setSidebar) cf.setSidebar(true, false);
    menuRecolhido = false;
  }

  function iniciar() {
    cf = window.__cf;
    if (!cf || !cf.S.data || ativo) return;
    ativo = true;
    viewOriginal = { ...cf.S.view };
    // o tour precisa do menu aberto para destacar cada item; no fim volta como estava
    menuRecolhido = document.getElementById('sidebar').classList.contains('recolhido');
    if (menuRecolhido && cf.setSidebar) cf.setSidebar(false, false);
    passos = definirPassos().filter((p) => !p.quando || p.quando());
    montar();
    document.addEventListener('keydown', teclado, true);
    window.addEventListener('resize', posicionar);
    ir(0);
  }

  function iniciarSeForPrimeiraVez() {
    let visto = false;
    try { visto = localStorage.getItem(KEY) === '1'; } catch (_) { /* ok */ }
    if (!visto) setTimeout(iniciar, 400);
  }

  window.CFTour = { start: iniciar, maybeStart: iniciarSeForPrimeiraVez, fechar: () => fechar(false) };
})();
