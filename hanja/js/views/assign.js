// 학생용 과제 풀이 — 선생님이 준 링크(설정+시드)로 같은 문항을 만들어 풀고, 결과 코드를 선생님께 전달.
// 결과 코드에는 과제 ID·점수·틀린 한자·날짜만 들어가고 이름 등 개인정보는 없다.
import * as D from '../data.js';
import * as S from '../store.js';
import * as W from '../worksheet.js';
import { esc, toast } from '../ui.js';
import { renderQuestion } from '../qrender.js';

export default async function (view, { params }) {
  const spec = W.decode(params.c || '');
  if (!spec || !spec.pid || !spec.lid) { view.innerHTML = '<h1>과제</h1><div class="notice bad">과제 링크가 올바르지 않아요. 선생님께 링크를 다시 받아 주세요.</div>'; return; }
  const P = await D.provider(spec.pid); const L = await D.level(spec.pid, spec.lid);
  if (!P || !L || !L.hasData) { view.innerHTML = '<h1>과제</h1><div class="notice bad">이 과제의 급수 자료를 찾을 수 없어요.</div>'; return; }
  const qs = await W.build(spec);
  const mine = S.get().current && S.get().current.provider === spec.pid;
  let i = 0, score = 0; const wrong = [];
  const step = async () => {
    if (i >= qs.length) {
      const code = W.encode({ a: spec.id, s: score, t: qs.length, w: [...new Set(wrong)], d: S.today() });
      view.innerHTML = `<h1>과제 결과</h1><div class="card center"><div class="cmp-num">${score} / ${qs.length}</div><div class="small">${esc(spec.title || '')}</div></div>
        <h3>선생님께 보낼 결과 코드</h3><div class="row"><input readonly value="${esc(code)}" data-code aria-label="결과 코드" style="flex:1"><button class="btn primary" data-copy type="button">복사</button></div>
        <p class="tiny">결과 코드에는 점수와 틀린 한자만 들어 있어요(이름 없음). 복사해서 선생님께 전달하세요.</p>
        ${wrong.length ? `<p>틀린 한자: <span class="hanzi">${esc([...new Set(wrong)].join(' '))}</span></p>` : ''}<a class="btn block" href="#/home">홈으로</a>`;
      view.querySelector('[data-copy]').onclick = async () => { try { await navigator.clipboard.writeText(code); toast('복사했어요'); } catch (e) { view.querySelector('[data-code]').select(); toast('길게 눌러 복사하세요'); } };
      return;
    }
    const q = qs[i];
    view.innerHTML = `<div class="q-head"><span class="small">${esc(spec.title || '과제')} · ${esc(P.name)} ${esc(L.name)} · ${i + 1}/${qs.length}</span><span class="small">맞힘 ${score}</span></div>
      <div class="progress-top"><i style="width:${(i * 100) / qs.length}%"></i></div><div class="qhost"></div>
      <button class="btn primary block" data-next type="button" style="margin-top:14px;display:none">${i + 1 < qs.length ? '다음 문제' : '결과 보기'}</button>`;
    const next = view.querySelector('[data-next]');
    const t0 = Date.now();
    await renderQuestion(view.querySelector('.qhost'), q, { mode: 'practice', onAnswer: (r) => {
      if (next.style.display === 'block') return;
      if (r.correct) score++; else wrong.push(...(q.relatedHanja || []));
      if (mine) { S.recordAnswer(spec.pid, q, r.correct, { picked: r.picked, rt: Date.now() - t0 }); S.save(); }
      next.style.display = 'block';
    } });
    next.onclick = () => { i++; step(); };
  };
  step();
}
