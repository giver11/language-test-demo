#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""통합 한자 자격시험 앱 데이터 빌드.

입력(원천):
  - 한국어문회 급수별 배정한자: rycont/hanja-grade-dataset (공식 xls 변환본)
  - 한자 훈음/한자어 목록/빈도: libhangul data/hanja (BSD 3-Clause, Choe Hwanjin)
  - 획순: hanzi-writer-data (Make Me a Hanzi 기반, Arphic Public License)
  - 사자성어 뜻풀이·반의/유의 쌍: scripts/src/*.tsv (이 프로젝트 자체 작성)
  - 기관 메타데이터: scripts/providers_meta.py (공식 사이트 조사 결과)

출력: hanja/data/**  (앱이 fetch 로 읽는 정적 JSON)

사용: python3 scripts/build_data.py --src <원천 폴더>
원천 폴더에는 hanja-grade-dataset/, libhangul/, hanzi-writer-data/ 가 있어야 한다.
"""
import argparse, csv, json, os, random, re, shutil, sys, unicodedata, ast
from collections import defaultdict, Counter

sys.path.insert(0, os.path.dirname(__file__))
import providers_meta as M

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.dirname(HERE)
DATA = os.path.join(APP, "data")

ap = argparse.ArgumentParser()
ap.add_argument("--src", required=True)
ap.add_argument("--skip-strokes", action="store_true")
args = ap.parse_args()
SRC = args.src

def nfc(s):
    return unicodedata.normalize("NFC", s)

def dump(path, obj, compact=True):
    full = os.path.join(DATA, path)
    os.makedirs(os.path.dirname(full), exist_ok=True)
    with open(full, "w", encoding="utf-8") as f:
        if compact:
            json.dump(obj, f, ensure_ascii=False, separators=(",", ":"))
        else:
            json.dump(obj, f, ensure_ascii=False, indent=1)
    return full

def is_han(ch):
    o = ord(ch)
    return 0x3400 <= o <= 0x9FFF or 0xF900 <= o <= 0xFAFF or 0x20000 <= o <= 0x2FFFF

# ------------------------------------------------------------------ 1. libhangul
lh_char = defaultdict(list)   # 字 -> ["배울 학", ...]  (훈음 문자열)
lh_word = defaultdict(list)   # 漢字語 -> [한글 독음]
with open(os.path.join(SRC, "libhangul/data/hanja/hanja.txt"), encoding="utf-8") as f:
    for line in f:
        if line.startswith("#") or ":" not in line:
            continue
        parts = line.rstrip("\n").split(":")
        if len(parts) < 3:
            continue
        hg, hj, cm = parts[0], nfc(parts[1]), parts[2]
        if not hj or not all(is_han(c) for c in hj):
            continue
        if len(hj) == 1:
            if cm:
                for piece in cm.split(","):
                    piece = piece.strip()
                    if piece and piece not in lh_char[hj]:
                        lh_char[hj].append(piece)
        else:
            if hg not in lh_word[hj]:
                lh_word[hj].append(hg)

freq = {}
with open(os.path.join(SRC, "libhangul/data/hanja/freq-hanjaeo.txt"), encoding="utf-8") as f:
    for line in f:
        if ":" in line:
            w, v = line.rstrip("\n").rsplit(":", 1)
            try:
                freq[nfc(w)] = int(v)
            except ValueError:
                pass

# ------------------------------------------------------------------ 2. 한국어문회 배정한자
LEVEL_ORDER = [l[0] for l in M.EOMUNHOE_LEVELS]
LEVEL_IDX = {lid: i for i, lid in enumerate(LEVEL_ORDER)}
dict_chars = {}      # 字 -> dictionary entry
eom_map = []         # {c, level}
rows = list(csv.DictReader(open(os.path.join(SRC, "hanja-grade-dataset/hanja.csv"), encoding="utf-8")))
for r in rows:
    c = nfc(r["hanja"])
    lid = M.EOMUNHOE_NAME2ID[r["level"]]
    try:
        meaning = ast.literal_eval(r["meaning"])
    except Exception:
        meaning = []
    hun_eum = []
    for m in meaning:
        huns, eums = m[0], m[1]
        for h in huns:
            for e in eums:
                hun_eum.append([h, e])
    if c in dict_chars:
        continue
    dict_chars[c] = {
        "c": c, "id": "U+%04X" % ord(c),
        "m": hun_eum,                     # [[훈, 음], ...]
        "r": r["main_sound"],             # 대표 음
        "rad": nfc(r["radical"]),
        "st": int(r["total_strokes"]) if r["total_strokes"].isdigit() else None,
        "src": "eomunhoe-xls",
    }
    eom_map.append({"c": c, "level": lid})

print("한국어문회 배정한자:", len(eom_map), Counter(x["level"] for x in eom_map))

# 대한검정회 8급(2차 자료) — 사전에 없는 글자는 libhangul 훈음으로 보완
for c, h, e in M.DAEHAN_8:
    c = nfc(c)
    if c not in dict_chars:
        dict_chars[c] = {"c": c, "id": "U+%04X" % ord(c), "m": [[h, e]], "r": e, "rad": None, "st": None, "src": "libhangul"}

# 훈음 교차검증: 한국어문회 음이 libhangul 훈음 문자열의 음과 일치하는지
mismatch = []
for c, d in dict_chars.items():
    lh = lh_char.get(c, [])
    lh_eums = {p.split()[-1] for p in lh if p.split()}
    if lh and d["r"] and d["r"] not in lh_eums:
        # 두음법칙(녀/여, 륙/육 등) 차이 허용
        alt = {"녀": "여", "륙": "육", "로": "노", "락": "낙", "례": "예", "리": "이", "량": "양", "력": "역", "련": "연", "렬": "열", "령": "영", "료": "요", "룡": "용", "류": "유", "률": "율", "륜": "윤", "린": "인", "림": "임", "립": "입", "라": "나", "란": "난", "람": "남", "랑": "낭", "래": "내", "랭": "냉", "략": "약", "려": "여", "록": "녹", "론": "논", "뢰": "뇌", "루": "누", "름": "름", "릉": "능", "니": "이", "뇨": "요", "뉴": "유", "닉": "익", "년": "연", "념": "염", "녕": "영"}
        if alt.get(d["r"]) not in lh_eums:
            mismatch.append((c, d["r"], lh[:3]))
print("음 교차검증 불일치:", len(mismatch), mismatch[:10])

# ------------------------------------------------------------------ 3. 획순 데이터
hw_dir = os.path.join(SRC, "hanzi-writer-data/data")
hw_have = {}
for fn in os.listdir(hw_dir):
    if fn.endswith(".json"):
        hw_have[nfc(fn[:-5])] = fn
stroke_out = os.path.join(DATA, "strokes")
if not args.skip_strokes:
    if os.path.isdir(stroke_out):
        shutil.rmtree(stroke_out)
    os.makedirs(stroke_out)
n_stroke = 0
for c, d in dict_chars.items():
    fn = hw_have.get(c)
    d["so"] = bool(fn)
    if fn:
        n_stroke += 1
        d["sc"] = None
        with open(os.path.join(hw_dir, fn), encoding="utf-8") as f:
            sd = json.load(f)
        d["sc"] = len(sd["strokes"])
        if not args.skip_strokes:
            with open(os.path.join(stroke_out, "%04X.json" % ord(c)), "w", encoding="utf-8") as f:
                json.dump({"s": sd["strokes"], "m": sd["medians"]}, f, separators=(",", ":"))
print("획순 데이터 보유:", n_stroke, "/", len(dict_chars))

# ------------------------------------------------------------------ 4. 한자어
# 사전 등록 한자로만 구성, libhangul 에 독음이 있고 빈도 목록에 있는 2~3음절 한자어
words = {}
for w, f in freq.items():
    if not (2 <= len(w) <= 3):
        continue
    if not all(ch in dict_chars for ch in w):
        continue
    rd = lh_word.get(w)
    if not rd:
        continue
    reading = rd[0]
    if len(reading) != len(w):
        continue
    words[w] = {"w": w, "r": reading, "f": f}
print("한자어 후보:", len(words))

def gloss(w):
    parts = []
    for ch in w:
        d = dict_chars[ch]
        he = d["m"][0] if d["m"] else ["", d["r"]]
        parts.append("%s(%s %s)" % (ch, he[0], he[1]))
    return " + ".join(parts)

# 글자별 예시 한자어(빈도순 상위 4)
by_char_words = defaultdict(list)
for w in sorted(words.values(), key=lambda x: -x["f"]):
    for ch in set(w["w"]):
        if len(by_char_words[ch]) < 6:
            by_char_words[ch].append(w["w"])

# ------------------------------------------------------------------ 5. 사자성어
idioms = []
seen = set()
for line in open(os.path.join(HERE, "src/idioms.tsv"), encoding="utf-8"):
    if line.startswith("#") or not line.strip():
        continue
    cols = line.rstrip("\n").split("\t")
    if len(cols) < 3:
        continue
    hj, mean, ex = nfc(cols[0]), cols[1].strip(), cols[2].strip()
    if len(hj) != 4 or mean.startswith("(") or hj in seen:
        continue
    rd = lh_word.get(hj)
    if not rd:
        print("  [제외] 사전 미등재 사자성어:", hj)
        continue
    missing = [ch for ch in hj if ch not in dict_chars]
    if missing:
        # 사전에 없는 글자는 libhangul 훈음으로 보완 (획순은 데이터 있을 때만)
        for ch in missing:
            lh = lh_char.get(ch)
            if not lh:
                break
            h, e = lh[0].rsplit(" ", 1) if " " in lh[0] else ("", lh[0])
            dict_chars[ch] = {"c": ch, "id": "U+%04X" % ord(ch), "m": [[h, e]], "r": e, "rad": None, "st": None, "src": "libhangul"}
            fn = hw_have.get(ch)
            dict_chars[ch]["so"] = bool(fn)
            if fn:
                with open(os.path.join(hw_dir, fn), encoding="utf-8") as f:
                    sd = json.load(f)
                dict_chars[ch]["sc"] = len(sd["strokes"])
                if not args.skip_strokes:
                    with open(os.path.join(stroke_out, "%04X.json" % ord(ch)), "w", encoding="utf-8") as f:
                        json.dump({"s": sd["strokes"], "m": sd["medians"]}, f, separators=(",", ":"))
        else:
            missing = []
        if missing:
            print("  [제외] 훈음 없는 글자 포함:", hj)
            continue
    seen.add(hj)
    idioms.append({
        "id": "I%03d" % (len(idioms) + 1), "w": hj, "r": rd[0], "mean": mean, "ex": ex,
        "chars": [[ch, (dict_chars[ch]["m"][0][0] if dict_chars[ch]["m"] else ""), dict_chars[ch]["r"]] for ch in hj],
        "sourceType": "original-practice",
    })
print("사자성어:", len(idioms))

# 반의/유의 쌍
pairs = {"antonym": [], "synonym": []}
for line in open(os.path.join(HERE, "src/pairs.tsv"), encoding="utf-8"):
    if line.startswith("#") or not line.strip():
        continue
    t, a, b = line.rstrip("\n").split("\t")
    a, b = nfc(a), nfc(b)
    if a in dict_chars and b in dict_chars and [a, b] not in pairs[t]:
        pairs[t].append([a, b])
print("반의 쌍:", len(pairs["antonym"]), "유의 쌍:", len(pairs["synonym"]))

# ------------------------------------------------------------------ 6. 공통 사전 출력
related_idioms = defaultdict(list)
for it in idioms:
    for ch in set(it["w"]):
        related_idioms[ch].append(it["id"])
for c, d in dict_chars.items():
    d["ex"] = by_char_words.get(c, [])[:4]
    d["idm"] = related_idioms.get(c, [])[:4]
    d.setdefault("so", False)
dump("dictionary/hanja.json", {"meta": {
        "description": "공통 한자 사전(시험기관과 무관한 글자 정보). 시험 정보는 providers/*/hanja-mapping.json 에서 분리 관리.",
        "fields": {"c": "character", "id": "unicode id", "m": "[[훈(meaning), 음(koreanReading)]]", "r": "대표 음", "rad": "radical 부수",
                   "st": "strokeCount 총획수(한국어문회 자료)", "sc": "획순 데이터의 획 수", "so": "획순 데이터 존재 여부",
                   "ex": "exampleWords 관련 한자어", "idm": "relatedIdioms 관련 사자성어 id"},
        "sources": ["한국어문회 배정한자 xls 변환본(rycont/hanja-grade-dataset)", "libhangul hanja.txt (BSD-3-Clause)", "hanzi-writer-data (Arphic Public License)"],
        "strokeNote": "획순 데이터는 Make Me a Hanzi(중국 표준 필순 기반)입니다. 한국 교육용 필순·획수와 다를 수 있으며, 획 수가 다른 글자(예: 艹 부수)는 필순 문항에서 제외했습니다.",
        "count": len(dict_chars)}, "chars": dict_chars})

wlist = sorted(words.values(), key=lambda x: -x["f"])
WORDS_ALL = wlist

dump("dictionary/idioms.json", {"meta": {"description": "사자성어: 독음은 libhangul 사전과 대조, 뜻풀이·사용 예는 자체 작성(original-practice).",
                                         "count": len(idioms)}, "idioms": idioms})
dump("dictionary/pairs.json", {"meta": {"description": "반대/비슷한 뜻 한자 쌍 (자체 정리, original-practice)"}, **pairs})

# ------------------------------------------------------------------ 7. 기관별 levels / mapping / exam-types
def write_sources():
    for pid, srcs in M.SOURCES.items():
        dump("providers/%s/sources.json" % pid, srcs, compact=False)
write_sources()
dump("providers/index.json", {"providers": M.PROVIDERS, "verifiedAt": M.VERIFIED_AT}, compact=False)

# --- 한국어문회
eom_levels = []
cum = 0
new_counts = Counter(x["level"] for x in eom_map)
cum_by_level = {}
for (lid, name, cat, rd, wr, q, ps, tm) in M.EOMUNHOE_LEVELS:
    cum += new_counts[lid]
    cum_by_level[lid] = cum
for i, (lid, name, cat, rd, wr, q, ps, tm) in enumerate(M.EOMUNHOE_LEVELS):
    # 쓰기 범위 = 하위 급수 읽기 배정 누적(배정 수가 정확히 일치하는 급수)
    write_upto = None
    for lj in LEVEL_ORDER[:i]:
        if cum_by_level[lj] == wr:
            write_upto = lj
    note = []
    data_count = cum_by_level[lid]
    if data_count != rd:
        note.append("공식 표기 읽기 배정 %d자 ↔ 공식 xls 변환 데이터 누적 %d자 불일치 — 공식 자료 확인 필요" % (rd, data_count))
    if wr and write_upto is None:
        # 1급 쓰기 2005자: 3급 누적 1817자까지만 확정
        cand = [lj for lj in LEVEL_ORDER[:i] if cum_by_level[lj] <= wr]
        write_upto = cand[-1] if cand else None
        note.append("공식 쓰기 배정 %d자 중 %s까지(%d자)만 확정 — 나머지 %d자 공식 목록 확인 필요" % (
            wr, dict(zip(LEVEL_ORDER, [l[1] for l in M.EOMUNHOE_LEVELS]))[write_upto], cum_by_level[write_upto], wr - cum_by_level[write_upto]))
    dist = M.EOMUNHOE_TYPE_DIST[lid]
    assert sum(dist) == q, (lid, sum(dist), q)
    eom_levels.append({
        "id": lid, "name": name, "order": i, "category": cat,
        "readCount": rd, "writeCount": wr, "newCount": new_counts[lid], "dataCount": data_count,
        "writeUpto": write_upto, "hasData": True,
        "exam": {"questionCount": q, "passCount": ps, "timeMin": tm, "passRule": "%d문항 중 %d문항 이상(%d%%)" % (q, ps, round(ps * 100 / q)),
                 "mockSupported": True},
        "notes": note,
        "status": {"levels": "secondary", "hanja": "official-file", "examFormat": "secondary"},
    })
dump("providers/eomunhoe/levels.json", {"provider": "eomunhoe", "levels": eom_levels,
                                         "writeRule": "한국어문회 쓰기 배정한자 = 하위 급수의 읽기 배정한자 누적(배정 수 일치로 산출). 공식 쓰기 목록 대조 필요.",
                                         "sourceRefs": [s["sourceUrl"] for s in M.SOURCES["eomunhoe"]]}, compact=False)
eom_write_level = {}
for x in eom_map:
    # 이 글자가 쓰기 범위에 처음 들어가는 급수
    li = LEVEL_IDX[x["level"]]
    wl = None
    for L in eom_levels:
        if L["writeUpto"] is not None and LEVEL_IDX[L["writeUpto"]] >= li:
            wl = L["id"]
            break
    eom_write_level[x["c"]] = wl
dump("providers/eomunhoe/hanja-mapping.json", {"provider": "eomunhoe", "status": "official-file",
      "fields": {"c": "character", "l": "읽기 배정 급수(level)", "w": "쓰기 범위에 포함되는 첫 급수(writingRequired 기준)"},
      "items": [{"c": x["c"], "l": x["level"], "w": eom_write_level[x["c"]]} for x in eom_map]})
dump("providers/eomunhoe/exam-types.json", {"provider": "eomunhoe", "status": "secondary",
      "statusNote": "유형별 문항 배분은 한국어문회 출제기준표 기준. 이 환경에서 공식 사이트 직접 대조 불가 → 공식 원문 대조 필요.",
      "typeKeys": M.EOMUNHOE_TYPE_KEYS,
      "levels": {lid: dict(zip(M.EOMUNHOE_TYPE_KEYS, dist)) for lid, dist in M.EOMUNHOE_TYPE_DIST.items()},
      "unsupportedInApp": {"장단음": "장단음 데이터 미확보 — 모의시험에서 독음 문항으로 대체하고 화면에 표시",
                           "약자": "약자 데이터 미확보 — 모의시험에서 훈음 문항으로 대체하고 화면에 표시"},
      "typeDescriptions": {"독음": "한자어의 읽는 소리 쓰기", "훈음": "한자의 뜻과 소리", "장단음": "한자어 첫 음절의 길고 짧음",
                           "반의어": "뜻이 반대(상대)되는 한자·한자어", "완성형": "한자어·성어의 빈칸 채우기", "부수": "한자의 부수",
                           "동의어": "뜻이 비슷한 한자·한자어", "동음이의어": "소리는 같고 뜻이 다른 한자·한자어", "뜻풀이": "한자어·성어의 뜻",
                           "약자": "정자의 약자", "필순": "획을 쓰는 순서", "한자쓰기": "제시된 훈음·한자어를 한자로 쓰기"}}, compact=False)

# --- 대한검정회
dh_levels = []
for i, (lid, name, cat, cnt, q) in enumerate(M.DAEHAN_LEVELS):
    has = lid == "8"
    dh_levels.append({"id": lid, "name": name, "order": i, "category": cat, "readCount": cnt, "writeCount": None,
                      "newCount": 30 if has else None, "dataCount": 30 if has else 0, "hasData": has,
                      "exam": {"questionCount": q, "passCount": None, "timeMin": None,
                               "passRule": "70점 이상 (공식 출제형식 페이지 판독값 — 급수별 세부 확인 필요)", "mockSupported": False},
                      "notes": (["8급 30자: 나무위키 전사본(2차 자료). 공식 선정한자표(이미지)와 대조 필요."] if has else
                                ["선정한자 목록 " + M.NEEDS + " (공식 사이트에 이미지로만 게시)"]) + ["문항 수는 공식 페이지 판독값 — " + M.NEEDS],
                      "status": {"levels": "partial", "hanja": "secondary" if has else "missing", "examFormat": "partial"}})
dump("providers/daehan/levels.json", {"provider": "daehan", "levels": dh_levels,
      "testTimes": {"8급~2급": "13:40 입실, 14:00 시작 (공식 일정표 '오후 2시 정각 전국동시')", "note": "시험 시간 세부는 " + M.NEEDS},
      "online": {"levels": ["8급", "7급", "6급", "준5급", "5급", "준4급", "4급", "준3급", "3급"], "format": "객관식",
                 "items": {"8급·7급": "25문항 15분", "6급~3급": "50문항 25분"}, "pass": "70점 이상", "source": "https://www.hanja.ne.kr/info/info01_online.asp"},
      "sourceRefs": [s["sourceUrl"] for s in M.SOURCES["daehan"]]}, compact=False)
dump("providers/daehan/hanja-mapping.json", {"provider": "daehan", "status": "secondary",
      "statusNote": "8급 30자만 2차 자료(나무위키 전사본) 기준으로 등록. 공식 선정한자와 대조 필요. 그 외 급수는 공식 자료 확인 필요.",
      "items": [{"c": nfc(c), "l": "8", "w": None} for c, _h, _e in M.DAEHAN_8]})
dump("providers/daehan/exam-types.json", {"provider": "daehan", "status": "unverified",
      "statusNote": "급수별 출제 유형·문항 배분 " + M.NEEDS + ". 앱은 기본 한자 유형(훈음·독음)만 연습용으로 제공.",
      "levels": {"8": {"훈음": None, "독음": None}}}, compact=False)

# --- 한자교육진흥회
jh_levels = []
for i, (lid, name, cat, cnt, tm, q, subj, wr, obj, pt, full, pr) in enumerate(M.JINHEUNG_LEVELS):
    notes = ["급수별 선정한자 목록 " + M.NEEDS + " (공식 .hwp/.exe 파일, 이 환경에서 다운로드 불가)"]
    if lid in M.JINHEUNG_NOTES:
        notes.append(M.JINHEUNG_NOTES[lid])
    jh_levels.append({"id": lid, "name": name, "order": i, "category": cat, "readCount": cnt, "writeCount": None,
                      "newCount": None, "dataCount": 0, "hasData": False,
                      "exam": {"questionCount": q, "subjective": subj, "writing": wr, "objective": obj, "pointEach": pt, "fullScore": full,
                               "timeMin": tm, "passCount": None, "passRule": "만점의 %d%% 이상" % round(pr * 100), "passRatio": pr,
                               "mockSupported": False, "mockBlockedReason": "배정한자 데이터 없음"},
                      "notes": notes, "status": {"levels": "official", "hanja": "missing", "examFormat": "official"}})
dump("providers/jinheung/levels.json", {"provider": "jinheung", "levels": jh_levels, "testTime": "매회 전 급수(사범~8급) 오후 3시",
      "sourceRefs": [s["sourceUrl"] for s in M.SOURCES["jinheung"]]}, compact=False)
dump("providers/jinheung/hanja-mapping.json", {"provider": "jinheung", "status": "missing", "statusNote": M.NEEDS, "items": []})
dump("providers/jinheung/exam-types.json", {"provider": "jinheung", "status": "official", "ratio": M.JINHEUNG_TYPE_RATIO}, compact=False)

# --- 대한상공회의소
kc_levels = []
for i, (lid, name, cat, tm, (a, b, c3), rule) in enumerate(M.KORCHAM_LEVELS):
    full = a * 4 + b * 6 + c3 * 8
    kc_levels.append({"id": lid, "name": name, "order": i, "category": cat, "readCount": None, "writeCount": 0,
                      "newCount": None, "dataCount": 0, "hasData": False,
                      "exam": {"questionCount": a + b + c3, "sections": {"한자": a, "어휘": b, "독해": c3}, "points": {"한자": 4, "어휘": 6, "독해": 8},
                               "fullScore": full, "timeMin": tm, "passRule": rule, "format": "CBT 객관식", "mockSupported": False,
                               "mockBlockedReason": "배정한자 데이터 없음"},
                      "notes": ["급수별 배정한자 " + M.NEEDS + " (공식 '배정한자 (1~ 9급).zip', 이 환경에서 다운로드 불가)",
                                "공식 FAQ: 1급 응시자는 1~9급 누적 약 4,908자 학습 필요, 1급 배정은 1,607자"] if lid == "1" else
                               ["급수별 배정한자 " + M.NEEDS + " (공식 '배정한자 (1~ 9급).zip', 이 환경에서 다운로드 불가)"],
                      "status": {"levels": "official", "hanja": "missing", "examFormat": "official"}})
dump("providers/korcham/levels.json", {"provider": "korcham", "levels": kc_levels,
      "note": "상공회의소 한자는 읽기·이해 중심의 객관식 시험(쓰기 문항 없음). 쓰기 연습은 학습용으로만 제공.",
      "sourceRefs": [s["sourceUrl"] for s in M.SOURCES["korcham"]]}, compact=False)
dump("providers/korcham/hanja-mapping.json", {"provider": "korcham", "status": "missing", "statusNote": M.NEEDS, "items": []})
dump("providers/korcham/exam-types.json", {"provider": "korcham", "status": "official", "sections": ["한자", "어휘", "독해"],
      "format": "CBT 객관식", "detailNote": "영역별 세부 유형은 공식 '검정 기준' 문서(hwpx) 확인 필요"}, compact=False)

# ------------------------------------------------------------------ 8. 2026 시험 일정
S_EOM = [s for s in M.SOURCES["eomunhoe"] if s["status"] == "secondary"][0]
sched = {
    "eomunhoe": {"provider": "eomunhoe", "year": 2026, "examName": "전국한자능력검정시험",
                 "status": "secondary", "statusNote": "공식 사이트 직접 접속 불가 — 공식 공지 재게시 자료 2건 교차확인. 접수 전 공식 사이트 확인 필요.",
                 "source": {"provider": "eomunhoe", "sourceName": S_EOM["sourceName"], "sourceUrl": S_EOM["sourceUrl"], "verifiedAt": M.VERIFIED_AT, "year": 2026},
                 "officialUrl": "https://www.hanja.re.kr/",
                 "sessions": [
                     {"round": "제112회", "levels": "특급~8급", "applyStart": "2026-01-19", "applyEnd": "2026-01-23", "examDate": "2026-02-28", "resultDate": "2026-03-27", "mode": "오프라인 · 인터넷 접수"},
                     {"round": "제113회", "levels": "특급~8급", "applyStart": "2026-04-20", "applyEnd": "2026-04-24", "examDate": "2026-05-23", "resultDate": "2026-06-19", "mode": "오프라인 · 인터넷 접수"},
                     {"round": "제114회", "levels": "특급~8급", "applyStart": "2026-07-13", "applyEnd": "2026-07-17", "examDate": "2026-08-22", "resultDate": "2026-09-18", "mode": "오프라인 · 인터넷 접수"},
                     {"round": "제115회", "levels": "특급~8급", "applyStart": "2026-10-19", "applyEnd": "2026-10-23", "examDate": "2026-11-21", "resultDate": "2026-12-18", "mode": "오프라인 · 인터넷 접수"},
                 ]},
    "daehan": {"provider": "daehan", "year": 2026, "examName": "한자급수자격검정", "status": "official",
               "source": {"provider": "daehan", "sourceName": "대한검정회 2026년도 한자급수자격검정시험 시행일정", "sourceUrl": "https://www.hanja.ne.kr/info/info01.asp", "verifiedAt": M.VERIFIED_AT, "year": 2026},
               "officialUrl": "https://www.hanja.ne.kr/",
               "sessions": [
                   {"round": "제110회", "levels": "8급~대사범", "applyStart": "2026-01-05", "applyEnd": "2026-01-16", "examDate": "2026-02-28", "resultDate": "2026-03-23", "mode": "현장시험 · 인터넷 접수"},
                   {"round": "제111회", "levels": "8급~대사범", "applyStart": "2026-03-30", "applyEnd": "2026-04-10", "examDate": "2026-05-23", "resultDate": "2026-06-15", "mode": "현장시험 · 인터넷 접수"},
                   {"round": "제112회", "levels": "8급~대사범", "applyStart": "2026-06-29", "applyEnd": "2026-07-10", "examDate": "2026-08-22", "resultDate": "2026-09-14", "mode": "현장시험 · 인터넷 접수"},
                   {"round": "제113회", "levels": "8급~대사범", "applyStart": "2026-10-05", "applyEnd": "2026-10-16", "examDate": "2026-11-28", "resultDate": "2026-12-21", "mode": "현장시험 · 인터넷 접수"},
                   {"round": "제110회(온라인)", "levels": "8급~3급", "applyStart": "2026-01-19", "applyEnd": "2026-01-23", "examDate": "2026-02-07", "resultDate": None, "mode": "자기주도형 온라인 · 객관식",
                    "source": {"sourceName": "대한검정회 자기주도형 온라인 시험 안내", "sourceUrl": "https://www.hanja.ne.kr/info/info01_online.asp"}, "resultNote": M.NEEDS},
                   {"round": "제112회(온라인)", "levels": "8급~3급", "applyStart": "2026-07-20", "applyEnd": "2026-07-24", "examDate": "2026-08-08", "resultDate": None, "mode": "자기주도형 온라인 · 객관식",
                    "source": {"sourceName": "대한검정회 자기주도형 온라인 시험 안내", "sourceUrl": "https://www.hanja.ne.kr/info/info01_online.asp"}, "resultNote": M.NEEDS},
               ]},
    "jinheung": {"provider": "jinheung", "year": 2026, "examName": "한자실력급수 자격시험", "status": "official",
                 "source": {"provider": "jinheung", "sourceName": "한자교육진흥회(한국한자실력평가원) 시험일정", "sourceUrl": "https://www.hanja114.org/common/intro/examInfoList.do", "verifiedAt": M.VERIFIED_AT, "year": 2026},
                 "officialUrl": "https://web.hanja114.org/", "note": "사정에 따라 시험 일정 및 접수기간은 조정될 수 있음(공식 안내).",
                 "sessions": [
                     {"round": "제123회", "levels": "사범~8급", "applyStart": "2026-01-13", "applyEnd": "2026-01-22", "examDate": "2026-02-28", "resultDate": "2026-03-26", "mode": "오프라인 · 인터넷/방문 접수 · 오후 3시"},
                     {"round": "제124회", "levels": "사범~8급", "applyStart": "2026-04-14", "applyEnd": "2026-04-23", "examDate": "2026-05-16", "resultDate": "2026-06-11", "mode": "오프라인 · 인터넷/방문 접수 · 오후 3시"},
                     {"round": "제125회", "levels": "사범~8급", "applyStart": "2026-07-14", "applyEnd": "2026-07-23", "examDate": "2026-08-22", "resultDate": "2026-09-17", "mode": "오프라인 · 인터넷/방문 접수 · 오후 3시"},
                     {"round": "제126회", "levels": "사범~8급", "applyStart": "2026-10-13", "applyEnd": "2026-10-22", "examDate": "2026-11-21", "resultDate": "2026-12-17", "mode": "오프라인 · 인터넷/방문 접수 · 오후 3시"},
                 ]},
    "korcham": {"provider": "korcham", "year": 2026, "examName": "상공회의소 한자", "status": "official", "type": "always",
                "source": {"provider": "korcham", "sourceName": "상공회의소 한자 시험일정 / 2026년 상시 자격시험 시작일정 안내", "sourceUrl": "https://license.korcham.net/co/examguide03.do?cd=0401&mm=53", "verifiedAt": M.VERIFIED_AT, "year": 2026},
                "officialUrl": "https://license.korcham.net/",
                "always": {"description": "상시 시행(시험개설 여부는 시험장 상황에 따라 다름)", "applyRule": "개설일로부터 시험일 4일 전까지",
                           "resultRule": "시험일 다음날 오전 10시", "yearStart": {"applyStart": "2026-01-01", "firstExam": "2026-01-05"},
                           "note": "지역상의 시행은 상의별로 다를 수 있음. 정해진 회차 날짜가 없으므로 D-Day는 사용자가 접수한 시험일로 설정."},
                "sessions": []},
}
for pid, s in sched.items():
    dump("schedules/%s-2026.json" % pid, s, compact=False)
dump("schedules/index.json", {"years": {"2026": ["eomunhoe", "daehan", "jinheung", "korcham"]},
      "note": "연도별 일정은 schedules/{provider}-{year}.json 파일만 추가·수정하면 앱에 반영됩니다."}, compact=False)

# ------------------------------------------------------------------ 9. 문제은행 (한국어문회 · 대한검정회 8급)
rng = random.Random(20260928)

def he_str(c):
    d = dict_chars[c]
    if not d["m"]:
        return d["r"]
    return "%s %s" % (d["m"][0][0], d["m"][0][1])

def all_eums(c):
    return {m[1] for m in dict_chars[c]["m"]} | {dict_chars[c]["r"]}

def pick(pool, k, exclude, key=lambda x: x):
    seen_k = set(key(e) for e in exclude)
    out = []
    cand = pool if isinstance(pool, list) else list(pool)
    if len(cand) > 60:
        for _ in range(80):
            x = cand[rng.randrange(len(cand))]
            kx = key(x)
            if kx in seen_k:
                continue
            seen_k.add(kx)
            out.append(x)
            if len(out) >= k:
                return out
    cand = list(cand)
    rng.shuffle(cand)
    for x in cand:
        kx = key(x)
        if kx in seen_k:
            continue
        seen_k.add(kx)
        out.append(x)
        if len(out) >= k:
            break
    return out

def mcq(provider, level, qtype, typeLabel, question, prompt, answer, distractors, related, explanation, extra=None):
    choices = distractors[:3] + [answer]
    if len(choices) < 4:
        return None
    rng.shuffle(choices)
    q = {"provider": provider, "level": level, "type": qtype, "typeLabel": typeLabel, "question": question, "prompt": prompt,
         "choices": choices, "answer": choices.index(answer), "explanation": explanation, "relatedHanja": related,
         "sourceType": "original-practice"}
    if extra:
        q.update(extra)
    return q

def gen_bank(provider, level_ids, level_of, write_level_of, allowed, level_order, level_names):
    """level_of: 字->level id (읽기), write_level_of: 字->쓰기 시작 level id"""
    idx = {l: i for i, l in enumerate(level_order)}
    banks = {}
    for L in level_ids:
        Li = idx[L]
        scope = [c for c, l in level_of.items() if idx[l] <= Li]
        new = [c for c, l in level_of.items() if l == L]
        scope_set = set(scope)
        # 하위 급수 글자 일부도 복습 문항으로 포함
        review = [c for c in scope if level_of[c] != L]
        rng.shuffle(review)
        review = review[: max(10, len(new) // 3)]
        focus = new + review
        he_pool = sorted({he_str(c) for c in scope})
        q = []
        types = allowed[L]
        # --- 훈음
        if "훈음" in types:
            for c in focus:
                ans = he_str(c)
                ds = pick([h for h in he_pool if h != ans], 3, [ans])
                x = mcq(provider, L, "hunum", "훈음", "다음 한자의 훈(뜻)과 음(소리)으로 알맞은 것은?", c, ans, ds, [c],
                        "%s은(는) '%s'입니다." % (c, ans))
                if x: q.append(x)
                # 역방향
                ds2 = pick([s for s in scope if he_str(s) != ans], 3, [c])
                x = mcq(provider, L, "hunum-rev", "훈음", "훈(뜻)과 음(소리)이 '%s'인 한자는?" % ans, "", c, ds2, [c] + ds2,
                        "'%s'은(는) %s입니다." % (ans, c))
                if x: q.append(x)
        # --- 독음 (한자어)
        wscope = [w for w in wlist if all(ch in scope_set for ch in w["w"])]
        wnew = [w for w in wscope if any(level_of[ch] == L for ch in w["w"])]
        wnew = wnew[: (60 if Li < 5 else 150 if Li < 9 else 250)]
        if len(wnew) < 120:
            # 신출 한자가 들어간 한자어가 적은 급수(특급 등): 범위 내 빈출 한자어로 보충(복습)
            extra_w = [w for w in wscope if w not in wnew][: 120 - len(wnew)]
            wnew = wnew + extra_w
        if "독음" in types:
            if len(wnew) < 10:
                # 한자어가 적은 저급수: 한 글자 독음 문항으로 보충
                eum_pool = sorted({dict_chars[s]["r"] for s in scope})
                for c in focus:
                    ans = dict_chars[c]["r"]
                    ds = pick([e for e in eum_pool if e not in all_eums(c)], 3, [ans])
                    x = mcq(provider, L, "reading-char", "독음", "다음 한자의 음(소리)은?", c, ans, ds, [c], "%s의 음은 '%s'입니다 (%s)." % (c, ans, he_str(c)))
                    if x: q.append(x)
            rd_pool = [w["r"] for w in wscope]
            for w in wnew:
                ans = w["r"]
                same_len = [r for r in rd_pool if len(r) == len(ans) and r != ans]
                ds = pick(same_len, 3, [ans])
                x = mcq(provider, L, "word-reading", "독음", "다음 한자어의 독음(읽는 소리)은?", w["w"], ans, ds, list(w["w"]),
                        "%s은(는) '%s'(으)로 읽습니다. 글자 풀이: %s" % (w["w"], ans, gloss(w["w"])))
                if x: q.append(x)
                # 음 → 한자어
                cands = [v["w"] for v in wscope if len(v["w"]) == len(w["w"]) and v["w"] != w["w"] and v["r"] != ans]
                # 한 글자만 다른 한자어 우선
                near = [v for v in cands if sum(a != b for a, b in zip(v, w["w"])) == 1]
                ds2 = pick(near, 3, [w["w"]]) if len(near) >= 3 else pick(cands, 3, [w["w"]])
                x = mcq(provider, L, "word-from-reading", "독음", "'%s'을(를) 한자로 바르게 쓴 것은?" % ans, "", w["w"], ds2, list(w["w"]),
                        "'%s' = %s (%s)" % (ans, w["w"], gloss(w["w"])))
                if x: q.append(x)
        # --- 완성형 (한자어 빈칸)
        if "완성형" in types:
            for w in wnew[:120]:
                pos = rng.randrange(len(w["w"]))
                ans = w["w"][pos]
                blank = w["w"][:pos] + "□" + w["w"][pos + 1:]
                ds = pick([s for s in scope if s not in all_eums(ans) and dict_chars[s]["r"] != dict_chars[ans]["r"]], 3, [ans])
                x = mcq(provider, L, "word-blank", "완성형", "빈칸(□)에 들어갈 알맞은 한자는? (독음: %s)" % w["r"], blank, ans, ds, list(w["w"]),
                        "%s(%s) — 빈칸은 %s(%s)입니다." % (w["w"], w["r"], ans, he_str(ans)))
                if x: q.append(x)
            for it in idioms:
                if all(ch in scope_set for ch in it["w"]):
                    pos = rng.randrange(4)
                    ans = it["w"][pos]
                    blank = it["w"][:pos] + "□" + it["w"][pos + 1:]
                    ds = pick([s for s in scope if s != ans], 3, [ans])
                    x = mcq(provider, L, "idiom-blank", "완성형", "빈칸(□)에 알맞은 한자를 넣어 성어를 완성하세요.", blank, ans, ds, list(it["w"]),
                            "%s(%s): %s" % (it["w"], it["r"], it["mean"]), {"idiom": it["id"]})
                    if x: q.append(x)
        # --- 뜻풀이
        if "뜻풀이" in types:
            for it in idioms:
                if all(ch in scope_set for ch in it["w"]):
                    others = [o for o in idioms if o["id"] != it["id"]]
                    ds = pick([o["mean"].split(".")[0] for o in others], 3, [it["mean"].split(".")[0]])
                    x = mcq(provider, L, "idiom-meaning", "뜻풀이", "다음 성어의 뜻으로 알맞은 것은?", it["w"], it["mean"].split(".")[0], ds, list(it["w"]),
                            "%s(%s): %s" % (it["w"], it["r"], it["mean"]), {"idiom": it["id"]})
                    if x: q.append(x)
            for w in wnew[:60]:
                ans = gloss(w["w"])
                others = [gloss(v["w"]) for v in wscope if v["w"] != w["w"] and len(v["w"]) == len(w["w"])]
                ds = pick(others, 3, [ans])
                x = mcq(provider, L, "word-gloss", "뜻풀이", "다음 한자어를 이루는 글자의 뜻풀이로 알맞은 것은?", w["w"], ans, ds, list(w["w"]),
                        "%s(%s) = %s" % (w["w"], w["r"], ans))
                if x: q.append(x)
        # --- 반의어 / 동의어
        for key, label, qtype, word in (("antonym", "반의어", "antonym", "반대(상대)되는"), ("synonym", "동의어", "synonym", "비슷한")):
            if label not in types:
                continue
            for a, b in pairs[key]:
                if a in scope_set and b in scope_set:
                    for x0, y0 in ((a, b), (b, a)):
                        bad = {p[1] for p in pairs[key] if p[0] == x0} | {p[0] for p in pairs[key] if p[1] == x0}
                        ds = pick([s for s in scope if s not in bad and s != x0], 3, [y0])
                        x = mcq(provider, L, qtype, label, "'%s'와(과) 뜻이 %s 한자는?" % (x0, word), x0, y0, ds, [x0, y0],
                                "%s(%s) ↔ %s(%s)" % (x0, he_str(x0), y0, he_str(y0)) if key == "antonym" else
                                "%s(%s) ≈ %s(%s)" % (x0, he_str(x0), y0, he_str(y0)))
                        if x: q.append(x)
        # --- 동음이의 (음이 같은 한자)
        if "동음이의어" in types:
            by_eum = defaultdict(list)
            for s in scope:
                by_eum[dict_chars[s]["r"]].append(s)
            for c in focus:
                same = [s for s in by_eum[dict_chars[c]["r"]] if s != c]
                if not same:
                    continue
                ans = rng.choice(same)
                ds = pick([s for s in scope if dict_chars[c]["r"] not in all_eums(s)], 3, [ans])
                x = mcq(provider, L, "homophone-char", "동음이의어", "'%s'와(과) 음(소리)은 같고 뜻이 다른 한자는?" % c, c, ans, ds, [c, ans],
                        "%s(%s)와 %s(%s)는 음이 '%s'로 같습니다." % (c, he_str(c), ans, he_str(ans), dict_chars[c]["r"]))
                if x: q.append(x)
        # --- 부수
        if "부수" in types:
            rad_pool = sorted({dict_chars[s]["rad"] for s in scope if dict_chars[s].get("rad")})
            for c in focus:
                r = dict_chars[c].get("rad")
                if not r or r == c:
                    continue
                ds = pick([x for x in rad_pool if x != r], 3, [r])
                x = mcq(provider, L, "radical", "부수", "다음 한자의 부수는?", c, r, ds, [c], "%s(%s)의 부수는 %s입니다." % (c, he_str(c), r))
                if x: q.append(x)
        # --- 필순 (획순 데이터가 있는 글자만)
        if "필순" in types:
            for c in focus:
                d = dict_chars[c]
                if not d.get("so") or not d.get("sc") or d["sc"] < 3:
                    continue
                # 획순 데이터(중국 표준 기반)의 획 수가 한국 자료의 총획수와 다르면 필순 문항을 만들지 않음
                if d.get("st") and d["st"] != d["sc"]:
                    continue
                k = rng.randrange(d["sc"])
                ans = "%d번째" % (k + 1)
                nums = [n for n in range(1, d["sc"] + 1) if n != k + 1]
                if len(nums) < 3:
                    continue
                ds = ["%d번째" % n for n in rng.sample(nums, 3)]
                x = mcq(provider, L, "stroke-order", "필순", "빨간색으로 표시한 획은 몇 번째로 쓰나요?", c, ans, ds, [c],
                        "%s(%s)는 총 %d획이며, 표시한 획은 %d번째 획입니다. (획순 데이터: Make Me a Hanzi)" % (c, he_str(c), d["sc"], k + 1),
                        {"strokeIndex": k})
                if x: q.append(x)
        # --- 한자쓰기 (쓰기 범위 + 획순 데이터 있는 글자, 필기 판정)
        if "한자쓰기" in types and write_level_of:
            wchars = [c for c in scope if write_level_of.get(c) and idx[write_level_of[c]] <= Li and dict_chars[c].get("so")]
            wfocus = [c for c in wchars if write_level_of[c] == L] + pick([c for c in wchars if write_level_of[c] != L], 60, [])
            for c in wfocus:
                ex = [w for w in by_char_words.get(c, []) if w in words and all(ch in scope_set for ch in w)]
                if ex:
                    w = ex[0]
                    pos = w.index(c)
                    hint = words[w]["r"]
                    under = hint[:pos] + "[" + hint[pos] + "]" + hint[pos + 1:]
                    qtext = "한자어 '%s'에서 [ ] 안의 음에 해당하는 한자를 쓰세요. (%s)" % (under, he_str(c))
                else:
                    qtext = "'%s'에 해당하는 한자를 쓰세요." % he_str(c)
                q.append({"provider": provider, "level": L, "type": "write", "typeLabel": "한자쓰기", "question": qtext, "prompt": "",
                          "choices": [], "answer": c, "explanation": "정답: %s (%s, %s획)" % (c, he_str(c), dict_chars[c].get("sc") or dict_chars[c].get("st")),
                          "relatedHanja": [c], "sourceType": "original-practice"})
        for i, x in enumerate(q):
            x["id"] = "%s-%s-%04d" % (provider, L, i + 1)
        banks[L] = q
    return banks

eom_level_of = {x["c"]: x["level"] for x in eom_map}
allowed = {}
for lid, dist in M.EOMUNHOE_TYPE_DIST.items():
    allowed[lid] = {k for k, v in zip(M.EOMUNHOE_TYPE_KEYS, dist) if v > 0}
banks = gen_bank("eomunhoe", LEVEL_ORDER, eom_level_of, eom_write_level, allowed, LEVEL_ORDER, None)
qdir = os.path.join(DATA, "questions")
if os.path.isdir(qdir):
    shutil.rmtree(qdir)
bank_stats = {"eomunhoe": {}, "daehan": {}, "jinheung": {}, "korcham": {}}
for L, qs in banks.items():
    dump("questions/eomunhoe/%s.json" % L, {"provider": "eomunhoe", "level": L, "sourceType": "original-practice",
                                             "label": "기출유형 연습 · 실전 유사문제 (자체 제작, 실제 기출문제 아님)", "questions": qs})
    bank_stats["eomunhoe"][L] = dict(Counter(q["typeLabel"] for q in qs), total=len(qs))

dh_level_of = {nfc(c): "8" for c, _h, _e in M.DAEHAN_8}
dh_banks = gen_bank("daehan", ["8"], dh_level_of, {}, {"8": {"훈음", "독음"}}, ["8"], None)
for L, qs in dh_banks.items():
    dump("questions/daehan/%s.json" % L, {"provider": "daehan", "level": L, "sourceType": "original-practice",
                                           "label": "기본 한자 연습 (자체 제작) — 대한검정회 출제유형 공식 확인 전", "questions": qs})
    bank_stats["daehan"][L] = dict(Counter(q["typeLabel"] for q in qs), total=len(qs))

# 한자어/사자성어 기관·급수 매핑 (구성 한자 기준 산출)
def map_items(level_of, order):
    idx = {l: i for i, l in enumerate(order)}
    wmap = defaultdict(list)
    for w in wlist:
        if all(ch in level_of for ch in w["w"]):
            L = max((level_of[ch] for ch in w["w"]), key=lambda l: idx[l])
            if len(wmap[L]) < (60 if idx[L] < 5 else 150 if idx[L] < 9 else 250):
                wmap[L].append(w["w"])
    imap = defaultdict(list)
    for it in idioms:
        if all(ch in level_of for ch in it["w"]):
            L = max((level_of[ch] for ch in it["w"]), key=lambda l: idx[l])
            imap[L].append(it["id"])
    return wmap, imap

for pid, lof, order in (("eomunhoe", eom_level_of, LEVEL_ORDER), ("daehan", dh_level_of, ["8"])):
    wmap, imap = map_items(lof, order)
    dump("providers/%s/words-mapping.json" % pid, {"provider": pid, "basis": "구성 한자가 모두 해당 기관 배정한자에 포함되는 한자어 (구성 한자 중 가장 높은 급수에 배치). 공식 출제 목록 아님.",
                                                   "levels": wmap})
    dump("providers/%s/idioms-mapping.json" % pid, {"provider": pid, "basis": "구성 한자 기준 산출. 기관의 공식 사자성어 출제범위 목록이 아님.", "levels": imap})
    for L in order:
        bank_stats[pid].setdefault(L, {})
        bank_stats[pid][L]["words"] = len(wmap.get(L, []))
        bank_stats[pid][L]["idioms"] = len(imap.get(L, []))

for pid in ("jinheung", "korcham"):
    dump("providers/%s/words-mapping.json" % pid, {"provider": pid, "levels": {}, "statusNote": M.NEEDS})
    dump("providers/%s/idioms-mapping.json" % pid, {"provider": pid, "levels": {}, "statusNote": M.NEEDS})

used_words = set()
for L in list(banks.values()) + list(dh_banks.values()):
    for q in L:
        for fld in ("prompt", "answer"):
            v = q.get(fld)
            if isinstance(v, str) and v in words:
                used_words.add(v)
        for ch in q.get("choices", []):
            if ch in words:
                used_words.add(ch)
for pid in ("eomunhoe", "daehan"):
    wm = json.load(open(os.path.join(DATA, "providers/%s/words-mapping.json" % pid), encoding="utf-8"))
    for ws in wm["levels"].values():
        used_words.update(ws)
for d in dict_chars.values():
    used_words.update(d["ex"])
wout = [x for x in wlist if x["w"] in used_words]
dump("dictionary/words.json", {"meta": {"description": "한자어 목록: libhangul 한자 사전(BSD-3-Clause)의 독음 + 사용 빈도. 뜻은 구성 한자 훈음 풀이로 제공(사전식 정의 아님).",
                                        "count": len(wout)},
                               "words": [{"w": x["w"], "r": x["r"], "f": x["f"]} for x in wout]})
wlist = wout
dump("stats.json", {"builtAt": M.VERIFIED_AT, "dictionary": len(dict_chars), "strokes": sum(1 for d in dict_chars.values() if d.get("so")),
                    "words": len(wlist), "idioms": len(idioms), "pairs": {k: len(v) for k, v in pairs.items()},
                    "banks": bank_stats,
                    "providers": {"eomunhoe": len(eom_map), "daehan": len(dh_level_of), "jinheung": 0, "korcham": 0}}, compact=False)
print(json.dumps({k: v.get("total") for k, v in bank_stats["eomunhoe"].items()}, ensure_ascii=False))
print("문제 총합:", sum(v.get("total", 0) for p in bank_stats.values() for v in p.values()))
