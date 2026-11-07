/* Petits outils partagés par les jeux : sons, dessin du bateau, eau, texte. */
(function () {
  'use strict';
  let ac = null;
  const Sound = {
    muted: false,
    ctx() { if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} } return ac; },
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
    bad() { this.beep(180, 0.18, 'sawtooth', 0.08); },
    tick() { this.beep(520, 0.04, 'square', 0.05); },
    win() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this.beep(f, 0.16, 'triangle', 0.14), i * 110)); }
  };

  const C = {
    deep: '#0b2233', water: '#134a63', water2: '#1b6683', foam: 'rgba(230,246,255,.55)',
    wood: '#c98a4b', woodDark: '#8a5a2b', ink: '#eaf3f7', muted: '#8fb3c4',
    accent: '#ffb547', good: '#5be3a6', bad: '#ff6b6b', sky: '#7cc4e4', sky2: '#d9f0f8'
  };

  /* Phase de rame 0..1 depuis le dernier coup (0 = attaque, 0.35 = fin de poussée). */
  function oarPhase() {
    const R = window.Rower;
    if (!R.lastStrokeAt) return 1;
    return Math.min(1, (performance.now() - R.lastStrokeAt) / 1600);
  }

  /* Bateau vu de côté, centré en (x, y), longueur L. */
  function boatSide(ctx, x, y, L, color, phase, label) {
    ctx.save(); ctx.translate(x, y);
    const h = L * 0.09;
    // coque
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(-L / 2, -h * 0.2);
    ctx.quadraticCurveTo(-L * 0.1, h * 1.3, L / 2, -h * 0.2);
    ctx.lineTo(L * 0.45, -h * 0.5); ctx.lineTo(-L * 0.45, -h * 0.5); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.fillRect(-L * 0.45, -h * 0.5, L * 0.9, h * 0.18);
    // rameur
    const p = phase == null ? 1 : phase;
    const drive = p < 0.35 ? p / 0.35 : 1 - (p - 0.35) / 0.65; // 0..1..0
    const lean = (drive - 0.5) * 0.7;
    const bx = -L * 0.02 - drive * L * 0.06;
    ctx.strokeStyle = '#f3e3cf'; ctx.lineWidth = Math.max(2, L * 0.025); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(bx, -h * 0.5); ctx.lineTo(bx + Math.sin(lean) * L * 0.14, -h * 0.5 - Math.cos(lean) * L * 0.14); ctx.stroke();
    ctx.fillStyle = '#f3e3cf';
    ctx.beginPath(); ctx.arc(bx + Math.sin(lean) * L * 0.18, -h * 0.5 - Math.cos(lean) * L * 0.18, L * 0.035, 0, 7); ctx.fill();
    // rame
    const ang = -0.9 + drive * 1.6;
    ctx.strokeStyle = C.wood; ctx.lineWidth = Math.max(1.5, L * 0.018);
    ctx.beginPath(); ctx.moveTo(bx + L * 0.02, -h * 0.9);
    ctx.lineTo(bx + L * 0.02 + Math.sin(ang) * L * 0.42, -h * 0.9 + Math.cos(ang) * L * 0.3); ctx.stroke();
    if (label) {
      ctx.fillStyle = C.ink; ctx.font = `600 ${Math.max(11, L * 0.11)}px system-ui, sans-serif`; ctx.textAlign = 'center';
      ctx.fillText(label, 0, -L * 0.32);
    }
    ctx.restore();
  }

  function waterBand(ctx, x, y, w, h, offset) {
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, C.water2); g.addColorStop(1, C.water);
    ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = C.foam; ctx.lineWidth = 1.5;
    for (let i = 0; i < 3; i++) {
      const yy = y + h * (0.25 + i * 0.28);
      ctx.beginPath();
      for (let xx = 0; xx <= w; xx += 18) {
        const yv = yy + Math.sin((xx + offset * (1 + i * 0.3)) / 38 + i) * 2.2;
        xx === 0 ? ctx.moveTo(x + xx, yv) : ctx.lineTo(x + xx, yv);
      }
      ctx.globalAlpha = 0.25; ctx.stroke(); ctx.globalAlpha = 1;
    }
  }

  function text(ctx, s, x, y, size, color, align, weight) {
    ctx.fillStyle = color || C.ink;
    ctx.font = `${weight || 700} ${size}px system-ui, -apple-system, Segoe UI, sans-serif`;
    ctx.textAlign = align || 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(s, x, y);
  }

  function fmtTime(sec) {
    const m = Math.floor(sec / 60), s = sec - m * 60;
    return m + ':' + (s < 10 ? '0' : '') + s.toFixed(1);
  }

  window.Kit = { Sound, C, oarPhase, boatSide, waterBand, text, fmtTime };
  window.Games = [];
})();
