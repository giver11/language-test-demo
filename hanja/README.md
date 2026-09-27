# 한자패스 — 통합 한자 자격시험 학습 앱 (MVP)

한국어문회 · 대한검정회 한자 자격시험 대비용 모바일 우선 웹앱.
(한자교육진흥회·대한상공회의소는 공식 배정한자 파일 미확보로 2026-09-28 지원 목록에서 제외 — 조사 결과는 `scripts/providers_meta.py`에 보존, `ENABLED`에 추가하면 복원)
기존 TOPIK/IELTS/HSK 앱과 코드·데이터를 공유하지 않는 **독립 프로젝트**입니다 (이 폴더만으로 동작).

- 배포: https://giver11.github.io/language-test-demo/hanja/
- 서버·로그인·유료 API 없음. 학습 기록은 브라우저 localStorage(`hanjaPass.v1`)에 기관별로 분리 저장.

## 구조

```
hanja/
  index.html, css/, js/            정적 SPA (빌드 도구 없음, ES Modules)
  data/dictionary/                 공통 한자 사전(hanja.json) · 한자어 · 사자성어 · 반의/유의 쌍
  data/providers/{eomunhoe,daehan}/
      levels.json                  급수 체계 · 배정 수 · 문항수 · 시간 · 합격기준 · 검증 상태
      hanja-mapping.json           기관별 급수 ↔ 한자 매핑(읽기 급수 l, 쓰기 시작 급수 w)
      exam-types.json              기관별 문제유형/배분
      words-mapping.json, idioms-mapping.json, sources.json
  data/schedules/{provider}-2026.json   연도별 시험일정 (2027년은 파일만 추가)
  data/questions/{provider}/{level}.json 자체 제작 문제은행(sourceType: original-practice)
  data/strokes/{UNICODE}.json      획순 데이터(hanzi-writer-data)
  scripts/build_data.py            원천 자료 → data/ 생성
  tests/e2e.py                     실제 브라우저 E2E (TEST 1~16 + 모바일 터치 필기)
  tests/judge.test.mjs             필기 판정 보정 테스트
```

## 데이터 원칙
- 공식 자료 우선. 확인되지 않은 항목은 `공식 자료 확인 필요`로 표시하고 임의 생성하지 않음.
- 공식 기출문제는 복제하지 않고 공식 페이지 링크로 연결. 앱 문제는 모두 “기출유형 연습 · 실전 유사문제”.
- 출처·검증일은 앱의 **더보기 → 데이터 출처** 화면과 `data/providers/*/sources.json`에 기록.

## 공식 배정한자 파일 추가 방법 (대한검정회 나머지 급수 등)
공식 파일(hwp/zip/이미지)을 `c,level` 형식 CSV로 변환해 `hanja-mapping.json`의 `items`에
`{"c": "字", "l": "<급수 id>", "w": "<쓰기 시작 급수 id 또는 null>"}`로 넣고, `levels.json`의 `hasData`를 true로 바꾼 뒤
`scripts/build_data.py`의 `gen_bank` 호출을 추가하면 문제은행·비교·모의시험이 자동으로 열립니다.

## 라이선스 / 출처
- 한국어문회 배정한자: 공식 xls 변환본 rycont/hanja-grade-dataset (데이터 저작권 한국어문회)
- 훈음·한자어 독음·빈도: libhangul data/hanja (BSD 3-Clause)
- 획순: hanzi-writer-data / Make Me a Hanzi (Arphic Public License) — 중국 표준 필순 기반
- 사자성어 뜻풀이·예문, 반의/유의 쌍, 문제: 자체 작성

## 테스트
```
python3 -m http.server 8765   # 저장소 루트에서
python3 hanja/tests/e2e.py http://localhost:8765/hanja/
node hanja/tests/judge.test.mjs
```
