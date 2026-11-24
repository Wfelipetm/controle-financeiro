(function () {
  'use strict';
  const C = window.Core;
  const api = window.api;
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const agora = new Date();
  const S = {
    data: null, info: {},
    view: { name: 'resumo', estabId: null },
    mes: agora.getMonth() + 1, ano: agora.getFullYear(),
    editId: null, flashId: null, focus: null,
    form: { data: C.todayISO(), tipo: 'entrada', forma: 'Dinheiro', valor: '' },
    formError: '', estabError: '', busca: '',
  };
  const PADRAO = ['Projeto', 'Invictus', 'Delivery', 'Loja', 'Contecnica'];

  // ---------- avisos e janelas ----------
  let toastTimer = null; let toastAction = null;
  function toast(msg, opts = {}) {
    const el = $('#toast');
    el.className = opts.erro ? 'erro' : '';
    el.innerHTML = `<span>${esc(msg)}</span>` + (opts.action ? `<button id="toastBtn">${esc(opts.action.label)}</button>` : '');
    toastAction = opts.action ? opts.action.fn : null;
    requestAnimationFrame(() => el.classList.add('show'));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), opts.action ? 9000 : 4200);
  }

  function modal({ title, message = '', input = null, okText = 'OK', cancelText = 'Cancelar', danger = false }) {
    return new Promise((resolve) => {
      const root = $('#modalRoot');
      root.innerHTML = `<div class="overlay"><div class="modal" role="dialog" aria-modal="true">
        <h3>${esc(title)}</h3>${message ? `<p>${esc(message)}</p>` : ''}
        ${input !== null ? `<input type="text" id="mInput" value="${esc(input)}" maxlength="40">` : ''}
        <div class="btns">${cancelText ? `<button class="btn light" id="mCancel">${esc(cancelText)}</button>` : ''}
        <button class="btn ${danger ? 'danger' : ''}" id="mOk">${esc(okText)}</button></div></div></div>`;
      const done = (ok) => {
        const v = input !== null ? $('#mInput').value : null;
        root.innerHTML = '';
        document.removeEventListener('keydown', onKey, true);
        resolve({ ok, value: v });
      };
      const onKey = (e) => {
        if (e.key === 'Escape') { e.preventDefault(); done(false); }
        else if (e.key === 'Enter') { e.preventDefault(); done(document.activeElement && document.activeElement.id === 'mCancel' ? false : true); }
      };
      document.addEventListener('keydown', onKey, true);
      $('#mOk').onclick = () => done(true);
      if ($('#mCancel')) $('#mCancel').onclick = () => done(false);
      if (input !== null) { $('#mInput').focus(); $('#mInput').select(); }
      else if (danger && $('#mCancel')) $('#mCancel').focus();
      else $('#mOk').focus();
    });
  }

  // ---------- utilidades de período ----------
  function shiftPeriod(d) {
    if (S.mes === 0) { S.ano += d; return; }
    let m = S.mes + d; let a = S.ano;
    if (m < 1) { m = 12; a--; } else if (m > 12) { m = 1; a++; }
    S.mes = m; S.ano = a;
  }
  /** Se o lançamento cai fora do período mostrado, vai para o mês dele. */
  function ajustarPeriodoPara(dataISO) {
    const y = C.yearOf(dataISO); const m = C.monthOf(dataISO);
    if (S.ano !== y || (S.mes !== 0 && S.mes !== m)) { S.ano = y; if (S.mes !== 0) S.mes = m; return true; }
    return false;
  }
  function irParaUltimoLancamentoSeVazio() {
    if (!S.data.lancamentos.length) return;
    const tem = S.data.lancamentos.some((l) => C.inPeriod(l, S.mes, S.ano));
    if (tem) return;
    const ultimo = S.data.lancamentos.map((l) => l.data).sort().pop();
    S.ano = C.yearOf(ultimo); S.mes = C.monthOf(ultimo);
  }
  const centsToInput = (c) => `${Math.floor(c / 100)},${String(c % 100).padStart(2, '0')}`;

  function periodControls() {
    const anos = new Set(C.anosDisponiveis(S.data)); anos.add(S.ano);
    const optAnos = [...anos].sort((a, b) => a - b).map((a) => `<option value="${a}" ${a === S.ano ? 'selected' : ''}>${a}</option>`).join('');
    const optMeses = `<option value="0" ${S.mes === 0 ? 'selected' : ''}>Ano todo</option>` +
      C.MESES.map((m, i) => `<option value="${i + 1}" ${S.mes === i + 1 ? 'selected' : ''}>${m}</option>`).join('');
    return `<div class="period">
      <button class="icon-btn" data-action="prevMes" title="Anterior">◀</button>
      <label>Mês <select id="selMes">${optMeses}</select></label>
      <label>Ano <select id="selAno">${optAnos}</select></label>
      <button class="icon-btn" data-action="nextMes" title="Próximo">▶</button>
      <button class="btn light small" data-action="mesAtual">Mês atual</button>
    </div>`;
  }

  // ---------- telas ----------
  const SVG = (d) => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + '</svg>';
  const ICO_RESUMO = SVG('<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>');
  const ICO_LOJA = SVG('<path d="M4 9l1.5-5h13L20 9"/><path d="M4 9a2.5 2.5 0 0 0 5 0 2.5 2.5 0 0 0 5 0 2.5 2.5 0 0 0 5 0"/><path d="M5 12v8h14v-8M10 20v-5h4v5"/>');
  function navBtn(ativo, acao, extra, icone, texto) {
    return `<button class="nav-btn ${ativo ? 'active' : ''}" data-action="${acao}" ${extra} title="${esc(texto)}" aria-label="${esc(texto)}"><span class="nav-ic">${icone}</span><span class="nav-tx">${esc(texto)}</span></button>`;
  }
  function renderNav() {
    const v = S.view.name;
    $('#nav').innerHTML =
      navBtn(v === 'resumo', 'nav', 'data-view="resumo"', ICO_RESUMO, 'Resumo Mensal') +
      navBtn(v === 'gerenciar' || v === 'estab', 'nav', 'data-view="gerenciar"', ICO_LOJA, 'Estabelecimentos');
  }

  function viewResumo() {
    const { linhas, total } = C.resumoGeral(S.data, S.mes, S.ano);
    const head = `<div class="banner"><div><h1>Resumo Mensal por Estabelecimento</h1><div class="sub">${esc(C.periodoLabel(S.mes, S.ano))}</div></div>
      <div class="banner-actions"><button class="btn light" data-action="exportExcel">Exportar Excel</button><button class="btn light" data-action="exportPdf">Exportar PDF</button></div></div>`;
    if (!S.data.estabelecimentos.length) {
      return head + `<div class="card empty" style="margin-top:1.2rem"><h3>Vamos começar!</h3>
        <div>Primeiro cadastre os estabelecimentos. Depois é só lançar as entradas e saídas.</div>
        <div class="row"><button class="btn green" data-action="seedPadrao">Criar: ${PADRAO.join(', ')}</button>
        <button class="btn light" data-action="importXlsx">Importar da planilha</button>
        <button class="btn light" data-action="nav" data-view="gerenciar">Criar outro nome</button></div></div>`;
    }
    const corpo = linhas.map((l) => `<tr class="click" data-action="goEstab" data-id="${esc(l.estabId)}"><td><b>${esc(l.nome)}</b></td>
      <td class="n">${C.fmtBRL(l.entrada)}</td><td class="n">${C.fmtBRL(l.saida)}</td><td class="n ${l.saldo < 0 ? 'neg' : ''}">${C.fmtBRL(l.saldo)}</td></tr>`).join('');
    return head + periodControls() + `<div class="table-wrap"><table>
      <thead><tr><th>Estabelecimento</th><th class="n">Total Entrada</th><th class="n">Total Saída</th><th class="n">Saldo</th></tr></thead>
      <tbody>${corpo}</tbody>
      <tfoot><tr><td>Total Geral</td><td class="n">${C.fmtBRL(total.entrada)}</td><td class="n">${C.fmtBRL(total.saida)}</td><td class="n ${total.saldo < 0 ? 'neg' : ''}">${C.fmtBRL(total.saldo)}</td></tr></tfoot></table></div>
      <div class="hint">Clique em um estabelecimento para ver e lançar as movimentações dele.</div>`;
  }

  function viewEstab() {
    const e = C.findEstab(S.data, S.view.estabId);
    if (!e) { S.view = { name: 'resumo', estabId: null }; return viewResumo(); }
    const ls = C.lancsDoPeriodo(S.data, e.id, S.mes, S.ano);
    const t = C.totais(ls);
    const editando = S.editId ? S.data.lancamentos.find((l) => l.id === S.editId) : null;
    const f = S.form;
    const formas = C.FORMAS.slice();
    if (f.forma && !formas.includes(f.forma)) formas.push(f.forma);
    const optFormas = formas.map((x) => `<option ${x === f.forma ? 'selected' : ''}>${esc(x)}</option>`).join('');

    const linhas = ls.map((l) => `<tr data-id="${esc(l.id)}" class="${l.id === S.flashId ? 'flash' : ''}"><td>${C.fmtDate(l.data)}</td>
      <td class="n entrada-v">${l.entrada ? C.fmtBRL(l.entrada) : ''}</td><td class="n saida-v">${l.saida ? C.fmtBRL(l.saida) : ''}</td><td>${esc(l.forma)}</td>
      <td class="acoes"><button class="link-btn" data-action="editLanc" data-id="${esc(l.id)}">Editar</button><button class="link-btn red" data-action="delLanc" data-id="${esc(l.id)}">Excluir</button></td></tr>`).join('');

    const trocar = S.data.estabelecimentos.map((x) => `<option value="${esc(x.id)}" ${x.id === e.id ? 'selected' : ''}>${esc(x.nome)}</option>`).join('');
    return `<div class="banner"><div><button class="back" data-action="nav" data-view="gerenciar">← Estabelecimentos</button><h1>Filtro Mensal ${esc(e.nome)}</h1><div class="sub">${esc(C.periodoLabel(S.mes, S.ano))}</div></div>
      <label class="swap">Trocar de estabelecimento <select id="selEstab">${trocar}</select></label></div>
      ${periodControls()}
      <div class="kpis">
        <div class="kpi e"><div class="t">Total Entrada</div><div class="v">${C.fmtBRL(t.entrada)}</div></div>
        <div class="kpi s"><div class="t">Total Saída</div><div class="v">${C.fmtBRL(t.saida)}</div></div>
        <div class="kpi"><div class="t">Saldo</div><div class="v ${t.saldo < 0 ? 'neg' : ''}">${C.fmtBRL(t.saldo)}</div></div>
      </div>
      <form class="card" id="formLanc" autocomplete="off">
        <h2>${editando ? 'Editar lançamento' : 'Novo lançamento'}</h2>
        <div class="form-grid">
          <div class="field"><label class="l" for="fData">Data</label><input type="date" id="fData" name="data" value="${esc(f.data)}"></div>
          <div class="field"><label class="l">Tipo</label><div class="seg">
            <input type="radio" name="tipo" id="tEnt" value="entrada" ${f.tipo === 'entrada' ? 'checked' : ''}><label class="ent" for="tEnt">Entrada</label>
            <input type="radio" name="tipo" id="tSai" value="saida" ${f.tipo === 'saida' ? 'checked' : ''}><label class="sai" for="tSai">Saída</label></div></div>
          <div class="field"><label class="l" for="fValor">Valor (R$)</label><input type="text" id="fValor" name="valor" inputmode="decimal" placeholder="0,00" value="${esc(f.valor)}"></div>
          <div class="field"><label class="l" for="fForma">Forma de pagamento</label><select id="fForma" name="forma">${optFormas}</select></div>
          <div class="field" style="display:flex;gap:.5rem"><button class="btn" type="submit">${editando ? 'Salvar alteração' : 'Salvar lançamento'}</button>${editando ? '<button class="btn light" type="button" data-action="cancelEdit">Cancelar</button>' : ''}</div>
        </div>
        ${S.formError ? `<div class="form-error">${esc(S.formError)}</div>` : '<div class="hint">Exemplo de valor: 1.200,50 &nbsp;·&nbsp; Aperte Enter para salvar.</div>'}
      </form>
      <h2 style="color:var(--azul);font-size:1.15rem;margin:1.2rem 0 .6rem">Lançamentos de ${esc(C.periodoLabel(S.mes, S.ano))} (${ls.length})</h2>
      ${ls.length ? `<div class="table-wrap"><table><thead><tr><th>Data</th><th class="n">Entrada</th><th class="n">Saída</th><th>Forma de pagamento</th><th></th></tr></thead><tbody>${linhas}</tbody></table></div>`
        : `<div class="card empty">Nenhum lançamento em ${esc(C.periodoLabel(S.mes, S.ano))}.<br>Use o formulário acima para lançar, ou troque o mês.</div>`}`;
  }

  function estabRows(filtro) {
    const q = C.norm(filtro || '');
    const lista = S.data.estabelecimentos.filter((e) => !q || C.norm(e.nome).includes(q));
    if (!lista.length) return `<div class="empty">${S.data.estabelecimentos.length ? 'Nenhum estabelecimento com esse nome.' : 'Nenhum estabelecimento ainda.'}</div>`;
    return lista.map((e) => {
      const n = S.data.lancamentos.filter((l) => l.estabId === e.id).length;
      return `<div class="estab-row"><button class="estab-open" data-action="goEstab" data-id="${esc(e.id)}" title="Abrir ${esc(e.nome)}"><span class="nav-ic">${ICO_LOJA}</span><span class="nome">${esc(e.nome)}</span></button><div class="qtd">${n} lançamento${n === 1 ? '' : 's'}</div>
        <button class="btn light small" data-action="renameEstab" data-id="${esc(e.id)}">Renomear</button>
        <button class="btn light small" data-action="removeEstab" data-id="${esc(e.id)}" style="color:var(--vermelho)">Remover</button></div>`;
    }).join('');
  }

  function viewGerenciar() {
    const total = S.data.estabelecimentos.length;
    const busca = total > 5 ? `<input type="text" id="fBusca" class="busca" placeholder="Buscar estabelecimento…" value="${esc(S.busca)}" aria-label="Buscar estabelecimento" autocomplete="off">` : '';
    return `<div class="banner"><div><h1>Estabelecimentos</h1><div class="sub">Abra um para lançar entradas e saídas, ou cadastre, renomeie e remova</div></div></div>
      <form class="card" id="formEstab" style="margin-top:1.2rem" autocomplete="off"><h2>Novo estabelecimento</h2>
        <div class="add-row"><input type="text" id="fEstab" name="nome" maxlength="40" placeholder="Nome do estabelecimento"><button class="btn" type="submit">Adicionar</button></div>
        ${S.estabError ? `<div class="form-error">${esc(S.estabError)}</div>` : ''}</form>
      <div class="card"><div class="card-head"><h2>Cadastrados (${total})</h2>${busca}</div><div id="estabLista">${estabRows(S.busca)}</div>
        <div class="hint">Ao renomear, todos os lançamentos e resumos acompanham o novo nome automaticamente.</div></div>
      <div class="card"><h2>Onde ficam os dados</h2><div class="hint" style="margin:0 0 .7rem">Seus dados ficam salvos só neste computador. O programa faz uma cópia automática por dia.</div>
        <button class="btn light small" data-action="openData">Abrir a pasta dos dados</button></div>`;
  }

  function captureForm() {
    const f = $('#formLanc'); if (!f) return;
    S.form.data = f.elements['data'].value;
    S.form.tipo = f.elements['tipo'].value || S.form.tipo;
    S.form.forma = f.elements['forma'].value;
    S.form.valor = f.elements['valor'].value;
  }

  function render() {
    captureForm();
    renderNav();
    const v = S.view.name;
    $('#main').innerHTML = v === 'estab' ? viewEstab() : v === 'gerenciar' ? viewGerenciar() : viewResumo();
    S.flashId = null;
    if (S.focus) { const el = $(S.focus); if (el) { el.focus(); if (el.select) el.select(); } S.focus = null; }
    if (v === 'estab') { const tr = $('tr.flash'); if (tr) tr.scrollIntoView({ block: 'nearest' }); }
  }

  // ---------- ações ----------
  async function call(name, payload) {
    const res = await api.op(name, payload);
    if (res.ok) S.data = res.data;
    return res;
  }

  async function saveLanc() {
    captureForm();
    const f = S.form;
    const payload = { estabId: S.view.estabId, data: f.data, tipo: f.tipo, valor: f.valor, forma: f.forma };
    const res = S.editId ? await call('updateLanc', { ...payload, id: S.editId }) : await call('addLanc', payload);
    if (!res.ok) { S.formError = res.error; S.focus = '#fValor'; render(); return; }
    const editou = !!S.editId;
    S.formError = ''; S.editId = null; S.form.valor = '';
    S.flashId = res.result.id;
    const mudou = ajustarPeriodoPara(res.result.data);
    S.focus = '#fValor';
    render();
    toast(editou ? 'Alteração salva.' : (mudou ? `Lançamento salvo. Mostrando ${C.periodoLabel(S.mes, S.ano)}.` : 'Lançamento salvo.'));
  }

  async function handleAction(action, el) {
    const id = el.dataset.id;
    switch (action) {
      case 'nav': S.view = { name: el.dataset.view, estabId: null }; S.editId = null; S.formError = ''; S.estabError = ''; render(); break;
      case 'goEstab': S.view = { name: 'estab', estabId: id }; S.editId = null; S.formError = ''; S.form.valor = ''; render(); break;
      case 'prevMes': shiftPeriod(-1); render(); break;
      case 'nextMes': shiftPeriod(1); render(); break;
      case 'mesAtual': { const n = new Date(); S.mes = n.getMonth() + 1; S.ano = n.getFullYear(); render(); break; }
      case 'editLanc': {
        const l = S.data.lancamentos.find((x) => x.id === id); if (!l) break;
        S.editId = id; S.formError = '';
        S.form = { data: l.data, tipo: l.entrada > 0 ? 'entrada' : 'saida', forma: l.forma || 'Dinheiro', valor: centsToInput(l.entrada > 0 ? l.entrada : l.saida) };
        S.focus = '#fValor'; render(); window.scrollTo(0, 0); $('#main').scrollTop = 0; break;
      }
      case 'cancelEdit': S.editId = null; S.formError = ''; S.form.valor = ''; render(); break;
      case 'delLanc': {
        const l = S.data.lancamentos.find((x) => x.id === id); if (!l) break;
        const desc = `${C.fmtDate(l.data)} — ${l.entrada ? 'Entrada ' + C.fmtBRL(l.entrada) : 'Saída ' + C.fmtBRL(l.saida)}`;
        const r = await modal({ title: 'Excluir lançamento?', message: desc, okText: 'Excluir', danger: true });
        if (!r.ok) break;
        const res = await call('deleteLanc', { id });
        if (!res.ok) { toast(res.error, { erro: true }); break; }
        if (S.editId === id) S.editId = null;
        render(); toast('Lançamento excluído.'); break;
      }
      case 'renameEstab': {
        const e = C.findEstab(S.data, id); if (!e) break;
        const r = await modal({ title: 'Renomear estabelecimento', input: e.nome, okText: 'Salvar' });
        if (!r.ok) break;
        const res = await call('renameEstab', { id, nome: r.value });
        if (!res.ok) { toast(res.error, { erro: true }); break; }
        render(); toast('Nome alterado.'); break;
      }
      case 'removeEstab': {
        const e = C.findEstab(S.data, id); if (!e) break;
        const n = S.data.lancamentos.filter((l) => l.estabId === id).length;
        const r = await modal({
          title: `Remover "${e.nome}"?`, danger: true, okText: 'Remover',
          message: n ? `Isso apaga também os ${n} lançamento(s) deste estabelecimento. Não dá para desfazer.\n\nSe tiver dúvida, faça antes uma cópia de segurança.` : 'Esse estabelecimento não tem lançamentos.',
        });
        if (!r.ok) break;
        const res = await call('removeEstab', { id });
        if (!res.ok) { toast(res.error, { erro: true }); break; }
        if (S.view.estabId === id) S.view = { name: 'gerenciar', estabId: null };
        render(); toast('Estabelecimento removido.'); break;
      }
      case 'seedPadrao': {
        const res = await call('addEstabs', { nomes: PADRAO });
        if (!res.ok) { toast(res.error, { erro: true }); break; }
        render(); toast('Estabelecimentos criados.'); break;
      }
      case 'exportExcel': case 'exportPdf': {
        const res = await (action === 'exportExcel' ? api.exportExcel : api.exportPdf)({ mes: S.mes, ano: S.ano });
        if (res.canceled) break;
        if (!res.ok) { toast(res.error, { erro: true }); break; }
        toast('Arquivo salvo.', { action: { label: 'Mostrar na pasta', fn: () => api.showInFolder(res.path) } }); break;
      }
      case 'backupSave': {
        const res = await api.backupSave(); if (res.canceled) break;
        if (!res.ok) { toast(res.error, { erro: true }); break; }
        toast('Cópia de segurança salva.', { action: { label: 'Mostrar na pasta', fn: () => api.showInFolder(res.path) } }); break;
      }
      case 'backupRestore': {
        const res = await api.backupRestore(); if (res.canceled) break;
        if (!res.ok) { toast(res.error, { erro: true }); break; }
        S.data = res.data; S.view = { name: 'resumo', estabId: null }; S.editId = null;
        irParaUltimoLancamentoSeVazio(); render(); toast('Cópia restaurada.'); break;
      }
      case 'importXlsx': {
        const res = await api.importXlsx(); if (res.canceled) break;
        if (!res.ok) { await modal({ title: 'Importação', message: res.error, okText: 'OK', cancelText: '' }); break; }
        S.data = res.data; irParaUltimoLancamentoSeVazio(); render();
        const r = res.resumo;
        const extras = r.ignoradas.length ? `\n\nLinhas ignoradas (${r.ignoradas.length}):\n${r.ignoradas.slice(0, 6).join('\n')}${r.ignoradas.length > 6 ? '\n…' : ''}` : '';
        await modal({
          title: 'Importação concluída', okText: 'OK', cancelText: '',
          message: `${r.estabNovos} estabelecimento(s) novo(s)\n${r.lancNovos} lançamento(s) importado(s)\n${r.jaExistiam} já estavam cadastrados e foram pulados${extras}`,
        });
        break;
      }
      case 'update': {
        if (S.upd && S.upd.estado === 'pronta') {
          const ok = await modal({ title: 'Atualizar o sistema', message: 'A versão ' + S.upd.versao + ' está pronta. O programa vai fechar e abrir de novo sozinho. Seus dados não são alterados.', okText: 'Reiniciar e atualizar', cancelText: 'Agora não' });
          if (ok) await api.updateInstall();
        } else { pintarUpdate(await api.updateCheck()); }
        break;
      }
      case 'updInstall': { const r = await api.updateInstall(); if (!r.ok) toast(r.error || 'Não foi possível atualizar agora.', { erro: true }); break; }
      case 'updDepois': if (S.upd) S.updFechado = (S.upd.versao + '|' + S.upd.estado); renderCartaoUpdate(S.upd || {}); break;
      case 'toggleSidebar': setSidebar(!document.getElementById('sidebar').classList.contains('recolhido'), true); break;
      case 'tour': if (window.CFTour) window.CFTour.start(); break;
      case 'logout': if (window.CFTour) window.CFTour.fechar(); await api.logout(); S.data = null; mostrarLogin(); break;
      case 'openData': api.openDataFolder(); break;
      default: break;
    }
  }

  // ---------- atualização automática ----------
  const ICO = {
    ok: SVG('<circle cx="12" cy="12" r="9.5"/><path d="M7.8 12.4l3 3 5.4-6"/>'),
    espera: SVG('<path d="M20 12a8 8 0 1 1-2.6-5.9"/><path d="M20 4v5h-5"/>'),
    aviso: SVG('<circle cx="12" cy="12" r="9.5"/><path d="M12 7v7M8.8 11.5l3.2 3.2 3.2-3.2"/>'),
    pronta: SVG('<circle cx="12" cy="12" r="9.5"/><path d="M12 17V8M8.6 11.2L12 7.8l3.4 3.4"/>'),
    erro: SVG('<circle cx="12" cy="12" r="9.5"/><path d="M12 7.5v5.5M12 16.2v.1"/>'),
    dev: SVG('<circle cx="12" cy="12" r="9.5"/><path d="M8 12h8"/>'),
  };
  function textoUpdate(u) {
    switch (u.estado) {
      case 'dev': return ['dev', 'Modo de teste'];
      case 'verificando': return ['espera', 'Verificando…'];
      case 'baixando': return ['aviso', 'Baixando ' + (u.pct || 0) + '%'];
      case 'pronta': return ['pronta', 'Nova versão ' + (u.versao || '') + ' pronta'];
      case 'erro': return ['erro', 'Sem conexão'];
      default: return ['ok', 'Atualizado'];
    }
  }
  function renderCartaoUpdate(u) {
    const c = document.getElementById('updCard'); if (!c) return;
    const app = document.getElementById('app');
    const aberto = (u.estado === 'baixando' || u.estado === 'pronta') && app && !app.hidden && S.updFechado !== (u.versao + '|' + u.estado);
    if (!aberto) { c.hidden = true; return; }
    const pronta = u.estado === 'pronta';
    const antes = c.hidden;
    c.innerHTML = '<div class="upd-t">Nova versão ' + esc(u.versao || '') + (pronta ? ' pronta' : ' encontrada') + '</div>' +
      (pronta
        ? '<p>O programa fecha e abre de novo sozinho. Seus dados não são alterados.</p><div class="upd-b"><button class="btn small" data-action="updInstall">Atualizar agora</button><button class="btn light small" data-action="updDepois">Depois</button></div>'
        : '<p>Baixando em segundo plano. Você pode continuar usando o sistema.</p><div class="upd-bar"><i style="width:' + (u.pct || 0) + '%"></i></div><div class="upd-b"><button class="btn light small" data-action="updDepois">Ocultar</button></div>');
    c.hidden = false;
    if (antes && pronta) { const b = c.querySelector('[data-action=updInstall]'); if (b) b.focus({ preventScroll: true }); }
  }
  function pintarUpdate(u) {
    if (!u) return;
    S.upd = u;
    const ic = document.getElementById('sbIc'); const tx = document.getElementById('sbUpdTx'); const bt = document.getElementById('sbUpd'); const ver = document.getElementById('sbVersao');
    if (!ic || !tx) return;
    const [cls, texto] = textoUpdate(u);
    ic.className = 'ver-ic ' + cls; ic.innerHTML = ICO[cls];
    tx.textContent = texto;
    if (ver && (u.atual || (S.info && S.info.version))) ver.textContent = u.atual || S.info.version;
    bt.title = u.estado === 'pronta' ? 'Instalar a atualização' : 'Verificar atualizações';
    renderCartaoUpdate(u);
  }

  // ---------- barra lateral (abre e fecha só com clique no botão) ----------
  function setSidebar(recolher, guardar) {
    const sb = document.getElementById('sidebar'); if (!sb) return;
    sb.classList.toggle('recolhido', recolher);
    const b = document.getElementById('sbToggle');
    b.setAttribute('aria-expanded', String(!recolher));
    const t = recolher ? 'Expandir o menu' : 'Recolher o menu';
    b.setAttribute('aria-label', t); b.title = t;
    if (guardar) { try { localStorage.setItem('cf_sb_recolhido', recolher ? '1' : '0'); } catch (_) { /* ok */ } }
  }

  // ---------- eventos ----------
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('#toastBtn');
    if (btn && toastAction) { toastAction(); return; }
    const el = e.target.closest('[data-action]');
    if (!el) return;
    handleAction(el.dataset.action, el).catch((err) => toast('Algo deu errado: ' + err.message, { erro: true }));
  });
  document.addEventListener('change', (e) => {
    if (e.target.id === 'selMes') { S.mes = Number(e.target.value); render(); }
    else if (e.target.id === 'selAno') { S.ano = Number(e.target.value); render(); }
    else if (e.target.id === 'selEstab') { S.view = { name: 'estab', estabId: e.target.value }; S.editId = null; S.formError = ''; S.form.valor = ''; render(); }
  });
  document.addEventListener('input', (e) => {
    if (e.target.id === 'fBusca') { S.busca = e.target.value; const l = $('#estabLista'); if (l) l.innerHTML = estabRows(S.busca); }
  });
  document.addEventListener('submit', (e) => {
    e.preventDefault();
    if (e.target.id === 'formLanc') {
      saveLanc().catch((err) => toast('Algo deu errado: ' + err.message, { erro: true }));
    } else if (e.target.id === 'formEstab') {
      const nome = e.target.elements['nome'].value;
      call('addEstab', { nome }).then((res) => {
        if (!res.ok) { S.estabError = res.error; S.focus = '#fEstab'; render(); return; }
        S.estabError = ''; S.focus = '#fEstab'; render(); toast(`"${res.result.nome}" criado.`);
      });
    }
  });

  if (api.onUpdate) api.onUpdate(pintarUpdate);

  // ---------- início ----------
  async function iniciar() {
    const st = await api.getState();
    if (!st || st.auth) { mostrarLogin(); return; }
    S.data = st.data; S.info = st;
    api.updateStatus().then(pintarUpdate).catch(() => {});
    S.view = { name: 'resumo', estabId: null }; S.editId = null;
    irParaUltimoLancamentoSeVazio();
    document.getElementById('login').hidden = true;
    document.getElementById('app').hidden = false;
    render();
    if (st.recovered) modal({ title: 'Aviso', message: st.recovered, okText: 'OK', cancelText: '' });
    if (window.CFTour) window.CFTour.maybeStart();
  }

  function mostrarLogin() {
    document.getElementById('app').hidden = true;
    document.getElementById('login').hidden = false;
    document.getElementById('modalRoot').innerHTML = '';
    const uc = document.getElementById('updCard'); if (uc) uc.hidden = true;
    document.getElementById('formLogin').reset();
    document.getElementById('lErro').textContent = '';
    document.getElementById('lAjuda').hidden = true;
    mostrarSenha(false);
    document.getElementById('lUser').focus();
    api.lembrado().then((l) => {
      if (!l) return;
      document.getElementById('lUser').value = l.usuario;
      document.getElementById('lPass').value = l.senha;
      document.getElementById('lLembrar').checked = true;
      document.getElementById('lBtn').focus();
    }).catch(() => { /* sem acesso guardado */ });
  }

  function mostrarSenha(ver) {
    document.getElementById('lPass').type = ver ? 'text' : 'password';
    const b = document.getElementById('lShow');
    b.classList.toggle('on', ver);
    b.setAttribute('aria-label', ver ? 'Ocultar senha' : 'Mostrar senha');
    b.title = ver ? 'Ocultar senha' : 'Mostrar senha';
  }
  document.getElementById('lShow').addEventListener('click', () => mostrarSenha(document.getElementById('lPass').type === 'password'));
  document.getElementById('lHelp').addEventListener('click', () => {
    const p = document.getElementById('lAjuda'); p.hidden = !p.hidden;
  });
  document.getElementById('formLogin').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target;
    const btn = document.getElementById('lBtn');
    const erro = document.getElementById('lErro');
    btn.disabled = true; erro.textContent = '';
    try {
      const res = await api.login(f.elements.usuario.value, f.elements.senha.value, document.getElementById('lLembrar').checked);
      if (res.ok) { await iniciar(); }
      else { erro.textContent = res.error; f.elements.senha.value = ''; f.elements.senha.focus(); }
    } catch (err) { erro.textContent = 'Algo deu errado: ' + err.message; }
    btn.disabled = false;
  });

  async function init() {
    try { setSidebar(localStorage.getItem('cf_sb_recolhido') === '1', false); } catch (_) { /* ok */ }
    const { logado } = await api.authStatus();
    if (logado) await iniciar(); else mostrarLogin();
  }
  window.__cf = { S, render, handleAction, setSidebar }; // usado nos testes de tela
  init();
})();
