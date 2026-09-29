// 시험지 생성기 — 선택한 기관·급수의 공식 배정한자와 공식/공공 훈음 자료로 자체 제작 문항을 만든다.
// 기출문제·출판사 문제를 쓰지 않는다. 같은 시드로 같은 시험지를 다시 만들 수 있다(과제 링크용).
import * as D from './data.js';
import * as Q from './qgen.js';
import { esc, shuffle } from './ui.js';

export const TYPES = [
  ['hunum', '한자 → 훈음'], ['hun-char', '훈 → 한자'], ['eum-char', '음 → 한자'],
  ['radical', '부수'], ['stroke-count', '획수'], ['word-reading', '한자어 읽기'], ['write', '훈음 보고 한자 쓰기'],
];
export const RANGES = [['all', '급수 누적 범위'], ['new', '이번 급수 신출 한자만'], ['chars', '지정한 한자만']];
export const LEVELS = [['easy', '쉬움'], ['normal', '보통'], ['hard', '어려움']];

// spec: {pid, lid, range, chars[], n, diff, types[], seed, title}
export async function build(spec) {
  const dict = await D.dict();
  const words = await D.words();
  const conf = await D.confusables();
  const all = await D.scopeChars(spec.pid, spec.lid);
  const nw = new Set(await D.scopeChars(spec.pid, spec.lid, true));
  const rnd = Q.seeded(String(spec.seed || Date.now()));
  let target = spec.range === 'new' ? all.filter((x) => nw.has(x)) : spec.range === 'chars' ? (spec.chars || []).filter((x) => dict[x]) : all;
  if (!target.length) target = all;
  const heOk = (x) => { const m = D.heList(dict[x], spec.pid); return m.length && m[0][0] && m[0][1]; };
  target = target.filter(heOk);
  const types = spec.types && spec.types.length ? spec.types : ['hunum', 'hun-char', 'eum-char'];
  return Q.withSeed(rnd, () => {
    // 난이도: 쉬움=하위 급수 한자 위주·무작위 오답 / 보통=섞음 / 어려움=신출 한자 위주·모양 비슷한 오답
    let order = shuffle(target, rnd);
    if (spec.diff === 'easy') order.sort((a, b) => (nw.has(a) ? 1 : 0) - (nw.has(b) ? 1 : 0));
    if (spec.diff === 'hard') order.sort((a, b) => (nw.has(b) ? 1 : 0) - (nw.has(a) ? 1 : 0));
    const qs = [];
    let k = 0;
    for (const ch of order) {
      if (qs.length >= spec.n) break;
      const type = types[k++ % types.length];
      let q = null;
      if (type === 'write') {
        const [h, e] = D.heList(dict[ch], spec.pid)[0];
        q = { id: 'ws-w-' + ch, type: 'write', typeLabel: '쓰기', question: `다음 훈음에 맞는 한자를 쓰시오.`, prompt: `${h} ${e}`, answer: ch, relatedHanja: [ch], sourceType: 'original' };
      } else if (type === 'word-reading') {
        const w = (dict[ch].ex || []).find((x) => words.get(x) && [...x].every((y) => all.includes(y)));
        if (w) q = Q.wordQ(w, [...words.keys()].slice(0, 4000), words);
      } else {
        const sim = spec.diff === 'hard' ? (conf[ch] || []).filter((x) => all.includes(x) && heOk(x)) : [];
        const pool = sim.length >= 3 && (type === 'hunum' || type === 'hun-char') ? [...sim, ...target] : target;
        q = Q.charQ(type, ch, pool, dict, spec.pid);
      }
      if (q && !qs.find((x) => x.question === q.question && x.prompt === q.prompt && x.answer === q.answer)) qs.push(q);
    }
    return qs;
  });
}

const ansText = (q) => (q.type === 'write' ? q.answer : `${q.answer + 1}. ${q.choices[q.answer]}`);

export function sheetHtml(qs, meta) {
  const head = `<div class="ws-head"><h2>${esc(meta.title || '한자 확인 시험')}</h2>
    <div class="ws-meta">${esc(meta.provider)} ${esc(meta.level)} · ${qs.length}문항 · 이름: ________ · 점수: ____ / ${qs.length}</div></div>`;
  const body = qs.map((q, i) => `<li class="ws-q"><div><b>${i + 1}.</b> ${esc(q.question)}</div>
      ${q.prompt ? `<div class="ws-prompt ${q.type === 'write' ? '' : 'hanzi'}">${esc(q.prompt)}</div>` : ''}
      ${q.type === 'write' ? '<div class="ws-box"></div>' : `<ol class="ws-ch">${q.choices.map((c) => `<li><span class="${c.length <= 2 && /[㐀-鿿]/.test(c) ? 'hanzi' : ''}">${esc(c)}</span></li>`).join('')}</ol>`}</li>`).join('');
  return `${head}<ol class="ws-list">${body}</ol><p class="ws-foot">자체 제작 연습문제 · ${esc(meta.provider)} 공식 배정한자 기준 · 실제 기출문제가 아닙니다.</p>`;
}
export function answerHtml(qs, meta) {
  return `<div class="ws-head"><h2>${esc(meta.title || '한자 확인 시험')} — 정답</h2><div class="ws-meta">${esc(meta.provider)} ${esc(meta.level)}</div></div>
    <table class="ws-ans"><tbody>${qs.map((q, i) => `<tr><td>${i + 1}</td><td class="hanzi">${esc(ansText(q))}</td><td class="small">${esc(q.explanation || (q.type === 'write' ? `${q.prompt} → ${q.answer}` : ''))}</td></tr>`).join('')}</tbody></table>`;
}

// 과제 코드: 설정만 담는다(학생 개인정보 없음). 학생 기기에서 같은 시드로 같은 문항이 만들어진다.
export function encode(obj) { return btoa(unescape(encodeURIComponent(JSON.stringify(obj)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
export function decode(str) {
  try { const b = str.replace(/-/g, '+').replace(/_/g, '/'); return JSON.parse(decodeURIComponent(escape(atob(b + '==='.slice((b.length + 3) % 4))))); } catch (e) { return null; }
}
