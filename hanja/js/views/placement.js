// 첫 실행 진단평가: 목표 급수 범위에서 12문항(한자→훈음 · 훈→한자 · 음→한자)
// 결과는 실제 응답만으로 mastery 에 반영하고(맞힌 글자=다음 복습 예약, 틀린 글자=오늘 복습) 개인 학습계획을 만든다.
import * as D from '../data.js';
import * as S from '../store.js';
import * as Q from '../qgen.js';
import * as Coach from '../coach.js';
import { esc, shuffle } from '../ui.js';
import { renderQuestion } from '../qrender.js';

const N = 12;
export default async function (view, { ctx: c }) {
  const dict = await D.dict();
  const scope = await D.scopeChars(c.pid, c.lid);
  const newSet = new Set(await D.scopeChars(c.pid, c.lid, true));
  // 이번 급수 신출 한자 절반 + 하위 급수 한자 절반 → 기초가 되어 있는지와 목표 급수 수준을 함께 확인
  const lower = scope.filter((x) => !newSet.has(x));
  const pickFrom = [...shuffle([...newSet]).slice(0, lower.length ? N : N * 2), ...shuffle(lower).slice(0, N)];
  const types = ['hunum', 'hun-char', 'eum-char'];
  const list = [];
  for (const ch of pickFrom) {
    if (list.length >= N) break;
    const q = Q.charQ(types[list.length % 3], ch, scope, dict, c.pid);
    if (q) { q.level = newSet.has(ch) ? 'new' : 'lower'; list.push(q); }
  }
  if (list.length < 4) {
    view.innerHTML = `<h1>진단평가</h1><div class="notice">이 급수는 진단평가 문항을 만들 수 있는 훈음 자료가 부족해요.</div><a class="btn accent block" href="#/home">학습 시작</a>`;
    return;
  }
  let i = 0; const res = [];
  const step = async () => {
    if (i >= list.length) return finish();
    const q = list[i];
    view.innerHTML = `<div class="spread"><h1 style="margin:0">진단평가</h1><span class="small">${i + 1} / ${list.length}</span></div>
      <p class="sub">${esc(c.provider.name)} ${esc(c.level.name)} · 모르면 “모르겠어요”를 누르세요 (찍지 않아야 계획이 정확해요)</p>
      <div class="progress-line"><i style="width:${Math.round((i * 100) / list.length)}%"></i></div>
      <div class="qhost"></div>
      <div class="btns fill" style="margin-top:10px"><button class="btn" data-idk type="button">모르겠어요</button><button class="btn" data-quit type="button">진단 그만하기</button></div>`;
    const t0 = Date.now();
    await renderQuestion(view.querySelector('.qhost'), q, {
      mode: 'exam',
      onAnswer: ({ picked, correct }) => { answer(q, correct, picked, Date.now() - t0); },
    });
    view.querySelector('[data-idk]').onclick = () => answer(q, false, null, Date.now() - t0);
    view.querySelector('[data-quit]').onclick = () => finish();
  };
  const answer = (q, correct, picked, rt) => {
    res.push({ q, correct, picked });
    S.recordAnswer(c.pid, q, correct, { picked, rt });
    i++;
    setTimeout(step, 150);
  };
  const finish = async () => {
    S.get().placement = S.get().placement || {};
    const nOk = res.filter((r) => r.correct).length;
    const byLv = (lv) => { const x = res.filter((r) => r.q.level === lv); return x.length ? Math.round((x.filter((r) => r.correct).length * 100) / x.length) : null; };
    S.get().placement[c.pid + ':' + c.lid] = { t: Date.now(), n: res.length, ok: nOk, newPct: byLv('new'), lowerPct: byLv('lower') };
    S.save(true);
    const c2 = { ...c, p: S.prov(c.pid) };
    const st = await Coach.status(c2);
    const tp = await Coach.todayPlan(c2, st);
    const lowP = byLv('lower'), newP = byLv('new');
    const advice = !res.length ? '진단 없이 시작합니다. 학습 기록이 쌓이면 계획이 자동으로 조정돼요.'
      : lowP != null && lowP < 60 ? '하위 급수 한자부터 다지는 것이 좋아요. 복습량을 늘린 계획으로 시작합니다.'
      : newP != null && newP >= 70 ? '이번 급수 한자도 꽤 알고 있어요. 모르는 글자 위주로 빠르게 진행합니다.'
      : '이번 급수 신출 한자를 중심으로 하루 목표를 나눴어요.';
    view.innerHTML = `<h1>진단 결과</h1>
      <div class="card center"><div class="cmp-num">${nOk} / ${res.length}</div><div class="small">실제로 푼 ${res.length}문항 기준</div></div>
      <div class="table-wrap" style="margin-top:10px"><table><tbody>
        <tr><th>하위 급수 한자</th><td>${lowP == null ? '해당 없음' : lowP + '%'}</td></tr>
        <tr><th>이번 급수 신출 한자</th><td>${newP == null ? '해당 없음' : newP + '%'}</td></tr>
      </tbody></table></div>
      <p>${esc(advice)}</p>
      <h3>오늘의 개인 학습계획</h3>
      <div class="card"><div class="coach-grid">
        ${[['신규 한자', tp.plan.hanja], ['복습', tp.plan.review], ['쓰기', tp.plan.writing], ['한자어', tp.plan.words], ['사자성어', tp.plan.idioms], ['시험형 문제', tp.plan.questions]].map(([k, v]) => `<div><b>${v}</b><span class="small">${k}</span></div>`).join('')}
      </div><p class="tiny">목표 한자 ${st.target.toLocaleString()}자 · 하루 ${tp.minutes}분 · ${tp.dLeft != null ? '시험까지 ' + tp.dLeft + '일' : '시험일 미정(30일 기준)'}</p></div>
      <a class="btn accent block" href="#/home" style="margin-top:14px;min-height:52px">학습 계획 보기</a>`;
  };
  step();
}
