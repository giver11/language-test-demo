// 오늘의 한자 학습 (10분 학습) — 새 한자 → 복습 → 오답 → 사자성어 → 쓰기 순서로 진행
// 구성은 learn.buildToday() 가 사용자 기록으로 매일 새로 만든다(하루 동안은 같은 세트 유지).
import * as D from '../data.js';
import * as S from '../store.js';
import * as Q from '../qgen.js';
import * as L from '../learn.js';
import { esc, shuffle, toast, ddayText } from '../ui.js';
import { runSession } from './quiz.js';

const PHASES = [
  ['new', '새 한자', '자'],
  ['review', '복습', '자'],
  ['wrong', '오답', '문제'],
  ['idioms', '사자성어', '개'],
  ['write', '쓰기', '자'],
];

export default async function (view, { ctx: c, params }) {
  const td = await L.buildToday(c);
  if (!td) {
    view.innerHTML = `<h1>오늘의 한자 학습</h1><div class="notice bad">${esc(c.provider.name)} ${esc(c.level.name)}: 배정한자 공식 자료 확인 필요 — 오늘의 학습을 만들 수 없어요.</div><a class="btn" href="#/idioms">사자성어 학습</a>`;
    return;
  }
  const dict = await D.dict();
  const scope = await D.scopeChars(c.pid, c.lid);
  const cnt = (k) => td.set[k].length;
  const doneOf = () => L.todayDone(c, td);

  const overview = () => {
    const d = doneOf();
    const allDone = PHASES.every(([k]) => d[k] >= cnt(k));
    view.innerHTML = `<h1>오늘의 한자 학습</h1>
      <p class="sub">${esc(c.provider.name)} ${esc(c.level.name)}${td.dLeft != null && td.dLeft >= 0 ? ` · ${ddayText(td.dLeft)}` : ''} · ${esc(td.date)}</p>
      <div class="card"><ul class="phase-list">${PHASES.map(([k, label, unit]) => `<li class="${d[k] >= cnt(k) ? 'fin' : ''}"><span><b>${label}</b> ${cnt(k)}${unit}</span><span class="small">${Math.min(d[k], cnt(k))}/${cnt(k)}</span></li>`).join('')}</ul>
        <ul class="why">${td.why.map((w) => `<li>${esc(w)}</li>`).join('')}</ul></div>
      <a class="btn accent block" href="#/today?run=1&t=${Date.now() % 1e6}" style="margin-top:12px;min-height:56px">${allDone ? '한 번 더 복습하기' : d.new + d.review + d.wrong + d.idioms + d.write ? '이어서 학습하기' : '10분 학습 시작'}</a>
      <p class="tiny">새 한자·복습 한자는 실제 학습 기록(간격복습 일정·정답률·오답)으로 매일 새로 골라요. 시험일이 가까울수록 새 한자는 줄고 복습·오답이 늘어나요.</p>`;
  };
  if (!params.run) return overview();

  // ---------- 실행: 남은 단계를 순서대로
  if (!td.started) { td.started = Date.now(); S.save(); }
  const d0 = doneOf();
  const queue = PHASES.map((x) => x[0]).filter((k) => d0[k] < cnt(k) || params.again);
  let alive = true;
  const header = (k) => {
    const idx = PHASES.findIndex((x) => x[0] === k);
    return `<div class="q-head"><span class="small">오늘의 학습 · ${idx + 1}/${PHASES.length} ${PHASES[idx][1]}</span><a class="small" href="#/today">목록</a></div>`;
  };
  const next = () => { if (!alive) return; const k = queue.shift(); if (!k) return finish(); PH[k](); };

  const PH = {
    new() {
      const list = td.set.new.filter((ch) => !(c.p.mastery[ch] && c.p.mastery[ch].n && c.p.mastery[ch].last >= new Date(td.date + 'T00:00:00').getTime()));
      let i = 0;
      const draw = () => {
        if (!alive) return;
        if (i >= list.length) return next();
        const ch = list[i];
        view.innerHTML = `${header('new')}
          <div class="card newcard"><div class="tag-label">새 한자 ${i + 1}/${list.length}</div><div class="hanzi">${esc(ch)}</div>
          <div style="font-size:1.375rem;font-weight:800">${esc(D.heStr(dict[ch], c.pid))}</div>
          ${dict[ch] && dict[ch].st ? `<div class="small">총 ${dict[ch].st}획${dict[ch].rad ? ` · 부수 ${esc(dict[ch].rad)}` : ''}</div>` : ''}</div>
          <p class="center small">잘 알고 있는지 스스로 확인하고 고르세요</p>
          <div class="btns fill"><button class="btn ok" data-s="know" type="button">알아요</button><button class="btn warn" data-s="unsure" type="button">헷갈려요</button><button class="btn bad" data-s="dont" type="button">몰라요</button></div>`;
        view.querySelectorAll('[data-s]').forEach((b) => (b.onclick = () => { S.recordCard(c.pid, ch, b.dataset.s); i++; draw(); }));
      };
      draw();
    },
    review() {
      const start = new Date(td.date + 'T00:00:00').getTime();
      const left = td.set.review.filter((ch) => !(c.p.mastery[ch] && c.p.mastery[ch].last >= start));
      const types = ['hunum', 'hun-char', 'eum-char'];
      const qs = left.map((ch, k) => Q.charQ(types[k % 3], ch, scope, dict, c.pid) || Q.charQ('hunum', ch, scope, dict, c.pid)).filter(Boolean);
      if (!qs.length) return next();
      runSession(view, c, qs, { title: '오늘의 학습 · 복습', chain: () => { if (L.todayDone(c, td).review >= cnt('review')) S.award('review'); next(); } });
    },
    wrong() {
      const done = new Set(td.wrongDone || []);
      const items = td.set.wrong.filter((id) => !done.has(id) && c.p.wrong[id]).map((id) => c.p.wrong[id].q);
      if (!items.length) return next();
      runSession(view, c, items, { title: '오늘의 학습 · 오답', onAnswer: (q) => { td.wrongDone = [...new Set([...(td.wrongDone || []), q.id])]; S.save(); }, chain: next });
    },
    async idioms() {
      const all = [...(await D.idioms()).values()];
      const start = new Date(td.date + 'T00:00:00').getTime();
      const ids = td.set.idioms.filter((id) => !(c.p.idioms[id] && c.p.idioms[id].t >= start));
      const short = (m) => String(m).split('.')[0];
      const qs = ids.map((id) => all.find((x) => x.id === id)).filter(Boolean).map((it, k) => {
        const others = shuffle(all.filter((x) => x.id !== it.id));
        const base = { provider: c.pid, level: c.lid, idiom: it.id, relatedHanja: [...it.w], sourceType: 'original' };
        if (k % 2 === 0) {
          const ch = shuffle([short(it.mean), ...others.slice(0, 3).map((o) => short(o.mean))]);
          return { ...base, id: `idiom-i2m-${it.id}`, type: 'idiom-meaning', typeLabel: '사자성어·뜻 맞히기', question: '다음 사자성어의 뜻은?', prompt: it.w, choices: ch, answer: ch.indexOf(short(it.mean)), explanation: `${it.w}(${it.r}): ${it.mean}` };
        }
        const pos = Math.floor(Math.random() * 4); const ans = [...it.w][pos];
        const ds = shuffle([...new Set(others.flatMap((o) => [...o.w]))].filter((x) => x !== ans)).slice(0, 3);
        const ch = shuffle([ans, ...ds]);
        return { ...base, id: `idiom-blank-${it.id}`, type: 'idiom-blank', typeLabel: '사자성어·빈칸 한자', question: `빈칸(□)에 들어갈 한자는? (독음: ${it.r})`, prompt: [...it.w].map((x, j) => (j === pos ? '□' : x)).join(''), choices: ch, answer: ch.indexOf(ans), explanation: `${it.w}(${it.r}): ${it.mean}` };
      });
      if (!qs.length) return next();
      runSession(view, c, qs, { title: '오늘의 학습 · 사자성어', chain: next });
    },
    write() {
      const start = new Date(td.date + 'T00:00:00').getTime();
      const left = td.set.write.filter((ch) => !(c.p.writing[ch] && c.p.writing[ch].t >= start));
      if (!left.length) return next();
      view.innerHTML = `${header('write')}<div class="card center"><div class="hanzi" style="font-size:44px;letter-spacing:8px">${left.map(esc).join('')}</div>
        <p>마지막 단계예요. 이 ${left.length}자를 손으로 써 보세요. 다 쓰면 자동으로 오늘의 학습으로 돌아와요.</p></div>
        <a class="btn accent block" href="#/write?c=${encodeURIComponent(left.join(','))}&from=today" style="min-height:56px">쓰기 시작</a>
        <button class="btn block" data-skip type="button" style="margin-top:8px">쓰기는 나중에 하고 마치기</button>`;
      view.querySelector('[data-skip]').onclick = finish;
    },
  };

  function finish() {
    if (!alive) return;
    const d = doneOf();
    const allDone = PHASES.every(([k]) => d[k] >= cnt(k));
    const got = [];
    if (!td.finished) { td.finished = Date.now(); }
    if (S.award('study')) got.push('오늘 학습 완료 +10 XP');
    if (d.review >= cnt('review') && cnt('review') && S.award('review')) got.push('복습 완료 +5 XP');
    if (d.write >= cnt('write') && cnt('write') && S.award('write')) got.push('쓰기 완료 +5 XP');
    if (allDone && S.award('goal')) got.push('오늘의 목표 완료 +20 XP');
    S.save(true);
    const mins = td.started ? Math.max(1, Math.round((Date.now() - td.started) / 60000)) : null;
    view.innerHTML = `<h1>오늘의 학습 ${allDone ? '완료' : '마침'}</h1>
      <div class="card"><ul class="phase-list">${PHASES.map(([k, label, unit]) => `<li class="${d[k] >= cnt(k) ? 'fin' : ''}"><span><b>${label}</b> ${cnt(k)}${unit}</span><span class="small">${Math.min(d[k], cnt(k))}/${cnt(k)}</span></li>`).join('')}</ul>
      ${mins ? `<p class="small">시작부터 ${mins}분</p>` : ''}</div>
      ${got.length ? `<div class="notice info" role="status">${got.map(esc).join('<br>')}</div>` : ''}
      <p class="small">연속 학습 ${S.streak().current}일 · 총 XP ${S.get().xp}</p>
      <div class="btns fill"><a class="btn accent" href="#/weak">나의 약점 보기</a><a class="btn" href="#/home">홈</a></div>`;
  }

  next();
  return () => { alive = false; };
}
