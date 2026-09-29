#!/usr/bin/env python3
"""ScoreStep V2 Adaptive Learning Engine — 실제 브라우저 E2E (Chromium/Playwright)
TOPIK · IELTS · HSK: 진입 → 목표/시험일 → 단어 → 실전문제(정답/오답) → AI 코치(timeout·retry·fallback) → Smart Review →
TTS(cancel·언어·중복 방지) → 쉐도잉(음성 인식 비교) → AI 대화 3턴 + 종합 피드백 → Weakness Map · 준비도 · Weekly →
새로고침 유지 · v1→v2 migration · 모바일 390px · console error.
주의: 이 테스트는 localhost 에서 AI 게이트웨이를 page.route 로 대체(응답 형식·오류 처리 검증용)한다.
      실제 Cloudflare Workers AI 응답은 배포 URL 에서 따로 확인한다.
사용: python3 tests/v2_engine_e2e.py [BASE_URL]"""
import asyncio, json, sys, os, datetime
from playwright.async_api import async_playwright

BASE = next((a for a in sys.argv[1:] if a.startswith('http')), 'http://localhost:8765/v2/')
GW = 'https://scorestep-ai-gateway.suharin2.workers.dev'
SHOTS = os.environ.get('SHOTS')
res = []
def rec(tid, name, ok, detail=''):
    res.append((tid, name, bool(ok), detail)); print(('PASS' if ok else 'FAIL'), tid, name, '-', detail, flush=True)

# 브라우저 음성 API 계측: speak/cancel 호출 기록 + 가짜 음성 인식(원문 일부만 인식)
INSTRUMENT = r"""
(() => {
  window.__tts = { speak: [], cancel: 0 };
  if (window.speechSynthesis) {
    const s = window.speechSynthesis;
    const oc = s.cancel.bind(s); s.cancel = () => { window.__tts.cancel++; try { oc(); } catch (e) {} };
    s.speak = (u) => { window.__tts.speak.push({ lang: u.lang, text: u.text, voice: u.voice ? u.voice.lang : null, cancelBefore: window.__tts.cancel }); setTimeout(() => { u.onstart && u.onstart({}); u.onend && u.onend({}); }, 30); };
  }
  if (!window.__noSR) {
    class FakeSR {
      constructor() { this.lang = ''; }
      start() {
        const target = (document.querySelector('#speaking.active #sentence') || {}).textContent || window.__srSay || '';
        let heard = window.__srSay || target;
        if (!window.__srSay) { const parts = target.split(' '); heard = parts.length > 2 ? parts.slice(0, -1).join(' ') : target.slice(0, Math.max(1, target.length - 3)); }
        setTimeout(() => {
          const r = [{ transcript: heard, confidence: 0.83 }]; r.isFinal = true;
          this.onresult && this.onresult({ resultIndex: 0, results: [r] });
          this.onend && this.onend();
        }, 60);
      }
      stop() {} abort() {}
    }
    window.SpeechRecognition = FakeSR; window.webkitSpeechRecognition = FakeSR;
  } else { delete window.SpeechRecognition; delete window.webkitSpeechRecognition; }
  if (navigator.mediaDevices) navigator.mediaDevices.getUserMedia = async () => ({ getTracks: () => [{ stop() {} }] });
})();
"""

REPLIES = {
    'topik': ['좋아요. 주말에는 보통 무엇을 해요?\n💡 문법: ‘친구를 만나요’가 더 자연스러워요.', '재미있네요. 그 영화는 어땠어요?', '그렇군요. 다음에는 어디에 가고 싶어요?', '좋은 계획이에요!'],
    'ielts': ['That sounds interesting. What do you enjoy most about it?\nEstimated practice feedback: "I am study" -> "I study".', 'Why do you think that is?', 'Could you give me an example?', 'Thank you.'],
    'hsk': ['你喜欢做什么？\nNǐ xǐhuan zuò shénme?\n무엇을 좋아해요?', '很好！你为什么喜欢？\nHěn hǎo! Nǐ wèishénme xǐhuan?\n좋아요! 왜 좋아해요?', '明白了。\nMíngbai le.\n알겠어요.', '再见！'],
}

async def setup(br, app, w=390, old_state=None, no_sr=False, route_mode='ok'):
    ctx = await br.new_context(viewport={'width': w, 'height': 860}, is_mobile=w < 800, has_touch=w < 800, locale='ko-KR', timezone_id='Asia/Seoul')
    pg = await ctx.new_page()
    errs, calls = [], []
    pg.on('console', lambda m: errs.append(m.text[:200]) if m.type == 'error' and 'Failed to load resource' not in m.text else None)
    pg.on('pageerror', lambda e: errs.append('pageerror ' + str(e)[:200]))
    if no_sr: await pg.add_init_script('window.__noSR = true;')
    await pg.add_init_script(INSTRUMENT)
    if old_state is not None:
        await pg.add_init_script('if(!sessionStorage.getItem("seed")){localStorage.setItem("v2:%s:state", %s);sessionStorage.setItem("seed","1")}' % (app, json.dumps(json.dumps(old_state))))
    idx = {'n': 0}
    async def handle(route):
        req = route.request
        if req.method == 'OPTIONS': return await route.fulfill(status=204, headers={'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'POST'})
        body = json.loads(req.post_data or '{}'); calls.append(body)
        mode = route_mode if isinstance(route_mode, str) else route_mode(body)
        if mode == 'ok':
            if body.get('scenario') in ('coach', 'feedback'):
                reply = ('1) 정답 2) 이유 3) 개념 4) 예 5) 새 문제' if app != 'ielts' else '1) Answer 2) Why 3) Concept 4) Example 5) New question')
            else:
                reply = REPLIES[app][min(idx['n'], 3)]; idx['n'] += 1
            return await route.fulfill(status=200, content_type='application/json', headers={'Access-Control-Allow-Origin': '*'}, body=json.dumps({'reply': reply}))
        if mode == '502': return await route.fulfill(status=502, content_type='application/json', headers={'Access-Control-Allow-Origin': '*'}, body='{"error":"ai_upstream_failed"}')
        if mode == '429': return await route.fulfill(status=429, content_type='application/json', headers={'Access-Control-Allow-Origin': '*'}, body='{"error":"ai_daily_limit"}')
        if mode == 'badjson': return await route.fulfill(status=200, content_type='application/json', headers={'Access-Control-Allow-Origin': '*'}, body='not-json')
    await pg.route(GW + '/**', handle); await pg.route(GW, handle)
    return ctx, pg, errs, calls

async def enter(pg, app, goal, date):
    await pg.goto(BASE + app + '/'); await pg.wait_for_selector('#code')
    await pg.fill('#code', 'STEP10'); await pg.click('#gateForm button')
    await pg.wait_for_selector('#app:not(.hide)')
    try: await pg.wait_for_selector('#profile:not(.hide)', timeout=2500)
    except Exception: pass
    if await pg.is_visible('#profile'):
        await pg.fill('#goal', goal); await pg.fill('#date', date); await pg.fill('#minutes', '10'); await pg.click('#profileForm button')
    await pg.wait_for_selector('#engineHome .mission', timeout=8000)

async def nav(pg, page):
    await pg.click(f'.nav[data-page="{page}"]'); await pg.wait_for_timeout(250)

async def eng(pg, app, disk=False):
    if not disk and await pg.evaluate('!!window.ScoreStepEngine'):
        return await pg.evaluate('() => JSON.parse(JSON.stringify(window.ScoreStepEngine.data()))')
    return await pg.evaluate(f"() => JSON.parse(localStorage.getItem('v2:{app}:engine') || 'null')")

async def answer(pg, n, pick=0):
    out = []
    for i in range(n):
        await pg.wait_for_selector('#options .option:not([disabled])')
        btn = pg.locator('#options .option').nth(pick % await pg.locator('#options .option').count())
        await btn.click(); await pg.wait_for_timeout(120)
        out.append('bad' in (await btn.get_attribute('class')))
        await pg.click('#nextQ')
    return out

async def run_app(br, app, lang):
    goal = {'topik': 'TOPIK II 4급', 'ielts': 'IELTS 6.5', 'hsk': 'HSK 4급'}[app]
    date = (datetime.date.today() + datetime.timedelta(days=20)).isoformat()
    ctx, pg, errs, calls = await setup(br, app)
    await enter(pg, app, goal, date)
    home = await pg.inner_text('#engineHome')
    rec(f'{app}-1', f'{app.upper()} 앱 진입 · D-Day/목표/준비도/오늘 학습량', 'D-20' in home and goal in home and ('시험 준비도' in home or 'readiness' in home.lower()), home.split('\n')[1:4])
    ok_m = ('오늘의 10분 미션' in home or "Today's 10-minute mission" in home)
    rec(f'{app}-B2', 'Daily Mission (시험·시험일·약점 기반)', ok_m and ('실전' in home or 'Exam mode' in home), [l for l in home.split('\n') if '분' in l or 'min' in l][:6])
    if SHOTS: os.makedirs(SHOTS, exist_ok=True); await pg.screenshot(path=f'{SHOTS}/v2-{app}-home.png', full_page=True)

    if app == 'ielts':
        for key in ['academic-reading', 'general-reading', 'general-writing', 'academic-writing', 'academic-listening', 'general-speaking']:
            await pg.select_option('#levelSelect', key); await pg.wait_for_timeout(150)
        await pg.select_option('#levelSelect', 'general-reading'); await nav(pg, 'test')
        qs = []
        for i in range(4):
            qs.append(await pg.inner_text('#question')); await pg.click('#nextQ'); await pg.wait_for_timeout(80)
        gen_ok = not any('[Academic' in x for x in qs)
        await pg.select_option('#levelSelect', 'academic-reading'); await pg.wait_for_timeout(150)
        qa = []
        for i in range(4):
            qa.append(await pg.inner_text('#question')); await pg.click('#nextQ'); await pg.wait_for_timeout(80)
        rec('ielts-B10', 'Academic / General Training 분리 (Reading/Writing 콘텐츠)', gen_ok and not any('[General' in x for x in qa), f'GT 샘플: {qs[0][:50]} / AC 샘플: {qa[0][:50]}')
        await pg.select_option('#levelSelect', 'academic-listening'); await pg.wait_for_timeout(150)

    # 단어 (어휘 기록) + HSK 汉字/拼音 카드
    await nav(pg, 'words')
    if app == 'hsk':
        hz = await pg.inner_text('#word .hz-big'); py = await pg.inner_text('#word .py')
        await pg.click('#flash'); await pg.wait_for_timeout(100)
        rec('hsk-1', '단어: 汉字 · 拼音 · 뜻 · 예문', hz and py and '뜻' in await pg.inner_text('#meaning') and '예문' in await pg.inner_text('#example'), f'{hz} / {py}')
    await pg.click('#playWord'); await pg.wait_for_timeout(1500)   # 음성 목록이 비어 있으면 voiceschanged 를 최대 1.2초 기다린 뒤 재생
    await pg.click('#know'); await pg.click('#again'); await pg.click('#know')
    e = await eng(pg, app)
    wit = [v for k, v in e['items'].items() if k.startswith('w:')]
    rec(f'{app}-B1', '공통 학습 기록 {id,exam,level,category,skill,correct,wrong,lastReviewed,nextReview,mastery,responseTime}', len(wit) >= 2 and all(k in wit[0] for k in ['id', 'exam', 'level', 'category', 'skill', 'correct', 'wrong', 'lastReviewed', 'nextReview', 'mastery', 'responseTime']), json.dumps({k: wit[0][k] for k in ['exam', 'level', 'skill', 'correct', 'wrong', 'mastery', 'responseTime']}, ensure_ascii=False))

    # TTS: 언어 · cancel 후 speak · 중복 탭 방지
    tts = await pg.evaluate('window.__tts')
    sp = tts['speak']
    await pg.evaluate('document.querySelector("#playWord").click(); document.querySelector("#playWord").click();'); await pg.wait_for_timeout(400)
    tts2 = await pg.evaluate('window.__tts')
    rec(f'{app}-TTS', f'TTS {lang} · 재생 전 cancel() · 연속 탭 중복 재생 없음 · 화면에 코드/디버그 없음',
        sp and sp[0]['lang'] == lang and sp[0]['cancelBefore'] >= 1 and len(tts2['speak']) - len(sp) == 1 and 'voiceschanged' not in await pg.inner_text('body') and 'TTS.report' not in await pg.inner_text('body'),
        f"speak {len(sp)}→{len(tts2['speak'])}, lang={sp[0]['lang'] if sp else None}, cancel={tts2['cancel']}")

    # 실전문제: 정답/오답 → AI 코치(로컬 5단계 + 게이트웨이)
    await nav(pg, 'test')
    if app != 'ielts':
        await pg.evaluate("document.querySelector('#engineHome') && 0")
    got_wrong = False
    for i in range(12):
        await pg.wait_for_selector('#options .option:not([disabled])')
        n = await pg.locator('#options .option').count()
        await pg.locator('#options .option').nth(i % n).click(); await pg.wait_for_timeout(120)
        if await pg.query_selector('#aiCoachBtn'): got_wrong = True; break
        await pg.click('#nextQ')
    coach = await pg.inner_text('#testResult') if got_wrong else ''
    need = ['정답', '왜 틀렸는지', '핵심 개념', '비슷한 예', '새로운 연습문제'] if app != 'ielts' else ['Answer', 'Why it was wrong', 'Key idea', 'Similar example', 'New practice question']
    rec(f'{app}-B6a', '오답 → 정답·왜 틀렸는지·핵심 개념·비슷한 예·새 연습문제 순서 피드백', got_wrong and all(x in coach for x in need), coach.replace('\n', ' ')[:120])
    if got_wrong:
        await pg.click('#aiCoachBtn'); await pg.wait_for_function("document.querySelector('#aiCoachOut') && /AI/.test(document.querySelector('#aiCoachOut').textContent) && !/준비|preparing/.test(document.querySelector('#aiCoachOut').textContent)", timeout=8000)
        rec(f'{app}-B6b', 'AI 코치: Workers AI 게이트웨이 요청 형식(language/exam/level/scenario) · 응답 표시', calls and calls[-1].get('scenario') == 'coach' and calls[-1].get('exam') in ('TOPIK', 'IELTS', 'HSK') and 'API' not in json.dumps(calls[-1]).upper().replace('API_', ''), json.dumps({k: calls[-1].get(k) for k in ['language', 'exam', 'level', 'scenario']}))
    e = await eng(pg, app)
    qitems = [v for k, v in e['items'].items() if k.startswith('q:')]
    rec(f'{app}-B4', 'Mistake DNA: 오답 원인 자동 분류 저장', len(e['mistakes']) >= 2 and all(m['cat'] in ['Vocabulary', 'Grammar', 'Listening detail', 'Inference', 'Spelling', 'Pronunciation', 'Time pressure', 'Question type'] for m in e['mistakes']), str([m['cat'] for m in e['mistakes']][:6]))

    # Smart Review: 복습 시기가 된 문제 → 복습 시작 → 그 문제 출제
    target = qitems[0]['id']
    await pg.evaluate(f"() => {{ const k='v2:{app}:engine'; }}")
    await pg.evaluate("id => { const e = window.ScoreStepEngine.data(); e.items[id].nextReview = Date.now() - 1000; }", target)
    await nav(pg, 'review'); await pg.wait_for_selector('#engineReview')
    rv = await pg.inner_text('#engineReview')
    has_btn = await pg.query_selector('#startReview')
    if has_btn:
        await pg.click('#startReview'); await pg.wait_for_selector('#options .option')
        meta = await pg.inner_text('#qMeta')
    else: meta = ''
    rec(f'{app}-B5', 'Smart Review (1·3·7·14·30 · 정답률·응답시간 반영) → 복습 시작 시 복습 문제 출제', ('SMART REVIEW' in rv) and has_btn and ('복습 시기' in meta or 'Due for review' in meta), meta)

    # Listening: 문제 듣기 버튼 + TTS
    lis = False
    await pg.evaluate("() => {}")
    for i in range(10):
        qt = await pg.inner_text('#question')
        if await pg.is_visible('#qAudio'):
            before = len((await pg.evaluate('window.__tts'))['speak'])
            await pg.click('#qAudio'); await pg.wait_for_timeout(250)
            after = (await pg.evaluate('window.__tts'))['speak']
            lis = len(after) > before and after[-1]['lang'] == lang
            break
        if await pg.query_selector('#options .option:not([disabled])'):
            await pg.locator('#options .option').first.click()
        await pg.click('#nextQ'); await pg.wait_for_timeout(80)
    rec(f'{app}-L', 'Listening: 문제 음성 재생', lis, qt[:60])

    # 쉐도잉: 듣기 → 녹음 → 인식 → 원문 비교 → 다시 말하기
    await nav(pg, 'speaking')
    await pg.click('#listen'); await pg.wait_for_timeout(200)
    await pg.click('#record'); await pg.wait_for_selector('.shadow-res', timeout=8000)
    sh = await pg.inner_text('.shadow-res')
    need = ['원문', '인식된 문장', '일치한 부분', '다시 연습할 부분'] if app != 'ielts' else ['Original', 'Recognised', 'Matched', 'Practise again']
    rec(f'{app}-B9', '쉐도잉 듣기→녹음→음성 인식→원문 비교→다시 말하기', all(x in sh for x in need) and await pg.query_selector('#shadowAgain') and await pg.query_selector('#shadowSteps li.done'), sh.replace('\n', ' ')[:140])

    # AI 대화 3턴 이상 + 종합 피드백
    await nav(pg, 'conversation'); await pg.wait_for_selector('#convFinish')
    dis0 = await pg.is_disabled('#convFinish')
    msgs = {'topik': ['주말에 친구를 만났어요.', '같이 영화를 봤어요. 그래서 기분이 좋았어요.', '다음에는 부산에 가고 싶어요.'],
            'ielts': ['I am study at university in Seoul.', 'I enjoy it because the teachers are helpful, for example in writing classes.', 'I think travel is important because people learn about other cultures.'],
            'hsk': ['我喜欢看书。', '因为看书很有意思。', '我每天晚上看书。']}[app]
    for m in msgs:
        await pg.fill('#conversationInput', m); await pg.click('#conversationSend')
        await pg.wait_for_function("!document.querySelector('#conversationSend').disabled", timeout=15000); await pg.wait_for_timeout(150)
    log = await pg.inner_text('#conversationLog')
    turns = log.count('You')
    await pg.click('#convFinish'); await pg.wait_for_selector('#convSummary')
    sm = await pg.inner_text('#convSummary')
    need = ['잘한 점', '교정할 점', '어휘', '문법', '발음', '추천 복습'] if app != 'ielts' else ['What went well', 'To improve', 'Vocabulary', 'Grammar', 'Pronunciation', 'Recommended review', 'Fluency & Coherence', 'Lexical Resource', 'not an official IELTS']
    rec(f'{app}-B7', 'AI Conversation 3턴 (질문→응답→피드백→다음 질문) + 종료 후 종합 피드백 (로컬 게이트웨이 대체)', dis0 and turns >= 3 and all(x in sm for x in need), f'턴 {turns}, 요약: ' + sm.replace('\n', ' ')[:120])

    # Weakness Map · 준비도 · Weekly
    await nav(pg, 'home'); await pg.wait_for_timeout(300)
    home = await pg.inner_text('#engineHome')
    labels = {'ielts': ['Listening', 'Reading', 'Writing', 'Speaking', 'Vocabulary', 'Grammar'], 'topik': ['어휘', '문법', '듣기', '읽기', '쓰기'], 'hsk': ['어휘', '듣기', '읽기', '쓰기', '발음']}[app]
    stat_words = ['강함', '보통', '복습 필요', '기록 부족'] if app != 'ielts' else ['Strong', 'Fair', 'Needs review', 'Not enough data']
    rec(f'{app}-B3', 'Weakness Map (영역별 강함/보통/복습 필요 · 실제 기록)', all(l in home for l in labels) and any(s in home for s in stat_words), '')
    rec(f'{app}-B14', '"시험 준비도" 표기 · 합격 확률 표현 없음 · 진척도 안내', ('합격 확률이 아니라' in home or 'not a pass probability' in home) and '합격 확률 ' not in home.replace('합격 확률이 아니라', ''), '')
    rec(f'{app}-B15', 'Weekly Report (학습시간·lesson·정답률·복습량·streak·XP·발전/취약 영역)', all(x in home for x in (['학습시간', '완료 lesson', '정답률', '복습량', 'Streak', 'XP', '가장 발전한 영역', '가장 취약한 영역'] if app != 'ielts' else ['Study time', 'Lessons done', 'Accuracy', 'Reviews', 'Streak', 'XP', 'Most improved', 'Weakest area'])), '')
    if app == 'topik':
        note = await pg.inner_text('#levelBar')
        rec('topik-B11', 'TOPIK I(듣기·읽기)/II(듣기·읽기·쓰기) 구분 · 1~6급 학습 단계 유지 · PBT/IBT', 'TOPIK I = 듣기·읽기' in note and 'TOPIK II = 듣기·읽기·쓰기' in note and 'PBT' in note and '학습 단계' in note, note.replace('\n', ' ')[:120])

    # 새로고침 후 기록 유지
    await pg.wait_for_timeout(400)
    before = await eng(pg, app, True); st_before = await pg.evaluate(f"localStorage.getItem('v2:{app}:state')")
    await pg.reload(); await pg.wait_for_selector('#engineHome .mission', timeout=8000)
    after = await eng(pg, app, True); st_after = await pg.evaluate(f"localStorage.getItem('v2:{app}:state')")
    rec(f'{app}-R', '새로고침 후 학습 기록 유지 (engine · 기존 state)', before['items'].keys() == after['items'].keys() and len(after['mistakes']) == len(before['mistakes']) and json.loads(st_after)['xp'] == json.loads(st_before)['xp'], f"items {len(after['items'])}, mistakes {len(after['mistakes'])}, xp {json.loads(st_after)['xp']}")
    over = await pg.evaluate('document.documentElement.scrollWidth > innerWidth + 1')
    rec(f'{app}-M', '모바일 390px 가로 넘침 없음', not over, '')
    rec(f'{app}-J', 'Console error / page error 없음', not errs, '; '.join(errs[:4]))
    await ctx.close()

async def main():
    async with async_playwright() as p:
        br = await p.chromium.launch()
        for app, lang in [('topik', 'ko-KR'), ('ielts', 'en-US'), ('hsk', 'zh-CN')]:
            try:
                await run_app(br, app, lang)
            except Exception as ex:
                rec(f'{app}-X', '예외', False, repr(ex)[:300])

        # v1 → v2 migration: 기존 state(XP·오답) 보존 + 엔진 변환 + 백업
        old = {'xp': 135, 'done': 20, 'correct': 14, 'wrong': ['‘school’에 해당하는 단어는?', '‘school’에 해당하는 단어는?', '저는 한국어를 공부합니다.', '학교'], 'streak': 1}
        ctx, pg, errs, calls = await setup(br, 'topik', old_state=old)
        await pg.goto(BASE + 'topik/'); await pg.fill('#code', 'STEP10'); await pg.click('#gateForm button'); await pg.wait_for_selector('#engineHome', timeout=8000)
        e = await eng(pg, 'topik'); st = await pg.evaluate("JSON.parse(localStorage.getItem('v2:topik:state'))"); bk = await pg.evaluate("localStorage.getItem('v2:topik:state.backup.v1')"); gv = await pg.evaluate("localStorage.getItem('scorestep_schema_version')")
        kinds = sorted(v['kind'] for v in e['items'].values())
        rec('E', 'localStorage migration v1→v2 (기존 XP·오답 보존, 백업 키, scorestep_schema_version)', st['xp'] == 135 and st['wrong'][:4] == old['wrong'] and bk and json.loads(bk)['xp'] == 135 and gv == '2' and len(e['items']) == 3 and len(e['mistakes']) == 4, f'kinds {kinds}, schema {gv}')
        # 오류 처리: 502 두 번 → 1회 재시도 후 fallback 문구 (무한 로딩 없음), 429 → 재시도 없음, JSON 오류
        for mode, expect_calls, text in [('502', 2, ['연결하지 못했어요']), ('429', 1, ['무료 사용량']), ('badjson', 2, ['연결하지 못했어요'])]:
            ctx2, pg2, errs2, calls2 = await setup(br, 'topik', route_mode=mode)
            await enter(pg2, 'topik', 'TOPIK I 2급', (datetime.date.today() + datetime.timedelta(days=40)).isoformat())
            await nav(pg2, 'test')
            for i in range(12):
                await pg2.wait_for_selector('#options .option:not([disabled])')
                n = await pg2.locator('#options .option').count()
                await pg2.locator('#options .option').nth(i % n).click(); await pg2.wait_for_timeout(100)
                if await pg2.query_selector('#aiCoachBtn'): break
                await pg2.click('#nextQ')
            await pg2.click('#aiCoachBtn')
            await pg2.wait_for_function("document.querySelector('#aiCoachBtn') && !document.querySelector('#aiCoachBtn').disabled && !/준비하고/.test(document.querySelector('#aiCoachOut').textContent)", timeout=12000)
            out = await pg2.inner_text('#aiCoachOut')
            coach_calls = [c for c in calls2 if c.get('scenario') == 'coach']
            rec(f'J-AI-{mode}', f'AI 오류 {mode}: retry {expect_calls - 1}회 · fallback 문구 · 로딩 종료', len(coach_calls) == expect_calls and any(t in out for t in text), f'요청 {len(coach_calls)}회, 표시: {out[:50]}')
            await ctx2.close()
        # 음성 인식 미지원 브라우저 → 오류 화면 대신 안내문
        ctx3, pg3, errs3, _ = await setup(br, 'hsk', no_sr=True)
        await enter(pg3, 'hsk', 'HSK 3급', (datetime.date.today() + datetime.timedelta(days=5)).isoformat())
        await nav(pg3, 'speaking')
        note = await pg3.inner_text('#speaking')
        rec('B9-unsupported', '음성 인식 미지원 → 안내문 표시 · 버튼 비활성', '지원하지 않아요' in note and await pg3.is_disabled('#record') and not errs3, note.split('\n')[-1][:80])
        home3 = await (await pg3.query_selector('#engineHome')).inner_text() if await pg3.query_selector('#engineHome') else ''
        await nav(pg3, 'home'); home3 = await pg3.inner_text('#engineHome')
        rec('B13', 'D-7 이내 → 새 내용 ↓ 취약·실전 ↑ (집중 복습 단계)', 'D-5' in home3 and '집중 복습' in home3, [l for l in home3.split('\n') if '분 ·' in l][:5])
        await ctx3.close()
        # 오프라인 → "인터넷 연결이 필요한 기능입니다."
        ctx4, pg4, errs4, calls4 = await setup(br, 'topik')
        await enter(pg4, 'topik', 'TOPIK 3급', (datetime.date.today() + datetime.timedelta(days=90)).isoformat())
        await nav(pg4, 'conversation'); await pg4.wait_for_selector('#convFinish')
        await ctx4.set_offline(True)
        await pg4.fill('#conversationInput', '안녕하세요'); await pg4.click('#conversationSend'); await pg4.wait_for_timeout(300)
        st4 = await pg4.inner_text('#conversationStatus')
        rec('F-offline', '오프라인: AI 대화 → "인터넷 연결이 필요한 기능입니다."', '인터넷 연결이 필요한 기능입니다.' in st4 and not calls4, st4)
        await ctx4.set_offline(False); await ctx4.close()
        # PC 1280px
        ctx5, pg5, errs5, _ = await setup(br, 'ielts', w=1280)
        await enter(pg5, 'ielts', 'IELTS 7.0', (datetime.date.today() + datetime.timedelta(days=60)).isoformat())
        rec('PC', 'PC Chrome 1280px 렌더 · 오류 없음', await pg5.is_visible('#engineHome .wmap') and not errs5, '; '.join(errs5[:3]))
        if SHOTS: await pg5.screenshot(path=f'{SHOTS}/v2-ielts-pc.png', full_page=True)
        await ctx5.close()
        await br.close()
    fails = [r for r in res if not r[2]]
    print('\nSUMMARY', len(res) - len(fails), '/', len(res), 'PASS')
    with open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'last-v2-engine-result.json'), 'w', encoding='utf-8') as f:
        json.dump({'base': BASE, 'at': datetime.datetime.now().isoformat(), 'results': [dict(id=a, name=b, ok=c, detail=str(d)) for a, b, c, d in res]}, f, ensure_ascii=False, indent=1)
    sys.exit(1 if fails else 0)

asyncio.run(main())
