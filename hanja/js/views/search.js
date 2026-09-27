import * as D from '../data.js';
import * as S from '../store.js';
import { esc, isHanzi, toast } from '../ui.js';
import { openHanjaDetail } from './hanja.js';
import { openIdiom } from './idioms.js';

export default async function (view, { params, ctx }) {
  const dict = await D.dict();
  const words = await D.words();
  const idioms = await D.idioms();
  const chars = Object.values(dict);
  view.innerHTML = `
    <h1>한자 검색</h1>
    <form data-form class="row" style="flex-wrap:nowrap" action="#" onsubmit="return false">
      <input type="search" data-q placeholder="한자 · 음 · 뜻 · 한자어 · 사자성어" value="${esc(params.q || '')}" autocomplete="off" autocapitalize="off" enterkeyhint="search" style="flex:1">
      <button class="btn primary" data-go type="submit" style="flex:0 0 auto">검색</button>
    </form>
    <div class="chips" style="margin-top:8px">${['學', '학', '배우다', '학교', '일석이조', '물'].map((x) => `<button class="chip" data-ex="${x}" type="button" style="min-height:36px">${x}</button>`).join('')}</div>
    <p class="tiny">전체 사전 ${chars.length.toLocaleString()}자 · 한자어 ${words.size.toLocaleString()}개 · 사자성어 ${idioms.size}개</p>
    <div data-res></div>`;
  const input = view.querySelector('[data-q]');
  const res = view.querySelector('[data-res]');
  const stem = (s) => s.replace(/다$/u, '');
  // 훈의 마지막 글자 받침 제거: 배울→배우, 가르칠→가르치 (동사 기본형 '배우다' 검색 지원)
  const dropFinal = (s) => {
    if (!s) return s;
    const code = s.charCodeAt(s.length - 1) - 0xac00;
    if (code < 0 || code > 11171) return s;
    return s.slice(0, -1) + String.fromCharCode(0xac00 + code - (code % 28));
  };
  const matchHun = (h, q) => h === q || (q.endsWith('다') && q.length >= 2 && (dropFinal(h) === stem(q) || h === stem(q))) || (q.length >= 2 && h.startsWith(q));
  const run = () => {
    const q = input.value.trim();
    if (!q) { res.innerHTML = '<div class="empty">검색어를 입력하세요.</div>'; return; }
    const hz = isHanzi(q);
    const qs = stem(q);
    let cHits = [], wHits = [], iHits = [];
    if (hz) {
      cHits = [...q].filter((ch) => dict[ch]).map((ch) => dict[ch]);
      for (const w of words.values()) if (w.w.includes(q)) { wHits.push(w); if (wHits.length > 60) break; }
      iHits = [...idioms.values()].filter((it) => it.w.includes(q));
    } else {
      cHits = chars.filter((d) => d.r === q || d.m.some(([h, e]) => e === q || matchHun(h, q)));
      // 현재 기관 배정 한자 → 획순 데이터 있는 한자 순으로 정렬
      cHits.sort((a, b) => (b.src === 'eomunhoe-xls') - (a.src === 'eomunhoe-xls') || (b.so - a.so));
      cHits = cHits.slice(0, 120);
      for (const w of words.values()) if (w.r === q || w.r.startsWith(q)) { wHits.push(w); if (wHits.length > 60) break; }
      iHits = [...idioms.values()].filter((it) => it.r.includes(q) || it.mean.includes(q));
    }
    // 현재 기관 배정 한자 우선
    res.innerHTML = `
      <h3>한자 (${cHits.length})</h3>
      <div class="hgrid">${cHits.map((d) => `<button class="hcell" data-c="${esc(d.c)}" type="button"><span class="z">${esc(d.c)}</span><span class="e">${esc(D.heStr(d))}</span></button>`).join('') || '<span class="small">없음</span>'}</div>
      <h3>한자어 (${wHits.length}${wHits.length > 60 ? '+' : ''})</h3>
      <div class="card">${wHits.slice(0, 60).map((w) => `<div class="list-row"><span class="hz">${esc(w.w)}</span><div class="grow"><b>${esc(w.r)}</b><div class="small">${[...w.w].map((ch) => `${ch}(${esc(D.heStr(dict[ch]))})`).join(' + ')}</div></div><button class="star ${S.isFav('words', w.w) ? 'on' : ''}" data-fw="${esc(w.w)}" type="button" aria-label="즐겨찾기">★</button></div>`).join('') || '<span class="small">없음</span>'}</div>
      <h3>사자성어 (${iHits.length})</h3>
      <div class="card">${iHits.map((it) => `<div class="list-row" data-i="${it.id}" style="cursor:pointer"><span class="hz" style="min-width:110px">${esc(it.w)}</span><div class="grow"><b>${esc(it.r)}</b><div class="small">${esc(it.mean)}</div></div></div>`).join('') || '<span class="small">없음</span>'}</div>`;
    res.querySelectorAll('[data-c]').forEach((b) => (b.onclick = () => openHanjaDetail(b.dataset.c, ctx)));
    res.querySelectorAll('[data-i]').forEach((b) => (b.onclick = () => openIdiom(idioms.get(b.dataset.i))));
    res.querySelectorAll('[data-fw]').forEach((b) => (b.onclick = () => { const on = S.toggleFav('words', b.dataset.fw); b.classList.toggle('on', on); toast(on ? '즐겨찾기에 추가' : '즐겨찾기 해제'); }));
  };
  let t;
  const now = () => { clearTimeout(t); run(); try { history.replaceState(null, '', `#/search?q=${encodeURIComponent(input.value.trim())}`); } catch (e) {} };
  // 한글 IME 조합 중에도/끝난 뒤에도 검색되도록 input·compositionend·change 모두 처리
  input.addEventListener('input', () => { clearTimeout(t); t = setTimeout(run, 250); });
  input.addEventListener('compositionend', () => { clearTimeout(t); t = setTimeout(run, 50); });
  input.addEventListener('change', now);
  view.querySelector('[data-form]').addEventListener('submit', (e) => { e.preventDefault(); input.blur(); now(); });
  view.querySelectorAll('[data-ex]').forEach((b) => (b.onclick = () => { input.value = b.dataset.ex; now(); }));
  run();
}
