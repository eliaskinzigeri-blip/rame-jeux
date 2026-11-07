/* COURSE — 500 m / 1 km / 2 km contre des bots et ton fantôme (record personnel). */
(function () {
  const { Sound, fmtTime, pace, esc, botPhase, Ghost, meBoat } = Kit;

  Games.push({
    id: 'course', name: 'Course', color: '#ffb547',
    tagline: 'Régate contre 3 bateaux et ton fantôme.',
    how: "Trois bateaux calés sur ton niveau (ou sur des allures types au début) et ton record en fantôme blanc. Le classement s'affiche en direct.",
    options: [{ key: 'dist', label: 'Distance', values: [500, 1000, 2000], unit: 'm', def: 500 }],
    lowerIsBetter: true,
    create(opts) {
      const dist = opts.dist || 500;
      const ghostKey = 'ghost-course-' + dist, recKey = 'rec-course-' + dist;
      const ghost = Store.get(ghostKey, null), pb = Store.get(recKey, null);
      // allures des bots : autour du record, sinon 2:25 / 2:10 / 1:58 aux 500 m
      const basePace = pb ? pb / dist * 500 : 130;
      const defs = pb ? [basePace * 1.06, basePace * 0.99, basePace * 0.95] : [145, 130, 118];
      const names = ['Léa', 'Malik', 'Jonas'];
      const cols = [[0x2a4f8f, 0x2a4f8f, 0x63a4ff], [0x8f2a3a, 0x8f2a3a, 0xff6b81], [0x5a3a8f, 0x5a3a8f, 0xc49bff]];
      const bots = defs.map((p, i) => ({ id: 'bot' + i, name: names[i], pace: p, d: 0, lane: [1, -1, 2][i], spm: 22 + Math.round(500 / p * 1.5), off: i * 0.7, hull: cols[i][0], suit: cols[i][1], accent: cols[i][2] }));
      const rec = Ghost.recorder();
      let t = 0, me = 0, done = false, lastSplit = 0, msg = '', msgT = 0;
      const finishTimes = {};
      return {
        update(dt) {
          t += dt;
          if (!done) { me += Rower.speed * dt; rec.push(dt, me); }
          bots.forEach((b, i) => {
            const v = 500 / b.pace * (1 + 0.035 * Math.sin(t / 6 + i * 2) + (b.d > dist * 0.85 ? 0.04 : 0));
            if (b.d < dist) { b.d = Math.min(dist, b.d + v * dt); if (b.d >= dist) finishTimes[b.id] = t; }
          });
          const split = Math.floor(me / 250) * 250;
          if (split > lastSplit && split < dist) { lastSplit = split; msg = `${split} m · ${fmtTime(t)}`; msgT = 2.5; Sound.split(); }
          msgT -= dt;
          if (!done && me >= dist) {
            done = true; Sound.win();
            const place = 1 + Object.keys(finishTimes).length + (ghost && Ghost.at(ghost, t) >= dist ? 1 : 0);
            if (!pb || t < pb) Store.set(ghostKey, rec.trace);
            this.over = true;
            this.result = { score: t, display: fmtTime(t), detail: `${place}${place === 1 ? 're' : 'e'} place · ${dist} m · allure moyenne ${pace(dist / t)} /500 m` };
          }
        },
        state() {
          const boats = bots.map(b => ({ id: b.id, d: b.d, lane: b.lane, phase: b.d < dist ? botPhase(t, b.spm, b.off) : 0.999, label: b.name, hull: b.hull, suit: b.suit, accent: b.accent }));
          if (ghost) boats.push({ id: 'ghost', d: Math.min(dist, Ghost.at(ghost, t)), lane: 0, phase: botPhase(t, 26, 0.3), ghost: true, label: 'Record', hull: 0xffffff, suit: 0xffffff, accent: 0xffffff });
          boats.push(meBoat(me));
          return { boats, finish: dist, laneMin: -1, laneCount: 4 };
        },
        hud() {
          const list = bots.map(b => ({ n: b.name, d: b.d, c: '#' + b.accent.toString(16).padStart(6, '0') }));
          if (ghost) list.push({ n: 'Record', d: Math.min(dist, Ghost.at(ghost, t)), c: '#ffffff' });
          list.push({ n: 'Toi', d: me, c: '#2fd47a', me: true });
          list.sort((a, b) => b.d - a.d);
          const rows = list.map((r, i) => `<li class="${r.me ? 'me' : ''}"><b>${i + 1}</b><i style="background:${r.c}"></i><span>${esc(r.n)}</span><em>${r.me ? Math.round(r.d) + ' m' : ((r.d - me) >= 0 ? '+' : '') + Math.round(r.d - me) + ' m'}</em></li>`).join('');
          return {
            panel: `<h4>Classement</h4><ol class="rank">${rows}</ol>`,
            progress: Math.min(1, me / dist), progressText: `${Math.min(dist, Math.round(me))} / ${dist} m · ${fmtTime(t)}`,
            center: msgT > 0 ? msg : ''
          };
        },
        onStroke() {}
      };
    }
  });
})();
