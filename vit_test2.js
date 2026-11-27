
// 直接定義 M 所需的最低介面，不 load music.js
const M = {
  pcName: (pc, flat) => {
    const SHARP = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
    return SHARP[((pc%12)+12)%12];
  },
  CHORD_TYPES: [
    { id: 'maj', iv: [0,4,7], suffix: '' },
    { id: 'min', iv: [0,3,7], suffix: 'm' }
  ]
};

const ids = [['maj',''],['min','m']];
const templates = [];
for (let r = 0; r < 12; r++) {
  ids.forEach(p => {
    const ct = M.CHORD_TYPES.find(c => c.id === p[0]);
    const v = new Float32Array(12);
    ct.iv.forEach((iv, idx) => { v[(r+iv)%12] = idx === 0 ? 1.3 : 1.0; });
    templates.push({ root: r, typeId: p[0], name: M.pcName(r)+p[1], v });
  });
}

function probsFor(seq) {
  const probs = [];
  seq.forEach(name => {
    const ti = templates.findIndex(t => t.name === name);
    for (let f = 0; f < 24; f++) {
      const row = new Float32Array(templates.length);
      for (let t = 0; t < templates.length; t++) row[t] = (t === ti) ? 0.9 : 0.3;
      probs.push(row);
    }
  });
  return probs;
}

function viterbi(probs, templates, selfBias) {
  selfBias = selfBias === undefined ? 0.84 : selfBias;
  const K = templates.length, T = probs.length;
  if (!T) return [];
  const move = (1 - selfBias) / (K - 1);
  const moveNeighbors = move * 1.6, moveOther = move * 0.7;
  const rootOf = templates.map(t => t.root);
  const typeOf = templates.map(t => t.typeId);
  function isNeighbor(a, b) {
    let d = Math.abs(rootOf[a] - rootOf[b]);
    d = Math.min(d, 12 - d);
    return d === 5 && typeOf[a] === typeOf[b];
  }
  const LOG_MIN = -1e9;
  const dp = new Float64Array(K), prev = new Int16Array(T * K);
  const next = new Float64Array(K);
  for (let t0 = 0; t0 < K; t0++) dp[t0] = Math.log(probs[0][t0] + 1e-9);
  for (let t1 = 0; t1 < T - 1; t1++) {
    const p = probs[t1];
    const mx = -Infinity;
    for (let c = 0; c < K; c++) if (p[c] > mx) mx = p[c];
    for (let to = 0; to < K; to++) {
      let bestScore = LOG_MIN, bestFrom = 0;
      const pTo = Math.log(p[to] + 1e-9);
      for (let from = 0; from < K; from++) {
        const trans = (from === to) ? selfBias : (isNeighbor(from, to) ? moveNeighbors : moveOther);
        const score = dp[from] + Math.log(trans);
        if (score > bestScore) { bestScore = score; bestFrom = from; }
      }
      next[to] = bestScore + pTo;
      prev[(t1 + 1) * K + to] = bestFrom;
    }
    const tmp = dp; dp = next; next = tmp;
  }
  let bestLast = 0;
  for (let l = 1; l < K; l++) if (dp[l] > dp[bestLast]) bestLast = l;
  const path = new Array(T);
  path[T - 1] = bestLast;
  for (let t2 = T - 1; t2 > 0; t2--) path[t2 - 1] = prev[t2 * K + path[t2]];
  return path;
}

const probs = probsFor(['C','G','Am','F']);
const path = viterbi(probs, templates, 0.84);
console.log('viterbi path:', path.map(i => templates[i].name).join(','));
const amax = [];
probs.forEach(row => { let bi=0; for(let t=1;t<row.length;t++) if(row[t]>row[bi]) bi=t; amax.push(bi); });
console.log('argmax     :', amax.map(i => templates[i].name).join(','));
