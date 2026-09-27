import * as D from '../data.js';
import * as S from '../store.js';
import { esc, statusBadge } from '../ui.js';

export default async function (view, { params, ctx }) {
  const provs = await D.providers();
  const opts = [];
  const unavailable = [];
  for (const p of provs) {
    const lv = await D.levels(p.id);
    const withData = lv.levels.filter((l) => l.hasData);
    if (!withData.length) unavailable.push(p);
    withData.forEach((l) => opts.push({ key: `${p.id}:${l.id}`, pid: p.id, lid: l.id, label: `${p.name} ${l.name}`, status: l.status.hanja }));
  }
  const cur = ctx && ctx.level && ctx.level.hasData ? `${ctx.pid}:${ctx.lid}` : null;
  const from = params.from || cur || 'daehan:8';
  const to = params.to || (from.startsWith('eomunhoe') ? 'daehan:8' : 'eomunhoe:8');
  const [fp, fl] = from.split(':');
  const [tp, tl] = to.split(':');
  const A = new Set(await D.scopeChars(fp, fl));
  const B = await D.scopeChars(tp, tl);
  const st = S.get();
  const learned = new Set();
  for (const p of Object.values(st.byProvider)) for (const [ch, e] of Object.entries(p.cards)) if (e.s === 'know') learned.add(ch);
  const common = B.filter((c) => A.has(c));
  const newOnes = B.filter((c) => !A.has(c));
  const already = B.filter((c) => learned.has(c));
  const extra = B.filter((c) => !learned.has(c));
  const onlyA = [...A].filter((c) => !B.includes(c));
  const lab = (k) => (opts.find((o) => o.key === k) || { label: k }).label;
  const stat = (k) => (opts.find((o) => o.key === k) || {}).status;
  const sel = (name, val) => `<select data-sel="${name}">${opts.map((o) => `<option value="${o.key}" ${o.key === val ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}</select>`;
  const block = (title, arr, desc, action) => `<div class="card"><div class="spread"><b>${title}</b><span class="cmp-num">${arr.length}</span></div><div class="small">${desc}</div>
    <details style="margin-top:6px"><summary class="small">한자 보기</summary><div class="chars-inline">${arr.map(esc).join(' ') || '<span class="small">없음</span>'}</div></details>${action || ''}</div>`;
  view.innerHTML = `
    <h1>시험기관 급수 비교</h1>
    <p class="sub">실제 기관별 배정한자 매핑으로 계산해요 (추정치 아님).</p>
    <div class="card flat">
      <label class="small">공부한 시험</label>${sel('from', from)}
      <div class="center" style="margin:6px 0">↓ 이 시험으로 바꾸면?</div>
      <label class="small">바꿀 시험</label>${sel('to', to)}
    </div>
    <div class="notice info">“${esc(lab(from))}”를 공부했을 때 “${esc(lab(to))}”(누적 ${B.length}자)로 바꾸면:</div>
    ${block('공통으로 알고 있는 한자', common, `두 시험 범위에 모두 들어 있는 한자`)}
    ${block('새로 공부해야 할 한자', newOnes, `${esc(lab(to))}에만 있는 한자`, newOnes.length ? `<a class="btn sm" style="margin-top:8px" href="#/cards?set=list&c=${encodeURIComponent(newOnes.slice(0, 300).join(','))}">카드로 학습</a>` : '')}
    ${block('이미 학습한 한자', already, `${esc(lab(to))} 범위 중 내 기록에서 ‘알아요’로 표시한 한자 (모든 기관 기록 합산)`)}
    ${block('추가 학습 한자', extra, `${esc(lab(to))} 범위 중 아직 ‘알아요’가 아닌 한자`, extra.length ? `<a class="btn sm" style="margin-top:8px" href="#/cards?set=list&c=${encodeURIComponent(extra.slice(0, 300).join(','))}">카드로 학습</a>` : '')}
    ${block('바꾸면 범위에서 빠지는 한자', onlyA, `${esc(lab(from))}에만 있는 한자`)}
    <p class="small">데이터 상태: ${esc(lab(from))} ${statusBadge(stat(from))} · ${esc(lab(to))} ${statusBadge(stat(to))}</p>
    ${unavailable.length ? `<div class="notice">비교 불가: ${unavailable.map((p) => esc(p.name)).join(', ')} — 배정한자 공식 자료 확인 필요 (공식 파일 확보 전에는 비교 대상에서 제외)</div>` : ''}
    <p class="tiny">대한검정회는 현재 8급(2차 자료)만 등록되어 있어요.</p>`;
  view.querySelectorAll('[data-sel]').forEach((s) => (s.onchange = () => {
    const f = view.querySelector('[data-sel=from]').value, t = view.querySelector('[data-sel=to]').value;
    location.hash = `#/compare?from=${f}&to=${t}`;
  }));
}
