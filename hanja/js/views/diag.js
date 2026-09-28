// 앱 진단: 실제 데이터 연결 · 한자 표시 · 필기 입력을 기기에서 직접 확인
import * as D from '../data.js';
import * as S from '../store.js';
import { esc } from '../ui.js';
import { WritingPad } from '../pad.js';
import { judge } from '../judge.js';
import { referenceMedians, renderChar } from '../strokes.js';

export default async function (view) {
  const rows = [];
  const add = (ok, label, detail) => rows.push(`<li><span class="${ok ? 'ok' : 'no'}">${ok ? '✓' : '✗'}</span> ${esc(label)} <span class="small">${esc(detail || '')}</span></li>`);
  view.innerHTML = `<h1>앱 진단</h1><p class="sub">이 기기에서 데이터 연결과 필기 입력이 실제로 되는지 확인해요. 문제가 있으면 이 화면을 캡처해 알려 주세요.</p>
    <div class="card"><ul class="diag" data-list style="list-style:none;padding:0;margin:0"><li>검사 중…</li></ul></div>
    <h3>한자 표시 확인</h3><div class="card center"><div data-sample></div></div>
    <h3>필기 입력 확인</h3><p class="small">아래 칸에 손가락으로 <b class="hanzi">人</b>을 써 보세요. 쓰는 동안 화면이 움직이지 않아야 해요.</p>
    <div data-padhost style="display:flex;justify-content:center"></div><div class="feedback" data-fb></div>
    <div class="btns fill" style="margin-top:8px"><button class="btn" data-clear type="button">지우기</button><button class="btn primary" data-judge type="button">판정</button></div>`;
  const list = view.querySelector('[data-list]');
  add(true, '앱 버전', D.APP_VERSION);
  add(true, '브라우저', navigator.userAgent.slice(0, 120));
  add(!!window.PointerEvent, 'Pointer Events', window.PointerEvent ? '지원' : '미지원 → Touch Events 사용');
  add('ontouchstart' in window || navigator.maxTouchPoints > 0, '터치 입력', `maxTouchPoints=${navigator.maxTouchPoints || 0}`);
  let lsOk = false;
  try { localStorage.setItem('__t', '1'); localStorage.removeItem('__t'); lsOk = true; } catch (e) {}
  add(lsOk, '학습 기록 저장(localStorage)', lsOk ? '사용 가능' : '사용 불가 — 개인정보 보호 모드/인앱 브라우저 확인');
  try {
    const dict = await D.dict();
    add(Object.keys(dict).length > 5000, '공통 한자 사전', `${Object.keys(dict).length.toLocaleString()}자 로드`);
    for (const p of await D.providers()) {
      const m = await D.mapping(p.id);
      add(m.items.length > 0, `${p.name} 배정한자 매핑`, `${m.items.length.toLocaleString()}자 로드`);
    }
    if (await D.provider('daehan')) {
      const v = await D.validateDaehanHanjaData();
      for (const r of v.levels) add(r.ok, `대한검정회 ${r.급수} 누적`, `실제 ${r.실제} / 공식 ${r.예상} · 신출 ${r.신출} · 중복 ${r.중복.length} · 누락 ${r.누락.length}`);
    }
    const st = S.get();
    if (st.current && st.current.provider) {
      const pv = S.prov(st.current.provider);
      const sc = pv.level ? await D.scopeChars(st.current.provider, pv.level).catch(() => []) : [];
      add(sc.length > 0, '현재 선택 급수의 한자', `${st.current.provider} ${pv.level || '-'} → ${sc.length}자 (예: ${sc.slice(0, 8).join(' ')})`);
    } else add(false, '현재 선택 급수', '아직 기관·급수를 선택하지 않았어요');
    const w = await D.words(); add(w.size > 0, '한자어', `${w.size.toLocaleString()}개`);
    const i = await D.idioms(); add(i.size > 0, '사자성어', `${i.size}개`);
    const med = await referenceMedians('學'); add(!!med, '획순 데이터(學)', med ? `${med.length}획` : '불러오기 실패');
    const d = dict['學'];
    view.querySelector('[data-sample]').innerHTML = `<div class="hanzi" style="font-size:64px;line-height:1.1">學</div><div style="font-size:20px;font-weight:800">${esc(D.heStr(d))}</div><div class="small">부수 ${esc(d.rad)} · ${esc(d.st)}획</div><div data-svg style="width:120px;margin:8px auto 0"></div>`;
    await renderChar(view.querySelector('[data-svg]'), '學', { grid: true });
  } catch (e) {
    add(false, '데이터 불러오기', e.message);
  }
  list.innerHTML = rows.join('');
  const pad = new WritingPad(view.querySelector('[data-padhost]'));
  const fb = view.querySelector('[data-fb]');
  let moves = 0;
  const onMove = () => { moves++; };
  pad.canvas.addEventListener('pointermove', onMove);
  pad.canvas.addEventListener('touchmove', onMove);
  const scrollStart = { y: 0 };
  pad.on('start', () => { scrollStart.y = window.scrollY; });
  pad.on('stroke', (n) => {
    const moved = Math.abs(window.scrollY - scrollStart.y);
    fb.className = 'feedback show ' + (moved ? 'retry' : 'good');
    fb.textContent = `획 ${n}개 입력됨 · 이동 이벤트 ${moves}회 · 쓰는 동안 화면 스크롤 ${moved ? moved + 'px 발생 ✗' : '없음 ✓'}`;
  });
  view.querySelector('[data-clear]').onclick = () => { pad.clear(); fb.className = 'feedback'; moves = 0; };
  view.querySelector('[data-judge]').onclick = async () => {
    const r = judge(pad.getStrokes(), await referenceMedians('人'));
    pad.showOverlay(r.per);
    fb.className = 'feedback show ' + r.verdict;
    fb.textContent = r.text + (r.messages[0] ? ' — ' + r.messages[0] : '');
  };
  return () => pad.destroy();
}
