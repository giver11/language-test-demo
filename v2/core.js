const EXAM_BANKS={"ielts":[{"q":"[Academic Reading] 연구 결과가 ‘일부 참가자에게만 효과가 있었다’고 한다. ‘모든 참가자에게 효과가 있었다’의 답은?","a":["TRUE","FALSE","NOT GIVEN"],"correct":1},{"q":"[Academic Writing Task 1] 도표 개요(Overview)에 가장 적절한 문장은?","a":["Overall, online sales rose while store sales declined.","I like online shopping.","The chart has many colours."],"correct":0},{"q":"[Academic Writing Task 2] 주장에 근거를 연결하는 가장 좋은 방식은?","a":["주장만 반복한다","구체적 이유와 관련 예시를 제시한다","어려운 단어만 나열한다"],"correct":1},{"q":"[General Reading] 안내문에 ‘Refunds are available within 14 days with a receipt’라고 쓰였다. 영수증 없이 10일 뒤 환불 가능한가?","a":["Yes","No","Not stated"],"correct":1},{"q":"[General Writing Task 1] 공식 항의 편지의 알맞은 시작은?","a":["Hey there!","I am writing to complain about...","Give me my money."],"correct":1},{"q":"[Listening] ‘The meeting has been put off until Friday’와 같은 뜻은?","a":["회의가 취소됐다","회의가 금요일로 연기됐다","회의가 금요일 전에 열린다"],"correct":1},{"q":"[Speaking Part 2] 1~2분 답변을 확장하는 가장 좋은 구성은?","a":["주제·세부사항·이유·느낌","한 문장만 반복","암기한 답을 매우 빠르게 말하기"],"correct":0},{"q":"[General Reading] ‘Staff only beyond this point’의 의미는?","a":["직원만 출입 가능","누구나 출입 가능","직원 채용 중"],"correct":0}],"topik":[{"q":"[TOPIK I 어휘] ‘약속 시간에 늦어서 친구에게 (   ).’에 알맞은 말은?","a":["사과했습니다","출발했습니다","구경했습니다"],"correct":0},{"q":"[TOPIK I 문법] ‘비가 오(   ) 우산을 가져가세요.’에 알맞은 것은?","a":["니까","지만","거나"],"correct":0},{"q":"[TOPIK I 대화] 가: 주말에 뭐 했어요? 나: (   )","a":["영화를 봤어요.","네, 주말이에요.","두 시예요."],"correct":0},{"q":"[TOPIK II 문법] ‘열심히 준비한 (   ) 좋은 결과를 얻었다.’에 알맞은 것은?","a":["끝에","대신에","척하고"],"correct":0},{"q":"[TOPIK II 읽기] 글의 중심 생각을 찾을 때 가장 먼저 볼 것은?","a":["반복되는 핵심어와 결론","문장 길이","글자 모양"],"correct":0},{"q":"[TOPIK II 쓰기 53] 자료 설명에 필요한 것은?","a":["주요 수치의 비교와 변화","개인 감정만 쓰기","모든 숫자를 그대로 나열"],"correct":0},{"q":"[TOPIK II 쓰기 54] 논설문의 기본 구조는?","a":["서론-본론-결론","결론-제목-단어","예시만 나열"],"correct":0},{"q":"[TOPIK II 맥락] ‘교통이 편리한 반면에 임대료가 비싸다’에서 ‘반면에’의 기능은?","a":["대조","원인","시간"],"correct":0}],"hsk":[{"q":"[HSK 1-2] 올바른 어순은?","a":["我很喜欢汉语。","很我汉语喜欢。","汉语我喜欢很。"],"correct":0},{"q":"[HSK 2 듣기형] “他今天不来，因为生病了。”에서 오지 않는 이유는?","a":["生病了","下雨了","工作了"],"correct":0},{"q":"[HSK 3] 我每天早上___七点起床。","a":["在","从","向"],"correct":0},{"q":"[HSK 4] ‘虽然很累，但是他继续工作。’의 관계는?","a":["转折","因果","并列"],"correct":0},{"q":"[HSK 4] 올바른 어순은?","a":["请把门关上。","请门把关上。","把请关上门。"],"correct":0},{"q":"[HSK 5 읽기] ‘随着科技的发展，远程办公越来越普遍。’의 중심 내용은?","a":["远程办公日益普及","科技停止发展","人们不再工作"],"correct":0},{"q":"[HSK 6 맥락] ‘这个方案看似简单，实施起来却困难重重。’에서 ‘却’의 기능은?","a":["转折","递进","条件"],"correct":0},{"q":"[HSK 7-9] ‘因地制宜’와 가장 가까운 뜻은?","a":["根据实际情况采取办法","完全照搬别人的方法","不考虑环境"],"correct":0}]};window.CONFIG.questions=EXAM_BANKS[window.CONFIG.id]||window.CONFIG.questions;
const C=window.CONFIG,K='v2:'+C.id+':',q=s=>document.querySelector(s),qa=s=>document.querySelectorAll(s);let state=JSON.parse(localStorage[K+'state']||'{"xp":0,"done":0,"correct":0,"wrong":[],"streak":1}'),vocab=0,test=0,voice='female',voices=[];function save(){localStorage[K+'state']=JSON.stringify(state)}function start(){q('#gate').classList.add('hide');q('#app').classList.remove('hide');if(C.id==='topik'||C.id==='hsk')qa('.speaker .voice').forEach(x=>x.style.display=x.dataset.voice==='female'?'':'none');initVoices();showWord();render();setTimeout(initLevels,0);if(!localStorage[K+'profile'])q('#profile').classList.remove('hide')}q('#gateForm').onsubmit=e=>{e.preventDefault();if(q('#code').value.trim().toUpperCase()==='STEP10'){sessionStorage[K+'ok']='1';start()}else q('#gateErr').textContent='초대 코드를 다시 확인해 주세요.'};if(sessionStorage[K+'ok'])start();q('#profileForm').onsubmit=e=>{e.preventDefault();localStorage[K+'profile']=JSON.stringify({goal:q('#goal').value,date:q('#date').value,minutes:q('#minutes').value});q('#profile').classList.add('hide');render()};qa('.nav').forEach(b=>b.onclick=()=>{qa('.nav,.screen').forEach(x=>x.classList.remove('active'));b.classList.add('active');q('#'+b.dataset.page).classList.add('active');if(b.dataset.page==='words')showWord();if(b.dataset.page==='test')showQuestion();if(b.dataset.page==='review')showReview();if(b.dataset.page==='speaking')showVoiceInfo()});function initVoices(){const load=()=>{voices=speechSynthesis.getVoices().filter(v=>v.lang.toLowerCase().startsWith(C.lang.slice(0,2).toLowerCase()));showVoiceInfo()};load();speechSynthesis.onvoiceschanged=load;setTimeout(load,400);setTimeout(load,1200)}function render(){let p=JSON.parse(localStorage[K+'profile']||'{}'),ready=Math.min(95,20+state.done*4+state.correct*3);q('#appName').textContent=C.name;q('#heroTitle').textContent=C.hero;q('#heroText').textContent=C.description;q('#ready').textContent=ready+'%';q('#readyBar').style.width=ready+'%';q('#goalText').textContent=p.goal?`목표 ${p.goal} · 하루 ${p.minutes||10}분`:'목표 설정 필요';q('#xp').textContent=state.xp;q('#done').textContent=state.done;q('#accuracy').textContent=(state.correct+state.wrong.length)?Math.round(state.correct/(state.correct+state.wrong.length)*100)+'%':'—';q('#weak').textContent=state.wrong.length;q('#streak').textContent='🔥 '+state.streak+'일 연속';q('#todayCards').innerHTML=C.missions.map((m,i)=>`<article class="card action" data-go="${m.go}"><div>${m.icon}</div><h3>${m.title}</h3><p>${m.desc}</p><div class="meter"><i style="width:${i===0?35:10}%"></i></div></article>`).join('');qa('[data-go]').forEach(x=>x.onclick=()=>q(`.nav[data-page="${x.dataset.go}"]`).click())}function ensureWordAudio(){if(q('#wordAudio'))return;let box=document.createElement('div');box.id='wordAudio';let chooser=(C.id==='topik'||C.id==='hsk')?'':`<div class="speaker" style="justify-content:center;margin-top:20px"><button class="voice word-gender active" data-g="male">👨 남성</button><button class="voice word-gender" data-g="female">👩 여성</button></div>`;box.innerHTML=chooser+`<div class="row"><button id="playWord" class="btn soft">🔊 단어 발음</button><button id="playExample" class="btn soft">🔊 예문 발음</button><button id="playSlow" class="btn soft">🐢 천천히</button></div><p id="wordVoiceInfo" style="font-size:12px;color:#748097"></p>`;q('#flash').appendChild(box);qa('.word-gender').forEach(b=>b.onclick=e=>{e.stopPropagation();voice=b.dataset.g;qa('.word-gender,.speaker .voice').forEach(x=>x.classList.toggle('active',x.dataset.g===voice||x.dataset.voice===voice));showVoiceInfo();speakText(targetWord())});q('#playWord').onclick=e=>{e.stopPropagation();speakText(targetWord(),false)};q('#playExample').onclick=e=>{e.stopPropagation();speakText(C.words[vocab%C.words.length][2],false)};q('#playSlow').onclick=e=>{e.stopPropagation();speakText(targetWord(),true)}}function targetWord(){let w=C.words[vocab%C.words.length];return w[3]||w[0]}function showWord(){let w=C.words[vocab%C.words.length];q('#word').textContent=w[0];q('#meaning').textContent='뜻 보기';q('#example').textContent='예문: '+w[2];ensureWordAudio();showVoiceInfo()}q('#flash').onclick=()=>{let w=C.words[vocab%C.words.length];q('#meaning').textContent='뜻: '+w[1];q('#example').textContent='예문: '+w[2]};q('#know').onclick=()=>{state.xp+=5;state.done++;save();vocab++;showWord();render()};q('#again').onclick=()=>{state.wrong.push(C.words[vocab%C.words.length][0]);save();vocab++;showWord();render()};function voiceHints(kind){return kind==='female'?['female','samantha','zira','susan','aria','jenny','sunhi','jimin','seohyeon','soonbok','yujin','seoyeon','sora','yuna','선희','지민','서현','순복','유진','서연','소라','유나']:['male','david','daniel','mark','alex','james','guy','injoon','bongjin','gookmin','hyunsu','joon','young','minjun','강호','민준','현수','인준','국민','봉진']}function namedVoice(kind){let hints=voiceHints(kind);return voices.find(v=>hints.some(x=>v.name.toLowerCase().includes(x)))||null}function pickVoice(kind){let exact=namedVoice(kind);if(exact)return exact;if(voices.length>1)return voices[kind==='female'?voices.length-1:0];return voices[0]||null}function hasDistinctGenderVoices(){let m=namedVoice('male'),f=namedVoice('female');return !!(m&&f&&m.name!==f.name)}function cleanChinese(text){return text.replace(/[A-Za-zÀ-žāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜü\s]+/g,'').trim()||text}function remoteChinese(text,slow){let audio=new Audio('https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=zh-CN&q='+encodeURIComponent(cleanChinese(text)));audio.playbackRate=slow?.72:(voice==='male'?.88:1.04);audio.preservesPitch=false;audio.play().catch(()=>localSpeak(cleanChinese(text),slow));status((voice==='female'?'여성':'남성')+' 중국어 발음을 재생합니다.')}
function localSpeak(text,slow){speechSynthesis.cancel();let chosen=(C.id==='topik'||C.id==='hsk')?'female':voice,u=new SpeechSynthesisUtterance(text);u.lang=C.lang;u.rate=slow?.62:(chosen==='male'?.86:.92);u.pitch=chosen==='female'?1:.78;let selected=pickVoice(chosen);if(selected)u.voice=selected;u.onerror=()=>status('기기의 '+C.lang+' 음성을 불러오지 못했습니다. 휴대전화 설정에서 해당 언어 음성을 설치해 주세요.');speechSynthesis.speak(u);status(((C.id==='topik')?'한국어 여성':(C.id==='hsk')?'중국어 여성':chosen==='female'?'여성':'남성')+' '+C.name+' 발음을 재생합니다.')}function speakText(text,slow=false){localSpeak(C.id==='hsk'?cleanChinese(text):text,slow)}
function status(msg){if(q('#speechFeedback'))q('#speechFeedback').textContent=msg;if(q('#wordVoiceInfo'))q('#wordVoiceInfo').textContent=msg}
function showVoiceInfo(){let m=pickVoice('male'),f=pickVoice('female'),real=hasDistinctGenderVoices(),msg=C.id==='topik'?'한국어 여성 음성: '+(f?.name||'기기 기본 음성'):C.id==='hsk'?'중국어 여성 음성: '+(f?.name||'기기 중국어 음성 필요'):real?'남성: '+m.name+' · 여성: '+f.name:voices.length===1?'기기 '+C.name+' 음성 1개 감지 · 여성은 자연 음성, 남성은 낮은 음역 보정':voices.length>1?'남성·여성 이름 정보가 없는 기기 음성 감지 · 서로 다른 음성과 자연 음역 보정 사용':C.id==='hsk'?'중국어 온라인 음성을 준비 중':'기기 음성을 불러오는 중';if(q('#wordVoiceInfo'))q('#wordVoiceInfo').textContent=msg;if(q('#speechFeedback')&&q('#speechFeedback').textContent.includes('음성을 듣고'))q('#speechFeedback').textContent=msg}function adaptiveQuestion(){
 let list=C.questions||[],p=JSON.parse(localStorage[K+'profile']||'{}'),days=p.date?Math.max(0,Math.ceil((new Date(p.date+'T23:59:59')-new Date())/86400000)):999;
 if((C.id==='topik'||C.id==='hsk')&&state.wrong.length&&(days<=14||test%3===2)){
   let weak=[...state.wrong].reverse().find(w=>list.some(x=>x.q===w));
   if(weak){let hit=list.find(x=>x.q===weak);if(hit)return hit}
 }
 return list[test%list.length];
}
function showQuestion(){let x=adaptiveQuestion();q('#question').textContent=`${test+1}. ${x.q}`;q('#options').innerHTML=x.a.map((a,i)=>`<button class="option" data-i="${i}">${a}</button>`).join('');q('#testResult').textContent='';qa('.option').forEach(o=>o.onclick=()=>{qa('.option').forEach(z=>z.disabled=true);if(+o.dataset.i===x.correct){o.classList.add('good');state.correct++;state.xp+=10;q('#testResult').innerHTML='정답입니다. +10 XP<br><small>'+explainAnswer(x,true)+'</small>'}else{o.classList.add('bad');qa('.option')[x.correct].classList.add('good');state.wrong.push(x.q);q('#testResult').innerHTML='오답입니다. 스마트 복습에 추가했습니다.<br><small>'+explainAnswer(x,false)+'</small>'}state.done++;save();render()})}q('#nextQ').onclick=()=>{test++;showQuestion()};let sent=0;function showSentence(){let s=C.sentences[sent%C.sentences.length];q('#sentence').textContent=s[0];q('#translation').textContent=s[1];q('#speechFeedback').textContent='음성을 듣고 따라 말해 보세요.';showVoiceInfo()}qa('.speaker .voice').forEach(v=>v.onclick=()=>{voice=v.dataset.voice;qa('.speaker .voice,.word-gender').forEach(x=>x.classList.toggle('active',x.dataset.voice===voice||x.dataset.g===voice));speakText(q('#sentence').textContent)});q('#listen').onclick=()=>speakText(q('#sentence').textContent);q('#nextS').onclick=()=>{sent++;showSentence()};let recording=false;
q('#record').onclick=async()=>{if(recording)return;speechSynthesis.cancel();let SR=window.SpeechRecognition||window.webkitSpeechRecognition;if(!SR){q('#speechFeedback').textContent='이 브라우저는 음성 인식을 지원하지 않습니다. Android Chrome 또는 데스크톱 Chrome을 이용해 주세요.';return}q('#speechFeedback').textContent='마이크를 점검하고 있습니다…';if(navigator.mediaDevices&&navigator.mediaDevices.getUserMedia){try{let stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true}});stream.getTracks().forEach(t=>t.stop())}catch(err){let msg=err.name==='NotAllowedError'?'마이크 권한이 차단되어 있습니다. 주소창의 자물쇠 → 마이크 → 허용으로 변경해 주세요.':err.name==='NotFoundError'?'사용할 수 있는 마이크를 찾지 못했습니다.':err.name==='NotReadableError'?'다른 앱이 마이크를 사용 중입니다. 통화·녹음 앱을 닫고 다시 시도해 주세요.':'마이크를 시작할 수 없습니다. 브라우저를 다시 실행해 주세요.';q('#speechFeedback').textContent=msg;return}}setTimeout(()=>startRecognition(SR),250)};
function startRecognition(SR){let r=new SR(),got=false,scored=false,lastError='',finalText='',btn=q('#record'),timer;recording=true;btn.disabled=true;btn.textContent='● 듣는 중…';r.lang=C.lang;r.continuous=false;r.interimResults=true;r.maxAlternatives=5;q('#speechFeedback').textContent='지금 문장을 또렷하게 말해 주세요. 최대 15초 동안 듣습니다.';
r.onresult=e=>{let interim='';for(let i=e.resultIndex;i<e.results.length;i++){let result=e.results[i],best='';for(let j=0;j<result.length;j++)if(!best||result[j].confidence>(result[0].confidence||0))best=result[j].transcript;if(result.isFinal)finalText+=(finalText?' ':'')+best;else interim+=best}let heard=(finalText||interim).trim();if(heard){got=true;q('#speechFeedback').textContent='인식 중: '+heard}if(finalText&&!scored){scored=true;gradeSpeech(finalText)}};
r.onspeechend=()=>setTimeout(()=>{try{r.stop()}catch(e){}},500);
r.onnomatch=()=>{lastError='말소리를 문장으로 인식하지 못했습니다. 휴대전화를 20~30cm 거리에 두고 다시 말해 주세요.';q('#speechFeedback').textContent=lastError};
r.onerror=e=>{let map={'no-speech':'말소리가 감지되지 않았습니다. 발음 진단을 누른 뒤 바로 말해 주세요.','audio-capture':'마이크 장치를 사용할 수 없습니다. 다른 녹음 앱을 닫아 주세요.','not-allowed':'마이크 권한이 차단되었습니다. 주소창의 자물쇠에서 마이크를 허용해 주세요.','network':'음성 인식 서버에 연결하지 못했습니다. 인터넷 연결을 확인해 주세요.','aborted':'음성 인식이 중단되었습니다. 다시 시도해 주세요.'};lastError=map[e.error]||('음성 인식 오류: '+e.error);q('#speechFeedback').textContent=lastError};
r.onend=()=>{clearTimeout(timer);recording=false;btn.disabled=false;btn.textContent='● 다시 말하기';if(finalText&&!scored)gradeSpeech(finalText);else if(!got&&!lastError)q('#speechFeedback').textContent='음성이 들리지 않았습니다. 조용한 곳에서 버튼을 누른 직후 말해 주세요.'};
try{r.start();timer=setTimeout(()=>{try{r.stop()}catch(e){}},15000)}catch(e){recording=false;btn.disabled=false;btn.textContent='● 발음 진단';q('#speechFeedback').textContent='마이크를 시작하지 못했습니다. 페이지를 새로고침한 뒤 다시 시도해 주세요.'}}
function gradeSpeech(heard){let target=normalizeSpeech(q('#sentence').textContent),spoken=normalizeSpeech(heard),score=speechScore(target,spoken);q('#speechFeedback').textContent=score+'% 문장 일치 · 인식 결과: '+heard+' · '+(score>=85?'매우 정확합니다.':score>=65?'좋습니다. 틀린 단어만 다시 연습해 보세요.':'문장을 천천히 끊어 다시 말해 보세요.');state.xp+=Math.round(score/10);state.done++;if(score<65)state.wrong.push(q('#sentence').textContent);save();render()}
function normalizeSpeech(s){return s.toLowerCase().normalize('NFKC').replace(/[^\p{L}\p{N}\s]/gu,'').replace(/\s+/g,' ').trim()}
function speechScore(a,b){if(!a||!b)return 0;let char=Math.max(0,1-editDistance(a.replace(/ /g,''),b.replace(/ /g,''))/Math.max(a.replace(/ /g,'').length,b.replace(/ /g,'').length));let aw=a.split(' '),bw=b.split(' '),match=aw.filter(w=>bw.includes(w)).length/Math.max(aw.length,1);return Math.round(Math.max(char,match*.65+char*.35)*100)}
function editDistance(a,b){let p=Array.from({length:b.length+1},(_,i)=>i);for(let i=1;i<=a.length;i++){let n=[i];for(let j=1;j<=b.length;j++)n[j]=Math.min(n[j-1]+1,p[j]+1,p[j-1]+(a[i-1]===b[j-1]?0:1));p=n}return p[b.length]}
function showReview(){let arr=[...new Set(state.wrong)].slice(-8);q('#reviewList').innerHTML=arr.length?arr.map(x=>`<div class="review-item"><span>${x}</span><button class="btn soft fix">복습 완료</button></div>`).join(''):'<div class="card">아직 오답이 없습니다. 실전 문제와 발음 진단을 먼저 완료하세요.</div>';qa('.fix').forEach((b,i)=>b.onclick=()=>{state.wrong=state.wrong.filter(x=>x!==arr[i]);state.xp+=5;save();showReview();render()})}showSentence();
function initLevels(){if(!C.levels)return;let keys=Object.keys(C.levels),saved=localStorage[K+'level']||keys[0],profile=JSON.parse(localStorage[K+'profile']||'{}'),host=q('#levelBar');host.innerHTML='<div class="card" style="padding:14px 18px;margin-bottom:18px;display:flex;align-items:center;gap:12px;flex-wrap:wrap"><b>학습 급수</b><select id="levelSelect" aria-label="학습 급수 선택" style="padding:10px 14px;border:1px solid #dfe4ee;border-radius:12px;background:#fff;font-weight:700">'+keys.map(k=>'<option value="'+k+'">'+C.levels[k].label+'</option>').join('')+'</select><span id="levelDesc" style="color:#748097;flex:1"></span><b>하루 학습</b><select id="minutesSelect" aria-label="하루 학습시간 선택" style="padding:10px 14px;border:1px solid #dfe4ee;border-radius:12px;background:#fff;font-weight:700"><option value="10">10분</option><option value="20">20분</option><option value="30">30분</option><option value="45">45분</option><option value="60">60분</option></select></div>';q('#levelSelect').value=saved;q('#levelSelect').onchange=e=>setLevel(e.target.value);q('#minutesSelect').value=String(profile.minutes||10);q('#minutesSelect').onchange=e=>{let p=JSON.parse(localStorage[K+'profile']||'{}');p.minutes=e.target.value;localStorage[K+'profile']=JSON.stringify(p);render();status('하루 학습시간을 '+e.target.value+'분으로 변경했습니다.')};setLevel(saved)}function setLevel(k){let d=C.levels[k];if(!d)return;localStorage[K+'level']=k;C.words=d.words;C.sentences=d.sentences;C.questions=d.questions;vocab=0;test=0;sent=0;if(q('#levelDesc'))q('#levelDesc').textContent=d.desc||'';showWord();showQuestion();showSentence();render();q('#heroTitle').textContent=C.name+' '+d.label+' 맞춤 트레이닝'}

/* Shared AI Conversation Engine v1 */
const CONV={
 topik:{title:"한국어 AI 상황 회화",modes:[["daily","일상"],["cafe","카페"],["restaurant","식당"],["shopping","쇼핑"],["travel","여행"],["school","학교"],["work","직장"],["hospital","병원"],["free","자유 회화"]],starters:{daily:"안녕하세요! 오늘 하루는 어땠어요?",cafe:"어서 오세요. 무엇을 주문하시겠어요?",restaurant:"안녕하세요. 몇 분이세요?",shopping:"찾으시는 물건이 있으세요?",travel:"이번 여행에서 어디에 가고 싶어요?",school:"오늘 수업에서 무엇을 배웠어요?",work:"오늘 업무에서 가장 중요한 일은 무엇인가요?",hospital:"어디가 불편해서 오셨어요?",free:"요즘 가장 관심 있는 것에 대해 이야기해 볼까요?"}},
 ielts:{title:"IELTS Speaking + Free Conversation",modes:[["part1","Speaking Part 1"],["part2","Speaking Part 2"],["part3","Speaking Part 3"],["free","Free conversation"]],starters:{part1:"Let's begin with Part 1. Do you work or are you a student?",part2:"Describe a memorable journey you have taken. You should say where you went, who you went with, what happened, and explain why it was memorable.",part3:"Why do you think travel is important for some people?",free:"What would you like to talk about today?"}},
 hsk:{title:"中文 AI 情景会话",modes:[["daily","日常生活"],["restaurant","餐厅"],["shopping","购物"],["travel","旅行"],["taxi","出租车"],["school","学校"],["work","工作"],["interview","面试"],["free","自由对话"]],starters:{daily:"你好！你今天过得怎么样？",restaurant:"您好，请问您想吃点什么？",shopping:"您好，您想买什么？",travel:"你最想去中国的哪个城市旅行？",taxi:"您好，请问您要去哪里？",school:"你今天在学校学了什么？",work:"你今天工作忙吗？",interview:"请先简单介绍一下你自己。",free:"我们来聊一个你感兴趣的话题吧。"}}
};
let convSession=null,convRecognizing=false;
function convCfg(){return CONV[C.id]||CONV.ielts}
function convKey(){return K+"conversation"}
function convLoad(){try{return JSON.parse(localStorage[convKey()]||"[]")}catch(e){return []}}
function convSave(h){localStorage[convKey()]=JSON.stringify(h.slice(-40))}
function convEsc(s){return String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]))}
function initConversationUI(){
 let mode=q("#conversationMode");if(!mode)return;let cfg=convCfg();q("#conversationTitle").textContent=cfg.title;
 if(!mode.dataset.ready){
  mode.innerHTML=cfg.modes.map(([v,l])=>'<option value="'+v+'">'+l+'</option>').join("");mode.dataset.ready="1";
  q("#newConversation").onclick=()=>startConversation(true);
  q("#conversationSend").onclick=sendConversationText;
  q("#conversationInput").onkeydown=e=>{if(e.key==="Enter"){e.preventDefault();sendConversationText()}};
  q("#conversationMic").onclick=startConversationMic;
 }
 if(!convSession)startConversation(false);else renderConversation();
}
function startConversation(reset){
 let cfg=convCfg(),mode=q("#conversationMode")?.value||cfg.modes[0][0],saved=!reset?convLoad():[];
 convSession={mode,history:saved.length?saved:[],turns:0};
 if(!convSession.history.length){convSession.history.push({role:"assistant",text:cfg.starters[mode]||cfg.starters.free});convSave(convSession.history);setTimeout(()=>speakText(convSession.history[0].text),150)}
 renderConversation();let f=q("#conversationFeedback");if(f)f.classList.add("hide");
}
function renderConversation(){
 let box=q("#conversationLog");if(!box||!convSession)return;
 box.innerHTML=convSession.history.map(x=>'<div class="review-item" style="justify-content:'+(x.role==="user"?"flex-end":"flex-start")+'"><span style="max-width:82%;padding:10px 12px;border-radius:14px;background:'+(x.role==="user"?"#e9f8f2":"#f3f5f8")+'"><b>'+(x.role==="user"?"You":"AI")+'</b><br>'+convEsc(x.text)+'</span></div>').join("");
 box.scrollTop=box.scrollHeight;
}
function guidedReply(text){
 let mode=convSession?.mode||"free",lvl=localStorage[K+"level"]||"",low=text.toLowerCase();
 if(C.id==="topik"){
  if(mode==="cafe")return low.includes("주세요")?"네, 알겠습니다. 음료는 따뜻하게 드릴까요, 차갑게 드릴까요?":"좋아요. 주문할 때 ‘~ 주세요’를 사용해 보세요. 무엇을 드시겠어요?";
  if(mode==="hospital")return "그 증상은 언제부터 있었어요? 얼마나 심한지도 말해 보세요.";
  return "그렇군요. 조금 더 자세히 말해 주세요. 왜 그렇게 생각해요?";
 }
 if(C.id==="hsk"){
  if(mode==="restaurant")return "好的。你还想喝点什么？";
  if(mode==="shopping")return "可以。你喜欢什么颜色？";
  return "很好！你为什么这么想？请再说一点。";
 }
 if(mode==="part1")return "Why? Can you give me one more detail?";
 if(mode==="part2")return "Good. Now add more detail about what happened and how you felt.";
 if(mode==="part3")return "What are the main reasons for that, and can you give an example?";
 return "That's interesting. Can you tell me more about it?";
}
async function requestAIConversation(userText){
 if(C.aiEndpoint){
  let controller=new AbortController(),timer=setTimeout(()=>controller.abort(),18000);
  try{
   let res=await fetch(C.aiEndpoint,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({app:C.id,mode:convSession.mode,level:localStorage[K+"level"]||null,profile:JSON.parse(localStorage[K+"profile"]||"{}"),history:convSession.history.slice(-10),message:userText}),signal:controller.signal});
   if(!res.ok)throw new Error("AI gateway "+res.status);let data=await res.json();if(data.reply)return data;
  }finally{clearTimeout(timer)}
 }
 return {reply:guidedReply(userText),guided:true};
}
async function submitConversation(text){
 text=String(text||"").trim();if(!text||!convSession)return;
 convSession.history.push({role:"user",text});convSession.turns++;renderConversation();q("#conversationStatus").textContent="AI가 답변을 준비하고 있습니다…";
 try{
  let result=await requestAIConversation(text);convSession.history.push({role:"assistant",text:result.reply});convSave(convSession.history);renderConversation();speakText(result.reply);
  q("#conversationStatus").textContent=result.guided?"서버 AI 연결 전: 안전한 연습 대화 모드입니다. Work에서 AI Gateway를 연결하면 자유 대화로 전환됩니다.":"AI 실시간 대화";
  state.xp+=5;state.done++;save();render();conversationFeedback(text,result);
 }catch(e){q("#conversationStatus").textContent="AI 연결이 일시적으로 불안정합니다. 다시 시도해 주세요."}
}
function sendConversationText(){let i=q("#conversationInput");if(!i)return;let text=i.value;i.value="";submitConversation(text)}
async function startConversationMic(){
 if(convRecognizing)return;let SR=window.SpeechRecognition||window.webkitSpeechRecognition;
 if(!SR){q("#conversationStatus").textContent="이 브라우저에서는 음성 인식이 지원되지 않습니다. 텍스트 입력을 이용해 주세요.";return}
 let r=new SR();r.lang=C.lang;r.interimResults=true;r.continuous=false;convRecognizing=true;q("#conversationMic").disabled=true;q("#conversationStatus").textContent="말씀하세요…";
 let final="";
 r.onresult=e=>{for(let i=e.resultIndex;i<e.results.length;i++)if(e.results[i].isFinal)final+=(final?" ":"")+e.results[i][0].transcript;else q("#conversationStatus").textContent="인식 중: "+e.results[i][0].transcript};
 r.onerror=e=>q("#conversationStatus").textContent="마이크 오류: "+e.error;
 r.onend=()=>{convRecognizing=false;q("#conversationMic").disabled=false;if(final)submitConversation(final)};
 try{r.start()}catch(e){convRecognizing=false;q("#conversationMic").disabled=false}
}
function conversationFeedback(userText,result){
 let box=q("#conversationFeedback");if(!box)return;let target=normalizeSpeech(userText),words=target.split(" ").filter(Boolean),note="";
 if(C.id==="ielts")note=words.length<6?"답을 한두 문장 더 확장해 보세요. 이유와 예시를 붙이면 Speaking 연습에 더 좋습니다.":"좋습니다. 다음 답변에서도 이유·예시를 붙여 자연스럽게 확장해 보세요.";
 else if(C.id==="topik")note=userText.length<8?"짧은 답 뒤에 이유나 경험을 한 문장 더 붙여 보세요.":"대화를 계속 이어갈 수 있는 길이입니다. 조사와 연결어를 함께 점검해 보세요.";
 else note=userText.length<5?"再说一句理由或例子，会更自然。":"很好。继续注意声调和语序。";
 box.innerHTML="<b>대화 피드백</b><p>"+convEsc(note)+"</p><p class='small'>대화에서 어려웠던 표현은 스마트 복습에 저장할 수 있습니다.</p><button class='btn soft' id='saveConvReview'>복습에 저장</button>";box.classList.remove("hide");
 q("#saveConvReview").onclick=()=>{state.wrong.push(userText);save();q("#saveConvReview").textContent="저장됨"};
}
/* Daily goal / monetization-ready entitlement hooks */
function entitlement(){try{return JSON.parse(localStorage[K+"entitlement"]||'{"tier":"free"}')}catch(e){return {tier:"free"}}}
window.canUsePremiumFeature=function(feature){let e=entitlement();return e.tier==="premium"||e.tier==="ai"||feature==="core"};
window.setEntitlementPreview=function(tier){localStorage[K+"entitlement"]=JSON.stringify({tier});render()};

function explainAnswer(x,correct){
 const answer=x.a&&x.a[x.correct]||"";
 if(C.id==="ielts")return (correct?"Why it works: ":"Review: ")+"The best choice matches the task instruction and evidence. Correct answer: "+answer;
 if(C.id==="hsk")return (correct?"解析：":"复习：")+"正确答案是“"+answer+"”。注意语序、语境和搭配。";
 return (correct?"해설: ":"복습 포인트: ")+"문맥과 문법에 가장 자연스럽게 맞는 답은 ‘"+answer+"’입니다.";
}
function dailyPlanInfo(){
 let p=JSON.parse(localStorage[K+"profile"]||"{}"),minutes=+(p.minutes||10),deadline=p.date?new Date(p.date+"T23:59:59"):null,days=deadline?Math.max(0,Math.ceil((deadline-new Date())/86400000)):null;
 let weak=Math.min(5,state.wrong.length),activities=Math.max(2,Math.round(minutes/5));
 return {minutes,days,weak,activities};
}
function installDailyQuest(){
 let home=q("#home");if(!home||q("#dailyQuest"))return;let d=dailyPlanInfo(),box=document.createElement("div");box.id="dailyQuest";box.className="card";box.style.marginTop="16px";
 let urgency=d.days===null?"시험일을 설정하면 남은 기간에 맞춰 학습 우선순위를 조정합니다.":d.days===0?"시험일입니다. 새 내용보다 오답·말하기 복습을 우선하세요.":d.days<=3?"시험까지 "+d.days+"일 · 오답 50% / 실전 30% / 말하기 20%로 압축 복습합니다.":d.days<=14?"시험까지 "+d.days+"일 · 최근 오답을 우선 출제하고 실전 비중을 높입니다.":"시험까지 "+d.days+"일 · 새 학습 50% / 약점복습 30% / 말하기 20%로 진행합니다.";
 box.innerHTML="<p class='eyebrow'>DAILY QUEST</p><h3>오늘 "+d.minutes+"분 · "+d.activities+"개 활동</h3><p>"+urgency+"</p><p class='small'>현재 스마트 복습 항목 "+d.weak+"개 · 대화/발음/실전문제를 섞어 학습합니다.</p>";
 home.appendChild(box);
}
const oldRender=render;
render=function(){oldRender();installDailyQuest();let d=dailyPlanInfo(),box=q("#dailyQuest");if(box){box.remove();installDailyQuest()}};
