/* Armazenamento local em arquivo JSON (sem banco nativo, para o instalador
 * funcionar em qualquer Windows). Gravação atômica + cópia automática diária. */
const fs = require('fs');
const path = require('path');
const Core = require('./renderer/core.js');

const KEEP_BACKUPS = 30;

class Store {
  constructor(dir) {
    this.dir = dir;
    this.file = path.join(dir, 'dados.json');
    this.backupDir = path.join(dir, 'backups');
    this.data = Core.emptyData();
    this.recovered = null; // texto explicando se precisou recuperar de uma cópia
  }

  load() {
    fs.mkdirSync(this.backupDir, { recursive: true });
    if (!fs.existsSync(this.file)) { this.data = Core.emptyData(); return this.data; }
    const lido = this._tryRead(this.file);
    if (lido) { this.data = lido; return this.data; }

    // arquivo principal corrompido: guarda o estragado e tenta a cópia mais recente
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    try { fs.renameSync(this.file, path.join(this.dir, `dados-corrompido-${stamp}.json`)); } catch (_) { /* ignora */ }
    for (const nome of this.listBackups()) {
      const b = this._tryRead(path.join(this.backupDir, nome));
      if (b) {
        this.data = b;
        this.recovered = `Os dados principais estavam danificados. Foi restaurada a cópia automática "${nome}".`;
        this.save();
        return this.data;
      }
    }
    this.data = Core.emptyData();
    this.recovered = 'Os dados principais estavam danificados e não havia cópia automática para recuperar.';
    return this.data;
  }

  _tryRead(file) {
    try {
      const obj = JSON.parse(fs.readFileSync(file, 'utf8'));
      return Core.validateData(obj) ? obj : null;
    } catch (_) { return null; }
  }

  save() {
    fs.mkdirSync(this.dir, { recursive: true });
    const tmp = this.file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2), 'utf8');
    fs.renameSync(tmp, this.file);
  }

  /** Recarrega do disco (usado se uma gravação falhar). */
  reload() {
    const lido = fs.existsSync(this.file) ? this._tryRead(this.file) : Core.emptyData();
    if (lido) this.data = lido;
  }

  listBackups() {
    try {
      return fs.readdirSync(this.backupDir).filter((n) => n.endsWith('.json')).sort().reverse();
    } catch (_) { return []; }
  }

  /** Uma cópia por dia, guardando as últimas KEEP_BACKUPS. */
  dailyBackup(now) {
    if (!fs.existsSync(this.file)) return null;
    const dest = path.join(this.backupDir, `dados-${Core.todayISO(now)}.json`);
    if (!fs.existsSync(dest)) fs.copyFileSync(this.file, dest);
    const todos = this.listBackups().filter((n) => /^dados-\d{4}-\d{2}-\d{2}\.json$/.test(n));
    for (const velho of todos.slice(KEEP_BACKUPS)) {
      try { fs.unlinkSync(path.join(this.backupDir, velho)); } catch (_) { /* ignora */ }
    }
    return dest;
  }

  /** Guarda o estado atual antes de uma operação arriscada (restaurar cópia). */
  snapshot(motivo) {
    this.save();
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const dest = path.join(this.backupDir, `antes-de-${motivo}-${stamp}.json`);
    fs.copyFileSync(this.file, dest);
    return dest;
  }

  replace(data) {
    this.data = data;
    this.save();
  }
}

module.exports = { Store };
