/* =====================================================================
   Blue Collar Business - The 20-Year Test
   recorder.js : record the stage from inside the page

   The browser can capture its own tab and write a video file, which
   means "press Play and it records" is possible without a second app.
   Three things make it usable rather than merely possible:

   - it captures THIS TAB, so the prompter window on the other half of
     the monitor is never in the file;
   - Studio Three is cropped to the 9:16 frame on the way through a
     canvas, so a vertical episode comes out as a vertical file rather
     than a widescreen one with a strip in the middle;
   - the microphone goes into the file, not the speakers, so there is no
     feedback loop - the earlier decision to keep audio off the camera
     preview still stands.

   What it cannot do: match OBS. No scenes, no hotkey mid-take, no
   hardware encoder. For a first take it is enough; for a channel that
   records weekly, OBS pointed at the same window is the better rig.
   ===================================================================== */
(function (global) {
  'use strict';

  var BCB = global.BCB = global.BCB || {};

  var display = null;      /* the tab/window stream */
  var mic = null;          /* microphone stream */
  var recorder = null;
  var chunks = [];
  var startedAt = 0;
  var canvas = null, raf = 0;
  var lastTake = null;     /* { blob, url, seconds, bytes, name, ext } */
  var listeners = [];
  var takeNo = 0;

  var prefs = {
    autoRecord: true,      /* start on Play, stop on Exit or at the end */
    includeMic: true,
    micDeviceId: '',
    fps: 30,
    bitrate: 10            /* Mbps */
  };
  var KEY = 'bcb-20-year-test-v1-recorder';
  try {
    var saved = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (saved) { Object.assign(prefs, saved); }
  } catch (e) { /* storage can throw outright */ }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(prefs)); } catch (e) { /* fine */ } }

  function emit(evt, data) { listeners.forEach(function (fn) { try { fn(evt, data); } catch (e) { /* listener's problem */ } }); }

  function supported() {
    return !!(global.MediaRecorder && navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia);
  }

  /* Prefer a container an editor opens without a fuss. Chrome can write
     H.264 MP4 on most platforms now; WebM is the universal fallback and
     YouTube takes it directly. */
  function pickMime() {
    /* A bare "video/mp4" can come back as VP9 inside an MP4 box, which
       YouTube accepts and some editors do not, so it ranks below WebM. */
    var candidates = [
      ['video/mp4;codecs="avc1.42E01E,mp4a.40.2"', 'mp4'],
      ['video/mp4;codecs="avc1.42E01E,opus"', 'mp4'],
      ['video/webm;codecs=vp9,opus', 'webm'],
      ['video/webm;codecs=vp8,opus', 'webm'],
      ['video/mp4', 'mp4'],
      ['video/webm', 'webm']
    ];
    for (var i = 0; i < candidates.length; i++) {
      try { if (MediaRecorder.isTypeSupported(candidates[i][0])) { return { mime: candidates[i][0], ext: candidates[i][1] }; } }
      catch (e) { /* keep looking */ }
    }
    return { mime: '', ext: 'webm' };
  }

  /* Ask for the screen once, ahead of the take, so the picker does not
     appear on top of the first slide. Resolves true if armed. */
  function arm() {
    if (!supported()) { emit('error', 'This browser cannot record its own screen. Use Chrome or Edge, or record with OBS.'); return Promise.resolve(false); }
    if (display && display.active) { return Promise.resolve(true); }
    var constraints = {
      video: { frameRate: { ideal: prefs.fps }, displaySurface: 'browser' },
      audio: false,
      /* Chrome-specific hints: offer this tab first, keep the picker
         from showing the recording's own window, no system audio. */
      preferCurrentTab: true,
      selfBrowserSurface: 'include',
      surfaceSwitching: 'exclude',
      systemAudio: 'exclude'
    };
    return navigator.mediaDevices.getDisplayMedia(constraints).then(function (stream) {
      display = stream;
      /* If they stop sharing from the browser's own bar, end the take. */
      var vt = stream.getVideoTracks()[0];
      if (vt) { vt.addEventListener('ended', function () { if (recorder) { stop(); } display = null; emit('disarmed'); }); }
      emit('armed', trackInfo());
      return true;
    }).catch(function (err) {
      display = null;
      var name = err && err.name;
      emit('error', name === 'NotAllowedError'
        ? 'Screen capture was cancelled. Press R (or Play) in the slide window and choose this tab.'
        : name === 'InvalidStateError'
          ? 'The browser only starts a recording from a click or key in the slide window itself. Press Play or R there.'
          : 'Screen capture failed: ' + (err && err.message ? err.message : err));
      return false;
    });
  }
  function trackInfo() {
    var vt = display && display.getVideoTracks()[0];
    var s = vt ? vt.getSettings() : {};
    return { width: s.width || 0, height: s.height || 0, fps: s.frameRate || 0, surface: s.displaySurface || '' };
  }

  function getMic() {
    if (!prefs.includeMic) { return Promise.resolve(null); }
    if (mic && mic.active) { return Promise.resolve(mic); }
    var c = { audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false };
    if (prefs.micDeviceId) { c.audio.deviceId = { exact: prefs.micDeviceId }; }
    return navigator.mediaDevices.getUserMedia(c).then(function (s) { mic = s; return s; })
      .catch(function () { emit('warn', 'No microphone - recording video only.'); return null; });
  }

  /* Studio Three: crop the captured tab to the 9:16 frame. The capture
     is the whole viewport; the frame's CSS rect maps onto it by the
     ratio of captured pixels to CSS pixels. */
  function cropTo(frameEl, srcTrack) {
    var video = document.createElement('video');
    video.srcObject = new MediaStream([srcTrack]);
    video.muted = true; video.playsInline = true;
    var st = srcTrack.getSettings();
    var scaleX = (st.width || global.innerWidth) / global.innerWidth;
    var scaleY = (st.height || global.innerHeight) / global.innerHeight;
    var r = frameEl.getBoundingClientRect();
    var sx = Math.round(r.left * scaleX), sy = Math.round(r.top * scaleY);
    var sw = Math.round(r.width * scaleX), sh = Math.round(r.height * scaleY);
    /* Even dimensions keep every encoder happy. */
    sw -= sw % 2; sh -= sh % 2;
    canvas = document.createElement('canvas');
    canvas.width = sw; canvas.height = sh;
    var ctx = canvas.getContext('2d');
    var draw = function () {
      if (!canvas) { return; }
      try { ctx.drawImage(video, sx, sy, sw, sh, 0, 0, sw, sh); } catch (e) { /* frame not ready */ }
      raf = global.requestAnimationFrame(draw);
    };
    return video.play().then(function () { draw(); return canvas.captureStream(prefs.fps).getVideoTracks()[0]; });
  }

  function start(opts) {
    opts = opts || {};
    if (recorder) { return Promise.resolve(false); }
    return arm().then(function (ok) {
      if (!ok) { return false; }
      return getMic().then(function (micStream) {
        var vt = display.getVideoTracks()[0];
        /* The share can be stopped from the browser's own bar between
           arming and rolling. */
        if (!vt) { emit('error', 'The screen share ended before the take started.'); return false; }
        /* Cropping needs a hidden video to play, and a browser is within
           its rights to refuse. Losing the crop is worth a warning; it is
           not worth losing the take. */
        var videoTrackP = opts.cropTo
          ? cropTo(opts.cropTo, vt).catch(function () {
              emit('warn', 'Could not crop to the vertical frame, so the whole tab is being recorded.');
              return vt;
            })
          : Promise.resolve(vt);
        return videoTrackP.then(function (videoTrack) {
          var tracks = [videoTrack];
          if (micStream) { tracks = tracks.concat(micStream.getAudioTracks()); }
          var mixed = new MediaStream(tracks);
          var m = pickMime();
          var options = { videoBitsPerSecond: prefs.bitrate * 1e6, audioBitsPerSecond: 160000 };
          if (m.mime) { options.mimeType = m.mime; }
          try { recorder = new MediaRecorder(mixed, options); }
          catch (e) { recorder = new MediaRecorder(mixed); }
          /* The extension follows what the recorder actually chose. */
          if (recorder.mimeType) { m = { mime: recorder.mimeType, ext: /mp4/.test(recorder.mimeType) ? 'mp4' : 'webm' }; }
          chunks = [];
          takeNo++;
          recorder.__ext = m.ext;
          recorder.ondataavailable = function (ev) { if (ev.data && ev.data.size) { chunks.push(ev.data); } };
          recorder.onstop = function () { finish(); };
          recorder.onerror = function (ev) { emit('error', 'Recording error: ' + (ev.error && ev.error.message ? ev.error.message : 'unknown')); };
          recorder.start(1000);        /* a chunk a second - a crash loses one second, not the take */
          startedAt = Date.now();
          emit('start', { take: takeNo, mime: m.mime, ext: m.ext, info: trackInfo() });
          return true;
        });
      });
    }).catch(function (err) {
      /* Whatever went wrong, this resolves to false rather than
         rejecting. A caller that is waiting on it to decide whether the
         episode may begin must never be left waiting. */
      recorder = null;
      if (raf) { global.cancelAnimationFrame(raf); raf = 0; }
      canvas = null;
      emit('error', 'Could not start recording: ' + (err && err.message ? err.message : err));
      return false;
    });
  }

  function stop() {
    if (!recorder) { return; }
    try { recorder.stop(); } catch (e) { finish(); }
  }

  function finish() {
    var ext = (recorder && recorder.__ext) || 'webm';
    var seconds = (Date.now() - startedAt) / 1000;
    recorder = null;
    if (raf) { global.cancelAnimationFrame(raf); raf = 0; }
    canvas = null;
    if (!chunks.length) { emit('stop', null); return; }
    var blob = new Blob(chunks, { type: chunks[0].type || ('video/' + ext) });
    chunks = [];
    if (lastTake && lastTake.url) { try { URL.revokeObjectURL(lastTake.url); } catch (e) { /* fine */ } }
    var stamp = new Date();
    var pad = function (n) { return String(n).padStart(2, '0'); };
    var name = (opts_name() || '20-year-test') + '-take-' + takeNo + '-' +
      stamp.getFullYear() + pad(stamp.getMonth() + 1) + pad(stamp.getDate()) + '-' + pad(stamp.getHours()) + pad(stamp.getMinutes()) +
      '.' + ext;
    lastTake = { blob: blob, url: URL.createObjectURL(blob), seconds: seconds, bytes: blob.size, name: name, ext: ext, take: takeNo };
    emit('stop', lastTake);
  }
  var nameFn = null;
  function opts_name() { return nameFn ? nameFn() : ''; }

  /* A download works from a real page - the local file or GitHub Pages.
     It is inert inside an embedded copy, which is also where the camera
     and screen capture do not work, so nothing is lost. */
  function download(take) {
    take = take || lastTake;
    if (!take) { return false; }
    var a = document.createElement('a');
    a.href = take.url; a.download = take.name;
    document.body.appendChild(a); a.click(); a.remove();
    return true;
  }

  /* Chrome and Edge can open a proper save dialog and stream the blob to
     disk; everywhere else the anchor download lands it in Downloads. */
  function saveAs(take) {
    take = take || lastTake;
    if (!take) { return Promise.resolve(false); }
    if (!global.showSaveFilePicker) { return Promise.resolve(download(take)); }
    var accept = {};
    accept[take.blob.type.split(';')[0] || 'video/' + take.ext] = ['.' + take.ext];
    return global.showSaveFilePicker({ suggestedName: take.name, types: [{ description: 'Video', accept: accept }] })
      .then(function (handle) { return handle.createWritable(); })
      .then(function (w) { return w.write(take.blob).then(function () { return w.close(); }); })
      .then(function () { emit('saved', take); return true; })
      .catch(function (err) {
        if (err && err.name === 'AbortError') { return false; }   /* they closed the dialog */
        return download(take);
      });
  }

  function disarm() {
    if (recorder) { stop(); }
    if (display) { display.getTracks().forEach(function (t) { t.stop(); }); display = null; }
    if (mic) { mic.getTracks().forEach(function (t) { t.stop(); }); mic = null; }
    emit('disarmed');
  }

  function listMics() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) { return Promise.resolve([]); }
    return navigator.mediaDevices.enumerateDevices().then(function (list) {
      return list.filter(function (d) { return d.kind === 'audioinput'; });
    }).catch(function () { return []; });
  }

  BCB.recorder = {
    prefs: prefs, save: save,
    supported: supported,
    arm: arm, start: start, stop: stop, disarm: disarm,
    download: download, saveAs: saveAs, listMics: listMics,
    isRecording: function () { return !!recorder; },
    isArmed: function () { return !!(display && display.active); },
    elapsed: function () { return recorder ? (Date.now() - startedAt) / 1000 : 0; },
    lastTake: function () { return lastTake; },
    onChange: function (fn) { listeners.push(fn); },
    clearTake: function () {
      if (lastTake && lastTake.url) { try { URL.revokeObjectURL(lastTake.url); } catch (e) { /* fine */ } }
      lastTake = null; emit('cleared');
    },
    setNameSource: function (fn) { nameFn = fn; },
    pickMime: pickMime
  };

})(typeof window !== 'undefined' ? window : globalThis);
