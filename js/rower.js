/* Modèle commun du rameur : toutes les sources (Bluetooth FTMS, accéléromètre,
   clavier, simulation) alimentent le même objet `Rower`, que les jeux lisent. */
(function () {
  'use strict';

  const Rower = {
    speed: 0,          // m/s (réelle si la console la donne, sinon modélisée)
    spm: 0,            // coups par minute
    power: null,       // watts (si connu)
    distance: 0,       // mètres parcourus depuis le début de la partie
    strokes: 0,
    heartRate: null,
    source: 'aucune',
    lastStrokeAt: 0,
    _modelSpeed: 0,
    _realSpeed: null,
    _realAt: 0,
    _listeners: {},

    on(ev, fn) { (this._listeners[ev] = this._listeners[ev] || []).push(fn); },
    off(ev, fn) { this._listeners[ev] = (this._listeners[ev] || []).filter(f => f !== fn); },
    emit(ev, data) { (this._listeners[ev] || []).forEach(fn => fn(data)); },

    resetSession() { this.distance = 0; this.strokes = 0; },

    /* Un coup de rame détecté. strength ≈ 1 pour un coup « normal ». */
    stroke(strength) {
      const now = performance.now();
      const s = Math.max(0.2, Math.min(2.2, strength || 1));
      if (this.lastStrokeAt) {
        const dt = now - this.lastStrokeAt;
        if (dt < 700) return; // anti-rebond : pas plus de ~85 cpm
        if (dt < 7000) {
          const inst = 60000 / dt;
          this.spm = this.spm ? this.spm * 0.6 + inst * 0.4 : inst;
        }
      }
      this.lastStrokeAt = now;
      this.strokes++;
      this._modelSpeed += 2.1 * s;
      this.emit('stroke', { strength: s, time: now });
    },

    /* Données réelles venant de la console. */
    setReal({ speed, spm, power, heartRate }) {
      if (speed != null && isFinite(speed)) { this._realSpeed = speed; this._realAt = performance.now(); }
      if (spm != null && spm > 0) this.spm = spm;
      if (power != null) this.power = power;
      if (heartRate) this.heartRate = heartRate;
      this.emit('data', this);
    },

    tick(dt) {
      const now = performance.now();
      this._modelSpeed *= Math.exp(-0.25 * dt);
      if (this._modelSpeed > 7) this._modelSpeed = 7;
      let target = this._modelSpeed;
      if (this._realSpeed != null && now - this._realAt < 3000) target = this._realSpeed;
      this.speed += (target - this.speed) * Math.min(1, dt * 2.5);
      if (this.speed < 0.02) this.speed = 0;
      this.distance += this.speed * dt;
      if (now - this.lastStrokeAt > 6000) this.spm *= Math.exp(-dt);
      if (this.spm < 1) this.spm = 0;
    },

    /* Allure en s/500 m formatée « 2:05 » */
    paceText() {
      if (this.speed < 0.3) return '–:––';
      const p = 500 / this.speed;
      const m = Math.floor(p / 60), s = Math.floor(p % 60);
      return m + ':' + String(s).padStart(2, '0');
    }
  };

  window.Rower = Rower;
})();
