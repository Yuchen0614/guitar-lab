/* 吉他實驗室 — 段落與歌詞（開發中殼頁） */
(function () {
  'use strict';

  function render(el) {
    el.innerHTML = window.GL.moduleShell({
      kicker: 'Structure & Lyrics',
      title: '段落與歌詞',
      lede: '自動切出前奏、主歌、副歌、橋段，再貼上歌詞做押韻與段落分析——和聲結構與文字結構對照看。',
      meta: ['自相似矩陣', 'novelty 邊界偵測', 'A/B/C 標記', '押韻分析', '段落統計'],
      features: [
        ['段落切分', '以 chroma 自相似矩陣偵測重複段落，標記 A/B/C 結構。'],
        ['歌詞押韻', '中文以拼音韻母比對，英文用音標比對，押韻句著色顯示。'],
        ['段落統計', '每段長度、和弦數、押韻密度一次列表。'],
        ['時間軸對照', '段落邊界與和弦變化對齊顯示。']
      ],
      previewNote: '段落分析與歌詞工具將在 M4 完成後上線。'
    });
  }

  window.GL.register('structure', { navName: '段落與歌詞', render: render });
})();
