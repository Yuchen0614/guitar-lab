/* 吉他實驗室 — 首頁 */
(function () {
  'use strict';

  var MODULES = [
    {
      id: 'chords', icon: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 3v18"/>',
      title: '和弦圖工坊', status: 'live', core: true,
      desc: '點選琴格設計和弦指法，即時命名、聽音、匯出 SVG/PNG，上百種內建指型。',
      link: '前往工坊'
    },
    {
      id: 'theory', icon: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
      title: '樂理教室', status: 'live', core: false,
      desc: '音程、音階、順階和弦到調性內轉——圖文並茂的互動課程，學完直接用。',
      link: '開始學習'
    },
    {
      id: 'practice', icon: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/>',
      title: '節奏・音感', status: 'live', core: false,
      desc: '節拍器、音感訓練（聽音程認和弦）、和弦反應測驗，練習成果記錄在案。',
      link: '開始練習'
    },
    {
      id: 'analyze', icon: '<path d="M3 12h4l2-7 4 14 2-7h6"/>',
      title: '和弦分析', status: 'live', core: true,
      desc: '上傳音訊，選擇辨識演算法（樣板比對／Viterbi），產出和弦時間軸與段落和弦。',
      link: '分析歌曲'
    },
    {
      id: 'structure', icon: '<path d="M4 6h16M4 12h16M4 18h10"/>',
      title: '段落與歌詞', status: 'live', core: true,
      desc: '自動切出前奏主歌副歌，貼上歌詞即分析段落與押韻，和聲結構一目瞭然。',
      link: '分析段落'
    },
    {
      id: 'solo', icon: '<path d="m12 3 1.9 5.8H20l-5 3.7 1.9 5.8-4.9-3.6-4.9 3.6L9 12.5 4 8.8h6.1z"/>',
      title: 'Solo 譜生成', status: 'live', core: true,
      desc: '選調性、和弦進行與難度，生成可彈奏的 Solo 六線譜，附譜面試聽與匯出。',
      link: '生成 Solo'
    }
  ];

  function icon(name) {
    var icons = {
      arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
      lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
      upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5"/><path d="M12 3v12"/>',
      audio: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
      chords: '<path d="m8 8 3-3 3 3M12 5v6"/><rect x="3" y="13" width="18" height="7" rx="2"/>',
      shield: '<path d="M12 22s8-3.5 8-10V5l-8-3-8 3v7c0 6.5 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>'
    };
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (icons[name] || icons.arrow) + '</svg>';
  }

  /* 指板裝飾：開放和弦把位點綴 */
  function fretboardStrip() {
    var strings = ['E', 'A', 'D', 'G', 'B', 'e'];
    var H = 120, rowGap = 18, top = 22;
    var svg = '<svg class="fretboard-svg" viewBox="0 0 860 ' + (H + 10) + '" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="吉他指板裝飾">';
    var frets = [0, 1, 3, 5, 7, 9, 12];
    var totalW = 800, left = 40;
    var positions = {};
    frets.forEach(function (f, i) { positions[f] = left + (totalW * i / (frets.length - 1)); });
    // 弦
    strings.forEach(function (s, i) {
      var y = top + i * rowGap;
      var w = 3.2 - i * 0.38;
      svg += '<line x1="' + left + '" y1="' + y + '" x2="' + (left + totalW) + '" y2="' + y + '" stroke="var(--border-strong)" stroke-width="' + w + '" stroke-linecap="round"/>';
      svg += '<text x="' + (left - 16) + '" y="' + (y + 4) + '" text-anchor="middle" font-size="11" fill="var(--faint)" font-family="var(--font-mono)">' + s + '</text>';
    });
    // 琴格線
    Object.keys(positions).forEach(function (f) {
      if (f === '0') return;
      var x = positions[f];
      svg += '<line x1="' + x + '" y1="' + (top - 8) + '" x2="' + x + '" y2="' + (top + 5 * rowGap + 8) + '" stroke="var(--border)" stroke-width="2"/>';
    });
    // 琴格標記
    [[3, 2], [5, 2], [7, 2], [9, 2], [12, 1], [12, 4]].forEach(function (m) {
      var x = (positions[m[0]] + (m[0] === 12 ? positions[9] : positions[m[0] - 2])) / 2;
      if (m[0] !== 12) x = (positions[m[0]] + positions[m[0] - 2]) / 2;
      var y = top + (m[1] - 1) * rowGap + rowGap / 2 - 2;
      svg += '<circle cx="' + x + '" cy="' + y + '" r="5" fill="var(--border-strong)" opacity=".55"/>';
    });
    // 音符點綴：C 和弦（x32010）開放指法，弦序低→高 E A D G B e
    function fretX(f) { // 第 f 格的中心 x（取相鄰兩條已繪琴格線的中點）
      var idx = frets.indexOf(f);
      if (f === 0) return positions[0];
      if (idx <= 0) return left;
      return (positions[frets[idx]] + positions[frets[idx - 1]]) / 2;
    }
    var dots = [[1, 3], [2, 2], [3, 0], [4, 1], [5, 0]]; // [弦索引, 琴格]
    dots.forEach(function (d) {
      var y = top + d[0] * rowGap;
      var x = fretX(d[1]);
      svg += '<circle cx="' + x + '" cy="' + y + '" r="9" fill="var(--accent)"/>';
      svg += '<circle cx="' + x + '" cy="' + y + '" r="13" fill="var(--accent)" opacity=".25"/>';
    });
    // 低音 E 弦悶音記號
    svg += '<text x="' + (positions[0] - 14) + '" y="' + (top + 4) + '" text-anchor="middle" font-size="13" fill="var(--faint)" font-family="var(--font-mono)">×</text>';
    svg += '</svg>';
    return svg;
  }

  function render(el) {
    var cards = '';
    MODULES.forEach(function (m) {
      var disabled = m.status !== 'live';
      cards += '<a class="feature-card' + (disabled ? ' disabled' : '') + '" href="#/' + m.id + '"' + (disabled ? ' aria-disabled="true"' : '') + '>' +
        '<div class="card-icon">' + icon(m.icon) + '</div>' +
        '<h3>' + m.title + '</h3>' +
        '<p>' + m.desc + '</p>' +
        '<div class="card-meta">' +
          '<span class="badge' + (m.core ? ' core' : '') + '">' + (m.core ? '核心功能' : '學習輔助') + '</span>' +
          '<span class="card-link">' + m.link + icon('arrow') + '</span>' +
        '</div>' +
      '</a>';
    });

    el.innerHTML =
      '<section class="hero">' +
        '<div class="container hero-inner">' +
          '<span class="hero-kicker">' + icon('audio') + '全瀏覽器端運算 · 音檔不上傳</span>' +
          '<h1>從聽懂一首歌，<br>到彈出<span class="grad">你自己的 Solo</span></h1>' +
          '<p class="lede">上傳音訊分析和弦進行、自動切出歌曲段落、貼歌詞看押韻結構；再加上樂理教室與 Solo 譜生成——把「聽歌」到「彈唱」的距離，縮到最短。</p>' +
          '<div class="hero-cta">' +
            '<a class="btn btn-primary" href="#/analyze">開始分析歌曲 ' + icon('upload') + '</a>' +
            '<a class="btn btn-ghost" href="#/theory">先學點樂理</a>' +
          '</div>' +
          '<p class="hero-note">免安裝、免註冊，打開瀏覽器就能用</p>' +
        '</div>' +
        '<div class="fretboard-strip">' + fretboardStrip() + '</div>' +
      '</section>' +

      '<section class="cards-section">' +
        '<div class="container">' +
          '<h2>六個模組，一條學習路</h2>' +
          '<p class="cards-sub">每個功能都獨立可用，也能串成完整流程：分析 → 理解 → 練習 → 創作</p>' +
          '<div class="card-grid">' + cards + '</div>' +
        '</div>' +
      '</section>' +

      '<section class="how-section">' +
        '<div class="container">' +
          '<h2>怎麼用？</h2>' +
          '<div class="steps">' +
            '<div class="step"><h3>丟進一首歌</h3><p>把音訊檔拖進和弦分析，本機計算 chroma 特徵，不上傳任何資料。</p></div>' +
            '<div class="step"><h3>選你的演算法</h3><p>樣板比對求快、Viterbi 求穩——同一首歌可以切換比對結果。</p></div>' +
            '<div class="step"><h3>看懂結構</h3><p>段落切分＋歌詞押韻分析，主歌副歌與和聲的關係一目瞭然。</p></div>' +
            '<div class="step"><h3>彈出來</h3><p>用生成的和弦與 Solo 六線譜開始練習，節拍器和音感訓練當陪練。</p></div>' +
          '</div>' +
        '</div>' +
      '</section>' +

      '<section class="privacy-band">' +
        '<div class="container">' +
          '<div class="privacy-box">' +
            icon('shield') +
            '<div>' +
              '<h3>隱私承諾</h3>' +
              '<p>所有音訊分析、和弦辨識、譜面生成都在你的瀏覽器內完成——沒有伺服器、沒有上傳、沒有帳號，關掉頁面就什麼都不留。</p>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</section>';
  }

  window.GL.register('home', { navName: '首頁', render: render });
})();
