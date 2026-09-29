// 진도 계산 · Daily Quest · 배지
import * as S from './store.js';
import * as D from './data.js';
import * as Coach from './coach.js';
import { daysUntil } from './ui.js';

export async function ctx() {
  const st = S.get();
  if (!st.current || !st.current.provider) return null;
  const pid = st.current.provider;
  const p = S.prov(pid);
  const provider = await D.provider(pid);
  if (!provider) return null;
  const lv = await D.levels(pid);
  const level = lv.levels.find((l) => l.id === p.level) || null;
  return { pid, p, provider, levels: lv.levels, levelsFile: lv, level, lid: level && level.id, st };
}

export async function summary(c) {
  const { pid, p, lid, level } = c;
  const scope = level && level.hasData ? await D.scopeChars(pid, lid) : [];
  const wscope = level && level.hasData ? await D.writeScope(pid, lid) : [];
  const known = scope.filter((ch) => p.cards[ch] && p.cards[ch].s === 'know').length;
  const studied = scope.filter((ch) => p.cards[ch]).length;
  const writeDone = wscope.filter((ch) => p.writing[ch] && p.writing[ch].ok > 0).length;
  const idiomsLearned = Object.values(p.idioms).filter((x) => x.ok > 0).length;
  const acc = p.quiz.answered ? Math.round((p.quiz.correct * 100) / p.quiz.answered) : null;
  const mocks = p.mocks.filter((m) => m.level === lid);
  const bestMock = mocks.length ? Math.max(...mocks.map((m) => m.pct)) : null;
  const sk = S.streak();
  return { scope, wscope, total: scope.length, studied, known, writeTotal: wscope.length, writeDone, idiomsLearned, acc,
           answered: p.quiz.answered, bestMock, mocks: mocks.length, streak: sk.current, bestStreak: sk.best, xp: S.get().xp };
}

// 오늘의 학습량: 남은 날짜 · 남은 분량 · 하루 학습시간으로 계산. 시험이 가까워질수록 복습/문제 비중 증가.
export async function dailyQuest(c, sum) {
  const st = S.get();
  const today = S.today();
  const minutes = st.minutes || 20;
  const dLeft = daysUntil(c.p.examDate);
  const key = `${c.pid}|${c.lid}|${minutes}|${c.p.examDate}`;
  if (st.quest && st.quest.date === today && st.quest.key === key && st.quest.v === 3) return st.quest;
  // Exam Coach: mastery·남은 기간·어제 수행률로 오늘 학습량 계산
  const cs = await Coach.status(c);
  const tp = await Coach.todayPlan(c, cs);
  const plan = tp.plan;
  if (!c.level || !c.level.hasData) { plan.hanja = 0; plan.review = 0; plan.writing = 0; }
  const prev = st.quest && st.quest.date === today ? st.quest.done : {};
  const q = { v: 3, date: today, key, plan, done: prev || {}, near: tp.near, dLeft, minutes, adj: tp.adj, ratio: tp.ratio };
  st.quest = q;
  c.p.dailyLog[today] = { plan, done: { ...q.done } };
  S.save();
  return q;
}

export const BADGES = [
  { id: 'h100', name: '첫 100자', icon: '字', desc: '암기 완료 100자', test: (c) => c.knownAll >= 100 },
  { id: 'study500', name: '500자 학습', icon: '學', desc: '학습한 한자 500자', test: (c) => c.studiedAll >= 500 },
  { id: 'write50', name: '쓰기왕', icon: '✎', desc: '쓰기 통과 50회', test: (c) => c.writeGood >= 50 },
  { id: 'streak7', name: '7일 연속', icon: '日', desc: '7일 연속 학습', test: (c) => c.bestStreak >= 7 },
  { id: 'streak30', name: '30일 연속', icon: '月', desc: '30일 연속 학습', test: (c) => c.bestStreak >= 30 },
  { id: 'mock90', name: '모의시험 90점', icon: '優', desc: '실전 모의시험 90% 이상', test: (c) => c.mockBest >= 90 },
  { id: 'idiom100', name: '사자성어 100개', icon: '成', desc: '맞힌 사자성어 100개', test: (c) => c.idiomOk >= 100 },
  { id: 'idiom30', name: '사자성어 30개', icon: '語', desc: '맞힌 사자성어 30개', test: (c) => c.idiomOk >= 30 },
  { id: 'mockpass', name: '모의시험 합격선', icon: '合', desc: '모의시험 합격 기준 충족', test: (c) => c.mockPass },
];

export function evalBadges() {
  const st = S.get();
  let knownAll = 0, writeGood = 0, idiomOk = 0, mockPass = false, studiedAll = 0, mockBest = 0;
  for (const p of Object.values(st.byProvider)) {
    knownAll += Object.values(p.cards).filter((x) => x.s === 'know').length;
    studiedAll += Object.keys(p.mastery || {}).length;
    for (const m of p.mocks) if (!m.mini) mockBest = Math.max(mockBest, m.pct || 0);
    writeGood += Object.values(p.writing).reduce((a, x) => a + (x.ok || 0), 0);
    idiomOk += Object.values(p.idioms).filter((x) => x.ok > 0).length;
    if (p.mocks.some((m) => m.pass)) mockPass = true;
  }
  const c = { knownAll, writeGood, idiomOk, mockPass, studiedAll, mockBest, bestStreak: S.streak().best };
  const newly = [];
  for (const b of BADGES) {
    if (!st.badges[b.id] && b.test(c)) { st.badges[b.id] = S.today(); newly.push(b); }
  }
  if (newly.length) S.save();
  return { list: BADGES.map((b) => ({ ...b, got: !!st.badges[b.id], date: st.badges[b.id] })), newly, c };
}

// Smart Review 대상 선정
export async function reviewItems(c) {
  const { p } = c;
  const now = Date.now();
  const score = new Map();
  const why = new Map();
  const add = (ch, s, reason) => { score.set(ch, (score.get(ch) || 0) + s); if (!why.has(ch)) why.set(ch, new Set()); why.get(ch).add(reason); };
  // 간격 반복: 복습 시기가 된 한자(mastery 낮을수록 우선)
  for (const [ch, e] of Object.entries(p.mastery || {})) {
    if (e.due && e.due <= now) add(ch, 4 + (100 - S.masteryValue(e, now)) / 25, '복습 시기');
  }
  for (const [ch, e] of Object.entries(p.cards)) {
    if (e.s === 'dont') add(ch, 5, '몰라요');
    else if (e.s === 'unsure') add(ch, 3, '헷갈려요');
    if (e.w >= 2) add(ch, e.w * 1.5, `${e.w}번 틀림`);
    if (e.t && now - e.t < 3 * 86400000 && e.s !== 'know') add(ch, 1, '최근');
  }
  for (const w of Object.values(p.wrong)) {
    if (w.resolved) continue;
    for (const ch of w.q.relatedHanja || []) add(ch, 2 + (w.count - 1) * 1.5, '최근 틀린 문제');
  }
  for (const [ch, e] of Object.entries(p.writing)) {
    if (e.last === 'retry' || e.last === 'order' || (e.fail > e.ok)) add(ch, 3 + e.fail, '쓰기 실패');
  }
  const chars = [...score.entries()].sort((a, b) => b[1] - a[1]).map(([ch, s]) => ({ c: ch, s, why: [...why.get(ch)] }));
  const idiomIds = Object.entries(p.idioms).filter(([, e]) => e.fail > e.ok).sort((a, b) => b[1].fail - a[1].fail).map(([id]) => id);
  return { chars, idiomIds };
}
