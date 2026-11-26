/* 吉他實驗室 — 節奏・音感（M2）
   節拍器（lookahead 排程）、音程聽辨、和弦品質聽辨、和弦反應測驗 */
(function () {
  'use strict';

  var M = window.GLmusic, SY = window.GLsynth;
  var stats = GL.store.bind('practice_stats', { intervals: { ok: 0, total: 0 }, chords: { ok: 0, total: 0 }, react: { ok: 0, total: 0 } });

  function render(el) {
    el.innerHTML =
      '<section class="module-hero"><div class="container">' +
        '<p class="kicker">Rhythm &amp; Ear Training</p>' +
        '<h1>節奏・音感</h1>' +
        '<p class="lede">每天十分鐘：節拍器穩住節奏，音程與和弦聽辨練耳朵，成績都記在你的瀏覽器裡。</p>' +
      '</div></section>' +

      '<section class="container practice-grid">' +

        /* ---------- 節拍器 ---------- */
        '<div class="panel">' +
          '<h3 class="panel-title">節拍器</h3>' +
          '<div class="metro-display">' +
            '<div class="metro-bpm"><span id="pmBpmVal">90</span><small> BPM</small></div>' +
            '<div class="metro-lamps" id="pmLamps"></div>' +
          '</div>' +
          '<input type="range" id="pmBpm" min="40" max="220" value="90" aria-label="拍速">' +
          '<div class="range-label"><span>40 慢</span><span>220 快</span></div>' +
          '<div class="select-row" style="margin-top:12px">' +
            '<label>拍號<select id="pmBeats"><option value="2">2/4</option><option value="3">3/4</option><option value="4" selected>4/4</option><option value="6">6/8</option></select></label>' +
            '<label>&nbsp;<button class="btn btn-primary btn-block" id="pmStart" style="margin-top:0">▶ 開始</button></label>' +
          '</div>' +
        '</div>' +

        /* ---------- 音程聽辨 ---------- */
        '<div class="panel">' +
          '<h3 class="panel-title">音程聽辨</h3>' +
          '<p class="quiz-q" id="piQ">按下「播放」聽兩個音，猜音程</p>' +
          '<div class="quiz-answers" id="piAnswers"></div>' +
          '<div class="quiz-feedback" id="piFb"></div>' +
          '<div class="btn-row">' +
            '<button class="btn btn-primary" id="piPlay">▶ 播放題目</button>' +
            '<button class="btn btn-ghost" id="piNext">下一題</button>' +
          '</div>' +
          '<div class="quiz-stats">答對 <strong id="piOk">0</strong> / <span id="piTotal">0</span></div>' +
        '</div>' +

        /* ---------- 和弦聽辨 ---------- */
        '<div class="panel">' +
          '<h3 class="panel-title">和弦品質聽辨</h3>' +
          '<p class="quiz-q" id="pcQ">聽和弦，猜品質</p>' +
          '<div class="quiz-answers" id="pcAnswers"></div>' +
          '<div class="quiz-feedback" id="pcFb"></div>' +
          '<div class="btn-row">' +
            '<button class="btn btn-primary" id="pcPlay">▶ 播放和弦</button>' +
            '<button class="btn btn-ghost" id="pcNext">下一題</button>' +
          '</div>' +
          '<div class="quiz-stats">答對 <strong id="pcOk">0</strong> / <span id="pcTotal">0</span></div>' +
        '</div>' +

        /* ---------- 和弦反應 ---------- */
        '<div class="panel">' +
          '<h3 class="panel-title">和弦反應（看圖搶答）</h3>' +
          '<p class="quiz-q" id="prQ">和弦圖出現後，盡快選出名字</p>' +
          '<div class="editor-stage" id="prImg" style="min-height:150px"></div>' +
          '<div class="quiz-answers" id="prAnswers" style="grid-template-columns:repeat(4,1fr)"></div>' +
          '<div class="quiz-feedback" id="prFb"></div>' +
          '<div class="quiz-stats">答對 <strong id="prOk">0</strong> / <span id="prTotal">0</span>　平均 <strong id="prAvg">–</strong> 秒</div>' +
        '</div>' +

      '</section>';

    /* ================= 節拍器 ================= */
    var bpm = 90, beats = 4, running = false, cur = 0, timer = null, nextTime = 0;
    var lamps = document.getElementById('pmLamps');
    function drawLamps() {
      lamps.innerHTML = '';
      for (var i = 0; i < beats; i++) {
        var d = document.createElement('div'); d.className = 'metro-lamp'; lamps.appendChild(d);
      }
    }
    drawLamps();

    function tick() {
      var c = SY.ctx();
      var spb = 60 / bpm;
      while (nextTime < c.currentTime + 0.12) {
        var isDown = cur === 0;
        var tt = Math.max(nextTime, c.currentTime + 0.001);
        // 排程聲音
        scheduleClick(tt, isDown);
        // 排程燈號（用 setTimeout 近似）
        var delay = (tt - c.currentTime) * 1000;
        (function (idx, down, dl) {
          setTimeout(function () {
            if (!running) return;
            var ls = lamps.children;
            for (var i = 0; i < ls.length; i++) ls[i].classList.toggle('on', i === idx && down);
            if (idx === 0 && !down) { /* 6/8 弱拍 */ }
          }, dl);
        })(cur, isDown, delay);
        nextTime += (beats === 6 ? spb / 2 : spb);
        cur = (cur + 1) % (beats === 6 ? beats * 2 : beats);
      }
      timer = setTimeout(tick, 40);
    }
    function scheduleClick(t, accent) {
      var c = SY.ctx();
      var o = c.createOscillator(), g = c.createGain();
      o.type = 'square';
      o.frequency.value = accent ? 1600 : 1050;
      g.gain.setValueAtTime(accent ? 0.22 : 0.12, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
      o.connect(g); g.connect(c.destination);
      o.start(t); o.stop(t + 0.07);
    }
    document.getElementById('pmStart').addEventListener('click', function () {
      running = !running;
      this.textContent = running ? '■ 停止' : '▶ 開始';
      if (running) {
        SY.ctx();
        cur = 0; nextTime = SY.ctx().currentTime + 0.08;
        tick();
      } else {
        clearTimeout(timer);
        var ls = lamps.children;
        for (var i = 0; i < ls.length; i++) ls[i].classList.remove('on');
      }
    });
    document.getElementById('pmBpm').addEventListener('input', function () {
      bpm = +this.value;
      document.getElementById('pmBpmVal').textContent = bpm;
    });
    document.getElementById('pmBeats').addEventListener('change', function () {
      beats = +this.value;
      drawLamps();
      cur = 0;
    });

    /* ================= 音程聽辨 ================= */
    var INTERVALS = [
      [1, '小二度'], [2, '大二度'], [3, '小三度'], [4, '大三度'], [5, '完全四度'],
      [7, '完全五度'], [8, '小六度'], [9, '大六度'], [12, '八度']
    ];
    var piAnswer = null, piPlaying = false;
    var piOk = 0, piTotal = 0;
    var piStats = stats.data.intervals || { ok: 0, total: 0 };
    function piRefreshStats() {
      document.getElementById('piOk').textContent = piStats.ok;
      document.getElementById('piTotal').textContent = piStats.total;
    }
    piRefreshStats();
    function piNew() {
      var iv = INTERVALS[Math.floor(Math.random() * INTERVALS.length)];
      var base = 48 + Math.floor(Math.random() * 12); // C3..B3
      piAnswer = { semis: iv[0], label: iv[1], base: base };
      document.getElementById('piQ').textContent = '聽兩個音，猜音程';
      document.getElementById('piFb').textContent = '';
      var opts = [iv[1]];
      while (opts.length < 4) {
        var cand = INTERVALS[Math.floor(Math.random() * INTERVALS.length)][1];
        if (opts.indexOf(cand) < 0) opts.push(cand);
      }
      opts.sort(function () { return Math.random() - 0.5; });
      var host = document.getElementById('piAnswers');
      host.innerHTML = '';
      opts.forEach(function (o) {
        var b = document.createElement('button');
        b.className = 'btn btn-ghost'; b.textContent = o;
        b.addEventListener('click', function () { piJudge(o, b); });
        host.appendChild(b);
      });
    }
    function piPlay() {
      if (!piAnswer) piNew();
      var c = SY.ctx(), t = c.currentTime + 0.05;
      SY.pluck(M.midiToFreq(piAnswer.base), t, 0.5);
      SY.pluck(M.midiToFreq(piAnswer.base + piAnswer.semis), t + 0.75, 0.5);
    }
    function piJudge(choice, btn) {
      if (!piAnswer) return;
      var fb = document.getElementById('piFb');
      piStats.total++;
      if (choice === piAnswer.label) {
        piStats.ok++;
        fb.textContent = '✓ 對！' + piAnswer.label;
        fb.className = 'quiz-feedback good';
        SY.blip(true);
      } else {
        fb.textContent = '✗ 是 ' + piAnswer.label;
        fb.className = 'quiz-feedback bad';
        SY.blip(false);
      }
      stats.data.intervals = piStats; stats.save();
      piRefreshStats();
      piAnswer = null;
    }
    document.getElementById('piPlay').addEventListener('click', piPlay);
    document.getElementById('piNext').addEventListener('click', piNew);
    piNew();

    /* ================= 和弦聽辨 ================= */
    var CHORD_QUALITIES = [
      ['maj', '大三和弦'], ['min', '小三和弦'], ['7', '屬七和弦'], ['maj7', '大七和弦'], ['m7', '小七和弦']
    ];
    var pcAnswer = null;
    var pcStats = stats.data.chords || { ok: 0, total: 0 };
    function pcRefresh() {
      document.getElementById('pcOk').textContent = pcStats.ok;
      document.getElementById('pcTotal').textContent = pcStats.total;
    }
    pcRefresh();
    function pcNew() {
      var q = CHORD_QUALITIES[Math.floor(Math.random() * CHORD_QUALITIES.length)];
      var rootPc = Math.floor(Math.random() * 12);
      var ct = null;
      for (var i = 0; i < M.CHORD_TYPES.length; i++) if (M.CHORD_TYPES[i].id === q[0]) { ct = M.CHORD_TYPES[i]; break; }
      pcAnswer = { root: rootPc, iv: ct.iv, label: q[1] };
      document.getElementById('pcFb').textContent = '';
      var opts = [q[1]];
      while (opts.length < 4) {
        var cand = CHORD_QUALITIES[Math.floor(Math.random() * CHORD_QUALITIES.length)][1];
        if (opts.indexOf(cand) < 0) opts.push(cand);
      }
      opts.sort(function () { return Math.random() - 0.5; });
      var host = document.getElementById('pcAnswers');
      host.innerHTML = '';
      opts.forEach(function (o) {
        var b = document.createElement('button');
        b.className = 'btn btn-ghost'; b.textContent = o;
        b.addEventListener('click', function () { pcJudge(o); });
        host.appendChild(b);
      });
    }
    function pcPlay() {
      if (!pcAnswer) pcNew();
      var midis = pcAnswer.iv.map(function (iv) { return 48 + pcAnswer.root + iv; });
      SY.arp(midis, 0.14);
    }
    function pcJudge(choice) {
      if (!pcAnswer) return;
      var fb = document.getElementById('pcFb');
      pcStats.total++;
      if (choice === pcAnswer.label) { pcStats.ok++; fb.textContent = '✓ 對！'; fb.className = 'quiz-feedback good'; SY.blip(true); }
      else { fb.textContent = '✗ 是 ' + pcAnswer.label; fb.className = 'quiz-feedback bad'; SY.blip(false); }
      stats.data.chords = pcStats; stats.save();
      pcRefresh();
      pcAnswer = null;
    }
    document.getElementById('pcPlay').addEventListener('click', pcPlay);
    document.getElementById('pcNext').addEventListener('click', pcNew);
    pcNew();

    /* ================= 和弦反應 ================= */
    var REACT_SET = [
      { name: 'C', frets: [null, 3, 2, 0, 1, 0] },
      { name: 'G', frets: [3, 2, 0, 0, 0, 3] },
      { name: 'D', frets: [null, null, 0, 2, 3, 2] },
      { name: 'Em', frets: [0, 2, 2, 0, 0, 0] },
      { name: 'Am', frets: [null, 0, 2, 2, 1, 0] },
      { name: 'F', frets: [1, 3, 3, 2, 1, 1] },
      { name: 'E', frets: [0, 2, 2, 1, 0, 0] },
      { name: 'A7', frets: [null, 0, 2, 0, 2, 0] },
      { name: 'Dm', frets: [null, null, 0, 2, 3, 1] },
      { name: 'Bm', frets: [null, 2, 4, 4, 3, 2] }
    ];
    var prAnswer = null, prShownAt = 0;
    var prStats = stats.data.react || { ok: 0, total: 0, ms: 0 };
    function prRefresh() {
      document.getElementById('prOk').textContent = prStats.ok;
      document.getElementById('prTotal').textContent = prStats.total;
      document.getElementById('prAvg').textContent = prStats.total ? (prStats.ms / prStats.total / 1000).toFixed(1) : '–';
    }
    prRefresh();
    function prNew() {
      prAnswer = REACT_SET[Math.floor(Math.random() * REACT_SET.length)];
      var host = document.getElementById('prImg');
      host.innerHTML = '';
      window.GLchordbox.render(host, { name: '?', frets: prAnswer.frets, fingers: null },
        { width: 150, height: 170, showFingers: false, theme: (document.documentElement.getAttribute('data-theme') !== 'light' ? undefined : {
          bg: 'transparent', line: '#b7ad9d', fret: '#c9c2b4', nut: '#4a463d',
          dot: '#c47b17', dotText: '#fff', text: '#24211b', muted: '#6d675c', accent: '#c47b17'
        }) });
      prShownAt = performance.now();
      document.getElementById('prFb').textContent = '';
      // 選項：正解 + 3 個干擾
      var names = [prAnswer.name];
      while (names.length < 4) {
        var cand = REACT_SET[Math.floor(Math.random() * REACT_SET.length)].name;
        if (names.indexOf(cand) < 0) names.push(cand);
      }
      names.sort(function () { return Math.random() - 0.5; });
      var ah = document.getElementById('prAnswers');
      ah.innerHTML = '';
      names.forEach(function (n) {
        var b = document.createElement('button');
        b.className = 'btn btn-ghost btn-sm'; b.textContent = n;
        b.addEventListener('click', function () { prJudge(n); });
        ah.appendChild(b);
      });
    }
    function prJudge(choice) {
      if (!prAnswer) return;
      var fb = document.getElementById('prFb');
      var ms = performance.now() - prShownAt;
      prStats.total++;
      if (choice === prAnswer.name) { prStats.ok++; prStats.ms += ms; fb.textContent = '✓ ' + (ms / 1000).toFixed(1) + ' 秒'; fb.className = 'quiz-feedback good'; SY.blip(true); }
      else { fb.textContent = '✗ 是 ' + prAnswer.name; fb.className = 'quiz-feedback bad'; SY.blip(false); }
      stats.data.react = prStats; stats.save();
      prRefresh();
      prAnswer = null;
      setTimeout(prNew, 700);
    }
    prNew();

    /* 清理：離開頁面時停掉節拍器與所有計時器 */
    GL.onCleanup(function () {
      running = false;
      clearTimeout(timer);
      // 取消所有待觸發的燈號 setTimeout（用 maxId 擋不掉的只能等自然結束，最長 1 拍）
    });
  }

  window.GL.register('practice', { navName: '節奏・音感', render: render });
})();
