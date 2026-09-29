// 나의 약점 — 오답 DNA(오답 원인 자동 분류) · 자주 헷갈리는 한자쌍 · 약점 집중 복습
import * as D from '../data.js';
import * as L from '../learn.js';
import { esc, bar } from '../ui.js';
import { runSession } from './quiz.js';

export default async function (view, { ctx: c, params }) {
  const d = await L.dna(c);
  const pairs = await L.confusionPairs(c);
  if (params.drill) {
    const cat = params.drill === 'auto' ? d.weakest && d.weakest.cat : params.drill;
    const qs = cat ? await L.weakDrill(c, cat, 10) : [];
    if (!qs.length) {
      view.innerHTML = `<h1>약점 집중 복습</h1><div class="notice">${esc(cat || '')} 영역에서 다시 풀 문제를 만들 수 없어요.${cat === '획순·획수' ? ' 쓰기 연습으로 복습해 보세요.' : ''}</div>
        <div class="btns"><a class="btn" href="#/weak">나의 약점</a>${cat === '획순·획수' ? '<a class="btn accent" href="#/write?set=review">쓰기 복습</a>' : ''}</div>`;
      return;
    }
    return runSession(view, c, qs, { title: `약점 복습 · ${cat}` });
  }
  const top = L.dnaTop(d);
  view.innerHTML = `<h1>나의 약점</h1>
    <p class="sub">${esc(c.provider.name)} ${esc(c.level.name)} · 오답 ${d.total}건을 원인별로 자동 분류했어요</p>
    ${d.total ? `<section class="card" aria-label="오답 DNA">
      <h2 class="mt0">오답 DNA</h2>
      ${top.map((r) => `<div class="dna-row"><div class="spread"><b>${esc(r.cat)}</b><span>${r.pct}% <span class="small">(${r.n}건)</span></span></div>${bar(r.pct)}</div>`).join('')}
      ${d.weakest ? `<a class="btn accent block" href="#/weak?drill=auto&t=${Date.now() % 1e6}" style="margin-top:10px">가장 취약한 영역부터 복습: ${esc(d.weakest.cat)}</a>` : ''}
    </section>
    <h3>영역별 자세히</h3>
    <div class="card">${d.rows.map((r) => `<div class="list-row"><div class="grow"><div class="spread"><b>${esc(r.cat)}</b><span class="small">${r.n}건 · ${r.pct}%</span></div>
      ${r.chars.length ? `<div class="hanzi" style="font-size:1.375rem;letter-spacing:4px;margin-top:4px">${r.chars.slice(0, 12).map(esc).join('')}</div>` : ''}</div>
      <a class="btn sm" href="#/weak?drill=${encodeURIComponent(r.cat)}&t=${Date.now() % 1e6}">복습</a></div>`).join('')}</div>`
    : `<div class="notice info">아직 오답 기록이 없어요. 문제·게임·쓰기를 하면 틀린 원인(비슷한 모양, 음 혼동, 훈 혼동, 뜻 혼동, 획순, 사자성어, 한자어, 문제유형)을 자동으로 분석해요.</div>`}
    <h3>자주 헷갈리는 한자쌍</h3>
    <div class="card">${pairs.length ? pairs.map((x) => `<div class="pair"><span class="hz2">${esc(x.a)} / ${esc(x.b)}</span>
        <div class="grow"><div class="small">${esc(x.he[0])} · ${esc(x.he[1])}</div><div class="tiny">${x.n ? `헷갈림 ${x.n}회 · ` : ''}${esc(x.src.join(', '))}${x.shape ? ' · 모양 비슷함' : ''}</div></div>
        <a class="btn sm" href="#/write?c=${encodeURIComponent(x.a + ',' + x.b)}" aria-label="${esc(x.a)}와 ${esc(x.b)} 비교 쓰기">비교 쓰기</a></div>`).join('')
      : '<div class="empty">아직 헷갈린 한자쌍이 없어요. 문제에서 비슷한 한자를 잘못 고르면 여기에 자동으로 저장돼요.</div>'}</div>
    <div class="btns fill" style="margin-top:12px"><a class="btn" href="#/confuse">헷갈리는 한자 구별 퀴즈</a><a class="btn" href="#/wrong">오답노트</a></div>
    <p class="tiny">분류 기준: 고른 오답 글자가 정답과 모양이 비슷한지(공개 획순 데이터 기반 유사도), 같은 음·같은 훈인지, 문제 유형(획순·사자성어·한자어 등)으로 판단해요. 최근 7일 오답을 더 무겁게 반영해요.</p>`;
}
