/* FUITE DU KRAKEN — survie : le monstre accélère sans cesse, garde ton avance. */
(function () {
  const { C, boatSide, waterBand, text, oarPhase, Sound } = Kit;

  Games.push({
    id: 'kraken',
    name: 'Fuite du kraken',
    tagline: 'Le monstre accélère. Tiens le plus longtemps possible.',
    how: "Tu pars avec 40 m d'avance. Le kraken démarre lentement puis accélère chaque seconde. S'il te rattrape, c'est fini. Passe les bouées dorées plus vite que le kraken pour le ralentir 3 s.",
    color: '#ff6b6b',
    options: [{ key: 'diff', label: 'Difficulté', values: ['facile', 'normal', 'dur'], unit: '', def: 'normal' }],
    scoreLabel: 'Distance',
    create(opts) {
      const ramp = { facile: 0.006, normal: 0.01, dur: 0.016 }[opts.diff || 'normal'];
      const startV = { facile: 1.8, normal: 2.2, dur: 2.6 }[opts.diff || 'normal'];
      let t = 0, me = 40, kr = 0, kv = startV, slow = 0, buoys = [], nextBuoy = 60, warned = false;
      return {
        update(dt) {
          t += dt;
          kv = startV + ramp * t * (1 + t / 400);
          if (slow > 0) slow -= dt;
          me += Rower.speed * dt;
          kr += kv * (slow > 0 ? 0.4 : 1) * dt;
          if (me > nextBuoy) { buoys.push(nextBuoy + 40); nextBuoy += 70 + Math.random() * 60; }
          buoys = buoys.filter(b => {
            if (Math.abs(b - me) < 2.5) {
              if (Rower.speed > kv) { slow = 3; Sound.good(); } else Sound.bad();
              return false;
            }
            return b > kr - 20;
          });
          const gap = me - kr;
          if (gap < 12 && !warned) { warned = true; Sound.bad(); }
          if (gap > 18) warned = false;
          if (gap <= 0) {
            this.over = true;
            this.result = { score: Math.round(me - 40), display: Math.round(me - 40) + ' m', detail: `Tenu ${Math.floor(t / 60)} min ${Math.round(t % 60)} s · kraken final à ${kv.toFixed(2)} m/s (allure ${Math.floor(500 / kv / 60)}:${String(Math.round(500 / kv % 60)).padStart(2, '0')})` };
          }
        },
        draw(ctx, w, h) {
          const gap = me - kr;
          const danger = Math.max(0, Math.min(1, 1 - gap / 40));
          const sky = ctx.createLinearGradient(0, 0, 0, h * 0.45);
          sky.addColorStop(0, `rgb(${20 + danger * 60},${30},${50})`); sky.addColorStop(1, '#2b4a5c');
          ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h * 0.45);
          waterBand(ctx, 0, h * 0.45, w, h * 0.55, me * 20);
          const pxPerM = w / 90, camX = me - 60;
          const X = m => (m - camX) * pxPerM, wy = h * 0.5;
          buoys.forEach(b => { const x = X(b); ctx.fillStyle = C.accent; ctx.beginPath(); ctx.arc(x, wy + 6, 8, 0, 7); ctx.fill(); ctx.fillStyle = '#fff'; ctx.fillRect(x - 8, wy + 3, 16, 3); });
          // kraken
          const kx = X(kr);
          ctx.fillStyle = slow > 0 ? '#6b4f8a' : '#7b2d4a';
          for (let i = 0; i < 6; i++) {
            const ph = performance.now() / 300 + i;
            ctx.beginPath();
            ctx.moveTo(kx - 30 - i * 14, wy + 30);
            ctx.quadraticCurveTo(kx - 10 - i * 10 + Math.sin(ph) * 20, wy - 60 - Math.cos(ph) * 25, kx + 10 - i * 12 + Math.sin(ph * 1.3) * 18, wy - 40 - i * 6);
            ctx.lineWidth = 12 - i; ctx.strokeStyle = ctx.fillStyle; ctx.stroke();
          }
          ctx.beginPath(); ctx.ellipse(kx - 60, wy + 20, 70, 40, 0, Math.PI, 0); ctx.fill();
          ctx.fillStyle = '#ffde59'; ctx.beginPath(); ctx.arc(kx - 40, wy + 2, 7, 0, 7); ctx.fill();
          boatSide(ctx, X(me), wy + 4, Math.min(160, w * 0.2), C.wood, oarPhase());
          // HUD
          text(ctx, Math.round(me - 40) + ' m', 20, 32, 28, '#fff', 'left');
          text(ctx, 'avance ' + Math.max(0, gap).toFixed(0) + ' m', w - 20, 32, 20, gap < 12 ? C.bad : '#fff', 'right');
          ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.fillRect(w - 180, 50, 160, 8);
          ctx.fillStyle = gap < 12 ? C.bad : C.good; ctx.fillRect(w - 180, 50, 160 * Math.min(1, gap / 60), 8);
          text(ctx, `kraken ${kv.toFixed(2)} m/s · toi ${Rower.speed.toFixed(2)} m/s`, w / 2, h - 24, 15, C.muted);
          if (slow > 0) text(ctx, 'Kraken ralenti !', w / 2, h * 0.2, 22, C.accent);
          if (gap < 12) text(ctx, 'Plus vite !', w / 2, h * 0.3, 30, C.bad);
        },
        onStroke() {}
      };
    }
  });
})();
