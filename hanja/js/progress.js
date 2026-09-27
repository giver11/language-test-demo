// 진도 계산 · Daily Quest · 배지
import * as S from './store.js';
import * as D from './data.js';
import { daysUntil } from './ui.js';

export async function ctx() {
  const st = S.get();
  if (!st.current || !st.current.provider) return null;
  const pid = st.current.provider;
  const p = S.prov(pid);
  const provider = await D.provider(pid);
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
  if (st.quest && st.quest.date === today && st.quest.key === key) return st.quest;
  const remaining = Math.max(0, sum.total - sum.known);
  const remainingW = Math.max(0, sum.writeTotal - sum.writeDone);
  const days = dLeft != null && dLeft > 0 ? dLeft : 30;
  const studyDays = Math.max(1, days - Math.min(7, Math.floor(days / 4))); // 마지막 구간은 복습 기간
  const near = dLeft != null && dLeft <= 14;
  // 분 단위 비용(대략): 카드 0.5, 쓰기 1, 한자어 0.5, 사자성어 1, 문제 0.6
  const share = near ? { hanja: 0.12, writing: 0.15, words: 0.1, idioms: 0.08, questions: 0.55 }
                     : { hanja: 0.35, writing: 0.2, words: 0.15, idioms: 0.1, questions: 0.2 };
  const cost = { hanja: 0.5, writing: 1, words: 0.5, idioms: 1, questions: 0.6 };
  const plan = {};
  for (const k of Object.keys(share)) plan[k] = Math.max(1, Math.round((minutes * share[k]) / cost[k]));
  // 남은 분량을 기간 안에 끝낼 수 있도록 필요량 반영(시간 예산의 1.5배까지)
  const needH = Math.ceil(remaining / studyDays);
  const needW = Math.ceil(remainingW / studyDays);
  plan.hanja = Math.min(Math.max(plan.hanja, needH), Math.round(plan.hanja * 1.5));
  if (sum.writeTotal) plan.writing = Math.min(Math.max(plan.writing, needW), Math.round(plan.writing * 1.5)); else plan.writing = Math.min(plan.writing, 5);
  if (!c.level || !c.level.hasData) { plan.hanja = 0; plan.writing = 0; }
  if (remaining === 0) plan.hanja = Math.max(5, Math.round(plan.hanja / 2));
  const q = { date: today, key, plan, done: {}, near, dLeft, minutes, needH, remaining };
  st.quest = q;
  S.save();
  return q;
}

export const BADGES = [
  { id: 'h100', name: '첫 100자 마스터', icon: '字', test: (c) => c.knownAll >= 100 },
  { id: 'write50', name: '한자 쓰기왕', icon: '✎', test: (c) => c.writeGood >= 50 },
  { id: 'idiom30', name: '사자성어 마스터', icon: '成', test: (c) => c.idiomOk >= 30 },
  { id: 'streak7', name: '7일 연속 공부', icon: '日', test: (c) => c.bestStreak >= 7 },
  { id: 'mockpass', name: '모의시험 합격기준 달성', icon: '合', test: (c) => c.mockPass },
];

export function evalBadges() {
  const st = S.get();
  let knownAll = 0, writeGood = 0, idiomOk = 0, mockPass = false;
  for (const p of Object.values(st.byProvider)) {
    knownAll += Object.values(p.cards).filter((x) => x.s === 'know').length;
    writeGood += Object.values(p.writing).reduce((a, x) => a + (x.ok || 0), 0);
    idiomOk += Object.values(p.idioms).filter((x) => x.ok > 0).length;
    if (p.mocks.some((m) => m.pass)) mockPass = true;
  }
  const c = { knownAll, writeGood, idiomOk, mockPass, bestStreak: S.streak().best };
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
