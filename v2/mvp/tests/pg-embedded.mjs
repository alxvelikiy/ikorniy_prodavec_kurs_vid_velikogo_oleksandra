// Справжній Postgres без системної інсталяції — для rls-test.mjs там, де немає postgresql-16 з sudo
// (Windows, macOS, CI без Postgres). npm-пакет embedded-postgres містить нативні бінарники Postgres
// (initdb/pg_ctl/postgres) під поточну платформу; psql у ньому немає, тому SQL-скрипт виконується
// через клієнт pg ПО ОДНІЙ інструкції в autocommit — так само, як psql -f з ON_ERROR_STOP
// (set_config(..., false) живе на рівні сесії, кожна інструкція — окрема транзакція).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

export async function embeddedAvailable() {
  try { await import('pg'); nativeDir(); return true; } catch (e) { return false; }
}

// psql-метакоманди: \i файл — підставити вміст (шлях відносно baseDir), \set/\echo — пропустити.
export function inlinePsql(src, baseDir) {
  return src.replace(/\r/g, '').split('\n').map(line => {
    const m = /^\\i\s+(.+?)\s*$/.exec(line);
    if (m) return inlinePsql(fs.readFileSync(path.resolve(baseDir, m[1]), 'utf8'), baseDir);
    if (/^\\(set|echo|pset|timing)\b/.test(line)) return '';
    return line;
  }).join('\n');
}

// Поділ на інструкції з урахуванням рядків '…' (з подвоєними ''), ідентифікаторів "…",
// долар-лапок $tag$…$tag$ і коментарів -- та /* */.
export function splitSql(src) {
  const out = [];
  let buf = '';
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    const two = src.slice(i, i + 2);
    if (two === '--') { const j = src.indexOf('\n', i); const end = j < 0 ? n : j; buf += src.slice(i, end); i = end; continue; }
    if (two === '/*') { const j = src.indexOf('*/', i + 2); const end = j < 0 ? n : j + 2; buf += src.slice(i, end); i = end; continue; }
    if (c === "'") {
      let j = i + 1;
      while (j < n) { if (src[j] === "'") { if (src[j + 1] === "'") { j += 2; continue; } break; } j++; }
      buf += src.slice(i, j + 1); i = j + 1; continue;
    }
    if (c === '"') { const j = src.indexOf('"', i + 1); const end = j < 0 ? n : j + 1; buf += src.slice(i, end); i = end; continue; }
    if (c === '$') {
      const m = /^\$([A-Za-z_][A-Za-z_0-9]*)?\$/.exec(src.slice(i, i + 64));
      if (m) { const tag = m[0]; const j = src.indexOf(tag, i + tag.length); const end = j < 0 ? n : j + tag.length; buf += src.slice(i, end); i = end; continue; }
    }
    if (c === ';') { out.push(buf); buf = ''; i++; continue; }
    buf += c; i++;
  }
  out.push(buf);
  const onlyComments = s => !s.replace(/--[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '').trim();
  return out.filter(s => !onlyComments(s)).map(s => s.trim());
}

// Каталог нативних бінарників платформи (bin/initdb, bin/pg_ctl, bin/postgres, share/…).
// initdb вбудовує шлях до share/ у bootstrap-SQL; якщо шлях не ASCII (напр. тека проєкту кирилицею
// на Windows з кодовою сторінкою 1251), кластер не ініціалізується — тоді копіюємо бінарники
// в ASCII-теку тимчасових файлів (один раз, далі — кеш за версією пакета).
function nativeDir() {
  const require = createRequire(import.meta.url);
  const pkg = `@embedded-postgres/${process.platform === 'win32' ? 'windows' : process.platform}-${process.arch}`;
  const root = path.resolve(path.dirname(require.resolve(pkg)), '..'); // exports не відкриває package.json — від dist/index.js
  const pkgJson = path.join(root, 'package.json');
  const src = path.join(root, 'native');
  if (/^[\x20-\x7e]*$/.test(src)) return src;
  const ver = JSON.parse(fs.readFileSync(pkgJson, 'utf8')).version;
  const dst = path.join(os.tmpdir(), `ikorka-pg-native-${ver}`);
  if (!fs.existsSync(path.join(dst, '.complete'))) {
    fs.rmSync(dst, { recursive: true, force: true });
    fs.cpSync(src, dst, { recursive: true });
    fs.writeFileSync(path.join(dst, '.complete'), ver);
  }
  return dst;
}

// pg_ctl start лишає запущений postgres, який успадковує дескриптори stdout/stderr, — зі звичайними
// каналами spawnSync чекав би завершення сервера (зависання на Windows), тому для start — stdio: 'ignore'
// і діагностика з server.log.
function run(bin, args, { detached = false } = {}) {
  const r = spawnSync(bin, args, { encoding: 'utf8', windowsHide: true, stdio: detached ? 'ignore' : 'pipe', env: { ...process.env, LC_ALL: 'C', LANG: 'C' } });
  if (r.status !== 0) throw new Error(`${path.basename(bin)} ${args[0]}: код ${r.status} ${(r.stderr || r.stdout || '').trim().split('\n').slice(-3).join(' | ')}`);
  return r.stdout;
}

// Запустити тимчасовий кластер, виконати скрипт, повернути NOTICE-повідомлення і першу помилку (якщо була).
export async function runSqlOnEmbedded(sqlText, { baseDir, db = 'ikorka_rls_test' } = {}) {
  const { default: pg } = await import('pg');
  const bin = path.join(nativeDir(), 'bin');
  const exe = name => path.join(bin, process.platform === 'win32' ? name + '.exe' : name);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ikorka-pg-'));
  const port = 54000 + Math.floor(Math.random() * 6000);
  const notices = [];
  let error = null;
  let statements = 0;
  let version = '';
  let started = false;
  try {
    run(exe('initdb'), ['-D', dir, '-U', 'postgres', '--auth=trust', '--encoding=UTF8', '--locale=C']);
    try {
      run(exe('pg_ctl'), ['start', '-D', dir, '-w', '-t', '60', '-l', path.join(dir, 'server.log'), '-o', `-p ${port} -c listen_addresses=127.0.0.1`], { detached: true });
    } catch (e) {
      let log = ''; try { log = fs.readFileSync(path.join(dir, 'server.log'), 'utf8').trim().split('\n').slice(-3).join(' | '); } catch (x) { /* */ }
      throw new Error(e.message + (log ? ' | ' + log : ''));
    }
    started = true;
    const admin = new pg.Client({ host: '127.0.0.1', port, user: 'postgres', database: 'postgres' });
    await admin.connect();
    await admin.query(`create database ${db}`);
    await admin.end();
    const client = new pg.Client({ host: '127.0.0.1', port, user: 'postgres', database: db });
    await client.connect();
    client.on('notice', m => notices.push(m.message));
    version = (await client.query('show server_version')).rows[0].server_version;
    try {
      for (const stmt of splitSql(inlinePsql(sqlText, baseDir))) { await client.query(stmt); statements++; }
    } catch (e) {
      error = `${e.message}${e.where ? ' | ' + e.where.split('\n')[0] : ''}`;
    }
    await client.end();
  } finally {
    if (started) { try { run(exe('pg_ctl'), ['stop', '-D', dir, '-m', 'fast', '-w']); } catch (e) { /* */ } }
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) { /* тимчасова тека — не критично */ }
  }
  return { notices, error, statements, version };
}
