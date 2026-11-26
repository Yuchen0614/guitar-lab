/* 吉他實驗室 — 樂理教室（開發中殼頁） */
(function () {
  'use strict';

  function render(el) {
    el.innerHTML = window.GL.moduleShell({
      kicker: 'Music Theory',
      title: '樂理教室',
      lede: '為吉他手寫的樂理課：從音程、音階、順階和弦，到調性內轉與常用進行，每課都有互動圖解與小練習。',
      meta: ['互動課程', '互動指板', '音階圖解', '和弦構成', '進行資料庫'],
      features: [
        ['十二平均律與音程', '全半音、大小音程，用鍵盤與指板對照著學。'],
        ['音階與調性', '大調、小調、五聲、藍調音階，指板圖形一次看懂。'],
        ['順階和弦', '為什麼 C 大調裡是 C-F-G？級數概念與常用進行。'],
        ['轉調與借用', '同一首歌怎麼換調、 borrowed chords 怎麼用。']
      ],
      previewNote: '課程內容與互動指板將在 M2 完成後上線。'
    });
  }

  window.GL.register('theory', { navName: '樂理教室', render: render });
})();
