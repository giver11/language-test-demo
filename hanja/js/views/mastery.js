// 한자 Mastery — 배정한자 전체를 새 한자 · 학습 중 · 복습 필요 · 완전 학습 4단계로 표시
import * as D from '../data.js';
import * as S from '../store.js';
import { esc, fmtDate } from '../ui.js';

const ORDER = ['NEW', 'LEARNING', 'REVIEW', 'MASTERED'];
const PAGE = 120;

export default async function (view, { ctx: c, params }) {
  const scope = c.level.hasData ? await D.scopeChars(c.pid, c.lid) : [];
  const dict = await D.dict();
  const now = Date.now();
  const by = { NEW: [], LEARNING: [], REVIEW: [], MASTERED: [] };
  for (const ch of scope) by[S.stageOf(c.p.mastery[ch], now)].push(ch);
  const sel = ORDER.includes(params.s) ? params.s : 'REVIEW';
  const page = Math.max(0, +(params.p || 0));
  const list = by[sel];
  const shown = list.slice(page * PAGE, page * PAGE + PAGE);
  const d = (t) => (t ? fmtDate(S.ymd(new Date(t))) : '-');
  view.innerHTML = `<h1>한자 Mastery</h1>
    <p class="sub">${esc(c.provider.name)} ${esc(c.level.name)} 배정한자 ${scope.length}자</p>
    <div class="card center"><div class="cmp-num">완전 학습 ${by.MASTERED.length}/${scope.length}</div></div>
    <div class="stage-row" role="tablist">${ORDER.map((k) => `<a href="#/mastery?s=${k}" role="tab" aria-selected="${k === sel}" class="${k === sel ? 'sel' : ''}" style="${k === sel ? 'outline:3px solid var(--ink)' : ''}"><b>${by[k].length}</b><span class="stage-tag stage-${k}">${S.STAGE_KO[k]}</span></a>`).join('')}</div>
    <p class="tiny">완전 학습 = 숙련도 80 이상 + 간격복습 3단계(7일) 이상 도달 · 복습 필요 = 복습 예정일이 지난 한자 · 학습 중 = 기록은 있지만 아직 숙련 전</p>
    <h3>${S.STAGE_KO[sel]} ${list.length}자</h3>
    <div class="card">${shown.map((ch) => {
      const r = S.srs(c.pid, ch, now);
      return `<div class="list-row"><span class="hz">${esc(ch)}</span><div class="grow"><b>${esc(D.heStr(dict[ch], c.pid))}</b>
        <div class="tiny">${r.stage === 'NEW' ? '아직 학습 기록 없음' : `숙련도 ${r.mastery} · 정답 ${r.correctCount} / 오답 ${r.wrongCount} · 복습 간격 ${r.interval}일 · 마지막 ${d(r.lastReviewed)} · 다음 복습 ${d(r.nextReview)}`}</div></div></div>`;
    }).join('') || '<div class="empty">해당하는 한자가 없어요.</div>'}</div>
    ${list.length > PAGE ? `<div class="btns fill" style="margin-top:8px">${page > 0 ? `<a class="btn" href="#/mastery?s=${sel}&p=${page - 1}">이전</a>` : ''}${(page + 1) * PAGE < list.length ? `<a class="btn" href="#/mastery?s=${sel}&p=${page + 1}">다음 ${PAGE}자</a>` : ''}</div>` : ''}
    <div class="btns fill" style="margin-top:12px">${by.REVIEW.length ? `<a class="btn accent" href="#/cards?set=review">복습 필요 ${by.REVIEW.length}자 복습</a>` : ''}<a class="btn" href="#/today">오늘의 학습</a></div>`;
}
