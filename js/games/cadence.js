/* CADENCE — jeu de rythme : déclenche chaque coup de rame pile sur le temps. */
(function () {
  const { C, text, Sound } = Kit;

  Games.push({
    id: 'cadence',
    name: 'Cadence',
    tagline: 'Rame en rythme, pile sur le temps.',
    how: "Une note arrive toutes les X secondes selon la cadence choisie. Ton attaque (début de la poussée) doit tomber sur la ligne : Parfait, Bien ou Décalé. Les séries multiplient les points.",
    color: '#b48cf2',
    options: [
      { key: 'spm', label: 'Cadence', values: [18, 22, 26, 30], unit: 'cpm', def: 22 },
      { key: 'beats', label: 'Coups', values: [30, 60, 100], unit: '', def: 60 }
    ],
    scoreLabel: 'Points',
    create(opts) {
      const spm = opts.spm || 22, beats = opts.beats || 60;
      const period = 60 / spm;
      let t = 0, score = 0, combo = 0, maxCombo = 0, judged = 0, lastTick = -1;
      const counts = { Parfait: 0, Bien: 0, 'Décalé': 0, 'Raté': 0 };
      const notes = [];
      for (let i = 0; i < beats; i++) notes.push({ at: 2 + i * period, hit: null });
      let feedback = null;
      return {
        update(dt) {
          t += dt;
          const beatIdx = Math.floor((t - 2) / period);
          if (beatIdx !== lastTick && beatIdx >= 0 && beatIdx < beats) { lastTick = beatIdx; Sound.tick(); }
          notes.forEach(n => {
            if (n.hit == null && t - n.at > period * 0.5) { n.hit = 'Raté'; counts['Raté']++; combo = 0; judged++; feedback = { s: 'Raté', c: C.bad, t: 0 }; }
          });
          if (feedback) feedback.t += dt;
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
          let j;
          if (bd < 0.12) j = 'Parfait'; else if (bd < 0.28) j = 'Bien'; else j = 'Décalé';
          best.hit = j; counts[j]++; judged++;
          if (j === 'Décalé') { combo = 0; Sound.bad(); }
          else { combo++; maxCombo = Math.max(maxCombo, combo); score += (j === 'Parfait' ? 100 : 50) * (1 + Math.floor(combo / 5)); Sound.good(); }
          feedback = { s: j + (t < best.at ? ' · tôt' : ' · tard'), c: j === 'Parfait' ? C.good : j === 'Bien' ? C.accent : C.bad, t: 0 };
          if (j === 'Parfait') feedback.s = 'Parfait';
        },
        draw(ctx, w, h) {
          ctx.fillStyle = '#151233'; ctx.fillRect(0, 0, w, h);
          const hitX = w * 0.22, pxPerS = w * 0.22, cy = h * 0.5;
          // piste
          ctx.fillStyle = 'rgba(255,255,255,.06)'; ctx.fillRect(0, cy - 40, w, 80);
          // pulsation
          const ph = ((t - 2) % period + period) % period / period;
          const pr = 40 + (1 - ph) * 25;
          ctx.strokeStyle = `rgba(180,140,242,${0.25 + (1 - ph) * 0.5})`; ctx.lineWidth = 4;
          ctx.beginPath(); ctx.arc(hitX, cy, pr, 0, 7); ctx.stroke();
          ctx.fillStyle = '#fff'; ctx.fillRect(hitX - 2, cy - 50, 4, 100);
          notes.forEach(n => {
            const x = hitX + (n.at - t) * pxPerS;
            if (x < -30 || x > w + 30) return;
            const col = n.hit == null ? '#b48cf2' : n.hit === 'Parfait' ? C.good : n.hit === 'Bien' ? C.accent : C.bad;
            ctx.globalAlpha = n.hit == null ? 1 : 0.35;
            ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, cy, 18, 0, 7); ctx.fill();
            ctx.globalAlpha = 1;
          });
          if (feedback && feedback.t < 0.8) text(ctx, feedback.s, hitX, cy - 90 - feedback.t * 20, 30, feedback.c);
          text(ctx, score + ' pts', 20, 32, 26, '#fff', 'left');
          if (combo >= 2) text(ctx, 'série ' + combo + (combo >= 5 ? ' · ×' + (1 + Math.floor(combo / 5)) : ''), 20, 62, 16, C.accent, 'left');
          text(ctx, `${Math.min(judged, beats)} / ${beats}`, w - 20, 32, 20, '#fff', 'right');
          text(ctx, `cible ${spm} cpm · toi ${Math.round(Rower.spm)} cpm`, w / 2, h - 30, 16, C.muted);
          if (t < 2) text(ctx, 'Prépare-toi : attaque quand la note touche la ligne', w / 2, h * 0.25, 18, '#fff');
        }
      };
    }
  });
})();
