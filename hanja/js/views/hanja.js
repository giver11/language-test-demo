import * as D from '../data.js';
import * as S from '../store.js';
import * as P from '../progress.js';
import { esc, openSheet, toast, shuffle } from '../ui.js';
import { renderSteps, animate } from '../strokes.js';

export default async function (view, r) {
  if (r.name === 'cards') return cards(view, r);
  return list(view, r);
}

function noData(view, c) {
  view.innerHTML = `<h1>${esc(c.provider.name)} ${esc(c.level.name)} 한자</h1>
    <div class="notice bad"><b>배정한자: 공식 자료 확인 필요</b><br>${c.level.notes.map(esc).join('<br>')}</div>
    <p class="small">가짜 한자 목록을 만들지 않습니다. 공식 배정한자 파일이 확보되면 이 급수 학습이 열립니다.</p>
    <div class="btns"><a class="btn" href="#/search">전체 한자 검색</a><a class="btn" href="#/idioms">사자성어 학습</a><a class="btn" href="#/sources">데이터 출처</a></div>`;
}

async function list(view, { ctx: c, params }) {
  if (!c.level.hasData) return noData(view, c);
  const dict = await D.dict();
  const tab = params.tab || 'new';
  const newChars = await D.scopeChars(c.pid, c.lid, true);
  const all = await D.scopeChars(c.pid, c.lid);
  const wset = new Set(await D.writeScope(c.pid, c.lid));
  const sets = {
    new: newChars,
    all,
    todo: all.filter((ch) => !c.p.cards[ch] || c.p.cards[ch].s !== 'know'),
    fav: all.filter((ch) => S.isFav('hanja', ch)),
  };
  const items = sets[tab] || newChars;
  const known = all.filter((ch) => c.p.cards[ch] && c.p.cards[ch].s === 'know').length;
  view.innerHTML = `
    <h1>${esc(c.provider.name)} ${esc(c.level.name)} 한자</h1>
    <p class="sub">배정 ${c.level.readCount ? c.level.readCount.toLocaleString() + '자' : ''} · 이번 급수 신출 ${newChars.length}자 · 암기 ${known}/${all.length}
      ${c.level.status.hanja === 'official-file' ? '<span class="badge official">공식 xls 변환</span>' : '<span class="badge secondary">2차 자료 · 공식 대조 필요</span>'}</p>
    ${c.level.notes.length ? `<div class="notice">${c.level.notes.map(esc).join('<br>')}</div>` : ''}
    <div class="tabs">${[['new', `이번 급수 신출 ${newChars.length}`], ['all', `누적 전체 ${all.length}`], ['todo', `안 외운 한자 ${sets.todo.length}`], ['fav', `⭐ ${sets.fav.length}`]]
      .map(([k, l]) => `<button class="${tab === k ? 'on' : ''}" data-tab="${k}" type="button">${l}</button>`).join('')}</div>
    <div class="btns fill" style="margin-bottom:12px">
      <a class="btn accent" href="#/cards?set=${tab}">플래시카드 시작</a>
      <a class="btn" href="#/write?set=${tab}">쓰기 연습</a>
    </div>
    <div class="hgrid">${items.slice(0, 800).map((ch) => {
      const e = c.p.cards[ch];
      return `<button class="hcell ${e ? e.s : ''}" data-c="${esc(ch)}" type="button" aria-label="${esc(ch)} ${esc(D.heStr(dict[ch]))}">
        <span class="z">${esc(ch)}</span><span class="e">${esc(D.heStr(dict[ch]))}</span>${wset.has(ch) ? '' : ''}</button>`;
    }).join('')}</div>
    ${items.length > 800 ? `<p class="small center">처음 800자만 표시합니다. 검색으로 전체를 찾을 수 있어요.</p>` : ''}
    ${!items.length ? '<div class="empty">표시할 한자가 없어요.</div>' : ''}
    <p class="tiny" style="margin-top:12px">색상: 초록 알아요 · 노랑 헷갈려요 · 빨강 몰라요</p>`;
  view.querySelectorAll('[data-tab]').forEach((b) => (b.onclick = () => (location.hash = `#/hanja?tab=${b.dataset.tab}`)));
  view.querySelectorAll('[data-c]').forEach((b) => (b.onclick = () => openHanjaDetail(b.dataset.c, c)));
}

export async function openHanjaDetail(ch, c) {
  const dict = await D.dict();
  const words = await D.words();
  const idioms = await D.idioms();
  const d = dict[ch];
  if (!d) { toast('사전에 없는 한자입니다'); return; }
  const provs = await D.providers();
  const rows = [];
  for (const p of provs) {
    const m = await D.mapping(p.id);
    const it = m.byChar.get(ch);
    const lvName = (id) => (m.levels.find((l) => l.id === id) || {}).name;
    if (it) rows.push(`<tr><td>${esc(p.name)}</td><td>${esc(lvName(it.l))} 읽기</td><td>${it.w ? esc(lvName(it.w)) + '부터 쓰기' : (p.id === 'eomunhoe' ? '쓰기 범위 밖' : '공식 자료 확인 필요')}</td></tr>`);
    else rows.push(`<tr><td>${esc(p.name)}</td><td colspan="2" class="small">${m.items.length ? '배정한자 아님' : '공식 자료 확인 필요'}</td></tr>`);
  }
  const fav = S.isFav('hanja', ch);
  const ex = (d.ex || []).map((w) => `<span class="badge">${esc(w)} ${esc((words.get(w) || {}).r || '')}</span>`).join(' ');
  const idm = (d.idm || []).map((id) => idioms.get(id)).filter(Boolean).map((it) => `<span class="badge accent">${esc(it.w)} ${esc(it.r)}</span>`).join(' ');
  let anim = null;
  openSheet(`
    <div class="spread"><div class="hanzi" style="font-size:72px;line-height:1">${esc(ch)}</div>
      <div style="text-align:right"><button class="star ${fav ? 'on' : ''}" data-fav type="button" aria-label="즐겨찾기">★</button><br><button class="btn sm" data-close type="button">닫기</button></div></div>
    <div style="font-size:22px;font-weight:800">${esc(D.heAll(d))}</div>
    <dl class="kv"><dt>음</dt><dd>${esc([...new Set(d.m.map((x) => x[1]))].join(', ') || d.r)}</dd><dt>뜻</dt><dd>${esc([...new Set(d.m.map((x) => x[0]))].join(', '))}</dd>
      <dt>부수</dt><dd>${esc(d.rad || '-')}</dd><dt>총획수</dt><dd>${esc(d.st || '-')}획${d.sc && d.st && d.sc !== d.st ? ` <span class="small">(획순 데이터 ${d.sc}획 — 중국 표준 기반 차이)</span>` : ''}</dd>
      <dt>코드</dt><dd class="small">${esc(d.id)}</dd></dl>
    ${ex ? `<h3>관련 한자어</h3><div class="row">${ex}</div>` : ''}
    ${idm ? `<h3>관련 사자성어</h3><div class="row">${idm}</div>` : ''}
    <h3>기관별 급수</h3><div class="table-wrap"><table><tbody>${rows.join('')}</tbody></table></div>
    <h3>획순</h3>
    <div class="stroke-anim" style="width:min(60vw,220px);margin:0 auto"></div>
    <div class="btns" style="justify-content:center;margin:8px 0"><button class="btn sm" data-play type="button">▶ 획순 애니메이션</button><a class="btn sm" href="#/write?c=${encodeURIComponent(ch)}">✎ 쓰기 연습</a></div>
    <div class="stroke-steps-host"></div>`, async (panel) => {
    panel.querySelector('[data-fav]').onclick = (e) => { const on = S.toggleFav('hanja', ch); e.target.classList.toggle('on', on); toast(on ? '즐겨찾기에 추가' : '즐겨찾기 해제'); };
    const ok = await renderSteps(panel.querySelector('.stroke-steps-host'), ch);
    if (!ok) {
      panel.querySelector('.stroke-steps-host').innerHTML = '<div class="notice">이 글자는 공개 획순 데이터가 없어 획순을 표시하지 않습니다.</div>';
      panel.querySelector('[data-play]').disabled = true;
    } else {
      anim = await animate(panel.querySelector('.stroke-anim'), ch);
      panel.querySelector('[data-play]').onclick = async () => { if (anim) anim.cancel(); anim = await animate(panel.querySelector('.stroke-anim'), ch); };
    }
  });
  window.__sheetClose = () => { if (anim) anim.cancel(); };
}

async function cards(view, { ctx: c, params }) {
  if (!c.level.hasData) return noData(view, c);
  const dict = await D.dict();
  const words = await D.words();
  const idioms = await D.idioms();
  const all = await D.scopeChars(c.pid, c.lid);
  const newChars = await D.scopeChars(c.pid, c.lid, true);
  const wset = new Set(await D.writeScope(c.pid, c.lid));
  const set = params.set || 'new';
  let items;
  if (set === 'all') items = shuffle(all);
  else if (set === 'todo') items = all.filter((ch) => !c.p.cards[ch] || c.p.cards[ch].s !== 'know');
  else if (set === 'fav') items = all.filter((ch) => S.isFav('hanja', ch));
  else if (set === 'review') items = (await P.reviewItems(c)).chars.map((x) => x.c).filter((ch) => dict[ch]);
  else if (set === 'list' && params.c) items = params.c.split(',');
  else if (set === 'quest') {
    const q = S.get().quest;
    const n = q ? q.plan.hanja : 15;
    const order = [...newChars, ...all.filter((x) => !newChars.includes(x))];
    const todo = order.filter((ch) => !c.p.cards[ch]);
    const weak = order.filter((ch) => c.p.cards[ch] && c.p.cards[ch].s !== 'know');
    items = [...todo, ...weak].slice(0, n);
  } else items = newChars;
  if (!items.length) {
    view.innerHTML = `<h1>플래시카드</h1><div class="empty">학습할 카드가 없어요 🎉<br><a href="#/hanja">한자 목록으로</a></div>`;
    return;
  }
  let i = 0;
  const res = { know: 0, unsure: 0, dont: 0 };
  const draw = () => {
    if (i >= items.length) {
      view.innerHTML = `<h1>카드 학습 완료</h1>
        <div class="card"><div class="grid3 center"><div><div class="cmp-num" style="color:var(--ok)">${res.know}</div>알아요</div><div><div class="cmp-num" style="color:var(--warn)">${res.unsure}</div>헷갈려요</div><div><div class="cmp-num" style="color:var(--bad)">${res.dont}</div>몰라요</div></div></div>
        <p class="small">헷갈려요·몰라요로 표시한 한자는 Smart Review에 자동으로 추가됐어요.</p>
        <div class="btns fill"><a class="btn accent" href="#/review">Smart Review</a><a class="btn" href="#/home">홈</a></div>`;
      return;
    }
    const ch = items[i];
    const d = dict[ch];
    const lvInfo = wset.has(ch) ? '읽기 · 쓰기 범위' : '읽기 범위';
    const ex = (d.ex || []).slice(0, 4).map((w) => `${esc(w)}(${esc((words.get(w) || {}).r || '')})`).join(', ');
    const idm = (d.idm || []).slice(0, 2).map((id) => idioms.get(id)).filter(Boolean).map((it) => `${esc(it.w)}(${esc(it.r)})`).join(', ');
    const fav = S.isFav('hanja', ch);
    view.innerHTML = `
      <div class="spread"><span class="small">${i + 1} / ${items.length}</span><button class="star ${fav ? 'on' : ''}" data-fav type="button" aria-label="즐겨찾기">★</button></div>
      <div class="progress-top"><i style="width:${(i * 100) / items.length}%"></i></div>
      <div class="flash"><div class="inner" data-flip role="button" tabindex="0" aria-label="카드 뒤집기">
        <div class="face front"><div class="z">${esc(ch)}</div><div class="tap-hint">터치해서 뜻 보기</div></div>
        <div class="face back">
          <div class="z">${esc(ch)}</div>
          <div class="he">${esc(D.heStr(d))}</div>
          <dl class="kv">
            <dt>음</dt><dd>${esc([...new Set(d.m.map((x) => x[1]))].join(', '))}</dd>
            <dt>뜻</dt><dd>${esc([...new Set(d.m.map((x) => x[0]))].join(', '))}</dd>
            <dt>획수</dt><dd>${esc(d.st || '-')}획</dd>
            <dt>부수</dt><dd>${esc(d.rad || '-')}</dd>
            <dt>범위</dt><dd>${esc(c.provider.short)} ${esc(c.level.name)} ${lvInfo}</dd>
            ${ex ? `<dt>관련 단어</dt><dd>${ex}</dd>` : ''}
            ${idm ? `<dt>사자성어</dt><dd>${idm}</dd>` : ''}
          </dl>
        </div></div></div>
      <div class="know-btns">
        <button class="btn ok" data-k="know" type="button">알아요</button>
        <button class="btn warn" data-k="unsure" type="button">헷갈려요</button>
        <button class="btn bad" data-k="dont" type="button">몰라요</button>
      </div>
      <div class="btns" style="justify-content:center;margin-top:12px"><button class="btn sm ghost" data-detail type="button">획순·상세 보기</button><a class="btn sm ghost" href="#/write?c=${encodeURIComponent(ch)}">✎ 써 보기</a></div>`;
    const flash = view.querySelector('.flash');
    const flip = () => flash.classList.toggle('flip');
    view.querySelector('[data-flip]').onclick = flip;
    view.querySelector('[data-flip]').onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); flip(); } };
    view.querySelector('[data-fav]').onclick = (e) => { const on = S.toggleFav('hanja', ch); e.currentTarget.classList.toggle('on', on); };
    view.querySelector('[data-detail]').onclick = () => openHanjaDetail(ch, c);
    view.querySelectorAll('[data-k]').forEach((b) => (b.onclick = () => {
      const k = b.dataset.k;
      S.recordCard(c.pid, ch, k);
      res[k]++;
      i++;
      draw();
    }));
  };
  draw();
}
