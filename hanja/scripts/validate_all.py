#!/usr/bin/env python3
"""4개 기관 데이터 검증 (빌드 산출물 기준). 실패 시 종료코드 1.
- 급수별 누적 수 = 공식 파일 수(진흥회 officialFileCount, 어문회 readCountGlyph, 그 외 readCount)
- 중복 / 사전 누락 / 훈·음 빈 값(공식 자료 없음으로 표시된 글자는 경고) / 급수 범위 밖 항목
- 문제의 정답·보기 한자가 해당 급수 범위 안인지, 모든 문제가 original 인지"""
import json, os, sys
D = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data")
def load(p): return json.load(open(os.path.join(D, p), encoding="utf-8"))
dic = load("dictionary/hanja.json")["chars"]
HE = {"daehan": "dh", "jinheung": "jh"}
fail = []
for pid in ("eomunhoe", "daehan", "jinheung", "korcham"):
    lv = load(f"providers/{pid}/levels.json")["levels"]
    items = load(f"providers/{pid}/hanja-mapping.json")["items"]
    order = [l["id"] for l in lv]; idx = {l: i for i, l in enumerate(order)}
    lof = {x["c"]: x["l"] for x in items}
    seen, cum, warn = set(), 0, []
    print(f"== {pid}")
    for l in lv:
        if not l["hasData"]:
            print(f"  {l['name']}: 데이터 없음"); fail.append(f"{pid} {l['name']} hasData false"); continue
        new = [x["c"] for x in items if x["l"] == l["id"]]
        dup = [c for c in new if c in seen]; seen.update(new); cum += len(new)
        exp = l.get("officialFileCount") or l.get("readCountGlyph") or l.get("readCount")
        miss = [c for c in new if c not in dic]
        def hn(c):
            d = dic.get(c, {}); m = d.get(HE.get(pid)) or d.get("m") or []
            return bool(m and m[0][0] and m[0][1])
        noh = [c for c in new if c in dic and not hn(c)]
        undoc = [c for c in noh if not (dic[c].get("noHunum") or dic[c].get("hunMissing"))]
        ok = (exp is None or cum == exp) and not dup and not miss and not undoc
        warn += noh
        print(f"  {l['name']}\t신출 {len(new)}\t누적 {cum}\t공식 {exp}\t{'PASS' if ok else 'FAIL'}" + (f"\t훈 없음 {len(noh)}" if noh else ""))
        if not ok: fail.append(f"{pid} {l['name']} {dup[:3]} {miss[:3]} {undoc[:3]}")
    if any(x["l"] not in idx for x in items): fail.append(f"{pid} 범위 밖 항목")
    if warn: print(f"  (경고) 훈(뜻) 공식 자료 없는 글자 {len(warn)}자: {''.join(warn)}")
    qtot = 0
    for l in order:
        fp = os.path.join(D, f"questions/{pid}/{l}.json")
        if not os.path.exists(fp): continue
        qs = load(f"questions/{pid}/{l}.json")["questions"]; qtot += len(qs)
        bad = []
        for q in qs:
            if q["provider"] != pid or q["level"] != l or q.get("sourceType") != "original": bad.append(q["id"]); continue
            for ch in q.get("relatedHanja", []):
                if ch not in lof or idx[lof[ch]] > idx[l]: bad.append(q["id"] + ":" + ch); break
        if bad: fail.append(f"{pid} 문제 범위 {l} {bad[:3]}")
    print(f"  문제 {qtot:,}문항")
print("RESULT:", "PASS" if not fail else "FAIL " + str(fail[:10]))
sys.exit(1 if fail else 0)
