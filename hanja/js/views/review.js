import * as D from '../data.js';
import * as P from '../progress.js';
import { esc } from '../ui.js';
import { runSession } from './quiz.js';

export default async function (view, { ctx: c, params }) {
  const dict = await D.dict();
  const idioms = await D.idioms();
  const r = await P.reviewItems(c);
  const chars = r.chars.filter((x) => dict[x.c]);
  const idm = r.idiomIds.map((id) => idioms.get(id)).filter(Boolean);
  if (params.go === 'quiz') {
    const bank = c.level.hasData ? await D.bank(c.pid, c.lid) : null;
    const set = new Set(chars.slice(0, 40).map((x) => x.c));
    const qs = bank ? bank.questions.filter((q) => q.type !== 'write' && (q.relatedHanja || []).some((ch) => set.has(ch))) : [];
    const pick = qs.sort(() => Math.random() - 0.5).slice(0, 15);
    if (!pick.length) { view.innerHTML = '<div class="empty">복습 문제를 만들 항목이 없어요.</div>'; return; }
    return runSession(view, c, pick, { title: 'Smart Review 문제' });
  }
  view.innerHTML = `
    <h1>Smart Review</h1>
    <p class="sub">최근 틀린 한자 · 여러 번 틀린 한자 · 쓰기 실패 한자 · 헷갈려요/몰라요 한자 · 틀린 사자성어를 자동으로 모았어요.</p>
    <div class="btns fill">
      <a class="btn accent" href="#/cards?set=review" ${chars.length ? '' : 'style="pointer-events:none;opacity:.45"'}>카드 복습 ${chars.length}</a>
      <a class="btn" href="#/write?set=review" ${chars.length ? '' : 'style="pointer-events:none;opacity:.45"'}>쓰기 복습</a>
      <a class="btn" href="#/review?go=quiz" ${chars.length ? '' : 'style="pointer-events:none;opacity:.45"'}>문제 복습</a>
    </div>
    <h3>복습 대상 한자 (${chars.length})</h3>
    <div class="card">${chars.slice(0, 80).map((x) => `<div class="list-row"><span class="hz">${esc(x.c)}</span><div class="grow"><b>${esc(D.heStr(dict[x.c]))}</b><div class="row" style="margin-top:4px">${x.why.map((w) => `<span class="badge ${/틀|실패|몰라/.test(w) ? 'missing' : 'secondary'}">${esc(w)}</span>`).join('')}</div></div></div>`).join('') || '<div class="empty">아직 복습할 한자가 없어요. 카드·문제·쓰기를 하면 자동으로 채워져요.</div>'}</div>
    <h3>틀린 사자성어 (${idm.length})</h3>
    <div class="card">${idm.map((it) => `<div class="list-row"><span class="hz" style="min-width:110px">${esc(it.w)}</span><div class="grow"><b>${esc(it.r)}</b><div class="small">${esc(it.mean)}</div></div><a class="btn sm" href="#/idioms?mode=i2m&id=${it.id}">복습</a></div>`).join('') || '<div class="empty">틀린 사자성어가 없어요.</div>'}</div>`;
}
