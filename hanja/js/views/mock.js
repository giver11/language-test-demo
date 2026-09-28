import * as D from '../data.js';
import * as S from '../store.js';
import { esc, shuffle, toast, statusBadge, daehanFooter } from '../ui.js';
import { renderQuestion } from '../qrender.js';

const TYPE_POOL = {
  독음: ['word-reading', 'word-from-reading', 'reading-char'],
  훈음: ['hunum', 'hunum-rev'],
  반의어: ['antonym'],
  완성형: ['word-blank', 'idiom-blank'],
  부수: ['radical'],
  동의어: ['synonym'],
  동음이의어: ['homophone-char'],
  뜻풀이: ['idiom-meaning', 'word-gloss'],
  필순: ['stroke-order'],
  한자쓰기: ['write'],
  획수: ['stroke-count'],
  문장: ['sentence-reading'],
};
const SUBSTITUTE = { 장단음: '독음', 약자: '훈음' };
const RUN_KEY = 'hanjaPass.mockRun';

function compose(bank, dist, scale = 1, pools = null) {
  const poolOf = (k) => (pools && pools[k]) || TYPE_POOL[k] || [];
  const byType = {};
  for (const q of bank.questions) (byType[q.type] = byType[q.type] || []).push(q);
  for (const k of Object.keys(byType)) byType[k] = shuffle(byType[k]);
  const used = new Set();
  const take = (types, n) => {
    const out = [];
    for (const t of types) {
      while (out.length < n && byType[t] && byType[t].length) {
        const q = byType[t].pop();
        if (!used.has(q.id)) { used.add(q.id); out.push(q); }
      }
    }
    return out;
  };
  const plan = [];
  const notes = [];
  for (const [key, cnt0] of Object.entries(dist)) {
    const cnt = Math.round(cnt0 * scale);
    if (!cnt) continue;
    let k = key;
    if (SUBSTITUTE[key]) { notes.push(`${key} ${cnt}문항 → ${SUBSTITUTE[key]} 문항으로 대체 (${key} 데이터 미확보)`); k = SUBSTITUTE[key]; }
    let got = take(poolOf(k), cnt);
    if (got.length < cnt) {
      const need = cnt - got.length;
      notes.push(`${key} ${need}문항 부족 → 독음·훈음 문항으로 채움`);
      got = got.concat(take([...TYPE_POOL['독음'], ...TYPE_POOL['훈음'], ...Object.values(pools || {}).flat()], need));
    }
    plan.push(...got.map((q) => ({ ...q, section: key })));
  }
  return { questions: plan, notes };
}

export default async function (view, { ctx: c, args, params }) {
  if (args[0] === 'run') return run(view, c);
  if (args[0] === 'result') return showResult(view, c, +(params.i || 0));
  const L = c.level;
  // 대한검정회: 현장시험(offline) / 자기주도형 온라인 시험(online, 8~3급) 형식 분리
  const mode = params.mode === 'online' && L.examOnline ? 'online' : 'offline';
  const ex = (mode === 'online' ? L.examOnline : L.exam) || {};
  if (mode === 'online') ex.mockSupported = L.exam && L.exam.mockSupported;
  const et = await D.examTypes(c.pid).catch(() => null);
  const saved = loadRun();
  const history = c.p.mocks.filter((m) => m.level === c.lid).slice(-5).reverse();
  let formatHtml = '';
  if (c.pid === 'eomunhoe' && et) {
    const dist = et.levels[c.lid];
    formatHtml = `<div class="table-wrap"><table><thead><tr><th>유형</th><th>문항</th><th>앱 구성</th></tr></thead><tbody>${Object.entries(dist).filter(([, v]) => v).map(([k, v]) => `<tr><td>${esc(k)}</td><td>${v}</td><td class="small">${SUBSTITUTE[k] ? `${SUBSTITUTE[k]} 문항으로 대체` : '자체 제작 유사문제'}</td></tr>`).join('')}</tbody></table></div>
      <p class="tiny">${esc(et.statusNote)} ${statusBadge(et.status)}</p>`;
  } else if (c.pid === 'daehan' && et) {
    const dist = et.levels[c.lid] || {};
    const sc = L.exam && ex.questionCount ? ex.questionCount / L.exam.questionCount : 1;
    formatHtml = `<div class="table-wrap"><table><thead><tr><th>영역(앱 구성)</th><th>문항</th></tr></thead><tbody>${Object.entries(dist).filter(([, v]) => v).map(([k, v]) => `<tr><td>${esc(k)}</td><td>${Math.round(v * sc)}</td></tr>`).join('')}</tbody></table></div>
      <p class="tiny">공식 문항 수·시간·합격 기준은 공식 시험안내 기준, 영역별 배분은 앱 구성입니다. ${statusBadge(et.status)}</p>`;
  } else if (c.pid === 'korcham') {
    formatHtml = `<div class="table-wrap"><table><thead><tr><th>영역</th><th>문항</th><th>배점</th></tr></thead><tbody>${Object.entries(ex.sections || {}).map(([k, v]) => `<tr><td>${k}</td><td>${v}</td><td>${ex.points[k]}점</td></tr>`).join('')}</tbody></table></div>
      <p class="tiny">만점 ${ex.fullScore}점 · ${esc(ex.passRule || '')} (공식). 영역 안 세부 유형은 앱 구성입니다.</p>`;
  } else if (c.pid === 'jinheung') {
    const dist = (et && et.levels && et.levels[c.lid]) || {};
    formatHtml = `<div class="table-wrap"><table><tbody><tr><th>총 문항</th><td>${ex.questionCount}</td></tr><tr><th>주관식</th><td>${ex.subjective} (한자쓰기 ${ex.writing})</td></tr><tr><th>객관식</th><td>${ex.objective}</td></tr><tr><th>배점/만점</th><td>${ex.pointEach} / ${ex.fullScore}</td></tr></tbody></table></div>
      ${Object.keys(dist).length ? `<div class="table-wrap" style="margin-top:8px"><table><thead><tr><th>출제 영역(공식 비율 환산)</th><th>문항</th></tr></thead><tbody>${Object.entries(dist).filter(([, v]) => v).map(([k, v]) => `<tr><td>${esc(k)}</td><td>${v}</td></tr>`).join('')}</tbody></table></div>
      <p class="tiny">${esc((et && et.statusNote) || '')}</p>` : ''}`;
  }
  view.innerHTML = `
    <h1>모의시험</h1>
    <p class="sub">${esc(c.provider.name)} ${esc(L.name)} · 공식 시험 형식 기준</p>
    ${L.examOnline ? `<div class="tabs" role="tablist"><button class="${mode === 'offline' ? 'on' : ''}" data-mode="offline" type="button">현장시험</button><button class="${mode === 'online' ? 'on' : ''}" data-mode="online" type="button">온라인 시험 (8~3급)</button></div>` : ''}
    ${ex.structure ? `<p class="small">시험 방식: ${esc(ex.examMode === 'online' ? '자기주도형 온라인 시험' : '현장시험')} · ${esc(ex.structure)}</p>` : ''}
    <div class="card">
      <dl class="kv" style="font-size:15px"><dt>문항 수</dt><dd>${ex.questionCount != null ? ex.questionCount : '공식 자료 확인 필요'}문항</dd>
        <dt>시험 시간</dt><dd>${ex.timeMin ? ex.timeMin + '분' : '공식 자료 확인 필요'}</dd>
        <dt>합격 기준</dt><dd>${esc(ex.passRule || '공식 자료 확인 필요')}</dd>
        ${ex.format ? `<dt>방식</dt><dd>${esc(ex.format)}</dd>` : ''}</dl>
    </div>
    <h3>출제 구성</h3>${formatHtml || '<p class="small">공식 자료 확인 필요</p>'}
    ${L.notes && L.notes.length ? `<div class="notice">${L.notes.map(esc).join('<br>')}</div>` : ''}
    ${ex.mockSupported ? `
      ${saved && saved.pid === c.pid && saved.lid === c.lid ? `<div class="notice info">진행 중인 모의시험이 있어요. <a href="#/mock/run">이어서 풀기 →</a></div>` : ''}
      <div class="btns fill" style="margin-top:14px">
        <button class="btn accent" data-start="full" type="button" style="min-height:56px">실전 모의시험 (${ex.questionCount}문항 · ${ex.timeMin}분)</button>
      </div>
      <div class="btns fill" style="margin-top:8px">
        <button class="btn" data-start="mini" type="button">미니 모의시험 (1/5 축소 · ${Math.round(ex.timeMin / 5)}분)</button>
      </div>
      <p class="tiny">문제는 공식 배정한자·공식 유형 기준의 자체 제작 “실전 유사문제”입니다. 한자쓰기 문항은 필기 판정으로 채점합니다.</p>`
      : `<div class="notice bad">이 기관·급수는 모의시험을 제공하지 않아요: ${esc(ex.mockBlockedReason || '공식 시험형식 또는 배정한자 ' + '공식 자료 확인 필요')}.</div>`}
    ${history.length ? `<h3>최근 기록</h3><div class="card">${history.map((m, k) => `<div class="list-row"><div class="grow"><b>${m.pct}%</b> · ${m.correct}/${m.total} ${m.mini ? '<span class="badge">미니</span>' : ''} ${m.pass ? '<span class="badge official">합격기준 충족</span>' : '<span class="badge missing">기준 미달</span>'}<div class="small">${new Date(m.t).toLocaleString('ko-KR')}</div></div><a class="btn sm" href="#/mock/result?i=${c.p.mocks.indexOf(m)}">결과</a></div>`).join('')}</div>` : ''}
    ${c.pid === 'daehan' ? daehanFooter() : ''}`;
  view.querySelectorAll('[data-mode]').forEach((b) => (b.onclick = () => { location.hash = '#/mock?mode=' + b.dataset.mode; }));
  view.querySelectorAll('[data-start]').forEach((b) => (b.onclick = async () => {
    const bank = await D.bank(c.pid, c.lid);
    const dist = et.levels[c.lid];
    const mini = b.dataset.start === 'mini';
    const base = L.exam && L.exam.questionCount && ex.questionCount ? ex.questionCount / L.exam.questionCount : 1;
    const { questions, notes } = compose(bank, dist, (mini ? 0.2 : 1) * base, et && et.pools);
    const scoring = ex.points ? { points: ex.points, passTotalRatio: ex.passTotalRatio, passSectionMin: ex.passSectionMin } : null;
    const runState = { pid: c.pid, lid: c.lid, mini, examMode: ex.examMode || 'offline', start: Date.now(), timeMin: mini ? Math.max(5, Math.round(ex.timeMin / 5)) : ex.timeMin,
      passCount: ex.passCount == null ? null : mini ? Math.ceil((ex.passCount * questions.length) / ex.questionCount) : ex.passCount, officialPass: ex.passCount, officialTotal: ex.questionCount, scoring, passRule: ex.passRule,
      questions, answers: {}, notes, cur: 0 };
    saveRun(runState);
    location.hash = '#/mock/run';
  }));
}

function loadRun() { try { return JSON.parse(localStorage.getItem(RUN_KEY) || 'null'); } catch (e) { return null; } }
function saveRun(r) { try { localStorage.setItem(RUN_KEY, JSON.stringify(r)); } catch (e) { toast('저장 공간이 부족해요'); } }

async function run(view, c) {
  const R = loadRun();
  if (!R || R.pid !== c.pid) { view.innerHTML = '<div class="empty">진행 중인 모의시험이 없어요. <a href="#/mock">모의시험</a></div>'; return; }
  let timer = null, pad = null;
  const end = R.start + R.timeMin * 60000;
  const tick = () => {
    const left = Math.max(0, end - Date.now());
    const el = view.querySelector('.timer');
    if (el) { const m = Math.floor(left / 60000), s = Math.floor((left % 60000) / 1000); el.textContent = `${m}:${String(s).padStart(2, '0')}`; el.classList.toggle('low', left < 5 * 60000); }
    if (left <= 0) { clearInterval(timer); toast('시험 시간이 끝나 자동 제출합니다'); submit(); }
  };
  const draw = async () => {
    const q = R.questions[R.cur];
    const answered = Object.keys(R.answers).length;
    view.innerHTML = `
      <div class="spread" style="position:sticky;top:52px;background:var(--bg);z-index:5;padding:6px 0">
        <span class="small"><b>${R.cur + 1}</b>/${R.questions.length} · 답한 문항 ${answered}</span>
        <span class="timer">--:--</span>
        <button class="btn sm accent" data-submit type="button">제출</button></div>
      <div class="progress-top"><i style="width:${(answered * 100) / R.questions.length}%"></i></div>
      <div class="small">[${esc(q.section)}]</div>
      <div class="qhost"></div>
      <div class="btns fill" style="margin-top:14px"><button class="btn" data-prev type="button" ${R.cur ? '' : 'disabled'}>← 이전</button><button class="btn primary" data-next type="button">${R.cur + 1 < R.questions.length ? '다음 →' : '마지막 문항'}</button></div>
      <details style="margin-top:14px"><summary class="small">문항 이동</summary><div class="qnav" style="margin-top:8px">${R.questions.map((x, k) => `<button data-go="${k}" class="${R.answers[k] ? 'ans' : ''} ${k === R.cur ? 'cur' : ''}" type="button">${k + 1}</button>`).join('')}</div></details>
      <div class="confirm-host"></div>`;
    tick();
    if (pad) { pad.destroy && pad.destroy(); pad = null; }
    const a = R.answers[R.cur];
    pad = await renderQuestion(view.querySelector('.qhost'), q, {
      mode: 'exam', selected: a ? a.picked : undefined, savedStrokes: a && a.strokes,
      onAnswer: (r) => { R.answers[R.cur] = { picked: r.picked, correct: r.correct, verdict: r.verdict, strokes: r.strokes }; saveRun(R); view.querySelector('.small b').parentElement.innerHTML = `<b>${R.cur + 1}</b>/${R.questions.length} · 답한 문항 ${Object.keys(R.answers).length}`; },
    });
    view.querySelector('[data-prev]').onclick = () => { R.cur--; saveRun(R); draw(); };
    view.querySelector('[data-next]').onclick = () => { if (R.cur + 1 < R.questions.length) { R.cur++; saveRun(R); draw(); } };
    view.querySelectorAll('[data-go]').forEach((b) => (b.onclick = () => { R.cur = +b.dataset.go; saveRun(R); draw(); }));
    view.querySelector('[data-submit]').onclick = () => {
      const left = R.questions.length - Object.keys(R.answers).length;
      const host = view.querySelector('.confirm-host');
      host.innerHTML = `<div class="notice" style="margin-top:14px">${left ? `아직 ${left}문항에 답하지 않았어요. ` : ''}제출하면 채점합니다.<div class="btns" style="margin-top:8px"><button class="btn sm accent" data-yes type="button">제출하고 채점</button><button class="btn sm" data-no type="button">계속 풀기</button></div></div>`;
      host.scrollIntoView({ behavior: 'smooth', block: 'center' });
      host.querySelector('[data-yes]').onclick = submit;
      host.querySelector('[data-no]').onclick = () => (host.innerHTML = '');
    };
  };
  const submit = () => {
    clearInterval(timer);
    const byType = {};
    const weak = {}, weakWrite = {}, weakIdiom = {};
    let correct = 0;
    R.questions.forEach((q, k) => {
      const a = R.answers[k];
      const ok = !!(a && a.correct);
      if (ok) correct++;
      const t = byType[q.section] || (byType[q.section] = { a: 0, c: 0 });
      t.a++; if (ok) t.c++;
      if (!ok) {
        (q.relatedHanja || []).forEach((ch) => (weak[ch] = (weak[ch] || 0) + 1));
        if (q.type === 'write') weakWrite[q.answer] = (weakWrite[q.answer] || 0) + 1;
        if (q.idiom) weakIdiom[q.idiom] = (weakIdiom[q.idiom] || 0) + 1;
      }
      S.recordAnswer(c.pid, q, ok, { picked: a ? a.picked : null });
      if (q.type === 'write' && a && a.verdict) S.recordWriting(c.pid, q.answer, a.verdict === 'good' ? 'good' : a.verdict === 'near' ? 'near' : 'retry');
    });
    const total = R.questions.length;
    // 대한상공회의소: 영역별 배점(한자4·어휘6·독해8) 합산 + 전체 득점 비율 + 과목별 최소 비율(공식 합격기준)
    let score = null, fullScore = null, weightedPass = null;
    if (R.scoring) {
      score = 0; fullScore = 0; weightedPass = true;
      for (const [sec, v] of Object.entries(byType)) {
        const pt = R.scoring.points[sec] || 0;
        score += v.c * pt; fullScore += v.a * pt;
        if (R.scoring.passSectionMin && v.a && v.c / v.a < R.scoring.passSectionMin) weightedPass = false;
      }
      if (!fullScore || score / fullScore < R.scoring.passTotalRatio) weightedPass = false;
    }
    const rec = { t: Date.now(), level: R.lid, mini: R.mini, total, correct, wrong: total - correct, pct: Math.round((correct * 100) / total), passCount: R.passCount,
      pass: weightedPass != null ? weightedPass : correct >= R.passCount, score, fullScore, passRule: R.passRule, officialPass: R.officialPass, officialTotal: R.officialTotal, byType, weak, weakWrite, weakIdiom, notes: R.notes,
      usedSec: Math.round((Date.now() - R.start) / 1000) };
    c.p.mocks.push(rec);
    S.markStudy('mock', 20);
    S.save(true);
    localStorage.removeItem(RUN_KEY);
    location.hash = `#/mock/result?i=${c.p.mocks.length - 1}`;
  };
  await draw();
  timer = setInterval(tick, 1000);
  return () => { clearInterval(timer); };
}

async function showResult(view, c, i) {
  const m = c.p.mocks[i];
  if (!m) { view.innerHTML = '<div class="empty">결과가 없어요.</div>'; return; }
  const dict = await D.dict();
  const idioms = await D.idioms();
  const top = (o) => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, 20);
  view.innerHTML = `
    <h1>모의시험 결과</h1>
    <p class="sub">${esc(c.provider.name)} ${esc((c.levels.find((l) => l.id === m.level) || {}).name || '')} ${m.mini ? '· 미니(1/5 축소)' : ''} · ${new Date(m.t).toLocaleString('ko-KR')}</p>
    <div class="card center"><div class="small">총점 (정답 문항)</div><div class="cmp-num" style="font-size:44px">${m.correct} / ${m.total}</div><div>정답률 <b>${m.pct}%</b> · 정답 ${m.correct} · 오답 ${m.wrong} · 소요 ${Math.floor(m.usedSec / 60)}분</div>${m.score != null ? `<div style="margin-top:6px">배점 합산 <b>${m.score}</b> / ${m.fullScore}점 (${Math.round((m.score * 100) / (m.fullScore || 1))}%)</div>` : ''}</div>
    ${m.score != null ? `<div class="notice ${m.pass ? 'ok' : 'bad'}">${m.pass ? '공식 합격 기준을 충족합니다' : '공식 합격 기준에 미달해요'} — ${esc(m.passRule || '')}<div class="tiny">영역별 배점과 과목별 최소 득점률로 판정했어요. 모의시험 결과는 실제 시험 합격을 보장하지 않습니다.</div></div>` : `<div class="notice ${m.pass ? 'ok' : 'bad'}">${m.pass
      ? `현재 모의시험 결과가 공식 합격 기준(${m.mini ? `축소 환산 ${m.passCount}/${m.total}, 공식 ${m.officialPass}/${m.officialTotal}` : `${m.officialTotal}문항 중 ${m.officialPass}문항 이상`})을 충족합니다.`
      : `공식 합격 기준(${m.mini ? `축소 환산 ${m.passCount}/${m.total}` : `${m.officialTotal}문항 중 ${m.officialPass}문항`})까지 ${m.passCount - m.correct}문항이 부족해요.`}
      <div class="tiny">모의시험 결과는 실제 시험 합격을 보장하지 않습니다.</div></div>`}
    ${m.notes && m.notes.length ? `<div class="notice info">${m.notes.map(esc).join('<br>')}</div>` : ''}
    <h3>유형별 정답률</h3>
    <div class="table-wrap"><table><thead><tr><th>유형</th><th>정답</th><th>정답률</th></tr></thead><tbody>${Object.entries(m.byType).map(([k, v]) => `<tr><td>${esc(k)}</td><td>${v.c}/${v.a}</td><td>${Math.round((v.c * 100) / v.a)}%</td></tr>`).join('')}</tbody></table></div>
    <h3>취약 한자</h3><div class="chars-inline">${top(m.weak).map(([ch]) => `<a href="#/search?q=${encodeURIComponent(ch)}" style="text-decoration:none">${esc(ch)}</a>`).join(' ') || '<span class="small">없음</span>'}</div>
    <h3>취약 사자성어</h3><div>${top(m.weakIdiom).map(([id]) => idioms.get(id)).filter(Boolean).map((it) => `<span class="badge accent">${esc(it.w)} ${esc(it.r)}</span>`).join(' ') || '<span class="small">없음</span>'}</div>
    <h3>쓰기 취약 한자</h3><div class="chars-inline">${top(m.weakWrite).map(([ch]) => esc(ch)).join(' ') || '<span class="small">없음</span>'}</div>
    <div class="btns fill" style="margin-top:16px"><a class="btn accent" href="#/wrong">오답노트</a><a class="btn" href="#/review">Smart Review</a><a class="btn" href="#/mock">모의시험</a></div>
    ${Object.keys(m.weakWrite).length ? `<a class="btn block" style="margin-top:8px" href="#/write?c=${encodeURIComponent(Object.keys(m.weakWrite).filter((x) => dict[x]).join(','))}">쓰기 취약 한자 연습</a>` : ''}`;
}
