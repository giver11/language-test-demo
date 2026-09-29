// 공유 카드: 오늘의 실제 학습 기록만 표시. 이름·학교·지역 등 개인정보는 넣지 않는다(닉네임은 사용자가 켤 때만).
import * as S from '../store.js';
import * as Card from '../card.js';
import { esc, daysUntil, toast } from '../ui.js';

export default async function (view, { ctx: c }) {
  const st = S.get();
  const t = S.today();
  const ds = (st.dstat || {})[t] || { a: 0, c: 0 };
  const streak = S.streak().current;
  const dl = daysUntil(c.p.examDate);
  const nick = (S.profiles().find((p) => p.id === S.activeProfileId()) || {}).nick || '';
  const opt = { format: '1:1', theme: 'ink', nick: false };
  view.innerHTML = `<h1>공유 카드</h1>
    <p class="sub">오늘의 실제 기록으로 만든 이미지 · 개인정보는 기본으로 넣지 않아요</p>
    <div class="chips" data-f>${Object.keys(Card.FORMATS).map((f) => `<button class="chip ${f === opt.format ? 'sel' : ''}" data-v="${f}" type="button">${f}</button>`).join('')}</div>
    <div class="chips" data-t style="margin-top:6px">${Object.keys(Card.THEMES).map((f) => `<button class="chip ${f === opt.theme ? 'sel' : ''}" data-v="${f}" type="button">${{ ink: '종이', night: '밤', mint: '민트' }[f]}</button>`).join('')}</div>
    ${nick ? `<label class="small" style="display:block;margin:8px 0"><input type="checkbox" data-nick> 닉네임 “${esc(nick)}” 표시</label>` : ''}
    <div class="card-preview"><canvas data-cv aria-label="공유 카드 미리보기"></canvas></div>
    <div class="btns fill"><button class="btn accent" data-dl type="button">이미지 저장</button><button class="btn" data-sh type="button">공유하기</button></div>
    <p class="tiny">자동으로 게시하지 않아요. 저장한 이미지를 직접 올리거나, “공유하기”로 기기 공유창을 열 수 있어요.</p>`;
  const cv = view.querySelector('[data-cv]');
  const render = () => {
    const lines = [
      { text: ds.a ? `오늘 ${ds.a}문제 · ${ds.c}정답` : '오늘 첫 문제를 풀어 보세요', size: 56, bold: true, accent: true },
      { text: `${streak}일 연속 학습`, size: 46, bold: true },
      { text: `${c.provider.name} ${c.level.name}${dl != null && dl >= 0 ? ` · D-${dl}` : ''}`, size: 42 },
    ];
    if (opt.nick && nick) lines.push({ text: nick, size: 36 });
    Card.draw(cv, { format: opt.format, theme: opt.theme, kicker: '오늘의 한자 공부', big: ds.a ? `${Math.round((ds.c * 100) / ds.a)}%` : '學', bigSize: ds.a ? null : null, lines, footer: '한자패스 · 한자 급수 준비' });
  };
  view.querySelectorAll('[data-f] [data-v]').forEach((b) => (b.onclick = () => { opt.format = b.dataset.v; view.querySelectorAll('[data-f] [data-v]').forEach((x) => x.classList.toggle('sel', x === b)); render(); }));
  view.querySelectorAll('[data-t] [data-v]').forEach((b) => (b.onclick = () => { opt.theme = b.dataset.v; view.querySelectorAll('[data-t] [data-v]').forEach((x) => x.classList.toggle('sel', x === b)); render(); }));
  const nb = view.querySelector('[data-nick]'); if (nb) nb.onchange = () => { opt.nick = nb.checked; render(); };
  view.querySelector('[data-dl]').onclick = () => Card.download(cv, `hanjapass-${t}.png`);
  view.querySelector('[data-sh]').onclick = async () => {
    try { if (!(await Card.shareImage(cv, `hanjapass-${t}.png`, '오늘의 한자 공부'))) { toast('이 기기는 이미지 공유를 지원하지 않아 저장으로 대신해요'); Card.download(cv, `hanjapass-${t}.png`); } } catch (e) { if (e.name !== 'AbortError') toast('공유를 취소했거나 지원하지 않아요'); }
  };
  render();
}
