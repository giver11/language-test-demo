import * as D from '../data.js';
import * as S from '../store.js';
import { esc, shuffle, toast } from '../ui.js';
import { runSession } from './quiz.js';
import { multiWrite } from '../multiwrite.js';

export function gloss(w, dict, withEum = true) {
  return [...w].map((ch) => { const d = dict[ch]; const hl = D.heList(d); const h = hl[0] ? hl[0] : ['', d ? d.r : '']; return withEum ? `${ch}(${h[0]} ${h[1]})` : `${h[0]}`; }).join(' + ');
}

const MODES = [['h2m', '한자 → 뜻'], ['m2h', '뜻 → 한자'], ['r2h', '음 → 한자'], ['blank', '빈칸'], ['combine', '한자 조합'], ['write', '직접 쓰기']];

async function scopeWords(c) {
  if (!c.level.hasData) return [];
  const wm = await D.wordsMapping(c.pid);
  const m = await D.mapping(c.pid);
  const Li = m.order.get(c.lid);
  const words = await D.words();
  const cur = (wm.levels[c.lid] || []);
  const lower = Object.entries(wm.levels).filter(([l]) => m.order.get(l) < Li).flatMap(([, a]) => a);
  return { cur: cur.map((w) => words.get(w)).filter(Boolean), lower: lower.map((w) => words.get(w)).filter(Boolean), basis: wm.basis };
}

export default async function (view, { ctx: c, params }) {
  const dict = await D.dict();
  if (!c.level.hasData) {
    view.innerHTML = `<h1>한자어</h1><div class="notice bad">${esc(c.provider.name)} ${esc(c.level.name)}: 배정한자 공식 자료 확인 필요 — 급수별 한자어 범위를 계산할 수 없어요.</div><a class="btn" href="#/search">한자어 검색</a>`;
    return;
  }
  const sc = await scopeWords(c);
  const all = [...sc.cur, ...sc.lower];
  if (params.mode) return practice(view, c, sc, params.mode, dict, params);
  const tab = params.tab || 'cur';
  const shown = tab === 'fav' ? all.filter((w) => S.isFav('words', w.w)) : tab === 'lower' ? sc.lower : sc.cur;
  view.innerHTML = `
    <h1>한자어</h1>
    <p class="sub">${esc(c.provider.name)} ${esc(c.level.name)} 범위 한자어 · ${esc(sc.basis)}</p>
    <h3>문제로 익히기</h3>
    <div class="menu-grid">${MODES.map(([k, l]) => `<a href="#/words?mode=${k}"><b>${l}</b><span>${k === 'write' ? '칸에 직접 쓰기' : '10문제'}</span></a>`).join('')}</div>
    <div class="tabs" style="margin-top:16px">
      <button class="${tab === 'cur' ? 'on' : ''}" data-tab="cur" type="button">이번 급수 ${sc.cur.length}</button>
      <button class="${tab === 'lower' ? 'on' : ''}" data-tab="lower" type="button">하위 급수 ${sc.lower.length}</button>
      <button class="${tab === 'fav' ? 'on' : ''}" data-tab="fav" type="button">⭐</button></div>
    <div class="card">${shown.slice(0, 300).map((w) => `<div class="list-row"><span class="hz">${esc(w.w)}</span><div class="grow"><b>${esc(w.r)}</b><div class="small">${esc(gloss(w.w, dict))}</div></div>
      <button class="star ${S.isFav('words', w.w) ? 'on' : ''}" data-fav="${esc(w.w)}" type="button" aria-label="즐겨찾기">★</button></div>`).join('') || '<div class="empty">표시할 한자어가 없어요.</div>'}</div>
    <p class="tiny">독음: libhangul 한자 사전(BSD). 뜻은 구성 한자의 훈음 풀이이며 사전식 정의가 아닙니다. 빈도순 정렬.</p>`;
  view.querySelectorAll('[data-tab]').forEach((b) => (b.onclick = () => (location.hash = `#/words?tab=${b.dataset.tab}`)));
  view.querySelectorAll('[data-fav]').forEach((b) => (b.onclick = () => { const on = S.toggleFav('words', b.dataset.fav); b.classList.toggle('on', on); toast(on ? '즐겨찾기에 추가' : '즐겨찾기 해제'); }));
}

function pickRound(c, sc, n) {
  const pool = [...sc.cur, ...sc.lower];
  const weak = pool.filter((w) => c.p.words[w.w] && c.p.words[w.w].fail > c.p.words[w.w].ok);
  const fresh = sc.cur.filter((w) => !c.p.words[w.w]);
  return [...shuffle(weak), ...shuffle(fresh), ...shuffle(pool)].filter((x, i, a) => a.indexOf(x) === i).slice(0, n);
}

async function practice(view, c, sc, mode, dict, params) {
  const pool = [...sc.cur, ...sc.lower];
  if (pool.length < 4) { view.innerHTML = '<div class="empty">연습할 한자어가 부족해요.</div>'; return; }
  const label = (MODES.find((m) => m[0] === mode) || [0, ''])[1];
  if (mode === 'write') return writeMode(view, c, sc, dict, params);
  if (mode === 'combine') return combineMode(view, c, sc, dict);
  const round = pickRound(c, sc, 10);
  const scopeChars = await D.scopeChars(c.pid, c.lid);
  const qs = round.map((w) => {
    const same = shuffle(pool.filter((x) => x.w !== w.w && x.w.length === w.w.length));
    const base = { id: `word-${mode}-${w.w}`, provider: c.pid, level: c.lid, relatedHanja: [...w.w], sourceType: 'original', word: w.w };
    const mk = (question, prompt, ans, ds, type) => { const choices = shuffle([ans, ...ds.filter((d) => d !== ans).slice(0, 3)]); return { ...base, type, typeLabel: `한자어·${label}`, question, prompt, choices, answer: choices.indexOf(ans), explanation: `${w.w}(${w.r}) = ${gloss(w.w, dict)}` }; };
    if (mode === 'h2m') return mk('다음 한자어의 글자 풀이(뜻)로 알맞은 것은?', w.w, gloss(w.w, dict, false), same.map((x) => gloss(x.w, dict, false)), 'word-gloss');
    if (mode === 'm2h') return mk(`뜻 풀이 “${gloss(w.w, dict, false)}”에 알맞은 한자어는? (독음: ${w.r})`, '', w.w, same.map((x) => x.w), 'word-from-meaning');
    if (mode === 'r2h') {
      const near = same.filter((x) => [...x.w].filter((ch, k) => ch !== w.w[k]).length === 1);
      return mk(`'${w.r}'을(를) 한자로 바르게 쓴 것은?`, '', w.w, [...near, ...same].filter((x) => x.r !== w.r).map((x) => x.w), 'word-from-reading');
    }
    const pos = Math.floor(Math.random() * w.w.length);
    const ans = w.w[pos];
    const ds = shuffle(scopeChars.filter((ch) => ch !== ans && dict[ch] && dict[ch].r !== dict[ans].r)).slice(0, 3);
    return mk(`빈칸(□)에 들어갈 한자는? (독음: ${w.r})`, w.w.slice(0, pos) + '□' + w.w.slice(pos + 1), ans, ds, 'word-blank');
  });
  runSession(view, c, qs, {
    title: `한자어 ${label}`,
    onDone: () => {},
  });
  // 한자어별 성취 기록
  const origRecord = S.recordAnswer;
}

function combineMode(view, c, sc, dict) {
  const round = pickRound(c, sc, 8);
  const pool = [...sc.cur, ...sc.lower];
  let i = 0, correct = 0;
  const step = () => {
    if (i >= round.length) { view.innerHTML = `<h1>한자 조합 결과</h1><div class="card center"><div class="cmp-num">${correct} / ${round.length}</div></div><div class="btns fill" style="margin-top:12px"><a class="btn accent" href="#/words?mode=combine&r=${Date.now()}">다시</a><a class="btn" href="#/words">한자어</a></div>`; return; }
    const w = round[i];
    const extra = shuffle([...new Set(pool.flatMap((x) => [...x.w]))].filter((ch) => !w.w.includes(ch))).slice(0, 3);
    const tiles = shuffle([...[...w.w].map((ch) => ({ ch })), ...extra.map((ch) => ({ ch }))]);
    const picked = [];
    const draw = (done) => {
      view.innerHTML = `<div class="q-head"><span class="small">한자 조합 ${i + 1}/${round.length}</span></div>
        <div class="progress-top"><i style="width:${(i * 100) / round.length}%"></i></div>
        <div class="tag-label">한자어·한자 조합</div><div class="q-text">'${esc(w.r)}'에 맞게 한자를 순서대로 고르세요.</div>
        <p class="small">뜻 풀이: ${esc(gloss(w.w, dict, false))}</p>
        <div class="answer-line">${[...w.w].map((_, k) => `<span>${picked[k] ? esc(picked[k].ch) : ''}</span>`).join('')}</div>
        <div class="arrange">${tiles.map((t, k) => `<button data-k="${k}" class="${picked.includes(t) ? 'used' : ''}" type="button">${esc(t.ch)}</button>`).join('')}</div>
        <div class="btns fill"><button class="btn" data-undo type="button">되돌리기</button><button class="btn primary" data-next type="button" ${done ? '' : 'disabled'}>다음</button></div><div class="q-explain"></div>`;
      view.querySelectorAll('[data-k]').forEach((b) => (b.onclick = () => {
        const t = tiles[+b.dataset.k];
        if (done || picked.includes(t)) return;
        picked.push(t);
        if (picked.length === w.w.length) {
          const ans = picked.map((x) => x.ch).join('');
          const ok = ans === w.w;
          if (ok) correct++;
          recordWord(c, w, ok, 'word-combine', '한자어·한자 조합', dict);
          draw(true);
          view.querySelector('.q-explain').innerHTML = `<div class="explain"><h4>${ok ? '✅ 정답입니다' : '❌ 오답입니다'}</h4><div class="hanzi" style="font-size:30px">${esc(w.w)}</div><div>${esc(w.r)} — ${esc(gloss(w.w, dict))}</div></div>`;
          return;
        }
        draw(false);
      }));
      view.querySelector('[data-undo]').onclick = () => { if (!done) { picked.pop(); draw(false); } };
      view.querySelector('[data-next]').onclick = () => { i++; step(); };
    };
    draw(false);
  };
  step();
}

function recordWord(c, w, ok, type, label, dict) {
  const e = c.p.words[w.w] || { ok: 0, fail: 0 };
  if (ok) e.ok++; else e.fail++;
  e.t = Date.now();
  c.p.words[w.w] = e;
  S.recordAnswer(c.pid, { id: `${type}-${w.w}`, type, typeLabel: label, question: `'${w.r}'`, prompt: w.w, choices: [w.w], answer: 0, relatedHanja: [...w.w], word: w.w, explanation: `${w.w}(${w.r}) = ${gloss(w.w, dict)}`, sourceType: 'original' }, ok);
}

async function writeMode(view, c, sc, dict, params) {
  const words = await D.words();
  const round = params.w ? [words.get(params.w)].filter(Boolean) : pickRound(c, sc, 5);
  let i = 0, mw = null;
  const step = async () => {
    if (mw) { mw.destroy(); mw = null; }
    if (i >= round.length) { view.innerHTML = `<h1>한자어 쓰기 완료</h1><div class="btns fill"><a class="btn accent" href="#/words?mode=write&r=${Date.now()}">한 번 더</a><a class="btn" href="#/words">한자어</a></div>`; return; }
    const w = round[i];
    view.innerHTML = `<div class="q-head"><span class="small">한자어 직접 쓰기 ${i + 1}/${round.length}</span><button class="btn sm" data-skip type="button">다음 단어</button></div>
      <div class="card flat"><div class="tag-label">독음과 뜻을 보고 한자로 쓰세요</div><div style="font-size:24px;font-weight:800">${esc(w.r)}</div><div class="small">${esc(gloss(w.w, dict, false))}</div></div>
      <div class="mw" style="margin-top:12px"></div>`;
    view.querySelector('[data-skip]').onclick = () => { i++; step(); };
    mw = await multiWrite(view.querySelector('.mw'), [...w.w], {
      onDone: (results) => {
        results.forEach((r) => { if (r.pass != null) S.recordWriting(c.pid, r.c, r.verdict === 'good' ? 'good' : r.verdict === 'near' ? 'near' : 'retry'); });
        recordWord(c, w, results.every((r) => r.pass !== false), 'word-write', '한자어·직접 쓰기', dict);
      },
    });
  };
  await step();
  return () => mw && mw.destroy();
}
