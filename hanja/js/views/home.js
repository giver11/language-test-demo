import * as P from '../progress.js';
import * as S from '../store.js';
import * as D from '../data.js';
import { esc, daysUntil, ddayText, fmtDate, bar, daehanFooter } from '../ui.js';
import * as Coach from '../coach.js';
import * as L from '../learn.js';

export default async function (view, { ctx: c }) {
  const sum = await P.summary(c);
  const q = await P.dailyQuest(c, sum);
  const Lv = c.level;
  const cs = Lv.hasData ? await Coach.status(c) : null;
  const n = daysUntil(c.p.examDate);
  const badges = P.evalBadges();
  // 오늘의 한자 학습(A-1) · Mastery 4단계(A-3) · 오답 DNA 요약(A-4)
  const td = Lv.hasData ? await L.buildToday(c) : null;
  const tdone = td ? L.todayDone(c, td) : null;
  const TD = [['new', '새 한자', '자'], ['review', '복습', '자'], ['write', '쓰기', '자'], ['idioms', '사자성어', '개'], ['wrong', '오답', '문제']];
  const tdTotal = td ? TD.reduce((a, [k]) => a + td.set[k].length, 0) : 0;
  const tdDone = td ? TD.reduce((a, [k]) => a + Math.min(td.set[k].length, tdone[k]), 0) : 0;
  const stages = { NEW: 0, LEARNING: 0, REVIEW: 0, MASTERED: 0 };
  if (cs) { const now = Date.now(); for (const ch of cs.scope) stages[S.stageOf(c.p.mastery[ch], now)]++; }
  const dn = L.dnaTop(await L.dna(c));
  const phase = L.phaseOf(n);
  const questItems = [
    ['hanja', '신규 한자', '자', '#/cards?set=quest'],
    ['review', '복습', '자', '#/cards?set=review'],
    ['writing', '쓰기', '자', '#/write'],
    ['words', '한자어', '개', '#/words'],
    ['idioms', '사자성어', '개', '#/idioms'],
    ['questions', '문제', '개', '#/quiz'],
  ].filter(([k]) => q.plan[k] > 0);
  const totalPlan = questItems.reduce((a, [k]) => a + q.plan[k], 0);
  const totalDone = questItems.reduce((a, [k]) => a + Math.min(q.plan[k], q.done[k] || 0), 0);
  const pct = totalPlan ? Math.round((totalDone * 100) / totalPlan) : 0;

  let ddayHtml;
  if (!c.p.examDate) ddayHtml = `<div class="label">${esc(c.provider.name)} ${esc(Lv.name)}</div><div class="num" style="font-size:26px">시험일 미정</div><a href="#/onboard?switch=1&p=${c.pid}">시험일 선택하기 →</a>`;
  else if (n < 0) ddayHtml = `<div class="label">${esc(c.provider.name)} ${esc(Lv.name)}</div><div class="num" style="font-size:26px">시험일이 지났어요</div><div class="small" style="color:#cfd5e4">${fmtDate(c.p.examDate)} · <a href="#/onboard?switch=1&p=${c.pid}">다음 시험일 선택 →</a></div>`;
  else ddayHtml = `<div class="label">${esc(c.provider.name)} ${esc(Lv.name)} 시험까지</div><div class="num">${ddayText(n)}</div>
      <div class="small" style="color:#cfd5e4">${esc(c.p.examRound || '')} · ${fmtDate(c.p.examDate)}${c.p.examRound === '직접 입력' ? ' (직접 입력)' : ''}</div>
      <div class="dmarks" aria-label="시험 전 구간">${L.DDAY_MARKS.map((m) => `<span class="${n <= m ? 'on' : ''}">D-${m}${n <= m ? ' ✓' : ''}</span>`).join('')}</div>
      <div class="small" style="color:#cfd5e4;margin-top:6px">${esc(phase.label)}${phase.newShare < 1 ? ` · 새 한자 ${Math.round(phase.newShare * 100)}% · 오답·복습 비중 ↑` : ''}</div>`;

  const todayCard = td ? `<section class="card today-card" aria-label="오늘의 한자 학습">
      <div class="spread"><h2>오늘의 한자 학습</h2><span class="badge ${tdDone >= tdTotal && tdTotal ? 'official' : 'accent'}">${tdDone >= tdTotal && tdTotal ? '완료 ✓' : `${tdDone}/${tdTotal}`}</span></div>
      <div class="small" style="margin-top:4px">오늘의 목표</div>
      <div class="today-grid">${TD.map(([k, label, unit]) => `<div class="${tdone[k] >= td.set[k].length ? 'done' : ''}"><b>${td.set[k].length}${unit}</b><span>${label}${td.set[k].length ? ` · ${Math.min(tdone[k], td.set[k].length)}/${td.set[k].length}` : ''}</span></div>`).join('')}</div>
      <a class="btn accent block" href="#/today?run=1" style="min-height:54px">${tdDone >= tdTotal && tdTotal ? '오늘 학습 다시 보기' : tdDone ? '10분 학습 이어하기' : '10분 학습 시작'}</a>
      <ul class="why">${td.why.slice(0, 3).map((w) => `<li>${esc(w)}</li>`).join('')}</ul>
    </section>` : '';
  const masteryCard = cs ? `<section class="card" style="margin-top:12px" aria-label="한자 Mastery">
      <div class="spread"><h2 class="mt0" style="margin:0">완전 학습 ${stages.MASTERED.toLocaleString()}/${cs.target.toLocaleString()}</h2><a class="small" href="#/mastery">자세히 →</a></div>
      <div class="stage-row">${['NEW', 'LEARNING', 'REVIEW', 'MASTERED'].map((k) => `<a href="#/mastery?s=${k}"><b>${stages[k].toLocaleString()}</b><span class="stage-tag stage-${k}">${S.STAGE_KO[k]}</span></a>`).join('')}</div>
    </section>` : '';
  const dnaCard = `<section class="card" style="margin-top:12px" aria-label="나의 약점">
      <div class="spread"><h2 class="mt0" style="margin:0">나의 약점</h2><a class="small" href="#/weak">오답 DNA →</a></div>
      ${dn.length ? dn.map((r) => `<div class="dna-row"><div class="spread small"><span>${esc(r.cat)}</span><b>${r.pct}%</b></div>${bar(r.pct)}</div>`).join('') + `<a class="btn sm" href="#/weak?drill=auto&t=${Date.now() % 1e6}" style="margin-top:6px">취약 영역부터 복습</a>` : '<p class="small" style="margin:6px 0 0">문제를 풀면 틀린 원인을 자동으로 분석해 보여줘요.</p>'}
    </section>`;
  view.innerHTML = `
    ${todayCard}
    <div class="card dday" style="${todayCard ? 'margin-top:12px' : ''}">${ddayHtml}</div>
    ${masteryCard}
    ${dnaCard}
    ${!Lv.hasData ? `<div class="notice bad"><b>${esc(c.provider.name)} ${esc(Lv.name)} 배정한자: 공식 자료 확인 필요</b><br>${esc(Lv.notes[0] || '')}<br>
       일정·시험형식·D-Day·사자성어 학습은 사용할 수 있어요. <a href="#/sources">데이터 출처 보기</a></div>` : ''}
    ${Lv.hasData && Lv.status && Lv.status.hanja === 'secondary' ? `<div class="notice">이 급수의 배정한자는 2차 자료 기준이에요 (공식 대조 필요).</div>` : ''}
    ${cs ? `<section class="card coach" aria-label="Exam Coach">
      <div class="spread"><h2 class="mt0" style="margin:0">Exam Coach</h2><span class="badge blue">${esc(c.provider.short || c.provider.name)} ${esc(Lv.name)}${n != null && n >= 0 ? ` · ${ddayText(n)}` : ''}</span></div>
      <div class="coach-grid">
        <div><div class="v">${cs.target.toLocaleString()}</div><div class="k">목표 한자</div></div>
        <div><div class="v ok">${cs.mastered.toLocaleString()}</div><div class="k">숙련</div></div>
        <div><div class="v warn">${cs.learning.toLocaleString()}</div><div class="k">학습 중</div></div>
        <div><div class="v muted">${cs.unseen.toLocaleString()}</div><div class="k">미학습</div></div>
      </div>
      <div class="stack-bar" role="img" aria-label="숙련 ${cs.mastered}, 학습 중 ${cs.learning}, 미학습 ${cs.unseen}">
        <i class="ok" style="width:${(cs.mastered * 100) / Math.max(1, cs.target)}%"></i><i class="warn" style="width:${(cs.learning * 100) / Math.max(1, cs.target)}%"></i></div>
      <div class="spread" style="margin-top:8px"><b>현재 준비도 ${cs.readiness}%</b><span class="small">복습 시기 ${cs.due.length}자</span></div>
      <div class="btns" style="margin-top:8px"><a class="btn sm" href="#/confuse">헷갈리는 한자</a><a class="btn sm" href="#/games">게임</a><a class="btn sm" href="#/share">공유 카드</a>${S.get().placement && S.get().placement[c.pid + ':' + c.lid] ? '' : '<a class="btn sm" href="#/placement">진단평가</a>'}</div>
      <p class="tiny" style="margin:4px 0 0">준비도 = 한자 숙련도 평균${cs.basis.quiz ? ' + 문제 정답률' : ''}${cs.basis.mock ? ' + 모의시험' : ''} 기준의 참고 지표예요. ${q.adj && q.adj !== 1 ? `어제 학습량 달성률에 맞춰 오늘 신규 분량을 ${q.adj > 1 ? '늘렸어요' : '줄였어요'}.` : ''}</p>
    </section>` : ''}
    <div class="card" style="margin-top:12px">
      <div class="spread"><h2 class="mt0" style="margin:0">오늘의 학습</h2><span class="badge ${q.near ? 'accent' : 'blue'}">${q.near ? '시험 임박 · 복습/문제 위주' : `하루 ${q.minutes}분`}</span></div>
      <div style="margin:10px 0 4px" class="spread"><span class="small">진행률 ${pct}%</span><span class="small">${totalDone}/${totalPlan}</span></div>
      ${bar(pct)}
      <div class="quest"><ul>${questItems.map(([k, label, unit, href]) => {
        const done = Math.min(q.plan[k], q.done[k] || 0);
        const ok = done >= q.plan[k];
        return `<li><span><b>${label}</b> ${q.plan[k]}${unit}</span><span class="row">${ok ? '<span class="done">완료 ✓</span>' : `<span class="small">${done}/${q.plan[k]}</span>`}<a class="btn sm" href="${href}">${ok ? '더 하기' : '시작'}</a></span></li>`;
      }).join('')}</ul></div>
      ${q.dLeft != null && q.dLeft > 0 && Lv.hasData ? `<div class="tiny">남은 미암기 ${q.remaining}자 · 시험까지 ${q.dLeft}일 기준으로 계산</div>` : ''}
    </div>
    <h2>학습 현황</h2>
    <div class="stat-grid">
      <div class="stat"><div class="v">${sum.total.toLocaleString()}</div><div class="k">전체 한자 (${esc(Lv.name)} 누적)</div></div>
      <div class="stat"><div class="v">${sum.studied.toLocaleString()}</div><div class="k">학습 한자</div></div>
      <div class="stat"><div class="v">${sum.known.toLocaleString()}</div><div class="k">암기 완료</div></div>
      <div class="stat"><div class="v">${sum.writeDone}<span class="small">/${sum.writeTotal}</span></div><div class="k">쓰기 완료</div></div>
      <div class="stat"><div class="v">${sum.idiomsLearned}</div><div class="k">사자성어</div></div>
      <div class="stat"><div class="v">${sum.acc == null ? '-' : sum.acc + '%'}</div><div class="k">문제 정답률 (${sum.answered}문항)</div></div>
      <div class="stat"><div class="v">${sum.bestMock == null ? '-' : sum.bestMock + '%'}</div><div class="k">모의시험 최고점</div></div>
      <div class="stat"><div class="v">${sum.streak}일</div><div class="k">연속 학습 · XP ${S.get().xp}</div></div>
    </div>
    <div class="card flat" style="margin-top:10px">
      <div class="spread small"><span>암기 진도</span><span>${sum.total ? Math.round((sum.known * 100) / sum.total) : 0}%</span></div>${bar(sum.total ? (sum.known * 100) / sum.total : 0)}
      <div class="spread small" style="margin-top:8px"><span>쓰기 진도</span><span>${sum.writeTotal ? Math.round((sum.writeDone * 100) / sum.writeTotal) : 0}%</span></div>${bar(sum.writeTotal ? (sum.writeDone * 100) / sum.writeTotal : 0, '#2f6db4')}
    </div>
    <h2>배지</h2>
    <div class="badges">${badges.list.map((b) => `<span class="bdg ${b.got ? 'got' : ''}"><span class="hanzi">${b.icon}</span>${esc(b.name)}</span>`).join('')}</div>
    <h2>바로가기</h2>
    <div class="menu-grid">
      <a href="#/weekly"><i>週</i><b>주간 리포트</b><span>이번 주 학습·다음 주 추천</span></a>
      <a href="#/games?g=speed3"><i>速</i><b>3초 한자</b><span>음·훈·뜻 순발력 10문제</span></a>
      <a href="#/review"><i>復</i><b>Smart Review</b><span>헷갈린·틀린 한자 복습</span></a>
      <a href="#/mock"><i>試</i><b>모의시험</b><span>공식 형식 기준</span></a>
      <a href="#/wrong"><i>誤</i><b>오답노트</b><span>틀린 문제 다시 풀기</span></a>
      <a href="#/schedule"><i>曆</i><b>2026 시험일정</b><span>어문회·검정회 공식 일정</span></a>
      <a href="#/compare"><i>比</i><b>기관 비교</b><span>배정한자 차이 계산</span></a>
      <a href="#/search"><i>索</i><b>한자 검색</b><span>한자·음·뜻·한자어</span></a>
    </div>
    ${c.pid === 'daehan' ? daehanFooter() : ''}`;
}
