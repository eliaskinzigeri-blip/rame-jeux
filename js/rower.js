/* Modèle commun du rameur. Toutes les sources (Bluetooth FTMS, accéléromètre, clavier,
   simulation) alimentent `Rower`, que le monde 3D et les jeux lisent.

   Anti-latence :
   - la vitesse affichée vient d'un modèle physique qui réagit À L'INSTANT du coup de rame
     (impulsion + traînée), au lieu d'attendre la console qui n'envoie ~1 mesure/s ;
   - les vraies mesures de la console servent à CALIBRER ce modèle (gain), pas à le piloter,
     donc l'allure reste juste sans le retard de 1-2 s ;
   - l'animation du rameur suit une phase prédite à partir de la cadence. */
(function () {
  'use strict';

  const DRAG = 0.30;      // traînée (1/s)
  const KICK = 2.3;       // impulsion de base par coup (m/s)

  const Rower = {
    speed: 0, spm: 0, power: null, heartRate: null, distance: 0, strokes: 0,
    source: 'aucune', lastStrokeAt: 0, period: 2.6, gain: 1, realSpeed: null,
    _model: 0, _modelAvg: 0, _realAt: 0, _listeners: {},

    on(ev, fn) { (this._listeners[ev] = this._listeners[ev] || []).push(fn); },
    off(ev, fn) { this._listeners[ev] = (this._listeners[ev] || []).filter(f => f !== fn); },
    emit(ev, data) { (this._listeners[ev] || []).forEach(fn => fn(data)); },
    resetSession() { this.distance = 0; this.strokes = 0; },

    /* Un coup de rame vient de commencer (attaque). strength ≈ 1 pour un coup normal. */
    stroke(strength) {
      const now = performance.now();
      const s = Math.max(0.3, Math.min(2, strength || 1));
      if (this.lastStrokeAt) {
        const dt = (now - this.lastStrokeAt) / 1000;
        if (dt < 0.75) return;                       // anti-rebond (> 80 cpm impossible)
        if (dt < 6) {
          this.period = this.period * 0.55 + dt * 0.45;
          const inst = 60 / dt;
          this.spm = this.spm ? this.spm * 0.5 + inst * 0.5 : inst;
        }
      }
      this.lastStrokeAt = now;
      this.strokes++;
      this._model += KICK * s * this.gain;
      this.emit('stroke', { strength: s, time: now });
    },

    /* Mesures réelles de la console : elles recalibrent le modèle. */
    setReal({ speed, spm, power, heartRate }) {
      const now = performance.now();
      if (speed != null && isFinite(speed)) {
        this.realSpeed = speed; this._realAt = now;
        if (speed > 0.5 && this._modelAvg > 0.5 && now - this.lastStrokeAt < 5000) {
          const err = (speed - this._modelAvg) / this._modelAvg;
          this.gain = Math.max(0.4, Math.min(2.5, this.gain * (1 + 0.12 * err)));
        }
        // la console dit qu'on glisse alors qu'on n'a vu aucun coup : on fait confiance à la console
        if (now - this.lastStrokeAt > 4000) this._model = speed;
      }
      if (spm != null && spm > 0 && now - this.lastStrokeAt > 4000) this.spm = spm;
      if (power != null) this.power = power;
      if (heartRate) this.heartRate = heartRate;
    },

    tick(dt) {
      this._model *= Math.exp(-DRAG * dt);
      if (this._model > 7) this._model = 7;
      this._modelAvg += (this._model - this._modelAvg) * Math.min(1, dt / 4);
      // lissage très court (≈ 80 ms) : réactif mais sans à-coups visuels
      this.speed += (this._model - this.speed) * Math.min(1, dt * 12);
      if (this.speed < 0.02) this.speed = 0;
      this.distance += this.speed * dt;
      const idle = performance.now() - this.lastStrokeAt;
      if (idle > 6000) { this.spm *= Math.exp(-dt); if (this.spm < 1) this.spm = 0; }
    },

    /* Phase du geste : 0 → 0.5 = poussée (pelle dans l'eau), 0.5 → 1 = retour vers l'attaque.
       Le retour s'étale sur la période prévue, puis on attend en position d'attaque. */
    phase() {
      if (!this.lastStrokeAt) return 0.999;
      const t = (performance.now() - this.lastStrokeAt) / 1000;
      const drive = Math.min(0.95, Math.max(0.55, this.period * 0.36));
      if (t < drive) return 0.5 * t / drive;
      const rec = Math.max(0.6, this.period - drive);
      return 0.5 + 0.5 * Math.min(0.999, (t - drive) / rec);
    },

    paceText(v) {
      v = v == null ? this.speed : v;
      if (v < 0.3) return '–:––';
      const p = 500 / v, m = Math.floor(p / 60), s = Math.floor(p % 60);
      return m + ':' + String(s).padStart(2, '0');
    }
  };

  window.Rower = Rower;
})();
