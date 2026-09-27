#!/usr/bin/env python3
"""실제 브라우저(Chromium, Playwright) E2E 테스트 — 요구사항 TEST 1~16 + 모바일 필기 검증.

사용: python3 tests/e2e.py [BASE_URL] [--shots DIR]
기본 BASE_URL = http://localhost:8765/hanja/
모바일 필기는 CDP Input.dispatchTouchEvent 로 실제 터치 이벤트를 발생시켜 검증한다(마우스 아님).
"""
import asyncio, json, os, sys, datetime, re
from playwright.async_api import async_playwright

BASE = next((a for a in sys.argv[1:] if a.startswith('http')), 'http://localhost:8765/hanja/')
SHOTS = sys.argv[sys.argv.index('--shots') + 1] if '--shots' in sys.argv else None
HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(os.path.dirname(HERE), 'data')
results = []

def load(p):
    with open(os.path.join(DATA, p), encoding='utf-8') as f:
        return json.load(f)

def rec(tid, name, ok, detail=''):
    results.append((tid, name, ok, detail))
    print(('PASS' if ok else 'FAIL'), tid, name, '-', detail, flush=True)

def fl(s):
    s = (s or '').strip()
    return s.splitlines()[0] if s else '(빈 피드백)'

def medians(ch):
    d = load('strokes/%04X.json' % ord(ch))
    return [[(x / 1024, (900 - y) / 1024) for x, y in s] for s in d['m']]

async def shot(pg, name):
    if SHOTS:
        os.makedirs(SHOTS, exist_ok=True)
        await pg.screenshot(path=os.path.join(SHOTS, name + '.png'), full_page=False)

async def touch_draw(pg, cdp, box, strokes, jitter=0.0, steps=3):
    """box: 캔버스 client rect. strokes: 0..1 좌표 목록. 실제 touchStart/Move/End 이벤트 발생."""
    for s in strokes:
        pts = []
        for i in range(len(s) - 1):
            for k in range(steps):
                t = k / steps
                pts.append((s[i][0] + (s[i + 1][0] - s[i][0]) * t, s[i][1] + (s[i + 1][1] - s[i][1]) * t))
        pts.append(s[-1])
        # 사람 글씨처럼 약간 작게 가운데 (0.9배)
        conv = [(box['x'] + box['width'] * (0.05 + p[0] * 0.9), box['y'] + box['height'] * (0.05 + p[1] * 0.9)) for p in pts]
        x0, y0 = conv[0]
        await cdp.send('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': [{'x': x0, 'y': y0, 'id': 1, 'radiusX': 4, 'radiusY': 4, 'force': 0.5}]})
        for x, y in conv[1:]:
            await cdp.send('Input.dispatchTouchEvent', {'type': 'touchMove', 'touchPoints': [{'x': x, 'y': y, 'id': 1, 'radiusX': 4, 'radiusY': 4, 'force': 0.5}]})
        await cdp.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []})
        await pg.wait_for_timeout(40)

async def pad_box(pg, sel='.pad canvas'):
    # 쓰기 칸 전체가 화면 안에 보이도록 (필요할 때만) 스크롤한 뒤 좌표 반환
    await pg.eval_on_selector(sel, 'e => { const r = e.getBoundingClientRect(); if (r.top < 0 || r.bottom > innerHeight) e.scrollIntoView({block: "center"}); }')
    await pg.wait_for_timeout(100)
    return await pg.eval_on_selector(sel, 'e => { const r = e.getBoundingClientRect(); return {x:r.left, y:r.top, width:r.width, height:r.height}; }')

async def ink_at(pg, fx, fy, sel='.pad canvas'):
    """캔버스 정규화 좌표(fx,fy) 근처 픽셀에 잉크가 있는지"""
    return await pg.eval_on_selector(sel, '''(c, [fx, fy]) => {
        const x = c.getContext('2d'); const W = c.width, H = c.height;
        const px = Math.round(fx * W), py = Math.round(fy * H);
        const d = x.getImageData(Math.max(0, px - 3), Math.max(0, py - 3), 7, 7).data;
        let a = 0; for (let i = 3; i < d.length; i += 4) a = Math.max(a, d[i]); return a; }''', [fx, fy])

async def ink_total(pg, sel='.pad canvas'):
    return await pg.eval_on_selector(sel, '''c => { const d = c.getContext('2d').getImageData(0,0,c.width,c.height).data; let n=0; for (let i=3;i<d.length;i+=4) if (d[i]>0) n++; return n; }''')

async def ls(pg):
    return await pg.evaluate("() => JSON.parse(localStorage.getItem('hanjaPass.v1') || 'null')")

async def main():
    levels = {p: load(f'providers/{p}/levels.json')['levels'] for p in ['eomunhoe', 'daehan', 'jinheung', 'korcham']}
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        dev = dict(p.devices['iPhone 13'])
        ctx = await browser.new_context(**dev, locale='ko-KR', timezone_id='Asia/Seoul')
        pg = await ctx.new_page()
        errors = []
        pg.on('pageerror', lambda e: errors.append(str(e)))
        pg.on('console', lambda m: errors.append(m.text) if m.type == 'error' and 'fonts.g' not in m.text and 'ERR_TUNNEL' not in m.text and 'ERR_CONNECTION' not in m.text else None)
        cdp = await ctx.new_cdp_session(pg)

        # ---------------- TEST 1
        await pg.goto(BASE)
        await pg.wait_for_selector('.pick')
        names = await pg.eval_on_selector_all('.pick .t', 'els => els.map(e => e.textContent)')
        title = await pg.inner_text('h1')
        rec('TEST 1', '앱 실행 → 4개 시험기관 표시', names == ['한국어문회', '대한검정회', '한자교육진흥회', '대한상공회의소'] and '어떤 한자시험을 준비하시나요' in title, str(names))
        await shot(pg, 't01-onboard')

        # ---------------- TEST 2
        ok2, det = True, []
        for pid in ['eomunhoe', 'daehan', 'jinheung', 'korcham']:
            await pg.goto(BASE + '#/onboard?p=' + pid)
            await pg.wait_for_selector('.lv')
            shown = await pg.eval_on_selector_all('.lv b', 'els => els.map(e => e.textContent)')
            expect = [l['name'] for l in levels[pid]]
            ok2 &= shown == expect
            det.append(f"{pid}:{len(shown)}급")
            if pid == 'korcham':
                await shot(pg, 't02-levels-korcham')
        rec('TEST 2', '기관 선택 → 실제 급수 표시', ok2, ', '.join(det))

        # 온보딩: 한국어문회 6급, 제115회
        await pg.goto(BASE + '#/onboard?p=eomunhoe')
        await pg.click('[data-l="6"]')
        await pg.wait_for_selector('.opt')
        await shot(pg, 't02-date')
        await pg.click('.opt >> nth=0')
        await pg.click('[data-m="30"]')
        await pg.click('[data-go]')
        await pg.wait_for_selector('.dday')

        # ---------------- TEST 13 (D-Day)
        st = await ls(pg)
        exam = st['byProvider']['eomunhoe']['examDate']
        today = datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=9))).date()
        n = (datetime.date.fromisoformat(exam) - today).days
        ddtxt = await pg.inner_text('.dday .num')
        rec('TEST 13', 'D-Day 자동 계산', ddtxt.strip() == f'D-{n}', f'{exam} → 화면 {ddtxt.strip()} / 계산 D-{n}')
        await shot(pg, 't13-home')

        # ---------------- TEST 3
        await pg.goto(BASE + '#/hanja?tab=new')
        await pg.wait_for_selector('.hcell')
        cells = await pg.eval_on_selector_all('.hcell .z', 'els => els.map(e => e.textContent)')
        mp = load('providers/eomunhoe/hanja-mapping.json')['items']
        exp6 = [x['c'] for x in mp if x['l'] == '6']
        await pg.click('[data-tab=all]'); await pg.wait_for_timeout(500)
        cells_all = await pg.eval_on_selector_all('.hcell', 'els => els.length')
        cum = sum(1 for x in mp if x['l'] in ('8', '7-2', '7', '6-2', '6'))
        rec('TEST 3', '급수 선택 → 해당 기관/급수 한자', cells == exp6 and cells_all == cum, f'신출 {len(cells)}자(데이터 {len(exp6)}), 누적 {cells_all}자(데이터 {cum})')

        # ---------------- TEST 4 Flash card
        await pg.goto(BASE + '#/cards?set=new')
        await pg.wait_for_selector('.flash')
        ch = (await pg.inner_text('.flash .front .z')).strip()
        await pg.tap('[data-flip]'); await pg.wait_for_timeout(600)
        flipped = await pg.eval_on_selector('.flash', 'e => e.classList.contains("flip")')
        await shot(pg, 't04-card-back')
        back = await pg.inner_text('.flash .back')
        await pg.tap('[data-k=know]'); await pg.wait_for_timeout(200)
        ch2 = (await pg.inner_text('.flash .front .z')).strip()
        await pg.tap('[data-k=unsure]'); await pg.wait_for_timeout(200)
        ch3 = (await pg.inner_text('.flash .front .z')).strip()
        await pg.tap('[data-k=dont]'); await pg.wait_for_timeout(300)
        st = await ls(pg)
        cards = st['byProvider']['eomunhoe']['cards']
        ok4 = flipped and '음' in back and '부수' in back and cards.get(ch, {}).get('s') == 'know' and cards.get(ch2, {}).get('s') == 'unsure' and cards.get(ch3, {}).get('s') == 'dont'
        await pg.goto(BASE + '#/review'); await pg.wait_for_timeout(700)
        rv = await pg.inner_text('#view')
        ok4 &= ch2 in rv and ch3 in rv
        rec('TEST 4', 'Flash Card 뒤집기·알아요/헷갈려요/몰라요 저장 → Smart Review 이동', ok4, f'{ch}=know {ch2}=unsure {ch3}=dont, Smart Review 포함')

        # ---------------- TEST 5 모바일 손가락 필기
        await pg.goto(BASE + '#/write?c=' + '人')
        await pg.wait_for_selector('.pad canvas')
        await pg.tap('[data-lv="3"]'); await pg.wait_for_timeout(400)
        # 페이지를 조금 스크롤한 상태에서 필기 → 스크롤 충돌 확인
        await pg.evaluate('window.scrollTo(0, 120)'); await pg.wait_for_timeout(150)
        box = await pad_box(pg)
        y_before = await pg.evaluate('window.scrollY')
        m = medians('人')
        await touch_draw(pg, cdp, box, m)
        await pg.wait_for_timeout(1200)  # 획수 도달 시 자동 채점
        y_after = await pg.evaluate('window.scrollY')
        scale = await pg.evaluate('window.visualViewport ? visualViewport.scale : 1')
        fb = await pg.inner_text('[data-fb]')
        s0 = m[0][len(m[0]) // 2]
        ink_hit = await ink_at(pg, 0.05 + s0[0] * 0.9, 0.05 + s0[1] * 0.9)
        ink_miss = await ink_at(pg, 0.97, 0.97)
        await shot(pg, 't05-touch-written')
        total1 = await ink_total(pg)
        await pg.tap('[data-act=clear]'); await pg.wait_for_timeout(200)
        total_clear = await ink_total(pg)
        await touch_draw(pg, cdp, await pad_box(pg), m)
        await pg.wait_for_timeout(1200)
        fb2 = await pg.inner_text('[data-fb]')
        await pg.tap('[data-act=retry]'); await pg.wait_for_timeout(200)
        total_retry = await ink_total(pg)
        # 오답 글씨(다른 글자 획) → 판정이 '잘 썼어요'가 아니어야 함
        await touch_draw(pg, cdp, await pad_box(pg), medians('大'))
        await pg.tap('[data-act=judge]'); await pg.wait_for_timeout(400)
        fb3 = await pg.inner_text('[data-fb]')
        touch_action = await pg.eval_on_selector('.pad canvas', 'e => getComputedStyle(e).touchAction')
        ok5 = (y_before == y_after and scale == 1 and ink_hit > 0 and ink_miss == 0 and total1 > 0 and total_clear == 0 and total_retry == 0
               and '잘 썼어요' in fb and '잘 썼어요' in fb2 and '잘 썼어요' not in fb3 and touch_action == 'none')
        rec('TEST 5', '스마트폰 viewport 손가락 필기 → 지우기 → 다시 쓰기', ok5,
            f'scrollY {y_before}→{y_after}, zoom {scale}, 좌표 일치 ink={ink_hit}, 빈곳 ink={ink_miss}, 판정1="{fl(fb)}", 지우기 후 픽셀 {total_clear}, 재작성 판정="{fl(fb2)}", 다른 글자 판정="{fl(fb3)}", touch-action={touch_action}')

        # 가로 모드(회전) 좌표 검증
        await pg.set_viewport_size({'width': 844, 'height': 390})
        await pg.wait_for_timeout(500)
        await pg.evaluate('window.scrollTo(0, 0)')
        await pg.tap('[data-act=clear]')
        box_l = await pad_box(pg)
        await pg.evaluate(f'window.scrollTo(0, {max(0, int(box_l["y"]) - 60)})'); await pg.wait_for_timeout(200)
        box_l = await pad_box(pg)
        yb = await pg.evaluate('window.scrollY')
        print('  landscape pad', box_l, 'viewport 844x390', flush=True)
        await touch_draw(pg, cdp, box_l, m)
        await pg.wait_for_timeout(1200)
        ya = await pg.evaluate('window.scrollY')
        fbl = await pg.inner_text('[data-fb]')
        hit_l = await ink_at(pg, 0.05 + s0[0] * 0.9, 0.05 + s0[1] * 0.9)
        await shot(pg, 't05-landscape')
        rec('TEST 5b', '가로 모드 필기 좌표·스크롤', yb == ya and hit_l > 0 and '잘 썼어요' in fbl, f'pad {int(box_l["width"])}px, scrollY {yb}→{ya}, 판정="{fl(fbl)}"')
        await pg.set_viewport_size({'width': 390, 'height': 664})
        await pg.wait_for_timeout(300)

        # 학(學) 16획 복잡한 글자 터치 필기
        await pg.goto(BASE + '#/write?c=學')
        await pg.wait_for_selector('.pad canvas'); await pg.wait_for_timeout(300)
        await touch_draw(pg, cdp, await pad_box(pg), medians('學'))
        await pg.wait_for_timeout(1300)
        fbx = await pg.inner_text('[data-fb]')
        await shot(pg, 't05-hak')
        rec('TEST 5c', '16획 學 터치 필기 판정', '잘 썼어요' in fbx or '거의 맞았어요' in fbx, fl(fbx))

        # ---------------- TEST 6 획순
        await pg.goto(BASE + '#/search?q=學')
        await pg.wait_for_selector('.hcell')
        await pg.tap('.hcell')
        await pg.wait_for_selector('.stroke-steps figure')
        figs = await pg.eval_on_selector_all('.stroke-steps figcaption', 'els => els.map(e => e.textContent)')
        await pg.wait_for_timeout(1500)
        anim_paths = await pg.eval_on_selector_all('.stroke-anim polyline', 'els => els.map(e => +e.getAttribute("stroke-dashoffset"))')
        await shot(pg, 't06-stroke')
        n_st = len(load('strokes/5B78.json')['s'])
        ok6 = len(figs) == n_st and figs[0] == '1획' and figs[-1] == f'{n_st}획' and len(anim_paths) == n_st and anim_paths[0] < 1
        # 획순 데이터 없는 글자는 애니메이션 없음 확인 (敎)
        await pg.goto(BASE + '#/search?q=敎'); await pg.wait_for_selector('.hcell'); await pg.tap('.hcell'); await pg.wait_for_timeout(800)
        nodata = await pg.inner_text('#sheet')
        ok6 &= '획순 데이터가 없어' in nodata and await pg.eval_on_selector_all('#sheet .stroke-anim polyline', 'e => e.length') == 0
        rec('TEST 6', '획순 표시(1획~N획 + 애니메이션, 데이터 없는 글자는 표시 안 함)', ok6, f'學 {len(figs)}단계, 애니메이션 진행 중 첫 획 offset={anim_paths[0] if anim_paths else None}; 敎 → 데이터 없음 안내')
        await pg.keyboard.press('Escape')

        # ---------------- TEST 7 사자성어 학습
        await pg.goto(BASE + '#/idioms')
        await pg.wait_for_selector('[data-id]')
        n_id = await pg.eval_on_selector_all('[data-id]', 'e => e.length')
        await pg.tap('[data-id] >> nth=0')
        await pg.wait_for_selector('#sheet .idiom-big')
        sheet = await pg.inner_text('#sheet')
        await shot(pg, 't07-idiom')
        ok7 = '사용 예' in sheet and '관련 시험급수' in sheet and '관련 한자' in sheet
        await pg.goto(BASE + '#/idioms?mode=i2m')
        await pg.wait_for_selector('.choice')
        await pg.tap('.choice >> nth=0')
        await pg.wait_for_selector('.explain')
        ok7 &= 'explain' in (await pg.inner_html('.q-explain'))
        modes_ok = True
        for mode in ['m2i', 'blank', 'reading']:
            await pg.goto(BASE + f'#/idioms?mode={mode}&r={mode}'); await pg.wait_for_selector('.choice'); await pg.tap('.choice >> nth=1'); await pg.wait_for_selector('.explain')
        await pg.goto(BASE + '#/idioms?mode=arrange'); await pg.wait_for_selector('.arrange button')
        for k in range(4):
            await pg.tap(f'.arrange button[data-k="{k}"]')
        await pg.wait_for_timeout(200)
        arr = await pg.inner_text('.q-explain')
        modes_ok &= ('정답' in arr or '오답' in arr)
        rec('TEST 7', '사자성어 학습(상세·뜻/성어/빈칸/독음/배열 문제)', ok7 and modes_ok, f'6급 범위 사자성어 {n_id}개')

        # ---------------- TEST 8 사자성어 네 글자 쓰기
        idi = load('dictionary/idioms.json')['idioms']
        it = next(x for x in idi if x['w'] == '一石二鳥')
        await pg.goto(BASE + f'#/idioms?mode=write&id={it["id"]}')
        await pg.wait_for_selector('.slot')
        slots = await pg.eval_on_selector_all('.slot', 'e => e.length')
        for i, c in enumerate(it['w']):
            await touch_draw(pg, cdp, await pad_box(pg), medians(c))
            if i < 3:
                await pg.wait_for_timeout(1300)  # 획수 도달 → 자동으로 다음 칸 이동
                active = await pg.eval_on_selector_all('.slot', 'els => els.findIndex(e => e.classList.contains("active"))')
                if active != i + 1:
                    await pg.tap('[data-a=next]')
        await pg.tap('[data-a=next]')  # 완료
        await pg.wait_for_selector('[data-after]:not([style*="none"])')
        fb8 = await pg.inner_text('.feedback')
        marks = await pg.eval_on_selector_all('.slot .res', 'els => els.map(e => e.textContent)')
        await shot(pg, 't08-idiom-write')
        await pg.tap('[data-a=answer]')
        ans = await pg.eval_on_selector_all('.slot .hanzi', 'els => els.map(e => e.textContent).join("")')
        await pg.tap('[data-a=restart]')
        cleared = await pg.eval_on_selector_all('.slot img', 'e => e.length')
        rec('TEST 8', '사자성어 네 글자 직접 쓰기(칸 이동·판정·정답·다시 쓰기)', slots == 4 and marks.count('✓') >= 3 and ans == it['w'] and cleared == 0,
            f'{it["w"]}: {"".join(marks)} — {fl(fb8)}')

        # ---------------- TEST 9 문제 10개 풀이
        await pg.goto(BASE + '#/quiz')
        await pg.wait_for_selector('[data-start]')
        await pg.tap('[data-n="10"]')
        await pg.tap('[data-start]')
        explained = 0; wrote = 0
        for i in range(10):
            await pg.wait_for_selector('.qhost .choice, .qhost .pad canvas')
            if await pg.query_selector('.qhost .pad canvas'):
                await touch_draw(pg, cdp, await pad_box(pg, '.qhost .pad canvas'), medians('一'))
                await pg.tap('.qhost [data-act=submit]'); wrote += 1
            else:
                await pg.tap('.choice >> nth=%d' % (i % 4))
            await pg.wait_for_selector('.q-explain .explain')
            explained += 1
            if i == 1: await shot(pg, 't09-explain')
            await pg.tap('[data-next]')
        await pg.wait_for_selector('.cmp-num')
        score = await pg.inner_text('.cmp-num')
        await shot(pg, 't09-result')
        rec('TEST 9', '문제 10개 풀이 → 채점 → 해설', explained == 10 and '/ 10' in score, f'점수 {score}, 해설 {explained}개, 쓰기문항 {wrote}개')

        # ---------------- TEST 10 오답노트
        st = await ls(pg)
        wrong = st['byProvider']['eomunhoe']['wrong']
        n_wrong = sum(1 for w in wrong.values() if not w.get('resolved'))
        await pg.goto(BASE + '#/wrong')
        await pg.wait_for_selector('[data-retry]')
        wtxt = await pg.inner_text('#view')
        await shot(pg, 't10-wrong')
        # 다시 풀기: 정답을 골라 해결 처리 확인
        n_retry = int(re.search(r'\((\d+)문제\)', await pg.inner_text('[data-retry]')).group(1))
        await pg.tap('[data-retry]')
        solved = 0
        for _ in range(n_retry):
            await pg.wait_for_selector('.qhost .choice, .qhost .pad canvas')
            qid_text = await pg.inner_text('.qhost .q-text')
            if await pg.query_selector('.qhost .pad canvas'):
                await pg.tap('.qhost [data-act=submit]')  # 빈 답
                await touch_draw(pg, cdp, await pad_box(pg, '.qhost .pad canvas'), medians('一'))
                await pg.tap('.qhost [data-act=submit]')
            else:
                # 정답 번호는 저장된 오답 데이터에서 찾기
                ans_idx = await pg.evaluate('''(t) => { const w = Object.values(JSON.parse(localStorage.getItem('hanjaPass.v1')).byProvider.eomunhoe.wrong);
                    const p = document.querySelector('.qhost .q-prompt'); const pr = p ? p.textContent : '';
                    const f = w.find(x => x.q.question === t && (x.q.prompt || '') === pr); return f ? f.q.answer : 0; }''', qid_text)
                await pg.tap('.choice >> nth=%d' % ans_idx)
                solved += 1
            await pg.wait_for_selector('.q-explain .explain')
            await pg.tap('[data-next]')
        await pg.wait_for_selector('.cmp-num')
        retry_score = int((await pg.inner_text('.cmp-num')).split('/')[0])
        await pg.wait_for_timeout(400)
        st2 = await ls(pg)
        resolved = sum(1 for w in st2['byProvider']['eomunhoe']['wrong'].values() if w.get('resolved'))
        rec('TEST 10', '오답노트 자동 저장 → 다시 풀기', n_wrong > 0 and '회 틀림' in wtxt and resolved >= retry_score > 0, f'저장된 오답 {n_wrong}개, 다시 풀기 {n_retry}문제 중 {retry_score}개 정답 → 해결 처리 {resolved}개')

        # ---------------- TEST 11 모의시험
        await pg.goto(BASE + '#/mock')
        await pg.wait_for_selector('[data-start=mini]')
        mock_info = await pg.inner_text('#view')
        await pg.tap('[data-start=mini]')
        await pg.wait_for_selector('.timer')
        await pg.wait_for_timeout(1200)
        t1 = await pg.inner_text('.timer'); await pg.wait_for_timeout(2100); t2 = await pg.inner_text('.timer')
        total_q = int(re.search(r'/(\d+)', await pg.inner_text('.spread .small')).group(1))
        await shot(pg, 't11-mock-run')
        for k in range(min(8, total_q)):
            if await pg.query_selector('.qhost .pad canvas'):
                await touch_draw(pg, cdp, await pad_box(pg, '.qhost .pad canvas'), medians('一'))
                await pg.tap('.qhost [data-act=submit]')
            elif await pg.query_selector('.choice'):
                await pg.tap('.choice >> nth=0')
            await pg.tap('[data-next]'); await pg.wait_for_timeout(150)
        await pg.reload(); await pg.wait_for_selector('.timer')  # 새로고침해도 시험 유지
        kept = await pg.inner_text('.spread .small')
        await pg.tap('[data-submit]'); await pg.wait_for_selector('[data-yes]'); await pg.tap('[data-yes]')
        await pg.wait_for_selector('.cmp-num')
        res = await pg.inner_text('#view')
        await shot(pg, 't11-mock-result')
        ok11 = t1 != t2 and '총점' in res and '유형별 정답률' in res and '취약 한자' in res and '쓰기 취약 한자' in res and ('공식 합격 기준' in res) and '90문항' in mock_info and '50분' in mock_info
        rec('TEST 11', '모의시험 → 타이머 → 제출 → 채점 → 결과', ok11, f'미니 {total_q}문항, 타이머 {t1}→{t2}, 새로고침 후 "{kept}", 공식 형식 90문항·50분·63문항 표시')

        # ---------------- TEST 12 일정
        await pg.goto(BASE + '#/schedule')
        await pg.wait_for_selector('.sched-cards')
        sch = await pg.inner_text('#view')
        await shot(pg, 't12-schedule')
        ok12 = all(x in sch for x in ['한국어문회', '대한검정회', '한자교육진흥회', '대한상공회의소', '2026.11.21', '2026.11.28', '제126회', '상시 시험', '마지막 확인: 2026-09-28', '공식 시험기관 발표 기준'])
        # 데이터 파일과 화면 대조
        for pid in ['eomunhoe', 'daehan', 'jinheung']:
            for s in load(f'schedules/{pid}-2026.json')['sessions']:
                ok12 &= s['examDate'].replace('-', '.') in sch
        rec('TEST 12', '4개 기관 2026 시험일정', ok12, '어문회 4회·검정회 4회+온라인 2회·진흥회 4회·상공회의소 상시')

        # ---------------- TEST 14 기관 변경 → 기존 진도 유지
        before = (await ls(pg))['byProvider']['eomunhoe']
        await pg.goto(BASE + '#/onboard?switch=1')
        await pg.tap('[data-p=daehan]'); await pg.tap('[data-l="8"]'); await pg.wait_for_timeout(300)
        await pg.tap('[data-skip]'); await pg.tap('[data-go]')
        await pg.wait_for_selector('.dday')
        ctxbtn = await pg.inner_text('#ctxBtn')
        await pg.goto(BASE + '#/cards?set=new'); await pg.wait_for_selector('.flash'); await pg.tap('[data-k=know]')
        await pg.goto(BASE + '#/settings'); await pg.wait_for_selector('[data-switch=eomunhoe]'); await pg.tap('[data-switch=eomunhoe]')
        await pg.wait_for_selector('.dday')
        after = (await ls(pg))['byProvider']['eomunhoe']
        dh = (await ls(pg))['byProvider']['daehan']
        ctxbtn2 = await pg.inner_text('#ctxBtn')
        ok14 = before['cards'] == after['cards'] and before['wrong'].keys() == after['wrong'].keys() and len(before['mocks']) == len(after['mocks']) and len(dh['cards']) == 1 and '대한검정회 8급' in ctxbtn and '한국어문회 6급' in ctxbtn2
        rec('TEST 14', '기관 변경 → 기존 진도 유지(기관별 분리 저장)', ok14, f'어문회 카드 {len(before["cards"])}→{len(after["cards"])}, 오답 {len(after["wrong"])}, 모의 {len(after["mocks"])}; 검정회 카드 {len(dh["cards"])}')

        # ---------------- TEST 15 기관 비교
        await pg.goto(BASE + '#/compare?from=daehan:8&to=eomunhoe:8')
        await pg.wait_for_selector('.cmp-num')
        nums = await pg.eval_on_selector_all('.card .cmp-num', 'els => els.map(e => +e.textContent)')
        A = {x['c'] for x in load('providers/daehan/hanja-mapping.json')['items']}
        B = [x['c'] for x in mp if x['l'] == '8']
        st = await ls(pg)
        learned = {c for p_ in st['byProvider'].values() for c, e in p_['cards'].items() if e.get('s') == 'know'}
        exp = [len([c for c in B if c in A]), len([c for c in B if c not in A]), len([c for c in B if c in learned]), len([c for c in B if c not in learned]), len([c for c in A if c not in B])]
        await shot(pg, 't15-compare')
        rec('TEST 15', '기관별 급수 비교(실제 매핑 기준)', nums == exp, f'검정회8급→어문회8급: 공통 {nums[0]}, 새로 {nums[1]}, 이미 학습 {nums[2]}, 추가 {nums[3]}, 빠짐 {nums[4]} (파일 계산 {exp})')

        # ---------------- TEST 16 새로고침 → 기록 유지
        before = await ls(pg)
        await pg.goto(BASE + '#/home'); await pg.wait_for_selector('.dday')
        home_before = await pg.inner_text('.stat-grid')
        await pg.reload(); await pg.wait_for_selector('.dday')
        after = await ls(pg)
        home_after = await pg.inner_text('.stat-grid')
        # 새 컨텍스트 페이지(탭 새로 열기)에서도 유지
        pg2 = await ctx.new_page(); await pg2.goto(BASE); await pg2.wait_for_selector('.dday')
        tab2 = await pg2.inner_text('#ctxBtn')
        keys = ['current', 'minutes', 'byProvider', 'favorites', 'xp', 'days', 'badges']
        ok16 = all(before[k] == after[k] for k in keys) and home_before == home_after and '한국어문회 6급' in tab2
        e = after['byProvider']['eomunhoe']
        rec('TEST 16', '새로고침 → 모든 학습 기록 유지', ok16, f'카드 {len(e["cards"])}, 쓰기 {len(e["writing"])}, 문제 {e["quiz"]["answered"]}, 오답 {len(e["wrong"])}, 모의 {len(e["mocks"])}, XP {after["xp"]}, streak일 {len(after["days"])}, 기관 {len(after["byProvider"])}')
        await pg2.close()

        # 추가: 데스크톱 마우스 필기
        dctx = await browser.new_context(viewport={'width': 1280, 'height': 900}, locale='ko-KR')
        await dctx.add_init_script("if(!localStorage.getItem('hanjaPass.v1')) localStorage.setItem('hanjaPass.v1', %s)" % json.dumps(json.dumps(after)))
        dp = await dctx.new_page()
        await dp.goto(BASE + '#/write?c=大'); await dp.wait_for_selector('.pad canvas'); await dp.wait_for_timeout(300)
        b = await pad_box(dp)
        for s in medians('大'):
            pts = [(b['x'] + b['width'] * (0.05 + x * 0.9), b['y'] + b['height'] * (0.05 + y * 0.9)) for x, y in s]
            await dp.mouse.move(*pts[0]); await dp.mouse.down()
            for q in pts[1:]: await dp.mouse.move(*q, steps=3)
            await dp.mouse.up()
        await dp.wait_for_timeout(1200)
        fbd = await dp.inner_text('[data-fb]')
        await dp.screenshot(path=os.path.join(SHOTS, 'desktop-mouse.png')) if SHOTS else None
        rec('EXTRA', 'PC 마우스 필기', '잘 썼어요' in fbd, fl(fbd))
        await dctx.close()

        rec('ERRORS', '페이지 JS 오류 없음', not errors, '; '.join(errors[:5]))
        await browser.close()
    fails = [r for r in results if not r[2]]
    print('\nSUMMARY', len(results) - len(fails), '/', len(results), 'PASS')
    with open(os.path.join(HERE, 'last-e2e-result.json'), 'w', encoding='utf-8') as f:
        json.dump({'base': BASE, 'at': datetime.datetime.now().isoformat(), 'results': [dict(id=a, name=b, ok=c, detail=d) for a, b, c, d in results]}, f, ensure_ascii=False, indent=1)
    sys.exit(1 if fails else 0)

asyncio.run(main())
