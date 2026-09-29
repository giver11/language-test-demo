import * as D from '../data.js';
import * as S from '../store.js';
import { esc, fmtDate, daysUntil, ddayText, statusBadge, toast } from '../ui.js';

const MARKS = { eomunhoe: '語', daehan: '檢', jinheung: '振', korcham: '商' };

export default async function (view, { params, go }) {
  const st = S.get();
  const providers = await D.providers();
  const cur = st.current && st.current.provider;
  const state = { step: 0, pid: params.p || (params.switch ? cur : null), lid: null, date: null, round: null, minutes: st.minutes || 20 };
  if (state.pid) {
    const pp = S.prov(state.pid);
    state.lid = pp.level; state.date = pp.examDate; state.round = pp.examRound;
    state.step = params.switch ? 0 : 1;
  }

  const draw = async () => {
    const steps = `<div class="steps">${[0, 1, 2, 3].map((i) => `<span class="${i <= state.step ? 'on' : ''}"></span>`).join('')}</div>`;
    if (state.step === 0) {
      view.innerHTML = `${steps}
        <h1>어떤 한자시험을 준비하시나요?</h1>
        <p class="sub">시험기관마다 급수·배정한자·문제유형이 달라요. 기관별 학습 기록은 따로 저장돼요.</p>
        <div class="pick-grid">${providers.map((p) => `
          <button class="pick ${state.pid === p.id ? 'sel' : ''}" data-p="${p.id}" type="button">
            <span class="mark hanzi">${MARKS[p.id]}</span>
            <span class="t">${esc(p.name)}</span>
            <span class="d">${esc(p.examName)}</span>
            <span class="d">${esc(p.mode)}</span>
          </button>`).join('')}</div>
        ${cur ? '<p class="small" style="margin-top:14px">기관을 바꿔도 이전 기관의 학습 기록은 그대로 보존돼요.</p>' : ''}
        ${cur && params.switch ? '<div class="btns" style="margin-top:8px"><a class="btn ghost" href="#/home">취소</a></div>' : ''}`;
      view.querySelectorAll('[data-p]').forEach((b) => (b.onclick = () => {
        state.pid = b.dataset.p;
        const pp = S.get().byProvider[state.pid];
        state.lid = pp ? pp.level : null; state.date = pp ? pp.examDate : null; state.round = pp ? pp.examRound : null;
        state.step = 1; draw();
      }));
      return;
    }
    const prov = providers.find((p) => p.id === state.pid);
    const lv = await D.levels(state.pid);
    if (state.step === 1) {
      view.innerHTML = `${steps}
        <button class="btn ghost sm" data-back type="button">← 기관 선택</button>
        <h1>${esc(prov.name)} 급수 선택</h1>
        <p class="sub">${esc(prov.examName)} · 공식 급수 체계(${lv.levels.length}개 급수)</p>
        <div class="level-list">${lv.levels.map((l) => l.hasData ? `
          <button class="lv ${state.lid === l.id ? 'sel' : ''}" data-l="${l.id}" type="button">
            <b>${esc(l.name)}</b>
            <span class="small">${esc(l.category)} · 한자 ${l.dataCount.toLocaleString()}자 학습 가능</span>
            ${statusBadge(l.status.hanja)}
          </button>` : `
          <button class="lv" type="button" disabled aria-disabled="true" style="opacity:.5;cursor:not-allowed">
            <b>${esc(l.name)}</b>
            <span class="small">${esc(l.category)} · 한자 데이터 준비 중</span>
            ${statusBadge('missing')}
          </button>`).join('')}</div>
        ${lv.levels.some((l) => !l.hasData) ? `<div class="notice" style="margin-top:14px">회색 급수는 공식 배정한자 목록을 아직 확보하지 못해 한자 학습을 할 수 없어요. 가짜 한자를 채우지 않고 선택을 막아 두었어요. (시험일정·시험형식은 더보기 → 시험일정/데이터 출처에서 볼 수 있어요)</div>` : ''}`;
      view.querySelector('[data-back]').onclick = () => { state.step = 0; draw(); };
      view.querySelectorAll('[data-l]').forEach((b) => (b.onclick = () => { state.lid = b.dataset.l; state.step = 2; draw(); }));
      return;
    }
    if (state.step === 2) {
      const sch = await D.schedule(state.pid);
      const L = lv.levels.find((l) => l.id === state.lid);
      const upcoming = (sch.sessions || []).filter((s) => s.examDate && daysUntil(s.examDate) >= 0);
      const isAlways = sch.type === 'always';
      view.innerHTML = `${steps}
        <button class="btn ghost sm" data-back type="button">← 급수 선택</button>
        <h1>시험일 선택</h1>
        <p class="sub">${esc(prov.name)} ${esc(L.name)} · 공식 시험기관 발표 기준 <span class="small">(마지막 확인: ${esc(sch.source.verifiedAt)})</span></p>
        ${sch.status !== 'official' ? `<div class="notice">${esc(sch.statusNote || '')}</div>` : ''}
        ${isAlways ? `<div class="notice info"><b>상시 시험</b> · ${esc(sch.always.description)}<br>접수: ${esc(sch.always.applyRule)} · 합격 발표: ${esc(sch.always.resultRule)}<br>${esc(sch.always.note)}</div>` : ''}
        <div class="opt-list">
          ${upcoming.map((s) => `<button class="opt ${state.date === s.examDate && state.round === s.round ? 'sel' : ''}" data-d="${s.examDate}" data-r="${esc(s.round)}" type="button">
              <span><b>${esc(s.round)}</b> · ${fmtDate(s.examDate)}<br><span class="small">접수 ${fmtDate(s.applyStart)} ~ ${fmtDate(s.applyEnd)} · ${esc(s.mode)}</span></span>
              <span class="badge accent">${ddayText(daysUntil(s.examDate))}</span></button>`).join('')}
          ${!isAlways && !upcoming.length ? '<div class="notice">올해 남은 공식 시험일이 없어요. 날짜를 직접 입력하거나 다음 해 일정이 등록되면 선택하세요.</div>' : ''}
        </div>
        <div class="card flat" style="margin-top:6px">
          <label class="small" for="customDate">${isAlways ? '접수한 시험일 입력' : '직접 입력 (공식 회차 외 날짜)'}</label>
          <input id="customDate" type="date" value="${state.round === '직접 입력' && state.date ? state.date : ''}" style="margin-top:6px">
        </div>
        <div class="btns fill" style="margin-top:14px">
          <button class="btn" data-skip type="button">시험일 나중에</button>
          <button class="btn primary" data-next type="button">다음</button>
        </div>`;
      view.querySelector('[data-back]').onclick = () => { state.step = 1; draw(); };
      view.querySelectorAll('[data-d]').forEach((b) => (b.onclick = () => { state.date = b.dataset.d; state.round = b.dataset.r; state.step = 3; draw(); }));
      view.querySelector('[data-skip]').onclick = () => { state.date = null; state.round = null; state.step = 3; draw(); };
      view.querySelector('[data-next]').onclick = () => {
        const v = view.querySelector('#customDate').value;
        if (v) { state.date = v; state.round = '직접 입력'; }
        if (!state.date) { toast('시험일을 선택하거나 “시험일 나중에”를 눌러 주세요'); return; }
        state.step = 3; draw();
      };
      return;
    }
    if (state.step === 3) {
      const L = lv.levels.find((l) => l.id === state.lid);
      view.innerHTML = `${steps}
        <button class="btn ghost sm" data-back type="button">← 시험일</button>
        <h1>하루 학습시간</h1>
        <p class="sub">선택한 시간에 맞춰 오늘의 학습량(Daily Quest)을 계산해요. 설정에서 언제든 바꿀 수 있어요.</p>
        <div class="chips">${[10, 20, 30, 45, 60].map((m) => `<button class="chip ${state.minutes === m ? 'sel' : ''}" data-m="${m}" type="button">${m}분</button>`).join('')}</div>
        <div class="card" style="margin-top:18px">
          <div class="small">선택 요약</div>
          <div style="font-size:18px;font-weight:800;margin-top:4px">${esc(prov.name)} ${esc(L.name)}</div>
          <div class="small">${state.date ? `${esc(state.round || '')} ${fmtDate(state.date)} · ${ddayText(daysUntil(state.date))}` : '시험일 미정'}</div>
        </div>
        ${L.hasData ? `<button class="btn accent block" data-go="placement" type="button" style="margin-top:16px;min-height:56px;font-size:18px">간단 진단평가 후 시작 (약 2분)</button>
        <button class="btn block" data-go="skip" type="button" style="margin-top:8px">진단 없이 바로 시작</button>
        <p class="tiny">진단 결과로 이미 아는 한자와 복습할 한자를 나눠 개인 학습계획(Exam Coach)을 만들어요.</p>` : `<button class="btn accent block" data-go type="button" style="margin-top:16px;min-height:56px;font-size:18px">학습 시작</button>`}`;
      view.querySelector('[data-back]').onclick = () => { state.step = 2; draw(); };
      view.querySelectorAll('[data-m]').forEach((b) => (b.onclick = () => { state.minutes = +b.dataset.m; draw(); }));
      view.querySelectorAll('[data-go]').forEach((btn) => (btn.onclick = () => {
        S.get().minutes = state.minutes;
        S.setCurrent(state.pid, { level: state.lid, examDate: state.date, examRound: state.round });
        go(btn.dataset.go === 'placement' ? '#/placement' : '#/home');
      }));
    }
  };
  await draw();
}
