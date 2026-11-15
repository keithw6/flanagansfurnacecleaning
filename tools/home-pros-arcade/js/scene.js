/* Pixel-art scenes, drawn on a 320x180 canvas and scaled up with crisp
   pixels. Two scenes: the street outside the shop, and the shop counter
   with the host. Text (the neon sign, menu board, banners) is HTML laid
   over the canvas so it stays sharp. No image files.                       */
(function (root) {
  const W = 320, H = 180;
  let ctx, mode = 'outside', t = 0, last = 0;
  const reduce = root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const C = {
    K: '#1a1020', C: '#e23b3b', c: '#a8262b', Y: '#ffc93c', S: '#f0b98d', s: '#c98a62',
    H: '#5a3a22', M: '#4a2a17', E: '#1a1020', P: '#24408e', p: '#182c66', m: '#6e1f28',
    W: '#ffffff', R: '#ff6f6f',
  };

  /* The host. Left half only; it is mirrored, so he is symmetric. */
  const HOST_HALF = [
    '..........KKKKKK',
    '........KKCCCCCC',
    '.......KCCCCCCCY',
    '......KCCCCCCCYY',
    '......KCCCCCCCYY',
    '......KCCCCCCCCC',
    '....KKcccccccccc',
    '...Kcccccccccccc',
    '....KKKKKKKKKKKK',
    '......KHHSSSSSSS',
    '.....KHSSSSSSSSS',
    '.....KSSSSSKKSSS',
    '....KsSSSSSSESSS',
    '....KsSSSSSSESSS',
    '.....KSSSSSSSSSs',
    '.....KSSSSMMMMMM',
    '.....KSSSMMMMMMM',
    '......KSSSSSSSSS',
    '......KSSSSSSSSS',
    '.......KSSSSSSSS',
    '........KKSSSSSS',
    '..........KsssSS',
    '.......KKKPYssss',
    '.....KKPPPPPYsss',
    '...KKPPPPPPPPYss',
    '..KPPPPPPPPPPPYs',
    '.KPPPPPPPPPPPPPY',
    '.KPPPPPPPPPPPPPP',
    'KPpPPPPPPPPPPPPP',
    'KPpPPPPPPPPPPPPP',
    'KPpPPPPPPPPPPPPP',
    'KPpPPPPPPPPPPPPP',
    'KPpPPPPPPPPPPPPP',
  ];
  const HOST = HOST_HALF.map(r => r + r.split('').reverse().join(''));

  const host = { talking: false, mood: 'idle', blinkUntil: 0, nextBlink: 2, wave: 0 };
  const walker = { active: false, x: -12, y: 0, phase: 'walk', onDone: null, alpha: 1 };
  let doorOpen = 0;

  // deterministic "random" so the city skyline is the same every load
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const stars = Array.from({ length: 40 }, () => [rnd() * W, rnd() * 50, rnd()]);
  const skyline = [];
  for (let x = 0; x < W;) { const w = 14 + rnd() * 22 | 0, h = 30 + rnd() * 50 | 0; skyline.push([x, w, h, Array.from({ length: 40 }, () => rnd() > 0.72)]); x += w + 1; }
  const rain = Array.from({ length: 90 }, () => [rnd() * W, rnd() * H, 2 + rnd() * 2]);
  const motes = Array.from({ length: 18 }, () => [rnd() * W, 14 + rnd() * 90, rnd() * 6.28]);
  const sparkles = [];

  const rect = (x, y, w, h, col) => { ctx.fillStyle = col; ctx.fillRect(x | 0, y | 0, w | 0, h | 0); };

  function sprite(rows, x, y, scale, swap) {
    for (let r = 0; r < rows.length; r++) for (let c = 0; c < rows[r].length; c++) {
      let ch = rows[r][c];
      if (swap) ch = swap(r, c, ch);
      if (ch === '.' || !C[ch]) continue;
      rect(x + c * scale, y + r * scale, scale, scale, C[ch]);
    }
  }

  /* -------------------------------- outside ------------------------------- */
  function drawOutside() {
    const sky = ['#0c0a22', '#120f30', '#1a143e', '#24184a', '#311c52', '#3f2056'];
    for (let i = 0; i < sky.length; i++) rect(0, i * 17, W, 17, sky[i]);
    rect(0, 102, W, 60, sky[5]);
    for (const [x, y, p] of stars) if (Math.sin(t * 2 + p * 20) > -0.3) rect(x, y, 1, 1, p > 0.8 ? '#ffe9a8' : '#8f86c9');
    // moon
    rect(212, 12, 10, 10, '#f3e6c0'); rect(210, 14, 14, 6, '#f3e6c0'); rect(216, 13, 4, 3, '#d9c99d');
    // skyline
    for (const [x, w, h, lit] of skyline) {
      rect(x, 120 - h, w, h, '#1b1735');
      let k = 0;
      for (let wy = 124 - h; wy < 112; wy += 6) for (let wx = x + 2; wx < x + w - 2; wx += 4) if (lit[k++ % 40]) rect(wx, wy, 2, 3, '#ffd86b');
    }

    // building
    rect(66, 30, 188, 112, '#5e2a26');
    for (let y = 40; y < 140; y += 4) {
      rect(66, y, 188, 1, '#4a1f1c');
      for (let x = 66 + ((y / 4) % 2) * 4; x < 254; x += 8) rect(x, y, 1, 4, '#4a1f1c');
    }
    rect(62, 28, 196, 6, '#2b1517'); rect(62, 34, 196, 2, '#7a3a33');
    rect(80, 40, 160, 26, '#120d1c'); rect(80, 40, 160, 1, '#2d2340'); // sign panel
    // awning
    for (let x = 70; x < 250; x += 10) {
      rect(x, 68, 5, 10, '#e23b3b'); rect(x + 5, 68, 5, 10, '#f4ead2');
      rect(x + 1, 78, 3, 2, '#e23b3b'); rect(x + 6, 78, 3, 2, '#f4ead2');
    }
    rect(68, 66, 184, 2, '#2b1517');

    // windows, with the shop lit up inside
    for (const wx of [78, 182]) {
      rect(wx - 2, 84, 64, 54, '#2b1517');
      rect(wx, 86, 60, 50, '#ffcf7a'); rect(wx, 112, 60, 24, '#f2b95e');
      rect(wx, 86, 60, 2, '#fff1c4');
    }
    // left window: a furnace on display
    rect(92, 96, 20, 36, '#9aa4b5'); rect(92, 96, 20, 2, '#c7cfdb'); rect(95, 102, 14, 8, '#6d7686');
    rect(96, 114, 12, 1, '#6d7686'); rect(96, 118, 12, 1, '#6d7686'); rect(96, 122, 12, 1, '#6d7686');
    rect(112, 100, 18, 6, '#c7cfdb'); rect(126, 88, 6, 18, '#c7cfdb'); // duct
    // "OPEN" sign
    const open = Math.sin(t * 3) > -0.8;
    rect(118, 120, 16, 8, '#2a0d17');
    if (open) { rect(119, 121, 14, 6, '#ff3d6e'); rect(121, 123, 10, 2, '#ffd1dc'); }
    // right window: dryer vent and coiled duct
    rect(194, 104, 22, 26, '#e9edf3'); rect(198, 108, 14, 14, '#9aa4b5'); rect(201, 111, 8, 8, '#e9edf3');
    for (let i = 0; i < 6; i++) rect(220 + i * 4, 112 - (i % 2) * 2, 3, 14, i % 2 ? '#c7cfdb' : '#a9b2c1');

    // door
    rect(146, 82, 28, 58, '#2b1517');
    const dw = 24 * (1 - doorOpen);
    rect(148, 84, 24, 56, '#fff6dc');
    rect(148, 84, dw, 56, '#3a6f78'); rect(150, 86, Math.max(0, dw - 4), 30, '#9fd6db');
    if (dw > 6) rect(148 + dw - 5, 114, 2, 5, '#ffc93c');

    // street lamp
    ctx.globalAlpha = 0.13 + 0.03 * Math.sin(t * 7);
    ctx.fillStyle = '#ffe28a';
    ctx.beginPath(); ctx.moveTo(30, 66); ctx.lineTo(6, 156); ctx.lineTo(60, 156); ctx.closePath(); ctx.fill();
    ctx.globalAlpha = 1;
    rect(32, 64, 3, 92, '#24222e'); rect(26, 62, 14, 4, '#24222e'); rect(28, 66, 10, 2, '#fff2b8');

    // sidewalk, curb, road
    rect(0, 140, W, 16, '#4c4b5c');
    for (let x = 0; x < W; x += 24) rect(x, 140, 1, 16, '#3c3b4a');
    rect(0, 140, W, 1, '#6a6980');
    rect(0, 156, W, 3, '#8a8a9d');
    rect(0, 159, W, 21, '#23222d');
    for (let x = ((t * 0) | 0); x < W; x += 28) rect(x, 169, 14, 2, '#d6b24a');
    // neon reflections in the wet road
    ctx.globalAlpha = 0.18 + 0.06 * Math.sin(t * 4);
    for (let y = 160; y < 180; y += 2) rect(96 + Math.sin(y + t * 5) * 3, y, 128, 1, y % 4 ? '#ff4f9a' : '#40e0ff');
    ctx.globalAlpha = 1;

    // the work van
    rect(240, 140, 72, 24, '#eef0f6'); rect(240, 140, 72, 2, '#ffffff');
    rect(286, 132, 26, 10, '#eef0f6'); rect(290, 134, 18, 7, '#28324a');
    rect(240, 150, 72, 4, '#e23b3b'); rect(240, 154, 72, 2, '#24408e');
    rect(250, 162, 12, 8, '#111'); rect(253, 164, 6, 4, '#666');
    rect(290, 162, 12, 8, '#111'); rect(293, 164, 6, 4, '#666');
    rect(310, 146, 3, 4, '#ffe28a');

    // the customer walking in
    if (walker.active) drawWalker();

    // rain
    if (!reduce) for (const d of rain) {
      d[1] += d[2] * 2.2; d[0] -= 0.6;
      if (d[1] > H) { d[1] = -4; d[0] = Math.random() * (W + 40); }
      ctx.globalAlpha = 0.45; rect(d[0], d[1], 1, 4, '#9fb8ff'); ctx.globalAlpha = 1;
    }
  }

  const PLAYER = [
    '..KKKK..',
    '.KHHHHK.',
    '.KSSSHK.',
    '.KSSSSK.',
    '..KSSK..',
    '.KYYYYK.',
    'KYYYYYYK',
    'KYYYYYYK',
    'KSYYYYSK',
    '.KYYYYK.',
    '.KPPPPK.',
    '.KPPPPK.',
  ];
  function drawWalker() {
    const w = walker;
    ctx.globalAlpha = w.alpha;
    const leg = Math.floor(t * 8) % 2;
    const x = w.x, y = 124 + w.y;
    C.Y = '#3fa7d6';
    sprite(PLAYER, x, y, 1);
    C.Y = '#ffc93c';
    if (w.phase === 'walk') {
      rect(x + 2, y + 12, 2, 4, leg ? '#24408e' : '#182c66'); rect(x + 4, y + 12, 2, 4, leg ? '#182c66' : '#24408e');
      rect(x + 1 + leg * 3, y + 16, 3, 1, '#1a1020');
    } else {
      rect(x + 2, y + 12, 2, 4, '#24408e'); rect(x + 4, y + 12, 2, 4, '#24408e');
    }
    ctx.globalAlpha = 1;
  }

  function stepWalker(dt) {
    const w = walker;
    if (!w.active) return;
    if (w.phase === 'walk') {
      w.x += dt * 70;
      if (w.x >= 156) { w.x = 156; w.phase = 'door'; root.HP_AUDIO && root.HP_AUDIO.door(); }
    } else if (w.phase === 'door') {
      doorOpen = Math.min(1, doorOpen + dt * 3);
      if (doorOpen >= 1) w.phase = 'in';
    } else if (w.phase === 'in') {
      w.y -= dt * 18; w.alpha = Math.max(0, w.alpha - dt * 1.8);
      if (w.alpha <= 0) { w.active = false; const cb = w.onDone; w.onDone = null; cb && cb(); }
    }
  }

  /* --------------------------------- inside ------------------------------- */
  function drawInside() {
    // ceiling and lights
    rect(0, 0, W, 12, '#221a2b');
    const flick = Math.sin(t * 31) > 0.97 ? 0.5 : 1;
    for (const lx of [36, 146, 256]) {
      rect(lx, 4, 36, 3, flick > 0.6 || lx !== 256 ? '#f4fff6' : '#9fb3a6');
      ctx.globalAlpha = 0.07;
      ctx.fillStyle = '#e9fff0';
      ctx.beginPath(); ctx.moveTo(lx, 7); ctx.lineTo(lx - 20, 118); ctx.lineTo(lx + 56, 118); ctx.lineTo(lx + 36, 7); ctx.fill();
      ctx.globalAlpha = 1;
    }
    // wall
    rect(0, 12, W, 106, '#2f5d62');
    for (let x = 0; x < W; x += 20) rect(x, 12, 1, 80, '#29525a');
    rect(0, 12, W, 2, '#1d3b40');
    rect(0, 92, W, 26, '#4a3326'); rect(0, 92, W, 2, '#6b4a35'); rect(0, 116, W, 2, '#2e1f17');
    // floor
    for (let y = 118; y < H; y += 10) for (let x = 0; x < W; x += 10) rect(x, y, 10, 10, ((x + y) / 10) % 2 ? '#d9d2c3' : '#a89f8f');

    // menu board with chasing marquee bulbs
    rect(10, 18, 120, 80, '#3b2a20'); rect(13, 21, 114, 74, '#0d0d14');
    let b = 0;
    const chase = Math.floor(t * 6);
    const bulb = (x, y) => { const on = (b++ + chase) % 3 !== 0; rect(x, y, 2, 2, on ? '#ffe28a' : '#6b5a2e'); };
    for (let x = 12; x <= 126; x += 6) { bulb(x, 18); }
    for (let y = 24; y <= 92; y += 6) bulb(126, y);
    for (let x = 126; x >= 12; x -= 6) bulb(x, 96);
    for (let y = 92; y >= 24; y -= 6) bulb(10, y);

    // banner behind the host
    rect(140, 18, 96, 14, '#e23b3b'); rect(140, 30, 96, 2, '#a8262b');
    rect(140, 18, 2, 14, '#ffc93c'); rect(234, 18, 2, 14, '#ffc93c');

    // pegboard with tools of the trade
    rect(246, 38, 66, 52, '#c8a46a');
    for (let y = 41; y < 88; y += 4) for (let x = 249; x < 310; x += 4) rect(x, y, 1, 1, '#8a6a3a');
    rect(252, 44, 16, 20, '#f4f4f4'); for (let x = 254; x < 268; x += 2) rect(x, 46, 1, 16, '#c9c9c9'); // filter
    rect(274, 42, 1, 26, '#555'); for (let y = 52; y < 68; y += 2) rect(271, y, 7, 1, '#2a2a2a'); // brush
    rect(286, 46, 18, 14, '#7f8796'); rect(290, 50, 10, 6, '#c8a46a'); // coiled hose
    for (let i = 0; i < 5; i++) rect(254 + i * 6, 70 + (i % 2), 5, 14, i % 2 ? '#d7dde6' : '#aeb7c4'); // flex duct
    rect(288, 68, 18, 16, '#3a3a46'); rect(290, 70, 14, 6, '#ffc93c'); // toolbox

    // plaque
    rect(140, 40, 22, 26, '#6b4a35'); rect(142, 42, 18, 22, '#f2e6c4'); rect(146, 46, 10, 10, '#ffc93c'); rect(148, 48, 6, 6, '#e8a92b');

    // the host (2x pixels)
    drawHost();

    // counter
    rect(118, 104, 202, 6, '#c9ccd8'); rect(118, 104, 202, 1, '#ffffff'); rect(118, 109, 202, 1, '#8b8e9c');
    rect(122, 110, 198, 40, '#a8262b');
    rect(122, 118, 198, 3, '#ffc93c');
    rect(122, 144, 198, 6, '#24408e');
    for (let x = 122; x < 320; x += 33) rect(x, 110, 1, 34, '#8c1f24');
    // register
    rect(270, 86, 32, 18, '#5a5d6b'); rect(272, 88, 28, 6, '#1d2a1a'); rect(274, 89, 24, 4, '#ffb347');
    for (let k = 0; k < 6; k++) rect(274 + k * 4, 97, 3, 2, '#d0d3de');
    rect(266, 100, 40, 4, '#454856');
    // service bell
    rect(134, 100, 10, 4, '#ffc93c'); rect(138, 98, 2, 2, '#ffe28a'); rect(132, 103, 14, 1, '#6b5a2e');
    // potted plant
    rect(12, 136, 16, 14, '#b3542f'); rect(10, 134, 20, 3, '#8c3e22');
    for (const [x, y, w, h] of [[14, 118, 4, 16], [19, 112, 3, 22], [23, 120, 4, 14], [10, 124, 5, 4], [25, 116, 5, 4]]) rect(x, y, w, h, '#3c8d4a');

    // dust in the light
    if (!reduce) {
      ctx.globalAlpha = 0.5;
      for (const m of motes) { m[2] += 0.01; rect(m[0] + Math.sin(m[2]) * 6, m[1] + Math.cos(m[2] * 0.7) * 4, 1, 1, '#f6f0d8'); }
      ctx.globalAlpha = 1;
    }
    for (let i = sparkles.length - 1; i >= 0; i--) {
      const s = sparkles[i]; s.y += s.vy; s.x += s.vx; s.vy += 0.04; s.life -= 1;
      rect(s.x, s.y, 2, 2, s.col);
      if (s.life <= 0) sparkles.splice(i, 1);
    }
  }

  function drawHost() {
    const breathe = Math.sin(t * 2.2) > 0.6 ? 1 : 0;
    const bob = host.mood === 'happy' ? Math.round(Math.abs(Math.sin(t * 8)) * -2) : 0;
    const x = 170, y = 38 + breathe + bob;
    const blinking = t < host.blinkUntil;
    const mouthOpen = host.talking && Math.floor(t * 11) % 2 === 0;
    sprite(HOST, x, y, 2, (r, c, ch) => {
      if (blinking && (r === 12 || r === 13) && ch === 'E') return r === 13 ? 'K' : 'S';
      if (r === 17 && c >= 13 && c <= 18) {
        if (host.mood === 'happy') return c === 13 || c === 18 ? 'm' : 'W';
        if (mouthOpen) return 'm';
        if (c >= 14 && c <= 17) return 'm';
      }
      if (r === 18 && c >= 14 && c <= 17) {
        if (host.mood === 'happy') return 'm';
        if (mouthOpen) return 'R';
      }
      return ch;
    });
    // body down to the counter, name tag, hands
    rect(x, y + 66, 64, 104 - (y + 66), C.P);
    rect(x, y + 66, 2, 104 - (y + 66), C.K); rect(x + 62, y + 66, 2, 104 - (y + 66), C.K);
    rect(x + 40, y + 58, 12, 6, '#ffffff'); rect(x + 41, y + 60, 10, 2, '#e23b3b');
    rect(x + 6, 99, 14, 6, C.K); rect(x + 7, 100, 12, 5, C.S);
    rect(x + 44, 99, 14, 6, C.K); rect(x + 45, 100, 12, 5, C.S);

    if (t > host.nextBlink) { host.blinkUntil = t + 0.14; host.nextBlink = t + 2.5 + Math.random() * 3; }
  }

  /* --------------------------------- loop --------------------------------- */
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000 || 0);
    last = now; t += dt;
    stepWalker(dt);
    if (mode === 'outside') drawOutside(); else drawInside();
    requestAnimationFrame(frame);
  }

  root.HP_SCENE = {
    init(canvas) {
      canvas.width = W; canvas.height = H;
      ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      requestAnimationFrame(frame);
    },
    setMode(m) { mode = m; doorOpen = 0; walker.active = false; },
    walkIn(onDone) {
      if (reduce) { root.HP_AUDIO && root.HP_AUDIO.door(); setTimeout(onDone, 300); return; }
      Object.assign(walker, { active: true, x: -12, y: 0, phase: 'walk', alpha: 1, onDone });
    },
    talk(on) { host.talking = on; },
    mood(m) { host.mood = m; },
    celebrate() {
      host.mood = 'happy';
      const cols = ['#ffc93c', '#e23b3b', '#3fa7d6', '#ffffff', '#7ee08a'];
      for (let i = 0; i < 70; i++) sparkles.push({ x: 202, y: 50, vx: (Math.random() - 0.5) * 4, vy: -Math.random() * 3 - 1, life: 60 + Math.random() * 40, col: cols[i % cols.length] });
    },
  };
})(window);
