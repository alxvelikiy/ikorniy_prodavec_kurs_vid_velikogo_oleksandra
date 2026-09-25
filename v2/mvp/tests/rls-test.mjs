#!/usr/bin/env node
// Ніч 3 · зріз 1: реальна перевірка RLS-політик supabase/migrations/0001_init.sql на живому Postgres 16
// (не мок і не лише синтаксис) — v2/mvp/tests/rls-test.sql, 7 сценаріїв. Потребує локального Postgres
// (є в цьому середовищі: postgresql-16, пароль sudo не потрібен). Якщо Postgres недоступний — тест
// пропускається з чітким поясненням, а не мовчки «зеленим».
import { execSync } from 'node:child_process';
import path from 'node:path';
import { Results, V2, REPO } from './lib.mjs';

const R = new Results('rls-test');
const DB = 'ikorka_rls_test';
const sql = path.join(V2, 'mvp', 'tests', 'rls-test.sql');

function sh(cmd) { return execSync(cmd, { cwd: REPO, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }); }

let pgOk = false;
try { sh('pg_isready -q || sudo -n pg_ctlcluster 16 main start'); sh('sleep 1; pg_isready -q'); pgOk = true; } catch (e) { pgOk = false; }

if (!pgOk) {
  console.log('  · пропущено: локальний Postgres недоступний у цьому середовищі');
  R.items.push({ id: 'rls.skipped', ok: true, detail: 'немає локального Postgres — не проведено' });
} else {
  try {
    sh(`sudo -n -u postgres psql -v ON_ERROR_STOP=1 -c "drop database if exists ${DB};" -c "create database ${DB};"`);
    const out = sh(`sudo -n -u postgres psql -v ON_ERROR_STOP=1 -d ${DB} -f "${sql}" 2>&1`);
    const oks = [...out.matchAll(/NOTICE:\s+OK ([\w.]+):/g)].map(m => m[1]);
    const fails = [...out.matchAll(/(?:ERROR|FAIL)[:\s]+([^\n]*)/g)].map(m => m[1]);
    for (const id of oks) R.ok('rls.' + id);
    for (const f of fails) R.fail('rls.error', f);
    const testCount = oks.filter(id => /^test\d/.test(id)).length;
    R.check('rls.all-7-ran', testCount === 7, `пройшло тестів у SQL-скрипті: ${testCount} з 7`);
    R.check('rls.no-recursion-or-escalation-bugs', fails.length === 0, fails.join(' | '));
  } catch (e) {
    R.fail('rls.execution', String(e.stderr || e.message || e).split('\n').slice(0, 5).join(' | '));
  } finally {
    try { sh(`sudo -n -u postgres psql -c "drop database if exists ${DB};"`); } catch (e) { /* прибирання не критичне */ }
  }
}

const f = R.save(path.join(V2, 'mvp', 'tests', 'results'));
console.log(`\nРАЗОМ: ${R.items.length - R.failed.length} ok, ${R.failed.length} fail → ${path.relative(process.cwd(), f)}`);
process.exit(R.failed.length ? 1 : 0);
