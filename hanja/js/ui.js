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
