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
    aux: null,
    stopCurrent() { if (this.current && this.current.stop) this.current.stop(); this.current = null; if (this.aux) { this.aux.stop(); this.aux = null; } },

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

      // Détection anticipée : la console incrémente son compteur de coups en fin de poussée
      // (et n'envoie qu'environ 1 trame/s). Une montée brutale de puissance signale l'attaque
      // plus tôt : on déclenche le coup tout de suite et on ignore l'incrément qui suit.
      let lastCount = null, prevPower = 0, earlyAt = 0;
      const stats = this.btStats = { frames: 0, since: performance.now(), hasCount: false, hasPower: false, spm: 0 };
      const handler = (ev) => {
        const d = parseRowerData(ev.target.value);
        const now = performance.now();
        let speed = null;
        if (d.pace && d.pace > 60 && d.pace < 1200) speed = 500 / d.pace;
        else if (d.power != null && d.power > 0) speed = Math.cbrt(d.power / 2.8);
        else if (d.power === 0 || d.pace === 0) speed = 0;
        R.setReal({ speed, spm: d.spm, power: d.power, heartRate: d.heartRate });
        const strength = d.power ? Math.max(0.5, Math.min(1.8, d.power / 110)) : 1;
        stats.frames++; if (d.strokeCount != null) stats.hasCount = true; if (d.power != null) stats.hasPower = true; if (d.spm) stats.spm = d.spm;
        // Si le micro (ou un autre capteur rapide) donne le rythme, la console ne sert qu'aux mesures.
        if (Sources.aux) { if (d.strokeCount != null) lastCount = d.strokeCount; if (d.power != null) prevPower = d.power; return; }
        if (d.power != null && d.power > 40 && d.power > prevPower * 1.5 + 15 && now - R._lastReal > 900) {
          earlyAt = now; R.stroke(strength);
        }
        if (d.power != null) prevPower = d.power;
        if (d.strokeCount != null) {
          if (lastCount != null && d.strokeCount > lastCount) {
            const n = Math.min(3, d.strokeCount - lastCount);
            const skip = now - earlyAt < 1600 ? 1 : 0;
            for (let i = skip; i < n; i++) R.stroke(strength);
            earlyAt = 0;
          }
          lastCount = d.strokeCount;
        } else if (d.spm && d.spm > 10 && now - R._lastReal > 60000 / d.spm * 1.15) {
          // console sans compteur de coups : on cale les coups sur la cadence qu'elle annonce
          R.stroke(strength);
        }
      };
      ch.addEventListener('characteristicvaluechanged', handler);
      await ch.startNotifications();
      R.source = 'Bluetooth · ' + (device.name || 'FTMS');
      const onDisc = () => { R.source = 'déconnecté'; onStatus && onStatus('Rameur déconnecté.'); };
      device.addEventListener('gattserverdisconnected', onDisc);
      this.current = {
        kind: 'bluetooth',
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
      // On déclenche dès que l'accélération franchit le seuil (début de poussée),
      // pas à la fin du pic : ~200-400 ms gagnées.
      let filt = 0, peak = 0, armed = true, lastAt = 0, avgPeak = 3;
      const handler = (e) => {
        const a = e.acceleration && e.acceleration.x != null ? e.acceleration : null;
        let mag;
        if (a) mag = Math.hypot(a.x || 0, a.y || 0, a.z || 0);
        else {
          const g = e.accelerationIncludingGravity || {};
          mag = Math.abs(Math.hypot(g.x || 0, g.y || 0, g.z || 0) - 9.81);
        }
        filt = filt * 0.5 + mag * 0.5;
        const now = performance.now();
        const thr = Math.max(1.0, avgPeak * 0.4);
        if (armed && filt > thr && now - lastAt > 900) {
          armed = false; peak = filt; lastAt = now;
          R.stroke(1);
        } else if (!armed) {
          peak = Math.max(peak, filt);
          if (filt < thr * 0.5) { armed = true; avgPeak = avgPeak * 0.8 + peak * 0.2; }
        }
        R.emit('motion', filt);
      };
      window.addEventListener('devicemotion', handler);
      R.source = 'Accéléromètre';
      this.current = { stop() { window.removeEventListener('devicemotion', handler); } };
    },

    /* MICRO : la roue (air ou magnétique) et la sangle font plus de bruit dès que la poussée
       commence. On détecte cette montée du volume : environ 30-80 ms après l'attaque réelle.
       Si le Bluetooth est connecté, il reste actif pour les mesures et le micro donne le rythme. */
    micSensitivity: 1.8,
    async mic() {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error("Micro inaccessible dans ce navigateur.");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
      const ac = Kit.Sound.ctx() || new AudioContext();
      const src = ac.createMediaStreamSource(stream);
      const hp = ac.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 120;   // coupe le grondement du sol
      const an = ac.createAnalyser(); an.fftSize = 512; an.smoothingTimeConstant = 0;
      src.connect(hp).connect(an);
      const buf = new Float32Array(an.fftSize);
      // On cherche une MONTÉE brutale du volume par rapport aux ~300 ms précédentes :
      // le bruit de la roue qui décroît pendant le retour ne déclenche donc rien.
      const hist = new Float32Array(48); let hi = 0;
      let prev = 0, last = 0, peak = 0, avgPeak = 0, inStroke = false, n = 0;
      const timer = setInterval(() => {
        an.getFloatTimeDomainData(buf);
        let sum = 0; for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
        const rms = Math.sqrt(sum / buf.length), now = performance.now();
        n++;
        hist[hi++ % hist.length] = rms;
        // niveau de référence : minimum entre 120 ms et 380 ms dans le passé
        let ref = Infinity;
        for (let k = 15; k < hist.length; k++) { const v = hist[(hi - 1 - k + hist.length * 4) % hist.length]; if (v < ref) ref = v; }
        const thr = ref * this.micSensitivity + 0.003;
        const minGap = Math.max(850, R.period * 1000 * 0.55);
        if (n > hist.length && rms > thr && rms > prev && now - last > minGap) {
          inStroke = true; last = now; peak = rms;
          R.stroke(avgPeak ? Math.max(0.6, Math.min(1.6, rms / (avgPeak * 0.6))) : 1);
        } else if (inStroke) {
          peak = Math.max(peak, rms);
          if (now - last > 600) { inStroke = false; avgPeak = avgPeak ? avgPeak * 0.8 + peak * 0.2 : peak; }
        }
        prev = rms;
        R.emit('level', { rms, thr });
      }, 8);
      const mic = {
        kind: 'mic',
        stop() { clearInterval(timer); stream.getTracks().forEach(t => t.stop()); try { src.disconnect(); } catch (e) {} }
      };
      if (this.current && this.current.kind === 'bluetooth') { if (this.aux) this.aux.stop(); this.aux = mic; R.source = 'Bluetooth + micro'; }
      else { this.stopCurrent(); this.current = mic; R.source = 'Micro'; }
    },

    /* Espace / clic / tap = un coup. Maintenir plus longtemps = coup plus fort. */
    manual() {
      this.stopCurrent();
      const down = (e) => {
        if (e.type === 'keydown' && (e.code !== 'Space' || e.repeat)) return;
        if (e.type === 'keydown') e.preventDefault();
        R.stroke(1);
      };
      const up = () => {};
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
        R.stroke(0.9 + Math.random() * 0.2);
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
