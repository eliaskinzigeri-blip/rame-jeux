/* RÉGATE — course contre trois bateaux fantômes à allure fixe + ton propre record. */
(function () {
  const { C, boatSide, waterBand, text, fmtTime, oarPhase, Sound } = Kit;

  Games.push({
    id: 'regate',
    name: 'Régate',
    tagline: 'Bats les bateaux fantômes sur la distance.',
    how: "Trois adversaires rament à allure constante (2:30, 2:10 et 1:55 aux 500 m). Ton meilleur temps devient un quatrième bateau fantôme.",
    color: '#ffb547',
    options: [{ key: 'dist', label: 'Distance', values: [250, 500, 1000, 2000], unit: 'm', def: 500 }],
    scoreLabel: 'Temps', lowerIsBetter: true,
    create(opts) {
      const dist = opts.dist || 500;
      const recKey = 'regate-ghost-' + dist;
      let ghostTrace = null;
      ghostTrace = Store.get(recKey, null);
      const rivals = [
        { name: 'Débutant', pace: 150, color: '#7aa6b8' },
        { name: 'Club', pace: 130, color: '#b48cf2' },
        { name: 'Pro', pace: 115, color: '#ff7a8a' }
      ].map(r => ({ ...r, d: 0 }));
      const trace = [];
      let t = 0, traceT = 0, finished = false, finishTime = 0, place = 1;
      const me = { d: 0 };

      return {
        update(dt) {
          t += dt;
          if (!finished) {
            me.d += Rower.speed * dt;
            traceT += dt;
            if (traceT >= 0.5) { traceT = 0; trace.push(Math.round(me.d * 10) / 10); }
          }
          rivals.forEach(r => { r.d = Math.min(dist, r.d + (500 / r.pace) * dt); });
          if (!finished && me.d >= dist) {
            finished = true; finishTime = t;
            place = 1 + rivals.filter(r => r.d >= dist).length + (ghostTrace && ghostAt(finishTime) >= dist ? 1 : 0);
            Sound.win();
            const best = ghostTrace ? ghostTrace.length * 0.5 : Infinity;
            if (finishTime < best) Store.set(recKey, trace);
            this.over = true;
            this.result = {
              score: finishTime, display: fmtTime(finishTime),
              detail: `${place}${place === 1 ? 're' : 'e'} place sur ${ghostTrace ? 5 : 4} · ${dist} m · allure moyenne ${paceStr(finishTime / dist * 500)}`
            };
          }
        },
        draw(ctx, w, h) {
          ctx.fillStyle = C.deep; ctx.fillRect(0, 0, w, h);
          const boats = [...rivals.map(r => ({ d: r.d, color: r.color, name: r.name, phase: (t * 500 / r.pace / 9) % 1 }))];
          if (ghostTrace) boats.push({ d: Math.min(dist, ghostAt(t)), color: 'rgba(255,255,255,.35)', name: 'Ton record', phase: (t / 2.3) % 1 });
          boats.push({ d: me.d, color: C.wood, name: 'Toi', phase: oarPhase(), me: true });
          const lanes = boats.length, top = h * 0.12, laneH = (h * 0.8) / lanes;
          const pxPerM = w / 60; // ~60 m visibles
          const camX = me.d - 20;
          boats.forEach((b, i) => {
            const y = top + i * laneH;
            waterBand(ctx, 0, y, w, laneH - 3, camX * pxPerM);
            // bouées tous les 10 m
            for (let m = Math.floor(camX / 10) * 10; m < camX + 70; m += 10) {
              const x = (m - camX) * pxPerM;
              ctx.fillStyle = m % 50 === 0 ? C.accent : 'rgba(255,255,255,.35)';
              ctx.beginPath(); ctx.arc(x, y + laneH - 6, m % 50 === 0 ? 4 : 2.5, 0, 7); ctx.fill();
            }
            // arrivée
            const fx = (dist - camX) * pxPerM;
            if (fx > -10 && fx < w + 10) {
              for (let k = 0; k < laneH / 8; k++) { ctx.fillStyle = k % 2 ? '#fff' : '#111'; ctx.fillRect(fx, y + k * 8, 6, 8); }
            }
            const bx = (b.d - camX) * pxPerM;
            const L = Math.min(laneH * 1.6, w * 0.16);
            if (bx > -L && bx < w + L) boatSide(ctx, bx, y + laneH * 0.62, L, b.color, b.phase, b.name);
            else text(ctx, (b.d > me.d ? '▶ ' : '◀ ') + b.name + ' ' + Math.abs(b.d - me.d).toFixed(0) + ' m', b.d > me.d ? w - 80 : 80, y + laneH / 2, 13, C.muted);
          });
          // barre de progression
          ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.fillRect(w * 0.1, h * 0.05, w * 0.8, 6);
          ctx.fillStyle = C.accent; ctx.fillRect(w * 0.1, h * 0.05, w * 0.8 * Math.min(1, me.d / dist), 6);
          text(ctx, `${Math.min(dist, me.d).toFixed(0)} / ${dist} m · ${fmtTime(t)}`, w / 2, h * 0.05 - 14, 15, C.ink);
        },
        onStroke() {}
      };
      function ghostAt(time) {
        const i = time / 0.5, a = Math.floor(i);
        if (a >= ghostTrace.length - 1) return ghostTrace.length ? dist : 0;
        return ghostTrace[a] + (ghostTrace[a + 1] - ghostTrace[a]) * (i - a);
      }
      function paceStr(p) { return Math.floor(p / 60) + ':' + String(Math.round(p % 60)).padStart(2, '0'); }
    }
  });
})();
