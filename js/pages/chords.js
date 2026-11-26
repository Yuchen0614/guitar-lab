/* 吉他實驗室 — 和弦圖工坊（開發中殼頁） */
(function () {
  'use strict';

  function render(el) {
    el.innerHTML = window.GL.moduleShell({
      kicker: 'Chord Workshop',
      title: '和弦圖工坊',
      lede: '點選琴格就能設計和弦指法：即時顯示和弦名稱、標示音名與指法編號、試聽撥弦與刷弦聲，一鍵匯出 SVG 或 PNG。',
      meta: ['SVG 向量輸出', 'PNG 匯出', '點選編輯', '即時命名', '內建指型庫'],
      features: [
        ['點格即編輯', '在指板圖上直接點選/取消琴格，像 ChordPic 一樣直覺。'],
        ['智慧命名', '依指法內音推導和弦名稱，支援七和弦、延伸與轉位。'],
        ['指法庫', '常見開放與封閉和弦全收錄，一鍵套用再微調。'],
        ['匯出與分享', 'SVG/PNG 下載，譜面排版直接拿去用。']
      ],
      previewNote: '和弦圖編輯器將在此里程碑完成後上線——目前先把網站骨架與設計系統建穩。'
    });
  }

  window.GL.register('chords', { navName: '和弦圖工坊', render: render });
})();
