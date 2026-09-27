// 여러 글자(사자성어 4자, 한자어) 직접 쓰기 — 큰 쓰기 칸 1개 + 글자별 슬롯
import { WritingPad } from './pad.js';
import { judge, isPass, VERDICT_TEXT } from './judge.js';
import { referenceMedians, animate, renderSteps } from './strokes.js';
import * as D from './data.js';
import { esc, openSheet } from './ui.js';

export async function multiWrite(host, chars, opts = {}) {
  const n = chars.length;
  const dict = await D.dict();
  const meds = await Promise.all(chars.map((c) => referenceMedians(c)));
  const saved = Array(n).fill(null);
  const thumbs = Array(n).fill(null);
  let cur = 0, finished = false, autoT = null, anim = null;
  host.innerHTML = `
    <div class="write-wrap">
      <div class="slots">${chars.map((_, i) => `<button class="slot" data-i="${i}" type="button" aria-label="${i + 1}번째 칸">□</button>`).join('')}</div>
      <div class="small" data-hint></div>
      <div class="padhost" style="width:100%;display:flex;justify-content:center"></div>
      <div class="feedback" data-fb></div>
      <div class="tool-row" data-writing>
        <button class="btn" data-a="undo" type="button">↶ 한 획</button>
        <button class="btn" data-a="clear" type="button">지우기</button>
        <button class="btn primary" data-a="next" type="button">다음 칸 →</button>
      </div>
      <div class="tool-row" data-after style="display:none">
        <button class="btn" data-a="answer" type="button">정답 보기</button>
        <button class="btn" data-a="order" type="button">획순 보기</button>
        <button class="btn" data-a="restart" type="button">다시 쓰기</button>
      </div>
    </div>`;
  const pad = new WritingPad(host.querySelector('.padhost'));
  const fb = host.querySelector('[data-fb]');
  const slots = [...host.querySelectorAll('.slot')];
  const hint = host.querySelector('[data-hint]');

  const paintSlots = () => slots.forEach((s, i) => {
    s.classList.toggle('active', i === cur && !finished);
    s.innerHTML = thumbs[i] ? `<img src="${thumbs[i]}" alt="">` : (finished && opts.revealed ? esc(chars[i]) : '□');
  });
  const saveCur = () => { saved[cur] = pad.rawStrokes(); thumbs[cur] = pad.isEmpty() ? null : pad.thumbnail(120); };
  const select = (i) => {
    if (finished) return;
    saveCur();
    cur = i;
    pad.loadStrokes(saved[i] || []);
    pad.clearOverlay();
    const d = dict[chars[i]];
    hint.textContent = `${i + 1}번째 글자${opts.showHints !== false && d ? ` · 뜻: ${d.m && d.m[0] ? d.m[0][0] : ''}` : ''}`;
    paintSlots();
  };
  slots.forEach((s) => (s.onclick = () => {
    if (finished) { showOrder(+s.dataset.i); return; }
    select(+s.dataset.i);
  }));
  pad.on('stroke', (k) => {
    clearTimeout(autoT);
    const m = meds[cur];
    if (m && k === m.length && cur < n - 1) autoT = setTimeout(() => { if (!finished) host.querySelector('[data-a=next]').click(); }, 900);
  });
  pad.on('start', () => clearTimeout(autoT));

  const finish = () => {
    saveCur();
    finished = true;
    paintSlots();
    const results = chars.map((c, i) => {
      const st = (saved[i] || []).map((s) => s.map((p) => [p.x, p.y]));
      if (!st.length) return { c, verdict: 'empty', pass: false };
      if (!meds[i]) return { c, verdict: 'nodata', pass: null };
      const r = judge(st, meds[i]);
      return { c, verdict: r.verdict, pass: isPass(r.verdict), messages: r.messages };
    });
    slots.forEach((s, i) => {
      const r = results[i];
      const mark = r.pass === true ? '✓' : r.pass === false ? '✗' : '?';
      s.insertAdjacentHTML('beforeend', `<span class="res" style="color:${r.pass ? 'var(--ok)' : r.pass === false ? 'var(--bad)' : 'var(--warn)'}">${mark}</span>`);
      s.classList.remove('active');
    });
    const good = results.filter((r) => r.pass).length;
    const nodata = results.filter((r) => r.pass === null).length;
    fb.className = 'feedback show ' + (good === n ? 'good' : good >= n - 1 ? 'near' : 'retry');
    fb.innerHTML = `${good === n ? '잘 썼어요' : good >= n - 1 ? '거의 맞았어요' : '다시 연습해보세요'} — ${n}자 중 ${good}자 통과${nodata ? ` (획순 데이터 없는 ${nodata}자는 정답과 직접 비교)` : ''}
      <ul>${results.map((r, i) => `<li>${i + 1}. ${esc(r.c)}: ${esc(r.verdict === 'nodata' ? '자동 판정 불가' : VERDICT_TEXT[r.verdict] || r.verdict)}${r.messages && r.messages[0] ? ' — ' + esc(r.messages[0]) : ''}</li>`).join('')}</ul>`;
    host.querySelector('[data-writing]').style.display = 'none';
    host.querySelector('[data-after]').style.display = '';
    hint.textContent = '칸을 누르면 그 글자의 획순을 볼 수 있어요.';
    if (opts.onDone) opts.onDone(results);
  };

  const showOrder = (i) => {
    const ch = chars[i];
    openSheet(`<div class="spread"><h2 class="mt0">획순 · <span class="hanzi">${esc(ch)}</span></h2><button class="btn sm" data-close type="button">닫기</button></div>
      <div class="anim" style="width:220px;max-width:60vw;margin:0 auto"></div><div class="steps-host" style="margin-top:10px"></div>`, async (panel) => {
      const ok = await renderSteps(panel.querySelector('.steps-host'), ch);
      if (!ok) { panel.querySelector('.steps-host').innerHTML = '<div class="notice">이 글자는 공개 획순 데이터가 없어 획순을 표시하지 않습니다.</div>'; return; }
      anim = await animate(panel.querySelector('.anim'), ch);
    });
    window.__sheetClose = () => anim && anim.cancel();
  };

  host.querySelector('[data-a=undo]').onclick = () => pad.undo();
  host.querySelector('[data-a=clear]').onclick = () => pad.clear();
  host.querySelector('[data-a=next]').onclick = () => {
    clearTimeout(autoT);
    if (cur < n - 1) select(cur + 1); else finish();
  };
  const updateNextLabel = () => { host.querySelector('[data-a=next]').textContent = cur < n - 1 ? '다음 칸 →' : '완료'; };
  const origSelect = select;
  pad.on('clear', updateNextLabel);
  host.querySelector('[data-a=answer]').onclick = () => {
    slots.forEach((s, i) => { s.innerHTML = `<span class="hanzi">${esc(chars[i])}</span>` + (s.querySelector('.res') ? s.querySelector('.res').outerHTML : ''); });
    pad.clear();
    pad.setGuide(chars.join('').slice(0, 1), 'none');
  };
  host.querySelector('[data-a=order]').onclick = () => showOrder(0);
  host.querySelector('[data-a=restart]').onclick = () => {
    finished = false;
    for (let i = 0; i < n; i++) { saved[i] = null; thumbs[i] = null; }
    cur = 0; pad.clear(); fb.className = 'feedback';
    host.querySelector('[data-writing]').style.display = '';
    host.querySelector('[data-after]').style.display = 'none';
    origSelect(0);
    updateNextLabel();
  };
  // 선택 시 버튼 라벨 갱신
  const sel2 = (i) => { origSelect(i); updateNextLabel(); };
  slots.forEach((s) => (s.onclick = () => { if (finished) { showOrder(+s.dataset.i); return; } sel2(+s.dataset.i); }));
  host.querySelector('[data-a=next]').onclick = () => { clearTimeout(autoT); if (cur < n - 1) sel2(cur + 1); else finish(); };
  sel2(0);
  return { destroy() { clearTimeout(autoT); if (anim) anim.cancel(); pad.destroy(); } };
}
