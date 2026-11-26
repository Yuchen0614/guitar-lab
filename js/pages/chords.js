/* 吉他實驗室 — 和弦圖工坊（M1）
   架構：CB.render 負責畫圖，頁面在其上疊透明熱區做點選編輯 */
(function () {
  'use strict';

  var M = window.GLmusic, CB = window.GLchordbox, SY = window.GLsynth;
  var saved = GL.store.bind('chord_favs', { list: [] });

  function themeOpts() {
    var dark = document.documentElement.getAttribute('data-theme') !== 'light';
    if (dark) return {};
    return { theme: {
      bg: 'transparent', line: '#b7ad9d', fret: '#c9c2b4', nut: '#4a463d',
      dot: '#c47b17', dotText: '#ffffff', text: '#24211b', muted: '#6d675c', accent: '#c47b17'
    } };
  }

  /* 編輯器幾何常數（與 CB.defaults 對應） */
  var ED = { W: 280, H: 300, padL: 44, padT: 54, padR: 26, padB: 34, frets: 5 };
  ED.colW = (ED.W - ED.padL - ED.padR) / 5;
  ED.rowH = (ED.H - ED.padT - ED.padB) / 5;

  function render(el) {
    el.innerHTML =
      '<section class="module-hero"><div class="container">' +
        '<p class="kicker">Chord Workshop</p>' +
        '<h1>和弦圖工坊</h1>' +
        '<p class="lede">從指法庫挑一個、或直接在指板上點出你的指法——即時命名、試聽、匯出。</p>' +
      '</div></section>' +

      '<section class="container workshop-grid">' +
        '<div class="panel workshop-main">' +
          '<div class="editor-stage" id="cwEditor"></div>' +
          '<div class="name-row">' +
            '<input id="cwName" class="text-input" maxlength="12" placeholder="和弦名稱" aria-label="和弦名稱">' +
            '<button class="btn btn-ghost btn-sm" id="cwAutoName" title="依指法內音自動命名">自動命名</button>' +
          '</div>' +
          '<div class="chord-readout" id="cwReadout"></div>' +
        '</div>' +
        '<div class="workshop-side">' +
          '<div class="panel">' +
            '<h3 class="panel-title">載入指法</h3>' +
            '<div class="select-row">' +
              '<label>根音<select id="cwRoot"></select></label>' +
              '<label>類型<select id="cwType"></select></label>' +
            '</div>' +
            '<button class="btn btn-primary btn-block" id="cwLoad">載入到編輯器</button>' +
          '</div>' +
          '<div class="panel">' +
            '<h3 class="panel-title">試聽</h3>' +
            '<div class="btn-row">' +
              '<button class="btn btn-ghost" id="cwStrumDown">↓ 刷弦</button>' +
              '<button class="btn btn-ghost" id="cwStrumUp">↑ 刷弦</button>' +
              '<button class="btn btn-ghost" id="cwArp">琶音</button>' +
            '</div>' +
            '<p class="hint">合成音色，模擬尼龍弦撥弦聲。</p>' +
          '</div>' +
          '<div class="panel">' +
            '<h3 class="panel-title">匯出</h3>' +
            '<div class="btn-row">' +
              '<button class="btn btn-ghost" id="cwSvg">下載 SVG</button>' +
              '<button class="btn btn-ghost" id="cwPng">下載 PNG</button>' +
            '</div>' +
            '<button class="btn btn-ghost btn-block" id="cwSave">★ 加入收藏</button>' +
          '</div>' +
        '</div>' +
      '</section>' +

      '<section class="container lib-section">' +
        '<h2 class="section-title">指法庫</h2>' +
        '<div class="lib-filters" id="cwLibFilters"></div>' +
        '<div class="lib-grid" id="cwLibGrid"></div>' +
      '</section>' +

      '<section class="container lib-section" id="cwFavSection" hidden>' +
        '<h2 class="section-title">我的收藏 <span class="badge" id="cwFavCount"></span></h2>' +
        '<div class="lib-grid" id="cwFavGrid"></div>' +
      '</section>';

    /* ---------- 狀態 ---------- */
    var state = { name: 'C', frets: [null, 3, 2, 0, 1, 0], fingers: [null, 3, 2, 0, 1, 0] };
    var svgHost = document.getElementById('cwEditor');
    var nameInput = document.getElementById('cwName');
    var autoNamed = true;

    /* 畫編輯器：CB.render + 熱區 */
    function drawEditor() {
      svgHost.innerHTML = '';
      var svg = CB.render(svgHost, { name: state.name, frets: state.frets, fingers: state.fingers },
        Object.assign({ width: 280, height: 300 }, themeOpts()));

      function hotspot(tag, attrs, onClick) {
        var h = document.createElementNS('http://www.w3.org/2000/svg', tag);
        for (var k in attrs) h.setAttribute(k, attrs[k]);
        h.setAttribute('fill', 'transparent');
        h.style.cursor = 'pointer';
        h.addEventListener('click', onClick);
        svg.appendChild(h);
      }
      for (var s = 0; s < 6; s++) {
        (function (si) {
          var cx = ED.padL + si * ED.colW;
          // 弦頂：× ↔ ○ 切換
          hotspot('circle', { cx: cx, cy: ED.padT - 22, r: 12 }, function () {
            state.frets[si] = (state.frets[si] === null) ? 0 : null;
            state.fingers = null;
            afterEdit();
          });
          // 琴格：點按切換
          for (var row = 0; row < ED.frets; row++) {
            (function (r) {
              hotspot('rect', {
                x: cx - ED.colW / 2, y: ED.padT + r * ED.rowH,
                width: ED.colW, height: ED.rowH
              }, function () {
                var fn = 1 + r;
                state.frets[si] = (state.frets[si] === fn) ? null : fn;
                state.fingers = null;
                afterEdit();
              });
            })(row);
          }
        })(s);
      }
    }

    function currentMidis() { return M.voicingToMidis(state.frets); }

    function refreshName() {
      var midis = currentMidis();
      var ids = midis.length ? M.identify(midis) : [];
      if (autoNamed) {
        state.name = ids.length ? ids[0].name : '自訂';
        nameInput.value = state.name;
      }
      var notes = midis.map(function (m) { return M.midiName(m); }).join(' · ') || '（空指法）';
      var idChips = ids.slice(0, 3).map(function (c) { return '<span class="chip chip-sm">' + c.name + '</span>'; }).join('');
      document.getElementById('cwReadout').innerHTML =
        '<div class="readout-row"><strong class="readout-name">' + state.name + '</strong>' +
        '<span class="readout-notes">' + notes + '</span></div>' +
        (ids.length > 1 ? '<div class="readout-ids">其他可能 ' + idChips + '</div>' : '');
    }

    function afterEdit() {
      drawEditor();
      refreshName();
    }

    nameInput.addEventListener('input', function () {
      autoNamed = false;
      state.name = nameInput.value;
      drawEditor();
    });
    document.getElementById('cwAutoName').addEventListener('click', function () {
      autoNamed = true;
      refreshName();
      drawEditor();
      GL.toast('已依指法內音自動命名');
    });

    /* ---------- 載入指法 ---------- */
    var rootSel = document.getElementById('cwRoot');
    var typeSel = document.getElementById('cwType');
    M.NOTES.forEach(function (n) {
      var o = document.createElement('option'); o.value = n; o.textContent = n; rootSel.appendChild(o);
    });
    ['maj', 'min', '7', 'maj7', 'm7', 'dim', 'aug', 'sus4', 'sus2', '6', 'm6', 'add9', '9', 'maj9', 'm9', 'm7b5', 'dim7'].forEach(function (tid) {
      var t = null;
      for (var i = 0; i < M.CHORD_TYPES.length; i++) if (M.CHORD_TYPES[i].id === tid) { t = M.CHORD_TYPES[i]; break; }
      if (!t) return;
      var o = document.createElement('option');
      o.value = tid;
      o.textContent = (t.suffix === '' ? 'maj' : t.suffix) + '（' + t.full + '）';
      typeSel.appendChild(o);
    });
    typeSel.value = 'maj';

    document.getElementById('cwLoad').addEventListener('click', function () {
      var rootPc = M.noteToPc(rootSel.value);
      var tid = typeSel.value;
      var suffix = '';
      for (var i = 0; i < M.CHORD_TYPES.length; i++) if (M.CHORD_TYPES[i].id === tid) { suffix = M.CHORD_TYPES[i].suffix; break; }
      var v = M.getVoicing(rootPc, tid);
      var name = M.pcName(rootPc) + suffix;
      if (v) {
        state.frets = v.slice();
        state.fingers = null;
        autoNamed = false;
        state.name = name;
        nameInput.value = name;
        afterEdit();
      } else {
        GL.toast(name + ' 沒有內建指法——在指板上自己點一個吧！');
      }
    });

    /* ---------- 試聽 ---------- */
    document.getElementById('cwStrumDown').addEventListener('click', function () {
      var m = currentMidis(); if (m.length) SY.strum(m.map(M.midiToFreq), 'down');
    });
    document.getElementById('cwStrumUp').addEventListener('click', function () {
      var m = currentMidis(); if (m.length) SY.strum(m.map(M.midiToFreq), 'up');
    });
    document.getElementById('cwArp').addEventListener('click', function () {
      var m = currentMidis(); if (m.length) SY.arp(m);
    });

    /* ---------- 匯出 ---------- */
    function hiddenRender(whiteBg) {
      var tmp = document.createElement('div');
      tmp.style.cssText = 'position:absolute;left:-9999px;top:0;';
      document.body.appendChild(tmp);
      var opts = whiteBg ? { width: 220, height: 250, theme: {
        bg: '#ffffff', line: '#8a93a5', fret: '#4a5162', nut: '#1a1d24',
        dot: '#e8940f', dotText: '#17120a', text: '#111318', muted: '#5a6272', accent: '#e8940f'
      } } : Object.assign({ width: 220, height: 250 }, themeOpts());
      var sv = CB.render(tmp, { name: state.name, frets: state.frets, fingers: state.fingers }, opts);
      return { tmp: tmp, svg: sv };
    }
    document.getElementById('cwSvg').addEventListener('click', function () {
      var r = hiddenRender(false);
      CB.downloadSVG(r.svg, (state.name || 'chord') + '.svg');
      setTimeout(function () { r.tmp.remove(); }, 500);
    });
    document.getElementById('cwPng').addEventListener('click', function () {
      var r = hiddenRender(true);
      CB.downloadPNG(r.svg, (state.name || 'chord') + '.png', 3);
      setTimeout(function () { r.tmp.remove(); }, 800);
      GL.toast('PNG 已匯出（白底 ×3 解析度）');
    });

    /* ---------- 收藏 ---------- */
    document.getElementById('cwSave').addEventListener('click', function () {
      if (!currentMidis().length) { GL.toast('這個指法沒有音，先點幾個格吧'); return; }
      var item = { name: state.name, frets: state.frets.slice(), fingers: state.fingers, t: Date.now() };
      saved.data.list = (saved.data.list || []).filter(function (x) {
        return JSON.stringify(x.frets) !== JSON.stringify(item.frets);
      });
      saved.data.list.unshift(item);
      if (saved.data.list.length > 24) saved.data.list.pop();
      saved.save();
      renderFavs();
      GL.toast('已加入收藏（存在這台瀏覽器）');
    });

    /* ---------- 指法庫 ---------- */
    var libFilter = 'all';
    var filters = document.getElementById('cwLibFilters');
    [['all', '全部'], ['open', '開放和弦'], ['barre', '封閉和弦']].forEach(function (f, idx) {
      var b = document.createElement('button');
      b.className = 'chip chip-btn' + (idx === 0 ? ' chip-active' : '');
      b.textContent = f[1]; b.dataset.f = f[0];
      b.addEventListener('click', function () {
        libFilter = f[0];
        filters.querySelectorAll('.chip-btn').forEach(function (x) { x.classList.toggle('chip-active', x.dataset.f === f[0]); });
        renderLib();
      });
      filters.appendChild(b);
    });

    function isBarre(frets) {
      var pressed = frets.filter(function (f) { return f > 0; });
      if (pressed.length < 4) return false;
      var min = Math.min.apply(null, pressed);
      return pressed.filter(function (f) { return f === min; }).length >= 3;
    }

    function loadIntoEditor(frets, fingers, name) {
      state.frets = frets.slice();
      state.fingers = fingers ? fingers.slice() : null;
      autoNamed = false;
      state.name = name;
      nameInput.value = name;
      afterEdit();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function renderLib() {
      var grid = document.getElementById('cwLibGrid');
      grid.innerHTML = '';
      var count = 0;
      Object.keys(M.VOICINGS).forEach(function (key) {
        var parts = key.split(':');
        var rootPc = M.noteToPc(parts[0]);
        if (rootPc < 0) return;
        var frets = M.VOICINGS[key][0];
        if (libFilter === 'open' && isBarre(frets)) return;
        if (libFilter === 'barre' && !isBarre(frets)) return;
        count++;
        var cell = document.createElement('button');
        cell.className = 'lib-cell';
        cell.setAttribute('aria-label', '載入 ' + key.replace(':', ''));
        grid.appendChild(cell);
        CB.render(cell, { name: key.replace(':', ''), frets: frets, fingers: null },
          { width: 128, height: 150, showFingers: false, theme: (themeOpts().theme || CB.defaults.theme) });
        cell.addEventListener('click', function () {
          loadIntoEditor(frets, null, key.replace(':', ''));
        });
      });
      if (!count) grid.innerHTML = '<p class="hint">沒有符合的和弦。</p>';
    }

    /* ---------- 收藏區 ---------- */
    function renderFavs() {
      var sec = document.getElementById('cwFavSection');
      var grid = document.getElementById('cwFavGrid');
      var list = saved.data.list || [];
      sec.hidden = list.length === 0;
      document.getElementById('cwFavCount').textContent = list.length;
      grid.innerHTML = '';
      list.forEach(function (it) {
        var cell = document.createElement('button');
        cell.className = 'lib-cell';
        grid.appendChild(cell);
        CB.render(cell, { name: it.name, frets: it.frets, fingers: it.fingers },
          { width: 128, height: 150, showFingers: false, theme: (themeOpts().theme || CB.defaults.theme) });
        cell.addEventListener('click', function () {
          loadIntoEditor(it.frets, it.fingers, it.name);
        });
      });
    }

    /* 主題切換時全部重繪 */
    var mo = new MutationObserver(function () {
      drawEditor(); renderLib(); renderFavs(); refreshName();
    });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    drawEditor();
    refreshName();
    renderLib();
    renderFavs();
  }

  window.GL.register('chords', { navName: '和弦圖工坊', render: render });
})();
