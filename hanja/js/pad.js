// 필기 캔버스 — Pointer Events 우선, 미지원 브라우저는 Touch/Mouse Events 로 대체.
// 필기 중 페이지 스크롤/확대가 일어나지 않도록 touch-action:none + touchmove preventDefault 처리.
import { svgBase } from './strokes.js';
import { strokes as loadStrokes } from './data.js';

const NS = 'http://www.w3.org/2000/svg';

export class WritingPad {
  constructor(host, opts = {}) {
    this.host = host;
    this.opts = Object.assign({ ink: '#1f2a44', width: 0.034 }, opts);
    this.strokes = [];      // [[{x,y,t}], ...] 0..1 정규화 좌표
    this.cur = null;
    this.listeners = {};
    this.el = document.createElement('div');
    this.el.className = 'pad';
    this.el.innerHTML = `
      <svg class="grid" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <rect x="0.5" y="0.5" width="99" height="99" fill="none" stroke="#e8dcc4" stroke-width="0.6"/>
        <line x1="50" y1="0" x2="50" y2="100" stroke="#eadfca" stroke-width="0.5" stroke-dasharray="2 1.6"/>
        <line x1="0" y1="50" x2="100" y2="50" stroke="#eadfca" stroke-width="0.5" stroke-dasharray="2 1.6"/>
        <line x1="0" y1="0" x2="100" y2="100" stroke="#f1e8d6" stroke-width="0.4" stroke-dasharray="1.5 2"/>
        <line x1="100" y1="0" x2="0" y2="100" stroke="#f1e8d6" stroke-width="0.4" stroke-dasharray="1.5 2"/>
      </svg>
      <div class="guide-layer"></div>
      <canvas aria-label="한자 쓰기 칸 — 손가락, 펜 또는 마우스로 쓰세요" role="img"></canvas>
      <svg class="overlay" viewBox="0 0 1 1" preserveAspectRatio="none" aria-hidden="true"></svg>`;
    host.appendChild(this.el);
    this.canvas = this.el.querySelector('canvas');
    this.ctx = this.canvas.getContext('2d');
    this.guideLayer = this.el.querySelector('.guide-layer');
    this.overlay = this.el.querySelector('svg.overlay');
    this._bind();
    this._resize();
    this._ro = new ResizeObserver(() => this._resize());
    this._ro.observe(this.el);
  }

  on(ev, fn) { (this.listeners[ev] = this.listeners[ev] || []).push(fn); return this; }
  _emit(ev, ...a) { (this.listeners[ev] || []).forEach((f) => f(...a)); }

  _resize() {
    const r = this.el.getBoundingClientRect();
    if (!r.width) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    this.size = r.width;
    this.canvas.width = Math.round(r.width * dpr);
    this.canvas.height = Math.round(r.height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.redraw();
  }

  _pos(clientX, clientY) {
    const r = this.canvas.getBoundingClientRect();
    return { x: (clientX - r.left) / r.width, y: (clientY - r.top) / r.height, t: performance.now() };
  }

  _bind() {
    const c = this.canvas;
    // iOS Safari 등에서 스크롤·더블탭 확대 차단
    const stop = (e) => { if (e.cancelable) e.preventDefault(); };
    c.addEventListener('touchstart', stop, { passive: false });
    c.addEventListener('touchmove', stop, { passive: false });
    c.addEventListener('touchend', stop, { passive: false });
    c.addEventListener('gesturestart', stop, { passive: false });
    c.addEventListener('contextmenu', stop);
    this.el.addEventListener('dblclick', stop);

    if (window.PointerEvent) {
      c.addEventListener('pointerdown', (e) => {
        if (e.button !== undefined && e.button > 0) return;
        if (this.cur) return; // 멀티터치 무시
        this._pid = e.pointerId;
        try { c.setPointerCapture(e.pointerId); } catch (_) {}
        e.preventDefault();
        this._start(this._pos(e.clientX, e.clientY), e.pointerType);
      });
      c.addEventListener('pointermove', (e) => {
        if (!this.cur || e.pointerId !== this._pid) return;
        e.preventDefault();
        const list = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
        for (const ev of (list.length ? list : [e])) this._move(this._pos(ev.clientX, ev.clientY));
      });
      const end = (e) => {
        if (!this.cur || e.pointerId !== this._pid) return;
        e.preventDefault();
        this._end();
      };
      c.addEventListener('pointerup', end);
      c.addEventListener('pointercancel', end);
      c.addEventListener('lostpointercapture', end);
    } else {
      // Touch Events 대체 경로
      c.addEventListener('touchstart', (e) => {
        const t = e.changedTouches[0];
        if (this.cur) return;
        this._tid = t.identifier;
        this._start(this._pos(t.clientX, t.clientY), 'touch');
      }, { passive: false });
      c.addEventListener('touchmove', (e) => {
        if (!this.cur) return;
        for (const t of e.changedTouches) if (t.identifier === this._tid) this._move(this._pos(t.clientX, t.clientY));
      }, { passive: false });
      const tend = (e) => { for (const t of e.changedTouches) if (t.identifier === this._tid && this.cur) this._end(); };
      c.addEventListener('touchend', tend, { passive: false });
      c.addEventListener('touchcancel', tend, { passive: false });
      c.addEventListener('mousedown', (e) => { this._start(this._pos(e.clientX, e.clientY), 'mouse'); });
      window.addEventListener('mousemove', (e) => { if (this.cur) this._move(this._pos(e.clientX, e.clientY)); });
      window.addEventListener('mouseup', () => { if (this.cur) this._end(); });
    }
  }

  _start(p, type) {
    this.clearOverlay();
    this.cur = [p];
    this.pointerType = type;
    this._emit('start');
    this.redraw();
  }
  _move(p) {
    const last = this.cur[this.cur.length - 1];
    if (Math.hypot(p.x - last.x, p.y - last.y) < 0.002) return;
    this.cur.push(p);
    this._drawSeg(last, p);
  }
  _end() {
    const s = this.cur;
    this.cur = null;
    if (s && s.length) {
      if (s.length === 1) s.push({ x: s[0].x + 0.001, y: s[0].y + 0.001, t: s[0].t });
      this.strokes.push(s);
      this._emit('stroke', this.strokes.length);
    }
    this.redraw();
  }

  _lineW() { return Math.max(4, this.size * this.opts.width); }
  _drawSeg(a, b) {
    const ctx = this.ctx, S = this.size;
    ctx.strokeStyle = this.opts.ink;
    ctx.lineWidth = this._lineW();
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(a.x * S, a.y * S); ctx.lineTo(b.x * S, b.y * S); ctx.stroke();
  }
  redraw() {
    const ctx = this.ctx, S = this.size || 1;
    ctx.clearRect(0, 0, S, S);
    const all = this.cur ? [...this.strokes, this.cur] : this.strokes;
    ctx.strokeStyle = this.opts.ink;
    ctx.lineWidth = this._lineW();
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const s of all) {
      ctx.beginPath();
      s.forEach((p, i) => (i ? ctx.lineTo(p.x * S, p.y * S) : ctx.moveTo(p.x * S, p.y * S)));
      ctx.stroke();
    }
  }

  clear() { this.strokes = []; this.cur = null; this.clearOverlay(); this.redraw(); this._emit('clear'); }
  undo() { this.strokes.pop(); this.clearOverlay(); this.redraw(); this._emit('stroke', this.strokes.length); }
  getStrokes() { return this.strokes.map((s) => s.map((p) => [p.x, p.y])); }
  isEmpty() { return this.strokes.length === 0; }

  // mode: 'solid'(따라 쓰기) | 'faint'(희미한 가이드) | 'none'(외워 쓰기)
  async setGuide(ch, mode) {
    this.guideLayer.innerHTML = '';
    this.guideChar = ch; this.guideMode = mode;
    if (!ch || mode === 'none') return;
    const data = await loadStrokes(ch);
    if (this.guideChar !== ch || this.guideMode !== mode) return;
    const opacity = mode === 'solid' ? 0.26 : 0.09;
    if (data) {
      const { svg, g } = svgBase();
      svg.style.cssText = 'position:absolute;inset:0;width:100%;height:100%';
      data.s.forEach((d) => { const p = document.createElementNS(NS, 'path'); p.setAttribute('d', d); p.setAttribute('fill', `rgba(31,42,68,${opacity})`); g.appendChild(p); });
      this.guideLayer.appendChild(svg);
    } else {
      const d = document.createElement('div');
      d.className = 'glyph'; d.textContent = ch; d.style.opacity = String(opacity);
      this.guideLayer.appendChild(d);
    }
  }

  // 판정 결과 표시: 사용자 획을 상태별 색으로 덧그림
  showOverlay(per) {
    this.clearOverlay();
    const colors = { ok: '#2f8a5b', near: '#2f6db4', order: '#b7791f', bad: '#c0392b', extra: '#c0392b' };
    this.strokes.forEach((s, i) => {
      const st = (per && per[i]) || 'ok';
      const pl = document.createElementNS(NS, 'polyline');
      pl.setAttribute('points', s.map((p) => `${p.x},${p.y}`).join(' '));
      pl.setAttribute('fill', 'none');
      pl.setAttribute('stroke', colors[st] || colors.ok);
      pl.setAttribute('stroke-width', '0.034');
      pl.setAttribute('stroke-linecap', 'round');
      pl.setAttribute('stroke-linejoin', 'round');
      this.overlay.appendChild(pl);
      const t = document.createElementNS(NS, 'text');
      t.setAttribute('x', String(s[0].x)); t.setAttribute('y', String(s[0].y - 0.02));
      t.setAttribute('font-size', '0.05'); t.setAttribute('fill', colors[st] || colors.ok); t.setAttribute('font-weight', '700');
      t.textContent = String(i + 1);
      this.overlay.appendChild(t);
    });
  }
  clearOverlay() { this.overlay.innerHTML = ''; }

  thumbnail(px = 160) {
    const cv = document.createElement('canvas');
    cv.width = px; cv.height = px;
    const x = cv.getContext('2d');
    x.fillStyle = '#fffdf8'; x.fillRect(0, 0, px, px);
    x.strokeStyle = '#1f2a44'; x.lineWidth = px * 0.045; x.lineCap = 'round'; x.lineJoin = 'round';
    for (const s of this.strokes) { x.beginPath(); s.forEach((p, i) => (i ? x.lineTo(p.x * px, p.y * px) : x.moveTo(p.x * px, p.y * px))); x.stroke(); }
    return cv.toDataURL('image/png');
  }
  loadStrokes(arr) { this.strokes = (arr || []).map((s) => s.map((p) => ({ x: p.x, y: p.y, t: p.t || 0 }))); this.redraw(); }
  rawStrokes() { return this.strokes.map((s) => s.map((p) => ({ x: p.x, y: p.y }))); }
  destroy() { try { this._ro.disconnect(); } catch (_) {} this.el.remove(); }
}
