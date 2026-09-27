import { esc } from '../ui.js';
import { runSession } from './quiz.js';

const CATS = ['전체', '한자', '한자어', '사자성어', '쓰기'];

function ansText(q) {
  if (typeof q.answer === 'string') return q.answer;
  return q.choices && q.choices[q.answer] != null ? q.choices[q.answer] : '';
}

export default async function (view, { ctx: c, params }) {
  const cat = params.cat || '전체';
  const type = params.type || '';
  const showResolved = params.resolved === '1';
  const all = Object.entries(c.p.wrong).map(([id, w]) => ({ id, ...w }));
  const types = [...new Set(all.map((w) => w.q.typeLabel))];
  let list = all.filter((w) => (cat === '전체' || w.cat === cat) && (!type || w.q.typeLabel === type) && (showResolved || !w.resolved));
  // 반복해서 틀린 항목 우선
  list.sort((a, b) => (a.resolved - b.resolved) || (b.count - a.count) || (b.t - a.t));
  const retryable = list.filter((w) => !['idiom-arrange', 'idiom-write', 'word-write', 'word-combine'].includes(w.q.type) && !w.resolved);
  const counts = Object.fromEntries(CATS.map((k) => [k, all.filter((w) => !w.resolved && (k === '전체' || w.cat === k)).length]));
  const q = (o) => '#/wrong?' + new URLSearchParams({ cat, type, resolved: showResolved ? '1' : '', ...o }).toString();
  view.innerHTML = `
    <h1>오답노트</h1>
    <p class="sub">${c.provider.name} · 틀린 문제는 자동 저장되고, 반복해서 틀린 문제가 위에 보여요.</p>
    <div class="tabs">${CATS.map((k) => `<button class="${cat === k ? 'on' : ''}" data-cat="${k}" type="button">${k} ${counts[k]}</button>`).join('')}</div>
    ${types.length ? `<select data-type aria-label="문제유형"><option value="">문제유형 전체</option>${types.map((t) => `<option ${t === type ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select>` : ''}
    <div class="btns fill" style="margin:12px 0">
      <button class="btn accent" data-retry type="button" ${retryable.length ? '' : 'disabled'}>다시 풀기 (${Math.min(20, retryable.length)}문제)</button>
      <a class="btn" href="${q({ resolved: showResolved ? '' : '1' })}">${showResolved ? '해결한 문제 숨기기' : '해결한 문제 보기'}</a>
    </div>
    <div class="card">${list.map((w) => `
      <div class="list-row">
        <span class="hz">${esc(String(w.q.prompt || ansText(w.q)).slice(0, 8))}</span>
        <div class="grow"><div class="row"><b>${esc(w.q.typeLabel)}</b><span class="badge ${w.count >= 2 ? 'missing' : ''}">${w.count}회 틀림</span>${w.resolved ? '<span class="badge official">해결</span>' : ''}<span class="badge">${esc(w.cat)}</span></div>
          <div class="small">${esc(w.q.question)}</div>
          <div class="small">정답: <b>${esc(ansText(w.q))}</b>${w.picked != null && w.q.choices && w.q.choices[w.picked] ? ` · 내 답: ${esc(w.q.choices[w.picked])}` : ''}</div>
          ${w.q.type === 'idiom-write' || w.q.type === 'idiom-arrange' ? `<a class="small" href="#/idioms?mode=${w.q.type === 'idiom-write' ? 'write' : 'arrange'}&id=${esc(w.q.idiom)}">다시 연습 →</a>` : ''}
          ${w.q.type === 'word-write' || w.q.type === 'word-combine' ? `<a class="small" href="#/words?mode=write&w=${encodeURIComponent(w.q.word)}">다시 연습 →</a>` : ''}
        </div></div>`).join('') || '<div class="empty">저장된 오답이 없어요.</div>'}</div>`;
  view.querySelectorAll('[data-cat]').forEach((b) => (b.onclick = () => (location.hash = q({ cat: b.dataset.cat, type: '' }))));
  const sel = view.querySelector('[data-type]');
  if (sel) sel.onchange = () => (location.hash = q({ type: sel.value }));
  view.querySelector('[data-retry]').onclick = () => runSession(view, c, retryable.slice(0, 20).map((w) => w.q), { title: '오답 다시 풀기', again: false });
}
