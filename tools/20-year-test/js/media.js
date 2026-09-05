/* =====================================================================
   Blue Collar Business - The 20-Year Test
   media.js : the slide background layer

   Two jobs:

   1. Resolve imagery for whichever careers are being compared, from
      media/manifest.json. Anything missing falls back to a procedural
      background, so a half-filled library is never a broken page - and
      an empty library still looks deliberate rather than unfinished.

   2. Keep the text readable on top of it. That is the whole discipline
      here: a photograph behind white type is a contrast problem, not a
      decoration. Every background carries a scrim, and how strong the
      picture is allowed to be depends on what the slide has to show -
      a chart gets almost none, a title card gets the most.
   ===================================================================== */
(function (global) {
  'use strict';

  var BCB = global.BCB = global.BCB || {};
  var manifest = null;
  var loading = null;
  var BASE = 'media/';

  /* How much photograph each kind of slide can carry before it starts
     competing with what the viewer is meant to read. */
  var INTENSITY = {
    brand: 0.55, title: 0.5, outro: 0.55, verdict: 0.42, versus: 0.5, close: 0.55, disclaimer: 0.2,
    headstart: 0.3, setup: 0.26, education: 0.24, business: 0.24,
    dependency: 0.24, hours: 0.24, freedom: 0.24,
    columns: 0.12, scores: 0.12, categories: 0.12, scenarios: 0.12, compound: 0.12, invest: 0.24,
    radar: 0.1
  };
  function intensityFor(kind) {
    if (kind.indexOf('chart:') === 0) { return 0.08; }
    return INTENSITY[kind] == null ? 0.2 : INTENSITY[kind];
  }

  function load() {
    if (manifest) { return Promise.resolve(manifest); }
    if (loading) { return loading; }
    /* A bundler can inline the library so no request is needed at all. */
    if (global.BCB_MEDIA_MANIFEST) {
      manifest = global.BCB_MEDIA_MANIFEST;
      return Promise.resolve(manifest);
    }
    /* fetch() from a file:// page is refused, and the refusal is logged
       as a console error before any catch can run. Do not ask. */
    if (global.location && global.location.protocol === 'file:') {
      manifest = emptyManifest();
      return Promise.resolve(manifest);
    }
    loading = fetch(BASE + 'manifest.json')
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) { manifest = j || emptyManifest(); return manifest; })
      .catch(function () {
        /* Opening the file straight off disk blocks fetch in some
           browsers. Not an error - just means no library. */
        manifest = emptyManifest();
        return manifest;
      });
    return loading;
  }
  function emptyManifest() { return { _brand: {}, careers: {} }; }

  /* Career id from a career object. Presets keep their id only in the
     CAREERS map, so match on name and fall back to a slug. */
  function idFor(career) {
    var C = BCB.data.CAREERS;
    for (var k in C) {
      if (C.hasOwnProperty(k) && C[k].name === career.name) { return k; }
    }
    return String(career.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
  }

  /* Your own pictures. Anything pasted on the Studio tab - a Higgsfield
     link, a photo on your site - sits on top of the shipped library,
     per career, per brand slot, or for one particular slide. Kept in
     this browser, so it survives a reload and never touches the repo. */
  var OKEY = 'bcb-20-year-test-v1-media';
  var overrides = { careers: {}, brand: {}, beats: {} };
  try {
    var savedO = JSON.parse(localStorage.getItem(OKEY) || 'null');
    if (savedO) { overrides.careers = savedO.careers || {}; overrides.brand = savedO.brand || {}; overrides.beats = savedO.beats || {}; }
  } catch (e) { /* storage can throw outright */ }
  function saveOverrides() { try { localStorage.setItem(OKEY, JSON.stringify(overrides)); } catch (e) { /* fine */ } }
  function setOverride(scope, key, field, value) {
    value = (value || '').trim();
    if (scope === 'beats') {
      if (value) { overrides.beats[key] = value; } else { delete overrides.beats[key]; }
    } else {
      var slot = overrides[scope][key] || (overrides[scope][key] = {});
      if (value) { slot[field] = value; } else { delete slot[field]; }
      if (!slot.still && !slot.clip) { delete overrides[scope][key]; }
    }
    saveOverrides();
  }
  function libraryEntry(scope, key) {
    var base = scope === 'brand'
      ? ((manifest && manifest._brand && manifest._brand[key]) || {})
      : ((manifest && manifest.careers && manifest.careers[key]) || {});
    var own = overrides[scope][key] || {};
    return { still: own.still || base.still || null, clip: own.clip || base.clip || null,
      ownStill: own.still || '', ownClip: own.clip || '', label: base.label || key };
  }
  /* A picture pinned to one slide wins over everything else. A video
     link counts as a clip; anything else is treated as a still. */
  function beatAsset(beatId) {
    var v = overrides.beats[beatId];
    if (!v) { return null; }
    return { kind: /\.(mp4|webm|mov)(\?|$)/i.test(v) ? 'clip' : 'still', src: resolve(v) };
  }

  function assetFor(careerOrKey, prefer) {
    var entry;
    if (typeof careerOrKey === 'string') {
      entry = libraryEntry('brand', careerOrKey);
    } else {
      entry = libraryEntry('careers', idFor(careerOrKey));
    }
    if (!entry) { return null; }
    var clip = entry.clip, still = entry.still;
    if (prefer === 'clip' && clip) { return { kind: 'clip', src: resolve(clip) }; }
    if (still) { return { kind: 'still', src: resolve(still) }; }
    if (clip) { return { kind: 'clip', src: resolve(clip) }; }
    return null;
  }

  /* A manifest entry is either a file in media/ or an absolute URL.
     Hosting the assets remotely gets a library working immediately;
     downloading them into media/ later makes it work offline, and the
     only change is the manifest value. */
  function resolve(v) {
    return /^(https?:)?\/\/|^(data|blob):/.test(v) ? v : BASE + v;
  }

  /* ---------------------------------------------------------------
     THE BACKGROUND ELEMENT
     One node, reused across beats: swapping the source beats
     rebuilding, and it lets the crossfade actually cross-fade.
     --------------------------------------------------------------- */
  function createLayer() {
    var el = document.createElement('div');
    el.className = 'st-bg';
    el.innerHTML =
      '<div class="st-bg-art" data-slot="a"></div>' +
      '<div class="st-bg-art" data-slot="b"></div>' +
      '<div class="st-bg-scrim"></div>' +
      '<div class="st-bg-grain"></div>';
    el.__slot = 'a';
    return el;
  }

  /* Swap in a new background. Returns quietly when there is nothing to
     show, leaving the procedural ground in place. */
  function setBackground(layer, asset, intensity, reduceMotion) {
    if (!layer) { return; }
    var next = layer.__slot === 'a' ? 'b' : 'a';
    var incoming = layer.querySelector('[data-slot="' + next + '"]');
    var outgoing = layer.querySelector('[data-slot="' + layer.__slot + '"]');

    if (!asset) {
      /* No asset for this beat: fade the picture out and let the
         procedural background carry it. */
      incoming.style.opacity = 0;
      outgoing.style.opacity = 0;
      layer.classList.add('bare');
      return;
    }
    layer.classList.remove('bare');
    incoming.innerHTML = '';

    /* An asset that fails to arrive - an expired link, no network, a
       blocked host - must not leave the heavy photo scrim sitting over
       nothing. That reads as a broken, muddy slide; falling back to the
       designed ground reads as intentional. */
    function failed() {
      incoming.style.opacity = 0;
      outgoing.style.opacity = 0;
      layer.classList.add('bare');
    }

    if (asset.kind === 'clip') {
      var v = document.createElement('video');
      v.muted = true; v.loop = true; v.playsInline = true; v.autoplay = true;
      v.setAttribute('aria-hidden', 'true');
      v.addEventListener('error', failed);
      v.src = asset.src;
      var p = v.play();
      if (p && p.catch) { p.catch(function () { /* autoplay refusal is not a failure */ }); }
      incoming.appendChild(v);
      incoming.classList.remove('kenburns');
    } else {
      var img = document.createElement('img');
      img.alt = '';
      img.setAttribute('aria-hidden', 'true');
      img.addEventListener('error', failed);
      img.src = asset.src;
      incoming.appendChild(img);
      incoming.classList.toggle('kenburns', !reduceMotion);
    }
    incoming.style.opacity = intensity;
    outgoing.style.opacity = 0;
    layer.__slot = next;
  }

  BCB.media = {
    load: load,
    assetFor: assetFor,
    idFor: idFor,
    intensityFor: intensityFor,
    createLayer: createLayer,
    setBackground: setBackground,
    overrides: overrides,
    setOverride: setOverride,
    libraryEntry: libraryEntry,
    beatAsset: beatAsset,
    get manifest() { return manifest; }
  };

})(typeof window !== 'undefined' ? window : globalThis);
