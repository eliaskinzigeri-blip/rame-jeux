/* CHASSE AUX BOUÉES — passe chaque bouée dorée au-dessus de l'allure cible pour la faire éclater. */
(function () {
  const { Sound, fmtClock, pace, meBoat } = Kit;

  Games.push({
    id: 'bouees', name: 'Chasse aux bouées', color: '#ffd23f',
    tagline: "Fais éclater les bouées en passant assez vite.",
    how: "Une bouée dorée arrive environ tous les 60 m. Si tu la passes plus vite que l'allure cible, elle éclate et tu marques. Chaque série relève la cible.",
    options: [{ key: 'dur', label: 'Durée', values: [3, 5, 10], unit: 'min', def: 5 }],
    create(opts) {
      const dur = (opts.dur || 5) * 60;
      let t = 0, me = 0, score = 0, combo = 0, hits = 0, total = 0, target = 2.6, avg = 0, msg = '', msgT = 0, cls = '';
      const items = [];
      let nextX = 80;
      return {
        update(dt) {
          t += dt; me += Rower.speed * dt;
          avg += (Rower.speed - avg) * Math.min(1, dt / 20);
          if (t < 25) target = Math.max(2.4, avg * 1.04);
          while (nextX < me + 200) { items.push({ x: nextX }); nextX += 55 + Math.random() * 30; }
          const now = performance.now() / 1000;
          items.forEach(it => {
            if (!it.hit && !it.missed && me >= it.x) {
              total++;
              if (Rower.speed >= target) {
                it.hit = true; it.hitAt = now; hits++; combo++;
                const g = 100 * Math.min(5, combo); score += g; Sound.good();
                msg = `+${g}` + (combo > 1 ? ` · série ×${Math.min(5, combo)}` : ''); cls = 'ok'; msgT = 1.4;
                if (combo % 3 === 0) { target *= 1.03; Intensity.nudge(0.06, 'Série de 3 ! Résistance ▲'); }
              } else { it.missed = true; combo = 0; Sound.bad(); msg = 'Trop lent !'; cls = 'low'; msgT = 1.2; target *= 0.985; Intensity.nudge(-0.04); }
            }
          });
          while (items.length && items[0].x < me - 25) items.shift();
          msgT -= dt;
          if (t >= dur) {
            this.over = true;
            this.result = { score, display: score + ' pts', detail: `${hits}/${total} bouées éclatées · ${Math.round(me)} m · cible finale ${pace(target)} /500 m` };
          }
        },
        state() { return { boats: [meBoat(me)], targets: items.slice(0, 8), laneMin: 0, laneCount: 1 }; },
        hud() {
          const ok = Rower.speed >= target, next = items.find(i => !i.hit && !i.missed);
          return {
            panel: `<h4>Bouées</h4><div class="big">${score} <small>pts</small></div><div class="kv"><span>Cible</span><b>${pace(target)}</b></div><div class="kv"><span>Toi</span><b class="${ok ? 'up' : 'down'}">${pace(Rower.speed)}</b></div>${next ? `<div class="kv"><span>Prochaine</span><b>${Math.max(0, Math.round(next.x - me))} m</b></div>` : ''}<div class="kv"><span>Reste</span><b>${fmtClock(dur - t)}</b></div>`,
            center: msgT > 0 ? `<span class="zone ${cls}">${msg}</span>` : '', centerHtml: true,
            progress: t / dur, progressText: `${hits}/${total} bouées`
          };
        },
        onStroke() {}
      };
    }
  });
})();
