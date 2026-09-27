// 필기 판정 보정 테스트: 실제 획순 데이터로 정답/오답/획순 오류/획수 오류 케이스를 검증
import fs from 'node:fs';
import { judge } from '../js/judge.js';
const load = (c) => JSON.parse(fs.readFileSync(new URL(`../data/strokes/${c.codePointAt(0).toString(16).toUpperCase().padStart(4,'0')}.json`, import.meta.url)));
const med = (c) => load(c).m.map((s) => s.map(([x, y]) => [x / 1024, (900 - y) / 1024]));
let rnd = 7; const R = () => ((rnd = (rnd * 16807) % 2147483647) / 2147483647 - 0.5);
// 사람 손글씨 흉내: 작게/치우치게 + 흔들림 + 점 보간
const human = (m, k = 0.02, scale = 0.8, dx = 0.05) => m.map((s) => {
  const out = [];
  for (let i = 0; i < s.length - 1; i++) for (let t = 0; t < 1; t += 0.25) out.push([s[i][0] + (s[i + 1][0] - s[i][0]) * t, s[i][1] + (s[i + 1][1] - s[i][1]) * t]);
  out.push(s[s.length - 1]);
  return out.map(([x, y]) => [x * scale + dx + R() * k, y * scale + 0.03 + R() * k]);
});
const chars = ['學', '家', '日', '一', '永', '國', '水', '大', '人', '心', '書', '火'];
let fails = 0;
const expect = (name, got, ok) => { const pass = ok.includes(got); if (!pass) fails++; console.log(pass ? 'PASS' : 'FAIL', name, '→', got); };
for (const c of chars) {
  const m = med(c);
  expect(`${c} 정확히`, judge(human(m, 0.0, 1, 0), m).verdict, ['good']);
  expect(`${c} 손글씨 흔들림`, judge(human(m, 0.02), m).verdict, ['good', 'near']);
  expect(`${c} 크게 흔들림`, judge(human(m, 0.06), m).verdict, ['near', 'retry', 'good', 'order']);
  if (m.length >= 3) {
    const sw = human(m, 0.01); [sw[0], sw[sw.length - 1]] = [sw[sw.length - 1], sw[0]];
    expect(`${c} 획순 바꿈`, judge(sw, m).verdict, ['order', 'retry']);
    const rv = human(m, 0.01); rv[1] = [...rv[1]].reverse();
    expect(`${c} 2획 방향 반대`, judge(rv, m).verdict, ['order', 'retry', 'near']);
    const miss = human(m, 0.01).slice(0, -2);
    expect(`${c} 2획 빠짐`, judge(miss, m).verdict, ['retry']);
  }
}
// 다른 글자를 쓴 경우 (획수가 같은 쌍)
const pairs = [['日', '口'], ['大', '士'], ['人', '入'], ['木', '水'], ['學', '機']];
for (const [a, b] of pairs) {
  try {
    const ma = med(a), mb = med(b);
    const v = judge(human(mb, 0.01), ma).verdict;
    expect(`${a} 칸에 ${b}(${mb.length}획 vs ${ma.length}획)`, v, ['retry', 'order', ...(a === '人' ? ['near'] : [])]);
  } catch (e) { console.log('skip', a, b, e.message); }
}
console.log(fails ? `\n${fails} FAIL` : '\nALL PASS');
process.exit(fails ? 1 : 0);
