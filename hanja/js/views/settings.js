import * as S from '../store.js';
import * as D from '../data.js';
import { esc, toast, fmtDate } from '../ui.js';

export default async function (view, { ctx: c, go }) {
  const st = S.get();
  const provs = await D.providers();
  const draw = () => {
    view.innerHTML = `
      <h1>설정</h1>
      <h3>하루 학습시간</h3>
      <div class="chips">${[10, 20, 30, 45, 60].map((m) => `<button class="chip ${st.minutes === m ? 'sel' : ''}" data-m="${m}" type="button">${m}분</button>`).join('')}</div>
      <p class="small">바꾸면 오늘의 학습량(Daily Quest)이 바로 다시 계산돼요.</p>
      <h3>현재 시험</h3>
      <div class="card">${c ? `<b>${esc(c.provider.name)} ${esc(c.level ? c.level.name : '')}</b><div class="small">${c.p.examDate ? `${esc(c.p.examRound || '')} ${fmtDate(c.p.examDate)}` : '시험일 미정'}</div>` : '선택 안 함'}
        <div class="btns" style="margin-top:10px"><a class="btn sm" href="#/onboard?switch=1">기관 변경</a>${c ? `<a class="btn sm" href="#/onboard?switch=1&p=${c.pid}">급수·시험일 변경</a>` : ''}</div>
        <p class="tiny">기관을 바꿔도 기관별 학습 기록은 삭제되지 않아요.</p></div>
      <h3>기관별 저장된 기록</h3>
      <div class="card">${provs.map((p) => { const pp = st.byProvider[p.id]; return `<div class="list-row"><div class="grow"><b>${esc(p.name)}</b><div class="small">${pp ? `카드 ${Object.keys(pp.cards).length} · 쓰기 ${Object.keys(pp.writing).length} · 문제 ${pp.quiz.answered} · 오답 ${Object.keys(pp.wrong).length}` : '기록 없음'}</div></div>${pp && pp.level ? `<button class="btn sm" data-switch="${p.id}" type="button">이 기관으로</button>` : ''}</div>`; }).join('')}</div>
      <h3>데이터</h3>
      <div class="btns"><button class="btn sm" data-export type="button">학습 기록 내보내기(JSON)</button><button class="btn sm bad" data-reset type="button">모든 기록 초기화</button></div>
      <div class="reset-host"></div>
      <p class="tiny" style="margin-top:14px">학습 기록은 이 브라우저(localStorage)에만 저장돼요. 로그인·서버 전송 없음 · 운영비 0원.</p>
      <p class="tiny"><a href="#/sources">데이터 출처와 라이선스</a></p>`;
    view.querySelectorAll('[data-m]').forEach((b) => (b.onclick = () => { st.minutes = +b.dataset.m; st.quest = null; S.save(true); toast(`하루 ${st.minutes}분으로 변경`); draw(); }));
    view.querySelectorAll('[data-switch]').forEach((b) => (b.onclick = () => { S.setCurrent(b.dataset.switch); go('#/home'); }));
    view.querySelector('[data-export]').onclick = () => {
      const blob = new Blob([S.exportJSON()], { type: 'application/json' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `hanjapass-backup-${S.today()}.json`; a.click();
    };
    view.querySelector('[data-reset]').onclick = () => {
      const h = view.querySelector('.reset-host');
      h.innerHTML = `<div class="notice bad">정말 모든 기관의 학습 기록을 지울까요? 되돌릴 수 없어요.<div class="btns" style="margin-top:8px"><button class="btn sm bad" data-yes type="button">모두 지우기</button><button class="btn sm" data-no type="button">취소</button></div></div>`;
      h.querySelector('[data-yes]').onclick = () => { S.reset(); go('#/onboard'); };
      h.querySelector('[data-no]').onclick = () => (h.innerHTML = '');
    };
  };
  draw();
}
