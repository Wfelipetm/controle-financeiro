// Autenticação local do aplicativo (um único usuário).
// A senha não fica no código: só o hash (scrypt + sal).
const crypto = require('crypto');

const USUARIO = 'acai.gisele';
const SAL = 'a10523c466677bc81be8cb9b15c17244';
const HASH = '1307cb2843914923e927a010425f9b2e9b2e043cca311e243b936e9e84025576';

const MAX_TENTATIVAS = 5;
const BLOQUEIO_MS = 30 * 1000;

// minúsculas, sem acento e sem espaços nas pontas ("Açai.Gisele" == "acai.gisele")
function normUser(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
}

function senhaConfere(senha) {
  const calc = crypto.scryptSync(String(senha || ''), Buffer.from(SAL, 'hex'), 32, { N: 16384, r: 8, p: 1 });
  return crypto.timingSafeEqual(calc, Buffer.from(HASH, 'hex'));
}

class Auth {
  constructor(agora = () => Date.now()) {
    this.agora = agora;
    this.logado = false;
    this.falhas = 0;
    this.bloqueadoAte = 0;
  }

  login(usuario, senha) {
    const t = this.agora();
    if (t < this.bloqueadoAte) {
      const seg = Math.ceil((this.bloqueadoAte - t) / 1000);
      return { ok: false, error: `Muitas tentativas. Aguarde ${seg} segundos e tente de novo.` };
    }
    // sempre calcula o hash, para o tempo de resposta não revelar se o usuário existe
    const senhaOk = senhaConfere(senha);
    const userOk = normUser(usuario) === USUARIO;
    if (userOk && senhaOk) {
      this.logado = true; this.falhas = 0; this.bloqueadoAte = 0;
      return { ok: true };
    }
    this.logado = false;
    this.falhas++;
    if (this.falhas >= MAX_TENTATIVAS) {
      this.falhas = 0; this.bloqueadoAte = t + BLOQUEIO_MS;
      return { ok: false, error: `Muitas tentativas. Aguarde ${BLOQUEIO_MS / 1000} segundos e tente de novo.` };
    }
    return { ok: false, error: 'Usuário ou senha incorretos.' };
  }

  logout() { this.logado = false; }
}

module.exports = { Auth, normUser, USUARIO, MAX_TENTATIVAS, BLOQUEIO_MS };
