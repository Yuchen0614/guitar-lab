/* 吉他實驗室 — 段落與歌詞（M4）
   上半：音訊段落分析（與和弦分析共用音訊來源：檔案/YouTube/示範）
   下半：歌詞押韻分析（貼上歌詞 → 韻式字母著色、韻腳統計） */
(function () {
  'use strict';

  var AC = window.GLaudio, SS = window.GLstructure, R = window.GLrhyme;
  var YTS = GL.store.bind('yt_settings', { endpoint: 'https://co.otomir23.me' });
  var STS = GL.store.bind('st_settings', { kernelSec: 8, threshold: 0.9 });
  var result = null;

  function fmtTime(s) {
    var m = Math.floor(s / 60), ss = Math.floor(s % 60);
    return m + ':' + (ss < 10 ? '0' : '') + ss;
  }

  var LETTER_COLORS = ['#f0a848', '#7dd3fc', '#4ade80', '#f472b6', '#c084fc', '#fbbf24', '#34d399', '#f87171'];
  function letterColor(i) { return LETTER_COLORS[i % LETTER_COLORS.length]; }

  function render(el) {
    el.innerHTML =
      '<section class="module-hero"><div class="container">' +
        '<p class="kicker">Structure &amp; Lyrics</p>' +
        '<h1>段落與歌詞</h1>' +
        '<p class="lede">聽出歌曲的段落骨架（A/B/C 結構），再貼上歌詞看押韻。所有計算都在這個分頁完成——音檔不上傳。</p>' +
        '<div class="chip-row">' +
          '<span class="chip">自相似矩陣</span><span class="chip">Foote novelty</span>' +
          '<span class="chip">A/B/C 標記</span><span class="chip">十三轍押韻</span>' +
        '</div>' +
      '</div></section>' +

      '<section class="container analyzer-grid">' +
        '<div class="panel">' +
          '<h3 class="panel-title">1 · 選擇音訊來源</h3>' +
          '<div class="src-tabs" role="tablist">' +
            '<button class="chip chip-btn chip-active" data-src="file" role="tab">📁 上傳檔案</button>' +
            '<button class="chip chip-btn" data-src="yt" role="tab">▶ YouTube 連結</button>' +
            '<button class="chip chip-btn" data-src="demo" role="tab">🎵 示範音訊</button>' +
          '</div>' +
          '<div class="src-pane" id="stFile">' +
            '<div class="dropzone" id="stDrop" tabindex="0" role="button" aria-label="選擇或拖曳音訊檔案">' +
              '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5"/><path d="M12 3v12"/></svg>' +
              '<p><strong>拖曳音訊檔到這裡</strong>，或點擊選擇</p>' +
              '<p class="hint">支援 MP3 / WAV / M4A / OGG，建議 8 分鐘以內</p>' +
            '</div>' +
            '<input type="file" id="stFileInput" accept="audio/*,.mp3,.wav,.m4a,.ogg,.flac" hidden>' +
          '</div>' +
          '<div class="src-pane" id="stYt" hidden>' +
            '<label class="field-label">YouTube 網址</label>' +
            '<input type="url" id="stYtUrl" class="text-input" placeholder="https://www.youtube.com/watch?v=..." spellcheck="false">' +
            '<p class="hint">與和弦分析共用 cobalt 服務設定。下載後只在本機分析。</p>' +
            '<button class="btn btn-primary btn-block" id="stYtGo" style="margin-top:10px">從 YouTube 匯入</button>' +
          '</div>' +
          '<div class="src-pane" id="stDemo" hidden>' +
            '<p class="hint" style="font-size:.9rem">內建合成示範：A(8s)–B(8s)–A(8s) 三段結構（C–G / F–D / C–G）。用它快速確認段落偵測，再拿真實歌曲來挑戰。</p>' +
            '<button class="btn btn-primary btn-block" id="stDemoGo" style="margin-top:10px">載入示範並分析</button>' +
          '</div>' +
        '</div>' +

        '<div class="panel">' +
          '<h3 class="panel-title">2 · 分析設定</h3>' +
          '<label class="field-label">novelty 核長度 <span id="stKernelVal">8.0 秒</span></label>' +
          '<input type="range" id="stKernel" min="4" max="14" step="1" value="8">' +
          '<div class="range-label"><span>4s 抓短段</span><span>14s 抓長段</span></div>' +
          '<label class="field-label" style="margin-top:12px">邊界靈敏度 <span id="stThrVal">0.90</span></label>' +
          '<input type="range" id="stThr" min="0.4" max="1.6" step="0.05" value="0.9">' +
          '<div class="range-label"><span>靈敏（邊界多）</span><span>保守（只留明顯的）</span></div>' +
          '<div class="btn-row" style="margin-top:14px">' +
            '<button class="btn btn-primary" id="stRun" disabled>3 · 開始分析</button>' +
            '<button class="btn btn-ghost" id="stReset">清除</button>' +
          '</div>' +
          '<div class="progress-wrap" id="stProgWrap" hidden>' +
            '<div class="progress-bar"><div class="progress-fill" id="stProgFill"></div></div>' +
            '<p class="hint" id="stProgText">準備中…</p>' +
          '</div>' +
        '</div>' +
      '</section>' +

      '<section class="container result-section" id="stResult" hidden>' +
        '<div class="result-head">' +
          '<div>' +
            '<h2 class="section-title" style="margin-bottom:4px">段落結果</h2>' +
            '<p class="hint" id="stMeta"></p>' +
          '</div>' +
          '<div class="btn-row">' +
            '<button class="btn btn-ghost btn-sm" id="stCopy">複製段落表</button>' +
          '</div>' +
        '</div>' +
        '<div class="panel" style="margin-bottom:14px">' +
          '<h3 class="panel-title">結構字母</h3>' +
          '<div class="structure-bar" id="stBar"></div>' +
          '<div class="letter-legend" id="stLegend"></div>' +
        '</div>' +
        '<div class="panel ssm-panel">' +
          '<h3 class="panel-title">自相似矩陣（對角線亮＝重複段落）</h3>' +
          '<div class="ssm-wrap"><canvas id="stSsm"></canvas></div>' +
          '<div class="novelty-wrap"><canvas id="stNovelty"></canvas></div>' +
        '</div>' +
        '<div class="panel">' +
          '<h3 class="panel-title">段落明細</h3>' +
          '<div class="seg-table" id="stSegs"></div>' +
        '</div>' +
        '<p class="hint center">段落偵測基於和聲相似度；前奏/間奏若只有打擊樂可能被併入相鄰段落。可調整核長度與靈敏度交叉比對。</p>' +
      '</section>' +

      '<section class="container lyric-section">' +
        '<div class="panel">' +
          '<h3 class="panel-title">歌詞押韻分析</h3>' +
          '<p class="hint" style="margin-top:0">貼上歌詞（一行一句），自動標出韻腳與韻式（A/B/C…）。中文用十三轍韻基比對，英文用字尾韻基。</p>' +
          '<textarea id="lyText" class="text-area" rows="9" placeholder="貼上歌詞，一行一句"></textarea>' +
          '<div class="btn-row" style="margin-top:12px">' +
            '<button class="btn btn-primary" id="lyRun">分析押韻</button>' +
            '<label class="chk-label"><input type="checkbox" id="lyShowFinal" checked> 顯示韻基</label>' +
          '</div>' +
          '<div id="lyResult" hidden>' +
            '<div class="ly-stats" id="lyStats"></div>' +
            '<div class="ly-lines" id="lyLines"></div>' +
          '</div>' +
        '</div>' +
      '</section>';

    var source = 'file';
    var audioData = null;
    var tabs = el.querySelectorAll('.src-tabs .chip-btn');
    tabs.forEach(function (t) {
      t.addEventListener('click', function () {
        tabs.forEach(function (x) { x.classList.remove('chip-active'); });
        t.classList.add('chip-active');
        source = t.dataset.src;
        document.getElementById('stFile').hidden = source !== 'file';
        document.getElementById('stYt').hidden = source !== 'yt';
        document.getElementById('stDemo').hidden = source !== 'demo';
      });
    });

    function setReady(label) {
      var btn = document.getElementById('stRun');
      btn.disabled = !audioData;
      btn.textContent = audioData ? ('3 · 開始分析（' + label + '）') : '3 · 開始分析';
    }
    function showProgress(text) {
      document.getElementById('stProgWrap').hidden = false;
      document.getElementById('stProgText').textContent = text;
      setBar(0.02);
    }
    function setBar(p) { document.getElementById('stProgFill').style.width = Math.round(p * 100) + '%'; }
    function hideProgress() { document.getElementById('stProgWrap').hidden = true; }

    var drop = document.getElementById('stDrop');
    var fileInput = document.getElementById('stFileInput');
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
      if (f) loadFile(f);
    });
    fileInput.addEventListener('change', function () {
      if (fileInput.files[0]) loadFile(fileInput.files[0]);
    });
    function loadFile(f) {
      showProgress('解碼 ' + f.name + '…');
      AC.decodeFile(f).then(function (buf) {
        audioData = buf;
        hideProgress();
        GL.toast('已載入：' + f.name + '（' + fmtTime(buf.duration) + '）');
        setReady(f.name.length > 18 ? f.name.slice(0, 17) + '…' : f.name);
      }).catch(function (err) { hideProgress(); GL.toast(err.message); });
    }

    document.getElementById('stYtGo').addEventListener('click', function () {
      var url = document.getElementById('stYtUrl').value.trim();
      var m = /(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{11})/.exec(url);
      if (!m) { GL.toast('這看起來不是 YouTube 影片網址'); return; }
      var btn = this;
      btn.disabled = true;
      showProgress('向 cobalt 服務請求音訊軌…');
      fetch(YTS.data.endpoint + '/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ url: url, downloadMode: 'audio', audioFormat: 'mp3', filenameStyle: 'basic' })
      }).then(function (r) { return r.json(); }).then(function (j) {
        if (j.status === 'stream' || j.status === 'redirect' || j.status === 'tunnel') {
          showProgress('下載音訊中…');
          return fetch(j.url).then(function (resp) {
            if (!resp.ok) throw new Error('下載失敗（HTTP ' + resp.status + '）');
            return resp.arrayBuffer();
          }).then(function (ab) { showProgress('解碼音訊…'); return AC.decodeBytes(ab); });
        }
        if (j.status === 'error' && /auth|login/i.test((j.error || {}).code || '')) {
          throw new Error('這部影片需要登入/年齡限制，cobalt 抓不到，請改用上傳檔案');
        }
        throw new Error((j.error && j.error.code) || 'cobalt 無法處理這個網址');
      }).then(function (buf) {
        audioData = buf;
        hideProgress();
        btn.disabled = false;
        setReady('YouTube');
        GL.toast('已從 YouTube 載入音訊（' + fmtTime(buf.duration) + '）');
      }).catch(function (err) {
        hideProgress();
        btn.disabled = false;
        GL.toast('YouTube 匯入失敗：' + err.message + '（可改用上傳檔案）');
      });
    });

    document.getElementById('stDemoGo').addEventListener('click', function () {
      var btn = this;
      btn.disabled = true;
      showProgress('渲染示範音訊…');
      AC.renderDemoABA().then(function (buf) {
        audioData = buf;
        hideProgress();
        btn.disabled = false;
        setReady('示範音訊');
        GL.toast('示範音訊已載入，按「開始分析」');
      }).catch(function () {
        hideProgress();
        btn.disabled = false;
        GL.toast('示範渲染失敗（瀏覽器不支援 OfflineAudioContext）');
      });
    });

    var running = false;
    document.getElementById('stRun').addEventListener('click', function () {
      if (!audioData || running) return;
      running = true;
      runAnalysis(audioData).finally(function () { running = false; });
    });
    document.getElementById('stReset').addEventListener('click', function () {
      audioData = null; result = null;
      document.getElementById('stResult').hidden = true;
      setReady('');
    });

    var kernelInput = document.getElementById('stKernel');
    var thrInput = document.getElementById('stThr');
    kernelInput.value = STS.data.kernelSec;
    thrInput.value = STS.data.threshold;
    document.getElementById('stKernelVal').textContent = (+STS.data.kernelSec).toFixed(1) + ' 秒';
    document.getElementById('stThrVal').textContent = (+STS.data.threshold).toFixed(2);
    kernelInput.addEventListener('input', function () {
      STS.data.kernelSec = +kernelInput.value;
      document.getElementById('stKernelVal').textContent = (+kernelInput.value).toFixed(1) + ' 秒';
      STS.save();
    });
    thrInput.addEventListener('input', function () {
      STS.data.threshold = +thrInput.value;
      document.getElementById('stThrVal').textContent = (+thrInput.value).toFixed(2);
      STS.save();
    });

    function runAnalysis(buffer) {
      try {
        showProgress('計算 chroma…');
        setBar(0.2);
        var mono = AC.toMono(buffer);
        var sr = 22050;
        var down = AC.trimSilence(AC.downsample(mono, buffer.sampleRate, sr));
        var chroma = AC.chromaFrames(down, sr, { frameSize: 4096, hop: 2048 });
        setBar(0.5);
        document.getElementById('stProgText').textContent = '計算自相似矩陣…';
        var ssm = SS.selfSimilarity(chroma.frames);
        setBar(0.75);
        document.getElementById('stProgText').textContent = '偵測段落邊界…';
        var nv = SS.novelty(ssm, chroma.frameDur, { kernelSec: STS.data.kernelSec });
        var pk = SS.peakPick(nv.novelty, chroma.frameDur, { thresholdRatio: STS.data.threshold });
        var segs = SS.labelSections(ssm, pk.peaks, {});
        result = {
          ssm: ssm, novelty: nv, peaks: pk,
          segments: segs.map(function (s) {
            return {
              start: +(s.start * chroma.frameDur).toFixed(2),
              end: +((s.end + 1) * chroma.frameDur).toFixed(2),
              letter: s.letter, sim: s.sim
            };
          }),
          frameDur: chroma.frameDur,
          boundaryFrames: pk.peaks,
          duration: buffer.duration
        };
        setBar(0.95);
        renderResult();
        setBar(1);
        hideProgress();
      } catch (err) {
        hideProgress();
        GL.toast('分析失敗：' + err.message);
      }
      return Promise.resolve();
    }

    function renderResult() {
      var box = document.getElementById('stResult');
      box.hidden = false;
      document.getElementById('stMeta').textContent =
        '全長 ' + fmtTime(result.duration) + ' · ' + result.segments.length + ' 個段落 · 邊界 ' +
        result.boundaryFrames.map(function (f) { return fmtTime(f * result.frameDur); }).join(' / ');

      var letterIndex = {};
      var nextIdx = 0;
      var totalDur = result.duration;
      var barHtml = '';
      result.segments.forEach(function (s) {
        if (!(s.letter in letterIndex)) letterIndex[s.letter] = nextIdx++;
        var pct = ((s.end - s.start) / totalDur * 100).toFixed(2);
        var color = letterColor(letterIndex[s.letter]);
        barHtml += '<div class="bar-seg" style="width:' + pct + '%;background:' + color + '" title="' +
          fmtTime(s.start) + '–' + fmtTime(s.end) + ' 段落 ' + s.letter + '">' +
          (s.end - s.start > totalDur * 0.06 ? '<span>' + s.letter + '</span>' : '') + '</div>';
      });
      document.getElementById('stBar').innerHTML = barHtml;

      var legendHtml = '';
      Object.keys(letterIndex).forEach(function (L) {
        legendHtml += '<span class="legend-item"><i style="background:' + letterColor(letterIndex[L]) + '"></i>' + L + ' 段</span>';
      });
      document.getElementById('stLegend').innerHTML = legendHtml;

      var rows = '<div class="seg-row seg-head"><span>時間</span><span>長度</span><span>字母</span><span>與前段相似</span></div>';
      result.segments.forEach(function (s) {
        var color = letterColor(letterIndex[s.letter]);
        rows += '<div class="seg-row">' +
          '<span class="mono">' + fmtTime(s.start) + ' – ' + fmtTime(s.end) + '</span>' +
          '<span>' + (s.end - s.start).toFixed(1) + 's</span>' +
          '<span><i class="seg-dot" style="background:' + color + '"></i>' + s.letter + '</span>' +
          '<span>' + (s.sim == null ? '—' : s.sim.toFixed(2)) + '</span>' +
          '</div>';
      });
      document.getElementById('stSegs').innerHTML = rows;

      drawSSM();
      drawNovelty();
      document.getElementById('stCopy').onclick = copyText;
      document.getElementById('stResult').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    function drawSSM() {
      var canvas = document.getElementById('stSsm');
      var n = result.ssm.n;
      var m = result.ssm.m;
      var off = document.createElement('canvas');
      var size = Math.min(n, 512);
      off.width = size; off.height = size;
      var octx = off.getContext('2d');
      var img = octx.createImageData(size, size);
      var step = n / size;
      var isDark = document.documentElement.getAttribute('data-theme') !== 'light';
      for (var y = 0; y < size; y++) {
        for (var x = 0; x < size; x++) {
          var fi = Math.floor(y * step), fj = Math.floor(x * step);
          var v = m[fi * n + fj];
          var r, g, b;
          if (isDark) {
            r = Math.round(20 + 220 * v);
            g = Math.round(16 + 150 * v);
            b = Math.round(20 + 40 * v);
          } else {
            r = Math.round(255 - 120 * (1 - v));
            g = Math.round(245 - 130 * (1 - v));
            b = Math.round(235 - 190 * (1 - v));
          }
          var idx = (y * size + x) * 4;
          img.data[idx] = r; img.data[idx + 1] = g; img.data[idx + 2] = b; img.data[idx + 3] = 255;
        }
      }
      octx.putImageData(img, 0, 0);

      var wrap = canvas.parentElement;
      var dpr = window.devicePixelRatio || 1;
      var dispW = wrap.clientWidth || 600;
      var dispH = Math.round(dispW * 0.72);
      canvas.width = dispW * dpr;
      canvas.height = dispH * dpr;
      canvas.style.width = dispW + 'px';
      canvas.style.height = dispH + 'px';
      var ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(off, 0, 0, canvas.width, canvas.height);

      var scaleX = canvas.width / n;
      result.boundaryFrames.forEach(function (f) {
        ctx.strokeStyle = 'rgba(125,211,252,.8)';
        ctx.lineWidth = Math.max(1, dpr);
        ctx.beginPath();
        ctx.moveTo(f * scaleX, 0);
        ctx.lineTo(f * scaleX, canvas.height);
        ctx.moveTo(0, f * scaleX);
        ctx.lineTo(canvas.width, f * scaleX);
        ctx.stroke();
      });
      ctx.font = Math.round(13 * dpr) + 'px sans-serif';
      ctx.textBaseline = 'middle';
      var li2 = {}; var ni2 = 0;
      result.segments.forEach(function (s) {
        if (!(s.letter in li2)) li2[s.letter] = ni2++;
        var startF = s.start / result.frameDur;
        var endF = s.end / result.frameDur;
        var mid = (startF + endF) / 2;
        ctx.fillStyle = letterColor(li2[s.letter]);
        ctx.shadowColor = 'rgba(0,0,0,.6)';
        ctx.shadowBlur = 4 * dpr;
        ctx.fillText(s.letter, mid * scaleX - 4 * dpr, 14 * dpr);
        ctx.shadowBlur = 0;
      });
    }

    function drawNovelty() {
      var canvas = document.getElementById('stNovelty');
      var nov = result.novelty.novelty;
      var n = nov.length;
      var dpr = window.devicePixelRatio || 1;
      var wrap = canvas.parentElement;
      var dispW = wrap.clientWidth || 600;
      var dispH = 80;
      canvas.width = dispW * dpr;
      canvas.height = dispH * dpr;
      canvas.style.width = dispW + 'px';
      canvas.style.height = dispH + 'px';
      var ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      var max = 0;
      for (var i = 0; i < n; i++) if (nov[i] > max) max = nov[i];
      if (max <= 0) max = 1;
      var scaleY = (canvas.height - 8 * dpr) / max;

      var scaleX = canvas.width / n;
      result.boundaryFrames.forEach(function (f) {
        ctx.strokeStyle = 'rgba(125,211,252,.35)';
        ctx.lineWidth = dpr;
        ctx.beginPath();
        ctx.moveTo(f * scaleX, 0);
        ctx.lineTo(f * scaleX, canvas.height);
        ctx.stroke();
      });

      ctx.strokeStyle = '#f0a848';
      ctx.lineWidth = 1.5 * dpr;
      ctx.beginPath();
      for (var j = 0; j < n; j++) {
        var x = j * scaleX;
        var y = canvas.height - nov[j] * scaleY - 4 * dpr;
        if (j === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();

      var thrY = canvas.height - result.peaks.threshold / max * scaleY - 4 * dpr;
      ctx.strokeStyle = 'rgba(248,113,113,.6)';
      ctx.setLineDash([4 * dpr, 4 * dpr]);
      ctx.beginPath();
      ctx.moveTo(0, thrY);
      ctx.lineTo(canvas.width, thrY);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    function copyText() {
      var lines = ['吉他實驗室 — 段落分析結果'];
      result.segments.forEach(function (s) {
        lines.push(fmtTime(s.start) + ' – ' + fmtTime(s.end) + '\t' + s.letter + '\t(' + (s.end - s.start).toFixed(1) + 's)');
      });
      navigator.clipboard.writeText(lines.join('\n')).then(
        function () { GL.toast('已複製到剪貼簿'); },
        function () { GL.toast('複製失敗'); });
    }

    document.getElementById('lyRun').addEventListener('click', function () {
      var text = document.getElementById('lyText').value;
      if (!text.trim()) { GL.toast('請先貼上歌詞'); return; }
      R.initIndex();
      var infos = R.analyzeLines(text, 'auto');
      var scheme = R.assignScheme(infos);
      var stats = R.stats(infos, scheme.letters);
      renderLyrics(infos, scheme, stats);
    });

    function renderLyrics(infos, scheme, stats) {
      var showFinal = document.getElementById('lyShowFinal').checked;
      document.getElementById('lyResult').hidden = false;

      var zheHtml = stats.zheTop.map(function (z) {
        return '<span class="chip chip-sm">' + z.zhe + ' ×' + z.count + '</span>';
      }).join('');
      document.getElementById('lyStats').innerHTML =
        '<span class="key-badge">韻式 ' + (scheme.letters.filter(Boolean).join('') || '—') + '</span>' +
        '<span class="stat-item">押韻密度 <strong>' + Math.round(stats.density * 100) + '%</strong></span>' +
        '<span class="stat-item">有韻腳 <strong>' + stats.lines + '</strong> 行</span>' +
        (stats.noData ? '<span class="stat-item muted">' + stats.noData + ' 行查無讀音</span>' : '') +
        (zheHtml ? '<span class="stat-item">常用韻轍：' + zheHtml + '</span>' : '');

      var letterColorMap = {};
      var ni = 0;
      var html = '';
      infos.forEach(function (info, i) {
        if (info.empty) { html += '<div class="ly-line empty">&nbsp;</div>'; return; }
        var L = scheme.letters[i];
        var color = null;
        if (L) {
          if (!(L in letterColorMap)) letterColorMap[L] = LETTER_COLORS[ni++ % LETTER_COLORS.length];
          color = letterColorMap[L];
        }
        var badge = L ? '<span class="ly-letter" style="border-color:' + color + ';color:' + color + '">' + L + '</span>' : '<span class="ly-letter none">·</span>';
        var tailInfo = '';
        if (showFinal && info.lang === 'zh' && info.final) {
          tailInfo = '<span class="ly-final">' + info.tail + '（' + info.final + (info.zhe ? '・' + info.zhe : '') + '）</span>';
        } else if (showFinal && info.lang === 'en' && info.rime) {
          tailInfo = '<span class="ly-final">' + info.tail + '（-' + info.rime + '）</span>';
        } else if (info.tail) {
          tailInfo = '<span class="ly-final">尾字：' + info.tail + '</span>';
        }
        var lineStyle = color ? ' style="border-left:3px solid ' + color + '"' : '';
        html += '<div class="ly-line"' + lineStyle + '>' + badge +
          '<span class="ly-text">' + escapeHtml(info.line) + '</span>' + tailInfo + '</div>';
      });
      document.getElementById('lyLines').innerHTML = html;
    }

    function escapeHtml(s) {
      return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    document.getElementById('themeToggle').addEventListener('click', function () {
      if (result) setTimeout(function () { drawSSM(); drawNovelty(); }, 50);
    });

    GL.onCleanup(function () { result = null; });
  }

  window.GL.register('structure', { navName: '段落與歌詞', render: render });
})();
