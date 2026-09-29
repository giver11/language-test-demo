#!/usr/bin/env python3
"""실제 배포 URL(GitHub Pages) + 실제 Cloudflare Workers AI 게이트웨이 검증 — GitHub Actions 에서 실행.
검사: 배포본=저장소 일치 · 모든 앱 경로 로드/404/JS 오류 · CORS(실제 origin) · 한자 앱 흐름 · V2 3개 앱
(한국어/영어/중국어 출력 · TTS 초기화 · 마이크 권한 거부 처리 · 뒤로가기 · 키보드 · 새로고침 유지) ·
RUN_AI=1 이면 실제 AI 대화 3턴 + 종합 피드백 + AI 코치 (TOPIK/IELTS/HSK).
모바일 우선: Pixel 7 (Android Chrome) 에뮬레이션. 결과는 GitHub Actions 주석(notice/error)과 JSON 으로 남긴다.
사용: RUN_AI=1 python3 tests/live_smoke.py [BASE]"""
import asyncio, json, os, re, sys, hashlib, datetime, urllib.request
from playwright.async_api import async_playwright

BASE = next((a for a in sys.argv[1:] if a.startswith('http')), 'https://giver11.github.io/language-test-demo/')
GW = 'https://scorestep-ai-gateway.suharin2.workers.dev'
ORIGIN = 'https://giver11.github.io'
RUN_AI = os.environ.get('RUN_AI') == '1'
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
res, groups = [], {}

def rec(group, tid, name, ok, detail=''):
    res.append((tid, name, bool(ok), str(detail)))
    groups.setdefault(group, []).append(f"{'PASS' if ok else 'FAIL'} {tid} {name}{' — ' + str(detail)[:160] if detail else ''}")
    print(('PASS' if ok else 'FAIL'), tid, name, '-', str(detail)[:300], flush=True)

def http(url, method='GET', headers=None, data=None):
    h = {'User-Agent': 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Mobile Safari/537.36 ScoreStep-live-check', 'Accept': 'application/json, */*'}
    h.update(headers or {})
    req = urllib.request.Request(url, method=method, headers=h, data=data)
    try:
        with urllib.request.urlopen(req, timeout=40) as r: return r.status, dict(r.headers), r.read()
    except urllib.error.HTTPError as e: return e.code, dict(e.headers), e.read()
    except Exception as e: return 0, {}, str(e).encode()

async def new_ctx(br, mobile=True):
    kw = dict(br._pw.devices['Pixel 7']) if mobile else {'viewport': {'width': 1280, 'height': 900}}
    ctx = await br.new_context(**kw, locale='ko-KR', timezone_id='Asia/Seoul')
    pg = await ctx.new_page()
    errs, bad = [], []
    pg.on('pageerror', lambda e: errs.append('pageerror: ' + str(e)[:200]))
    pg.on('console', lambda m: errs.append(m.text[:200]) if m.type == 'error' and 'Failed to load resource' not in m.text else None)
    pg.on('response', lambda r: bad.append(f'{r.status} {r.url}') if r.status >= 400 and r.url.startswith(BASE) and '/favicon' not in r.url else None)
    return ctx, pg, errs, bad

def has(s, script):
    return {'ko': re.search(r'[가-힣]', s), 'en': re.search(r'[A-Za-z]{3}', s), 'zh': re.search(r'[一-鿿]', s)}[script] is not None

async def main():
    # 1) 배포본 = 저장소 (GitHub Pages 반영 확인)
    st, _, body = http(BASE + 'hanja/version.json?t=' + str(datetime.datetime.now().timestamp()))
    local_v = json.load(open(os.path.join(ROOT, 'hanja', 'version.json')))['v']
    live_v = json.loads(body).get('v') if st == 200 else None
    rec('deploy', 'D1', '한자 앱 배포 버전 = 저장소', live_v == local_v, f'live {live_v} / repo {local_v}')
    mism = []
    for f in ['v2/learn-engine.js', 'v2/tts.js', 'v2/shell.js', 'v2/content-bank.js', 'hanja/js/store.js', 'hanja/js/learn.js']:
        s2, _, b2 = http(BASE + f + '?t=' + str(datetime.datetime.now().timestamp()))
        loc = open(os.path.join(ROOT, f), 'rb').read()
        if s2 != 200 or hashlib.sha1(b2).hexdigest() != hashlib.sha1(loc).hexdigest(): mism.append(f'{f}:{s2}')
    rec('deploy', 'D2', '배포 파일 내용 = 저장소 (v2 엔진·TTS·한자 저장소)', not mism, ', '.join(mism) or '6개 파일 일치')

    # 2) CORS · 게이트웨이 상태 (실제 origin 기준)
    s, h, _ = http(GW, 'OPTIONS', {'Origin': ORIGIN, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type'})
    acao = {k.lower(): v for k, v in h.items()}.get('access-control-allow-origin')
    rec('api', 'C1', f'CORS preflight (Origin {ORIGIN})', s == 204 and acao == ORIGIN, f'{s} ACAO={acao}')
    s, h, b = http(GW, 'OPTIONS', {'Origin': 'https://evil.example', 'Access-Control-Request-Method': 'POST'})
    acao2 = {k.lower(): v for k, v in h.items()}.get('access-control-allow-origin')
    rec('api', 'C2', '다른 origin 은 허용되지 않음', s == 204 and acao2 != 'https://evil.example', f'ACAO={acao2}')
    s, _, b = http(GW)
    try: j = json.loads(b or b'{}')
    except Exception: j = {}
    rec('api', 'C3', 'AI 게이트웨이 상태 (Workers AI 바인딩)', s == 200 and j.get('ok') and j.get('provider') == 'cloudflare-workers-ai', f"{s} {j.get('provider')} {j.get('model')}")
    s, _, b = http(GW, 'POST', {'Origin': ORIGIN, 'Content-Type': 'application/json'}, b'{"language":"xx"}')
    rec('api', 'C4', '잘못된 요청 → 400 JSON 오류', s == 400 and b'invalid_request' in b, f'{s}')

    async with async_playwright() as p:
        br = await p.chromium.launch(); br._pw = p

        # 3) 모든 앱 경로: 로드 · 404 · JS 오류 (모바일)
        for path in ['', 'hanja/', 'v2/', 'v2/topik/', 'v2/ielts/', 'v2/hsk/', 'v2/worldcook/', 'v2/cookora-in/', 'v2/cookora-out/', 'blade-round/', 'topik/', 'ielts/', 'hsk/']:
            ctx, pg, errs, bad = await new_ctx(br)
            try:
                r = await pg.goto(BASE + path, wait_until='networkidle', timeout=45000)
                await pg.wait_for_timeout(1200)
                over = await pg.evaluate('document.documentElement.scrollWidth > innerWidth + 1')
                rec('paths', 'P:' + (path or '/'), f'/{path} 로드 · 404 없음 · JS 오류 없음 · 가로 넘침 없음', r and r.status == 200 and not bad and not errs and not over, '; '.join(bad[:2] + errs[:2]) + (' 가로넘침' if over else ''))
            except Exception as ex:
                rec('paths', 'P:' + (path or '/'), f'/{path} 로드', False, repr(ex)[:160])
            await ctx.close()

        # 4) 한자 앱 흐름 (실제 URL)
        ctx, pg, errs, bad = await new_ctx(br)
        H = BASE + 'hanja/'
        await pg.goto(H + '#/onboard?p=eomunhoe'); await pg.wait_for_selector('.lv', timeout=30000)
        await pg.click('[data-l="6"]'); await pg.wait_for_selector('.opt'); await pg.click('.opt >> nth=0'); await pg.click('[data-m="20"]'); await pg.click('[data-go="skip"]')
        await pg.wait_for_selector('.today-card', timeout=30000)
        card = await pg.inner_text('.today-card')
        rec('hanja', 'H1', '기관·급수 선택 → 오늘의 한자 학습 카드 (한국어 출력)', '10분 학습' in card and has(card, 'ko'), card.replace('\n', ' ')[:80])
        await pg.tap('.today-card a.btn'); await pg.wait_for_selector('.newcard')
        ch = (await pg.inner_text('.newcard .hanzi')).strip()
        await pg.tap('[data-s="know"]'); await pg.wait_for_timeout(500)
        await pg.goto(H + '#/weak'); await pg.wait_for_selector('h1'); await pg.go_back(); await pg.wait_for_timeout(800)
        back_ok = '#/today' in pg.url
        rec('hanja', 'H2', 'Android 뒤로가기(history.back) → 이전 화면', back_ok, pg.url.split('#')[-1])
        await pg.reload(); await pg.wait_for_timeout(1500)
        stt = await pg.evaluate("JSON.parse(localStorage.getItem('hanjaPass.v1'))")
        rec('hanja', 'H3', '새로고침 후 학습 기록 유지 (localStorage v3)', stt['version'] == 3 and ch in stt['byProvider']['eomunhoe']['mastery'], f'{ch} 기록 유지')
        for h in ['#/games?g=speed3', '#/mastery', '#/weekly', '#/write?c=人', '#/idioms?mode=i2m', '#/mock', '#/camera']:
            await pg.goto(H + h); await pg.wait_for_timeout(1300)
        sw = await pg.evaluate("navigator.serviceWorker && navigator.serviceWorker.getRegistration().then(r => !!r)")
        rec('hanja', 'H4', '주요 화면(3초 한자·Mastery·주간·쓰기·사자성어·모의·카메라) JS 오류 없음 · 오프라인 SW 등록', not errs and not bad and sw, '; '.join(errs[:3] + bad[:2]))
        await ctx.close()

        # 5) V2 3개 앱
        INJECT = "navigator.mediaDevices && (navigator.mediaDevices.getUserMedia = () => Promise.reject(Object.assign(new Error('denied'), {name: 'NotAllowedError'})));"
        MSGS = {'topik': ['주말에 친구를 만났어요.', '같이 영화를 봤어요. 그래서 기분이 좋았어요.', '다음 주에는 부산에 가고 싶어요.'],
                'ielts': ['I am a student and I study engineering in Seoul.', 'I enjoy it because the projects are practical, for example building robots.', 'I think travelling helps people understand other cultures.'],
                'hsk': ['我喜欢看书。', '因为看书很有意思。', '我每天晚上看一个小时。']}
        SCRIPT = {'topik': 'ko', 'ielts': 'en', 'hsk': 'zh'}
        for app in ['topik', 'ielts', 'hsk']:
            ctx, pg, errs, bad = await new_ctx(br)
            await pg.add_init_script(INJECT)
            ai_status = []
            pg.on('response', lambda r: ai_status.append(r.status) if r.url.startswith(GW) and r.request.method == 'POST' else None)
            await pg.goto(BASE + f'v2/{app}/', wait_until='networkidle'); await pg.fill('#code', 'STEP10'); await pg.click('#gateForm button')
            try: await pg.wait_for_selector('#profile:not(.hide)', timeout=3000); await pg.fill('#goal', {'topik': 'TOPIK II 4급', 'ielts': 'IELTS 6.5', 'hsk': 'HSK 4급'}[app]); await pg.click('#profileForm button')
            except Exception: pass
            await pg.wait_for_selector('#engineHome .mission', timeout=30000)
            home = await pg.inner_text('#engineHome')
            ui_lang = 'en' if app == 'ielts' else 'ko'
            rec(app, f'{app}-1', f'{app.upper()} 진입 · 미션/준비도/약점 지도 · UI 언어({ui_lang})', has(home, ui_lang) and ('미션' in home or 'mission' in home), home.split('\n')[1][:60])
            tts = await pg.evaluate("({ok: !!window.TTS, sup: window.TTS && TTS.supported, lang: CONFIG.lang})")
            await pg.click('.nav[data-page="words"]'); await pg.click('#playWord'); await pg.wait_for_timeout(1500)
            word = await pg.inner_text('#word')
            await pg.click('#know')
            rec(app, f'{app}-TTS', 'TTS 초기화 · 단어 재생 버튼 (오류/디버그 텍스트 없음) · 학습 콘텐츠 언어', tts['ok'] and tts['sup'] and not errs and has(word, 'zh' if app == 'hsk' else SCRIPT[app]) and 'report' not in (await pg.inner_text('#wordVoiceInfo')), f"{tts} 단어={word.strip()[:20]} {errs[:2]}")
            await pg.click('.nav[data-page="test"]'); await pg.wait_for_timeout(300); await pg.go_back(); await pg.wait_for_timeout(500)
            active = await pg.evaluate("document.querySelector('.nav.active').dataset.page")
            rec(app, f'{app}-BACK', 'Android 뒤로가기 → 이전 화면(단어)', active == 'words', active)
            await pg.click('.nav[data-page="speaking"]'); await pg.click('#record'); await pg.wait_for_timeout(1200)
            fb = await pg.inner_text('#speechFeedback')
            rec(app, f'{app}-MIC', '마이크 권한 거부 → 안내 문구 (오류 화면 없음)', ('마이크' in fb or 'icrophone' in fb) and not errs, fb[:70])
            await pg.click('.nav[data-page="conversation"]'); await pg.wait_for_selector('#convFinish')
            await pg.focus('#conversationInput'); await pg.set_viewport_size({'width': 412, 'height': 360}); await pg.wait_for_timeout(500)
            vis = await pg.evaluate("(() => { const r = document.querySelector('#conversationInput').getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; })()")
            await pg.set_viewport_size({'width': 412, 'height': 915})
            rec(app, f'{app}-KB', '키보드가 올라왔을 때(화면 높이 축소) 입력창이 보임', vis, '')
            if RUN_AI:
                replies = []
                for m in MSGS[app]:
                    n0 = await pg.locator('#conversationLog .review-item').count()
                    await pg.fill('#conversationInput', m); await pg.click('#conversationSend')
                    try:
                        await pg.wait_for_function(f"document.querySelectorAll('#conversationLog .review-item').length >= {n0 + 2} || /다시 시도|unavailable|无法|소진|used up|用完/.test(document.querySelector('#conversationStatus').textContent)", timeout=60000)
                    except Exception: pass
                    items = await pg.locator('#conversationLog .review-item').all_inner_texts()
                    replies.append(items[-1] if len(items) >= n0 + 2 else '(응답 없음) ' + await pg.inner_text('#conversationStatus'))
                    await pg.wait_for_timeout(600)
                ok_lang = all(r.startswith('AI') and has(r, SCRIPT[app]) and '```' not in r and '**' not in r for r in replies)
                rec(app, f'{app}-AI3', f'실제 Workers AI 대화 3턴 ({SCRIPT[app]} 응답 · HTTP {ai_status})', len(replies) == 3 and ok_lang and all(s == 200 for s in ai_status) and len(ai_status) >= 3, ' | '.join(r.replace('\n', ' ')[3:70] for r in replies))
                fin_enabled = not await pg.is_disabled('#convFinish')
                if fin_enabled:
                    await pg.click('#convFinish'); await pg.wait_for_selector('#convSummary')
                    await pg.click('#convAiSum')
                    await pg.wait_for_function("!document.querySelector('#convAiSum').disabled && !/검토하고|reviewing/.test(document.querySelector('#convAiOut').textContent)", timeout=60000)
                    summ = await pg.inner_text('#convSummary'); aiout = await pg.inner_text('#convAiOut')
                    need = ['잘한 점', '교정할 점', '어휘', '문법', '발음', '추천 복습'] if app != 'ielts' else ['What went well', 'To improve', 'Vocabulary', 'Grammar', 'Pronunciation', 'Recommended review', 'not an official IELTS']
                    rec(app, f'{app}-SUM', '대화 종료 → 종합 피드백 + 실제 AI 총평', all(x in summ for x in need) and 'AI' in aiout and not re.search('연결하지 못|Could not reach|시간 초과|timeout', aiout), aiout.replace('\n', ' ')[:120])
                else:
                    rec(app, f'{app}-SUM', '대화 종료 → 종합 피드백', False, '3턴 미완료로 버튼 비활성')
                # AI 코치 (실제 게이트웨이)
                await pg.click('.nav[data-page="test"]')
                got = False
                for i in range(15):
                    await pg.wait_for_selector('#options .option:not([disabled])')
                    n = await pg.locator('#options .option').count()
                    await pg.locator('#options .option').nth(i % n).click(); await pg.wait_for_timeout(150)
                    if await pg.query_selector('#aiCoachBtn'): got = True; break
                    await pg.click('#nextQ')
                if got:
                    await pg.click('#aiCoachBtn')
                    await pg.wait_for_function("!document.querySelector('#aiCoachBtn').disabled && !/준비하고|preparing/.test(document.querySelector('#aiCoachOut').textContent)", timeout=60000)
                    co = await pg.inner_text('#aiCoachOut')
                    rec(app, f'{app}-COACH', '오답 → 실제 AI 코치 설명 (timeout/retry/fallback 포함)', 'AI' in co and not re.search('연결하지 못|Could not reach|시간 초과|timeout', co), co.replace('\n', ' ')[:120])
                else:
                    rec(app, f'{app}-COACH', '오답 → AI 코치', False, '오답을 만들지 못함')
            before = await pg.evaluate(f"localStorage.getItem('v2:{app}:state')"); await pg.wait_for_timeout(400)
            await pg.reload(); await pg.wait_for_selector('#engineHome', state='attached', timeout=30000); await pg.wait_for_timeout(800)
            eng = await pg.evaluate(f"JSON.parse(localStorage.getItem('v2:{app}:engine') || 'null')")
            rec(app, f'{app}-KEEP', '새로고침 후 기록 유지 · console error 없음', eng and len(eng['items']) >= 1 and json.loads(before)['xp'] == json.loads(await pg.evaluate(f"localStorage.getItem('v2:{app}:state')"))['xp'] and not errs, '; '.join(errs[:3]))
            await ctx.close()
        await br.close()

    fails = [r for r in res if not r[2]]
    for g, lines in groups.items():   # GitHub Actions 주석 (그룹당 1개 → API 로도 읽을 수 있음)
        kind = 'error' if any(l.startswith('FAIL') for l in lines) else 'notice'
        print(f"::{kind} title=live {g}::" + '%0A'.join(l.replace('%', '%25').replace('\n', ' ') for l in lines))
    print(f"\nSUMMARY {len(res) - len(fails)} / {len(res)} PASS (RUN_AI={int(RUN_AI)})")
    json.dump({'base': BASE, 'at': datetime.datetime.now().isoformat(), 'ai': RUN_AI, 'results': [dict(id=a, name=b, ok=c, detail=d) for a, b, c, d in res]}, open(os.path.join(ROOT, 'tests', 'last-live-result.json'), 'w'), ensure_ascii=False, indent=1)
    sys.exit(1 if fails else 0)

asyncio.run(main())
