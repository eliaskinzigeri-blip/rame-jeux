/* Sources de données : Bluetooth FTMS, accéléromètre du téléphone, clavier/tactile, simulation. */
(function () {
  'use strict';
  const R = window.Rower;

  const FTMS_SERVICE = 0x1826;
  const ROWER_DATA = 0x2ad1;
  const CONTROL_POINT = 0x2ad9;

  /* Décodage de la caractéristique « Rower Data » (0x2AD1) du profil FTMS. */
  function parseRowerData(dv) {
    let o = 0;
    const flags = dv.getUint16(o, true); o += 2;
    const d = {};
    if (!(flags & 0x0001)) { // « More Data » à 0 => cadence + nombre de coups présents
      d.spm = dv.getUint8(o) / 2; o += 1;
      d.strokeCount = dv.getUint16(o, true); o += 2;
    }
    if (flags & 0x0002) { d.avgSpm = dv.getUint8(o) / 2; o += 1; }
    if (flags & 0x0004) { d.distance = dv.getUint16(o, true) | (dv.getUint8(o + 2) << 16); o += 3; }
    if (flags & 0x0008) { d.pace = dv.getUint16(o, true); o += 2; }
    if (flags & 0x0010) { d.avgPace = dv.getUint16(o, true); o += 2; }
    if (flags & 0x0020) { d.power = dv.getInt16(o, true); o += 2; }
    if (flags & 0x0040) { d.avgPower = dv.getInt16(o, true); o += 2; }
    if (flags & 0x0080) { d.resistance = dv.getInt16(o, true); o += 2; }
    if (flags & 0x0100) { d.kcal = dv.getUint16(o, true); o += 5; }
    if (flags & 0x0200) { d.heartRate = dv.getUint8(o); o += 1; }
    if (flags & 0x0400) { o += 1; }
    if (flags & 0x0800) { d.elapsed = dv.getUint16(o, true); o += 2; }
    return d;
  }

  const Sources = {
    current: null,
    stopCurrent() { if (this.current && this.current.stop) this.current.stop(); this.current = null; },

    bluetoothSupported() { return !!(navigator.bluetooth && navigator.bluetooth.requestDevice); },

    async bluetooth(onStatus) {
      if (!this.bluetoothSupported()) throw new Error("Ce navigateur n'a pas Web Bluetooth. Utilise Chrome ou Edge sur ordinateur/Android (sur iPhone : app Bluefy).");
      this.stopCurrent();
      const device = await navigator.bluetooth.requestDevice({
        filters: [{ services: [FTMS_SERVICE] }, { namePrefix: 'Domyos' }, { namePrefix: 'DOMYOS' }],
        optionalServices: [FTMS_SERVICE]
      });
      onStatus && onStatus('Connexion à ' + (device.name || 'rameur') + '…');
      const server = await device.gatt.connect();
      const service = await server.getPrimaryService(FTMS_SERVICE);
      const ch = await service.getCharacteristic(ROWER_DATA);
      // Certaines consoles n'envoient rien tant qu'on n'a pas demandé le contrôle + démarrage.
      try {
        const cp = await service.getCharacteristic(CONTROL_POINT);
        await cp.startNotifications().catch(() => {});
        await cp.writeValueWithResponse(new Uint8Array([0x00]));
        await cp.writeValueWithResponse(new Uint8Array([0x07]));
      } catch (e) { /* facultatif */ }

      let lastCount = null, lastPowerStroke = 0;
      const handler = (ev) => {
        const d = parseRowerData(ev.target.value);
        let speed = null;
        if (d.pace && d.pace > 60 && d.pace < 1200) speed = 500 / d.pace;
        else if (d.power != null && d.power > 0) speed = Math.cbrt(d.power / 2.8);
        else if (d.power === 0 || d.pace === 0) speed = 0;
        R.setReal({ speed, spm: d.spm, power: d.power, heartRate: d.heartRate });
        if (d.strokeCount != null) {
          if (lastCount != null && d.strokeCount > lastCount) {
            const n = Math.min(3, d.strokeCount - lastCount);
            const strength = d.power ? d.power / 110 : 1;
            for (let i = 0; i < n; i++) R.stroke(strength);
          }
          lastCount = d.strokeCount;
        } else if (d.power != null) {
          // Pas de compteur : on déduit un coup à chaque pic de puissance.
          if (d.power > 40 && performance.now() - lastPowerStroke > 1200) { lastPowerStroke = performance.now(); R.stroke(d.power / 110); }
        }
      };
      ch.addEventListener('characteristicvaluechanged', handler);
      await ch.startNotifications();
      R.source = 'Bluetooth · ' + (device.name || 'FTMS');
      const onDisc = () => { R.source = 'déconnecté'; onStatus && onStatus('Rameur déconnecté.'); };
      device.addEventListener('gattserverdisconnected', onDisc);
      this.current = {
        stop() {
          ch.removeEventListener('characteristicvaluechanged', handler);
          device.removeEventListener('gattserverdisconnected', onDisc);
          try { device.gatt.disconnect(); } catch (e) {}
        }
      };
    },

    /* Téléphone posé sur le siège : chaque aller-retour du chariot crée un pic d'accélération. */
    async motion() {
      if (typeof DeviceMotionEvent === 'undefined') throw new Error("Pas d'accéléromètre accessible sur cet appareil.");
      if (typeof DeviceMotionEvent.requestPermission === 'function') {
        const p = await DeviceMotionEvent.requestPermission();
        if (p !== 'granted') throw new Error("Accès aux capteurs de mouvement refusé.");
      }
      this.stopCurrent();
      let filt = 0, peak = 0, armed = true, lastAt = 0, avgPeak = 3;
      const handler = (e) => {
        const a = e.acceleration && e.acceleration.x != null ? e.acceleration : null;
        let mag;
        if (a) mag = Math.hypot(a.x || 0, a.y || 0, a.z || 0);
        else {
          const g = e.accelerationIncludingGravity || {};
          mag = Math.abs(Math.hypot(g.x || 0, g.y || 0, g.z || 0) - 9.81);
        }
        filt = filt * 0.75 + mag * 0.25;
        const now = performance.now();
        const thr = Math.max(1.2, avgPeak * 0.45);
        if (armed && filt > thr) { armed = false; peak = filt; }
        else if (!armed) {
          peak = Math.max(peak, filt);
          if (filt < thr * 0.5) {
            armed = true;
            if (now - lastAt > 900) {
              lastAt = now;
              avgPeak = avgPeak * 0.8 + peak * 0.2;
              R.stroke(peak / avgPeak);
            }
          }
        }
        R.emit('motion', filt);
      };
      window.addEventListener('devicemotion', handler);
      R.source = 'Accéléromètre';
      this.current = { stop() { window.removeEventListener('devicemotion', handler); } };
    },

    /* Espace / clic / tap = un coup. Maintenir plus longtemps = coup plus fort. */
    manual() {
      this.stopCurrent();
      let downAt = 0;
      const down = (e) => {
        if (e.type === 'keydown' && (e.code !== 'Space' || e.repeat)) return;
        if (e.type === 'keydown') e.preventDefault();
        downAt = performance.now();
      };
      const up = (e) => {
        if (e.type === 'keyup' && e.code !== 'Space') return;
        if (!downAt) return;
        const held = performance.now() - downAt; downAt = 0;
        R.stroke(0.7 + Math.min(1.2, held / 400));
      };
      const pad = document.getElementById('stage');
      window.addEventListener('keydown', down); window.addEventListener('keyup', up);
      pad.addEventListener('pointerdown', down); pad.addEventListener('pointerup', up);
      R.source = 'Manuel (espace / tap)';
      this.current = {
        stop() {
          window.removeEventListener('keydown', down); window.removeEventListener('keyup', up);
          pad.removeEventListener('pointerdown', down); pad.removeEventListener('pointerup', up);
        }
      };
    },

    /* Rameur virtuel pour tester sans matériel. */
    simulate(getSpm) {
      this.stopCurrent();
      let t = null;
      const loop = () => {
        const spm = getSpm();
        R.stroke(0.85 + Math.random() * 0.3);
        t = setTimeout(loop, 60000 / spm * (0.95 + Math.random() * 0.1));
      };
      t = setTimeout(loop, 300);
      R.source = 'Simulation';
      this.current = { stop() { clearTimeout(t); } };
    }
  };

  window.Sources = Sources;
  window.parseRowerData = parseRowerData;
})();
