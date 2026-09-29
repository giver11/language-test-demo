#!/usr/bin/env python3
"""대한검정회 공식 데이터 · 모바일(360/390/412px) · 타 기관 회귀 E2E 테스트 (Playwright Chromium, 실제 터치 이벤트).

사용: python3 tests/daehan.py [BASE_URL] [--shots DIR] [--json OUT]
"""
import asyncio, json, os, sys
from playwright.async_api import async_playwright

BASE = next((a for a in sys.argv[1:] if a.startswith('http')), 'http://localhost:8765/hanja/')
SHOTS = sys.argv[sys.argv.index('--shots') + 1] if '--shots' in sys.argv else None
OUT = sys.argv[sys.argv.index('--json') + 1] if '--json' in sys.argv else None
HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(os.path.dirname(HERE), 'data')
results = []

def load(p):
    with open(os.path.join(DATA, p), encoding='utf-8') as f:
        return json.load(f)

def rec(tid, name, ok, detail=''):
    results.append({'id': tid, 'name': name, 'ok': bool(ok), 'detail': detail})
    print(('PASS' if ok else 'FAIL'), tid, name, '-', detail, flush=True)

async def shot(pg, name):
    if SHOTS:
        os.makedirs(SHOTS, exist_ok=True)
        await pg.screenshot(path=os.path.join(SHOTS, name + '.png'))

EXPECT = {'8': 30, '7': 50, '6': 70, '5-j': 100, '5': 250, '4-j': 400, '4': 600, '3-j': 800, '3': 1000,
          '2-j': 1500, '2': 2000, '1-j': 2500, '1': 3500, 'sa': 5000}

NAV = 0
async def choose(pg, pid, lid):
    global NAV
    NAV += 1
    await pg.goto(BASE + f'#/onboard?switch=1&t={NAV}')
    await pg.wait_for_selector(f'[data-p="{pid}"]')
    await pg.click(f'[data-p="{pid}"]')
    await pg.wait_for_selector(f'[data-l="{lid}"]')
    await pg.click(f'[data-l="{lid}"]')
    await pg.wait_for_selector('[data-skip], .opt')
    if await pg.query_selector('[data-skip]'):
        await pg.click('[data-skip]')
    else:
        await pg.click('.opt >> nth=0')
    await pg.wait_for_selector('[data-go="skip"]')
    await pg.click('[data-go="skip"]')
    await pg.wait_for_selector('.dday')

async def touch_line(cdp, box, pts):
    conv = [(box['x'] + box['width'] * x, box['y'] + box['height'] * y) for x, y in pts]
    await cdp.send('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': [{'x': conv[0][0], 'y': conv[0][1], 'id': 1}]})
    for x, y in conv[1:]:
        await cdp.send('Input.dispatchTouchEvent', {'type': 'touchMove', 'touchPoints': [{'x': x, 'y': y, 'id': 1}]})
    await cdp.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []})

async def run_width(browser, W):
    ctx = await browser.new_context(viewport={'width': W, 'height': 800}, device_scale_factor=3, is_mobile=True, has_touch=True, locale='ko-KR', timezone_id='Asia/Seoul')
    pg = await ctx.new_page()
    errors = []
    pg.on('pageerror', lambda e: errors.append('pageerror: ' + str(e)))
    pg.on('console', lambda m: errors.append(m.text) if m.type == 'error' and 'fonts.g' not in m.text and 'ERR_TUNNEL' not in m.text and 'ERR_CONNECTION' not in m.text else None)
    cdp = await ctx.new_cdp_session(pg)
    T = f'{W}px'

    # 1. 기관 4개 표시
    await pg.goto(BASE)
    await pg.wait_for_selector('.pick')
    names = await pg.eval_on_selector_all('.pick .t', 'els => els.map(e => e.textContent)')
    exp_names = [p['name'] for p in load('providers/index.json')['providers']]
    rec(f'{T} D01', '시험기관 4개 표시', names == exp_names and len(names) == 4, str(names))

    # 2. 대한검정회 급수 15개, 데이터 있는 14개 선택 가능
    await pg.goto(BASE + '#/onboard?p=daehan')
    await pg.wait_for_selector('.lv')
    enabled = await pg.eval_on_selector_all('[data-l]', 'els => els.map(e => e.dataset.l)')
    total = await pg.eval_on_selector_all('.lv', 'els => els.length')
    rec(f'{T} D02', '대한검정회 급수 선택 (8급~대사범 15개)', enabled == list(EXPECT) + ['dsa'] and total == 15, f'선택 가능 {len(enabled)} / 표시 {total}')
    await shot(pg, f'{W}-d02-levels')

    # 3. 데이터 검증 함수
    v = await pg.evaluate("async () => { const D = await import('./js/data.js'); return D.validateDaehanHanjaData({quiet:true}); }")
    bad = [r for r in v['levels'] if not r['ok']]
    rec(f'{T} D03', 'validateDaehanHanjaData() 전 급수 통과', v['ok'] and not bad, ' '.join(f"{r['급수']}{r['실제']}/{r['예상']}" for r in v['levels']))

    # 4. 급수별 한자 목록: 신출/누적 개수 (8급, 준5급, 3급, 1급, 사범)
    ok4, det4 = True, []
    order = list(EXPECT)
    for lid in ['8', '5-j', '3', '1', 'sa']:
        await choose(pg, 'daehan', lid)
        await pg.goto(BASE + '#/hanja?tab=all')
        await pg.wait_for_selector('.hcell')
        tabs = await pg.eval_on_selector_all('.tabs button', 'els => els.map(e => e.textContent)')
        i = order.index(lid)
        new_exp = EXPECT[lid] - (EXPECT[order[i - 1]] if i else 0)
        good = f'이번 급수 신출 {new_exp}' in tabs[0] and f'누적 전체 {EXPECT[lid]}' in tabs[1]
        cells = await pg.eval_on_selector_all('.hcell .e', 'els => els.slice(0, 50).map(e => e.textContent)')
        empty = [c for c in cells if not c.strip()]
        ok4 &= good and not empty
        det4.append(f"{lid}:{tabs[0].split()[-1]}/{tabs[1].split()[-1]}")
    await shot(pg, f'{W}-d04-hanja-sa')
    rec(f'{T} D04', '급수별 신출/누적 한자 수 = 공식 수, 훈음 표시', ok4, ', '.join(det4))

    # 5. 플래시카드 이전/다음, 뒤집기
    await choose(pg, 'daehan', '5')
    await pg.goto(BASE + '#/cards?set=new')
    await pg.wait_for_selector('.flash')
    c1 = await pg.inner_text('.face.front .z')
    await pg.click('[data-next]'); c2 = await pg.inner_text('.face.front .z')
    await pg.click('[data-prev]'); c3 = await pg.inner_text('.face.front .z')
    await pg.click('[data-flip]'); he = await pg.inner_text('.face.back .he')
    rec(f'{T} D05', '플래시카드 다음/이전/뒤집기(공식 훈음)', c1 != c2 and c1 == c3 and len(he.strip()) >= 2, f'{c1}→{c2}→{c3} · {he}')

    # 6. 검색 결과 형식
    await pg.goto(BASE + '#/search?q=' + '學')
    await pg.wait_for_selector('.srow')
    row = await pg.inner_text('.srow')
    rec(f'{T} D06', '검색 결과 "學 배울 학 / 대한검정회 ○급 신출 / ○급 이상 포함"', '學 배울 학' in row and '대한검정회' in row and '신출' in row and '이상 포함' in row, row.replace('\n', ' | '))
    await pg.fill('[data-q]', '배우다'); await pg.click('[data-go]'); await pg.wait_for_timeout(300)
    rows = await pg.eval_on_selector_all('.srow b', 'els => els.map(e => e.textContent)')
    rec(f'{T} D06b', '뜻(배우다) 검색', any('學' in r for r in rows), str(rows[:5]))
    await shot(pg, f'{W}-d06-search')

    # 7. 문제 풀이 → 오답노트 (날짜·내 답)
    await pg.goto(BASE + '#/quiz')
    await pg.wait_for_selector('[data-start]')
    lbl = await pg.inner_text('.sub')
    await pg.click('[data-start]')
    await pg.wait_for_selector('.qhost .choice')
    wrong_done = False
    for _ in range(10):
        ans = await pg.evaluate("() => { const b = document.querySelectorAll('.qhost .choice'); return b.length; }")
        if not ans:
            break
        # 의도적으로 첫 문항은 오답 선택: 정답 인덱스를 모르므로 첫 보기 선택
        await pg.click('.qhost .choice >> nth=0')
        await pg.wait_for_timeout(150)
        nxt = await pg.query_selector('[data-next]')
        if nxt:
            await nxt.click()
        await pg.wait_for_timeout(150)
        if await pg.query_selector('h1:has-text("채점 결과")'):
            break
    await pg.goto(BASE + '#/wrong')
    await pg.wait_for_selector('h1')
    wn = await pg.inner_text('#view')
    has_wrong = '저장된 오답이 없어요' not in wn
    rec(f'{T} D07', '문제풀이(기출유형 연습문제·예상문제) → 오답노트 날짜·내 답', '기출유형 연습문제' in lbl and (not has_wrong or ('틀린 날짜' in wn and '내 답' in wn and '오답만 다시 풀기' in wn)), f'오답 {"있음" if has_wrong else "없음(전부 정답)"}')

    # 8. 모의시험: 현장/온라인 형식
    await choose(pg, 'daehan', '3')
    await pg.goto(BASE + '#/mock')
    await pg.wait_for_selector('[data-start=full]')
    off = await pg.inner_text('[data-start=full]')
    await pg.click('[data-mode=online]'); await pg.wait_for_timeout(400)
    on = await pg.inner_text('[data-start=full]')
    lv3 = next(l for l in load('providers/daehan/levels.json')['levels'] if l['id'] == '3')
    ok8 = f"{lv3['exam']['questionCount']}문항 · {lv3['exam']['timeMin']}분" in off and f"{lv3['examOnline']['questionCount']}문항 · {lv3['examOnline']['timeMin']}분" in on
    await pg.click('[data-start=mini]')
    await pg.wait_for_selector('.timer')
    await pg.wait_for_selector('.qhost .choice')
    runst = await pg.evaluate("() => JSON.parse(localStorage.getItem('hanjaPass.mockRun'))")
    ok8 &= runst['examMode'] == 'online' and len(runst['questions']) >= 5
    rec(f'{T} D08', '모의시험 현장/온라인 형식 분리 (3급)', ok8, f'현장 [{off}] · 온라인 [{on}] · 미니 {len(runst["questions"])}문항 {runst["examMode"]}')
    await pg.click('[data-submit]'); await pg.click('[data-yes]')
    await pg.wait_for_selector('h1:has-text("모의시험 결과")')

    # 9. 공식 링크 · 자료 기준 문구
    await pg.goto(BASE + '#/home')
    await pg.wait_for_selector('.dh-foot')
    foot = await pg.inner_text('.dh-foot')
    hrefs = await pg.eval_on_selector_all('.dh-foot a', 'els => els.map(e => e.href)')
    need = ['https://www.hanja.ne.kr/', 'https://www.hanja.ne.kr/apply/info01.asp', 'https://www.hanja.ne.kr/jupsu/jupsu07.asp']
    rec(f'{T} D09', '공식 홈페이지/선정한자/시험안내/기출문제 링크 · 자료 기준', all(n in hrefs for n in need) and len(hrefs) == 4 and '자료 기준: 사단법인 대한민국한자교육연구회·대한검정회 공식 홈페이지' in foot and '최근 기출문제를 확인' in foot, str(len(hrefs)) + '개 링크')
    await shot(pg, f'{W}-d09-home')

    # 10. 손가락 필기 (스크롤 없이 잉크)
    await pg.goto(BASE + '#/write?c=' + '人')
    await pg.wait_for_selector('.pad canvas')
    await pg.eval_on_selector('.pad canvas', 'e => e.scrollIntoView({block:"center"})')
    await pg.wait_for_timeout(150)
    box = await pg.eval_on_selector('.pad canvas', 'e => { const r = e.getBoundingClientRect(); return {x:r.left, y:r.top, width:r.width, height:r.height}; }')
    y0 = await pg.evaluate('scrollY')
    await touch_line(cdp, box, [(0.5 + 0.02 * k, 0.2 + 0.06 * k) for k in range(10)])
    y1 = await pg.evaluate('scrollY')
    ink = await pg.eval_on_selector('.pad canvas', 'c => { const d = c.getContext("2d").getImageData(0,0,c.width,c.height).data; let n=0; for (let i=3;i<d.length;i+=4) if (d[i]>0) n++; return n; }')
    rec(f'{T} D10', '손가락 필기: 잉크 표시 · 화면 스크롤 없음', ink > 50 and y0 == y1, f'ink {ink}px, scroll {y0}→{y1}, pad {int(box["width"])}px')

    # 11. 가로 넘침 없음
    over = []
    for h in ['#/home', '#/hanja', '#/mock', '#/search?q=學', '#/sources', '#/schedule', '#/compare']:
        await pg.goto(BASE + h); await pg.wait_for_timeout(500)
        sw = await pg.evaluate('document.documentElement.scrollWidth')
        if sw > W + 1:
            over.append(f'{h}:{sw}')
    rec(f'{T} D11', f'{W}px 가로 넘침 없음', not over, ', '.join(over) or 'OK')

    # 11b. 대사범: 사범 5,000자 범위 + 서술형 안내(자동 채점 모의시험 미제공)
    await choose(pg, 'daehan', 'dsa')
    await pg.goto(BASE + '#/hanja'); await pg.wait_for_selector('.hcell')
    tabs = await pg.eval_on_selector_all('.tabs button', 'els => els.map(e => e.textContent)')
    note = await pg.inner_text('#view')
    await pg.goto(BASE + '#/mock'); await pg.wait_for_selector('h1')
    mk = await pg.inner_text('#view')
    await pg.goto(BASE + '#/quiz'); await pg.wait_for_selector('[data-start]')
    await pg.click('[data-start]'); await pg.wait_for_selector('.qhost .choice')
    rec(f'{T} D11b', '대사범: 누적 5,000자 학습·문제풀이, 모의시험은 서술형 안내', any('누적 전체 5000' in t for t in tabs) and '별도 선정한자 목록이 없어요' in note and '국역·논술' in mk and not await pg.query_selector('[data-start=full]'), ' | '.join(tabs[:2]))

    # 11c. 한국어문회 공식 쓰기 배정 (1급 2,005자, 5급Ⅱ 級/急), 특급Ⅱ 자형 4,650자
    r = await pg.evaluate("""async () => { const D = await import('./js/data.js');
      const w1 = await D.writeScope('eomunhoe', '1'); const w52 = await D.writeScope('eomunhoe', '5-2'); const s2 = await D.scopeChars('eomunhoe', 's2');
      const lv = await D.level('eomunhoe', 's2');
      return {w1: w1.length, w52: w52.length, has級: w52.includes('級'), has急: w52.includes('急'), s2: s2.length, glyph: lv.readCountGlyph, hee: s2.includes('熙'), heeOld: s2.includes('煕')}; }""")
    rec(f'{T} D11c', '한국어문회 공식 대조(1급 쓰기 2,005 · 5급Ⅱ 級 · 특급Ⅱ 4,650 · 熙)', r['w1'] == 2005 and r['w52'] == 225 and r['has級'] and not r['has急'] and r['s2'] == 4650 == r['glyph'] and r['hee'] and not r['heeOld'], str(r))

    # 12a. 한자교육진흥회: 공식 선정한자(준5급 신출 81 · 누적 151), 공식 훈음, 영역별 모의시험
    await choose(pg, 'jinheung', '5-j')
    await pg.goto(BASE + '#/hanja?tab=all'); await pg.wait_for_selector('.hcell')
    jt = await pg.eval_on_selector_all('.tabs button', 'els => els.map(e => e.textContent)')
    jsub = await pg.inner_text('.sub')
    await pg.goto(BASE + '#/quiz'); await pg.wait_for_selector('[data-start]')
    jq = await pg.inner_text('#view')
    await pg.goto(BASE + '#/mock'); await pg.wait_for_selector('[data-start=mini]')
    jm = await pg.inner_text('#view')
    await pg.click('[data-start=mini]'); await pg.wait_for_selector('.qhost .choice, .qhost .pad canvas')
    jrun = await pg.evaluate("() => JSON.parse(localStorage.getItem('hanjaPass.mockRun'))")
    await pg.click('[data-submit]'); await pg.click('[data-yes]'); await pg.wait_for_selector('h1:has-text("모의시험 결과")')
    jv = await pg.evaluate("async () => { const D = await import('./js/data.js'); return D.validateProviderData('jinheung', {quiet:true}); }")
    rec(f'{T} D12a', '한자교육진흥회 공식 데이터·문제·모의시험', any('이번 급수 신출 81' in t for t in jt) and any('누적 전체 151' in t for t in jt) and '선정한자 150자(평가한자 250자)' in jsub
        and '문제은행 구성' in jq and '선정한자·훈음' in jm and len(jrun['questions']) >= 15 and jv['ok'], f"{jt[:2]} · 미니 {len(jrun['questions'])}문항 · 검증 {jv['ok']}")

    # 12b. 대한상공회의소: 공식 배정한자(1급 누적 4,908), 배점 합산 채점
    await choose(pg, 'korcham', '1')
    await pg.goto(BASE + '#/hanja?tab=all'); await pg.wait_for_selector('.hcell')
    kt = await pg.eval_on_selector_all('.tabs button', 'els => els.map(e => e.textContent)')
    await pg.goto(BASE + '#/mock'); await pg.wait_for_selector('[data-start=mini]')
    await pg.click('[data-start=mini]'); await pg.wait_for_selector('.qhost .choice')
    for _ in range(6):
        await pg.click('.qhost .choice >> nth=0'); await pg.wait_for_timeout(80)
        nx = await pg.query_selector('[data-next]')
        if nx: await nx.click(); await pg.wait_for_timeout(80)
    await pg.click('[data-submit]'); await pg.click('[data-yes]'); await pg.wait_for_selector('h1:has-text("모의시험 결과")')
    kr = await pg.inner_text('#view')
    kv = await pg.evaluate("async () => { const D = await import('./js/data.js'); return D.validateProviderData('korcham', {quiet:true}); }")
    await pg.goto(BASE + '#/search?q=' + '跭'); await pg.wait_for_selector('.srow')
    ks = await pg.inner_text('.srow')
    rec(f'{T} D12b', '대한상공회의소 공식 배정한자·배점 채점·훈 없음 표시', any('이번 급수 신출 1607' in t for t in kt) and any('누적 전체 4908' in t for t in kt) and '배점 합산' in kr and '점' in kr and kv['ok'] and '뜻 자료 없음' in ks,
        f"{kt[:2]} · 검색 {ks.splitlines()[1] if len(ks.splitlines())>1 else ks}")

    # 12. 타 기관 회귀
    ok12, det12 = True, []
    for pid in ['eomunhoe', 'jinheung', 'korcham']:
        lv = [l for l in load(f'providers/{pid}/levels.json')['levels']]
        await pg.goto(BASE + '#/onboard?p=' + pid + '&r=' + str(W))
        await pg.wait_for_selector('.lv')
        sel = await pg.eval_on_selector_all('[data-l]', 'els => els.map(e => e.dataset.l)')
        exp_sel = [l['id'] for l in lv if l.get('hasData')]
        good = sel == exp_sel
        if exp_sel:
            await choose(pg, pid, exp_sel[0])
            await pg.goto(BASE + '#/hanja'); await pg.wait_for_selector('.hcell')
            n = await pg.eval_on_selector_all('.hcell', 'els => els.length')
            good &= n > 0
        ok12 &= good
        det12.append(f'{pid}:{len(sel)}/{len(lv)}급')
    await pg.goto(BASE + '#/schedule'); await pg.wait_for_timeout(600)
    sch = await pg.inner_text('#view')
    ok12 &= all(p['name'] in sch for p in load('providers/index.json')['providers'])
    rec(f'{T} D12', '타 기관(어문회·진흥회·상공회의소) 회귀 + 4기관 일정', ok12, ', '.join(det12))

    rec(f'{T} D13', 'console error 없음', not errors, '; '.join(errors[:5]) or '0건')
    await ctx.close()

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        for W in (360, 390, 412):
            await run_width(browser, W)
        await browser.close()
    n_ok = sum(r['ok'] for r in results)
    print(f'\n결과: {n_ok}/{len(results)} PASS')
    if OUT:
        json.dump(results, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    sys.exit(0 if n_ok == len(results) else 1)

asyncio.run(main())
