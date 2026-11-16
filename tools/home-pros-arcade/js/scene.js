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
    office: 'img/office.webp',
    'dir-keith': 'img/dir-keith.webp',
    'dir-grace': 'img/dir-grace.webp',
    'dir-penny': 'img/dir-penny.webp',
    'dir-max': 'img/dir-max.webp',
    'dir-eddie': 'img/dir-eddie.webp',
    'dir-rosa': 'img/dir-rosa.webp',
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

  /* ------------------------- head office (overhead) ------------------------- */
  /* The office map (img/office.webp) is laid out on a 2000x1131 grid; every
     point below is in that grid and scaled to the canvas when drawn. Each
     place has a "chain": the walk from that spot out to the hallway. A route
     between two places is one chain out, along the hallway, the other chain in. */
  const MW = 2000, MH = 1131, SX = W / MW, SY = H / MH;
  const FW = 220, FH = 440, PERSON_H = 100;          // character frames, height on the map grid
  const PLACES = {
    // desks: chair spot first, then out through the door to the hallway
    gm:    { face: 0, chain: [[372, 290], [505, 290], [505, 390], [375, 430], [375, 500], [375, 585]] },
    acct:  { face: 0, chain: [[792, 290], [920, 290], [920, 390], [800, 430], [800, 500], [800, 585]] },
    mkt:   { face: 0, chain: [[1213, 290], [1095, 290], [1095, 390], [1232, 430], [1232, 500], [1232, 585]] },
    email: { face: 0, chain: [[350, 965], [350, 880], [372, 860], [372, 690], [372, 585]] },
    cs:    { face: 0, chain: [[767, 965], [767, 880], [777, 860], [777, 690], [777, 585]] },
    cho:   { face: 0, chain: [[1222, 975], [1222, 880], [1212, 860], [1212, 690], [1212, 585]] },
    // visiting spots, in front of or beside each desk
    'v-gm':    { face: 3, chain: [[400, 385], [375, 430], [375, 500], [375, 585]] },
    'v-acct':  { face: 3, chain: [[820, 385], [800, 430], [800, 500], [800, 585]] },
    'v-mkt':   { face: 3, chain: [[1190, 385], [1232, 430], [1232, 500], [1232, 585]] },
    'v-email': { face: 1, chain: [[475, 990], [470, 880], [372, 860], [372, 690], [372, 585]] },
    'v-cs':    { face: 1, chain: [[895, 990], [890, 880], [777, 860], [777, 690], [777, 585]] },
    'v-cho':   { face: 2, chain: [[1050, 1000], [1050, 880], [1212, 860], [1212, 690], [1212, 585]] },
    cooler:    { face: 2, chain: [[1800, 930], [1800, 820], [1500, 820], [1500, 585], [1440, 585]] },
    shop:      { face: 2, chain: [[110, 600], [170, 585]] },
    // boardroom seats: top row faces you, bottom row faces the table, head faces left
    'seat-t1': { face: 0, chain: [[1597, 555], [1597, 440], [1500, 440], [1500, 585], [1440, 585]] },
    'seat-t2': { face: 0, chain: [[1695, 555], [1695, 440], [1500, 440], [1500, 585], [1440, 585]] },
    'seat-t3': { face: 0, chain: [[1790, 555], [1790, 440], [1500, 440], [1500, 585], [1440, 585]] },
    'seat-b1': { face: 3, chain: [[1597, 760], [1597, 780], [1500, 780], [1500, 585], [1440, 585]] },
    'seat-b2': { face: 3, chain: [[1695, 760], [1695, 780], [1500, 780], [1500, 585], [1440, 585]] },
    'seat-b3': { face: 3, chain: [[1790, 760], [1790, 780], [1500, 780], [1500, 585], [1440, 585]] },
    'seat-head': { face: 1, chain: [[1885, 640], [1890, 780], [1500, 780], [1500, 585], [1440, 585]] },
  };
  // furniture people can be "behind": redrawn on top of anyone standing in it
  const DESKS = [[280, 238, 465, 345], [700, 238, 890, 345], [1122, 238, 1310, 345], [258, 925, 445, 1030],
    [675, 925, 862, 1030], [1080, 918, 1362, 1042], [1525, 518, 1862, 672]];
  const SHOP_DOOR = [40, 505, 150, 665];
  // whole office rooms, so clicking a room opens whoever works there
  const ROOMS = { gm: [165, 40, 590, 455], acct: [600, 40, 1005, 455], mkt: [1015, 40, 1460, 455],
    email: [165, 690, 575, 1065], cs: [585, 690, 980, 1065], cho: [995, 690, 1465, 1065] };

  const office = { people: [], selected: null, hover: null, meeting: false, onSeated: null };
  const rand = (a, b) => a + Math.random() * (b - a);

  function route(from, to) {
    const a = PLACES[from].chain, b = PLACES[to].chain;
    return a.slice(1).concat(b.slice().reverse().slice(1)).map(([x, y]) => ({ x, y }));
  }
  function goTo(p, place) {
    if (p.loc === place && !p.path.length) return;
    p.goal = place;
    if (!p.path.length) { p.path = route(p.loc, place); p.loc = null; }
  }
  
  function stepOffice(dt) {
    let seated = 0;
    for (const p of office.people) {
      p.walking = false;
      if (office.selected === p.id && !p.path.length) { p.dir = 0; continue; }
      if (p.path.length) {
        const n = p.path[0], dx = n.x - p.x, dy = n.y - p.y, d = Math.hypot(dx, dy);
        const v = 150 * dt;
        if (d <= v) { p.x = n.x; p.y = n.y; p.path.shift(); }
        else { p.x += dx / d * v; p.y += dy / d * v; }
        p.walking = true;
        p.dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 1 : 2) : (dy > 0 ? 0 : 3);
        if (!p.path.length) {
          if (p.goal) {
            p.loc = p.goal; p.dir = PLACES[p.loc].face; p.wait = p.errandWait || 4; p.errandWait = 0;
            if (p.onArrive) { const cb = p.onArrive; p.onArrive = null; cb(); }
          }
          // a stop on the way somewhere new: carry on
          if (p.next) { const nx = p.next; p.next = null; goTo(p, nx); }
        }
        continue;
      }
      if (p.loc && p.loc.startsWith('seat')) { seated++; continue; }
      // People stay in their offices. They only leave on an errand (taking
      // something to someone) or for a board meeting, then come straight back.
      if (office.meeting || p.loc === p.home) continue;
      p.wait -= dt;
      if (p.wait <= 0) { goTo(p, p.home); if (p.onBack) { const cb = p.onBack; p.onBack = null; p.whenHome = cb; } }
    }
    for (const p of office.people) if (p.whenHome && p.loc === p.home && !p.path.length) { const cb = p.whenHome; p.whenHome = null; cb(); }
    if (office.meeting && office.onSeated && seated === office.people.length) { const cb = office.onSeated; office.onSeated = null; cb(); }
  }

  function personBox(p) {
    const h = PERSON_H * SY, w = h * FW / FH;
    return { x: p.x * SX - w / 2, y: p.y * SY - h, w, h };
  }
  const behind = (p, d) => p.y > d[1] && p.y < d[3] + 4 && p.x > d[0] - 10 && p.x < d[2] + 10;

  function drawPerson(p) {
    const sheet = img['dir-' + p.id];
    if (!sheet) return;
    const b = personBox(p);
    ctx.globalAlpha = 0.3; ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.ellipse(p.x * SX, p.y * SY - 1, b.w * 0.4, b.w * 0.14, 0, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
    const sx0 = p.dir * FW;
    if (!p.walking || reduce) { ctx.drawImage(sheet, sx0, 0, FW, FH, b.x, b.y, b.w, b.h); return; }

    // Walking: the sprite is one still frame, so the legs are animated here.
    // Upper body and legs are drawn separately; the legs swing or lift on
    // every step, and the body bobs up on each footfall.
    const step = Math.sin(t * 11 + p.phase);              // -1..1, one stride per cycle
    const bob = -Math.abs(step) * b.h * 0.05;
    const HIP = 0.54, hipSrc = FH * HIP, hipY = b.y + b.h * HIP;
    const legH = b.h * (1 - HIP), half = FW / 2;
    // upper body (overlaps the hip a little so there is no seam)
    ctx.drawImage(sheet, sx0, 0, FW, hipSrc + 4, b.x, b.y + bob, b.w, b.h * HIP + 4 * b.h / FH);

    if (p.dir === 1 || p.dir === 2) {
      // side view: two copies of the legs swinging opposite ways like scissors,
      // the far leg darker
      const swing = step * 0.55;                           // horizontal shear: foot travel per unit height
      const leg = (k, dark) => {
        ctx.save();
        if (dark) ctx.filter = 'brightness(0.55)';
        ctx.translate(p.x * SX, hipY + bob);
        ctx.transform(1, 0, k, 1, 0, 0);
        ctx.drawImage(sheet, sx0, hipSrc, FW, FH - hipSrc, -b.w / 2, 0, b.w, legH - bob);
        ctx.restore();
      };
      leg(-swing, true);
      leg(swing, false);
    } else {
      // facing you or walking away: knees come up one at a time
      const lift = b.h * 0.12;
      const up = side => Math.max(0, side * step) * lift;  // how far this leg is raised
      for (const side of [-1, 1]) {
        const srcX = sx0 + (side < 0 ? 0 : half), dx = side < 0 ? b.x : b.x + b.w / 2;
        const raise = up(side);
        ctx.drawImage(sheet, srcX, hipSrc, half, FH - hipSrc, dx, hipY + bob, b.w / 2, legH - raise - bob);
      }
    }
  }

  function label(p) {
    const b = personBox(p);
    const text = p.name;
    ctx.font = "800 22px 'Barlow Condensed', sans-serif";
    const w = ctx.measureText(text).width + 14, x = p.x * SX - w / 2, y = b.y - 34;
    ctx.fillStyle = 'rgba(12,14,13,.88)'; ctx.fillRect(x, y, w, 26);
    ctx.fillStyle = '#3faa35'; ctx.fillRect(x, y + 24, w, 2);
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, p.x * SX, y + 13);
  }

  function drawOffice() {
    const map = img.office;
    if (map) ctx.drawImage(map, 0, 0, W, H);
    else { ctx.fillStyle = '#141715'; ctx.fillRect(0, 0, W, H); }
    const people = office.people.slice().sort((a, b) => a.y - b.y);
    const back = people.filter(p => DESKS.some(d => behind(p, d)));
    back.forEach(drawPerson);
    if (map) for (const d of DESKS) if (back.some(p => behind(p, d))) {
      const kx = map.naturalWidth / MW, ky = map.naturalHeight / MH;
      ctx.drawImage(map, d[0] * kx, d[1] * ky, (d[2] - d[0]) * kx, (d[3] - d[1]) * ky, d[0] * SX, d[1] * SY, (d[2] - d[0]) * SX, (d[3] - d[1]) * SY);
    }
    people.filter(p => !back.includes(p)).forEach(drawPerson);
    for (const p of people) {
      if (office.selected === p.id) {
        const b = personBox(p), cx = p.x * SX, top = b.y - 40 + Math.sin(t * 5) * 3;
        ctx.fillStyle = '#3faa35';
        ctx.beginPath(); ctx.moveTo(cx - 10, top - 12); ctx.lineTo(cx + 10, top - 12); ctx.lineTo(cx, top); ctx.fill();
      }
      if (office.selected === p.id || office.hover === p.id) label(p);
    }
  }

  /* --------------------------------- loop --------------------------------- */
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000 || 0);
    last = now; t += dt;
    stepEntry(dt);
    if (mode === 'office') { stepOffice(dt); drawOffice(); }
    else if (mode === 'outside') drawOutside(); else drawInside();
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
    get mode() { return mode; },
    walkIn(onDone) {
      root.HP_AUDIO && root.HP_AUDIO.door();
      if (reduce) { setTimeout(onDone, 300); return; }
      Object.assign(entry, { active: true, phase: 'open', zoom: 1, onDone });
    },
    talk(on) { host.talking = on; if (!on) host.nextFlip = 0; },
    office: {
      lights() {},
      // people: [{ id, name, home }] - everyone starts at their desk; Keith walks in from the shop
      enter(people) {
        office.selected = null; office.meeting = false; office.onSeated = null;
        office.people = people.map((d, i) => {
          const start = d.id === 'keith' ? 'shop' : d.home;
          const [x, y] = PLACES[start].chain[0];
          const p = { id: d.id, name: d.name, home: d.home, seat: d.seat, x, y, loc: start, goal: null, next: null, path: [], dir: PLACES[start].face, wait: rand(2, 12), phase: i, walking: false };
          if (d.id === 'keith') { if (reduce) { p.loc = d.home; [p.x, p.y] = PLACES[d.home].chain[0]; p.dir = 0; } else goTo(p, d.home); }
          return p;
        });
      },
      clear() { office.people = []; office.selected = null; office.meeting = false; },
      // walk someone to another place, wait there, then back to their desk
      errand(id, place, waitSec, onArrive, onBack) {
        const p = office.people.find(x => x.id === id);
        if (!p || office.meeting) return false;
        p.errandWait = waitSec; p.onArrive = onArrive || null; p.onBack = onBack || null;
        if (reduce) { onArrive && onArrive(); onBack && onBack(); return true; }
        if (p.path.length) p.next = place; else goTo(p, place);
        return true;
      },
      select(id) { office.selected = id; },
      hover(id) { office.hover = id; },
      // everyone to their boardroom seat (on) or back to their desks (off)
      meeting(on, onSeated) {
        office.meeting = on; office.onSeated = on ? onSeated : null;
        for (const p of office.people) {
          const target = on ? p.seat : p.home;
          if (reduce) { p.path = []; p.loc = target; [p.x, p.y] = PLACES[target].chain[0]; p.dir = PLACES[target].face; continue; }
          if (p.path.length) { p.next = target; continue; }
          goTo(p, target);
        }
      },
      // canvas pixel -> person id, or 'shop' for the exit door
      pick(px, py) {
        const hit = office.people.slice().sort((a, b) => b.y - a.y).find(p => {
          const b = personBox(p); return px >= b.x - 12 && px <= b.x + b.w + 12 && py >= b.y - 8 && py <= b.y + b.h + 6;
        });
        if (hit) return hit.id;
        const [x0, y0, x1, y1] = SHOP_DOOR;
        if (px >= x0 * SX && px <= x1 * SX && py >= y0 * SY && py <= y1 * SY) return 'shop';
        for (const [room, [a, b, c, d]] of Object.entries(ROOMS))
          if (px >= a * SX && px <= c * SX && py >= b * SY && py <= d * SY) {
            const owner = office.people.find(p => p.home === room);
            return owner ? owner.id : null;
          }
        return null;
      },
      size: { W, H },
    },
    mood(m) { host.mood = m; host.nextFlip = 0; },
    celebrate() {
      host.mood = 'happy'; host.nextFlip = 0;
      const cols = ['#ffc93c', '#e23b3b', '#3fa7d6', '#ffffff', '#7ee08a'];
      for (let i = 0; i < 90; i++) sparkles.push({ x: 188, y: 60, vx: (Math.random() - 0.5) * 4, vy: -Math.random() * 3 - 1, life: 60 + Math.random() * 40, col: cols[i % cols.length] });
    },
  };
})(window);
