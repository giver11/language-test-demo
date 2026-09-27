// 필기 판정 — 실제 입력 stroke 좌표와 기준 획(중심선 median) 데이터를 비교한다.
// 비교 항목: 획수, 획순(가장 가까운 기준 획의 순서), 시작/끝 위치, 경로 거리, 방향.
// 점수(%)를 만들지 않고 규칙 기반 피드백만 반환한다.

const N = 14;

function resample(pts, n = N) {
  if (pts.length === 1) return Array(n).fill(pts[0]);
  const d = [0];
  for (let i = 1; i < pts.length; i++) d.push(d[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const L = d[d.length - 1] || 1e-6;
  const out = [];
  let j = 1;
  for (let k = 0; k < n; k++) {
    const t = (L * k) / (n - 1);
    while (j < d.length - 1 && d[j] < t) j++;
    const a = pts[j - 1], b = pts[j];
    const seg = d[j] - d[j - 1] || 1e-6;
    const u = Math.min(1, Math.max(0, (t - d[j - 1]) / seg));
    out.push([a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u]);
  }
  return out;
}

function bbox(strokes) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const s of strokes) for (const [x, y] of s) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
}

// 사용자 글씨를 기준 글자의 크기·위치에 맞춤(균일 배율) — 글씨를 작게/치우쳐 써도 모양을 비교
function normalize(user, ref) {
  const bu = bbox(user), br = bbox(ref);
  const su = Math.max(bu.w, bu.h, 0.05), sr = Math.max(br.w, br.h, 0.05);
  const k = sr / su;
  return user.map((s) => s.map(([x, y]) => [br.cx + (x - bu.cx) * k, br.cy + (y - bu.cy) * k]));
}

function meanDist(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += Math.hypot(a[i][0] - b[i][0], a[i][1] - b[i][1]);
  return s / a.length;
}

export const VERDICT_TEXT = {
  good: '잘 썼어요',
  near: '거의 맞았어요',
  order: '획순을 다시 확인하세요',
  retry: '다시 연습해보세요',
  empty: '아직 쓰지 않았어요',
};

export function judge(userStrokes, refMedians) {
  if (!userStrokes || !userStrokes.length) return { verdict: 'empty', text: VERDICT_TEXT.empty, messages: [], per: [] };
  const ref = refMedians.map((s) => resample(s));
  const user = normalize(userStrokes, refMedians).map((s) => resample(s));
  const nu = user.length, nr = ref.length;
  const msgs = [];
  const per = new Array(nu).fill('ok');

  // 거리 행렬
  const fwd = user.map((u) => ref.map((r) => meanDist(u, r)));
  const rev = user.map((u) => ref.map((r) => meanDist([...u].reverse(), r)));

  // 같은 순번끼리 비교 (획순 그대로 썼다고 가정)
  const inOrder = [];
  for (let i = 0; i < Math.min(nu, nr); i++) inOrder.push(fwd[i][i]);

  // 각 사용자 획이 가장 닮은 기준 획
  const best = user.map((_, i) => {
    let bj = 0, bd = Infinity;
    for (let j = 0; j < nr; j++) if (fwd[i][j] < bd) { bd = fwd[i][j]; bj = j; }
    return { j: bj, d: bd };
  });

  const GOOD = 0.085, NEAR = 0.14, BAD = 0.2;
  let orderIssues = 0, dirIssues = 0, shapeBad = 0, shapeNear = 0;

  for (let i = 0; i < Math.min(nu, nr); i++) {
    const d = inOrder[i];
    const u = user[i], r = ref[i];
    const startD = Math.hypot(u[0][0] - r[0][0], u[0][1] - r[0][1]);
    const endD = Math.hypot(u[N - 1][0] - r[N - 1][0], u[N - 1][1] - r[N - 1][1]);
    if (d <= GOOD) continue;
    // 방향이 반대인지
    if (rev[i][i] < d * 0.6 && rev[i][i] <= NEAR) {
      dirIssues++; per[i] = 'order';
      msgs.push(`${i + 1}번째 획의 쓰는 방향이 반대예요 (시작점과 끝점을 확인하세요).`);
      continue;
    }
    // 다른 순번의 기준 획과 더 잘 맞으면 획순 문제
    if (best[i].j !== i && best[i].d <= NEAR && best[i].d < d * 0.7) {
      orderIssues++; per[i] = 'order';
      msgs.push(`${i + 1}번째로 쓴 획은 기준 ${best[i].j + 1}번째 획과 비슷해요.`);
      continue;
    }
    if (d <= NEAR) {
      shapeNear++; per[i] = 'near';
      if (startD > 0.15) msgs.push(`${i + 1}번째 획의 시작 위치를 확인하세요.`);
      else if (endD > 0.15) msgs.push(`${i + 1}번째 획의 끝 위치를 확인하세요.`);
      else msgs.push(`${i + 1}번째 획의 모양·길이를 조금 더 맞춰 보세요.`);
    } else {
      shapeBad++; per[i] = 'bad';
      msgs.push(`${i + 1}번째 획의 위치나 모양이 기준과 많이 달라요.`);
    }
  }
  for (let i = nr; i < nu; i++) per[i] = 'extra';

  let verdict;
  const countDiff = nu - nr;
  if (countDiff !== 0) {
    msgs.unshift(`획수가 달라요 — 기준 ${nr}획, 쓴 획 ${nu}획.`);
    const okish = shapeBad === 0 && orderIssues + dirIssues === 0;
    verdict = Math.abs(countDiff) === 1 && okish ? 'near' : 'retry';
  } else if (orderIssues + dirIssues > 0 && shapeBad <= 1) {
    verdict = 'order';
  } else if (shapeBad > 0) {
    verdict = shapeBad <= Math.max(1, Math.floor(nr / 6)) && orderIssues + dirIssues === 0 ? 'near' : 'retry';
  } else if (shapeNear > Math.max(2, Math.ceil(nr / 3))) {
    verdict = 'near';
  } else if (shapeNear > 0) {
    verdict = 'near';
  } else {
    verdict = 'good';
  }
  if (verdict === 'good') msgs.length = 0;
  return { verdict, text: VERDICT_TEXT[verdict], messages: msgs.slice(0, 5), per, countUser: nu, countRef: nr };
}

// 문제 채점용: good/near 는 정답으로 인정
export function isPass(v) { return v === 'good' || v === 'near'; }
