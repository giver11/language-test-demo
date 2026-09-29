// SNS 콘텐츠 스튜디오 — 자체 제작 한자 카드 이미지(9:16 · 1:1 · 16:9)와 3초 퀴즈 영상(브라우저 녹화, 지원 기기만).
// 자동 게시 없음 · 개인정보 없음. 내용은 공식 배정한자 + 자체 작성 설명만 사용.
import * as D from '../data.js';
import * as Q from '../qgen.js';
import * as Card from '../card.js';
import { esc, shuffle, toast } from '../ui.js';

const KINDS = [
  ['hanja', '오늘의 한자'], ['idiom', '오늘의 사자성어'], ['quiz3', '3초 퀴즈'], ['confuse', '틀리기 쉬운 한자'],
  ['kids', '초등 퀴즈'], ['exam', '급수시험 문제'], ['radical', '부수 이야기'],
];

export default async function (view, { params }) {
  const dict = await D.dict();
  const provs = await D.providers();
  const idioms = [...(await D.idioms()).values()];
  const conf = await D.confusables();
  const exs = await D.examples();
  const stories = (await D.json('dictionary/radical_stories.json')).stories;
  const opt = { kind: params.k || 'hanja', format: '9:16', theme: 'ink', pid: params.p || 'daehan', lid: params.l || '' };
  const lv = (await D.levels(opt.pid)).levels.filter((l) => l.hasData);
  if (!lv.find((l) => l.id === opt.lid)) opt.lid = lv[Math.min(2, lv.length - 1)].id;
  const P = provs.find((p) => p.id === opt.pid);
  const scope = (await D.scopeChars(opt.pid, opt.lid)).filter((x) => dict[x] && D.heList(dict[x], opt.pid).length && D.heList(dict[x], opt.pid)[0][0]);
  const L = lv.find((l) => l.id === opt.lid);
  const he = (ch) => D.heStr(dict[ch], opt.pid);
  let spec = null, reveal = null;

  const make = () => {
    const k = opt.kind;
    reveal = null;
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    if (k === 'hanja') {
      const ch = pick(scope); const d = dict[ch];
      const w = (d.ex || []).find((x) => exs[x]);
      spec = { kicker: '오늘의 한자', big: ch, grid: true, lines: [{ text: he(ch), size: 64, bold: true, accent: true }, { text: `부수 ${d.rad || '-'} · 총 ${d.st || d.sc || '-'}획`, size: 40 }, ...(w ? [{ text: exs[w], size: 40 }] : (d.ex || []).length ? [{ text: '예: ' + d.ex.slice(0, 3).join(' · '), size: 40, serif: true }] : [])], footer: `${P.name} ${L.name} 배정한자 · 한자패스` };
    } else if (k === 'idiom') {
      const it = pick(idioms);
      spec = { kicker: '오늘의 사자성어', big: it.w, lines: [{ text: it.r, size: 60, bold: true, accent: true }, { text: it.mean, size: 42 }, ...(it.ex ? [{ text: '예) ' + it.ex, size: 36 }] : [])], footer: '뜻풀이·예문 자체 작성 · 한자패스' };
    } else if (k === 'quiz3' || k === 'kids' || k === 'exam') {
      let pool = scope;
      if (k === 'kids') { pool = scope.filter((x) => (dict[x].st || 99) <= 8); if (pool.length < 10) pool = scope; }
      const q = Q.charQ(pick(['hunum', 'hun-char', 'eum-char']), pick(pool), pool, dict, opt.pid);
      if (!q) return make();
      const kicker = k === 'quiz3' ? '3초 퀴즈' : k === 'kids' ? '초등 한자 퀴즈' : `${P.name} ${L.name} 예상문제`;
      const choices = q.choices.map((x, i) => ({ text: `${i + 1}. ${x}`, size: 50, serif: /[㐀-鿿]/.test(x) }));
      spec = { kicker, big: q.prompt || '?', title: q.question, lines: choices, footer: '자체 제작 연습문제 · 정답은 다음 장' };
      reveal = { kicker: kicker + ' 정답', big: q.prompt || q.choices[q.answer], lines: [{ text: `정답 ${q.answer + 1}번 · ${q.choices[q.answer]}`, size: 58, bold: true, accent: true }, { text: q.explanation, size: 40 }], footer: '자체 제작 연습문제 · 한자패스' };
    } else if (k === 'confuse') {
      const cand = scope.filter((x) => (conf[x] || []).some((y) => scope.includes(y)));
      const a = pick(cand.length ? cand : scope); const b = (conf[a] || []).find((y) => scope.includes(y));
      spec = { kicker: '틀리기 쉬운 한자', big: b ? a + ' ' + b : a, lines: [{ text: `${a} : ${he(a)}`, size: 54, bold: true, accent: true }, ...(b ? [{ text: `${b} : ${he(b)}`, size: 54, bold: true }] : []), { text: '모양이 닮았지만 뜻과 음이 달라요. 부수와 획을 비교해 보세요.', size: 38 }], footer: `${P.name} ${L.name} 범위 · 한자패스` };
    } else if (k === 'radical') {
      const s = pick(stories);
      spec = { kicker: '부수 이야기', big: s.v, grid: true, title: `${s.v} (${s.name})`, lines: [{ text: s.text, size: 40 }, { text: s.ex.map((c) => `${c} ${D.heStr(dict[c], opt.pid)}`).join(' · '), size: 42, serif: true, accent: true }], footer: '설명 자체 작성 · 한자패스' };
    }
    render(false);
  };
  const cv = document.createElement('canvas');
  const render = (showAns) => { Card.draw(cv, { ...(showAns && reveal ? reveal : spec), format: opt.format, theme: opt.theme }); view.querySelector('[data-ans]').style.display = reveal ? '' : 'none'; };

  view.innerHTML = `<h1>콘텐츠 스튜디오</h1>
    <p class="sub">SNS용 한자 카드를 만들어 이미지로 저장 · 자동 게시 없음 · 개인정보 없음</p>
    <div class="row wrap"><label class="small">기관 <select data-pid>${provs.map((p) => `<option value="${p.id}" ${p.id === opt.pid ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select></label>
      <label class="small">급수 <select data-lid>${lv.map((l) => `<option value="${l.id}" ${l.id === opt.lid ? 'selected' : ''}>${esc(l.name)}</option>`).join('')}</select></label></div>
    <div class="chips" data-k style="margin-top:8px">${KINDS.map(([k, l]) => `<button class="chip ${k === opt.kind ? 'sel' : ''}" data-v="${k}" type="button">${l}</button>`).join('')}</div>
    <div class="chips" data-f style="margin-top:6px">${Object.keys(Card.FORMATS).map((f) => `<button class="chip ${f === opt.format ? 'sel' : ''}" data-v="${f}" type="button">${f}</button>`).join('')}
      ${Object.keys(Card.THEMES).map((f) => `<button class="chip ${f === opt.theme ? 'sel' : ''}" data-th="${f}" type="button">${{ ink: '종이', night: '밤', mint: '민트' }[f]}</button>`).join('')}</div>
    <div class="card-preview" data-pv></div>
    <div class="btns fill"><button class="btn" data-new type="button">다른 내용</button><button class="btn" data-ans type="button">정답 장 보기</button><button class="btn accent" data-dl type="button">PNG 저장</button></div>
    <div class="btns fill" style="margin-top:6px"><button class="btn" data-dla type="button">정답 장 PNG</button><button class="btn" data-vid type="button">3초 퀴즈 영상 만들기</button></div>
    <p class="tiny">영상은 이 브라우저의 녹화 기능(MediaRecorder)을 지원하는 기기에서만 만들어져요. 문제·설명은 모두 앱에서 자체 제작한 내용이에요.</p>`;
  view.querySelector('[data-pv]').appendChild(cv);
  cv.setAttribute('aria-label', 'SNS 카드 미리보기');
  const reroute = () => (location.hash = `#/studio?k=${opt.kind}&p=${view.querySelector('[data-pid]').value}&l=${view.querySelector('[data-lid]').value}`);
  view.querySelector('[data-pid]').onchange = () => { view.querySelector('[data-lid]').value = ''; location.hash = `#/studio?k=${opt.kind}&p=${view.querySelector('[data-pid]').value}`; };
  view.querySelector('[data-lid]').onchange = reroute;
  view.querySelectorAll('[data-k] [data-v]').forEach((b) => (b.onclick = () => { opt.kind = b.dataset.v; view.querySelectorAll('[data-k] [data-v]').forEach((x) => x.classList.toggle('sel', x === b)); make(); }));
  view.querySelectorAll('[data-f] [data-v]').forEach((b) => (b.onclick = () => { opt.format = b.dataset.v; view.querySelectorAll('[data-f] [data-v]').forEach((x) => x.classList.toggle('sel', x === b)); render(false); }));
  view.querySelectorAll('[data-th]').forEach((b) => (b.onclick = () => { opt.theme = b.dataset.th; view.querySelectorAll('[data-th]').forEach((x) => x.classList.toggle('sel', x === b)); render(false); }));
  view.querySelector('[data-new]').onclick = make;
  let ansShown = false;
  view.querySelector('[data-ans]').onclick = () => { ansShown = !ansShown; render(ansShown); };
  view.querySelector('[data-dl]').onclick = () => { render(false); Card.download(cv, `hanja-${opt.kind}-${opt.format.replace(':', 'x')}.png`); };
  view.querySelector('[data-dla]').onclick = () => { if (!reveal) { toast('퀴즈 카드에서만 정답 장이 있어요'); return; } render(true); Card.download(cv, `hanja-${opt.kind}-answer.png`); render(false); };
  view.querySelector('[data-vid]').onclick = async () => {
    if (!reveal) { opt.kind = 'quiz3'; view.querySelectorAll('[data-k] [data-v]').forEach((x) => x.classList.toggle('sel', x.dataset.v === 'quiz3')); make(); }
    if (!window.MediaRecorder || !cv.captureStream) { toast('이 기기 브라우저는 영상 녹화를 지원하지 않아요. PNG 두 장으로 만들어 주세요'); return; }
    const type = ['video/mp4', 'video/webm;codecs=vp9', 'video/webm'].find((t) => MediaRecorder.isTypeSupported(t));
    if (!type) { toast('지원하는 영상 형식이 없어요'); return; }
    const btn = view.querySelector('[data-vid]'); btn.disabled = true; btn.textContent = '녹화 중… (약 7초)';
    const stream = cv.captureStream(30); const rec = new MediaRecorder(stream, { mimeType: type }); const chunks = [];
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    const q = spec;
    rec.onstop = () => {
      const blob = new Blob(chunks, { type }); const a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = `hanja-quiz3.${type.includes('mp4') ? 'mp4' : 'webm'}`; document.body.appendChild(a); a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
      btn.disabled = false; btn.textContent = '3초 퀴즈 영상 만들기'; render(false);
    };
    rec.start(200);
    const frame = (txt) => Card.draw(cv, { ...q, kicker: `3초 퀴즈 · ${txt}`, format: opt.format, theme: opt.theme });
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    for (const n of ['3', '2', '1']) { frame(n); for (let i = 0; i < 10; i++) { await sleep(100); frame(n); } }
    for (let i = 0; i < 30; i++) { Card.draw(cv, { ...reveal, format: opt.format, theme: opt.theme }); await sleep(100); }
    rec.stop();
  };
  if (!scope.length) { view.querySelector('[data-pv]').innerHTML = '<div class="notice">이 급수 자료가 부족해요.</div>'; return; }
  make();
}
