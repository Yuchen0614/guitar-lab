/* 吉他實驗室 — 音訊分析核心（M3）
   解碼 → 降取樣 → FFT → chroma(PCP) → 和弦辨識（樣板 / Viterbi）→ 分段
   參考：@audio/mir-chord（24 樣板 + Viterbi）、FMP C5（HMM 和弦辨識） */
(function () {
  'use strict';

  var AC = {};
  var M = window.GLmusic;

  /* ================= 解碼與降取樣 ================= */

  /* 檔案 → AudioBuffer（Web Audio 原生解碼，支援 mp3/wav/m4a/ogg/flac 視瀏覽器） */
  AC.decodeFile = function (file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onerror = function () { reject(new Error('檔案讀取失敗')); };
      reader.onload = function () {
        var c = new (window.AudioContext || window.webkitAudioContext)();
        c.decodeAudioData(reader.result, function (buf) {
          c.close();
          resolve(buf);
        }, function (e) {
          c.close();
          reject(new Error('瀏覽器無法解碼這個音訊格式（試試 mp3 / wav / m4a）'));
        });
      };
      reader.readAsArrayBuffer(file);
    });
  };

  AC.decodeBytes = function (arrayBuffer) {
    return new Promise(function (resolve, reject) {
      var c = new (window.AudioContext || window.webkitAudioContext)();
      c.decodeAudioData(arrayBuffer, function (buf) { c.close(); resolve(buf); },
        function () { c.close(); reject(new Error('音訊解碼失敗')); });
    });
  };

  /* 立體聲混合 → 單聲道 Float32Array */
  AC.toMono = function (buf) {
    var ch = buf.numberOfChannels, n = buf.length;
    var out = new Float32Array(n);
    for (var c = 0; c < ch; c++) {
      var d = buf.getChannelData(c);
      for (var i = 0; i < n; i++) out[i] += d[i] / ch;
    }
    return out;
  };

  /* 線性內插降取樣（44.1k/48k → 22050） */
  AC.downsample = function (mono, srFrom, srTo) {
    if (srFrom === srTo) return mono;
    if (srFrom < srTo) return mono;
    var ratio = srFrom / srTo;
    var nOut = Math.floor(mono.length / ratio);
    var out = new Float32Array(nOut);
    for (var i = 0; i < nOut; i++) {
      var pos = i * ratio;
      var i0 = Math.floor(pos);
      var frac = pos - i0;
      var a = mono[i0], b = mono[Math.min(i0 + 1, mono.length - 1)];
      out[i] = a + (b - a) * frac;
    }
    return out;
  };

  /* 裁掉頭尾靜音（靜音幀的 chroma 是雜訊，會汙染辨識） */
  AC.trimSilence = function (mono, thr) {
    thr = thr || 0.008;
    var s = 0, e = mono.length - 1;
    while (s < mono.length && Math.abs(mono[s]) < thr) s++;
    while (e > s && Math.abs(mono[e]) < thr) e--;
    if (e <= s) return mono;
    return mono.subarray(s, e + 1);
  };

  /* ================= FFT ================= */

  var hannCache = {};
  function hann(n) {
    if (!hannCache[n]) {
      var w = new Float32Array(n);
      for (var i = 0; i < n; i++) w[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / n);
      hannCache[n] = w;
    }
    return hannCache[n];
  }

  /* 迭代式 radix-2 FFT（in-place） */
  function fft(re, im) {
    var n = re.length;
    for (var i = 1, j = 0; i < n; i++) {
      var bit = n >> 1;
      for (; j & bit; bit >>= 1) j ^= bit;
      j ^= bit;
      if (i < j) {
        var tr = re[i]; re[i] = re[j]; re[j] = tr;
        var ti = im[i]; im[i] = im[j]; im[j] = ti;
      }
    }
    for (var len = 2; len <= n; len <<= 1) {
      var ang = -2 * Math.PI / len;
      var wr = Math.cos(ang), wi = Math.sin(ang);
      var half = len >> 1;
      for (var i2 = 0; i2 < n; i2 += len) {
        var cwr = 1, cwi = 0;
        for (var k = 0; k < half; k++) {
          var ur = re[i2 + k], ui = im[i2 + k];
          var xr = re[i2 + k + half], xi = im[i2 + k + half];
          var vr = xr * cwr - xi * cwi;
          var vi = xr * cwi + xi * cwr;
          re[i2 + k] = ur + vr; im[i2 + k] = ui + vi;
          re[i2 + k + half] = ur - vr; im[i2 + k + half] = ui - vi;
          var nwr = cwr * wr - cwi * wi;
          cwi = cwr * wi + cwi * wr;
          cwr = nwr;
        }
      }
    }
  }

  /* ================= Chroma (PCP) ================= */

  /* frames: Float32Array[]，每幀 12-bin chroma */
  AC.chromaFrames = function (mono, sr, opts, onProgress) {
    opts = opts || {};
    var N = opts.frameSize || 4096;
    var hop = opts.hop || 2048;
    var fMin = 55, fMax = 5000;
    var win = hann(N);
    var frames = [];
    var re = new Float32Array(N), im = new Float32Array(N);
    // 預先算好每個 bin 的 pitch class
    var binPc = new Int8Array(N / 2);
    for (var k = 1; k < N / 2; k++) {
      var f = k * sr / N;
      if (f < fMin || f > fMax) { binPc[k] = -1; continue; }
      var midiF = 69 + 12 * Math.log2(f / 440);
      binPc[k] = ((Math.round(midiF) % 12) + 12) % 12;
    }
    var total = Math.max(0, Math.floor((mono.length - N) / hop));
    for (var start = 0; start + N <= mono.length; start += hop) {
      for (var i = 0; i < N; i++) { re[i] = mono[start + i] * win[i]; im[i] = 0; }
      fft(re, im);
      var ch = new Float32Array(12);
      for (var k2 = 1; k2 < N / 2; k2++) {
        var pc = binPc[k2];
        if (pc < 0) continue;
        var mag = Math.sqrt(re[k2] * re[k2] + im[k2] * im[k2]);
        ch[pc] += Math.sqrt(mag); // 壓縮動態範圍
      }
      // L2 正規化
      var s = 0;
      for (var q = 0; q < 12; q++) s += ch[q] * ch[q];
      s = Math.sqrt(s) || 1;
      for (var q2 = 0; q2 < 12; q2++) ch[q2] /= s;
      frames.push(ch);
      if (onProgress && frames.length % 200 === 0) onProgress(frames.length / total);
    }
    return { frames: frames, frameDur: hop / sr, total: total };
  };

  /* ================= 和弦樣板 ================= */

  AC.templates24 = function (extended) {
    var ids = [['maj', ''], ['min', 'm']];
    if (extended) ids = ids.concat([['7', '7'], ['m7', 'm7'], ['maj7', 'maj7'], ['dim', 'dim']]);
    var out = [];
    for (var r = 0; r < 12; r++) {
      ids.forEach(function (p) {
        var ct = null;
        for (var i = 0; i < M.CHORD_TYPES.length; i++) if (M.CHORD_TYPES[i].id === p[0]) { ct = M.CHORD_TYPES[i]; break; }
        var v = new Float32Array(12);
        ct.iv.forEach(function (iv, idx) { v[(r + iv) % 12] = idx === 0 ? 1.3 : 1.0; }); // 根音加權
        out.push({ root: r, typeId: p[0], name: M.pcName(r) + p[1], v: v });
      });
    }
    return out;
  };

  /* 每幀樣板比對 → 機率矩陣（softmax 正規化，幀內總和為 1）
     這讓 Viterbi 的 emission 量級與轉移機率可比，log 域才不會失衡 */
  AC.templateScores = function (frames, templates, sharpness) {
    sharpness = sharpness || 14;
    var K = templates.length;
    var probs = [];
    frames.forEach(function (ch) {
      var row = new Float64Array(K);
      var maxDot = -Infinity;
      var dots = new Float64Array(K);
      for (var t = 0; t < K; t++) {
        var v = templates[t].v;
        var dot = 0;
        for (var q = 0; q < 12; q++) dot += ch[q] * v[q];
        dots[t] = dot * sharpness;
        if (dots[t] > maxDot) maxDot = dots[t];
      }
      var sum = 0;
      for (var t2 = 0; t2 < K; t2++) {
        var e = Math.exp(dots[t2] - maxDot); // 數值穩定
        row[t2] = e;
        sum += e;
      }
      for (var t3 = 0; t3 < K; t3++) row[t3] /= sum;
      probs.push(row);
    });
    return probs;
  };

  /* ================= Viterbi ================= */

  AC.viterbi = function (probs, templates, selfBias) {
    selfBias = selfBias === undefined ? 0.6 : selfBias;
    var K = templates.length, T = probs.length;
    if (!T) return [];
    // 轉移：留 = selfBias；走 = 均分（可加五度圈鄰居加權）
    var move = (1 - selfBias) / (K - 1);
    var moveNeighbors = move * 1.6, moveOther = move * 0.7;
    // 先算好每個 chord 的五度圈鄰居 index
    var rootOf = templates.map(function (t) { return t.root; });
    var typeOf = templates.map(function (t) { return t.typeId; });
    function isNeighbor(a, b) {
      // 根音差 ±5 semitones（上下五度）且同性質，視為鄰居
      var d = Math.abs(rootOf[a] - rootOf[b]);
      d = Math.min(d, 12 - d);
      return d === 5 && typeOf[a] === typeOf[b];
    }
    var LOG_MIN = -1e9;
    var dp = new Float64Array(K), prev = new Int16Array(T * K);
    var row = new Float64Array(K), next = new Float64Array(K);
    var max0 = -Infinity;
    for (var t0 = 0; t0 < K; t0++) { dp[t0] = Math.log(probs[0][t0] + 1e-9); if (dp[t0] > max0) max0 = dp[t0]; }
    for (var t1 = 0; t1 < T - 1; t1++) {
      var p = probs[t1];
      // 取樣本友善的近似：先正規化這幀分數
      var mx = -Infinity;
      for (var c = 0; c < K; c++) if (p[c] > mx) mx = p[c];
      for (var to = 0; to < K; to++) {
        var bestScore = LOG_MIN, bestFrom = 0;
        var pTo = Math.log(p[to] - mx * 0 + 1e-9); // 相對分數
        for (var from = 0; from < K; from++) {
          var trans = (from === to) ? selfBias : (isNeighbor(from, to) ? moveNeighbors : moveOther);
          var score = dp[from] + Math.log(trans);
          if (score > bestScore) { bestScore = score; bestFrom = from; }
        }
        next[to] = bestScore + pTo;
        prev[(t1 + 1) * K + to] = bestFrom;
      }
      var tmp = dp; dp = next; next = tmp;
    }
    // 回溯
    var bestLast = 0;
    for (var l = 1; l < K; l++) if (dp[l] > dp[bestLast]) bestLast = l;
    var path = new Array(T);
    path[T - 1] = bestLast;
    for (var t2 = T - 1; t2 > 0; t2--) {
      path[t2 - 1] = prev[t2 * K + path[t2]];
    }
    return path;
  };

  /* 樣板直接 argmax 路徑 */
  AC.argmaxPath = function (probs, templates) {
    var out = [];
    probs.forEach(function (row) {
      var bi = 0;
      for (var t = 1; t < row.length; t++) if (row[t] > row[bi]) bi = t;
      out.push(bi);
    });
    return out;
  };

  /* ================= 分段合併 ================= */

  /* 眾數濾波：把被夾在中間的孤立短段改成兩側較長段的值（半窗 w 幀） */
  AC.modeFilter = function (path, templates, w) {
    w = w || 2;
    var out = path.slice();
    for (var i = 0; i < path.length; i++) {
      // 若與前一幀和後一幀都不同 → 候選污染幀
      var samePrev = i > 0 && path[i - 1] === path[i];
      var sameNext = i < path.length - 1 && path[i + 1] === path[i];
      if (samePrev || sameNext) continue;
      // 統計窗口內眾數（排除自己）
      var counts = {};
      for (var j = Math.max(0, i - w); j <= Math.min(path.length - 1, i + w); j++) {
        if (j === i) continue;
        counts[path[j]] = (counts[path[j]] || 0) + 1;
      }
      var best = -1, bestN = 0;
      for (var k in counts) {
        if (counts[k] > bestN) { bestN = counts[k]; best = +k; }
      }
      if (best >= 0 && bestN >= w) out[i] = best;
    }
    return out;
  };

  AC.segments = function (path, templates, frameDur, opts) {
    opts = opts || {};
    var minSec = opts.minSec || 0.4; // 短於此的段落併入前一段
    var segs = [];
    var cur = { i0: 0, i1: 0, t: path[0] };
    for (var i = 1; i < path.length; i++) {
      if (path[i] === cur.t) cur.i1 = i;
      else { segs.push(cur); cur = { i0: i, i1: i, t: path[i] }; }
    }
    segs.push(cur);
    // 合併太短的（併入前一段；開頭的短段保留等下一步處理）
    var merged = [];
    segs.forEach(function (s) {
      var dur = (s.i1 - s.i0 + 1) * frameDur;
      if (merged.length && dur < minSec) {
        merged[merged.length - 1].i1 = s.i1;
      } else {
        merged.push(s);
      }
    });
    // 合併相鄰同型
    var filled = [];
    merged.forEach(function (s) {
      if (filled.length && s.t === filled[filled.length - 1].t) {
        filled[filled.length - 1].i1 = s.i1;
      } else {
        filled.push(s);
      }
    });
    return filled.map(function (s) {
      var tpl = templates[s.t];
      return {
        start: +(s.i0 * frameDur).toFixed(2),
        end: +((s.i1 + 1) * frameDur).toFixed(2),
        root: tpl.root, typeId: tpl.typeId, name: tpl.name
      };
    });
  };

  /* ================= 調性估計（Krumhansl） ================= */
  var KK_MAJ = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
  var KK_MIN = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];
  AC.estimateKey = function (frames) {
    var avg = new Float64Array(12);
    frames.forEach(function (f) { for (var i = 0; i < 12; i++) avg[i] += f[i]; });
    for (var i = 0; i < 12; i++) avg[i] /= frames.length || 1;
    var best = { corr: -2 };
    for (var r = 0; r < 12; r++) {
      [['大調', KK_MAJ], ['小調', KK_MIN]].forEach(function (mm) {
        var prof = mm[1], dot = 0, na = 0, np = 0;
        for (var q = 0; q < 12; q++) {
          var a = avg[(r + q) % 12];
          dot += a * prof[q]; na += a * a; np += prof[q] * prof[q];
        }
        var corr = dot / (Math.sqrt(na * np) || 1);
        if (corr > best.corr) best = { corr: corr, root: r, mode: mm[0], name: M.pcName(r) + ' ' + mm[0] };
      });
    }
    return best;
  };

  /* ================= 示範音訊（離線渲染 I-V-vi-IV） ================= */
  /* 音域選擇：低音聲部突出根音（root 加強），高音聲部用封閉位避免與鄰和弦共享過多音 */
  AC.renderDemo = function () {
    var sr = 22050, beatDur = 0.5, barDur = beatDur * 4;
    var prog = [
      [[36, 48, 52, 55], [64, 67]],   // C2 C3 E3 G3 + E4 G4
      [[31, 43, 47, 50], [59, 62]],   // G1 G2 B2 D3 + B3 D4
      [[33, 45, 48, 52], [60, 64]],   // A1 A2 C3 E3 + C4 E4
      [[29, 41, 45, 48], [57, 60]]    // F1 F2 A2 C3 + A3 C4
    ];
    var ctx = new OfflineAudioContext(1, Math.ceil(sr * barDur * 4 + sr), sr);
    prog.forEach(function (chord, bi) {
      var t0 = bi * barDur;
      chord[0].forEach(function (midi, ni) {
        var f = M.midiToFreq(midi);
        var osc = ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.value = f;
        var g = ctx.createGain();
        var t = t0 + ni * 0.012;
        var amp = ni === 0 ? 0.30 : 0.20; // 根音最強
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(amp, t + 0.02);
        g.gain.setValueAtTime(amp * 0.92, t + barDur - 0.08);
        g.gain.exponentialRampToValueAtTime(0.0001, t + barDur);
        osc.connect(g); g.connect(ctx.destination);
        osc.start(t); osc.stop(t + barDur + 0.05);
      });
      chord[1].forEach(function (midi, ni) {
        var f = M.midiToFreq(midi);
        var osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = f;
        var g = ctx.createGain();
        var t = t0 + 0.03 + ni * 0.012;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.12, t + 0.02);
        g.gain.setValueAtTime(0.11, t + barDur - 0.08);
        g.gain.exponentialRampToValueAtTime(0.0001, t + barDur);
        osc.connect(g); g.connect(ctx.destination);
        osc.start(t); osc.stop(t + barDur + 0.05);
      });
    });
    return ctx.startRendering();
  };

  window.GLaudio = AC;
})();
