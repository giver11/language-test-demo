#!/usr/bin/env python3
"""한자패스 2026.09.30 업그레이드 실제 브라우저 테스트 (Chromium/Playwright)
오늘의 한자 학습(10분) · 스마트 간격복습 · Mastery 4단계 · 오답 DNA · 혼동쌍 · 3단계 쓰기 · 3초 한자 · 사자성어 ·
D-Day 구간 · 모의시험 '연습문제' 표기 · XP/연속학습 · 주간 리포트 · v2→v3 migration · 새로고침 유지 · 모바일/PC · console error.
사용: python3 hanja/tests/upgrade.py [BASE_URL]"""
import asyncio, json, sys, os, datetime
from playwright.async_api import async_playwright

BASE = next((a for a in sys.argv[1:] if a.startswith('http')), 'http://localhost:8765/hanja/')
HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, '..', 'data')
SHOTS = os.environ.get('SHOTS')
res = []

def rec(tid, name, ok, detail=''):
    res.append((tid, name, bool(ok), detail)); print(('PASS' if ok else 'FAIL'), tid, name, '-', detail, flush=True)

def medians(ch):
    d = json.load(open(os.path.join(DATA, 'strokes/%04X.json' % ord(ch)), encoding='utf-8'))
    return [[(x / 1024, (900 - y) / 1024) for x, y in s] for s in d['m']]

async def shot(pg, name):
    if SHOTS:
        os.makedirs(SHOTS, exist_ok=True); await pg.screenshot(path=os.path.join(SHOTS, name + '.png'))

async def ls(pg):
    return await pg.evaluate("() => JSON.parse(localStorage.getItem('hanjaPass.v1') || 'null')")

async def touch_draw(pg, cdp, strokes):
    await pg.eval_on_selector('.pad canvas', 'e => e.scrollIntoView({block: "center"})'); await pg.wait_for_timeout(120)
    box = await pg.eval_on_selector('.pad canvas', 'e => { const r = e.getBoundingClientRect(); return {x:r.left, y:r.top, width:r.width, height:r.height}; }')
    for s in strokes:
        pts = []
        for i in range(len(s) - 1):
            for k in range(3):
                t = k / 3; pts.append((s[i][0] + (s[i + 1][0] - s[i][0]) * t, s[i][1] + (s[i + 1][1] - s[i][1]) * t))
        pts.append(s[-1])
        conv = [(box['x'] + box['width'] * (0.05 + p[0] * 0.9), box['y'] + box['height'] * (0.05 + p[1] * 0.9)) for p in pts]
        await cdp.send('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': [{'x': conv[0][0], 'y': conv[0][1], 'id': 1}]})
        for x, y in conv[1:]:
            await cdp.send('Input.dispatchTouchEvent', {'type': 'touchMove', 'touchPoints': [{'x': x, 'y': y, 'id': 1}]})
        await cdp.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []})
        await pg.wait_for_timeout(40)

async def answer_session(pg, pick=0, max_q=40):
    """runSession 한 세트를 끝까지 (pick 번째 보기 선택). 결과/다음 단계가 나오면 종료"""
    n = 0
    while n < max_q:
        await pg.wait_for_timeout(150)
        if not await pg.query_selector('.qhost .choice:not([disabled])'):
            break
        await pg.tap(f'.qhost .choice >> nth={pick}')
        await pg.wait_for_selector('[data-next]:visible', timeout=5000)
        await pg.tap('[data-next]')
        n += 1
    return n

async def main():
    async with async_playwright() as p:
        br = await p.chromium.launch()
        dev = dict(p.devices['Pixel 7'])   # Android Chrome 모바일 에뮬레이션
        ctx = await br.new_context(**dev, locale='ko-KR', timezone_id='Asia/Seoul', service_workers='block')
        pg = await ctx.new_page()
        errors = []
        pg.on('pageerror', lambda e: errors.append('pageerror ' + str(e)[:200]))
        pg.on('console', lambda m: errors.append(m.text[:200]) if m.type == 'error' and 'fonts.g' not in m.text and 'ERR_' not in m.text else None)
        cdp = await ctx.new_cdp_session(pg)

        # H1 홈 진입 · H2 기관 선택 · H3 급수 선택
        await pg.goto(BASE); await pg.wait_for_selector('.pick')
        names = await pg.eval_on_selector_all('.pick .t', 'els => els.map(e => e.textContent)')
        rec('H1', '홈 진입 → 4개 기관', names == ['한국어문회', '대한검정회', '한자교육진흥회', '대한상공회의소'], str(names))
        await pg.goto(BASE + '#/onboard?p=eomunhoe'); await pg.wait_for_selector('.lv')
        await pg.click('[data-l="6"]'); await pg.wait_for_selector('.opt')
        await pg.click('.opt >> nth=0'); await pg.click('[data-m="20"]'); await pg.click('[data-go="skip"]')
        await pg.wait_for_selector('.today-card'); await pg.wait_for_timeout(400)
        st = await ls(pg)
        rec('H2-3', '기관(한국어문회)·급수(6급) 선택 저장', st['current']['provider'] == 'eomunhoe' and st['byProvider']['eomunhoe']['level'] == '6', st['byProvider']['eomunhoe'].get('examDate'))

        # A-1 오늘의 한자 학습 카드가 홈 최상단
        first = await pg.evaluate("document.querySelector('#view').firstElementChild.getAttribute('aria-label')")
        card = await pg.inner_text('.today-card')
        rec('A-1', '홈 상단 "오늘의 한자 학습" 카드 (목표·10분 학습 시작)', first == '오늘의 한자 학습' and '오늘의 목표' in card and '10분 학습' in card and '새 한자' in card, card.replace('\n', ' ')[:140])
        await shot(pg, 'u01-home')
        dd = await pg.inner_text('.dday')
        rec('A-9', 'D-Day 표시 + D-30/14/7/1 구간 표시', 'D-' in dd and 'D-30' in dd and 'D-14' in dd and 'D-7' in dd and 'D-1' in dd, dd.replace('\n', ' ')[:120])
        mcard = await pg.inner_text('[aria-label="한자 Mastery"]')
        rec('A-3a', '홈 "완전 학습 N/M" · 4단계', '완전 학습 0/' in mcard and '새 한자' in mcard and '학습 중' in mcard and '복습 필요' in mcard, mcard.replace('\n', ' ')[:100])

        # 10분 학습: 새 한자(알아요/몰라요 교대) → 사자성어 → 쓰기 단계에서 나중에 마치기
        td = st['byProvider']['eomunhoe']['today']
        new_set = td['set']['new']
        await pg.tap('.today-card a.btn'); await pg.wait_for_selector('.newcard')
        k = 0
        while await pg.query_selector('.newcard'):
            await pg.tap('[data-s="know"]' if k % 2 == 0 else '[data-s="dont"]'); k += 1
            await pg.wait_for_timeout(120)
            if k > 30: break
        await answer_session(pg, 0)   # 복습/오답/사자성어 단계 (있으면)
        await pg.wait_for_selector('[data-skip], h1:has-text("오늘의 학습")', timeout=8000)
        if await pg.query_selector('[data-skip]'):
            await pg.tap('[data-skip]')
        await pg.wait_for_selector('h1:has-text("오늘의 학습")')
        fin = await pg.inner_text('#view')
        st = await ls(pg)
        pv = st['byProvider']['eomunhoe']
        learned = [c for c in new_set if c in pv['mastery']]
        rec('A-1b', '10분 학습 진행 → 새 한자 기록 · 오늘 학습 완료 +10 XP', k == len(new_set) and len(learned) == len(new_set) and '+10 XP' in fin and st['xpAwards'][list(st['xpAwards'])[0]].get('study'), f'새 한자 {k}자 학습, 기록 {len(learned)}자, XP {st["xp"]}')

        # A-2 간격복습 기록 구조
        ch_know, ch_dont = new_set[0], new_set[1]
        e1, e2 = pv['mastery'][ch_know], pv['mastery'][ch_dont]
        srs = await pg.evaluate(f"() => [window.__hanja.S.srs('eomunhoe', '{ch_know}'), window.__hanja.S.srs('eomunhoe', '{ch_dont}')]")
        need = {'char', 'exam', 'level', 'correctCount', 'wrongCount', 'lastReviewed', 'nextReview', 'interval', 'mastery'}
        ok2 = srs and need <= set(srs[0]) and srs[0]['correctCount'] == 1 and srs[1]['wrongCount'] == 1 and srs[1]['interval'] == 1 and e2['due'] - e2['last'] <= 86400000 + 1000
        rec('A-2', '한자별 간격복습 기록 {char,exam,level,correctCount,wrongCount,lastReviewed,nextReview,interval,mastery}', ok2, f'{ch_know}: {srs[0] if srs else None} / {ch_dont}: interval {srs[1]["interval"] if srs else None}일')

        # 정답/오답 저장 → 오답 DNA
        await pg.goto(BASE + '#/quiz'); await pg.wait_for_selector('[data-start]')
        await pg.tap('[data-t="훈→한자"]'); await pg.tap('[data-n="10"]'); await pg.tap('[data-start]')
        await pg.wait_for_selector('.qhost .choice')
        n = await answer_session(pg, 0, 10)
        await pg.wait_for_timeout(400)
        st = await ls(pg); pv = st['byProvider']['eomunhoe']
        wrong_n = len([w for w in pv['wrong'].values() if not w['resolved']])
        rec('I6-7', '문제 정답·오답 저장 (quiz·wrong·mistakes)', pv['quiz']['answered'] >= n >= 5 and wrong_n > 0 and len(pv['mistakes']) >= wrong_n, f'답 {pv["quiz"]["answered"]} 정답 {pv["quiz"]["correct"]} 오답노트 {wrong_n} DNA 원자료 {len(pv["mistakes"])}')
        await pg.goto(BASE + '#/weak'); await pg.wait_for_selector('h1:has-text("나의 약점")')
        wk = await pg.inner_text('#view')
        rec('A-4', '오답 DNA (원인별 % · 가장 취약한 영역부터 복습 버튼)', '오답 DNA' in wk and '%' in wk and '가장 취약한 영역부터 복습' in wk, wk.split('영역별')[0].replace('\n', ' ')[:160])
        await shot(pg, 'u02-weak')
        await pg.tap('a:has-text("가장 취약한 영역부터 복습")')
        await pg.wait_for_selector('.qhost .choice, .notice', timeout=8000)
        drill = await pg.inner_text('#view')
        rec('A-4b', '약점 집중 복습 문제 자동 출제', '약점 복습' in drill or '다시 풀 문제' in drill, drill.replace('\n', ' ')[:80])
        rec('A-5', '혼동쌍 영역 표시 (실제 오답 기록 기반)', '자주 헷갈리는 한자쌍' in wk, ('/' in wk.split('자주 헷갈리는 한자쌍')[1][:200]) and '쌍 있음' or '아직 쌍 없음(오답 글자 선택형 없음)')

        # I8 스마트 복습 생성
        await pg.goto(BASE + '#/review'); await pg.wait_for_timeout(800)
        rv = await pg.inner_text('#view')
        rec('I8', 'Smart Review 복습 대상 생성', ch_dont in rv and '복습 대상 한자' in rv, f'{ch_dont} 포함')

        # A-6 3단계 쓰기 (흐리게 보고 쓰기) → 완료 여부·횟수 기록
        await pg.goto(BASE + '#/write?c=人'); await pg.wait_for_selector('.pad canvas')
        labels = await pg.eval_on_selector_all('[data-lv]', 'els => els.map(e => e.innerText.replace(/\\n/g, " "))')
        await pg.tap('[data-lv="2"]'); await pg.wait_for_timeout(400)
        await touch_draw(pg, cdp, medians('人')); await pg.wait_for_timeout(1300)
        fb = await pg.inner_text('[data-fb]')
        await pg.tap('[data-lv="3"]'); await pg.wait_for_timeout(400)
        await touch_draw(pg, cdp, medians('人')); await pg.wait_for_timeout(1300)
        st = await ls(pg); wm = st['byProvider']['eomunhoe']['writeModes'].get('人', {})
        rec('A-6', '쓰기 3단계(보고/흐리게 보고/안 보고) · 단계별 횟수 저장 · 획순 판정', labels == ['1단계 보고 쓰기', '2단계 흐리게 보고 쓰기', '3단계 안 보고 쓰기'] and wm.get('2') == 1 and wm.get('3') == 1 and '잘 썼어요' in fb, f'{labels} {wm} 판정="{fb.splitlines()[0] if fb else ""}"')

        # A-7 3초 한자 (일부 시간 초과)
        await pg.goto(BASE + '#/games?g=speed3'); await pg.wait_for_selector('.speed-bar')
        for i in range(10):
            await pg.wait_for_selector('.choice:not([disabled])', timeout=6000)
            if i % 3 == 2:
                await pg.wait_for_timeout(3300)          # 시간 초과
            else:
                await pg.tap('.choice >> nth=%d' % (i % 4))
            await pg.wait_for_timeout(1250)
        await pg.wait_for_selector('h1:has-text("3초 한자 결과")', timeout=8000)
        g = await pg.inner_text('#view')
        st = await ls(pg); gs = st['games'].get('speed3', {})
        rec('A-7', '3초 한자 10문제 → 정답률·평균 응답시간·가장 느린/많이 틀린 한자 저장', all(x in g for x in ['정답률', '평균 응답시간', '가장 느린 한자', '가장 많이 틀린 한자', '시간 초과']) and gs.get('n') == 1 and gs['last'].get('avgRt'), json.dumps(gs.get('last'), ensure_ascii=False)[:160])
        await shot(pg, 'u03-speed3')

        # A-8 사자성어 4가지 모드
        okm = []
        for mode in ['i2m', 'blank', 'arrange', 'write']:
            await pg.goto(BASE + f'#/idioms?mode={mode}&r={mode}'); await pg.wait_for_timeout(900)
            okm.append((mode, bool(await pg.query_selector('.choice, .arrange button, .pad canvas, .mw canvas, canvas'))))
        rec('A-8', '사자성어 뜻 맞히기·빈칸 한자·순서 맞추기·직접 쓰기', all(x[1] for x in okm), str(okm))

        # A-3 Mastery 화면
        await pg.goto(BASE + '#/mastery?s=LEARNING'); await pg.wait_for_selector('.cmp-num')
        ms = await pg.inner_text('#view')
        rec('A-3b', 'Mastery 화면 (단계별 목록 · 간격 · 다음 복습)', '완전 학습' in ms and '복습 간격' in ms and '다음 복습' in ms, ms.split('\n')[2][:60])

        # A-10 모의시험 연습문제 표기
        await pg.goto(BASE + '#/mock'); await pg.wait_for_timeout(900)
        mk = await pg.inner_text('#view')
        rec('A-10', '모의시험 "연습문제" 표시 · 기출 아님 안내', '연습문제' in mk and '공식 기출문제 아님' in mk, '')

        # A-12 주간 리포트
        await pg.goto(BASE + '#/weekly'); await pg.wait_for_selector('.report-grid')
        wr = await pg.inner_text('#view')
        rec('A-12', '주간 학습 리포트 (학습·완전학습·복습·정답률·쓰기·시간·취약영역·추천량)', all(x in wr for x in ['학습한 한자', '완전 학습', '복습한 한자', '문제 정답률', '쓰기 연습', '총 학습시간', '가장 취약한 영역', '다음 주 추천 학습량']), '')
        await shot(pg, 'u04-weekly')
        rec('A-11', 'Streak 기록 (1·3·7·14·30·100일) 표시', all(f'{n}일' in wr for n in [1, 3, 7, 14, 30, 100]) and st['streakMarks'].get('1'), json.dumps(st['streakMarks']))

        # 새로고침 후 진도 유지
        before = await ls(pg)
        await pg.reload(); await pg.wait_for_timeout(1200)
        after = await ls(pg)
        keep = all(before[k] == after[k] for k in ['xp', 'days', 'xpAwards', 'streakMarks']) and before['byProvider']['eomunhoe']['mistakes'] == after['byProvider']['eomunhoe']['mistakes'] and before['byProvider']['eomunhoe']['writeModes'] == after['byProvider']['eomunhoe']['writeModes'] and after['version'] == 3
        rec('I13', '새로고침 후 진도·XP·오답·쓰기 기록 유지', keep, f'XP {after["xp"]} mistakes {len(after["byProvider"]["eomunhoe"]["mistakes"])}')

        # 모바일 가로 넘침 (360px)
        over = []
        await pg.set_viewport_size({'width': 360, 'height': 780})
        for h in ['#/home', '#/today', '#/weak', '#/weekly', '#/mastery', '#/games?g=speed3']:
            await pg.goto(BASE + h); await pg.wait_for_timeout(700)
            if await pg.evaluate('document.documentElement.scrollWidth > innerWidth + 1'): over.append(h)
        rec('I14', '모바일 360px 가로 넘침 없음 (새 화면)', not over, str(over))
        # 터치 영역
        small = await pg.evaluate("[...document.querySelectorAll('#view button, #view a.btn')].filter(b => b.offsetParent && b.getBoundingClientRect().height < 44).map(b => b.textContent.trim()).slice(0, 5)")
        rec('H-a11y', '버튼 최소 터치 높이 44px', not small, str(small))
        await ctx.close()

        # v2 → v3 migration (기존 사용자 데이터 보존)
        ctx2 = await br.new_context(viewport={'width': 1280, 'height': 900}, service_workers='block')
        pg2 = await ctx2.new_page()
        pg2.on('pageerror', lambda e: errors.append('pageerror(PC) ' + str(e)[:200]))
        V2 = {"version": 2, "current": {"provider": "daehan"}, "minutes": 20, "byProvider": {"daehan": {"level": "5", "examDate": "2026-11-28", "examRound": "제113회",
              "cards": {"學": {"s": "know", "n": 3, "w": 0, "t": 1759000000000}}, "writing": {"學": {"ok": 2, "near": 0, "fail": 1, "t": 1759000000000, "last": "order"}},
              "words": {}, "idioms": {}, "quiz": {"answered": 5, "correct": 3, "byType": {}},
              "wrong": {"q1": {"q": {"id": "q1", "type": "eum-char", "typeLabel": "음→한자", "question": "q", "choices": ["學", "校", "敎", "室"], "answer": 0, "relatedHanja": ["學"]}, "count": 2, "t": 1759000000000, "cat": "한자", "resolved": False, "picked": 1}},
              "mocks": [], "mastery": {"學": {"m": 60, "st": 2, "due": 1759600000000, "n": 4, "ok": 3, "lap": 1, "rt": 0, "w": 3, "wok": 2, "last": 1759000000000}}, "confusions": {"學": {"校": 2}}, "dailyLog": {}}},
              "favorites": {"hanja": ["學"], "words": [], "idioms": []}, "xp": 77, "days": ["2026-09-27", "2026-09-28"], "quest": None, "badges": {}, "log": [{"t": 1759000000000, "k": "card"}], "time": {}, "games": {}, "parent": {"pin": None}}
        await pg2.add_init_script('if(!sessionStorage.getItem("seed")){localStorage.clear();localStorage.setItem("hanjaPass.v1", %s);sessionStorage.setItem("seed","1")}' % json.dumps(json.dumps(V2)))
        await pg2.goto(BASE + '#/home'); await pg2.wait_for_selector('.dday'); await pg2.wait_for_timeout(600)
        m = await pg2.evaluate("() => ({s: JSON.parse(localStorage.getItem('hanjaPass.v1')), bk: localStorage.getItem('hanjaPass.v1.backup.v2')})")
        s = m['s']; d = s['byProvider']['daehan']
        okm = (s['version'] == 3 and s['xp'] == 77 and s['days'][:2] == V2['days'] and d['wrong']['q1']['count'] == 2 and d['cards']['學']['s'] == 'know'
               and d['mastery']['學']['iv'] == 7 and len(d['mistakes']) == 2 and m['bk'] and json.loads(m['bk'])['version'] == 2 and s['favorites'] == V2['favorites'])
        rec('E', 'localStorage v2→v3 migration (XP·진도·오답·즐겨찾기 보존, 백업 생성, 오답 DNA 원자료 변환)', okm, f"version {s['version']}, xp {s['xp']}, mistakes {len(d['mistakes'])}, backup {'O' if m['bk'] else 'X'}")
        await pg2.goto(BASE + '#/weak'); await pg2.wait_for_selector('h1')
        wk2 = await pg2.inner_text('#view')
        rec('A-5b', '혼동쌍: 실제 오답 기록(學→校)으로 동적 생성', '學 / 校' in wk2 or '校 / 學' in wk2, '')
        rec('PC', 'PC Chrome 1280px 홈·약점 화면 렌더', '오답 DNA' in wk2, '')
        await ctx2.close()

        rec('J', 'Console JS error / page error 없음', not errors, '; '.join(errors[:5]))
        await br.close()
    fails = [r for r in res if not r[2]]
    print('\nSUMMARY', len(res) - len(fails), '/', len(res), 'PASS')
    with open(os.path.join(HERE, 'last-upgrade-result.json'), 'w', encoding='utf-8') as f:
        json.dump({'base': BASE, 'at': datetime.datetime.now().isoformat(), 'results': [dict(id=a, name=b, ok=c, detail=d) for a, b, c, d in res]}, f, ensure_ascii=False, indent=1)
    sys.exit(1 if fails else 0)

asyncio.run(main())
