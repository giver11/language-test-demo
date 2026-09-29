/* IELTS V2: English interface.
   The shared V2 shell/core render Korean UI copy (TOPIK/HSK keep it). For the IELTS app only,
   this layer translates visible UI text and form attributes to English as they are rendered.
   It never touches learning data, AI chat messages, user input, or any audio/TTS logic. */
(function(){
  'use strict';
  if (!window.CONFIG || window.CONFIG.id !== 'ielts') return;
  document.documentElement.lang = 'en';

  var HANGUL = /[가-힯]/;
  var OFFICIAL = '공식 사이트 확인';
  var EXACT = {
    '점수 향상 코치': 'Score Coach',
    '단어·실전문제·발음·오답복습을 한 번에 훈련합니다.': 'Train vocabulary, practice tests, pronunciation and mistake review in one place.',
    '초대 코드': 'Invite code',
    'V2 시작하기': 'Start',
    '초대 코드를 다시 확인해 주세요.': 'Please check your invite code.',
    '← V2 앱 선택': '← All V2 apps',
    '오늘': 'Today',
    '단어': 'Words',
    '실전문제': 'Practice Test',
    '스피킹랩': 'Speaking Lab',
    'AI 대화': 'AI Conversation',
    '시험 일정': 'Exam Schedule',
    '스마트복습': 'Smart Review',
    '분석': 'Progress',
    '나만의 오늘 학습': "Today's Study",
    '목표 설정 필요': 'Set your goal',
    '학습 트랙': 'Learning Track',
    '학습 급수': 'Learning Track',
    '하루 학습': 'Daily Study',
    '준비도': 'Readiness',
    '목표를 먼저 알려주세요': 'Tell us your goal first',
    '목표 점수·급수': 'Target band score',
    '시험일': 'Exam date',
    '하루 학습시간(분)': 'Daily study time (min)',
    '맞춤 계획 만들기': 'Create my plan',
    '시험일을 설정하면 남은 기간에 맞춰 학습 우선순위를 조정합니다.': "Set your exam date and we'll prioritise your study for the time left.",
    '시험일입니다. 새 내용보다 오답·말하기 복습을 우선하세요.': "It's exam day. Review mistakes and speaking rather than new material.",
    'D-7 집중 · 오답 50% / 실전 30% / 말하기 20%로 압축 복습합니다.': 'D-7 focus · Mistakes 50% / Practice 30% / Speaking 20% intensive review.',
    'D-30 실전 · 실전 40% / 약점복습 35% / 말하기 25%로 진행합니다.': 'D-30 practice · Practice 40% / Weak points 35% / Speaking 25%.',
    'D-90 강화 · 새 학습 40% / 약점복습 35% / 말하기 25%로 진행합니다.': 'D-90 build-up · New material 40% / Weak points 35% / Speaking 25%.',
    '기초 구축 · 새 학습 50% / 약점복습 30% / 말하기 20%로 진행합니다.': 'Foundations · New material 50% / Weak points 30% / Speaking 20%.',
    '시험 필수 단어': 'Essential Exam Vocabulary',
    '뜻 보기': 'Show meaning',
    '🔊 단어 발음': '🔊 Word',
    '🔊 예문 발음': '🔊 Example',
    '🐢 천천히': '🐢 Slow',
    '다시 복습': 'Review again',
    '알아요 · +5 XP': 'I know it · +5 XP',
    '실전 문제': 'Practice Test',
    '🔊 문제 듣기': '🔊 Play Audio',
    '🔊 정답 듣기': '🔊 Play Answer',
    '다음 문제': 'Next question',
    '오답입니다. 스마트 복습에 추가했습니다.': 'Incorrect. Added to Smart Review.',
    '정답입니다. +10 XP': 'Correct! +10 XP',
    '원어민 쉐도잉 진단': 'Native Shadowing Check',
    '▶ 듣기': '▶ Listen',
    '● 발음 진단': '● Check pronunciation',
    '● 다시 말하기': '● Try again',
    '● 듣는 중…': '● Listening…',
    '다음 문장': 'Next sentence',
    '음성을 듣고 따라 말해 보세요.': 'Listen, then repeat the sentence.',
    '마이크를 점검하고 있습니다…': 'Checking your microphone…',
    '지금 문장을 또렷하게 말해 주세요. 최대 15초 동안 듣습니다.': 'Say the sentence clearly now. Listening for up to 15 seconds.',
    '마이크 권한이 차단되어 있습니다. 주소창의 자물쇠 → 마이크 → 허용으로 변경해 주세요.': 'Microphone access is blocked. Tap the lock in the address bar → Microphone → Allow.',
    '마이크 권한이 차단되었습니다. 주소창의 자물쇠에서 마이크를 허용해 주세요.': 'Microphone access is blocked. Allow the microphone from the lock in the address bar.',
    '사용할 수 있는 마이크를 찾지 못했습니다.': 'No microphone was found.',
    '다른 앱이 마이크를 사용 중입니다. 통화·녹음 앱을 닫고 다시 시도해 주세요.': 'Another app is using the microphone. Close call or recording apps and try again.',
    '마이크를 시작할 수 없습니다. 브라우저를 다시 실행해 주세요.': 'The microphone could not start. Please restart the browser.',
    '마이크를 시작하지 못했습니다. 페이지를 새로고침한 뒤 다시 시도해 주세요.': 'The microphone could not start. Refresh the page and try again.',
    '마이크 장치를 사용할 수 없습니다. 다른 녹음 앱을 닫아 주세요.': 'The microphone is unavailable. Close other recording apps.',
    '말소리가 감지되지 않았습니다. 발음 진단을 누른 뒤 바로 말해 주세요.': 'No speech detected. Start speaking right after tapping Check pronunciation.',
    '말소리를 문장으로 인식하지 못했습니다. 휴대전화를 20~30cm 거리에 두고 다시 말해 주세요.': 'Your speech could not be recognised. Hold the phone 20–30 cm away and try again.',
    '음성이 들리지 않았습니다. 조용한 곳에서 버튼을 누른 직후 말해 주세요.': 'No voice heard. In a quiet place, speak right after tapping the button.',
    '음성 인식 서버에 연결하지 못했습니다. 인터넷 연결을 확인해 주세요.': 'Could not reach the speech recognition service. Check your internet connection.',
    '음성 인식이 중단되었습니다. 다시 시도해 주세요.': 'Speech recognition stopped. Please try again.',
    '이 브라우저는 음성 인식을 지원하지 않습니다. Android Chrome 또는 데스크톱 Chrome을 이용해 주세요.': 'This browser does not support speech recognition. Please use Android Chrome or desktop Chrome.',
    '이 브라우저에서는 음성 인식이 지원되지 않습니다. 텍스트 입력을 이용해 주세요.': 'Speech recognition is not supported in this browser. Please type instead.',
    '말씀하세요…': 'Go ahead, speak…',
    '새 대화': 'New chat',
    '● 말하기': '● Speak',
    '보내기': 'Send',
    '대화 피드백': 'Conversation feedback',
    '학습 피드백': 'Learning feedback',
    '대화에서 어려웠던 표현은 스마트 복습에 저장할 수 있습니다.': 'Save difficult expressions from the chat to Smart Review.',
    '복습에 저장': 'Save to review',
    '저장됨': 'Saved',
    '답을 한두 문장 더 확장해 보세요. 이유와 예시를 붙이면 Speaking 연습에 더 좋습니다.': 'Try extending your answer by one or two sentences. Reasons and examples make better Speaking practice.',
    '좋습니다. 다음 답변에서도 이유·예시를 붙여 자연스럽게 확장해 보세요.': 'Good. Keep extending your answers naturally with reasons and examples.',
    '짧은 답 뒤에 이유나 경험을 한 문장 더 붙여 보세요.': 'After a short answer, add one more sentence with a reason or an experience.',
    '대화를 계속 이어갈 수 있는 길이입니다. 조사와 연결어를 함께 점검해 보세요.': 'Good length to keep the conversation going. Check your linking words too.',
    'AI 실시간 대화': 'Live AI conversation',
    'AI와 실전 대화': 'Practice conversation with AI',
    'AI가 답변을 준비하고 있습니다…': 'AI is preparing a reply…',
    'AI 튜터가 답변을 준비하고 있습니다…': 'AI tutor is responding…',
    'AI 연결이 일시적으로 불안정합니다. 다시 시도해 주세요.': 'The AI connection is unstable. Please try again.',
    'AI 튜터에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.': 'Cannot reach the AI tutor. Please try again shortly.',
    '오늘 AI 서버의 무료 사용량이 모두 소진되었습니다. 내일 다시 시도해 주세요.': "Today's free AI capacity has been used up. Please try again tomorrow.",
    '서버 AI 연결 전: 안전한 연습 대화 모드입니다. Work에서 AI Gateway를 연결하면 자유 대화로 전환됩니다.': 'Practice mode: the AI server is not connected yet.',
    '오늘의 무료 AI 대화 5회를 모두 사용했습니다.': "You've used all 5 free AI conversations for today.",
    'Premium/AI 플랜에서는 제한이 해제됩니다.': 'The limit is removed on the Premium/AI plan.',
    '2026 시험 일정': '2026 Exam Schedule',
    'IELTS 대한민국 시험 일정 (컴퓨터 시험)': 'IELTS test dates in Korea (computer-delivered)',
    'IELTS 대한민국 시험 일정': 'IELTS test dates in Korea',
    '목표 시험': 'My exam',
    '목표 시험 변경': 'Change target exam',
    'IELTS 시험일 선택': 'Choose your IELTS date',
    '컴퓨터 시험은 거의 매일 열려 고정 회차가 없습니다. 예약했거나 목표로 하는 날짜를 저장하세요.': 'Computer-delivered tests run almost every day, so there are no fixed sessions. Save the date you booked or are aiming for.',
    '목표일 저장': 'Save date',
    '목표일 설정': 'Set as target',
    '예약:': 'Book:',
    'British Council 예약': 'British Council booking',
    'IDP IELTS 예약': 'IDP IELTS booking',
    '2026년 3월 22일부터 국내 IELTS는 컴퓨터 시험만 시행됩니다. 서울·부산·대구·대전·인천 시험장에서 주 6~7일 운영되며, 날짜별 잔여 좌석은 예약 페이지에서 확인하세요. 성적은 보통 1~2일 안에 발표됩니다.': 'Since 22 March 2026, IELTS in Korea is computer-delivered only. Tests run 6–7 days a week in Seoul, Busan, Daegu, Daejeon and Incheon; check seat availability on the booking pages. Results are usually released within 1–2 days.',
    '공식 일정·예약 확인': 'Official dates & booking',
    '고정 날짜 대신 시험센터별 실시간 일정이 제공됩니다.': 'Test centres publish live availability instead of fixed dates.',
    '나만의 오답 복습': 'Review Mistakes',
    '복습 완료': 'Done',
    '아직 오답이 없습니다. 실전 문제와 발음 진단을 먼저 완료하세요.': 'No mistakes yet. Try the Practice Test and pronunciation check first.',
    '점수 향상 분석': 'Progress Analysis',
    '총 XP': 'Total XP',
    '완료 활동': 'Activities done',
    '정답률': 'Accuracy',
    '복습 항목': 'Review items',
    'V2 분석 방식': 'How progress is analysed',
    '문제 정답률, 발음 점수, 오답 횟수를 함께 사용해 다음 복습 항목을 자동으로 정합니다.': 'Accuracy, pronunciation scores and mistake counts together decide what you review next.',
    '음성 엔진을 불러오지 못했습니다.': 'Could not load the speech engine.',
    '이 브라우저는 음성 재생(Web Speech)을 지원하지 않습니다.': 'This browser does not support speech playback (Web Speech).',
    '이 브라우저에서 음성을 재생할 수 없습니다.': 'Audio cannot be played in this browser.',
    '재생할 문장이 없습니다.': 'Nothing to play.',
    '🔊 버튼을 다시 눌러 주세요 (브라우저가 자동 재생을 막았습니다).': 'Tap 🔊 again (the browser blocked autoplay).',
    '매우 정확합니다.': 'Very accurate.',
    '좋습니다. 틀린 단어만 다시 연습해 보세요.': 'Good. Practise just the words you missed.',
    '문장을 천천히 끊어 다시 말해 보세요.': 'Say it again slowly, phrase by phrase.'
  };
  var ATTR = {
    '대화 모드': 'Conversation mode',
    '메시지를 입력하세요': 'Type a message',
    '예: IELTS 7.0': 'e.g. IELTS 7.0',
    'IELTS 모듈': 'IELTS module',
    '목표 IELTS 시험일': 'Target IELTS date',
    '학습 급수 선택': 'Choose learning track',
    '하루 학습시간 선택': 'Choose daily study time'
  };
  var PATTERNS = [
    [/^목표 (.+?) · 하루 (\d+)분(.*)$/, function(m, g, n, rest){ return 'Goal ' + g + ' · ' + n + ' min/day' + rest; }],
    [/^(\d+)분$/, '$1 min'],
    [/^🔥 (\d+)일 연속$/, function(m, n){ return '🔥 ' + n + '-day streak'; }],
    [/^오늘 (\d+)분 · (\d+)개 활동$/, "Today: $1 min · $2 activities"],
    [/^현재 스마트 복습 항목 (\d+)개 · 대화\/발음\/실전문제를 섞어 학습합니다\.$/, 'Smart Review items: $1 · mixing conversation, pronunciation and practice tests.'],
    [/^예문: ([\s\S]*)$/, 'Example: $1'],
    [/^뜻: ([\s\S]*)$/, 'Meaning: $1'],
    [/^(.+) 맞춤 트레이닝$/, '$1 · Personalised training'],
    [/^무료 AI 대화 오늘 (\d+)회 남음$/, '$1 free AI conversations left today'],
    [/^🔊 (.+) 발음 재생 중$/, '🔊 Playing $1 audio'],
    [/^(IELTS) 음성: (.+)$/, '$1 voice: $2'],
    [/^기기의 (\S+) 기본 음성으로 재생합니다\.$/, "Using the device's default $1 voice."],
    [/^기기의 (\S+) 음성을 재생하지 못했습니다\((.*)\)\. 볼륨·무음 모드와 기기 음성 설정을 확인해 주세요\.$/, 'Could not play the $1 voice ($2). Check volume, silent mode and device voice settings.'],
    [/^재생할 (.+) 문장이 없습니다\.$/, 'No $1 sentence to play.'],
    [/^하루 학습시간을 (\d+)분으로 변경했습니다\.$/, 'Daily study time set to $1 min.'],
    [/^시험 (\d{4}-\d{2}-\d{2}) · D-(\d+)$/, 'Exam $1 · D-$2'],
    [/^접수 (.+) · 발표 (.+)$/, function(m, a, b){ return 'Registration ' + (a === OFFICIAL ? 'see official site' : a) + ' · Results ' + (b === OFFICIAL ? 'see official site' : b); }],
    [/^(\d+)주 후$/, 'In $1 weeks'],
    [/^Source: (.+?) 공식 예약 일정 · Last verified: (.*)$/, 'Source: $1 official booking · Last verified: $2'],
    [/^([\s\S]*?) · 확인일 (.*)$/, '$1 · Verified $2'],
    [/^(\d+)% 문장 일치 · 인식 결과: ([\s\S]*?) · (.+)$/, function(m, s, heard, verdict){ return s + '% match · Heard: ' + heard + ' · ' + (EXACT[verdict] || verdict); }],
    [/^인식 중: ([\s\S]*)$/, 'Recognising: $1'],
    [/^마이크 오류: ([\s\S]*)$/, 'Microphone error: $1'],
    [/^음성 인식 오류: ([\s\S]*)$/, 'Speech recognition error: $1'],
    [/^해설: ([\s\S]*)$/, 'Explanation: $1'],
    [/^복습 포인트: ([\s\S]*)$/, 'Review: $1']
  ];
  /* Learning content and conversation stay as they are. */
  var SKIP = '#conversationLog, #translation, script, style, textarea';

  function translate(text){
    if (!HANGUL.test(text)) return null;
    var lead = text.match(/^\s*/)[0], trail = text.match(/\s*$/)[0], core = text.trim();
    if (EXACT[core]) return lead + EXACT[core] + trail;
    for (var i = 0; i < PATTERNS.length; i++) {
      var p = PATTERNS[i];
      if (p[0].test(core)) {
        var out = core.replace(p[0], p[1]);
        if (!HANGUL.test(out) || out !== core) return lead + out + trail;
      }
    }
    return null;
  }
  function skip(el){ return el && el.closest && el.closest(SKIP); }
  function fixText(node){
    if (!node.nodeValue || skip(node.parentElement)) return;
    var t = translate(node.nodeValue);
    if (t !== null && t !== node.nodeValue) node.nodeValue = t;
  }
  function fixAttrs(el){
    if (!el.getAttribute || skip(el)) return;
    ['placeholder', 'aria-label', 'title'].forEach(function(a){
      var v = el.getAttribute(a);
      if (v && HANGUL.test(v)) { var t = ATTR[v.trim()] || (translate(v) || '').trim(); if (t) el.setAttribute(a, t); }
    });
  }
  function walk(root){
    if (!root) return;
    if (root.nodeType === 3) { fixText(root); return; }
    if (root.nodeType !== 1) return;
    fixAttrs(root);
    var w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT), n;
    while ((n = w.nextNode())) { if (n.nodeType === 3) fixText(n); else fixAttrs(n); }
  }
  new MutationObserver(function(list){
    list.forEach(function(m){
      if (m.type === 'characterData') fixText(m.target);
      else if (m.type === 'attributes') fixAttrs(m.target);
      else m.addedNodes.forEach(walk);
    });
  }).observe(document.documentElement, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['placeholder', 'aria-label', 'title'] });
  walk(document.body);
  window.IELTS_I18N = { translate: translate };
})();
