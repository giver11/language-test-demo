#!/usr/bin/env python3
"""학습 기록 이중 반영 회귀 테스트 (실제 브라우저 UI 조작)
A 일반 한자 직접 쓰기 1회 → writing 기록 정확히 1, mastery n=1, w=1
B 한자어 직접 쓰기 1회 → 글자별 writing 1, mastery n=1 (이중 반영 없음)
C 사자성어 직접 쓰기 1회 → 네 글자 각각 writing 1, mastery n=1, 오답노트 relatedHanja 네 글자 유지
D 객관식 문제는 기존처럼 mastery 1회 반영
E 결과 화면 '다시 풀기' → 같은 문제 세트가 같은 순서로 새로고침 없이 다시 시작
F 모의시험 쓰기 문항 채점 → writing 1, mastery n=1
+ console error 없음
사용: python3 tests/record_integrity.py [BASE_URL]"""
import asyncio, json, os, sys
from playwright.async_api import async_playwright

BASE = next((a for a in sys.argv[1:] if a.startswith('http')), 'http://localhost:8765/hanja/')
DATA = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data')
res = []
def rec(t, name, ok, d=''):
    res.append((t, ok)); print(('PASS' if ok else 'FAIL'), t, name, '-', d, flush=True)

def state(pid, lid):
    return {"version": 2, "current": {"provider": pid}, "minutes": 20, "byProvider": {pid: {"level": lid, "examDate": "2026-11-28", "examRound": "t"}},
            "favorites": {"hanja": [], "words": [], "idioms": []}, "xp": 0, "days": [], "quest": None, "badges": {}, "log": []}

def medians(ch):
    d = json.load(open(os.path.join(DATA, 'strokes/%04X.json' % ord(ch)), encoding='utf-8'))
    return [[(x / 1024, (900 - y) / 1024) for x, y in s] for s in d['m']]

async def draw(pg, ch, sel='.pad canvas'):
    await pg.eval_on_selector(sel, 'e => e.scrollIntoView({block: "center"})'); await pg.wait_for_timeout(150)
    b = await pg.eval_on_selector(sel, 'e => { const r = e.getBoundingClientRect(); return {x:r.left, y:r.top, w:r.width, h:r.height}; }')
    for s in medians(ch):
        pts = [(b['x'] + b['w'] * (0.05 + x * 0.9), b['y'] + b['h'] * (0.05 + y * 0.9)) for x, y in s]
        await pg.mouse.move(*pts[0]); await pg.mouse.down()
        for i in range(1, len(pts)):
            x0, y0 = pts[i - 1]; x1, y1 = pts[i]
            for k in range(1, 4): await pg.mouse.move(x0 + (x1 - x0) * k / 3, y0 + (y1 - y0) * k / 3)
        await pg.mouse.up(); await pg.wait_for_timeout(40)

async def page(br, st):
    ctx = await br.new_context(viewport={'width': 390, 'height': 844}, is_mobile=False, service_workers='block')
    pg = await ctx.new_page(); errs = []
    pg.on('console', lambda m: m.type == 'error' and 'ERR_TUNNEL' not in m.text and errs.append(m.text[:200]))
    pg.on('pageerror', lambda e: errs.append('pageerror ' + str(e)[:200]))
    await pg.add_init_script('if(!sessionStorage.getItem("seed")){localStorage.setItem("hanjaPass.v1", %s);sessionStorage.setItem("seed","1")}' % json.dumps(json.dumps(st)))
    return ctx, pg, errs

async def prov(pg, pid):
    return await pg.evaluate('pid => JSON.parse(localStorage.getItem("hanjaPass.v1")).byProvider[pid]', pid)

async def main():
    allerr = []
    async with async_playwright() as p:
        br = await p.chromium.launch()

        # A · D · E : 문제 풀이 (한국어문회 6급)
        ctx, pg, errs = await page(br, state('eomunhoe', '6'))
        await pg.goto(BASE + '#/quiz'); await pg.wait_for_selector('[data-start]')
        await pg.click('[data-t="한자쓰기"]'); await pg.click('[data-n="10"]'); await pg.click('[data-start]')
        await pg.wait_for_selector('.qhost .pad canvas')
        q = await pg.evaluate('async () => { const t = document.querySelector(".q-text").textContent; return t; }')
        ans = await pg.evaluate('''async () => { const D = await import('./js/data.js'); const b = await D.bank('eomunhoe','6'); const t = document.querySelector('.q-text').textContent; return b.questions.find(x => x.question === t && x.type === 'write').answer; }''')
        await draw(pg, ans)
        await pg.click('.qhost [data-act=submit]'); await pg.wait_for_selector('.q-explain .explain')
        await pg.wait_for_timeout(300)
        P = await prov(pg, 'eomunhoe')
        w = P['writing'].get(ans, {}); m = P['mastery'].get(ans, {})
        wn = w.get('ok', 0) + w.get('near', 0) + w.get('fail', 0)
        rec('A', '일반 한자 직접 쓰기 1회 → writing 1 · mastery 1회', wn == 1 and m.get('n') == 1 and m.get('w') == 1 and P['quiz']['answered'] == 1,
            f'{ans}: writing {wn} ({w.get("last")}), mastery n={m.get("n")} w={m.get("w")} wok={m.get("wok")}, answered={P["quiz"]["answered"]}')
        # 나머지 문제는 건너뛰기(빈 칸 제출 불가 → 그대로 다음) 대신 세션 목록을 기록한 뒤 끝까지 진행
        order1 = []
        order1.append(await pg.inner_text('.q-text'))
        for i in range(9):
            await pg.click('[data-next]'); await pg.wait_for_selector('.qhost .pad canvas')
            order1.append(await pg.inner_text('.q-text'))
            a2 = await pg.evaluate('''async () => { const D = await import('./js/data.js'); const b = await D.bank('eomunhoe','6'); const t = document.querySelector('.q-text').textContent; return b.questions.find(x => x.question === t && x.type === 'write').answer; }''')
            await draw(pg, a2); await pg.click('.qhost [data-act=submit]'); await pg.wait_for_selector('[data-next]:visible')
        await pg.click('[data-next]'); await pg.wait_for_selector('[data-again]')
        await pg.evaluate('window.__marker = 42')
        await pg.click('[data-again]'); await pg.wait_for_selector('.qhost .pad canvas')
        order2 = [await pg.inner_text('.q-text')]
        for i in range(9):
            # 다음 문제로 가려면 답을 제출해야 하므로 정답을 써서 진행
            a2 = await pg.evaluate('''async () => { const D = await import('./js/data.js'); const b = await D.bank('eomunhoe','6'); const t = document.querySelector('.q-text').textContent; return b.questions.find(x => x.question === t && x.type === 'write').answer; }''')
            await draw(pg, a2); await pg.click('.qhost [data-act=submit]'); await pg.wait_for_selector('[data-next]:visible')
            await pg.click('[data-next]'); await pg.wait_for_selector('.qhost .pad canvas')
            order2.append(await pg.inner_text('.q-text'))
        marker = await pg.evaluate('window.__marker')
        head = await pg.inner_text('.q-head')
        rec('E', "'다시 풀기' → 같은 10문제·같은 순서, 새로고침 없음", order1 == order2 and marker == 42 and '1/10' not in head and '10/10' in head,
            f'일치 {sum(a == b for a, b in zip(order1, order2))}/10, 새로고침 없음={marker == 42}')
        # D 객관식
        await pg.goto(BASE + '#/quiz?r=1'); await pg.wait_for_selector('[data-start]')
        await pg.click('[data-t="독음"]') if await pg.query_selector('[data-t="독음"]') else await pg.click('[data-t="훈→한자"]')
        await pg.click('[data-start]'); await pg.wait_for_selector('.qhost .choice')
        before = await prov(pg, 'eomunhoe')
        rel = await pg.evaluate('''async () => { const D = await import('./js/data.js'); const t = document.querySelector('.q-text').textContent; const p = (document.querySelector('.q-prompt')||{}).textContent || ''; const b = await D.bank('eomunhoe','6'); const q = b.questions.find(x => x.question === t && (x.prompt||'') === p); return q ? q.relatedHanja : null; }''')
        await (await pg.query_selector_all('.qhost .choice'))[0].click(); await pg.wait_for_timeout(300)
        after = await prov(pg, 'eomunhoe')
        if rel:
            dn = [((after['mastery'].get(ch) or {}).get('n', 0)) - ((before['mastery'].get(ch) or {}).get('n', 0)) for ch in rel]
            okD = all(x == 1 for x in dn)
        else:
            # 즉석 생성 문항(훈→한자): 대상 한자 1자만 1회
            diff = {k: v['n'] - (before['mastery'].get(k) or {}).get('n', 0) for k, v in after['mastery'].items() if v['n'] != (before['mastery'].get(k) or {}).get('n', 0)}
            dn = list(diff.values()); okD = dn == [1]
        rec('D', '객관식 문제 mastery 1회 반영(기존 동작 유지)', okD and after['quiz']['answered'] == before['quiz']['answered'] + 1, f'증가량 {dn}')
        allerr += errs; await ctx.close()

        # B 한자어 직접 쓰기 (대한검정회 5급)
        ctx, pg, errs = await page(br, state('daehan', '5'))
        await pg.goto(BASE + '#/words?mode=write'); await pg.wait_for_selector('.mw .slot')
        word = await pg.evaluate('''async () => { const D = await import('./js/data.js'); const ws = await D.words(); const r = document.querySelector('.card.flat div[style]').textContent.trim(); return [...ws.values()].filter(x => x.r === r).map(x => x.w); }''')
        n = len(await pg.query_selector_all('.mw .slot'))
        chars_written = []
        # 각 칸을 실제로 써서 제출 (첫 후보 단어 기준)
        target = [w for w in word if len(w) == n][0]
        for i, ch in enumerate(target):
            await draw(pg, ch)
            btn = await pg.query_selector('.mw [data-a=next]')
            if await btn.is_visible(): await btn.click()
            await pg.wait_for_timeout(1000)
        if await pg.is_visible('.mw [data-a=next]'): await pg.click('.mw [data-a=next]')
        await pg.wait_for_selector('.mw [data-after]:visible', timeout=8000); await pg.wait_for_timeout(300)
        P = await prov(pg, 'daehan')
        det = []
        okB = True
        for ch in target:
            w = P['writing'].get(ch, {}); m = P['mastery'].get(ch, {})
            wn = w.get('ok', 0) + w.get('near', 0) + w.get('fail', 0)
            det.append(f'{ch}:w{wn}/n{m.get("n")}')
            okB &= wn == 1 and m.get('n') == 1
        rec('B', '한자어 직접 쓰기 1회 → 글자별 writing 1 · mastery 1회', okB and P['words'][target]['ok'] + P['words'][target]['fail'] == 1, f'{target} ' + ' '.join(det))

        # C 사자성어 직접 쓰기
        await pg.goto(BASE + '#/idioms?mode=write'); await pg.wait_for_selector('.mw .slot')
        mean = await pg.inner_text('.card.flat div[style]')
        it = await pg.evaluate('''async (mean) => { const D = await import('./js/data.js'); const m = await D.idioms(); return [...m.values()].find(x => x.mean === mean.trim()); }''', mean)
        # 앞 두 글자만 쓰고 나머지는 빈 칸으로 제출 → 오답(pass=false) 경로까지 확인
        for i, ch in enumerate(it['w']):
            if i < 2: await draw(pg, ch)
            await pg.click('.mw [data-a=next]'); await pg.wait_for_timeout(250)
        await pg.wait_for_selector('.mw [data-after]:visible', timeout=8000); await pg.wait_for_timeout(300)
        P = await prov(pg, 'daehan')
        det = []; okC = True
        for ch in it['w']:
            w = P['writing'].get(ch, {}); m = P['mastery'].get(ch, {})
            wn = w.get('ok', 0) + w.get('near', 0) + w.get('fail', 0)
            prior = 1 if ch in target else 0  # B에서 이미 쓴 글자면 1회 더해짐
            det.append(f'{ch}:w{wn}/n{m.get("n")}')
            okC &= wn == 1 + prior and m.get('n') == 1 + prior
        wr = P['wrong'].get('idiom-write-' + it['id'])
        okC &= bool(wr) and wr['q']['relatedHanja'] == list(it['w'])
        rec('C', '사자성어 직접 쓰기 1회 → 네 글자 writing 1 · mastery 1회, 오답노트 관련 한자 4자', okC, f'{it["w"]} ' + ' '.join(det) + f' · 오답노트 {wr["q"]["relatedHanja"] if wr else None}')
        allerr += errs; await ctx.close()

        # F 모의시험 쓰기 문항 (한국어문회 6급 미니)
        ctx, pg, errs = await page(br, state('eomunhoe', '6'))
        await pg.goto(BASE + '#/home'); await pg.wait_for_selector('.dday')
        ok = await pg.evaluate('''async () => {
          const S = window.__hanja.S;
          // mock.js 채점 경로와 같은 호출 순서를 직접 검증 (쓰기 문항 1개)
          const q = { id: 'mock-w-test', type: 'write', typeLabel: '한자쓰기', question: 't', prompt: '', choices: [], answer: '家', relatedHanja: ['家'], sourceType: 'original' };
          S.recordWriting('eomunhoe', '家', 'good');
          S.recordAnswer('eomunhoe', q, true, { writingRecorded: true });
          const p = S.prov('eomunhoe'); return [p.writing['家'].ok, p.mastery['家'].n];
        }''')
        src = open(os.path.join(os.path.dirname(DATA), 'js/views/mock.js'), encoding='utf-8').read()
        rec('F', '모의시험 쓰기 채점 경로도 writingRecorded 전달', ok == [1, 1] and 'writingRecorded: !!wrote' in src, f'writing {ok[0]}, mastery n {ok[1]}')
        allerr += errs; await ctx.close()
        await br.close()
    rec('G', 'console error 없음', not allerr, '; '.join(allerr[:3]))
    fails = [r for r in res if not r[1]]
    print(f'\n{len(res) - len(fails)}/{len(res)} PASS')
    sys.exit(1 if fails else 0)

asyncio.run(main())
