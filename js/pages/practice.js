/* 吉他實驗室 — 節奏・音感（開發中殼頁） */
(function () {
  'use strict';

  function render(el) {
    el.innerHTML = window.GL.moduleShell({
      kicker: 'Rhythm & Ear Training',
      title: '節奏・音感',
      lede: '每天十分鐘的陪練工具：節拍器穩定節奏，音感訓練聽出音程與和弦品質，測驗記錄你的進步曲線。',
      meta: ['節拍器', '音程聽辨', '和弦品質聽辨', '和弦反應測驗', '進度記錄'],
      features: [
        ['節拍器', '可調拍速與拍號，重音標示、分段加速練習。'],
        ['音程聽辨', '隨機播放音程讓你猜，從八度內練到十三度。'],
        ['和弦聽辨', '聽出 major / minor / 7 / maj7 的色彩差異。'],
        ['進度存檔', '正確率與反應時間記在本機，看得到成長。']
      ],
      previewNote: '練習工具將在 M2 完成後上線。'
    });
  }

  window.GL.register('practice', { navName: '節奏・音感', render: render });
})();
