/* BALADE — rame librement sur le lac, ton meilleur parcours sur la même durée en fantôme. */
(function () {
  const { Sound, fmtClock, pace, Ghost, meBoat, botPhase } = Kit;

  Games.push({
    id: 'libre', name: 'Balade sur le lac', color: '#5bc0eb',
    tagline: 'Rame librement, ton meilleur parcours te suit.',
    how: "Pas d'adversaire : le lac, les montagnes et ton fantôme (ta meilleure distance sur cette durée). Temps intermédiaire tous les 500 m.",
    options: [{ key: 'dur', label: 'Durée', values: [5, 10, 20, 30], unit: 'min', def: 10 }],
    create(opts) {
      const dur = (opts.dur || 10) * 60, gKey = 'ghost-libre-' + opts.dur;
      const ghost = Store.get(gKey, null), rec = Ghost.recorder();
      let t = 0, me = 0, last = 0, msg = '', msgT = 0; const s0 = Rower.strokes;
      return {
        update(dt) {
          t += dt; me += Rower.speed * dt; rec.push(dt, me);
          const s = Math.floor(me / 500) * 500;
          if (s > last) { last = s; msg = `${s} m · allure ${pace(s / t)}`; msgT = 3; Sound.split(); }
          msgT -= dt;
          if (t >= dur) {
            const best = Store.get('rec-libre-' + opts.dur, 0);
            if (me > best) Store.set(gKey, rec.trace);
            this.over = true;
            this.result = { score: Math.round(me), display: Math.round(me) + ' m', detail: `${opts.dur} min · allure moyenne ${pace(me / t)} /500 m · ${Rower.strokes - s0} coups` };
          }
        },
        state() {
          const boats = [];
          if (ghost) boats.push({ id: 'ghost', d: Ghost.at(ghost, t), lane: 0, phase: botPhase(t, 24, 0.3), ghost: true, label: 'Ton record', hull: 0xffffff, suit: 0xffffff, accent: 0xffffff });
          boats.push(meBoat(me));
          return { boats, laneMin: 0, laneCount: 1 };
        },
        hud() {
          const gd = ghost ? Ghost.at(ghost, t) : null;
          return {
            panel: `<h4>Balade</h4><div class="kv"><span>Reste</span><b>${fmtClock(dur - t)}</b></div><div class="kv"><span>Distance</span><b>${Math.round(me)} m</b></div>${gd != null ? `<div class="kv"><span>Écart record</span><b class="${me >= gd ? 'up' : 'down'}">${me >= gd ? '+' : ''}${Math.round(me - gd)} m</b></div>` : ''}`,
            progress: t / dur, progressText: fmtClock(t) + ' / ' + fmtClock(dur), center: msgT > 0 ? msg : ''
          };
        },
        onStroke() {}
      };
    }
  });
})();
