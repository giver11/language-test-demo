import * as S from '../store.js';
import * as D from '../data.js';
import { esc, toast, fmtDate } from '../ui.js';
import * as F from '../flags.js';

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
      <h3>글자 크기</h3>
      <div class="chips">${[['', '보통'], ['l', '크게'], ['xl', '아주 크게']].map(([k, l]) => `<button class="chip ${(document.documentElement.getAttribute('data-fs') || '') === k ? 'sel' : ''}" data-fs="${k}" type="button">${l}</button>`).join('')}</div>
      <h3>학습자 프로필</h3>
      <div class="card"><b>${esc((S.profiles().find((p) => p.id === S.activeProfileId()) || {}).nick || '기본 학습자')}</b> <span class="small">사용 중</span>
        <div class="btns" style="margin-top:8px"><a class="btn sm" href="#/parent">부모 모드 · 프로필 관리</a></div></div>
      <h3>오프라인 학습</h3>
      <div class="card"><p class="small" style="margin-top:0">지금 기관·급수의 한자·플래시카드·기본 퀴즈·쓰기(획순) 자료를 이 기기에 저장해 인터넷 없이 쓸 수 있게 해요.</p>
        <button class="btn primary" data-off type="button" ${'serviceWorker' in navigator ? '' : 'disabled'}>오프라인용 자료 저장</button><div class="small" data-offst aria-live="polite"></div></div>
      <h3>요금제 <span class="badge">MVP · 결제 없음</span></h3>
      <div class="card"><p class="small" style="margin-top:0">현재 모든 기능을 무료로 열어 두었어요(결제·잠금 미적용). 추후 요금제 구성 예정:</p>
        ${F.TIERS.map((t) => `<div class="list-row"><b style="min-width:84px">${t.name}</b><div class="grow small">${esc(t.desc)}</div></div>`).join('')}</div>
      <h3>데이터</h3>
      <div class="btns"><button class="btn sm" data-export type="button">학습 기록 내보내기(JSON)</button><label class="btn sm">학습 기록 가져오기<input type="file" accept="application/json,.json" data-import hidden></label><button class="btn sm bad" data-reset type="button">모든 기록 초기화</button></div>
      <div class="reset-host"></div>
      <p class="tiny" style="margin-top:14px">학습 기록은 이 브라우저(localStorage)에만 저장돼요. 기기를 바꿀 때는 내보내기 → 새 기기에서 가져오기를 쓰세요. 로그인·서버 전송 없음 · 운영비 0원.</p>
      <p class="tiny"><a href="#/sources">데이터 출처와 라이선스</a></p>`;
    view.querySelectorAll('[data-m]').forEach((b) => (b.onclick = () => { st.minutes = +b.dataset.m; st.quest = null; S.save(true); toast(`하루 ${st.minutes}분으로 변경`); draw(); }));
    view.querySelectorAll('[data-switch]').forEach((b) => (b.onclick = () => { S.setCurrent(b.dataset.switch); go('#/home'); }));
    view.querySelectorAll('[data-fs]').forEach((b) => (b.onclick = () => {
      const v = b.dataset.fs;
      if (v) document.documentElement.setAttribute('data-fs', v); else document.documentElement.removeAttribute('data-fs');
      try { if (v) localStorage.setItem('hanja.fontScale', v); else localStorage.removeItem('hanja.fontScale'); } catch (e) {}
      draw();
    }));
    view.querySelector('[data-off]').onclick = async (e) => {
      const btn = e.target; const out = view.querySelector('[data-offst]');
      if (!c || !c.level || !c.level.hasData) { toast('먼저 기관과 급수를 선택하세요'); return; }
      btn.disabled = true;
      try {
        const reg = await Promise.race([navigator.serviceWorker.ready, new Promise((r) => setTimeout(() => r(null), 4000))]);
        if (!reg) throw new Error('오프라인 기능을 준비하지 못했어요(브라우저 설정 확인)');
        const V = D.APP_VERSION; const base = D.BASE;
        const files = ['dictionary/hanja.json', 'dictionary/idioms.json', 'dictionary/words.json', 'dictionary/pairs.json', 'dictionary/confusables.json', 'dictionary/examples.json', 'dictionary/radical_stories.json',
          'providers/index.json', `providers/${c.pid}/levels.json`, `providers/${c.pid}/hanja-mapping.json`, `providers/${c.pid}/words-mapping.json`, `providers/${c.pid}/idioms-mapping.json`, `providers/${c.pid}/exam-types.json`, `providers/${c.pid}/sources.json`,
          `questions/${c.pid}/${c.lid}.json`, 'questions/index.json', 'schedules/index.json'].map((f) => base + f + '?v=' + V);
        const dict = await D.dict();
        const scope = await D.scopeChars(c.pid, c.lid);
        for (const ch of scope) if (dict[ch] && dict[ch].so) files.push(base + 'strokes/' + ch.codePointAt(0).toString(16).toUpperCase().padStart(4, '0') + '.json?v=' + V);
        let n = 0, fail = 0;
        const q = files.slice();
        const worker = async () => { while (q.length) { const u = q.shift(); try { const r = await fetch(u); if (!r.ok) fail++; } catch (er) { fail++; } n++; if (n % 20 === 0 || !q.length) out.textContent = `${n} / ${files.length} 저장 중…`; } };
        await Promise.all([1, 2, 3, 4, 5, 6].map(worker));
        out.textContent = reg && navigator.serviceWorker.controller ? `저장 완료 (${files.length - fail}개 파일${fail ? `, 실패 ${fail}` : ''}). 인터넷 없이도 이 급수를 공부할 수 있어요.` : '저장했어요. 앱을 한 번 새로고침하면 오프라인에서도 열려요.';
      } catch (er) { out.textContent = '저장하지 못했어요: ' + er.message; }
      btn.disabled = false;
    };
    view.querySelector('[data-export]').onclick = () => {
      const blob = new Blob([S.exportJSON()], { type: 'application/json' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `hanjapass-backup-${S.today()}.json`; a.click();
    };
    view.querySelector('[data-import]').onchange = async (e) => {
      const f = e.target.files[0]; if (!f) return;
      const h = view.querySelector('.reset-host');
      const text = await f.text();
      h.innerHTML = `<div class="notice">“${esc(f.name)}” 기록으로 바꿀까요? 지금 기록은 지우지 않고 이 기기에 따로 백업해 둬요.<div class="btns" style="margin-top:8px"><button class="btn sm primary" data-imp-yes type="button">가져오기</button><button class="btn sm" data-imp-no type="button">취소</button></div></div>`;
      h.querySelector('[data-imp-no]').onclick = () => (h.innerHTML = '');
      h.querySelector('[data-imp-yes]').onclick = () => {
        try { const r = S.importJSON(text); toast(`가져왔어요 (기관 ${r.providers}곳)`); setTimeout(() => location.reload(), 600); }
        catch (er) { h.innerHTML = `<div class="notice bad">${esc(er.message)}</div>`; }
      };
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
