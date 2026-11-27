/* 吉他實驗室 — Solo 樂句生成引擎（M5）
   方法參考 AutoLeadGuitar (McVicar et al. 2014)：以和弦內音為骨架、
   調性音階填充、經過音連接、樂句呼吸；把位連續性偏好避免亂跳把位
   生成結果：每拍事件 { start, dur, midi, string, fret, kind, technique } */
(function () {
  'use strict';

  var SG = {};
  var M = window.GLmusic;

  function mulberry32(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function positionsFor(midi, maxFret) {
    var opts = [];
    for (var s = 0; s < 6; s++) {
      var f = midi - M.OPEN_STRINGS[s];
      if (f >= 0 && f <= maxFret) opts.push({ string: s, fret: f });
    }
    return opts;
  }

  var RHYTHMS = {
    easy: [
      [1, 1, 2], [2, 1, 1], [1, 1, 1, 1], [2, 2], [4], [3, 1], [1, 3], [2, 1, 0.5, 0.5]
    ],
    medium: [
      [0.5, 0.5, 1, 2], [1, 0.5, 0.5, 2], [0.5, 0.5, 0.5, 0.5, 2],
      [1, 1, 0.5, 0.5, 1], [2, 0.5, 0.5, 1], [1.5, 0.5, 2],
      [0.5, 1.5, 2], [4], [0.5, 0.5, 1, 1, 1], [1, 2, 1]
    ],
    hard: [
      [0.5, 0.5, 0.5, 0.5, 1, 1], [0.25, 0.25, 0.5, 1, 2],
      [0.5, 0.25, 0.25, 0.5, 2.5], [1, 0.5, 0.25, 0.25, 2],
      [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 1], [2.5, 0.5, 1],
      [0.25, 0.25, 0.5, 0.5, 0.5, 0.5, 1.5], [4],
      [0.5, 0.5, 0.25, 0.25, 0.5, 0.5, 0.5, 0.5, 1]
    ]
  };

  function pickNext(cands, prevMidi, dir, rnd, chordToneBias) {
    if (!cands.length) return null;
    var scored = cands.map(function (c) {
      var s = c.weight || 1;
      if (c.kind === 'chord') s *= chordToneBias;
      var d = c.midi - prevMidi;
      if (dir !== 0 && d !== 0 && Math.sign(d) === dir) s *= 1.6;
      if (d === 0) s *= 0.15;
      var abs = Math.abs(d);
      if (abs >= 5) s *= 0.5;
      if (abs >= 8) s *= 0.5;
      s *= 0.7 + rnd() * 0.6;
      return { c: c, s: s };
    });
    scored.sort(function (a, b) { return b.s - a.s; });
    return scored[0].c;
  }

  function pickPosition(midi, prevPos, maxFret, centerFret, rnd) {
    var opts = positionsFor(midi, maxFret);
    if (!opts.length) return null;
    var best = null, bestScore = Infinity;
    opts.forEach(function (o) {
      var dPos = prevPos ? Math.abs(o.string - prevPos.string) + Math.abs(o.fret - prevPos.fret) * 0.7 : 0;
      var dCenter = Math.abs(o.fret - centerFret) * 0.35;
      var score = dPos + dCenter + rnd() * 0.8;
      if (score < bestScore) { bestScore = score; best = o; }
    });
    return best;
  }

  function chordType(id) {
    for (var i = 0; i < M.CHORD_TYPES.length; i++) {
      if (M.CHORD_TYPES[i].id === id) return M.CHORD_TYPES[i];
    }
    return null;
  }
  SG.chordType = chordType;

  SG.generate = function (prog, key, opts) {
    opts = opts || {};
    var difficulty = opts.difficulty || 'medium';
    var beatsPerBar = opts.beatsPerBar || 4;
    var barsPerChord = opts.barsPerChord || 1;
    var rnd = mulberry32(opts.seed || 12345);
    var maxFret = difficulty === 'easy' ? 12 : 17;
    var centerFret = opts.centerFret != null ? opts.centerFret : (difficulty === 'easy' ? 5 : 9);
    var chordToneBias = difficulty === 'easy' ? 2.2 : difficulty === 'medium' ? 1.6 : 1.3;

    var scalePcs = M.scalePcs(key.root, key.scaleId);

    var events = [];
    var barIndex = 0;
    var prevPos = null;
    var prevMidi = 64;
    var LOW = 52, HIGH = 86;

    prog.forEach(function (chord) {
      var parsed = { root: chord.root, type: chordType(chord.typeId) };
      if (!parsed.type) return;
      var chordPcs = M.chordPcs(parsed);
      var chordMidiSet = {};
      chordPcs.forEach(function (pc) {
        for (var oct = 4; oct <= 6; oct++) {
          var midi = 12 * oct + pc;
          if (midi >= LOW && midi <= HIGH) chordMidiSet[midi] = true;
        }
      });

      for (var b = 0; b < barsPerChord; b++, barIndex++) {
        var patterns = RHYTHMS[difficulty];
        var pat = patterns[Math.floor(rnd() * patterns.length)];
        var beatInBar = 0;
        var isPhraseEnd = (barIndex % 2 === 1);

        pat.forEach(function (dur, ei) {
          var startBeat = barIndex * beatsPerBar + beatInBar;
          beatInBar += dur;
          var isLastOfBar = ei === pat.length - 1;
          var wantChordTone = (ei === 0) || isLastOfBar || rnd() < 0.45;

          var cands = [];
          if (wantChordTone) {
            Object.keys(chordMidiSet).forEach(function (m) {
              cands.push({ midi: +m, kind: 'chord', weight: 1 });
            });
          } else {
            scalePcs.forEach(function (pc) {
              for (var oct = 4; oct <= 6; oct++) {
                var midi = 12 * oct + pc;
                if (midi >= LOW && midi <= HIGH) {
                  cands.push({
                    midi: midi,
                    kind: chordMidiSet[midi] ? 'chord' : 'scale',
                    weight: 1
                  });
                }
              }
            });
          }
          if (isPhraseEnd && isLastOfBar) {
            cands = Object.keys(chordMidiSet).map(function (m) {
              return { midi: +m, kind: 'chord', weight: 1 };
            });
          }

          var dir = rnd() < 0.5 ? 1 : -1;
          var picked = pickNext(cands, prevMidi, isPhraseEnd && isLastOfBar ? 0 : dir, rnd, chordToneBias);
          if (!picked) return;

          var pos = pickPosition(picked.midi, prevPos, maxFret, centerFret, rnd);
          if (!pos) return;

          var technique = null;
          if (difficulty !== 'easy' && isLastOfBar && rnd() < 0.25) {
            technique = rnd() < 0.5 ? 'bend' : 'slide';
          }

          events.push({
            start: startBeat,
            dur: dur,
            midi: picked.midi,
            string: pos.string,
            fret: pos.fret,
            kind: picked.kind,
            technique: technique
          });
          prevPos = pos;
          prevMidi = picked.midi;
        });
      }
    });
    return {
      events: events,
      beatsPerBar: beatsPerBar,
      totalBeats: barIndex * beatsPerBar,
      difficulty: difficulty,
      key: key
    };
  };

  window.GLsolo = SG;
})();
