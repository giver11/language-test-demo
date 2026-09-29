// 요금제 기능 플래그 (MVP: 결제·잠금을 강제하지 않음 — ENFORCE=false)
// 나중에 결제를 붙일 때 ENFORCE 와 사용자 tier 만 바꾸면 되도록 기능별 최소 요금제를 한곳에 모아 둔다.
export const ENFORCE = false;
export const TIERS = [
  { id: 'free', name: 'FREE', desc: '기관·급수 학습, 플래시카드, 기본 퀴즈, 쓰기, 검색, 시험일정' },
  { id: 'pass', name: 'PASS', desc: 'Exam Coach 전체, 모의시험 무제한, 헷갈리는 한자, 게임, 공유 카드' },
  { id: 'family', name: 'FAMILY', desc: 'PASS + 자녀 프로필 여러 개, 부모 모드·주간 리포트' },
  { id: 'teacher', name: 'TEACHER', desc: 'FAMILY + 선생님 모드(반·과제·시험지 생성·인쇄), SNS 콘텐츠 스튜디오' },
];
const RANK = { free: 0, pass: 1, family: 2, teacher: 3 };
export const FEATURES = {
  learn: 'free', flashcards: 'free', quiz: 'free', write: 'free', search: 'free', schedule: 'free', placement: 'free',
  coach: 'pass', mockUnlimited: 'pass', confuse: 'pass', games: 'pass', share: 'pass', camera: 'pass',
  profiles: 'family', parent: 'family',
  teacher: 'teacher', studio: 'teacher',
};
export function tierOf(st) { return (st && st.tier) || 'free'; }
export function need(feature) { return FEATURES[feature] || 'free'; }
export function can(feature, st) {
  if (!ENFORCE) return true;
  return RANK[tierOf(st)] >= RANK[need(feature)];
}
export function tierName(id) { return (TIERS.find((t) => t.id === id) || TIERS[0]).name; }
