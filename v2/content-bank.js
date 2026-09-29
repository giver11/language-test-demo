/* ScoreStep V2 — 추가 연습문제 은행 (이 프로젝트에서 직접 작성한 독자 문제).
   공식 기출문제·타 앱·문제집의 문장을 복제하지 않았으며, 시험 영역(듣기·읽기·쓰기·어휘·문법·발음)의 학습 목표만 참고했다.
   skill: 약점 지도 영역 · lv: 적용 급수 범위(TOPIK/HSK) · track: IELTS 트랙(academic/general/both) · cat: 오답 원인 분류 힌트 */
window.SS_BANK = {
 topik: [
  {q:'[듣기] 들은 내용: “저는 지금 도서관에서 책을 빌리고 있어요.” 이 사람은 어디에 있습니까?',a:['도서관','은행','식당'],correct:0,skill:'Listening',lv:[1,2]},
  {q:'[듣기] 들은 내용: “내일 오후 세 시에 친구와 영화를 볼 거예요.” 언제 영화를 봅니까?',a:['내일 오후 3시','오늘 오후 3시','내일 오전 3시'],correct:0,skill:'Listening',lv:[1,2]},
  {q:'[듣기] 들은 내용: “여기에서 지하철역까지 걸어서 십 분쯤 걸려요.” 지하철역까지 얼마나 걸립니까?',a:['걸어서 10분쯤','버스로 10분쯤','걸어서 1시간쯤'],correct:0,skill:'Listening',lv:[1,2]},
  {q:'[듣기] 들은 내용: “회의가 다음 주 월요일로 미뤄졌으니 자료는 금요일까지만 보내 주시면 됩니다.” 들은 내용과 같은 것은?',a:['회의 날짜가 바뀌었다.','자료를 오늘 보내야 한다.','회의가 취소되었다.'],correct:0,skill:'Listening',lv:[3,6]},
  {q:'[듣기] 들은 내용: “이번 조사에서 20대의 독서량은 늘었지만 50대는 오히려 줄었습니다.” 들은 내용과 같은 것은?',a:['50대의 독서량이 줄었다.','모든 연령의 독서량이 늘었다.','20대의 독서량이 줄었다.'],correct:0,skill:'Listening',lv:[3,6]},
  {q:'[문법] ‘시간이 없어서 아침을 (   ).’에 알맞은 것은?',a:['못 먹었어요','먹으러 가요','먹고 있어요'],correct:0,skill:'Grammar',lv:[1,2]},
  {q:'[문법] ‘한국어를 잘하(   ) 매일 연습해요.’에 알맞은 것은?',a:['려고','지만','거나'],correct:0,skill:'Grammar',lv:[1,2]},
  {q:'[문법] ‘요즘 바쁘(   ) 연락을 못 드렸습니다.’에 알맞은 것은?',a:['다 보니','더라도','도록'],correct:0,skill:'Grammar',lv:[3,6]},
  {q:'[문법] ‘아무리 힘들(   ) 포기하지 않겠습니다.’에 알맞은 것은?',a:['더라도','어서','으니까'],correct:0,skill:'Grammar',lv:[3,6]},
  {q:'[어휘] 병원에서 환자를 치료하는 사람은?',a:['의사','요리사','운전기사'],correct:0,skill:'Vocabulary',lv:[1,2]},
  {q:'[어휘] ‘싸다’의 반대말은?',a:['비싸다','작다','가볍다'],correct:0,skill:'Vocabulary',lv:[1,2]},
  {q:'[어휘] ‘문제를 풀 방법을 찾아 없애다’의 뜻을 가진 말은?',a:['해결하다','발생하다','증가하다'],correct:0,skill:'Vocabulary',lv:[3,6]},
  {q:'[어휘] ‘나빠졌던 경제가 다시 좋아지다’에 알맞은 말은?',a:['회복되다','악화되다','중단되다'],correct:0,skill:'Vocabulary',lv:[3,6]},
  {q:'[읽기] 안내문 “도서관 이용 시간: 평일 09:00~18:00, 주말 휴관”과 같은 것은?',a:['토요일에는 도서관을 이용할 수 없다.','도서관은 매일 문을 연다.','평일 저녁 8시까지 이용할 수 있다.'],correct:0,skill:'Reading',lv:[1,2]},
  {q:'[읽기] “재택근무는 출퇴근 시간을 줄여 주지만 동료와의 소통이 어려워질 수 있다.” 글의 내용과 같은 것은?',a:['재택근무에는 장점과 단점이 모두 있다.','재택근무는 소통을 쉽게 만든다.','재택근무는 출퇴근 시간을 늘린다.'],correct:0,skill:'Reading',lv:[3,6]},
  {q:'[읽기·추론] “그는 우산을 챙기지 않은 것을 후회했다.” 바로 앞에 올 내용으로 알맞은 것은?',a:['갑자기 비가 내리기 시작했다.','하루 종일 날씨가 맑았다.','그는 집에서 쉬고 있었다.'],correct:0,skill:'Reading',lv:[3,6],cat:'Inference'},
  {q:'[쓰기 51] “다음 주에 이사를 합니다. 그래서 (   ). 도와줄 수 있는 사람은 연락 주세요.” 빈칸에 알맞은 문장은?',a:['짐을 옮길 사람이 필요합니다','이사가 취소되었습니다','저는 도움이 필요 없습니다'],correct:0,skill:'Writing',lv:[3,6]},
  {q:'[쓰기 53] “2020년 30% → 2025년 45%” 변화를 설명하는 문장으로 알맞은 것은?',a:['5년 사이에 15%p 증가하였다.','5년 사이에 15%p 감소하였다.','5년 동안 변화가 거의 없었다.'],correct:0,skill:'Writing',lv:[3,6]}
 ],
 hsk: [
  {q:'[听力] 听到：“我明天去北京。” 他什么时候去北京？',a:['明天','今天','昨天'],correct:0,skill:'Listening',lv:[1,2]},
  {q:'[听力] 听到：“这个苹果五块钱。” 苹果多少钱？',a:['五块','十块','三块'],correct:0,skill:'Listening',lv:[1,2]},
  {q:'[听力] 听到：“会议改到下午三点了，别迟到。” 会议几点开始？',a:['下午三点','上午三点','下午一点'],correct:0,skill:'Listening',lv:[3,6]},
  {q:'[听力] 听到：“虽然这家餐厅有点儿贵，但是菜很好吃。” 说话人觉得这家餐厅怎么样？',a:['有点儿贵，但是好吃','便宜又好吃','菜不好吃'],correct:0,skill:'Listening',lv:[3,6]},
  {q:'[阅读] “我在医院工作，每天帮助病人。” 他可能是做什么的？',a:['医生','老师','司机'],correct:0,skill:'Reading',lv:[1,2]},
  {q:'[阅读] “他为了提高汉语水平，每天坚持看中文新闻。” 他为什么看中文新闻？',a:['为了提高汉语水平','为了找工作','因为没有时间'],correct:0,skill:'Reading',lv:[3,6]},
  {q:'[阅读·推理] “小王一进门就把伞放在门口，衣服也湿了。” 可以知道什么？',a:['外面在下雨','小王很饿','今天很热'],correct:0,skill:'Reading',lv:[3,6],cat:'Inference'},
  {q:'[词汇] ‘가다’에 해당하는 중국어는?',a:['去','来','吃'],correct:0,skill:'Vocabulary',lv:[1,2]},
  {q:'[词汇] ‘学生’의 뜻은?',a:['학생','선생님','학교'],correct:0,skill:'Vocabulary',lv:[1,2]},
  {q:'[词汇] ‘提高’의 뜻은?',a:['향상시키다','줄이다','포기하다'],correct:0,skill:'Vocabulary',lv:[3,6]},
  {q:'[书写·어순] 올바른 문장은?',a:['我喝咖啡。','咖啡我喝吗很。','喝我咖啡。'],correct:0,skill:'Writing',lv:[1,2]},
  {q:'[书写·어순] 올바른 문장은?',a:['我把作业做完了。','我作业把做完了。','把我作业做完了。'],correct:0,skill:'Writing',lv:[3,6]},
  {q:'[书写] 비교문 ‘我___他高。’에 알맞은 것은?',a:['比','被','把'],correct:0,skill:'Writing',lv:[3,6]},
  {q:'[发音] ‘妈妈’의 병음은?',a:['māma','mǎma','máma'],correct:0,skill:'Pronunciation',lv:[1,2]},
  {q:'[发音] ‘谢谢’의 병음은?',a:['xièxie','xiéxie','xiēxie'],correct:0,skill:'Pronunciation',lv:[1,2]},
  {q:'[发音] ‘学习’의 병음은?',a:['xuéxí','xuēxī','xuěxì'],correct:0,skill:'Pronunciation',lv:[3,6]}
 ],
 ielts: [
  {q:'[Vocabulary] Complete: “The government plans to ___ more money to public transport.”',a:['allocate','decline','postpone'],correct:0,skill:'Vocabulary',track:'both'},
  {q:'[Vocabulary] Which is closest in meaning to ‘substantial’?',a:['large in amount','very small','temporary'],correct:0,skill:'Vocabulary',track:'both'},
  {q:'[Vocabulary] Which verb best replaces ‘rose dramatically’ in a chart description?',a:['surged','dipped','levelled off'],correct:0,skill:'Vocabulary',track:'both'},
  {q:'[Grammar] Choose the correct sentence.',a:['If I had known, I would have come.','If I would know, I had come.','If I knew, I will have come.'],correct:0,skill:'Grammar',track:'both'},
  {q:'[Grammar] Complete: “The number of students ___ increased since 2010.”',a:['has','have','are'],correct:0,skill:'Grammar',track:'both'},
  {q:'[Grammar] Complete: “She has lived in Busan ___ 2015.”',a:['since','for','during'],correct:0,skill:'Grammar',track:'both'},
  {q:'[Listening] You hear: “Your appointment is on the fifteenth, not the fifth.” What is the date of the appointment?',a:['the 15th','the 5th','the 50th'],correct:0,skill:'Listening',track:'both'},
  {q:'[Listening] You hear: “Parking is free for the first two hours, then it costs three pounds an hour.” How much do you pay for three hours?',a:['£3','£6','Nothing'],correct:0,skill:'Listening',track:'both'},
  {q:'[Academic Reading] Passage: “Although early results were promising, the researchers cautioned that the sample was too small to draw firm conclusions.” Statement: ‘The researchers were certain about their conclusions.’',a:['TRUE','FALSE','NOT GIVEN'],correct:1,skill:'Reading',track:'academic',cat:'Inference'},
  {q:'[Academic Reading] Passage: “Coral reefs cover less than one percent of the ocean floor.” Statement: ‘Coral reefs are the most studied marine habitat.’',a:['TRUE','FALSE','NOT GIVEN'],correct:2,skill:'Reading',track:'academic',cat:'Inference'},
  {q:'[General Reading] Notice: “Gym members must book classes at least 24 hours in advance.” Can you book a class two hours before it starts?',a:['No','Yes','Not stated'],correct:0,skill:'Reading',track:'general'},
  {q:'[General Reading] Advert: “Part-time cashier wanted. Weekend shifts only. No experience necessary.” Which statement is true?',a:['You can apply without experience.','The job is full-time.','Shifts are on weekdays.'],correct:0,skill:'Reading',track:'general'},
  {q:'[Academic Writing Task 1] Which phrase best describes a small decrease?',a:['fell slightly','plummeted','soared'],correct:0,skill:'Writing',track:'academic'},
  {q:'[General Writing Task 1] A formal letter begins “Dear Sir or Madam”. Which closing is conventional?',a:['Yours faithfully','Yours sincerely','Cheers'],correct:0,skill:'Writing',track:'general'},
  {q:'[Speaking Part 3] Which answer develops an opinion best?',a:['I believe it does, mainly because it saves time. For example, …','Yes, it does.','Maybe.'],correct:0,skill:'Speaking',track:'both'}
 ]
};
