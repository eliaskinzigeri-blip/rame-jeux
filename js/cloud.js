/* Comptes + synchronisation multi-appareils (Supabase).
   Toutes les données d'un joueur (records, réglages, fantômes, historique) vivent dans
   un seul document JSON : table rj_user_state, une ligne par compte, protégée par RLS. */
(function () {
  'use strict';
  // Clé publique (publishable) : faite pour être dans le navigateur, la sécurité vient des règles RLS.
  const SUPABASE_URL = 'https://ieagkscoaoutrvsgihat.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_NxwV-ExTPEaK_GV0aKrwdA_nbSUYmO9';

  const sb = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, storageKey: 'rj-auth' }
  }) : null;

  let user = null, data = {}, pushTimer = null, syncState = 'ok', recovery = /type=recovery/.test(location.hash);
  if (sb) sb.auth.onAuthStateChange(ev => { if (ev === 'PASSWORD_RECOVERY') recovery = true; });
  const listeners = [];
  const localKey = () => 'rj-state-' + (user ? user.id : 'invite');

  function saveLocal() { try { localStorage.setItem(localKey(), JSON.stringify(data)); } catch (e) {} }
  function loadLocal() { try { return JSON.parse(localStorage.getItem(localKey()) || 'null'); } catch (e) { return null; } }
  function setSync(s) { syncState = s; listeners.forEach(fn => fn({ user, sync: s })); }

  async function push() {
    if (!sb || !user) return;
    setSync('envoi');
    const { error } = await sb.from('rj_user_state').upsert({ user_id: user.id, data, updated_at: new Date(data._t || Date.now()).toISOString() });
    setSync(error ? 'hors ligne' : 'ok');
    if (error) { clearTimeout(pushTimer); pushTimer = setTimeout(push, 15000); }
  }
  function schedulePush() { clearTimeout(pushTimer); pushTimer = setTimeout(push, 1200); }

  async function pull() {
    const local = loadLocal();
    data = local || {};
    if (!sb || !user) return;
    const { data: row, error } = await sb.from('rj_user_state').select('data, updated_at').eq('user_id', user.id).maybeSingle();
    if (error) { setSync('hors ligne'); return; }
    if (row && row.data && (!local || (row.data._t || 0) >= (local._t || 0))) data = row.data;
    else if (local) schedulePush(); // le local est plus récent (partie jouée hors ligne)
    if (!data.pseudo && user.user_metadata && user.user_metadata.pseudo) data.pseudo = user.user_metadata.pseudo;
    saveLocal();
    setSync('ok');
  }

  const Store = {
    get(k, d) { return data[k] === undefined ? d : data[k]; },
    set(k, v) { data[k] = v; data._t = Date.now(); saveLocal(); schedulePush(); },
    all() { return data; }
  };

  const Cloud = {
    available: !!sb,
    get user() { return user; },
    get sync() { return syncState; },
    get recovery() { return recovery; },
    pseudo() { return data.pseudo || (user && user.user_metadata && user.user_metadata.pseudo) || (user && user.email) || 'Invité'; },
    onChange(fn) { listeners.push(fn); },

    async init() {
      if (!sb) return null;
      const { data: s } = await sb.auth.getSession();
      user = s.session ? s.session.user : null;
      if (user) await pull();
      // Quand on revient sur l'onglet, on récupère ce qui a été joué sur un autre appareil.
      document.addEventListener('visibilitychange', async () => {
        if (document.visibilityState === 'visible' && user && !window.__rjPlaying) { await pull(); listeners.forEach(fn => fn({ user, sync: syncState, refreshed: true })); }
      });
      return user;
    },

    async signUp(pseudo, email, password) {
      const { data: r, error } = await sb.auth.signUp({ email, password, options: { data: { pseudo } } });
      if (error) throw new Error(traduire(error.message));
      if (!r.session) return { needsConfirm: true };
      user = r.user; data = loadLocal() || {}; data.pseudo = pseudo; data._t = Date.now(); saveLocal(); await push();
      return { ok: true };
    },

    async signIn(email, password) {
      const { data: r, error } = await sb.auth.signInWithPassword({ email, password });
      if (error) throw new Error(traduire(error.message));
      user = r.user; await pull();
      return { ok: true };
    },

    async reset(email) {
      const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
      if (error) throw new Error(traduire(error.message));
    },

    async updatePassword(pw) {
      const { error } = await sb.auth.updateUser({ password: pw });
      if (error) throw new Error(traduire(error.message));
    },

    async signOut() {
      clearTimeout(pushTimer);
      if (user) await push();
      await sb.auth.signOut();
      user = null; data = {};
    },

    async flush() { clearTimeout(pushTimer); await push(); }
  };

  function traduire(m) {
    const t = {
      'Invalid login credentials': 'E-mail ou mot de passe incorrect.',
      'User already registered': 'Un compte existe déjà avec cet e-mail : connecte-toi.',
      'Email not confirmed': "E-mail pas encore confirmé : clique sur le lien reçu par mail.",
      'Password should be at least 6 characters.': 'Mot de passe : 6 caractères minimum.'
    };
    for (const k in t) if (m.indexOf(k) === 0) return t[k];
    if (/rate limit/i.test(m)) return 'Trop de tentatives, réessaie dans quelques minutes.';
    if (/fetch/i.test(m)) return 'Pas de connexion Internet.';
    return m;
  }

  window.Store = Store;
  window.Cloud = Cloud;
})();
