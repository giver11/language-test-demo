// 선생님 모드 — 반·학생·과제·결과 관리 + 시험지(정답지 포함) 생성·인쇄.
// 모든 데이터는 이 기기의 localStorage('hanjaPass.teacher')에만 저장. 학생 실명 대신 번호·별명 사용을 권장.
import * as D from '../data.js';
import * as W from '../worksheet.js';
import { esc, toast } from '../ui.js';

const KEY = 'hanjaPass.teacher';
function load() { try { return JSON.parse(localStorage.getItem(KEY)) || { classes: [] }; } catch (e) { return { classes: [] }; } }
function save(t) { try { localStorage.setItem(KEY, JSON.stringify(t)); } catch (e) { toast('저장 공간이 부족해요'); } }
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 5);

export function printArea(html, mode) {
  let el = document.getElementById('printArea');
  if (!el) { el = document.createElement('div'); el.id = 'printArea'; document.body.appendChild(el); }
  el.innerHTML = html;
  document.body.classList.add('printing');
  const done = () => { document.body.classList.remove('printing'); window.removeEventListener('afterprint', done); };
  window.addEventListener('afterprint', done);
  setTimeout(() => { window.print(); setTimeout(done, 500); }, 50);
}

export default async function (view, { params }) {
  const T = load();
  const provs = await D.providers();
  const tab = params.tab || 'class';
  let cls = T.classes.find((x) => x.id === params.c) || T.classes[0] || null;
  const nav = (h) => (location.hash = h);
  const tabs = [['class', '반·학생'], ['sheet', '시험지 만들기'], ['assign', '과제·결과'], ['weak', '우리 반 취약한자']];
  const head = `<h1>선생님 모드</h1>
    <p class="sub">반·과제·결과는 이 기기에만 저장돼요 · 학생은 실명 대신 번호나 별명으로 등록하세요</p>
    <div class="tabs">${tabs.map(([k, l]) => `<button class="${k === tab ? 'on' : ''}" data-tab="${k}" type="button">${l}</button>`).join('')}</div>
    ${T.classes.length ? `<div class="row" style="margin:8px 0"><label class="small">반</label><select data-cls aria-label="반 선택">${T.classes.map((x) => `<option value="${x.id}" ${cls && x.id === cls.id ? 'selected' : ''}>${esc(x.name)} (${x.students.length}명)</option>`).join('')}</select></div>` : ''}`;
  const wire = () => {
    view.querySelectorAll('[data-tab]').forEach((b) => (b.onclick = () => nav(`#/teacher?tab=${b.dataset.tab}${cls ? '&c=' + cls.id : ''}`)));
    const sel = view.querySelector('[data-cls]'); if (sel) sel.onchange = () => nav(`#/teacher?tab=${tab}&c=${sel.value}`);
  };

  // ---------------- 반·학생
  if (tab === 'class') {
    view.innerHTML = head + `
      <div class="btns" style="margin:6px 0"><button class="btn sm" data-texp type="button">선생님 자료 내보내기</button><label class="btn sm">가져오기(다른 기기)<input type="file" accept="application/json,.json" data-timp hidden></label></div>
      <div class="card"><h3 class="mt0">새 반 만들기</h3><form class="row" data-newc onsubmit="return false"><input data-cname maxlength="20" placeholder="예: 3학년 2반 한자반" aria-label="반 이름" style="flex:1"><button class="btn primary" type="submit">추가</button></form></div>
      ${cls ? `<div class="card"><div class="spread"><h3 class="mt0" style="margin:0">${esc(cls.name)} 학생 (${cls.students.length})</h3><button class="btn sm" data-delc type="button">반 삭제</button></div>
        <form class="row" data-news onsubmit="return false" style="margin-top:8px"><input data-sname maxlength="12" placeholder="번호 또는 별명 (예: 7번)" aria-label="학생 번호 또는 별명" style="flex:1"><button class="btn primary" type="submit">학생 추가</button></form>
        <div class="table-wrap" style="margin-top:8px"><table><thead><tr><th>학생</th><th>제출 과제</th><th>평균</th><th></th></tr></thead><tbody>
        ${cls.students.map((s) => { const rs = Object.values(cls.results[s.id] || {}); const avg = rs.length ? Math.round(rs.reduce((a, r) => a + (r.s * 100) / r.t, 0) / rs.length) : null;
          return `<tr><td>${esc(s.nick)}</td><td>${rs.length} / ${cls.assigns.length}</td><td>${avg == null ? '-' : avg + '%'}</td><td><button class="btn sm" data-dels="${s.id}" type="button">삭제</button></td></tr>`; }).join('') || '<tr><td colspan="4" class="small">학생을 추가하세요</td></tr>'}
        </tbody></table></div></div>` : '<div class="empty">먼저 반을 만드세요.</div>'}`;
    wire();
    view.querySelector('[data-texp]').onclick = () => {
      const blob = new Blob([JSON.stringify({ kind: 'hanjaPass.teacher', v: 1, ...T })], { type: 'application/json' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `hanjapass-teacher-${new Date().toISOString().slice(0, 10)}.json`; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    };
    // 가져오기: 같은 반(id)은 학생·과제·결과를 합치고, 새 반은 추가 (기존 자료 삭제 없음)
    view.querySelector('[data-timp]').onchange = async (e) => {
      const f = e.target.files[0]; if (!f) return;
      let o; try { o = JSON.parse(await f.text()); } catch (er) { toast('JSON 파일이 아니에요'); return; }
      if (!o || o.kind !== 'hanjaPass.teacher' || !Array.isArray(o.classes)) { toast('선생님 자료 파일이 아니에요'); return; }
      let added = 0;
      for (const c of o.classes) {
        const cur = T.classes.find((x) => x.id === c.id);
        if (!cur) { T.classes.push(c); added++; continue; }
        for (const st of c.students || []) if (!cur.students.find((x) => x.id === st.id)) cur.students.push(st);
        for (const a of c.assigns || []) if (!cur.assigns.find((x) => x.id === a.id)) cur.assigns.push(a);
        for (const [sid, r] of Object.entries(c.results || {})) cur.results[sid] = { ...(r || {}), ...(cur.results[sid] || {}) };
      }
      save(T); toast(`가져왔어요 (새 반 ${added}개, 기존 반은 합침)`); nav(`#/teacher?tab=class&r=${uid()}`);
    };
    view.querySelector('[data-newc]').onsubmit = (ev) => { ev.preventDefault();
      const n = view.querySelector('[data-cname]').value.trim(); if (!n) return;
      const c = { id: uid(), name: n, students: [], assigns: [], results: {} }; T.classes.push(c); save(T); nav(`#/teacher?tab=class&c=${c.id}&r=${uid()}`);
    };
    if (cls) {
      view.querySelector('[data-news]').onsubmit = (ev) => { ev.preventDefault();
        const n = view.querySelector('[data-sname]').value.trim(); if (!n) return;
        cls.students.push({ id: uid(), nick: n }); save(T); nav(`#/teacher?tab=class&c=${cls.id}&r=${uid()}`);
      };
      view.querySelectorAll('[data-dels]').forEach((b) => (b.onclick = () => {
        if (b.dataset.armed !== '1') { b.dataset.armed = '1'; b.textContent = '한 번 더 누르면 삭제'; return; }
        cls.students = cls.students.filter((s) => s.id !== b.dataset.dels); delete cls.results[b.dataset.dels]; save(T); nav(`#/teacher?tab=class&c=${cls.id}&r=${uid()}`);
      }));
      const dc = view.querySelector('[data-delc]');
      dc.onclick = () => {
        if (dc.dataset.armed !== '1') { dc.dataset.armed = '1'; dc.textContent = '한 번 더 누르면 반 삭제'; return; }
        T.classes = T.classes.filter((x) => x !== cls); save(T); nav(`#/teacher?tab=class&r=${uid()}`);
      };
    }
    return;
  }

  // ---------------- 시험지 만들기 (+ 취약한자 시험은 범위=지정 한자)
  if (tab === 'sheet' || tab === 'weak') {
    let weakChars = [];
    if (tab === 'weak' && cls) {
      const cnt = {};
      for (const r of Object.values(cls.results || {})) for (const x of Object.values(r)) for (const ch of x.w || []) cnt[ch] = (cnt[ch] || 0) + 1;
      weakChars = Object.entries(cnt).sort((a, b) => b[1] - a[1]).slice(0, 40).map((x) => x[0]);
    }
    const last = (cls && cls.assigns[cls.assigns.length - 1]) || {};
    const f = { pid: params.p || last.pid || 'daehan', lid: params.l || last.lid || '', range: tab === 'weak' ? 'chars' : 'all', n: 20, diff: 'normal', types: ['hunum', 'hun-char', 'eum-char'], title: tab === 'weak' ? '우리 반 취약한자 시험' : '', chars: weakChars.join('') };
    const lv = (await D.levels(f.pid)).levels.filter((l) => l.hasData);
    if (!lv.find((l) => l.id === f.lid)) f.lid = lv[0].id;
    view.innerHTML = head + `
      ${tab === 'weak' ? (cls ? (weakChars.length ? `<div class="notice info">${esc(cls.name)} 학생들이 과제에서 틀린 한자 ${weakChars.length}자로 시험지를 만들어요.</div>` : `<div class="notice">아직 가져온 과제 결과가 없어요. 과제·결과 탭에서 학생 결과 코드를 입력하면 취약한자가 모여요. 아래에 한자를 직접 입력해도 돼요.</div>`) : '<div class="notice">먼저 반을 만드세요.</div>') : ''}
      <form class="card ws-form" data-form onsubmit="return false">
        <label>시험기관<select data-pid>${provs.map((p) => `<option value="${p.id}" ${p.id === f.pid ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select></label>
        <label>급수<select data-lid>${lv.map((l) => `<option value="${l.id}" ${l.id === f.lid ? 'selected' : ''}>${esc(l.name)}</option>`).join('')}</select></label>
        <label>범위<select data-range>${W.RANGES.map(([k, l]) => `<option value="${k}" ${k === f.range ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
        <label>지정 한자 <span class="tiny">(범위=지정한 한자만)</span><input data-chars value="${esc(f.chars)}" placeholder="예: 學校先生"></label>
        <label>문제 수<select data-n>${[10, 20, 30, 50].map((n) => `<option ${n === f.n ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
        <label>난이도<select data-diff>${W.LEVELS.map(([k, l]) => `<option value="${k}" ${k === f.diff ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
        <fieldset><legend class="small">문제 유형</legend>${W.TYPES.map(([k, l]) => `<label class="chk"><input type="checkbox" value="${k}" ${f.types.includes(k) ? 'checked' : ''}> ${l}</label>`).join('')}</fieldset>
        <label>제목<input data-title maxlength="30" value="${esc(f.title)}" placeholder="예: 5월 3주 한자 확인"></label>
        <button class="btn accent block" type="submit">시험지 만들기</button>
      </form>
      <div data-out></div>`;
    wire();
    const $ = (s) => view.querySelector(s);
    $('[data-pid]').onchange = () => nav(`#/teacher?tab=${tab}${cls ? '&c=' + cls.id : ''}&p=${$('[data-pid]').value}`);
    $('[data-form]').onsubmit = async (ev) => { ev.preventDefault();
      const spec = { pid: $('[data-pid]').value, lid: $('[data-lid]').value, range: $('[data-range]').value, chars: [...$('[data-chars]').value].filter((x) => /[㐀-鿿豈-﫿]/.test(x)),
        n: +$('[data-n]').value, diff: $('[data-diff]').value, types: [...view.querySelectorAll('fieldset input:checked')].map((x) => x.value), seed: uid(), title: $('[data-title]').value.trim() || '한자 확인 시험' };
      if (!spec.types.length) { toast('문제 유형을 하나 이상 고르세요'); return; }
      const qs = await W.build(spec);
      const P = provs.find((p) => p.id === spec.pid); const L = lv.find((l) => l.id === spec.lid) || (await D.level(spec.pid, spec.lid));
      const meta = { title: spec.title, provider: P.name, level: L.name };
      $('[data-out]').innerHTML = `<div class="card"><div class="spread"><h3 class="mt0" style="margin:0">미리보기 · ${qs.length}문항</h3></div>
        ${qs.length < spec.n ? `<div class="notice">범위 안에서 만들 수 있는 문항이 ${qs.length}개예요.</div>` : ''}
        <div class="btns fill"><button class="btn primary" data-print type="button">시험지 인쇄 / PDF</button><button class="btn" data-printa type="button">정답지 인쇄</button>${cls ? `<button class="btn" data-assign type="button">${esc(cls.name)} 과제로 내기</button>` : ''}</div>
        <div class="ws-preview">${W.sheetHtml(qs, meta)}</div><details><summary>정답지 보기</summary>${W.answerHtml(qs, meta)}</details></div>`;
      $('[data-print]').onclick = () => printArea(`<div class="ws">${W.sheetHtml(qs, meta)}</div>`);
      $('[data-printa]').onclick = () => printArea(`<div class="ws">${W.answerHtml(qs, meta)}</div>`);
      const as = $('[data-assign]');
      if (as) as.onclick = () => {
        if (spec.types.includes('write')) toast('쓰기 문항은 학생 기기에서 필기 판정으로 채점돼요');
        const a = { id: uid(), ...spec, level: L.name, provider: P.name, created: Date.now() };
        cls.assigns.push(a); save(T); nav(`#/teacher?tab=assign&c=${cls.id}&r=${uid()}`);
      };
    };
    return;
  }

  // ---------------- 과제·결과
  if (tab === 'assign') {
    if (!cls) { view.innerHTML = head + '<div class="empty">먼저 반을 만드세요.</div>'; wire(); return; }
    const base = location.href.split('#')[0];
    view.innerHTML = head + (cls.assigns.length ? cls.assigns.slice().reverse().map((a) => {
      const code = W.encode({ id: a.id, pid: a.pid, lid: a.lid, range: a.range, chars: a.chars, n: a.n, diff: a.diff, types: a.types, seed: a.seed, title: a.title });
      const done = cls.students.filter((s) => (cls.results[s.id] || {})[a.id]);
      return `<div class="card"><div class="spread"><h3 class="mt0" style="margin:0">${esc(a.title)}</h3><span class="small">${done.length} / ${cls.students.length} 제출</span></div>
        <div class="small">${esc(a.provider)} ${esc(a.level)} · ${a.n}문항 · ${new Date(a.created).toLocaleDateString('ko-KR')}</div>
        <div class="row" style="margin-top:6px"><input readonly value="${esc(base + '#/assign?c=' + code)}" aria-label="과제 링크" style="flex:1" data-link><button class="btn sm" data-copy type="button">링크 복사</button></div>
        <p class="tiny">학생이 이 링크로 풀면 “결과 코드”가 나와요. 받은 코드를 아래에 붙여 넣으세요.</p>
        <form class="row" data-res="${a.id}" onsubmit="return false"><select aria-label="학생">${cls.students.map((s) => `<option value="${s.id}">${esc(s.nick)}</option>`).join('')}</select><input placeholder="결과 코드" aria-label="결과 코드" style="flex:1"><button class="btn sm primary" type="submit">입력</button></form>
        <div class="table-wrap"><table><thead><tr><th>학생</th><th>점수</th><th>틀린 한자</th></tr></thead><tbody>${cls.students.map((s) => { const r = (cls.results[s.id] || {})[a.id];
          return `<tr><td>${esc(s.nick)}</td><td>${r ? `${r.s} / ${r.t}` : '<span class="small">미제출</span>'}</td><td class="hanzi">${r ? esc((r.w || []).join(' ')) : ''}</td></tr>`; }).join('')}</tbody></table></div></div>`;
    }).join('') : '<div class="empty">아직 과제가 없어요. “시험지 만들기”에서 과제로 낼 수 있어요.</div>');
    wire();
    view.querySelectorAll('[data-copy]').forEach((b) => (b.onclick = async () => { const i = b.parentElement.querySelector('[data-link]'); try { await navigator.clipboard.writeText(i.value); toast('링크를 복사했어요'); } catch (e) { i.select(); toast('링크를 길게 눌러 복사하세요'); } }));
    view.querySelectorAll('[data-res]').forEach((fm) => (fm.onsubmit = (ev) => { ev.preventDefault();
      const r = W.decode(fm.querySelector('input').value.trim());
      if (!r || r.a !== fm.dataset.res || typeof r.s !== 'number') { toast('이 과제의 결과 코드가 아니에요'); return; }
      const sid = fm.querySelector('select').value;
      (cls.results[sid] = cls.results[sid] || {})[r.a] = { s: r.s, t: r.t, w: (r.w || []).slice(0, 50), d: r.d };
      save(T); nav(`#/teacher?tab=assign&c=${cls.id}&r=${uid()}`);
    }));
  }
}
