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
EOM_CHECK = json.load(open(os.path.join(HERE, "src/eomunhoe_official_check.json"), encoding="utf-8"))
for _old, _new in EOM_CHECK["readFix"].items():
    if len(_old) != 1:
        continue
    for x in eom_map:
        if x["c"] == _old:
            x["c"] = _new
    if _old in dict_chars and _new not in dict_chars:
        e = dict_chars.pop(_old)
        e["c"] = _new; e["id"] = "U+%04X" % ord(_new)
        dict_chars[_new] = e
print("한국어문회 공식 대조 보정:", EOM_CHECK["readFix"])

# 대한검정회 공식 선정한자(8급~사범 5,000자) + 공식 훈음표
#   src/daehan_official_raw.txt : 「8급~사범 선정한자훈음표」 급수별 신출 한자 원문 순서 (SHA-256 대조 완료)
#   src/daehan_hunum/part*.txt  : 같은 공식 PDF 의 훈음 (字|훈|음)
DH_NAME2ID = {l[1]: l[0] for l in M.DAEHAN_LEVELS}
DH_OFFICIAL_LIST = []   # [(字, level id)]
for line in open(os.path.join(HERE, "src/daehan_official_raw.txt"), encoding="utf-8"):
    if line.startswith("#") or not line.strip():
        continue
    name, chars = line.rstrip("\n").split("\t")
    lid = DH_NAME2ID[name.strip()]
    chars = list(chars.strip())
    if lid == "sa" and chars[104] == "\u6c68" and chars[103] == "滾" and chars[105] == "鶻":
        # 공식 PDF 원문 오류: '골'(滾·鶻 사이) 자리에 汨(멱)이 인쇄되어 '멱' 자리의 汨 과 중복 → 汩(다스릴 골)로 바로잡음
        chars[104] = "\u6c69"
    for ch in chars:
        DH_OFFICIAL_LIST.append((ch, lid))
# NFC 정규화. 단, 공식 목록이 호환용 한자(KS X 1001 다른 음)로 따로 싣은 글자는 정규화하면 중복이 되므로 원 코드포인트 유지
#   예) 1급 輻(U+FA07, 바퀴살통 폭) ↔ 사범 輻(U+8F3B, 바퀴살 복)
_nfc_count = Counter(nfc(c) for c, _ in DH_OFFICIAL_LIST)
DH_COMPAT_KEEP = {c for c, _ in DH_OFFICIAL_LIST if nfc(c) != c and _nfc_count[nfc(c)] > 1}
DH_OFFICIAL_LIST = [(c if c in DH_COMPAT_KEEP else nfc(c), l) for c, l in DH_OFFICIAL_LIST]
print("호환용 한자 유지:", ["%s U+%04X" % (c, ord(c)) for c in DH_COMPAT_KEEP])
_dup = [c for c, n in Counter(c for c, _ in DH_OFFICIAL_LIST).items() if n > 1]
if _dup:
    raise SystemExit("대한검정회 공식 선정한자 중복: %s" % _dup)
print("대한검정회 공식 선정한자:", len(DH_OFFICIAL_LIST), Counter(l for _, l in DH_OFFICIAL_LIST))

DUEUM = {"녀": "여", "뇨": "요", "뉴": "유", "니": "이", "닉": "익", "년": "연", "념": "염", "녕": "영", "라": "나", "락": "낙", "란": "난",
         "람": "남", "랍": "납", "랑": "낭", "래": "내", "랭": "냉", "략": "약", "량": "양", "려": "여", "력": "역", "련": "연", "렬": "열",
         "렴": "염", "렵": "엽", "령": "영", "례": "예", "로": "노", "록": "녹", "론": "논", "롱": "농", "뢰": "뇌", "료": "요", "룡": "용",
         "루": "누", "류": "유", "륙": "육", "륜": "윤", "률": "율", "륭": "융", "륵": "늑", "름": "늠", "릉": "능", "리": "이", "린": "인",
         "림": "임", "립": "입"}
def eum_eq(a, b):
    return a == b or DUEUM.get(a) == b or DUEUM.get(b) == a
# PDF 텍스트 추출 과정에서 줄바꿈·괄호가 깨진 항목은 공식 훈음으로 쓰지 않고 사전 훈음으로 대체(검증 표시)
DH_HUNUM_BROKEN = set("車籠率俊遵准埈浚焌儁栱薊偈泮寯驂苞晡偲")
DH_HUNUM = {}        # 字 -> [[훈, 음], ...] (공식)
DH_HUNUM_REJECT = []
DH_HUNUM_DICT_DIFF = []
DH_HUNUM_FROM_DICT = set()
_hunum_raw = []
for fn in ("part1.txt", "part2.txt", "part3.txt"):
    for line in open(os.path.join(HERE, "src/daehan_hunum", fn), encoding="utf-8"):
        line = line.rstrip("\n")
        if line.count("|") != 2:
            continue
        c, h, e = line.split("|")
        _hunum_raw.append((nfc(c), h.strip().rstrip(",").strip(), e.strip()))
def _dict_eums(c):
    out = set()
    d = dict_chars.get(c)
    if d:
        out |= {m[1] for m in d["m"]} | {d["r"]}
    out |= {p.split()[-1] for p in lh_char.get(c, []) if p.split()}
    return out
for c, h, e in _hunum_raw:
    if c == "\u6c68" and e == "골":
        c = "\u6c69"          # 汩(다스릴 골) — 위 원문 오류와 같은 글자
    ok = (c not in DH_HUNUM_BROKEN and len(e) == 1 and "\uac00" <= e <= "\ud7a3" and h and
          h.count("(") == h.count(")") and not re.search(r"^[,)\s]|[,(\s]$", h))
    de = _dict_eums(c)
    if ok and de and not any(eum_eq(e, x) for x in de):
        DH_HUNUM_DICT_DIFF.append((c, h, e, sorted(de)))   # 형식이 정상인 공식 훈음은 사전과 달라도 공식 기준 채택(기록)
    if not ok:
        DH_HUNUM_REJECT.append((c, h, e))
        continue
    DH_HUNUM.setdefault(c, [])
    if [h, e] not in DH_HUNUM[c]:
        DH_HUNUM[c].append([h, e])
# 汨(U+6C68)은 공식 목록 '멱' 자리의 글자 — 훈음표 추출본에서는 汩(골)과 같은 글꼴로 찍혀 음이 섞였으므로 사전(libhangul) 훈음 사용
if "\u6c68" not in DH_HUNUM:
    _m = [p.rsplit(" ", 1) for p in lh_char.get("\u6c68", []) if p.endswith(" \uba71")]
    if _m:
        DH_HUNUM["\u6c68"] = [list(_m[0])]
        DH_HUNUM_FROM_DICT.add("\u6c68")
_dh_set = {c for c, _ in DH_OFFICIAL_LIST}
print("대한검정회 공식 훈음 채택:", sum(1 for c in _dh_set if c in DH_HUNUM), "/", len(_dh_set),
      "제외(깨진 항목·음 불일치):", len(DH_HUNUM_REJECT), DH_HUNUM_REJECT[:40])
print("공식 훈음 ↔ 사전 음 차이(공식 채택):", len(DH_HUNUM_DICT_DIFF), DH_HUNUM_DICT_DIFF[:30])
HUNUM_SUPP = {}
for line in open(os.path.join(HERE, "src/hunum_supplement.tsv"), encoding="utf-8"):
    if line.startswith("#") or not line.strip():
        continue
    cc, hh, ee = line.rstrip("\n").split("\t")[:3]
    HUNUM_SUPP[nfc(cc)] = [hh, ee]
# 사전에 없는 대한검정회 한자 → 공식 훈음(없으면 libhangul)으로 공통 사전에 추가
_no_hunum = []
for c, _l in DH_OFFICIAL_LIST:
    if c in dict_chars:
        continue
    if c in DH_COMPAT_KEEP:
        # 호환용 한자: 정규 글자의 공식 훈음과 다른 음의 사전 훈음(libhangul)을 사용
        base = nfc(c)
        taken = {x[1] for x in DH_HUNUM.get(base, [])}
        pcs = [p.rsplit(" ", 1) for p in lh_char.get(base, []) if " " in p]
        m = [list(x) for x in pcs if x[1] not in taken]
        if not m:
            _no_hunum.append(c); continue
        dict_chars[c] = {"c": c, "id": "U+%04X" % ord(c), "m": m, "r": m[0][1], "rad": None, "st": None, "src": "libhangul", "base": base}
        continue
    if c in DH_HUNUM:
        m = DH_HUNUM[c]; src = "daehan-official"
    elif c in HUNUM_SUPP:
        m = [HUNUM_SUPP[c]]; src = "supplement"
    elif lh_char.get(c):
        m = [list(p.rsplit(" ", 1)) if " " in p else ["", p] for p in lh_char[c][:3]]; src = "libhangul"
    else:
        _no_hunum.append(c); continue
    dict_chars[c] = {"c": c, "id": "U+%04X" % ord(c), "m": m, "r": m[0][1], "rad": None, "st": None, "src": src}
if _no_hunum:
    raise SystemExit("훈음을 찾을 수 없는 대한검정회 한자: %s" % _no_hunum)
# 대한검정회 기준 훈음(공식)을 사전 항목에 별도 필드로 보관 → 앱에서 대한검정회 선택 시 우선 표시
for c, _l in DH_OFFICIAL_LIST:
    if c in DH_HUNUM and c not in DH_COMPAT_KEEP:
        dict_chars[c]["dh"] = DH_HUNUM[c]
print("사전 크기(대한검정회 추가 후):", len(dict_chars))

# ---- 한자교육진흥회 공식 「급수별선정한자.hwp」 (scripts/src/jinheung/part*.txt, SHA-256 대조 완료)
JH_NAME2ID = {l[1]: l[0] for l in M.JINHEUNG_LEVELS}
JH_RAW = []
cur = None  # 급수 머리글은 분할 파일 사이에서 이어짐
for fn in ("part1.txt", "part2.txt", "part3.txt", "part4.txt"):
    for line in open(os.path.join(HERE, "src/jinheung", fn), encoding="utf-8"):
        line = line.rstrip("\n")
        if not line:
            continue
        if line.startswith("#"):
            cur = JH_NAME2ID[line[1:]]
            continue
        c, h, e = line.split("|")
        JH_RAW.append((c, cur, h.strip(), e.strip()))
_jn = Counter(nfc(c) for c, *_ in JH_RAW)
JH_COMPAT_KEEP = {c for c, *_ in JH_RAW if nfc(c) != c and _jn[nfc(c)] > 1}
JH_LIST = [((c if c in JH_COMPAT_KEEP else nfc(c)), l, h, e) for c, l, h, e in JH_RAW]
_jd = [c for c, n in Counter(c for c, *_ in JH_LIST).items() if n > 1]
if _jd:
    raise SystemExit("한자교육진흥회 공식 선정한자 중복: %s" % _jd)
def _first_syllable(e):
    m = re.match(r"[가-힣]", e)
    return m.group(0) if m else None
JH_HUNUM = {}
for c, l, h, e in JH_LIST:
    eum = _first_syllable(e)
    if not eum or not h:
        raise SystemExit("한자교육진흥회 훈음 누락: %s %s %s" % (c, h, e))
    JH_HUNUM[c] = [[nfc(h), eum]]
print("한자교육진흥회 공식 선정한자:", len(JH_LIST), Counter(l for _, l, *_ in JH_LIST), "호환용 한자 유지:", sorted(JH_COMPAT_KEEP))
# 교과서 한자어(8급~3급) · 직업분야별 실용한자어(2급·1급) 공식 목록
JH_WORDS = defaultdict(list)
cur = None; cat = None
for fn in ("words1.txt", "words2.txt"):
    for line in open(os.path.join(HERE, "src/jinheung", fn), encoding="utf-8"):
        line = line.rstrip("\n")
        if not line:
            continue
        if line.startswith("#"):
            cur = JH_NAME2ID[line[1:]]; cat = None
            continue
        if line.startswith("@"):
            cat = line[1:]
            continue
        w, r = line.split("|")
        JH_WORDS[cur].append({"w": nfc(w), "r": r, "cat": cat})
print("한자교육진흥회 공식 한자어:", {k: len(v) for k, v in JH_WORDS.items()})

# ---- 대한상공회의소 공식 「배정한자 (1~9급).zip」 (scripts/src/korcham_official.txt, SHA-256 대조 완료)
KC_LIST = []
for line in open(os.path.join(HERE, "src/korcham_official.txt"), encoding="utf-8"):
    line = line.rstrip("\n")
    if not line:
        continue
    lid, chars = line.split("\t")
    for c in chars:
        KC_LIST.append((nfc(c), lid))
_kd = [c for c, n in Counter(c for c, _ in KC_LIST).items() if n > 1]
if _kd:
    raise SystemExit("대한상공회의소 배정한자 중복: %s" % _kd)
for lid, n in M.KORCHAM_NEW.items():
    got = sum(1 for _, l in KC_LIST if l == lid)
    if got != n:
        raise SystemExit("대한상공회의소 %s급 %d자 ≠ 공식 %d자" % (lid, got, n))
print("대한상공회의소 공식 배정한자:", len(KC_LIST), Counter(l for _, l in KC_LIST))

# 사전에 없는 글자 추가 (진흥회: 공식 훈음, 상공회의소: libhangul → 없으면 보충표)
_added = Counter(); _kc_nohunum = []
for c, l, h, e in (JH_LIST if M.PHASE2 else []):
    if c in dict_chars:
        continue
    if c in JH_COMPAT_KEEP:
        base = nfc(c)
        dict_chars[c] = {"c": c, "id": "U+%04X" % ord(c), "m": JH_HUNUM[c], "r": JH_HUNUM[c][0][1], "rad": None, "st": None, "src": "jinheung-official", "base": base}
    else:
        dict_chars[c] = {"c": c, "id": "U+%04X" % ord(c), "m": JH_HUNUM[c], "r": JH_HUNUM[c][0][1], "rad": None, "st": None, "src": "jinheung-official"}
    _added["jinheung"] += 1
for c, l, h, e in (JH_LIST if M.PHASE2 else []):
    dict_chars[c]["jh"] = JH_HUNUM[c]
SCOURT = {}
def _scourt_pairs(eums, info):
    pairs = []
    for h, e in re.findall(r"([가-힣]+)\(([가-힣/]+)\)", info):
        e = e.split("/")[0]
        if [h, e] not in pairs:
            pairs.append([h, e])
    return pairs or [["", eums.split(",")[0]]]
for fn, src in (("korcham_hunum_scourt.txt", "scourt-inmyung"), ("korcham_hunum_scourt_ext.txt", "scourt-ext")):
    for line in open(os.path.join(HERE, "src", fn), encoding="utf-8"):
        if line.startswith("#") or not line.strip():
            continue
        parts = line.rstrip("\n").split("|")
        c, eums, info = nfc(parts[0]), parts[1], nfc(parts[2])
        SCOURT[c] = (_scourt_pairs(eums, info), src)
for c, l in (KC_LIST if M.PHASE2 else []):
    if c in dict_chars:
        continue
    if c in SCOURT:
        m, src = SCOURT[c]
        dict_chars[c] = {"c": c, "id": "U+%04X" % ord(c), "m": m, "r": m[0][1], "rad": None, "st": None, "src": src}
        if not m[0][0]:
            dict_chars[c]["hunMissing"] = True
        _added["korcham"] += 1
        continue
    if c in HUNUM_SUPP:
        m = [HUNUM_SUPP[c]]; src = "supplement"
    elif lh_char.get(c):
        m = [list(p.rsplit(" ", 1)) if " " in p else ["", p] for p in lh_char[c][:3]]; src = "libhangul"
        m = [x for x in m if x[0]] or m
    else:
        # 공식·공공 자료 어디에도 훈음이 없는 글자: 사전에는 올리되 훈음 없음 표시 (문항 생성 제외)
        _kc_nohunum.append(c)
        dict_chars[c] = {"c": c, "id": "U+%04X" % ord(c), "m": [], "r": "", "rad": None, "st": None, "src": "korcham-official", "noHunum": True}
        continue
    dict_chars[c] = {"c": c, "id": "U+%04X" % ord(c), "m": m, "r": m[0][1], "rad": None, "st": None, "src": src}
    _added["korcham"] += 1
print("사전 추가:", dict(_added), "상공회의소 훈음 미확보:", len(_kc_nohunum), "".join(_kc_nohunum))

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
    fn = hw_have.get(c) or hw_have.get(d.get("base", c))
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

HE_PREF = [None]   # 문제 생성 시 기관별 훈음 우선순위 (대한검정회: 공식 훈음 dh)
def he_list(d):
    if HE_PREF[0] == "jinheung" and d.get("jh"):
        return d["jh"]
    if HE_PREF[0] == "daehan" and d.get("dh"):
        return d["dh"]
    return d["m"]

def has_hunum(c):
    ml = he_list(dict_chars[c])
    return bool(ml and ml[0][0] and ml[0][1])

def gloss(w):
    parts = []
    for ch in w:
        d = dict_chars[ch]
        ml = he_list(d)
        he = ml[0] if ml else ["", d["r"]]
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
ENABLED = M.ENABLED
dump("providers/index.json", {"providers": [x for x in M.PROVIDERS if x["id"] in ENABLED], "verifiedAt": M.VERIFIED_AT}, compact=False)

# --- 한국어문회
eom_levels = []
cum = 0
new_counts = Counter(x["level"] for x in eom_map)
cum_by_level = {}
for (lid, name, cat, rd, wr, q, ps, tm) in M.EOMUNHOE_LEVELS:
    cum += new_counts[lid]
    cum_by_level[lid] = cum
import hashlib
def _set_hash(st):
    return hashlib.sha256("".join(sorted(st, key=ord)).encode("utf-8")).hexdigest()[:16]
eom_level_of_tmp = {x["c"]: x["level"] for x in eom_map}
def eom_cum(L):
    return {c for c, l in eom_level_of_tmp.items() if LEVEL_IDX[l] <= LEVEL_IDX[L]}
EOM_WRITE_1 = [nfc(c) for c in open(os.path.join(HERE, "src/eomunhoe_write1.txt"), encoding="utf-8").read().strip()]
eom_write_sets = {}
for i, (lid, name, cat, rd, wr, q, ps, tm) in enumerate(M.EOMUNHOE_LEVELS):
    if not wr:
        continue
    if lid == "1":
        ws = set(EOM_WRITE_1)
    else:
        # 공식: 쓰기 배정 = 하위 급수 읽기 배정 누적 (배정 수 일치)
        base = [lj for lj in LEVEL_ORDER[:i] if cum_by_level[lj] == wr]
        if not base:
            raise SystemExit("한국어문회 %s 쓰기 %d자에 해당하는 하위 급수 없음" % (name, wr))
        ws = eom_cum(base[-1])
    ex = EOM_CHECK.get("writeExceptions", {}).get(lid)
    if ex:
        ws = (ws - set(ex["remove"])) | set(ex["add"])
    if len(ws) != wr:
        raise SystemExit("한국어문회 %s 쓰기 %d자 ≠ 공식 %d자" % (name, len(ws), wr))
    exp = EOM_CHECK["write"].get(lid, "")
    if re.fullmatch(r"[0-9a-f]{16}", exp) and _set_hash(ws) != exp:
        raise SystemExit("한국어문회 %s 쓰기 배정한자가 공식 HWP와 다름 (%s ≠ %s)" % (name, _set_hash(ws), exp))
    eom_write_sets[lid] = ws
for lid, exp in EOM_CHECK["read"].items():
    if _set_hash(eom_cum(lid)) != exp:
        raise SystemExit("한국어문회 %s 읽기 배정한자가 공식 HWP와 다름" % lid)
_prev = set()
for lid in LEVEL_ORDER:
    if lid in eom_write_sets:
        if not _prev <= eom_write_sets[lid]:
            raise SystemExit("한국어문회 쓰기 배정 누적 구조 위반: %s" % lid)
        _prev = eom_write_sets[lid]
print("한국어문회 쓰기 배정 공식 대조 통과:", {k: len(v) for k, v in eom_write_sets.items()})
for i, (lid, name, cat, rd, wr, q, ps, tm) in enumerate(M.EOMUNHOE_LEVELS):
    note = []
    data_count = cum_by_level[lid]
    glyph = rd
    if lid == "s2":
        glyph = 4650  # 공식 원문: 4,918자 중 다음자 중복 등록 268자를 빼면 자형 기준 4,650자
        note.append("공식 표기 4,918자는 전산용 한자의 다음자(多音字) 중복 등록 268자를 포함한 수 — 자형 기준 4,650자 (공식 배정한자특급Ⅱ.hwp 원문 주석). 앱 데이터 4,650자 = 공식 목록과 일치.")
    if data_count != glyph:
        raise SystemExit("한국어문회 %s 읽기 %d자 ≠ 공식 %d자" % (name, data_count, glyph))
    if lid == "1":
        note.append("쓰기 2,005자 = 2급 배정한자 2,355자 중 성명·지명용 350자를 제외한 공식 목록(배정한자1급.hwp).")
    if lid == "5-2":
        note.append("쓰기 225자: 공식 목록은 6급Ⅱ 읽기 225자 중 急 대신 級을 포함(배정한자5급II.hwp).")
    dist = M.EOMUNHOE_TYPE_DIST[lid]
    assert sum(dist) == q, (lid, sum(dist), q)
    eom_levels.append({
        "id": lid, "name": name, "order": i, "category": cat,
        "readCount": rd, "readCountGlyph": glyph, "writeCount": wr, "newCount": new_counts[lid], "dataCount": data_count,
        "writeDataCount": len(eom_write_sets.get(lid, ())), "hasData": True,
        "exam": {"questionCount": q, "passCount": ps, "timeMin": tm, "passRule": "%d문항 중 %d문항 이상(%d%%)" % (q, ps, round(ps * 100 / q)),
                 "mockSupported": True},
        "notes": note,
        "status": {"levels": "official", "hanja": "official", "examFormat": "secondary"},
    })
dump("providers/eomunhoe/levels.json", {"provider": "eomunhoe", "levels": eom_levels,
                                         "writeRule": "공식 급수별 배정한자 HWP의 쓰기 배정한자 목록과 전수 대조(1급 2,005자·5급Ⅱ 예외 포함).",
                                         "verification": {"source": "https://www.hanja.re.kr/kccpt/exam/levelConfirm.do", "verifiedAt": M.VERIFIED_AT, "readFix": "煕→熙"},
                                         "sourceRefs": [s["sourceUrl"] for s in M.SOURCES["eomunhoe"]]}, compact=False)
eom_write_level = {}
for x in eom_map:
    # 이 글자가 쓰기 범위에 처음 들어가는 급수 (공식 쓰기 배정 기준)
    eom_write_level[x["c"]] = next((lid for lid in LEVEL_ORDER if x["c"] in eom_write_sets.get(lid, ())), None)
dump("providers/eomunhoe/hanja-mapping.json", {"provider": "eomunhoe", "status": "official",
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
DH_ORDER = [l[0] for l in M.DAEHAN_LEVELS]
DH_NAME = {l[0]: l[1] for l in M.DAEHAN_LEVELS}
DH_EXPECT = {l[0]: l[3] for l in M.DAEHAN_LEVELS}
# 공식 선정한자 (daehan_official_raw.txt, 위에서 적재·검증)
dh_official = {c: l for c, l in DH_OFFICIAL_LIST}
dh_level_of = dict(dh_official)
dh_src = {c: "official" for c in dh_official}
# 누적 개수 검증 → 공식 수와 일치하는 급수만 학습 가능(hasData)
dh_levels = []
cum = 0
dh_valid_upto = True
for i, (lid, name, cat, cnt, q, tm, ps, struct) in enumerate(M.DAEHAN_LEVELS):
    new_n = sum(1 for l in dh_level_of.values() if l == lid)
    cum += new_n
    ok = bool(new_n) and cnt is not None and cum == cnt and dh_valid_upto
    is_dsa = lid == "dsa"
    if new_n and cnt is not None and cum != cnt:
        raise SystemExit("대한검정회 %s 누적 %d자 ≠ 공식 %d자 — 입력 데이터 확인 필요" % (name, cum, cnt))
    if not ok and not is_dsa:
        dh_valid_upto = False
    srcs = {dh_src[c] for c, l in dh_level_of.items() if l == lid}
    status_h = ("official" if srcs == {"official"} else "secondary") if ok else "missing"
    on = M.DAEHAN_ONLINE.get(lid)
    notes = []
    if ok and status_h == "secondary":
        notes.append("%s 선정한자: 2차 자료(나무위키 전사본) 기준 — 공식 선정한자표와 대조 필요." % name)
    if not ok and not is_dsa:
        notes.append("선정한자 목록 " + M.NEEDS + " (공식 자료실 원문 미확보)")
    if is_dsa:
        dh_levels.append({"id": lid, "name": name, "order": i, "category": cat, "readCount": None, "writeCount": None,
                          "newCount": 0, "dataCount": cum, "hasData": dh_valid_upto, "scopeFrom": "sa",
                          "subjects": ["대학·논어·맹자·중용", "고문진보·사략", "고급한문Ⅱ(선정단원)", "기타"],
                          "exam": {"examMode": "offline", "questionCount": q, "timeMin": tm, "passCount": ps,
                                   "passRule": "%d문항 중 %d문항 이상 (1문항당 1점, 70점 이상)" % (q, ps), "structure": struct,
                                   "format": "필기시험 · 국역 및 논술", "mockSupported": False,
                                   "mockBlockedReason": "대사범은 경전·고문 지문을 국역·논술하는 서술형 시험이라 자동 채점 모의시험을 제공하지 않아요. 공식 기출문제로 대비하세요"},
                          "examOnline": None,
                          "notes": ["대사범은 별도 선정한자 목록이 없어요(공식). 한문지식 기반인 사범 선정한자 5,000자를 학습 범위로 제공하고, 경전·고문 지문은 공식 기출문제로 대비하세요.",
                                    "검정과목(공식): 대학·논어·맹자·중용 / 고문진보·사략 / 고급한문Ⅱ(선정단원) / 기타 — 10개 지문 100문항, 60분, 국역 및 논술."],
                          "status": {"levels": "official", "hanja": "official", "examFormat": "official"}})
        continue
    dh_levels.append({"id": lid, "name": name, "order": i, "category": cat, "readCount": cnt, "writeCount": None,
                      "newCount": new_n if ok else None, "dataCount": cum if ok else 0, "hasData": ok,
                      "exam": {"examMode": "offline", "questionCount": q, "timeMin": tm, "passCount": ps,
                               "passRule": "%d문항 중 %d문항 이상 (70점 이상)" % (q, ps), "structure": struct, "mockSupported": ok,
                               "mockBlockedReason": None if ok else "선정한자 데이터 없음"},
                      "examOnline": ({"examMode": "online", "questionCount": on[0], "timeMin": on[1], "passCount": on[2],
                                      "passRule": "%d문항 중 %d문항 이상 (70점 이상)" % (on[0], on[2]), "structure": "객관식 %d" % on[0]} if on else None),
                      "notes": notes,
                      "status": {"levels": "official", "hanja": status_h, "examFormat": "official"}})
dump("providers/daehan/levels.json", {"provider": "daehan", "levels": dh_levels,
      "examModes": {"offline": "현장시험 (공식 시험안내 https://www.hanja.ne.kr/apply/info01.asp)",
                    "online": "자기주도형 온라인 시험 — 8급~3급만, 객관식 (https://www.hanja.ne.kr/info/info01_online.asp)"},
      "cumulative": "상위 급수 선정한자는 하위 급수 선정한자를 모두 포함하는 누적 구조 (공식)",
      "sourceRefs": [s["sourceUrl"] for s in M.SOURCES["daehan"]]}, compact=False)
dh_items = [{"c": c, "l": l, "w": None, "src": dh_src[c]} for c, l in sorted(dh_level_of.items(), key=lambda x: (DH_ORDER.index(x[1]), x[0]))]
dump("providers/daehan/hanja-mapping.json", {"provider": "daehan",
      "status": "official" if dh_official else "secondary",
      "statusNote": "대한검정회 공식 「8급~사범 선정한자훈음표」(hanja.ne.kr 자료실) 기준 5,000자. 사범 104번째 글자는 원문 인쇄 오류(汨 중복)를 汩(다스릴 골)로 바로잡음.",
      "source": {"sourceName": "대한검정회 8급~사범 선정한자훈음표", "sourceUrl": "https://www.hanja.ne.kr/board/board/view.asp?tb=inno_12&num=15", "verifiedAt": M.VERIFIED_AT},
      "items": dh_items})
def dh_dist(n):
    # 공식 총 문항 수(n)에 맞춘 앱 구성 비율 — 영역별 공식 배분표는 공개되지 않아 앱 구성으로 표시
    if n <= 25:
        return {"훈음": 13, "독음": 12}
    w = {"훈음": 30, "독음": 30, "완성형": 12, "반의어": 5, "동의어": 5, "뜻풀이": 8, "동음이의어": 4, "부수": 3, "획수": 3}
    out = {k: n * v // 100 for k, v in w.items()}
    out["훈음"] += n - sum(out.values())
    return out
dump("providers/daehan/exam-types.json", {"provider": "daehan", "status": "app-composition",
      "statusNote": "공식 기준: 급수별 총 문항 수·시간·합격 기준(시험안내). 영역별 세부 배분은 공식 공개 자료가 없어 앱 구성(훈음·독음 중심 + 완성형·반의어·동의어·뜻풀이·동음이의어·부수·획수)으로 공식 문항 수에 맞춤.",
      "levels": {l[0]: dh_dist(l[4]) for l in M.DAEHAN_LEVELS}}, compact=False)

# --- 한자교육진흥회 (공식 급수별선정한자.hwp + 교과서/실용 한자어)
JH_ORDER = [l[0] for l in M.JINHEUNG_LEVELS]
jh_level_of = {c: l for c, l, _h, _e in JH_LIST} if M.PHASE2 else {}
jh_levels = []
_cum = 0
for i, (lid, name, cat, cnt, tm, q, subj, wr, obj, pt, full, pr) in enumerate(M.JINHEUNG_LEVELS):
    new_n = sum(1 for l in jh_level_of.values() if l == lid)
    _cum += new_n
    sel = M.JINHEUNG_SELECTED[lid]
    ok = bool(jh_level_of)
    notes = []
    if lid in M.JINHEUNG_NOTES:
        notes.append(M.JINHEUNG_NOTES[lid])
    if ok and _cum != sel:
        notes.append("공식 파일(급수별선정한자.hwp) 누적 %d자 · 급수표 표기 %d자 — 공식 파일의 준5급 신출이 81자(표기 80자)여서 1자 차이. 원문 그대로 반영." % (_cum, sel))
    if lid in ("1", "2"):
        notes.append("직업분야별 실용한자어 500단어는 선정한자 수에 포함(공식).")
    if lid == "sa":
        notes.append("사범: 사서삼경·명심보감·고문진보·한시에서 널리 통용되는 문장이 출제(공식).")
    words_off = len(JH_WORDS.get(lid, []))
    jh_levels.append({"id": lid, "name": name, "order": i, "category": cat, "readCount": cnt, "selectedCount": sel,
                      "officialFileCount": _cum if ok else None, "wordsLabel": M.JINHEUNG_WORDS_LABEL[lid], "wordsOfficial": words_off,
                      "writeCount": None, "newCount": new_n if ok else None, "dataCount": _cum if ok else 0, "hasData": ok,
                      "exam": {"questionCount": q, "subjective": subj, "writing": wr, "objective": obj, "pointEach": pt, "fullScore": full,
                               "timeMin": tm, "passCount": -(-q * int(pr * 100) // 100), "passRule": "만점(%d점)의 %d%% 이상" % (full, round(pr * 100)), "passRatio": pr,
                               "mockSupported": ok, "mockBlockedReason": None if ok else "배정한자 데이터 없음"},
                      "notes": notes, "status": {"levels": "official", "hanja": "official" if ok else "missing", "examFormat": "official"}})
dump("providers/jinheung/levels.json", {"provider": "jinheung", "levels": jh_levels, "testTime": "매회 전 급수(사범~8급) 오후 3시",
      "countRule": "평가한자(readCount) = 선정한자(selectedCount) + 교과서 한자어에 새로 나오는 한자 수(3급 이하) / 1·2급은 실용한자어 500단어가 선정한자 수에 포함 (공식 examGrade.do)",
      "writeRule": "한자쓰기 문항 범위는 공식 별도 목록이 없어 해당 급수 누적 선정한자로 연습(앱 구성).",
      "sourceRefs": [s["sourceUrl"] for s in M.SOURCES["jinheung"]]}, compact=False)
dump("providers/jinheung/hanja-mapping.json", {"provider": "jinheung", "status": "official" if jh_level_of else "missing",
      "statusNote": "한자교육진흥회 공식 「급수별선정한자.hwp」(web.hanja114.org 평가한자 다운로드) 원문 기준 5,001행. 훈음은 공식 파일 기준.",
      "source": {"sourceName": "한자교육진흥회 급수별 선정한자(HWP)", "sourceUrl": "https://web.hanja114.org/common/intro/examGrade.do", "verifiedAt": M.VERIFIED_AT},
      "items": [{"c": c, "l": l, "w": l, "src": "official"} for c, l in sorted(jh_level_of.items(), key=lambda x: (JH_ORDER.index(x[1]), x[0]))]})
def _pct_dist(q, parts):
    # parts: [(key, pct)] → 합이 q가 되도록 반올림 보정
    tot = sum(v for _, v in parts) or 1
    raw = [(k, q * v / tot) for k, v in parts if v]
    out = {k: int(v) for k, v in raw}
    rest = q - sum(out.values())
    for k, v in sorted(raw, key=lambda kv: -(kv[1] - int(kv[1])))[:rest]:
        out[k] += 1
    return out
_JH_GROUP = {"sa": "사범", "1": "1급", "2": "2급~준5급", "3": "2급~준5급", "3-j": "2급~준5급", "4": "2급~준5급", "4-j": "2급~준5급",
             "5": "2급~준5급", "5-j": "2급~준5급", "6": "6급", "7": "7급·8급", "8": "7급·8급"}
JH_AREAS = ["선정한자·훈음", "선정한자·독음", "선정한자·쓰기", "선정한자·기타", "한자어·독음", "한자어·용어뜻", "한자어·쓰기", "한자어·기타"]
JH_POOLS = {"선정한자·훈음": ["hunum", "hunum-rev"], "선정한자·독음": ["reading-char"], "선정한자·쓰기": ["write"],
            "선정한자·기타": ["radical", "antonym", "synonym", "homophone-char", "stroke-count"],
            "한자어·독음": ["word-reading"], "한자어·용어뜻": ["word-gloss", "idiom-meaning"], "한자어·쓰기": ["word-from-reading"],
            "한자어·기타": ["word-blank", "idiom-blank"]}
jh_dist = {}
for lid, name, cat, cnt, tm, q, subj, wr, obj, pt, full, pr in M.JINHEUNG_LEVELS:
    g = M.JINHEUNG_TYPE_RATIO[_JH_GROUP[lid]]
    pcts = g["선정한자"] + g.get("한자어", [0, 0, 0, 0])
    jh_dist[lid] = _pct_dist(q, list(zip(JH_AREAS, pcts)))
dump("providers/jinheung/exam-types.json", {"provider": "jinheung", "status": "official-ratio",
      "statusNote": "공식 시험요강 '출제유형 비율'(%)을 공식 문항 수에 맞춰 환산. 한자어 쓰기는 앱에서 '독음에 맞는 한자어 고르기'로 연습.",
      "ratio": M.JINHEUNG_TYPE_RATIO, "levels": jh_dist, "pools": JH_POOLS}, compact=False)

# --- 대한상공회의소 (공식 배정한자 (1~9급).zip)
KC_ORDER = [l[0] for l in M.KORCHAM_LEVELS]
kc_level_of = {c: l for c, l in KC_LIST} if M.PHASE2 else {}
kc_levels = []
_cum = 0
for i, (lid, name, cat, tm, (a, b, c3), rule) in enumerate(M.KORCHAM_LEVELS):
    full = a * 4 + b * 6 + c3 * 8
    new_n = sum(1 for l in kc_level_of.values() if l == lid)
    _cum += new_n
    ok = bool(kc_level_of)
    tr, smin = M.KORCHAM_PASS[lid]
    no_h = [c for c, l in kc_level_of.items() if l == lid and not has_hunum(c)]
    notes = []
    if lid == "1":
        notes.append("공식: 1급 응시자는 1~9급 누적 4,908자 학습 필요(1급 신규 배정 1,607자).")
    if lid in ("1", "2"):
        notes.append("1·2급 배정한자 = KS X 1001 한자 2,824자 + 대법원 인명용 한자 284자(공식 표 머리글).")
    if no_h:
        notes.append("공식 배정한자 파일에는 훈음이 없어 공통 사전·대법원 인명용 한자 조회 기준으로 표시. 뜻(훈)이 공식·공공 자료에 없는 %d자는 음만 표시하고 훈음 문항에서 제외: %s" % (len(no_h), "".join(no_h)))
    kc_levels.append({"id": lid, "name": name, "order": i, "category": cat, "readCount": _cum if ok else None, "newCount": new_n if ok else None,
                      "writeCount": 0, "dataCount": _cum if ok else 0, "hasData": ok,
                      "exam": {"questionCount": a + b + c3, "sections": {"한자": a, "어휘": b, "독해": c3}, "points": {"한자": 4, "어휘": 6, "독해": 8},
                               "fullScore": full, "timeMin": tm, "passRule": rule, "passTotalRatio": tr, "passSectionMin": smin,
                               "passCount": None, "format": "CBT 객관식", "mockSupported": ok, "mockBlockedReason": None if ok else "배정한자 데이터 없음"},
                      "notes": notes, "status": {"levels": "official", "hanja": "official" if ok else "missing", "examFormat": "official"}})
dump("providers/korcham/levels.json", {"provider": "korcham", "levels": kc_levels,
      "note": "상공회의소 한자는 읽기·이해 중심의 객관식 시험(쓰기 문항 없음). 쓰기 연습은 학습용으로만 제공.",
      "sourceRefs": [s["sourceUrl"] for s in M.SOURCES["korcham"]]}, compact=False)
dump("providers/korcham/hanja-mapping.json", {"provider": "korcham", "status": "official" if kc_level_of else "missing",
      "statusNote": "대한상공회의소 공식 「배정한자 (1~9급).zip」(배정한자(5~9급).hwp, 배정한자(1~4급).hwp) 원문 기준 4,908자. 공식 파일에 훈음 없음 → 훈음은 공통 사전·대법원 인명용 한자 조회.",
      "source": {"sourceName": "상공회의소 한자 급수별(1~9급) 배정한자", "sourceUrl": "https://license.korcham.net/co/examguide02Sub.do?cd=0401&mm=53&num=2948011", "verifiedAt": M.VERIFIED_AT},
      "items": [{"c": c, "l": l, "w": None, "src": "official"} for c, l in sorted(kc_level_of.items(), key=lambda x: (KC_ORDER.index(x[1]), x[0]))]})
KC_POOLS = {"한자": ["hunum", "hunum-rev", "reading-char", "radical", "antonym", "synonym", "homophone-char", "stroke-count"],
            "어휘": ["word-reading", "word-from-reading", "word-gloss", "word-blank"],
            "독해": ["sentence-reading", "idiom-meaning", "idiom-blank", "word-gloss"]}
dump("providers/korcham/exam-types.json", {"provider": "korcham", "status": "official", "sections": ["한자", "어휘", "독해"],
      "format": "CBT 객관식", "statusNote": "영역별 문항 수·배점은 공식 시험안내 기준. 영역 안 세부 유형은 앱 구성.",
      "levels": {l[0]: {"한자": l[4][0], "어휘": l[4][1], "독해": l[4][2]} for l in M.KORCHAM_LEVELS}, "pools": KC_POOLS}, compact=False)

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
dump("schedules/index.json", {"years": {"2026": [x for x in ["eomunhoe", "daehan", "jinheung", "korcham"] if x in ENABLED]},
      "note": "연도별 일정은 schedules/{provider}-{year}.json 파일만 추가·수정하면 앱에 반영됩니다."}, compact=False)

# ------------------------------------------------------------------ 9. 문제은행 (한국어문회 · 대한검정회 8급)
rng = random.Random(20260928)

_he_cache = {}
def he_str(c):
    k = (HE_PREF[0], c)
    if k in _he_cache:
        return _he_cache[k]
    _he_cache[k] = v = _he_str(c)
    return v

def _he_str(c):
    d = dict_chars[c]
    ml = he_list(d)
    if not ml:
        return d["r"]
    return "%s %s" % (ml[0][0], ml[0][1])

_eum_cache = {}
def all_eums(c):
    v = _eum_cache.get(c)
    if v is None:
        d = dict_chars[c]
        v = _eum_cache[c] = {m[1] for m in d["m"]} | {m[1] for m in d.get("dh", [])} | {m[1] for m in d.get("jh", [])} | {d["r"]}
    return v

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

def gen_bank(provider, level_ids, level_of, write_level_of, allowed, level_order, level_names, word_list=None):
    """level_of: 字->level id (읽기), write_level_of: 字->쓰기 시작 level id, word_list: 기관 공식 한자어 [{w,r}] (없으면 공통 목록)"""
    idx = {l: i for i, l in enumerate(level_order)}
    WL = word_list if word_list is not None else wlist
    banks = {}
    for L in level_ids:
        Li = idx[L]
        scope = [c for c, l in level_of.items() if idx[l] <= Li and has_hunum(c)]
        new = [c for c, l in level_of.items() if l == L and has_hunum(c)]
        scope_set = set(scope)
        # 하위 급수 글자 일부도 복습 문항으로 포함
        review = [c for c in scope if level_of[c] != L]
        rng.shuffle(review)
        review = review[: max(10, len(new) // 3)] if new else review[:600]
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
        wscope = [w for w in WL if all(ch in scope_set for ch in w["w"])]
        wnew = [w for w in wscope if any(level_of[ch] == L for ch in w["w"])]
        wnew = wnew[: (60 if Li < 5 else 150 if Li < 9 else 250)]
        if len(wnew) < 120:
            # 신출 한자가 들어간 한자어가 적은 급수(특급 등): 범위 내 빈출 한자어로 보충(복습)
            extra_w = [w for w in wscope if w not in wnew][: 120 - len(wnew)]
            wnew = wnew + extra_w
        if "한자독음" in types:
            eum_pool = sorted({dict_chars[s]["r"] for s in scope})
            for c in focus:
                ans = he_list(dict_chars[c])[0][1]
                ds = pick([e for e in eum_pool if e not in all_eums(c)], 3, [ans])
                x = mcq(provider, L, "reading-char", "독음", "다음 한자의 음(소리)은?", c, ans, ds, [c], "%s의 음은 '%s'입니다 (%s)." % (c, ans, he_str(c)))
                if x: q.append(x)
        if "독음" in types:
            if len(wnew) < 10 and "한자독음" not in types:
                # 한자어가 적은 저급수: 한 글자 독음 문항으로 보충
                eum_pool = sorted({dict_chars[s]["r"] for s in scope})
                for c in focus:
                    ans = dict_chars[c]["r"]
                    ds = pick([e for e in eum_pool if e not in all_eums(c)], 3, [ans])
                    x = mcq(provider, L, "reading-char", "독음", "다음 한자의 음(소리)은?", c, ans, ds, [c], "%s의 음은 '%s'입니다 (%s)." % (c, ans, he_str(c)))
                    if x: q.append(x)
            rd_pool = [w["r"] for w in wscope]
            wpat = defaultdict(list)
            wbylen = defaultdict(list)
            for v in wscope:
                wbylen[len(v["w"])].append(v)
                for k in range(len(v["w"])):
                    wpat[v["w"][:k] + "?" + v["w"][k + 1:]].append(v)
            rd_bylen = defaultdict(list)
            for r in rd_pool:
                rd_bylen[len(r)].append(r)
            for w in wnew:
                ans = w["r"]
                ds = pick(rd_bylen.get(len(ans), []), 3, [ans])
                x = mcq(provider, L, "word-reading", "독음", "다음 한자어의 독음(읽는 소리)은?", w["w"], ans, ds, list(w["w"]),
                        "%s은(는) '%s'(으)로 읽습니다. 글자 풀이: %s" % (w["w"], ans, gloss(w["w"])))
                if x: q.append(x)
                # 음 → 한자어
                # 한 글자만 다른 한자어 우선 (패턴 색인으로 탐색)
                near = []
                for k in range(len(w["w"])):
                    for v in wpat.get(w["w"][:k] + "?" + w["w"][k + 1:], ()):
                        if v["w"] != w["w"] and v["r"] != ans and v["w"] not in near:
                            near.append(v["w"])
                if len(near) >= 3:
                    ds2 = pick(near, 3, [w["w"]])
                else:
                    pool = wbylen.get(len(w["w"]), [])
                    cands = [v["w"] for v in (rng.sample(pool, min(len(pool), 200)) if len(pool) > 200 else pool) if v["w"] != w["w"] and v["r"] != ans]
                    ds2 = pick(cands, 3, [w["w"]])
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
                pool = [v for v in wscope if len(v["w"]) == len(w["w"])] if len(wscope) < 400 else [v for v in rng.sample(wscope, 400) if len(v["w"]) == len(w["w"])]
                others = [gloss(v["w"]) for v in pool if v["w"] != w["w"]]
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
        # --- 획수 (한국 자료 총획수가 있는 글자만)
        if "획수" in types:
            for c in focus:
                st = dict_chars[c].get("st")
                if not st:
                    continue
                cands = [n for n in (st - 2, st - 1, st + 1, st + 2) if n > 0]
                if len(cands) < 3:
                    continue
                ds = ["%d획" % n for n in rng.sample(cands, 3)]
                x = mcq(provider, L, "stroke-count", "획수", "다음 한자의 총 획수는?", c, "%d획" % st, ds, [c],
                        "%s(%s)는 총 %d획입니다 (부수 %s)." % (c, he_str(c), st, dict_chars[c].get("rad") or "-"))
                if x: q.append(x)
        # --- 문장 속 한자 (사자성어 사용 예문 속 성어의 독음)
        if "문장" in types:
            for it in idioms:
                if all(ch in scope_set for ch in it["w"]) and it["w"] in it["ex"]:
                    others = [o["r"] for o in idioms if o["id"] != it["id"]]
                    ds = pick(others, 3, [it["r"]])
                    sent = it["ex"].replace(it["w"], "［" + it["w"] + "］", 1)
                    x = mcq(provider, L, "sentence-reading", "문장 속 한자", "다음 문장에서 ［ ］ 안 한자어의 독음은?", "", it["r"], ds, list(it["w"]),
                            "%s(%s): %s" % (it["w"], it["r"], it["mean"]), {"idiom": it["id"], "sentence": sent})
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
def _dump_eom():
  for L, qs in banks.items():
    dump("questions/eomunhoe/%s.json" % L, {"provider": "eomunhoe", "level": L, "sourceType": "original-practice",
                                             "label": "기출유형 연습문제 · 예상문제 (자체 제작, 실제 기출문제 아님)", "questions": qs})
    bank_stats["eomunhoe"][L] = dict(Counter(q["typeLabel"] for q in qs), total=len(qs))

DH_TYPES = {"훈음", "독음", "완성형", "뜻풀이", "반의어", "동의어", "동음이의어", "부수", "획수", "문장"}
dh_data_levels = [L["id"] for L in dh_levels if L["hasData"]]
HE_PREF[0] = "daehan"
dh_banks = gen_bank("daehan", dh_data_levels, dh_level_of, {}, {l: DH_TYPES for l in dh_data_levels}, DH_ORDER, None)
HE_PREF[0] = None
def _dump_dh():
  for L, qs in dh_banks.items():
    dump("questions/daehan/%s.json" % L, {"provider": "daehan", "level": L, "sourceType": "original-practice",
                                           "label": "기출유형 연습문제 · 예상문제 (자체 제작, 실제 기출문제 아님) — 대한검정회 선정한자 범위", "questions": qs})
    bank_stats["daehan"][L] = dict(Counter(q["typeLabel"] for q in qs), total=len(qs))

JH_TYPES_BY_LEVEL = {}
for lid, name, cat, cnt, tm, q, subj, wr, obj, pt, full, pr in M.JINHEUNG_LEVELS:
    t = {"훈음", "한자독음", "독음", "뜻풀이", "완성형", "부수", "반의어", "동의어", "동음이의어", "획수"}
    if wr:
        t.add("한자쓰기")
    JH_TYPES_BY_LEVEL[lid] = t
def _usable_words(lst):
    out, seen = [], set()
    for x in lst:
        w, r = x["w"], x["r"]
        if w in seen or " " in w or len(w) < 2 or len(w) != len(r) or not re.fullmatch(r"[가-힣]+", r):
            continue
        if not all(ch in dict_chars and has_hunum(ch) for ch in w):
            continue
        seen.add(w)
        out.append({"w": w, "r": r, "f": 0})
    return out
JH_WORDS_USABLE = {}
_acc = []
for lid in [l[0] for l in M.JINHEUNG_LEVELS]:
    _acc = _acc + JH_WORDS.get(lid, [])
    JH_WORDS_USABLE[lid] = _usable_words(_acc)
jh_banks, kc_banks = {}, {}
if M.PHASE2:
    HE_PREF[0] = "jinheung"
    for lid in [l["id"] for l in jh_levels if l["hasData"]]:
        jh_banks.update(gen_bank("jinheung", [lid], jh_level_of, jh_level_of, {lid: JH_TYPES_BY_LEVEL[lid]}, JH_ORDER, None,
                                 word_list=JH_WORDS_USABLE[lid] + [w for w in wlist[:4000] if all(ch in jh_level_of for ch in w["w"])]))
    HE_PREF[0] = None
    KC_TYPES = {"훈음", "한자독음", "독음", "뜻풀이", "완성형", "부수", "반의어", "동의어", "동음이의어", "획수", "문장"}
    kc_banks = gen_bank("korcham", [l["id"] for l in kc_levels if l["hasData"]], kc_level_of, {}, {l["id"]: KC_TYPES for l in kc_levels}, KC_ORDER, None)
AREA_OF = {"jinheung": {t: a for a, ts in JH_POOLS.items() for t in ts}, "korcham": {t: a for a, ts in KC_POOLS.items() for t in ts}}
for pid, bk, lab in (("jinheung", jh_banks, "한자교육진흥회 선정한자·한자어 범위"), ("korcham", kc_banks, "대한상공회의소 배정한자 범위")):
    for L, qs in bk.items():
        for x in qs:
            x["area"] = AREA_OF[pid].get(x["type"], x["typeLabel"])
        dump("questions/%s/%s.json" % (pid, L), {"provider": pid, "level": L, "sourceType": "original-practice",
                                                 "label": "기출유형 연습문제 · 예상문제 (자체 제작, 실제 기출문제 아님) — " + lab, "questions": qs})
        bank_stats[pid][L] = dict(Counter(q["typeLabel"] for q in qs), total=len(qs))
for bk, pid in ((banks, "eomunhoe"), (dh_banks, "daehan")):
    for L, qs in bk.items():
        for x in qs:
            x["area"] = x["typeLabel"] if pid == "eomunhoe" else "한문지식(선정한자) · " + x["typeLabel"]

_dump_eom(); _dump_dh()

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

for pid, lof, order in (("eomunhoe", eom_level_of, LEVEL_ORDER), ("daehan", dh_level_of, DH_ORDER)):
    wmap, imap = map_items(lof, order)
    dump("providers/%s/words-mapping.json" % pid, {"provider": pid, "basis": "구성 한자가 모두 해당 기관 배정한자에 포함되는 한자어 (구성 한자 중 가장 높은 급수에 배치). 공식 출제 목록 아님.",
                                                   "levels": wmap})
    dump("providers/%s/idioms-mapping.json" % pid, {"provider": pid, "basis": "구성 한자 기준 산출. 기관의 공식 사자성어 출제범위 목록이 아님.", "levels": imap})
    for L in order:
        bank_stats[pid].setdefault(L, {})
        bank_stats[pid][L]["words"] = len(wmap.get(L, []))
        bank_stats[pid][L]["idioms"] = len(imap.get(L, []))

JH_WORDS_ALL = {}
if M.PHASE2:
    jh_wmap = {}
    for lid in JH_ORDER:
        lst = _usable_words(JH_WORDS.get(lid, []))
        jh_wmap[lid] = [x["w"] for x in lst]
        for x in lst:
            JH_WORDS_ALL.setdefault(x["w"], x["r"])
    _, jh_imap = map_items(jh_level_of, JH_ORDER)
    dump("providers/jinheung/words-mapping.json", {"provider": "jinheung", "status": "official",
          "basis": "공식 교과서 한자어(8급~3급)·직업분야별 실용한자어(2급·1급) 목록. 띄어쓰기·영문 약어가 있는 용어는 학습 카드에서 제외.",
          "officialCounts": {k: len(v) for k, v in JH_WORDS.items()}, "levels": jh_wmap,
          "fields": {"categories": {lid: sorted({x["cat"] for x in JH_WORDS.get(lid, []) if x["cat"]}) for lid in ("1", "2")}}})
    dump("providers/jinheung/idioms-mapping.json", {"provider": "jinheung", "basis": "구성 한자 기준 산출. 공식 사자성어 출제범위 목록 아님.", "levels": jh_imap})
    kc_wmap, kc_imap = map_items(kc_level_of, KC_ORDER)
    dump("providers/korcham/words-mapping.json", {"provider": "korcham", "basis": "구성 한자가 모두 상공회의소 배정한자에 포함되는 한자어(구성 한자 중 가장 높은 급수에 배치). 공식 출제 목록 아님.", "levels": kc_wmap})
    dump("providers/korcham/idioms-mapping.json", {"provider": "korcham", "basis": "구성 한자 기준 산출. 공식 사자성어 출제범위 목록 아님.", "levels": kc_imap})
    for pid, wm, im, order in (("jinheung", jh_wmap, jh_imap, JH_ORDER), ("korcham", kc_wmap, kc_imap, KC_ORDER)):
        for L in order:
            bank_stats[pid].setdefault(L, {})
            bank_stats[pid][L]["words"] = len(wm.get(L, []))
            bank_stats[pid][L]["idioms"] = len(im.get(L, []))
else:
    for pid in ("jinheung", "korcham"):
        dump("providers/%s/words-mapping.json" % pid, {"provider": pid, "levels": {}, "statusNote": M.NEEDS})
        dump("providers/%s/idioms-mapping.json" % pid, {"provider": pid, "levels": {}, "statusNote": M.NEEDS})

# 대한검정회 전용 한자 DB (기관 namespace 분리: providers/daehan/hanja.json)
dh_scope_levels = {c: DH_ORDER[DH_ORDER.index(l):] for c, l in dh_level_of.items()}
dh_set = set(dh_level_of)
dh_db = []
_dh_words_by_char = defaultdict(list)
for w in wlist:
    if all(ch in dh_set for ch in w["w"]):
        for ch in set(w["w"]):
            if len(_dh_words_by_char[ch]) < 6:
                _dh_words_by_char[ch].append(w["w"])
for c, l in sorted(dh_level_of.items(), key=lambda x: (DH_ORDER.index(x[1]), x[0])):
    d = dict_chars[c]
    ml = d.get("dh") or d["m"]
    ws = _dh_words_by_char.get(c, [])
    ids = [it["id"] for it in idioms if c in it["w"] and all(ch in dh_set for ch in it["w"])][:4]
    dh_db.append({"character": c, "grade": l, "gradeName": DH_NAME[l],
                  "cumulativeGrades": [DH_NAME[x] for x in dh_scope_levels[c]],
                  "meaning": ml[0][0] if ml else "", "reading": ml[0][1] if ml else d["r"],
                  "meanings": ml, "hunumSource": "대한검정회 공식 훈음표" if d.get("dh") and c not in DH_HUNUM_FROM_DICT else "사전(libhangul/한국어문회 자료) — 공식 훈음표 추출 불가 항목", "strokes": d.get("st"), "radical": d.get("rad"),
                  "words": ws, "idioms": ids, "source": "대한검정회",
                  "verification": "official"})
dump("providers/daehan/hanja.json", {"provider": "daehan", "count": len(dh_db),
      "fields": "character, grade(신출 급수), cumulativeGrades(포함되는 급수), meaning(훈), reading(음), strokes, radical, words, idioms, source",
      "items": dh_db}, compact=False)

used_words = set()
for L in list(banks.values()) + list(dh_banks.values()) + list(jh_banks.values()) + list(kc_banks.values()):
    for q in L:
        for fld in ("prompt", "answer"):
            v = q.get(fld)
            if isinstance(v, str) and v in words:
                used_words.add(v)
        for ch in q.get("choices", []):
            if ch in words:
                used_words.add(ch)
for pid in ("eomunhoe", "daehan", "korcham"):
    wm = json.load(open(os.path.join(DATA, "providers/%s/words-mapping.json" % pid), encoding="utf-8"))
    for ws in wm["levels"].values():
        used_words.update(ws)
for d in dict_chars.values():
    used_words.update(d["ex"])
wout = [x for x in wlist if x["w"] in used_words]
_have = {x["w"] for x in wout}
for w, r in JH_WORDS_ALL.items():
    if w not in _have:
        wout.append({"w": w, "r": r, "f": 0})
for L in jh_banks.values():
    for q in L:
        for v in [q.get("prompt"), q.get("answer")] + list(q.get("choices", [])):
            if isinstance(v, str) and v not in _have and len(v) >= 2:
                for x in JH_WORDS_USABLE.get("sa", []) + JH_WORDS_USABLE.get("1", []):
                    if x["w"] == v:
                        wout.append(x); _have.add(v); break
dump("dictionary/words.json", {"meta": {"description": "한자어 목록: libhangul 한자 사전(BSD-3-Clause)의 독음 + 사용 빈도. 뜻은 구성 한자 훈음 풀이로 제공(사전식 정의 아님).",
                                        "count": len(wout)},
                               "words": [{"w": x["w"], "r": x["r"], "f": x["f"]} for x in wout]})
wlist = wout
dump("stats.json", {"builtAt": M.VERIFIED_AT, "dictionary": len(dict_chars), "strokes": sum(1 for d in dict_chars.values() if d.get("so")),
                    "words": len(wlist), "idioms": len(idioms), "pairs": {k: len(v) for k, v in pairs.items()},
                    "banks": bank_stats,
                    "providers": {"eomunhoe": len(eom_map), "daehan": len(dh_level_of), "jinheung": len(jh_level_of), "korcham": len(kc_level_of)}}, compact=False)

# ---- 문제은행 목록(manifest): 출처 구분 · 공식 영역 매핑 · 공식 기출 링크
_prov = {p["id"]: p for p in M.PROVIDERS}
manifest = {"generatedAt": M.VERIFIED_AT,
            "policy": {"sourceType": {"original-practice": "이 앱이 공식 배정/선정한자와 공식 출제 유형을 기준으로 자체 제작한 연습문제(실제 기출 아님)",
                                      "official-past-exam": "기관 공식 기출문제 — 저작권 보호로 앱에 저장하지 않고 공식 사이트 링크로만 연결"},
                       "note": "모의시험은 공식 문항 수·시간·합격 기준(가능한 경우 영역 배분)에 맞춰 자체 제작 문항으로 구성합니다."},
            "providers": {}}
for pid, bk in (("eomunhoe", banks), ("daehan", dh_banks), ("jinheung", jh_banks), ("korcham", kc_banks)):
    pv = _prov[pid]
    manifest["providers"][pid] = {
        "officialPastExam": {"url": pv["pastExamUrl"], "policy": pv["pastExamPolicy"], "storedInApp": False},
        "levels": {L: {"count": len(qs), "sourceType": "original-practice",
                       "byArea": dict(Counter(q.get("area", q["typeLabel"]) for q in qs))} for L, qs in bk.items()}}
dump("questions/index.json", manifest, compact=False)
print(json.dumps({k: v.get("total") for k, v in bank_stats["eomunhoe"].items()}, ensure_ascii=False))
print("문제 총합:", sum(v.get("total", 0) for p in bank_stats.values() for v in p.values()))

# 비활성 기관 출력물 제거 (조사 메타데이터는 providers_meta.py 에 보존)
for pid in ("jinheung", "korcham"):
    if pid in ENABLED:
        continue
    shutil.rmtree(os.path.join(DATA, "providers", pid), ignore_errors=True)
    for f in (os.path.join(DATA, "schedules", pid + "-2026.json"),):
        if os.path.exists(f):
            os.remove(f)
    shutil.rmtree(os.path.join(DATA, "questions", pid), ignore_errors=True)
    st = json.load(open(os.path.join(DATA, "stats.json"), encoding="utf-8"))
    st["banks"].pop(pid, None); st["providers"].pop(pid, None)
    dump("stats.json", st, compact=False)
