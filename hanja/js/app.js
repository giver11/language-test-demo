// 라우터 · 앱 셸
import * as S from './store.js';
import * as P from './progress.js';
import { $, $$, esc, closeSheet } from './ui.js';
import * as D from './data.js';

const routes = {
  onboard: () => import('./views/onboard.js'),
  home: () => import('./views/home.js'),
  hanja: () => import('./views/hanja.js'),
  cards: () => import('./views/hanja.js'),
  write: () => import('./views/write.js'),
  quiz: () => import('./views/quiz.js'),
  more: () => import('./views/more.js'),
  idioms: () => import('./views/idioms.js'),
  words: () => import('./views/words.js'),
  mock: () => import('./views/mock.js'),
  wrong: () => import('./views/wrong.js'),
  review: () => import('./views/review.js'),
  schedule: () => import('./views/schedule.js'),
  compare: () => import('./views/compare.js'),
  stats: () => import('./views/stats.js'),
  settings: () => import('./views/settings.js'),
  search: () => import('./views/search.js'),
  favorites: () => import('./views/favorites.js'),
  sources: () => import('./views/sources.js'),
  diag: () => import('./views/diag.js'),
  placement: () => import('./views/placement.js'),
  confuse: () => import('./views/confuse.js'),
  games: () => import('./views/games.js'),
  parent: () => import('./views/parent.js'),
  teacher: () => import('./views/teacher.js'),
  studio: () => import('./views/studio.js'),
  camera: () => import('./views/camera.js'),
  share: () => import('./views/share.js'),
  assign: () => import('./views/assign.js'),
};
const TAB_OF = { home: 'home', hanja: 'hanja', cards: 'hanja', write: 'write', quiz: 'quiz' };
const NEEDS_CTX = new Set(['home', 'hanja', 'cards', 'write', 'quiz', 'idioms', 'words', 'mock', 'wrong', 'review', 'stats', 'favorites', 'placement', 'confuse', 'games', 'share']);

let cleanup = null;
let navSeq = 0;

export function parseHash() {
  const h = location.hash.replace(/^#\/?/, '');
  const [path, qs] = h.split('?');
  const parts = path.split('/').filter(Boolean);
  const params = Object.fromEntries(new URLSearchParams(qs || ''));
  return { name: parts[0] || '', args: parts.slice(1), params };
}

export function go(hash) { if (location.hash === hash) render(); else location.hash = hash; }

async function render() {
  const seq = ++navSeq;
  closeSheet();
  let { name, args, params } = parseHash();
  const st = S.get();
  D.setHeProvider(st.current && st.current.provider);
  let hasCtx = st.current && st.current.provider && S.prov(st.current.provider).level;
  // 지원이 종료된 기관이 선택돼 있던 경우(기록은 보존) → 기관 다시 선택
  if (hasCtx && !(await D.provider(st.current.provider))) hasCtx = false;
  // 한자 데이터가 없는 급수가 선택돼 있으면(이전 버전에서 선택) 급수를 다시 고르게 함
  if (hasCtx) {
    const lv = await D.level(st.current.provider, S.prov(st.current.provider).level);
    if (!lv || !lv.hasData) {
      hasCtx = false;
      if (name !== 'onboard' && !['schedule', 'sources', 'search', 'compare', 'more', 'settings', 'diag', 'assign', 'teacher', 'studio', 'camera', 'parent'].includes(name)) {
        name = 'onboard'; params = { p: st.current.provider };
      }
    }
  }
  if (!name) name = hasCtx ? 'home' : 'onboard';
  if (NEEDS_CTX.has(name) && !hasCtx) name = 'onboard';
  if (!routes[name]) name = hasCtx ? 'home' : 'onboard';
  if (cleanup) { try { cleanup(); } catch (e) { console.warn(e); } cleanup = null; }
  const view = $('#view');
  document.body.classList.toggle('no-tabs', name === 'onboard' || name === 'mock' && args[0] === 'run');
  $$('#tabbar a').forEach((a) => a.classList.toggle('on', a.dataset.tab === (TAB_OF[name] || (name === 'onboard' ? '' : 'more'))));
  await updateCtxButton();
  view.innerHTML = '<div class="loading">불러오는 중…</div>';
  try {
    const mod = await routes[name]();
    if (seq !== navSeq) return;
    const c = hasCtx ? await P.ctx() : null;
    if (seq !== navSeq) return;
    view.innerHTML = '';
    const r = await mod.default(view, { name, args, params, ctx: c, go });
    if (seq !== navSeq) { if (typeof r === 'function') r(); return; }
    cleanup = typeof r === 'function' ? r : null;
    window.__hanjaReady = true;
    window.scrollTo(0, 0);
    const nb = P.evalBadges().newly;
    if (nb.length) import('./ui.js').then((u) => u.toast(`🏅 배지 획득: ${nb.map((b) => b.name).join(', ')}`));
  } catch (e) {
    console.error(e);
    view.innerHTML = `<div class="notice bad">화면을 불러오지 못했습니다: ${esc(e.message)}<br><a href="javascript:location.reload()">새로고침</a> · <a href="#/diag">진단 화면</a> · <a href="#/home">홈으로</a></div>`;
  }
}

async function updateCtxButton() {
  const btn = $('#ctxBtn');
  const c = await P.ctx();
  if (!c || !c.level) { btn.textContent = ''; return; }
  btn.textContent = `${c.provider.name} ${c.level.name} ▾`;
  btn.onclick = () => go('#/onboard?switch=1');
}

window.addEventListener('hashchange', render);
render().then(() => {
  // 대한검정회 데이터 무결성 검사 (불일치 시 console.error)
  const st = S.get();
  if (st.current && st.current.provider === 'daehan') D.validateDaehanHanjaData().catch((e) => console.error(e));
  else if (st.current && st.current.provider) D.validateProviderData(st.current.provider).catch((e) => console.error(e));
});
window.__hanja = { S, go };
