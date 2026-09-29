// 내가 자꾸 틀리는 한자 (Smart Writing Review)
// 근거: ① 문제에서 실제로 헷갈려 고른 글자(confusions) ② 쓰기 실패 기록 ③ 반복 오답(lapse)
// 비슷한 글자 묶음: 공개 획순 데이터로 계산한 모양 유사도 + 같은 음의 배정한자
import * as D from '../data.js';
import * as S from '../store.js';
import * as Q from '../qgen.js';
import { esc, shuffle } from '../ui.js';
import { runSession } from './quiz.js';

export default async function (view, { ctx: c }) {
  const dict = await D.dict();
  const conf = await D.confusables();
  const scope = await D.scopeChars(c.pid, c.lid);
  const inScope = new Set(scope);
  const p = c.p;
  const score = new Map();
  const why = new Map();
  const add = (ch, n, reason) => { if (!dict[ch]) return; score.set(ch, (score.get(ch) || 0) + n); (why.get(ch) || why.set(ch, new Set()).get(ch)).add(reason); };
  for (const [a, m] of Object.entries(p.confusions || {})) for (const [b, n] of Object.entries(m)) { add(a, n * 2, `${b}와(과) 헷갈림 ${n}회`); }
  for (const [ch, w] of Object.entries(p.writing || {})) if (w.fail > (w.ok || 0)) add(ch, w.fail, `쓰기 실패 ${w.fail}회`);
  for (const [ch, e] of Object.entries(p.mastery || {})) if ((e.lap || 0) >= 2) add(ch, e.lap, `반복 오답 ${e.lap}회`);
  const top = [...score.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30).map((x) => x[0]);
  const groupOf = (ch) => {
    const picked = Object.keys((p.confusions || {})[ch] || {});
    const shape = (conf[ch] || []).filter((x) => inScope.has(x));
    const eum = (D.heList(dict[ch])[0] || [])[1];
    const sameEum = eum ? scope.filter((x) => x !== ch && dict[x] && (D.heList(dict[x])[0] || [])[1] === eum && dict[x].rad !== dict[ch].rad && (conf[ch] || []).includes(x)) : [];
    return [...new Set([ch, ...picked, ...shape, ...sameEum])].filter((x) => dict[x]).slice(0, 5);
  };
  const cell = (x) => `<div class="cf-cell"><div class="hanzi">${esc(x)}</div><div class="small">${esc(D.heStr(dict[x]))}</div></div>`;
  // 기록이 아직 없을 때: 이번 급수 범위에서 모양이 비슷한 글자 쌍을 미리 보여 줌
  const preview = top.length ? [] : shuffle(scope.filter((x) => (conf[x] || []).some((y) => inScope.has(y)))).slice(0, 6);
  view.innerHTML = `<h1>내가 자꾸 틀리는 한자</h1>
    <p class="sub">${esc(c.provider.name)} ${esc(c.level.name)} · 실제 풀이·쓰기 기록으로 찾은 헷갈리는 글자 묶음</p>
    ${top.length ? '' : '<div class="notice info">아직 헷갈린 기록이 없어요. 문제를 풀거나 쓰기 연습을 하면 여기에 자동으로 모여요. 아래는 이번 급수 범위에서 모양이 비슷한 글자들이에요.</div>'}
    <div class="stack">${(top.length ? top : preview).map((ch) => {
      const g = groupOf(ch);
      return `<div class="card"><div class="cf-row">${g.map(cell).join('')}</div>
        ${why.get(ch) ? `<div class="tiny">${esc([...why.get(ch)].join(' · '))}</div>` : ''}
        <div class="btns"><button class="btn sm" data-q="${esc(g.join(''))}" type="button">구별 퀴즈</button><a class="btn sm" href="#/write?c=${encodeURIComponent(g.join(','))}">비교 쓰기</a></div></div>`;
    }).join('') || '<div class="empty">범위 안에서 비슷한 글자를 찾지 못했어요.</div>'}</div>
    ${top.length ? `<button class="btn accent block" data-all type="button" style="margin-top:12px">헷갈리는 한자 전체 구별 퀴즈</button>` : ''}
    <p class="tiny">모양 유사도는 공개 획순 데이터(Make Me a Hanzi)를 이미지로 바꿔 계산한 값이에요. 문항은 앱이 즉석에서 만든 자체 제작 문제예요.</p>`;
  const quiz = (chars) => {
    // 같은 묶음 글자끼리 보기로 → 모양이 비슷한 글자를 구별하는 연습
    const list = [];
    for (const ch of shuffle(chars)) {
      const g = groupOf(ch);
      const pool = g.length >= 4 ? g : [...g, ...scope];
      const q = Q.charQ(list.length % 2 ? 'hunum' : 'hun-char', ch, pool, dict, c.pid);
      if (q) list.push(q);
    }
    if (list.length) runSession(view, c, list, { title: '헷갈리는 한자 구별', again: false });
  };
  view.querySelectorAll('[data-q]').forEach((b) => (b.onclick = () => quiz([...b.dataset.q])));
  const all = view.querySelector('[data-all]');
  if (all) all.onclick = () => quiz(top.slice(0, 15));
}
