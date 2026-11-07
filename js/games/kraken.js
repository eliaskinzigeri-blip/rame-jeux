/* FUITE DU KRAKEN — survie : le monstre accélère sans cesse, garde ton avance. */
(function () {
  const { Sound, fmtClock, pace, meBoat } = Kit;

  Games.push({
    id: 'kraken', name: 'Fuite du kraken', color: '#ff6b6b',
    tagline: 'Le monstre accélère. Tiens le plus longtemps possible.',
    how: "Tu pars avec 40 m d'avance. Le kraken accélère chaque seconde ; s'il te rattrape, c'est fini. Passe les bouées dorées plus vite que lui pour le ralentir 3 s.",
    options: [{ key: 'diff', label: 'Difficulté', values: ['facile', 'normal', 'dur'], unit: '', def: 'normal' }],
    create(opts) {
      const ramp = { facile: 0.006, normal: 0.01, dur: 0.016 }[opts.diff || 'normal'];
      const startV = { facile: 1.8, normal: 2.2, dur: 2.6 }[opts.diff || 'normal'];
      let t = 0, me = 40, kr = 0, kv = startV, slow = 0, msg = '', msgT = 0, cls = '', warned = false;
      const items = []; let nextX = 110;
      return {
        update(dt) {
          t += dt;
          kv = startV + ramp * t * (1 + t / 400);
          slow -= dt;
          me += Rower.speed * dt;
          kr += kv * (slow > 0 ? 0.4 : 1) * dt;
          while (nextX < me + 200) { items.push({ x: nextX }); nextX += 90 + Math.random() * 60; }
          items.forEach(it => {
            if (!it.hit && !it.missed && me >= it.x) {
              if (Rower.speed > kv) { it.hit = true; it.hitAt = performance.now() / 1000; slow = 3; Sound.good(); msg = 'Kraken ralenti !'; cls = 'ok'; msgT = 2; }
              else { it.missed = true; Sound.bad(); msg = 'Bouée ratée : trop lent'; cls = 'low'; msgT = 1.5; }
            }
          });
          while (items.length && items[0].x < me - 25) items.shift();
          msgT -= dt;
          const gap = me - kr;
          if (gap < 12 && !warned) { warned = true; Sound.bad(); }
          if (gap > 18) warned = false;
          if (gap <= 0) {
            this.over = true;
            this.result = { score: Math.round(me - 40), display: Math.round(me - 40) + ' m', detail: `Tenu ${fmtClock(t)} · kraken final à ${pace(kv)} /500 m` };
          }
        },
        state() { return { boats: [meBoat(me)], kraken: kr - 6, targets: items.slice(0, 8), laneMin: 0, laneCount: 1 }; },
        hud() {
          const gap = Math.max(0, me - kr);
          return {
            panel: `<h4>Fuite</h4><div class="big ${gap < 12 ? 'down' : ''}">${Math.round(gap)} <small>m d'avance</small></div><div class="kv"><span>Kraken</span><b>${pace(kv * (slow > 0 ? 0.4 : 1))}</b></div><div class="kv"><span>Toi</span><b class="${Rower.speed > kv ? 'up' : 'down'}">${pace(Rower.speed)}</b></div><div class="kv"><span>Distance</span><b>${Math.round(me - 40)} m</b></div>`,
            center: msgT > 0 ? `<span class="zone ${cls}">${msg}</span>` : gap < 12 ? '<span class="zone low">Plus vite !</span>' : '', centerHtml: true,
            progress: Math.min(1, gap / 60), progressText: fmtClock(t), danger: gap < 12
          };
        },
        onStroke() {}
      };
    }
  });
})();
