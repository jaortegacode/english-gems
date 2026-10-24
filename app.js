/* English Gems - app core: state, routing, Today, practice sessions, weekly review */
(function () {
  'use strict';
  var EG = window.EG, esc = EG.esc;
  var DEFAULTS = { activeStart: 8, activeEnd: 18, activeDays: [1, 2, 3, 4, 5], interval: 2, accent: 'US', voiceURI: '', keepRecordings: false, transcript: true, remindersOn: true };
  var S = EG.S = { gems: new Map(), days: new Map(), attempts: [], checkins: [], speaking: [], reviews: [], meta: null, settings: null, route: 'today', session: null, esOpen: {}, lib: { q: '', cat: 'all', status: 'all' }, noteOpen: -1 };
  EG.views = {}; EG.acts = {}; EG.after = {}; EG.ins = {}; EG.chs = {};
  var $ = function (s) { return document.querySelector(s); };
  EG.$ = $;

  /* ---------- basics ---------- */
  EG.today = function () { return EG.localDate(); };
  EG.dayNo = function () { return Math.max(1, EG.daysBetween(S.meta.startDate, EG.today()) + 1); };
  EG.weekOf = function (d) { return Math.ceil(d / 7); };
  EG.dayIds = function (n) { return S.meta.order.slice((n - 1) * 3, n * 3); };
  EG.gem = function (id) { return S.gems.get(id); };
  EG.saveGem = function (g) { return EG.dbPut('gems', g); };
  EG.saveKV = function (key, value) { return EG.dbPut('kv', { key: key, value: value }); };
  EG.saveMeta = function () { return EG.saveKV('meta', S.meta); };
  EG.saveSettings = function () { return EG.saveKV('settings', S.settings); };
  EG.saveDay = function (d) { return EG.dbPut('days', d); };
  EG.uid = function (p) { return (p || 'x') + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); };
  EG.toast = function (m) { var t = $('#toast'); t.textContent = m; t.classList.add('show'); clearTimeout(EG._tt); EG._tt = setTimeout(function () { t.classList.remove('show'); }, 2600); };
  EG.openModal = function (html) { var m = $('#modal'); m.innerHTML = '<div class="sheet">' + html + '</div>'; m.classList.add('open'); };
  EG.closeModal = function () { var m = $('#modal'); m.classList.remove('open'); m.innerHTML = ''; };
  EG.completedDates = function () { var a = []; S.days.forEach(function (d) { if (d.completed) a.push(d.date); }); return a; };

  EG.ensureToday = function () {
    var date = EG.today();
    if (!S.days.has(date)) {
      var n = EG.dayNo();
      var rec = { date: date, dayNo: n, ids: EG.dayIds(n), done: {}, completed: false, shownAt: Date.now() };
      S.days.set(date, rec); EG.saveDay(rec);
    }
    return S.days.get(date);
  };

  function newGem(c) {
    return { id: c.id, expression: c.expr, meaning: c.meaning, es: c.es, example: c.ex, note: c.note, category: c.cat, register: c.reg, frequency: c.freq, forms: c.forms, status: 'new', cd: [], attempts: 0, correct: 0, misses: 0, lastMiss: null, lastSeen: null, custom: false };
  }

  EG.load = async function () {
    await EG.dbOpen();
    var r = await Promise.all(['gems', 'days', 'attempts', 'checkins', 'speaking', 'kv'].map(EG.dbAll));
    var kv = {}; r[5].forEach(function (x) { kv[x.key] = x.value; });
    if (!r[0].length) {
      var gems = EG.GEMS.map(newGem);
      await EG.dbPutMany('gems', gems);
      r[0] = gems;
    }
    S.gems = new Map(r[0].map(function (g) { return [g.id, g]; }));
    S.days = new Map(r[1].map(function (d) { return [d.date, d]; }));
    S.attempts = r[2]; S.checkins = r[3]; S.speaking = r[4];
    S.reviews = kv.reviews || [];
    S.settings = Object.assign({}, DEFAULTS, kv.settings || {});
    S.meta = kv.meta || { startDate: EG.today(), order: EG.ORDER.slice(), lastBackup: null, checkin: { pending: null, lastAt: 0, snoozeUntil: 0 } };
    if (!S.meta.checkin) S.meta.checkin = { pending: null, lastAt: 0, snoozeUntil: 0 };
    if (!kv.meta) await EG.saveMeta();
    if (!kv.settings) await EG.saveSettings();
  };

  /* ---------- navigation and rendering ---------- */
  var TABS = [
    ['today', 'Today', '<path d="M12 3l8 6-8 12L4 9z"/><path d="M4 9h16M9 9l3 12 3-12"/>'],
    ['progress', 'Progress', '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>'],
    ['review', 'Review', '<path d="M5 4h14v16H5z"/><path d="M9 9l2 2 4-4M9 15h6"/>'],
    ['library', 'Library', '<path d="M4 5a2 2 0 012-2h12v16H6a2 2 0 00-2 2z"/><path d="M4 19V5"/>'],
    ['more', 'More', '<circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>']
  ];
  var FULL = { session: 1, speak: 1, checkin: 1 };
  EG.go = function (route, opts) {
    opts = opts || {};
    if (route === S.route && !opts.force) { EG.render(false); return; }
    S.route = route;
    try { if (!opts.replace) history.pushState({ r: route }, ''); } catch (e) { /* sandboxed */ }
    EG.render(false);
  };
  window.addEventListener('popstate', function (e) {
    var r = (e.state && e.state.r) || 'today';
    if (S.route === 'session' || S.route === 'speak') EG.leaveSpeak && EG.leaveSpeak();
    S.route = r; EG.render(false);
  });
  EG.render = function (keep) {
    if (!S.settings) return;
    var y = window.scrollY, app = $('#app');
    var v = EG.views[S.route] || EG.views.today;
    app.innerHTML = v();
    app.className = FULL[S.route] ? 'nonav' : '';
    var nav = $('#tabs');
    if (!nav) { nav = document.createElement('nav'); nav.id = 'tabs'; nav.className = 'tabs'; document.body.appendChild(nav); }
    nav.hidden = !!FULL[S.route];
    var due = EG.checkinDue && EG.checkinDue();
    nav.innerHTML = '<div>' + TABS.map(function (t) {
      return '<button data-act="tab" data-to="' + t[0] + '"' + (S.route === t[0] ? ' aria-current="page"' : '') + '><svg viewBox="0 0 24 24" aria-hidden="true">' + t[2] + '</svg>' + t[1] + (t[0] === 'today' && due ? '<span class="badge" aria-label="Check-in due"></span>' : '') + '</button>';
    }).join('') + '</div>';
    if (keep) window.scrollTo(0, y); else window.scrollTo(0, 0);
    if (EG.after[S.route]) EG.after[S.route]();
  };

  /* event delegation */
  document.addEventListener('click', function (e) {
    if (e.target.id === 'modal') { EG.closeModal(); return; }
    var el = e.target.closest('[data-act]');
    if (!el) return;
    var fn = EG.acts[el.dataset.act];
    if (fn) { e.preventDefault(); fn(el, e); }
  });
  document.addEventListener('input', function (e) { var k = e.target.dataset && e.target.dataset.in; if (k && EG.ins[k]) EG.ins[k](e.target); });
  document.addEventListener('change', function (e) { var k = e.target.dataset && e.target.dataset.ch; if (k && EG.chs[k]) EG.chs[k](e.target); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey && e.target.dataset && e.target.dataset.enter) { e.preventDefault(); var b = document.querySelector('[data-act="' + e.target.dataset.enter + '"]'); if (b) b.click(); }
    if (e.key === 'Escape') EG.closeModal();
  });
  EG.acts.tab = function (el) { if (S.route === 'session') EG.exitSessionNow(); EG.go(el.dataset.to); };
  EG.acts.go = function (el) { EG.go(el.dataset.to); };
  EG.acts.closeModal = function () { EG.closeModal(); };
  EG.acts.say = function (el) { EG.say && EG.say(EG.gem(el.dataset.id).example, el.dataset.slow === '1'); };
  EG.acts.toggleEs = function (el) { var id = el.dataset.id; S.esOpen[id] = !S.esOpen[id]; EG.render(true); };

  /* ---------- shared gem bits ---------- */
  EG.tagsHTML = function (g, opt) {
    return '<div class="tags"><span class="tag">' + esc(EG.catShort(g.category)) + '</span>' +
      (g.register !== 'n' ? '<span class="tag reg-' + g.register + '">' + EG.REG[g.register] + '</span>' : '') +
      '<span class="tag st-' + g.status + '">' + g.status + '</span></div>';
  };
  function stepDots(rec, id) {
    var d = (rec && rec.done[id]) || {};
    return '<div class="dots">' + [['mc', 'Meaning'], ['fill', 'Fill'], ['write', 'Write'], ['speak', 'Speak']].map(function (x) {
      var on = x[0] === 'speak' ? d.speak === true : !!d[x[0]];
      return '<span class="dot' + (on ? ' on' : '') + '"><i></i>' + x[1] + '</span>';
    }).join('') + '</div>';
  }

  /* ---------- Today ---------- */
  EG.views.today = function () {
    var rec = EG.ensureToday(), n = rec.dayNo, gems = rec.ids.map(EG.gem).filter(Boolean);
    var st = EG.computeStreaks(EG.completedDates(), rec.date);
    var due = EG.checkinDue && EG.checkinDue();
    var h = '<header class="top"><div><div class="sub">Day ' + n + ' - ' + esc(EG.fmtDate(rec.date)) + '</div><h1>' + (gems.length ? 'Your 3 gems today' : 'Starter bank finished') + '</h1></div>' +
      '<button class="chip" data-act="go" data-to="progress" aria-label="Streak">Streak ' + st.current + '</button></header><div class="stack">';
    if (EG.memOnly) h += '<div class="banner"><div><b>Storage is off</b>This browser blocks local storage, so progress will be lost when you close the tab.</div></div>';
    if (due) h += '<div class="banner"><div><b>Check-in time</b>Two quick questions about the last ' + S.settings.interval + ' hours.</div><button class="btn" data-act="startCheckin">Open</button></div>';
    if (EG.backupDue && EG.backupDue()) h += '<div class="banner info"><div><b>Back up your progress</b>Browsers can clear local data. Save a file now.</div><button class="btn" data-act="exportData">Back up</button></div>';
    var done = 0, total = gems.length * 3;
    gems.forEach(function (g) { var d = rec.done[g.id] || {}; done += (d.mc ? 1 : 0) + (d.fill ? 1 : 0) + (d.write ? 1 : 0); });
    if (!gems.length) {
      h += '<div class="card"><p>You have worked through all 90 days. Keep the gems fresh with a quick review, the weekly quiz, or add your own expressions in the Library.</p></div>';
    } else {
      h += '<div class="row between"><span class="sub">' + done + ' of ' + total + ' exercises done</span><button class="link" data-act="startCheckin">Check-in' + (due ? ' <span class="badge">1</span>' : '') + '</button></div><div class="progress"><i style="width:' + Math.round(done / total * 100) + '%"></i></div>';
      gems.forEach(function (g) {
        h += '<article class="card gem st-' + g.status + '">' + EG.tagsHTML(g) + '<h2 class="expr">' + esc(g.expression) + '</h2><p class="meaning">' + esc(g.meaning) + '</p>' +
          '<p class="example">&ldquo;' + esc(g.example) + '&rdquo;</p><p class="note"><b>When to use it:</b> ' + esc(g.note) + '</p>' +
          (S.esOpen[g.id] ? '<p class="es">' + esc(g.es || 'No Spanish note yet.') + '</p>' : '') +
          '<div class="row" style="margin-top:8px"><button class="icon-btn" data-act="say" data-id="' + g.id + '">Listen</button><button class="icon-btn" data-act="speakGem" data-id="' + g.id + '">Speak</button><button class="link" data-act="toggleEs" data-id="' + g.id + '">' + (S.esOpen[g.id] ? 'Hide Spanish' : 'Show Spanish') + '</button></div>' +
          stepDots(rec, g.id) + '</article>';
      });
      if (rec.completed) h += '<div class="fb ok"><b class="v">Done for today</b>Come back tomorrow for three new gems. Want more now? Try a quick review.</div>';
    }
    h += '</div><div class="bar"><div>' +
      (gems.length && !rec.completed ? '<button class="btn" data-act="startDaily">' + (done ? 'Continue practice' : 'Start practice') + '</button>' : '<button class="btn" data-act="startQuick">Quick review</button>') + '</div></div>';
    return h;
  };
  EG.acts.speakGem = function (el) { EG.openSpeak(el.dataset.id); };

  /* ---------- question builders ---------- */
  function mkMC(g) {
    var all = Array.from(S.gems.values()).filter(function (x) { return x.id !== g.id && x.meaning !== g.meaning; });
    var same = EG.shuffle(all.filter(function (x) { return x.category === g.category; }));
    var rest = EG.shuffle(all.filter(function (x) { return x.category !== g.category; }));
    var d = same.concat(rest).slice(0, 3).map(function (x) { return { t: x.meaning, ok: false }; });
    return EG.shuffle(d.concat([{ t: g.meaning, ok: true }]));
  }
  function mkFill(g) {
    var m = EG.findForm(g.example, g.forms);
    if (!m) return { fallback: true };
    return { before: g.example.slice(0, m.index), after: g.example.slice(m.index + m.length), answer: m.text };
  }
  EG.mkQ = function (id, type, src) {
    var g = EG.gem(id), q = { gemId: id, type: type, src: src, st: {} };
    if (type === 'mc') q.opts = mkMC(g);
    if (type === 'fill') q.fill = mkFill(g);
    return q;
  };

  /* ---------- sessions ---------- */
  EG.startSession = function (s) { s.i = 0; s.results = []; s.date = EG.today(); S.session = s; EG.go('session'); };
  EG.acts.startDaily = function () {
    var rec = EG.ensureToday(), steps = [];
    rec.ids.forEach(function (id) {
      var d = rec.done[id] || {};
      ['mc', 'fill', 'write', 'speak'].forEach(function (t) { if (!d[t]) steps.push(EG.mkQ(id, t, 'daily')); });
    });
    if (!steps.length) { EG.toast('All steps are done today.'); return; }
    EG.startSession({ kind: 'daily', title: 'Daily practice', steps: steps });
  };
  EG.acts.startQuick = function () {
    var pool = Array.from(S.gems.values()).filter(function (g) { return g.attempts > 0; });
    if (!pool.length) { EG.toast('Practice your daily gems first.'); return; }
    pool.sort(function (a, b) {
      var sa = (a.status === 'learning' ? 0 : 1) - (b.status === 'learning' ? 0 : 1);
      return sa || (b.misses || 0) - (a.misses || 0) || String(a.lastSeen).localeCompare(String(b.lastSeen));
    });
    var pick = EG.shuffle(pool.slice(0, 12)).slice(0, 6);
    EG.startSession({ kind: 'extra', title: 'Quick review', steps: pick.map(function (g, i) { return EG.mkQ(g.id, i % 2 ? 'fill' : 'mc', 'extra'); }) });
  };
  EG.exitSessionNow = function () { EG.leaveSpeak && EG.leaveSpeak(); S.session = null; };
  EG.acts.exitSession = function () {
    var s = S.session;
    EG.exitSessionNow(); EG.go(s && s.kind === 'review' ? 'review' : 'today', { force: true });
  };

  EG.recordAnswer = function (q, correct) {
    var g = EG.gem(q.gemId), date = EG.today();
    EG.applyResult(g, correct, date); EG.saveGem(g);
    var a = { id: EG.uid('a'), gemId: g.id, type: q.type, correct: !!correct, date: date, ts: Date.now(), src: q.src };
    S.attempts.push(a); EG.dbPut('attempts', a);
    if (q.src === 'daily') markDone(q.gemId, q.type);
  };
  function markDone(gemId, type) {
    var s = S.session, rec = S.days.get(s ? s.date : EG.today());
    if (!rec) return;
    rec.done[gemId] = rec.done[gemId] || {}; rec.done[gemId][type] = true;
    rec.completed = rec.ids.length > 0 && rec.ids.every(function (id) { var d = rec.done[id] || {}; return d.mc && d.fill && d.write; });
    EG.saveDay(rec);
  }

  function finishQ(q, correct) {
    q.st.done = true; q.st.correct = !!correct;
    EG.recordAnswer(q, correct);
    S.session.results.push({ gemId: q.gemId, type: q.type, correct: !!correct });
    EG.render(true);
    setTimeout(function () { var b = document.querySelector('[data-act="nextStep"]'); if (b && b.scrollIntoView) b.scrollIntoView({ block: 'nearest' }); }, 30);
  }
  EG.acts.nextStep = function () {
    var s = S.session; s.i++;
    if (s.i >= s.steps.length) { s.finished = true; if (s.kind === 'review') saveReview(s); }
    EG.render(false);
  };

  function fbHTML(ok, title, body) { return '<div class="fb ' + (ok ? 'ok' : 'no') + '"><b class="v">' + title + '</b>' + body + '</div>'; }
  function gemBrief(g) { return '<p><b>' + esc(g.expression) + '</b>: ' + esc(g.meaning) + '.</p><p class="note">' + esc(g.note) + '</p>'; }

  EG.views.session = function () {
    var s = S.session;
    if (!s) return '<div class="empty">No practice running.</div>';
    if (s.finished) return summaryHTML(s);
    var q = s.steps[s.i], g = EG.gem(q.gemId), st = q.st, h = '';
    h += '<div class="row between"><button class="icon-btn" data-act="exitSession">Close</button><span class="q-label">' + esc(s.title) + ' - ' + (s.i + 1) + ' of ' + s.steps.length + '</span></div><div class="progress" style="margin:12px 0 18px"><i style="width:' + Math.round(s.i / s.steps.length * 100) + '%"></i></div>';
    var next = '<div class="bar nonav"><div><button class="btn" data-act="nextStep">' + (s.i + 1 >= s.steps.length ? 'Finish' : 'Next') + '</button></div></div>';
    if (q.type === 'mc') {
      h += '<div class="q-label">Meaning</div><h2 class="q-title">What does &ldquo;' + esc(g.expression) + '&rdquo; mean?</h2>';
      q.opts.forEach(function (o, i) {
        var cls = st.done ? (o.ok ? ' right' : (st.picked === i ? ' wrong' : '')) : '';
        h += '<button class="opt' + cls + '" data-act="mcPick" data-i="' + i + '"' + (st.done ? ' disabled' : '') + '>' + esc(o.t) + '</button>';
      });
      if (st.done) h += fbHTML(st.correct, st.correct ? 'Correct' : 'Not quite', gemBrief(g) + '<p class="example">&ldquo;' + esc(g.example) + '&rdquo;</p>') + next;
    } else if (q.type === 'fill') {
      h += '<div class="q-label">Fill in the blank</div>';
      if (q.fill.fallback) {
        h += '<h2 class="q-title">Which expression means: &ldquo;' + esc(g.meaning) + '&rdquo;?</h2>';
      } else {
        h += '<h2 class="q-title">' + esc(q.fill.before) + (st.done ? '<span class="hl">' + esc(q.fill.answer) + '</span>' : '<span class="blank">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>') + esc(q.fill.after) + '</h2>';
      }
      if (!st.done) {
        h += '<input id="fillIn" class="field" data-enter="fillCheck" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Type the missing words" value="' + esc(st.val || '') + '">';
        if (st.hint) h += '<p class="hint">' + esc(hintText(q, g)) + '</p>';
        h += '<div class="row" style="margin-top:12px"><button class="btn small ghost" data-act="fillHint">Hint</button><button class="btn small ghost" data-act="fillGive">Show answer</button></div>';
        h += '<div class="bar nonav"><div><button class="btn" data-act="fillCheck">Check</button></div></div>';
      } else {
        var ans = q.fill.fallback ? g.expression : q.fill.answer;
        h += fbHTML(st.correct, st.correct ? 'Correct' : 'Not quite', (st.note ? '<p>' + esc(st.note) + '</p>' : '') + (st.correct ? '' : '<p>The answer is <b>' + esc(ans) + '</b>.</p>') + gemBrief(g)) + next;
      }
    } else if (q.type === 'write') {
      h += '<div class="q-label">Write your own sentence</div><h2 class="q-title">Use &ldquo;' + esc(g.expression) + '&rdquo; in a sentence about your work.</h2>';
      h += '<p class="hint" style="margin:-6px 0 10px">Meaning: ' + esc(g.meaning) + '.</p>';
      if (!st.matched && !st.done) {
        h += '<textarea id="writeIn" class="field" data-in="write" placeholder="Write one sentence">' + esc(st.val || '') + '</textarea>';
        if (st.msg) h += '<p class="hint" style="color:var(--red)">' + esc(st.msg) + '</p>';
        h += '<div class="bar nonav"><div><button class="btn" data-act="writeCheck">Check</button></div></div>';
      } else {
        var m = EG.findForm(st.val, g.forms), vs = st.val;
        var shown = m ? esc(vs.slice(0, m.index)) + '<span class="hl">' + esc(m.text) + '</span>' + esc(vs.slice(m.index + m.length)) : esc(vs);
        h += '<div class="card"><p class="example" style="margin:0">&ldquo;' + shown + '&rdquo;</p></div>';
        if (!st.done) {
          h += '<div class="fb info"><b class="v">Your sentence includes the expression</b><p>Compare with a model: <i>&ldquo;' + esc(g.example) + '&rdquo;</i></p><p style="margin-top:10px"><b>How natural does yours sound?</b></p><div class="row" style="margin-top:8px"><button class="btn small soft grow" data-act="rate" data-v="natural">Natural</button><button class="btn small soft grow" data-act="rate" data-v="okay">Okay</button><button class="btn small ghost grow" data-act="rate" data-v="unsure">Not sure</button></div></div>';
        } else {
          h += fbHTML(st.correct, st.correct ? 'Saved' : 'Keep practicing', '<p>Model: <i>&ldquo;' + esc(g.example) + '&rdquo;</i></p>' + gemBrief(g)) + next;
        }
      }
      if (st.done && !st.matched) {
        h = h.replace('<div class="card">', '<div class="card">'); // sentence without the expression stays visible
      }
    } else if (q.type === 'speak') {
      h = EG.speakHTML(g, { session: true });
    }
    return h;
  };
  function hintText(q, g) {
    var a = q.fill.fallback ? g.expression : q.fill.answer;
    return 'Starts with "' + a.charAt(0) + '", ' + a.split(/\s+/).length + ' word' + (a.split(/\s+/).length > 1 ? 's' : '') + '. Meaning: ' + g.meaning + '.';
  }
  EG.after.session = function () {
    var s = S.session; if (!s || s.finished) return;
    var q = s.steps[s.i], f = document.getElementById('fillIn') || document.getElementById('writeIn');
    if (f && !q.st.done && window.matchMedia && !window.matchMedia('(pointer:coarse)').matches) f.focus();
    if (q.type === 'speak' && EG.afterSpeak) EG.afterSpeak();
  };
  EG.acts.mcPick = function (el) { var q = S.session.steps[S.session.i]; if (q.st.done) return; q.st.picked = +el.dataset.i; finishQ(q, q.opts[q.st.picked].ok); };
  EG.acts.fillHint = function () { var q = S.session.steps[S.session.i]; q.st.val = (document.getElementById('fillIn') || {}).value || ''; q.st.hint = true; EG.render(true); };
  EG.acts.fillGive = function () { var q = S.session.steps[S.session.i]; finishQ(q, false); };
  EG.acts.fillCheck = function () {
    var q = S.session.steps[S.session.i], g = EG.gem(q.gemId), v = ((document.getElementById('fillIn') || {}).value || '').trim();
    if (!v) { EG.toast('Type your answer first.'); return; }
    var target = q.fill.fallback ? g.expression : q.fill.answer;
    if (EG.normAnswer(v) === EG.normAnswer(target) || (q.fill.fallback && EG.matchesForm(v, g.forms))) { finishQ(q, true); return; }
    if (EG.matchesForm(v, g.forms)) { q.st.note = 'Right expression. In this sentence the form is "' + target + '".'; finishQ(q, true); return; }
    finishQ(q, false);
  };
  EG.ins.write = function (el) { var q = S.session && S.session.steps[S.session.i]; if (q) q.st.val = el.value; };
  EG.acts.writeCheck = function () {
    var q = S.session.steps[S.session.i], g = EG.gem(q.gemId), v = ((document.getElementById('writeIn') || {}).value || '').trim();
    q.st.val = v;
    if (v.split(/\s+/).length < 3) { q.st.msg = 'Write a full sentence, at least three words.'; EG.render(true); return; }
    if (EG.containsForm(v, g.forms)) { q.st.matched = true; q.st.msg = ''; EG.render(true); return; }
    if (!q.st.tried) { q.st.tried = true; q.st.msg = 'I cannot find "' + g.expression + '" (or a form of it) in your sentence. Try once more.'; EG.render(true); return; }
    q.st.matched = false; finishQ(q, false);
  };
  EG.acts.rate = function (el) { var q = S.session.steps[S.session.i]; q.st.rating = el.dataset.v; finishQ(q, el.dataset.v !== 'unsure'); };

  function summaryHTML(s) {
    var graded = s.results, ok = graded.filter(function (r) { return r.correct; }).length, tot = graded.length;
    var h = '<header class="top"><div><div class="sub">' + esc(s.title) + '</div><h1>' + (s.kind === 'review' ? 'Score: ' + ok + ' of ' + tot : 'Nice work') + '</h1></div></header><div class="stack">';
    h += '<div class="stat-grid"><div class="stat"><b>' + (tot ? Math.round(ok / tot * 100) : 0) + '%</b><span>accuracy</span></div><div class="stat"><b>' + ok + '/' + tot + '</b><span>correct answers</span></div></div>';
    if (s.kind === 'daily') {
      var st = EG.computeStreaks(EG.completedDates(), EG.today()), rec = S.days.get(s.date);
      h += '<div class="fb ' + (rec && rec.completed ? 'ok' : 'info') + '"><b class="v">' + (rec && rec.completed ? 'Streak: ' + st.current + ' day' + (st.current === 1 ? '' : 's') : 'Not finished yet') + '</b>' + (rec && rec.completed ? 'All three gems are done for today.' : 'Finish all exercises to count today for your streak.') + '</div>';
    }
    var missed = []; var seen = {};
    graded.forEach(function (r) { if (!r.correct && !seen[r.gemId]) { seen[r.gemId] = 1; missed.push(EG.gem(r.gemId)); } });
    if (missed.length) {
      h += '<h2 class="sec">' + (s.kind === 'review' ? 'These need more work' : 'To look at again') + '</h2>';
      missed.forEach(function (g) { h += '<div class="card" style="margin-bottom:10px"><b class="t" style="font-family:var(--serif);font-size:20px">' + esc(g.expression) + '</b><p>' + esc(g.meaning) + '</p><p class="example">&ldquo;' + esc(g.example) + '&rdquo;</p></div>'; });
    } else if (tot) h += '<div class="fb ok"><b class="v">No misses</b>Every answer was right.</div>';
    h += '</div><div class="bar nonav"><div><button class="btn" data-act="endSession">Back to ' + (s.kind === 'review' ? 'Review' : 'Today') + '</button></div></div>';
    return h;
  }
  EG.acts.endSession = function () { var k = S.session && S.session.kind; EG.exitSessionNow(); EG.go(k === 'review' ? 'review' : 'today', { force: true }); };

  /* ---------- weekly review ---------- */
  function weekIds(w) { var a = []; for (var d = (w - 1) * 7 + 1; d <= w * 7; d++) a = a.concat(EG.dayIds(d)); return a.filter(function (id) { return S.gems.has(id); }); }
  function earlierIds(w) { var a = []; for (var d = 1; d <= (w - 1) * 7; d++) a = a.concat(EG.dayIds(d)); return a.filter(function (id) { return S.gems.has(id); }); }
  EG.views.review = function () {
    var n = EG.dayNo(), cur = EG.weekOf(n), h = '<header class="top"><div><div class="sub">Day ' + n + '</div><h1>Review</h1></div></header><div class="stack">';
    h += '<div class="card"><h3 style="font-family:var(--serif);font-size:20px">Quick review</h3><p class="sub">Six questions on the gems you are still learning.</p><div style="margin-top:12px"><button class="btn block soft" data-act="startQuick">Start quick review</button></div></div>';
    h += '<h2 class="sec">Weekly quizzes</h2>';
    var maxW = Math.max(1, Math.floor(n / 7)), nextLocked = (Math.floor(n / 7) + 1);
    for (var w = Math.max(1, Math.floor(n / 7)); w >= 1; w--) {
      if (n < 7 * w) continue;
      var rs = S.reviews.filter(function (r) { return r.week === w; }), last = rs[rs.length - 1];
      h += '<div class="card"><div class="row between"><div><b style="font-family:var(--serif);font-size:20px">Week ' + w + '</b><div class="sub">Days ' + ((w - 1) * 7 + 1) + ' to ' + (w * 7) + (last ? ' - last score ' + last.score + '/' + last.total : '') + '</div></div><button class="btn small" data-act="startWeekly" data-w="' + w + '">' + (last ? 'Retake' : 'Start') + '</button></div></div>';
    }
    h += '<div class="card"><b style="font-family:var(--serif);font-size:20px">Week ' + nextLocked + '</b><div class="sub">Opens on day ' + (nextLocked * 7) + ' - ' + (nextLocked * 7 - n) + ' day' + (nextLocked * 7 - n === 1 ? '' : 's') + ' to go.</div></div>';
    h += '<p class="hint">Each quiz has 20 questions: about 70% from that week and 30% from earlier weeks.</p></div>';
    return h;
  };
  EG.acts.startWeekly = function (el) {
    var w = +el.dataset.w, cur = weekIds(w), earlier = earlierIds(w);
    var nCur = earlier.length ? Math.min(14, cur.length) : Math.min(20, cur.length);
    var picks = EG.shuffle(cur).slice(0, nCur);
    if (earlier.length) {
      var pool = earlier.map(EG.gem).sort(function (a, b) {
        var wa = (a.status === 'learning' ? 2 : 0) + (a.misses ? 1 : 0), wb = (b.status === 'learning' ? 2 : 0) + (b.misses ? 1 : 0);
        return wb - wa || Math.random() - .5;
      });
      var top = pool.slice(0, 18).map(function (g) { return g.id; });
      picks = picks.concat(EG.shuffle(top).slice(0, 20 - picks.length));
    }
    if (picks.length < 20) picks = picks.concat(EG.shuffle(cur.filter(function (id) { return picks.indexOf(id) < 0; })).slice(0, 20 - picks.length));
    var types = EG.shuffle(picks.map(function (_, i) { return i % 20 < 9 ? 'mc' : (i % 20 < 16 ? 'fill' : 'write'); }));
    var steps = EG.shuffle(picks).map(function (id, i) { return EG.mkQ(id, types[i], 'review'); });
    EG.startSession({ kind: 'review', title: 'Week ' + w + ' quiz', steps: steps, week: w });
  };
  function saveReview(s) {
    var ok = s.results.filter(function (r) { return r.correct; }).length, miss = [];
    s.results.forEach(function (r) { if (!r.correct && miss.indexOf(r.gemId) < 0) miss.push(r.gemId); });
    S.reviews.push({ id: EG.uid('r'), week: s.week, date: EG.today(), score: ok, total: s.results.length, missed: miss });
    EG.saveKV('reviews', S.reviews);
  }
})();
