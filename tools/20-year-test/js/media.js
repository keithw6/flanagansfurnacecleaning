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
    if (manifest && filesReady) { return filesReady.then(function () { return manifest; }); }
    if (loading) { return loading; }
    loading = loadFiles().then(function () { return loadManifest(); });
    return loading;
  }
  var loadingManifest = null;
  function loadManifest() {
    if (manifest) { return Promise.resolve(manifest); }
    if (loadingManifest) { return loadingManifest; }
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
    loadingManifest = fetch(BASE + 'manifest.json')
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) { manifest = j || emptyManifest(); return manifest; })
      .catch(function () {
        /* Opening the file straight off disk blocks fetch in some
           browsers. Not an error - just means no library. */
        manifest = emptyManifest();
        return manifest;
      });
    return loadingManifest;
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
    var slot = overrides[scope][key] || (overrides[scope][key] = {});
    var prev = slot[field];
    if (prev && /^file:/.test(prev) && prev !== value) { removeFile(prev.slice(5)); }
    if (value) { slot[field] = value; } else { delete slot[field]; }
    if (!slot.still && !slot.clip) { delete overrides[scope][key]; }
    saveOverrides();
  }

  /* ---------------------------------------------------------------
     A SLIDE'S OWN PICTURES
     A slide holds a list rather than one picture, so a run of them can
     be played in turn to fill the time the script takes to speak. A
     bare string from an earlier version reads as a list of one.
     --------------------------------------------------------------- */
  function beatList(id) {
    var v = overrides.beats[id];
    if (!v) { return []; }
    return Array.isArray(v) ? v.slice() : [v];
  }
  function setBeatList(id, list) {
    if (list && list.length) { overrides.beats[id] = list; }
    else { delete overrides.beats[id]; }
    saveOverrides();
  }
  function addBeatMedia(id, value) {
    value = (value || '').trim();
    if (!value) { return false; }
    var list = beatList(id);
    list.push(value);
    setBeatList(id, list);
    return true;
  }
  function addBeatFile(id, file) {
    /* Each upload gets its own key, so adding a second picture to a
       slide does not overwrite the first. */
    var fid = 'beat|' + id + '|' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    return putFile(fid, file).then(function (ref) { addBeatMedia(id, ref); return ref; });
  }
  function removeBeatMedia(id, i) {
    var list = beatList(id);
    var gone = list.splice(i, 1)[0];
    setBeatList(id, list);
    if (gone && /^file:/.test(gone)) { removeFile(gone.slice(5)); }
  }
  function clearBeatMedia(id) {
    beatList(id).forEach(function (v) { if (/^file:/.test(v)) { removeFile(v.slice(5)); } });
    setBeatList(id, []);
  }
  function libraryEntry(scope, key) {
    var base = scope === 'brand'
      ? ((manifest && manifest._brand && manifest._brand[key]) || {})
      : ((manifest && manifest.careers && manifest.careers[key]) || {});
    var own = overrides[scope][key] || {};
    var still = own.still || base.still || null, clip = own.clip || base.clip || null;
    return { still: still, clip: clip, stillUrl: still ? resolve(still) : null, clipUrl: clip ? resolve(clip) : null,
      ownStill: own.still || '', ownClip: own.clip || '', label: base.label || key };
  }
  /* A picture pinned to a slide wins over everything else. A video link
     counts as a clip; anything else is treated as a still. */
  function assetFromRef(v) {
    var src = resolve(v);
    if (!src) { return null; }
    var f = fileInfo(v);
    return {
      kind: f ? f.kind : (/\.(mp4|webm|mov)(\?|$)/i.test(v) ? 'clip' : 'still'),
      src: src, ref: v,
      name: f ? (f.name || 'uploaded file') : v.replace(/[?#].*$/, '').replace(/^.*\//, '').slice(0, 44) || v
    };
  }
  function beatAssets(beatId) {
    return beatList(beatId).map(assetFromRef).filter(Boolean);
  }
  function beatAsset(beatId) { return beatAssets(beatId)[0] || null; }

  function assetFor(careerOrKey, prefer) {
    var entry;
    if (typeof careerOrKey === 'string') {
      entry = libraryEntry('brand', careerOrKey);
    } else {
      entry = libraryEntry('careers', idFor(careerOrKey));
    }
    if (!entry) { return null; }
    /* An uploaded file that has not loaded yet resolves to nothing;
       fall through to the next option rather than show a broken slot. */
    var clip = entry.clip && resolve(entry.clip), still = entry.still && resolve(entry.still);
    if (prefer === 'clip' && clip) { return { kind: 'clip', src: clip }; }
    if (still) { return { kind: 'still', src: still }; }
    if (clip) { return { kind: 'clip', src: clip }; }
    return null;
  }

  /* A manifest entry is either a file in media/ or an absolute URL.
     Hosting the assets remotely gets a library working immediately;
     downloading them into media/ later makes it work offline, and the
     only change is the manifest value. */
  function resolve(v) {
    if (/^file:/.test(v)) { var f = files[v.slice(5)]; return f ? f.url : null; }
    return /^(https?:)?\/\/|^(data|blob):/.test(v) ? v : BASE + v;
  }

  /* ---------------------------------------------------------------
     UPLOADED FILES
     A picture or clip chosen from disk is kept in IndexedDB - the
     only browser store that takes a 200 MB video without complaint -
     and referenced from the overrides as "file:<id>". Object URLs are
     minted once per page load, so everything else can treat them as
     ordinary links.
     --------------------------------------------------------------- */
  var DBNAME = 'bcb-20-year-test-media', STORE = 'files';
  var files = {};            /* id -> { url, kind, name, size } */
  var filesReady = null;
  function openDb() {
    return new Promise(function (res, rej) {
      if (!global.indexedDB) { rej(new Error('no IndexedDB')); return; }
      var r = global.indexedDB.open(DBNAME, 1);
      r.onupgradeneeded = function () { r.result.createObjectStore(STORE); };
      r.onsuccess = function () { res(r.result); };
      r.onerror = function () { rej(r.error); };
    });
  }
  function loadFiles() {
    if (filesReady) { return filesReady; }
    filesReady = openDb().then(function (db) {
      return new Promise(function (res) {
        var tx = db.transaction(STORE, 'readonly');
        var store = tx.objectStore(STORE);
        var req = store.openCursor();
        req.onsuccess = function () {
          var c = req.result;
          if (!c) { res(); return; }
          var rec = c.value;
          if (rec && rec.blob) {
            files[c.key] = { url: URL.createObjectURL(rec.blob), kind: /^video\//.test(rec.blob.type) ? 'clip' : 'still',
              name: rec.name || '', size: rec.blob.size };
          }
          c.continue();
        };
        req.onerror = function () { res(); };
      });
    }).catch(function () { /* no store: uploads simply do not persist */ });
    return filesReady;
  }
  function putFile(id, file) {
    return openDb().then(function (db) {
      return new Promise(function (res, rej) {
        var tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).put({ blob: file, name: file.name }, id);
        tx.oncomplete = function () { res(); };
        tx.onerror = function () { rej(tx.error); };
      });
    }).then(function () {
      if (files[id] && files[id].url) { try { URL.revokeObjectURL(files[id].url); } catch (e) { /* fine */ } }
      files[id] = { url: URL.createObjectURL(file), kind: /^video\//.test(file.type) ? 'clip' : 'still', name: file.name, size: file.size };
      return 'file:' + id;
    });
  }
  function removeFile(id) {
    if (files[id]) { try { URL.revokeObjectURL(files[id].url); } catch (e) { /* fine */ } delete files[id]; }
    return openDb().then(function (db) {
      return new Promise(function (res) {
        var tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).delete(id);
        tx.oncomplete = function () { res(); };
        tx.onerror = function () { res(); };
      });
    }).catch(function () { /* fine */ });
  }
  function fileInfo(v) { return /^file:/.test(v || '') ? (files[v.slice(5)] || null) : null; }

  /* Store a chosen file against a library slot and point the override
     at it. Slides use addBeatFile instead, since they hold a list. */
  function setFile(scope, key, field, file) {
    var id = scope + '|' + key + '|' + field;
    var prev = (overrides[scope][key] || {})[field];
    var p = putFile(id, file).then(function (ref) { setOverride(scope, key, field, ref); return ref; });
    if (prev && /^file:/.test(prev) && prev.slice(5) !== id) { removeFile(prev.slice(5)); }
    return p;
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
  /* ---------------------------------------------------------------
     LETTING GO OF A VIDEO
     A <video> that is merely detached from the page keeps its decoder
     until the collector gets round to it, and a browser has only so
     many. An episode that swaps a clip every few seconds runs the pool
     dry, and the symptom is not an error: it is torn frames and a
     picture that stops moving. So every clip we replace is stopped and
     emptied on the spot.
     --------------------------------------------------------------- */
  function release(root) {
    if (!root || !root.querySelectorAll) { return; }
    Array.prototype.forEach.call(root.querySelectorAll('video'), function (v) {
      try { v.pause(); v.removeAttribute('src'); v.load(); } catch (e) { /* already gone */ }
    });
  }
  /* Out of sight but still decoding is waste too. Paused rather than
     emptied, because this one may fade back in. */
  function pauseMedia(root) {
    if (!root || !root.querySelectorAll) { return; }
    Array.prototype.forEach.call(root.querySelectorAll('video'), function (v) {
      try { v.pause(); } catch (e) { /* fine */ }
    });
  }

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
    release(incoming);
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
    /* Once it has finished fading it is not being watched, so stop it
       decoding. It is emptied outright when this slot is reused. */
    if (layer.__fade) { clearTimeout(layer.__fade); }
    layer.__fade = setTimeout(function () { pauseMedia(outgoing); }, 1000);
    layer.__slot = next;
  }

  BCB.media = {
    load: load,
    assetFor: assetFor,
    idFor: idFor,
    intensityFor: intensityFor,
    createLayer: createLayer,
    setBackground: setBackground,
    release: release,
    pauseMedia: pauseMedia,
    overrides: overrides,
    setOverride: setOverride,
    setFile: setFile,
    fileInfo: fileInfo,
    beatList: beatList,
    beatAssets: beatAssets,
    addBeatMedia: addBeatMedia,
    addBeatFile: addBeatFile,
    removeBeatMedia: removeBeatMedia,
    clearBeatMedia: clearBeatMedia,
    libraryEntry: libraryEntry,
    beatAsset: beatAsset,
    get manifest() { return manifest; }
  };

})(typeof window !== 'undefined' ? window : globalThis);
