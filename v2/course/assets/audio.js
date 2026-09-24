// Ikorka Shop — хаус-біт і звук клацання. Генеруються в браузері (Web Audio),
// без аудіофайлів і без чужих прав. Нічого не грає, поки менеджер сам не натисне кнопку.
(function () {
  var AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;

  function load(k, d) { try { var v = localStorage.getItem(k); return v === null ? d : v === '1'; } catch (e) { return d; } }
  function save(k, v) { try { localStorage.setItem(k, v ? '1' : '0'); } catch (e) {} }

  var ctx = null, master = null, musicOn = false, timer = null, step = 0;
  var BPM = 122, STEP = 60 / BPM / 4; // 16-ті

  function ensure() {
    if (!ctx) {
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.9;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  // ---------- елементарні голоси ----------
  function env(node, t, a, d, peak) {
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
    node.connect(g);
    return g;
  }
  function noiseBuffer(sec) {
    var n = Math.floor(ctx.sampleRate * sec), b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0);
    for (var i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }
  var NOISE = null;

  function kick(t, out) {
    var o = ctx.createOscillator();
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(48, t + 0.11);
    env(o, t, 0.004, 0.24, 0.9).connect(out);
    o.start(t); o.stop(t + 0.3);
  }
  function hat(t, out, open) {
    if (!NOISE) NOISE = noiseBuffer(0.4);
    var s = ctx.createBufferSource(); s.buffer = NOISE;
    var hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = open ? 6500 : 9000;
    s.connect(hp);
    env(hp, t, 0.002, open ? 0.16 : 0.035, open ? 0.14 : 0.1).connect(out);
    s.start(t); s.stop(t + 0.25);
  }
  function clap(t, out) {
    if (!NOISE) NOISE = noiseBuffer(0.4);
    var s = ctx.createBufferSource(); s.buffer = NOISE;
    var bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1700; bp.Q.value = 1.2;
    s.connect(bp);
    env(bp, t, 0.003, 0.14, 0.22).connect(out);
    s.start(t); s.stop(t + 0.25);
  }
  function bass(t, freq, out) {
    var o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = freq;
    var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 520; lp.Q.value = 6;
    o.connect(lp);
    env(lp, t, 0.01, 0.2, 0.3).connect(out);
    o.start(t); o.stop(t + 0.3);
  }
  function stab(t, freqs, out) {
    var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2600;
    var g = env(lp, t, 0.012, 0.42, 0.11);
    freqs.forEach(function (f) {
      var o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = f;
      o.connect(lp); o.start(t); o.stop(t + 0.5);
    });
    g.connect(out);
  }

  // ---------- 32-кроковий цикл (2 такти) ----------
  var ROOT = [55.0, 55.0, 65.41, 49.0];               // A1, A1, C2, G1 — по такту
  var CHORD = [[220, 261.63, 329.63], [246.94, 293.66, 349.23]]; // Am, Bdim-ish
  function tick() {
    var t = ctx.currentTime + 0.06;
    var bar = Math.floor(step / 16) % 4;
    var s = step % 16;
    if (s % 4 === 0) kick(t, master);
    if (s % 4 === 2) hat(t, master, true);
    if (s % 2 === 1) hat(t, master, false);
    if (s === 4 || s === 12) clap(t, master);
    if (s % 4 !== 0) bass(t, ROOT[bar] * (s % 8 === 3 ? 1.5 : 1), master);
    if (s === 6 || s === 14) stab(t, CHORD[bar % 2], master);
    step = (step + 1) % 64;
  }

  function startMusic() {
    ensure();
    if (timer) return;
    step = 0;
    master.gain.value = 0;
    master.gain.linearRampToValueAtTime(0.28, ctx.currentTime + 1.2);
    tick();
    timer = setInterval(tick, STEP * 1000);
  }
  function stopMusic() {
    if (!timer) return;
    clearInterval(timer); timer = null;
    if (master) { master.gain.cancelScheduledValues(ctx.currentTime); master.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + 0.4); }
  }

  // ---------- звук клацання: м'який короткий «тік», без різкого писку ----------
  function clickSound() {
    ensure();
    var t = ctx.currentTime + 0.001;
    var o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(720, t);
    o.frequency.exponentialRampToValueAtTime(500, t + 0.035);
    var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2200;
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.045, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.055);
    o.connect(lp); lp.connect(g); g.connect(ctx.destination);
    o.start(t); o.stop(t + 0.07);
  }

  // ---------- кнопка в меню: тільки іконка-перемикач музики (без кнопки «Клік») ----------
  var nav = document.querySelector('.topnav-inner');
  if (!nav) return;
  var box = document.createElement('div'); box.className = 'sound-ctl';
  var bM = document.createElement('button'); bM.type = 'button'; bM.className = 'snd-btn';
  box.appendChild(bM);
  nav.appendChild(box);

  function paintM() {
    bM.textContent = musicOn ? '♪' : '♪';
    bM.classList.toggle('on', musicOn);
    bM.setAttribute('aria-pressed', musicOn ? 'true' : 'false');
    bM.setAttribute('aria-label', musicOn ? 'Вимкнути фонову музику' : 'Увімкнути фонову музику');
    bM.title = musicOn ? 'Вимкнути фонову музику' : 'Увімкнути фонову музику';
  }
  bM.addEventListener('click', function () {
    musicOn = !musicOn;
    save('ikorka-music', musicOn);
    if (musicOn) startMusic(); else stopMusic();
    paintM();
  });
  paintM();

  // Музика не вмикається сама: якщо менеджер увімкнув її раніше, чекаємо першого кліку на сторінці
  if (load('ikorka-music', false)) {
    var armed = function () {
      document.removeEventListener('pointerdown', armed);
      musicOn = true; startMusic(); paintM();
    };
    document.addEventListener('pointerdown', armed, { once: true });
  }

  document.addEventListener('pointerdown', function (e) {
    var el = e.target.closest('a,button,summary,.check-item,.lesson-tile,.daycard,.chip');
    if (el && !el.closest('.sound-ctl')) clickSound();
  });

  // Озвучення уроку і відео мають бути чутні — приглушуємо біт
  document.addEventListener('click', function (e) {
    if (!musicOn || !master) return;
    if (e.target.closest('.tts-play,.video-play')) {
      var q = e.target.closest('.tts-play') ? 0.06 : 0.0001;
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.linearRampToValueAtTime(q, ctx.currentTime + 0.3);
    }
  });
  window.addEventListener('pagehide', stopMusic);
})();
