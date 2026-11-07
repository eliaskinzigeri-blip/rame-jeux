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
      if (kind === 'manual') { Sources.manual(); status('Appuie sur Espace (ou tape l\'écran de jeu) à chaque coup.'); }
      if (kind === 'sim') { Sources.simulate(simSpm); status('Simulation active.'); }
      document.querySelectorAll('.src-btn').forEach(b => b.classList.toggle('active', b === btn));
      store.set('src', kind);
    } catch (e) {
      if (e && e.name === 'NotFoundError') status('Aucun rameur choisi.');
      else status(e.message || String(e));
    }
  }));
  if (!Sources.bluetoothSupported()) {
    const b = document.querySelector('[data-src="bluetooth"] span');
    b.textContent = "Indisponible dans ce navigateur (il faut Chrome ou Edge sur PC/Android ; Bluefy sur iPhone).";
  }

  // Jauge de coup
  let meterT;
  R.on('stroke', ({ strength }) => {
    const m = $('stroke-meter').firstElementChild;
    m.style.transition = 'none'; m.style.width = Math.min(100, strength * 60) + '%';
    clearTimeout(meterT); meterT = setTimeout(() => { m.style.transition = ''; m.style.width = '0'; }, 60);
    if (game && !counting) game.onStroke(strength);
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
    $('setup').hidden = false;
    $('setup-go').focus();
  }
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
    World.reset();
    resize();
    R.resetSession();
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
  }
  function loop(now) {
    const dt = Math.min(0.5, (now - last) / 1000); last = now;
    R.tick(dt);
    if (counting > 0) {
      counting -= dt;
      const c = Math.ceil(counting);
      if (c !== prevCount) { prevCount = c; if (c > 0) Kit.Sound.beep(c === 1 ? 880 : 520, 0.12, 'triangle'); else Kit.Sound.beep(1200, 0.25, 'triangle'); }
      $('count').textContent = counting > 0 ? c : '';
      if (counting <= 0) { counting = 0; R.resetSession(); }
    } else { game.update(dt); playT += dt; }
    World.render(game.state(), dt);
    ctx.clearRect(0, 0, W, H);
    if (game.overlay) game.overlay(ctx, W, H);
    hudT -= dt; if (hudT <= 0) { hudT = 0.1; updateHud(); }
    if (game.over) return finish();
    raf = requestAnimationFrame(loop);
  }
  function finish() {
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
    cancelAnimationFrame(raf); game = null; counting = 0; window.__rjPlaying = false; $('count').textContent = '';
    $('play').hidden = true; $('result').hidden = true; $('home').hidden = false;
    if (wakeLock) { wakeLock.release().catch(() => {}); wakeLock = null; }
    renderGames(); renderProfile();
  }
  $('quit').onclick = home;
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
