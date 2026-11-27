/* 吉他實驗室 — 段落結構分析引擎（純函式庫，無 UI）
   方法：Foote (2000) 自相似矩陣 + 棋盤核 novelty 曲線 + 峰值偵測
   參考：FormFinder (josmithiii, MIT)、SSMNet (Peeters ISMIR2023)、
         Mauch et al. ISMIR2009 chroma SSM 段落法
   全部純 JS，接收 chroma 幀陣列（來自 audio-core.chromaFrames） */
(function () {
  'use strict';

  var SS = {};

  function dot(a, b) {
    var s = 0;
    for (var i = 0; i < a.length; i++) s += a[i] * b[i];
    return s;
  }
  function norm(a) {
    var s = 0;
    for (var i = 0; i < a.length; i++) s += a[i] * a[i];
    return Math.sqrt(s) || 1;
  }
  //餘弦相似
  function cos(a, b) {
    return dot(a, b) / (norm(a) * norm(b));
  }

  /* ---------- 自相似矩陣 SSM ----------
     frames: Float32Array(12)[]，回傳 N×N 陣列（row-major Float64Array） */
  SS.selfSimilarity = function (frames) {
    var n = frames.length;
    var m = new Float64Array(n * n);
    for (var i = 0; i < n; i++) {
      for (var j = i; j < n; j++) {
        var v = cos(frames[i], frames[j]);
        m[i * n + j] = v;
        m[j * n + i] = v;
      }
    }
    return { m: m, n: n };
  };

  /* ---------- Foote 棋盤核 novelty ----------
     核大小 k（幀數，預設 ~8 秒 / frameDur）
     沿主對角線卷積：nov(t) = Σ kernel(a,b) * SSM[t+a][t+b] */
  SS.novelty = function (ssm, frameDur, opts) {
    opts = opts || {};
    var n = ssm.n, m = ssm.m;
    var kSec = opts.kernelSec || 8;
    var k = Math.max(3, Math.round(kSec / frameDur));
    if (k % 2 === 0) k++;
    var half = (k - 1) / 2;
    // 棋盤核：左上/右下 +1，右上/左下 -1
    var kern = new Float64Array(k * k);
    for (var a = 0; a < k; a++) {
      for (var b = 0; b < k; b++) {
        var sa = a < half ? -1 : (a > half ? 1 : 0);
        var sb = b < half ? -1 : (b > half ? 1 : 0);
        kern[a * k + b] = sa * sb; // (+1 左上/右下, -1 右上/左下)
      }
    }
    var nov = new Float64Array(n);
    for (var t = half; t < n - half; t++) {
      var acc = 0, cnt = 0;
      for (var a = -half; a <= half; a++) {
        for (var b = -half; b <= half; b++) {
          acc += kern[(a + half) * k + (b + half)] * m[(t + a) * n + (t + b)];
          cnt++;
        }
      }
      nov[t] = acc / cnt;
    }
    // 左半場補 0，右半場同理（邊界無法卷積）
    return { novelty: nov, k: k, half: half };
  };

  /* ---------- 峰值偵測（邊界） ----------
     策略：novelty 先做局部平均平滑，找局部最大值且超過
     (全域平均 + thresholdRatio × 全域標準差)，最小間隔 minGapSec */
  SS.peakPick = function (nov, frameDur, opts) {
    opts = opts || {};
    var n = nov.length;
    var smoothW = Math.max(1, Math.round((opts.smoothSec || 1.5) / frameDur));
    var sm = new Float64Array(n);
    for (var i = 0; i < n; i++) {
      var lo = Math.max(0, i - smoothW), hi = Math.min(n - 1, i + smoothW);
      var s = 0;
      for (var j = lo; j <= hi; j++) s += nov[j];
      sm[i] = s / (hi - lo + 1);
    }
    var mean = 0;
    for (var i2 = 0; i2 < n; i2++) mean += sm[i2];
    mean /= n;
    var sd = 0;
    for (var i3 = 0; i3 < n; i3++) sd += (sm[i3] - mean) * (sm[i3] - mean);
    sd = Math.sqrt(sd / n);
    var thr = mean + (opts.thresholdRatio != null ? opts.thresholdRatio : 0.9) * sd;
    var minGap = Math.max(1, Math.round((opts.minGapSec || 4) / frameDur));
    var peaks = [];
    for (var t = 1; t < n - 1; t++) {
      if (sm[t] >= thr && sm[t] >= sm[t - 1] && sm[t] > sm[t + 1]) {
        if (peaks.length && t - peaks[peaks.length - 1] < minGap) {
          if (sm[t] > sm[peaks[peaks.length - 1]]) peaks[peaks.length - 1] = t;
        } else {
          peaks.push(t);
        }
      }
    }
    return { peaks: peaks, smoothed: sm, threshold: thr, mean: mean, sd: sd };
  };

  /* ---------- 段落標記（A/B/C 重複結構） ----------
     用 SSM 的區塊平均相似度做凝聚分群：
     以邊界把歌切成段，計算段間平均相似度，相似度高於門檻者同字母 */
  SS.labelSections = function (ssm, boundaries, opts) {
    opts = opts || {};
    var n = ssm.n, m = ssm.m;
    // 段落 = [start, end)，邊界互不重疊
    var b = [0].concat(boundaries, [n]);
    var segs = [];
    for (var i = 0; i < b.length - 1; i++) {
      segs.push({ start: b[i], end: b[i + 1] });
    }
    // 段間平均相似度矩陣
    var k = segs.length;
    var sim = new Float64Array(k * k);
    for (var a = 0; a < k; a++) {
      for (var c = a; c < k; c++) {
        var s = 0, cnt = 0;
        var a0 = segs[a].start, a1 = segs[a].end;   // [a0, a1)
        var c0 = segs[c].start, c1 = segs[c].end;   // [c0, c1)
        // 採樣避免 O(n²)：每段最多取 40 幀
        var sa = Math.max(1, Math.floor((a1 - a0) / 40));
        var sc = Math.max(1, Math.floor((c1 - c0) / 40));
        for (var x = a0; x < a1; x += sa) {
          for (var y = c0; y < c1; y += sc) {
            s += m[x * n + y]; cnt++;
          }
        }
        var v = cnt ? s / cnt : 0;
        sim[a * k + c] = v;
        sim[c * k + a] = v;
      }
    }
    // 指派字母：每段先回頭比對前面段落，相似度高且長度相近者沿用其字母，否則給新字母
    var letters = new Array(k).fill(-1);
    var nextLetter = 0;
    var thr = opts.simThreshold != null ? opts.simThreshold : 0.72;
    for (var i2 = 0; i2 < k; i2++) {
      var lenI = segs[i2].end - segs[i2].start;
      var assigned = -1;
      for (var j = 0; j < i2; j++) {
        var lenJ = segs[j].end - segs[j].start;
        var lenRatio = Math.max(lenI, lenJ) / Math.max(1, Math.min(lenI, lenJ));
        if (sim[i2 * k + j] >= thr && lenRatio <= 1.6) { assigned = letters[j]; break; }
      }
      if (assigned < 0) assigned = nextLetter++;
      letters[i2] = assigned;
    }
    return segs.map(function (s, i) {
      s.letter = String.fromCharCode(65 + letters[i]);
      s.sim = i > 0 ? +sim[(i - 1) * k + i].toFixed(3) : null;
      return s;
    });
  };

  /* ---------- 一鍵完整分析 ---------- */
  SS.analyze = function (frames, frameDur, opts) {
    opts = opts || {};
    var ssm = SS.selfSimilarity(frames);
    var nv = SS.novelty(ssm, frameDur, opts);
    var pk = SS.peakPick(nv.novelty, frameDur, opts);
    var segs = SS.labelSections(ssm, pk.peaks, opts);
    return {
      ssm: ssm, novelty: nv, peaks: pk,
      segments: segs.map(function (s) {
        return {
          start: +(s.start * frameDur).toFixed(2),
          end: +((s.end + 1) * frameDur).toFixed(2),
          startFrame: s.start, endFrame: s.end,
          letter: s.letter, sim: s.sim
        };
      }),
      frameDur: frameDur,
      boundaryFrames: pk.peaks
    };
  };

  window.GLstructure = SS;
})();
