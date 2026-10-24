/* English Gems - speaking practice: text-to-speech, recording, scenarios, optional transcript */
(function () {
  'use strict';
  var EG = window.EG, S = EG.S, esc = EG.esc, R = null, audio = null;
  var HAS_TTS = 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;

  /* ---------- text to speech ---------- */
  EG.voiceList = function () {
    if (!HAS_TTS) return [];
    return speechSynthesis.getVoices().filter(function (v) { return /^en/i.test(v.lang); });
  };
  function pickVoice() {
    var vs = EG.voiceList();
    if (S.settings.voiceURI) { var v = vs.find(function (x) { return x.voiceURI === S.settings.voiceURI; }); if (v) return v; }
    var want = S.settings.accent === 'UK' ? /en[-_]GB/i : /en[-_]US/i;
    return vs.find(function (v) { return want.test(v.lang); }) || vs[0];
  }
  if (HAS_TTS) try { speechSynthesis.onvoiceschanged = function () { }; } catch (e) { /* ignore */ }
  EG.say = function (text, slow, onend) {
    if (!HAS_TTS) { EG.toast('Spoken audio is not supported in this browser.'); if (onend) onend(); return; }
    try {
      speechSynthesis.cancel();
      var u = new SpeechSynthesisUtterance(text), v = pickVoice();
      if (v) { u.voice = v; u.lang = v.lang; } else u.lang = S.settings.accent === 'UK' ? 'en-GB' : 'en-US';
      u.rate = slow ? 0.65 : 0.95;
      if (onend) { u.onend = onend; u.onerror = onend; }
      speechSynthesis.speak(u);
    } catch (e) { if (onend) onend(); }
  };

  /* ---------- state ---------- */
  function fresh(id) {
    return { gemId: id, error: null, shadow: { state: 'idle', used: [id] }, scn: { state: 'idle', used: [] }, scnText: scenarioFor(EG.gem(id)) };
  }
  function scenarioFor(g) {
    var list = (EG.SCENARIOS && EG.SCENARIOS[g.category]) || EG.SCENARIOS.PM;
    return list[EG.hash(g.id) % list.length] + ' Use "' + g.expression + '" in your answer.';
  }
  function ensure(g) { if (!R || R.gemId !== g.id) { EG.leaveSpeak(); R = fresh(g.id); } return R; }
  EG.openSpeak = function (id) { EG.leaveSpeak(); R = fresh(id); EG.go('speak'); };
  EG.leaveSpeak = function () {
    if (!R) return;
    clearInterval(R.timer); R.leaving = true;
    try { if (R.recog) R.recog.abort(); } catch (e) { /* ignore */ }
    try { if (R.rec && R.rec.state !== 'inactive') R.rec.stop(); } catch (e) { /* ignore */ }
    if (R.stream) R.stream.getTracks().forEach(function (t) { t.stop(); });
    ['shadow', 'scn'].forEach(function (k) { if (R[k].url) URL.revokeObjectURL(R[k].url); });
    if (audio) { audio.pause(); audio = null; }
    if (HAS_TTS) try { speechSynthesis.cancel(); } catch (e) { /* ignore */ }
    R = null;
  };

  /* ---------- view ---------- */
  function transcriptHTML(g, X, k) {
    if (X.transcript == null) return '';
    var found = EG.containsForm(X.transcript, g.forms);
    return '<div class="fb info"><b class="v">What the browser heard</b><p>&ldquo;' + esc(X.transcript || '(nothing recognized)') + '&rdquo;</p>' +
      '<p>' + (found ? 'The expression <b>' + esc(g.expression) + '</b> appears.' : 'I did not find <b>' + esc(g.expression) + '</b> in the text.') + '</p>' +
      '<p class="hint">This text comes from your browser\'s online speech service. It tends to correct your mistakes, so it is not a pronunciation score.</p></div>';
  }
  function ratingHTML(k, X) {
    return '<p style="margin-top:12px"><b>How did it feel?</b></p><div class="row" style="margin-top:8px">' + [['smooth', 'Smooth'], ['hesitated', 'Hesitated'], ['stuck', 'Stuck']].map(function (r) {
      return '<button class="chip' + (X.rating === r[0] ? ' on' : '') + '" data-act="rateSpeak" data-k="' + k + '" data-v="' + r[0] + '">' + r[1] + '</button>';
    }).join('') + '</div>';
  }
  EG.speakHTML = function (g, opt) {
    opt = opt || {};
    var r = ensure(g), sh = r.shadow, sc = r.scn, h = '';
    var rated = sh.rating || sc.rating;
    if (opt.session) h += '<div class="row between"><button class="icon-btn" data-act="exitSession">Close</button><span class="q-label">Speak - ' + (S.session.i + 1) + ' of ' + S.session.steps.length + '</span></div><div class="progress" style="margin:12px 0 18px"><i style="width:' + Math.round(S.session.i / S.session.steps.length * 100) + '%"></i></div>';
    else h += '<div class="row between"><button class="icon-btn" data-act="leaveSpeakPage">Back</button><span class="q-label">Speaking practice</span></div>';
    h += '<h2 class="q-title" style="margin-top:14px">' + esc(g.expression) + '</h2><div class="stack">';
    if (r.error) h += '<div class="fb no"><b class="v">' + (r.error === 'denied' ? 'Microphone is blocked' : 'Recording did not start') + '</b>' + (r.error === 'denied' ? 'Allow the microphone for this site in your browser settings, then tap Record again.' : 'Check that a microphone is connected and not used by another app.') + '</div>';
    /* 1 listen and repeat */
    h += '<div class="card"><div class="q-label">1. Listen and repeat</div><p class="example">&ldquo;' + esc(g.example) + '&rdquo;</p>' +
      '<div class="row" style="margin-top:12px"><button class="btn small soft" data-act="say" data-id="' + g.id + '">Normal</button><button class="btn small soft" data-act="say" data-id="' + g.id + '" data-slow="1">Slow</button></div>' + (HAS_TTS ? '' : '<p class="hint">Spoken audio is not available in this browser.</p>') + '</div>';
    /* 2 shadowing */
    h += '<div class="card"><div class="q-label">2. Shadowing</div><p style="margin-top:4px">Say the sentence, then compare your voice with the model.</p><div style="margin-top:12px">';
    h += recUI('shadow', sh, g, 'Record my voice');
    h += '</div></div>';
    /* 3 scenario */
    h += '<div class="card"><div class="q-label">3. Scenario (30 seconds)</div><p class="scn" style="margin-top:8px">' + esc(r.scnText) + '</p><div style="margin-top:12px">';
    h += recUI('scn', sc, g, 'Start scenario');
    if (sc.state === 'done') {
      var rec = S.days.get(EG.today()), ids = rec && rec.ids.indexOf(g.id) >= 0 ? rec.ids : [g.id];
      h += '<p style="margin-top:12px"><b>Which gems did you use?</b></p>' + ids.map(EG.gem).filter(Boolean).map(function (x) {
        return '<label class="checkrow"><input type="checkbox" data-ch="tick" data-id="' + x.id + '"' + (sc.used.indexOf(x.id) >= 0 ? ' checked' : '') + '><span>' + esc(x.expression) + '</span></label>';
      }).join('');
    }
    h += '</div></div></div>';
    h += '<div class="bar nonav"><div>' + (opt.session ? '<button class="btn' + (rated ? '' : ' ghost') + '" data-act="speakDone">' + (rated ? (S.session.i + 1 >= S.session.steps.length ? 'Finish' : 'Continue') : 'Skip speaking') + '</button>' : '<button class="btn" data-act="leaveSpeakPage">Done</button>') + '</div></div>';
    return h;
  };
  function recUI(k, X, g, label) {
    if (X.state === 'unsupported') return '<p class="hint">Recording is not supported here. Say it out loud anyway, then rate yourself.</p>' + ratingHTML(k, X);
    if (X.state === 'idle') return '<button class="btn block" data-act="recStart" data-k="' + k + '">' + label + '</button>';
    if (X.state === 'ready') return '<p class="sub" style="text-align:center">Get ready</p><div class="big-count" id="cnt-' + k + '">' + X.count + '</div>';
    if (X.state === 'rec') return '<div class="row between"><span><span class="rec-dot"></span> Recording</span><span class="q-label" id="cnt-' + k + '">' + (k === 'scn' ? X.secs + ' s' : '') + '</span></div><div style="margin-top:12px"><button class="btn block danger" data-act="recStop" data-k="' + k + '">Stop</button></div>';
    var h = '<div class="row"><button class="btn small soft" data-act="playModel" data-k="' + k + '">Model</button><button class="btn small soft" data-act="playMine" data-k="' + k + '">Mine</button>' + (k === 'shadow' ? '<button class="btn small soft" data-act="playBoth" data-k="' + k + '">Both</button>' : '') + '<button class="btn small ghost" data-act="recStart" data-k="' + k + '">Again</button></div>';
    if (X.pending) h += '<p class="hint">Checking the transcript...</p>';
    h += transcriptHTML(g, X, k) + ratingHTML(k, X);
    return h;
  }

  /* ---------- recording ---------- */
  function pickMime() {
    var c = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm', 'audio/ogg;codecs=opus'];
    for (var i = 0; i < c.length; i++) { try { if (MediaRecorder.isTypeSupported(c[i])) return c[i]; } catch (e) { /* ignore */ } }
    return '';
  }
  function setCount(k, txt) { var el = document.getElementById('cnt-' + k); if (el) el.textContent = txt; }
  EG.acts.recStart = function (el) { startFlow(el.dataset.k); };
  function startFlow(k) {
    var r = R; if (!r) return;
    var X = r[k]; r.error = null;
    if (X.url) { URL.revokeObjectURL(X.url); X.url = null; }
    X.blob = null; X.rating = null; X.transcript = null; X.recId = null; X.pending = false;
    if (k === 'scn') X.used = [];
    if (audio) { audio.pause(); }
    if (HAS_TTS) try { speechSynthesis.cancel(); } catch (e) { /* ignore */ }
    if (k === 'scn') {
      X.state = 'ready'; X.count = 3; EG.render(true);
      r.timer = setInterval(function () {
        if (R !== r) { clearInterval(r.timer); return; }
        X.count--;
        if (X.count <= 0) { clearInterval(r.timer); beginRecording(k); } else setCount(k, X.count);
      }, 1000);
    } else beginRecording(k);
  }
  async function beginRecording(k) {
    var r = R; if (!r) return; var X = r[k];
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || typeof MediaRecorder === 'undefined') { X.state = 'unsupported'; EG.render(true); return; }
    var stream;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
    catch (e) { if (R !== r) return; r.error = (e && e.name === 'NotAllowedError') ? 'denied' : 'fail'; X.state = 'idle'; EG.render(true); return; }
    if (R !== r) { stream.getTracks().forEach(function (t) { t.stop(); }); return; }
    var mime = pickMime(), chunks = [], rec;
    try { rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream); }
    catch (e) { stream.getTracks().forEach(function (t) { t.stop(); }); r.error = 'fail'; X.state = 'idle'; EG.render(true); return; }
    r.stream = stream; r.rec = rec; r.k = k;
    rec.ondataavailable = function (e) { if (e.data && e.data.size) chunks.push(e.data); };
    rec.onstop = function () {
      stream.getTracks().forEach(function (t) { t.stop(); });
      if (R !== r || r.leaving) return;
      var type = rec.mimeType || mime || 'audio/webm';
      X.blob = new Blob(chunks, { type: type }); X.url = URL.createObjectURL(X.blob); X.state = 'done';
      EG.render(true);
    };
    startRecog(r, X, k);
    X.state = 'rec'; X.secs = 30;
    rec.start();
    EG.render(true);
    var started = Date.now();
    clearInterval(r.timer);
    r.timer = setInterval(function () {
      if (R !== r) { clearInterval(r.timer); return; }
      var el = Math.floor((Date.now() - started) / 1000);
      if (k === 'scn') { X.secs = Math.max(0, 30 - el); setCount(k, X.secs + ' s'); if (X.secs <= 0) stopRec(k); }
      else if (el >= 20) stopRec(k);
    }, 500);
  }
  function startRecog(r, X, k) {
    if (!SR || !navigator.onLine || !S.settings.transcript) return;
    try {
      var rc = new SR(); rc.lang = 'en-US'; rc.continuous = true; rc.interimResults = false;
      var text = '';
      rc.onresult = function (e) { for (var i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) text += (text ? ' ' : '') + e.results[i][0].transcript; };
      rc.onerror = function () { };
      rc.onend = function () { if (R !== r) return; finishTranscript(r, X, k, text); };
      r.recog = rc; X.pending = true; rc.start();
    } catch (e) { r.recog = null; X.pending = false; }
  }
  function finishTranscript(r, X, k, text) {
    if (!X.pending) return;
    X.pending = false; X.transcript = text;
    if (k === 'scn') {
      var rec = S.days.get(EG.today()), ids = rec && rec.ids.indexOf(r.gemId) >= 0 ? rec.ids : [r.gemId];
      X.used = ids.filter(function (id) { var g = EG.gem(id); return g && EG.containsForm(text, g.forms); });
    }
    EG.render(true);
  }
  function stopRec(k) {
    var r = R; if (!r) return;
    clearInterval(r.timer);
    try { if (r.rec && r.rec.state !== 'inactive') r.rec.stop(); } catch (e) { /* ignore */ }
    try { if (r.recog) r.recog.stop(); } catch (e) { /* ignore */ }
    var X = r[k];
    if (X.pending) setTimeout(function () { if (R === r && X.pending) finishTranscript(r, X, k, ''); }, 3000);
  }
  EG.acts.recStop = function (el) { stopRec(el.dataset.k); };

  /* ---------- playback ---------- */
  EG.acts.playModel = function (el) { var g = EG.gem(R.gemId); EG.say(el.dataset.k === 'shadow' ? g.example : g.example, false); };
  function playMine(k, cb) {
    var X = R && R[k]; if (!X || !X.url) return;
    if (audio) audio.pause();
    audio = new Audio(X.url); if (cb) audio.onended = cb;
    audio.play().catch(function () { EG.toast('Tap again to play.'); });
  }
  EG.acts.playMine = function (el) { playMine(el.dataset.k); };
  EG.acts.playBoth = function (el) { var k = el.dataset.k, g = EG.gem(R.gemId); EG.say(g.example, false, function () { setTimeout(function () { playMine(k); }, 300); }); };

  /* ---------- rating and saving ---------- */
  function markSpeak(gemId, val) {
    var rec = S.days.get(EG.today());
    if (!rec || rec.ids.indexOf(gemId) < 0) return;
    rec.done[gemId] = rec.done[gemId] || {};
    if (rec.done[gemId].speak !== true) rec.done[gemId].speak = val;
    EG.saveDay(rec);
  }
  function saveSpeaking(k) {
    var X = R[k]; if (!X.rating) return;
    if (!X.recId) X.recId = EG.uid('s');
    var r = { id: X.recId, gemId: R.gemId, kind: k === 'scn' ? 'scenario' : 'shadow', rating: X.rating, used: k === 'scn' ? X.used.slice() : [R.gemId], date: EG.today(), ts: Date.now(), transcript: X.transcript == null ? null : X.transcript };
    var i = S.speaking.findIndex(function (x) { return x.id === r.id; });
    if (i >= 0) S.speaking[i] = r; else S.speaking.push(r);
    EG.dbPut('speaking', r);
    if (S.settings.keepRecordings && X.blob) EG.dbPut('recordings', { id: r.id, gemId: r.gemId, kind: r.kind, ts: r.ts, mime: X.blob.type, blob: X.blob });
    markSpeak(R.gemId, true);
  }
  EG.acts.rateSpeak = function (el) { var k = el.dataset.k; R[k].rating = el.dataset.v; saveSpeaking(k); EG.render(true); };
  EG.chs.tick = function (el) {
    var X = R.scn, i = X.used.indexOf(el.dataset.id);
    if (el.checked && i < 0) X.used.push(el.dataset.id); else if (!el.checked && i >= 0) X.used.splice(i, 1);
    saveSpeaking('scn');
  };
  EG.acts.speakDone = function () {
    var id = R && R.gemId; if (id) markSpeak(id, 'skipped');
    EG.leaveSpeak(); EG.acts.nextStep();
  };
  EG.acts.leaveSpeakPage = function () { EG.leaveSpeak(); EG.go('today', { force: true }); };
  EG.views.speak = function () { if (!R) return '<div class="empty">Pick a gem on the Today screen.</div>'; return EG.speakHTML(EG.gem(R.gemId), {}); };
})();
