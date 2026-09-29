// 한자패스 학습 엔진 — 오늘의 한자 학습 · 오답 DNA · 혼동쌍 · 주간 리포트
// 모든 계산은 이 기기의 실제 학습 기록(localStorage)과 앱 내부 데이터(배정한자·사전·모양 유사도)로만 한다.
// 기관별 기록(byProvider[pid])만 사용하므로 기관 간 데이터가 섞이지 않는다.
import * as S from './store.js';
import * as D from './data.js';
import * as Q from './qgen.js';
import * as Coach from './coach.js';
import { daysUntil, shuffle } from './ui.js';

const DAY = 86400000;
export const DNA_CATS = ['비슷한 모양', '음 혼동', '훈 혼동', '뜻 혼동', '획순·획수', '사자성어', '한자어', '급수시험 문제유형'];

// ---------------- 오답 DNA: 오답 1건을 원인 영역으로 분류
const EUM_TYPES = new Set(['eum-char', 'homophone-char', 'reading-char', 'word-reading', 'word-from-reading', 'sentence-reading']);
const MEANING_TYPES = new Set(['synonym', 'antonym', 'word-gloss']);
const heSplit = (s) => { const m = String(s || '').trim().split(/\s+/); return m.length >= 2 ? [m.slice(0, -1).join(' '), m[m.length - 1]] : [m[0] || '', '']; };

export function classify(m, dict, conf) {
  const t = m.type || '';
  if (t === 'write') return m.v === 'order' ? '획순·획수' : '비슷한 모양';
  if (t === 'stroke-order' || t === 'stroke-count') return '획순·획수';
  if (t.startsWith('idiom')) return '사자성어';
  const a = m.ans, p = m.picked;
  // 한 글자를 잘못 고른 경우: 모양이 비슷한 글자 → 같은 음 → 같은 훈 순서로 원인 판단
  if (a && p && [...a].length === 1 && [...p].length === 1) {
    if ((conf[a] || []).includes(p) || (conf[p] || []).includes(a)) return '비슷한 모양';
    const ha = D.heList(dict[a]), hp = D.heList(dict[p]);
    if (ha.length && hp.length) {
      if (ha.some((x) => hp.some((y) => y[1] && y[1] === x[1]))) return '음 혼동';
      if (ha.some((x) => hp.some((y) => y[0] && y[0] === x[0]))) return '훈 혼동';
    }
  }
  if (t === 'hunum' || t === 'hunum-rev') {
    if (a && p) {
      const [ah, ae] = heSplit(a), [ph, pe] = heSplit(p);
      if (ae && ae === pe) return '훈 혼동';
      if (ah && ah === ph) return '음 혼동';
      // 보기 훈음의 주인 글자가 모양이 비슷한 글자였는지
      if (m.ch && (conf[m.ch] || []).some((x) => D.heStr(dict[x]) === p)) return '비슷한 모양';
    }
    return '뜻 혼동';
  }
  if (t === 'hun-char') return '훈 혼동';
  if (EUM_TYPES.has(t)) return t.startsWith('word') || t === 'sentence-reading' ? '한자어' : '음 혼동';
  if (MEANING_TYPES.has(t)) return '뜻 혼동';
  if (t.startsWith('word')) return '한자어';
  return '급수시험 문제유형';
}

// 최근 기록일수록 무겁게 (반복해서 틀리는 원인이 위로)
export async function dna(c) {
  const dict = await D.dict();
  const conf = await D.confusables();
  const now = Date.now();
  const list = (c.p.mistakes || []).slice(-400);
  const byCat = Object.fromEntries(DNA_CATS.map((k) => [k, { n: 0, w: 0, chars: new Map(), items: [] }]));
  for (const m of list) {
    const cat = classify(m, dict, conf);
    const x = byCat[cat];
    const age = (now - (m.t || now)) / DAY;
    const w = age < 7 ? 1 : age < 30 ? 0.6 : 0.3;
    x.n++; x.w += w; x.items.push(m);
    for (const ch of (m.ans && [...m.ans].length === 1 ? [m.ans] : m.rel || (m.ch ? [m.ch] : []))) if (dict[ch]) x.chars.set(ch, (x.chars.get(ch) || 0) + 1);
  }
  const total = list.length;
  const rows = DNA_CATS.map((k) => ({ cat: k, n: byCat[k].n, w: byCat[k].w, pct: total ? Math.round((byCat[k].n * 100) / total) : 0,
    chars: [...byCat[k].chars.entries()].sort((a, b) => b[1] - a[1]).map((x) => x[0]), items: byCat[k].items }))
    .filter((r) => r.n > 0).sort((a, b) => b.w - a.w || b.n - a.n);
  return { total, rows, weakest: rows[0] || null };
}

// 화면용: 상위 3개 + 기타
export function dnaTop(d, k = 3) {
  const top = d.rows.slice(0, k);
  const rest = d.rows.slice(k).reduce((a, r) => a + r.n, 0);
  const out = top.map((r) => ({ cat: r.cat, pct: r.pct, n: r.n }));
  if (rest) out.push({ cat: '기타', pct: Math.max(0, 100 - top.reduce((a, r) => a + r.pct, 0)), n: rest });
  return out;
}

// ---------------- 혼동쌍: 실제로 헷갈려 고른 기록 + 모양 유사 데이터 (둘 다 앱 내부 데이터)
export async function confusionPairs(c, limit = 12) {
  const dict = await D.dict();
  const conf = await D.confusables();
  const pairs = new Map();
  const add = (a, b, n, src) => {
    if (!a || !b || a === b || !dict[a] || !dict[b]) return;
    const key = [a, b].sort().join('/');
    const x = pairs.get(key) || { a: key.split('/')[0], b: key.split('/')[1], n: 0, shape: false, src: new Set() };
    x.n += n; x.src.add(src);
    if ((conf[a] || []).includes(b) || (conf[b] || []).includes(a)) x.shape = true;
    pairs.set(key, x);
  };
  for (const [a, m] of Object.entries(c.p.confusions || {})) for (const [b, n] of Object.entries(m)) add(a, b, n, '문제에서 헷갈림');
  for (const m of c.p.mistakes || []) if (m.ans && m.picked && [...m.ans].length === 1 && [...m.picked].length === 1) add(m.ans, m.picked, 0, '오답 기록');
  return [...pairs.values()].sort((x, y) => y.n - x.n || y.shape - x.shape).slice(0, limit)
    .map((x) => ({ ...x, src: [...x.src], he: [D.heStr(dict[x.a], c.pid), D.heStr(dict[x.b], c.pid)] }));
}

// ---------------- 약점 집중 복습 문항: 가장 취약한 영역의 글자·문항으로 구성
export async function weakDrill(c, cat, n = 10) {
  const dict = await D.dict();
  const conf = await D.confusables();
  const d = await dna(c);
  const row = d.rows.find((r) => r.cat === cat) || d.weakest;
  if (!row) return [];
  const scope = c.level && c.level.hasData ? await D.scopeChars(c.pid, c.lid) : [];
  const inScope = new Set(scope);
  const chars = row.chars.filter((ch) => inScope.has(ch) || !scope.length);
  const out = [];
  const typeOf = { '음 혼동': 'eum-char', '훈 혼동': 'hun-char', '뜻 혼동': 'hunum', '비슷한 모양': 'hunum', '획순·획수': 'stroke-count' }[row.cat];
  if (typeOf) {
    for (const ch of chars) {
      if (out.length >= n) break;
      const pool = row.cat === '비슷한 모양' ? [...new Set([...(conf[ch] || []).filter((x) => inScope.has(x)), ...scope])] : scope;
      const q = Q.charQ(typeOf, ch, pool, dict, c.pid) || Q.charQ('hunum', ch, scope, dict, c.pid);
      if (q) out.push(q);
    }
  }
  // 같은 영역에서 실제로 틀렸던 문항(아직 해결 안 된 것) 다시 풀기
  const ids = new Set(row.items.map((m) => m.qid));
  for (const [id, w] of Object.entries(c.p.wrong || {})) {
    if (out.length >= n) break;
    if (ids.has(id) && !w.resolved && w.q && w.q.choices && !['idiom-arrange', 'idiom-write', 'word-write', 'word-combine', 'write'].includes(w.q.type)) out.push(w.q);
  }
  return shuffle(out).slice(0, n);
}

// ---------------- A-9: 시험까지 남은 날짜 → 신규/복습 비중
export function phaseOf(dLeft) {
  if (dLeft == null || dLeft < 0) return { key: 'free', label: '시험일 미정', newShare: 1 };
  if (dLeft > 30) return { key: 'base', label: '기초 다지기', newShare: 1 };
  if (dLeft > 14) return { key: 'd30', label: 'D-30 구간 · 복습 비중 증가', newShare: 0.7 };
  if (dLeft > 7) return { key: 'd14', label: 'D-14 구간 · 오답·복습 중심', newShare: 0.4 };
  if (dLeft > 1) return { key: 'd7', label: 'D-7 구간 · 신규 최소화', newShare: 0.15 };
  return { key: 'd1', label: dLeft === 1 ? 'D-1 · 오답·복습만' : 'D-DAY · 가볍게 오답 확인', newShare: 0 };
}
export const DDAY_MARKS = [30, 14, 7, 1];

// ---------------- A-1: 오늘의 한자 학습 (진도·정답률·오답·마지막 학습일·시험일로 자동 구성, 하루 동안 고정)
export async function buildToday(c) {
  const st = S.get();
  const t = S.today();
  const dLeft = daysUntil(c.p.examDate);
  const phase = phaseOf(dLeft);
  const key = `${c.pid}|${c.lid}|${c.p.examDate || ''}`;
  if (c.p.today && c.p.today.date === t && c.p.today.key === key && c.p.today.v === 1) return c.p.today;
  if (!c.level || !c.level.hasData) return null;
  const cs = await Coach.status(c);
  const dict = await D.dict();
  // 최근 정답률(최근 7일)과 마지막 학습일
  let a = 0, cc = 0; const dd = new Date();
  for (let i = 0; i < 7; i++) { const x = (st.dstat || {})[S.ymd(dd)]; if (x) { a += x.a; cc += x.c; } dd.setDate(dd.getDate() - 1); }
  const acc = a >= 5 ? cc / a : null;
  const lastDay = [...(st.days || [])].filter((x) => x < t).sort().pop() || null;
  const gap = lastDay ? Math.round((new Date(t + 'T00:00:00') - new Date(lastDay + 'T00:00:00')) / DAY) : null;
  let newF = phase.newShare;
  const why = [phase.label];
  if (acc != null && acc < 0.6) { newF *= 0.6; why.push(`최근 정답률 ${Math.round(acc * 100)}% → 새 한자를 줄이고 복습을 늘렸어요`); }
  else if (acc != null && acc >= 0.85) { newF = Math.min(1.2, newF * 1.15); why.push(`최근 정답률 ${Math.round(acc * 100)}% → 새 한자를 조금 늘렸어요`); }
  if (gap != null && gap >= 3) { newF *= 0.7; why.push(`${gap}일 만의 학습 → 복습부터`); }
  const wrongOpen = Object.entries(c.p.wrong || {}).filter(([, w]) => !w.resolved && w.q && w.q.choices && !['idiom-arrange', 'idiom-write', 'word-write', 'word-combine', 'write'].includes(w.q.type));
  const nNew = Math.min(cs.unseen, Math.round(8 * newF));
  const nReview = Math.min(cs.due.length, 12 + Math.round((1 - Math.min(1, newF)) * 6));
  const nWrong = Math.min(wrongOpen.length, 5 + Math.round((1 - Math.min(1, newF)) * 5));
  // 새 한자: 이번 급수 신출 먼저 (Coach.status 정렬)
  const newSet = cs.unseenList.slice(0, nNew);
  const reviewSet = cs.due.slice(0, nReview).map((x) => x.c);
  // 쓰기: 쓰기 실패 → 오늘 새 한자 → 복습 한자 중 획순 데이터 있는 글자
  const wscope = new Set(await D.writeScope(c.pid, c.lid));
  const failW = Object.entries(c.p.writing || {}).filter(([ch, w]) => w.fail > (w.ok || 0) && dict[ch] && dict[ch].so).map(([ch]) => ch);
  const writeSet = [...new Set([...failW, ...newSet, ...reviewSet].filter((ch) => dict[ch] && dict[ch].so && (!wscope.size || wscope.has(ch) || newSet.includes(ch))))].slice(0, 5);
  // 사자성어: 틀린 것 → 아직 안 본 것
  const { scopeIdioms } = await import('./views/idioms.js');
  const { list: idl } = await scopeIdioms(c);
  const idm = shuffle(idl.filter((it) => [...it.w].length === 4)).sort((x, y) => {
    const ex = c.p.idioms[x.id], ey = c.p.idioms[y.id];
    const sx = ex ? (ex.fail > ex.ok ? 0 : 2) : 1, sy = ey ? (ey.fail > ey.ok ? 0 : 2) : 1;
    return sx - sy;
  }).slice(0, 2).map((it) => it.id);
  // 오답: 오답 DNA 에서 가장 취약한 영역의 문항부터
  const d = await dna(c);
  const rank = new Map(d.rows.map((r, i) => [r.cat, i]));
  const conf = await D.confusables();
  const wrongSet = wrongOpen.map(([id, w]) => ({ id, w, r: rank.get(classify({ type: w.q.type, ans: typeof w.q.answer === 'string' ? w.q.answer : w.q.choices[w.q.answer], picked: w.picked != null && w.q.choices ? w.q.choices[w.picked] : null, ch: (w.q.relatedHanja || [])[0], v: '' }, dict, conf)) ?? 9 }))
    .sort((x, y) => x.r - y.r || y.w.count - x.w.count).slice(0, nWrong).map((x) => x.id);
  if (d.weakest) why.push(`가장 취약한 영역: ${d.weakest.cat}`);
  const today = { v: 1, date: t, key, dLeft, phase: phase.key, phaseLabel: phase.label, why, acc, lastDay,
    set: { new: newSet, review: reviewSet, write: writeSet, idioms: idm, wrong: wrongSet }, started: null, finished: null };
  c.p.today = today;
  S.save();
  return today;
}

// 오늘 실제로 한 항목 수 (기록에서 계산 — 화면을 떠났다 돌아와도 정확)
export function todayDone(c, td) {
  if (!td) return null;
  const start = new Date(td.date + 'T00:00:00').getTime();
  const p = c.p;
  const touched = (ch) => p.mastery[ch] && p.mastery[ch].last >= start;
  return {
    new: td.set.new.filter(touched).length,
    review: td.set.review.filter(touched).length,
    write: td.set.write.filter((ch) => p.writing[ch] && p.writing[ch].t >= start).length,
    idioms: td.set.idioms.filter((id) => p.idioms[id] && p.idioms[id].t >= start).length,
    wrong: td.set.wrong.filter((id) => (td.wrongDone || []).includes(id)).length,
  };
}

// ---------------- A-12: 주간 학습 리포트 (최근 7일, 현재 기관·급수)
export async function weekly(c, st = S.get()) {
  const days = []; const d = new Date();
  for (let i = 0; i < 7; i++) { days.push(S.ymd(d)); d.setDate(d.getDate() - 1); }
  const since = new Date(days[6] + 'T00:00:00').getTime();
  const prevSince = since - 7 * DAY;
  const p = c.p;
  let studied = 0, mastered = 0, reviewed = 0, newW = 0;
  const now = Date.now();
  for (const [, e] of Object.entries(p.mastery || {})) {
    if (!e.n) continue;
    if (e.last >= since) { studied++; if (e.n > 1) reviewed++; else newW++; }
    if (S.stageOf(e, now) === 'MASTERED' && e.last >= since) mastered++;
  }
  let q = 0, qc = 0, wr = 0, rv = 0, nw = 0;
  for (const x of days) { const c1 = (st.dcount || {})[x]; if (c1) { q += c1.q; qc += c1.qc; wr += c1.wr; rv += c1.rv; nw += c1.nw; } }
  let pq = 0, pqc = 0;
  const pd = new Date(since - DAY);
  for (let i = 0; i < 7; i++) { const c1 = (st.dcount || {})[S.ymd(pd)]; if (c1) { pq += c1.q; pqc += c1.qc; } pd.setDate(pd.getDate() - 1); }
  const writeN = Math.max(wr, Object.values(p.writing || {}).filter((w) => w.t >= since).length);
  const sec = S.weekSeconds(st);
  const studyDays = days.filter((x) => (st.days || []).includes(x)).length;
  const dn = await dna(c);
  const weekMist = (p.mistakes || []).filter((m) => m.t >= since).length;
  const cs = c.level && c.level.hasData ? await Coach.status(c) : null;
  // 다음 주 추천 학습량: 이번 주 실제 수행량과 남은 기간·복습 부채로 계산
  const dLeft = daysUntil(p.examDate);
  const phase = phaseOf(dLeft);
  // 남은 미학습 한자를 남은 기간(시험일 미정이면 60일)에 나눈 양 × 시험 임박도, 3~15자 범위
  const daysLeft = dLeft != null && dLeft > 0 ? dLeft : 60;
  const recNew = cs && cs.unseen ? Math.min(15, Math.max(3, Math.round((cs.unseen / daysLeft) * phase.newShare))) : 0;
  const recReview = cs ? Math.max(10, Math.round(cs.due.length / 7) + 10) : 12;
  const recWrite = Math.max(3, Math.round((writeN / Math.max(1, studyDays)) || 5));
  const recMin = Math.max(10, Math.round((sec / 60 / Math.max(1, studyDays)) * (studyDays < 4 ? 1 : 1.1)) || 10);
  return {
    days, since, studyDays, minutes: Math.round(sec / 60), streak: S.streak(st).current,
    studied, newW: Math.max(newW, nw), reviewed: Math.max(reviewed, rv), mastered,
    masteredAll: cs ? cs.mastered : 0, target: cs ? cs.target : 0,
    q, qc, acc: q ? Math.round((qc * 100) / q) : null, prevAcc: pq ? Math.round((pqc * 100) / pq) : null,
    writeN, weakest: dn.weakest ? dn.weakest.cat : null, weekMist,
    rec: { perDayNew: phase.newShare ? recNew : 0, perDayReview: recReview, perDayWrite: recWrite, minutes: recMin, phase: phase.label },
  };
}
