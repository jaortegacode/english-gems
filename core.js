/* English Gems - pure helpers (works in the browser and in Node) */
(function (root) {
  'use strict';
  var EG = root.EG = root.EG || {};

  EG.CATS = [
    { id: 'PM', name: 'Project management', short: 'Projects' },
    { id: 'SCH', name: 'Scheduling meetings', short: 'Scheduling' },
    { id: 'IT', name: 'IT strategy and business applications', short: 'IT strategy' },
    { id: 'TEAM', name: 'Team management in professional services', short: 'Teams' },
    { id: 'CALL', name: 'Video and phone calls', short: 'Calls' },
    { id: 'MA', name: 'M&A', short: 'M&A' },
    { id: 'PROB', name: 'Probability', short: 'Probability' },
    { id: 'TRV', name: 'Travel', short: 'Travel' },
    { id: 'FIN', name: 'Finance', short: 'Finance' },
    { id: 'HLT', name: 'Health', short: 'Health' }
  ];
  EG.catName = function (id) { var c = EG.CATS.find(function (x) { return x.id === id; }); return c ? c.name : id; };
  EG.catShort = function (id) { var c = EG.CATS.find(function (x) { return x.id === id; }); return c ? c.short : id; };
  EG.REG = { n: 'neutral', c: 'casual', a: 'avoid with clients' };

  EG.esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };

  /* ---------- verb inflection (first word of an expression) ---------- */
  var IRR = {
    go: ['goes', 'went', 'gone', 'going'], come: ['comes', 'came', 'come', 'coming'],
    take: ['takes', 'took', 'taken', 'taking'], make: ['makes', 'made', 'made', 'making'],
    get: ['gets', 'got', 'gotten', 'getting'], throw: ['throws', 'threw', 'thrown', 'throwing'],
    bite: ['bites', 'bit', 'bitten', 'biting'], hold: ['holds', 'held', 'held', 'holding'],
    keep: ['keeps', 'kept', 'kept', 'keeping'], lose: ['loses', 'lost', 'lost', 'losing'],
    run: ['runs', 'ran', 'run', 'running'], break: ['breaks', 'broke', 'broken', 'breaking'],
    fall: ['falls', 'fell', 'fallen', 'falling'], think: ['thinks', 'thought', 'thought', 'thinking'],
    put: ['puts', 'put', 'put', 'putting'], set: ['sets', 'set', 'set', 'setting'],
    let: ['lets', 'let', 'let', 'letting'], cut: ['cuts', 'cut', 'cut', 'cutting'],
    hit: ['hits', 'hit', 'hit', 'hitting'], beat: ['beats', 'beat', 'beaten', 'beating'],
    see: ['sees', 'saw', 'seen', 'seeing'], do: ['does', 'did', 'done', 'doing'],
    have: ['has', 'had', 'had', 'having'], swing: ['swings', 'swung', 'swung', 'swinging'],
    spin: ['spins', 'spun', 'spun', 'spinning'], buy: ['buys', 'bought', 'bought', 'buying'],
    wind: ['winds', 'wound', 'wound', 'winding'], lay: ['lays', 'laid', 'laid', 'laying'],
    hang: ['hangs', 'hung', 'hung', 'hanging'], sleep: ['sleeps', 'slept', 'slept', 'sleeping'],
    feel: ['feels', 'felt', 'felt', 'feeling'], stand: ['stands', 'stood', 'stood', 'standing'],
    catch: ['catches', 'caught', 'caught', 'catching'], speak: ['speaks', 'spoke', 'spoken', 'speaking'],
    bear: ['bears', 'bore', 'borne', 'bearing'], burn: ['burns', 'burned', 'burned', 'burning'],
    fly: ['flies', 'flew', 'flown', 'flying'], wear: ['wears', 'wore', 'worn', 'wearing'],
    give: ['gives', 'gave', 'given', 'giving'], pay: ['pays', 'paid', 'paid', 'paying'],
    know: ['knows', 'knew', 'known', 'knowing'], tell: ['tells', 'told', 'told', 'telling'],
    leave: ['leaves', 'left', 'left', 'leaving'], send: ['sends', 'sent', 'sent', 'sending'],
    meet: ['meets', 'met', 'met', 'meeting'], find: ['finds', 'found', 'found', 'finding'],
    sink: ['sinks', 'sank', 'sunk', 'sinking'], sit: ['sits', 'sat', 'sat', 'sitting'],
    tie: ['ties', 'tied', 'tied', 'tying'], bring: ['brings', 'brought', 'brought', 'bringing']
  };
  var DBL = { drop: 1, stop: 1, plan: 1, wrap: 1, pop: 1, tip: 1, step: 1, slip: 1, trip: 1, flip: 1, hop: 1, strip: 1, ship: 1, skip: 1, shop: 1, jam: 1, tag: 1, log: 1, win: 1, chat: 1, plug: 1, rub: 1, scrub: 1, spot: 1, trim: 1 };

  EG.inflect = function (w) {
    w = String(w);
    var lw = w.toLowerCase();
    if (IRR[lw]) return [lw].concat(IRR[lw]);
    var s, ed, ing;
    if (/(s|x|z|ch|sh|o)$/.test(lw)) s = lw + 'es';
    else if (/[^aeiou]y$/.test(lw)) s = lw.slice(0, -1) + 'ies';
    else s = lw + 's';
    if (DBL[lw]) { ed = lw + lw.slice(-1) + 'ed'; ing = lw + lw.slice(-1) + 'ing'; }
    else if (/ie$/.test(lw)) { ed = lw + 'd'; ing = lw.slice(0, -2) + 'ying'; }
    else if (/e$/.test(lw)) { ed = lw + 'd'; ing = /(ee|ye|oe)$/.test(lw) ? lw + 'ing' : lw.slice(0, -1) + 'ing'; }
    else if (/[^aeiou]y$/.test(lw)) { ed = lw.slice(0, -1) + 'ied'; ing = lw + 'ing'; }
    else { ed = lw + 'ed'; ing = lw + 'ing'; }
    return [lw, s, ed, ing];
  };

  /* "~push back;~push it back" -> ["push back","pushes back","pushed back","pushing back", ...] */
  EG.expandForms = function (spec) {
    var out = [];
    String(spec).split(';').forEach(function (part) {
      part = part.trim();
      if (!part) return;
      if (part.charAt(0) === '~') {
        var toks = part.slice(1).trim().split(/\s+/);
        var rest = toks.slice(1).join(' ');
        EG.inflect(toks[0]).forEach(function (v) { out.push(rest ? v + ' ' + rest : v); });
      } else out.push(part);
    });
    var seen = {};
    return out.filter(function (f) { var k = f.toLowerCase(); if (seen[k]) return false; seen[k] = 1; return true; });
  };
  EG.displayExpr = function (spec) { return String(spec).split(';')[0].replace(/^~/, '').trim(); };

  /* ---------- matching ---------- */
  function formRegex(form) {
    var s = '';
    for (var i = 0; i < form.length; i++) {
      var ch = form.charAt(i);
      if (ch === "'" || ch === '\u2019') s += "['\u2019]?";
      else if (ch === ' ' || ch === '-') s += '[\\s-]+';
      else s += ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
    return new RegExp('(^|[^A-Za-z0-9])(' + s + ')(?![A-Za-z0-9])', 'i');
  }
  /* returns {index, length, text, form} for the longest match of any form in text, or null */
  EG.findForm = function (text, forms) {
    var best = null;
    text = String(text || '');
    (forms || []).forEach(function (f) {
      var m = formRegex(f).exec(text);
      if (!m) return;
      var idx = m.index + m[1].length, txt = m[2];
      if (!best || txt.length > best.length || (txt.length === best.length && idx < best.index)) {
        best = { index: idx, length: txt.length, text: txt, form: f };
      }
    });
    return best;
  };
  EG.containsForm = function (text, forms) { return !!EG.findForm(text, forms); };
  EG.normAnswer = function (s) {
    return String(s || '').toLowerCase().replace(/[\u2018\u2019]/g, "'").replace(/'/g, '').replace(/-/g, ' ')
      .replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  };
  EG.matchesForm = function (ans, forms) {
    var a = EG.normAnswer(ans);
    return !!a && (forms || []).some(function (f) { return EG.normAnswer(f) === a; });
  };

  /* ---------- dates ---------- */
  EG.localDate = function (d) {
    d = d || new Date();
    var m = d.getMonth() + 1, day = d.getDate();
    return d.getFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (day < 10 ? '0' : '') + day;
  };
  function parts(s) { var p = s.split('-'); return [+p[0], +p[1], +p[2]]; }
  EG.daysBetween = function (a, b) {
    var x = parts(a), y = parts(b);
    return Math.round((Date.UTC(y[0], y[1] - 1, y[2]) - Date.UTC(x[0], x[1] - 1, x[2])) / 864e5);
  };
  EG.addDays = function (s, n) {
    var x = parts(s);
    return new Date(Date.UTC(x[0], x[1] - 1, x[2] + n)).toISOString().slice(0, 10);
  };
  EG.fmtDate = function (s) {
    var x = parts(s);
    return new Date(x[0], x[1] - 1, x[2]).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  };

  EG.shuffle = function (arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  };
  EG.hash = function (s) { var h = 0; for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; };

  /* ---------- progress rules ---------- */
  EG.STATUS_RANK = { new: 0, learning: 1, mastered: 2 };
  EG.applyResult = function (g, correct, date) {
    g.attempts = (g.attempts || 0) + 1;
    g.lastSeen = date;
    g.cd = g.cd || [];
    if (g.status === 'new') g.status = 'learning';
    if (correct) {
      g.correct = (g.correct || 0) + 1;
      if (g.lastMiss !== date && g.cd.indexOf(date) < 0) g.cd.push(date);
      if (g.cd.length >= 3) g.status = 'mastered';
    } else {
      g.misses = (g.misses || 0) + 1;
      g.lastMiss = date;
      g.cd = g.cd.filter(function (d) { return d !== date; });
      if (g.status === 'mastered') { g.status = 'learning'; g.cd = []; }
    }
    return g;
  };
  EG.progressScore = function (g) { return (EG.STATUS_RANK[g.status] || 0) * 1e6 + (g.cd ? g.cd.length : 0) * 1e3 + (g.attempts || 0); };

  EG.computeStreaks = function (dates, today) {
    var set = {}; dates.forEach(function (d) { set[d] = 1; });
    var cur = 0, d = set[today] ? today : EG.addDays(today, -1);
    while (set[d]) { cur++; d = EG.addDays(d, -1); }
    var sorted = Object.keys(set).sort(), best = 0, run = 0, prev = null;
    sorted.forEach(function (x) { run = (prev && EG.daysBetween(prev, x) === 1) ? run + 1 : 1; if (run > best) best = run; prev = x; });
    return { current: cur, best: best };
  };

  EG.validateBackup = function (o) {
    var errs = [];
    if (!o || typeof o !== 'object') return ['This is not a backup file.'];
    if (o.app !== 'english-gems') errs.push('The file was not made by this app.');
    if (typeof o.version !== 'number') errs.push('The file has no version number.');
    if (!Array.isArray(o.gems)) errs.push('The file has no list of gems.');
    else {
      var ids = {};
      o.gems.forEach(function (g, i) {
        if (!g || typeof g.id !== 'string' || typeof g.expression !== 'string' || typeof g.meaning !== 'string' || !Array.isArray(g.forms)) { errs.push('Gem ' + (i + 1) + ' is incomplete.'); return; }
        if (ids[g.id]) errs.push('Gem id repeated: ' + g.id);
        ids[g.id] = 1;
        if (!EG.STATUS_RANK.hasOwnProperty(g.status)) errs.push('Gem ' + g.expression + ' has an unknown status.');
        if (!EG.CATS.some(function (c) { return c.id === g.category; })) errs.push('Gem ' + g.expression + ' has an unknown category.');
      });
    }
    ['days', 'attempts', 'checkins', 'speaking', 'reviews'].forEach(function (k) {
      if (o[k] != null && !Array.isArray(o[k])) errs.push('"' + k + '" must be a list.');
    });
    if (!o.meta || !Array.isArray(o.meta.order) || typeof o.meta.startDate !== 'string') errs.push('The file has no start date or gem order.');
    return errs.slice(0, 6);
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = EG;
})(typeof window !== 'undefined' ? window : globalThis);
