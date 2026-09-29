// 정적 JSON 데이터 로더 (캐시). 모든 시험 정보는 data/ 파일에서만 읽는다 — 코드에 일정·급수를 하드코딩하지 않음.
// 배포 버전 — 데이터·코드가 섞여 캐시되지 않도록 모든 데이터 요청에 붙임
export const APP_VERSION = '2026.09.29-1';
const cache = new Map();
export const BASE = new URL('../data/', import.meta.url).href;

export async function json(path) {
  if (cache.has(path)) return cache.get(path);
  const p = fetch(BASE + path + '?v=' + APP_VERSION).then((r) => {
    if (!r.ok) throw new Error(path + ' ' + r.status);
    return r.json();
  });
  cache.set(path, p);
  try { return await p; } catch (e) { cache.delete(path); throw e; }
}

export const SCHEDULE_YEAR = 2026;

let _dict = null, _words = null, _idioms = null, _pairs = null;
export async function dict() { if (!_dict) _dict = (await json('dictionary/hanja.json')).chars; return _dict; }
export async function dictMeta() { return (await json('dictionary/hanja.json')).meta; }
export async function words() {
  if (!_words) { const w = (await json('dictionary/words.json')).words; _words = new Map(w.map((x) => [x.w, x])); }
  return _words;
}
export async function idioms() {
  if (!_idioms) { const w = (await json('dictionary/idioms.json')).idioms; _idioms = new Map(w.map((x) => [x.id, x])); }
  return _idioms;
}
let _conf = null, _ex = null;
export async function examples() { if (!_ex) _ex = (await json('dictionary/examples.json')).examples; return _ex; }
export async function confusables() { if (!_conf) _conf = (await json('dictionary/confusables.json')).map; return _conf; }
export async function pairs() { if (!_pairs) _pairs = await json('dictionary/pairs.json'); return _pairs; }
export async function providers() { return (await json('providers/index.json')).providers; }
export async function provider(pid) { return (await providers()).find((p) => p.id === pid); }
export async function levels(pid) { return (await json(`providers/${pid}/levels.json`)); }
export async function level(pid, lid) { return (await levels(pid)).levels.find((l) => l.id === lid); }
export async function sources(pid) { return json(`providers/${pid}/sources.json`); }
export async function examTypes(pid) { return json(`providers/${pid}/exam-types.json`); }
export async function schedule(pid, year = SCHEDULE_YEAR) { return json(`schedules/${pid}-${year}.json`); }
export async function scheduleIndex() { return json('schedules/index.json'); }
export async function stats() { return json('stats.json'); }

const _map = new Map();
// 기관 배정한자 매핑: {c, l(읽기 급수), w(쓰기 시작 급수)}
export async function mapping(pid) {
  if (_map.has(pid)) return _map.get(pid);
  const m = await json(`providers/${pid}/hanja-mapping.json`);
  const lv = await levels(pid);
  const order = new Map(lv.levels.map((l) => [l.id, l.order]));
  const res = { raw: m, items: m.items, order, levels: lv.levels, byChar: new Map(m.items.map((x) => [x.c, x])) };
  _map.set(pid, res);
  return res;
}

// 급수 L 까지의 누적 배정 한자 (읽기)
export async function scopeChars(pid, lid, onlyNew = false) {
  const m = await mapping(pid);
  const Li = m.order.get(lid);
  return m.items.filter((x) => (onlyNew ? m.order.get(x.l) === Li : m.order.get(x.l) <= Li)).map((x) => x.c);
}
// 급수 L 에서 쓰기 범위에 포함되는 한자
export async function writeScope(pid, lid) {
  const m = await mapping(pid);
  const Li = m.order.get(lid);
  return m.items.filter((x) => x.w != null && m.order.get(x.w) <= Li).map((x) => x.c);
}

export async function wordsMapping(pid) { return json(`providers/${pid}/words-mapping.json`); }
export async function idiomsMapping(pid) { return json(`providers/${pid}/idioms-mapping.json`); }

export async function questionIndex() { return json('questions/index.json'); }
export async function bank(pid, lid) {
  try { return await json(`questions/${pid}/${lid}.json`); } catch (e) { return null; }
}

const strokeCache = new Map();
export async function strokes(c) {
  if (strokeCache.has(c)) return strokeCache.get(c);
  const hex = c.codePointAt(0).toString(16).toUpperCase().padStart(4, '0');
  const d = (await dict())[c];
  if (!d || !d.so) { strokeCache.set(c, Promise.resolve(null)); return null; }  // 획순 데이터 없는 글자는 요청하지 않음
  const p = fetch(BASE + 'strokes/' + hex + '.json?v=' + APP_VERSION).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  strokeCache.set(c, p);
  return p;
}

// 현재 선택 기관 — 대한검정회 선택 시 공식 선정한자훈음표의 훈음(dh)을 우선 표시
let _heProvider = null;
export function setHeProvider(pid) { _heProvider = pid || null; }
const HE_FIELD = { daehan: 'dh', jinheung: 'jh' };
export function heList(d, pid = _heProvider) {
  if (!d) return [];
  const f = HE_FIELD[pid];
  if (f && d[f] && d[f].length) return d[f];
  return d.m || [];
}
export function heStr(d, pid) {
  if (!d) return '';
  const m = heList(d, pid);
  if (m.length && m[0][0]) return m[0][0] + ' ' + m[0][1];
  if (m.length && m[0][1]) return m[0][1] + ' (뜻 자료 없음)';
  return d.noHunum ? '훈음 공식 자료 없음' : (d.r || '');
}
export function heAll(d, pid) {
  const m = heList(d, pid);
  return m.map((x) => x[0] + ' ' + x[1]).join(', ');
}

// 기관 공통 데이터 검증: 급수별 누적 수 = 공식 파일 수, 중복, 사전 누락, 훈음 누락(공식 자료 없음으로 문서화된 글자는 경고)
export async function validateProviderData(pid, { quiet = false } = {}) {
  const lv = await levels(pid);
  const m = await mapping(pid);
  const dic = await dict();
  const report = [];
  const seen = new Set();
  let cum = 0;
  const known = new Set(lv.levels.map((l) => l.id));
  const foreign = m.items.filter((x) => !known.has(x.l));
  for (const L of lv.levels) {
    if (!L.hasData) continue;
    const news = m.items.filter((x) => x.l === L.id);
    const dup = [];
    for (const x of news) { if (seen.has(x.c)) dup.push(x.c); seen.add(x.c); }
    cum += news.length;
    const expected = L.officialFileCount != null ? L.officialFileCount : L.readCountGlyph != null ? L.readCountGlyph : L.readCount;
    const missing = news.filter((x) => !dic[x.c]).map((x) => x.c);
    const noHunum = news.filter((x) => { const d = dic[x.c]; const h = d && heList(d, pid); return d && (!h.length || !h[0][0] || !h[0][1]); }).map((x) => x.c);
    const undocumented = noHunum.filter((c) => !(dic[c].noHunum || dic[c].hunMissing));
    const ok = (expected == null || cum === expected) && !dup.length && !missing.length && !undocumented.length;
    const row = { 기관: pid, 급수: L.name, 예상: expected, 실제: cum, 신출: news.length, 중복: dup, 누락: missing, 훈음없음: noHunum, ok };
    if (!ok && !quiet) console.error('[validateProviderData] 불일치', row);
    report.push(row);
  }
  if (foreign.length && !quiet) console.error('[validateProviderData] 급수 범위 밖 항목', pid, foreign.slice(0, 20));
  return { ok: report.every((r) => r.ok) && !foreign.length, levels: report, foreign: foreign.length };
}

// 대한검정회 선정한자 데이터 검증: 급수별 누적 개수(공식) · 중복 · 누락(사전/훈음) · 기관 혼입
export async function validateDaehanHanjaData({ quiet = false } = {}) {
  const lv = await levels('daehan');
  const m = await mapping('daehan');
  const dic = await dict();
  const report = [];
  const seen = new Set();
  const levelIds = new Set(lv.levels.map((l) => l.id));
  const foreign = m.items.filter((x) => !levelIds.has(x.l));
  let cum = 0;
  for (const L of lv.levels) {
    if (L.readCount == null) continue; // 대사범: 선정한자 범위 없음(공식)
    const news = m.items.filter((x) => x.l === L.id);
    const dup = [];
    for (const x of news) { if (seen.has(x.c)) dup.push(x.c); seen.add(x.c); }
    cum += news.length;
    const missing = news.filter((x) => { const d = dic[x.c]; const h = heList(d, 'daehan'); return !d || !h.length || !h[0][0] || !h[0][1]; }).map((x) => x.c);
    const ok = cum === L.readCount && !dup.length && !missing.length && L.hasData;
    const row = { 기관: '대한검정회', 급수: L.name, 예상: L.readCount, 실제: cum, 신출: news.length, 중복: dup, 누락: missing, ok };
    if (!ok && !quiet) console.error('[validateDaehanHanjaData] 불일치', row);
    report.push(row);
  }
  if (foreign.length && !quiet) console.error('[validateDaehanHanjaData] 급수 범위 밖 항목', foreign.slice(0, 20));
  return { ok: report.every((r) => r.ok) && !foreign.length, levels: report, foreign: foreign.length };
}
