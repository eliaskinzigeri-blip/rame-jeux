/* ENVOL — un oiseau dont l'altitude suit ta vitesse : accélère pour monter,
   relâche pour descendre, et attrape les anneaux. Du fractionné déguisé. */
(function () {
  const { C, text, Sound } = Kit;

  Games.push({
    id: 'envol',
    name: 'Envol',
    tagline: "Ta vitesse = ton altitude. Attrape les anneaux.",
    how: "Plus tu rames vite, plus l'oiseau monte. Les anneaux hauts demandent un sprint, les bas une récupération. Évite les nuages d'orage.",
    color: '#7cc4e4',
    options: [{ key: 'dur', label: 'Durée', values: [2, 4, 8], unit: 'min', def: 4 }],
    scoreLabel: 'Points',
    create(opts) {
      const dur = (opts.dur || 4) * 60;
      let t = 0, score = 0, combo = 0, alt = 0, x = 0, items = [], nextAt = 3, flash = 0, hits = 0, total = 0;
      const vMax = 5.2; // m/s => altitude max
      const pops = [];
      return {
        update(dt) {
          t += dt; x += dt;
          const target = Math.min(1, Rower.speed / vMax);
          alt += (target - alt) * Math.min(1, dt * 2.2);
          if (t >= nextAt && t < dur - 4) {
            // séquences en « vagues » : alternance haut / bas façon fractionné
            const cycle = Math.floor(t / 40) % 2;
            const base = cycle ? 0.7 + Math.random() * 0.25 : 0.2 + Math.random() * 0.35;
            const storm = Math.random() < 0.18;
            items.push({ at: t + 4, y: storm ? Math.min(0.95, Math.max(0.1, base + (Math.random() < .5 ? -.25 : .25))) : base, storm, done: false });
            if (!storm) total++;
            nextAt = t + 2.4 + Math.random() * 1.2;
          }
          items.forEach(it => {
            if (!it.done && t >= it.at) {
              it.done = true;
              const hit = Math.abs(alt - it.y) < 0.11;
              if (it.storm && hit) { combo = 0; score = Math.max(0, score - 30); flash = 0.4; Sound.bad(); pops.push({ s: '-30', y: it.y, t: 0, c: C.bad }); }
              if (!it.storm) {
                if (hit) { combo++; hits++; const g = 10 * Math.min(5, combo); score += g; Sound.good(); pops.push({ s: '+' + g, y: it.y, t: 0, c: C.good }); }
                else combo = 0;
              }
            }
          });
          items = items.filter(it => t - it.at < 2);
          pops.forEach(p => p.t += dt);
          flash = Math.max(0, flash - dt);
          if (t >= dur) {
            this.over = true;
            this.result = { score, display: score + ' pts', detail: `${hits}/${total} anneaux attrapés · ${Math.round(Rower.distance)} m` };
          }
        },
        draw(ctx, w, h) {
          const g = ctx.createLinearGradient(0, 0, 0, h);
          g.addColorStop(0, '#2a6f97'); g.addColorStop(0.7, C.sky); g.addColorStop(1, C.sky2);
          ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
          // montagnes en parallaxe
          ctx.fillStyle = 'rgba(20,60,80,.35)';
          ctx.beginPath(); ctx.moveTo(0, h);
          for (let i = 0; i <= w; i += 20) ctx.lineTo(i, h * 0.82 - Math.abs(Math.sin((i + x * 30) / 140)) * h * 0.12);
          ctx.lineTo(w, h); ctx.fill();
          ctx.fillStyle = C.water; ctx.fillRect(0, h * 0.92, w, h * 0.08);
          const yOf = a => h * 0.88 - a * h * 0.76;
          const birdX = w * 0.25, pxPerS = w * 0.17;
          // repère de zones
          ctx.setLineDash([4, 6]); ctx.strokeStyle = 'rgba(255,255,255,.25)';
          [0.25, 0.5, 0.75].forEach(a => { ctx.beginPath(); ctx.moveTo(0, yOf(a)); ctx.lineTo(w, yOf(a)); ctx.stroke(); });
          ctx.setLineDash([]);
          [[0.25, 'tranquille'], [0.5, 'soutenu'], [0.75, 'sprint']].forEach(([a, s]) => text(ctx, s, w - 8, yOf(a) - 9, 11, 'rgba(255,255,255,.6)', 'right', 600));
          items.forEach(it => {
            const ix = birdX + (it.at - t) * pxPerS, iy = yOf(it.y);
            if (it.storm) {
              ctx.fillStyle = '#3b3f52';
              [[-18, 0, 18], [0, -8, 22], [18, 0, 17]].forEach(([dx, dy, r]) => { ctx.beginPath(); ctx.arc(ix + dx, iy + dy, r, 0, 7); ctx.fill(); });
              ctx.strokeStyle = C.accent; ctx.lineWidth = 3;
              ctx.beginPath(); ctx.moveTo(ix, iy + 10); ctx.lineTo(ix - 6, iy + 24); ctx.lineTo(ix + 3, iy + 24); ctx.lineTo(ix - 4, iy + 40); ctx.stroke();
            } else if (!it.done || t - it.at < 0.05) {
              ctx.strokeStyle = C.accent; ctx.lineWidth = 6;
              ctx.beginPath(); ctx.ellipse(ix, iy, 12, h * 0.07, 0, 0, 7); ctx.stroke();
            }
          });
          // oiseau
          const by = yOf(alt), flap = Math.sin(performance.now() / (120 - Math.min(80, Rower.spm * 2)));
          ctx.save(); ctx.translate(birdX, by); ctx.rotate(-Math.max(-0.4, Math.min(0.4, (Rower.speed / vMax - alt) * 2)));
          ctx.fillStyle = '#fff';
          ctx.beginPath(); ctx.ellipse(0, 0, 22, 11, 0, 0, 7); ctx.fill();
          ctx.fillStyle = '#e8eef2';
          ctx.beginPath(); ctx.moveTo(-6, -2); ctx.lineTo(-14, -26 * flap); ctx.lineTo(10, -2); ctx.fill();
          ctx.fillStyle = C.accent; ctx.beginPath(); ctx.moveTo(20, -3); ctx.lineTo(32, 1); ctx.lineTo(20, 4); ctx.fill();
          ctx.fillStyle = '#123'; ctx.beginPath(); ctx.arc(13, -3, 2.4, 0, 7); ctx.fill();
          ctx.restore();
          pops.filter(p => p.t < 1).forEach(p => text(ctx, p.s, birdX + 40, yOf(p.y) - p.t * 40, 22, p.c));
          if (flash) { ctx.fillStyle = `rgba(255,80,80,${flash})`; ctx.fillRect(0, 0, w, h); }
          text(ctx, score + ' pts', 20, 30, 26, '#fff', 'left');
          if (combo > 1) text(ctx, 'combo ×' + Math.min(5, combo), 20, 60, 16, C.accent, 'left');
          text(ctx, Math.max(0, Math.ceil(dur - t)) + ' s', w - 20, 30, 20, '#fff', 'right');
        },
        onStroke() {}
      };
    }
  });
})();
