/* CADENCE — jeu de rythme sur le lac : chaque attaque doit tomber pile sur le temps. */
(function () {
  const { Sound, esc, meBoat } = Kit;

  Games.push({
    id: 'cadence', name: 'Cadence', color: '#ff8fd0',
    tagline: 'Rame en rythme, pile sur le temps.',
    how: "Les notes défilent vers la ligne au rythme choisi. Ton attaque (début de la poussée) doit tomber dessus : Parfait, Bien ou Décalé. Les séries multiplient les points.",
    options: [
      { key: 'spm', label: 'Cadence', values: [18, 22, 26, 30], unit: 'cpm', def: 22 },
      { key: 'beats', label: 'Coups', values: [30, 60, 100], unit: '', def: 60 }
    ],
    create(opts) {
      const spm = opts.spm || 22, beats = opts.beats || 60, period = 60 / spm;
      let t = 0, me = 0, score = 0, combo = 0, maxCombo = 0, judged = 0, lastTick = -1, fb = null;
      const counts = { Parfait: 0, Bien: 0, 'Décalé': 0, 'Raté': 0 };
      const notes = Array.from({ length: beats }, (_, i) => ({ at: 3 + i * period, hit: null }));
      return {
        update(dt) {
          t += dt; me += Rower.speed * dt;
          const bi = Math.floor((t - 3) / period);
          if (bi !== lastTick && bi >= 0 && bi < beats) { lastTick = bi; Sound.tick(); }
          notes.forEach(n => { if (n.hit == null && t - n.at > period * 0.5) { n.hit = 'Raté'; counts['Raté']++; combo = 0; judged++; fb = { s: 'Raté', c: 'low', t: 0 }; } });
          if (fb) fb.t += dt;
          if (judged >= beats) {
            this.over = true;
            const acc = Math.round((counts.Parfait + counts.Bien * 0.6) / beats * 100);
            this.result = { score, display: score + ' pts', detail: `Précision ${acc} % · ${counts.Parfait} parfaits · meilleure série ${maxCombo}` };
          }
        },
        onStroke() {
          let best = null, bd = Infinity;
          notes.forEach(n => { if (n.hit == null) { const d = Math.abs(t - n.at); if (d < bd) { bd = d; best = n; } } });
          if (!best || bd > period * 0.5) return;
          const j = bd < 0.12 ? 'Parfait' : bd < 0.28 ? 'Bien' : 'Décalé';
          best.hit = j; counts[j]++; judged++;
          if (j === 'Décalé') { combo = 0; Sound.bad(); }
          else { combo++; maxCombo = Math.max(maxCombo, combo); score += (j === 'Parfait' ? 100 : 50) * (1 + Math.floor(combo / 5)); }
          fb = { s: j === 'Parfait' ? 'Parfait' : j + (t < best.at ? ' · tôt' : ' · tard'), c: j === 'Parfait' ? 'ok' : j === 'Bien' ? 'mid' : 'low', t: 0 };
        },
        state() { return { boats: [meBoat(me)], laneMin: 0, laneCount: 1 }; },
        hud() {
          return {
            panel: `<h4>Cadence ${spm} cpm</h4><div class="big">${score} <small>pts</small></div><div class="kv"><span>Série</span><b>${combo}${combo >= 5 ? ' · ×' + (1 + Math.floor(combo / 5)) : ''}</b></div><div class="kv"><span>Coups</span><b>${Math.min(judged, beats)} / ${beats}</b></div>`,
            center: fb && fb.t < 0.8 ? `<span class="zone ${fb.c}">${esc(fb.s)}</span>` : (t < 3 ? '<span class="zone">Attaque quand la note touche la ligne</span>' : ''), centerHtml: true,
            progress: judged / beats, progressText: `${Math.round(Rower.spm)} cpm · cible ${spm}`
          };
        },
        /* Piste de rythme dessinée par-dessus la 3D. */
        overlay(ctx, w, h) {
          const y = h - 120, hitX = w * 0.5, pxPerS = Math.min(260, w * 0.22);
          ctx.fillStyle = 'rgba(8,18,28,.45)'; ctx.beginPath(); ctx.roundRect(16, y - 30, w - 32, 60, 30); ctx.fill();
          const ph = (((t - 3) % period) + period) % period / period;
          ctx.strokeStyle = `rgba(255,143,208,${0.3 + (1 - ph) * 0.6})`; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.arc(hitX, y, 22 + (1 - ph) * 8, 0, 7); ctx.stroke();
          ctx.fillStyle = '#fff'; ctx.fillRect(hitX - 1.5, y - 26, 3, 52);
          notes.forEach(n => {
            const x = hitX + (n.at - t) * pxPerS; if (x < 20 || x > w - 20) return;
            ctx.globalAlpha = n.hit == null ? 1 : 0.3;
            ctx.fillStyle = n.hit == null ? '#ff8fd0' : n.hit === 'Parfait' ? '#5be3a6' : n.hit === 'Bien' ? '#ffb547' : '#ff6b6b';
            ctx.beginPath(); ctx.arc(x, y, 13, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
          });
        }
      };
    }
  });
})();
