const test = require('node:test');
const assert = require('node:assert');
const C = require('../src/renderer/core.js');

test('parseMoney pt-BR', () => {
  assert.strictEqual(C.parseMoney('1.200,50'), 120050);
  assert.strictEqual(C.parseMoney('R$ 1.200,50'), 120050);
  assert.strictEqual(C.parseMoney('1200.50'), 120050);
  assert.strictEqual(C.parseMoney('35'), 3500);
  assert.strictEqual(C.parseMoney('0,5'), 50);
});
test('fmtBRL', () => {
  assert.strictEqual(C.fmtBRL(120000).replace(/ /g, ' '), 'R$ 1.200,00');
  assert.strictEqual(C.fmtBRL(-35000).replace(/ /g, ' '), '-R$ 350,00');
});
test('estabelecimentos: unicidade e renomear', () => {
  const d = C.emptyData();
  const a = C.addEstab(d, 'Projeto');
  assert.throws(() => C.addEstab(d, ' projeto '));
  assert.throws(() => C.addEstab(d, ''));
  C.addEstab(d, 'Loja');
  assert.throws(() => C.renameEstab(d, a.id, 'LOJA'));
  C.renameEstab(d, a.id, 'Wallace');
  assert.strictEqual(C.findEstab(d, a.id).nome, 'Wallace');
});
test('lançamentos e filtro mensal', () => {
  const d = C.emptyData();
  const e = C.addEstab(d, 'Invictus');
  const f = C.addEstab(d, 'Loja');
  C.addLanc(d, { estabId: e.id, data: '2026-10-01', tipo: 'entrada', valor: '1.000,00', forma: 'pix' });
  C.addLanc(d, { estabId: e.id, data: '2026-10-15', tipo: 'saida', valor: '350,00', forma: 'Dinheiro' });
  C.addLanc(d, { estabId: e.id, data: '2026-09-30', tipo: 'entrada', valor: '99,90', forma: 'Pix' });
  C.addLanc(d, { estabId: f.id, data: '2026-10-02', tipo: 'entrada', valor: '10', forma: 'Pix' });
  const out = C.lancsDoPeriodo(d, e.id, 10, 2026);
  assert.strictEqual(out.length, 2);
  const t = C.totais(out); assert.deepStrictEqual([t.entrada, t.saida, t.saldo], [100000, 35000, 65000]);
  assert.strictEqual(C.lancsDoPeriodo(d, e.id, 9, 2026).length, 1);
  assert.strictEqual(C.lancsDoPeriodo(d, e.id, 0, 2026).length, 3);
  assert.strictEqual(C.lancsDoPeriodo(d, e.id, 10, 2025).length, 0);
  const g = C.resumoGeral(d, 10, 2026);
  assert.strictEqual(g.linhas.length, 2);
  assert.strictEqual(g.total.entrada, 101000);
  assert.strictEqual(g.total.saldo, 66000);
  assert.strictEqual(out[0].forma, 'Pix');
});
test('validações', () => {
  const d = C.emptyData(); const e = C.addEstab(d, 'A');
  const base = { estabId: e.id, data: '2026-10-01', tipo: 'entrada', valor: '10', forma: 'Pix' };
  assert.throws(() => C.addLanc(d, { ...base, valor: '0' }));
  assert.throws(() => C.addLanc(d, { ...base, valor: 'abc' }));
  assert.throws(() => C.addLanc(d, { ...base, data: '2026-02-31' }));
  assert.throws(() => C.addLanc(d, { ...base, tipo: 'x' }));
});
test('remover estabelecimento apaga lançamentos', () => {
  const d = C.emptyData(); const e = C.addEstab(d, 'A');
  C.addLanc(d, { estabId: e.id, data: '2026-10-01', tipo: 'saida', valor: '5', forma: 'Pix' });
  assert.deepStrictEqual(C.removeEstab(d, e.id), { removidos: 1 });
  assert.strictEqual(d.lancamentos.length, 0);
});
