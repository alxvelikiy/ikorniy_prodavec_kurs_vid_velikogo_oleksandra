// Duo-слой: тексти для збірки сторінок — той самий v2/build/assets/duo/copy.js, що й у браузері (UMD).
// Без copy.js збірка падає: статичні сторінки не мають власних запасних текстів.
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
export const COPY = require('../assets/duo/copy.js');
if (!COPY || !COPY.pages || !COPY.nav) throw new Error('[Duo] copy.js не завантажено: немає Duo.copy.pages/nav');
