// 학습 기록 저장소 (localStorage). 로그인 없이 새로고침 후에도 유지된다.
// 기관별 진도는 byProvider[pid] 에 분리 저장 — 기관을 바꿔도 기존 기록은 삭제되지 않는다.
const KEY = 'hanjaPass.v1';

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
  };
}

function blank() {
  return {
    version: 1,
    current: null,  // {provider}
    minutes: 20,
    byProvider: {},
    favorites: { hanja: [], words: [], idioms: [] },
    xp: 0,
    days: [],       // 학습한 날짜 YYYY-MM-DD
    quest: null,    // {date, provider, level, plan:{...}, done:{...}}
    badges: {},     // id -> date
    log: [],        // 최근 활동 (최대 200)
  };
}

let state = load();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return blank();
    const s = JSON.parse(raw);
    return Object.assign(blank(), s);
  } catch (e) {
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
  if (!state.days.includes(t)) state.days.push(t);
  if (state.days.length > 800) state.days = state.days.slice(-800);
  state.xp += xp;
  state.log.push({ t: Date.now(), k: kind });
  if (state.log.length > 200) state.log = state.log.slice(-200);
  questTick(kind);
  save();
}

export function streak() {
  const set = new Set(state.days);
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
const QUEST_MAP = { card: 'hanja', write: 'writing', word: 'words', idiom: 'idioms', question: 'questions' };
function questTick(kind) {
  const q = state.quest;
  if (!q || q.date !== today()) return;
  const k = QUEST_MAP[kind];
  if (!k) return;
  q.done[k] = (q.done[k] || 0) + 1;
}

export function toggleFav(kind, id) {
  const arr = state.favorites[kind];
  const i = arr.indexOf(id);
  if (i >= 0) arr.splice(i, 1); else arr.push(id);
  save();
  return i < 0;
}
export function isFav(kind, id) { return state.favorites[kind].includes(id); }

// ---------------- 학습 결과 기록 helpers
export function recordCard(pid, c, s) {
  const p = prov(pid);
  const e = p.cards[c] || { n: 0, w: 0 };
  e.s = s; e.n++; e.t = Date.now();
  if (s !== 'know') e.w = (e.w || 0) + 1;
  p.cards[c] = e;
  markStudy('card', s === 'know' ? 2 : 1);
}

export function recordWriting(pid, c, verdict) {
  const p = prov(pid);
  const e = p.writing[c] || { ok: 0, near: 0, fail: 0 };
  if (verdict === 'good') e.ok++; else if (verdict === 'near') e.near++; else e.fail++;
  e.last = verdict; e.t = Date.now();
  p.writing[c] = e;
  markStudy('write', verdict === 'good' ? 5 : verdict === 'near' ? 3 : 1);
}

export function recordAnswer(pid, q, correct, extra = {}) {
  const p = prov(pid);
  p.quiz.answered++;
  if (correct) p.quiz.correct++;
  const bt = p.quiz.byType[q.typeLabel] || (p.quiz.byType[q.typeLabel] = { a: 0, c: 0 });
  bt.a++; if (correct) bt.c++;
  const cat = categoryOf(q);
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

export function categoryOf(q) {
  if (q.type === 'write' || q.type === 'idiom-write' || q.type === 'word-write') return '쓰기';
  if (q.type && q.type.startsWith('idiom')) return '사자성어';
  if (q.type && q.type.startsWith('word')) return '한자어';
  return '한자';
}

export function exportJSON() { return JSON.stringify(state); }
