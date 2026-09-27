import * as D from '../data.js';
import { esc, fmtDate, daysUntil, ddayText, statusBadge } from '../ui.js';

export default async function (view, { params }) {
  const provs = await D.providers();
  const idx = await D.scheduleIndex();
  const years = Object.keys(idx.years);
  const year = params.y || String(D.SCHEDULE_YEAR);
  const filter = params.p || 'all';
  const blocks = [];
  for (const p of provs) {
    if (filter !== 'all' && filter !== p.id) continue;
    let s;
    try { s = await D.schedule(p.id, year); } catch (e) { blocks.push(`<div class="card"><h2 class="mt0">${esc(p.name)}</h2><div class="notice">${year}년 일정 데이터 없음 — 공식 자료 확인 필요</div></div>`); continue; }
    const next = (s.sessions || []).find((x) => daysUntil(x.examDate) >= 0);
    const rows = (s.sessions || []).map((x) => {
      const n = daysUntil(x.examDate);
      const cls = n < 0 ? 'past' : x === next ? 'next' : '';
      return `<div class="s-item ${cls}">
        <div class="spread"><b>${esc(x.round)}</b><span class="badge ${n < 0 ? '' : 'accent'}">${n < 0 ? '종료' : ddayText(n)}</span></div>
        <dl><dt>기관</dt><dd>${esc(p.name)}</dd><dt>시험명</dt><dd>${esc(s.examName)}</dd><dt>급수</dt><dd>${esc(x.levels)}</dd>
          <dt>접수 시작</dt><dd>${fmtDate(x.applyStart)}</dd><dt>접수 마감</dt><dd>${fmtDate(x.applyEnd)}</dd>
          <dt>시험일</dt><dd><b>${fmtDate(x.examDate)}</b></dd><dt>결과 발표</dt><dd>${x.resultDate ? fmtDate(x.resultDate) : esc(x.resultNote || '공식 자료 확인 필요')}</dd>
          <dt>시험방식</dt><dd>${esc(x.mode)}</dd>
          <dt>공식 출처</dt><dd><a href="${esc((x.source || s.source).sourceUrl)}" target="_blank" rel="noopener">${esc((x.source || s.source).sourceName)} ↗</a></dd></dl></div>`;
    }).join('');
    blocks.push(`<div class="card">
      <div class="spread"><h2 class="mt0" style="margin:0">${esc(p.name)}</h2>${statusBadge(s.status)}</div>
      <div class="small" style="margin:4px 0 10px">${esc(s.examName)} · 공식 시험기관 발표 기준 · 마지막 확인: ${esc(s.source.verifiedAt)}</div>
      ${s.statusNote ? `<div class="notice">${esc(s.statusNote)}</div>` : ''}
      ${s.note ? `<div class="notice info">${esc(s.note)}</div>` : ''}
      ${s.type === 'always' ? `<div class="s-item next"><b>상시 시험</b><dl>
          <dt>기관</dt><dd>${esc(p.name)}</dd><dt>시험명</dt><dd>${esc(s.examName)}</dd><dt>급수</dt><dd>1급~9급</dd>
          <dt>시행</dt><dd>${esc(s.always.description)}</dd><dt>접수</dt><dd>${esc(s.always.applyRule)} (2026년 접수 시작 ${fmtDate(s.always.yearStart.applyStart)})</dd>
          <dt>첫 시험</dt><dd>${fmtDate(s.always.yearStart.firstExam)}</dd><dt>결과 발표</dt><dd>${esc(s.always.resultRule)}</dd><dt>시험방식</dt><dd>CBT 객관식</dd>
          <dt>공식 출처</dt><dd><a href="${esc(s.source.sourceUrl)}" target="_blank" rel="noopener">${esc(s.source.sourceName)} ↗</a></dd></dl>
          <p class="small" style="margin:8px 0 0">${esc(s.always.note)}</p></div>` : ''}
      <div class="sched-cards">${rows}</div>
      <a class="small" href="${esc(s.officialUrl)}" target="_blank" rel="noopener">공식 사이트에서 최신 일정 확인 ↗</a>
    </div>`);
  }
  view.innerHTML = `
    <h1>${esc(year)} 시험일정</h1>
    <p class="sub">공식 시험기관 발표 기준 · 확인되지 않은 날짜는 만들지 않습니다.</p>
    <div class="tabs">${[['all', '전체'], ...provs.map((p) => [p.id, p.name])].map(([k, l]) => `<button class="${filter === k ? 'on' : ''}" data-p="${k}" type="button">${esc(l)}</button>`).join('')}</div>
    ${years.length > 1 ? `<div class="tabs">${years.map((y) => `<button class="${y === year ? 'on' : ''}" data-y="${y}" type="button">${y}</button>`).join('')}</div>` : ''}
    ${blocks.join('')}
    <p class="tiny">일정은 data/schedules/{기관}-{연도}.json 파일로 관리되어, 다음 해에는 파일만 추가하면 반영됩니다.</p>`;
  view.querySelectorAll('[data-p]').forEach((b) => (b.onclick = () => (location.hash = `#/schedule?p=${b.dataset.p}&y=${year}`)));
  view.querySelectorAll('[data-y]').forEach((b) => (b.onclick = () => (location.hash = `#/schedule?p=${filter}&y=${b.dataset.y}`)));
}
