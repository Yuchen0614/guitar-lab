/* 吉他實驗室 — 和弦分析（M3）
   來源：檔案上傳 / YouTube（cobalt 相容 API）/ 示範音訊
   流程：解碼 → 降取樣 → chroma → 演算法（樣板 / Viterbi）→ 時間軸 */
(function () {
  'use strict';

  var AC = window.GLaudio, M = window.GLmusic, SY = window.GLsynth, YT = window.GLyoutube;
  var result = null; // { segs, key, duration, algo }
  var YTS = YT.settings;

  function fmtTime(s) {
    var m = Math.floor(s / 60), ss = Math.floor(s % 60);
    return m + ':' + (ss < 10 ? '0' : '') + ss;
  }

  function render(el) {
    el.innerHTML =
      '<section class="module-hero"><div class="container">' +
        '<p class="kicker">Chord Analysis</p>' +
        '<h1>和弦分析</h1>' +
        '<p class="lede">丟進一首歌，聽出它的和弦骨架。所有計算都在這個分頁完成——音檔不上傳、不保存。</p>' +
      '</div></section>' +

      '<section class="container analyzer-grid">' +
        '<div class="panel">' +
          '<h3 class="panel-title">1 · 選擇音訊來源</h3>' +
          '<div class="src-tabs" role="tablist">' +
            '<button class="chip chip-btn chip-active" data-src="file" role="tab">📁 上傳檔案</button>' +
            '<button class="chip chip-btn" data-src="yt" role="tab">▶ YouTube 連結</button>' +
            '<button class="chip chip-btn" data-src="demo" role="tab">🎵 示範音訊</button>' +
          '</div>' +

          '<div class="src-pane" id="srcFile">' +
            '<div class="dropzone" id="azDrop" tabindex="0" role="button" aria-label="選擇或拖曳音訊檔案">' +
              '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5"/><path d="M12 3v12"/></svg>' +
              '<p><strong>拖曳音訊檔到這裡</strong>，或點擊選擇</p>' +
              '<p class="hint">支援 MP3 / WAV / M4A / OGG，建議 8 分鐘以內</p>' +
            '</div>' +
            '<input type="file" id="azFile" accept="audio/*,.mp3,.wav,.m4a,.ogg,.flac" hidden>' +
          '</div>' +

          '<div class="src-pane" id="srcYt" hidden>' +
            '<label class="field-label">YouTube 網址</label>' +
            '<input type="url" id="azYtUrl" class="text-input" placeholder="https://www.youtube.com/watch?v=..." spellcheck="false">' +
            '<p class="hint">透過 cobalt 相服務抓音訊軌，下載後只在本機分析。<strong>2026 年起公共實例全面要求認證</strong>——需在下方填入 Api-Key，或改用上傳檔案。</p>' +
            '<details class="adv-box"><summary>進階：實例位址與 Api-Key</summary>' +
              '<label class="field-label" style="margin-top:8px">cobalt 實例位址（自架或服務提供者）</label>' +
              '<input type="url" id="azYtEndpoint" class="text-input" placeholder="https://your-cobalt-instance.example">' +
              '<label class="field-label" style="margin-top:8px">Api-Key</label>' +
              '<input type="password" id="azYtKey" class="text-input" placeholder="aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee" autocomplete="off">' +
              '<p class="hint">自架：<code>docker run -p 28818:28818 ghcr.io/imputnet/cobalt:11</code>（API 設定檔允許你的 github.io 來源）；或向公共實例主申請 Api-Key。key 只存在你的瀏覽器 localStorage。</p>' +
            '</details>' +
            '<button class="btn btn-primary btn-block" id="azYtGo" style="margin-top:10px">從 YouTube 匯入</button>' +
            '<div class="yt-help" id="azYtHelp" hidden></div>' +
          '</div>' +

          '<div class="src-pane" id="srcDemo" hidden>' +
            '<p class="hint" style="font-size:.9rem">內建一段合成示範：C–G–Am–F（1645 進行，每和弦一小節）。用它快速確認引擎運作，再拿真實歌曲來挑戰。</p>' +
            '<button class="btn btn-primary btn-block" id="azDemoGo" style="margin-top:10px">播放示範並分析</button>' +
          '</div>' +
        '</div>' +

        '<div class="panel">' +
          '<h3 class="panel-title">2 · 分析設定</h3>' +
          '<div class="select-row">' +
            '<label>辨識演算法<select id="azAlgo">' +
              '<option value="template">樣板比對（快、逐幀）</option>' +
              '<option value="viterbi" selected>Viterbi 平滑（穩、整體最佳）</option>' +
            '</select></label>' +
            '<label>和弦集合<select id="azSet">' +
              '<option value="basic" selected>大 + 小（24 個）</option>' +
              '<option value="ext">加七和弦（72 個）</option>' +
            '</select></label>' +
          '</div>' +
          '<label class="field-label" style="margin-top:14px">Viterbi 連續性強度 <span id="azBiasVal">0.60</span></label>' +
          '<input type="range" id="azBias" min="0.3" max="0.9" step="0.01" value="0.60">' +
          '<div class="range-label"><span>0.6 換得多</span><span>0.95 黏得緊</span></div>' +
          '<div class="btn-row" style="margin-top:14px">' +
            '<button class="btn btn-primary" id="azRun" disabled>3 · 開始分析</button>' +
            '<button class="btn btn-ghost" id="azReset">清除</button>' +
          '</div>' +
          '<div class="progress-wrap" id="azProgWrap" hidden>' +
            '<div class="progress-bar"><div class="progress-fill" id="azProgFill"></div></div>' +
            '<p class="hint" id="azProgText">準備中…</p>' +
          '</div>' +
        '</div>' +
      '</section>' +

      '<section class="container result-section" id="azResult" hidden>' +
        '<div class="result-head">' +
          '<div>' +
            '<h2 class="section-title" style="margin-bottom:4px">分析結果</h2>' +
            '<p class="hint" id="azMeta"></p>' +
          '</div>' +
          '<div class="btn-row">' +
            '<button class="btn btn-ghost btn-sm" id="azCopy">複製文字譜</button>' +
            '<button class="btn btn-ghost btn-sm" id="azCsv">下載 CSV</button>' +
          '</div>' +
        '</div>' +
        '<div class="panel"><div class="key-line" id="azKey"></div></div>' +
        '<div class="chord-timeline panel" id="azTimeline"></div>' +
        '<p class="hint center">辨識結果是「聽感推測」——複雜編曲（轉調、強力失真、大量打擊）誤差會變大，歡迎用不同演算法與參數交叉比對。</p>' +
      '</section>';

    /* ================= 來源切換 ================= */
    var source = 'file';
    var audioData = null; // AudioBuffer
    var tabs = el.querySelectorAll('.src-tabs .chip-btn');
    tabs.forEach(function (t) {
      t.addEventListener('click', function () {
        tabs.forEach(function (x) { x.classList.remove('chip-active'); });
        t.classList.add('chip-active');
        source = t.dataset.src;
        document.getElementById('srcFile').hidden = source !== 'file';
        document.getElementById('srcYt').hidden = source !== 'yt';
        document.getElementById('srcDemo').hidden = source !== 'demo';
      });
    });

    /* ================= 檔案上傳 ================= */
    var drop = document.getElementById('azDrop');
    var fileInput = document.getElementById('azFile');
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

    function setReady(label) {
      var btn = document.getElementById('azRun');
      btn.disabled = !audioData;
      btn.textContent = audioData ? ('3 · 開始分析（' + label + '）') : '3 · 開始分析';
    }
    function loadFile(f) {
      showProgress('解碼 ' + f.name + '…');
      AC.decodeFile(f).then(function (buf) {
        audioData = buf;
        hideProgress();
        GL.toast('已載入：' + f.name + '（' + fmtTime(buf.duration) + '）');
        setReady(f.name.length > 18 ? f.name.slice(0, 17) + '…' : f.name);
      }).catch(function (err) {
        hideProgress();
        GL.toast(err.message);
      });
    }

    /* ================= YouTube 匯入 ================= */
    var ytEndpoint = document.getElementById('azYtEndpoint');
    var ytKey = document.getElementById('azYtKey');
    ytEndpoint.value = YTS.data.endpoint || '';
    ytKey.value = YTS.data.apiKey || '';
    ytEndpoint.addEventListener('change', function () {
      YTS.data.endpoint = ytEndpoint.value.trim();
      YTS.save();
    });
    ytKey.addEventListener('change', function () {
      YTS.data.apiKey = ytKey.value.trim();
      YTS.save();
      GL.toast(ytKey.value ? 'Api-Key 已儲存（僅存本機）' : 'Api-Key 已清除');
    });

    function ytId(url) {
      var m = /(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{11})/.exec(url);
      return m ? m[1] : null;
    }
    document.getElementById('azYtGo').addEventListener('click', function () {
      var url = document.getElementById('azYtUrl').value.trim();
      var id = ytId(url);
      if (!id) { GL.toast('這看起來不是 YouTube 影片網址'); return; }
      importYouTube(url);
    });

    function importYouTube(url) {
      var btn = document.getElementById('azYtGo');
      btn.disabled = true;
      showProgress('向 cobalt 實例請求音訊軌…');
      YT.getTunnel(url, showProgress).then(function (r) {
        if (!r.ok) {
          hideProgress();
          btn.disabled = false;
          var box = document.getElementById('azYtHelp');
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
        return YT.downloadAudio(r.url, showProgress).then(function (ab) {
          showProgress('解碼音訊…');
          return AC.decodeBytes(ab);
        }).then(function (buf) {
          audioData = buf;
          hideProgress();
          btn.disabled = false;
          GL.toast('已從 YouTube 載入音訊（' + fmtTime(buf.duration) + '）');
          setReady('YouTube');
        });
      }).catch(function (err) {
        hideProgress();
        btn.disabled = false;
        GL.toast('YouTube 匯入失敗：' + err.message + '（可改用上傳檔案）');
      });
    }

    /* ================= 示範音訊 ================= */
    document.getElementById('azDemoGo').addEventListener('click', function () {
      var btn = this;
      btn.disabled = true;
      showProgress('渲染示範音訊…');
      AC.renderDemo().then(function (buf) {
        // 也撥放一次讓使用者聽到
        var c = SY.ctx();
        var src = c.createBufferSource();
        src.buffer = buf;
        src.connect(c.destination);
        src.start();
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

    /* ================= 分析流程 ================= */
    var running = false;
    document.getElementById('azRun').addEventListener('click', function () {
      if (!audioData || running) return;
      running = true;
      var algo = document.getElementById('azAlgo').value;
      var ext = document.getElementById('azSet').value === 'ext';
      var bias = parseFloat(document.getElementById('azBias').value);
      runAnalysis(audioData, algo, ext, bias).finally(function () { running = false; });
    });
    document.getElementById('azReset').addEventListener('click', function () {
      audioData = null; result = null;
      document.getElementById('azResult').hidden = true;
      setReady('');
    });

    function showProgress(text) {
      document.getElementById('azProgWrap').hidden = false;
      document.getElementById('azProgText').textContent = text;
      setBar(0.02);
    }
    function setBar(p) {
      document.getElementById('azProgFill').style.width = Math.round(p * 100) + '%';
    }
    function hideProgress() {
      document.getElementById('azProgWrap').hidden = true;
    }

    function runAnalysis(buffer, algo, ext, bias) {
      /* 同步計算：DSP 全程 <200ms，不需要非同步切割
        （部分自動化環境會凍結 setTimeout，同步路徑最可靠） */
      try {
        showProgress('計算中…');
        setBar(0.2);
        var mono = AC.toMono(buffer);
        var sr = 22050;
        var down = AC.trimSilence(AC.downsample(mono, buffer.sampleRate, sr));
        var chroma = AC.chromaFrames(down, sr, { frameSize: 4096, hop: 2048 });
        setBar(0.55);
        document.getElementById('azProgText').textContent = '和弦辨識…';
        var templates = AC.templates24(ext);
        var probs = AC.templateScores(chroma.frames, templates);
        var raw = algo === 'viterbi' ? AC.viterbi(probs, templates, bias) : AC.argmaxPath(probs, templates);
        var path = AC.modeFilter(raw, templates, 2);
        var segs = AC.segments(path, templates, chroma.frameDur);
        setBar(0.9);
        var key = AC.estimateKey(chroma.frames);
        result = {
          segs: segs, key: key,
          duration: buffer.duration,
          algo: algo === 'viterbi' ? 'Viterbi 平滑' : '樣板比對',
          frames: chroma.frames.length
        };
        renderResult();
        setBar(1);
        hideProgress();
      } catch (err) {
        hideProgress();
        GL.toast('分析失敗：' + err.message);
      }
      return Promise.resolve();
    }

    /* ================= 結果渲染 ================= */
    function renderResult() {
      var box = document.getElementById('azResult');
      box.hidden = false;
      document.getElementById('azMeta').textContent =
        result.algo + ' · ' + result.frames + ' 幀 · 全長 ' + fmtTime(result.duration) + ' · 共 ' + result.segs.length + ' 個和弦段落';
      document.getElementById('azKey').innerHTML =
        '<span class="key-badge">🎵 估計調性：' + result.key.name + '</span>' +
        '<span class="hint">（相關係數 ' + result.key.corr.toFixed(2) + '，僅供參考）</span>';

      var tl = document.getElementById('azTimeline');
      tl.innerHTML = '';
      result.segs.forEach(function (s) {
        var cell = document.createElement('button');
        cell.className = 'seg-cell';
        cell.innerHTML = '<span class="seg-time">' + fmtTime(s.start) + '</span><strong class="seg-name">' + s.name + '</strong>';
        cell.title = s.start + 's – ' + s.end + 's（' + (s.end - s.start).toFixed(1) + ' 秒）· 點擊試聽';
        cell.addEventListener('click', function () {
          var v = M.getVoicing(s.root, s.typeId);
          var midis = v ? M.voicingToMidis(v)
            : [48 + s.root, 48 + ((s.root + 4) % 12), 48 + ((s.root + 7) % 12)];
          SY.playMidis(midis);
        });
        tl.appendChild(cell);
      });
      document.getElementById('azCopy').onclick = copyText;
      document.getElementById('azCsv').onclick = downloadCsv;
      box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    function chordText() {
      var lines = ['吉他實驗室 — 和弦分析結果', '調性估計：' + result.key.name, '演算法：' + result.algo, ''];
      result.segs.forEach(function (s) {
        lines.push(fmtTime(s.start) + '\t' + s.name);
      });
      return lines.join('\n');
    }
    function copyText() {
      navigator.clipboard.writeText(chordText()).then(function () { GL.toast('已複製到剪貼簿'); },
        function () { GL.toast('複製失敗，請改用 CSV'); });
    }
    function downloadCsv() {
      var rows = ['start_sec,end_sec,chord'];
      result.segs.forEach(function (s) { rows.push(s.start + ',' + s.end + ',' + s.name); });
      var blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'chords.csv';
      document.body.appendChild(a); a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 400);
    }

    /* 主題切換不需重繪（結果純文字/色塊） */
    GL.onCleanup(function () { result = null; });
  }

  window.GL.register('analyze', { navName: '和弦分析', render: render });
})();
