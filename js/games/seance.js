/* SÉANCES — entraînements structurés : la cadence cible change à chaque étape. */
(function () {
  const { Sound, fmtClock, esc, meBoat } = Kit;

  const P = {
    'Pyramide': [['Échauffement', 120, 20], ['Fort', 60, 26], ['Récup', 60, 20], ['Fort', 120, 26], ['Récup', 60, 20], ['Fort', 180, 26], ['Récup', 60, 20], ['Fort', 120, 26], ['Récup', 60, 20], ['Fort', 60, 28], ['Retour au calme', 120, 18]],
    '8 × 250 m': [['Échauffement', 120, 20]].concat(...Array.from({ length: 8 }, (_, i) => [['Sprint ' + (i + 1) + '/8', { m: 250 }, 28], ['Récup', 60, 18]])).concat([['Retour au calme', 120, 18]]),
    'Tempo 3 × 5 min': [['Échauffement', 180, 20], ['Tempo 1', 300, 24], ['Récup', 120, 18], ['Tempo 2', 300, 24], ['Récup', 120, 18], ['Tempo 3', 300, 25], ['Retour au calme', 120, 18]],
    'Express 12 min': [['Échauffement', 120, 20], ['Fort', 45, 28], ['Récup', 45, 20], ['Fort', 45, 28], ['Récup', 45, 20], ['Fort', 45, 28], ['Récup', 45, 20], ['Fort', 45, 28], ['Récup', 45, 20], ['Seuil', 180, 25], ['Retour au calme', 60, 18]]
  };

  Games.push({
    id: 'seance', name: 'Séances', color: '#b48cf2',
    tagline: 'Fractionné guidé : tiens la cadence cible.',
    how: "Chaque étape a une cadence cible (coups/min). Reste à ±2 cpm de la cible pour marquer : le score est le pourcentage du temps passé dans la zone.",
    options: [{ key: 'prog', label: 'Programme', values: Object.keys(P), unit: '', def: 'Express 12 min' }],
    scoreUnit: '%',
    create(opts) {
      const steps = P[opts.prog] || P['Express 12 min'];
      let i = 0, st = 0, sd = 0, t = 0, me = 0, inZone = 0, counted = 0, ann = 3;
      return {
        update(dt) {
          t += dt; st += dt; me += Rower.speed * dt; sd += Rower.speed * dt;
          const [, len, cpm] = steps[i];
          if (t > 8) { counted += dt; if (Math.abs(Rower.spm - cpm) <= 2) inZone += dt; }
          const left = typeof len === 'object' ? len.m - sd : len - st;
          if (typeof len !== 'object' && left <= 3 && left > 0 && Math.ceil(left) !== ann) { ann = Math.ceil(left); Sound.tick(); }
          if (left <= 0) {
            i++; st = 0; sd = 0; ann = 3; Sound.split();
            if (i >= steps.length) {
              const pct = Math.round(inZone / Math.max(1, counted) * 100);
              this.over = true;
              this.result = { score: pct, display: pct + ' %', detail: `${opts.prog} · ${Math.round(me)} m · ${fmtClock(t)} · ${pct} % du temps dans la zone` };
            }
          }
        },
        state() { return { boats: [meBoat(me)], laneMin: 0, laneCount: 1 }; },
        hud() {
          const s = steps[Math.min(i, steps.length - 1)], [name, len, cpm] = s;
          const left = typeof len === 'object' ? Math.max(0, Math.round(len.m - sd)) + ' m' : fmtClock(len - st);
          const diff = Rower.spm - cpm, ok = Math.abs(diff) <= 2;
          const next = steps[i + 1];
          const pct = Math.round(inZone / Math.max(1, counted) * 100);
          return {
            panel: `<h4>${esc(opts.prog)}</h4><div class="step">${esc(name)}</div><div class="kv"><span>Reste</span><b>${left}</b></div><div class="kv"><span>Cible</span><b>${cpm} cpm</b></div><div class="kv"><span>Dans la zone</span><b>${pct} %</b></div>${next ? `<div class="next">Ensuite : ${esc(next[0])} · ${next[2]} cpm</div>` : ''}`,
            center: `<span class="zone ${ok ? 'ok' : diff < 0 ? 'low' : 'high'}">${ok ? 'Dans la zone' : diff < 0 ? 'Accélère la cadence ▲' : 'Ralentis la cadence ▼'}</span>`,
            centerHtml: true,
            progress: i / steps.length, progressText: `Étape ${Math.min(i + 1, steps.length)} / ${steps.length}`
          };
        },
        onStroke() {}
      };
    }
  });
})();
