// Ikorka Duo — скріншоти стенду design-системи (components.html).
// Власник: design-system-engineer. Запуск: node v2/duo/lab/ds-shots.mjs
// 390x844 і 1440x900, світла і темна тема -> Output/lab/design-system/*.png
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdirSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire('C:/Users/User/Desktop/Аудио_курс учебный/_duo/v2/mvp/tests/package.json');
const { chromium } = require('playwright-core');

const PAGE_PATH = join(__dirname, 'components.html');
const PAGE_URL = pathToFileURL(PAGE_PATH).href;
const OUT_DIR = join(__dirname, '..', '..', '..', 'Output', 'lab', 'design-system');
mkdirSync(OUT_DIR, { recursive: true });

const VIEWPORTS = [
  { tag: 'mobile', width: 390, height: 844 },
  { tag: 'desktop', width: 1440, height: 900 }
];
const THEMES = ['light', 'dark'];

async function shoot(browser, theme, vp) {
  const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
  if (theme === 'dark') {
    await context.addInitScript(() => { try { localStorage.setItem('ikorka-theme', 'dark'); } catch (e) {} });
  }
  const page = await context.newPage();
  await page.goto(PAGE_URL, { waitUntil: 'load' });
  await page.waitForSelector('#iconGrid .lab-icon-cell'); // дочекатись рендеру JS (іконки, свотчі)
  await page.waitForTimeout(150); // шрифт/стилі осядуть
  const outPath = join(OUT_DIR, `${theme}-${vp.tag}-${vp.width}x${vp.height}.png`);
  await page.screenshot({ path: outPath, fullPage: true });
  console.log('saved', outPath);
  await context.close();
}

const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
try {
  for (const theme of THEMES) {
    for (const vp of VIEWPORTS) {
      await shoot(browser, theme, vp);
    }
  }
} finally {
  await browser.close();
}
console.log('done');
