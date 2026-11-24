const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs'); const os = require('os'); const path = require('path');
const { BackupExterno, SUBPASTA, KEEP, VELHO_HORAS } = require('../src/backupExterno.js');

const tmp = (p) => fs.mkdtempSync(path.join(os.tmpdir(), p));
function cenario() {
  const dados = tmp('cf-bk-dados-'); const nuvem = tmp('cf-bk-nuvem-');
  const store = { file: path.join(dados, 'dados.json') };
  fs.writeFileSync(store.file, '{"version":1}');
  return { dados, nuvem, store, bk: new BackupExterno(dados, store) };
}

test('começa desligado e sem aviso', () => {
  const { bk } = cenario();
  assert.deepStrictEqual(bk.status(), { pasta: null, ultimo: null, erro: null, aviso: null, ligado: false });
});

test('escolher a pasta já faz o primeiro backup', () => {
  const { bk, nuvem } = cenario();
  const r = bk.definirPasta(nuvem);
  assert.strictEqual(r.ok, true);
  assert.ok(fs.existsSync(r.arquivo));
  assert.strictEqual(fs.readFileSync(r.arquivo, 'utf8'), '{"version":1}');
  assert.ok(r.arquivo.includes(SUBPASTA));
  const s = bk.status();
  assert.strictEqual(s.ligado, true); assert.strictEqual(s.aviso, null);
});

test('guarda a escolha entre execuções do programa', () => {
  const { bk, dados, store, nuvem } = cenario();
  bk.definirPasta(nuvem);
  assert.strictEqual(new BackupExterno(dados, store).status().pasta, nuvem);
});

test('pasta que não dá para gravar é recusada e não liga o backup', () => {
  const { bk, nuvem } = cenario();
  const arquivoComum = path.join(nuvem, 'arquivo.txt'); fs.writeFileSync(arquivoComum, 'x');
  const r = bk.definirPasta(arquivoComum); // é um arquivo, não uma pasta
  assert.strictEqual(r.ok, false); assert.ok(r.error.length > 10);
  assert.strictEqual(bk.status().ligado, false);
});

test('o backup do dia é atualizado e mantém só os últimos 30', () => {
  const { bk, nuvem, store } = cenario();
  bk.definirPasta(nuvem);
  const dest = path.join(nuvem, SUBPASTA);
  for (let i = 1; i <= 40; i++) fs.writeFileSync(path.join(dest, `dados-2026-01-${String(i).padStart(2, '0')}.json`.replace('2026-01-3', '2026-02-0').replace('2026-01-4', '2026-02-1')), 'velho');
  fs.writeFileSync(store.file, '{"version":2}');
  const r = bk.executar(new Date(2026, 10, 24, 12, 0));
  assert.strictEqual(fs.readFileSync(path.join(dest, 'dados-2026-11-24.json'), 'utf8'), '{"version":2}');
  assert.strictEqual(fs.readdirSync(dest).filter((n) => /^dados-/.test(n)).length, KEEP);
  assert.ok(r.ok);
});

test('pasta que sumiu vira aviso de erro; voltando, o aviso some', () => {
  const { bk, nuvem } = cenario();
  bk.definirPasta(nuvem);
  fs.rmSync(path.join(nuvem, SUBPASTA), { recursive: true, force: true });
  fs.rmSync(nuvem, { recursive: true, force: true });
  const falha = bk.executar();
  assert.strictEqual(falha.ok, true); // recria a pasta de destino se o disco ainda existe
  // simula erro real: o "disco" some e não dá para recriar (pasta pai é um arquivo)
  const arq = path.join(os.tmpdir(), 'cf-bk-arquivo-' + Date.now()); fs.writeFileSync(arq, 'x');
  bk.cfg.pasta = path.join(arq, 'dentro');
  const r = bk.executar();
  assert.strictEqual(r.ok, false);
  assert.strictEqual(bk.status().aviso, 'erro');
  fs.rmSync(arq);
  bk.cfg.pasta = nuvem;
  assert.strictEqual(bk.executar().ok, true);
  assert.strictEqual(bk.status().aviso, null);
});

test('backup antigo vira aviso', () => {
  const { bk, nuvem } = cenario();
  bk.definirPasta(nuvem);
  const tresDias = Date.now() + (VELHO_HORAS + 1) * 3600 * 1000;
  assert.strictEqual(bk.status(tresDias).aviso, 'antigo');
});

test('remover desliga e não deixa cópia agendada', async () => {
  const { bk, nuvem } = cenario();
  bk.definirPasta(nuvem); bk.agendar(20); bk.remover();
  await new Promise((r) => setTimeout(r, 80));
  assert.strictEqual(bk.status().ligado, false);
});

test('agendar junta várias alterações em uma cópia e finalizar copia na hora', async () => {
  const { bk, nuvem, store } = cenario();
  bk.definirPasta(nuvem);
  const dest = path.join(nuvem, SUBPASTA);
  fs.writeFileSync(store.file, '{"version":3}');
  bk.agendar(5000); bk.agendar(5000);
  bk.finalizar(); // ao fechar o programa
  const arq = fs.readdirSync(dest).find((n) => /^dados-/.test(n));
  assert.strictEqual(fs.readFileSync(path.join(dest, arq), 'utf8'), '{"version":3}');
});
