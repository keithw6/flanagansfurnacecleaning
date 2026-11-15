/* Chiptune sound effects and a quiet shop tune, synthesized with WebAudio.
   Nothing plays until the customer presses Start (browsers require a tap). */
(function (root) {
  let ac, master, musicGain, musicTimer, step = 0, nextTime = 0;
  let muted = false;
  try { muted = localStorage.getItem('hp-muted') === '1'; } catch (e) {}

  function ensure() {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return true; }
    const AC = root.AudioContext || root.webkitAudioContext;
    if (!AC) return false;
    ac = new AC();
    master = ac.createGain(); master.gain.value = muted ? 0 : 0.5; master.connect(ac.destination);
    musicGain = ac.createGain(); musicGain.gain.value = 0.16; musicGain.connect(master);
    return true;
  }

  function tone(freq, start, dur, type = 'square', vol = 0.2, dest) {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, start);
    g.gain.setValueAtTime(vol, start);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    o.connect(g); g.connect(dest || master);
    o.start(start); o.stop(start + dur + 0.02);
  }

  function noise(start, dur, vol = 0.15) {
    const len = Math.floor(ac.sampleRate * dur), buf = ac.createBuffer(1, len, ac.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const s = ac.createBufferSource(), g = ac.createGain(), f = ac.createBiquadFilter();
    f.type = 'highpass'; f.frequency.value = 3000;
    s.buffer = buf; g.gain.value = vol; s.connect(f); f.connect(g); g.connect(master); s.start(start);
  }

  const fx = {
    blip() { if (!ac || muted) return; tone(520 + Math.random() * 120, ac.currentTime, 0.03, 'square', 0.05); },
    select() { if (!ensure()) return; const n = ac.currentTime; tone(660, n, 0.06, 'square', 0.12); tone(990, n + 0.06, 0.08, 'square', 0.1); },
    back() { if (!ensure()) return; const n = ac.currentTime; tone(440, n, 0.06, 'square', 0.1); tone(330, n + 0.06, 0.08, 'square', 0.08); },
    door() { if (!ensure()) return; const n = ac.currentTime; tone(1318, n, 0.6, 'triangle', 0.18); tone(1046, n + 0.22, 0.8, 'triangle', 0.16); },
    register() {
      if (!ensure()) return; const n = ac.currentTime;
      noise(n, 0.08, 0.2); tone(2093, n + 0.06, 0.25, 'triangle', 0.14); tone(2637, n + 0.12, 0.4, 'triangle', 0.12);
    },
    win() {
      if (!ensure()) return; const n = ac.currentTime;
      [523, 659, 784, 1046, 784, 1046, 1318].forEach((f, i) => tone(f, n + i * 0.09, 0.16, 'square', 0.12));
      tone(130, n, 0.7, 'triangle', 0.2);
    },
    error() { if (!ensure()) return; const n = ac.currentTime; tone(200, n, 0.15, 'sawtooth', 0.1); tone(150, n + 0.15, 0.25, 'sawtooth', 0.1); },
  };

  // A laid-back 8-bar shop loop: bass + a sparse lead.
  const BASS = [110, 0, 165, 0, 147, 0, 165, 0, 98, 0, 147, 0, 131, 0, 147, 0];
  const LEAD = [0, 440, 0, 0, 494, 0, 523, 0, 0, 392, 0, 0, 440, 0, 0, 0, 0, 440, 0, 0, 587, 0, 523, 0, 494, 0, 440, 0, 392, 0, 0, 0];
  function schedule() {
    while (nextTime < ac.currentTime + 0.3) {
      const b = BASS[step % 16], l = LEAD[step % 32];
      if (b) tone(b, nextTime, 0.22, 'triangle', 0.5, musicGain);
      if (l) tone(l, nextTime, 0.18, 'square', 0.12, musicGain);
      if (step % 4 === 2) { /* hat */ }
      nextTime += 0.2; step++;
    }
  }

  root.HP_AUDIO = Object.assign(fx, {
    start() {
      if (!ensure()) return;
      if (!musicTimer) { nextTime = ac.currentTime + 0.1; musicTimer = setInterval(schedule, 100); }
    },
    toggleMute() {
      muted = !muted;
      try { localStorage.setItem('hp-muted', muted ? '1' : '0'); } catch (e) {}
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    get muted() { return muted; },
  });
})(window);
