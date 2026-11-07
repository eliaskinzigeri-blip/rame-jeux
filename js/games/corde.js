/* TIR À LA CORDE — ta vitesse contre la force d'un adversaire qui monte de niveau. */
(function () {
  const { C, text, Sound, oarPhase } = Kit;

  Games.push({
    id: 'corde',
    name: 'Tir à la corde',
    tagline: 'Tire plus fort que l\'adversaire, niveau après niveau.',
    how: "Le ruban se déplace selon la différence entre ta vitesse et la force de l'adversaire. Amène-le dans ta zone pour gagner la manche. L'adversaire devient plus fort et tente des à-coups. Une manche perdue = fin.",
    color: '#5be3a6',
    options: [{ key: 'start', label: 'Niveau de départ', values: [1, 3, 5], unit: '', def: 1 }],
    scoreLabel: 'Niveau',
    create(opts) {
      let level = opts.start || 1, pos = 0, t = 0, roundT = 0, surge = 0, nextSurge = 6, pause = 0, msg = 'Manche ' + level;
      const startLevel = level;
      const aiForce = () => (2.2 + level * 0.32) * (1 + surge);
      return {
        update(dt) {
          t += dt;
          if (pause > 0) { pause -= dt; return; }
          roundT += dt;
          if (roundT > nextSurge) { surge = 0.35; nextSurge = roundT + 5 + Math.random() * 5; Sound.beep(240, 0.25, 'sawtooth', 0.06); }
          surge = Math.max(0, surge - dt * 0.18);
          const diff = Rower.speed - aiForce();
          pos += diff * dt * 0.09;
          pos = Math.max(-1, Math.min(1, pos));
          if (pos >= 1) { Sound.win(); level++; pos = 0; roundT = 0; nextSurge = 6; pause = 2.5; msg = 'Gagné ! Manche ' + level; }
          else if (pos <= -1) {
            Sound.bad();
            this.over = true;
            const won = level - startLevel;
            this.result = { score: level - 1, display: 'Niveau ' + (level - 1), detail: `${won} manche${won > 1 ? 's' : ''} gagnée${won > 1 ? 's' : ''} · force finale adverse ${(aiForce()).toFixed(1)} m/s` };
          }
        },
        draw(ctx, w, h) {
          ctx.fillStyle = '#10261f'; ctx.fillRect(0, 0, w, h);
          const cy = h * 0.55, mid = w / 2, span = w * 0.36;
          // zones
          ctx.fillStyle = 'rgba(91,227,166,.18)'; ctx.fillRect(mid + span, cy - 60, w - mid - span, 120);
          ctx.fillStyle = 'rgba(255,107,107,.18)'; ctx.fillRect(0, cy - 60, mid - span, 120);
          // corde
          const ox = pos * span;
          ctx.strokeStyle = '#d9b27c'; ctx.lineWidth = 7;
          ctx.beginPath(); ctx.moveTo(40, cy); ctx.quadraticCurveTo(mid + ox, cy + 12, w - 40, cy); ctx.stroke();
          ctx.fillStyle = C.bad; ctx.fillRect(mid + ox - 5, cy - 26, 10, 52);
          ctx.fillStyle = '#fff'; ctx.fillRect(mid - 1, cy - 70, 2, 140);
          // personnages
          const drawGuy = (x, dir, col, lean) => {
            ctx.save(); ctx.translate(x, cy); ctx.scale(dir, 1);
            ctx.strokeStyle = col; ctx.lineWidth = 7; ctx.lineCap = 'round';
            ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(16 + lean * 12, -46); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-14, 40); ctx.moveTo(0, 0); ctx.lineTo(14, 40); ctx.stroke();
            ctx.fillStyle = col; ctx.beginPath(); ctx.arc(20 + lean * 14, -58, 12, 0, 7); ctx.fill();
            ctx.restore();
          };
          const ph = oarPhase(), drive = ph < 0.35 ? ph / 0.35 : 1 - (ph - 0.35) / 0.65;
          drawGuy(w - 60 + ox * 0.15, -1, C.good, drive);
          drawGuy(60 + ox * 0.15, 1, C.bad, surge * 2);
          // jauges
          const bar = (x, v, col, lab) => {
            const H = h * 0.3, v01 = Math.min(1, v / 7);
            ctx.fillStyle = 'rgba(255,255,255,.1)'; ctx.fillRect(x, h * 0.12, 14, H);
            ctx.fillStyle = col; ctx.fillRect(x, h * 0.12 + H * (1 - v01), 14, H * v01);
            text(ctx, lab, x + 7, h * 0.12 + H + 16, 12, C.muted);
          };
          bar(w - 40, Rower.speed, C.good, 'toi');
          bar(26, aiForce(), C.bad, 'lui');
          text(ctx, 'Niveau ' + level, mid, 34, 26, '#fff');
          text(ctx, `toi ${Rower.speed.toFixed(1)} m/s · adversaire ${aiForce().toFixed(1)} m/s`, mid, 64, 15, C.muted);
          if (surge > 0.2) text(ctx, 'À-coup adverse !', mid, cy - 100, 22, C.bad);
          if (pause > 0) text(ctx, msg, mid, cy - 110, 30, C.good);
        },
        onStroke() {}
      };
    }
  });
})();
