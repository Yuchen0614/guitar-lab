/* 吉他實驗室 — Solo 譜生成（M5 + 歌曲匯入）
   和弦進行編輯 + 難度/BPM/seed → 生成 → ASCII 六線譜 + 試聽 + 匯出
   從歌曲匯入：上傳音檔 / YouTube 連結 → 和弦分析 → 帶入進行與調性建議 */
(function () {
  'use strict';

  var M = window.GLmusic, SG = window.GLsolo, TB = window.GLtab, SY = window.GLsynth;
  var AC = window.GLaudio, YT = window.GLyoutube;
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
          '<h3 class="panel-title">✨ 從歌曲匯入（可選）</h3>' +
          '<p class="hint" style="margin-top:0">丟一首歌進來，自動分析和弦與調性，帶入下方進行——再生成 Solo。音檔只在本機解碼。</p>' +
          '<div class="src-tabs" role="tablist">' +
            '<button class="chip chip-btn" data-so-src="file" role="tab">📁 上傳檔案</button>' +
            '<button class="chip chip-btn" data-so-src="yt" role="tab">▶ YouTube 連結</button>' +
          '</div>' +
          '<div class="src-pane" id="soFilePane" hidden>' +
            '<div class="dropzone" id="soDrop" tabindex="0" role="button" aria-label="選擇或拖曳音訊檔案">' +
              '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5"/><path d="M12 3v12"/></svg>' +
              '<p><strong>拖曳音訊檔到這裡</strong>，或點擊選擇</p>' +
              '<p class="hint">MP3 / WAV / M4A / OGG，建議 8 分鐘以內</p>' +
            '</div>' +
            '<input type="file" id="soFileInput" accept="audio/*,.mp3,.wav,.m4a,.ogg,.flac" hidden>' +
          '</div>' +
          '<div class="src-pane" id="soYtPane" hidden>' +
            '<label class="field-label">YouTube 網址</label>' +
            '<input type="url" id="soYtUrl" class="text-input" placeholder="https://www.youtube.com/watch?v=..." spellcheck="false">' +
            '<p class="hint">與和弦分析共用 cobalt 設定（實例 + Api-Key，在「和弦分析」頁填）。</p>' +
            '<button class="btn btn-primary btn-block" id="soYtGo" style="margin-top:10px">從 YouTube 匯入並分析</button>' +
            '<div class="yt-help" id="soYtHelp" hidden></div>' +
          '</div>' +
          '<div class="progress-wrap" id="soImportProg" hidden>' +
            '<div class="progress-bar"><div class="progress-fill" id="soImportFill"></div></div>' +
            '<p class="hint" id="soImportText">準備中…</p>' +
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

    /* ================= 從歌曲匯入 ================= */
    var importSrc = 'file';
    var importTabs = el.querySelectorAll('[data-so-src]');
    importTabs.forEach(function (t) {
      t.addEventListener('click', function () {
        importTabs.forEach(function (x) { x.classList.remove('chip-active'); });
        t.classList.add('chip-active');
        importSrc = t.dataset.soSrc;
        document.getElementById('soFilePane').hidden = importSrc !== 'file';
        document.getElementById('soYtPane').hidden = importSrc !== 'yt';
      });
    });

    function showImport(text, p) {
      document.getElementById('soImportProg').hidden = false;
      document.getElementById('soImportText').textContent = text;
      document.getElementById('soImportFill').style.width = Math.round((p || 0.02) * 100) + '%';
    }
    function setImportP(p) { document.getElementById('soImportFill').style.width = Math.round(p * 100) + '%'; }
    function hideImport() { document.getElementById('soImportProg').hidden = true; }

    /* 分析 → 帶入：把和弦段落壓縮成進行（相鄰同名合併、截斷到前 8 個不同段） */
    function applyAnalysis(segs, key) {
      // 1) 壓縮：相鄰同名和弦合併（保留出現順序）
      var compressed = [];
      segs.forEach(function (s) {
        if (compressed.length && compressed[compressed.length - 1].name === s.name) {
          compressed[compressed.length - 1].count++;
        } else {
          compressed.push({ name: s.name, root: s.root, typeId: s.typeId, count: 1 });
        }
      });
      // 2) 取前 16 個段落（約 1-2 分鐘的音樂）
      compressed = compressed.slice(0, 16);
      if (!compressed.length) { GL.toast('分析結果沒有可用的和弦'); return; }

      // 3) 帶入進行
      prog = compressed.map(function (c) {
        return { root: c.root, typeId: c.typeId };
      });
      saveProg();
      renderProg();

      // 4) 帶入調性建議（信賴度夠高才自動切換）
      if (key && key.corr >= 0.75) {
        keySel.value = key.root;
        SOS.data.keyRoot = key.root;
        // 大調→大調音階；小調→小調五聲（Solo 常用）
        if (/小調/.test(key.mode)) {
          scaleSel.value = 'pentaMin';
          SOS.data.scaleId = 'pentaMin';
        } else {
          scaleSel.value = 'major';
          SOS.data.scaleId = 'major';
        }
        SOS.save();
      }

      var progText = compressed.slice(0, 8).map(function (c) { return c.name; }).join(' → ');
      GL.toast('已帶入 ' + compressed.length + ' 個和弦段落' +
        (key ? '（估計調性：' + key.name + '）' : '') + '——按「生成 Solo」開始', 6000);
      var el = document.getElementById('soRun');
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return { progName: progText, key: key };
    }

    /* ---------- 上傳檔案流程 ---------- */
    var drop = document.getElementById('soDrop');
    var fileInput = document.getElementById('soFileInput');
    drop.addEventListener('click', function () { fileInput.click(); });
    drop.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') fileInput.click(); });
    ['dragover', 'dragenter'].forEach(function (ev) {
      drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add('drag'); });
    });
    ['dragleave', 'drop'].forEach(function (ev) {
      drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove('drag'); });
    });
    drop.addEventListener('drop', function (e) {
      var f = e.dataTransfer.files && e.dataTransfer.files[0];
      if (f) importFromFile(f);
    });
    fileInput.addEventListener('change', function () {
      if (fileInput.files[0]) importFromFile(fileInput.files[0]);
    });

    function importFromFile(f) {
      showImport('解碼 ' + f.name + '…');
      AC.decodeFile(f).then(function (buf) {
        showImport('計算 chroma…', 0.3);
        var mono = AC.toMono(buf);
        var down = AC.trimSilence(AC.downsample(mono, buf.sampleRate, 22050));
        var chroma = AC.chromaFrames(down, 22050, { frameSize: 4096, hop: 2048 });
        setImportP(0.7);
        document.getElementById('soImportText').textContent = '辨識和弦…';
        var templates = AC.templates24(false);
        var probs = AC.templateScores(chroma.frames, templates);
        var raw = AC.viterbi(probs, templates, 0.6);
        var path = AC.modeFilter(raw, templates, 2);
        var segs = AC.segments(path, templates, chroma.frameDur);
        var key = AC.estimateKey(chroma.frames);
        setImportP(1);
        hideImport();
        applyAnalysis(segs, key);
      }).catch(function (err) {
        hideImport();
        GL.toast('匯入失敗：' + err.message);
      });
    }

    /* ---------- YouTube 流程 ---------- */
    document.getElementById('soYtGo').addEventListener('click', function () {
      var url = document.getElementById('soYtUrl').value.trim();
      if (!YT.videoId(url)) { GL.toast('這看起來不是 YouTube 影片網址'); return; }
      var btn = this;
      btn.disabled = true;
      showImport('向 cobalt 實例請求音訊軌…');
      YT.getTunnel(url, showImport).then(function (r) {
        if (!r.ok) {
          hideImport();
          btn.disabled = false;
          var box = document.getElementById('soYtHelp');
          if (box && r.classified.steps) {
            box.hidden = false;
            box.innerHTML = '<strong>' + r.classified.title + '</strong><p class="hint">' + r.classified.msg + '</p>';
            YT.renderSteps(box, r.classified.steps);
            box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          } else {
            GL.toast(r.classified.title + '：' + r.classified.msg, 6000);
          }
          return;
        }
        return YT.downloadAudio(r.url, showImport).then(function (ab) {
          showImport('解碼音訊…', 0.85);
          return AC.decodeBytes(ab);
        }).then(function (buf) {
          showImport('計算 chroma…', 0.9);
          var mono = AC.toMono(buf);
          var down = AC.trimSilence(AC.downsample(mono, buf.sampleRate, 22050));
          var chroma = AC.chromaFrames(down, 22050, { frameSize: 4096, hop: 2048 });
          setImportP(0.95);
          document.getElementById('soImportText').textContent = '辨識和弦…';
          var templates = AC.templates24(false);
          var probs = AC.templateScores(chroma.frames, templates);
          var raw = AC.viterbi(probs, templates, 0.6);
          var path = AC.modeFilter(raw, templates, 2);
          var segs = AC.segments(path, templates, chroma.frameDur);
          var key = AC.estimateKey(chroma.frames);
          setImportP(1);
          hideImport();
          btn.disabled = false;
          applyAnalysis(segs, key);
        });
      }).catch(function (err) {
        hideImport();
        btn.disabled = false;
        GL.toast('YouTube 匯入失敗：' + err.message + '（可改用上傳檔案）');
      });
    });

    GL.onCleanup(function () { stopPlayback(); result = null; });
  }

  window.GL.register('solo', { navName: 'Solo 譜生成', render: render });
})();
