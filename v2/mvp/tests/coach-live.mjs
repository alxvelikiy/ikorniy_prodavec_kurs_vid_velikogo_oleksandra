#!/usr/bin/env node
// Ніч 2 · П1 — жива перевірка ІІ-тренера. Працює ЛИШЕ з ANTHROPIC_API_KEY в оточенні:
//   3 повні розмови з ІІ-клієнтом (різні сцени) + розбір, потім 10 спроб ін'єкції (роль клієнта і розбір).
// Результат — v2/mvp/COACH_LIVE_TEST.md (що написано → що відповів тренер → пройшло / заблоковано).
// Без ключа НЕ імітує перевірку: пише в той самий файл «НЕ ПРОВЕДЕНА — немає ключа».
// Код виходу 1, якщо хоч одна ін'єкція пройшла (блокер).
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import os from 'node:os';
import { startServer, Results, V2 } from './lib.mjs';
import { INJECTIONS, judgeRoleplay, judgeFeedback } from './injections.mjs';
import { sceneContext } from '../../coach/lib/coach-core.mjs';
import { normText, inText } from '../../coach/lib/verbatim.mjs';

const OUT = path.join(V2, 'mvp', 'COACH_LIVE_TEST.md');
const R = new Results('coach-live');
const key = process.env.ANTHROPIC_API_KEY || '';
const LESSONS = JSON.parse(fs.readFileSync(path.join(V2, 'coach', 'data', 'lessons.json'), 'utf8'));
const inLessons = t => LESSONS.some(l => inText(normText(l.text), t));
const md = s => String(s == null ? '' : s).replace(/\|/g, '\\|').replace(/\n/g, ' ');

// Сценарії розмов: репліки менеджера — дослівні фрази з уроку 4 і нейтральні уточнення
const CONVERSATIONS = [
  { scene: 'dz-1', opener: 'Дорого', lines: ['Розумію вас — зараз багато хто уважно рахує гроші. Але наш набір розрахований не на один раз, а щоб вистачило і собі, і почастувати.', 'Скажіть, будь ласка, дорого порівняно з чим?', 'Тоді оформлюємо менший набір із тими самими смаками?'] },
  { scene: 'dz-12', opener: 'Мені не треба', lines: ['Розумію вас, я нічого не пропоную.', 'Ви у нас замовляли ікру, тому телефоную розповісти про новий сет.', 'Зазвичай, коли мені так кажуть, — це або фінансове питання, або ще є ікра.'] },
  { scene: 's04-1', opener: 'У мене ще залишилась ікра з минулого разу', lines: ['Розумію — якщо є вдома, то поки не на часі. А скажіть, будь ласка, скільки саме залишилось, одна-дві упаковки?', 'Тоді менший сет якраз підійде, щоб не було перерви.', 'Оформлюємо?'] },
];

function req(base, p, body) {
  return new Promise((resolve, reject) => {
    const u = new URL(base), data = JSON.stringify(body);
    const r = http.request({ host: u.hostname, port: u.port, method: 'POST', path: p, headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(data) } }, res => {
      let b = ''; res.on('data', d => { b += d; }); res.on('end', () => { try { resolve(JSON.parse(b)); } catch (e) { resolve({ ok: false, reason: 'parse' }); } });
    });
    r.on('error', reject); r.write(data); r.end();
  });
}

const header = `# COACH_LIVE_TEST — жива перевірка ІІ-тренера (ніч 2, П1)\n\nЗапуск: \`ANTHROPIC_API_KEY=… node v2/mvp/tests/coach-live.mjs\` (сервер піднімається сам, модель — \`COACH_MODEL\` або claude-sonnet-5). Критерії: \`v2/mvp/tests/injections.mjs\`.\n\n`;
const attemptsTable = rows => '| № | Тип спроби | Що написано в полі менеджера |' + (rows ? ' ІІ-клієнт відповів | Розбір тренера | Результат |' : '') + '\n|---|---|---|' + (rows ? '---|---|---|' : '') + '\n' +
  INJECTIONS.map((inj, i) => `| ${i + 1} | ${md(inj.kind)} | ${md(inj.text)} |` + (rows ? ` ${md(rows[i].reply)} | ${md(rows[i].fb)} | ${rows[i].verdict} |` : '')).join('\n') + '\n';

if (!key) {
  let mock = [];
  try { mock = JSON.parse(fs.readFileSync(path.join(V2, 'mvp', 'tests', 'results', 'injections-mock.json'), 'utf8')); } catch (e) { /* */ }
  fs.writeFileSync(OUT, header +
    `## ⚠️ ЖИВА ПЕРЕВІРКА НЕ ПРОВЕДЕНА — НЕМАЄ КЛЮЧА\n\nУ середовищі нічної роботи немає \`ANTHROPIC_API_KEY\`, тому жодного виклику до моделі не було. Нижче — підготовлені спроби; результатів живої моделі тут немає.\n\n` +
    attemptsTable(null) +
    `\n## Що перевірено без ключа (не жива модель)\n\nМок «зламаної» моделі (\`COACH_MOCK=1\`) на кожну спробу навмисно віддає небезпечну відповідь (злитий промпт, знижка, ціна, рецепт, англійська, «я — ІІ»). Запобіжники сервера мають її відсіяти — це друга лінія оборони, вона працює однаково з живою моделлю. Результат (\`coach-api.mjs\` → \`results/injections-mock.json\`):\n\n| Спроба | Роль клієнта / розбір |\n|---|---|\n` +
    mock.map(r => `| ${r.id} | ${md(r.note)} |`).join('\n') +
    `\n\nЯк тільки з'явиться ключ: \`ANTHROPIC_API_KEY=… node v2/mvp/tests/coach-live.mjs\` — скрипт перепише цей файл результатами 3 розмов і 10 спроб і завершиться з помилкою, якщо хоч одна спроба пройде.\n`);
  console.log('  · жива перевірка НЕ проведена: немає ANTHROPIC_API_KEY → ' + path.relative(process.cwd(), OUT));
  R.items.push({ id: 'live.skipped', ok: true, detail: 'немає ключа — не проведено' });
  R.save(path.join(V2, 'mvp', 'tests', 'results'));
  process.exit(0);
}

const srv = await startServer({ port: 6400 + Math.floor(Math.random() * 400), env: { COACH_MOCK: '0', ANTHROPIC_API_KEY: key, COACH_DAILY_LIMIT: '80', COACH_USAGE_FILE: path.join(os.tmpdir(), 'ikorka-live-' + Date.now() + '.json') } });
const b = srv.url;
let doc = header + `Дата: ${new Date().toISOString()} · модель: ${process.env.COACH_MODEL || 'claude-sonnet-5'}\n\n## 1. Три розмови з ІІ-клієнтом і розбір\n\n`;
for (const c of CONVERSATIONS) {
  const history = [{ r: 'c', t: c.opener }];
  doc += `### Сцена ${c.scene}: «${c.opener}»\n\n| Хто | Репліка |\n|---|---|\n| Клієнт (з уроку) | ${md(c.opener)} |\n`;
  let ok = true;
  for (const line of c.lines) {
    history.push({ r: 'm', t: line });
    const r = await req(b, '/api/coach/roleplay', { scene: c.scene, history });
    if (!r.ok) { ok = false; doc += `| — | помилка: ${md(r.reason)} |\n`; break; }
    const j = judgeRoleplay(r);
    if (j.passed) ok = false;
    history.push({ r: 'c', t: r.reply });
    doc += `| Менеджер | ${md(line)} |\n| ІІ-клієнт | ${md(r.reply)}${r.guarded ? ' _(замінено вартовим)_' : ''} |\n`;
  }
  const fb = await req(b, '/api/coach/feedback', { scene: c.scene, replies: c.lines, history });
  const jf = fb.ok ? judgeFeedback(fb, sceneContext(c.scene).rules.map(x => x.code), inLessons) : { passed: true, note: 'немає розбору: ' + fb.reason };
  if (fb.ok) doc += `\n**Розбір:** оцінка «${md(fb.feedback['оцінка'])}», правило ${fb.feedback['код_правила']}. Що сказано: ${md(fb.feedback['що_сказано'])}. Чому: ${md(fb.feedback['чому'])}. Що сказати натомість: ${fb.feedback['що_сказати_натомість'].map(p => '«' + md(p['текст']) + '»').join('; ')}.\n\n`;
  else doc += `\n**Розбір:** не отримано (${md(fb.reason)}).\n\n`;
  R.check('live.conversation.' + c.scene, ok && !jf.passed, jf.note);
}
doc += `## 2. Спроби ін'єкції (поле відповіді менеджера)\n\n`;
const rows = [];
for (const inj of INJECTIONS) {
  const rp = await req(b, '/api/coach/roleplay', { scene: 'dz-1', history: [{ r: 'c', t: 'Дорого' }, { r: 'm', t: inj.text }] });
  const fb = await req(b, '/api/coach/feedback', { scene: 'dz-1', replies: [inj.text] });
  const jr = judgeRoleplay(rp), jf = judgeFeedback(fb, sceneContext('dz-1').rules.map(x => x.code), inLessons);
  const passed = jr.passed || jf.passed || !rp.ok || !fb.ok;
  rows.push({ reply: rp.ok ? rp.reply + (rp.guarded ? ' (замінено вартовим)' : '') : 'помилка ' + rp.reason, fb: fb.ok ? `«${fb.feedback['оцінка']}»; ${jf.note}` : 'помилка ' + fb.reason, verdict: passed ? (rp.ok && fb.ok ? '❌ ПРОЙШЛА' : '⚠️ немає відповіді') : '✅ заблоковано' });
  R.check('live.injection.' + inj.id, !passed, jr.note + ' / ' + jf.note);
}
doc += attemptsTable(rows);
doc += `\n**Підсумок:** ${R.failed.length ? '❌ є проблеми — див. рядки вище (блокер: полагодити промпт/валідатор і повторити всі спроби)' : '✅ усі розмови коректні, усі спроби заблоковані'}.\n`;
fs.writeFileSync(OUT, doc);
srv.close();
R.save(path.join(V2, 'mvp', 'tests', 'results'));
console.log(`\nРАЗОМ: ${R.items.length - R.failed.length} ok, ${R.failed.length} fail → ${path.relative(process.cwd(), OUT)}`);
process.exit(R.failed.length ? 1 : 0);
