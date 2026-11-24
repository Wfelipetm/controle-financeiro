const test = require('node:test');
const assert = require('node:assert');
const { Auth, normUser, MAX_TENTATIVAS, BLOQUEIO_MS } = require('../src/auth.js');

test('entra com usuário e senha corretos', () => {
  const a = new Auth();
  assert.deepStrictEqual(a.login('acai.gisele', 'senho123456'), { ok: true });
  assert.strictEqual(a.logado, true);
});

test('ignora maiúsculas, acento e espaços no usuário', () => {
  assert.strictEqual(normUser('  Açai.Gisele '), 'acai.gisele');
  assert.strictEqual(new Auth().login('Açai.Gisele', 'senho123456').ok, true);
});

test('a senha diferencia maiúsculas de minúsculas', () => {
  const a = new Auth();
  assert.strictEqual(a.login('acai.gisele', 'Senho123456').ok, false);
  assert.strictEqual(a.logado, false);
});

test('rejeita usuário ou senha errados, com a mesma mensagem', () => {
  const a = new Auth();
  const r1 = a.login('outro', 'senho123456');
  const r2 = a.login('acai.gisele', 'errada');
  assert.strictEqual(r1.error, 'Usuário ou senha incorretos.');
  assert.strictEqual(r2.error, 'Usuário ou senha incorretos.');
  assert.strictEqual(a.login('', '').ok, false);
});

test('bloqueia após várias tentativas e libera depois do prazo', () => {
  let t = 1000;
  const a = new Auth(() => t);
  for (let i = 0; i < MAX_TENTATIVAS; i++) a.login('acai.gisele', 'x');
  const r = a.login('acai.gisele', 'senho123456'); // certa, mas bloqueado
  assert.strictEqual(r.ok, false);
  assert.match(r.error, /Aguarde/);
  t += BLOQUEIO_MS + 1;
  assert.strictEqual(a.login('acai.gisele', 'senho123456').ok, true);
});

test('logout encerra a sessão', () => {
  const a = new Auth();
  a.login('acai.gisele', 'senho123456');
  a.logout();
  assert.strictEqual(a.logado, false);
});

test('a senha não aparece em texto no código', () => {
  const src = require('fs').readFileSync(require('path').join(__dirname, '../src/auth.js'), 'utf8');
  assert.ok(!src.includes('senho123456'));
});
