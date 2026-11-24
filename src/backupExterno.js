// Backup automático para uma pasta escolhida (por exemplo, dentro do Google Drive ou do OneDrive).
// Mantém um arquivo por dia (dados-AAAA-MM-DD.json) e guarda os últimos KEEP.
const fs = require('fs');
const path = require('path');

const SUBPASTA = 'Controle Financeiro - Backup';
const KEEP = 30;
const VELHO_HORAS = 48;

const pad = (n) => String(n).padStart(2, '0');
const diaLocal = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function mensagem(e) {
  const c = e && e.code;
  if (c === 'ENOENT' || c === 'ENOTDIR') return 'A pasta não foi encontrada. Se ela está no Google Drive, no OneDrive ou em um pen drive, confira se está conectado.';
  if (c === 'EACCES' || c === 'EPERM' || c === 'EROFS') return 'Sem permissão para gravar nessa pasta.';
  if (c === 'ENOSPC') return 'Não há espaço livre nessa pasta.';
  return 'Não foi possível gravar na pasta escolhida.';
}

class BackupExterno {
  constructor(dir, store) {
    this.cfgFile = path.join(dir, 'backup-externo.json');
    this.store = store;
    this.timer = null;
    this.cfg = this._ler();
  }

  _ler() {
    try {
      const o = JSON.parse(fs.readFileSync(this.cfgFile, 'utf8'));
      return { pasta: typeof o.pasta === 'string' && o.pasta ? o.pasta : null, ultimo: o.ultimo || null, erro: o.erro || null };
    } catch (_) { return { pasta: null, ultimo: null, erro: null }; }
  }

  _gravar() { try { fs.writeFileSync(this.cfgFile, JSON.stringify(this.cfg, null, 2)); } catch (_) { /* sem permissão: segue sem guardar */ } }

  /** aviso: null (tudo certo) | 'erro' | 'antigo' */
  status(agora = Date.now()) {
    const { pasta, ultimo, erro } = this.cfg;
    let aviso = null;
    if (pasta) {
      if (erro) aviso = 'erro';
      else if (!ultimo || agora - Date.parse(ultimo) > VELHO_HORAS * 3600 * 1000) aviso = 'antigo';
    }
    return { pasta, ultimo, erro, aviso, ligado: !!pasta };
  }

  /** Escolhe a pasta, confere se dá para gravar e já faz o primeiro backup. */
  definirPasta(pasta) {
    if (!pasta || typeof pasta !== 'string') return { ok: false, error: 'Nenhuma pasta escolhida.' };
    try {
      const dest = path.join(pasta, SUBPASTA);
      fs.mkdirSync(dest, { recursive: true });
      const teste = path.join(dest, '.teste-gravacao');
      fs.writeFileSync(teste, 'ok'); fs.unlinkSync(teste);
    } catch (e) { return { ok: false, error: mensagem(e) }; }
    this.cfg = { pasta, ultimo: null, erro: null };
    this._gravar();
    return this.executar();
  }

  remover() {
    clearTimeout(this.timer); this.timer = null;
    this.cfg = { pasta: null, ultimo: null, erro: null };
    this._gravar();
  }

  executar(agora = new Date()) {
    const { pasta } = this.cfg;
    if (!pasta) return { ok: false, error: 'O backup automático está desligado.' };
    try {
      const dest = path.join(pasta, SUBPASTA);
      fs.mkdirSync(dest, { recursive: true });
      if (!fs.existsSync(this.store.file)) { this.cfg.ultimo = agora.toISOString(); this.cfg.erro = null; this._gravar(); return { ok: true, arquivo: null }; }
      const arquivo = path.join(dest, `dados-${diaLocal(agora)}.json`);
      fs.copyFileSync(this.store.file, arquivo);
      const todos = fs.readdirSync(dest).filter((n) => /^dados-\d{4}-\d{2}-\d{2}\.json$/.test(n)).sort().reverse();
      for (const velho of todos.slice(KEEP)) { try { fs.unlinkSync(path.join(dest, velho)); } catch (_) { /* ignora */ } }
      this.cfg.ultimo = agora.toISOString(); this.cfg.erro = null; this._gravar();
      return { ok: true, arquivo };
    } catch (e) {
      this.cfg.erro = mensagem(e); this._gravar();
      return { ok: false, error: this.cfg.erro };
    }
  }

  /** Depois de cada alteração nos dados: espera um pouco e copia (várias alterações seguidas viram uma cópia só). */
  agendar(ms = 15000) {
    if (!this.cfg.pasta) return;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => { this.timer = null; this.executar(); }, ms);
    if (this.timer.unref) this.timer.unref();
  }

  /** Ao fechar o programa: se havia uma cópia esperando, faz agora. */
  finalizar() {
    if (this.timer) { clearTimeout(this.timer); this.timer = null; this.executar(); }
  }
}

module.exports = { BackupExterno, SUBPASTA, KEEP, VELHO_HORAS };
