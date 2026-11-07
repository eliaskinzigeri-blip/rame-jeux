/* INTENSITÉ — les jeux pilotent la difficulté :
   - avec une console Bluetooth qui l'accepte, on change la VRAIE résistance (FTMS) ;
   - sinon, le bateau devient plus « lourd » dans le jeu (même effort = moins de vitesse).
   Niveau normalisé 0 (très léger) → 1 (très dur). */
(function () {
  'use strict';
  const Intensity = {
    enabled: true,      // réglage joueur : « Résistance pilotée par le jeu »
    base: 0.35,         // niveau de départ de la partie
    target: 0.35,       // niveau voulu par le jeu (hors effets temporaires)
    level: 0.35,        // niveau effectif (cible + effets)
    effects: [],        // { delta, until, label }
    events: [],         // messages à afficher { text, up, at }
    _sentAt: 0, _sent: null,

    get real() { return !!(Sources.resistance && Sources.resistance.supported); },

    start(base) {
      this.base = this.target = this.level = base == null ? 0.35 : base;
      this.effects = []; this.events = []; this._sent = null;
      this.apply(true);
    },
    stop() { this.effects = []; this.target = this.base; this.level = this.base; this.apply(true); Rower.speedMul = 1; },

    /* Changement durable du niveau. */
    set(n, label) {
      n = Math.max(0, Math.min(1, n));
      if (Math.abs(n - this.target) < 0.005) return;
      const up = n > this.target; this.target = n;
      if (label) this.say(label, up);
    },
    nudge(d, label) { this.set(this.target + d, label); },
    /* Effet temporaire (ex. le kraken t'agrippe). */
    bump(delta, secs, label) {
      this.effects.push({ delta, until: performance.now() + secs * 1000 });
      if (label) this.say(label, delta > 0);
    },
    say(text, up) { this.events.push({ text, up, at: performance.now() }); if (this.events.length > 3) this.events.shift(); },
    lastEvent() { const e = this.events[this.events.length - 1]; return e && performance.now() - e.at < 2600 ? e : null; },

    tick() {
      const now = performance.now();
      this.effects = this.effects.filter(e => e.until > now);
      const eff = this.effects.reduce((a, e) => a + e.delta, 0);
      this.level = this.enabled ? Math.max(0, Math.min(1, this.target + eff)) : this.base;
      this.apply(false);
    },

    apply(force) {
      const r = Sources.resistance;
      if (this.real) {
        Rower.speedMul = 1;
        const lv = r.min + (r.max - r.min) * this.level;
        const snapped = Math.round(lv / r.inc) * r.inc;
        const now = performance.now();
        if ((force || snapped !== this._sent) && now - this._sentAt > 700) { this._sent = snapped; this._sentAt = now; r.set(snapped); }
      } else {
        // résistance simulée : au niveau de base on ne change rien, au maximum ≈ -30 % de vitesse
        Rower.speedMul = 1 - (this.level - this.base) * 0.45;
      }
    },

    /* Pour l'affichage : « 7 / 16 » ou « 45 % » */
    label() {
      const r = Sources.resistance;
      if (this.real) return Math.round(r.min + (r.max - r.min) * this.level) + ' / ' + Math.round(r.max);
      return Math.round(this.level * 100) + ' %';
    }
  };
  window.Intensity = Intensity;
})();
