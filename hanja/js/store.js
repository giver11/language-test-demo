// 학습 기록 저장소 (localStorage). 로그인 없이 새로고침 후에도 유지된다.
// 기관별 진도는 byProvider[pid] 에 분리 저장 — 기관을 바꿔도 기존 기록은 삭제되지 않는다.
// 스키마 버전: 1(초기) → 2(mastery·간격반복·학습시간·혼동기록·일별 학습계획) → 3(오답 DNA 로그·쓰기 단계 기록·일별 학습량·XP 보너스·연속학습 기록).
// migrate() 가 이전 데이터를 보존한 채 올린다(단계마다 원본 백업, 실패하면 이전 데이터를 그대로 유지).
// 프로필(자녀별): 기본 프로필은 기존 키 'hanjaPass.v1' 을 그대로 쓰고, 추가 프로필은 'hanjaPass.v1@<id>' 에 저장한다.
export const SCHEMA_VERSION = 3;
const BASE_KEY = 'hanjaPass.v1';
const PROFILES_KEY = 'hanjaPass.profiles';
const ACTIVE_KEY = 'hanjaPass.activeProfile';
function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
function lsSet(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } }
export function activeProfileId() { return lsGet(ACTIVE_KEY) || 'default'; }
export function keyOf(id) { return !id || id === 'default' ? BASE_KEY : BASE_KEY + '@' + id; }
const KEY = keyOf(activeProfileId());

function blankProvider() {
  return {
    level: null, examDate: null, examRound: null,
    cards: {},      // 字 -> {s:'know'|'unsure'|'dont', n, w(오답/헷갈림 횟수), t}
    writing: {},    // 字 -> {ok, near, fail, t, last}
    words: {},      // 漢字語 -> {ok, fail, t}
    idioms: {},     // id -> {ok, fail, t}
    quiz: { answered: 0, correct: 0, byType: {} },
    wrong: {},      // qid -> {q, count, t, cat, resolved}
    mocks: [],      // {t, level, score, correct, total, pass, byType, weak...}
    mastery: {},    // 字 -> {m(0~100), st(간격 단계), due, n, ok, lap, rt(ms), w, wok, last}
    confusions: {}, // 정답字 -> {고른字: 횟수}  (내가 자꾸 헷갈리는 한자)
    dailyLog: {},   // YYYY-MM-DD -> {plan, done}
    mistakes: [],   // 오답 DNA 원자료 {t, qid, type, ans, picked, ch, idiom, word, v} (최대 600)
    writeModes: {}, // 字 -> {1: 보고 쓰기 횟수, 2: 흐리게 보고 쓰기, 3: 안 보고 쓰기, ok: 통과 횟수}
    today: null,    // 오늘의 한자 학습 세트 {date, key, set:{new,review,write,idioms,wrong}, done:{...}}
  };
}

function blank() {
  return {
    version: SCHEMA_VERSION,
    current: null,  // {provider}
    minutes: 20,
    byProvider: {},
    favorites: { hanja: [], words: [], idioms: [] },
    xp: 0,
    days: [],       // 학습한 날짜 YYYY-MM-DD
    quest: null,    // {date, provider, level, plan:{...}, done:{...}}
    badges: {},     // id -> date
    log: [],        // 최근 활동 (최대 200)
    time: {},       // YYYY-MM-DD -> 실제 학습 화면 사용 초
    games: {},      // 게임 기록 {king: {date: best}, ...}
    parent: { pin: null },
    dcount: {},     // YYYY-MM-DD -> {nw(새 한자), rv(복습), wr(쓰기), q(문제), qc(정답)}
    xpAwards: {},   // YYYY-MM-DD -> {study, review, write, goal} (하루 1번씩만 지급)
    streakMarks: {},// 1·3·7·14·30·100 -> 처음 달성한 날짜
  };
}

// ---------------- 스키마 migration (이전 데이터 삭제 없음)
const IV = [1, 3, 7, 14, 30];
export function migrate(s, profileId = activeProfileId()) {
  const from = s.version || 1;
  if (from >= SCHEMA_VERSION) return s;
  if (from < 2) {
    // 이전 버전 원본을 한 번 백업해 둔다
    const bk = BASE_KEY + '.backup.v1' + (!profileId || profileId === 'default' ? '' : '@' + profileId);
    if (!lsGet(bk)) lsSet(bk, JSON.stringify(s));
    for (const p of Object.values(s.byProvider || {})) {
      p.mastery = p.mastery || {};
      p.confusions = p.confusions || {};
      p.dailyLog = p.dailyLog || {};
      // 카드·쓰기·오답 기록으로 초기 mastery 추정
      for (const [ch, e] of Object.entries(p.cards || {})) {
        const base = e.s === 'know' ? 70 : e.s === 'unsure' ? 35 : 10;
        const m = Math.max(0, base - Math.min(20, (e.w || 0) * 5));
        p.mastery[ch] = { m, st: e.s === 'know' ? 2 : 0, due: (e.t || Date.now()) + (e.s === 'know' ? 7 : 1) * 86400000, n: e.n || 1, ok: e.s === 'know' ? 1 : 0, lap: e.w || 0, rt: 0, w: 0, wok: 0, last: e.t || Date.now() };
      }
      for (const [ch, e] of Object.entries(p.writing || {})) {
        const x = p.mastery[ch] || { m: 20, st: 0, due: Date.now(), n: 0, ok: 0, lap: 0, rt: 0, w: 0, wok: 0, last: e.t || Date.now() };
        x.w = (e.ok || 0) + (e.near || 0) + (e.fail || 0); x.wok = (e.ok || 0) + (e.near || 0);
        p.mastery[ch] = x;
      }
    }
    s.time = s.time || {}; s.games = s.games || {}; s.parent = s.parent || { pin: null };
    s.version = 2;
  }
  if (s.version < 3) {
    const bk = BASE_KEY + '.backup.v2' + (!profileId || profileId === 'default' ? '' : '@' + profileId);
    if (!lsGet(bk)) lsSet(bk, JSON.stringify(s));
    try {
      const next = JSON.parse(JSON.stringify(s));   // 사본에서 변환 → 실패하면 원본(s)을 그대로 쓴다
      for (const p of Object.values(next.byProvider || {})) {
        p.writeModes = p.writeModes || {};
        if (!Array.isArray(p.mistakes)) {
          // 기존 오답노트를 오답 DNA 원자료로 옮김 (오답노트 자체는 그대로 둔다)
          p.mistakes = Object.entries(p.wrong || {}).map(([qid, w]) => mistakeOf(w.q || {}, w.picked, w.t, qid)).filter(Boolean);
          for (const [ch, w] of Object.entries(p.writing || {})) if ((w.fail || 0) > 0) p.mistakes.push({ t: w.t || Date.now(), type: 'write', ch, v: w.last || 'retry' });
        }
        for (const e of Object.values(p.mastery || {})) if (e && e.iv == null) e.iv = IV[e.st || 0];
      }
      next.dcount = next.dcount || {};
      for (const x of next.log || []) {
        const d = ymd(new Date(x.t)); const c = next.dcount[d] || (next.dcount[d] = { nw: 0, rv: 0, wr: 0, q: 0, qc: 0 });
        if (x.k === 'card') c.nw++; else if (x.k === 'review') c.rv++; else if (x.k === 'write') c.wr++; else c.q++;
      }
      for (const [d, x] of Object.entries(next.dstat || {})) { const c = next.dcount[d] || (next.dcount[d] = { nw: 0, rv: 0, wr: 0, q: 0, qc: 0 }); c.q = Math.max(c.q, x.a || 0); c.qc = x.c || 0; }
      next.xpAwards = next.xpAwards || {};
      next.streakMarks = next.streakMarks || {};
      const best = streak(next).best;
      for (const m of STREAK_MARKS) if (best >= m && !next.streakMarks[m]) next.streakMarks[m] = '기존 기록';
      next.version = 3;
      return next;
    } catch (err) {
      console.error('[hanjaPass] v3 migration 실패 — 기존 데이터 유지', err);
      return s;
    }
  }
  return s;
}
export const STREAK_MARKS = [1, 3, 7, 14, 30, 100];

// 오답 1건 → 오답 DNA 원자료 (분류는 dna.js 에서 사전·모양 데이터로 계산)
function ansStr(q) { return typeof q.answer === 'string' ? q.answer : q.choices && q.choices[q.answer] != null ? String(q.choices[q.answer]) : ''; }
function mistakeOf(q, picked, t, qid) {
  if (!q || !q.type) return null;
  const pk = picked != null && q.choices && typeof picked === 'number' ? q.choices[picked] : typeof picked === 'string' ? picked : null;
  return { t: t || Date.now(), qid: qid || q.id, type: q.type, label: q.typeLabel || '', ans: ansStr(q), picked: pk == null ? null : String(pk), ch: (q.relatedHanja || [])[0] || null, rel: (q.relatedHanja || []).slice(0, 4), idiom: q.idiom || null, word: q.word || null };
}


let state = load();

function load() {
  let raw = null;
  try {
    raw = localStorage.getItem(KEY);
    if (!raw) return blank();
    const s = JSON.parse(raw);
    return migrate(Object.assign(blank(), s, { version: s.version || 1 }));
  } catch (e) {
    // 읽기 실패: 원본 문자열을 따로 보관한 뒤 빈 기록으로 시작 (원본을 덮어써 잃지 않도록)
    console.error('[hanjaPass] 학습 기록을 읽지 못했어요 — 원본을 백업 키에 보관합니다', e);
    if (raw) lsSet(KEY + '.backup.unreadable-' + Date.now(), raw);
    return blank();
  }
}

let saveTimer = null;
export function save(now = false) {
  const write = () => {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { console.warn('저장 실패', e); }
  };
  if (now) { clearTimeout(saveTimer); write(); return; }
  clearTimeout(saveTimer);
  saveTimer = setTimeout(write, 120);
}
window.addEventListener('pagehide', () => save(true));
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') save(true); });

export function get() { return state; }
// 다른 프로필(자녀) 기록 읽기 — 보호자 대시보드용 (읽기 전용)
export function readProfile(id) {
  if (id === activeProfileId()) return state;
  try { const raw = lsGet(keyOf(id)); if (!raw) return blank(); const o = JSON.parse(raw); return migrate(Object.assign(blank(), o, { version: o.version || 1 }), id); } catch (e) { return blank(); }
}
export function profiles() {
  let list = [];
  try { list = JSON.parse(lsGet(PROFILES_KEY) || '[]'); } catch (e) { list = []; }
  if (!list.find((x) => x.id === 'default')) list.unshift({ id: 'default', nick: '기본 학습자' });
  return list;
}
export function addProfile(nick) {
  const list = profiles();
  const id = 'p' + Date.now().toString(36);
  list.push({ id, nick: String(nick || '학습자').slice(0, 12) });
  lsSet(PROFILES_KEY, JSON.stringify(list));
  return id;
}
export function renameProfile(id, nick) {
  const list = profiles(); const x = list.find((p) => p.id === id); if (x) x.nick = String(nick).slice(0, 12);
  lsSet(PROFILES_KEY, JSON.stringify(list));
}
export function switchProfile(id) { save(true); lsSet(ACTIVE_KEY, id); location.hash = '#/home'; location.reload(); }
export function reset() { state = blank(); save(true); }

export function today() {
  const d = new Date();
  return ymd(d);
}
export function ymd(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function prov(pid) {
  pid = pid || (state.current && state.current.provider);
  if (!pid) return null;
  if (!state.byProvider[pid]) state.byProvider[pid] = blankProvider();
  const p = state.byProvider[pid];
  // 이전 버전 호환
  for (const [k, v] of Object.entries(blankProvider())) if (p[k] === undefined) p[k] = v;
  return p;
}

export function setCurrent(pid, patch = {}) {
  state.current = { provider: pid };
  Object.assign(prov(pid), patch);
  save(true);
}

export function markStudy(kind, xp = 0) {
  const t = today();
  const firstToday = !state.days.includes(t);
  if (firstToday) state.days.push(t);
  if (state.days.length > 800) state.days = state.days.slice(-800);
  state.xp += xp;
  state.log.push({ t: Date.now(), k: kind });
  if (state.log.length > 200) state.log = state.log.slice(-200);
  const dc = dcountOf(t);
  if (kind === 'card') dc.nw++; else if (kind === 'review') dc.rv++; else if (kind === 'write') dc.wr++;
  if (firstToday) streakMarkCheck();
  questTick(kind);
  save();
}
export function dcountOf(t = today()) {
  const d = state.dcount || (state.dcount = {});
  const c = d[t] || (d[t] = { nw: 0, rv: 0, wr: 0, q: 0, qc: 0 });
  for (const k of ['nw', 'rv', 'wr', 'q', 'qc']) if (c[k] == null) c[k] = 0;
  return c;
}

// ---------------- XP 보너스 (하루 1번씩): 오늘 학습(10분 학습 끝까지) +10 · 복습 완료 +5 · 쓰기 완료 +5 · 오늘의 목표 전부 완료 +20
export const XP_BONUS = { study: 10, review: 5, write: 5, goal: 20 };
export function award(kind, t = today()) {
  const a = state.xpAwards || (state.xpAwards = {});
  const d = a[t] || (a[t] = {});
  if (d[kind] || !XP_BONUS[kind]) return 0;
  d[kind] = Date.now();
  state.xp += XP_BONUS[kind];
  state.log.push({ t: Date.now(), k: 'bonus-' + kind });
  if (typeof window !== 'undefined' && window.dispatchEvent) setTimeout(() => window.dispatchEvent(new CustomEvent('hanja:xp', { detail: { kind, xp: XP_BONUS[kind] } })), 0);
  return XP_BONUS[kind];
}
function streakMarkCheck() {
  const cur = streak().current;
  const m = state.streakMarks || (state.streakMarks = {});
  for (const n of STREAK_MARKS) if (cur >= n && !m[n]) m[n] = today();
}

export function streak(st = state) {
  const set = new Set(st.days || []);
  let cur = 0;
  const d = new Date();
  // 오늘 아직 안 했어도 어제까지 이어졌으면 유지
  if (!set.has(ymd(d))) d.setDate(d.getDate() - 1);
  while (set.has(ymd(d))) { cur++; d.setDate(d.getDate() - 1); }
  // 최장 기록
  const sorted = [...set].sort();
  let best = 0, run = 0, prev = null;
  for (const s of sorted) {
    const dt = new Date(s + 'T00:00:00');
    if (prev && (dt - prev) === 86400000) run++; else run = 1;
    best = Math.max(best, run); prev = dt;
  }
  return { current: cur, best };
}

// ---------------- Daily Quest 진행 카운트
const QUEST_MAP = { card: 'hanja', review: 'review', write: 'writing', word: 'words', idiom: 'idioms', question: 'questions', game: 'questions' };
function questTick(kind) {
  const q = state.quest;
  if (!q || q.date !== today()) return;
  const k = QUEST_MAP[kind];
  if (!k) return;
  q.done[k] = (q.done[k] || 0) + 1;
  const cur = state.current && state.byProvider[state.current.provider];
  if (cur && cur.dailyLog && cur.dailyLog[q.date]) cur.dailyLog[q.date].done = { ...q.done };
  checkQuestBonus();
}
// 오늘 계획 달성 여부로 보너스 지급
export function checkQuestBonus() {
  const q = state.quest;
  if (!q || q.date !== today() || !q.plan) return;
  const done = (k) => (q.done[k] || 0) >= (q.plan[k] || 0);
  if (q.plan.review > 0 && done('review')) award('review');
  if (q.plan.writing > 0 && done('writing')) award('write');
  const keys = Object.keys(q.plan).filter((k) => q.plan[k] > 0);
  if (keys.length && keys.every(done)) award('goal');
}

export function toggleFav(kind, id) {
  const arr = state.favorites[kind];
  const i = arr.indexOf(id);
  if (i >= 0) arr.splice(i, 1); else arr.push(id);
  save();
  return i < 0;
}
export function isFav(kind, id) { return state.favorites[kind].includes(id); }

// ---------------- Mastery(0~100) · 간격 반복(1·3·7·14·30일, 정답률로 자동 조정)
const DAY = 86400000;
function stageScore(st) { return [22, 42, 62, 80, 94][st] || 0; }
export function masteryValue(e, now = Date.now()) {
  if (!e) return 0;
  const acc = e.n ? e.ok / e.n : 0;
  const wacc = e.w ? e.wok / e.w : acc;
  let m = 0.55 * stageScore(e.st) + 0.3 * acc * 100 + 0.15 * wacc * 100;
  m -= Math.min(20, (e.lap || 0) * 4);                        // 반복 오답
  if (e.rt && e.rt > 8000) m -= 5;                              // 반응이 매우 느림
  const overdue = now - (e.due || now);
  if (overdue > 0) m -= Math.min(20, (overdue / DAY) * 2);      // 복습 시기를 넘기면 서서히 감소
  return Math.max(0, Math.min(100, Math.round(m)));
}
export function touch(pid, ch, ok, opt = {}) {
  if (!ch) return;
  const p = prov(pid);
  const now = Date.now();
  const e = p.mastery[ch] || { m: 0, st: 0, due: now, n: 0, ok: 0, lap: 0, rt: 0, w: 0, wok: 0, last: 0, iv: 0, h: '' };
  const first = !e.n;
  e.n++;
  if (ok) e.ok++;
  e.h = ((e.h || '') + (ok ? '1' : '0')).slice(-8);   // 최근 8번 결과
  if (opt.src === 'write') { e.w++; if (ok) e.wok++; }
  if (opt.rt && opt.rt > 0 && opt.rt < 120000) e.rt = e.rt ? Math.round(e.rt * 0.7 + opt.rt * 0.3) : Math.round(opt.rt);
  if (ok) {
    // 복습 시기가 됐거나(또는 첫 학습) 정답이면 다음 단계로. 같은 날 반복 정답은 단계를 올리지 않음
    const ready = first || now >= e.due - 0.25 * DAY || now - e.last > DAY;
    if (ready && !opt.soft) e.st = Math.min(IV.length - 1, e.st + (first ? 0 : 1));
    // 누적 정답률 + 최근 성적(최근 8번)을 함께 반영: 최근에 자주 틀리면 간격을 줄인다
    const acc = 0.5 * (e.ok / e.n) + 0.5 * recentAcc(e);
    const f = acc >= 0.9 ? 1.3 : acc >= 0.75 ? 1 : acc >= 0.5 ? 0.75 : 0.5;
    const fast = opt.rt && opt.rt < 3500 ? 1.1 : opt.rt && opt.rt > 10000 ? 0.8 : 1;   // 답이 매우 느리면 더 일찍 복습
    e.iv = Math.max(1, Math.round(IV[e.st] * f * fast * 10) / 10);
    e.due = now + e.iv * DAY;
  } else {
    e.lap = (e.lap || 0) + (opt.soft ? 0 : 1);
    e.st = 0;
    e.iv = opt.soft ? 0.5 : 1;
    e.due = now + e.iv * DAY;
  }
  e.last = now;
  e.m = masteryValue(e, now);
  p.mastery[ch] = e;
}
function recentAcc(e) { const h = e.h || ''; if (!h.length) return e.n ? e.ok / e.n : 0; return h.split('').filter((x) => x === '1').length / h.length; }

// 한자별 간격복습 기록 (A-2 스키마 형태로 조회)
export function srs(pid, ch, now = Date.now()) {
  const p = prov(pid); const e = p && p.mastery[ch];
  const base = { char: ch, exam: pid, level: p && p.level, correctCount: 0, wrongCount: 0, lastReviewed: null, nextReview: null, interval: 0, mastery: 0, stage: 'NEW' };
  if (!e || !e.n) return base;
  return { ...base, correctCount: e.ok, wrongCount: e.n - e.ok, lastReviewed: e.last || null, nextReview: e.due || null, interval: e.iv != null ? e.iv : IV[e.st || 0], mastery: masteryValue(e, now), stage: stageOf(e, now) };
}
// Mastery 4단계: NEW(새 한자) · LEARNING(학습 중) · REVIEW(복습 필요) · MASTERED(완전 학습)
export const STAGE_KO = { NEW: '새 한자', LEARNING: '학습 중', REVIEW: '복습 필요', MASTERED: '완전 학습' };
export function stageOf(e, now = Date.now()) {
  if (!e || !e.n) return 'NEW';
  const m = masteryValue(e, now);
  if (e.due && e.due <= now) return 'REVIEW';
  if (m >= 80 && (e.st || 0) >= 2) return 'MASTERED';
  return 'LEARNING';
}
export function recordMistake(pid, entry) {
  const p = prov(pid);
  if (!Array.isArray(p.mistakes)) p.mistakes = [];
  p.mistakes.push({ t: Date.now(), ...entry });
  if (p.mistakes.length > 600) p.mistakes = p.mistakes.slice(-600);
}

export function recordConfusion(pid, ans, picked) {
  if (!ans || !picked || ans === picked) return;
  const p = prov(pid);
  const x = p.confusions[ans] || (p.confusions[ans] = {});
  x[picked] = (x[picked] || 0) + 1;
}

// ---------------- 학습 시간(실제로 화면을 쓰는 시간만)
let lastAct = Date.now();
['pointerdown', 'keydown', 'touchstart'].forEach((ev) => window.addEventListener(ev, () => { lastAct = Date.now(); }, { passive: true }));
setInterval(() => {
  if (document.visibilityState !== 'visible' || Date.now() - lastAct > 60000) return;
  const t = today();
  state.time[t] = (state.time[t] || 0) + 15;
  save();
}, 15000);
export function weekSeconds(st = state, days = 7) {
  let sum = 0; const d = new Date();
  for (let i = 0; i < days; i++) { sum += (st.time || {})[ymd(d)] || 0; d.setDate(d.getDate() - 1); }
  return sum;
}

// ---------------- 학습 결과 기록 helpers
export function recordCard(pid, c, s) {
  const p = prov(pid);
  const e = p.cards[c] || { n: 0, w: 0 };
  e.s = s; e.n++; e.t = Date.now();
  if (s !== 'know') e.w = (e.w || 0) + 1;
  p.cards[c] = e;
  const seenBefore = !!(p.mastery[c] && p.mastery[c].n);
  touch(pid, c, s === 'know', { src: 'card', soft: s === 'unsure' });
  markStudy(seenBefore ? 'review' : 'card', s === 'know' ? 2 : 1);
}

export function recordWriting(pid, c, verdict, detail = {}) {
  const p = prov(pid);
  if (detail.mode) {
    const wm = p.writeModes[c] || (p.writeModes[c] = { 1: 0, 2: 0, 3: 0, ok: 0 });
    wm[detail.mode] = (wm[detail.mode] || 0) + 1;
    if (verdict === 'good' || verdict === 'near') wm.ok = (wm.ok || 0) + 1;
    wm.t = Date.now();
  }
  if (verdict !== 'good' && verdict !== 'near') recordMistake(pid, { type: 'write', ch: c, v: detail.v || verdict });
  const e = p.writing[c] || { ok: 0, near: 0, fail: 0 };
  if (verdict === 'good') e.ok++; else if (verdict === 'near') e.near++; else e.fail++;
  e.last = verdict; e.t = Date.now();
  p.writing[c] = e;
  touch(pid, c, verdict === 'good' || verdict === 'near', { src: 'write', soft: verdict === 'near' });
  markStudy('write', verdict === 'good' ? 5 : verdict === 'near' ? 3 : 1);
}

// 날짜별 풀이 수·정답 수 (공유 카드·부모 리포트용 실제 기록)
export function dayStat(ok, t = today()) {
  const d = state.dstat || (state.dstat = {});
  const e = d[t] || (d[t] = { a: 0, c: 0 });
  e.a++; if (ok) e.c++;
  const dc = dcountOf(t); dc.q++; if (ok) dc.qc++;
}
export function recordAnswer(pid, q, correct, extra = {}) {
  const p = prov(pid);
  dayStat(correct);
  if (!correct && !extra.writingRecorded) { const m = mistakeOf(q, extra.picked, Date.now()); if (m) { if (extra.rt) m.rt = extra.rt; recordMistake(pid, m); } }
  p.quiz.answered++;
  if (correct) p.quiz.correct++;
  const bt = p.quiz.byType[q.typeLabel] || (p.quiz.byType[q.typeLabel] = { a: 0, c: 0 });
  bt.a++; if (correct) bt.c++;
  const cat = categoryOf(q);
  // mastery: 한 글자 문항은 대상 글자, 한자어·성어 문항은 구성 글자 모두 (가볍게)
  // 직접 쓰기에서 이미 recordWriting()으로 mastery를 기록했다면 여기서 다시 증가시키지 않는다(이중 반영 방지)
  if (!extra.writingRecorded) {
    const rel = q.relatedHanja || [];
    const single = rel.length && ['hunum', 'hunum-rev', 'hun-char', 'eum-char', 'reading-char', 'radical', 'stroke-count', 'homophone-char', 'antonym', 'synonym', 'write'].includes(q.type);
    if (single) {
      const target = q.type === 'hunum-rev' || q.type === 'hun-char' || q.type === 'eum-char' || q.type === 'write'
        ? (typeof q.answer === 'string' ? q.answer : q.choices && q.choices[q.answer]) || rel[0]
        : rel[0];
      touch(pid, target, correct, { src: q.type === 'write' ? 'write' : 'quiz', rt: extra.rt });
    } else {
      for (const ch of rel) touch(pid, ch, correct, { src: 'quiz', rt: extra.rt, soft: true });
    }
  }
  if (!correct && q.choices && typeof q.answer === 'number' && extra.picked != null) {
    const a = q.choices[q.answer], b = q.choices[extra.picked];
    if (typeof a === 'string' && typeof b === 'string' && [...a].length === 1 && [...b].length === 1) recordConfusion(pid, a, b);
  }
  if (!correct) {
    const w = p.wrong[q.id] || { count: 0 };
    w.q = q; w.count++; w.t = Date.now(); w.cat = cat; w.resolved = false; w.picked = extra.picked;
    p.wrong[q.id] = w;
    for (const c of q.relatedHanja || []) {
      const ce = p.cards[c] || { n: 0, w: 0, s: 'unsure' };
      ce.w = (ce.w || 0) + 1; ce.t = ce.t || Date.now();
      p.cards[c] = ce;
    }
    if (q.idiom) {
      const ie = p.idioms[q.idiom] || { ok: 0, fail: 0 };
      ie.fail++; ie.t = Date.now(); p.idioms[q.idiom] = ie;
    }
  } else {
    if (p.wrong[q.id]) { p.wrong[q.id].resolved = true; p.wrong[q.id].rt = Date.now(); }
    if (q.idiom) {
      const ie = p.idioms[q.idiom] || { ok: 0, fail: 0 };
      ie.ok++; ie.t = Date.now(); p.idioms[q.idiom] = ie;
    }
  }
  markStudy(q.idiom ? 'idiom' : (cat === '한자어' ? 'word' : 'question'), correct ? 3 : 1);
  if (cat === '한자어' || cat === '사자성어') questTick('question');
}

// 게임 결과 기록: 게임별 최고점·횟수(state.games) + 날짜별 로그(부모 리포트용)
export function recordGame(id, score, total, extra = {}) {
  const g = state.games[id] || (state.games[id] = { n: 0, best: 0, last: null });
  g.n++; g.best = Math.max(g.best || 0, score); g.last = { t: Date.now(), score, total, ...extra };
  const log = state.games.log || (state.games.log = []);
  log.push({ t: Date.now(), id, score, total });
  if (log.length > 300) state.games.log = log.slice(-300);
  save(true);
  return g;
}
export function categoryOf(q) {
  if (q.type === 'write' || q.type === 'idiom-write' || q.type === 'word-write') return '쓰기';
  if (q.type && q.type.startsWith('idiom')) return '사자성어';
  if (q.type && q.type.startsWith('word')) return '한자어';
  return '한자';
}

export function exportJSON() { return JSON.stringify(state); }
// 부모 모드: 자녀 기기에서 내보낸 기록을 새 프로필로 추가(현재 사용자의 기록은 그대로)
export function importAsProfile(text, nick) {
  let o;
  try { o = JSON.parse(text); } catch (e) { throw new Error('JSON 파일이 아니에요'); }
  if (!o || typeof o !== 'object' || !o.byProvider) throw new Error('한자패스 학습 기록 파일이 아니에요');
  const id = addProfile(nick);
  const st = migrate(Object.assign(blank(), o, { version: o.version || 1 }), id);
  if (!lsSet(keyOf(id), JSON.stringify(st))) throw new Error('저장 공간이 부족해요');
  return id;
}
// 백업 가져오기(다른 기기에서 내보낸 JSON). 현재 기록은 지우지 않고 먼저 백업 키에 보관한 뒤 교체한다.
export function importJSON(text) {
  let o;
  try { o = JSON.parse(text); } catch (e) { throw new Error('JSON 파일이 아니에요'); }
  if (!o || typeof o !== 'object' || !o.byProvider || typeof o.byProvider !== 'object') throw new Error('한자패스 학습 기록 파일이 아니에요');
  const bk = KEY + '.backup.import-' + Date.now();
  lsSet(bk, JSON.stringify(state));
  state = migrate(Object.assign(blank(), o, { version: o.version || 1 }));
  save(true);
  return { backupKey: bk, providers: Object.keys(state.byProvider).length };
}
