/* 吉他實驗室 — 音樂理論引擎（純函式庫，無 UI） */
(function () {
  'use strict';

  var M = {};

  /* ---------- 基礎音名 ---------- */
  M.NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  // 顯示用（台灣常見）：升降記號擇一
  M.SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  M.FLAT  = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
  M.SOLFEGE = ['Do', 'Do#', 'Re', 'Re#', 'Mi', 'Fa', 'Fa#', 'Sol', 'Sol#', 'La', 'La#', 'Si'];

  // 標準調弦 E2 A2 D3 G3 B3 E4 → MIDI 40 45 50 55 59 64
  M.OPEN_STRINGS = [40, 45, 50, 55, 59, 64]; // index 0 = 低音E(第6弦)
  M.STRING_LABELS = ['E', 'A', 'D', 'G', 'B', 'e']; // 低→高

  function mod12(n) { return ((n % 12) + 12) % 12; }
  M.mod12 = mod12;

  /* 音名（支援 #/b）→ pitch class */
  M.noteToPc = function (name) {
    var m = /^([A-G])([#b]{0,2})$/.exec(name.trim());
    if (!m) return -1;
    var base = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1]];
    var acc = (m[2].match(/#/g) || []).length - (m[2].match(/b/g) || []).length;
    return mod12(base + acc);
  };

  /* pitch class → 顯示名 */
  M.pcName = function (pc, preferFlat) {
    return (preferFlat ? M.FLAT : M.SHARP)[mod12(pc)];
  };

  /* MIDI → 頻率 */
  M.midiToFreq = function (midi) { return 440 * Math.pow(2, (midi - 69) / 12); };

  /* ---------- 和弦定義 ---------- */
  // 縮寫 → (音程半音陣列, 全名, 別名)
  M.CHORD_TYPES = [
    { id: 'maj',  iv: [0, 4, 7],       full: '大三和弦',    suffix: '',      aliases: ['major', ''] },
    { id: 'min',  iv: [0, 3, 7],       full: '小三和弦',    suffix: 'm',     aliases: ['minor', 'm', 'min', '-'] },
    { id: 'dim',  iv: [0, 3, 6],       full: '減三和弦',    suffix: 'dim',   aliases: ['dim', '°', 'o'] },
    { id: 'aug',  iv: [0, 4, 8],       full: '增三和弦',    suffix: 'aug',   aliases: ['aug', '+'] },
    { id: 'sus4', iv: [0, 5, 7],       full: '掛留四和弦',  suffix: 'sus4',  aliases: ['sus4', 'sus'] },
    { id: 'sus2', iv: [0, 2, 7],       full: '掛留二和弦',  suffix: 'sus2',  aliases: ['sus2'] },
    { id: '7',    iv: [0, 4, 7, 10],   full: '屬七和弦',    suffix: '7',     aliases: ['7', 'dom7'] },
    { id: 'maj7', iv: [0, 4, 7, 11],   full: '大七和弦',    suffix: 'maj7',  aliases: ['maj7', 'M7', 'Δ'] },
    { id: 'm7',   iv: [0, 3, 7, 10],   full: '小七和弦',    suffix: 'm7',    aliases: ['m7', 'min7', '-7'] },
    { id: 'm7b5', iv: [0, 3, 6, 10],   full: '半減七和弦',  suffix: 'm7b5',  aliases: ['m7b5', 'ø'] },
    { id: 'dim7', iv: [0, 3, 6, 9],    full: '減七和弦',    suffix: 'dim7',  aliases: ['dim7', '°7'] },
    { id: '6',    iv: [0, 4, 7, 9],    full: '大六和弦',    suffix: '6',     aliases: ['6'] },
    { id: 'm6',   iv: [0, 3, 7, 9],    full: '小六和弦',    suffix: 'm6',    aliases: ['m6'] },
    { id: 'add9', iv: [0, 4, 7, 14],   full: '加九和弦',    suffix: 'add9',  aliases: ['add9', 'add2'] },
    { id: 'madd9',iv: [0, 3, 7, 14],   full: '小加九和弦',  suffix: 'm(add9)', aliases: ['madd9'] },
    { id: '9',    iv: [0, 4, 7, 10, 14], full: '屬九和弦', suffix: '9',     aliases: ['9'] },
    { id: 'maj9', iv: [0, 4, 7, 11, 14], full: '大九和弦', suffix: 'maj9',  aliases: ['maj9'] },
    { id: 'm9',   iv: [0, 3, 7, 10, 14], full: '小九和弦', suffix: 'm9',    aliases: ['m9'] }
  ];

  /* 和弦名稱（如 Cmaj7、G#m7b5、Bb）→ { root, type } 或 null */
  M.parseChord = function (name) {
    var m = /^([A-G])([#b]{0,2})(.*)$/.exec(name.trim());
    if (!m) return null;
    var rootName = m[1] + m[2];
    var rest = m[3].replace(/\s+/g, '');
    if (rest === '') rest = 'major';
    var t = null;
    for (var i = 0; i < M.CHORD_TYPES.length; i++) {
      var ct = M.CHORD_TYPES[i];
      if (ct.aliases.indexOf(rest) >= 0 || ct.suffix === rest) { t = ct; break; }
    }
    if (!t) return null;
    return { root: M.noteToPc(rootName), rootName: rootName, type: t };
  };

  /* 和弦 → pitch class 集合 */
  M.chordPcs = function (parsed) {
    return parsed.type.iv.map(function (i) { return mod12(parsed.root + i); });
  };

  /* 和弦名稱組裝 */
  M.chordName = function (rootPc, typeId, preferFlat) {
    var t = null;
    for (var i = 0; i < M.CHORD_TYPES.length; i++) if (M.CHORD_TYPES[i].id === typeId) { t = M.CHORD_TYPES[i]; break; }
    if (!t) return '?';
    return M.pcName(rootPc, preferFlat) + t.suffix;
  };

  /* ---------- 音階 ---------- */
  M.SCALES = [
    { id: 'major',   name: '大調音階',      steps: [2, 2, 1, 2, 2, 2, 1] },
    { id: 'natmin',  name: '自然小調',      steps: [2, 1, 2, 2, 1, 2, 2] },
    { id: 'harmmin', name: '和聲小調',      steps: [2, 1, 2, 2, 1, 3, 1] },
    { id: 'pentaMaj', name: '大五聲音階',   steps: [2, 2, 3, 2, 3] },
    { id: 'pentaMin', name: '小五聲音階',   steps: [3, 2, 2, 3, 2] },
    { id: 'blues',   name: '藍調音階',      steps: [3, 2, 1, 1, 3, 2] },
    { id: 'dorian',  name: '多利亞調式',    steps: [2, 1, 2, 2, 2, 1, 2] },
    { id: 'mixo',    name: '混合利底亞調式', steps: [2, 2, 1, 2, 2, 1, 2] }
  ];
  M.SCALES = M.SCALES.filter(function (s) { return s.steps; });

  M.scalePcs = function (rootPc, scaleId) {
    var sc = null;
    for (var i = 0; i < M.SCALES.length; i++) if (M.SCALES[i].id === scaleId) { sc = M.SCALES[i]; break; }
    if (!sc) return [];
    var out = [mod12(rootPc)], cur = mod12(rootPc);
    for (var k = 0; k < sc.steps.length - 1; k++) {
      cur = mod12(cur + sc.steps[k]);
      out.push(cur);
    }
    return out;
  };

  /* ---------- 順階和弦（調內三和弦/七和弦） ---------- */
  M.diatonic = function (rootPc, mode) {
    // mode: 'major' | 'natmin'
    var steps = mode === 'major' ? [2, 2, 1, 2, 2, 2, 1] : [2, 1, 2, 2, 1, 2, 2];
    var triadQ = mode === 'major' ? ['maj', 'min', 'min', 'maj', 'maj', 'min', 'dim']
                                 : ['min', 'dim', 'maj', 'min', 'min', 'maj', 'maj'];
    var sevenQ = mode === 'major' ? ['maj7', 'm7', 'm7', 'maj7', '7', 'm7', 'm7b5']
                                 : ['m7', 'm7b5', 'maj7', 'm7', 'm7', 'maj7', '7'];
    var romans = mode === 'major' ? ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°']
                                  : ['i', 'ii°', 'III', 'iv', 'v', 'VI', 'VII'];
    var out = [], pc = mod12(rootPc);
    for (var d = 0; d < 7; d++) {
      out.push({
        degree: d + 1, roman: romans[d],
        root: pc, triad: triadQ[d], seventh: sevenQ[d],
        name: M.pcName(pc) + triadQ[d],
        name7: M.pcName(pc) + sevenQ[d]
      });
      pc = mod12(pc + steps[d]);
    }
    return out;
  };

  /* ---------- 和弦 → 指法（voicing）搜尋 ---------- */
  // 指法資料庫：常見開放/封閉和弦（弦序 0=低E … 5=高e；null=不彈，0=空弦）
  M.VOICINGS = {
    'C:maj':    [[null,3,2,0,1,0], [3,3,2,0,1,0]],
    'C:maj7':   [[null,3,2,0,0,0]],
    'C:maj9':   [[null,3,2,0,3,0]],
    'C:6':      [[null,3,2,2,1,0]],
    'C:sus4':   [[null,3,3,0,1,0]],
    'C:add9':   [[null,3,2,0,3,0]],
    'C:min':    [[null,null,5,5,4,3], [3,3,5,5,4,3]],
    'C:m7':     [[null,null,5,5,3,3], [3,3,5,3,3,3]],
    'C:7':      [[null,3,2,3,1,0]],
    'C:dim':    [[null,null,3,4,2,3]],

    'C#:maj':   [[4,6,6,5,4,4]],
    'C#:min':   [[4,6,6,4,4,4]],
    'C#:7':     [[4,6,4,6,4,4]],
    'C#:m7':    [[4,6,4,6,4,4]],

    'D:maj':    [[null,null,0,2,3,2], [5,7,7,7,5,5]],
    'D:maj7':   [[null,null,0,2,2,2]],
    'D:min':    [[null,null,0,2,3,1]],
    'D:min7':   [[null,null,0,2,1,1]],
    'D:m7':     [[null,null,0,2,1,1]],
    'D:7':      [[null,null,0,2,1,2]],
    'D:sus4':   [[null,null,0,2,3,3]],
    'D:6':      [[null,null,0,2,0,2]],

    'D#:maj':   [[6,8,8,8,6,6]],
    'D#:min':   [[6,8,8,6,6,6]],
    'D#:m7':    [[6,8,6,8,6,6]],

    'E:maj':    [[0,2,2,1,0,0], [7,9,9,8,7,7]],
    'E:min':    [[0,2,2,0,0,0]],
    'E:min7':   [[0,2,0,0,0,0]],
    'E:m7':     [[0,2,0,0,0,0]],
    'E:7':      [[0,2,0,1,0,0]],
    'E:maj7':   [[0,2,1,1,0,0]],

    'F:maj':    [[1,3,3,2,1,1], [null,null,3,2,1,1]],
    'F:maj7':   [[null,null,3,2,1,0]],
    'F:min':    [[1,3,3,1,1,1]],
    'F:m7':     [[1,3,1,1,1,1]],
    'F:7':      [[1,3,1,2,1,1]],

    'F#:maj':   [[2,4,4,3,2,2]],
    'F#:min':   [[2,4,4,2,2,2]],
    'F#:m7':    [[2,4,2,2,2,2]],
    'F#:7':     [[2,4,2,3,2,2]],

    'G:maj':    [[3,2,0,0,0,3], [3,2,0,0,3,3]],
    'G:7':      [[3,2,0,0,0,1]],
    'G:maj7':   [[3,2,0,0,0,2]],
    'G:min':    [[3,5,5,3,3,3]],
    'G:m7':     [[3,5,3,3,3,3]],
    'G:sus4':   [[3,3,0,0,1,3]],

    'G#:maj':   [[4,6,6,5,4,4]],
    'G#:min':   [[4,6,6,4,4,4]],
    'G#:m7':    [[4,6,4,4,4,4]],

    'A:maj':    [[null,0,2,2,2,0], [5,7,7,6,5,5]],
    'A:maj7':   [[null,0,2,1,2,0]],
    'A:min':    [[null,0,2,2,1,0]],
    'A:m7':     [[null,0,2,0,1,0]],
    'A:7':      [[null,0,2,0,2,0]],
    'A:sus4':   [[null,0,2,2,3,0]],

    'A#:maj':   [[6,8,8,7,6,6]],
    'A#:min':   [[6,8,8,6,6,6]],
    'A#:7':     [[6,8,6,7,6,6]],

    'B:maj':    [[7,9,9,8,7,7]],
    'B:min':    [[null,2,4,4,3,2], [7,9,9,7,7,7]],
    'B:m7':     [[null,2,0,2,0,2]],
    'B:7':      [[null,2,1,2,0,2]],
    'B:min7':   [[null,2,0,2,0,2]]
  };

  // 別名統一（Dm → D:min 用 m；m7 與 min7 合併）
  function voicingKey(rootPc, typeId) {
    return M.pcName(rootPc) + ':' + typeId;
  }

  /* 查內建指法；找不到回 null。可選 preferFlat 用 b 音名查 */
  M.getVoicing = function (rootPc, typeId, preferFlat) {
    var key = (preferFlat ? M.pcName(rootPc, true) : M.pcName(rootPc)) + ':' + typeId;
    var alt = M.pcName(rootPc) + ':' + typeId;
    var v = M.VOICINGS[key] || M.VOICINGS[alt] || null;
    return v ? v[0].slice() : null;
  };

  /* 指法 → 實際 MIDI 音 */
  M.voicingToMidis = function (frets) {
    // frets[0] = 低音E弦
    var out = [];
    for (var i = 0; i < 6; i++) {
      var f = frets[i];
      if (f === null || f === undefined) continue;
      out.push(M.OPEN_STRINGS[i] + f);
    }
    return out;
  };

  /* 依 MIDI 音集合猜和弦（供編輯器命名）: 回候選陣列 [{root, typeId, name, score}] */
  M.identify = function (midis) {
    var pcsSet = {};
    midis.forEach(function (m) { pcsSet[mod12(m)] = true; });
    var pcs = Object.keys(pcsSet).map(Number);
    var cands = [];
    for (var r = 0; r < 12; r++) {
      for (var t = 0; t < M.CHORD_TYPES.length; t++) {
        var ct = M.CHORD_TYPES[t];
        var ivs = ct.iv;
        // 評分：所有和弦音都在，且沒有太多非和弦音
        var inCount = 0, extra = 0;
        ivs.forEach(function (iv) { if (pcsSet[mod12(r + iv)]) inCount++; });
        pcs.forEach(function (pc) {
          var isChordTone = ivs.some(function (iv) { return mod12(r + iv) === pc; });
          if (!isChordTone) extra++;
        });
        if (inCount === 0) continue;
        var cover = inCount / ivs.length;
        var penalty = extra * 0.35;
        var bassBonus = (mod12(midis[0] || midis[midis.length - 1]) === r) ? 0.15 : 0;
        var sizeBonus = (pcs.length <= ivs.length + 1) ? 0.1 : 0;
        var score = cover - penalty + bassBonus + sizeBonus;
        if (cover >= 0.99 && extra <= 1) {
          cands.push({ root: r, typeId: ct.id, name: M.pcName(r) + ct.suffix, score: score });
        }
      }
    }
    cands.sort(function (a, b) { return b.score - a.score; });
    return cands.slice(0, 5);
  };

  /* ---------- 段落用途的常用進行 ---------- */
  M.PROGRESSIONS = [
    { id: 'pop1645', name: '流行經典 I-V-vi-IV', degrees: [1, 5, 6, 4], mode: 'major', example: '週末夜路、公路歌的萬用進行' },
    { id: 'sad6415', name: '抒情反向 vi-IV-I-V', degrees: [6, 4, 1, 5], mode: 'major', example: '副歌爆發前常用' },
    { id: 'jazz251', name: '爵士 ii-V-I', degrees: [2, 5, 1], mode: 'major', example: '爵士標準曲核心' },
    { id: 'canon', name: '卡農進行 I-V-vi-iii-IV-I-IV-V', degrees: [1, 5, 6, 3, 4, 1, 4, 5], mode: 'major', example: '跨界流行都愛用' },
    { id: 'blues12', name: '藍調 12 小節', degrees: [1, 1, 1, 1, 4, 4, 1, 1, 5, 4, 1, 1], mode: 'major', example: '十二小節循環，屬七和弦' },
    { id: 'pop4536', name: '日系進行 IV-V-iii-vi', degrees: [4, 5, 3, 6], mode: 'major', example: 'J-pop 與華語抒情常見' }
  ];

  /* 依級數取得調內和弦（1-based） */
  M.degreeChord = function (rootPc, mode, degree) {
    var dia = M.diatonic(rootPc, mode);
    var d = dia[(degree - 1 + 7) % 7];
    return { root: d.root, typeId: d.triad, seventh: d.seventh, name: d.name, name7: d.name7, roman: d.roman };
  };

  /* 指板：弦 s（0..5）、格 f → MIDI */
  M.fretToMidi = function (s, f) { return M.OPEN_STRINGS[s] + f; };

  /* 音名標籤（含八度） */
  M.midiName = function (midi, preferFlat) {
    var pc = mod12(midi), oct = Math.floor(midi / 12) - 1;
    return M.pcName(pc, preferFlat) + oct;
  };

  window.GLmusic = M;
})();
