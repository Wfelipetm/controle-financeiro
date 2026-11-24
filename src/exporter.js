/* Exportação para Excel (.xlsx) e relatório em HTML (usado para gerar o PDF). */
const ExcelJS = require('exceljs');
const Core = require('./renderer/core.js');

const AZUL = 'FF5B21B6';
const AZUL_CLARO = 'FFEDE4FB';
const FONTE = 'Arial';

function nomeAbaSeguro(nome, usados) {
  let base = nome.replace(/[\\/?*[\]:]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 31) || 'Aba';
  let n = base; let i = 2;
  while (usados.has(Core.norm(n))) {
    const suf = ` (${i++})`;
    n = base.slice(0, 31 - suf.length) + suf;
  }
  usados.add(Core.norm(n));
  return n;
}

function estiloCabecalho(row) {
  row.eachCell((c) => {
    c.font = { name: FONTE, bold: true, color: { argb: 'FFFFFFFF' } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AZUL } };
    c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    c.border = { top: { style: 'thin', color: { argb: 'FFCCCCCC' } }, bottom: { style: 'thin', color: { argb: 'FFCCCCCC' } }, left: { style: 'thin', color: { argb: 'FFCCCCCC' } }, right: { style: 'thin', color: { argb: 'FFCCCCCC' } } };
  });
  row.height = 24;
}

const FMT_RS = '"R$" #,##0.00';
const reais = (c) => c / 100;

async function exportarExcel(data, mes, ano, caminho) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Controle Financeiro';
  wb.created = new Date();
  const usados = new Set();

  // --- Resumo do período ---
  const ws = wb.addWorksheet(nomeAbaSeguro('Resumo Mensal', usados), { views: [{ showGridLines: false }] });
  ws.columns = [{ width: 28 }, { width: 20 }, { width: 20 }, { width: 18 }];
  ws.mergeCells('A1:D1');
  ws.getCell('A1').value = 'Resumo por Estabelecimento';
  ws.getCell('A1').font = { name: FONTE, size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
  ws.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AZUL } };
  ws.getCell('A1').alignment = { vertical: 'middle', indent: 1 };
  ws.getRow(1).height = 30;
  ws.getCell('A2').value = `Período: ${Core.periodoLabel(mes, ano)}`;
  ws.getCell('A2').font = { name: FONTE, italic: true, color: { argb: 'FF757575' } };
  const h = ws.getRow(4);
  h.values = ['Estabelecimento', 'Total Entrada (R$)', 'Total Saída (R$)', 'Saldo (R$)'];
  estiloCabecalho(h);

  const { linhas, total } = Core.resumoGeral(data, mes, ano);
  let r = 5;
  for (const l of linhas) {
    const row = ws.getRow(r++);
    row.values = [l.nome, reais(l.entrada), reais(l.saida), null];
    row.getCell(4).value = { formula: `B${r - 1}-C${r - 1}`, result: reais(l.saldo) };
    row.eachCell((c, i) => { c.font = { name: FONTE }; if (i > 1) c.numFmt = FMT_RS; });
  }
  const t = ws.getRow(r);
  t.getCell(1).value = 'Total Geral';
  if (linhas.length) {
    t.getCell(2).value = { formula: `SUM(B5:B${r - 1})`, result: reais(total.entrada) };
    t.getCell(3).value = { formula: `SUM(C5:C${r - 1})`, result: reais(total.saida) };
  } else { t.getCell(2).value = 0; t.getCell(3).value = 0; }
  t.getCell(4).value = { formula: `B${r}-C${r}`, result: reais(total.saldo) };
  t.eachCell((c, i) => {
    c.font = { name: FONTE, bold: true };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AZUL_CLARO } };
    if (i > 1) c.numFmt = FMT_RS;
  });

  // --- Uma aba por estabelecimento, com todos os lançamentos ---
  for (const e of data.estabelecimentos) {
    const w = wb.addWorksheet(nomeAbaSeguro(e.nome, usados), { views: [{ state: 'frozen', ySplit: 1 }] });
    w.columns = [{ width: 14 }, { width: 16 }, { width: 16 }, { width: 20 }];
    const hh = w.getRow(1);
    hh.values = ['Data', 'Entrada (R$)', 'Saída (R$)', 'Forma de Pagamento'];
    estiloCabecalho(hh);
    const todos = data.lancamentos
      .map((l, idx) => ({ l, idx }))
      .filter(({ l }) => l.estabId === e.id)
      .sort((a, b) => (a.l.data < b.l.data ? -1 : a.l.data > b.l.data ? 1 : a.idx - b.idx))
      .map(({ l }) => l);
    let rr = 2;
    for (const l of todos) {
      const [y, m, d] = l.data.split('-').map(Number);
      const row = w.getRow(rr++);
      row.getCell(1).value = new Date(Date.UTC(y, m - 1, d));
      row.getCell(1).numFmt = 'dd/mm/yyyy';
      if (l.entrada) { row.getCell(2).value = reais(l.entrada); row.getCell(2).numFmt = FMT_RS; }
      if (l.saida) { row.getCell(3).value = reais(l.saida); row.getCell(3).numFmt = FMT_RS; }
      row.getCell(4).value = l.forma || '';
      row.eachCell((c) => { c.font = { name: FONTE }; });
    }
    w.autoFilter = { from: 'A1', to: `D${Math.max(rr - 1, 1)}` };
  }

  await wb.xlsx.writeFile(caminho);
}

// ---------- relatório (vira PDF) ----------
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function relatorioHTML(data, mes, ano, agora) {
  const { linhas, total } = Core.resumoGeral(data, mes, ano);
  const cls = (v) => (v < 0 ? 'neg' : '');
  const resumo = linhas.map((l) => `<tr><td>${esc(l.nome)}</td><td class="n">${Core.fmtBRL(l.entrada)}</td><td class="n">${Core.fmtBRL(l.saida)}</td><td class="n ${cls(l.saldo)}">${Core.fmtBRL(l.saldo)}</td></tr>`).join('');
  const detalhes = data.estabelecimentos.map((e) => {
    const ls = Core.lancsDoPeriodo(data, e.id, mes, ano);
    if (!ls.length) return '';
    const t = Core.totais(ls);
    const corpo = ls.map((l) => `<tr><td>${Core.fmtDate(l.data)}</td><td class="n">${l.entrada ? Core.fmtBRL(l.entrada) : ''}</td><td class="n">${l.saida ? Core.fmtBRL(l.saida) : ''}</td><td>${esc(l.forma)}</td></tr>`).join('');
    return `<section><h2>${esc(e.nome)}</h2><table><thead><tr><th>Data</th><th>Entrada</th><th>Saída</th><th>Forma de Pagamento</th></tr></thead><tbody>${corpo}</tbody><tfoot><tr><td>Total</td><td class="n">${Core.fmtBRL(t.entrada)}</td><td class="n">${Core.fmtBRL(t.saida)}</td><td class="n ${cls(t.saldo)}">Saldo ${Core.fmtBRL(t.saldo)}</td></tr></tfoot></table></section>`;
  }).join('');
  const gerado = (agora || new Date()).toLocaleString('pt-BR');
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><title>Relatório</title><style>
  @page { size: A4; margin: 14mm; }
  body { font-family: Arial, Helvetica, sans-serif; color: #222; font-size: 11pt; margin: 0; }
  .banner { background: #5B21B6; color: #fff; padding: 14px 18px; border-radius: 4px; }
  .banner h1 { margin: 0; font-size: 18pt; } .banner p { margin: 4px 0 0; font-size: 11pt; opacity: .9; }
  h2 { color: #5B21B6; font-size: 13pt; margin: 18px 0 6px; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  th { background: #5B21B6; color: #fff; padding: 7px 8px; text-align: left; font-size: 10pt; }
  td { padding: 6px 8px; border-bottom: 1px solid #ddd; }
  td.n, th.n { text-align: right; } tfoot td { font-weight: bold; background: #EDE4FB; border-bottom: none; }
  .neg { color: #C62828; } section { break-inside: avoid-page; }
  .foot { margin-top: 20px; font-size: 9pt; color: #777; }
  </style></head><body>
  <div class="banner"><h1>Resumo por Estabelecimento</h1><p>Período: ${esc(Core.periodoLabel(mes, ano))}</p></div>
  <table><thead><tr><th>Estabelecimento</th><th class="n">Total Entrada</th><th class="n">Total Saída</th><th class="n">Saldo</th></tr></thead>
  <tbody>${resumo || '<tr><td colspan="4">Nenhum estabelecimento cadastrado.</td></tr>'}</tbody>
  <tfoot><tr><td>Total Geral</td><td class="n">${Core.fmtBRL(total.entrada)}</td><td class="n">${Core.fmtBRL(total.saida)}</td><td class="n ${cls(total.saldo)}">${Core.fmtBRL(total.saldo)}</td></tr></tfoot></table>
  ${detalhes}
  <div class="foot">Gerado em ${esc(gerado)}</div></body></html>`;
}

module.exports = { exportarExcel, relatorioHTML, nomeAbaSeguro };
