import * as D from '../data.js';
import * as S from '../store.js';
import { esc, openSheet, shuffle, toast } from '../ui.js';
import { runSession } from './quiz.js';
import { multiWrite } from '../multiwrite.js';

export async function idiomLevels(it) {
  const provs = await D.providers();
  const out = [];
  for (const p of provs) {
    const m = await D.mapping(p.id);
    if (!m.items.length) { out.push([p, null, '공식 자료 확인 필요']); continue; }
    let best = -1, name = null;
    for (const ch of it.w) {
      const x = m.byChar.get(ch);
      if (!x) { best = null; break; }
      const o = m.order.get(x.l);
      if (o > best) { best = o; name = m.levels.find((l) => l.id === x.l).name; }
    }
    out.push([p, best == null ? null : name, best == null ? '배정한자 밖 글자 포함' : `구성 한자 기준 ${name}`]);
  }
  return out;
}

async function scopeIdioms(c) {
  const all = [...(await D.idioms()).values()];
  if (!c.level.hasData) return { list: all, note: `${c.provider.name} 사자성어 출제범위: 공식 자료 확인 필요 — 전체 사자성어를 보여줘요.` };
  const im = await D.idiomsMapping(c.pid);
  const m = await D.mapping(c.pid);
  const Li = m.order.get(c.lid);
  const ids = new Set();
  for (const [l, arr] of Object.entries(im.levels)) if (m.order.get(l) <= Li) arr.forEach((x) => ids.add(x));
  return { list: all.filter((x) => ids.has(x.id)), all, note: `${c.provider.name} ${c.level.name} 배정한자로만 이루어진 사자성어 (구성 한자 기준 산출 — 기관의 공식 출제 목록 아님)` };
}

export async function openIdiom(it) {
  const dict = await D.dict();
  const lv = await idiomLevels(it);
  const fav = S.isFav('idioms', it.id);
  openSheet(`
    <div class="spread"><span class="tag-label">사자성어</span><div><button class="star ${fav ? 'on' : ''}" data-fav type="button" aria-label="즐겨찾기">★</button><button class="btn sm" data-close type="button">닫기</button></div></div>
    <div class="idiom-big">${esc(it.w)}</div>
    <div class="center" style="font-size:20px;font-weight:800">${esc(it.r)}</div>
    <p style="font-size:16px">${esc(it.mean)}</p>
    <div class="idiom-chars">${it.chars.map(([ch, h, e]) => `<div><b>${esc(ch)}</b><span class="small">${esc(h)} ${esc(e)}</span></div>`).join('')}</div>
    <h3>사용 예</h3><p class="card flat">${esc(it.ex)}</p>
    <h3>관련 한자</h3><div class="row">${[...new Set(it.w)].map((ch) => `<span class="badge">${esc(ch)} ${esc(D.heStr(dict[ch]))}</span>`).join(' ')}</div>
    <h3>관련 시험급수</h3>
    <div class="table-wrap"><table><tbody>${lv.map(([p, name, note]) => `<tr><td>${esc(p.name)}</td><td>${name ? esc(name) : '-'}</td><td class="small">${esc(note)}</td></tr>`).join('')}</tbody></table></div>
    <p class="tiny">급수는 성어를 이루는 한자의 기관별 배정 급수로 계산한 값이며, 기관의 공식 사자성어 출제범위 목록이 아닙니다. 뜻풀이·예문은 이 앱에서 직접 작성했습니다.</p>`, (panel) => {
    panel.querySelector('[data-fav]').onclick = (e) => { const on = S.toggleFav('idioms', it.id); e.currentTarget.classList.toggle('on', on); toast(on ? '즐겨찾기에 추가' : '즐겨찾기 해제'); };
  });
}

const MODES = [
  ['i2m', '성어 → 뜻'], ['m2i', '뜻 → 성어'], ['blank', '빈칸'], ['arrange', '글자 배열'], ['reading', '독음 맞히기'], ['write', '직접 쓰기'],
];

export default async function (view, { ctx: c, params }) {
  const { list, note } = await scopeIdioms(c);
  const mode = params.mode || '';
  if (mode) return practice(view, c, list, mode, params);
  const tab = params.tab || 'list';
  const favs = list.filter((x) => S.isFav('idioms', x.id));
  const shown = tab === 'fav' ? favs : list;
  view.innerHTML = `
    <h1>사자성어</h1>
    <p class="sub">${esc(note)}</p>
    <h3>문제로 익히기</h3>
    <div class="menu-grid">${MODES.map(([k, l]) => `<a href="#/idioms?mode=${k}"><b>${l}</b><span>${k === 'write' ? '네 칸에 직접 쓰기' : '10문제'}</span></a>`).join('')}</div>
    <div class="tabs" style="margin-top:16px"><button class="${tab === 'list' ? 'on' : ''}" data-tab="list" type="button">목록 ${list.length}</button><button class="${tab === 'fav' ? 'on' : ''}" data-tab="fav" type="button">⭐ ${favs.length}</button></div>
    <div class="card">${shown.map((it) => {
      const st = c.p.idioms[it.id];
      return `<div class="list-row" data-id="${it.id}" style="cursor:pointer"><span class="hz" style="min-width:110px">${esc(it.w)}</span><div class="grow"><b>${esc(it.r)}</b><div class="small">${esc(it.mean)}</div></div>
      ${st ? `<span class="badge ${st.ok > st.fail ? 'official' : 'missing'}">${st.ok}/${st.ok + st.fail}</span>` : ''}</div>`;
    }).join('') || '<div class="empty">표시할 사자성어가 없어요.</div>'}</div>`;
  view.querySelectorAll('[data-tab]').forEach((b) => (b.onclick = () => (location.hash = `#/idioms?tab=${b.dataset.tab}`)));
  view.querySelectorAll('[data-id]').forEach((r) => (r.onclick = async () => openIdiom((await D.idioms()).get(r.dataset.id))));
}

function pickRound(c, list, n = 10) {
  // 틀린 적 있는 성어 우선 + 새 성어
  const weak = list.filter((x) => c.p.idioms[x.id] && c.p.idioms[x.id].fail > c.p.idioms[x.id].ok);
  const fresh = list.filter((x) => !c.p.idioms[x.id]);
  return [...shuffle(weak), ...shuffle(fresh), ...shuffle(list)].filter((x, i, a) => a.indexOf(x) === i).slice(0, n);
}

async function practice(view, c, list, mode, params) {
  const all = [...(await D.idioms()).values()];
  const dict = await D.dict();
  if (!list.length) { view.innerHTML = '<div class="empty">연습할 사자성어가 없어요.</div>'; return; }
  const label = (MODES.find((m) => m[0] === mode) || [0, ''])[1];
  if (mode === 'write') return writeMode(view, c, list, params);
  if (mode === 'arrange') return arrangeMode(view, c, list);
  const round = params.id ? [all.find((x) => x.id === params.id)] : pickRound(c, list);
  const qs = round.map((it) => {
    const others = shuffle(all.filter((x) => x.id !== it.id));
    const base = { id: `idiom-${mode}-${it.id}`, provider: c.pid, level: c.lid, idiom: it.id, relatedHanja: [...it.w], sourceType: 'original-practice' };
    const mk = (question, prompt, ans, ds, type) => {
      const choices = shuffle([ans, ...ds.slice(0, 3)]);
      return { ...base, type, typeLabel: `사자성어·${label}`, question, prompt, choices, answer: choices.indexOf(ans), explanation: `${it.w}(${it.r}): ${it.mean}` };
    };
    const short = (m) => m.split('.')[0];
    if (mode === 'i2m') return mk('다음 사자성어의 뜻은?', it.w, short(it.mean), others.map((o) => short(o.mean)), 'idiom-meaning');
    if (mode === 'm2i') return mk(`뜻: “${short(it.mean)}”에 알맞은 사자성어는?`, '', it.w, others.map((o) => o.w), 'idiom-from-meaning');
    if (mode === 'reading') return mk('다음 사자성어의 독음(읽는 소리)은?', it.w, it.r, others.map((o) => o.r), 'idiom-reading');
    // blank
    const pos = Math.floor(Math.random() * 4);
    const ans = it.w[pos];
    const pool = shuffle(Object.keys(dict).filter((k) => k !== ans && dict[k].src === 'eomunhoe-xls')).slice(0, 30);
    const sameLv = shuffle([...new Set(others.flatMap((o) => [...o.w]))].filter((k) => k !== ans));
    return mk(`빈칸(□)에 들어갈 한자는? (독음: ${it.r})`, it.w.slice(0, pos) + '□' + it.w.slice(pos + 1), ans, [...sameLv, ...pool], 'idiom-blank');
  });
  runSession(view, c, qs, { title: `사자성어 ${label}` });
}

function arrangeMode(view, c, list) {
  const round = pickRound(c, list, 8);
  let i = 0, correct = 0;
  const step = () => {
    if (i >= round.length) {
      view.innerHTML = `<h1>글자 배열 결과</h1><div class="card center"><div class="cmp-num">${correct} / ${round.length}</div></div><div class="btns fill" style="margin-top:12px"><a class="btn accent" href="#/idioms?mode=arrange&r=${Date.now()}">다시</a><a class="btn" href="#/idioms">사자성어</a></div>`;
      return;
    }
    const it = round[i];
    const tiles = shuffle([...it.w].map((ch, k) => ({ ch, k })));
    const picked = [];
    const draw = (done) => {
      view.innerHTML = `<div class="q-head"><span class="small">글자 배열 ${i + 1}/${round.length}</span></div>
        <div class="progress-top"><i style="width:${(i * 100) / round.length}%"></i></div>
        <div class="tag-label">사자성어·글자 배열</div><div class="q-text">뜻을 보고 글자를 순서대로 누르세요.</div>
        <p class="card flat" style="font-size:16px">${esc(it.mean)}<br><span class="small">독음: ${esc(it.r)}</span></p>
        <div class="answer-line">${[0, 1, 2, 3].map((k) => `<span>${picked[k] ? esc(picked[k].ch) : ''}</span>`).join('')}</div>
        <div class="arrange">${tiles.map((t, k) => `<button data-k="${k}" class="${picked.includes(t) ? 'used' : ''}" type="button">${esc(t.ch)}</button>`).join('')}</div>
        <div class="btns fill"><button class="btn" data-undo type="button">되돌리기</button><button class="btn primary" data-next type="button" ${done ? '' : 'disabled'}>다음</button></div>
        <div class="q-explain"></div>`;
      view.querySelectorAll('[data-k]').forEach((b) => (b.onclick = () => {
        const t = tiles[+b.dataset.k];
        if (done || picked.includes(t)) return;
        picked.push(t);
        if (picked.length === 4) {
          const ans = picked.map((x) => x.ch).join('');
          const ok = ans === it.w;
          if (ok) correct++;
          S.recordAnswer(c.pid, { id: `idiom-arrange-${it.id}`, type: 'idiom-arrange', typeLabel: '사자성어·글자 배열', question: '글자 배열', prompt: it.w, choices: [it.w], answer: 0, relatedHanja: [...it.w], idiom: it.id, explanation: `${it.w}(${it.r}): ${it.mean}`, sourceType: 'original-practice' }, ok);
          draw(true);
          view.querySelector('.q-explain').innerHTML = `<div class="explain"><h4>${ok ? '✅ 정답입니다' : '❌ 오답입니다'}</h4><div class="hanzi" style="font-size:30px">${esc(it.w)}</div><div>${esc(it.r)} — ${esc(it.mean)}</div>${ok ? '' : `<div class="small">내가 배열: ${esc(ans)}</div>`}</div>`;
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

async function writeMode(view, c, list, params) {
  const all = await D.idioms();
  const round = params.id ? [all.get(params.id)] : pickRound(c, list, 5);
  let i = 0, mw = null;
  const step = async () => {
    if (mw) { mw.destroy(); mw = null; }
    if (i >= round.length) { view.innerHTML = `<h1>사자성어 쓰기 완료</h1><div class="btns fill"><a class="btn accent" href="#/idioms?mode=write&r=${Date.now()}">한 번 더</a><a class="btn" href="#/idioms">사자성어</a></div>`; return; }
    const it = round[i];
    view.innerHTML = `<div class="q-head"><span class="small">사자성어 직접 쓰기 ${i + 1}/${round.length}</span><button class="btn sm" data-skip type="button">다음 성어</button></div>
      <div class="card flat"><div class="tag-label">뜻을 보고 네 글자를 쓰세요</div><div style="font-size:17px;font-weight:700;margin-top:4px">${esc(it.mean)}</div><div class="small">독음: ${esc(it.r)}</div></div>
      <div class="mw" style="margin-top:12px"></div>`;
    view.querySelector('[data-skip]').onclick = () => { i++; step(); };
    mw = await multiWrite(view.querySelector('.mw'), [...it.w], {
      onDone: (results) => {
        const pass = results.every((r) => r.pass !== false);
        results.forEach((r) => { if (r.pass != null) S.recordWriting(c.pid, r.c, r.verdict === 'good' ? 'good' : r.verdict === 'near' ? 'near' : 'retry'); });
        S.recordAnswer(c.pid, { id: `idiom-write-${it.id}`, type: 'idiom-write', typeLabel: '사자성어·직접 쓰기', question: `뜻: ${it.mean}`, prompt: '', choices: [], answer: it.w, relatedHanja: results.filter((r) => r.pass === false).map((r) => r.c), idiom: it.id, explanation: `${it.w}(${it.r}): ${it.mean}`, sourceType: 'original-practice' }, pass);
      },
    });
  };
  await step();
  return () => mw && mw.destroy();
}
