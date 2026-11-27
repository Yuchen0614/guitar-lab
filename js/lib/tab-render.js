/* 吉他實驗室 — ASCII 六線譜渲染引擎（M5）
   kanpu8 風格：e|---3---|---1---| 小節線、上方和弦名對齊、
   自動斷行（每行 N 小節）、技巧記號（b=推弦 / =滑音）
   輸入：GLsolo.generate 的結果 + 和弦進行 */
(function () {
  'use strict';

  var TB = {};
  var M = window.GLmusic;

  var STRING_LABELS = ['e', 'B', 'G', 'D', 'A', 'E']; // 顯示順序：高音弦在上
  // events 的 string: 0=低音E...5=高音e；顯示行 row = 5 - string

  /* ---------- 主渲染 ----------
     result: GLsolo.generate 結果
     prog:   和弦進行 [{root, typeId, bars}]（bars 與生成時一致）
     opts:   { barsPerLine, beatsPerBar, barsPerChord, showChordNames } */
  TB.render = function (result, prog, opts) {
    opts = opts || {};
    var beatsPerBar = opts.beatsPerBar || 4;
    var barsPerChord = opts.barsPerChord || 1;
    var barsPerLine = opts.barsPerLine || 4;
    var totalBars = result.totalBeats / beatsPerBar;

    // 1) 把事件按小節分組，每小節內按時間排序
    var bars = [];
    for (var i = 0; i < totalBars; i++) bars.push([]);
    result.events.forEach(function (e) {
      var bar = Math.floor(e.start / beatsPerBar);
      if (bar < bars.length) bars[bar].push(e);
    });
    bars.forEach(function (bar) { bar.sort(function (a, b) { return a.start - b.start; }); });

    // 2) 小節 → 和弦名對照
    var barChords = [];
    prog.forEach(function (chord) {
      var name = M.pcName(chord.root) + (SGTypeSuffix(chord.typeId));
      for (var b = 0; b < barsPerChord; b++) barChords.push(name);
    });

    // 3) 逐行渲染
    var lines = [];
    var colW = 6; // 每個「拍位」欄位寬（字元）
    var beatsPerBarCells = beatsPerBar * 2; // 半拍精度

    for (var lineStart = 0; lineStart < totalBars; lineStart += barsPerLine) {
      var lineBars = bars.slice(lineStart, lineStart + barsPerLine);
      lines.push(renderLine(lineBars, lineStart, beatsPerBar, colW, barChords, opts));
    }

    // 標題
    var header = '吉他實驗室 — Solo 六線譜' +
      '  (' + M.pcName(result.key.root) + ' ' + scaleName(result.key.scaleId) +
      ' · ' + ({ easy: '初級', medium: '中級', hard: '高級' }[result.difficulty] || result.difficulty) + ')';
    return header + '\n\n' + lines.join('\n') + '\n';
  };

  function renderLine(lineBars, lineStartBar, beatsPerBar, colW, barChords, opts) {
    var nRows = 6;
    // 每小節 = beatsPerBar 個拍位，每拍位 colW 字元；小節線 1 字元
    var barWidth = beatsPerBar * colW;
    var totalWidth = lineBars.length * (barWidth + 1) + 1;

    // 初始化 6 條弦 + 和弦名行
    var rows = [];
    for (var r = 0; r < nRows; r++) rows.push([]);
    // 預填空白
    for (var r2 = 0; r2 < nRows; r2++) {
      for (var c = 0; c < totalWidth; c++) rows[r2].push(' ');
    }

    // 和弦名行（對齊每小節開頭）
    var chordRow = [];
    for (var c2 = 0; c2 < totalWidth; c2++) chordRow.push(' ');
    lineBars.forEach(function (_, bi) {
      var barIdx = lineStartBar + bi;
      var name = barChords[barIdx] || '';
      var x = bi * (barWidth + 1) + 1;
      for (var k = 0; k < name.length && x + k < totalWidth - 1; k++) {
        chordRow[x + k] = name[k];
      }
    });

    // 填入音符數字
    lineBars.forEach(function (bar, bi) {
      var barX = bi * (barWidth + 1) + 1;
      bar.forEach(function (e) {
        var beatInBar = e.start % beatsPerBar;
        var x = barX + Math.round(beatInBar * 2) * colW / 2;
        var row = 5 - e.string;
        var num = String(e.fret);
        // 技巧後綴
        var tech = e.technique === 'bend' ? 'b' : e.technique === 'slide' ? '/' : '';
        var token = num + tech;
        for (var k = 0; k < token.length && x + k < barX + barWidth; k++) {
          rows[row][x + k] = token[k];
        }
      });
    });

    // 加弦標籤與小節線
    var out = [];
    // 和弦名行（縮排 2）
    out.push('  ' + chordRow.join(''));
    for (var r3 = 0; r3 < nRows; r3++) {
      var label = STRING_LABELS[r3];
      var line = '  ' + label + '|';
      for (var bi2 = 0; bi2 < lineBars.length; bi2++) {
        var bx = bi2 * (barWidth + 1) + 1;
        for (var c3 = 0; c3 < barWidth; c3++) {
          line += rows[r3][bx + c3];
        }
        line += '|';
      }
      out.push(line);
    }
    return out.join('\n');
  }

  function SGTypeSuffix(typeId) {
    var ct = null;
    for (var i = 0; i < M.CHORD_TYPES.length; i++) {
      if (M.CHORD_TYPES[i].id === typeId) { ct = M.CHORD_TYPES[i]; break; }
    }
    return ct ? ct.suffix : '';
  }

  function scaleName(id) {
    var names = { major: '大調', natmin: '自然小調', pentaMin: '小五聲', pentaMaj: '大五聲', blues: '藍調', mixo: 'Mixolydian' };
    return names[id] || id;
  }

  /* ---------- alphaTex 匯出（可餵給 alphaTab） ---------- */
  TB.toAlphaTex = function (result, prog, opts) {
    opts = opts || {};
    var bpm = opts.bpm || 90;
    var lines = ['\\title "Generated Solo"', '\\tempo ' + bpm];
    var beatsPerBar = result.beatsPerBar;
    var events = result.events.slice().sort(function (a, b) { return a.start - b.start; });
    var cur = 0;
    var bar = [];
    function flushBar() {
      lines.push(bar.join(' ') + ' |');
      bar = [];
    }
    events.forEach(function (e) {
      // 填補空檔（休止符）
      var gap = e.start - cur;
      while (gap >= 0.5) {
        // 休止符：直接用拍數命名（alphaTex r 後可接 .4/.8 等；簡化用 .4）
        var restLen = gap >= 2 ? '2' : gap >= 1 ? '4' : '8';
        var step = restLen === '2' ? 2 : restLen === '4' ? 1 : 0.5;
        bar.push('r.' + restLen);
        cur += step;
        gap = e.start - cur;
        if (Math.abs(cur % beatsPerBar) < 0.001 && bar.length) flushBar();
      }
      var durBeats = e.dur;
      // 音符值代號：4=四分, 8=八分, 2=二分, 1=全音符；附點用 d (1.5x)
      var durCode;
      if (durBeats >= 4) durCode = '1';
      else if (durBeats >= 3) durCode = '2.';      // 附點二分 = 3 拍
      else if (durBeats >= 2) durCode = '2';
      else if (durBeats >= 1.5) durCode = '4.';    // 附點四分 = 1.5 拍
      else if (durBeats >= 1) durCode = '4';
      else if (durBeats >= 0.75) durCode = '8.';   // 附點八分 = 0.75 拍
      else durCode = '8';
      var restDur;
      if (durBeats >= 4) restDur = 4;
      else if (durBeats >= 3) restDur = 3;
      else if (durBeats >= 2) restDur = 2;
      else if (durBeats >= 1.5) restDur = 1.5;
      else if (durBeats >= 1) restDur = 1;
      else if (durBeats >= 0.75) restDur = 0.75;
      else restDur = 0.5;
      // alphaTex 格式：string.fret.duration 或 r.duration（休止）
      bar.push(e.fret + '.' + (e.string + 1) + '.' + durCode);
      cur += durBeats;
      if (Math.abs(cur % beatsPerBar) < 0.001 && bar.length) flushBar();
    });
    if (bar.length) flushBar();
    return lines.join('\n');
  };

  window.GLtab = TB;
})();
