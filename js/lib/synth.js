/* 吉他實驗室 — Web Audio 合成器（撥弦、刷弦、節拍器、音感訓練音） */
(function () {
  'use strict';

  var S = {};
  var ctx = null;

  function ac() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  S.ctx = ac;

  /* 撥弦：Karplus-Strong 簡化版（三角波+指數衰減+低通），聽起來像尼龍弦 */
  S.pluck = function (freq, when, gain, pan) {
    var c = ac();
    var t = when || c.currentTime;
    var g = gain || 0.5;
    var osc = c.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    // 二次泛音增加亮度
    var osc2 = c.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.value = freq * 2;
    var g2 = c.createGain();
    g2.gain.value = 0.18;

    var env = c.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(g, t + 0.008);
    env.gain.exponentialRampToValueAtTime(0.0001, t + 2.2);

    var lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = Math.min(freq * 6, 6500);
    lp.Q.value = 0.7;

    var pn = c.createStereoPanner ? c.createStereoPanner() : null;
    var out = env;
    if (pn) { pn.pan.value = pan || 0; env.connect(lp); lp.connect(pn); pn.connect(c.destination); }
    else { env.connect(lp); lp.connect(c.destination); }

    osc.connect(env);
    osc2.connect(g2); g2.connect(env);
    osc.start(t); osc2.start(t);
    osc.stop(t + 2.4); osc2.stop(t + 2.4);
  };

  /* 刷弦（strum）：依間隔依序撥弦 */
  S.strum = function (freqs, dir, gap) {
    var c = ac();
    var t = c.currentTime + 0.02;
    var d = dir === 'up' ? freqs.slice().reverse() : freqs.slice();
    var step = gap || 0.028;
    d.forEach(function (f, i) {
      S.pluck(f, t + i * step, 0.42 - i * 0.02, (i / Math.max(1, d.length - 1)) * 0.5 - 0.25);
    });
  };

  /* 節拍器：短促 click */
  S.click = function (accent) {
    var c = ac();
    var t = c.currentTime;
    var osc = c.createOscillator();
    osc.type = 'square';
    osc.frequency.value = accent ? 1600 : 1050;
    var g = c.createGain();
    g.gain.setValueAtTime(accent ? 0.22 : 0.13, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
    osc.connect(g); g.connect(c.destination);
    osc.start(t); osc.stop(t + 0.07);
  };

  /* 提示音（測驗對/錯） */
  S.blip = function (good) {
    var c = ac();
    var t = c.currentTime;
    var o = c.createOscillator();
    o.type = 'sine';
    o.frequency.value = good ? 880 : 220;
    if (good) { o.frequency.setValueAtTime(880, t); o.frequency.setValueAtTime(1320, t + 0.09); }
    var g = c.createGain();
    g.gain.setValueAtTime(0.18, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    o.connect(g); g.connect(c.destination);
    o.start(t); o.stop(t + 0.24);
  };

  /* 播放一組 MIDI 音（同時發聲） */
  S.playMidis = function (midis, when, gain) {
    var c = ac();
    var t = when || c.currentTime + 0.02;
    midis.forEach(function (m, i) {
      S.pluck(GLmusic.midiToFreq(m), t, gain || 0.4, (i / Math.max(1, midis.length - 1)) * 0.6 - 0.3);
    });
  };

  /* 琶音（arpeggio） */
  S.arp = function (midis, gap) {
    var c = ac();
    var t = c.currentTime + 0.02;
    var g = gap || 0.16;
    midis.forEach(function (m, i) {
      S.pluck(GLmusic.midiToFreq(m), t + i * g, 0.45, 0);
    });
  };

  window.GLsynth = S;
})();
