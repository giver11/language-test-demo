// 부모 모드 — 자녀 프로필별 실제 학습 기록으로 주간 리포트를 만든다.
// 이 기기 안에서만 계산·표시하며 자동 전송·자동 게시하지 않는다. 자녀 정보는 별명만 저장.
import * as D from '../data.js';
import * as S from '../store.js';
import { esc, daysUntil, toast } from '../ui.js';
import { printArea } from './teacher.js';

const DAY = 86400000;
function weekDays(n = 7) { const out = []; const d = new Date(); for (let i = 0; i < n; i++) { out.push(S.ymd(d)); d.setDate(d.getDate() - 1); } return out; }

export async function report(st) {
  const cur = st.current && st.current.provider;
  const days = weekDays();
  const since = Date.now() - 7 * DAY;
  const r = { studySec: S.weekSeconds(st), studyDays: days.filter((d) => (st.days || []).includes(d)).length, streak: S.streak(st).current };
  let a = 0, c = 0;
  for (const d of days) { const x = (st.dstat || {})[d]; if (x) { a += x.a; c += x.c; } }
  r.quizA = a; r.quizC = c;
  r.byProv = [];
  for (const [pid, p] of Object.entries(st.byProvider || {})) {
    if (!p.level) continue;
    const P = await D.provider(pid); const L = P && (await D.level(pid, p.level));
    if (!P || !L) continue;
    const scope = L.hasData ? await D.scopeChars(pid, p.level) : [];
    const now = Date.now();
    let studied = 0, mastered = 0, due = 0, weekNew = 0;
    for (const ch of scope) {
      const e = (p.mastery || {})[ch]; if (!e || !e.n) continue;
      studied++;
      if (S.masteryValue(e, now) >= 80) mastered++;
      if (e.due <= now) due++;
    }
    for (const e of Object.values(p.mastery || {})) if (e.n && e.last >= since && e.n <= 3) weekNew++;
    let w = 0, wok = 0;
    for (const x of Object.values(p.writing || {})) if (x.t >= since) { w += x.ok + x.near + x.fail; wok += x.ok + x.near; }
    const mocks = (p.mocks || []).filter((m) => !m.mini).slice(-5).map((m) => ({ d: new Date(m.t).toLocaleDateString('ko-KR'), pct: m.fullScore ? Math.round((m.score * 100) / m.fullScore) : m.pct, pass: m.pass, level: m.level }));
    r.byProv.push({ pid, name: P.name, level: L.name, target: scope.length, studied, mastered, due, weekNew, writeN: w, writeAcc: w ? Math.round((wok * 100) / w) : null, mocks, dday: daysUntil(p.examDate), current: pid === cur });
  }
  r.byProv.sort((x, y) => y.current - x.current);
  return r;
}

export function reportText(nick, r) {
  const m = Math.round(r.studySec / 60);
  const lines = [`[한자패스 주간 리포트] ${nick} · ${new Date().toLocaleDateString('ko-KR')}`,
    `· 이번 주 학습 ${m}분 (${r.studyDays}일) · 연속 ${r.streak}일`,
    `· 문제 ${r.quizA}개 풀이, 정답률 ${r.quizA ? Math.round((r.quizC * 100) / r.quizA) + '%' : '기록 없음'}`];
  for (const p of r.byProv) {
    lines.push(`· ${p.name} ${p.level}: 목표 ${p.target}자 중 학습 ${p.studied}자 · 숙련 ${p.mastered}자 · 복습 필요 ${p.due}자${p.dday != null && p.dday >= 0 ? ` · D-${p.dday}` : ''}`);
    if (p.writeAcc != null) lines.push(`  쓰기 ${p.writeN}회, 정확도 ${p.writeAcc}%`);
    if (p.mocks.length) lines.push(`  최근 모의시험 ${p.mocks.map((x) => x.pct + '%').join(' → ')}`);
  }
  const tip = r.byProv[0] && r.byProv[0].due > 20 ? '복습할 한자가 쌓였어요. 이번 주는 새 한자보다 복습을 먼저 해 주세요.' : r.studyDays < 3 ? '주 3일 이상, 짧게라도 꾸준히 하는 것이 좋아요.' : '좋은 흐름이에요. 지금 속도를 유지해 주세요.';
  lines.push(`· 다음 주 제안: ${tip}`);
  return lines.join('\n');
}

export default async function (view, { params }) {
  const st0 = S.get();
  const pin = st0.parent && st0.parent.pin;
  if (pin && !sessionStorage.getItem('hanja.parentOk')) {
    view.innerHTML = `<h1>부모 모드</h1><form class="card" data-pin onsubmit="return false"><label>보호자 PIN<input type="password" inputmode="numeric" maxlength="6" autocomplete="off" data-v aria-label="보호자 PIN"></label><button class="btn primary block" type="submit" style="margin-top:8px">열기</button></form>`;
    view.querySelector('[data-pin]').onsubmit = (ev) => { ev.preventDefault(); if (view.querySelector('[data-v]').value === pin) { try { sessionStorage.setItem('hanja.parentOk', '1'); } catch (e) {} location.reload(); } else toast('PIN이 맞지 않아요'); };
    return;
  }
  const profs = S.profiles();
  const pid = params.id || S.activeProfileId();
  const prof = profs.find((p) => p.id === pid) || profs[0];
  const st = S.readProfile(prof.id);
  const r = await report(st);
  const txt = reportText(prof.nick, r);
  const min = Math.round(r.studySec / 60);
  view.innerHTML = `<h1>부모 모드</h1>
    <p class="sub">이 기기에 저장된 실제 학습 기록으로 계산 · 자동 전송하지 않아요</p>
    <div class="chips">${profs.map((p) => `<a class="chip ${p.id === prof.id ? 'sel' : ''}" href="#/parent?id=${p.id}">${esc(p.nick)}${p.id === S.activeProfileId() ? ' (사용 중)' : ''}</a>`).join('')}</div>
    <div class="coach-grid" style="margin:12px 0">
      <div><b>${min}분</b><span class="small">이번 주 학습</span></div><div><b>${r.studyDays}일</b><span class="small">학습한 날</span></div>
      <div><b>${r.streak}일</b><span class="small">연속</span></div><div><b>${r.quizA ? Math.round((r.quizC * 100) / r.quizA) + '%' : '-'}</b><span class="small">문제 정답률 (${r.quizA})</span></div>
    </div>
    ${r.byProv.map((p) => `<div class="card"><div class="spread"><h3 class="mt0" style="margin:0">${esc(p.name)} ${esc(p.level)}</h3><span class="badge accent">${p.dday != null && p.dday >= 0 ? 'D-' + p.dday : '시험일 미정'}</span></div>
      <div class="coach-grid" style="margin-top:8px"><div><b>${p.studied}</b><span class="small">학습한 한자 / ${p.target}</span></div><div><b>${p.mastered}</b><span class="small">숙련</span></div><div><b>${p.due}</b><span class="small">복습 필요</span></div><div><b>${p.writeAcc == null ? '-' : p.writeAcc + '%'}</b><span class="small">쓰기 정확도 (${p.writeN}회)</span></div></div>
      ${p.mocks.length ? `<div class="small" style="margin-top:6px">최근 모의시험: ${p.mocks.map((m) => `${m.d} ${m.pct}%${m.pass ? '(합격선 이상)' : ''}`).join(' · ')}</div>` : '<div class="small" style="margin-top:6px">모의시험 기록 없음</div>'}</div>`).join('') || '<div class="empty">아직 학습 기록이 없어요.</div>'}
    <h3>주간 리포트</h3>
    <pre class="report" data-rep>${esc(txt)}</pre>
    <div class="btns fill"><button class="btn primary" data-copy type="button">리포트 복사</button><button class="btn" data-print type="button">인쇄 / PDF</button></div>
    <h3>자녀 프로필</h3>
    <div class="card"><p class="small" style="margin-top:0">자녀마다 학습 기록을 따로 저장해요. 실명·학교·연락처는 넣지 말고 별명만 쓰세요.</p>
      <form class="row" data-add onsubmit="return false"><input data-nick maxlength="12" placeholder="별명 (예: 첫째)" aria-label="자녀 별명" style="flex:1"><button class="btn" type="submit">프로필 추가</button></form>
      <label class="btn sm" style="margin-top:8px">자녀 기기 기록 가져오기<input type="file" accept="application/json,.json" data-pimp hidden></label>
      <p class="tiny">자녀 기기의 설정 → “학습 기록 내보내기”로 받은 파일을 넣으면 새 프로필로 추가돼요(이 기기의 기록은 그대로).</p>
      <div class="btns" style="margin-top:8px">${profs.filter((p) => p.id !== S.activeProfileId()).map((p) => `<button class="btn sm" data-sw="${p.id}" type="button">${esc(p.nick)}(으)로 전환</button>`).join('')}</div></div>
    <h3>보호자 PIN</h3>
    <form class="card row" data-setpin onsubmit="return false"><input type="password" inputmode="numeric" maxlength="6" placeholder="숫자 4~6자리 (비우면 해제)" aria-label="보호자 PIN 설정" style="flex:1" autocomplete="new-password"><button class="btn" type="submit">${pin ? 'PIN 변경' : 'PIN 설정'}</button></form>
    <p class="tiny">PIN은 이 기기에서 부모 모드를 여는 간단한 잠금이에요(보안 인증 수단이 아님).</p>`;
  view.querySelector('[data-copy]').onclick = async () => { try { await navigator.clipboard.writeText(txt); toast('리포트를 복사했어요'); } catch (e) { toast('복사가 지원되지 않아요. 길게 눌러 선택하세요'); } };
  view.querySelector('[data-print]').onclick = () => printArea(`<div class="ws"><pre class="report">${esc(txt)}</pre></div>`);
  view.querySelector('[data-add]').onsubmit = (ev) => { ev.preventDefault(); const n = view.querySelector('[data-nick]').value.trim(); if (!n) return; const id = S.addProfile(n); location.hash = `#/parent?id=${id}`; };
  view.querySelector('[data-pimp]').onchange = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try { const id = S.importAsProfile(await f.text(), (view.querySelector('[data-nick]').value.trim() || '가져온 자녀').slice(0, 12)); toast('자녀 기록을 가져왔어요'); location.hash = `#/parent?id=${id}`; }
    catch (er) { toast(er.message); }
  };
  view.querySelectorAll('[data-sw]').forEach((b) => (b.onclick = () => S.switchProfile(b.dataset.sw)));
  view.querySelector('[data-setpin]').onsubmit = (e) => { e.preventDefault();
    const v = e.target.querySelector('input').value.trim();
    if (v && !/^\d{4,6}$/.test(v)) { toast('숫자 4~6자리로 입력하세요'); return; }
    S.get().parent = { pin: v || null }; S.save(true); toast(v ? 'PIN을 설정했어요' : 'PIN을 해제했어요');
  };
}
