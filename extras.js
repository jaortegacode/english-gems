/* English Gems - progress, check-ins, library, settings, backup, study notes, boot */
(function () {
  'use strict';
  var EG = window.EG, S = EG.S, esc = EG.esc, $ = EG.$;

  /* ================= check-ins (in-app reminders) ================= */
  EG.inActiveWindow = function (d) {
    var s = S.settings;
    if (s.activeDays.indexOf(d.getDay()) < 0) return false;
    var h = d.getHours() + d.getMinutes() / 60;
    return h >= s.activeStart && h < s.activeEnd;
  };
  EG.evalCheckin = function () {
    if (!S.settings || !S.meta) return false;
    var ck = S.meta.checkin, now = Date.now(), changed = false;
    if (ck.pending) {
      var p = S.checkins.find(function (c) { return c.id === ck.pending; });
      if (!p) { ck.pending = null; changed = true; }
      else if (EG.localDate(new Date(p.dueAt)) !== EG.today()) { p.status = 'missed'; EG.dbPut('checkins', p); ck.pending = null; changed = true; }
    }
    if (!ck.pending && S.settings.remindersOn && EG.inActiveWindow(new Date())) {
      var rec = S.days.get(EG.today());
      if (rec && rec.ids.length) {
        var base = Math.max(ck.lastAt || 0, rec.shownAt || 0);
        if (now >= base + S.settings.interval * 3600e3) {
          var c = { id: EG.uid('c'), dueAt: now, status: 'due', dayNo: rec.dayNo };
          S.checkins.push(c); EG.dbPut('checkins', c); ck.pending = c.id; ck.snoozeUntil = 0; changed = true;
        }
      }
    }
    if (changed) EG.saveMeta();
    return changed;
  };
  EG.checkinDue = function () {
    var ck = S.meta && S.meta.checkin;
    return !!(S.settings.remindersOn && ck && ck.pending && Date.now() >= (ck.snoozeUntil || 0));
  };
  EG.refreshReminders = function () {
    var due = EG.checkinDue();
    document.title = due ? '(1) English gems' : 'English gems';
    try { if (due) { if (navigator.setAppBadge) navigator.setAppBadge(1); } else if (navigator.clearAppBadge) navigator.clearAppBadge(); } catch (e) { /* ignore */ }
    if (due !== EG._lastDue) { EG._lastDue = due; if (S.route === 'today') EG.render(true); }
  };
  EG.backupDue = function () {
    var lb = S.meta.lastBackup;
    return lb ? EG.daysBetween(lb, EG.today()) >= 7 : EG.dayNo() >= 7;
  };
  function tick() {
    if (!S.settings) return;
    if (S._today !== EG.today()) { S._today = EG.today(); EG.ensureToday(); if (S.route === 'today') EG.render(false); }
    EG.evalCheckin(); EG.refreshReminders();
  }

  EG.acts.startCheckin = function () { S.ck = { used: [], none: false, next: null, sentences: {}, done: false }; EG.go('checkin'); };
  EG.views.checkin = function () {
    var rec = EG.ensureToday(), gems = rec.ids.map(EG.gem).filter(Boolean), c = S.ck || (S.ck = { used: [], none: false, next: null, sentences: {}, done: false }), n = S.settings.interval;
    var h = '<div class="row between"><button class="icon-btn" data-act="closeCheckin">Close</button><span class="q-label">Check-in</span></div><h1 class="q-title" style="margin-top:14px">Quick check-in</h1>';
    if (!gems.length) return h + '<div class="empty">There are no gems for today.</div>';
    if (c.done) {
      h += '<div class="stack">' + gems.map(function (g) {
        var t = c.sentences[g.id]; if (!t) return '';
        var ok = EG.containsForm(t, g.forms);
        return '<div class="card"><b>' + esc(g.expression) + '</b><p class="example">&ldquo;' + esc(t) + '&rdquo;</p><p class="hint">' + (ok ? 'The expression appears in your sentence.' : 'I could not find the expression in this sentence.') + '</p></div>';
      }).join('') + '<div class="fb ok"><b class="v">Check-in saved</b>Thanks. Use your chosen gem in the next ' + n + ' hours.</div></div><div class="bar nonav"><div><button class="btn" data-act="closeCheckin">Back to Today</button></div></div>';
      return h;
    }
    h += '<div class="stack"><div class="card"><div class="q-label">1</div><p><b>Which gem of the day were you able to use in the last ' + n + ' hours?</b></p><div class="row" style="margin-top:10px">' +
      gems.map(function (g) { return '<button class="chip' + (c.used.indexOf(g.id) >= 0 ? ' on' : '') + '" data-act="ckUsed" data-id="' + g.id + '">' + esc(g.expression) + '</button>'; }).join('') +
      '<button class="chip' + (c.none ? ' on' : '') + '" data-act="ckNone">None yet</button></div></div>';
    h += '<div class="card"><div class="q-label">2</div><p><b>Which gem will you use for sure in the next ' + n + ' hours?</b></p><div class="row" style="margin-top:10px">' +
      gems.map(function (g) { return '<button class="chip' + (c.next === g.id ? ' on' : '') + '" data-act="ckNext" data-id="' + g.id + '">' + esc(g.expression) + '</button>'; }).join('') + '</div></div>';
    h += '<div class="card"><div class="q-label">3</div><p><b>Write one example for each gem of the day.</b></p>' + gems.map(function (g) {
      return '<label class="lbl">' + esc(g.expression) + '</label><textarea class="field" style="min-height:84px" data-in="ckS" data-id="' + g.id + '" placeholder="Your own sentence">' + esc(c.sentences[g.id] || '') + '</textarea>';
    }).join('') + '</div></div>';
    var pending = S.meta.checkin.pending;
    h += '<div class="bar nonav"><div>' + (pending ? '<button class="btn ghost small" data-act="snoozeCheckin" style="flex:1 1 40%">Snooze 30 min</button><button class="btn ghost small" data-act="skipCheckin" style="flex:1 1 40%">Skip</button>' : '') + '<button class="btn" data-act="saveCheckin" style="flex:1 1 100%">Save</button></div></div>';
    return h;
  };
  EG.acts.ckUsed = function (el) { var c = S.ck, i = c.used.indexOf(el.dataset.id); if (i >= 0) c.used.splice(i, 1); else { c.used.push(el.dataset.id); c.none = false; } EG.render(true); };
  EG.acts.ckNone = function () { S.ck.none = !S.ck.none; if (S.ck.none) S.ck.used = []; EG.render(true); };
  EG.acts.ckNext = function (el) { S.ck.next = el.dataset.id; EG.render(true); };
  EG.ins.ckS = function (el) { S.ck.sentences[el.dataset.id] = el.value; };
  function closeOut(status) {
    var ck = S.meta.checkin, p = S.checkins.find(function (c) { return c.id === ck.pending; }), now = Date.now();
    if (!p) { p = { id: EG.uid('c'), dueAt: now, status: status, dayNo: EG.dayNo(), manual: true }; S.checkins.push(p); }
    p.status = status; p.completedAt = now;
    ck.pending = null; ck.lastAt = now; ck.snoozeUntil = 0;
    EG.dbPut('checkins', p); EG.saveMeta();
    return p;
  }
  EG.acts.saveCheckin = function () {
    var c = S.ck;
    if (!c.used.length && !c.none && !c.next && !Object.keys(c.sentences).some(function (k) { return (c.sentences[k] || '').trim(); })) { EG.toast('Answer at least one question.'); return; }
    var p = closeOut('done'); p.used = c.used.slice(); p.next = c.next; p.sentences = {};
    Object.keys(c.sentences).forEach(function (k) { if ((c.sentences[k] || '').trim()) p.sentences[k] = c.sentences[k].trim(); });
    c.sentences = p.sentences; EG.dbPut('checkins', p); c.done = true; EG.refreshReminders(); EG.render(false);
  };
  EG.acts.skipCheckin = function () { closeOut('skipped'); EG.refreshReminders(); EG.go('today', { force: true }); };
  EG.acts.snoozeCheckin = function () { S.meta.checkin.snoozeUntil = Date.now() + 30 * 60000; EG.saveMeta(); EG.refreshReminders(); EG.toast('Snoozed for 30 minutes.'); EG.go('today', { force: true }); };
  EG.acts.closeCheckin = function () { S.ck = null; EG.go('today', { force: true }); };

  /* ================= progress ================= */
  function weekly() {
    var by = {};
    S.attempts.forEach(function (a) {
      var w = EG.weekOf(Math.max(1, EG.daysBetween(S.meta.startDate, a.date) + 1));
      var x = by[w] || (by[w] = { t: 0, c: 0 }); x.t++; if (a.correct) x.c++;
    });
    return Object.keys(by).map(Number).sort(function (a, b) { return a - b; }).map(function (w) { return { w: w, pct: Math.round(by[w].c / by[w].t * 100), t: by[w].t }; });
  }
  function chartSVG(pts) {
    if (!pts.length) return '<div class="empty">Your accuracy chart appears after your first answers.</div>';
    var W = 320, H = 170, L = 30, B = 24, T = 24, R = 14, iw = W - L - R, ih = H - T - B;
    var x = function (i) { return pts.length === 1 ? L + iw / 2 : L + iw * i / (pts.length - 1); }, y = function (v) { return T + ih * (1 - v / 100); };
    var s = '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Accuracy by week">';
    [0, 50, 100].forEach(function (v) { s += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + y(v) + '" y2="' + y(v) + '" stroke="var(--line)"/><text x="' + (L - 6) + '" y="' + (y(v) + 3) + '" text-anchor="end">' + v + '</text>'; });
    s += '<polyline fill="none" stroke="var(--brand)" stroke-width="2.5" stroke-linejoin="round" points="' + pts.map(function (p, i) { return x(i) + ',' + y(p.pct); }).join(' ') + '"/>';
    pts.forEach(function (p, i) { s += '<circle cx="' + x(i) + '" cy="' + y(p.pct) + '" r="4.5" fill="var(--brand)"/><text x="' + x(i) + '" y="' + (y(p.pct) - 9) + '" text-anchor="middle">' + p.pct + '%</text><text x="' + x(i) + '" y="' + (H - 6) + '" text-anchor="middle">W' + p.w + '</text>'; });
    return s + '</svg>';
  }
  EG.views.progress = function () {
    var gems = Array.from(S.gems.values()), c = { new: 0, learning: 0, mastered: 0 };
    gems.forEach(function (g) { c[g.status]++; });
    var st = EG.computeStreaks(EG.completedDates(), EG.today());
    var tot = S.attempts.length, ok = S.attempts.filter(function (a) { return a.correct; }).length;
    var wk = weekly();
    var h = '<header class="top"><div><div class="sub">Day ' + EG.dayNo() + '</div><h1>Progress</h1></div></header><div class="stack">';
    h += '<div class="stat-grid"><div class="stat"><b>' + st.current + '</b><span>day streak (best ' + st.best + ')</span></div><div class="stat"><b>' + c.mastered + '</b><span>gems mastered of ' + gems.length + '</span></div><div class="stat"><b>' + (tot ? Math.round(ok / tot * 100) + '%' : '-') + '</b><span>overall accuracy</span></div><div class="stat"><b>' + tot + '</b><span>answers given</span></div></div>';
    h += '<h2 class="sec">Accuracy by week</h2><div class="card">' + chartSVG(wk) + '</div>';
    h += '<h2 class="sec">Gems by status</h2><div class="card"><div class="sbar"><i style="width:' + (c.mastered / gems.length * 100) + '%;background:var(--green)"></i><i style="width:' + (c.learning / gems.length * 100) + '%;background:#d9942b"></i></div><div class="row" style="margin-top:10px"><span class="tag st-mastered">' + c.mastered + ' mastered</span><span class="tag st-learning">' + c.learning + ' learning</span><span class="tag st-new">' + c.new + ' new</span></div></div>';
    /* real-life use */
    var done = S.checkins.filter(function (x) { return x.status === 'done' && !x.manual; }).length, dueN = S.checkins.filter(function (x) { return !x.manual; }).length;
    var use = {};
    S.checkins.forEach(function (x) { if (x.status === 'done' && x.used && x.used.length) { var w = EG.weekOf(x.dayNo || 1); use[w] = (use[w] || 0) + x.used.length; } });
    var uw = Object.keys(use).map(Number).sort(function (a, b) { return a - b; });
    h += '<h2 class="sec">Using gems in real life</h2><div class="card"><p><b>' + done + ' of ' + dueN + '</b> due check-ins completed.</p>' +
      (uw.length ? '<div class="row" style="margin-top:10px">' + uw.map(function (w) { return '<span class="tag">Week ' + w + ': ' + use[w] + ' gem uses</span>'; }).join('') + '</div>' : '<p class="hint">Gems you tick in check-ins show up here by week.</p>') + '</div>';
    var sp = S.speaking.length, sm = S.speaking.filter(function (x) { return x.rating === 'smooth'; }).length;
    h += '<h2 class="sec">Speaking</h2><div class="card">' + (sp ? '<p><b>' + sp + '</b> recordings rated, <b>' + sm + '</b> felt smooth.</p>' : '<p class="hint">Open a gem and tap Speak to start.</p>') + '</div>';
    if (S.reviews.length) {
      h += '<h2 class="sec">Weekly quizzes</h2>' + S.reviews.slice(-5).reverse().map(function (r) { return '<div class="item" style="margin-bottom:8px;cursor:default"><div><div class="t">Week ' + r.week + '</div><div class="s">' + esc(EG.fmtDate(r.date)) + '</div></div><b>' + r.score + '/' + r.total + '</b></div>'; }).join('');
    }
    h += '<h2 class="sec">Backup</h2><div class="card"><p>Last backup: <b>' + (S.meta.lastBackup ? esc(EG.fmtDate(S.meta.lastBackup)) : 'never') + '</b></p><div style="margin-top:12px"><button class="btn block soft" data-act="exportData">Back up now</button></div></div></div>';
    return h;
  };

  /* ================= library ================= */
  function libList() {
    var q = S.lib.q.trim().toLowerCase(), order = S.meta.order, idx = {};
    order.forEach(function (id, i) { idx[id] = i; });
    var arr = Array.from(S.gems.values()).filter(function (g) {
      if (S.lib.cat !== 'all' && g.category !== S.lib.cat) return false;
      if (S.lib.status !== 'all' && g.status !== S.lib.status) return false;
      return !q || (g.expression + ' ' + g.meaning + ' ' + (g.es || '')).toLowerCase().indexOf(q) >= 0;
    }).sort(function (a, b) { return (idx[a.id] == null ? 1e9 : idx[a.id]) - (idx[b.id] == null ? 1e9 : idx[b.id]); });
    var seen = EG.dayNo() * 3;
    return '<p class="hint" style="margin:0 0 8px">' + arr.length + ' gem' + (arr.length === 1 ? '' : 's') + '</p>' + (arr.length ? arr.map(function (g) {
      var day = idx[g.id] == null ? '' : 'Day ' + (Math.floor(idx[g.id] / 3) + 1);
      return '<button class="item" style="margin-bottom:8px" data-act="openGem" data-id="' + g.id + '"><div><div class="t">' + esc(g.expression) + '</div><div class="s">' + esc(EG.catShort(g.category)) + (day ? ' - ' + day : '') + (g.custom ? ' - yours' : '') + '</div></div><span class="tag st-' + g.status + '">' + g.status + '</span></button>';
    }).join('') : '<div class="empty">No gems match. Try another search, or add your own.</div>');
  }
  EG.views.library = function () {
    return '<header class="top"><div><h1>Library</h1><div class="sub">Every gem, past and future.</div></div><button class="btn small" data-act="addGem">Add gem</button></header>' +
      '<input class="field" type="search" placeholder="Search gems" data-in="libq" value="' + esc(S.lib.q) + '" aria-label="Search gems">' +
      '<div class="row" style="margin:10px 0 14px"><select class="field grow" data-ch="libcat" aria-label="Category" style="min-height:48px"><option value="all">All categories</option>' + EG.CATS.map(function (c) { return '<option value="' + c.id + '"' + (S.lib.cat === c.id ? ' selected' : '') + '>' + esc(c.short) + '</option>'; }).join('') + '</select>' +
      '<select class="field grow" data-ch="libstatus" aria-label="Status" style="min-height:48px">' + ['all', 'new', 'learning', 'mastered'].map(function (s) { return '<option value="' + s + '"' + (S.lib.status === s ? ' selected' : '') + '>' + (s === 'all' ? 'Any status' : s) + '</option>'; }).join('') + '</select></div><div id="liblist">' + libList() + '</div>';
  };
  EG.ins.libq = function (el) { S.lib.q = el.value; $('#liblist').innerHTML = libList(); };
  EG.chs.libcat = function (el) { S.lib.cat = el.value; $('#liblist').innerHTML = libList(); };
  EG.chs.libstatus = function (el) { S.lib.status = el.value; $('#liblist').innerHTML = libList(); };
  function gemModal(g) {
    EG.openModal('<div class="stack">' + EG.tagsHTML(g) + '<h2 class="expr" style="margin:0">' + esc(g.expression) + '</h2><p class="meaning">' + esc(g.meaning) + '</p><p class="example">&ldquo;' + esc(g.example) + '&rdquo;</p><p class="note"><b>When to use it:</b> ' + esc(g.note) + '</p>' +
      (g.es ? '<p class="es">' + esc(g.es) + '</p>' : '') +
      '<p class="hint">Day-to-day frequency (3 = very common). You can change it.</p><div class="row">' + [1, 2, 3].map(function (n) { return '<button class="chip' + (g.frequency === n ? ' on' : '') + '" data-act="setFreq" data-id="' + g.id + '" data-n="' + n + '">' + n + '</button>'; }).join('') + '</div>' +
      '<p class="hint">' + g.attempts + ' answers, ' + (g.correct || 0) + ' correct.</p>' +
      '<div class="row"><button class="btn small soft" data-act="say" data-id="' + g.id + '">Listen</button><button class="btn small soft" data-act="speakGemClose" data-id="' + g.id + '">Speak</button>' + (g.custom ? '<button class="btn small ghost" data-act="editGem" data-id="' + g.id + '">Edit</button><button class="btn small ghost" data-act="deleteGem" data-id="' + g.id + '">Delete</button>' : '') + '</div>' +
      '<button class="btn block ghost" data-act="closeModal">Close</button></div>');
  }
  EG.acts.openGem = function (el) { gemModal(EG.gem(el.dataset.id)); };
  EG.acts.speakGemClose = function (el) { EG.closeModal(); EG.openSpeak(el.dataset.id); };
  EG.acts.setFreq = function (el) { var g = EG.gem(el.dataset.id); g.frequency = +el.dataset.n; EG.saveGem(g); gemModal(g); };
  function gemForm(g) {
    g = g || {};
    var f = function (id, label, val, ph, area) {
      return '<label class="lbl" for="' + id + '">' + label + '</label>' + (area ? '<textarea class="field" id="' + id + '" style="min-height:84px" placeholder="' + ph + '">' + esc(val || '') + '</textarea>' : '<input class="field" id="' + id + '" value="' + esc(val || '') + '" placeholder="' + ph + '" autocomplete="off">');
    };
    EG.openModal('<h2 class="q-title">' + (g.id ? 'Edit gem' : 'Add your own gem') + '</h2>' +
      f('gx', 'Expression', g.expression, 'to kick the tires') + '<p class="hint">Start with "to" for a verb phrase, and the app also accepts forms like "kicked".</p>' +
      f('gm', 'Meaning', g.meaning, 'to test something before committing') +
      f('gex', 'Example sentence', g.example, 'We want to kick the tires on the new CRM.', true) +
      f('gn', 'When to use it', g.note, 'Use before a purchase or decision.') +
      f('ges', 'Spanish (optional)', g.es, 'probar a fondo') +
      '<label class="lbl" for="gc">Category</label><select class="field" id="gc">' + EG.CATS.map(function (c) { return '<option value="' + c.id + '"' + (g.category === c.id ? ' selected' : '') + '>' + esc(c.name) + '</option>'; }).join('') + '</select>' +
      '<label class="lbl" for="gr">Register</label><select class="field" id="gr"><option value="n"' + (g.register === 'n' || !g.register ? ' selected' : '') + '>neutral</option><option value="c"' + (g.register === 'c' ? ' selected' : '') + '>casual</option><option value="a"' + (g.register === 'a' ? ' selected' : '') + '>avoid with clients</option></select>' +
      '<label class="lbl" for="gf">Frequency in daily conversation</label><select class="field" id="gf">' + [3, 2, 1].map(function (n) { return '<option value="' + n + '"' + ((g.frequency || 2) === n ? ' selected' : '') + '>' + n + (n === 3 ? ' - very common' : n === 1 ? ' - occasional' : ' - common') + '</option>'; }).join('') + '</select>' +
      f('gfm', 'Other accepted forms (optional, separated by commas)', (g.extraForms || ''), 'kick the tire') +
      '<div id="gwarn"></div><div class="row" style="margin-top:16px"><button class="btn grow" data-act="saveGem" data-id="' + (g.id || '') + '">Save gem</button><button class="btn ghost" data-act="closeModal">Cancel</button></div>');
  }
  EG.acts.addGem = function () { gemForm(null); };
  EG.acts.editGem = function (el) { gemForm(EG.gem(el.dataset.id)); };
  EG.acts.saveGem = function (el) {
    var v = function (id) { return ($('#' + id).value || '').trim(); };
    var exprRaw = v('gx'), meaning = v('gm'), ex = v('gex');
    var warn = $('#gwarn');
    if (!exprRaw || !meaning || !ex) { warn.innerHTML = '<div class="fb no">Expression, meaning and example are required.</div>'; return; }
    var isVerb = /^to\s+/i.test(exprRaw), expr = exprRaw.replace(/^to\s+/i, '');
    var forms = EG.expandForms(isVerb ? '~' + expr : expr);
    v('gfm').split(/[,;]/).forEach(function (x) { x = x.trim(); if (x && forms.indexOf(x) < 0) forms.push(x); });
    if (!EG.findForm(ex, forms) && !EG._warned) { EG._warned = true; warn.innerHTML = '<div class="fb info">Your example does not contain the expression or an accepted form. The fill-in exercise will ask for the expression from its meaning. Tap Save gem again to keep it.</div>'; return; }
    EG._warned = false;
    var id = el.dataset.id, g = id ? EG.gem(id) : null;
    if (!g) {
      g = { id: EG.uid('c'), status: 'new', cd: [], attempts: 0, correct: 0, misses: 0, lastMiss: null, lastSeen: null, custom: true };
      S.gems.set(g.id, g);
      var order = S.meta.order, pos = Math.min(order.length, EG.dayNo() * 3);
      while (pos < order.length && S.gems.get(order[pos]) && S.gems.get(order[pos]).custom) pos++;
      order.splice(pos, 0, g.id); EG.saveMeta();
    }
    Object.assign(g, { expression: expr, meaning: meaning, example: ex, note: v('gn'), es: v('ges'), category: v('gc'), register: v('gr'), frequency: +v('gf'), forms: forms, extraForms: v('gfm') });
    EG.saveGem(g); EG.closeModal(); EG.render(true);
    EG.toast(id ? 'Saved.' : 'Added. It joins your daily rotation tomorrow.');
  };
  EG.acts.deleteGem = function (el) {
    var g = EG.gem(el.dataset.id);
    EG.openModal('<h2 class="q-title">Delete "' + esc(g.expression) + '"?</h2><p>This removes the gem and its progress.</p><div class="row" style="margin-top:16px"><button class="btn danger grow" data-act="confirmDeleteGem" data-id="' + g.id + '">Delete</button><button class="btn ghost" data-act="closeModal">Cancel</button></div>');
  };
  EG.acts.confirmDeleteGem = function (el) {
    var id = el.dataset.id; S.gems.delete(id); S.meta.order = S.meta.order.filter(function (x) { return x !== id; });
    EG.dbDel('gems', id); EG.saveMeta(); EG.closeModal(); EG.render(true);
  };

  /* ================= more / settings ================= */
  var hourOpts = function (sel) { var o = ''; for (var i = 0; i <= 24; i++) o += '<option value="' + i + '"' + (i === sel ? ' selected' : '') + '>' + (i < 10 ? '0' : '') + i + ':00</option>'; return o; };
  EG.views.more = function () {
    var s = S.settings, DN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    var voices = EG.voiceList();
    var h = '<header class="top"><div><h1>More</h1><div class="sub">Settings, backup and study notes.</div></div></header><div class="stack">';
    h += '<div class="card"><h3 class="q-title" style="font-size:21px;margin:0 0 6px">Check-in reminders</h3><p class="hint" style="margin:0 0 6px">Reminders appear inside the app only. Keep it open or pinned to your home screen.</p>' +
      '<label class="switch"><span>Remind me</span><input type="checkbox" data-ch="set" data-k="remindersOn"' + (s.remindersOn ? ' checked' : '') + '></label>' +
      '<div class="row"><div class="grow"><label class="lbl">From</label><select class="field" data-ch="set" data-k="activeStart" data-num="1">' + hourOpts(s.activeStart) + '</select></div><div class="grow"><label class="lbl">Until</label><select class="field" data-ch="set" data-k="activeEnd" data-num="1">' + hourOpts(s.activeEnd) + '</select></div></div>' +
      '<label class="lbl">Every</label><select class="field" data-ch="set" data-k="interval" data-num="1">' + [1, 2, 3, 4].map(function (n) { return '<option value="' + n + '"' + (s.interval === n ? ' selected' : '') + '>' + n + ' hour' + (n > 1 ? 's' : '') + '</option>'; }).join('') + '</select>' +
      '<label class="lbl">Active days</label><div class="days">' + DN.map(function (d, i) { return '<button class="chip" data-act="toggleDay" data-d="' + i + '" aria-pressed="' + (s.activeDays.indexOf(i) >= 0) + '">' + d + '</button>'; }).join('') + '</div></div>';
    h += '<div class="card"><h3 class="q-title" style="font-size:21px;margin:0 0 6px">Voice and speaking</h3>' +
      '<label class="lbl">Accent</label><select class="field" data-ch="set" data-k="accent"><option value="US"' + (s.accent === 'US' ? ' selected' : '') + '>American (US)</option><option value="UK"' + (s.accent === 'UK' ? ' selected' : '') + '>British (UK)</option></select>' +
      (voices.length ? '<label class="lbl">Voice</label><select class="field" data-ch="set" data-k="voiceURI"><option value="">Automatic</option>' + voices.map(function (v) { return '<option value="' + esc(v.voiceURI) + '"' + (s.voiceURI === v.voiceURI ? ' selected' : '') + '>' + esc(v.name + ' (' + v.lang + ')') + '</option>'; }).join('') + '</select>' : '') +
      '<div class="row" style="margin-top:10px"><button class="btn small soft" data-act="testVoice">Test voice</button></div>' +
      '<label class="switch" style="margin-top:6px"><span>Show a transcript when online<br><span class="hint">Uses your browser\'s online speech service.</span></span><input type="checkbox" data-ch="set" data-k="transcript"' + (s.transcript ? ' checked' : '') + '></label>' +
      '<label class="switch"><span>Keep my recordings on this device<br><span class="hint">Off by default. Only ratings are saved.</span></span><input type="checkbox" data-ch="set" data-k="keepRecordings"' + (s.keepRecordings ? ' checked' : '') + '></label>' +
      '<button class="btn small ghost" data-act="openRecordings">Saved recordings</button></div>';
    h += '<div class="card"><h3 class="q-title" style="font-size:21px;margin:0 0 6px">Backup</h3><p>Last backup: <b>' + (S.meta.lastBackup ? esc(EG.fmtDate(S.meta.lastBackup)) : 'never') + '</b></p><p class="hint">Browsers can erase local data on sites you do not visit for a while. Back up often. Recordings are not included.</p>' +
      '<div class="row" style="margin-top:12px"><button class="btn grow" data-act="exportData">Export</button><label class="btn ghost grow" for="importFile" style="cursor:pointer">Import<input id="importFile" type="file" accept="application/json,.json" data-ch="importFile" hidden></label></div>' +
      '<div class="row" style="margin-top:8px"><button class="link" data-act="copyBackup">Copy as text</button><button class="link" data-act="pasteBackup">Paste text</button></div></div>';
    h += '<button class="item" data-act="go" data-to="notes"><div><div class="t">Study notes</div><div class="s">Numbers, Even, Neither/nor, opinions, contrasts</div></div><span>&rsaquo;</span></button>';
    h += '<button class="item" data-act="go" data-to="corrections"><div><div class="t">Corrections</div><div class="s">What was fixed in your expression list</div></div><span>&rsaquo;</span></button>';
    h += '<div class="card"><h3 class="q-title" style="font-size:21px;margin:0 0 6px">Install</h3>' + (EG.deferredInstall ? '<button class="btn block soft" data-act="installApp">Install on this device</button>' : '<p class="hint" style="margin:0">On iPhone: tap Share, then Add to Home Screen. On Android or desktop Chrome: use the browser menu and choose Install app. Offline use needs a copy hosted over https.</p>') + '</div>';
    h += '<button class="btn block ghost" data-act="askReset" style="color:var(--red)">Delete all my data</button></div>';
    return h;
  };
  EG.chs.set = function (el) {
    var k = el.dataset.k, v = el.type === 'checkbox' ? el.checked : (el.dataset.num ? +el.value : el.value);
    S.settings[k] = v; EG.saveSettings(); EG.evalCheckin(); EG.refreshReminders();
    if (k === 'accent') { S.settings.voiceURI = ''; EG.saveSettings(); EG.render(true); }
  };
  EG.acts.toggleDay = function (el) {
    var d = +el.dataset.d, a = S.settings.activeDays, i = a.indexOf(d);
    if (i >= 0) a.splice(i, 1); else a.push(d);
    EG.saveSettings(); EG.render(true);
  };
  EG.acts.testVoice = function () { EG.say('Let me circle back with you by the end of the day.', false); };
  EG.acts.installApp = function () { var p = EG.deferredInstall; if (!p) return; p.prompt(); EG.deferredInstall = null; };
  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); EG.deferredInstall = e; });

  EG.acts.openRecordings = async function () {
    var rs = await EG.dbAll('recordings'); rs.sort(function (a, b) { return b.ts - a.ts; });
    EG.openModal('<h2 class="q-title">Saved recordings</h2>' + (rs.length ? rs.map(function (r) {
      var g = EG.gem(r.gemId);
      return '<div class="item" style="margin-bottom:8px;cursor:default"><div><div class="t">' + esc(g ? g.expression : 'Gem') + '</div><div class="s">' + esc(r.kind) + ' - ' + esc(EG.fmtDate(EG.localDate(new Date(r.ts)))) + '</div></div><div class="row"><button class="icon-btn" data-act="playRec" data-id="' + r.id + '">Play</button><button class="icon-btn" data-act="delRec" data-id="' + r.id + '">Delete</button></div></div>';
    }).join('') : '<div class="empty">No recordings saved. Turn on "Keep my recordings" to save them.</div>') + '<button class="btn block ghost" style="margin-top:12px" data-act="closeModal">Close</button>');
  };
  EG.acts.playRec = async function (el) {
    var rs = await EG.dbAll('recordings'), r = rs.find(function (x) { return x.id === el.dataset.id; });
    if (r) { var a = new Audio(URL.createObjectURL(r.blob)); a.play().catch(function () { EG.toast('Could not play this recording.'); }); }
  };
  EG.acts.delRec = async function (el) { await EG.dbDel('recordings', el.dataset.id); EG.acts.openRecordings(); };
  EG.acts.askReset = function () {
    EG.openModal('<h2 class="q-title">Delete all data?</h2><p>This removes your progress, your own gems and your history from this device. Export a backup first if you want to keep it.</p><div class="row" style="margin-top:16px"><button class="btn danger grow" data-act="doReset">Delete everything</button><button class="btn ghost" data-act="closeModal">Cancel</button></div>');
  };
  EG.acts.doReset = async function () { await EG.dbClearAll(); location.reload(); };

  /* ================= backup ================= */
  function buildBackup() {
    return { app: 'english-gems', version: 1, exportedAt: new Date().toISOString(), meta: S.meta, settings: S.settings, gems: Array.from(S.gems.values()), days: Array.from(S.days.values()), attempts: S.attempts, checkins: S.checkins, speaking: S.speaking, reviews: S.reviews };
  }
  EG.acts.exportData = function () {
    var json = JSON.stringify(buildBackup()), blob = new Blob([json], { type: 'application/json' }), a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'english-gems-backup-' + EG.today() + '.json';
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
    S.meta.lastBackup = EG.today(); EG.saveMeta(); EG.toast('Backup file created.'); EG.render(true);
  };
  EG.acts.copyBackup = function () {
    var json = JSON.stringify(buildBackup());
    var done = function () { S.meta.lastBackup = EG.today(); EG.saveMeta(); EG.toast('Backup copied. Paste it into a note or email.'); EG.render(true); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(json).then(done, function () { EG.toast('Copy was blocked. Use Export instead.'); });
    else EG.toast('Copy is not available. Use Export instead.');
  };
  EG.acts.pasteBackup = function () {
    EG.openModal('<h2 class="q-title">Paste backup text</h2><textarea id="pasteBox" class="field" style="min-height:160px" placeholder="Paste the backup text here"></textarea><div id="pasteMsg"></div><div class="row" style="margin-top:12px"><button class="btn grow" data-act="readPaste">Check backup</button><button class="btn ghost" data-act="closeModal">Cancel</button></div>');
  };
  EG.acts.readPaste = function () { parseBackup($('#pasteBox').value, function (m) { $('#pasteMsg').innerHTML = '<div class="fb no">' + esc(m) + '</div>'; }); };
  EG.chs.importFile = function (el) {
    var f = el.files && el.files[0]; if (!f) return;
    var r = new FileReader();
    r.onload = function () { parseBackup(String(r.result), function (m) { EG.openModal('<h2 class="q-title">Cannot import</h2><div class="fb no">' + esc(m) + '</div><button class="btn block ghost" style="margin-top:12px" data-act="closeModal">Close</button>'); }); };
    r.onerror = function () { EG.toast('Could not read the file.'); };
    r.readAsText(f); el.value = '';
  };
  function parseBackup(text, fail) {
    var o;
    try { o = JSON.parse(text); } catch (e) { fail('This is not valid JSON. Pick the file made by the Export button.'); return; }
    var errs = EG.validateBackup(o);
    if (errs.length) { fail(errs.join(' ')); return; }
    EG._pending = o;
    var mastered = o.gems.filter(function (g) { return g.status === 'mastered'; }).length;
    EG.openModal('<h2 class="q-title">Import this backup?</h2><div class="card"><p><b>' + o.gems.length + '</b> gems, <b>' + mastered + '</b> mastered, <b>' + (o.attempts || []).length + '</b> answers.</p><p class="hint">Saved ' + esc(String(o.exportedAt || '').slice(0, 10)) + '. Started ' + esc(o.meta.startDate) + '.</p></div>' +
      '<p style="margin:14px 0 8px"><b>Merge</b> keeps what you have and adds the file, using the higher progress for each gem. <b>Replace</b> erases this device first and uses the file only.</p><div class="stack"><button class="btn block" data-act="importMerge">Merge</button><button class="btn block danger" data-act="importReplace">Replace everything</button><button class="btn block ghost" data-act="closeModal">Cancel</button></div>');
  }
  function union(cur, inc, key) { var seen = {}; cur.forEach(function (x) { seen[x[key]] = 1; }); return cur.concat((inc || []).filter(function (x) { return x && x[key] && !seen[x[key]]; })); }
  async function persistAll() {
    await Promise.all([EG.dbPutMany('gems', Array.from(S.gems.values())), EG.dbPutMany('days', Array.from(S.days.values())), EG.dbPutMany('attempts', S.attempts), EG.dbPutMany('checkins', S.checkins), EG.dbPutMany('speaking', S.speaking), EG.saveMeta(), EG.saveSettings(), EG.saveKV('reviews', S.reviews)]);
  }
  EG.acts.importMerge = async function () {
    var o = EG._pending; if (!o) return;
    o.gems.forEach(function (ig) {
      var cur = S.gems.get(ig.id);
      if (!cur || EG.progressScore(ig) > EG.progressScore(cur)) S.gems.set(ig.id, ig);
    });
    o.meta.order.forEach(function (id) { if (S.meta.order.indexOf(id) < 0) S.meta.order.push(id); });
    if (o.meta.startDate < S.meta.startDate) S.meta.startDate = o.meta.startDate;
    if (o.meta.lastBackup && (!S.meta.lastBackup || o.meta.lastBackup > S.meta.lastBackup)) S.meta.lastBackup = o.meta.lastBackup;
    (o.days || []).forEach(function (d) {
      if (!d || typeof d.date !== 'string') return;
      var c = S.days.get(d.date);
      if (!c) S.days.set(d.date, d);
      else { Object.keys(d.done || {}).forEach(function (id) { c.done[id] = Object.assign({}, d.done[id], c.done[id]); }); c.completed = c.completed || d.completed; c.shownAt = Math.min(c.shownAt || Infinity, d.shownAt || Infinity); }
    });
    S.attempts = union(S.attempts, o.attempts, 'id'); S.checkins = union(S.checkins, o.checkins, 'id'); S.speaking = union(S.speaking, o.speaking, 'id'); S.reviews = union(S.reviews, o.reviews, 'id');
    await persistAll(); EG._pending = null; EG.closeModal(); EG.ensureToday(); EG.go('progress', { force: true }); EG.toast('Backup merged.');
  };
  EG.acts.importReplace = async function () {
    var o = EG._pending; if (!o) return;
    await EG.dbClearAll();
    await Promise.all([EG.dbPutMany('gems', o.gems), EG.dbPutMany('days', (o.days || []).filter(function (d) { return d && d.date; })), EG.dbPutMany('attempts', o.attempts || []), EG.dbPutMany('checkins', o.checkins || []), EG.dbPutMany('speaking', o.speaking || []),
      EG.saveKV('meta', o.meta), EG.saveKV('settings', o.settings || {}), EG.saveKV('reviews', o.reviews || [])]);
    await EG.load(); EG._pending = null; EG.closeModal(); EG.ensureToday(); EG.go('progress', { force: true }); EG.toast('Backup restored.');
  };

  /* ================= study notes and corrections ================= */
  EG.views.notes = function () {
    var h = '<div class="row between"><button class="icon-btn" data-act="go" data-to="more">Back</button></div><header class="top" style="margin-top:12px"><div><h1>Study notes</h1><div class="sub">Patterns and single words that are not Gems.</div></div></header><div class="stack">';
    EG.NOTES.forEach(function (sec, i) {
      var open = S.noteOpen === i;
      h += '<div class="card"><button class="item" style="border:0;padding:0;min-height:44px;background:none" data-act="toggleNote" data-i="' + i + '"><div class="t">' + esc(sec.title) + '</div><span>' + (open ? '&minus;' : '+') + '</span></button>';
      if (open) h += '<p class="hint">' + esc(sec.intro) + '</p>' + sec.items.map(function (it) { return '<div style="margin-top:12px"><b>' + esc(it[0]) + '</b><p class="note" style="margin-top:2px">' + esc(it[1]) + '</p></div>'; }).join('');
      h += '</div>';
    });
    return h + '</div>';
  };
  EG.acts.toggleNote = function (el) { var i = +el.dataset.i; S.noteOpen = S.noteOpen === i ? -1 : i; EG.render(true); };
  EG.views.corrections = function () {
    var h = '<div class="row between"><button class="icon-btn" data-act="go" data-to="more">Back</button></div><header class="top" style="margin-top:12px"><div><h1>Corrections</h1><div class="sub">Review what changed in your list before it became Gems.</div></div></header><div class="stack">';
    h += '<h2 class="sec" style="margin-top:4px">Fixed entries</h2>' + EG.CORRECTIONS.map(function (c) { return '<div class="card" style="padding:14px 16px"><p style="color:var(--red);text-decoration:line-through">' + esc(c[0]) + '</p><p style="color:var(--green);font-weight:700">' + esc(c[1]) + '</p><p class="hint" style="margin-top:2px">' + esc(c[2]) + '</p></div>'; }).join('');
    h += '<h2 class="sec">What else changed</h2>' + EG.REMOVED.map(function (c) { return '<div class="card" style="padding:14px 16px"><b>' + esc(c[0]) + '</b><p class="note">' + esc(c[1]) + '</p></div>'; }).join('');
    h += '<h2 class="sec">Flagged: I could not confirm these</h2>' + EG.FLAGGED.map(function (c) { return '<div class="card" style="padding:14px 16px"><b>' + esc(c[0]) + '</b><p class="note">' + esc(c[1]) + '</p></div>'; }).join('');
    return h + '</div>';
  };

  /* ================= boot ================= */
  EG.start = async function () {
    await EG.load();
    S._today = EG.today(); EG.ensureToday();
    try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) { /* ignore */ }
    EG.evalCheckin();
    try { history.replaceState({ r: 'today' }, ''); } catch (e) { /* ignore */ }
    EG.render(false); EG.refreshReminders();
    setInterval(tick, 30000);
    document.addEventListener('visibilitychange', function () { if (!document.hidden) tick(); });
    if (!window.EG_SINGLE && 'serviceWorker' in navigator && /^https?:/.test(location.protocol)) navigator.serviceWorker.register('sw.js').catch(function () { /* ignore */ });
  };
})();
