/* 吉他實驗室 — 樂理教室（M2）
   課程資料：js/data/theory-data.js → window.GL_DATA.theory.courses
   附加：互動指板（音階/音名模式）、調內和弦查詢 */
(function () {
  'use strict';

  var M = window.GLmusic, SY = window.GLsynth;
  var progress = GL.store.bind('theory_progress', { done: [] });

  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /* body 區塊渲染 */
  function renderBody(body) {
    var html = '';
    (body || []).forEach(function (b) {
      if (b.type === 'p') html += '<p>' + esc(b.text) + '</p>';
      else if (b.type === 'list') html += '<ul>' + b.items.map(function (i) { return '<li>' + esc(i) + '</li>'; }).join('') + '</ul>';
      else if (b.type === 'table') {
        html += '<table><thead><tr>' + b.head.map(function (h) { return '<th>' + esc(h) + '</th>'; }).join('') + '</tr></thead><tbody>';
        b.rows.forEach(function (r) { html += '<tr>' + r.map(function (c) { return '<td>' + esc(c) + '</td>'; }).join('') + '</tr>'; });
        html += '</tbody></table>';
      }
      else if (b.type === 'note') html += '<div class="note-box">' + esc(b.text) + '</div>';
      else if (b.type === 'callout') html += '<div class="callout ' + (b.tone || 'info') + '"><strong>' + esc(b.title || '') + '</strong>' + esc(b.text) + '</div>';
    });
    return html;
  }

  /* ---------- 互動指板 ---------- */
  function fretboardWidget(opts) {
    // opts: { mode:'scale'|'notes', root, scaleId }
    var wrap = document.createElement('div');
    wrap.className = 'fb-widget';
    var W = 900, H = 150, left = 46, right = 20, top = 34, rowH = 18, fretsN = 13;
    var totalW = W - left - right;
    // 真實弦長比（12-TET）：第 n 格位置 = L*(1-2^(-n/12))
    function fretX(f) { return f === 0 ? 0 : totalW * (1 - Math.pow(2, -f / 12)); }
    var scalePcs = opts.mode === 'scale' ? M.scalePcs(M.noteToPc(opts.root), opts.scaleId) : null;

    function draw() {
      var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" class="fb-svg" role="img" aria-label="互動指板">';
      // 琴格線
      for (var f = 0; f <= fretsN; f++) {
        var x = left + fretX(f);
        svg += '<line x1="' + x + '" y1="' + top + '" x2="' + x + '" y2="' + (top + 5 * rowH) + '" stroke="var(--border-strong)" stroke-width="' + (f === 0 ? 4 : 1.4) + '"/>';
        if (f > 0) {
          svg += '<text x="' + ((left + fretX(f) + left + fretX(f - 1)) / 2) + '" y="' + (top + 5 * rowH + 16) + '" text-anchor="middle" font-size="10" fill="var(--faint)">' + f + '</text>';
        }
      }
      // 弦
      var labels = ['E', 'A', 'D', 'G', 'B', 'e'];
      for (var s = 0; s < 6; s++) {
        var y = top + s * rowH;
        svg += '<line x1="' + left + '" y1="' + y + '" x2="' + (left + totalW) + '" y2="' + y + '" stroke="var(--muted)" stroke-width="' + (2.6 - s * 0.3) + '"/>';
        svg += '<text x="' + (left - 18) + '" y="' + (y + 4) + '" text-anchor="middle" font-size="11" fill="var(--muted)">' + labels[s] + '</text>';
      }
      // 記號點
      [3, 5, 7, 9].forEach(function (f) {
        var x = left + (fretX(f) + fretX(f - 1)) / 2;
        svg += '<circle cx="' + x + '" cy="' + (top + 2.5 * rowH) + '" r="4" fill="var(--border-strong)" opacity=".5"/>';
      });
      var x12 = left + (fretX(12) + fretX(11)) / 2;
      svg += '<circle cx="' + x12 + '" cy="' + (top + 1.5 * rowH) + '" r="4" fill="var(--border-strong)" opacity=".5"/>';
      svg += '<circle cx="' + x12 + '" cy="' + (top + 3.5 * rowH) + '" r="4" fill="var(--border-strong)" opacity=".5"/>';

      // 音符
      var inScale = 0;
      for (var st = 0; st < 6; st++) {
        for (var fr = 0; fr <= 12; fr++) {
          var midi = M.OPEN_STRINGS[st] + fr;
          var pc = M.mod12(midi);
          var isRoot = scalePcs ? (pc === scalePcs[0]) : false;
          var show = opts.mode === 'notes' || (scalePcs && scalePcs.indexOf(pc) >= 0);
          if (!show) continue;
          inScale++;
          var x = left + (fr === 0 ? 0 : (fretX(fr) + fretX(fr - 1)) / 2);
          var y = top + st * rowH;
          if (fr === 0) x -= 14;
          var col = isRoot ? 'var(--accent)' : 'var(--card-hover)';
          var txt = isRoot ? 'var(--dot-text,#17120a)' : 'var(--text)';
          if (opts.mode === 'notes') { col = 'transparent'; txt = 'var(--muted)'; }
          if (opts.mode === 'notes') {
            svg += '<text x="' + x + '" y="' + (y + 3.5) + '" text-anchor="middle" font-size="9.5" fill="var(--muted)" font-family="var(--font-mono)">' + M.pcName(pc) + '</text>';
          } else {
            svg += '<circle cx="' + x + '" cy="' + y + '" r="7.5" fill="' + col + '" stroke="var(--accent-border)" stroke-width="1"/>';
            svg += '<text x="' + x + '" y="' + (y + 3.2) + '" text-anchor="middle" font-size="' + (isRoot ? 9 : 8) + '" font-weight="' + (isRoot ? 700 : 500) + '" fill="' + (isRoot ? '#17120a' : 'var(--text)') + '">' + M.pcName(pc) + '</text>';
          }
        }
      }
      svg += '</svg>';
      wrap.innerHTML = svg;
      return inScale;
    }

    draw();
    return { el: wrap, redraw: draw };
  }

  function render(el) {
    var data = (window.GL_DATA && window.GL_DATA.theory && window.GL_DATA.theory.courses) || [];
    var doneSet = {};
    (progress.data.done || []).forEach(function (id) { doneSet[id] = true; });

    el.innerHTML =
      '<section class="module-hero"><div class="container">' +
        '<p class="kicker">Music Theory</p>' +
        '<h1>樂理教室</h1>' +
        '<p class="lede">為吉他手寫的樂理課：六堂課從音名走到和弦進行，每堂 5–10 分鐘，讀完直接在指板上用。</p>' +
        '<div class="chip-row"><span class="chip" id="thProgress">已完成 0 / ' + data.length + ' 課</span></div>' +
      '</div></section>' +

      '<section class="container theory-layout">' +
        '<aside class="theory-toc panel" id="thToc"></aside>' +
        '<div class="theory-content">' +
          '<div class="panel theory-tools">' +
            '<h3 class="panel-title">互動指板</h3>' +
            '<div class="select-row" style="grid-template-columns:1fr 1fr 1fr">' +
              '<label>模式<select id="thFbMode"><option value="scale">音階顯示</option><option value="notes">全部音名</option></select></label>' +
              '<label>根音<select id="thFbRoot"></select></label>' +
              '<label>音階<select id="thFbScale"></select></label>' +
            '</div>' +
            '<div id="thFretboard" style="margin-top:14px;overflow-x:auto;"></div>' +
          '</div>' +
          '<div class="panel theory-tools" style="margin-top:16px">' +
            '<h3 class="panel-title">調內和弦查詢</h3>' +
            '<div class="select-row" style="grid-template-columns:1fr 1fr 1.4fr">' +
              '<label>根音<select id="thKeyRoot"></select></label>' +
              '<label>調性<select id="thKeyMode"><option value="major">大調</option><option value="natmin">自然小調</option></select></label>' +
              '<label style="align-self:end"><span>&nbsp;</span><button class="btn btn-ghost btn-sm btn-block" id="thKeyGo">顯示順階和弦</button></label>' +
            '</div>' +
            '<div id="thDiatonic" style="margin-top:14px"></div>' +
          '</div>' +
          '<article class="panel prose" id="thArticle" style="margin-top:16px;display:none"></article>' +
        '</div>' +
      '</section>';

    /* TOC */
    var toc = document.getElementById('thToc');
    function renderToc(activeId) {
      toc.innerHTML = '<h3 class="panel-title">課程目錄</h3>';
      data.forEach(function (c) {
        var a = document.createElement('button');
        a.className = 'toc-item' + (c.id === activeId ? ' toc-active' : '') + (doneSet[c.id] ? ' toc-done' : '');
        a.innerHTML = '<span class="toc-num">' + (doneSet[c.id] ? '✓' : c.id.replace('c', '')) + '</span>' +
          '<span><strong>' + esc(c.title) + '</strong><small>' + esc(c.level) + ' · 約 ' + c.minutes + ' 分</small></span>';
        a.addEventListener('click', function () { showCourse(c.id); });
        toc.appendChild(a);
      });
      document.getElementById('thProgress').textContent = '已完成 ' + Object.keys(doneSet).length + ' / ' + data.length + ' 課';
    }

    function showCourse(id) {
      var c = data.filter(function (x) { return x.id === id; })[0];
      if (!c) return;
      var art = document.getElementById('thArticle');
      art.style.display = 'block';
      var bodyHtml = c.sections.map(function (s) { return '<h3>' + esc(s.h) + '</h3>' + renderBody(s.body); }).join('');
      art.innerHTML =
        '<header class="course-head"><h2>' + esc(c.title) + '</h2><p class="course-sub">' + esc(c.subtitle || '') + '</p></header>' +
        bodyHtml +
        '<div class="course-foot"><button class="btn btn-primary" id="thDoneBtn">' + (doneSet[c.id] ? '✓ 已讀完（再點一次取消）' : '標記為已讀完') + '</button></div>';
      document.getElementById('thDoneBtn').addEventListener('click', function () {
        if (doneSet[c.id]) { delete doneSet[c.id]; } else { doneSet[c.id] = true; GL.toast('完成！下一課見 🎸'); }
        progress.data.done = Object.keys(doneSet);
        progress.save();
        renderToc(c.id);
        showCourse(c.id);
      });
      renderToc(id);
      art.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    /* 指板 */
    var fbRoot = document.getElementById('thFbRoot');
    var fbScale = document.getElementById('thFbScale');
    var fbMode = document.getElementById('thFbMode');
    M.NOTES.forEach(function (n) { var o = document.createElement('option'); o.value = n; o.textContent = n; fbRoot.appendChild(o); });
    M.SCALES.forEach(function (s) { var o = document.createElement('option'); o.value = s.id; o.textContent = s.name; fbScale.appendChild(o); });
    fbRoot.value = 'C'; fbScale.value = 'major';

    var fbHost = document.getElementById('thFretboard');
    var fb = fretboardWidget({ mode: 'scale', root: 'C', scaleId: 'major' });
    fbHost.appendChild(fb.el);
    function fbUpdate() {
      fbHost.innerHTML = '';
      var f2 = fretboardWidget({ mode: fbMode.value, root: fbRoot.value, scaleId: fbScale.value });
      fbHost.appendChild(f2.el);
    }
    [fbRoot, fbScale, fbMode].forEach(function (sel) { sel.addEventListener('change', fbUpdate); });

    /* 調內和弦 */
    var keyRoot = document.getElementById('thKeyRoot');
    M.NOTES.forEach(function (n) { var o = document.createElement('option'); o.value = n; o.textContent = n; keyRoot.appendChild(o); });
    keyRoot.value = 'C';
    document.getElementById('thKeyGo').addEventListener('click', function () {
      var rootPc = M.noteToPc(keyRoot.value);
      var mode = document.getElementById('thKeyMode').value;
      var dia = M.diatonic(rootPc, mode);
      var host = document.getElementById('thDiatonic');
      var html = '<div class="dia-grid">';
      dia.forEach(function (d) {
        html += '<div class="dia-card"><span class="dia-roman">' + d.roman + '</span>' +
          '<strong>' + d.name + '</strong><small>七和弦 ' + d.name7 + '</small>' +
          '<button class="btn btn-ghost btn-sm dia-play" data-root="' + d.root + '" data-type="' + d.triad + '">▶ 試聽</button></div>';
      });
      html += '</div>';
      host.innerHTML = html;
      host.querySelectorAll('.dia-play').forEach(function (b) {
        b.addEventListener('click', function () {
          var rootPc2 = +b.dataset.root, tid = b.dataset.type;
          var v = M.getVoicing(rootPc2, tid);
          if (v) SY.playMidis(M.voicingToMidis(v));
          else SY.playMidis(M.chordPcs({ root: rootPc2, type: { iv: [0, 4, 7] } }).map(function (pc) { return 48 + pc; }));
        });
      });
    });

    /* 主題切換重繪指板 */
    var mo = new MutationObserver(function () { fbUpdate(); });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    if (data.length) { renderToc(null); showCourse(data[0].id); }
    else {
      document.getElementById('thToc').innerHTML = '<p class="hint">課程資料載入中……重新整理即可看到。</p>';
    }
  }

  window.GL.register('theory', { navName: '樂理教室', render: render });
})();
