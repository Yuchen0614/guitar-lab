/* 吉他實驗室 — localStorage 狀態層（帶版本前綴，避免舊資料汙染） */
(function () {
  'use strict';

  var PREFIX = 'gl_v1:';

  function get(key, fallback) {
    try {
      var raw = localStorage.getItem(PREFIX + key);
      if (raw === null) return fallback;
      return JSON.parse(raw);
    } catch (e) {
      return fallback;
    }
  }

  function set(key, value) {
    try {
      localStorage.setItem(PREFIX + key, JSON.stringify(value));
      return true;
    } catch (e) {
      // 隱私模式或空間不足時靜默失敗，不影響主功能
      return false;
    }
  }

  function remove(key) {
    try { localStorage.removeItem(PREFIX + key); } catch (e) { /* noop */ }
  }

  /* 取得一個綁定某 key 的響應式小物件：讀寫自動持久化 */
  function bind(key, defaults) {
    var data = Object.assign({}, defaults, get(key, {}));
    return {
      data: data,
      save: function () { return set(key, data); },
      reset: function () {
        data = Object.assign({}, defaults);
        set(key, data);
        return data;
      }
    };
  }

  window.GL = window.GL || {};
  window.GL.store = { get: get, set: set, remove: remove, bind: bind, PREFIX: PREFIX };
})();
