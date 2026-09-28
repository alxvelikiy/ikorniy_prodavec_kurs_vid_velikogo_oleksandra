// Duo-слой (DUO-редизайн): збірка сторінок-застосунку поруч зі старими сторінками курсу.
// Викликається з v2/build/build.mjs. Пише дані вправ у v2/site/data/ (під гейтингом, на відміну від /assets/)
// і повертає сторінки для загального циклу запису HTML. Власник — Lead; тіла сторінок — pages/*.mjs.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { loadDuoContent, compileCourse, DUO_CONTENT } from './content.mjs';
import { duoShell } from './shell.mjs';
import * as indexPage from './pages/index.mjs';
import * as vpravaPage from './pages/vprava.mjs';
import * as metaPages from './pages/meta.mjs';
import * as cheatPage from './pages/shpargalka.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ASSETS = path.join(__dirname, '..', 'assets', 'duo');
const require = createRequire(import.meta.url);

// DUO_HOME=0 — повернути стару «Сьогодні» на index.html (відкат, DECISIONS D-004)
export const DUO_HOME = !/^(0|false|no)$/i.test(process.env.DUO_HOME || '');
export const DUO_SLUGS = ['vprava', 'praktyka', 'zavdannia', 'profil', 'shpargalka'];

const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// UMD-модулі маскота/ілюстрацій — для пререндеру SVG у статичну розмітку (якщо вже є)
function optionalUmd(file) {
  const p = path.join(ASSETS, file);
  if (!fs.existsSync(p)) return null;
  try { delete require.cache[require.resolve(p)]; return require(p); } catch (e) { return null; }
}

function writeData(dirs, name, src) {
  for (const d of dirs) { fs.mkdirSync(path.join(d, 'data'), { recursive: true }); fs.writeFileSync(path.join(d, 'data', name), src, 'utf8'); }
}

/**
 * @returns {{ pages: {slug, html}[], dataFiles: string[], report: {errors, warnings, generated}, course }}
 */
export function buildDuo({ SITE, OUT, trainer, accountsOn }) {
  const content = loadDuoContent();
  const courseSpec = JSON.parse(fs.readFileSync(path.join(DUO_CONTENT, 'course.json'), 'utf8'));
  const course = compileCourse(content.lessons, courseSpec);

  // --- дані: карта курсу + по файлу на урок (lesson.js вантажить потрібний на вимогу)
  const dataFiles = [];
  const dirs = [SITE, OUT];
  writeData(dirs, 'duo-course.js', '// Згенеровано v2/build/duo/build-duo.mjs — не редагувати вручну\nwindow.DUO_COURSE=' + JSON.stringify(course) + ';\n');
  dataFiles.push('data/duo-course.js');
  for (const [n, data] of Object.entries(content.lessons)) {
    const name = `duo-u${String(n).padStart(2, '0')}.js`;
    writeData(dirs, name, `// Згенеровано v2/build/duo/build-duo.mjs з v2/duo/content/urok_${String(n).padStart(2, '0')}.json\n(window.DUO_LESSONS=window.DUO_LESSONS||{})[${Number(n)}]=` + JSON.stringify(data) + ';\n');
    dataFiles.push('data/' + name);
  }

  const mascot = optionalUmd('mascot.js');
  const illos = optionalUmd('illos.js');
  const ctx = {
    course, trainer, esc, accountsOn,
    mascotSvg: mascot && mascot.svg ? (e, o) => mascot.svg(e, o) : null,
    illo: illos && illos.get ? name => illos.get(name) : null,
  };
  const page = (slug, r) => ({ slug, html: duoShell({ slug, accountsOn, ...r }) });
  const pages = [];
  if (DUO_HOME) pages.push(page('index', indexPage.render(ctx)));
  pages.push(page('vprava', vpravaPage.render(ctx)));
  pages.push(page('praktyka', metaPages.praktyka(ctx)));
  pages.push(page('zavdannia', metaPages.zavdannia(ctx)));
  pages.push(page('profil', metaPages.profil(ctx)));
  pages.push(page('shpargalka', cheatPage.render(ctx)));
  return { pages, dataFiles, course, report: { errors: content.errors, warnings: content.warnings, generated: content.generated } };
}
