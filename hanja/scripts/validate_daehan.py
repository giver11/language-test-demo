#!/usr/bin/env python3
"""대한검정회 데이터 검증 (빌드 산출물 기준). 실패 시 종료코드 1.
- 급수별 누적 개수 = 공식 누적 수, 중복/누락, 훈·음 빈 값, 다른 기관 데이터 혼입, 문제 정답·보기가 급수 범위 안인지"""
import json, os, sys
sys.path.insert(0, os.path.dirname(__file__))
import providers_meta as M
D = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data")
def load(p): return json.load(open(os.path.join(D, p), encoding="utf-8"))
lv = load("providers/daehan/levels.json")["levels"]
mp = load("providers/daehan/hanja-mapping.json")["items"]
db = load("providers/daehan/hanja.json")["items"]
dic = load("dictionary/hanja.json")["chars"]
order = [l["id"] for l in lv]
fail = []
seen = set(); cum = 0
print("급수\t신출\t누적\t공식\t결과")
for l in lv:
    if l["readCount"] is None:
        print(l["name"], "\t-\t-\t-\t(선정한자 범위 없음: 공식)"); continue
    new = [x["c"] for x in mp if x["l"] == l["id"]]
    dup = [c for c in new if c in seen]; seen.update(new)
    cum += len(new)
    miss = [c for c in new if c not in dic]
    ok = cum == l["readCount"] and not dup and not miss and l["hasData"]
    print("%s\t%d\t%d\t%d\t%s" % (l["name"], len(new), cum, l["readCount"], "PASS" if ok else "FAIL %s %s" % (dup[:5], miss[:5])))
    if not ok: fail.append(l["name"])
if any(x["l"] not in order for x in mp): fail.append("급수 범위 밖 항목")
if any(x.get("src") != "official" for x in mp): fail.append("비공식 출처 항목")
empty = [x["character"] for x in db if not x["meaning"] or not x["reading"] or x["meaning"] in ("null", "undefined") or x["reading"] in ("null", "undefined")]
if empty: fail.append("훈/음 빈 값 %s" % empty[:10])
print("DB 항목:", len(db), "훈음 공식표 기준:", sum(1 for x in db if x["hunumSource"].startswith("대한검정회")), "사전 대체:", [x["character"] for x in db if not x["hunumSource"].startswith("대한검정회")])
# 문제 범위 검사
lof = {x["c"]: x["l"] for x in mp}
idx = {l: i for i, l in enumerate(order)}
qtot = 0
for l in order:
    fp = os.path.join(D, "questions/daehan/%s.json" % l)
    if not os.path.exists(fp): continue
    qs = load("questions/daehan/%s.json" % l)["questions"]
    qtot += len(qs)
    bad = []
    for q in qs:
        if q["provider"] != "daehan" or q["level"] != l or q.get("sourceType") != "original-practice": bad.append(q["id"]); continue
        for ch in q.get("relatedHanja", []):
            if ch not in lof or idx[lof[ch]] > idx[l]: bad.append(q["id"]); break
        if q["type"] in ("hunum-rev", "word-blank", "idiom-blank", "antonym", "synonym", "homophone-char"):
            for ch in q["choices"]:
                if ch not in lof or idx[lof[ch]] > idx[l]: bad.append(q["id"] + ":" + ch); break
        if q.get("choices") and not isinstance(q["answer"], int): bad.append(q["id"] + ":answer")
    print("문제 %s: %d문항 %s" % (l, len(qs), "PASS" if not bad else "FAIL %s" % bad[:5]))
    if bad: fail.append("문제 범위 %s" % l)
print("대한검정회 문제 총:", qtot)
print("RESULT:", "PASS" if not fail else "FAIL " + str(fail))
sys.exit(1 if fail else 0)
