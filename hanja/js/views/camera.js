// 카메라 한자 검색 (실험 기능) — 사진 촬영/갤러리 → 기기 안에서 OCR(Tesseract.js, 무료 오픈소스) → 한자 선택 → 사전.
// 사진은 서버로 보내지 않는다(인식은 브라우저에서 실행). 인식 엔진·언어 데이터는 처음 한 번 공개 CDN에서 받는다.
import * as D from '../data.js';
import { esc, isHanzi, toast } from '../ui.js';
import { openHanjaDetail } from './hanja.js';

const TESS = ['https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js', 'https://unpkg.com/tesseract.js@5.1.1/dist/tesseract.min.js'];
function loadScript(src) {
  return new Promise((res, rej) => {
    if (window.Tesseract) return res();
    const s = document.createElement('script'); s.src = src; s.async = true; s.crossOrigin = 'anonymous';
    s.onload = () => res(); s.onerror = () => rej(new Error('인식 엔진을 불러오지 못했어요(인터넷 연결 확인)'));
    document.head.appendChild(s);
  });
}
function downscale(file, max = 1400) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(img.src); res(c);
    };
    img.onerror = () => rej(new Error('이미지를 열 수 없어요'));
    img.src = URL.createObjectURL(file);
  });
}

export default async function (view, { ctx }) {
  const dict = await D.dict();
  view.innerHTML = `<h1>카메라 한자 검색 <span class="badge">실험</span></h1>
    <div class="notice info">사진 속 한자를 기기 안에서 인식해요. 사진은 서버로 전송되지 않아요. 인식이 틀릴 수 있으니 결과를 꼭 확인하세요.</div>
    <div class="btns fill"><label class="btn accent" style="text-align:center">📷 촬영<input type="file" accept="image/*" capture="environment" data-cam hidden></label>
      <label class="btn" style="text-align:center">🖼 갤러리<input type="file" accept="image/*" data-gal hidden></label></div>
    <div data-prev style="margin-top:10px"></div><div data-st class="small" aria-live="polite"></div><div data-res></div>
    <p class="tiny">인식 엔진: Tesseract.js(Apache-2.0) · 번체 한자 모델. 처음 사용할 때 약 10~20MB를 내려받아요.</p>
    <form class="row" data-man onsubmit="return false" style="margin-top:10px"><input data-q placeholder="인식이 안 되면 직접 입력 (예: 學)" aria-label="한자 직접 입력" style="flex:1"><button class="btn" type="submit">찾기</button></form>`;
  const st = view.querySelector('[data-st]'); const out = view.querySelector('[data-res]');
  const showChars = (text) => {
    const chars = [...new Set([...text].filter((x) => isHanzi(x) && dict[x]))];
    out.innerHTML = chars.length ? `<h3>찾은 한자 (${chars.length}) — 눌러서 사전 보기</h3><div class="cf-row wrap">${chars.map((x) => `<button class="cf-cell" data-c="${esc(x)}" type="button"><div class="hanzi">${esc(x)}</div><div class="small">${esc(D.heStr(dict[x]))}</div></button>`).join('')}</div>`
      : '<div class="notice">사전에 있는 한자를 찾지 못했어요. 글자를 크게, 밝게 찍어 보세요.</div>';
    out.querySelectorAll('[data-c]').forEach((b) => (b.onclick = () => openHanjaDetail(b.dataset.c, ctx)));
  };
  const run = async (file) => {
    if (!file) return;
    out.innerHTML = '';
    try {
      const cv = await downscale(file);
      cv.style.cssText = 'max-width:100%;border-radius:10px'; const pv = view.querySelector('[data-prev]'); pv.innerHTML = ''; pv.appendChild(cv);
      st.textContent = '인식 엔진 준비 중…';
      let loaded = false;
      for (const u of TESS) { try { await loadScript(u); loaded = true; break; } catch (er) { /* 다음 CDN 시도 */ } }
      if (!loaded) throw new Error('인식 엔진을 불러오지 못했어요(인터넷 연결 확인). 아래에 한자를 직접 입력해 찾을 수 있어요.');
      const worker = await window.Tesseract.createWorker('chi_tra', 1, { logger: (m) => { if (m.status) st.textContent = `${m.status} ${m.progress ? Math.round(m.progress * 100) + '%' : ''}`; } });
      const r = await worker.recognize(cv);
      await worker.terminate();
      st.textContent = '인식 완료';
      showChars(r.data.text || '');
    } catch (e) { st.textContent = ''; out.innerHTML = `<div class="notice bad">${esc(e.message || '인식하지 못했어요')}</div>`; }
  };
  view.querySelector('[data-cam]').onchange = (e) => run(e.target.files[0]);
  view.querySelector('[data-gal]').onchange = (e) => run(e.target.files[0]);
  view.querySelector('[data-man]').onsubmit = (ev) => { ev.preventDefault(); const v = view.querySelector('[data-q]').value; if (!v.trim()) return toast('한자를 입력하세요'); showChars(v); };
}
