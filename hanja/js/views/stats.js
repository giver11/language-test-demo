import * as P from '../progress.js';
import * as S from '../store.js';
import * as D from '../data.js';
import { esc, bar } from '../ui.js';

export default async function (view, { ctx: c }) {
  const sum = await P.summary(c);
  const st = S.get();
  const bt = Object.entries(c.p.quiz.byType).sort((a, b) => b[1].a - a[1].a);
  const provs = await D.providers();
  const last14 = [];
  const d = new Date();
  for (let i = 13; i >= 0; i--) { const x = new Date(d); x.setDate(d.getDate() - i); last14.push(S.ymd(x)); }
  const days = new Set(st.days);
  const badges = P.evalBadges();
  view.innerHTML = `
    <h1>통계</h1>
    <p class="sub">${esc(c.provider.name)} ${esc(c.level.name)}</p>
    <div class="stat-grid">
      <div class="stat"><div class="v">${sum.known}/${sum.total}</div><div class="k">암기 완료</div></div>
      <div class="stat"><div class="v">${sum.writeDone}/${sum.writeTotal}</div><div class="k">쓰기 완료</div></div>
      <div class="stat"><div class="v">${sum.answered}</div><div class="k">푼 문제</div></div>
      <div class="stat"><div class="v">${sum.acc == null ? '-' : sum.acc + '%'}</div><div class="k">정답률</div></div>
      <div class="stat"><div class="v">${sum.streak}일</div><div class="k">연속 학습 (최장 ${sum.bestStreak}일)</div></div>
      <div class="stat"><div class="v">${st.xp}</div><div class="k">XP</div></div>
      <div class="stat"><div class="v">${sum.mocks}</div><div class="k">모의시험 횟수</div></div>
      <div class="stat"><div class="v">${sum.bestMock == null ? '-' : sum.bestMock + '%'}</div><div class="k">모의시험 최고점</div></div>
    </div>
    <h3>최근 14일 학습</h3>
    <div class="card flat"><div style="display:grid;grid-template-columns:repeat(14,1fr);gap:4px">${last14.map((x) => `<div title="${x}" style="height:18px;border-radius:5px;background:${days.has(x) ? 'var(--ok)' : '#ebe6db'}"></div>`).join('')}</div>
      <div class="spread tiny" style="margin-top:4px"><span>${last14[0].slice(5)}</span><span>오늘</span></div></div>
    <h3>유형별 정답률</h3>
    <div class="card">${bt.map(([k, v]) => `<div style="margin:8px 0"><div class="spread small"><span>${esc(k)}</span><span>${v.c}/${v.a} · ${Math.round((v.c * 100) / v.a)}%</span></div>${bar((v.c * 100) / v.a, v.c / v.a >= 0.7 ? 'var(--ok)' : 'var(--warn)')}</div>`).join('') || '<div class="empty">아직 푼 문제가 없어요.</div>'}</div>
    <h3>기관별 진도 (기록 보존)</h3>
    <div class="card">${provs.map((p) => {
      const pp = st.byProvider[p.id];
      if (!pp) return `<div class="list-row"><div class="grow"><b>${esc(p.name)}</b><div class="small">기록 없음</div></div></div>`;
      const known = Object.values(pp.cards).filter((x) => x.s === 'know').length;
      return `<div class="list-row"><div class="grow"><b>${esc(p.name)}</b> ${pp.level ? '<span class="badge">' + esc(pp.level) + '</span>' : ''}<div class="small">암기 ${known}자 · 쓰기 ${Object.keys(pp.writing).length}자 · 문제 ${pp.quiz.answered} · 오답 ${Object.keys(pp.wrong).length} · 모의시험 ${pp.mocks.length}</div></div></div>`;
    }).join('')}</div>
    <h3>배지</h3>
    <div class="badges">${badges.list.map((b) => `<span class="bdg ${b.got ? 'got' : ''}"><span class="hanzi">${b.icon}</span>${esc(b.name)}${b.got ? ' · ' + b.date : ''}</span>`).join('')}</div>`;
}
