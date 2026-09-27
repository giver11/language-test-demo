import * as D from '../data.js';
import * as S from '../store.js';
import { esc } from '../ui.js';
import { openHanjaDetail } from './hanja.js';
import { openIdiom } from './idioms.js';

export default async function (view, { ctx }) {
  const dict = await D.dict();
  const words = await D.words();
  const idioms = await D.idioms();
  const f = S.get().favorites;
  const hz = f.hanja.filter((c) => dict[c]);
  view.innerHTML = `
    <h1>즐겨찾기</h1>
    <h3>한자 (${hz.length})</h3>
    ${hz.length ? `<div class="btns" style="margin-bottom:8px"><a class="btn sm accent" href="#/cards?set=list&c=${encodeURIComponent(hz.join(','))}">카드로 공부</a><a class="btn sm" href="#/write?c=${encodeURIComponent(hz.join(','))}">쓰기 연습</a></div>` : ''}
    <div class="hgrid">${hz.map((c) => `<button class="hcell" data-c="${esc(c)}" type="button"><span class="z">${esc(c)}</span><span class="e">${esc(D.heStr(dict[c]))}</span></button>`).join('') || '<span class="small">한자 상세 화면의 ★로 추가하세요.</span>'}</div>
    <h3>한자어 (${f.words.length})</h3>
    <div class="card">${f.words.map((w) => words.get(w)).filter(Boolean).map((w) => `<div class="list-row"><span class="hz">${esc(w.w)}</span><div class="grow"><b>${esc(w.r)}</b></div><a class="btn sm" href="#/words?mode=write&w=${encodeURIComponent(w.w)}">쓰기</a></div>`).join('') || '<span class="small">없음</span>'}</div>
    <h3>사자성어 (${f.idioms.length})</h3>
    <div class="card">${f.idioms.map((id) => idioms.get(id)).filter(Boolean).map((it) => `<div class="list-row" data-i="${it.id}" style="cursor:pointer"><span class="hz" style="min-width:110px">${esc(it.w)}</span><div class="grow"><b>${esc(it.r)}</b><div class="small">${esc(it.mean)}</div></div><a class="btn sm" href="#/idioms?mode=write&id=${it.id}">쓰기</a></div>`).join('') || '<span class="small">없음</span>'}</div>`;
  view.querySelectorAll('[data-c]').forEach((b) => (b.onclick = () => openHanjaDetail(b.dataset.c, ctx)));
  view.querySelectorAll('[data-i]').forEach((b) => (b.onclick = (e) => { if (e.target.closest('a')) return; openIdiom(idioms.get(b.dataset.i)); }));
}
