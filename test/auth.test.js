const test = require('node:test');
const assert = require('node:assert');
const { Auth, normUser, MAX_TENTATIVAS, BLOQUEIO_MS } = require('../src/auth.js');

test('entra com usuário e senha corretos', () => {
  const a = new Auth();
  assert.deepStrictEqual(a.login('acai.giselle', 'senho123456'), { ok: true });
  assert.strictEqual(a.logado, true);
});

test('ignora maiúsculas, acento e espaços no usuário', () => {
  assert.strictEqual(normUser('  Açai.Giselle '), 'acai.giselle');
  assert.strictEqual(new Auth().login('Açai.Giselle', 'senho123456').ok, true);
});

test('a senha diferencia maiúsculas de minúsculas', () => {
  const a = new Auth();
  assert.strictEqual(a.login('acai.giselle', 'Senho123456').ok, false);
  assert.strictEqual(a.logado, false);
});

test('rejeita usuário ou senha errados, com a mesma mensagem', () => {
  const a = new Auth();
  const r1 = a.login('outro', 'senho123456');
  const r2 = a.login('acai.giselle', 'errada');
  assert.strictEqual(r1.error, 'Usuário ou senha incorretos.');
  assert.strictEqual(r2.error, 'Usuário ou senha incorretos.');
  assert.strictEqual(a.login('', '').ok, false);
});

test('bloqueia após várias tentativas e libera depois do prazo', () => {
  let t = 1000;
  const a = new Auth(() => t);
  for (let i = 0; i < MAX_TENTATIVAS; i++) a.login('acai.giselle', 'x');
  const r = a.login('acai.giselle', 'senho123456'); // certa, mas bloqueado
  assert.strictEqual(r.ok, false);
  assert.match(r.error, /Aguarde/);
  t += BLOQUEIO_MS + 1;
  assert.strictEqual(a.login('acai.giselle', 'senho123456').ok, true);
});

test('logout encerra a sessão', () => {
  const a = new Auth();
  a.login('acai.giselle', 'senho123456');
  a.logout();
  assert.strictEqual(a.logado, false);
});

test('a senha não aparece em texto no código', () => {
  const src = require('fs').readFileSync(require('path').join(__dirname, '../src/auth.js'), 'utf8');
  assert.ok(!src.includes('senho123456'));
});

test('o usuário antigo (acai.gisele) continua valendo até ela trocar o acesso', () => {
  assert.strictEqual(new Auth().login('acai.gisele', 'senho123456').ok, true);
});

const fs = require('fs'), os = require('os'), path = require('path');
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'cf-auth-'));

test('alterar usuário e senha: guarda só o hash e passa a valer no login', () => {
  const dir = tmp();
  const a = new Auth(undefined, dir);
  a.login('acai.giselle', 'senho123456');
  const r = a.alterar('senho123456', 'Gi.Nova', 'outraSenha9');
  assert.strictEqual(r.ok, true);
  assert.ok(!fs.readFileSync(path.join(dir, 'credenciais.json'), 'utf8').includes('outraSenha9'));
  const b = new Auth(undefined, dir);   // "reabre o programa"
  assert.strictEqual(b.login('acai.giselle', 'senho123456').ok, false);
  assert.strictEqual(b.login('acai.gisele', 'outraSenha9').ok, false);
  assert.strictEqual(b.login('gi.nova', 'outraSenha9').ok, true);
});

test('alterar só o usuário mantém a senha', () => {
  const a = new Auth(undefined, tmp());
  a.login('acai.giselle', 'senho123456');
  assert.strictEqual(a.alterar('senho123456', 'giselle', '').ok, true);
  assert.strictEqual(new Auth(undefined, a.file ? path.dirname(a.file) : null).login('giselle', 'senho123456').ok, true);
});

test('alterar exige login, senha atual certa e valores válidos', () => {
  const a = new Auth(undefined, tmp());
  assert.strictEqual(a.alterar('senho123456', 'x.y.z', 'abcdef').ok, false);          // sem login
  a.login('acai.giselle', 'senho123456');
  assert.match(a.alterar('errada', 'novo.user', '').error, /senha atual/);
  assert.match(a.alterar('senho123456', 'ab', '').error, /usuário/);
  assert.match(a.alterar('senho123456', 'com espaço', '').error, /espaços/);
  assert.match(a.alterar('senho123456', '', '123').error, /senha nova/);
  assert.match(a.alterar('senho123456', '', '').error, /Nada foi alterado/);
});
