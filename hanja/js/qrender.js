// 문제 1개 렌더링(객관식 · 필순 · 필기) + 해설
import * as D from './data.js';
import { esc, isHanzi } from './ui.js';
import { WritingPad } from './pad.js';
import { judge, isPass, VERDICT_TEXT } from './judge.js';
import { renderChar, referenceMedians, renderSteps } from './strokes.js';

// opts: {mode:'practice'|'exam', onAnswer(result), selected}
export async function renderQuestion(host, q, opts = {}) {
  host.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'qbox';
  const promptHtml = q.prompt ? `<div class="q-prompt">${esc(q.prompt)}</div>` : '';
  wrap.innerHTML = `
    <div class="tag-label">${esc(q.typeLabel)}${q.sourceType === 'original-practice' ? ' · 기출유형 연습' : ''}</div>
    <div class="q-text">${esc(q.question)}</div>
    ${q.type === 'stroke-order' ? '<div class="q-stroke" style="width:min(62vw,230px);margin:10px auto"></div>' : promptHtml}
    <div class="q-body"></div>
    <div class="q-explain"></div>`;
  host.appendChild(wrap);
  const body = wrap.querySelector('.q-body');
  if (q.type === 'stroke-order') {
    const box = wrap.querySelector('.q-stroke');
    const ok = await renderChar(box, q.prompt, { highlight: q.strokeIndex, grid: true });
    if (!ok) box.innerHTML = '<div class="notice">획순 데이터를 불러오지 못했습니다.</div>';
  }
  if (q.type === 'write' || q.type === 'idiom-write' || q.type === 'word-write') return renderWrite(body, wrap, q, opts);
  return renderMC(body, wrap, q, opts);
}

function renderMC(body, wrap, q, opts) {
  const list = document.createElement('div');
  list.className = 'choices';
  q.choices.forEach((ch, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'choice' + (opts.selected === i ? ' pick' : '');
    b.innerHTML = `<span class="n">${i + 1}</span><span class="t ${isHanzi(ch) && ch.length <= 6 && !/[가-힣]/.test(ch) ? 'hz' : ''}">${esc(ch)}</span>`;
    b.onclick = () => {
      if (opts.mode === 'exam') {
        [...list.children].forEach((x) => x.classList.remove('pick'));
        b.classList.add('pick');
        opts.onAnswer && opts.onAnswer({ picked: i, correct: i === q.answer });
        return;
      }
      if (list.dataset.done) return;
      list.dataset.done = '1';
      const correct = i === q.answer;
      b.classList.add(correct ? 'correct' : 'wrong');
      list.children[q.answer].classList.add('correct');
      showExplain(wrap.querySelector('.q-explain'), q, i, correct);
      opts.onAnswer && opts.onAnswer({ picked: i, correct });
    };
    list.appendChild(b);
  });
  body.appendChild(list);
}

async function renderWrite(body, wrap, q, opts) {
  const target = q.answer;
  const d = (await D.dict())[target];
  const medians = await referenceMedians(target);
  body.innerHTML = `<div class="write-wrap" style="margin-top:12px"><div class="padhost" style="width:100%;display:flex;justify-content:center"></div>
    <div class="tool-row">
      <button class="btn" data-act="undo" type="button">한 획 지우기</button>
      <button class="btn" data-act="clear" type="button">지우기</button>
      <button class="btn primary" data-act="submit" type="button">${opts.mode === 'exam' ? '저장' : '제출'}</button>
    </div>
    <div class="feedback"></div></div>`;
  const pad = new WritingPad(body.querySelector('.padhost'));
  if (opts.savedStrokes) pad.loadStrokes(opts.savedStrokes);
  const fb = body.querySelector('.feedback');
  body.querySelector('[data-act=undo]').onclick = () => pad.undo();
  body.querySelector('[data-act=clear]').onclick = () => { pad.clear(); fb.className = 'feedback'; };
  const submit = body.querySelector('[data-act=submit]');
  submit.onclick = () => {
    if (pad.isEmpty()) { fb.className = 'feedback show retry'; fb.textContent = VERDICT_TEXT.empty; return; }
    if (!medians) {
      // 획순 데이터가 없는 글자: 자동 판정 불가 → 자기 채점
      fb.className = 'feedback show near';
      fb.innerHTML = `이 글자는 공개 획순 데이터가 없어 자동 판정을 할 수 없어요. 정답 <b class="hanzi" style="font-size:28px">${esc(target)}</b>과 비교해 스스로 채점하세요.
        <div class="btns" style="margin-top:8px"><button class="btn sm ok" data-self="1" type="button">맞게 썼어요</button><button class="btn sm bad" data-self="0" type="button">틀렸어요</button></div>`;
      fb.querySelectorAll('[data-self]').forEach((b) => (b.onclick = () => {
        const correct = b.dataset.self === '1';
        if (opts.mode !== 'exam') showExplain(wrap.querySelector('.q-explain'), q, null, correct);
        opts.onAnswer && opts.onAnswer({ correct, verdict: correct ? 'self-ok' : 'self-fail', strokes: pad.rawStrokes(), selfGraded: true });
      }));
      return;
    }
    const r = judge(pad.getStrokes(), medians);
    const correct = isPass(r.verdict);
    if (opts.mode === 'exam') {
      fb.className = 'feedback show near';
      fb.textContent = '답안을 저장했어요. 채점은 제출 후 확인할 수 있어요.';
      opts.onAnswer && opts.onAnswer({ correct, verdict: r.verdict, strokes: pad.rawStrokes() });
      return;
    }
    pad.showOverlay(r.per);
    fb.className = 'feedback show ' + r.verdict;
    fb.innerHTML = `${esc(r.text)}${r.messages.length ? '<ul>' + r.messages.map((m) => `<li>${esc(m)}</li>`).join('') + '</ul>' : ''}`;
    submit.disabled = true;
    showExplain(wrap.querySelector('.q-explain'), q, null, correct, { verdict: r.verdict });
    opts.onAnswer && opts.onAnswer({ correct, verdict: r.verdict, strokes: pad.rawStrokes() });
  };
  return pad;
}

export async function showExplain(el, q, picked, correct, extra = {}) {
  const dict = await D.dict();
  const words = await D.words();
  const ans = q.type === 'write' ? q.answer : q.choices[q.answer];
  const parts = [];
  parts.push(`<h4>${correct ? '✅ 정답입니다' : '❌ 오답입니다'}</h4>`);
  parts.push(`<div><b>정답:</b> <span class="${isHanzi(ans) ? 'hanzi' : ''}" style="font-size:18px">${esc(ans)}</span></div>`);
  if (!correct && picked != null && q.choices[picked] != null) {
    const pv = q.choices[picked];
    let why = '';
    if (pv.length === 1 && dict[pv]) why = `선택한 ${pv}은(는) '${D.heAll(dict[pv])}'입니다.`;
    else if (words.get(pv)) why = `선택한 ${pv}은(는) '${words.get(pv).r}'(으)로 읽는 다른 한자어입니다.`;
    else if (q.type === 'hunum' || q.type === 'reading-char' || q.type === 'word-reading') why = `선택한 '${pv}'은(는) 이 문제의 한자/한자어와 맞지 않습니다.`;
    else why = `선택한 답: ${pv}`;
    parts.push(`<div style="margin-top:4px"><b>왜 틀렸나요?</b> ${esc(why)}</div>`);
  }
  if (extra.verdict && !correct) parts.push(`<div><b>필기 판정:</b> ${esc(VERDICT_TEXT[extra.verdict] || '')}</div>`);
  parts.push(`<div style="margin-top:6px">${esc(q.explanation)}</div>`);
  const rel = [...new Set(q.relatedHanja || [])].filter((c) => dict[c]).slice(0, 4);
  if (rel.length) {
    parts.push('<div class="hr"></div><b>관련 한자</b>');
    for (const c of rel) {
      const d = dict[c];
      const ex = (d.ex || []).slice(0, 3).map((w) => `${w}(${(words.get(w) || {}).r || ''})`).join(', ');
      parts.push(`<div class="list-row"><span class="hz">${esc(c)}</span><div class="grow"><div><b>뜻·음</b> ${esc(D.heAll(d))}</div>
        <div class="small">부수 ${esc(d.rad || '-')} · 총 ${esc(d.st || d.sc || '-')}획${ex ? ' · 관련 단어 ' + esc(ex) : ''}</div></div></div>`);
    }
  }
  el.innerHTML = `<div class="explain">${parts.join('')}</div>`;
  if ((q.type === 'write' || q.type === 'stroke-order') && !correct) {
    const box = document.createElement('div');
    box.style.marginTop = '10px';
    el.querySelector('.explain').appendChild(box);
    const c = q.type === 'write' ? q.answer : q.prompt;
    const ok = await renderSteps(box, c);
    if (!ok) box.innerHTML = '<div class="small">이 글자는 공개 획순 데이터가 없어 획순을 표시하지 않습니다.</div>';
  }
}
