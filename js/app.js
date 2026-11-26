/* 吉他實驗室 — 路由器、主題、共用 UI */
(function () {
  'use strict';

  window.GL = window.GL || {};
  var pages = (window.GL.pages = {});

  /* ---------- 頁面註冊 ---------- */
  // def = { navName, render(el, params) }
  window.GL.register = function (id, def) { pages[id] = def; };

  /* ---------- 主題 ---------- */
  var THEME_KEY = 'theme';
  function applyTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
  }
  function initTheme() {
    var saved = GL.store.get(THEME_KEY, null);
    if (saved === 'light' || saved === 'dark') { applyTheme(saved); return; }
    var prefersLight = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;
    applyTheme(prefersLight ? 'light' : 'dark');
  }
  function toggleTheme() {
    var cur = document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
    var next = cur === 'light' ? 'dark' : 'light';
    applyTheme(next);
    GL.store.set(THEME_KEY, next);
  }

  /* ---------- Toast ---------- */
  var toastTimer = null;
  window.GL.toast = function (msg, ms) {
    var el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('show'); }, ms || 2600);
  };

  /* ---------- 共用：模組頁外殼（開發中階段的統一樣式） ---------- */
  window.GL.moduleShell = function (opt) {
    var chips = '';
    (opt.meta || []).forEach(function (m) {
      chips += '<span class="chip">' + m + '</span>';
    });
    var feats = '';
    (opt.features || []).forEach(function (f) {
      feats += '<li class="feature-item">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>' +
        '<div><strong>' + f[0] + '</strong>' + (f[1] ? '<p>' + f[1] + '</p>' : '') + '</div></li>';
    });
    return '' +
      '<section class="module-hero">' +
        '<div class="container">' +
          '<p class="kicker">' + opt.kicker + '</p>' +
          '<h1>' + opt.title + '</h1>' +
          '<p class="lede">' + opt.lede + '</p>' +
          '<div class="chip-row">' + chips + '</div>' +
        '</div>' +
      '</section>' +
      '<section class="container module-body">' +
        '<h2 class="section-title">這個模組會提供</h2>' +
        '<ul class="feature-list">' + feats + '</ul>' +
        '<div class="preview-panel">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
            '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>' +
          '</svg>' +
          '<p><strong>開發中</strong> — ' + (opt.previewNote || '此區域將在對應里程碑完成後呈現互動內容。') + '</p>' +
        '</div>' +
      '</section>';
  };

  /* ---------- 路由 ---------- */
  function currentRoute() {
    var h = location.hash.replace(/^#\/?/, '').split('?')[0];
    return pages[h] ? h : 'home';
  }

  function render() {
    var route = currentRoute();
    var def = pages[route];
    var app = document.getElementById('app');
    if (!def) return;
    app.innerHTML = '';
    def.render(app);
    window.scrollTo(0, 0);
    document.querySelectorAll('[data-nav]').forEach(function (a) {
      var active = a.getAttribute('data-nav') === route;
      a.classList.toggle('active', active);
      if (a.tagName === 'A') {
        if (active) { a.setAttribute('aria-current', 'page'); } else { a.removeAttribute('aria-current'); }
      }
    });
    document.title = (route === 'home' ? '' : def.navName + ' · ') + '吉他實驗室 Guitar Lab';
  }

  /* ---------- 行動版選單 ---------- */
  function initNav() {
    var toggle = document.getElementById('navToggle');
    var nav = document.getElementById('siteNav');
    if (!toggle || !nav) return;
    toggle.addEventListener('click', function () {
      var open = document.body.classList.toggle('nav-open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    nav.addEventListener('click', function (e) {
      if (e.target.closest('a')) {
        document.body.classList.remove('nav-open');
        toggle.setAttribute('aria-expanded', 'false');
      }
    });
  }

  /* ---------- 啟動 ---------- */
  function init() {
    initTheme();
    initNav();
    var themeBtn = document.getElementById('themeToggle');
    if (themeBtn) themeBtn.addEventListener('click', toggleTheme);
    window.addEventListener('hashchange', render);
    render();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
