/* 吉他實驗室 — Solo 譜生成（開發中殼頁） */
(function () {
  'use strict';

  function render(el) {
    el.innerHTML = window.GL.moduleShell({
      kicker: 'Solo Generator',
      title: 'Solo 譜生成',
      lede: '選調性、和弦進行與難度，生成器沿著和弦內音與調性音階編出可彈奏的 Solo 樂句，輸出專業六線譜並可試聽。',
      meta: ['和弦音+經過音', '把位連接', '節奏樣式', 'alphaTab 譜面', 'MIDI 試聽', 'ASCII 譜'],
      features: [
        ['樂句生成', '以和弦琶音為骨架、音階音填充，加上經過音與鄰音裝飾。'],
        ['難度分級', '初級八分音符為主、中級加入十六分與推弦、高級跨弦樂句。'],
        ['專業譜面', 'alphaTab 渲染標準譜+六線譜，節拍精確、可捲動播放。'],
        ['試聽與匯出', '內建合成器播放，匯出 alphaTex / MusicXML 檔案。']
      ],
      previewNote: 'Solo 生成器將在 M5 完成後上線——最令人期待的一塊。'
    });
  }

  window.GL.register('solo', { navName: 'Solo 譜生成', render: render });
})();
