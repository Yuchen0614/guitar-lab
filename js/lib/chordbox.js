/* 吉他實驗室 — 和弦圖引擎（SVG 渲染 + 互動編輯）
   靈感來自 SVGuitar / ChordPic，但為本站量身打造：
   - render(el, chord, opts)  純渲染
   - editor(el, state, onChange) 可點選編輯的互動指板
   - toSVGString / toPNG  匯出
*/
(function () {
  'use strict';

  var CB = {};
  var SVGNS = 'http://www.w3.org/2000/svg';

  /* chord = { name:'C', frets:[null,3,2,0,1,0], fingers:[null,3,2,0,1,0]|null } */

  CB.defaults = {
    width: 220, height: 250,
    strings: 6,
    frets: 5,          // 顯示琴格數
    baseFret: 1,       // 顯示起始格
    style: 'light',
    showTuning: true,
    showFingers: true,
    theme: {
      bg: 'transparent', line: '#8a93a5', fret: '#4a5162', nut: '#cfd6e4',
      dot: '#f0a848', dotText: '#17120a', text: '#e8eaf0', muted: '#9aa3b2',
      barre: 'rgba(240,168,72,.85)', open: 'none', accent: '#f0a848'
    }
  };

  /* ---------- 內部：建立 SVG 元素 ---------- */
  function el(tag, attrs, parent) {
    var e = document.createElementNS(SVGNS, tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }

  /* 計算版面幾何 */
  function geom(opts) {
    var w = opts.width, h = opts.height;
    var padL = opts.showTuning ? 44 : 30, padR = 26, padT = 54, padB = 34;
    var gw = w - padL - padR;             // grid 寬
    var gh = h - padT - padB;             // grid 高
    var colW = gw / (opts.strings - 1);
    var rowH = gh / opts.frets;
    return { w: w, h: h, padL: padL, padT: padT, gw: gw, gh: gh, colW: colW, rowH: rowH };
  }

  /* frets 陣列 → baseFret 自動判定（最低按壓格 > frets 時上移） */
  function autoBase(chord, opts) {
    var pressed = chord.frets.filter(function (f) { return f !== null && f > 0; });
    if (!pressed.length) return 1;
    var min = Math.min.apply(null, pressed);
    var max = Math.max.apply(null, pressed);
    if (max <= opts.frets) return 1;
    return min; // 把最低按壓格當第一格顯示
  }

  /* ---------- 純渲染 ---------- */
  CB.render = function (container, chord, userOpts) {
    var opts = Object.assign({}, CB.defaults, userOpts || {});
    var th = Object.assign({}, CB.defaults.theme, (userOpts && userOpts.theme) || {});
    var svg = el('svg', {
      viewBox: '0 0 ' + opts.width + ' ' + opts.height,
      width: opts.width, height: opts.height,
      role: 'img', 'aria-label': chord.name + ' 和弦圖'
    });
    var g = geom(opts);

    // 背景
    el('rect', { x: 0, y: 0, width: opts.width, height: opts.height, fill: th.bg }, svg);

    // 和弦名稱
    var title = el('text', {
      x: g.padL + (opts.strings - 1) * g.colW / 2, y: 30,
      'text-anchor': 'middle', 'font-size': 21, 'font-weight': 700, fill: th.text,
      'font-family': 'inherit'
    }, svg);
    title.textContent = chord.name || '';

    // 弦名（x 小寫高音 E）
    if (opts.showTuning) {
      var labels = ['E', 'A', 'D', 'G', 'B', 'e'];
      for (var s = 0; s < opts.strings; s++) {
        var tx = el('text', {
          x: g.padL + s * g.colW, y: g.padT - 10,
          'text-anchor': 'middle', 'font-size': 11, fill: th.muted, 'font-family': 'inherit'
        }, svg);
        tx.textContent = labels[s];
      }
    }

    // 弦（縱線）
    for (var st = 0; st < opts.strings; st++) {
      el('line', {
        x1: g.padL + st * g.colW, y1: g.padT,
        x2: g.padL + st * g.colW, y2: g.padT + g.gh,
        stroke: th.line, 'stroke-width': 1.4
      }, svg);
    }

    // 琴格（橫線）
    for (var fr = 0; fr <= opts.frets; fr++) {
      var isNut = (opts.baseFret === 1 && fr === 0);
      el('line', {
        x1: g.padL, y1: g.padT + fr * g.rowH,
        x2: g.padL + (opts.strings - 1) * g.colW, y2: g.padT + fr * g.rowH,
        stroke: isNut ? th.nut : th.fret,
        'stroke-width': isNut ? 5 : 1.3
      }, svg);
    }

    // baseFret 標示（>1 時）
    if (opts.baseFret > 1) {
      var bf = el('text', {
        x: g.padL - 12, y: g.padT + g.rowH / 2 + 4,
        'text-anchor': 'middle', 'font-size': 11, fill: th.muted
      }, svg);
      bf.textContent = opts.baseFret + 'fr';
    }

    // 底部琴格數字
    for (var n = 0; n < opts.frets; n++) {
      var num = el('text', {
        x: g.padL - 12, y: g.padT + (n + 0.5) * g.rowH + 4,
        'text-anchor': 'middle', 'font-size': 10.5, fill: th.muted
      }, svg);
      num.textContent = opts.baseFret + n;
    }

    // 悶音 ×、空弦 ○
    for (var i = 0; i < opts.strings; i++) {
      var f = chord.frets[i];
      var cx = g.padL + i * g.colW, cy = g.padT - 22;
      if (f === null || f === undefined) {
        el('text', { x: cx, y: cy + 4, 'text-anchor': 'middle', 'font-size': 13, fill: th.muted }, svg).textContent = '×';
      } else if (f === 0) {
        el('circle', { cx: cx, cy: cy, r: 4.5, fill: 'none', stroke: th.accent, 'stroke-width': 1.8 }, svg);
      }
    }

    // 按壓點 + 指法
    for (var k = 0; k < opts.strings; k++) {
      var ff = chord.frets[k];
      if (ff === null || ff === undefined || ff === 0) continue;
      var rel = ff - opts.baseFret + 1; // 顯示在第幾行
      if (rel < 1 || rel > opts.frets) continue;
      var dotX = g.padL + k * g.colW;
      var dotY = g.padT + (rel - 0.5) * g.rowH;
      el('circle', { cx: dotX, cy: dotY, r: 9.5, fill: th.dot }, svg);
      if (opts.showFingers && chord.fingers && chord.fingers[k]) {
        var ft = el('text', {
          x: dotX, y: dotY + 3.8, 'text-anchor': 'middle', 'font-size': 11,
          'font-weight': 700, fill: th.dotText
        }, svg);
        ft.textContent = chord.fingers[k];
      }
    }

    container.appendChild(svg);
    return svg;
  };

  /* ---------- 互動編輯器 ---------- */
  /* state = { frets, fingers }; onChange(state) */
  CB.editor = function (container, state, onChange, userOpts) {
    var opts = Object.assign({}, CB.defaults, userOpts || {});
    var th = Object.assign({}, CB.defaults.theme, (userOpts && userOpts.theme) || {});
    var wrap = el('div', { style: 'position:relative;display:inline-block;' });
    container.appendChild(wrap);

    function redraw() {
      wrap.innerHTML = '';
      var svg = el('svg', {
        viewBox: '0 0 ' + opts.width + ' ' + opts.height,
        width: opts.width, height: opts.height, style: 'touch-action:manipulation;cursor:pointer;'
      }, wrap);
      var g = geom(opts);

      el('rect', { x: 0, y: 0, width: opts.width, height: opts.height, fill: th.bg }, svg);

      var title = el('text', {
        x: g.padL + (opts.strings - 1) * g.colW / 2, y: 30,
        'text-anchor': 'middle', 'font-size': 21, 'font-weight': 700, fill: th.text
      }, svg);
      title.textContent = state.name || '自訂和弦';

      var labels = ['E', 'A', 'D', 'G', 'B', 'e'];
      for (var s = 0; s < opts.strings; s++) {
        el('text', { x: g.padL + s * g.colW, y: g.padT - 10, 'text-anchor': 'middle', 'font-size': 11, fill: th.muted }, svg).textContent = labels[s];
      }
      for (var st = 0; st < opts.strings; st++) {
        el('line', { x1: g.padL + st * g.colW, y1: g.padT, x2: g.padL + st * g.colW, y2: g.padT + g.gh, stroke: th.line, 'stroke-width': 1.4 }, svg);
      }
      for (var fr = 0; fr <= opts.frets; fr++) {
        var isNut = (opts.baseFret === 1 && fr === 0);
        el('line', {
          x1: g.padL, y1: g.padT + fr * g.rowH, x2: g.padL + (opts.strings - 1) * g.colW, y2: g.padT + fr * g.rowH,
          stroke: isNut ? th.nut : th.fret, 'stroke-width': isNut ? 5 : 1.3
        }, svg);
      }
      if (opts.baseFret > 1) {
        el('text', { x: g.padL - 12, y: g.padT + g.rowH / 2 + 4, 'text-anchor': 'middle', 'font-size': 11, fill: th.muted }, svg).textContent = opts.baseFret + 'fr';
      }
      for (var n = 0; n < opts.frets; n++) {
        el('text', { x: g.padL - 12, y: g.padT + (n + 0.5) * g.rowH + 4, 'text-anchor': 'middle', 'font-size': 10.5, fill: th.muted }, svg).textContent = opts.baseFret + n;
      }

      // 互動區：每個交叉點一個透明熱區
      for (var i = 0; i < opts.strings; i++) {
        var fi = state.frets[i];
        var cx = g.padL + i * g.colW;
        // × / ○ 切換
        if (fi === null || fi === 0) {
          var cy0 = g.padT - 22;
          el('text', { x: cx, y: cy0 + 4, 'text-anchor': 'middle', 'font-size': 13, fill: th.muted }, svg).textContent = fi === 0 ? '○' : '×';
        } else {
          var rel = fi - opts.baseFret + 1;
          if (rel >= 1 && rel <= opts.frets) {
            el('circle', { cx: cx, cy: g.padT + (rel - 0.5) * g.rowH, r: 9.5, fill: th.dot }, svg);
            if (state.fingers && state.fingers[i]) {
              el('text', {
                x: cx, y: g.padT + (rel - 0.5) * g.rowH + 3.8, 'text-anchor': 'middle',
                'font-size': 11, 'font-weight': 700, fill: th.dotText
              }, svg).textContent = state.fingers[i];
            }
          }
        }
        var hit = el('circle', { cx: cx, cy: g.padT - 22, r: 10, fill: 'transparent' }, svg);
        hit.style.cursor = 'pointer';
        hit.addEventListener('click', makeToggle(i));
      }

      function makeToggle(si) {
        return function () {
          var cur = state.frets[si];
          if (cur === null || cur === undefined) { state.frets[si] = 0; }
          else if (cur === 0) { state.frets[si] = null; }
          else { state.frets[si] = null; }
          normalize();
          onChange && onChange(state);
          redraw();
        };
      }
      function normalize() {
        for (var z = 0; z < state.frets.length; z++) {
          if (state.frets[z] === undefined) state.frets[z] = null;
        }
      }

      // 琴格熱區（點按切換 0 → 1..frets → null 循環）
      for (var sIdx = 0; sIdx < opts.strings; sIdx++) {
        (function (si) {
          var cx = g.padL + si * g.colW;
          var _loop = function (row) {
            var fy = g.padT + (row + 0.5) * g.rowH;
            var zone = el('rect', {
              x: cx - g.colW / 2, y: g.padT + row * g.rowH,
              width: g.colW, height: g.rowH, fill: 'transparent'
            }, svg);
            zone.style.cursor = 'pointer';
            zone.addEventListener('click', function () {
              var fretNum = opts.baseFret + row;
              state.frets[si] = (state.frets[si] === fretNum) ? null : fretNum;
              state.fingers = null; // 手動改格後清掉自動指法
              onChange && onChange(state);
              redraw();
            });
          };
          for (var row = 0; row < opts.frets; row++) _loop(row);
        })(sIdx);
      }
    }

    redraw();
    return { redraw: redraw, wrap: wrap };
  };

  /* ---------- 匯出 ---------- */
  CB.toSVGString = function (svgEl) {
    var clone = svgEl.cloneNode(true);
    clone.setAttribute('xmlns', SVGNS);
    // 內嵌字型避免匯出後走樣
    clone.setAttribute('style', 'font-family:Arial,Helvetica,sans-serif;background:#ffffff;');
    return '<?xml version="1.0" encoding="UTF-8"?>\n' + new XMLSerializer().serializeToString(clone);
  };

  CB.downloadSVG = function (svgEl, filename) {
    var blob = new Blob([CB.toSVGString(svgEl)], { type: 'image/svg+xml;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename || 'chord.svg';
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 400);
  };

  CB.downloadPNG = function (svgEl, filename, scale) {
    var s = scale || 3;
    var vb = svgEl.viewBox.baseVal;
    var w = vb.width * s, h = vb.height * s;
    var canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    var img = new Image();
    var svgStr = CB.toSVGString(svgEl);
    img.onload = function () {
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      canvas.toBlob(function (blob) {
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = filename || 'chord.png';
        document.body.appendChild(a); a.click();
        setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 400);
      });
    };
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgStr);
  };

  window.GLchordbox = CB;
})();
