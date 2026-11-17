/* DUST BUNNY BLASTER: Hank's counter game. Dust bunnies burst out of the floor
   vents; zap them with the vacuum before they get away. 2 rounds, 20 bunnies,
   3 shots each. Zap 15 for 5% off, 18 for 10% off your cleaning.
   HP_BUNNY.mount(el, { onBook(prize), sound }) draws the brochure into el.
   HP_BUNNY.prize() -> {pct, code, until} or null (a win is kept for 30 days).   */
(function (root) {
  'use strict';
  const W = 256, H = 192;                       // logical pixels, scaled up
  const TOTAL = 20, PER_ROUND = 10, SHOTS = 3;
  const GOAL5 = 15, GOAL10 = 18, TRIES_PER_DAY = 3;
  const KEY_PRIZE = 'hp-bunny-prize', KEY_TRIES = 'hp-bunny-tries';
  const VENTS = [52, 128, 204];                 // vent centres on the floor
  const FLOOR = 150;

  const store = {
    get(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } },
  };
  const today = () => new Date().toISOString().slice(0, 10);
  function triesLeft() { const t = store.get(KEY_TRIES); return t && t.day === today() ? Math.max(0, TRIES_PER_DAY - t.n) : TRIES_PER_DAY; }
  function useTry() { const t = store.get(KEY_TRIES); store.set(KEY_TRIES, { day: today(), n: (t && t.day === today() ? t.n : 0) + 1 }); }
  function prize() { const p = store.get(KEY_PRIZE); return p && p.until > Date.now() ? p : null; }
  function savePrize(pct) {
    const old = prize();
    if (old && old.pct >= pct) return old;
    const code = 'BUNNY' + pct + '-' + Math.random().toString(36).slice(2, 6).toUpperCase();
    const p = { pct, code, until: Date.now() + 30 * 864e5 };
    store.set(KEY_PRIZE, p);
    return p;
  }

  // ---------------------------------------------------------------- sprites
  const PAL = { d: '#4d524f', G: '#b8bcb8', L: '#dfe2df', w: '#ffffff', k: '#111111', p: '#ff8fb3', r: '#e23b3b' };
  const BUN = [[
    '...dd..dd...',
    '..dLGddGLd..',
    '..dLGddGLd..',
    '.dGGGGGGGGd.',
    'dGLGGGGGGLGd',
    'dGGwkGGwkGGd',
    'dGGGGGGGGGGd',
    'dGLGGppGGLGd',
    '.dGGGGGGGGd.',
    '..dGdGGdGd..',
    '...d.dd.d...',
  ], [
    '..dd....dd..',
    '..dLd..dLd..',
    '..dLGddGLd..',
    '.dGGGGGGGGd.',
    'dGLGGGGGGLGd',
    'dGGwkGGwkGGd',
    'dGGGGGGGGGGd',
    'dGLGGppGGLGd',
    '.dGGGGGGGGd.',
    '.dGd.dd.dGd.',
    '..d......d..',
  ]];
  const DIZZY = [
    '...dd..dd...',
    '..dLGddGLd..',
    '.dGGGGGGGGd.',
    'dGLGGGGGGLGd',
    'dGkGkGGkGkGd',
    'dGGkGGGGkGGd',
    'dGkGkGGkGkGd',
    'dGGGGrrGGGGd',
    '.dGGGGGGGGd.',
    '..dGdGGdGd..',
    '...d.dd.d...',
  ];
  function sprite(g, rows, x, y, s = 1) {
    for (let j = 0; j < rows.length; j++) for (let i = 0; i < rows[j].length; i++) {
      const c = rows[j][i]; if (c === '.') continue;
      g.fillStyle = PAL[c]; g.fillRect(Math.round(x + i * s), Math.round(y + j * s), Math.ceil(s), Math.ceil(s));
    }
  }

  // ------------------------------------------------------------- the scene
  function drawRoom(g, t) {
    // wall
    g.fillStyle = '#26332c'; g.fillRect(0, 0, W, FLOOR);
    g.fillStyle = '#2c3b33'; for (let x = 0; x < W; x += 16) g.fillRect(x, 0, 8, FLOOR);
    // window with a little sky
    g.fillStyle = '#0d1410'; g.fillRect(150, 22, 70, 52);
    g.fillStyle = '#21405a'; g.fillRect(153, 25, 64, 46);
    g.fillStyle = '#e8eef0'; g.fillRect(160 + ((t / 400) % 60), 34, 14, 4); g.fillRect(164 + ((t / 400) % 60), 31, 8, 3);
    g.fillStyle = '#0d1410'; g.fillRect(184, 25, 2, 46); g.fillRect(153, 47, 64, 2);
    // picture frame: the Home Pros shield
    g.fillStyle = '#7a5530'; g.fillRect(30, 30, 40, 34);
    g.fillStyle = '#121614'; g.fillRect(33, 33, 34, 28);
    g.fillStyle = '#3faa35'; g.fillRect(43, 38, 14, 12); g.fillRect(45, 50, 10, 3); g.fillRect(47, 53, 6, 2);
    g.fillStyle = '#f4f6f4'; g.fillRect(46, 40, 2, 8); g.fillRect(52, 40, 2, 8); g.fillRect(48, 43, 4, 2);
    // wainscot and baseboard
    g.fillStyle = '#1b231e'; g.fillRect(0, 112, W, 38);
    g.fillStyle = '#3faa35'; g.fillRect(0, 110, W, 2);
    g.fillStyle = '#0f1411'; g.fillRect(0, FLOOR - 4, W, 4);
    // floor: green and black checks, like the shop
    for (let y = FLOOR; y < H; y += 10) for (let x = 0; x < W; x += 16) {
      g.fillStyle = ((x / 16 + (y - FLOOR) / 10) % 2) ? '#2f7d29' : '#0e130f';
      g.fillRect(x, y, 16, 10);
    }
    // floor vents
    for (const vx of VENTS) {
      g.fillStyle = '#0a0c0b'; g.fillRect(vx - 15, FLOOR + 2, 30, 9);
      g.fillStyle = '#9aa09c'; g.fillRect(vx - 14, FLOOR + 3, 28, 7);
      g.fillStyle = '#3d423f'; for (let i = 0; i < 6; i++) g.fillRect(vx - 12 + i * 5, FLOOR + 4, 2, 5);
    }
  }

  // ----------------------------------------------------------------- mount
  function mount(el, opts = {}) {
    const S = opts.sound || {};
    const snd = k => { try { S[k] && S[k](); } catch (e) { } };
    el.innerHTML = `
      <div class="bb">
        <div class="bb-head">
          <div class="bb-title">DUST BUNNY<br>BLASTER</div>
          <div class="bb-sub">Zap the dust bunnies before they get away.<br><b>Win up to 10% off</b> your duct cleaning.</div>
        </div>
        <ul class="bb-rules">
          <li><b>Tap or click</b> a dust bunny to zap it. You get <b>3 shots</b> per bunny.</li>
          <li><b>20 bunnies</b> in 2 rounds. Round 2 is faster, and they come two at a time.</li>
          <li>Zap <b>${GOAL5}</b> for <b>5% off</b>. Zap <b>${GOAL10}</b> for <b>10% off</b>.</li>
          <li>${TRIES_PER_DAY} tries a day. Your prize is saved for 30 days and Rosa applies it when you book.</li>
        </ul>
        <div class="bb-screen">
          <canvas class="bb-canvas" width="${W}" height="${H}" aria-label="Dust Bunny Blaster game"></canvas>
          <div class="bb-overlay"></div>
        </div>
        <div class="bb-hud">
          <span class="bb-round">ROUND 1</span>
          <span class="bb-shots" aria-label="Shots left"></span>
          <span class="bb-tally" aria-label="Bunnies zapped"></span>
          <span class="bb-score">0/${TOTAL}</span>
        </div>
        <div class="bb-foot">
          <p class="bb-msg" aria-live="polite"></p>
          <div class="bb-btns">
            <button type="button" class="bb-play">&#9654; PLAY</button>
            <button type="button" class="bb-book">BOOK NOW</button>
          </div>
        </div>
      </div>`;
    const $ = s => el.querySelector(s);
    const cv = $('.bb-canvas'), g = cv.getContext('2d');
    g.imageSmoothingEnabled = false;
    const ov = $('.bb-overlay'), msg = $('.bb-msg'), playBtn = $('.bb-play'), bookBtn = $('.bb-book');

    let game = null, raf = 0, last = 0, aim = { x: W / 2, y: H / 2, on: false }, flashT = 0;

    function setFoot() {
      const p = prize(), left = triesLeft();
      bookBtn.textContent = p ? `BOOK NOW WITH ${p.pct}% OFF` : 'BOOK NOW';
      bookBtn.classList.toggle('win', !!p);
      playBtn.disabled = !!(game && game.live) || left <= 0;
      playBtn.innerHTML = left <= 0 ? 'NO TRIES LEFT TODAY' : (game && game.done ? '&#8635; PLAY AGAIN' : '&#9654; PLAY') + ` <small>(${left} ${left === 1 ? 'try' : 'tries'} left today)</small>`;
    }
    function overlay(html) { ov.innerHTML = html; ov.hidden = !html; }

    function hud() {
      if (!game) { $('.bb-shots').innerHTML = ''; $('.bb-tally').innerHTML = ''; return; }
      $('.bb-round').textContent = 'ROUND ' + game.round;
      const shots = game.bunnies.length ? Math.max(...game.bunnies.filter(b => b.state === 'fly').map(b => b.shots), 0) : 0;
      $('.bb-shots').innerHTML = Array.from({ length: SHOTS }, (_, i) => `<i class="${i < shots ? 'on' : ''}"></i>`).join('');
      $('.bb-tally').innerHTML = game.tally.map(r => `<i class="${r === 1 ? 'hit' : r === 0 ? 'miss' : ''}"></i>`).join('');
      $('.bb-score').textContent = `${game.hits}/${TOTAL}`;
    }

    function newBunny(i) {
      const r2 = game.round === 2;
      const vx = VENTS[Math.floor(Math.random() * 3)];
      const speed = (r2 ? 74 : 52) + game.served * 1.6;     // gets faster with every bunny
      const a = (-Math.PI / 2) + (Math.random() - .5) * 1.4;
      return { idx: i, x: vx - 6, y: FLOOR - 4, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, speed, shots: SHOTS, state: 'fly', t: 0,
        turn: .35 + Math.random() * .4, life: (r2 ? 3.3 : 4.2) - game.served * .03, frame: 0 };
    }
    function serve() {
      const n = game.round === 2 ? 2 : 1;
      game.bunnies = [];
      for (let k = 0; k < n && game.served < TOTAL; k++) { game.bunnies.push(newBunny(game.served)); game.served++; }
      game.wait = 0;
      hud();
    }

    function start() {
      if (triesLeft() <= 0 || (game && game.live)) return;
      useTry();
      game = { live: true, done: false, round: 1, served: 0, hits: 0, tally: Array(TOTAL).fill(-1), bunnies: [], wait: 1.2, banner: 'ROUND 1', bannerT: 1.6, pops: [] };
      overlay('');
      msg.textContent = 'Here they come!';
      snd('select');
      setFoot(); hud();
    }

    function finish() {
      game.live = false; game.done = true;
      const h = game.hits;
      let p = null;
      if (h >= GOAL10) p = savePrize(10); else if (h >= GOAL5) p = savePrize(5);
      if (p && h >= GOAL5) {
        snd('win');
        overlay(`<div class="bb-card win"><b>${h >= GOAL10 ? 'DUST-FREE!' : 'NICE SHOOTING!'}</b><span>You zapped ${h} of ${TOTAL}.</span><span class="bb-prize">${p.pct}% OFF</span><small>Code ${p.code} · saved for 30 days</small></div>`);
        msg.innerHTML = `You won <b>${p.pct}% off</b>. Press <b>Book now</b> and Rosa takes it off your bill.`;
      } else {
        snd('error');
        const need = GOAL5 - h;
        overlay(`<div class="bb-card"><b>THEY GOT AWAY!</b><span>You zapped ${h} of ${TOTAL}.</span><small>${need > 0 ? `${need} more for 5% off.` : ''}${triesLeft() ? ' Try again?' : ' Come back tomorrow for 3 more tries.'}</small></div>`);
        const keep = prize();
        msg.innerHTML = keep ? `Your earlier prize, <b>${keep.pct}% off</b>, is still saved.` : 'So close. The dust bunnies win this time.';
      }
      setFoot(); hud();
      if (opts.onResult) opts.onResult(prize(), h);
    }

    function zap(x, y) {
      if (!game || !game.live) return;
      const flying = game.bunnies.filter(b => b.state === 'fly');
      if (!flying.length) return;
      snd('blip');
      flashT = .06;
      let hit = null;
      for (const b of flying) { const cx = b.x + 6, cy = b.y + 5.5; if ((x - cx) ** 2 + (y - cy) ** 2 <= 10 * 10) { hit = b; break; } }
      for (const b of flying) b.shots--;
      if (hit) {
        hit.state = 'hit'; hit.t = 0;
        game.hits++; game.tally[hit.idx] = 1;
        game.pops.push({ x: hit.x + 6, y: hit.y, t: 0, txt: 'ZAP!' });
        snd('select');
      }
      for (const b of game.bunnies) if (b.state === 'fly' && b.shots <= 0) { b.state = 'flee'; b.t = 0; }
      hud();
    }

    function step(dt) {
      if (!game || !game.live) return;
      if (game.bannerT > 0) { game.bannerT -= dt; return; }
      if (!game.bunnies.length || game.bunnies.every(b => b.state === 'gone')) {
        game.wait -= dt;
        if (game.wait > 0) return;
        if (game.served >= TOTAL) return finish();
        if (game.served === PER_ROUND && game.round === 1) { game.round = 2; game.banner = 'ROUND 2 · FASTER!'; game.bannerT = 1.6; game.bunnies = []; hud(); return; }
        return serve();
      }
      for (const b of game.bunnies) {
        b.t += dt; b.frame = Math.floor(b.t * 8) % 2;
        if (b.state === 'fly') {
          b.turn -= dt;
          if (b.turn <= 0) {   // zig-zag: pick a new heading, mostly upward
            const a = (Math.random() < .75 ? -Math.PI / 2 : Math.PI / 2) + (Math.random() - .5) * 2.2;
            b.vx = Math.cos(a) * b.speed; b.vy = Math.sin(a) * b.speed * .8;
            b.turn = .3 + Math.random() * .45;
          }
          b.x += b.vx * dt; b.y += b.vy * dt;
          if (b.x < 2) { b.x = 2; b.vx = Math.abs(b.vx); } if (b.x > W - 14) { b.x = W - 14; b.vx = -Math.abs(b.vx); }
          if (b.y < 4) { b.y = 4; b.vy = Math.abs(b.vy); } if (b.y > FLOOR - 16) { b.y = FLOOR - 16; b.vy = -Math.abs(b.vy); }
          if (b.t > b.life) { b.state = 'flee'; b.t = 0; }
        } else if (b.state === 'flee') {
          b.y -= 140 * dt; b.x += Math.sin(b.t * 14) * 1.5;
          if (b.y < -16) { b.state = 'gone'; game.tally[b.idx] = 0; game.pops.push({ x: Math.max(20, Math.min(W - 20, b.x + 6)), y: 16, t: 0, txt: 'MISSED!', bad: true }); snd('back'); hud(); }
        } else if (b.state === 'hit') {
          if (b.t > .55) { b.state = 'gone'; }
        }
      }
      if (game.bunnies.length && game.bunnies.every(b => b.state === 'gone') && game.wait <= 0) game.wait = .7;
      for (const p of game.pops) p.t += dt;
      game.pops = game.pops.filter(p => p.t < .8);
    }

    function draw(t) {
      drawRoom(g, t);
      if (game) {
        for (const b of game.bunnies) {
          if (b.state === 'gone') continue;
          if (b.state === 'hit') {           // sucked into the vacuum: spin and shrink
            const s = Math.max(.1, 1 - b.t * 1.7);
            sprite(g, DIZZY, b.x + 6 - 6 * s, b.y + 5.5 - 5.5 * s, s);
          } else sprite(g, BUN[b.frame], b.x, b.y);
        }
        for (const p of game.pops) {
          g.font = '8px "Press Start 2P", monospace'; g.textAlign = 'center';
          g.fillStyle = '#000'; g.fillText(p.txt, p.x + 1, p.y - p.t * 20 + 1);
          g.fillStyle = p.bad ? '#ff6a5a' : '#7fd977'; g.fillText(p.txt, p.x, p.y - p.t * 20);
        }
        if (game.live && game.bannerT > 0) {
          g.fillStyle = 'rgba(0,0,0,.6)'; g.fillRect(0, 76, W, 30);
          g.font = '10px "Press Start 2P", monospace'; g.textAlign = 'center'; g.fillStyle = '#7fd977'; g.fillText(game.banner, W / 2, 95);
        }
      }
      if (aim.on && game && game.live) {   // vacuum crosshair
        g.fillStyle = '#7fd977';
        const { x, y } = aim;
        g.fillRect(x - 9, y - 9, 5, 2); g.fillRect(x - 9, y - 9, 2, 5); g.fillRect(x + 4, y - 9, 5, 2); g.fillRect(x + 7, y - 9, 2, 5);
        g.fillRect(x - 9, y + 7, 5, 2); g.fillRect(x - 9, y + 4, 2, 5); g.fillRect(x + 4, y + 7, 5, 2); g.fillRect(x + 7, y + 4, 2, 5);
        g.fillRect(x - 1, y - 1, 2, 2);
      }
      if (flashT > 0) { g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(0, 0, W, H); }
    }

    function loop(ts) {
      const dt = Math.min(.05, (ts - (last || ts)) / 1000); last = ts;
      if (flashT > 0) flashT -= dt;
      step(dt); draw(ts);
      raf = el.isConnected ? requestAnimationFrame(loop) : 0;
    }

    const toLogical = e => { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H }; };
    cv.addEventListener('pointermove', e => { const p = toLogical(e); aim = { ...p, on: true }; });
    cv.addEventListener('pointerleave', () => { aim.on = false; });
    cv.addEventListener('pointerdown', e => { e.preventDefault(); const p = toLogical(e); aim = { ...p, on: true }; zap(p.x, p.y); });
    playBtn.onclick = start;
    bookBtn.onclick = () => { if (opts.onBook) opts.onBook(prize()); };

    const p0 = prize();
    overlay(`<div class="bb-card"><b>READY?</b><span>${TOTAL} dust bunnies. ${SHOTS} shots each.</span><small>Zap ${GOAL5} for 5% off · ${GOAL10} for 10% off</small></div>`);
    msg.innerHTML = p0 ? `You already won <b>${p0.pct}% off</b> (code ${p0.code}). Book now, or play to win more.` : 'Press <b>Play</b> to start. No sign-up needed.';
    setFoot(); hud();
    cancelAnimationFrame(raf); last = 0; raf = requestAnimationFrame(loop);
    return { stop() { cancelAnimationFrame(raf); raf = 0; if (game) game.live = false; }, peek: () => game };
  }

  // once a booking goes through, the prize is used
  function spend() { try { localStorage.removeItem(KEY_PRIZE); } catch (e) { } }
  root.HP_BUNNY = { mount, prize, spend, GOAL5, GOAL10 };
})(window);
