
const fs = require('fs');
eval(fs.readFileSync("C:/Users/admin/OneDrive/桌面/projects/guitar-lab/js/lib/music.js", 'utf8').replace(/window\.GLmusic = M;/, 'global.GLmusic = M;'));
const M = global.GLmusic;

// 模擬逐幀 argmax 正確路徑：C×24 G×24 Am×24 F×24 (每小節 ~24 幀)
const names = ['C','G','Am','F'];
const path = [];
names.forEach(n => { for (let i=0;i<24;i++) path.push(n); });

// --- 重現 AC.segments 邏輯 ---
function segments(path, frameDur, minSec, fillSec) {
  minSec = minSec || 0.55; fillSec = fillSec || 0.32;
  const segs = [];
  let cur = { i0: 0, i1: 0, t: path[0] };
  for (let i = 1; i < path.length; i++) {
    if (path[i] === cur.t) cur.i1 = i;
    else { segs.push(cur); cur = { i0: i, i1: i, t: path[i] }; }
  }
  segs.push(cur);
  console.log('raw segs:', segs.map(s => s.t + '(' + (s.i1-s.i0+1) + ')').join(' '));
  // 合併太短的
  const merged = [];
  segs.forEach(s => {
    const dur = (s.i1 - s.i0 + 1) * frameDur;
    if (merged.length && dur < minSec) merged[merged.length-1].i1 = s.i1;
    else merged.push(s);
  });
  console.log('merged:', merged.map(s => s.t + '(' + (s.i1-s.i0+1) + ')').join(' '));
  const filled = [];
  merged.forEach(s => {
    if (filled.length && s.t === filled[filled.length-1].t) filled[filled.length-1].i1 = s.i1;
    else filled.push(s);
  });
  return filled;
}
const out = segments(path, 0.093);
console.log('RESULT:', out.map(s => s.t).join(' → '));
console.log('每小節', 24*0.093, '秒 >', 0.55, 'minSec?', 24*0.093 > 0.55);
