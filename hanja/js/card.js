// 공유 카드 / SNS 카드 이미지 렌더러 (canvas, 외부 폰트·이미지 없음 → 오프라인 동작)
export const FORMATS = { '9:16': [1080, 1920], '1:1': [1080, 1080], '16:9': [1920, 1080] };
export const THEMES = {
  ink: { bg: '#fbf7ee', fg: '#1f2a44', accent: '#d23a2a', sub: '#6b6f7a', line: '#e4dccb' },
  night: { bg: '#1c2233', fg: '#f4efe3', accent: '#ff8a6b', sub: '#aab0bf', line: '#343c52' },
  mint: { bg: '#eef7f3', fg: '#17352b', accent: '#1f8a5b', sub: '#58706a', line: '#cfe5db' },
};
const SERIF = '"Noto Serif CJK KR","Noto Serif KR","Nanum Myeongjo","Batang","AppleMyungjo",serif';
const SANS = '"Noto Sans KR","Apple SD Gothic Neo","Malgun Gothic",sans-serif';

function wrap(ctx, text, maxW) {
  const out = [];
  for (const para of String(text).split('\n')) {
    let line = '';
    for (const ch of [...para]) {
      if (ctx.measureText(line + ch).width > maxW && line) { out.push(line); line = ch.trimStart(); } else line += ch;
    }
    out.push(line);
  }
  return out;
}

// spec: {format, theme, kicker, big, bigSize, title, lines[], footer, grid(bool), progress(0..1)}
export function draw(canvas, spec) {
  const [W, H] = FORMATS[spec.format] || FORMATS['1:1'];
  const T = THEMES[spec.theme] || THEMES.ink;
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = T.bg; ctx.fillRect(0, 0, W, H);
  const pad = Math.round(Math.min(W, H) * 0.08);
  ctx.strokeStyle = T.line; ctx.lineWidth = 6; ctx.strokeRect(pad / 2, pad / 2, W - pad, H - pad);
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  const unit = Math.min(W, H) / 1080;
  let y = pad + 70 * unit;
  if (spec.kicker) {
    ctx.fillStyle = T.accent; ctx.font = `700 ${Math.round(44 * unit)}px ${SANS}`;
    ctx.fillText(spec.kicker, W / 2, y); y += 40 * unit;
  }
  const wide = W > H;
  // 큰 한자(또는 숫자)
  if (spec.big) {
    const len = [...spec.big].length;
    const size = spec.bigSize || Math.round(Math.min(W * (wide ? 0.34 : 0.6) / Math.max(1, len * 0.9), H * (wide ? 0.42 : 0.32)));
    const cy = wide ? H * 0.52 : y + size * 0.95;
    const cx = wide ? W * 0.3 : W / 2;
    if (spec.grid) {
      const b = size * 1.1 * Math.min(len, 4);
      ctx.save(); ctx.strokeStyle = T.line; ctx.setLineDash([12, 12]); ctx.lineWidth = 3;
      ctx.strokeRect(cx - b / 2, cy - size * 0.92, b, size * 1.1);
      ctx.beginPath(); ctx.moveTo(cx - b / 2, cy - size * 0.37); ctx.lineTo(cx + b / 2, cy - size * 0.37); ctx.stroke();
      ctx.restore();
    }
    ctx.fillStyle = T.fg; ctx.font = `700 ${size}px ${SERIF}`;
    ctx.fillText(spec.big, cx, cy);
    if (!wide) y = cy + 90 * unit;
  }
  // 본문
  const colX = wide && spec.big ? W * 0.62 : W / 2;
  const maxW = wide && spec.big ? W * 0.62 - pad : W - pad * 2.2;
  if (wide && spec.big) { ctx.textAlign = 'left'; y = H * 0.3; }
  const tx = wide && spec.big ? W * 0.52 : colX;
  if (spec.title) {
    ctx.fillStyle = T.fg; ctx.font = `800 ${Math.round(64 * unit)}px ${SANS}`;
    for (const l of wrap(ctx, spec.title, maxW)) { ctx.fillText(l, tx, y); y += 80 * unit; }
    y += 10 * unit;
  }
  ctx.font = `500 ${Math.round(42 * unit)}px ${SANS}`;
  for (const para of spec.lines || []) {
    ctx.fillStyle = para.accent ? T.accent : T.sub;
    ctx.font = `${para.bold ? 700 : 500} ${Math.round((para.size || 42) * unit)}px ${para.serif ? SERIF : SANS}`;
    for (const l of wrap(ctx, para.text || para, maxW)) { ctx.fillText(l, tx, y); y += (para.size || 42) * 1.45 * unit; }
    y += 14 * unit;
  }
  if (spec.progress != null) {
    const bw = maxW, bx = wide && spec.big ? tx : (W - bw) / 2;
    ctx.fillStyle = T.line; ctx.fillRect(bx, y, bw, 22 * unit);
    ctx.fillStyle = T.accent; ctx.fillRect(bx, y, bw * Math.max(0, Math.min(1, spec.progress)), 22 * unit);
    y += 60 * unit;
  }
  ctx.textAlign = 'center';
  ctx.fillStyle = T.sub; ctx.font = `600 ${Math.round(34 * unit)}px ${SANS}`;
  ctx.fillText(spec.footer || '한자패스', W / 2, H - pad - 10 * unit);
  return canvas;
}

export function download(canvas, name) {
  return new Promise((res) => canvas.toBlob((b) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(b); a.download = name; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    res(b);
  }, 'image/png'));
}

// 사용자가 직접 누를 때만 시스템 공유창을 연다 (자동 게시 없음)
export async function shareImage(canvas, name, text) {
  const blob = await new Promise((r) => canvas.toBlob(r, 'image/png'));
  const file = new File([blob], name, { type: 'image/png' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], text }); return true; }
  return false;
}
