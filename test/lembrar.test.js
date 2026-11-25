const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs'); const os = require('os'); const path = require('path');
const { Lembrar } = require('../src/lembrar.js');

// "criptografia" de mentira, só para o teste (inverte os bytes)
const falso = (disp = true) => ({
  isEncryptionAvailable: () => disp,
  encryptString: (s) => Buffer.from(s, 'utf8').reverse(),
  decryptString: (b) => Buffer.from(b).reverse().toString('utf8'),
});
const pasta = () => fs.mkdtempSync(path.join(os.tmpdir(), 'cf-lembrar-'));

test('salva e carrega o acesso, sem deixar a senha em texto no arquivo', () => {
  const d = pasta(); const l = new Lembrar(d, falso());
  assert.strictEqual(l.salvar('acai.giselle', 'senho123456'), true);
  assert.deepStrictEqual(l.carregar(), { usuario: 'acai.giselle', senha: 'senho123456' });
  assert.ok(!fs.readFileSync(path.join(d, 'acesso.bin'), 'utf8').includes('senho123456'));
});

test('apagar remove o acesso guardado', () => {
  const l = new Lembrar(pasta(), falso());
  l.salvar('a', 'b'); l.apagar();
  assert.strictEqual(l.carregar(), null);
  l.apagar(); // apagar de novo não dá erro
});

test('sem criptografia disponível não grava nada', () => {
  const d = pasta(); const l = new Lembrar(d, falso(false));
  assert.strictEqual(l.salvar('a', 'b'), false);
  assert.strictEqual(fs.existsSync(path.join(d, 'acesso.bin')), false);
  assert.strictEqual(l.carregar(), null);
});

test('arquivo corrompido vira "nada guardado"', () => {
  const d = pasta(); const l = new Lembrar(d, falso());
  fs.writeFileSync(path.join(d, 'acesso.bin'), 'lixo');
  assert.strictEqual(l.carregar(), null);
});
