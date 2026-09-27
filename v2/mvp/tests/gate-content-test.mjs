#!/usr/bin/env node
// Зріз 5: гейтинг контенту на Netlify Edge Function (netlify/edge-functions/gate-content.js).
// Перевіряє лише чисту логіку «який шлях публічний» (lib/gate-logic.mjs, без Deno.env/fetch/Response) —
// саму edge-функцію тут прогнати неможливо: пісочниця розробки не має мережевого доступу для
// завантаження рантайму Netlify Edge Functions (Deno-бінар, 403 з egress-проксі при `netlify dev`).
// Живу перевірку (реальний редірект на account.html без сесії, реальний прохід із дійсним токеном)
// власник проводить сам після деплою — див. SUPABASE_SETUP.md, розділ 8.
import path from 'node:path';
import { Results, V2, REPO } from './lib.mjs';
import { isPublicPath } from '../../../netlify/edge-functions/lib/gate-logic.mjs';

const R = new Results('gate-content');

R.check('gate.public-root', isPublicPath('/'));
R.check('gate.public-account', isPublicPath('/account.html'));
R.check('gate.public-sw', isPublicPath('/sw.js'));
R.check('gate.public-favicon', isPublicPath('/favicon.ico'));
R.check('gate.public-assets-css', isPublicPath('/assets/style.css'));
R.check('gate.public-assets-vendor', isPublicPath('/assets/vendor/supabase-js.js'));

R.check('gate.gated-index-is-not-public', !isPublicPath('/index.html'));
R.check('gate.gated-lesson', !isPublicPath('/urok-01.html'));
R.check('gate.gated-day', !isPublicPath('/den-01.html'));
R.check('gate.gated-trenazher', !isPublicPath('/trenazher.html'));
R.check('gate.gated-trener', !isPublicPath('/trener.html'));
R.check('gate.gated-perevirka', !isPublicPath('/perevirka.html'));
R.check('gate.gated-povtorennia', !isPublicPath('/povtorennia.html'));
R.check('gate.gated-sos', !isPublicPath('/sos.html'));
R.check('gate.gated-video', !isPublicPath('/video.html'));
R.check('gate.gated-dzvinky', !isPublicPath('/dzvinky.html'));
R.check('gate.gated-kerivnyku', !isPublicPath('/kerivnyku.html'));
R.check('gate.gated-vstup', !isPublicPath('/vstup.html'));
// не має ловити шляхи, що лише ПОЧИНАЮТЬСЯ з "/account" чи "/assets" без роздільника (напр. чужа сторінка)
R.check('gate.no-prefix-false-positive', !isPublicPath('/account-other.html'));

const f = R.save(path.join(V2, 'mvp', 'tests', 'results'));
console.log(`\nРАЗОМ: ${R.items.length - R.failed.length} ok, ${R.failed.length} fail → ${path.relative(REPO, f)}`);
process.exit(R.failed.length ? 1 : 0);
