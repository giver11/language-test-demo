# language-test-demo
Free demo for IELTS, TOPIK and HSK learners

## 자동 테스트 · 배포 (PC 없이 스마트폰에서 확인)
- 배포: `main` 에 push 하면 GitHub Pages(Deploy from branch)가 자동 배포 → https://giver11.github.io/language-test-demo/
- `CI tests` (`.github/workflows/ci.yml`): push 마다 정적 검사(누락 파일·import·경로·문법·API/CORS 설정) + 모바일 에뮬레이션 E2E (한자·TOPIK·IELTS·HSK)
- `Live check` (`.github/workflows/live.yml`): Pages 배포가 끝나면 **실제 배포 URL**과 **실제 Cloudflare Workers AI**(CORS 포함)로 검사. 매일 09:17 KST 자동 실행, Actions 탭 → Live check → Run workflow 로 수동 실행 가능
- 결과 확인: GitHub 앱/모바일 웹 → 저장소 → Actions → 실행 기록 (실패 시 빨간 X, 요약 주석에 항목별 PASS/FAIL)
- AI 는 `api/worker.js` (Cloudflare Workers AI 무료 한도) 만 사용. 프론트엔드에 API KEY 없음
