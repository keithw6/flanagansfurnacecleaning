/* Scenes. The street, the shop and Hank are pixel-art images generated with
   Higgsfield (img/). This file layers them and adds the moving parts on
   top: rain, the door opening and the camera pushing in, Hank talking and
   celebrating, flickering lights, dust and confetti.

   Canvas is 1344x752, the size of the background art. Effects are written
   in a 320x180 grid and scaled up, so they stay chunky like the art.      */
(function (root) {
  const W = 1344, H = 752, GX = W / 320, GY = H / 180;
  let ctx, mode = 'outside', t = 0, last = 0;
  const reduce = root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const SRC = {
    street: 'img/street.webp',
    shop: 'img/shop.webp',
    idle: 'img/hank-idle.webp',
    talk: 'img/hank-talk.webp',
    happy: 'img/hank-happy.webp',
  };
  const img = {};
  function load() {
    return Promise.all(Object.entries(SRC).map(([k, src]) => new Promise(res => {
      const i = new Image();
      i.onload = () => { img[k] = i; res(); };
      i.onerror = () => res();
      i.src = src;
    })));
  }

  // where things are in the art, in image pixels
  const DOOR = { x: 548, y: 268, w: 134, h: 260 };
  const HANK = { x: 580, y: 228, w: 420, h: 420 };
  const COUNTER_TOP = 512;                   // Hank is hidden below this line
  const LIGHTS = [[215, 40, 270, 32], [905, 40, 285, 32]];

  const host = { talking: false, mood: 'idle', frame: 'idle', nextFlip: 0 };
  const entry = { active: false, phase: 'open', zoom: 1, onDone: null };
  let doorOpen = 0;

  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const rain = Array.from({ length: 110 }, () => [rnd() * 340, rnd() * 180, 2 + rnd() * 2]);
  const motes = Array.from({ length: 22 }, () => [rnd() * 320, 20 + rnd() * 90, rnd() * 6.28]);
  const sparkles = [];

  // a rectangle on the 320x180 effects grid
  const rect = (x, y, w, h, col) => { ctx.fillStyle = col; ctx.fillRect(Math.round(x * GX), Math.round(y * GY), Math.ceil(w * GX), Math.ceil(h * GY)); };

  /* -------------------------------- outside ------------------------------- */
  function drawOutside() {
    ctx.save();
    if (entry.zoom > 1) {
      // push the camera in toward the open door
      const cx = DOOR.x + DOOR.w / 2, cy = DOOR.y + DOOR.h / 2;
      ctx.translate(W / 2, H / 2); ctx.scale(entry.zoom, entry.zoom); ctx.translate(-cx - (W / 2 - cx) / entry.zoom, -cy - (H / 2 - cy) / entry.zoom);
    }
    if (img.street) ctx.drawImage(img.street, 0, 0, W, H);
    else { ctx.fillStyle = '#1a143e'; ctx.fillRect(0, 0, W, H); }

    // the door fills with warm light as it opens
    if (doorOpen > 0) {
      ctx.globalAlpha = doorOpen * 0.85;
      ctx.fillStyle = '#ffe9b0';
      ctx.fillRect(DOOR.x, DOOR.y, DOOR.w, DOOR.h);
      ctx.globalAlpha = doorOpen * 0.25;
      ctx.beginPath(); ctx.moveTo(DOOR.x, DOOR.y + DOOR.h); ctx.lineTo(DOOR.x - 60, DOOR.y + DOOR.h + 70);
      ctx.lineTo(DOOR.x + DOOR.w + 60, DOOR.y + DOOR.h + 70); ctx.lineTo(DOOR.x + DOOR.w, DOOR.y + DOOR.h); ctx.fill();
      ctx.globalAlpha = 1;
    }

    // neon sign hum
    ctx.globalAlpha = 0.06 + 0.05 * Math.sin(t * 9) * (Math.sin(t * 0.7) > 0.9 ? 3 : 1);
    ctx.fillStyle = '#ff4fb0';
    ctx.fillRect(360, 82, 525, 95);
    ctx.globalAlpha = 1;

    ctx.restore();

    if (!reduce) {
      ctx.globalAlpha = 0.4;
      for (const d of rain) {
        d[1] += d[2] * 2.2; d[0] -= 0.6;
        if (d[1] > 180) { d[1] = -4; d[0] = Math.random() * 340; }
        rect(d[0], d[1], 0.4, 3.2, '#b9c8ff');
      }
      ctx.globalAlpha = 1;
    }
  }

  function stepEntry(dt) {
    const e = entry;
    if (!e.active) return;
    if (e.phase === 'open') {
      doorOpen = Math.min(1, doorOpen + dt * 2.2);
      if (doorOpen >= 1) e.phase = 'push';
    } else if (e.phase === 'push') {
      e.zoom += dt * e.zoom * 1.9;
      if (e.zoom >= 5) { e.active = false; const cb = e.onDone; e.onDone = null; cb && cb(); }
    }
  }

  /* --------------------------------- inside ------------------------------- */
  function drawInside() {
    const shop = img.shop;
    if (shop) ctx.drawImage(shop, 0, 0, W, H);
    else { ctx.fillStyle = '#2f5d62'; ctx.fillRect(0, 0, W, H); }

    // fluorescent flicker
    if (Math.sin(t * 31) > 0.96 || (t % 7 > 6.85)) {
      ctx.globalAlpha = 0.45; ctx.fillStyle = '#1a1020';
      const [x, y, w, h] = LIGHTS[1]; ctx.fillRect(x, y, w, h);
      ctx.globalAlpha = 1;
    }

    // Hank, between the wall and the counter
    if (t > host.nextFlip) {
      host.frame = host.mood === 'happy' ? 'happy' : host.talking ? (host.frame === 'talk' ? 'idle' : 'talk') : 'idle';
      host.nextFlip = t + (host.talking ? 0.09 + Math.random() * 0.08 : 0.05);
    }
    const sprite = img[host.frame] || img.idle;
    if (sprite) {
      const bob = host.mood === 'happy' ? -Math.abs(Math.sin(t * 7)) * 10 : Math.round(Math.sin(t * 2.1) * 2);
      ctx.save();
      ctx.beginPath(); ctx.rect(0, 0, W, COUNTER_TOP); ctx.clip();
      ctx.drawImage(sprite, HANK.x, HANK.y + bob, HANK.w, HANK.h);
      ctx.restore();
      // soft contact shadow on the counter edge
      ctx.globalAlpha = 0.25; ctx.fillStyle = '#000';
      ctx.fillRect(HANK.x + 40, COUNTER_TOP, HANK.w - 80, 6);
      ctx.globalAlpha = 1;
    }

    if (!reduce) {
      ctx.globalAlpha = 0.5;
      for (const m of motes) { m[2] += 0.01; rect(m[0] + Math.sin(m[2]) * 6, m[1] + Math.cos(m[2] * 0.7) * 4, 0.7, 0.7, '#f6f0d8'); }
      ctx.globalAlpha = 1;
    }
    for (let i = sparkles.length - 1; i >= 0; i--) {
      const s = sparkles[i]; s.y += s.vy; s.x += s.vx; s.vy += 0.04; s.life -= 1;
      rect(s.x, s.y, 1.6, 1.6, s.col);
      if (s.life <= 0) sparkles.splice(i, 1);
    }
  }

  /* --------------------------------- loop --------------------------------- */
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000 || 0);
    last = now; t += dt;
    stepEntry(dt);
    if (mode === 'outside') drawOutside(); else drawInside();
    requestAnimationFrame(frame);
  }

  root.HP_SCENE = {
    init(canvas) {
      canvas.width = W; canvas.height = H;
      ctx = canvas.getContext('2d');
      requestAnimationFrame(frame);
      return load();
    },
    setMode(m) { mode = m; doorOpen = 0; Object.assign(entry, { active: false, zoom: 1 }); },
    walkIn(onDone) {
      root.HP_AUDIO && root.HP_AUDIO.door();
      if (reduce) { setTimeout(onDone, 300); return; }
      Object.assign(entry, { active: true, phase: 'open', zoom: 1, onDone });
    },
    talk(on) { host.talking = on; if (!on) host.nextFlip = 0; },
    mood(m) { host.mood = m; host.nextFlip = 0; },
    celebrate() {
      host.mood = 'happy'; host.nextFlip = 0;
      const cols = ['#ffc93c', '#e23b3b', '#3fa7d6', '#ffffff', '#7ee08a'];
      for (let i = 0; i < 90; i++) sparkles.push({ x: 188, y: 60, vx: (Math.random() - 0.5) * 4, vy: -Math.random() * 3 - 1, life: 60 + Math.random() * 40, col: cols[i % cols.length] });
    },
  };
})(window);
