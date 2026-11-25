// Autenticação local do aplicativo (um único usuário).
// A senha não fica no código: só o hash (scrypt + sal).
// Ela pode trocar o usuário e a senha dentro do sistema; o novo acesso fica em credenciais.json (também só com hash).
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const USUARIO = 'acai.giselle';
const USUARIO_ANTIGO = 'acai.gisele';   // grafia usada nas versões 1.1.x; continua valendo enquanto o acesso não for trocado
const SAL = 'a10523c466677bc81be8cb9b15c17244';
const HASH = '1307cb2843914923e927a010425f9b2e9b2e043cca311e243b936e9e84025576';

const MAX_TENTATIVAS = 5;
const BLOQUEIO_MS = 30 * 1000;
const USER_MIN = 3, USER_MAX = 40, SENHA_MIN = 6, SENHA_MAX = 64;

// minúsculas, sem acento e sem espaços nas pontas ("Açai.Giselle" == "acai.giselle")
function normUser(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
}

function derivar(senha, salHex) {
  return crypto.scryptSync(String(senha || ''), Buffer.from(salHex, 'hex'), 32, { N: 16384, r: 8, p: 1 });
}

class Auth {
  constructor(agora = () => Date.now(), dir = null) {
    this.agora = agora;
    this.file = dir ? path.join(dir, 'credenciais.json') : null;
    this.logado = false;
    this.falhas = 0;
    this.bloqueadoAte = 0;
    this.cred = this._ler();
  }

  _ler() {
    const padrao = { usuario: USUARIO, sal: SAL, hash: HASH, aceita: [USUARIO, USUARIO_ANTIGO] };
    if (!this.file) return padrao;
    try {
      const o = JSON.parse(fs.readFileSync(this.file, 'utf8'));
      if (typeof o.usuario === 'string' && /^[0-9a-f]{32}$/.test(o.sal) && /^[0-9a-f]{64}$/.test(o.hash)) {
        return { usuario: o.usuario, sal: o.sal, hash: o.hash, aceita: [normUser(o.usuario)] };
      }
    } catch (_) { /* sem acesso próprio: vale o padrão */ }
    return padrao;
  }

  usuario() { return this.cred.usuario; }

  _senhaConfere(senha) {
    return crypto.timingSafeEqual(derivar(senha, this.cred.sal), Buffer.from(this.cred.hash, 'hex'));
  }

  _bloqueio(t) {
    if (t < this.bloqueadoAte) {
      const seg = Math.ceil((this.bloqueadoAte - t) / 1000);
      return { ok: false, error: `Muitas tentativas. Aguarde ${seg} segundos e tente de novo.` };
    }
    return null;
  }

  _falhou(t, msg) {
    this.falhas++;
    if (this.falhas >= MAX_TENTATIVAS) {
      this.falhas = 0; this.bloqueadoAte = t + BLOQUEIO_MS;
      return { ok: false, error: `Muitas tentativas. Aguarde ${BLOQUEIO_MS / 1000} segundos e tente de novo.` };
    }
    return { ok: false, error: msg };
  }

  login(usuario, senha) {
    const t = this.agora();
    const b = this._bloqueio(t); if (b) return b;
    // sempre calcula o hash, para o tempo de resposta não revelar se o usuário existe
    const senhaOk = this._senhaConfere(senha);
    const userOk = this.cred.aceita.includes(normUser(usuario));
    if (userOk && senhaOk) {
      this.logado = true; this.falhas = 0; this.bloqueadoAte = 0;
      return { ok: true };
    }
    this.logado = false;
    return this._falhou(t, 'Usuário ou senha incorretos.');
  }

  /** Troca usuário e/ou senha. Exige a senha atual. Em branco = mantém o que já existe. */
  alterar(senhaAtual, novoUsuario, novaSenha) {
    if (!this.logado) return { ok: false, error: 'Faça login para continuar.' };
    const t = this.agora();
    const b = this._bloqueio(t); if (b) return b;
    if (!this._senhaConfere(senhaAtual)) return this._falhou(t, 'A senha atual não está correta.');

    const usuario = String(novoUsuario || '').trim() || this.cred.usuario;
    if (usuario.length < USER_MIN || usuario.length > USER_MAX) return { ok: false, error: `O usuário precisa ter de ${USER_MIN} a ${USER_MAX} letras.` };
    if (/\s/.test(usuario)) return { ok: false, error: 'O usuário não pode ter espaços.' };
    const trocaSenha = !!novaSenha;
    if (trocaSenha && (novaSenha.length < SENHA_MIN || novaSenha.length > SENHA_MAX)) return { ok: false, error: `A senha nova precisa ter de ${SENHA_MIN} a ${SENHA_MAX} caracteres.` };
    if (!trocaSenha && usuario === this.cred.usuario) return { ok: false, error: 'Nada foi alterado. Escreva um usuário ou uma senha nova.' };

    const sal = trocaSenha ? crypto.randomBytes(16).toString('hex') : this.cred.sal;
    const hash = trocaSenha ? derivar(novaSenha, sal).toString('hex') : this.cred.hash;
    const nova = { usuario, sal, hash };
    if (this.file) {
      try { fs.writeFileSync(this.file, JSON.stringify(nova, null, 2)); }
      catch (_) { return { ok: false, error: 'Não foi possível guardar o novo acesso neste computador.' }; }
    }
    this.cred = { ...nova, aceita: [normUser(usuario)] };
    this.falhas = 0;
    return { ok: true, usuario, senhaNova: trocaSenha ? novaSenha : null };
  }

  logout() { this.logado = false; }
}

module.exports = { Auth, normUser, USUARIO, USUARIO_ANTIGO, MAX_TENTATIVAS, BLOQUEIO_MS, SENHA_MIN };
