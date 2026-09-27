// 획순 표시/애니메이션 — 공개 획순 데이터(hanzi-writer-data / Make Me a Hanzi, Arphic Public License)만 사용.
// 데이터가 없는 글자는 애니메이션을 만들지 않는다.
import { strokes } from './data.js';

const NS = 'http://www.w3.org/2000/svg';
let uid = 0;

function el(tag, attrs = {}, parent) {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (parent) parent.appendChild(e);
  return e;
}

export function svgBase(size) {
  const svg = el('svg', { viewBox: '0 0 1024 1024', width: size || '100%', height: size || '100%', 'aria-hidden': 'true' });
  const g = el('g', { transform: 'translate(0,900) scale(1,-1)' }, svg);
  return { svg, g };
}

function gridLines(svg) {
  const s = { stroke: '#e4d9c3', 'stroke-width': 4, 'stroke-dasharray': '18 14' };
  el('line', { x1: 512, y1: 0, x2: 512, y2: 1024, ...s }, svg);
  el('line', { x1: 0, y1: 512, x2: 1024, y2: 512, ...s }, svg);
}

// 전체 글자(정적) — color, highlight: {index, color}
export async function renderChar(container, c, opts = {}) {
  const data = await strokes(c);
  container.innerHTML = '';
  if (!data) return null;
  const { svg, g } = svgBase();
  if (opts.grid) { gridLines(svg); svg.appendChild(g); }
  data.s.forEach((d, i) => {
    let fill = opts.color || '#1f2a44';
    if (opts.upto != null && i > opts.upto) fill = opts.restColor || 'transparent';
    if (opts.highlight != null && i === opts.highlight) fill = opts.highlightColor || '#d23a2a';
    else if (opts.highlight != null) fill = opts.dimColor || '#c9ccd6';
    el('path', { d, fill }, g);
  });
  if (opts.className) svg.setAttribute('class', opts.className);
  container.appendChild(svg);
  return data;
}

// 1획, 2획 ... 단계별 그림
export async function renderSteps(container, c) {
  const data = await strokes(c);
  container.innerHTML = '';
  if (!data) return null;
  const wrap = document.createElement('div');
  wrap.className = 'stroke-steps';
  data.s.forEach((_, k) => {
    const fig = document.createElement('figure');
    const { svg, g } = svgBase();
    data.s.forEach((d, i) => {
      if (i > k) return;
      el('path', { d, fill: i === k ? '#d23a2a' : '#1f2a44' }, g);
    });
    fig.appendChild(svg);
    const cap = document.createElement('figcaption');
    cap.textContent = `${k + 1}획`;
    fig.appendChild(cap);
    wrap.appendChild(fig);
  });
  container.appendChild(wrap);
  return data;
}

function polyLen(pts) {
  let L = 0;
  for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return L;
}

// 획순 애니메이션: 각 획의 윤곽을 clipPath 로 두고, 중심선(median)을 따라 굵은 선을 그려 나간다.
export async function animate(container, c, opts = {}) {
  const data = await strokes(c);
  container.innerHTML = '';
  if (!data) return null;
  const { svg, g } = svgBase();
  if (opts.grid !== false) { gridLines(svg); svg.appendChild(g); }
  const id = 'sk' + (++uid);
  const defs = el('defs', {}, svg);
  // 옅은 전체 윤곽
  data.s.forEach((d) => el('path', { d, fill: '#e9e4d8' }, g));
  const lines = data.s.map((d, i) => {
    const cp = el('clipPath', { id: `${id}-${i}` }, defs);
    el('path', { d }, cp);
    const pts = data.m[i];
    const len = polyLen(pts) + 60;
    const pl = el('polyline', {
      points: pts.map((p) => p.join(',')).join(' '), fill: 'none', stroke: opts.color || '#1f2a44',
      'stroke-width': 150, 'stroke-linecap': 'round', 'stroke-linejoin': 'round',
      'clip-path': `url(#${id}-${i})`, 'stroke-dasharray': `${len} ${len}`, 'stroke-dashoffset': len,
    }, g);
    return { pl, len };
  });
  container.appendChild(svg);
  let cancelled = false;
  const ctl = { cancel() { cancelled = true; }, total: data.s.length, onStroke: null };
  const speed = opts.speed || 1;
  (async () => {
    for (let i = 0; i < lines.length; i++) {
      if (cancelled) return;
      if (ctl.onStroke) ctl.onStroke(i);
      const { pl, len } = lines[i];
      const dur = Math.max(260, Math.min(900, len * 0.9)) / speed;
      await new Promise((res) => {
        const t0 = performance.now();
        const step = (now) => {
          if (cancelled) return res();
          const k = Math.min(1, (now - t0) / dur);
          pl.setAttribute('stroke-dashoffset', String(len * (1 - k)));
          if (k < 1) requestAnimationFrame(step); else res();
        };
        requestAnimationFrame(step);
      });
      await new Promise((r) => setTimeout(r, 180 / speed));
    }
    if (ctl.onStroke) ctl.onStroke(lines.length);
  })();
  return ctl;
}

// 필기 판정용: 기준 중심선을 0..1 정규화 좌표(위쪽이 0)로 반환
export async function referenceMedians(c) {
  const data = await strokes(c);
  if (!data) return null;
  return data.m.map((pts) => pts.map(([x, y]) => [x / 1024, (900 - y) / 1024]));
}
