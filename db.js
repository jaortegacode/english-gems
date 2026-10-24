/* English Gems - IndexedDB layer with an in-memory fallback */
(function () {
  'use strict';
  var EG = window.EG;
  var KEYS = { gems: 'id', attempts: 'id', kv: 'key', checkins: 'id', speaking: 'id', recordings: 'id', days: 'date' };
  var STORES = Object.keys(KEYS), db = null, mem = {};
  STORES.forEach(function (s) { mem[s] = new Map(); });
  EG.memOnly = false;

  EG.dbOpen = function () {
    return new Promise(function (res) {
      if (!window.indexedDB) { EG.memOnly = true; return res(); }
      var req;
      try { req = indexedDB.open('english-gems', 1); } catch (e) { EG.memOnly = true; return res(); }
      req.onupgradeneeded = function () {
        var d = req.result;
        STORES.forEach(function (s) { if (!d.objectStoreNames.contains(s)) d.createObjectStore(s, { keyPath: KEYS[s] }); });
      };
      req.onsuccess = function () { db = req.result; res(); };
      req.onerror = function () { EG.memOnly = true; res(); };
    });
  };
  EG.dbAll = function (s) {
    if (EG.memOnly) return Promise.resolve(Array.from(mem[s].values()));
    return new Promise(function (res, rej) {
      var r = db.transaction(s).objectStore(s).getAll();
      r.onsuccess = function () { res(r.result); }; r.onerror = function () { rej(r.error); };
    });
  };
  function write(s, fn, memFn) {
    if (EG.memOnly) { memFn(mem[s]); return Promise.resolve(); }
    return new Promise(function (res) {
      try {
        var t = db.transaction(s, 'readwrite'); fn(t.objectStore(s));
        t.oncomplete = function () { res(); };
        t.onerror = t.onabort = function () { console.warn('db write failed', t.error); res(); };
      } catch (e) { console.warn(e); res(); }
    });
  }
  EG.dbPut = function (s, v) { return write(s, function (os) { os.put(v); }, function (m) { m.set(v[KEYS[s]], v); }); };
  EG.dbPutMany = function (s, arr) { return write(s, function (os) { arr.forEach(function (v) { os.put(v); }); }, function (m) { arr.forEach(function (v) { m.set(v[KEYS[s]], v); }); }); };
  EG.dbDel = function (s, k) { return write(s, function (os) { os.delete(k); }, function (m) { m.delete(k); }); };
  EG.dbClear = function (s) { return write(s, function (os) { os.clear(); }, function (m) { m.clear(); }); };
  EG.dbClearAll = function () { return Promise.all(STORES.map(EG.dbClear)); };
})();
