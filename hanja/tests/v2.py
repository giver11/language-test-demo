#!/usr/bin/env python3
"""v2 기능 실제 브라우저 테스트 (Chromium/Playwright, 모바일 터치 에뮬레이션)
진단평가·Exam Coach·훈/음→한자 문항·검색(부수/획수/예문)·시험일정 '내 시험'·헷갈리는 한자·게임 5종·공유 카드·
콘텐츠 스튜디오·선생님 모드(시험지/정답지/과제 링크/결과 코드/취약한자)·부모 모드·카메라(화면)·쓰기 확장·
v1→v2 migration·재접속 유지·오프라인(Service Worker)·320/360/390/430 가로 넘침·console error.
사용: python3 tests/v2.py [BASE_URL]"""
import asyncio, json, sys, os, re, base64
from playwright.async_api import async_playwright

BASE = next((a for a in sys.argv[1:] if a.startswith('http')), 'http://localhost:8765/hanja/')
res = []
def rec(tid, name, ok, detail=''):
    res.append((tid, name, ok, detail)); print(('PASS' if ok else 'FAIL'), tid, name, '-', detail, flush=True)

V1_SAMPLE = {"current": {"provider": "daehan"}, "minutes": 20, "byProvider": {"daehan": {"level": "5", "examDate": "2026-11-28", "examRound": "제113회",
  "cards": {"學": {"s": "know", "n": 3, "w": 0, "t": 1759000000000}, "校": {"s": "dont", "n": 2, "w": 2, "t": 1759000000000}},
  "writing": {"學": {"ok": 2, "near": 0, "fail": 1, "t": 1759000000000}}, "words": {}, "idioms": {}, "quiz": {"answered": 12, "correct": 9, "byType": {}},
  "wrong": {}, "mocks": []}}, "favorites": {"hanja": ["學"], "words": [], "idioms": []}, "xp": 40, "days": ["2026-09-27", "2026-09-28"], "quest": None, "badges": {}, "log": []}

async def new_page(br, w=390, state=None):
    ctx = await br.new_context(viewport={'width': w, 'height': 820}, device_scale_factor=2, is_mobile=True, has_touch=True, service_workers='block')
    pg = await ctx.new_page()
    errs = []
    pg.on('console', lambda m: m.type == 'error' and errs.append(m.text[:300]))
    pg.on('pageerror', lambda e: errs.append('pageerror ' + str(e)[:300]))
    if state is not None:
        await pg.add_init_script('if(!sessionStorage.getItem("seeded")){localStorage.setItem("hanjaPass.v1", %s);sessionStorage.setItem("seeded","1")}' % json.dumps(json.dumps(state)))
    return ctx, pg, errs

async def go(pg, h, sel=None, t=15000):
    await pg.goto(BASE + h)
    if sel: await pg.wait_for_selector(sel, timeout=t)
    await pg.wait_for_timeout(250)

async def overflow(pg):
    return await pg.evaluate('document.documentElement.scrollWidth > innerWidth + 1')

async def main():
    async with async_playwright() as p:
        br = await p.chromium.launch()
        allerr = []

        # T1 첫 실행: 기관→급수→시험일→시간→진단평가→계획
        ctx, pg, errs = await new_page(br)
        await go(pg, '#/onboard', '[data-p]')
        await pg.click('[data-p="daehan"]'); await pg.wait_for_timeout(300)
        await pg.click('[data-l="5"]') if await pg.query_selector('[data-l="5"]') else None
        await pg.wait_for_timeout(300)
        body = await pg.inner_text('body')
        if await pg.query_selector('[data-skip]'): await pg.click('[data-skip]'); await pg.wait_for_timeout(300)
        ok_place = await pg.query_selector('[data-go="placement"]')
        if ok_place:
            await pg.click('[data-go="placement"]')
            await pg.wait_for_selector('.qhost .choice', timeout=15000)
            n = 0
            while n < 14 and await pg.query_selector('.qhost .choice'):
                chs = await pg.query_selector_all('.qhost .choice')
                if n % 4 == 3: await pg.click('[data-idk]')
                else: await chs[n % len(chs)].click()
                n += 1; await pg.wait_for_timeout(350)
            await pg.wait_for_selector('text=진단 결과', timeout=8000)
            txt = await pg.inner_text('#view')
            st = await pg.evaluate('JSON.parse(localStorage.getItem("hanjaPass.v1"))')
            mastery = len(st['byProvider']['daehan'].get('mastery', {}))
            rec('T1', '첫 실행 → 진단평가 → 개인 학습계획', '오늘의 개인 학습계획' in txt and mastery >= 8 and st['version'] >= 2, f'진단 {n}문항, mastery 기록 {mastery}자')
            await pg.click('text=학습 계획 보기'); await pg.wait_for_selector('.coach', timeout=10000)
            coach = await pg.inner_text('.coach')
            rec('T2', 'Exam Coach 카드(목표/숙련/학습중/미학습·준비도·오늘 계획)', all(k in coach for k in ['숙련', '미학습']) and '%' in coach, coach.replace('\n', ' ')[:140])
        else:
            rec('T1', '첫 실행 → 진단평가', False, '진단 버튼 없음: ' + body[:200])
        allerr += errs; await ctx.close()

        # 이후 테스트는 대한검정회 5급 상태로 시작
        base_state = dict(V1_SAMPLE)
        # T3 v1 → v2 migration(기존 기록 보존 + 백업)
        ctx, pg, errs = await new_page(br, state=base_state)
        await go(pg, '#/home', '.coach')
        st = await pg.evaluate('JSON.parse(localStorage.getItem("hanjaPass.v1"))')
        bk = await pg.evaluate('localStorage.getItem("hanjaPass.v1.backup.v1")')
        d = st['byProvider']['daehan']
        rec('T3', 'v1 기록 → v2 migration (삭제 없음, 백업 보관)', st['version'] >= 2 and d['cards']['學']['n'] == 3 and d['quiz']['answered'] == 12 and 'mastery' in d and '學' in d['mastery'] and bk is not None and st['favorites']['hanja'] == ['學'],
            f"mastery 學={d['mastery'].get('學', {}).get('m')} 校={d['mastery'].get('校', {}).get('m')}, backup={'있음' if bk else '없음'}")
        # T4 재접속 유지
        await pg.reload(); await pg.wait_for_selector('.coach')
        st2 = await pg.evaluate('JSON.parse(localStorage.getItem("hanjaPass.v1"))')
        rec('T4', '새로고침 후 기록 유지', st2['byProvider']['daehan']['cards'] == d['cards'] and st2['xp'] >= st['xp'])

        # T5 퀴즈: 훈→한자·음→한자 유형
        await go(pg, '#/quiz', '[data-start]')
        chips = await pg.inner_text('.chips')
        has = '훈→한자' in chips and '음→한자' in chips
        await pg.click('[data-t="훈→한자"]'); await pg.click('[data-start]')
        await pg.wait_for_selector('.qhost .choice')
        qt = await pg.inner_text('.qhost')
        await (await pg.query_selector_all('.qhost .choice'))[0].click(); await pg.wait_for_timeout(300)
        expl = await pg.inner_text('.q-explain')
        rec('T5', '문제 엔진: 훈→한자 · 음→한자 즉석 생성', has and '뜻(훈)을 가진 한자' in qt and '정답' in expl, qt.replace('\n', ' ')[:80])

        # T6 검색: 부수 / 획수 / 예문
        await go(pg, '#/search?q=' + '水부', '.srow')
        t1 = await pg.inner_text('[data-res]')
        await go(pg, '#/search?q=8획', '.srow')
        t2 = await pg.inner_text('[data-res]')
        await go(pg, '#/search?q=學', '.srow')
        t3 = await pg.inner_text('.srow')
        rec('T6', '검색: 부수(水부)·획수(8획)·훈음/부수/획수/급수/한자어/자체 예문', '부수 水' in t1 and '총 8획' in t2 and '부수 子' in t3 and '16획' in t3 and '예문:' in t3 and '대한검정회' in t3, t3.replace('\n', ' | ')[:160])

        # T7 시험일정 → 내 시험으로 설정 → D-Day
        await go(pg, '#/schedule?p=daehan', '[data-mine]')
        b = (await pg.query_selector_all('[data-mine]'))[-1]
        val = await b.get_attribute('data-mine')
        await b.click(); await pg.wait_for_selector('.dday', timeout=10000)
        st = await pg.evaluate('JSON.parse(localStorage.getItem("hanjaPass.v1"))')
        rec('T7', '시험일정 [내 시험으로 설정] → D-Day·Coach 연결', st['byProvider']['daehan']['examDate'] == val.split('|')[1], val)

        # T8 헷갈리는 한자
        await pg.evaluate('''() => { const s = window.__hanja.S; const p = s.prov('daehan'); p.confusions['木'] = {'本': 2}; p.writing['水'] = {ok:0, near:0, fail:3, t:Date.now()}; s.save(true); }''')
        await go(pg, '#/confuse', '.cf-row')
        ct = await pg.inner_text('#view')
        await pg.click('[data-q]'); await pg.wait_for_selector('.qhost .choice', timeout=8000)
        rec('T8', '내가 자꾸 틀리는 한자(헷갈림·쓰기 실패 기반) + 구별 퀴즈', '헷갈림 2회' in ct and '쓰기 실패 3회' in ct, ct.replace('\n', ' ')[:120])

        # T9 게임 5종
        gres = []
        # 60초 퀴즈: 몇 문제 풀고 타이머 종료까지 대기
        await go(pg, '#/games?g=quick60', '.choice')
        for i in range(5):
            c = await pg.query_selector_all('.choice:not([disabled])')
            if c: await c[i % 4].click()
            await pg.wait_for_timeout(1000)
        await pg.wait_for_selector('text=60초 퀴즈 결과', timeout=70000)
        for g in ['king', 'idiom']:
            await go(pg, '#/games?g=' + g, '.choice')
            for i in range(10):
                c = await pg.query_selector_all('.choice:not([disabled])')
                if not c: break
                await c[0].click(); await pg.wait_for_timeout(1300)
                if await pg.query_selector('text=결과') and not await pg.query_selector('.choice:not([disabled])'): break
            gres.append((g, 'ok'))
        await go(pg, '#/games?g=memory', '.mem')
        faces = await pg.eval_on_selector_all('.mem span', 'es => es.map(e => e.textContent)')
        # 정답 짝 찾기(한자 카드 ↔ 훈음 카드)
        dictp = await pg.evaluate('''async () => { const D = await import('./js/data.js'); const d = await D.dict(); return Object.fromEntries(%s.filter(x => [...x].length===1 && d[x]).map(x => [x, D.heStr(d[x], 'daehan')])); }''' % json.dumps(faces))
        for ch, he in dictp.items():
            i = faces.index(ch); j = faces.index(he)
            await (await pg.query_selector_all('.mem'))[i].click(); await (await pg.query_selector_all('.mem'))[j].click(); await pg.wait_for_timeout(250)
        await pg.wait_for_selector('text=짝맞추기 결과', timeout=5000)
        gres.append(('memory', 'ok'))
        await go(pg, '#/games?g=match', '[data-l]')
        for r in range(3):
            await pg.wait_for_selector('[data-l]:not([disabled])', timeout=5000)
            for L in await pg.query_selector_all('[data-l]'):
                ch = await L.get_attribute('data-l'); await L.click()
                await pg.click(f'[data-r="{ch}"]'); await pg.wait_for_timeout(120)
            await pg.wait_for_timeout(700)
        await pg.wait_for_selector('text=훈음 매칭 결과', timeout=5000)
        gres.append(('match', 'ok'))
        st = await pg.evaluate('JSON.parse(localStorage.getItem("hanjaPass.v1"))')
        rec('T9', '게임 5종 플레이 → 기록·mastery 반영', all(k in st['games'] for k in ['quick60', 'king', 'idiom', 'memory', 'match']) and st['games']['match']['best'] == 15, str({k: v['best'] for k, v in st['games'].items() if isinstance(v, dict) and 'best' in v}))

        # T10 공유 카드 (개인정보 없음, PNG 다운로드)
        await go(pg, '#/share', 'canvas')
        async with pg.expect_download() as dl:
            await pg.click('[data-dl]')
        f = await dl.value
        size = os.path.getsize(await f.path())
        rec('T10', '공유 카드 PNG 생성 (기본 개인정보 없음)', size > 10000 and f.suggested_filename.endswith('.png'), f'{f.suggested_filename} {size}B')

        # T11 콘텐츠 스튜디오 3형식 · 7종
        await go(pg, '#/studio', 'canvas')
        sizes = []
        for k in ['hanja', 'idiom', 'quiz3', 'confuse', 'kids', 'exam', 'radical']:
            await pg.click(f'[data-k] [data-v="{k}"]'); await pg.wait_for_timeout(120)
        for fm in ['9:16', '1:1', '16:9']:
            await pg.click(f'[data-f] [data-v="{fm}"]'); await pg.wait_for_timeout(120)
            sizes.append(await pg.eval_on_selector('canvas', 'c => c.width + "x" + c.height'))
        async with pg.expect_download() as dl:
            await pg.click('[data-dl]')
        f = await dl.value
        rec('T11', 'SNS 스튜디오: 7종 카드 · 9:16/1:1/16:9 · PNG', sizes == ['1080x1920', '1080x1080', '1920x1080'] and f.suggested_filename.endswith('.png'), ' '.join(sizes))

        # T12 선생님 모드: 반/학생 → 시험지+정답지 → 과제 링크 → 학생 풀이 → 결과 코드 → 취약한자 시험
        await go(pg, '#/teacher', '[data-cname]')
        await pg.fill('[data-cname]', '3학년 2반'); await pg.press('[data-cname]', 'Enter'); await pg.wait_for_selector('[data-sname]')
        for s in ['1번', '2번']:
            await pg.fill('[data-sname]', s); await pg.press('[data-sname]', 'Enter'); await pg.wait_for_timeout(400)
        await pg.click('[data-tab="sheet"]'); await pg.wait_for_selector('[data-form]')
        await pg.select_option('[data-lid]', '5')
        await pg.click('[data-form] button[type=submit]'); await pg.wait_for_selector('.ws-q', timeout=10000)
        nq = len(await pg.query_selector_all('.ws-preview .ws-q'))
        nans = len(await pg.query_selector_all('.ws-ans tr'))
        await pg.evaluate('() => { window.print = () => { window.__printed = (window.__printed||0) + 1; }; }')
        await pg.click('[data-print]'); await pg.wait_for_timeout(300)
        printed = await pg.evaluate('(window.__printed||0) + ":" + document.getElementById("printArea").querySelectorAll(".ws-q").length')
        await pg.click('[data-assign]'); await pg.wait_for_selector('[data-link]')
        link = await pg.eval_on_selector('[data-link]', 'e => e.value')
        # 학생 기기 (새 컨텍스트)
        ctx2, pg2, errs2 = await new_page(br, 360)
        await pg2.goto(link); await pg2.wait_for_selector('.qhost .choice', timeout=15000)
        k = 0
        while await pg2.query_selector('[data-next]') and k < 30:
            ch = await pg2.query_selector_all('.qhost .choice')
            if ch: await ch[k % 4].click()
            await pg2.wait_for_timeout(150)
            await pg2.click('[data-next]'); await pg2.wait_for_timeout(250); k += 1
        await pg2.wait_for_selector('[data-code]')
        code = await pg2.eval_on_selector('[data-code]', 'e => e.value')
        dec = json.loads(base64.urlsafe_b64decode(code + '=' * (-len(code) % 4)).decode())
        allerr += errs2; await ctx2.close()
        await pg.fill('[data-res] input', code); await pg.click('[data-res] button[type=submit]'); await pg.wait_for_timeout(500)
        tt = await pg.inner_text('#view')
        await pg.click('[data-tab="weak"]'); await pg.wait_for_selector('[data-form]')
        weak = await pg.eval_on_selector('[data-chars]', 'e => e.value')
        rec('T12', '선생님: 반·학생 → 시험지/정답지/인쇄 → 과제 링크 → 결과 코드 → 취약한자 시험', nq == 20 and nans == 20 and printed.startswith('1:20') and f"{dec['s']} / {dec['t']}" in tt and 'name' not in dec and (len(weak) > 0 or dec['s'] == dec['t']),
            f'시험지 {nq}문항·정답 {nans}·인쇄 {printed}·결과 {dec["s"]}/{dec["t"]}·취약 {weak[:20]}')

        # T13 부모 모드 리포트 + 프로필
        await go(pg, '#/parent', '[data-rep]')
        rep = await pg.inner_text('[data-rep]')
        await pg.fill('[data-nick]', '둘째'); await pg.press('[data-nick]', 'Enter'); await pg.wait_for_timeout(600)
        profs = await pg.evaluate('localStorage.getItem("hanjaPass.profiles")')
        rec('T13', '부모 모드: 주간 리포트(학습시간·학습/숙련/복습·쓰기·정답률·모의) + 자녀 프로필', '주간 리포트' in rep and '대한검정회' in rep and '둘째' in (profs or ''), rep.replace('\n', ' / ')[:160])

        # T14 쓰기 확장: 가이드 숨기기 · 획순 속도 · 직접 쓰기 시험
        await go(pg, '#/write', '.pad canvas')
        await pg.click('[data-act=guide]'); g = await pg.get_attribute('[data-act=guide]', 'aria-pressed')
        await pg.click('[data-act=order]'); await pg.wait_for_selector('[data-sp="0.4"]', timeout=5000)
        await pg.click('[data-sp="0.4"]'); await pg.wait_for_timeout(200); await pg.click('[data-close]') if await pg.query_selector('[data-close]') else None
        await pg.wait_for_timeout(300)
        await pg.click('[data-act=test]'); await pg.wait_for_timeout(500)
        cnt = await pg.inner_text('[data-count]'); show = await pg.inner_text('[data-show]')
        dis = await pg.eval_on_selector('[data-act=hint]', 'e => e.disabled')
        # 낙서 판정 → 합격 처리되면 안 됨
        box = await pg.eval_on_selector('.pad canvas', 'e => { e.scrollIntoView({block:"center"}); const r = e.getBoundingClientRect(); return {x:r.left, y:r.top, w:r.width, h:r.height}; }')
        await pg.mouse.move(box['x'] + 20, box['y'] + 20); await pg.mouse.down(); await pg.mouse.move(box['x'] + box['w'] - 30, box['y'] + box['h'] - 20, steps=8); await pg.mouse.up()
        await pg.click('[data-act=judge]'); await pg.wait_for_timeout(300)
        fb = await pg.inner_text('[data-fb]')
        rec('T14', '쓰기: 가이드 숨기기·느린 획순·직접 쓰기 시험·낙서 불인정', g == 'true' and cnt.startswith('시험 1') and show == '?' and dis and '정확' not in fb.split('\n')[0], f'{cnt} / 판정: {fb.splitlines()[0] if fb else ""}')

        # T15 카메라 화면(실험) + 설정 글자 크기
        await pg.goto(BASE + '#/camera'); await pg.wait_for_selector('[data-gal]', state='attached')
        await pg.fill('[data-q]', '學校'); await pg.press('[data-q]', 'Enter'); await pg.wait_for_selector('[data-c]')
        n = len(await pg.query_selector_all('[data-res] [data-c]'))
        await go(pg, '#/settings', '[data-fs="xl"]')
        await pg.click('[data-fs="xl"]'); fs = await pg.evaluate('getComputedStyle(document.documentElement).fontSize')
        await pg.click('[data-fs=""]')
        rec('T15', '카메라 검색 화면(직접 입력 대체) · 글자 크기 설정', n == 2 and fs == '20px', f'찾은 한자 {n}, 아주 크게={fs}')
        allerr += errs; await ctx.close()

        # T16 모바일 폭 320/360/390/430 — 가로 넘침·잘림
        routes = ['#/home', '#/placement', '#/confuse', '#/games', '#/games?g=memory', '#/games?g=match', '#/share', '#/studio', '#/teacher', '#/teacher?tab=sheet', '#/parent', '#/camera', '#/settings', '#/search?q=水부', '#/write', '#/quiz', '#/schedule', '#/more', '#/mock', '#/hanja']
        bad = []
        for w in [320, 360, 390, 430]:
            ctx, pg, errs = await new_page(br, w, state=V1_SAMPLE)
            for r in routes:
                await go(pg, r); await pg.wait_for_timeout(500)
                if await overflow(pg): bad.append(f'{w}:{r}')
            # 큰 글씨에서도
            await pg.evaluate('localStorage.setItem("hanja.fontScale","xl")')
            for r in ['#/home', '#/games', '#/teacher?tab=sheet', '#/parent']:
                await go(pg, r); await pg.wait_for_timeout(500)
                if await overflow(pg): bad.append(f'{w}xl:{r}')
            allerr += errs; await ctx.close()
        rec('T16', '모바일 320/360/390/430 (+큰 글씨) 가로 넘침 없음', not bad, ', '.join(bad) or f'{len(routes)}개 화면 × 4폭')

        # T17 오프라인 (Service Worker)
        ctx = await br.new_context(viewport={'width': 390, 'height': 820}, is_mobile=True, has_touch=True)
        pg = await ctx.new_page(); oerr = []
        pg.on('pageerror', lambda e: oerr.append(str(e)))
        await pg.add_init_script('localStorage.setItem("hanjaPass.v1", %s)' % json.dumps(json.dumps(V1_SAMPLE)))
        await pg.goto(BASE + '#/home'); await pg.wait_for_selector('.coach')
        await pg.evaluate('navigator.serviceWorker.ready')
        await pg.reload(); await pg.wait_for_selector('.coach')
        await go(pg, '#/settings', '[data-off]')
        await pg.click('[data-off]'); await pg.wait_for_function('document.querySelector("[data-offst]").textContent.includes("완료")', timeout=90000)
        offmsg = await pg.inner_text('[data-offst]')
        await ctx.set_offline(True)
        ok_off = True; det = []
        for r, sel in [('#/home', '.coach'), ('#/hanja', '.hcell'), ('#/quiz', '[data-start]'), ('#/write', '.pad canvas')]:
            try:
                await pg.goto(BASE + r); await pg.wait_for_selector(sel, timeout=8000); det.append(r + ' ok')
            except Exception as e:
                ok_off = False; det.append(r + ' 실패')
        try:
            await pg.click('[data-act=order]'); await pg.wait_for_selector('.anim svg', timeout=5000); det.append('획순 ok')
        except Exception:
            ok_off = False; det.append('획순 실패')
        rec('T17', '오프라인(PWA): 학습·플래시카드·퀴즈·쓰기', ok_off, offmsg + ' / ' + ', '.join(det))
        await ctx.close()

        # T19~T23 백업·이동·영상·예문
        ctx, pg, errs = await new_page(br, 390, state=V1_SAMPLE)
        await go(pg, '#/settings', '[data-export]')
        async with pg.expect_download() as dl:
            await pg.click('[data-export]')
        f = await dl.value; bpath = await f.path(); backup = open(bpath, encoding='utf-8').read()
        # 기록을 바꾼 뒤 백업 파일로 복원
        await pg.evaluate('() => { const s = window.__hanja.S; s.prov("daehan").cards["學"].n = 99; s.save(true); }')
        await pg.set_input_files('[data-import]', bpath); await pg.click('[data-imp-yes]'); await pg.wait_for_timeout(1500); await pg.wait_for_selector('#view h1')
        st = await pg.evaluate('JSON.parse(localStorage.getItem("hanjaPass.v1"))')
        keys = await pg.evaluate('Object.keys(localStorage).filter(k => k.includes("backup.import"))')
        rec('T19', '학습 기록 내보내기 → 가져오기(기존 기록은 백업 후 교체)', st['byProvider']['daehan']['cards']['學']['n'] == 3 and len(keys) == 1, f'복원 n={st["byProvider"]["daehan"]["cards"]["學"]["n"]}, 백업 {keys}')
        # 부모: 자녀 기기 기록을 새 프로필로
        await go(pg, '#/parent', '[data-pimp]', t=15000) if False else await pg.goto(BASE + '#/parent')
        await pg.wait_for_selector('[data-pimp]', state='attached')
        await pg.fill('[data-nick]', '첫째'); await pg.set_input_files('[data-pimp]', bpath); await pg.wait_for_selector('text=첫째', timeout=8000); await pg.wait_for_timeout(800)
        rep = await pg.inner_text('[data-rep]')
        rec('T20', '부모 모드: 자녀 기기 기록 가져와 프로필별 리포트', '첫째' in rep and '대한검정회 5급' in rep, rep.splitlines()[0])
        # 선생님 자료 내보내기 → 새 기기에서 가져오기
        await go(pg, '#/teacher', '[data-cname]')
        await pg.fill('[data-cname]', '한자반'); await pg.press('[data-cname]', 'Enter'); await pg.wait_for_selector('[data-sname]')
        await pg.fill('[data-sname]', '5번'); await pg.press('[data-sname]', 'Enter'); await pg.wait_for_timeout(400)
        async with pg.expect_download() as dl:
            await pg.click('[data-texp]')
        tpath = await (await dl.value).path()
        ctx3, pg3, errs3 = await new_page(br, 360)
        await pg3.goto(BASE + '#/teacher'); await pg3.wait_for_selector('[data-timp]', state='attached')
        await pg3.set_input_files('[data-timp]', tpath); await pg3.wait_for_timeout(1200)
        tv = await pg3.inner_text('#view')
        allerr += errs3; await ctx3.close()
        rec('T21', '선생님 자료 내보내기 → 다른 기기에서 가져오기', '한자반' in tv and '5번' in tv, tv.replace('\n', ' ')[:100])
        # 3초 퀴즈 영상(MediaRecorder)
        await go(pg, '#/studio?k=quiz3', 'canvas')
        async with pg.expect_download(timeout=30000) as dl:
            await pg.click('[data-vid]')
        vf = await dl.value; vsize = os.path.getsize(await vf.path())
        rec('T22', 'SNS 3초 퀴즈 영상 생성(브라우저 녹화)', vsize > 20000 and vf.suggested_filename.startswith('hanja-quiz3.'), f'{vf.suggested_filename} {vsize}B')
        # 예문 확대
        await go(pg, '#/search?q=試驗', '.srow')
        t = await pg.inner_text('[data-res]')
        n_ex = await pg.evaluate('async () => Object.keys(await (await import("./js/data.js")).examples()).length')
        rec('T23', '자체 작성 예문 확대', n_ex >= 250 and '예문:' in t, f'예문 {n_ex}개')
        allerr += errs; await ctx.close()

        errs_f = [e for e in allerr if 'favicon' not in e and 'ERR_TUNNEL_CONNECTION_FAILED' not in e and 'ERR_INTERNET_DISCONNECTED' not in e]
        rec('T18', 'console error / page error 없음', not errs_f, '; '.join(errs_f[:5]))
        await br.close()
    fails = [r for r in res if not r[2]]
    print(f'\n{len(res) - len(fails)}/{len(res)} PASS')
    sys.exit(1 if fails else 0)

asyncio.run(main())
