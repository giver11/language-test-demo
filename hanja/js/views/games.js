// 한자 게임 5종 — 결과는 모두 실제 응답으로 mastery(S.touch)와 Daily Quest에 반영.
// 도박형 보상(랜덤 뽑기·확률형 아이템) 없음. 점수·최고기록만 저장.
import * as D from '../data.js';
import * as S from '../store.js';
import * as Q from '../qgen.js';
import { esc, shuffle, toast } from '../ui.js';
import { scopeIdioms } from './idioms.js';

const GAMES = [
  ['quick60', '⏱', '60초 퀴즈', '60초 동안 최대한 많이 맞히기'],
  ['memory', '🃏', '짝맞추기', '뒤집힌 카드에서 한자와 훈음 짝 찾기'],
  ['match', '🔗', '훈음 매칭', '한자와 훈음을 줄 잇듯 연결'],
  ['idiom', '成', '사자성어 완성', '빈칸에 들어갈 한자 고르기'],
  ['king', '👑', '오늘의 한자왕', '오늘 하루 같은 10문제 · 최고기록 도전'],
];

export default async function (view, { ctx: c, params }) {
  const dict = await D.dict();
  const scope = (await D.scopeChars(c.pid, c.lid)).filter((x) => dict[x] && D.heList(dict[x], c.pid).length && D.heList(dict[x], c.pid)[0][0]);
  const game = params.g;
  let timers = [];
  const clearAll = () => { timers.forEach(clearInterval); timers.forEach(clearTimeout); timers = []; };
  const G = S.get().games;
  const he = (ch) => D.heStr(dict[ch], c.pid);
  // 학습 우선순위: 복습 시기가 된 글자 → 학습 중 → 미학습
  const priority = () => {
    const now = Date.now();
    const m = c.p.mastery;
    return [...scope].sort((a, b) => ((m[a] ? (m[a].due <= now ? 0 : 1) : 2) - (m[b] ? (m[b].due <= now ? 0 : 1) : 2)) || Math.random() - 0.5);
  };
  const finish = (id, score, total, detail = '') => {
    clearAll();
    const g = S.recordGame(id, score, total);
    const name = GAMES.find((x) => x[0] === id)[2];
    view.innerHTML = `<h1>${esc(name)} 결과</h1>
      <div class="card center"><div class="cmp-num">${score}${total ? ' / ' + total : '점'}</div><div class="small">최고기록 ${g.best}${total ? '' : '점'} · ${g.n}번째 플레이</div></div>
      ${detail}
      <p class="tiny">맞힌 한자와 틀린 한자는 학습 기록(mastery·복습 일정)에 반영됐어요.</p>
      <div class="btns fill"><a class="btn accent" href="#/games?g=${id}&r=${Date.now() % 1e5}">다시 하기</a><a class="btn" href="#/games">게임 목록</a><a class="btn" href="#/share">공유 카드</a></div>`;
  };
  const hit = (ch, ok, rt) => { S.touch(c.pid, ch, ok, { src: 'game', rt, soft: true }); S.dayStat(ok); if (ok) S.markStudy('game', 1); };

  if (!game) {
    view.innerHTML = `<h1>한자 게임</h1><p class="sub">${esc(c.provider.name)} ${esc(c.level.name)} 배정한자로 플레이 · 결과는 학습 기록에 반영돼요</p>
      <div class="menu-grid">${GAMES.map(([id, i, n, d]) => `<a href="#/games?g=${id}"><i>${i}</i><b>${n}</b><span>${d}${G[id] ? ` · 최고 ${G[id].best}` : ''}</span></a>`).join('')}</div>
      <p class="tiny">문항은 공식 배정한자와 공식·공공 훈음 자료로 앱이 즉석에서 만든 자체 제작 문제예요.</p>`;
    return;
  }
  if (scope.length < 8) { view.innerHTML = '<h1>한자 게임</h1><div class="notice">이 급수는 게임을 만들 한자 자료가 부족해요.</div>'; return; }

  // ---------- 60초 퀴즈 · 오늘의 한자왕 (객관식)
  if (game === 'quick60' || game === 'king') {
    const king = game === 'king';
    const rnd = king ? Q.seeded(S.today() + c.pid + c.lid) : Math.random;
    const src = king ? shuffle([...scope].sort(), rnd).slice(0, 40) : priority().slice(0, 80);
    const list = [];
    const types = ['hunum', 'hun-char', 'eum-char'];
    const build = () => { for (const ch of src) { if (list.length >= (king ? 10 : 60)) break; const q = Q.charQ(types[list.length % 3], ch, scope, dict, c.pid); if (q) list.push(q); } };
    if (king) Q.withSeed(rnd, build); else build();
    let i = 0, score = 0, left = 60;
    const t0all = Date.now();
    const wrongs = [];
    const draw = () => {
      if (i >= list.length) return end();
      const q = list[i];
      const t0 = Date.now();
      view.innerHTML = `<div class="spread"><h1 style="margin:0">${king ? '오늘의 한자왕' : '60초 퀴즈'}</h1><b class="timer" aria-live="polite">${king ? `${i + 1}/10` : `⏱ ${left}초`}</b></div>
        <div class="small">점수 ${score}</div>
        <div class="card center"><div class="q-text">${esc(q.question)}</div>${q.prompt ? `<div class="hanzi" style="font-size:64px">${esc(q.prompt)}</div>` : ''}</div>
        <div class="choices">${q.choices.map((x, k) => `<button class="choice" data-k="${k}" type="button"><span class="n">${k + 1}</span><span class="t ${x.length === 1 ? 'hz' : ''}">${esc(x)}</span></button>`).join('')}</div>`;
      view.querySelectorAll('[data-k]').forEach((b) => (b.onclick = () => {
        const ok = +b.dataset.k === q.answer;
        b.classList.add(ok ? 'correct' : 'wrong');
        view.querySelectorAll('[data-k]')[q.answer].classList.add('correct');
        view.querySelectorAll('[data-k]').forEach((x) => (x.disabled = true));
        hit(q.relatedHanja[0], ok, Date.now() - t0);
        if (!ok) { wrongs.push(q); if (q.type !== 'hunum') S.recordConfusion(c.pid, q.choices[q.answer], q.choices[+b.dataset.k]); }
        if (ok) score++;
        i++;
        timers.push(setTimeout(draw, ok ? 250 : 900));
      }));
    };
    let ended = false;
    const end = () => {
      if (ended) return; ended = true;
      if (king) { const k = G.king || (G.king = { n: 0, best: 0, last: null }); const d = (k.days = k.days || {}); d[S.today()] = Math.max(d[S.today()] || 0, score); }
      const detail = wrongs.length ? `<h3>틀린 한자</h3><div class="card">${wrongs.map((q) => `<div class="list-row"><span class="hz">${esc(q.relatedHanja[0])}</span><div class="grow">${esc(he(q.relatedHanja[0]))}</div></div>`).join('')}</div>` : '';
      finish(game, score, king ? list.length : 0, (king ? '' : `<p class="center small">${Math.round((Date.now() - t0all) / 1000)}초 동안 ${i}문제 · 정답 ${score}</p>`) + detail);
    };
    if (!king) timers.push(setInterval(() => { left--; const t = view.querySelector('.timer'); if (t) t.textContent = `⏱ ${left}초`; if (left <= 0) end(); }, 1000));
    draw();
    return clearAll;
  }

  // ---------- 짝맞추기 (메모리)
  if (game === 'memory') {
    const chars = priority().slice(0, 6);
    const cards = shuffle(chars.flatMap((ch) => [{ ch, face: ch, hz: true }, { ch, face: he(ch), hz: false }]));
    let open = [], found = 0, tries = 0, lock = false;
    const miss = new Set();
    view.innerHTML = `<div class="spread"><h1 style="margin:0">짝맞추기</h1><span class="small" data-st>시도 0</span></div>
      <p class="sub">한자와 그 훈음 카드를 짝지으세요</p>
      <div class="mem-grid">${cards.map((x, k) => `<button class="mem" data-k="${k}" type="button" aria-label="카드 ${k + 1}"><span>${esc(x.face)}</span></button>`).join('')}</div>`;
    view.querySelectorAll('.mem').forEach((b) => (b.onclick = () => {
      const k = +b.dataset.k;
      if (lock || b.classList.contains('up') || b.classList.contains('done')) return;
      b.classList.add('up'); if (cards[k].hz) b.classList.add('hz');
      open.push(k);
      if (open.length < 2) return;
      tries++; view.querySelector('[data-st]').textContent = `시도 ${tries}`;
      const [a, z] = open; open = [];
      const btns = view.querySelectorAll('.mem');
      if (cards[a].ch === cards[z].ch && cards[a].hz !== cards[z].hz) {
        btns[a].classList.add('done'); btns[z].classList.add('done'); found++;
        hit(cards[a].ch, !miss.has(cards[a].ch));
        if (found === chars.length) timers.push(setTimeout(() => finish('memory', Math.max(0, 100 - (tries - chars.length) * 8), 0, `<p class="center small">${tries}번 시도로 ${chars.length}쌍 완성</p>`), 500));
      } else {
        // 서로 다른 한자를 짝으로 고른 경우만 '헷갈림'으로 기록(처음 보는 카드를 뒤집는 것은 기억 과정이므로 제외)
        if (cards[a].hz !== cards[z].hz) { miss.add(cards[a].ch); miss.add(cards[z].ch); }
        lock = true;
        timers.push(setTimeout(() => { btns[a].classList.remove('up', 'hz'); btns[z].classList.remove('up', 'hz'); lock = false; }, 800));
      }
    }));
    return clearAll;
  }

  // ---------- 훈음 매칭 (5쌍씩 3라운드)
  if (game === 'match') {
    const pool = priority();
    let round = 0, score = 0, mistakes = 0;
    const R = 3;
    const draw = () => {
      if (round >= R) return finish('match', score, R * 5, `<p class="center small">잘못 연결 ${mistakes}회</p>`);
      const set = pool.slice(round * 5, round * 5 + 5);
      const right = shuffle(set.map((ch) => ch));
      let sel = null; const bad = new Set(); let done = 0;
      view.innerHTML = `<div class="spread"><h1 style="margin:0">훈음 매칭</h1><span class="small">라운드 ${round + 1}/${R}</span></div>
        <p class="sub">왼쪽 한자를 누르고, 알맞은 훈음을 누르세요</p>
        <div class="match-cols"><div>${set.map((ch) => `<button class="choice mt-l" data-l="${esc(ch)}" type="button"><span class="t hz">${esc(ch)}</span></button>`).join('')}</div>
        <div>${right.map((ch) => `<button class="choice mt-r" data-r="${esc(ch)}" type="button"><span class="t">${esc(he(ch))}</span></button>`).join('')}</div></div>`;
      view.querySelectorAll('[data-l]').forEach((b) => (b.onclick = () => { if (b.disabled) return; view.querySelectorAll('[data-l]').forEach((x) => x.classList.remove('pick')); b.classList.add('pick'); sel = b.dataset.l; }));
      view.querySelectorAll('[data-r]').forEach((b) => (b.onclick = () => {
        if (!sel || b.disabled) { if (!sel) toast('먼저 왼쪽 한자를 고르세요'); return; }
        const L = view.querySelector(`[data-l="${CSS.escape(sel)}"]`);
        if (b.dataset.r === sel) {
          L.classList.add('correct'); b.classList.add('correct'); L.disabled = b.disabled = true;
          hit(sel, !bad.has(sel)); if (!bad.has(sel)) score++;
          sel = null; done++;
          if (done === set.length) { round++; timers.push(setTimeout(draw, 500)); }
        } else {
          mistakes++; bad.add(sel); S.recordConfusion(c.pid, sel, b.dataset.r);
          b.classList.add('wrong'); timers.push(setTimeout(() => b.classList.remove('wrong'), 500));
        }
      }));
    };
    draw();
    return clearAll;
  }

  // ---------- 사자성어 완성
  if (game === 'idiom') {
    const { list: ids } = await scopeIdioms(c);
    const pool = shuffle(ids.filter((it) => [...it.w].length === 4)).slice(0, 10);
    if (pool.length < 3) { view.innerHTML = '<h1>사자성어 완성</h1><div class="notice">이 급수 범위에 사자성어가 부족해요.</div>'; return; }
    const allChars = [...new Set(ids.flatMap((it) => [...it.w]))];
    let i = 0, score = 0;
    const wrongs = [];
    const draw = () => {
      if (i >= pool.length) return finish('idiom', score, pool.length, wrongs.length ? `<h3>다시 볼 사자성어</h3><div class="card">${wrongs.map((it) => `<div class="list-row"><span class="hz" style="min-width:100px">${esc(it.w)}</span><div class="grow"><b>${esc(it.r)}</b><div class="small">${esc(it.mean)}</div></div></div>`).join('')}</div>` : '');
      const it = pool[i];
      const w = [...it.w];
      const k = Math.floor(Math.random() * 4);
      const ans = w[k];
      const ds = shuffle(allChars.filter((x) => x !== ans && !w.includes(x))).slice(0, 3);
      const ch4 = shuffle([ans, ...ds]);
      view.innerHTML = `<div class="spread"><h1 style="margin:0">사자성어 완성</h1><span class="small">${i + 1}/${pool.length} · 점수 ${score}</span></div>
        <div class="card center"><div class="hanzi" style="font-size:48px;letter-spacing:6px">${w.map((x, j) => (j === k ? '□' : esc(x))).join('')}</div>
        <div class="small">${esc(it.r.split('').map((x, j) => (j === k ? '○' : x)).join(''))}</div><div style="margin-top:6px">${esc(it.mean)}</div></div>
        <div class="choices">${ch4.map((x, j) => `<button class="choice" data-k="${j}" type="button"><span class="n">${j + 1}</span><span class="t hz">${esc(x)}</span></button>`).join('')}</div>`;
      view.querySelectorAll('[data-k]').forEach((b) => (b.onclick = () => {
        const ok = ch4[+b.dataset.k] === ans;
        view.querySelectorAll('[data-k]').forEach((x) => (x.disabled = true));
        b.classList.add(ok ? 'correct' : 'wrong'); view.querySelectorAll('[data-k]')[ch4.indexOf(ans)].classList.add('correct');
        hit(ans, ok);
        const ie = c.p.idioms[it.id] || { ok: 0, fail: 0 }; if (ok) ie.ok++; else ie.fail++; ie.t = Date.now(); c.p.idioms[it.id] = ie;
        if (ok) score++; else wrongs.push(it);
        S.markStudy('idiom', ok ? 2 : 0);
        i++; timers.push(setTimeout(draw, ok ? 400 : 1200));
      }));
    };
    draw();
    return clearAll;
  }
  view.innerHTML = '<h1>한자 게임</h1><div class="empty">알 수 없는 게임이에요.</div><a class="btn" href="#/games">게임 목록</a>';
}
