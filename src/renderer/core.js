/* Lógica pura do sistema (sem tela, sem disco): dinheiro em centavos, datas,
 * filtros por mês e resumos. Usada pela interface, pelo processo principal
 * (exportações) e pelos testes automáticos. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Core = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const FORMAS = ['Dinheiro', 'Pix', 'Cartão Débito', 'Cartão Crédito', 'Transferência', 'Boleto'];
  const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho',
    'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

  // ---------- dinheiro (sempre em centavos inteiros) ----------
  function parseMoney(input) {
    if (typeof input === 'number') return Number.isFinite(input) ? Math.round(input * 100) : NaN;
    let s = String(input == null ? '' : input).replace(/R\$/gi, '').replace(/\s/g, '');
    if (!s) return NaN;
    if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
    else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
    if (!/^\d+(\.\d+)?$/.test(s)) return NaN;
    return Math.round(parseFloat(s) * 100);
  }

  function fmtBRL(cents) {
    const neg = cents < 0;
    const abs = Math.abs(Math.round(cents || 0));
    const reais = Math.floor(abs / 100);
    const cent = String(abs % 100).padStart(2, '0');
    const int = String(reais).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return (neg ? '-' : '') + 'R$ ' + int + ',' + cent;
  }

  // ---------- datas (texto AAAA-MM-DD, sem fuso horário) ----------
  function isValidDate(s) {
    if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
    const [y, m, d] = s.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
  }
  function fmtDate(s) {
    if (!isValidDate(s)) return '';
    const [y, m, d] = s.split('-');
    return `${d}/${m}/${y}`;
  }
  function todayISO(now) {
    const d = now || new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  function monthOf(s) { return Number(s.slice(5, 7)); }
  function yearOf(s) { return Number(s.slice(0, 4)); }

  // ---------- nomes ----------
  function norm(s) {
    return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
  }
  function canonicalForma(f) {
    const t = String(f == null ? '' : f).trim();
    if (!t) return '';
    const hit = FORMAS.find((x) => norm(x) === norm(t));
    return hit || t;
  }
  function newId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  // ---------- dados ----------
  function emptyData() {
    return { version: 1, estabelecimentos: [], lancamentos: [] };
  }

  function findEstab(data, id) {
    return data.estabelecimentos.find((e) => e.id === id);
  }

  function cleanName(nome) {
    return String(nome == null ? '' : nome).replace(/\s+/g, ' ').trim();
  }

  function addEstab(data, nome) {
    const n = cleanName(nome);
    if (!n) throw new Error('Digite o nome do estabelecimento.');
    if (n.length > 40) throw new Error('O nome pode ter no máximo 40 letras.');
    if (data.estabelecimentos.some((e) => norm(e.nome) === norm(n))) {
      throw new Error('Já existe um estabelecimento com esse nome.');
    }
    const estab = { id: newId(), nome: n };
    data.estabelecimentos.push(estab);
    return estab;
  }

  function renameEstab(data, id, nome) {
    const e = findEstab(data, id);
    if (!e) throw new Error('Estabelecimento não encontrado.');
    const n = cleanName(nome);
    if (!n) throw new Error('Digite o nome do estabelecimento.');
    if (n.length > 40) throw new Error('O nome pode ter no máximo 40 letras.');
    if (data.estabelecimentos.some((x) => x.id !== id && norm(x.nome) === norm(n))) {
      throw new Error('Já existe um estabelecimento com esse nome.');
    }
    e.nome = n;
    return e;
  }

  function removeEstab(data, id) {
    const e = findEstab(data, id);
    if (!e) throw new Error('Estabelecimento não encontrado.');
    const removidos = data.lancamentos.filter((l) => l.estabId === id).length;
    data.estabelecimentos = data.estabelecimentos.filter((x) => x.id !== id);
    data.lancamentos = data.lancamentos.filter((l) => l.estabId !== id);
    return { removidos };
  }

  /** p = { estabId, data, tipo: 'entrada'|'saida', valor (texto ou centavos), forma } */
  function buildLanc(data, p, id) {
    if (!findEstab(data, p.estabId)) throw new Error('Estabelecimento não encontrado.');
    if (!isValidDate(p.data)) throw new Error('Informe uma data válida.');
    if (p.tipo !== 'entrada' && p.tipo !== 'saida') throw new Error('Escolha se é Entrada ou Saída.');
    const cents = typeof p.valor === 'number' && Number.isInteger(p.valor) && p.centavos ? p.valor : parseMoney(p.valor);
    if (!Number.isFinite(cents) || cents <= 0) throw new Error('Informe um valor maior que zero. Exemplo: 1.200,50');
    if (cents > 99999999999) throw new Error('Esse valor é grande demais.');
    return {
      id: id || newId(),
      estabId: p.estabId,
      data: p.data,
      entrada: p.tipo === 'entrada' ? cents : 0,
      saida: p.tipo === 'saida' ? cents : 0,
      forma: canonicalForma(p.forma),
    };
  }

  function addLanc(data, p) {
    const l = buildLanc(data, p);
    data.lancamentos.push(l);
    return l;
  }

  function updateLanc(data, id, p) {
    const i = data.lancamentos.findIndex((l) => l.id === id);
    if (i < 0) throw new Error('Lançamento não encontrado.');
    const l = buildLanc(data, p, id);
    data.lancamentos[i] = l;
    return l;
  }

  function deleteLanc(data, id) {
    const i = data.lancamentos.findIndex((l) => l.id === id);
    if (i < 0) throw new Error('Lançamento não encontrado.');
    data.lancamentos.splice(i, 1);
  }

  // ---------- filtros e resumos ----------
  /** mes = 1..12, ou 0 para o ano inteiro. */
  function inPeriod(l, mes, ano) {
    if (yearOf(l.data) !== Number(ano)) return false;
    return Number(mes) === 0 || monthOf(l.data) === Number(mes);
  }

  function lancsDoPeriodo(data, estabId, mes, ano) {
    return data.lancamentos
      .map((l, idx) => ({ l, idx }))
      .filter(({ l }) => l.estabId === estabId && inPeriod(l, mes, ano))
      .sort((a, b) => (a.l.data < b.l.data ? -1 : a.l.data > b.l.data ? 1 : a.idx - b.idx))
      .map(({ l }) => l);
  }

  function totais(lancs) {
    let entrada = 0; let saida = 0;
    for (const l of lancs) { entrada += l.entrada; saida += l.saida; }
    return { entrada, saida, saldo: entrada - saida, quantidade: lancs.length };
  }

  function resumoEstab(data, estabId, mes, ano) {
    return totais(lancsDoPeriodo(data, estabId, mes, ano));
  }

  function resumoGeral(data, mes, ano) {
    const linhas = data.estabelecimentos.map((e) => ({
      estabId: e.id, nome: e.nome, ...resumoEstab(data, e.id, mes, ano),
    }));
    const total = linhas.reduce((acc, r) => ({
      entrada: acc.entrada + r.entrada,
      saida: acc.saida + r.saida,
      saldo: acc.saldo + r.saldo,
      quantidade: acc.quantidade + r.quantidade,
    }), { entrada: 0, saida: 0, saldo: 0, quantidade: 0 });
    return { linhas, total };
  }

  function periodoLabel(mes, ano) {
    return Number(mes) === 0 ? `Ano de ${ano}` : `${MESES[Number(mes) - 1]} de ${ano}`;
  }

  /** Anos que têm lançamentos + o ano atual (para o seletor de ano). */
  function anosDisponiveis(data, now) {
    const set = new Set([(now || new Date()).getFullYear()]);
    for (const l of data.lancamentos) set.add(yearOf(l.data));
    return [...set].sort((a, b) => a - b);
  }

  /** Valida um objeto lido de arquivo (restauração de backup). */
  function validateData(obj) {
    if (!obj || typeof obj !== 'object') return false;
    if (!Array.isArray(obj.estabelecimentos) || !Array.isArray(obj.lancamentos)) return false;
    const ids = new Set();
    for (const e of obj.estabelecimentos) {
      if (!e || typeof e.id !== 'string' || typeof e.nome !== 'string') return false;
      ids.add(e.id);
    }
    for (const l of obj.lancamentos) {
      if (!l || !ids.has(l.estabId) || !isValidDate(l.data)) return false;
      if (!Number.isInteger(l.entrada) || !Number.isInteger(l.saida)) return false;
    }
    return true;
  }

  return {
    FORMAS, MESES, parseMoney, fmtBRL, isValidDate, fmtDate, todayISO, monthOf, yearOf, norm,
    canonicalForma, newId, emptyData, findEstab, cleanName, addEstab, renameEstab, removeEstab,
    addLanc, updateLanc, deleteLanc, inPeriod, lancsDoPeriodo, totais, resumoEstab, resumoGeral,
    periodoLabel, anosDisponiveis, validateData,
  };
});
