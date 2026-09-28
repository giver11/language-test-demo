import * as D from '../data.js';
import * as S from '../store.js';
import * as P from '../progress.js';
import { esc, openSheet, toast, shuffle } from '../ui.js';
import { WritingPad } from '../pad.js';
import { judge, VERDICT_TEXT } from '../judge.js';
import { referenceMedians, animate, renderSteps, svgBase } from '../strokes.js';

export default async function (view, { ctx: c, params }) {
  const dict = await D.dict();
  let items = [];
  let scopeNote = '';
  const hasData = c.level && c.level.hasData;
  const wscope = hasData ? await D.writeScope(c.pid, c.lid) : [];
  const all = hasData ? await D.scopeChars(c.pid, c.lid) : [];
  if (params.c) items = params.c.split(',').filter((x) => dict[x]);
  else if (!hasData) {
    view.innerHTML = `<h1>한자 쓰기</h1><div class="notice bad">${esc(c.provider.name)} ${esc(c.level.name)} 배정한자: 공식 자료 확인 필요 — 쓰기 대상 목록을 만들 수 없어요.</div>
      <p>검색에서 한자를 골라 자유롭게 쓰기 연습을 할 수 있어요.</p><a class="btn" href="#/search">한자 검색</a>`;
    return;
  } else {
    const base = wscope.length ? wscope : all;
    if (!wscope.length) scopeNote = `${c.provider.name} ${c.level.name}은(는) 공식 쓰기 배정한자가 없어요. 읽기 한자로 학습용 쓰기 연습을 합니다.`;
    const set = params.set || 'quest';
    if (set === 'review') items = (await P.reviewItems(c)).chars.map((x) => x.c).filter((x) => dict[x]);
    else if (set === 'fav') items = base.filter((x) => S.isFav('hanja', x));
    else if (set === 'all') items = shuffle(base);
    else if (set === 'new') { const nw = new Set(await D.scopeChars(c.pid, c.lid, true)); items = base.filter((x) => nw.has(x)); if (!items.length) items = base; }
    else {
      const notDone = base.filter((x) => !(c.p.writing[x] && c.p.writing[x].ok));
      const failed = base.filter((x) => c.p.writing[x] && c.p.writing[x].fail > c.p.writing[x].ok);
      items = [...failed, ...notDone.filter((x) => !failed.includes(x))];
      if (!items.length) items = shuffle(base);
    }
  }
  if (!items.length) { view.innerHTML = '<h1>한자 쓰기</h1><div class="empty">쓰기 연습할 한자가 없어요.</div>'; return; }

  let idx = 0;
  let level = +(localStorage.getItem('hanja.writeLevel') || 1);
  let pad = null, anim = null, medians = null, judged = false, autoTimer = null;

  view.innerHTML = `
    <div class="spread"><h1 class="mt0" style="margin:0">한자 쓰기</h1><span class="small" data-count></span></div>
    ${scopeNote ? `<div class="notice info">${esc(scopeNote)}</div>` : ''}
    <div class="levels3" style="margin:10px 0">
      <button class="chip" data-lv="1" type="button">1단계<br>따라 쓰기</button>
      <button class="chip" data-lv="2" type="button">2단계<br>희미하게</button>
      <button class="chip" data-lv="3" type="button">3단계<br>외워 쓰기</button>
    </div>
    <div class="write-wrap">
      <div class="card target-card" style="width:100%;max-width:440px"><div><div class="small" data-lvlabel></div><div class="he" data-he></div></div><div class="hanzi" data-show style="font-size:44px;min-width:50px;text-align:right"></div></div>
      <div class="padhost" style="width:100%;display:flex;justify-content:center"></div>
      <div class="feedback" data-fb></div>
      <div class="btns fill" style="width:100%;max-width:440px">
        <button class="btn sm" data-act="undo" type="button">↶ 한 획 지우기</button>
        <button class="btn primary" data-act="judge" type="button" style="flex:2">채점하기</button>
      </div>
      <div class="tool-row">
        <button class="btn" data-act="order" type="button">획순 보기</button>
        <button class="btn" data-act="hint" type="button">힌트</button>
        <button class="btn" data-act="retry" type="button">다시 쓰기</button>
        <button class="btn" data-act="clear" type="button">지우기</button>
        <button class="btn" data-act="answer" type="button">정답 보기</button>
        <button class="btn" data-act="next" type="button">다음 한자</button>
      </div>
      <form data-free class="free-form" style="margin-top:4px" onsubmit="return false">
      <input data-freein type="text" placeholder="자유 쓰기: 한자 입력 (예: 學)" autocomplete="off" >
      <button class="btn sm" type="submit">이 한자 쓰기</button>
      <button class="btn sm" data-blank type="button">빈 칸 연습</button>
    </form>
      <p class="tiny center" style="max-width:440px">판정은 입력한 획의 수·순서·시작/끝 위치·경로를 공개 획순 데이터(Make Me a Hanzi, 중국 표준 필순 기반)와 비교한 결과예요. 한국 교과서 필순과 다른 글자가 있을 수 있어요.</p>
    </div>`;

  const fb = view.querySelector('[data-fb]');
  pad = new WritingPad(view.querySelector('.padhost'));

  const setFb = (cls, html) => { fb.className = 'feedback' + (cls ? ' show ' + cls : ''); fb.innerHTML = html || ''; };

  async function load() {
    const ch = items[idx];
    const d = dict[ch];
    judged = false;
    clearTimeout(autoTimer);
    pad.clear();
    setFb('');
    medians = await referenceMedians(ch);
    // 획순 데이터를 받는 동안 다른 화면으로 이동했으면 중단 (이전 화면 요소 없음)
    if (!view.querySelector('[data-count]') || items[idx] !== ch) return;
    view.querySelector('[data-count]').textContent = `${idx + 1} / ${items.length}`;
    view.querySelector('[data-he]').textContent = D.heStr(d);
    view.querySelector('[data-show]').textContent = level === 3 ? '?' : ch;
    view.querySelector('[data-lvlabel]').textContent = level === 1 ? '보고 따라 쓰세요' : level === 2 ? '희미한 가이드 위에 쓰세요' : '뜻과 음을 보고 외워서 쓰세요';
    view.querySelectorAll('[data-lv]').forEach((b) => b.classList.toggle('sel', +b.dataset.lv === level));
    await pad.setGuide(ch, level === 1 ? 'solid' : level === 2 ? 'faint' : 'none');
    if (!view.querySelector('[data-count]')) return;
    if (!medians) setFb('near', '이 글자는 공개 획순 데이터가 없어 자동 판정·획순 보기가 지원되지 않아요. 쓰고 나서 “정답 보기”로 비교하세요.');
  }

  function doJudge() {
    const ch = items[idx];
    if (pad.isEmpty()) { setFb('retry', VERDICT_TEXT.empty); return; }
    if (!medians) { setFb('near', '자동 판정 불가(획순 데이터 없음) — 정답과 비교해 보세요.'); return; }
    const r = judge(pad.getStrokes(), medians);
    pad.showOverlay(r.per);
    setFb(r.verdict, `${esc(r.text)}${r.messages.length ? '<ul>' + r.messages.map((m) => `<li>${esc(m)}</li>`).join('') + '</ul>' : ''}`);
    if (!judged) {
      judged = true;
      S.recordWriting(c.pid, ch, r.verdict === 'good' ? 'good' : r.verdict === 'near' ? 'near' : 'retry');
      if (r.verdict !== 'good' && r.verdict !== 'near') {
        const e = c.p.writing[ch]; if (e) e.last = r.verdict;
      }
    }
  }

  pad.on('stroke', (n) => {
    clearTimeout(autoTimer);
    if (medians && n === medians.length) autoTimer = setTimeout(doJudge, 700);
  });
  pad.on('start', () => clearTimeout(autoTimer));

  view.querySelectorAll('[data-lv]').forEach((b) => (b.onclick = () => { level = +b.dataset.lv; localStorage.setItem('hanja.writeLevel', String(level)); load(); }));
  view.querySelector('[data-act=clear]').onclick = () => { pad.clear(); setFb(''); };
  view.querySelector('[data-act=retry]').onclick = () => { judged = false; pad.clear(); setFb(''); pad.setGuide(items[idx], level === 1 ? 'solid' : level === 2 ? 'faint' : 'none'); };
  view.querySelector('[data-act=undo]').onclick = () => pad.undo();
  view.querySelector('[data-act=judge]').onclick = doJudge;
  view.querySelector('[data-act=next]').onclick = () => { idx = (idx + 1) % items.length; load(); };
  view.querySelector('[data-act=answer]').onclick = async () => {
    const ch = items[idx];
    view.querySelector('[data-show]').textContent = ch;
    await pad.setGuide(ch, 'solid');
    toast(`정답: ${ch} (${D.heStr(dict[ch])})`);
  };
  view.querySelector('[data-act=hint]').onclick = async () => {
    const ch = items[idx];
    const d = dict[ch];
    const data = await D.strokes(ch);
    if (!data) { toast(`힌트: 부수 ${d.rad || '-'} · 총 ${d.st || '-'}획`); return; }
    const k = Math.min(pad.strokes.length, data.s.length - 1);
    // 다음에 쓸 획을 잠깐 표시
    const { svg, g } = svgBase();
    svg.style.cssText = 'position:absolute;top:0;right:0;bottom:0;left:0;width:100%;height:100%;pointer-events:none';
    data.s.forEach((p, i) => { const e = document.createElementNS('http://www.w3.org/2000/svg', 'path'); e.setAttribute('d', p); e.setAttribute('fill', i === k ? 'rgba(210,58,42,.55)' : i < k ? 'rgba(31,42,68,.12)' : 'transparent'); g.appendChild(e); });
    pad.guideLayer.appendChild(svg);
    toast(`${k + 1}번째 획 (총 ${data.s.length}획)`);
    setTimeout(() => svg.remove(), 1800);
  };
  view.querySelector('[data-act=order]').onclick = () => {
    const ch = items[idx];
    openSheet(`<div class="spread"><h2 class="mt0">획순 · <span class="hanzi">${esc(ch)}</span></h2><button class="btn sm" data-close type="button">닫기</button></div>
      <div class="anim" style="width:240px;max-width:64vw;margin:0 auto"></div>
      <div class="btns" style="justify-content:center;margin:8px 0"><button class="btn sm" data-replay type="button">▶ 다시 보기</button></div>
      <div class="steps-host"></div>`, async (panel) => {
      const ok = await renderSteps(panel.querySelector('.steps-host'), ch);
      if (!ok) { panel.querySelector('.steps-host').innerHTML = '<div class="notice">이 글자는 공개 획순 데이터가 없어 획순을 표시하지 않습니다.</div>'; panel.querySelector('[data-replay]').disabled = true; return; }
      anim = await animate(panel.querySelector('.anim'), ch);
      panel.querySelector('[data-replay]').onclick = async () => { if (anim) anim.cancel(); anim = await animate(panel.querySelector('.anim'), ch); };
    });
    window.__sheetClose = () => anim && anim.cancel();
  };

  view.querySelector('[data-free]').addEventListener('submit', (e) => {
    e.preventDefault();
    const v = view.querySelector('[data-freein]').value;
    const ch = [...v].find((x) => dict[x]);
    if (!ch) { toast('사전에 있는 한자를 입력하세요'); return; }
    items.splice(idx + 1, 0, ch); idx = idx + 1; load();
  });
  // 빈 칸 연습: 가이드·판정 없이 자유롭게 쓰기
  view.querySelector('[data-blank]').onclick = async () => {
    clearTimeout(autoTimer); medians = null; pad.clear(); await pad.setGuide(null, 'none');
    view.querySelector('[data-he]').textContent = '자유 연습'; view.querySelector('[data-show]').textContent = '';
    view.querySelector('[data-lvlabel]').textContent = '가이드 없이 자유롭게 써 보세요 (채점 없음)';
    setFb('');
  };
  await load();
  return () => { clearTimeout(autoTimer); if (anim) anim.cancel(); pad.destroy(); };
}
