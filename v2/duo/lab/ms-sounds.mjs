#!/usr/bin/env node
// Рендер звукової палітри Duo.sfx (OfflineAudioContext у headless Chrome) → Output/lab/motion-sound/sounds/*.wav
// + _palette.wav (усі звуки поспіль) + таблиця рівнів (пік, RMS, тривалість до −50 dBFS) при гучності 1.
//   node v2/duo/lab/ms-sounds.mjs [--volume 0.5]
import fs from 'node:fs';
import path from 'node:path';
import { serve, launch, renderSounds, writeWavs, OUT } from './ms-lib.mjs';

const vi = process.argv.indexOf('--volume');
const volume = vi > 0 ? +process.argv[vi + 1] : 1;
const srv = await serve();
const browser = await launch();
try {
  const page = await browser.newPage();
  await page.goto(srv.url + '/__iso.html', { waitUntil: 'load' });
  const sounds = await renderSounds(page, { volume });
  writeWavs(sounds, path.join(OUT, 'sounds'));
  const rows = sounds.map(s => ({ name: s.name, ms: s.ms, peak: s.peak, peakDb: s.peakDb, rmsDb: s.rmsDb, attackMs: s.attackMs }));
  fs.writeFileSync(path.join(OUT, 'sounds', 'levels.json'), JSON.stringify({ volume, rows }, null, 1));
  console.log('звук            мс   пік    пік dB  RMS dB  атака мс');
  for (const r of rows) console.log(r.name.padEnd(15), String(r.ms).padStart(5), String(r.peak).padStart(6), String(r.peakDb).padStart(7), String(r.rmsDb).padStart(7), String(r.attackMs).padStart(8));
  console.log('→ ' + path.relative(process.cwd(), path.join(OUT, 'sounds')));
} finally { await browser.close(); srv.close(); }
