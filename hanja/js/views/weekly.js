// 주간 학습 리포트 (최근 7일) — 실제 기록으로 계산, 이 기기 안에서만 표시
import * as L from '../learn.js';
import * as S from '../store.js';
import { esc } from '../ui.js';

export default async function (view, { ctx: c }) {
  const r = await L.weekly(c);
  const st = S.get();
  const marks = S.STREAK_MARKS.map((n) => ({ n, d: (st.streakMarks || {})[n] }));
  const diff = r.acc != null && r.prevAcc != null ? r.acc - r.prevAcc : null;
  view.innerHTML = `<h1>주간 학습 리포트</h1>
    <p class="sub">${esc(c.provider.name)} ${esc(c.level.name)} · ${esc(r.days[6])} ~ ${esc(r.days[0])}</p>
    <div class="report-grid">
      <div><b>${r.studied}자</b><span>학습한 한자 (새 ${r.newW} · 복습 ${r.reviewed})</span></div>
      <div><b>${r.mastered}자</b><span>이번 주 완전 학습 (전체 ${r.masteredAll}/${r.target})</span></div>
      <div><b>${r.reviewed}자</b><span>복습한 한자</span></div>
      <div><b>${r.acc == null ? '-' : r.acc + '%'}</b><span>문제 정답률 (${r.q}문항)${diff != null ? ` · 지난주보다 ${diff >= 0 ? '+' : ''}${diff}%p` : ''}</span></div>
      <div><b>${r.writeN}회</b><span>쓰기 연습</span></div>
      <div><b>${r.minutes}분</b><span>총 학습시간 (${r.studyDays}일 학습)</span></div>
      <div><b>${r.streak}일</b><span>연속 학습 · XP ${st.xp}</span></div>
      <div><b>${esc(r.weakest || '-')}</b><span>가장 취약한 영역 (이번 주 오답 ${r.weekMist}건)</span></div>
    </div>
    <h3>다음 주 추천 학습량 (하루 기준)</h3>
    <div class="card"><ul class="phase-list">
      <li><span>새 한자</span><b>${r.rec.perDayNew}자</b></li>
      <li><span>복습</span><b>${r.rec.perDayReview}자</b></li>
      <li><span>쓰기</span><b>${r.rec.perDayWrite}자</b></li>
      <li><span>학습 시간</span><b>${r.rec.minutes}분</b></li>
    </ul><p class="tiny">${esc(r.rec.phase)} 기준 · 남은 미학습 한자, 복습할 한자 수, 이번 주 실제 학습량으로 계산했어요.</p>
    ${r.weakest ? `<a class="btn accent block" href="#/weak?drill=auto&t=${Date.now() % 1e6}">${esc(r.weakest)} 먼저 복습하기</a>` : ''}</div>
    <h3>연속 학습 기록</h3>
    <div class="badges">${marks.map((m) => `<span class="bdg ${m.d ? 'got' : ''}" aria-label="${m.n}일 연속 ${m.d ? '달성' : '미달성'}"><span class="hanzi">${m.n}</span>${m.n}일${m.d ? ' ✓' : ''}</span>`).join('')}</div>
    <p class="tiny">학습시간은 화면을 실제로 사용한 시간만 셉니다(1분 이상 조작이 없으면 제외).</p>`;
}
