// HANJA EXAM COACH — 시험일까지 남은 시간 + 실제 학습 데이터(mastery·정답률·모의시험)로 오늘의 학습량을 계산한다.
import * as S from './store.js';
import * as D from './data.js';
import { daysUntil } from './ui.js';

const DAY = 86400000;

// 목표 한자 상태: 숙련(mastery 80 이상) · 학습 중(1~79 또는 기록 있음) · 미학습(기록 없음)
export async function status(c) {
  const scope = c.level && c.level.hasData ? await D.scopeChars(c.pid, c.lid) : [];
  const newSet = new Set(c.level && c.level.hasData ? await D.scopeChars(c.pid, c.lid, true) : []);
  const now = Date.now();
  let mastered = 0, learning = 0, unseen = 0, msum = 0;
  const due = [], unseenList = [];
  for (const ch of scope) {
    const e = c.p.mastery[ch];
    if (!e || !e.n) { unseen++; unseenList.push(ch); continue; }
    const m = S.masteryValue(e, now);
    msum += m;
    if (m >= 80) mastered++; else learning++;
    if (e.due <= now) due.push({ c: ch, m, overdue: now - e.due, imp: newSet.has(ch) ? 1 : 0 });
  }
  // 복습 우선순위: 이번 급수 신출(시험 중요도) → mastery 낮은 순 → 오래 밀린 순
  due.sort((a, b) => b.imp - a.imp || a.m - b.m || b.overdue - a.overdue);
  // 신규 학습 순서: 이번 급수 신출 먼저
  unseenList.sort((a, b) => (newSet.has(b) ? 1 : 0) - (newSet.has(a) ? 1 : 0));
  const avgM = scope.length ? msum / scope.length : 0;
  const acc = c.p.quiz.answered >= 10 ? c.p.quiz.correct / c.p.quiz.answered : null;
  const mocks = c.p.mocks.filter((m) => m.level === c.lid && !m.mini).slice(-3);
  const mockR = mocks.length ? Math.max(...mocks.map((m) => (m.score != null && m.fullScore ? m.score / m.fullScore : m.correct / m.total))) : null;
  // 준비도 = mastery 평균 60% + 최근 문제 정답률 25% + 모의시험 15% (데이터가 없는 항목은 비중을 mastery로 돌림)
  let w = 0.6, sum = 0.6 * (avgM / 100);
  if (acc != null) { sum += 0.25 * acc; w += 0.25; }
  if (mockR != null) { sum += 0.15 * mockR; w += 0.15; }
  const readiness = scope.length ? Math.round((sum / w) * 100) : 0;
  return { scope, target: scope.length, mastered, learning, unseen, due, unseenList, readiness, avgM: Math.round(avgM), acc, mockR,
           basis: { mastery: 60, quiz: acc != null ? 25 : 0, mock: mockR != null ? 15 : 0 } };
}

// 어제 계획 대비 실제 수행률 → 오늘 신규량 조정
function yesterdayRatio(p) {
  const d = new Date(Date.now() - DAY);
  const key = S.ymd(d);
  const log = p.dailyLog[key];
  if (!log || !log.plan) return null;
  let plan = 0, done = 0;
  for (const [k, v] of Object.entries(log.plan)) { plan += v; done += Math.min(v, (log.done || {})[k] || 0); }
  return plan ? done / plan : null;
}

export async function todayPlan(c, st) {
  const minutes = S.get().minutes || 20;
  const dLeft = daysUntil(c.p.examDate);
  const days = dLeft != null && dLeft > 0 ? dLeft : 30;
  const reviewDays = Math.min(7, Math.floor(days / 4));            // 시험 직전은 복습·시험형 문제 위주
  const studyDays = Math.max(1, days - reviewDays);
  const near = dLeft != null && dLeft <= 14;
  const ratio = yesterdayRatio(c.p);
  const adj = ratio == null ? 1 : ratio < 0.5 ? 0.75 : ratio < 0.8 ? 0.9 : ratio >= 1 ? 1.15 : 1;
  // 분당 비용(대략): 신규 0.8, 복습 0.35, 쓰기 1, 한자어 0.5, 성어 1, 문제 0.6
  const budget = minutes;
  let newN = st.unseen ? Math.ceil((st.unseen / studyDays) * adj) : 0;
  // 시험이 가까워질수록 신규 비중 ↓ (D-30 0.7 · D-14 0.4 · D-7 0.15 · D-1 0)
  const share = dLeft == null || dLeft < 0 || dLeft > 30 ? 1 : dLeft > 14 ? 0.7 : dLeft > 7 ? 0.4 : dLeft > 1 ? 0.15 : 0;
  newN = Math.round(newN * share);
  if (near) newN = Math.min(newN, Math.max(share ? 2 : 0, Math.round(budget * 0.1)));
  newN = Math.min(newN, Math.round(budget * 0.5 / 0.8) || 1, st.unseen);
  let review = Math.min(st.due.length, Math.round((budget * (0.25 + (1 - share) * 0.15)) / 0.35));
  if (st.due.length && review < 5) review = Math.min(st.due.length, 5);
  const hasWrite = true;
  const writing = hasWrite ? Math.max(3, Math.round((budget * (near ? 0.12 : 0.18)) / 1)) : 0;
  const words = Math.max(3, Math.round((budget * 0.1) / 0.5));
  const idioms = Math.max(1, Math.round((budget * 0.06) / 1));
  const questions = Math.max(5, Math.round((budget * (0.2 + (1 - share) * 0.2)) / 0.6));
  return { plan: { hanja: newN, review, writing, words, idioms, questions }, near, dLeft, adj, ratio, minutes, share };
}
