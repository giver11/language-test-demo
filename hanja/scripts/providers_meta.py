# -*- coding: utf-8 -*-
"""기관별 메타데이터(급수 체계·시험형식·일정·출처).

모든 값은 공식 사이트에서 확인한 값이거나, 확인하지 못한 경우 status 필드로
'공식 자료 확인 필요'를 명시한다. 추정값을 확정값처럼 쓰지 않는다.
verifiedAt 은 이 세션에서 해당 페이지를 실제로 조회한 날짜(KST)다.
"""

VERIFIED_AT = "2026-09-28"

# 앱에서 지원하는 기관 (4개 기관 모두 표시. 배정한자 데이터가 없는 급수는 앱에서 선택 불가로 표시)
ENABLED = ["eomunhoe", "daehan", "jinheung", "korcham"]

# 상태 코드
OFFICIAL = "official"                 # 공식 사이트에서 직접 확인
OFFICIAL_FILE = "official-file"       # 공식 배포 파일(xls)을 변환한 공개 데이터셋
SECONDARY = "secondary"               # 공식 공지를 재게시한 2차 자료(공식 사이트 직접 접속 불가)
UNVERIFIED = "unverified"             # 공식 자료 확인 필요
NEEDS = "공식 자료 확인 필요"

SOURCES = {
    "eomunhoe": [
        {"provider": "eomunhoe", "sourceName": "사단법인 한국어문회 공식 홈페이지", "sourceUrl": "https://www.hanja.re.kr/",
         "verifiedAt": VERIFIED_AT, "year": 2026, "status": "unreachable",
         "note": "이 개발 환경에서는 공식 사이트 접속(robots.txt 응답 실패)이 되지 않아 직접 대조하지 못함."},
        {"provider": "eomunhoe", "sourceName": "한국어문회 학습자료 급수별 배정한자 xls → CSV 변환본 (rycont/hanja-grade-dataset)",
         "sourceUrl": "https://github.com/rycont/hanja-grade-dataset", "verifiedAt": VERIFIED_AT, "year": 2026, "status": OFFICIAL_FILE,
         "note": "한국어문회 공식 홈페이지 학습자료의 xls 파일을 CSV로 변환한 공개 데이터셋(커밋 91a1f49, 2024-06-06). 데이터 저작권은 한국어문회에 있음."},
        {"provider": "eomunhoe", "sourceName": "2026 한국어문회 시행일정 재게시 공지 (신지원에듀 검스타트)",
         "sourceUrl": "https://gumstart.sinjiwonedu.co.kr/bbs/board.php?bo_table=bs101&wr_id=351", "verifiedAt": VERIFIED_AT, "year": 2026,
         "status": SECONDARY, "note": "한국어문회 공식 일정을 인용한 교재사 공지. 한공사 공지(https://www.hangongsa.com/b/notice-309)와 제112회 2월 28일 일치 교차확인."},
    ],
    "daehan": [
        {"provider": "daehan", "sourceName": "대한검정회 2026년도 한자급수자격검정시험 시행일정", "sourceUrl": "https://www.hanja.ne.kr/info/info01.asp",
         "verifiedAt": VERIFIED_AT, "year": 2026, "status": OFFICIAL},
        {"provider": "daehan", "sourceName": "대한검정회 자기주도형 온라인 시험 안내", "sourceUrl": "https://www.hanja.ne.kr/info/info01_online.asp",
         "verifiedAt": VERIFIED_AT, "year": 2026, "status": OFFICIAL},
        {"provider": "daehan", "sourceName": "대한검정회 공식 시험안내 (급수별 문항수·시험시간·합격기준)", "sourceUrl": "https://www.hanja.ne.kr/apply/info01.asp",
         "verifiedAt": VERIFIED_AT, "year": 2026, "status": OFFICIAL,
         "note": "현장시험: 8·7급 25문항 40분(18문항 이상), 6~3급 50문항 40분(35), 준2·2급 100문항 60분(70), 준1·1급·사범 150문항 90분(105), 대사범 100문항 60분(70). 8~3급 객관식."},
        {"provider": "daehan", "sourceName": "대한검정회 등급별 검정과목 출제형식", "sourceUrl": "https://www.hanja.ne.kr/jupsu/info01.asp",
         "verifiedAt": VERIFIED_AT, "year": 2026, "status": "partial",
         "note": "급수별 선정한자 누적 수(8급 30 ~ 사범 5,000) 확인. 표 일부는 인코딩 문제로 판독 제한."},
        {"provider": "daehan", "sourceName": "대한검정회 등급별 선정한자", "sourceUrl": "https://www.hanja.ne.kr/jupsu/jupsu07_01.asp",
         "verifiedAt": VERIFIED_AT, "year": 2026, "status": "image-only",
         "note": "페이지 본문은 8·7·6급 제목과 누적 구성(30/50/70자)만 텍스트로 제공. 한자 목록은 자료실 게시판(/board/board/list.asp?tb=inno_12)에 있으며 이 개발 환경에서는 robots.txt 차단으로 원문 확보 불가 → 공식 자료 확인 필요."},
        {"provider": "daehan", "sourceName": "대한검정회 공식 기출문제 (최근 2회분, 무단 복제·배포 금지)", "sourceUrl": "https://www.hanja.ne.kr/jupsu/jupsu07.asp",
         "verifiedAt": VERIFIED_AT, "year": 2026, "status": OFFICIAL, "note": "앱에는 저장하지 않고 링크로만 연결."},
        {"provider": "daehan", "sourceName": "나무위키 한자급수자격검정/배정한자 (2차 자료)", "sourceUrl": "https://namu.wiki/w/%ED%95%9C%EC%9E%90%EA%B8%89%EC%88%98%EC%9E%90%EA%B2%A9%EA%B2%80%EC%A0%95/%EB%B0%B0%EC%A0%95%ED%95%9C%EC%9E%90",
         "verifiedAt": VERIFIED_AT, "year": 2026, "status": SECONDARY},
    ],
    "jinheung": [
        {"provider": "jinheung", "sourceName": "한자교육진흥회(한국한자실력평가원) 2026 시험일정", "sourceUrl": "https://www.hanja114.org/common/intro/examInfoList.do",
         "verifiedAt": VERIFIED_AT, "year": 2026, "status": OFFICIAL},
        {"provider": "jinheung", "sourceName": "한자실력급수 시험소개", "sourceUrl": "https://web.hanja114.org/common/intro/exam.do",
         "verifiedAt": VERIFIED_AT, "year": 2026, "status": OFFICIAL},
        {"provider": "jinheung", "sourceName": "한자실력급수 급수별 평가한자", "sourceUrl": "https://web.hanja114.org/common/intro/examGrade.do",
         "verifiedAt": VERIFIED_AT, "year": 2026, "status": OFFICIAL,
         "note": "급수별 한자 수는 확인. 한자 목록은 .hwp/.exe 파일로만 배포되어 이 환경에서 다운로드 불가 → 배정한자 공식 자료 확인 필요."},
        {"provider": "jinheung", "sourceName": "한자실력급수 시험요강(문항수·시간·합격기준)", "sourceUrl": "https://web.hanja114.org/common/intro/examGuide.do",
         "verifiedAt": VERIFIED_AT, "year": 2026, "status": OFFICIAL},
    ],
    "korcham": [
        {"provider": "korcham", "sourceName": "대한상공회의소 자격평가사업단 상공회의소 한자 시험안내", "sourceUrl": "https://license.korcham.net/co/examguide.do?mm=53&cd=0401",
         "verifiedAt": VERIFIED_AT, "year": 2026, "status": OFFICIAL},
        {"provider": "korcham", "sourceName": "상공회의소 한자 시험일정", "sourceUrl": "https://license.korcham.net/co/examguide03.do?cd=0401&mm=53",
         "verifiedAt": VERIFIED_AT, "year": 2026, "status": OFFICIAL},
        {"provider": "korcham", "sourceName": "2026년 상시 자격시험 시작일정 안내(공지)", "sourceUrl": "https://license.korcham.net/customer/noticeview.do?num=252526&pg=1&word=&search=",
         "verifiedAt": VERIFIED_AT, "year": 2026, "status": OFFICIAL},
        {"provider": "korcham", "sourceName": "상공회의소 한자 시험문제 자료실", "sourceUrl": "https://license.korcham.net/co/examguide02.do?cd=0401&mm=53",
         "verifiedAt": VERIFIED_AT, "year": 2026, "status": OFFICIAL,
         "note": "상시검정 문제는 문제은행식으로 비공개. 배정한자는 '배정한자 (1~ 9급).zip'으로만 배포되어 이 환경에서 다운로드 불가."},
        {"provider": "korcham", "sourceName": "상공회의소 한자 FAQ", "sourceUrl": "https://license.korcham.net/co/examguide05.do?cd=0401&mm=53",
         "verifiedAt": VERIFIED_AT, "year": 2026, "status": OFFICIAL},
        {"provider": "korcham", "sourceName": "민간자격정보서비스 상공회의소한자 기본정보", "sourceUrl": "https://www.pqi.or.kr/inf/qul/infQulBasDetail.do?qulId=373",
         "verifiedAt": VERIFIED_AT, "year": 2026, "status": OFFICIAL},
    ],
}

PROVIDERS = [
    {"id": "eomunhoe", "name": "한국어문회", "examName": "전국한자능력검정시험", "short": "어문회",
     "operating2026": True, "operatingSource": "2026년 제112~115회 시행 일정 공지(재게시 자료 교차확인)",
     "officialUrl": "https://www.hanja.re.kr/", "pastExamUrl": "https://www.hanja.re.kr/",
     "pastExamPolicy": "공식 홈페이지 자료실 확인 필요(이 환경에서 접속 불가). 앱 내부에는 기출문제를 복제하지 않음.",
     "mode": "오프라인(지필) · 인터넷 접수", "color": "#b4432f"},
    {"id": "daehan", "name": "대한검정회", "examName": "한자급수자격검정", "short": "검정회",
     "operating2026": True, "operatingSource": "공식 2026년도 시행일정 공지(제110~113회)",
     "officialUrl": "https://www.hanja.ne.kr/", "pastExamUrl": "https://www.hanja.ne.kr/jupsu/jupsu07.asp",
     "pastExamPolicy": "공식: 최근 2회분 기출문제를 자료실에 게재. 무단 전송·복제·배포·2차적 저작물 작성 금지 → 앱에서는 링크로만 연결.",
     "mode": "오프라인 현장시험 + 자기주도형 온라인(연 2회, 8급~3급 객관식)", "color": "#2f6db4"},
    {"id": "jinheung", "name": "한자교육진흥회", "examName": "한자실력급수 자격시험", "short": "진흥회",
     "operating2026": True, "operatingSource": "공식 2026년 시험일정(제123~126회)",
     "officialUrl": "https://web.hanja114.org/", "pastExamUrl": "https://web.hanja114.org/common/intro/boardFileList.do",
     "pastExamPolicy": "공식 자료실에서 제공 여부 확인 필요. 앱에서는 링크로만 연결.",
     "mode": "오프라인(지필) · 인터넷/방문 접수", "color": "#2f8a5b"},
    {"id": "korcham", "name": "대한상공회의소", "examName": "상공회의소 한자", "short": "상공회의소",
     "operating2026": True, "operatingSource": "2026년 상시 자격시험 시작일정 안내(접수 2026-01-01~, 최초 시험 2026-01-05)",
     "officialUrl": "https://license.korcham.net/", "pastExamUrl": "https://license.korcham.net/co/examguide02.do?cd=0401&mm=53",
     "pastExamPolicy": "공식: 상시검정 문제는 문제은행식으로 비공개. 학습용 문제모음집·모의문제(2013)는 공식 자료실 링크로만 연결.",
     "mode": "상시검정 · CBT 객관식", "color": "#8a5a2f"},
]

# ---------------------------------------------------------------- 한국어문회
# readCount/writeCount/questionCount/passCount/timeMin: 한국어문회 공개 출제기준(여러 재게시 자료에서 동일하게 확인되는 값).
# 공식 사이트 직접 대조는 불가했으므로 levelStatus = secondary 로 표기.
EOMUNHOE_LEVELS = [
    # id, name, category, read, write, q, pass, time
    ("8", "8급", "교육급수", 50, 0, 50, 35, 50),
    ("7-2", "7급Ⅱ", "교육급수", 100, 0, 60, 42, 50),
    ("7", "7급", "교육급수", 150, 0, 70, 49, 50),
    ("6-2", "6급Ⅱ", "교육급수", 225, 50, 80, 56, 50),
    ("6", "6급", "교육급수", 300, 150, 90, 63, 50),
    ("5-2", "5급Ⅱ", "교육급수", 400, 225, 100, 70, 50),
    ("5", "5급", "교육급수", 500, 300, 100, 70, 50),
    ("4-2", "4급Ⅱ", "교육급수", 750, 400, 100, 70, 50),
    ("4", "4급", "교육급수", 1000, 500, 100, 70, 50),
    ("3-2", "3급Ⅱ", "공인급수", 1500, 750, 150, 105, 60),
    ("3", "3급", "공인급수", 1817, 1000, 150, 105, 60),
    ("2", "2급", "공인급수", 2355, 1817, 150, 105, 60),
    ("1", "1급", "공인급수", 3500, 2005, 200, 160, 90),
    ("s2", "특급Ⅱ", "공인급수", 4918, 2355, 200, 160, 100),
    ("s", "특급", "공인급수", 5978, 3500, 200, 160, 100),
]
# 데이터셋 급수명 → id
EOMUNHOE_NAME2ID = {name: lid for (lid, name, *_r) in EOMUNHOE_LEVELS}

# 한국어문회 유형별 문항 배분(출제기준표). 공식 원문 대조 필요 → status 로 명시.
# 순서: 독음, 훈음, 장단음, 반의어, 완성형, 부수, 동의어, 동음이의어, 뜻풀이, 약자, 필순, 한자쓰기
EOMUNHOE_TYPE_KEYS = ["독음", "훈음", "장단음", "반의어", "완성형", "부수", "동의어", "동음이의어", "뜻풀이", "약자", "필순", "한자쓰기"]
EOMUNHOE_TYPE_DIST = {
    "8":   [24, 24, 0, 0, 0, 0, 0, 0, 0, 0, 2, 0],
    "7-2": [22, 30, 0, 2, 2, 0, 0, 0, 2, 0, 2, 0],
    "7":   [32, 30, 0, 2, 2, 0, 0, 0, 2, 0, 2, 0],
    "6-2": [32, 29, 0, 2, 2, 0, 0, 0, 2, 0, 3, 10],
    "6":   [33, 22, 0, 3, 3, 0, 2, 2, 2, 0, 3, 20],
    "5-2": [35, 23, 0, 3, 4, 0, 3, 3, 3, 3, 3, 20],
    "5":   [35, 23, 0, 3, 4, 0, 3, 3, 3, 3, 3, 20],
    "4-2": [35, 22, 0, 3, 5, 3, 3, 3, 3, 3, 0, 20],
    "4":   [32, 22, 3, 3, 5, 3, 3, 3, 3, 3, 0, 20],
    "3-2": [45, 27, 5, 10, 10, 5, 5, 5, 5, 3, 0, 30],
    "3":   [45, 27, 5, 10, 10, 5, 5, 5, 5, 3, 0, 30],
    "2":   [45, 27, 5, 10, 10, 5, 5, 5, 5, 3, 0, 30],
    "1":   [50, 32, 10, 10, 15, 10, 10, 10, 10, 3, 0, 40],
    "s2":  [50, 32, 10, 10, 15, 10, 10, 10, 10, 3, 0, 40],
    "s":   [50, 32, 10, 10, 15, 10, 10, 10, 10, 3, 0, 40],
}

# ---------------------------------------------------------------- 대한검정회
# (id, name, category, 선정한자 누적 수(판독값), 문항수(판독값))
# 공식 시험안내 https://www.hanja.ne.kr/apply/info01.asp (2026-09-28 확인)
# (id, name, category, 선정한자 누적 수, 현장 문항, 현장 시간(분), 합격 문항, 문항 구성)
DAEHAN_LEVELS = [
    ("8", "8급", "등록(민간)", 30, 25, 40, 18, "객관식 25"),
    ("7", "7급", "등록(민간)", 50, 25, 40, 18, "객관식 25"),
    ("6", "6급", "등록(민간)", 70, 50, 40, 35, "객관식 50"),
    ("5-j", "준5급", "등록(민간)", 100, 50, 40, 35, "객관식 50"),
    ("5", "5급", "등록(민간)", 250, 50, 40, 35, "객관식 50"),
    ("4-j", "준4급", "등록(민간)", 400, 50, 40, 35, "객관식 50"),
    ("4", "4급", "등록(민간)", 600, 50, 40, 35, "객관식 50"),
    ("3-j", "준3급", "등록(민간)", 800, 50, 40, 35, "객관식 50"),
    ("3", "3급", "등록(민간)", 1000, 50, 40, 35, "객관식 50"),
    ("2-j", "준2급", "공인", 1500, 100, 60, 70, "객관식 50 · 주관식 50"),
    ("2", "2급", "공인", 2000, 100, 60, 70, "객관식 50 · 주관식 50"),
    ("1-j", "준1급", "공인", 2500, 150, 90, 105, "객관식 50 · 주관식 100"),
    ("1", "1급", "공인", 3500, 150, 90, 105, "객관식 50 · 주관식 100"),
    ("sa", "사범", "공인", 5000, 150, 90, 105, "객관식 50 · 주관식 100"),
    ("dsa", "대사범", "공인", None, 100, 60, 70, "10개 지문 · 100문항"),
]
# 자기주도형 온라인 시험 (https://www.hanja.ne.kr/info/info01_online.asp) — 8급~3급만, 모두 객관식
DAEHAN_ONLINE = {
    "8": (25, 15, 18), "7": (25, 15, 18),
    "6": (50, 25, 35), "5-j": (50, 25, 35), "5": (50, 25, 35), "4-j": (50, 25, 35), "4": (50, 25, 35), "3-j": (50, 25, 35), "3": (50, 25, 35),
}
# 대한검정회 8급 30자 — 나무위키 전사본(2차 자료). 공식 선정한자 이미지와 대조 필요.
DAEHAN_8 = [("九","아홉","구"),("金","쇠","금"),("南","남녘","남"),("男","사내","남"),("女","여자","녀"),("東","동녘","동"),
            ("六","여섯","륙"),("母","어머니","모"),("木","나무","목"),("門","문","문"),("父","아버지","부"),("北","북녘","북"),
            ("四","넉","사"),("三","석","삼"),("西","서녘","서"),("水","물","수"),("十","열","십"),("五","다섯","오"),
            ("月","달","월"),("二","두","이"),("人","사람","인"),("日","날","일"),("一","한","일"),("子","아들","자"),
            ("弟","아우","제"),("七","일곱","칠"),("土","흙","토"),("八","여덟","팔"),("兄","맏","형"),("火","불","화")]

# ---------------------------------------------------------------- 한자교육진흥회 (공식 examGrade.do / examGuide.do)
# (id, name, category, 공식 표기 한자 수, 시간, 문항, 주관식, 한자쓰기, 객관식, 배점, 만점, 합격비율)
JINHEUNG_LEVELS = [
    ("8", "8급", "등록", 50, 60, 50, 20, 0, 30, 2, 100, 0.7),
    ("7", "7급", "등록", 120, 60, 50, 20, 0, 30, 2, 100, 0.7),
    ("6", "6급", "등록", 170, 60, 80, 50, 10, 30, 1.25, 100, 0.7),
    ("5-j", "준5급", "등록", 250, 60, 100, 70, 20, 30, 1, 100, 0.7),
    ("5", "5급", "등록", 450, 60, 100, 70, 20, 30, 1, 100, 0.7),
    ("4-j", "준4급", "등록", 700, 60, 100, 70, 20, 30, 1, 100, 0.7),
    ("4", "4급", "등록", 900, 60, 100, 70, 20, 30, 1, 100, 0.7),
    ("3-j", "준3급", "등록", 1350, 60, 100, 70, 20, 30, 1, 100, 0.7),
    ("3", "3급", "공인", 1800, 60, 100, 70, 20, 30, 2, 200, 0.7),
    ("2", "2급", "공인", 2300, 60, 100, 70, 25, 30, 2, 200, 0.7),
    ("1", "1급", "공인", 3500, 80, 150, 100, 25, 50, 2, 300, 0.7),
    ("sa", "사범", "공인", 5000, 120, 200, 150, 25, 50, 2, 400, 0.8),
]
JINHEUNG_NOTES = {
    "3": "공식 다운로드 목록 표기: 선정한자 1,300자 + 교과서한자어 500 (급수표 합계 1,800)",
    "3-j": "공식 다운로드 목록 표기: 선정한자 1,000자 + 교과서한자어 350 (급수표 합계 1,350)",
}
JINHEUNG_TYPE_RATIO = {
    "note": "공식 시험요강 '출제유형 비율' 표 판독값(%). 선정한자(훈음/독음/쓰기/기타) + 교과서·실용한자어(독음/용어뜻/쓰기/기타).",
    "사범": {"선정한자": [25, 35, 25, 15]},
    "1급": {"선정한자": [15, 15, 20, 15], "한자어": [10, 10, 5, 10]},
    "2급~준5급": {"선정한자": [15, 15, 20, 15], "한자어": [10, 10, 0, 10]},
    "6급": {"선정한자": [20, 20, 10, 15], "한자어": [10, 10, 0, 10]},
    "7급·8급": {"선정한자": [25, 25, 0, 15], "한자어": [15, 10, 0, 10]},
}

# ---------------------------------------------------------------- 대한상공회의소 (공식 examguide.do)
# (id, name, category, 시간, 한자/어휘/독해 문항, 합격기준 문구)
KORCHAM_LEVELS = [
    ("9", "9급", "등록", 30, (20, 10, 0), "60% 이상 득점"),
    ("8", "8급", "등록", 30, (30, 15, 5), "60% 이상 득점"),
    ("7", "7급", "등록", 40, (40, 20, 10), "60% 이상 득점"),
    ("6", "6급", "등록", 40, (45, 30, 15), "60% 이상 득점"),
    ("5", "5급", "등록", 60, (40, 30, 30), "70% 이상 득점"),
    ("4", "4급", "등록", 60, (40, 35, 35), "70% 이상 득점"),
    ("3", "3급", "공인", 60, (40, 40, 40), "전과목 60% 이상 + 만점의 80% 이상"),
    ("2", "2급", "공인", 80, (50, 40, 40), "전과목 60% 이상 + 만점의 80% 이상"),
    ("1", "1급", "공인", 80, (50, 50, 50), "전과목 60% 이상 + 만점의 90% 이상"),
]
KORCHAM_POINTS = (4, 6, 8)  # 한자/어휘/독해 문항당 배점 (공식)
