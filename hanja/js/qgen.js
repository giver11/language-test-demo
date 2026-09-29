// 자체 제작 문항 생성기(앱 안에서 즉석 생성) — 시험기관 배정한자 + 공식/공공 훈음 자료만 사용.
// 기출·출판사 문제를 쓰지 않으며, 모든 문항은 sourceType:'original'.
import * as D from './data.js';
import { shuffle } from './ui.js';

const hasHe = (d, pid) => { const m = D.heList(d, pid); return m.length && m[0][0] && m[0][1]; };
const heOf = (d, pid) => D.heList(d, pid)[0];
const allEum = (d, pid) => new Set(D.heList(d, pid).map((x) => x[1]).concat(d.r ? [d.r] : []));
const allHun = (d, pid) => new Set(D.heList(d, pid).map((x) => x[0]));
let seq = 0;
let R = Math.random;
// 같은 시드 → 같은 문항 (과제 링크·오늘의 한자왕·시험지 재현용)
export function withSeed(rnd, fn) { const old = R; R = rnd; try { return fn(); } finally { R = old; } }
export function seeded(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  return () => { h = Math.imul(h ^ (h >>> 16), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return ((h ^= h >>> 16) >>> 0) / 4294967296; };
}

function pick(pool, n, ok) {
  const out = [];
  for (const x of shuffle(pool, R)) { if (out.length >= n) break; if (ok(x)) out.push(x); }
  return out;
}

// type: 'hunum'(한자→훈음) | 'hun-char'(훈→한자) | 'eum-char'(음→한자) | 'radical' | 'stroke-count'
export function charQ(type, ch, pool, dict, pid) {
  const d = dict[ch];
  if (!d || !hasHe(d, pid)) return null;
  const [hun, eum] = heOf(d, pid);
  const cand = pool.filter((x) => x !== ch && dict[x] && hasHe(dict[x], pid));
  let q = null;
  if (type === 'hunum') {
    const ds = pick(cand, 3, (x) => { const [h, e] = heOf(dict[x], pid); return h + ' ' + e !== hun + ' ' + eum; }).map((x) => heOf(dict[x], pid).join(' '));
    if (ds.length < 3) return null;
    const ch4 = shuffle([hun + ' ' + eum, ...ds], R);
    q = { typeLabel: '한자→훈음', question: '다음 한자의 훈(뜻)과 음(소리)으로 알맞은 것은?', prompt: ch, choices: ch4, answer: ch4.indexOf(hun + ' ' + eum), explanation: `${ch}은(는) '${hun} ${eum}'입니다.` };
  } else if (type === 'hun-char') {
    // 같은 훈을 가진 글자는 오답으로 쓰지 않음(정답이 둘이 되는 것을 방지)
    const ds = pick(cand, 3, (x) => !allHun(dict[x], pid).has(hun));
    if (ds.length < 3) return null;
    const c4 = shuffle([ch, ...ds], R);
    q = { typeLabel: '훈→한자', question: `'${hun}'이라는 뜻(훈)을 가진 한자는?`, prompt: '', choices: c4, answer: c4.indexOf(ch), explanation: `'${hun}'의 뜻을 가진 한자는 ${ch}(${hun} ${eum})입니다.` };
  } else if (type === 'eum-char') {
    // 같은 음으로 읽을 수 있는 글자는 오답에서 제외
    const ds = pick(cand, 3, (x) => !allEum(dict[x], pid).has(eum));
    if (ds.length < 3) return null;
    const c4 = shuffle([ch, ...ds], R);
    q = { typeLabel: '음→한자', question: `'${eum}'(으)로 읽는 한자는?`, prompt: '', choices: c4, answer: c4.indexOf(ch), explanation: `'${eum}'(으)로 읽는 한자는 ${ch}(${hun} ${eum})입니다.` };
  } else if (type === 'radical') {
    if (!d.rad) return null;
    const rads = [...new Set(cand.map((x) => dict[x].rad).filter((r) => r && r !== d.rad))];
    const ds = shuffle(rads, R).slice(0, 3);
    if (ds.length < 3) return null;
    const c4 = shuffle([d.rad, ...ds], R);
    q = { typeLabel: '부수', question: '다음 한자의 부수는?', prompt: ch, choices: c4, answer: c4.indexOf(d.rad), explanation: `${ch}(${hun} ${eum})의 부수는 ${d.rad}입니다.` };
  } else if (type === 'stroke-count') {
    if (!d.st) return null;
    const opts = shuffle([d.st - 2, d.st - 1, d.st + 1, d.st + 2].filter((x) => x > 0), R).slice(0, 3);
    const c4 = shuffle([d.st, ...opts], R).map((x) => x + '획');
    q = { typeLabel: '획수', question: '다음 한자의 총 획수는?', prompt: ch, choices: c4, answer: c4.indexOf(d.st + '획'), explanation: `${ch}(${hun} ${eum})은(는) 총 ${d.st}획입니다. (한국어문회 자료 기준)` };
  }
  if (!q) return null;
  return Object.assign(q, { id: `gen-${pid}-${type}-${ch}-${++seq}`, type, relatedHanja: [ch], sourceType: 'original', area: q.typeLabel, generated: true });
}

// 한자어 읽기: 한자어 → 독음
export function wordQ(w, pool, words) {
  const e = words.get(w);
  if (!e || !e.r) return null;
  const ds = pick(pool, 3, (x) => x !== w && words.get(x) && words.get(x).r !== e.r && [...x].length === [...w].length).map((x) => words.get(x).r);
  if (ds.length < 3) return null;
  const c4 = shuffle([e.r, ...ds], R);
  return { id: `gen-word-${w}-${++seq}`, type: 'word-reading', typeLabel: '한자어 읽기', question: '다음 한자어의 독음으로 알맞은 것은?', prompt: w, choices: c4, answer: c4.indexOf(e.r),
    explanation: `${w}은(는) '${e.r}'(으)로 읽습니다.${e.g ? ' 뜻: ' + e.g : ''}`, relatedHanja: [...w], sourceType: 'original', area: '한자어', generated: true };
}

// 범위에서 섞인 유형으로 n문항
export function mixed(scope, dict, pid, n, types = ['hunum', 'hun-char', 'eum-char']) {
  const out = [];
  const chars = shuffle(scope.filter((c) => dict[c] && hasHe(dict[c], pid)), R);
  let i = 0;
  for (const ch of chars) {
    if (out.length >= n) break;
    const q = charQ(types[i++ % types.length], ch, scope, dict, pid);
    if (q) out.push(q);
  }
  return out;
}
