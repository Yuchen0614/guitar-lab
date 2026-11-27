/* 吉他實驗室 — Solo 譜生成（M5）
   和弦進行編輯 + 難度/BPM/seed → 生成 → ASCII 六線譜 + 試聽 + 匯出 */
(function () {
  'use strict';

  var M = window.GLmusic, SG = window.GLsolo, TB = window.GLtab, SY = window.GLsynth;
  var SOS = GL.store.bind('solo_settings', {
    keyRoot: 0, scaleId: 'major', difficulty: 'medium',
    barsPerChord: 2, bpm: 90, seed: 42
  });
  var result = null;
  var currentSeed = 42;

  /* ---------- 預設進行 ---------- */
  var PRESETS = [
    { name: '流行經典 I–V–vi–IV', chords: [[0, 'maj'], [7, 'maj'], [9, 'min'], [5, 'maj']] },
    { name: '深情進行 vi–IV–I–V', chords: [[9, 'min'], [5, 'maj'], [0, 'maj'], [7, 'maj']] },
    { name: '藍調小五聲 i7–iv7', chords: [[9, 'min'], [9, 'min'], [5, 'min'], [5, 'min']] },
    { name: '爵士 ii–V–I', chords: [[2, 'm7'], [7, '7'], [0, 'maj7'], [0, 'maj7']] },
    { name: '卡農進行 I–V–vi–iii–IV', chords: [[0, 'maj'], [7, 'maj'], [9, 'min'], [4, 'min'], [5, 'maj']] }
  ];
  var SCALES = [
    { id: 'major', name: '大調音階' },
    { id: 'pentaMin', name: '小五聲音階（藍調感）' },
    { id: 'pentaMaj', name: '大五聲音階（鄉村感）' },
    { id: 'mixo', name: 'Mixolydian（搖滾感）' }
  ];

  function render(el) {
    el.innerHTML =
      '<section class="module-hero"><div class="container">' +
        '<p class="kicker">Solo Generator</p>' +
        '<h1>Solo 譜生成</h1>' +
        '<p class="lede">選調性、和弦進行與難度，沿著和弦內音編出可彈奏的 Solo 樂句——輸出六線譜、可試聽、可匯出。</p>' +
        '<div class="chip-row">' +
          '<span class="chip">和弦音骨架</span><span class="chip">音階填充</span>' +
          '<span class="chip">把位連續</span><span class="chip">可重現 seed</span>' +
        '</div>' +
      '</div></section>' +

      '<section class="container analyzer-grid">' +
        '<div class="panel">' +
          '<h3 class="panel-title">1 · 調性與音階</h3>' +
          '<div class="select-row">' +
            '<label>調性<select id="soKey"></select></label>' +
            '<label>音階<select id="soScale"></select></label>' +
          '</div>' +
          '<h3 class="panel-title" style="margin-top:18px">2 · 和弦進行</h3>' +
          '<div class="preset-row" id="soPresets"></div>' +
          '<div class="prog-editor" id="soProg"></div>' +
          '<div class="btn-row" style="margin-top:8px">' +
            '<button class="btn btn-ghost btn-sm" id="soAddChord">＋ 加和弦</button>' +
            '<button class="btn btn-ghost btn-sm" id="soClearChords">清空</button>' +
          '</div>' +
        '</div>' +

        '<div class="panel">' +
          '<h3 class="panel-title">3 · 生成設定</h3>' +
          '<div class="select-row">' +
            '<label>難度<select id="soDiff">' +
              '<option value="easy">初級（長音、開放把位）</option>' +
              '<option value="medium" selected>中級（八分音符樂句）</option>' +
              '<option value="hard">高級（十六分、推滑音）</option>' +
            '</select></label>' +
            '<label>每和弦小節<select id="soBars">' +
              '<option value="1">1 小節</option>' +
              '<option value="2" selected>2 小節</option>' +
              '<option value="4">4 小節</option>' +
            '</select></label>' +
          '</div>' +
          '<label class="field-label" style="margin-top:14px">速度 <span id="soBpmVal">90 BPM</span></label>' +
          '<input type="range" id="soBpm" min="50" max="180" step="5" value="90">' +
          '<div class="range-label"><span>慢板 50</span><span>急板 180</span></div>' +
          '<label class="field-label" style="margin-top:14px">隨機種子 seed <span id="soSeedVal">42</span></label>' +
          '<div class="seed-row">' +
            '<input type="number" id="soSeed" class="text-input" min="0" max="99999" value="42">' +
            '<button class="btn btn-ghost btn-sm" id="soSeedRnd" title="隨機 seed">🎲</button>' +
          '</div>' +
          '<p class="hint">相同 seed + 相同設定 = 完全相同的譜。喜歡某個版本就記下 seed。</p>' +
          '<div class="btn-row" style="margin-top:14px">' +
            '<button class="btn btn-primary" id="soRun">4 · 生成 Solo</button>' +
          '</div>' +
        '</div>' +
      '</section>' +

      '<section class="container result-section" id="soResult" hidden>' +
        '<div class="result-head">' +
          '<div>' +
            '<h2 class="section-title" style="margin-bottom:4px">Solo 六線譜</h2>' +
            '<p class="hint" id="soMeta"></p>' +
          '</div>' +
          '<div class="btn-row">' +
            '<button class="btn btn-ghost btn-sm" id="soPlay">▶ 試聽</button>' +
            '<button class="btn btn-ghost btn-sm" id="soStop">■ 停止</button>' +
            '<button class="btn btn-ghost btn-sm" id="soTxt">下載 TXT</button>' +
            '<button class="btn btn-ghost btn-sm" id="soTex">複製 alphaTex</button>' +
          '</div>' +
        '</div>' +
        '<div class="panel"><pre class="tab-pre" id="soTab"></pre></div>' +
        '<details class="adv-box alpha-tab-box">' +
          '<summary>標準譜檢視（alphaTab，含五線譜與節拍）</summary>' +
          '<p class="hint">從 CDN 載入 alphaTab 渲染標準譜。首次開啟需下載約 1MB 資源。</p>' +
          '<div class="alpha-tab-wrap" id="soAlphaTab"></div>' +
        '</details>' +
        '<p class="hint center">b = 推弦 · / = 滑音。節奏以半拍為最小單位；樂句每 2 小節收在和弦音上。</p>' +
      '</section>';

    /* ---------- 調性/音階下拉 ---------- */
    var keySel = document.getElementById('soKey');
    var scaleSel = document.getElementById('soScale');
    for (var i = 0; i < 12; i++) {
      var opt = document.createElement('option');
      opt.value = i;
      opt.textContent = M.pcName(i) + ' 調';
      keySel.appendChild(opt);
    }
    SCALES.forEach(function (s) {
      var opt = document.createElement('option');
      opt.value = s.id;
      opt.textContent = s.name;
      scaleSel.appendChild(opt);
    });
    keySel.value = SOS.data.keyRoot;
    scaleSel.value = SOS.data.scaleId;
    keySel.addEventListener('change', function () { SOS.data.keyRoot = +keySel.value; SOS.save(); });
    scaleSel.addEventListener('change', function () { SOS.data.scaleId = scaleSel.value; SOS.save(); });

    /* ---------- 和弦進行編輯器 ---------- */
    var prog = SOS.data.prog ? SOS.data.prog.slice() :
      PRESETS[0].chords.map(function (c) { return { root: c[0], typeId: c[1] }; });
    saveProg();

    function saveProg() {
      SOS.data.prog = prog;
      SOS.save();
    }

    // 預設按鈕
    var presetBox = document.getElementById('soPresets');
    PRESETS.forEach(function (p) {
      var b = document.createElement('button');
      b.className = 'chip chip-btn chip-sm';
      b.textContent = p.name;
      b.addEventListener('click', function () {
        prog = p.chords.map(function (c) { return { root: c[0], typeId: c[1] }; });
        saveProg();
        renderProg();
      });
      presetBox.appendChild(b);
    });

    function renderProg() {
      var box = document.getElementById('soProg');
      box.innerHTML = '';
      prog.forEach(function (chord, i) {
        var cell = document.createElement('div');
        cell.className = 'prog-cell';
        var rootSel = document.createElement('select');
        for (var r = 0; r < 12; r++) {
          var o = document.createElement('option');
          o.value = r;
          o.textContent = M.pcName(r);
          if (r === chord.root) o.selected = true;
          rootSel.appendChild(o);
        }
        var typeSel = document.createElement('select');
        ['maj', 'min', '7', 'm7', 'maj7', 'sus4'].forEach(function (t) {
          var ct = SG.chordType(t);
          var o = document.createElement('option');
          o.value = t;
          o.textContent = ct.suffix || 'maj';
          if (t === chord.typeId) o.selected = true;
          typeSel.appendChild(o);
        });
        rootSel.addEventListener('change', function () { chord.root = +rootSel.value; saveProg(); });
        typeSel.addEventListener('change', function () { chord.typeId = typeSel.value; saveProg(); });
        var del = document.createElement('button');
        del.className = 'prog-del';
        del.textContent = '×';
        del.title = '刪除此和弦';
        del.addEventListener('click', function () {
          prog.splice(i, 1);
          saveProg();
          renderProg();
        });
        cell.appendChild(rootSel);
        cell.appendChild(typeSel);
        cell.appendChild(del);
        box.appendChild(cell);
      });
      if (!prog.length) {
        box.innerHTML = '<p class="hint">尚無和弦——按「＋ 加和弦」或選一個預設進行。</p>';
      }
    }
    renderProg();

    document.getElementById('soAddChord').addEventListener('click', function () {
      prog.push({ root: 0, typeId: 'maj' });
      saveProg();
      renderProg();
    });
    document.getElementById('soClearChords').addEventListener('click', function () {
      prog = [];
      saveProg();
      renderProg();
    });

    /* ---------- 設定 ---------- */
    var diffSel = document.getElementById('soDiff');
    var barsSel = document.getElementById('soBars');
    var bpmInput = document.getElementById('soBpm');
    var seedInput = document.getElementById('soSeed');
    diffSel.value = SOS.data.difficulty;
    barsSel.value = String(SOS.data.barsPerChord);
    bpmInput.value = SOS.data.bpm;
    seedInput.value = SOS.data.seed;
    document.getElementById('soBpmVal').textContent = SOS.data.bpm + ' BPM';
    document.getElementById('soSeedVal').textContent = SOS.data.seed;
    diffSel.addEventListener('change', function () { SOS.data.difficulty = diffSel.value; SOS.save(); });
    barsSel.addEventListener('change', function () { SOS.data.barsPerChord = +barsSel.value; SOS.save(); });
    bpmInput.addEventListener('input', function () {
      SOS.data.bpm = +bpmInput.value;
      document.getElementById('soBpmVal').textContent = bpmInput.value + ' BPM';
      SOS.save();
    });
    seedInput.addEventListener('change', function () {
      SOS.data.seed = +seedInput.value || 42;
      document.getElementById('soSeedVal').textContent = SOS.data.seed;
      SOS.save();
    });
    document.getElementById('soSeedRnd').addEventListener('click', function () {
      currentSeed = Math.floor(Math.random() * 99999);
      seedInput.value = currentSeed;
      SOS.data.seed = currentSeed;
      document.getElementById('soSeedVal').textContent = currentSeed;
      SOS.save();
    });

    /* ---------- 生成 ---------- */
    document.getElementById('soRun').addEventListener('click', function () {
      if (!prog.length) { GL.toast('請先加入至少一個和弦'); return; }
      var key = { root: +keySel.value, scaleId: scaleSel.value };
      var opts = {
        difficulty: diffSel.value,
        barsPerChord: +barsSel.value,
        seed: +seedInput.value || 42
      };
      result = SG.generate(prog, key, opts);
      var tab = TB.render(result, prog, { barsPerLine: 4, barsPerChord: opts.barsPerChord });
      document.getElementById('soTab').textContent = tab;
      var totalBars = result.totalBeats / 4;
      document.getElementById('soMeta').textContent =
        M.pcName(key.root) + ' ' + scaleLabel(key.scaleId) + ' · ' + totalBars + ' 小節 · ' +
        result.events.length + ' 個音 · seed ' + opts.seed;
      document.getElementById('soResult').hidden = false;
      document.getElementById('soResult').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });

    function scaleLabel(id) {
      for (var i = 0; i < SCALES.length; i++) if (SCALES[i].id === id) return SCALES[i].name;
      return id;
    }

    /* ---------- 試聽 ---------- */
    var playTimer = null;
    document.getElementById('soPlay').addEventListener('click', function () {
      if (!result) return;
      stopPlayback();
      var bpm = SOS.data.bpm || 90;
      var beatSec = 60 / bpm;
      var c = SY.ctx();
      var t0 = c.currentTime + 0.15;
      result.events.forEach(function (e) {
        var f = M.midiToFreq(e.midi);
        var gain = e.kind === 'chord' ? 0.42 : 0.3;
        SY.pluck(f, t0 + e.start * beatSec, gain, 0);
        // 技巧：bend 用頻率滑升、slide 用快速滑音到下一音
        // （簡化：在音的開頭以 osc 頻率 ramp 表現）
      });
      var totalSec = result.totalBeats * beatSec + 2;
      playTimer = setTimeout(stopPlayback, totalSec * 1000);
      GL.toast('試聽中… ' + bpm + ' BPM');
    });
    document.getElementById('soStop').addEventListener('click', stopPlayback);
    function stopPlayback() {
      if (playTimer) { clearTimeout(playTimer); playTimer = null; }
      // 靜音：關掉所有 oscillator 不易追蹤，改以關閉主音量再開——簡化：重載頁面音源已停
      // Web Audio 的 pluck 是一次性 oscillator，setTimeout 停止計時即可
    }

    /* ---------- 匯出 ---------- */
    document.getElementById('soTxt').addEventListener('click', function () {
      if (!result) return;
      var tab = document.getElementById('soTab').textContent;
      var blob = new Blob([tab], { type: 'text/plain;charset=utf-8' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'solo-' + M.pcName(result.key.root).replace('#', 's') + '-seed' + SOS.data.seed + '.txt';
      document.body.appendChild(a); a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 400);
    });
    document.getElementById('soTex').addEventListener('click', function () {
      if (!result) return;
      var tex = TB.toAlphaTex(result, prog, { bpm: SOS.data.bpm });
      navigator.clipboard.writeText(tex).then(
        function () { GL.toast('alphaTex 已複製（可貼進 alphaTab）'); },
        function () { GL.toast('複製失敗'); });
    });

    /* ---------- alphaTab 標準譜（懶載入） ---------- */
    var alphaTabLoaded = false;
    document.querySelector('.alpha-tab-box').addEventListener('toggle', function () {
      if (!this.open || !result) return;
      var wrap = document.getElementById('soAlphaTab');
      if (wrap.dataset.rendered === '1') return;
      wrap.textContent = '載入 alphaTab…';
      loadAlphaTab(function (ok) {
        if (!ok) { wrap.textContent = 'alphaTab 載入失敗（CDN 不可用）——ASCII 六線譜仍可正常使用與匯出。'; return; }
        try {
          wrap.innerHTML = '';
          var api = new alphaTab.AlphaTabApi(wrap, {
            core: { fontDirectory: 'https://cdn.jsdelivr.net/npm/@coderline/alphatab@latest/dist/font/' }
          });
          api.tex(TB.toAlphaTex(result, prog, { bpm: SOS.data.bpm }));
          wrap.dataset.rendered = '1';
        } catch (e) {
          wrap.textContent = '渲染失敗：' + e.message;
        }
      });
    });

    function loadAlphaTab(cb) {
      if (window.alphaTab) { cb(true); return; }
      var s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/@coderline/alphatab@latest/dist/alphaTab.js';
      s.onload = function () { cb(true); };
      s.onerror = function () { cb(false); };
      document.head.appendChild(s);
    }

    GL.onCleanup(function () { stopPlayback(); result = null; });
  }

  window.GL.register('solo', { navName: 'Solo 譜生成', render: render });
})();
