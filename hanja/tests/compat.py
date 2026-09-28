# 호환성 회귀 테스트: PointerEvent·ResizeObserver 없는 구형 브라우저 모사 + 일반 모드에서
# 데이터 없는 급수 선택 차단, 플래시카드 한자 표시, 터치 필기(스크롤 없음), 검색, 진단 화면을 확인
import asyncio, json, sys, os
src=open(os.path.join(os.path.dirname(os.path.abspath(__file__)),'e2e.py')).read().split('async def main():')[0]
src=src.replace("HERE = os.path.dirname(os.path.abspath(__file__))","HERE=os.path.dirname(os.path.abspath(__file__))")
exec(src)
from playwright.async_api import async_playwright
OLD = """
delete window.PointerEvent; delete window.ResizeObserver;
"""
async def run():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        for label, init in [('구형 브라우저 모사(PointerEvent·ResizeObserver 없음)', OLD), ('일반', '')]:
            ctx = await b.new_context(**p.devices['Galaxy S9+'], locale='ko-KR')
            if init: await ctx.add_init_script(init)
            pg = await ctx.new_page(); errs=[]
            pg.on('pageerror', lambda e: errs.append(str(e)))
            cdp = await ctx.new_cdp_session(pg)
            await pg.goto(BASE); await pg.wait_for_selector('.pick')
            # 데이터 없는 급수(비활성) 탭 동작: 비활성 급수가 남아 있는 기관에서 확인
            dis = en = 0; still = '-'
            for pid in ('jinheung', 'korcham', 'daehan', 'eomunhoe'):
                await pg.goto(BASE + '#/onboard?p=' + pid + '&r=' + label[:2]); await pg.wait_for_selector('.lv')
                dis = await pg.eval_on_selector_all('.lv[disabled]', 'e=>e.length'); en = await pg.eval_on_selector_all('.lv:not([disabled])', 'e=>e.length')
                if dis:
                    await pg.tap('.lv[disabled] >> nth=0', force=True); await pg.wait_for_timeout(200)
                    still = await pg.inner_text('h1')
                    break
            await pg.goto(BASE + '#/onboard?p=daehan&r=x' + label[:2]); await pg.wait_for_selector('[data-l="8"]')
            await pg.tap('[data-l="8"]'); await pg.tap('[data-skip]'); await pg.tap('[data-go]'); await pg.wait_for_selector('.dday')
            await pg.goto(BASE+'#/cards?set=new'); await pg.wait_for_selector('.flash')
            fh = await pg.eval_on_selector('.flash .front', 'e=>{const r=e.getBoundingClientRect();return [Math.round(r.width),Math.round(r.height)]}')
            ch = await pg.inner_text('.flash .front .z')
            await pg.goto(BASE+'#/write'); await pg.wait_for_selector('.pad canvas'); await pg.wait_for_timeout(400)
            box = await pad_box(pg)
            y0 = await pg.evaluate('scrollY')
            cur = (await pg.inner_text('[data-show]')).strip()
            await pg.tap('[data-lv="3"]'); await pg.wait_for_timeout(300)
            cur = (await pg.inner_text('[data-he]'))
            # 현재 목표 글자 알아내기
            tgt = await pg.evaluate("()=>document.querySelector('[data-count]').textContent")
            await pg.fill('[data-freein]', '人'); await pg.tap('[data-free] button[type=submit]'); await pg.wait_for_timeout(400)
            box = await pad_box(pg); y0 = await pg.evaluate('scrollY')
            await touch_draw(pg, cdp, box, medians('人')); await pg.wait_for_timeout(1200)
            y1 = await pg.evaluate('scrollY'); fb = await pg.inner_text('[data-fb]')
            await pg.goto(BASE+'#/search'); await pg.wait_for_selector('[data-q]')
            await pg.fill('[data-q]', '배우다'); await pg.tap('[data-go]'); await pg.wait_for_timeout(500)
            r1 = await pg.inner_text('[data-res]')
            await pg.tap('[data-ex="일석이조"]'); await pg.wait_for_timeout(400); r2 = await pg.inner_text('[data-res]')
            await pg.goto(BASE+'#/diag'); await pg.wait_for_timeout(2500); dg = await pg.inner_text('.diag')
            print(f'[{label}] 비활성 급수 {dis}/활성 {en}, 비활성 탭 후 화면="{still}", 카드 크기 {fh} 글자={ch}, 쓰기 캔버스 {int(box["width"])}x{int(box["height"])}, 스크롤 {y0}->{y1}, 판정="{fl(fb)}", 검색(배우다) 學 포함={"學" in r1}, 검색(일석이조)={"一石二鳥" in r2}, 진단 실패항목={dg.count("✗")}, 오류={errs}')
            await ctx.close()
        await b.close()
asyncio.run(run())
