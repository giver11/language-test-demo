// 정적 JSON 데이터 로더 (캐시). 모든 시험 정보는 data/ 파일에서만 읽는다 — 코드에 일정·급수를 하드코딩하지 않음.
// 배포 버전 — 데이터·코드가 섞여 캐시되지 않도록 모든 데이터 요청에 붙임
export const APP_VERSION = '2026.09.28-3';
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

export function heStr(d) {
  if (!d) return '';
  if (d.m && d.m.length) return d.m[0][0] + ' ' + d.m[0][1];
  return d.r || '';
}
export function heAll(d) {
  if (!d || !d.m) return '';
  return d.m.map((x) => x[0] + ' ' + x[1]).join(', ');
}
