/* 吉他實驗室 — structure-core Node 測試
   測資：A(8s) B(8s) A(8s) 三段，每段兩個和弦（各 4s）
   驗證：novelty 邊界 ≈ 8s / 16s，字母標記 = ABA */
'use strict';

global.window = {};
require('../js/data/rhyme-data.js');
global.window.GLmusic = { mod12: function (n) { return ((n % 12) + 12) % 12; } };
var fs = require('fs');
var path = require('path');

// 載入 audio-core（截去瀏覽器依賴的 renderDemo 之後）
var acSrc = fs.readFileSync(path.join(__dirname, '../js/lib/audio-core.js'), 'utf8');
eval(acSrc.slice(0, acSrc.indexOf('AC.renderDemo')) + '\nwindow.GLaudio = AC;\n})();');
var AC = global.window.GLaudio;

require('../js/lib/structure-core.js');
var SS = window.GLstructure;

var SR = 22050;
var NOTE_FREQ = { C: 261.63, D: 293.66, E: 329.63, F: 349.23, G: 392.0, A: 440.0, B: 493.88 };

// 合成一段：chords = [[音名…], …]，每和弦 dur/chords.length 秒
function synthSection(chords, dur) {
  var out = [];
  var cd = dur / chords.length;
  chords.forEach(function (chord) {
    var samples = Math.floor(cd * SR);
    for (var i = 0; i < samples; i++) {
      var t = i / SR;
      var env = Math.min(1, i / (SR * 0.01)) * Math.exp(-t * 0.5);
      var v = 0;
      chord.forEach(function (name, k) {
        var f = NOTE_FREQ[name];
        v += Math.sin(2 * Math.PI * f * t) * 0.35
           + Math.sin(2 * Math.PI * f * 0.5 * t) * 0.3
           + Math.sin(2 * Math.PI * f * 2 * t) * 0.12;
      });
      out.push(v * env * 0.6);
    }
  });
  return out;
}

// 直接重用 audio-core 的 chroma（它是瀏覽器全域腳本，需模擬 window + GLmusic 依賴）
global.window.GLmusic = { mod12: function (n) { return ((n % 12) + 12) % 12; } };
// audio-core 用到 GLaudio 的 audio context 僅在 decode；chroma 相關是純運算，直接提取
var acSrc = require('fs').readFileSync(require('path').join(__dirname, '../js/lib/audio-core.js'), 'utf8');
// 只取到 chromaFrames 結束前的部分（避開 OfflineAudioContext/renderDemo 瀏覽器依賴）
var cutIdx = acSrc.indexOf('AC.renderDemo');
var safe = acSrc.slice(0, cutIdx) + '\nwindow.GLaudio = AC;\n})();';
eval(safe);
var AC = global.window.GLaudio;

console.log('== 1. 合成 A B A 音訊（各 8s，C-G / F-D / C-G）==');
var buf = [];
buf = buf.concat(synthSection([['C', 'E', 'G'], ['G', 'B', 'D']], 8)); // A
buf = buf.concat(synthSection([['F', 'A', 'C'], ['D', 'F', 'A']], 8)); // B
buf = buf.concat(synthSection([['C', 'E', 'G'], ['G', 'B', 'D']], 8)); // A
var mono = new Float32Array(buf);
console.log('樣本數:', mono.length, '時長:', (mono.length / SR).toFixed(1) + 's');

console.log('\n== 2. chroma ==');
var chroma = AC.chromaFrames(mono, SR, { frameSize: 4096, hop: 2048 });
console.log('幀數:', chroma.frames.length, '每幀', (chroma.frameDur * 1000).toFixed(0) + 'ms');

console.log('\n== 3. 段落分析 ==');
var result = SS.analyze(chroma.frames, chroma.frameDur, { kernelSec: 8, minGapSec: 4 });
var boundsSec = result.boundaryFrames.map(function (f) { return +(f * chroma.frameDur).toFixed(1); });
console.log('偵測邊界（秒）:', boundsSec.join(', '), '（期望 ≈ 8, 16）');
console.log('門檻:', result.peaks.threshold.toFixed(3), 'mean:', result.peaks.mean.toFixed(3), 'sd:', result.peaks.sd.toFixed(3));
console.log('\n段落表:');
result.segments.forEach(function (s, i) {
  console.log('  ' + (i + 1) + '. ' + s.start.toFixed(1) + '–' + s.end.toFixed(1) + 's  字母=' + s.letter + '  與前段相似度=' + s.sim);
});

console.log('\n== 4. 驗證 ==');
var letters = result.segments.map(function (s) { return s.letter; }).join('');
console.log('偵測到', result.segments.length, '段，字母序:', letters, '（期望 ABA）');
var okLetters = letters === 'ABA';
console.log(okLetters ? '✓ 字母標記正確' : '✗ 字母標記不符');

// 邊界容差 ±1.5s
var okBounds = boundsSec.length === 2 &&
  Math.abs(boundsSec[0] - 8) <= 1.5 && Math.abs(boundsSec[1] - 16) <= 1.5;
console.log(okBounds ? '✓ 邊界位置正確（±1.5s 容差）' : '✗ 邊界位置不符: ' + boundsSec.join(','));

console.log('\n== 5. 押韻資料抽檢 ==');
var RD = global.window.GLRhymeData;
console.log('groups 數:', Object.keys(RD.groups).length);
console.log('「一」在 i 組:', RD.groups.i.indexOf('一') >= 0 ? '✓' : '✗');

process.exit(okLetters && okBounds ? 0 : 1);
