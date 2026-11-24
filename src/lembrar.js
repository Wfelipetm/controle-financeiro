// "Lembrar meu acesso": guarda usuário e senha neste computador, criptografados.
// Usa o safeStorage do Electron (no Windows, a criptografia fica presa à conta do usuário do Windows).
// Se a criptografia não estiver disponível, nada é gravado.
const fs = require('fs');
const path = require('path');

class Lembrar {
  constructor(dir, safeStorage) {
    this.file = path.join(dir, 'acesso.bin');
    this.ss = safeStorage;
  }

  disponivel() {
    try { return !!(this.ss && this.ss.isEncryptionAvailable()); } catch (_) { return false; }
  }

  salvar(usuario, senha) {
    if (!this.disponivel()) return false;
    try {
      const bruto = this.ss.encryptString(JSON.stringify({ u: String(usuario), s: String(senha) }));
      fs.writeFileSync(this.file, bruto);
      return true;
    } catch (_) { return false; }
  }

  carregar() {
    if (!this.disponivel()) return null;
    try {
      const o = JSON.parse(this.ss.decryptString(fs.readFileSync(this.file)));
      return o && typeof o.u === 'string' && typeof o.s === 'string' ? { usuario: o.u, senha: o.s } : null;
    } catch (_) { return null; }
  }

  apagar() {
    try { fs.unlinkSync(this.file); } catch (_) { /* já não existia */ }
  }
}

module.exports = { Lembrar };
