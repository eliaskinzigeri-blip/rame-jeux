/* Outils partagés : sons, formats, bateaux « bots » animés, fantômes. */
(function () {
  'use strict';
  let ac = null;
  const Sound = {
    muted: false,
    ctx() { if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} } if (ac && ac.state === 'suspended') ac.resume(); return ac; },
    beep(freq = 660, dur = 0.08, type = 'sine', vol = 0.15) {
      if (this.muted) return;
      const c = this.ctx(); if (!c) return;
      const o = c.createOscillator(), g = c.createGain();
      o.type = type; o.frequency.value = freq;
      g.gain.setValueAtTime(vol, c.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
      o.connect(g).connect(c.destination); o.start(); o.stop(c.currentTime + dur + 0.02);
    },
    good() { this.beep(880, 0.09, 'triangle'); setTimeout(() => this.beep(1320, 0.08, 'triangle', 0.1), 60); },
    bad() { this.beep(180, 0.18, 'sawtooth', 0.07); },
    tick() { this.beep(1046, 0.03, 'square', 0.04); },
    split() { this.beep(660, 0.12, 'triangle', 0.1); setTimeout(() => this.beep(990, 0.14, 'triangle', 0.1), 120); },
    win() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this.beep(f, 0.18, 'triangle', 0.13), i * 110)); }
  };

  const fmtTime = sec => { sec = Math.max(0, sec); const m = Math.floor(sec / 60), s = sec - m * 60; return m + ':' + (s < 10 ? '0' : '') + s.toFixed(1); };
  const fmtClock = sec => { sec = Math.max(0, Math.round(sec)); return Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0'); };
  const pace = v => Rower.paceText(v);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

  /* Phase d'un bot qui rame à `spm`, avec la même cinématique que le joueur. */
  function botPhase(t, spm, offset) {
    const period = 60 / Math.max(10, spm), tt = ((t + (offset || 0)) % period + period) % period;
    const drive = Math.min(0.95, Math.max(0.55, period * 0.36));
    return tt < drive ? 0.5 * tt / drive : 0.5 + 0.5 * Math.min(0.999, (tt - drive) / (period - drive));
  }

  /* Trace d'un fantôme : distance échantillonnée toutes les 0,5 s. */
  const Ghost = {
    at(trace, time) {
      if (!trace || !trace.length) return 0;
      const i = time / 0.5, a = Math.floor(i);
      if (a >= trace.length - 1) return trace[trace.length - 1];
      return trace[a] + (trace[a + 1] - trace[a]) * (i - a);
    },
    recorder() { const tr = []; let acc = 0; return { trace: tr, push(dt, d) { acc += dt; while (acc >= 0.5) { acc -= 0.5; tr.push(Math.round(d * 10) / 10); } } }; }
  };

  /* Bateau du joueur, prêt pour le monde 3D. */
  const meBoat = d => ({ id: 'me', d, lane: 0, phase: Rower.phase(), me: true, speed: Rower.speed, hull: 0x0f1317, suit: 0x111418, accent: 0x2fd47a });

  window.Kit = { Sound, fmtTime, fmtClock, pace, esc, botPhase, Ghost, meBoat };
  window.Games = [];
})();
