import * as D from '../data.js';
import * as S from '../store.js';
import { esc, shuffle, daehanFooter } from '../ui.js';
import { renderQuestion } from '../qrender.js';
import * as Q from '../qgen.js';

export default async function (view, { ctx: c, params }) {
  const bank = c.level.hasData ? await D.bank(c.pid, c.lid) : null;
  if (!bank) {
    view.innerHTML = `<h1>문제 풀이</h1>
      <div class="notice bad">${esc(c.provider.name)} ${esc(c.level.name)}: 배정한자 공식 자료 확인 필요 — 공식 범위를 모르는 상태에서 문제를 만들지 않아요.</div>
      <div class="btns"><a class="btn" href="${esc(c.provider.pastExamUrl)}" target="_blank" rel="noopener">공식 기출문제 보기 ↗</a><a class="btn" href="#/idioms">사자성어 문제</a></div>`;
    return;
  }
  // 훈→한자 · 음→한자 문항은 배정한자 범위에서 즉석 생성(자체 제작, 공식 훈음 자료 기준)
  const dict = await D.dict();
  const scope = await D.scopeChars(c.pid, c.lid);
  const gen = Q.mixed(scope, dict, c.pid, Math.min(240, scope.length * 2), ['hun-char', 'eum-char']);
  const qs = bank.questions.concat(gen);
  // 진흥회·상공회의소는 공식 출제 영역(area) 기준으로 묶어 보여 줌
  const keyOf = (q) => (c.pid === 'jinheung' || c.pid === 'korcham') && q.area ? q.area : q.typeLabel;
  const types = {};
  for (const q of qs) types[keyOf(q)] = (types[keyOf(q)] || 0) + 1;
  const qi = await D.questionIndex().catch(() => null);
  const qiP = qi && qi.providers[c.pid];
  const et = await D.examTypes(c.pid).catch(() => null);
  const sel = { type: params.type || '전체', n: +(params.n || 10) };
  const draw = () => {
    view.innerHTML = `
      <h1>문제 풀이</h1>
      <p class="sub">${esc(c.provider.name)} ${esc(c.level.name)} · <b>기출유형 연습문제 · 예상문제</b></p>
      <div class="notice info">공식 배정한자와 공식 문제유형을 기준으로 이 앱에서 새로 만든 문제예요 (실제 기출문제가 아니에요). 문제은행 ${qs.length.toLocaleString()}문항.</div>
      <details class="card flat" style="margin:10px 0"><summary><b>문제은행 구성 · 출처 구분</b></summary>
        <div class="table-wrap" style="margin-top:8px"><table><tbody>
          <tr><th>이 앱의 문제</th><td>자체 제작 연습문제 ${qs.length.toLocaleString()}문항 <span class="badge">original</span><div class="tiny">공식 배정/선정한자 범위와 공식 출제 유형을 기준으로 만든 문제예요. 실제 기출문제가 아니에요.</div></td></tr>
          <tr><th>공식 자료</th><td>배정한자·급수·훈음·문항 수·합격 기준 <span class="badge">official-fact</span> · 사전/획순 <span class="badge">public-domain</span></td></tr>
          <tr><th>공식 기출문제</th><td>저작권 보호 — 앱에 저장하지 않고 공식 사이트로만 연결 <a href="${esc(c.provider.pastExamUrl)}" target="_blank" rel="noopener">공식 기출 ↗</a></td></tr>
          <tr><th>모의시험</th><td>공식 문항 수·시간·합격 기준에 맞춰 자체 제작 문항으로 구성</td></tr>
        </tbody></table></div>
        ${qiP && qiP.levels[c.lid] ? `<div class="table-wrap" style="margin-top:8px"><table><thead><tr><th>출제 영역</th><th>문항</th></tr></thead><tbody>${Object.entries(qiP.levels[c.lid].byArea).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<tr><td>${esc(k)}</td><td>${v.toLocaleString()}</td></tr>`).join('')}</tbody></table></div>` : ''}
      </details>
      <h3>문제 유형</h3>
      <div class="chips">${['전체', ...Object.keys(types)].map((t) => `<button class="chip ${sel.type === t ? 'sel' : ''}" data-t="${esc(t)}" type="button">${esc(t)}${t !== '전체' ? ` <span class="small">${types[t]}</span>` : ''}</button>`).join('')}</div>
      ${et && et.status !== 'official' ? `<p class="tiny">유형 구성: ${esc(et.statusNote || '')}</p>` : ''}
      <h3>문항 수</h3>
      <div class="chips">${[10, 20, 30].map((n) => `<button class="chip ${sel.n === n ? 'sel' : ''}" data-n="${n}" type="button">${n}문제</button>`).join('')}</div>
      <button class="btn accent block" data-start type="button" style="margin-top:18px;min-height:56px">풀기 시작</button>
      <div class="btns" style="margin-top:12px"><a class="btn sm" href="#/wrong">오답노트</a><a class="btn sm" href="#/mock">모의시험</a>
        <a class="btn sm" href="${esc(c.provider.pastExamUrl)}" target="_blank" rel="noopener">공식 기출문제 보기 ↗</a></div>
      <p class="tiny">${esc(c.provider.pastExamPolicy)}</p>
      ${c.pid === 'daehan' ? daehanFooter() : ''}`;
    view.querySelectorAll('[data-t]').forEach((b) => (b.onclick = () => { sel.type = b.dataset.t; draw(); }));
    view.querySelectorAll('[data-n]').forEach((b) => (b.onclick = () => { sel.n = +b.dataset.n; draw(); }));
    view.querySelector('[data-start]').onclick = () => {
      const pool = sel.type === '전체' ? qs : qs.filter((q) => keyOf(q) === sel.type);
      const seen = c.p.quiz.seen || (c.p.quiz.seen = {});
      const fresh = shuffle(pool.filter((q) => !seen[q.id]));
      const old = shuffle(pool.filter((q) => seen[q.id]));
      // 전체 유형일 때는 유형이 고르게 섞이도록
      let pick = [...fresh, ...old];
      if (sel.type === '전체') {
        const byT = {};
        for (const q of pick) (byT[q.typeLabel] = byT[q.typeLabel] || []).push(q);
        const out = []; const keys = shuffle(Object.keys(byT));
        while (out.length < sel.n && keys.some((k) => byT[k].length)) for (const k of keys) if (byT[k].length && out.length < sel.n) out.push(byT[k].shift());
        pick = out;
      }
      runSession(view, c, pick.slice(0, sel.n), { title: `${sel.type} 연습` });
    };
  };
  draw();
}

// 공용 문제 풀이 세션 (연습/오답 다시 풀기/복습)
export function runSession(view, c, list, opts = {}) {
  let i = 0, correct = 0;
  const wrongs = [];
  const step = async () => {
    if (i >= list.length) {
      const pct = list.length ? Math.round((correct * 100) / list.length) : 0;
      view.innerHTML = `<h1>채점 결과</h1>
        <div class="card center"><div class="cmp-num">${correct} / ${list.length}</div><div class="small">정답률 ${pct}%</div></div>
        ${wrongs.length ? `<h3>틀린 문제 (${wrongs.length}) — 오답노트에 저장됨</h3><div class="card">${wrongs.map((q) => `<div class="list-row"><span class="hz">${esc(q.prompt || (q.type === 'write' ? q.answer : q.choices[q.answer]) || '')}</span><div class="grow"><b>${esc(q.typeLabel)}</b><div class="small">${esc(q.question)}</div><div class="small">정답: ${esc(q.type === 'write' ? q.answer : q.choices[q.answer])}</div></div></div>`).join('')}</div>` : '<p class="center">모두 맞혔어요! 🎉</p>'}
        <div class="btns fill" style="margin-top:14px">${opts.again !== false ? '<button class="btn accent" data-again type="button">다시 풀기</button>' : ''}<a class="btn" href="#/wrong">오답노트</a><a class="btn" href="#/home">홈</a></div>`;
      const a = view.querySelector('[data-again]');
      if (a) a.onclick = () => location.reload();
      if (opts.onDone) opts.onDone({ correct, total: list.length, wrongs });
      return;
    }
    const q = list[i];
    view.innerHTML = `
      <div class="q-head"><span class="small">${esc(opts.title || '문제')} · ${i + 1}/${list.length}</span><span class="small">맞힘 ${correct}</span></div>
      <div class="progress-top"><i style="width:${(i * 100) / list.length}%"></i></div>
      <div class="qhost"></div>
      <button class="btn primary block" data-next type="button" style="margin-top:14px;display:none">${i + 1 < list.length ? '다음 문제' : '결과 보기'}</button>`;
    const next = view.querySelector('[data-next]');
    const t0 = Date.now();
    await renderQuestion(view.querySelector('.qhost'), q, {
      mode: 'practice',
      onAnswer: (r) => {
        if (next.style.display === 'block') return;
        if (r.correct) correct++; else wrongs.push(q);
        S.recordAnswer(c.pid, q, r.correct, { picked: r.picked, rt: Date.now() - t0 });
        const seen = c.p.quiz.seen || (c.p.quiz.seen = {});
        seen[q.id] = 1;
        if (q.word) { const e = c.p.words[q.word] || { ok: 0, fail: 0 }; if (r.correct) e.ok++; else e.fail++; e.t = Date.now(); c.p.words[q.word] = e; }
        if (q.type === 'write') S.recordWriting(c.pid, q.answer, r.verdict === 'good' ? 'good' : r.verdict === 'near' ? 'near' : 'retry');
        S.save();
        next.style.display = 'block';
      },
    });
    next.onclick = () => { i++; step(); };
  };
  step();
}
