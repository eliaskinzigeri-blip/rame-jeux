(function () {
  'use strict';
  const R = Rower, $ = id => document.getElementById(id);
  const store = window.Store;

  /* ---------- Source ---------- */
  const status = msg => { $('status').textContent = msg || ''; };
  const simSpm = () => +$('sim-spm').value;
  $('sim-spm').addEventListener('input', e => { $('sim-out').textContent = e.target.value; });
  $('sim-spm').addEventListener('click', e => e.stopPropagation());

  document.querySelectorAll('.src-btn').forEach(btn => btn.addEventListener('click', async () => {
    const kind = btn.dataset.src;
    status('');
    try {
      if (kind === 'bluetooth') { status('Recherche du rameur… (allume la console et commence à ramer)'); await Sources.bluetooth(status); status('Rameur connecté. Donne quelques coups pour vérifier.'); }
      if (kind === 'motion') { await Sources.motion(); status('Pose le téléphone à plat sur le siège (ou attaché au chariot) et rame.'); }
      if (kind === 'mic') {
        await Sources.mic();
        status(Sources.aux ? 'Micro actif pour le rythme, Bluetooth gardé pour les mesures.' : 'Micro actif. Rame quelques coups et regarde la barre de niveau.');
        $('mic-row').hidden = false;
      } else $('mic-row').hidden = true;
      if (kind === 'manual') { Sources.manual(); status('Appuie sur Espace (ou tape l\'écran de jeu) à chaque coup.'); }
      if (kind === 'sim') { Sources.simulate(simSpm); status('Simulation active.'); }
      document.querySelectorAll('.src-btn').forEach(b => b.classList.toggle('active', b === btn || (kind === 'mic' && Sources.aux && b.dataset.src === 'bluetooth')));
      store.set('src', kind);
      setLatencySource(kind);
    } catch (e) {
      if (e && e.name === 'NotFoundError') status('Aucun rameur choisi.');
      else status(e.message || String(e));
    }
  }));
  if (!Sources.bluetoothSupported()) {
    const b = document.querySelector('[data-src="bluetooth"] span');
    b.textContent = "Indisponible dans ce navigateur (il faut Chrome ou Edge sur PC/Android ; Bluefy sur iPhone).";
  }

  /* ---------- Latence ---------- */
  // Retard typique entre l'attaque réelle et l'arrivée du coup dans l'app, par source.
  const LAT_DEFAULT = { bluetooth: 650, motion: 120, mic: 50, manual: 40, sim: 0 };
  Sources.micSensitivity = store.get('mic-sens', 1.8); $('mic-sens').value = Sources.micSensitivity;
  $('mic-sens').addEventListener('input', e => { Sources.micSensitivity = +e.target.value; store.set('mic-sens', Sources.micSensitivity); });
  let lvlT = 0;
  R.on('level', ({ rms, thr }) => {
    const now = performance.now(); if (now - lvlT < 40) return; lvlT = now;
    const scale = Math.max(thr * 2.2, 0.01);
    $('mic-lvl').style.width = Math.min(100, rms / scale * 100) + '%';
    $('mic-thr').style.left = Math.min(100, thr / scale * 100) + '%';
  });
  // Diagnostic Bluetooth : fréquence des trames et données disponibles
  setInterval(() => {
    const st = Sources.btStats; if (!st || !Sources.current || Sources.current.kind !== 'bluetooth') { $('bt-diag').hidden = true; return; }
    const fps = st.frames / Math.max(1, (performance.now() - st.since) / 1000);
    $('bt-diag').hidden = false;
    $('bt-diag').textContent = `Console : ${fps.toFixed(1)} trame/s · compteur de coups ${st.hasCount ? 'oui' : 'non'} · puissance ${st.hasPower ? 'oui' : 'non'}` + (fps < 2 ? ' → la console envoie peu de mesures : ajoute le Micro pour un rythme instantané.' : '');
  }, 1000);
  let latKind = null;
  function setLatencySource(kind) {
    latKind = kind;
    R.latency = store.get('lat-' + kind, LAT_DEFAULT[kind] || 0);
    $('latency-row').hidden = kind === 'sim';
    $('lat-range').value = R.latency; $('lat-val').textContent = R.latency;
  }
  $('lat-range').addEventListener('input', e => { R.latency = +e.target.value; $('lat-val').textContent = R.latency; });
  $('lat-range').addEventListener('change', () => { if (latKind) store.set('lat-' + latKind, R.latency); });

  let calib = null;
  $('lat-calib').onclick = () => { $('calib').hidden = false; $('calib-n').textContent = 'Prêt ?'; $('calib-msg').textContent = ''; $('calib-go').disabled = false; };
  $('calib-cancel').onclick = () => { if (calib) { clearInterval(calib.timer); calib = null; } $('calib').hidden = true; };
  $('calib-go').onclick = () => {
    Kit.Sound.ctx();
    $('calib-go').disabled = true;
    const period = 3000, beats = [], arrivals = [];
    let i = 0;
    calib = { arrivals };
    const beat = () => {
      if (i >= 14) {
        clearInterval(calib.timer);
        // on associe chaque coup reçu au bip le plus proche avant lui
        const delays = [];
        arrivals.forEach(a => {
          const b = beats.filter(x => x <= a + 300).pop();
          if (b != null && a - b > -300 && a - b < 2000) delays.push(a - b);
        });
        calib = null;
        if (delays.length < 6) { $('calib-msg').textContent = `Seulement ${delays.length} coups détectés : vérifie la source et recommence.`; $('calib-go').disabled = false; return; }
        delays.sort((x, y) => x - y);
        const med = Math.max(0, Math.min(1500, Math.round(delays[Math.floor(delays.length / 2)] / 10) * 10));
        R.latency = med; if (latKind) store.set('lat-' + latKind, med);
        $('lat-range').value = med; $('lat-val').textContent = med;
        $('calib-n').textContent = med + ' ms';
        $('calib-msg').textContent = `Latence mesurée : ${med} ms (sur ${delays.length} coups). C'est enregistré pour cette source.`;
        setTimeout(() => { $('calib').hidden = true; }, 2600);
        return;
      }
      const now = performance.now();
      if (i >= 2) beats.push(now);   // les 2 premiers bips servent à prendre le rythme
      Kit.Sound.beep(i >= 2 ? 1046 : 660, 0.12, 'triangle', 0.2);
      $('calib-n').textContent = i < 2 ? 'Rythme…' : (i - 1) + ' / 12';
      const ring = $('calib-ring'); ring.classList.remove('pulse'); void ring.offsetWidth; ring.classList.add('pulse');
      i++;
    };
    calib.timer = setInterval(beat, period); beat();
  };

  // Jauge de coup
  let meterT;
  R.on('stroke', ({ strength, lag }) => {
    const m = $('stroke-meter').firstElementChild;
    m.style.transition = 'none'; m.style.width = Math.min(100, strength * 60) + '%';
    clearTimeout(meterT); meterT = setTimeout(() => { m.style.transition = ''; m.style.width = '0'; }, 60);
    if (game && !counting) game.onStroke(strength, lag || 0);
    if (calib) calib.arrivals.push(performance.now());
  });

  /* ---------- Liste des jeux ---------- */
  const recKey = (g, opts) => 'rec-' + g.id + '-' + (g.options || []).map(o => opts[o.key]).join('-');
  const fmtScore = (g, v) => g.lowerIsBetter ? Kit.fmtTime(v) : (g.id === 'libre' || g.id === 'kraken') ? v + ' m' : g.id === 'seance' ? v + ' %' : v + ' pts';

  function renderGames() {
    const wrap = $('games'); wrap.innerHTML = '';
    Games.forEach(g => {
      const b = document.createElement('button');
      b.className = 'game'; b.style.setProperty('--c', g.color);
      const opts = defaults(g);
      const rec = store.get(recKey(g, opts), null);
      b.innerHTML = `<h3></h3><p></p><span class="rec"></span>`;
      b.querySelector('h3').textContent = g.name;
      b.querySelector('p').textContent = g.tagline;
      b.querySelector('.rec').textContent = rec != null ? 'Record : ' + fmtScore(g, rec) : 'Pas encore de record';
      b.addEventListener('click', () => openSetup(g));
      wrap.appendChild(b);
    });
  }
  function defaults(g) {
    const saved = store.get('opts-' + g.id, {});
    const o = {};
    (g.options || []).forEach(op => { o[op.key] = op.values.includes(saved[op.key]) ? saved[op.key] : op.def; });
    return o;
  }

  /* ---------- Réglages ---------- */
  let current = null, currentOpts = null;
  function openSetup(g) {
    current = g; currentOpts = defaults(g);
    $('setup-title').textContent = g.name;
    $('setup-how').textContent = g.how;
    const box = $('setup-opts'); box.innerHTML = '';
    (g.options || []).forEach(op => {
      const d = document.createElement('div'); d.className = 'opt';
      d.innerHTML = `<label></label><div class="chips"></div>`;
      d.querySelector('label').textContent = op.label;
      op.values.forEach(v => {
        const c = document.createElement('button'); c.className = 'chip' + (currentOpts[op.key] === v ? ' on' : '');
        c.textContent = v + (op.unit ? ' ' + op.unit : '');
        c.addEventListener('click', () => { currentOpts[op.key] = v; d.querySelectorAll('.chip').forEach(x => x.classList.toggle('on', x === c)); });
        d.querySelector('.chips').appendChild(c);
      });
      box.appendChild(d);
    });
    const ra = store.get('resist-auto', true);
    document.querySelectorAll('#resist-chips .chip').forEach(c => c.classList.toggle('on', (c.dataset.v === '1') === ra));
    $('resist-hint').textContent = Intensity.real
      ? 'Ta console accepte le réglage : le jeu change la vraie résistance (kraken qui agrippe, vent, coach…).'
      : (Sources.resistance ? "Ta console n'accepte pas le réglage à distance : la difficulté est simulée dans le jeu." : 'Sans console Bluetooth, la difficulté est simulée dans le jeu (bateau plus lourd).');
    $('setup').hidden = false;
    $('setup-go').focus();
  }
  document.querySelectorAll('#resist-chips .chip').forEach(c => c.addEventListener('click', () => {
    store.set('resist-auto', c.dataset.v === '1');
    document.querySelectorAll('#resist-chips .chip').forEach(x => x.classList.toggle('on', x === c));
  }));
  $('setup-cancel').onclick = () => { $('setup').hidden = true; };
  $('setup-go').onclick = () => { $('setup').hidden = true; store.set('opts-' + current.id, currentOpts); start(); };

  /* ---------- Partie ---------- */
  const ov = $('ov'), ctx = ov.getContext('2d');
  let game = null, counting = 0, raf = 0, last = 0, W = 0, H = 0, playT = 0, hudT = 0;
  function resize() {
    const r = $('stage').getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
    W = r.width; H = r.height; ov.width = W * dpr; ov.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (window.World && World.ready) World.resize();
  }
  window.addEventListener('resize', () => { if (game) resize(); });

  function whenWorld() {
    return new Promise(res => { if (window.World) return res(); window.addEventListener('world-ready', () => res(), { once: true }); });
  }
  async function start() {
    if (!Sources.current) { Sources.manual(); status('Aucune source choisie : mode manuel (Espace / tap).'); document.querySelector('[data-src="manual"]').classList.add('active'); }
    Kit.Sound.ctx();
    $('home').hidden = true; $('play').hidden = false; $('result').hidden = true;
    $('loading').hidden = !!(window.World && World.ready);
    await whenWorld();
    try { World.init($('gl')); } catch (e) { $('loading').hidden = false; $('loading').textContent = "La 3D (WebGL) n'est pas disponible sur cet appareil."; return; }
    $('loading').hidden = true;
    World.onQuality = q => { $('qual').textContent = 'Qualité : ' + QN[q]; };
    World.onQuality(World.quality);
    World.reset();
    resize();
    R.resetSession();
    Intensity.enabled = store.get('resist-auto', true);
    Intensity.start(0.35);
    game = current.create(currentOpts);
    window.__rjPlaying = true;
    counting = 3.999; playT = 0; prevCount = 4;
    last = performance.now();
    if (wakeLock == null && navigator.wakeLock) navigator.wakeLock.request('screen').then(l => { wakeLock = l; l.addEventListener('release', () => { wakeLock = null; }); }).catch(() => {});
    cancelAnimationFrame(raf); raf = requestAnimationFrame(loop);
  }
  let wakeLock = null, prevCount = 4;
  const fmtClock = Kit.fmtClock;
  function updateHud(force) {
    $('h-pace').textContent = R.paceText();
    $('h-spm').textContent = Math.round(R.spm);
    $('h-watt').textContent = R.power != null ? R.power : Math.round(2.8 * Math.pow(R.speed, 3));
    $('h-dist').textContent = Math.round(R.distance);
    $('h-time').textContent = fmtClock(playT);
    $('h-phase').style.transform = `scaleX(${R.phase() < 0.5 ? R.phase() * 2 : 2 - R.phase() * 2})`;
    const h = game.hud();
    $('h-panel').innerHTML = h.panel || '';
    $('h-panel').hidden = !h.panel;
    const c = $('h-center');
    if (h.centerHtml) c.innerHTML = h.center || ''; else c.textContent = h.center || '';
    $('h-prog').style.width = Math.round(Math.min(1, Math.max(0, h.progress || 0)) * 1000) / 10 + '%';
    $('h-prog').classList.toggle('danger', !!h.danger);
    $('h-progtxt').textContent = h.progressText || '';
    $('h-resrow').hidden = !Intensity.enabled;
    $('h-res').style.width = Math.round(Intensity.level * 100) + '%';
    $('h-reslbl').textContent = Intensity.label();
    $('h-resmode').textContent = Intensity.real ? '' : '(simulée)';
    const ev = Intensity.lastEvent(), he = $('h-event');
    if (ev) { if (he.dataset.at != ev.at) { he.dataset.at = ev.at; he.textContent = ev.text; he.className = 'hud-event show ' + (ev.up ? 'up' : 'down'); } }
    else he.className = 'hud-event';
  }
  function loop(now) {
    const real = (now - last) / 1000; last = now;
    const dt = Math.min(0.5, real);
    R.tick(Math.min(2, real));   // la physique suit le temps réel, même si l'appareil rame
    if (counting > 0) {
      counting -= dt;
      const c = Math.ceil(counting);
      if (c !== prevCount) { prevCount = c; if (c > 0) Kit.Sound.beep(c === 1 ? 880 : 520, 0.12, 'triangle'); else Kit.Sound.beep(1200, 0.25, 'triangle'); }
      $('count').textContent = counting > 0 ? c : '';
      if (counting <= 0) { counting = 0; R.resetSession(); }
    } else { game.update(dt); playT += dt; Intensity.tick(); }
    World.render(game.state(), dt);
    ctx.clearRect(0, 0, W, H);
    if (game.overlay) game.overlay(ctx, W, H);
    hudT -= dt; if (hudT <= 0) { hudT = 0.1; updateHud(); }
    if (game.over) return finish();
    raf = requestAnimationFrame(loop);
  }
  function finish() {
    Intensity.stop();
    const g = current, res = game.result, key = recKey(g, currentOpts);
    const prev = store.get(key, null);
    const better = prev == null || (g.lowerIsBetter ? res.score < prev : res.score > prev);
    if (better) store.set(key, res.score);
    const hist = store.get('history', []);
    hist.unshift({ g: g.id, s: res.score, d: Date.now(), m: Math.round(R.distance) }); store.set('history', hist.slice(0, 100));
    $('r-game').textContent = g.name;
    $('r-score').textContent = res.display;
    $('r-detail').textContent = res.detail;
    $('r-record').textContent = better ? (prev == null ? 'Premier record !' : 'Nouveau record ! (avant : ' + fmtScore(g, prev) + ')') : 'Record : ' + fmtScore(g, prev);
    $('result').hidden = false;
    game = null; window.__rjPlaying = false;
    Cloud.flush();
  }
  function home() {
    Intensity.stop();
    cancelAnimationFrame(raf); game = null; counting = 0; window.__rjPlaying = false; $('count').textContent = '';
    $('play').hidden = true; $('result').hidden = true; $('home').hidden = false;
    if (wakeLock) { wakeLock.release().catch(() => {}); wakeLock = null; }
    renderGames(); renderProfile();
  }
  $('quit').onclick = home;
  const QN = ['éco', 'moyenne', 'haute'];
  $('qual').onclick = () => { if (window.World && World.ready) World.setQuality((World.quality + 2) % 3); };
  $('cam').onclick = () => { if (window.World && World.ready) $('cam').textContent = World.cycleCamera(); };
  $('r-home').onclick = home;
  $('r-again').onclick = start;
  $('mute').onclick = () => { Kit.Sound.muted = !Kit.Sound.muted; $('mute').textContent = 'Son : ' + (Kit.Sound.muted ? 'non' : 'oui'); };
  document.addEventListener('keydown', e => { if ((e.key === 'c' || e.key === 'C') && game) $('cam').click();
    if (e.key === 'Escape') { if (!$('setup').hidden) $('setup').hidden = true; else if (game) home(); } });

  /* ---------- Bandeau live ---------- */
  setInterval(() => {
    if (!game) R.tick(0.2);
    $('l-speed').textContent = R.speed.toFixed(1);
    $('l-pace').textContent = R.paceText();
    $('l-spm').textContent = Math.round(R.spm);
    $('l-src').textContent = Sources.current ? R.source : 'aucune source';
    $('l-src').classList.toggle('on', !!Sources.current);
  }, 200);

  /* ---------- Comptes ---------- */
  let authMode = 'signup';
  function showAuth(mode) {
    authMode = mode || authMode;
    const su = authMode === 'signup';
    $('auth-title').textContent = su ? 'Crée ton compte' : 'Connexion';
    $('auth-sub').textContent = su ? 'Un compte par rameur : tes records et fantômes te suivent sur tous tes appareils.' : 'Retrouve tes records sur cet appareil.';
    $('f-pseudo-row').hidden = !su;
    $('auth-go').textContent = su ? 'Créer mon compte' : 'Se connecter';
    $('auth-switch').textContent = su ? "J'ai déjà un compte" : 'Créer un compte';
    $('auth-reset').hidden = su;
    $('auth-msg').textContent = '';
    $('auth').hidden = false; $('home').hidden = true;
    (su ? $('f-pseudo') : $('f-email')).focus();
  }
  function showHome() {
    $('auth').hidden = true; $('home').hidden = false;
    $('who').hidden = false; $('who-name').textContent = Cloud.pseudo();
    renderGames(); renderProfile();
  }
  function renderProfile() {
    const h = store.get('history', []);
    const total = h.reduce((a, x) => a + (x.m || 0), 0);
    $('profile').textContent = h.length ? `${h.length} partie${h.length > 1 ? 's' : ''} · ${(total / 1000).toFixed(1)} km ramés` : 'Aucune partie pour l\'instant';
  }
  $('auth-form').addEventListener('submit', async e => {
    e.preventDefault();
    const email = $('f-email').value.trim(), pass = $('f-pass').value, pseudo = $('f-pseudo').value.trim();
    if (authMode === 'signup' && !pseudo) { $('auth-msg').textContent = 'Choisis un pseudo.'; return; }
    $('auth-go').disabled = true; $('auth-msg').textContent = '…';
    try {
      const r = authMode === 'signup' ? await Cloud.signUp(pseudo, email, pass) : await Cloud.signIn(email, pass);
      if (r.needsConfirm) { $('auth-msg').textContent = 'Compte créé ! Clique sur le lien reçu par e-mail, puis connecte-toi.'; showAuth('login'); $('f-email').value = email; $('auth-msg').textContent = 'Compte créé ! Confirme ton e-mail via le lien reçu, puis connecte-toi.'; }
      else showHome();
    } catch (err) { $('auth-msg').textContent = err.message; }
    $('auth-go').disabled = false;
  });
  $('auth-switch').onclick = () => showAuth(authMode === 'signup' ? 'login' : 'signup');
  $('auth-reset').onclick = async () => {
    const email = $('f-email').value.trim();
    if (!email) { $('auth-msg').textContent = 'Entre ton e-mail d\'abord.'; return; }
    try { await Cloud.reset(email); $('auth-msg').textContent = 'E-mail de réinitialisation envoyé.'; } catch (err) { $('auth-msg').textContent = err.message; }
  };
  $('logout').onclick = async () => { await Cloud.signOut(); $('who').hidden = true; $('f-pass').value = ''; showAuth('login'); };
  Cloud.onChange(({ sync, refreshed }) => {
    $('sync').textContent = sync === 'ok' ? 'synchronisé' : sync;
    $('sync').className = 'sync ' + (sync === 'ok' ? 'on' : sync === 'envoi' ? '' : 'off');
    if (refreshed && !$('home').hidden) { renderGames(); renderProfile(); }
  });

  if (!Cloud.available) {
    $('auth-msg').textContent = 'Service de comptes injoignable (hors ligne ?). Recharge la page avec Internet.';
    showAuth('signup');
  } else {
    Cloud.init().then(async u => {
      // Lien « mot de passe oublié » : Supabase revient ici avec une session temporaire.
      if (u && Cloud.recovery) {
        const np = prompt('Choisis un nouveau mot de passe (6 caractères minimum) :');
        if (np) { try { await Cloud.updatePassword(np); alert('Mot de passe changé.'); } catch (err) { alert(err.message); } }
        history.replaceState(null, '', location.pathname);
      }
      u ? showHome() : showAuth('signup');
    }).catch(() => showAuth('login'));
  }
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
})();
