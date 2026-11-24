const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs'); const os = require('os'); const path = require('path');
const ExcelJS = require('exceljs');
const C = require('../src/renderer/core.js');
const { parseWorkbook, mergeInto } = require('../src/importer.js');
const { exportarExcel, relatorioHTML } = require('../src/exporter.js');
const { Store } = require('../src/store.js');

const XLSX = process.env.XLSX_TEST || '/mnt/user-data/outputs/Controle Financeiro - Por Estabelecimento.xlsx';
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'cf-'));

test('importa a planilha do cliente sem duplicar', { skip: !fs.existsSync(XLSX) }, async () => {
  const wb = new ExcelJS.Workbook(); await wb.xlsx.readFile(XLSX);
  const parsed = parseWorkbook(wb);
  const d = C.emptyData();
  const r1 = mergeInto(d, parsed);
  assert.ok(r1.lancNovos > 0, 'importou lançamentos');
  assert.ok(d.estabelecimentos.some((e) => e.nome === 'Invictus'));
  assert.ok(!d.estabelecimentos.some((e) => /^Novo Estabelecimento/.test(e.nome)));
  assert.ok(!d.estabelecimentos.some((e) => /Resumo/.test(e.nome)));
  const n = d.lancamentos.length;
  const r2 = mergeInto(d, parseWorkbook(wb));
  assert.strictEqual(r2.lancNovos, 0);
  assert.strictEqual(d.lancamentos.length, n);
  assert.strictEqual(C.validateData(d) === true || C.validateData(d) == null || !C.validateData(d).error, true);
});

test('exporta Excel e o PDF-html', async () => {
  const d = C.emptyData();
  const a = C.addEstab(d, 'Projeto'); C.addEstab(d, 'Loja/Centro:1');
  C.addLanc(d, { estabId: a.id, data: '2026-10-01', tipo: 'entrada', valor: '1.200,50', forma: 'Pix' });
  C.addLanc(d, { estabId: a.id, data: '2026-10-05', tipo: 'saida', valor: '200', forma: 'Dinheiro' });
  const f = path.join(tmp(), 'x.xlsx');
  await exportarExcel(d, 10, 2026, f);
  const wb = new ExcelJS.Workbook(); await wb.xlsx.readFile(f);
  const nomes = wb.worksheets.map((w) => w.name);
  assert.strictEqual(nomes[0], 'Resumo Mensal');
  assert.ok(nomes.includes('Projeto'));
  assert.strictEqual(nomes.length, 3);
  const html = relatorioHTML(d, 10, 2026, new Date());
  assert.ok(html.includes('Projeto') && html.includes('1.200,50'));
  // reimporta o que foi exportado
  const d2 = C.emptyData(); mergeInto(d2, parseWorkbook(wb));
  assert.strictEqual(d2.lancamentos.length, 2);
});

test('store: salvar, recarregar, backup e recuperação', () => {
  const dir = tmp();
  const s = new Store(dir); s.load();
  C.addEstab(s.data, 'A'); s.save();
  const s2 = new Store(dir); s2.load();
  assert.strictEqual(s2.data.estabelecimentos.length, 1);
  s2.dailyBackup(new Date()); assert.ok(s2.listBackups().length >= 1);
  fs.writeFileSync(path.join(dir, fs.readdirSync(dir).find((f) => f.endsWith('.json'))), '{corrompido');
  const s3 = new Store(dir); s3.load();
  assert.strictEqual(s3.data.estabelecimentos.length, 1, 'recuperou do backup');
  assert.ok(s3.recovered);
});
