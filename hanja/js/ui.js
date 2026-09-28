// 공용 UI 헬퍼
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

let toastTimer;
export function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 1800);
}

export function openSheet(html, onMount) {
  const s = $('#sheet');
  s.innerHTML = `<div class="panel" role="dialog" aria-modal="true"><div class="grab"></div>${html}</div>`;
  s.hidden = false;
  document.body.style.overflow = 'hidden';
  const close = () => closeSheet();
  s.onclick = (e) => { if (e.target === s) close(); };
  $$('[data-close]', s).forEach((b) => (b.onclick = close));
  if (onMount) onMount(s.querySelector('.panel'), close);
  return close;
}
export function closeSheet() {
  const s = $('#sheet');
  if (s.hidden) return;
  s.hidden = true; s.innerHTML = '';
  document.body.style.overflow = '';
  if (window.__sheetClose) { const f = window.__sheetClose; window.__sheetClose = null; f(); }
}

export function shuffle(a, rnd = Math.random) {
  a = [...a];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
export function sample(a, k) { return shuffle(a).slice(0, k); }

export function daysUntil(dateStr) {
  if (!dateStr) return null;
  const t = new Date(); t.setHours(0, 0, 0, 0);
  const d = new Date(dateStr + 'T00:00:00');
  return Math.round((d - t) / 86400000);
}
export function ddayText(n) {
  if (n == null) return '';
  if (n > 0) return `D-${n}`;
  if (n === 0) return 'D-DAY';
  return `D+${-n}`;
}
export function fmtDate(s) {
  if (!s) return '-';
  const d = new Date(s + 'T00:00:00');
  const w = '일월화수목금토'[d.getDay()];
  return `${s.slice(0, 4)}.${s.slice(5, 7)}.${s.slice(8, 10)}(${w})`;
}

export function statusBadge(status) {
  const map = {
    official: ['official', '공식 확인'],
    'official-file': ['official', '공식 xls 변환'],
    secondary: ['secondary', '재게시 자료 · 공식 확인 필요'],
    partial: ['secondary', '부분 확인'],
    unverified: ['missing', '공식 자료 확인 필요'],
    missing: ['missing', '공식 자료 확인 필요'],
  };
  const [cls, label] = map[status] || ['', status || ''];
  return `<span class="badge ${cls}">${esc(label)}</span>`;
}

export function isHanzi(s) { return /[㐀-鿿豈-﫿]/.test(s || ''); }

export function bar(pct, color) {
  const v = Math.max(0, Math.min(100, pct || 0));
  return `<div class="bar"><i style="width:${v}%;${color ? 'background:' + color : ''}"></i></div>`;
}

// 대한검정회 공식 자료 안내 (기출문제는 저작권 보호 — 공식 홈페이지 링크로만 안내)
export const DAEHAN_LINKS = [
  ['공식 홈페이지', 'https://www.hanja.ne.kr/'],
  ['공식 선정한자', 'https://www.hanja.ne.kr/jupsu/jupsu07_01.asp'],
  ['공식 시험안내', 'https://www.hanja.ne.kr/apply/info01.asp'],
  ['공식 기출문제', 'https://www.hanja.ne.kr/jupsu/jupsu07.asp'],
];
export function daehanFooter() {
  return `<div class="card flat dh-foot">
    <div class="btns" style="flex-wrap:wrap;gap:6px">${DAEHAN_LINKS.map(([t, u]) => `<a class="btn sm" href="${u}" target="_blank" rel="noopener">${t} ↗</a>`).join('')}</div>
    <p class="small" style="margin:8px 0 0">대한검정회 공식 홈페이지에서 제공하는 최근 기출문제를 확인할 수 있습니다. 이 앱의 문제는 공식 선정한자 범위로 자체 제작한 기출유형 연습문제·예상문제이며 실제 기출문제가 아닙니다.</p>
    <p class="tiny" style="margin:6px 0 0">자료 기준: 사단법인 대한민국한자교육연구회·대한검정회 공식 홈페이지</p>
  </div>`;
}
