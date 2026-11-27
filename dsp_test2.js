
const fs = require('fs');
const path = "C:/Users/admin/OneDrive/桌面/projects/guitar-lab/js/lib/music.js";
eval(fs.readFileSync(path, 'utf8').replace(/window\.GLmusic = M;/, 'global.GLmusic = M;'));
const M = global.GLmusic;
console.log('GLmusic loaded:', !!M, '| NOTES:', M.NOTES.length);

// --- FFT ---
function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { let t=re[i];re[i]=re[j];re[j]=t; t=im[i];im[i]=im[j];im[j]=t; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = -2 * Math.PI / len, wr = Math.cos(ang), wi = Math.sin(ang), half = len >> 1;
    for (let i2 = 0; i2 < n; i2 += len) {
      let cwr = 1, cwi = 0;
      for (let k = 0; k < half; k++) {
        const ur = re[i2+k], ui = im[i2+k], xr = re[i2+k+half], xi = im[i2+k+half];
        const vr = xr*cwr - xi*cwi, vi = xr*cwi + xi*cwr;
        re[i2+k] = ur+vr; im[i2+k] = ui+vi;
        re[i2+k+half] = ur-vr; im[i2+k+half] = ui-vi;
        const nwr = cwr*wr - cwi*wi; cwi = cwr*wi + cwi*wr; cwr = nwr;
      }
    }
  }
}

// --- 產生測試音訊：4 小節 C-G-Am-F，與 renderDemo 相同參數 ---
const sr = 22050, beatDur = 0.5, barDur = beatDur * 4;
const prog = [
  [[48,52,55],[60,64,67]],
  [[43,47,50],[55,59,62]],
  [[45,48,52],[57,60,64]],
  [[41,45,48],[53,57,60]]
];
const totalN = Math.ceil(sr * barDur * 4 + sr);
const mono = new Float32Array(totalN);
prog.forEach((chord, bi) => {
  const t0 = bi * barDur;
  chord[0].concat(chord[1]).forEach((midi, ni) => {
    const f = M.midiToFreq(midi);
    const t = t0 + (ni % 3) * 0.015;
    const iStart = Math.floor(t * sr);
    const dur = barDur;
    for (let i = 0; i < dur*sr; i++) {
      const tt = i / sr;
      if (tt < 0) continue;
      const idx = iStart + i;
      if (idx >= totalN) break;
      // envelope: fast attack, sustain, release
      let env;
      if (tt < 0.02) env = tt / 0.02;
      else if (tt < barDur - 0.1) env = 1;
      else env = (barDur - tt) / 0.1;
      const wave = ni < 3 ? Math.sin(2*Math.PI*f*tt) * 0.7 + 0.3*Math.sin(4*Math.PI*f*tt)  // triangle-ish
                          : Math.sin(2*Math.PI*f*tt);
      mono[idx] += wave * 0.22 * env;
    }
  });
});
console.log('audio generated:', mono.length, 'samples');

// --- chroma ---
const N = 4096, hop = 2048, fMin = 55, fMax = 5000;
const win = new Float32Array(N);
for (let i = 0; i < N; i++) win[i] = 0.5 - 0.5 * Math.cos(2*Math.PI*i/N);
const binPc = new Int8Array(N/2);
for (let k = 1; k < N/2; k++) {
  const f = k * sr / N;
  if (f < fMin || f > fMax) { binPc[k] = -1; continue; }
  const midiF = 69 + 12*Math.log2(f/440);
  binPc[k] = ((Math.round(midiF) % 12) + 12) % 12;
}
const frames = [];
const re = new Float32Array(N), im = new Float32Array(N);
for (let start = 0; start + N <= mono.length; start += hop) {
  for (let i = 0; i < N; i++) { re[i] = mono[start+i]*win[i]; im[i] = 0; }
  fft(re, im);
  const ch = new Float32Array(12);
  for (let k = 1; k < N/2; k++) {
    const pc = binPc[k];
    if (pc < 0) continue;
    const mag = Math.sqrt(re[k]*re[k] + im[k]*im[k]);
    ch[pc] += Math.sqrt(mag);
  }
  let s = 0; for (let q=0;q<12;q++) s += ch[q]*ch[q];
  s = Math.sqrt(s) || 1;
  for (let q=0;q<12;q++) ch[q] /= s;
  frames.push(ch);
}
console.log('frames:', frames.length, 'frameDur:', (hop/sr).toFixed(3));

// 檢查第 4 小節（F）的 chroma
const frameDur = hop / sr;
const f4start = Math.floor(3*barDur / frameDur);
const f4 = frames[f4start + 5];
console.log('F-section chroma top pcs:', [...f4].map((v,i)=>[i,+v.toFixed(2)]).sort((a,b)=>b[1]-a[1]).slice(0,5));

// --- 樣板比對 ---
function pcName(pc) { return M.pcName(pc); }
const ids = [['maj',''],['min','m']];
const templates = [];
for (let r = 0; r < 12; r++) {
  ids.forEach(p => {
    const ct = M.CHORD_TYPES.find(c => c.id === p[0]);
    const v = new Float32Array(12);
    ct.iv.forEach((iv, idx) => { v[(r+iv)%12] = idx === 0 ? 1.3 : 1.0; });
    templates.push({ root: r, typeId: p[0], name: pcName(r)+p[1], v });
  });
}
// 每小節中段的 best template
for (let bar = 0; bar < 4; bar++) {
  const fi = Math.floor((bar*barDur + barDur/2) / frameDur);
  const ch = frames[fi];
  let best = -1, bi = 0;
  const scores = templates.map((t, ti) => {
    let dot = 0; for (let q=0;q<12;q++) dot += ch[q]*t.v[q];
    return dot;
  });
  const sorted = scores.map((s,i)=>[s,i]).sort((a,b)=>b[0]-a[0]);
  console.log('bar', bar, ':', templates[sorted[0][1]].name, '(2nd:', templates[sorted[1][1]].name + ')', 'scores:', sorted.slice(0,3).map(x=>x[0].toFixed(3)).join(', '));
}

console.log('\n--- bar3 逐幀 argmax ---');
const row = [];
const f3 = Math.floor(3*barDur/frameDur), f4 = Math.floor(4*barDur/frameDur)+4;
for (let fi = f3; fi < Math.min(f4, frames.length); fi++) {
  const ch = frames[fi];
  let best = -2, bi = 0;
  templates.forEach((t, ti) => {
    let dot = 0; for (let q=0;q<12;q++) dot += ch[q]*t.v[q];
    if (dot > best) { best = dot; bi = ti; }
  });
  row.push(templates[bi].name);
}
console.log(row.join(','));
