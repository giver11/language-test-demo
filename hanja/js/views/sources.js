import * as D from '../data.js';
import { esc, statusBadge, daehanFooter } from '../ui.js';

export default async function (view) {
  const provs = await D.providers();
  const stats = await D.stats();
  const meta = await D.dictMeta();
  const blocks = [];
  for (const p of provs) {
    const src = await D.sources(p.id);
    const lv = await D.levels(p.id);
    blocks.push(`<div class="card">
      <div class="spread"><h2 class="mt0" style="margin:0">${esc(p.name)}</h2><span class="badge ${p.operating2026 ? 'official' : 'missing'}">2026 시행 ${p.operating2026 ? '확인' : '확인 필요'}</span></div>
      <div class="small">${esc(p.examName)} · ${esc(p.mode)}</div>
      <div class="small">시행 근거: ${esc(p.operatingSource)}</div>
      <div class="small">기출문제: ${esc(p.pastExamPolicy)} <a href="${esc(p.pastExamUrl)}" target="_blank" rel="noopener">공식 기출문제 보기 ↗</a></div>
      <div class="table-wrap" style="margin-top:10px"><table><thead><tr><th>급수</th><th>배정(공식 표기)</th><th>앱 등록</th><th>문항</th><th>시간</th><th>합격기준</th><th>상태</th></tr></thead><tbody>
        ${lv.levels.map((l) => `<tr><td>${esc(l.name)}</td><td>${l.selectedCount ? `선정 ${l.selectedCount.toLocaleString()} · 평가 ` : ''}${l.readCount ? l.readCount.toLocaleString() : (l.scopeFrom ? '별도 없음(공식)' : '확인 필요')}${l.writeCount ? ` / 쓰기 ${l.writeCount.toLocaleString()}` : ''}</td><td>${l.dataCount ? l.dataCount.toLocaleString() : 0}자</td>
          <td>${l.exam.questionCount != null ? l.exam.questionCount : '-'}</td><td>${l.exam.timeMin ? l.exam.timeMin + '분' : '-'}</td><td class="small">${esc(l.exam.passRule || '-')}</td><td>${statusBadge(l.hasData ? l.status.hanja : 'missing')}</td></tr>`).join('')}
      </tbody></table></div>
      ${p.id === 'daehan' ? daehanFooter() : ''}
      <h3>출처</h3><div class="src-list">${src.map((s) => `<div style="margin-bottom:8px">${statusBadge(s.status === 'unreachable' ? 'missing' : s.status === 'image-only' ? 'partial' : s.status)} <a href="${esc(s.sourceUrl)}" target="_blank" rel="noopener">${esc(s.sourceName)}</a> · 확인 ${esc(s.verifiedAt)}${s.note ? `<br><span class="small">${esc(s.note)}</span>` : ''}</div>`).join('')}</div>
    </div>`);
  }
  view.innerHTML = `
    <h1>데이터 출처 · 검증 상태</h1>
    <p class="sub">공식 자료를 가장 우선하며, 확인되지 않은 항목은 “공식 자료 확인 필요”로 표시합니다. AI가 급수별 한자를 임의로 만들지 않습니다.</p>
    <div class="card flat"><b>등록 현황</b><div class="small">공통 사전 ${stats.dictionary.toLocaleString()}자 · 획순 데이터 ${stats.strokes.toLocaleString()}자 · 한자어 ${stats.words.toLocaleString()}개 · 사자성어 ${stats.idioms}개</div></div>
    ${blocks.join('')}
    <div class="card">
      <h2 class="mt0">공통 데이터 · 라이선스</h2>
      <div class="src-list">
        <p><b>한국어문회 배정한자</b> — 한국어문회 홈페이지 학습자료 xls를 CSV로 변환한 공개 데이터셋 <a href="https://github.com/rycont/hanja-grade-dataset" target="_blank" rel="noopener">rycont/hanja-grade-dataset</a> (데이터 저작권: 한국어문회).</p>
        <p><b>훈음·한자어 독음·빈도</b> — <a href="https://github.com/libhangul/libhangul" target="_blank" rel="noopener">libhangul</a> data/hanja (BSD 3-Clause, Choe Hwanjin).</p>
        <p><b>획순</b> — <a href="https://github.com/chanind/hanzi-writer-data" target="_blank" rel="noopener">hanzi-writer-data</a> / Make Me a Hanzi (Arphic Public License). ${esc(meta.strokeNote || '')}</p>
        <p><b>사자성어 뜻풀이·예문, 반의/유의 한자 쌍, 모든 문제</b> — 이 앱에서 직접 작성한 자료(sourceType: original). 실제 기출문제를 복제하지 않았습니다.</p>
        <p><b>한자 예문 · 부수 이야기 · 진단/게임/시험지 문항</b> — 이 앱에서 직접 작성하거나 공식 배정한자·훈음으로 즉석 생성(sourceType: original).</p>
        <p><b>헷갈리는 한자(모양 유사)</b> — Make Me a Hanzi 획순 중심선을 이미지로 바꿔 계산한 유사도(외부 문제·해설 미사용).</p>
        <p><b>상공회의소 일부 희귀자 훈음</b> — 대법원 인명용 한자 조회(공공 서비스) 결과로 보완.</p>
        <p><b>카메라 검색(실험)</b> — Tesseract.js(Apache-2.0)를 기기 안에서 실행. 사진은 서버로 보내지 않음.</p>
        <p><b>출처 구분</b> — original(자체 제작) · official-fact(기관 공식 사실 정보: 배정한자·급수·일정·문항 수·합격 기준) · public-domain(공개 라이선스/공공 자료).</p>
        <p><b>저작권 때문에 넣지 않은 자료</b> — 기관 공식 기출문제 원문(링크만 제공), 출판사 문제집·교재 문제, 다른 한자 앱·블로그의 문제·해설·예문, 시중 사전의 뜻풀이 문장. 출처·권리가 불분명한 자료는 넣지 않았습니다.</p>
        <p><b>필기 판정</b> — 브라우저에서 입력 획 좌표와 획순 데이터의 중심선을 비교(획수·순서·시작/끝 위치·경로 거리). 유료 API·AI 채점 없음.</p>
      </div>
    </div>`;
}
