// 실배포(GitHub Pages) 검증용 브라우저 내 스모크 테스트.
// 사용: 배포 주소(https://giver11.github.io/language-test-demo/hanja/)를 360/390/412px 폭으로 연 뒤 콘솔에서
//   const r = await (await import('./tests/prod_smoke.js')).run(); console.table(r.res);
// 학습 기록(localStorage)을 테스트 전에 백업하고 끝나면 복원한다.
export async function run() {
  const backup = localStorage.getItem('hanjaPass.v1');
  const S = window.__hanja.S;
  const D = await import('../js/data.js');
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const nav = async (h, sel) => {
    location.hash = h + (h.includes('?') ? '&' : '?') + 'r=' + Math.random().toString(36).slice(2, 6);
    for (let i = 0; i < 100; i++) { await wait(100); if (!sel || document.querySelector(sel)) break; }
    await wait(200);
  };
  const W = innerWidth, res = [], errors = [];
  const origErr = console.error;
  console.error = (...a) => { errors.push(a.map((x) => (x && x.stack) || String(x)).join(' ').slice(0, 400)); origErr(...a); };
  const onErr = (e) => errors.push('pageerror ' + e.message);
  window.addEventListener('error', onErr);
  const over = () => document.documentElement.scrollWidth > W + 1;
  const cases = [['eomunhoe', '1'], ['eomunhoe', 's2'], ['daehan', '5'], ['daehan', 'dsa'], ['jinheung', '5-j'], ['jinheung', 'sa'], ['korcham', '9'], ['korcham', '1']];
  try {
    for (const [pid, lid] of cases) {
      S.setCurrent(pid, { level: lid }); S.save(true);
      const r = { case: `${pid}:${lid}` };
      await nav('#/home', '.dday'); r.home = !!document.querySelector('.dday');
      await nav('#/hanja?tab=all', '.hcell');
      r.cells = document.querySelectorAll('.hcell').length;
      r.emptyHunum = [...document.querySelectorAll('.hcell .e')].filter((e) => !e.textContent.trim()).length;
      r.tabs = [...document.querySelectorAll('.tabs button')].slice(0, 2).map((b) => b.textContent.trim()).join(' / ');
      await nav('#/quiz', '[data-start]'); r.panel = document.body.innerText.includes('문제은행 구성');
      document.querySelector('[data-start]').click();
      for (let i = 0; i < 50 && !document.querySelector('.qhost .choice, .qhost .pad canvas'); i++) await wait(100);
      r.quiz = !!document.querySelector('.qhost .choice, .qhost .pad canvas');
      await nav('#/mock', 'h1'); r.mock = document.querySelector('[data-start=full]') ? 'full' : document.body.innerText.includes('제공하지 않') ? 'blocked(설명)' : 'none';
      await nav('#/write', '.pad canvas'); r.write = !!document.querySelector('.pad canvas');
      r.overflow = over();
      const v = pid === 'daehan' ? await D.validateDaehanHanjaData({ quiet: true }) : await D.validateProviderData(pid, { quiet: true });
      r.valid = v.ok;
      res.push(r);
    }
    await nav('#/search?q=學', '.srow');
    const srow = document.querySelector('.srow') ? document.querySelector('.srow').innerText.replace(/\n/g, ' | ') : '';
    await nav('#/schedule', 'h1');
    const schOk = ['한국어문회', '대한검정회', '한자교육진흥회', '대한상공회의소'].every((n) => document.body.innerText.includes(n));
    return { W, version: D.APP_VERSION, res, srow, schOk, errors };
  } finally {
    console.error = origErr;
    window.removeEventListener('error', onErr);
    if (backup != null) localStorage.setItem('hanjaPass.v1', backup); else localStorage.removeItem('hanjaPass.v1');
  }
}
