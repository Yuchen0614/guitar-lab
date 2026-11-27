/* 吉他實驗室 — 押韻分析引擎（純函式庫，無 UI）
   中文：查 GLRhymeData 韻基表 → 比對韻基／十三轍
   英文：輕量音節切分 + 韻基（最後母音起至字尾）比對
   資料檔：js/data/rhyme-data.js（build-rhyme-data.py 產生） */
(function () {
  'use strict';

  var R = {};

  /* ---------- 中文 ---------- */

  // 字→韻基反查索引（GLRhymeData.buildIndex() 產生）
  var INDEX = null;
  R.initIndex = function () {
    if (window.GLRhymeData && window.GLRhymeData.buildIndex) {
      INDEX = window.GLRhymeData.buildIndex();
    }
    return INDEX;
  };

  // 取單字韻基；查無資料回 null
  R.charFinal = function (ch) {
    if (INDEX) return INDEX[ch] || null;
    if (window.GLRhymeData && window.GLRhymeData.buildIndex) {
      INDEX = window.GLRhymeData.buildIndex();
      return INDEX[ch] || null;
    }
    return null;
  };
  R.charToFinal = R.charFinal;

  // 十三轍：由韻基反查所屬轍
  var ZHE = [
    ['發花', ['a', 'ia', 'ua']],
    ['梭波', ['e', 'o', 'uo', 'io']],
    ['乜斜', ['ie', 've']],
    ['一七', ['i', 'v', 'er']],
    ['姑蘇', ['u']],
    ['懷來', ['ai', 'uai']],
    ['灰堆', ['ei', 'uei']],
    ['遙條', ['ao', 'iao']],
    ['由求', ['ou', 'iou']],
    ['言前', 'AN'],
    ['人辰', ['en', 'in', 'uen', 'vn']],
    ['江陽', ['ang', 'iang', 'uang']],
    ['中東', ['eng', 'ing', 'ong', 'iong', 'ueng']]
  ];
  R.zheOf = function (final) {
    if (!final) return null;
    for (var i = 0; i < ZHE.length; i++) {
      var members = ZHE[i][1];
      if (members === 'AN') { if (final.slice(-2) === 'an') return ZHE[i][0]; }
      else if (members.indexOf(final) >= 0) return ZHE[i][0];
    }
    return null;
  };

  // 中文兩字是否押韻：同轍即押（寬）；韻基全同為「全同」（嚴）
  R.zhRhyme = function (chA, chB) {
    var fa = R.charFinal(chA), fb = R.charFinal(chB);
    if (!fa || !fb) return null;
    if (fa === fb) return { level: 'exact', zhe: R.zheOf(fa) };
    var za = R.zheOf(fa), zb = R.zheOf(fb);
    if (za && za === zb) return { level: 'zhe', zhe: za };
    return { level: 'none', zhe: za || zb };
  };

  /* ---------- 英文 ---------- */

  // 輕量音節切分（母音群為核心）
  var VOWELS = 'aeiouy';
  function syllables(word) {
    var w = word.toLowerCase().replace(/[^a-z']/g, '');
    if (!w) return [];
    var groups = [];
    var cur = '';
    for (var i = 0; i < w.length; i++) {
      if (VOWELS.indexOf(w[i]) >= 0) cur += w[i];
      else { if (cur) { groups.push(cur); cur = ''; } }
    }
    if (cur) groups.push(cur);
    // 無聲 e：word→orde 修正為 1 音節（略過細節，此處保守處理）
    return groups;
  }

  // 英文韻基：最後一個母音群起至字尾（tail rhyme）
  R.enRime = function (word) {
    var w = word.toLowerCase().replace(/[^a-z]/g, '');
    if (!w) return null;
    var last = -1;
    for (var i = w.length - 1; i >= 0; i--) {
      if (VOWELS.indexOf(w[i]) >= 0) { last = i; break; }
    }
    if (last < 0) return null;
    return w.slice(last);
  };

  R.enRhyme = function (wa, wb) {
    var ra = R.enRime(wa), rb = R.enRime(wb);
    if (!ra || !rb) return null;
    if (ra === rb) return { level: 'exact', rime: ra };
    // 寬鬆：最後兩字元相同（如 -ing/-ing、-ight/-ite 差異忽略）
    if (ra.length >= 2 && rb.length >= 2 && ra.slice(-2) === rb.slice(-2)) return { level: 'loose', rime: ra + '/' + rb };
    return { level: 'none' };
  };

  /* ---------- 行級分析 ---------- */

  // 分行 → 每行的尾字資訊
  // lang: 'zh' | 'en' | 'auto'
  R.analyzeLines = function (text, lang) {
    var lines = text.split(/\r?\n/).map(function (l) { return l.trim(); });
    var result = [];
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      if (!line) { result.push({ empty: true }); continue; }
      // 去標點，取最後一個「字」
      var clean = line.replace(/[，。！？、；：""''「」『』（）,.!?;:()"'—…·\s]+/g, '');
      if (!clean) { result.push({ empty: true }); continue; }
      if (lang === 'en' || (lang === 'auto' && /[a-zA-Z]{3,}$/.test(line))) {
        var words = line.toLowerCase().replace(/[^a-zA-Z\s']/g, '').split(/\s+/).filter(Boolean);
        var lastWord = words.length ? words[words.length - 1] : '';
        result.push({
          lang: 'en', line: line, tail: lastWord,
          rime: R.enRime(lastWord),
          syl: syllables(lastWord).length
        });
      } else {
        var tail = clean.slice(-1); // 中文尾字
        var fin = R.charFinal(tail);
        result.push({
          lang: 'zh', line: line, tail: tail,
          final: fin, zhe: R.zheOf(fin)
        });
      }
    }
    return result;
  };

  // 指派韻式字母（AABB / ABAB / XAAA…）
  // 規則：連續同韻 → 同字母；不連續但同韻 → 仍沿用（AAAA 型）; 無資料 → X
  R.assignScheme = function (lineInfos) {
    var letters = [];
    var next = 0;
    var groups = []; // { key, letter }
    for (var i = 0; i < lineInfos.length; i++) {
      var info = lineInfos[i];
      if (info.empty) { letters.push(null); continue; }
      var key = info.lang === 'en' ? 'en:' + (info.rime || '?') : 'zh:' + (info.final || '?');
      var found = null;
      // 先找：前面 2 行內同 key → 同字母（緊鄰押韻）
      for (var j = letters.length - 1; j >= 0; j--) {
        if (letters[j] === null) continue;
        if (lineInfos[j].empty) continue;
        var jkey = lineInfos[j].lang === 'en' ? 'en:' + (lineInfos[j].rime || '?') : 'zh:' + (lineInfos[j].final || '?');
        if (jkey === key) { found = letters[j]; break; }
        // 中文：不同韻基但同轍 → 寬鬆視為同韻（僅相鄰時）
        if (info.lang === 'zh' && lineInfos[j].lang === 'zh' &&
            info.zhe && lineInfos[j].zhe && info.zhe === lineInfos[j].zhe &&
            i - j === 1) { found = letters[j]; break; }
      }
      if (found !== null && found !== undefined) {
        letters.push(found);
      } else {
        var letter = String.fromCharCode(65 + next);
        groups.push({ key: key, letter: letter });
        letters.push(letter);
        next++;
      }
    }
    return { letters: letters, groups: groups };
  };

  // 統計：押韻密度（有韻腳資訊的行中，與前一行同韻的比例）
  R.stats = function (lineInfos, letters) {
    var total = 0, rhymed = 0, noData = 0;
    var zheCount = {};
    for (var i = 0; i < lineInfos.length; i++) {
      var info = lineInfos[i];
      if (info.empty || !info.tail) continue;
      if (info.lang === 'zh' && !info.final) { noData++; continue; }
      total++;
      if (info.lang === 'zh' && info.zhe) {
        zheCount[info.zhe] = (zheCount[info.zhe] || 0) + 1;
      }
      if (i > 0 && letters[i] && letters[i - 1] && letters[i] === letters[i - 1]) rhymed++;
    }
    return {
      lines: total, rhymed: rhymed,
      density: total ? +(rhymed / total).toFixed(2) : 0,
      noData: noData,
      zheTop: Object.keys(zheCount).sort(function (a, b) { return zheCount[b] - zheCount[a]; })
        .map(function (z) { return { zhe: z, count: zheCount[z] }; }).slice(0, 3)
    };
  };

  window.GLrhyme = R;
})();
