/* 吉他實驗室 — 和弦分析（開發中殼頁） */
(function () {
  'use strict';

  function render(el) {
    el.innerHTML = window.GL.moduleShell({
      kicker: 'Chord Analysis',
      title: '和弦分析',
      lede: '把歌丟進來，讓演算法聽出和弦：上傳音訊 → 抽取 chroma 特徵 → 選擇辨識演算法 → 得到和弦時間軸，可按段落折疊檢視。',
      meta: ['本機音訊解碼', 'PCP / NNLS chroma', '樣板比對', 'Viterbi 平滑', '時間軸檢視'],
      features: [
        ['演算法任選', '24 大小和弦樣板即時比對，或用 Viterbi 動態規劃求整體最適解。'],
        ['特徵可調', '框架大小、hop 長度、平滑強度開放調整，拆解不同編曲。'],
        ['段落同步', '和弦時間軸與段落切分結果對齊，副歌進行一眼看出。'],
        ['隱私安全', '音訊用 Web Audio API 本機解碼，永不上傳。']
      ],
      previewNote: '音訊分析引擎將在 M3 完成後上線——這是本站最核心的模組。'
    });
  }

  window.GL.register('analyze', { navName: '和弦分析', render: render });
})();
