/* Importa lançamentos de uma planilha .xlsx (a planilha por abas ou a antiga
 * com coluna "Estabelecimento"). Recebe um workbook do ExcelJS já aberto. */
const Core = require('./renderer/core.js');

function cellValue(v) {
  if (v == null) return null;
  if (v instanceof Date) return v;
  if (typeof v === 'object') {
    if ('result' in v) return cellValue(v.result);
    if (Array.isArray(v.richText)) return v.richText.map((t) => t.text).join('');
    if ('text' in v) return v.text;
    return null;
  }
  return v;
}

function toISODate(v) {
  if (v == null || v === '') return null;
  if (v instanceof Date) {
    if (isNaN(v)) return null;
    return `${v.getUTCFullYear()}-${String(v.getUTCMonth() + 1).padStart(2, '0')}-${String(v.getUTCDate()).padStart(2, '0')}`;
  }
  if (typeof v === 'number') { // número de série do Excel
    return toISODate(new Date(Math.round((v - 25569) * 86400 * 1000)));
  }
  const s = String(v).trim();
  let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    const iso = `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
    return Core.isValidDate(iso) ? iso : null;
  }
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) { const iso = `${m[1]}-${m[2]}-${m[3]}`; return Core.isValidDate(iso) ? iso : null; }
  return null;
}

function toCents(v) {
  if (v == null || v === '') return 0;
  const c = Core.parseMoney(v);
  return Number.isFinite(c) && c > 0 ? c : 0;
}

/** Lê todas as abas e devolve { grupos: [{ nome, linhas: [...] }], ignoradas: [...] } */
function parseWorkbook(wb) {
  const grupos = [];
  const ignoradas = [];
  wb.eachSheet((ws) => {
    if (Core.norm(ws.name) === 'resumo mensal') return;

    // acha a linha de cabeçalho nas primeiras 5 linhas
    let hdrRow = 0; let cols = null;
    for (let r = 1; r <= Math.min(5, ws.rowCount) && !cols; r++) {
      const map = {};
      ws.getRow(r).eachCell((cell, c) => {
        const t = Core.norm(cellValue(cell.value));
        if (t.startsWith('data')) map.data = c;
        else if (t.startsWith('estabelecimento')) map.estab = c;
        else if (t.startsWith('entrada')) map.entrada = c;
        else if (t.startsWith('saida')) map.saida = c;
        else if (t.startsWith('forma')) map.forma = c;
      });
      if (map.data && (map.entrada || map.saida)) { hdrRow = r; cols = map; }
    }
    if (!cols) return; // aba que não é de lançamentos

    const linhas = [];
    for (let r = hdrRow + 1; r <= ws.rowCount; r++) {
      const row = ws.getRow(r);
      const get = (c) => (c ? cellValue(row.getCell(c).value) : null);
      const rawData = get(cols.data);
      const entrada = toCents(get(cols.entrada));
      const saida = toCents(get(cols.saida));
      if ((rawData == null || rawData === '') && !entrada && !saida) continue; // linha vazia
      const data = toISODate(rawData);
      if (!data || (!entrada && !saida)) {
        ignoradas.push(`${ws.name}, linha ${r}: ${!data ? 'data inválida' : 'sem valor'}`);
        continue;
      }
      const estabTxt = cols.estab ? Core.cleanName(get(cols.estab)) : '';
      linhas.push({ estabNome: estabTxt || ws.name, data, entrada, saida, forma: Core.canonicalForma(get(cols.forma)) });
    }

    // abas reserva vazias ("Novo Estabelecimento 1") não viram estabelecimento
    if (!linhas.length && /^novo estabelecimento \d*$/i.test(ws.name.trim())) return;
    grupos.push({ nomeAba: ws.name, linhas });
  });
  return { grupos, ignoradas };
}

/** Junta ao banco de dados sem duplicar o que já existe. */
function mergeInto(data, parsed) {
  let estabNovos = 0; let lancNovos = 0; let jaExistiam = 0;

  const getEstab = (nome) => {
    const n = Core.cleanName(nome).slice(0, 40);
    let e = data.estabelecimentos.find((x) => Core.norm(x.nome) === Core.norm(n));
    if (!e) { e = Core.addEstab(data, n); estabNovos++; }
    return e;
  };
  const keyOf = (l) => `${l.estabId}|${l.data}|${l.entrada}|${l.saida}|${Core.norm(l.forma)}`;
  const existentes = new Map();
  for (const l of data.lancamentos) existentes.set(keyOf(l), (existentes.get(keyOf(l)) || 0) + 1);

  for (const g of parsed.grupos) {
    if (!g.linhas.length) getEstab(g.nomeAba);
    for (const li of g.linhas) {
      const e = getEstab(li.estabNome);
      const novo = { id: Core.newId(), estabId: e.id, data: li.data, entrada: li.entrada, saida: li.saida, forma: li.forma };
      const k = keyOf(novo);
      const n = existentes.get(k) || 0;
      if (n > 0) { existentes.set(k, n - 1); jaExistiam++; continue; } // já estava cadastrado
      data.lancamentos.push(novo);
      lancNovos++;
    }
  }
  return { estabNovos, lancNovos, jaExistiam, ignoradas: parsed.ignoradas };
}

module.exports = { parseWorkbook, mergeInto, toISODate };
