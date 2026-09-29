/* ScoreStep V2 — 공통 Adaptive Learning Engine (TOPIK · IELTS · HSK)
   core.js / patch-216.js 뒤에 로드된다. 기존 전역(C, K, state, save, render, showQuestion …)을 그대로 쓰고
   기존 저장 키(v2:<app>:state / profile / level / conversation …)는 읽기만 한다(삭제·덮어쓰기 없음).
   새 학습 기록은 v2:<app>:engine 에 따로 저장하고, 전역 스키마 버전은 scorestep_schema_version 에 둔다.
   AI 는 기존 Cloudflare Workers AI 게이트웨이(runtime-config.js)만 사용한다. API Key 없음, 유료 API 없음. */
(function () {
  'use strict';
  if (typeof C === 'undefined' || !C || !C.id) return;
  var APP = C.id, EN = APP === 'ielts';
  var T = function (ko, en) { return EN ? en : ko; };
  var DAY = 86400000, IV = [1, 3, 7, 14, 30];
  var EK = K + 'engine', GV = 'scorestep_schema_version', SCHEMA = 2;
  var SKILLS = { ielts: ['Listening', 'Reading', 'Writing', 'Speaking', 'Vocabulary', 'Grammar'], topik: ['Vocabulary', 'Grammar', 'Listening', 'Reading', 'Writing'], hsk: ['Vocabulary', 'Listening', 'Reading', 'Writing', 'Pronunciation'] }[APP];
  var SK_KO = { Listening: '듣기', Reading: '읽기', Writing: '쓰기', Speaking: '말하기', Vocabulary: '어휘', Grammar: '문법', Pronunciation: '발음' };
  var skillLabel = function (s) { return EN ? s : (SK_KO[s] || s) + ' ' + s; };
  var CAT = ['Vocabulary', 'Grammar', 'Listening detail', 'Inference', 'Spelling', 'Pronunciation', 'Time pressure', 'Question type'];
  var CAT_KO = { Vocabulary: '어휘', Grammar: '문법', 'Listening detail': '듣기 세부정보', Inference: '추론', Spelling: '철자', Pronunciation: '발음', 'Time pressure': '시간 압박', 'Question type': '문제 유형' };
  var catLabel = function (c) { return EN ? c : (CAT_KO[c] || c) + ' ' + c; };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (m) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]; }); };
  var today = function (d) { d = d || new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  var jget = function (k, dflt) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : dflt; } catch (e) { return dflt; } };
  function hash(s) { var h = 5381; s = String(s); for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0; return h.toString(36); }
  function shuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }

  /* ================= 저장소 + migration ================= */
  function blankEng() { return { v: 1, items: {}, log: [], days: {}, mistakes: [], conv: [], createdAt: Date.now() }; }
  var E = loadEngine();
  function loadEngine() {
    var raw = null;
    try { raw = localStorage.getItem(EK); if (raw) return Object.assign(blankEng(), JSON.parse(raw)); }
    catch (err) { console.error('[engine] 학습 기록을 읽지 못했어요 — 원본을 백업합니다', err); try { if (raw) localStorage.setItem(EK + '.backup.unreadable-' + Date.now(), raw); } catch (e) {} return blankEng(); }
    return migrateV1();
  }
  /* v1(기존 state.wrong 문자열 목록) → 엔진 항목. 기존 state 는 변경하지 않고, 원본을 한 번 백업해 둔다. */
  function migrateV1() {
    var e = blankEng();
    try {
      var rawState = localStorage.getItem(K + 'state');
      if (rawState && !localStorage.getItem(K + 'state.backup.v1')) localStorage.setItem(K + 'state.backup.v1', rawState);
      var st = rawState ? JSON.parse(rawState) : null;
      var now = Date.now(), counts = {};
      ((st && st.wrong) || []).forEach(function (w) { if (typeof w === 'string' && w) counts[w] = (counts[w] || 0) + 1; });
      var all = allQuestions(), words = allWords(), sents = allSentences();
      Object.keys(counts).forEach(function (text) {
        var meta = null, id;
        var hitQ = all.find(function (x) { return x.q === text; });
        if (hitQ) { id = hitQ.id; meta = { skill: hitQ.skill, text: text, cat: hitQ.cat, kind: 'q' }; }
        else if (words.some(function (w) { return w[0] === text; })) { id = 'w:' + hash(text); meta = { skill: 'Vocabulary', text: text, kind: 'w' }; }
        else if (sents.some(function (s) { return s[0] === text; })) { id = 's:' + hash(text); meta = { skill: speechSkill(), text: text, kind: 'speech' }; }
        else { id = 'x:' + hash(text); meta = { skill: guessSkill(text), text: text, kind: 'x' }; }
        e.items[id] = { id: id, exam: APP, level: localStorage.getItem(K + 'level') || null, category: meta.cat || meta.skill, skill: meta.skill, kind: meta.kind, text: text.slice(0, 200),
          correct: 0, wrong: counts[text], lastReviewed: null, nextReview: now, mastery: 0, responseTime: 0, st: 0, interval: 1, h: '0', migrated: true };
        for (var i = 0; i < counts[text]; i++) e.mistakes.push({ t: now, id: id, cat: classify(meta, 0), skill: meta.skill, migrated: true });
      });
      e.migratedFrom = 1;
      var gv = +(localStorage.getItem(GV) || 1);
      if (gv < SCHEMA) localStorage.setItem(GV, String(SCHEMA));
      localStorage.setItem(EK, JSON.stringify(e));
      return e;
    } catch (err) {
      console.error('[engine] migration 실패 — 기존 데이터는 그대로 둡니다', err);
      return blankEng();
    }
  }
  var saveTimer = null;
  function saveE(now) {
    var write = function () {
      try { localStorage.setItem(EK, JSON.stringify(E)); }
      catch (err) { E.log = E.log.slice(-600); E.mistakes = E.mistakes.slice(-200); try { localStorage.setItem(EK, JSON.stringify(E)); } catch (e2) { console.error('[engine] 저장 실패', e2); } }
    };
    clearTimeout(saveTimer); if (now) write(); else saveTimer = setTimeout(write, 150);
  }
  window.addEventListener('pagehide', function () { saveE(true); });

  /* ================= 콘텐츠 풀 ================= */
  function levelKey() { return localStorage.getItem(K + 'level') || Object.keys(C.levels || {})[0] || ''; }
  function lvNum() { return APP === 'ielts' ? null : (+levelKey() || 1); }
  function track() { return APP === 'ielts' ? (levelKey().split('-')[0] || 'academic') : null; }
  function speechSkill() { return APP === 'hsk' ? 'Pronunciation' : 'Speaking'; }
  function guessSkill(t) {
    t = String(t || '');
    if (/듣기|Listening|听力|You hear|听到|들은 내용/.test(t)) return 'Listening';
    if (/발음|병음|拼音|发音|pinyin/i.test(t)) return APP === 'hsk' ? 'Pronunciation' : 'Speaking';
    if (/Speaking|말하기/.test(t)) return APP === 'ielts' ? 'Speaking' : 'Reading';
    if (/쓰기|Writing|书写|논설문|도표|논술|어순/.test(t)) return 'Writing';
    if (/문법|Grammar|语法|\(\s+\)|___|（\s*）/.test(t)) return APP === 'hsk' ? 'Writing' : 'Grammar';
    if (/어휘|단어|뜻|해당하는|Vocabulary|词汇|반대말|closest in meaning/.test(t)) return 'Vocabulary';
    return 'Reading';
  }
  function skillOf(x, key) {
    if (x.skill) return x.skill;
    if (APP === 'ielts' && key) { var s = key.split('-')[1] || 'listening'; return s.charAt(0).toUpperCase() + s.slice(1); }
    return guessSkill(x.q);
  }
  var _all = null;
  function allQuestions() {
    if (_all) return _all;
    var out = [], seen = {};
    var push = function (x, meta) { if (!x || !x.q || !x.a) return; var id = 'q:' + hash(x.q); if (seen[id]) return; seen[id] = 1; out.push(Object.assign({}, x, { id: id }, meta)); };
    Object.keys(C.levels || {}).forEach(function (k) { (C.levels[k].questions || []).forEach(function (x) { push(x, { lvKey: k, skill: skillOf(x, k) }); }); });
    ((window.SS_BANK || {})[APP] || []).forEach(function (x) { push(x, { extra: 1, skill: x.skill }); });
    try { ((typeof EXAM_BANKS !== 'undefined' && EXAM_BANKS[APP]) || []).forEach(function (x) { push(x, { bank: 1, skill: skillOf(x) }); }); } catch (e) {}
    _all = out; return out;
  }
  function inScope(x) {
    if (APP === 'ielts') {
      var t = track();
      if (x.lvKey) return x.lvKey.indexOf(t) === 0;
      if (x.track) return x.track === 'both' || x.track === t;
      if (x.bank) return /General/.test(x.q) ? t === 'general' : /Academic/.test(x.q) ? t === 'academic' : true;
      return true;
    }
    var n = lvNum();
    if (x.lvKey) return +x.lvKey === n;
    if (x.lv) return n >= x.lv[0] && n <= x.lv[1];
    if (x.bank) {
      if (APP === 'topik') return /TOPIK I /.test(x.q) ? n <= 2 : /TOPIK II/.test(x.q) ? n >= 3 : true;
      var m = x.q.match(/HSK (\d)/); return m ? Math.abs(+m[1] - n) <= 1 || (+m[1] >= 7 && n >= 6) : true;
    }
    return true;
  }
  function allWords() { var out = []; Object.keys(C.levels || {}).forEach(function (k) { (C.levels[k].words || []).forEach(function (w) { out.push(w); }); }); return out; }
  function allSentences() { var out = []; Object.keys(C.levels || {}).forEach(function (k) { (C.levels[k].sentences || []).forEach(function (s) { out.push(s); }); }); return out; }
  function skillsInExam() {
    if (APP === 'topik' && lvNum() <= 2) return SKILLS.filter(function (s) { return s !== 'Writing'; });   // TOPIK I: 듣기·읽기 (쓰기 없음)
    return SKILLS;
  }

  /* ================= 기록 · 간격복습 · Mastery ================= */
  function slowMs(skill) { return skill === 'Listening' || skill === 'Reading' ? 30000 : 20000; }
  function recentAcc(it) { var h = it.h || ''; if (!h.length) return 0; return h.split('').filter(function (c) { return c === '1'; }).length / h.length; }
  function schedule(it, ok, rt) {
    var now = Date.now(), n = it.correct + it.wrong;
    var acc = 0.5 * (n ? it.correct / n : 0) + 0.5 * recentAcc(it);
    var slow = rt && rt > slowMs(it.skill);
    if (ok) {
      var first = n === 1, ready = first || !it.nextReview || now >= it.nextReview - DAY / 4;
      if (ready && !first) it.st = Math.min(IV.length - 1, (it.st || 0) + (slow ? 0 : 1));
      var f = acc >= 0.9 ? 1.2 : acc >= 0.75 ? 1 : acc >= 0.5 ? 0.7 : 0.5;
      it.interval = Math.max(0.5, Math.round(IV[it.st || 0] * f * (slow ? 0.6 : 1) * 10) / 10);   // 느리거나 정답률이 낮으면 간격 단축
    } else {
      it.st = 0;
      it.interval = it.wrong >= 3 ? 0.5 : 1;
    }
    it.nextReview = now + it.interval * DAY;
  }
  function masteryOf(it, now) {
    now = now || Date.now();
    var n = it.correct + it.wrong; if (!n) return 0;
    var m = 0.45 * [20, 40, 60, 80, 95][it.st || 0] + 0.3 * (it.correct / n) * 100 + 0.25 * recentAcc(it) * 100;
    if (it.responseTime && it.responseTime > slowMs(it.skill)) m -= 5;
    var over = now - (it.nextReview || now); if (over > 0) m -= Math.min(20, over / DAY * 2);
    return Math.max(0, Math.min(100, Math.round(m)));
  }
  function dayRec(d) { d = d || today(); var x = E.days[d] || (E.days[d] = { sec: 0, q: 0, qc: 0, rv: 0, w: 0, sp: 0, lessons: 0, blocks: [], xp0: (typeof state !== 'undefined' ? state.xp : 0) }); return x; }
  function classify(meta, rt, extra) {
    extra = extra || {};
    if (extra.kind === 'speech' || meta.kind === 'speech') return 'Pronunciation';
    if (meta.skill === 'Pronunciation') return 'Pronunciation';
    if (rt && rt > slowMs(meta.skill)) return 'Time pressure';
    if (meta.cat === 'Inference' || /NOT GIVEN|추론|推理|중심|infer|main idea|imply|可以知道|중심 생각/i.test(meta.text || '')) return 'Inference';
    if (meta.skill === 'Listening') return 'Listening detail';
    if (meta.skill === 'Vocabulary') return 'Vocabulary';
    if (meta.skill === 'Grammar') return 'Grammar';
    if (meta.skill === 'Writing' && /어순|书写|文法|Grammar|比|把/.test(meta.text || '')) return 'Grammar';
    if (meta.skill === 'Writing' && /spell|철자/i.test(meta.text || '')) return 'Spelling';
    return 'Question type';
  }
  /* 공통 학습 항목 기록: {id, exam, level, category, skill, correct, wrong, lastReviewed, nextReview, mastery, responseTime} */
  function record(id, meta, ok, rt, extra) {
    extra = extra || {};
    var now = Date.now();
    var due = E.items[id] && E.items[id].nextReview && E.items[id].nextReview <= now;
    var it = E.items[id] || (E.items[id] = { id: id, exam: APP, level: levelKey(), category: meta.cat || meta.skill, skill: meta.skill, kind: meta.kind || extra.kind || 'q', text: String(meta.text || '').slice(0, 200),
      correct: 0, wrong: 0, lastReviewed: null, nextReview: null, mastery: 0, responseTime: 0, st: 0, interval: 0, h: '' });
    if (ok) it.correct++; else it.wrong++;
    it.h = ((it.h || '') + (ok ? '1' : '0')).slice(-8);
    if (rt && rt > 0 && rt < 600000) it.responseTime = it.responseTime ? Math.round(it.responseTime * 0.6 + rt * 0.4) : Math.round(rt);
    schedule(it, ok, rt);
    it.lastReviewed = now;
    it.mastery = masteryOf(it, now);
    E.log.push({ t: now, id: id, s: it.skill, ok: ok ? 1 : 0, rt: Math.round(rt || 0), k: extra.kind || it.kind, rv: due ? 1 : 0, ms: extra.skillOverride || null });
    if (E.log.length > 2500) E.log = E.log.slice(-2500);
    var d = dayRec();
    if (it.kind === 'w') d.w++; else if (it.kind === 'speech') d.sp++; else { d.q++; if (ok) d.qc++; }
    if (due) d.rv++;
    if (!ok) { E.mistakes.push({ t: now, id: id, cat: classify(meta, rt, extra), skill: it.skill }); if (E.mistakes.length > 600) E.mistakes = E.mistakes.slice(-600); }
    updateStreak();
    saveE();
    return it;
  }
  window.ScoreStepEngine = { record: record, items: function () { return E.items; }, data: function () { return E; }, schemaVersion: SCHEMA };

  /* ================= 연속 학습 · 학습 시간 ================= */
  function activeDay(x) { return x && (x.q + x.w + x.sp + x.lessons > 0 || x.sec >= 60); }
  function streakCalc() {
    var cur = 0, d = new Date();
    if (!activeDay(E.days[today(d)])) d.setDate(d.getDate() - 1);
    while (activeDay(E.days[today(d)])) { cur++; d.setDate(d.getDate() - 1); }
    return cur;
  }
  function updateStreak() { try { var s = streakCalc(); if (typeof state !== 'undefined' && s > 0) { state.streak = s; save(); } } catch (e) {} }
  var lastAct = Date.now();
  ['pointerdown', 'keydown', 'touchstart'].forEach(function (ev) { window.addEventListener(ev, function () { lastAct = Date.now(); }, { passive: true }); });
  setInterval(function () {   /* 실제로 화면을 쓰는 시간만 (1분 이상 조작 없으면 제외). 앱 전체에서 타이머 1개 */
    if (document.visibilityState !== 'visible' || Date.now() - lastAct > 60000) return;
    var app = document.getElementById('app'); if (!app || app.classList.contains('hide')) return;
    dayRec().sec += 15; saveE();
  }, 15000);

  /* ================= 시험일 · 단계 ================= */
  function profile() { return jget(K + 'profile', {}); }
  function targetExam() { var t = jget(K + 'target-exam', null); if (t && t.date) return t; var p = profile(); return p.date ? { name: p.goal || C.name, date: p.date } : null; }
  function daysLeft() {
    var t = targetExam(); if (!t) return null;
    var s = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' })), a = Date.UTC(s.getFullYear(), s.getMonth(), s.getDate()), p = t.date.split('-').map(Number);
    return Math.ceil((Date.UTC(p[0], p[1] - 1, p[2]) - a) / DAY);
  }
  /* 시험이 가까울수록 새 내용 ↓ · 취약영역 ↑ · 오답 ↑ · 실전연습 ↑ */
  function phase(d) {
    if (d == null || d < 0) return { key: 'free', label: T('시험일 미설정 · 기본 균형', 'No exam date · balanced'), nw: 0.4, weak: 0.25, prac: 0.2, speak: 0.15 };
    if (d > 60) return { key: 'base', label: T('기초 구축 (D-60 이전)', 'Foundation (60+ days)'), nw: 0.4, weak: 0.25, prac: 0.2, speak: 0.15 };
    if (d > 30) return { key: 'd60', label: T('강화 (D-60~31)', 'Build-up (60–31 days)'), nw: 0.3, weak: 0.3, prac: 0.25, speak: 0.15 };
    if (d > 7) return { key: 'd30', label: T('실전 (D-30~8) · 취약영역·실전 비중 ↑', 'Exam mode (30–8 days) · weak areas & practice ↑'), nw: 0.2, weak: 0.35, prac: 0.3, speak: 0.15 };
    return { key: 'd7', label: T('집중 복습 (D-7 이내) · 새 내용 최소화', 'Final review (≤7 days) · minimal new content'), nw: 0.05, weak: 0.4, prac: 0.4, speak: 0.15 };
  }

  /* ================= 분석: 영역 · 준비도 · 약점 · DNA ================= */
  function skillStats() {
    var now = Date.now(), since = now - 30 * DAY, out = {};
    SKILLS.forEach(function (s) { out[s] = { skill: s, a: 0, c: 0, items: 0, msum: 0 }; });
    Object.keys(E.items).forEach(function (id) { var it = E.items[id], x = out[it.skill]; if (!x) return; x.items++; x.msum += masteryOf(it, now); });
    E.log.forEach(function (l) { if (l.t < since) return; var x = out[l.s]; if (!x) return; x.a++; x.c += l.ok; });
    SKILLS.forEach(function (s) {
      var x = out[s];
      x.acc = x.a ? x.c / x.a : null;
      x.mAvg = x.items ? x.msum / x.items : 0;
      var cover = Math.min(1, x.items / 8);
      x.ready = x.a ? Math.round(100 * cover * (0.6 * x.acc + 0.4 * x.mAvg / 100)) : 0;
      x.status = x.a < 3 ? 'none' : (x.ready >= 70 && x.acc >= 0.8) ? 'strong' : x.ready >= 45 && x.acc >= 0.6 ? 'ok' : 'weak';
      x.inExam = skillsInExam().indexOf(s) >= 0;
    });
    return out;
  }
  function readiness() {
    var st = skillStats(), list = skillsInExam(), sum = 0;
    list.forEach(function (s) { sum += st[s].ready; });
    return { overall: list.length ? Math.round(sum / list.length) : 0, by: st, list: list };
  }
  function weakestSkill() {
    var st = skillStats(), list = skillsInExam().map(function (s) { return st[s]; });
    var never = list.filter(function (x) { return !x.a; });
    var withData = list.filter(function (x) { return x.a; }).sort(function (a, b) { return a.ready - b.ready; });
    if (withData.length && withData[0].status === 'weak') return withData[0].skill;
    if (never.length) return never[(new Date().getDate()) % never.length].skill;   // 아직 안 한 영역을 날마다 번갈아
    return withData.length ? withData[0].skill : list[0].skill;
  }
  function dna() {
    var now = Date.now(), counts = {}, total = 0;
    E.mistakes.forEach(function (m) { var age = (now - m.t) / DAY, w = age < 7 ? 1 : age < 30 ? 0.6 : 0.3; counts[m.cat] = counts[m.cat] || { n: 0, w: 0 }; counts[m.cat].n++; counts[m.cat].w += w; total++; });
    var rows = Object.keys(counts).map(function (k) { return { cat: k, n: counts[k].n, w: counts[k].w, pct: total ? Math.round(counts[k].n * 100 / total) : 0 }; }).sort(function (a, b) { return b.w - a.w; });
    return { total: total, rows: rows, top: rows[0] ? rows[0].cat : null };
  }
  function catMatch(x, cat) {
    var it = E.items[x.id];
    switch (cat) {
      case 'Listening detail': return x.skill === 'Listening';
      case 'Inference': return x.cat === 'Inference' || /NOT GIVEN|추론|推理|중심|可以知道/.test(x.q);
      case 'Vocabulary': return x.skill === 'Vocabulary';
      case 'Grammar': return x.skill === 'Grammar' || (APP === 'hsk' && x.skill === 'Writing');
      case 'Pronunciation': return x.skill === 'Pronunciation';
      case 'Time pressure': return !!(it && it.responseTime > slowMs(x.skill));
      case 'Spelling': return x.skill === 'Writing';
      default: return !!(it && it.wrong);
    }
  }

  /* ================= 문제 출제 (Smart Review + 약점 우선) ================= */
  var reviewQueue = [], practiceSkill = null, lastId = null, cur = null;
  function pickQuestion() {
    var now = Date.now(), all = allQuestions();
    while (reviewQueue.length) {
      var rid = reviewQueue.shift(), hit = all.find(function (z) { return z.id === rid; });
      if (hit) return { x: hit, why: 'review' };
    }
    var pool = all.filter(inScope), cand = pool;
    if (practiceSkill) { var f = pool.filter(function (z) { return z.skill === practiceSkill; }); if (f.length) cand = f; else { f = all.filter(function (z) { return z.skill === practiceSkill; }); if (f.length) cand = f; } }
    if (cand.length > 1) cand = cand.filter(function (z) { return z.id !== lastId; });
    var ph = phase(daysLeft());
    var due = cand.filter(function (z) { return E.items[z.id] && E.items[z.id].nextReview <= now; });
    if (due.length && Math.random() < 0.3 + ph.weak) return { x: due.sort(function (a, b) { return masteryOf(E.items[a.id]) - masteryOf(E.items[b.id]); })[0], why: 'due' };
    var top = dna().top;
    if (top && Math.random() < 0.15 + ph.weak / 2) { var wk = cand.filter(function (z) { return catMatch(z, top); }); if (wk.length) return { x: wk[Math.floor(Math.random() * wk.length)], why: 'weak', cat: top }; }
    var unseen = cand.filter(function (z) { return !E.items[z.id]; });
    if (unseen.length && Math.random() < 0.35 + ph.nw) return { x: unseen[Math.floor(Math.random() * unseen.length)], why: 'new' };
    var least = cand.slice().sort(function (a, b) { var ia = E.items[a.id], ib = E.items[b.id]; return (ia ? ia.lastReviewed : 0) - (ib ? ib.lastReviewed : 0); });
    return { x: least[0] || pool[0], why: 'practice' };
  }
  var WHY = { review: T('복습 시기', 'Due for review'), due: T('복습 시기', 'Due for review'), weak: T('약점 우선', 'Weak area'), new: T('새 문제', 'New'), practice: T('실전 연습', 'Practice') };

  showQuestion = function () {
    var p = pickQuestion(), x = p.x;
    if (!x) return;
    lastId = x.id;
    var order = shuffle(x.a.map(function (_, i) { return i; })), right = order.indexOf(x.correct);
    cur = { x: x, t0: performance.now(), answered: false };
    q('#question').textContent = (test + 1) + '. ' + x.q;
    var meta = q('#qMeta');
    if (!meta) { meta = document.createElement('div'); meta.id = 'qMeta'; meta.className = 'qmeta'; q('#question').before(meta); }
    meta.innerHTML = '<span class="chip-s">' + esc(skillLabel(x.skill)) + '</span><span class="chip-s">' + esc(WHY[p.why] || '') + (p.cat ? ' · ' + esc(catLabel(p.cat)) : '') + '</span>' + (practiceSkill ? '<span class="chip-s">' + T('미션: ', 'Mission: ') + esc(skillLabel(practiceSkill)) + ' <button type="button" class="linkbtn" id="clearSkill">' + T('해제', 'clear') + '</button></span>' : '') + (E.items[x.id] ? '<span class="chip-s">' + T('복습 간격 ', 'Interval ') + E.items[x.id].interval + T('일', 'd') + '</span>' : '');
    var cs = q('#clearSkill'); if (cs) cs.onclick = function () { practiceSkill = null; showQuestion(); };
    q('#options').innerHTML = order.map(function (oi, i) { return '<button class="option" type="button" data-i="' + i + '">' + esc(x.a[oi]) + '</button>'; }).join('');
    q('#testResult').textContent = '';
    showQuestionAudio(x);
    qa('.option').forEach(function (o) {
      o.onclick = function () {
        if (cur.answered) return; cur.answered = true;
        var rt = performance.now() - cur.t0, i = +o.dataset.i, ok = i === right;
        qa('.option').forEach(function (z) { z.disabled = true; });
        o.classList.add(ok ? 'good' : 'bad'); if (!ok) qa('.option')[right].classList.add('good');
        o.setAttribute('aria-label', (ok ? T('정답: ', 'Correct: ') : T('오답: ', 'Wrong: ')) + o.textContent);
        if (ok) { state.correct++; state.xp += 10; } else state.wrong.push(x.q);
        state.done++; save(); render();
        record(x.id, { skill: x.skill, text: x.q, cat: x.cat, kind: 'q' }, ok, rt);
        if (ok) q('#testResult').innerHTML = T('정답입니다. +10 XP', 'Correct. +10 XP') + '<br><small>' + esc(explainAnswer(x, true)) + '</small>' + (rt > slowMs(x.skill) ? '<br><small>' + T('⏱ 답하는 데 오래 걸려서 복습 간격을 짧게 잡았어요.', '⏱ You took a while, so this comes back sooner.') + '</small>' : '');
        else renderCoach(x, x.a[order[i]], rt);
        showAnswerAudio(x);
        refreshHome();
      };
    });
  };

  /* ================= AI 코치 (오답 피드백) ================= */
  var CONCEPT = {
    topik: { Vocabulary: '어휘는 뜻만 외우지 말고 함께 쓰이는 말(연어)과 예문으로 익히세요.', Grammar: '문법 표현은 앞뒤 문장의 관계(이유·대조·조건·목적)를 먼저 보고 고르세요.', Listening: '듣기는 질문을 먼저 읽고 시간·장소·숫자 같은 핵심 정보에 집중하세요.', Reading: '읽기는 반복되는 핵심어와 마지막 문장의 결론을 확인하세요.', Writing: 'TOPIK II 쓰기는 문장 연결과 자료의 수치 비교(증가·감소)를 정확히 표현해야 합니다.' },
    hsk: { Vocabulary: '단어는 한자·병음·뜻을 함께 기억하고 예문으로 쓰임을 확인하세요.', Listening: '듣기는 시간·숫자·장소와 “虽然…但是”, “因为…所以” 같은 연결어를 잡으세요.', Reading: '독해는 문장의 목적(为了)·원인(因为)·전환(但是)을 보여 주는 표지어를 찾으세요.', Writing: '중국어 어순은 주어-부사어-동사-목적어가 기본입니다. 把·比·被 구문의 자리를 확인하세요.', Pronunciation: '성조는 1성(높고 평평)·2성(올라감)·3성(내렸다 올라감)·4성(떨어짐)을 구별해 소리 내 보세요.' },
    ielts: { Listening: 'Read the question first and listen for the exact detail (numbers, dates, corrections such as “not the fifth”).', Reading: 'TRUE = the passage says it; FALSE = the passage says the opposite; NOT GIVEN = the passage does not say.', Writing: 'Match the register and task: formal letters, clear overviews and precise trend language.', Speaking: 'Extend answers: opinion → reason → example.', Vocabulary: 'Learn words with collocations and paraphrases, not as single translations.', Grammar: 'Check agreement (the number of … has) and tense/time expressions (since/for).' }
  };
  var WHYTXT = {
    'Listening detail': T('들은 내용의 세부 정보(숫자·시간·장소·정정된 정보)를 놓쳤어요.', 'A key detail (number, time, place or a correction) was missed.'),
    Inference: T('글에 직접 쓰이지 않은 내용을 추론하는 문제예요. 근거 문장을 먼저 찾으세요.', 'This asks you to infer or check what the text actually says. Find the evidence first.'),
    Vocabulary: T('단어의 정확한 뜻이나 쓰임을 헷갈렸어요.', 'The exact meaning or use of the word was confused.'),
    Grammar: T('문장 구조나 문법 표현의 기능을 헷갈렸어요.', 'The sentence structure or grammar function was confused.'),
    'Time pressure': T('답하는 데 시간이 오래 걸렸어요. 실제 시험에서는 시간 관리가 중요해요.', 'You took a long time. Time management matters in the real exam.'),
    Pronunciation: T('발음·성조 구별이 필요한 문제예요.', 'This needs sound/tone discrimination.'),
    Spelling: T('철자·표기를 정확히 확인하세요.', 'Check the spelling carefully.'),
    'Question type': T('문제 유형이 요구하는 답의 형식을 다시 확인하세요.', 'Re-check what this question type is asking for.')
  };
  function renderCoach(x, picked, rt) {
    var cat = classify({ skill: x.skill, text: x.q, cat: x.cat }, rt);
    var sim = allQuestions().filter(function (z) { return z.skill === x.skill && z.id !== x.id && inScope(z); });
    if (!sim.length) sim = allQuestions().filter(function (z) { return z.skill === x.skill && z.id !== x.id; });
    sim = shuffle(sim);
    var ex = sim[0], pr = sim[1] || sim[0];
    var box = q('#testResult');
    box.innerHTML = '<div class="coach" role="region" aria-label="' + T('AI 코치 피드백', 'AI coach feedback') + '">' +
      '<p><b>' + T('✗ 오답 · 스마트 복습에 추가했어요', '✗ Incorrect · added to Smart Review') + '</b></p>' +
      '<ol class="coach-steps">' +
      '<li><b>' + T('정답', 'Answer') + '</b> ' + esc(x.a[x.correct]) + ' <small>(' + T('내 답: ', 'your answer: ') + esc(picked) + ')</small></li>' +
      '<li><b>' + T('왜 틀렸는지', 'Why it was wrong') + '</b> ' + esc(WHYTXT[cat] || '') + '</li>' +
      '<li><b>' + T('핵심 개념', 'Key idea') + '</b> ' + esc((CONCEPT[APP] || {})[x.skill] || '') + '</li>' +
      (ex ? '<li><b>' + T('비슷한 예', 'Similar example') + '</b> ' + esc(ex.q) + ' → <b>' + esc(ex.a[ex.correct]) + '</b></li>' : '') +
      (pr ? '<li><b>' + T('새로운 연습문제', 'New practice question') + '</b> <span id="coachPracticeQ">' + esc(pr.q) + '</span><div class="row" style="justify-content:flex-start;margin-top:6px" id="coachPractice">' + shuffle(pr.a.map(function (_, i) { return i; })).map(function (i) { return '<button type="button" class="btn soft" data-ci="' + i + '">' + esc(pr.a[i]) + '</button>'; }).join('') + '</div><div id="coachPracticeRes" aria-live="polite"></div></li>' : '') +
      '</ol>' +
      '<div class="row" style="justify-content:flex-start"><button type="button" class="btn soft" id="aiCoachBtn">🤖 ' + T('AI 코치에게 더 자세히 묻기', 'Ask the AI coach for more') + '</button></div><div id="aiCoachOut" class="feedback hide" aria-live="polite"></div></div>';
    if (pr) {
      var t1 = performance.now();
      qa('#coachPractice [data-ci]').forEach(function (b) {
        b.onclick = function () {
          var ok = +b.dataset.ci === pr.correct;
          qa('#coachPractice [data-ci]').forEach(function (z) { z.disabled = true; });
          q('#coachPracticeRes').textContent = ok ? T('✓ 정답! ', '✓ Correct! ') : T('✗ 오답 · 정답: ', '✗ Wrong · answer: ') + pr.a[pr.correct];
          record(pr.id, { skill: pr.skill, text: pr.q, cat: pr.cat, kind: 'q' }, ok, performance.now() - t1);
        };
      });
    }
    q('#aiCoachBtn').onclick = function () { askCoach(x, picked, cat); };
  }
  function aiEndpoint() { return String((window.LANGUAGE_APP_RUNTIME || {}).aiEndpoint || C.aiEndpoint || '').replace(/\/$/, ''); }
  var LANG = APP === 'topik' ? 'ko' : APP === 'hsk' ? 'zh' : 'en', EXAM = APP === 'topik' ? 'TOPIK' : APP === 'hsk' ? 'HSK' : 'IELTS';
  var OFFLINE = T('인터넷 연결이 필요한 기능입니다.', 'This feature needs an internet connection.');
  /* 게이트웨이 호출: timeout · retry(1회) · HTTP/CORS/JSON 오류 구분 · 무한 로딩 없음 */
  function aiCall(message, opts) {
    opts = opts || {};
    var timeout = opts.timeout || 18000, retries = opts.retries == null ? 1 : opts.retries;
    if (!navigator.onLine) return Promise.reject(new Error('OFFLINE'));
    var ep = aiEndpoint(); if (!ep) return Promise.reject(new Error('NO_ENDPOINT'));
    var attempt = function (n) {
      var ctl = new AbortController(), timer = setTimeout(function () { ctl.abort(); }, timeout);
      return fetch(ep, { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: ctl.signal,
        body: JSON.stringify({ language: LANG, exam: EXAM, level: levelKey(), scenario: opts.scenario || 'coach', message: message.slice(0, 2900), conversationHistory: opts.history || [], track: APP === 'ielts' ? levelKey() : undefined, showTranslation: false }) })
        .then(function (res) {
          if (res.status === 429) { var e = new Error('LIMIT'); e.noRetry = true; throw e; }
          if (!res.ok) throw new Error('HTTP_' + res.status);
          return res.text().then(function (t) { var j; try { j = JSON.parse(t); } catch (e) { throw new Error('BAD_JSON'); } if (!j || typeof j.reply !== 'string' || !j.reply.trim()) throw new Error('EMPTY'); return j.reply; });
        })
        .catch(function (err) {
          var e = err && err.name === 'AbortError' ? new Error('TIMEOUT') : err && err.message === 'Failed to fetch' ? new Error('NETWORK_OR_CORS') : err;
          if (n < retries && !e.noRetry) return new Promise(function (r) { setTimeout(r, 800); }).then(function () { return attempt(n + 1); });
          throw e;
        })
        .finally(function () { clearTimeout(timer); });
    };
    return attempt(0);
  }
  function aiErrorText(err) {
    var m = String(err && err.message || err);
    if (m === 'OFFLINE') return OFFLINE;
    if (m === 'LIMIT') return T('오늘 AI 서버의 무료 사용량이 모두 소진되었습니다. 위의 기본 피드백을 참고하세요.', "Today's free AI capacity is used up. Please use the feedback above.");
    if (m === 'TIMEOUT') return T('AI 응답이 늦어 중단했어요(시간 초과). 위의 기본 피드백을 참고하거나 다시 시도하세요.', 'The AI took too long (timeout). Use the feedback above or try again.');
    return T('AI 코치에 연결하지 못했어요. 위의 기본 피드백을 참고하세요.', 'Could not reach the AI coach. Please use the feedback above.');
  }
  function coachUsage() { var u = jget(K + 'coach-usage', {}); if (u.day !== today()) u = { day: today(), n: 0 }; return u; }
  function askCoach(x, picked, cat) {
    var out = q('#aiCoachOut'), btn = q('#aiCoachBtn');
    out.classList.remove('hide');
    var u = coachUsage();
    if (u.n >= 10) { out.textContent = T('AI 코치는 하루 10번까지 사용할 수 있어요. 내일 다시 이용해 주세요.', 'The AI coach is limited to 10 uses per day.'); return; }
    if (!navigator.onLine) { out.textContent = OFFLINE; return; }
    btn.disabled = true; out.textContent = T('AI 코치가 설명을 준비하고 있어요…', 'The AI coach is preparing an explanation…');
    var msg = EN
      ? 'COACH MODE (not role-play). A learner answered this practice question incorrectly.\nQuestion: ' + x.q + '\nOptions: ' + x.a.join(' / ') + '\nLearner answer: ' + picked + '\nCorrect answer: ' + x.a[x.correct] + '\nReply in plain text with exactly five short numbered lines: 1) Correct answer 2) Why the learner was wrong 3) Key concept 4) A similar example 5) One new practice question with three options (put the answer in brackets at the end).'
      : '코치 모드(역할극 아님). 학습자가 연습문제를 틀렸습니다.\n문제: ' + x.q + '\n보기: ' + x.a.join(' / ') + '\n학습자 답: ' + picked + '\n정답: ' + x.a[x.correct] + '\n한국어 설명으로, 번호가 붙은 짧은 다섯 줄만 쓰세요: 1) 정답 2) 왜 틀렸는지 3) 핵심 개념 4) 비슷한 예 5) 보기 세 개가 있는 새 연습문제 1개(정답은 마지막에 괄호로).';
    aiCall(msg, { scenario: 'coach', timeout: 18000, retries: 1 })
      .then(function (reply) { u.n++; localStorage.setItem(K + 'coach-usage', JSON.stringify(u)); out.innerHTML = '<b>🤖 ' + T('AI 코치', 'AI coach') + '</b> <small>' + T('(AI 학습 피드백 · 참고용)', '(AI learning feedback · for practice only)') + '</small><div style="white-space:pre-line;margin-top:6px">' + esc(reply) + '</div>'; })
      .catch(function (err) { console.warn('[AI coach]', err && err.message); out.textContent = aiErrorText(err); })
      .finally(function () { btn.disabled = false; });
  }

  /* ================= 단어 · 발음(쉐도잉) 기록 ================= */
  var wordShownAt = performance.now();
  var baseShowWord = showWord;
  showWord = function () {
    baseShowWord();
    wordShownAt = performance.now();
    if (APP === 'hsk') hskWordCard();
  };
  function curWord() { return C.words[vocab % C.words.length]; }
  function hskParts(w) {   /* "你好 nǐhǎo" → 汉字 / 拼音 */
    var s = String(w[0] || ''), han = (s.match(/[㐀-鿿，。！？、]+/g) || []).join(''), py = s.replace(/[㐀-鿿，。！？、]+/g, '').trim();
    return { han: han || s, py: py };
  }
  function hskWordCard() {
    var w = curWord(), p = hskParts(w);
    q('#word').innerHTML = '<span class="hz-big" lang="zh-CN">' + esc(p.han) + '</span>' + (p.py ? '<span class="py">' + esc(p.py) + '</span>' : '');
    q('#word').setAttribute('aria-label', p.han + ' ' + p.py);
  }
  var knowBtn = q('#know'), againBtn = q('#again');
  if (knowBtn && againBtn) {
    var oldKnow = knowBtn.onclick, oldAgain = againBtn.onclick;
    knowBtn.onclick = function (e) { var w = curWord(); record('w:' + hash(w[0]), { skill: 'Vocabulary', text: w[0], kind: 'w' }, true, performance.now() - wordShownAt, { kind: 'w' }); oldKnow && oldKnow.call(this, e); refreshHome(); };
    againBtn.onclick = function (e) { var w = curWord(); record('w:' + hash(w[0]), { skill: 'Vocabulary', text: w[0], kind: 'w' }, false, performance.now() - wordShownAt, { kind: 'w' }); oldAgain && oldAgain.call(this, e); refreshHome(); };
  }
  var flash = q('#flash');
  if (flash && APP === 'hsk') { var oldFlash = flash.onclick; flash.onclick = function (e) { oldFlash && oldFlash.call(this, e); hskWordCard(); var w = curWord(); q('#meaning').textContent = '뜻: ' + w[1]; q('#example').textContent = '예문: ' + w[2]; }; }

  /* 쉐도잉: 듣기 → 녹음 → 음성 인식 → 원문 비교 → 다시 말하기 */
  function tokens(s) {
    s = normalizeSpeech(s);
    if (APP === 'hsk') return s.replace(/\s/g, '').split('');
    if (APP === 'topik') return s.replace(/\s/g, '').split('');
    return s.split(' ').filter(Boolean);
  }
  function lcsAlign(a, b) {
    var n = a.length, m = b.length, dp = [];
    for (var i = 0; i <= n; i++) { dp.push(new Array(m + 1).fill(0)); }
    for (i = n - 1; i >= 0; i--) for (var j = m - 1; j >= 0; j--) dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    var hit = new Array(n).fill(false); i = 0; j = 0;
    while (i < n && j < m) { if (a[i] === b[j]) { hit[i] = true; i++; j++; } else if (dp[i + 1][j] >= dp[i][j + 1]) i++; else j++; }
    return hit;
  }
  function runs(tok, hit, want) {
    var out = [], buf = [];
    var sep = APP === 'ielts' ? ' ' : '';
    tok.forEach(function (t, i) { if (hit[i] === want) buf.push(t); else if (buf.length) { out.push(buf.join(sep)); buf = []; } });
    if (buf.length) out.push(buf.join(sep));
    return out;
  }
  var baseGrade = gradeSpeech;
  gradeSpeech = function (heard) {
    var sentence = q('#sentence').textContent, a = tokens(sentence), b = tokens(heard), hit = lcsAlign(a, b);
    var score = speechScore(normalizeSpeech(sentence), normalizeSpeech(heard));
    var sep = APP === 'ielts' ? ' ' : '';
    var marked = a.map(function (t, i) { return hit[i] ? '<mark class="ok">' + esc(t) + '</mark>' : '<mark class="miss">' + esc(t) + '</mark>'; }).join(sep);
    var good = runs(a, hit, true), miss = runs(a, hit, false);
    state.xp += Math.round(score / 10); state.done++; if (score < 65) state.wrong.push(sentence); save(); render();
    record('s:' + hash(sentence), { skill: speechSkill(), text: sentence, kind: 'speech' }, score >= 65, 0, { kind: 'speech' });
    setStep(4);
    q('#speechFeedback').innerHTML = '<div class="shadow-res">' +
      '<p><b>' + score + '% ' + T('일치', 'match') + '</b> · ' + (score >= 85 ? T('매우 정확합니다.', 'Very accurate.') : score >= 65 ? T('좋습니다. 표시된 부분만 다시 연습해 보세요.', 'Good. Practise the marked part again.') : T('문장을 천천히 끊어 다시 말해 보세요.', 'Say it again slowly, phrase by phrase.')) + '</p>' +
      '<dl><dt>' + T('원문', 'Original') + '</dt><dd lang="' + C.lang + '">' + marked + '</dd>' +
      '<dt>' + T('인식된 문장', 'Recognised') + '</dt><dd lang="' + C.lang + '">' + esc(heard) + '</dd>' +
      '<dt>' + T('일치한 부분', 'Matched') + '</dt><dd>' + (good.length ? esc(good.join(' · ')) : '—') + '</dd>' +
      '<dt>' + T('다시 연습할 부분', 'Practise again') + '</dt><dd>' + (miss.length ? esc(miss.join(' · ')) : T('없음 ✓', 'None ✓')) + '</dd></dl>' +
      '<div class="row" style="justify-content:flex-start"><button type="button" class="btn soft" id="shadowReplay">▶ ' + T('원문 다시 듣기', 'Listen again') + '</button>' + (miss.length ? '<button type="button" class="btn soft" id="shadowMiss">🔊 ' + T('틀린 부분 듣기', 'Play missed part') + '</button>' : '') + '<button type="button" class="btn primary" id="shadowAgain">● ' + T('다시 말하기', 'Say it again') + '</button></div></div>';
    q('#shadowReplay').onclick = function () { setStep(1); speakText(sentence); };
    if (q('#shadowMiss')) q('#shadowMiss').onclick = function () { speakText(miss.join(APP === 'ielts' ? ', ' : '，'), true); };
    q('#shadowAgain').onclick = function () { setStep(5); q('#record').click(); };
    refreshHome();
  };
  window.gradeSpeechBase = baseGrade;
  function setStep(n) { qa('#shadowSteps li').forEach(function (li, i) { li.classList.toggle('on', i + 1 === n); li.classList.toggle('done', i + 1 < n); }); }
  function installShadowing() {
    var card = q('#speaking .card'); if (!card || q('#shadowSteps')) return;
    var steps = document.createElement('ol'); steps.id = 'shadowSteps'; steps.className = 'steps';
    steps.setAttribute('aria-label', T('쉐도잉 단계', 'Shadowing steps'));
    steps.innerHTML = [T('듣기', 'Listen'), T('녹음', 'Record'), T('음성 인식', 'Recognise'), T('원문 비교', 'Compare'), T('다시 말하기', 'Say again')].map(function (s, i) { return '<li>' + (i + 1) + '. ' + s + '</li>'; }).join('');
    card.insertBefore(steps, card.firstChild);
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      var rec = q('#record'); if (rec) { rec.disabled = true; rec.textContent = T('● 음성 인식 미지원', '● Speech recognition unavailable'); }
      var note = document.createElement('p'); note.className = 'notice-s'; note.setAttribute('role', 'note');
      note.textContent = T('이 브라우저는 음성 인식을 지원하지 않아요. 듣기와 따라 말하기 연습은 그대로 할 수 있고, 발음 비교는 Android Chrome 또는 PC Chrome에서 이용해 주세요.', 'This browser does not support speech recognition. You can still listen and repeat; use Chrome on Android or desktop for pronunciation comparison.');
      card.appendChild(note);
    }
    var listen = q('#listen'); if (listen) listen.addEventListener('click', function () { setStep(1); });
    var recb = q('#record'); if (recb) recb.addEventListener('click', function () { setStep(2); });
    setStep(1);
  }
  /* 인식 중 표시 → 3단계 */
  new MutationObserver(function () { var f = q('#speechFeedback'); if (f && /^인식 중|^Recognising/.test(f.textContent)) setStep(3); }).observe(q('#speechFeedback') || document.body, { childList: true, characterData: true, subtree: true });

  /* ================= TTS 표시 정리 (음성 이름·오류 코드 대신 안내 문구) ================= */
  showVoiceInfo = function () {
    var ok = window.TTS && TTS.supported;
    var msg = ok ? T('🔊 ' + (APP === 'hsk' ? '중국어' : APP === 'topik' ? '한국어' : '영어') + ' 음성으로 재생합니다.', '🔊 Plays with an English voice.') : T('이 브라우저는 음성 재생을 지원하지 않습니다.', 'This browser cannot play speech.');
    if (q('#wordVoiceInfo')) q('#wordVoiceInfo').textContent = msg;
  };
  if (window.TTS && TTS.on) TTS.on(function (type) {
    if (type === 'error') { var m = T('음성을 재생하지 못했어요. 볼륨·무음 모드를 확인하고 다시 눌러 주세요.', 'Could not play audio. Check volume/silent mode and tap again.'); if (q('#speechFeedback')) q('#speechFeedback').textContent = m; if (q('#wordVoiceInfo')) q('#wordVoiceInfo').textContent = m; }
  });

  /* ================= Smart Review 화면 ================= */
  var baseShowReview = showReview;
  showReview = function () {
    var host = q('#engineReview');
    if (!host) { host = document.createElement('div'); host.id = 'engineReview'; q('#review h2').after(host); }
    var now = Date.now(), items = Object.keys(E.items).map(function (k) { return E.items[k]; });
    var due = items.filter(function (it) { return it.nextReview && it.nextReview <= now; }).sort(function (a, b) { return a.mastery - b.mastery; });
    var soon = items.filter(function (it) { return it.nextReview && it.nextReview > now; }).sort(function (a, b) { return a.nextReview - b.nextReview; }).slice(0, 6);
    var qDue = due.filter(function (it) { return it.id.indexOf('q:') === 0 && allQuestions().some(function (z) { return z.id === it.id; }); });
    var fmt = function (t) { var d = Math.round((t - now) / DAY * 10) / 10; return d <= 0 ? T('지금', 'now') : d < 1 ? T('오늘', 'today') : T(Math.ceil(d) + '일 후', 'in ' + Math.ceil(d) + 'd'); };
    var row = function (it) { return '<div class="review-item"><span><b>' + esc(it.text.slice(0, 80)) + '</b><br><small>' + esc(skillLabel(it.skill)) + ' · ' + T('정답 ', 'right ') + it.correct + ' / ' + T('오답 ', 'wrong ') + it.wrong + ' · ' + T('숙련도 ', 'mastery ') + masteryOf(it) + ' · ' + T('간격 ', 'interval ') + it.interval + T('일', 'd') + (it.responseTime ? ' · ' + (it.responseTime / 1000).toFixed(1) + T('초', 's') : '') + ' · ' + T('다음 복습 ', 'next ') + fmt(it.nextReview) + '</small></span></div>'; };
    host.innerHTML = '<div class="card" style="margin-top:12px"><p class="eyebrow">SMART REVIEW · 1 · 3 · 7 · 14 · 30</p><h3>' + T('지금 복습할 항목 ', 'Due now ') + due.length + '</h3>' +
      '<p class="small-s">' + T('정답이면 간격이 1→3→7→14→30일로 늘고, 틀리거나 정답률이 낮거나 답이 오래 걸리면 간격이 짧아져요.', 'Correct answers stretch the interval 1→3→7→14→30 days; mistakes, low accuracy or slow answers shorten it.') + '</p>' +
      '<div class="row" style="justify-content:flex-start">' + (qDue.length ? '<button type="button" class="btn primary" id="startReview">' + T('문제 복습 시작 ', 'Start review ') + '(' + qDue.length + ')</button>' : '') + '</div>' +
      '<div class="review-list">' + (due.slice(0, 12).map(row).join('') || '<div class="review-item"><span>' + T('지금 복습할 항목이 없어요. 문제·단어·발음 연습을 하면 자동으로 일정이 잡혀요.', 'Nothing is due. Practice questions, words and speaking to build your schedule.') + '</span></div>') + '</div>' +
      (soon.length ? '<h3 style="margin-top:16px">' + T('다가오는 복습', 'Coming up') + '</h3><div class="review-list">' + soon.map(row).join('') + '</div>' : '') +
      '</div><h3 style="margin-top:18px">' + T('이전 오답 기록', 'Earlier mistakes') + '</h3>';
    var sb = q('#startReview');
    if (sb) sb.onclick = function () { reviewQueue = qDue.map(function (it) { return it.id; }); practiceSkill = null; goPage('test'); };
    baseShowReview();
  };

  /* ================= 오늘의 10분 미션 · D-Day · 준비도 · 약점 지도 · DNA · 주간 리포트 ================= */
  function missionPlan() {
    var mins = +(profile().minutes || 10), d = daysLeft(), ph = phase(d), weak = weakestSkill();
    var B;
    if (APP === 'ielts') B = [
      { k: 'vocab', label: 'Vocabulary', go: 'words', skill: 'Vocabulary', w: ph.nw, unit: 'words' },
      { k: 'listen', label: 'Listening', go: 'test', skill: 'Listening', w: ph.prac, unit: 'questions' },
      { k: 'speak', label: 'Speaking', go: 'speaking', skill: 'Speaking', w: ph.speak, unit: 'sentences' },
      { k: 'weak', label: 'Weak Point Review · ' + weak, go: 'test', skill: weak, w: ph.weak, unit: 'questions', weak: true }];
    else if (APP === 'topik') B = [
      { k: 'vocab', label: '어휘', go: 'words', skill: 'Vocabulary', w: ph.nw, unit: '단어' },
      { k: 'read', label: '읽기', go: 'test', skill: 'Reading', w: ph.prac / 2, unit: '문제' },
      { k: 'listen', label: '듣기', go: 'test', skill: 'Listening', w: ph.prac / 2 + ph.speak / 2, unit: '문제' },
      { k: 'weak', label: '오답복습 · ' + (SK_KO[weak] || weak), go: 'review', skill: weak, w: ph.weak + ph.speak / 2, unit: '항목', weak: true }];
    else B = [
      { k: 'vocab', label: '단어', go: 'words', skill: 'Vocabulary', w: ph.nw, unit: '단어' },
      { k: 'listen', label: '듣기', go: 'test', skill: 'Listening', w: ph.prac / 2, unit: '문제' },
      { k: 'read', label: '문장', go: 'test', skill: 'Reading', w: ph.prac / 2, unit: '문제' },
      { k: 'speak', label: '발음', go: 'speaking', skill: 'Pronunciation', w: ph.speak, unit: '문장' },
      { k: 'weak', label: '복습 · ' + (SK_KO[weak] || weak), go: 'review', skill: weak, w: ph.weak, unit: '항목', weak: true }];
    var sw = B.reduce(function (a, b) { return a + b.w; }, 0);
    var per = { words: 3, '단어': 3, questions: 2, '문제': 2, sentences: 2, '문장': 2, '항목': 3 };
    B.forEach(function (b) { b.min = Math.max(1, Math.round(mins * b.w / sw)); b.target = Math.max(1, b.min * (per[b.unit] || 2)); });
    var tl = E.log.filter(function (l) { return l.t >= new Date(today() + 'T00:00:00').getTime(); });
    B.forEach(function (b) {
      b.done = tl.filter(function (l) {
        if (b.go === 'words') return l.k === 'w';
        if (b.go === 'speaking') return l.k === 'speech';
        if (b.weak) return l.rv || l.s === b.skill && !l.ok || (b.go === 'test' && l.s === b.skill);
        return l.k === 'q' && l.s === b.skill;
      }).length;
    });
    var dd = dayRec();
    B.forEach(function (b) { if (b.done >= b.target && dd.blocks.indexOf(b.k) < 0) { dd.blocks.push(b.k); dd.lessons++; saveE(); } });
    return { mins: mins, d: d, ph: ph, blocks: B, weak: weak };
  }
  function goPage(page) { var b = q('.nav[data-page="' + page + '"]'); if (b) b.click(); window.scrollTo(0, 0); }
  function startBlock(b) {
    practiceSkill = b.go === 'test' ? b.skill : null;
    if (APP === 'ielts' && (b.go === 'test' || b.go === 'speaking') && ['Listening', 'Reading', 'Writing', 'Speaking'].indexOf(b.skill) >= 0) {
      var key = track() + '-' + b.skill.toLowerCase(); if (C.levels[key] && levelKey() !== key) { setLevel(key); if (q('#levelSelect')) q('#levelSelect').value = key; }
    }
    goPage(b.go === 'review' ? 'review' : b.go);
    if (b.go === 'test') { test++; showQuestion(); }
  }
  var STATUS = { strong: ['●', T('강함', 'Strong')], ok: ['◐', T('보통', 'Fair')], weak: ['○', T('복습 필요', 'Needs review')], none: ['–', T('기록 부족', 'Not enough data')] };
  function engineHome() {
    var home = q('#home'); if (!home) return;
    var box = q('#engineHome');
    if (!box) { box = document.createElement('div'); box.id = 'engineHome'; var hero = home.querySelector('.hero'); if (hero) hero.after(box); else home.prepend(box); }
    var mp = missionPlan(), rd = readiness(), dn = dna(), t = targetExam(), p = profile();
    var total = mp.blocks.reduce(function (a, b) { return a + b.target; }, 0), done = mp.blocks.reduce(function (a, b) { return a + Math.min(b.target, b.done); }, 0);
    var dText = mp.d == null ? T('시험일 미설정', 'No exam date') : mp.d > 0 ? 'D-' + mp.d : mp.d === 0 ? 'D-DAY' : T('시험 종료', 'Exam passed');
    var ddayCard = '<section class="card eng-card" aria-label="' + T('시험 D-Day', 'Exam countdown') + '"><p class="eyebrow">EXAM D-DAY</p>' +
      '<div class="dday-row"><b class="dday-num">' + esc(dText) + '</b><div><div>' + T('목표: ', 'Goal: ') + '<b>' + esc(p.goal || (t && t.name) || T('미설정', 'not set')) + '</b>' + (t ? ' · ' + esc(t.date) : '') + '</div>' +
      '<div>' + T('현재 시험 준비도 ', 'Current readiness ') + '<b>' + rd.overall + '%</b> · ' + T('오늘 학습량 ', "Today's load ") + '<b>' + mp.mins + T('분', ' min') + ' · ' + total + T('개', ' items') + '</b></div>' +
      '<div class="small-s">' + esc(mp.ph.label) + '</div></div></div>' + (mp.d == null ? '<button type="button" class="btn soft" id="setExamBtn">' + T('시험일 설정', 'Set exam date') + '</button>' : '') + '</section>';
    var missionCard = '<section class="card eng-card" aria-label="' + T('오늘의 10분 미션', "Today's mission") + '"><p class="eyebrow">TODAY\'S ' + mp.mins + '-MIN MISSION</p><h3>' + T('오늘의 ' + mp.mins + '분 미션', "Today's " + mp.mins + '-minute mission') + ' <small>' + done + '/' + total + '</small></h3>' +
      '<div class="meter"><i style="width:' + (total ? Math.round(done * 100 / total) : 0) + '%"></i></div>' +
      '<ul class="mission">' + mp.blocks.map(function (b, i) { var fin = b.done >= b.target; return '<li class="' + (fin ? 'fin' : '') + '"><span><b>' + esc(b.label) + '</b> ' + b.min + T('분', ' min') + ' · ' + Math.min(b.done, b.target) + '/' + b.target + ' ' + esc(b.unit) + (fin ? ' <span class="okmark">✓ ' + T('완료', 'done') + '</span>' : '') + '</span><button type="button" class="btn ' + (fin ? 'soft' : 'primary') + '" data-mb="' + i + '">' + (fin ? T('더 하기', 'More') : T('시작', 'Start')) + '</button></li>'; }).join('') + '</ul>' +
      '<p class="small-s">' + T('시험일·목표·최근 정답률·약점·오답으로 매일 다시 계산해요. 오늘의 약점: ', 'Rebuilt daily from your exam date, goal, recent accuracy, weak areas and mistakes. Focus today: ') + '<b>' + esc(skillLabel(mp.weak)) + '</b></p></section>';
    var readyCard = '<section class="card eng-card" aria-label="' + T('시험 준비도와 약점 지도', 'Readiness and weakness map') + '"><p class="eyebrow">' + T('시험 준비도 · WEAKNESS MAP', 'READINESS · WEAKNESS MAP') + '</p><h3>' + T('시험 준비도 ', 'Exam readiness ') + 'Overall ' + rd.overall + '%</h3>' +
      '<div class="wmap">' + SKILLS.map(function (s) { var x = rd.by[s], stt = STATUS[x.status]; return '<div class="wrow' + (x.inExam ? '' : ' muted') + '"><span class="wname">' + esc(skillLabel(s)) + '</span><span class="wbar"><i style="width:' + x.ready + '%"></i></span><span class="wval">' + x.ready + '%</span><span class="wst st-' + x.status + '">' + stt[0] + ' ' + stt[1] + '</span>' + (x.inExam ? '' : '<span class="small-s">' + T('TOPIK II 영역', 'n/a') + '</span>') + '</div>'; }).join('') + '</div>' +
      '<p class="small-s">' + T('시험 준비도는 합격 확률이 아니라, 이 앱에서 푼 문제·단어·발음 기록(최근 30일 정답률 × 숙련도 × 학습 범위)으로 계산한 진척도예요. ‘기록 부족’은 3회 미만 학습한 영역이에요.', 'Readiness is not a pass probability. It is a progress indicator from your in-app records (30-day accuracy × mastery × coverage). “Not enough data” = fewer than 3 attempts.') + '</p></section>';
    var dnaCard = '<section class="card eng-card" aria-label="Mistake DNA"><p class="eyebrow">MISTAKE DNA</p><h3>' + T('오답 원인 분석', 'Why I get things wrong') + ' <small>' + dn.total + T('건', '') + '</small></h3>' +
      (dn.rows.length ? dn.rows.slice(0, 4).map(function (r) { return '<div class="wrow"><span class="wname">' + esc(catLabel(r.cat)) + '</span><span class="wbar"><i style="width:' + r.pct + '%"></i></span><span class="wval">' + r.pct + '%</span></div>'; }).join('') + '<p class="small-s">' + T('가장 많이 반복되는 원인(', 'Most repeated cause (') + esc(catLabel(dn.top)) + T(')의 문제를 다음 학습에서 먼저 출제해요.', ') is prioritised in your next questions.') + '</p>' : '<p class="small-s">' + T('틀린 문제가 생기면 원인(어휘·문법·듣기 세부정보·추론·철자·발음·시간 압박·문제 유형)을 자동으로 분류해요.', 'Mistakes are classified automatically (vocabulary, grammar, listening detail, inference, spelling, pronunciation, time pressure, question type).') + '</p>') + '</section>';
    box.innerHTML = ddayCard + missionCard + readyCard + dnaCard + weeklyHtml(true);
    qa('#engineHome [data-mb]').forEach(function (b) { b.onclick = function () { startBlock(mp.blocks[+b.dataset.mb]); }; });
    var se = q('#setExamBtn'); if (se) se.onclick = function () { var nb = q('.nav[data-page="schedule"]'); if (nb) nb.click(); };
    var dq = q('#dailyQuest'); if (dq) dq.remove();
    var r = q('#ready'); if (r) r.textContent = rd.overall + '%';
    var rb = q('#readyBar'); if (rb) rb.style.width = rd.overall + '%';
    var rs = q('.readiness small'); if (rs) rs.textContent = T('시험 준비도', 'Readiness');
    var sk = q('#streak'); if (sk) sk.textContent = '🔥 ' + T(Math.max(1, streakCalc()) + '일 연속', Math.max(1, streakCalc()) + '-day streak');
  }
  function weekly() {
    var now = Date.now(), d0 = new Date(); d0.setHours(0, 0, 0, 0);
    var since = d0.getTime() - 6 * DAY, prev = since - 7 * DAY, days = [];
    for (var i = 6; i >= 0; i--) days.push(today(new Date(d0.getTime() - i * DAY)));
    var sec = 0, lessons = 0, rv = 0;
    days.forEach(function (d) { var x = E.days[d]; if (x) { sec += x.sec; lessons += x.lessons; rv += x.rv; } });
    var wk = E.log.filter(function (l) { return l.t >= since && l.k !== 'w'; }), pw = E.log.filter(function (l) { return l.t >= prev && l.t < since && l.k !== 'w'; });
    var acc = wk.length ? Math.round(wk.reduce(function (a, l) { return a + l.ok; }, 0) * 100 / wk.length) : null;
    var firstDay = days.find(function (d) { return E.days[d]; });
    var xp = firstDay && typeof state !== 'undefined' ? Math.max(0, state.xp - (E.days[firstDay].xp0 || 0)) : 0;
    var by = function (list) { var o = {}; list.forEach(function (l) { var x = o[l.s] || (o[l.s] = { a: 0, c: 0 }); x.a++; x.c += l.ok; }); return o; };
    var bw = by(wk), bp = by(pw), best = null, bestD = -1;
    Object.keys(bw).forEach(function (s) { if (bw[s].a < 2) return; var a = bw[s].c / bw[s].a, b = bp[s] && bp[s].a >= 2 ? bp[s].c / bp[s].a : null; var dlt = b == null ? a - 0.5 : a - b; if (dlt > bestD) { bestD = dlt; best = s; } });
    var rd = readiness(), weakS = null;
    rd.list.forEach(function (s) { var x = rd.by[s]; if (x.a >= 3 && (!weakS || x.ready < rd.by[weakS].ready)) weakS = s; });
    return { mins: Math.round(sec / 60), lessons: lessons, acc: acc, n: wk.length, rv: rv, streak: streakCalc(), xp: xp, best: best, bestD: bestD, weak: weakS };
  }
  function weeklyHtml(compact) {
    var w = weekly();
    var cells = [[T('학습시간', 'Study time'), w.mins + T('분', ' min')], [T('완료 lesson', 'Lessons done'), w.lessons], [T('정답률', 'Accuracy'), w.acc == null ? '—' : w.acc + '% (' + w.n + ')'], [T('복습량', 'Reviews'), w.rv], ['Streak', w.streak + T('일', ' days')], ['XP', '+' + w.xp],
      [T('가장 발전한 영역', 'Most improved'), w.best ? skillLabel(w.best) : '—'], [T('가장 취약한 영역', 'Weakest area'), w.weak ? skillLabel(w.weak) : '—']];
    return '<section class="card eng-card" aria-label="Weekly Report"><p class="eyebrow">WEEKLY REPORT</p><h3>' + T('이번 주 (최근 7일)', 'This week (last 7 days)') + '</h3><div class="wk">' + cells.map(function (c) { return '<div><span>' + esc(c[0]) + '</span><b>' + esc(c[1]) + '</b></div>'; }).join('') + '</div>' + (compact ? '' : '<p class="small-s">' + T('학습시간은 화면을 실제로 사용한 시간만 셉니다.', 'Study time counts only active use.') + '</p>') + '</section>';
  }
  function engineProgress() {
    var host = q('#engineProgress'), pr = q('#progress'); if (!pr) return;
    if (!host) { host = document.createElement('div'); host.id = 'engineProgress'; pr.appendChild(host); }
    host.innerHTML = weeklyHtml(false);
  }
  var busy = false;
  function refreshHome() { if (busy) return; busy = true; setTimeout(function () { busy = false; try { engineHome(); engineProgress(); } catch (e) { console.error('[engine] home', e); } }, 0); }
  installDailyQuest = function () {};   /* 기존 일반 안내(Daily Quest)는 실제 기록 기반 미션으로 대체 */
  var baseRender = render;
  render = function () { baseRender(); refreshHome(); };

  /* ================= TOPIK I/II · IELTS 표기 ================= */
  function labelLevels() {
    var sel = q('#levelSelect'); if (!sel || sel.dataset.eng) return;
    sel.dataset.eng = '1';
    if (APP === 'topik') {
      [].forEach.call(sel.options, function (o) { var n = +o.value; o.textContent = '학습 단계 ' + n + '급 (' + (n <= 2 ? 'TOPIK I 목표' : 'TOPIK II 목표') + ')'; });
      var note = document.createElement('p'); note.className = 'small-s'; note.id = 'topikNote';
      note.textContent = '공식 시험 구조: TOPIK I = 듣기·읽기 (1–2급 판정) · TOPIK II = 듣기·읽기·쓰기 (3–6급 판정). 1~6급은 이 앱의 학습 단계이며 시험 회차는 PBT·IBT 형식별로 ‘시험 일정’에서 확인하세요.';
      var lb = q('#levelBar'); if (lb) lb.appendChild(note);
    }
    if (APP === 'hsk') {
      var hn = document.createElement('p'); hn.className = 'small-s'; hn.textContent = '학습 단계 HSK 1–6급 (기존 진도 유지) · 7–9급 문제는 6급 단계에서 함께 연습합니다. 시험 일정은 ‘시험 일정’ 메뉴에서 확인하세요.';
      var hb = q('#levelBar'); if (hb) hb.appendChild(hn);
    }
  }
  var baseSetLevel = setLevel;
  setLevel = function (k) { baseSetLevel(k); reviewQueue = []; refreshHome(); };

  /* ================= AI 대화: 3턴 이상 · 턴 피드백 · 종료 후 종합 피드백 ================= */
  function userTurns() { return ((convSession && convSession.history) || []).filter(function (x) { return x.role === 'user'; }).length; }
  function convControls() {
    var row = q('#conversation .card .row'); if (!row || q('#convFinish')) return;
    var fin = document.createElement('button'); fin.id = 'convFinish'; fin.type = 'button'; fin.className = 'btn soft';
    fin.textContent = T('대화 종료 · 종합 피드백', 'End · full feedback');
    row.appendChild(fin);
    var info = document.createElement('p'); info.id = 'convTurns'; info.className = 'small-s'; info.setAttribute('aria-live', 'polite');
    q('#conversationLog').before(info);
    if (APP === 'ielts') { var lab = document.createElement('p'); lab.className = 'small-s'; lab.innerHTML = '<b>AI 학습 피드백 (AI learning feedback)</b> — practice feedback only, <b>not an official IELTS score</b>. Speaking Part 1 · Part 2 · Part 3 modes are in the menu.'; info.before(lab); }
    fin.onclick = finishConversation;
    var nb = q('#newConversation'); if (nb) nb.addEventListener('click', function () { convConf = []; updateTurns(); var s = q('#convSummary'); if (s) s.remove(); });
    updateTurns();
  }
  function updateTurns() {
    var n = userTurns(), info = q('#convTurns'), fin = q('#convFinish');
    if (info) info.textContent = T('대화 ' + n + '턴 · AI 질문 → 내 답 → 짧은 피드백(💡) → 다음 질문. 3턴 이상 대화하면 종합 피드백을 받을 수 있어요.', n + ' turn(s) · AI question → your answer → quick feedback (💡) → next question. After 3+ turns you can get full feedback.');
    if (fin) fin.disabled = n < 3;
  }
  var convConf = [];
  var baseSubmit = window.submitConversation;
  window.submitConversation = submitConversation = function (text) {
    if (!navigator.onLine) { q('#conversationStatus').textContent = OFFLINE; return Promise.resolve(); }
    var p = baseSubmit(text);
    return Promise.resolve(p).then(function () { updateTurns(); });
  };
  /* 일시적인 네트워크 오류·시간 초과는 1번 자동 재시도 (무료 한도 초과 429 는 재시도하지 않음) */
  var baseReq = window.requestAIConversation;
  window.requestAIConversation = requestAIConversation = function (userText) {
    return baseReq(userText).catch(function (err) {
      var m = String(err && err.message || err);
      if (/429|NOT_CONFIGURED/.test(m) || !navigator.onLine) throw err;
      return new Promise(function (r) { setTimeout(r, 900); }).then(function () { return baseReq(userText); });
    });
  };
  startConversationMic = function () {
    if (convRecognizing) return;
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { q('#conversationStatus').textContent = T('이 브라우저에서는 음성 인식이 지원되지 않아요. 텍스트로 입력해 주세요.', 'Speech recognition is not supported here. Please type your answer.'); return; }
    if (!navigator.onLine) { q('#conversationStatus').textContent = OFFLINE; return; }
    try { if (window.TTS) TTS.stop(); } catch (e) {}
    var r = new SR(); r.lang = C.lang; r.interimResults = true; r.continuous = false; r.maxAlternatives = 1;
    convRecognizing = true; q('#conversationMic').disabled = true; q('#conversationStatus').textContent = T('말씀하세요…', 'Speak now…');
    var fin = '', conf = [];
    r.onresult = function (e) { for (var i = e.resultIndex; i < e.results.length; i++) { if (e.results[i].isFinal) { fin += (fin ? ' ' : '') + e.results[i][0].transcript; if (e.results[i][0].confidence) conf.push(e.results[i][0].confidence); } else q('#conversationStatus').textContent = T('인식 중: ', 'Recognising: ') + e.results[i][0].transcript; } };
    r.onerror = function (e) { var map = { 'no-speech': T('말소리가 감지되지 않았어요. 버튼을 누른 뒤 바로 말해 주세요.', 'No speech detected.'), 'not-allowed': T('마이크 권한이 차단되어 있어요. 주소창의 자물쇠에서 마이크를 허용해 주세요.', 'Microphone permission is blocked.'), network: T('음성 인식 서버에 연결하지 못했어요.', 'Could not reach the speech service.'), 'audio-capture': T('마이크를 사용할 수 없어요.', 'Microphone unavailable.') }; q('#conversationStatus').textContent = map[e.error] || T('음성 인식을 다시 시도해 주세요.', 'Please try speech input again.'); };
    r.onend = function () { convRecognizing = false; q('#conversationMic').disabled = false; if (conf.length) convConf = convConf.concat(conf); if (fin) submitConversation(fin); };
    try { r.start(); } catch (e) { convRecognizing = false; q('#conversationMic').disabled = false; }
  };
  function finishConversation() {
    var hist = (convSession && convSession.history) || [], users = hist.filter(function (x) { return x.role === 'user'; }), ai = hist.filter(function (x) { return x.role === 'assistant'; });
    if (users.length < 3) { updateTurns(); return; }
    var words = users.map(function (u) { return APP === 'ielts' ? u.text.split(/\s+/).filter(Boolean) : APP === 'hsk' ? (u.text.match(/[㐀-鿿]/g) || []) : u.text.split(/\s+/).filter(Boolean); });
    var avg = Math.round(words.reduce(function (a, w) { return a + w.length; }, 0) / users.length);
    var uniq = {}; words.forEach(function (w) { w.forEach(function (x) { uniq[x.toLowerCase()] = 1; }); });
    var tips = []; ai.forEach(function (x) { String(x.text).split('\n').forEach(function (l) { l = l.trim(); if (/^💡|^Estimated practice feedback/i.test(l)) tips.push(l.replace(/^💡\s*/, '')); }); });
    var gram = tips.filter(function (t) { return /문법|Grammar|语法|어순|→|->/.test(t); }), vocabTips = tips.filter(function (t) { return /어휘|Vocabulary|词|표현|expression/i.test(t); });
    var conn = { ielts: /\b(because|however|for example|although|so|therefore|also)\b/i, topik: /(그래서|하지만|그런데|왜냐하면|그리고|-아서|-니까|는데)/, hsk: /(因为|所以|但是|虽然|而且|然后)/ }[APP];
    var usedConn = users.some(function (u) { return conn.test(u.text); });
    var longEnough = APP === 'hsk' ? avg >= 6 : APP === 'ielts' ? avg >= 10 : avg >= 4;
    var pron = convConf.length ? Math.round(convConf.reduce(function (a, b) { return a + b; }, 0) / convConf.length * 100) : null;
    var good = [], fix = [];
    good.push(T(users.length + '턴 동안 대화를 이어갔어요.', 'You kept the conversation going for ' + users.length + ' turns.'));
    if (longEnough) good.push(T('답의 길이가 충분해요(평균 ' + avg + (APP === 'hsk' ? '자' : '어절') + ').', 'Your answers had good length (avg ' + avg + ' words).')); else fix.push(T('답을 한두 문장 더 늘려 이유나 예시를 붙여 보세요(평균 ' + avg + (APP === 'hsk' ? '자' : '어절') + ').', 'Extend answers with a reason or example (avg ' + avg + ' words).'));
    if (usedConn) good.push(T('연결어를 사용해 생각을 이어 말했어요.', 'You used linking words.')); else fix.push(T('연결어(' + (APP === 'hsk' ? '因为·所以·但是' : '그래서·하지만·왜냐하면') + ')로 문장을 이어 보세요.', 'Use linking words (because, however, for example).'));
    if (tips.length) fix.push(T('AI가 교정한 표현 ' + tips.length + '개를 다시 확인하세요.', 'Review the ' + tips.length + ' correction(s) from the AI.'));
    var weak = weakestSkill();
    var sections = [
      [T('잘한 점', 'What went well'), good],
      [T('교정할 점', 'To improve'), fix.length ? fix : [T('큰 오류 없이 대화했어요.', 'No major issues noticed.')]],
      [T('어휘', 'Vocabulary'), [T('사용한 서로 다른 단어 ' + Object.keys(uniq).length + '개', Object.keys(uniq).length + ' different words used')].concat(vocabTips.slice(0, 2))],
      [T('문법', 'Grammar'), gram.length ? gram.slice(0, 3) : [T('AI가 지적한 문법 오류가 없어요.', 'No grammar corrections from the AI.')]],
      [T('발음', 'Pronunciation'), [pron != null ? T('음성 입력 인식 신뢰도 평균 ' + pron + '% (브라우저 음성 인식 기준 참고값)', 'Speech-input recognition confidence ' + pron + '% (browser estimate)') : T('이번 대화는 텍스트로 입력했어요. ● 말하기로 답하면 발음도 점검할 수 있어요.', 'You typed this time. Use ● Speak to check pronunciation.')]],
      [T('추천 복습', 'Recommended review'), [T('약점 영역 ' + skillLabel(weak) + ' 문제 풀기', 'Practise your weakest area: ' + weak), T('스피킹랩에서 쉐도잉 3문장', '3 shadowing sentences in the Speaking Lab')]]
    ];
    var box = q('#convSummary');
    if (!box) { box = document.createElement('div'); box.id = 'convSummary'; box.className = 'card eng-card'; q('#conversation .card').appendChild(box); }
    var ielts = APP === 'ielts' ? '<h4>AI 학습 피드백 · Estimated practice feedback (not an official IELTS band)</h4><div class="wk">' +
      [['Fluency & Coherence', longEnough && usedConn ? 'Developing well' : 'Needs longer, linked answers'], ['Lexical Resource', Object.keys(uniq).length >= 40 ? 'Good range' : 'Try more varied words'], ['Grammar', gram.length ? gram.length + ' correction(s)' : 'No corrections noted'], ['Pronunciation', pron != null ? 'Recognition ' + pron + '%' : 'Use voice input to check']].map(function (c) { return '<div><span>' + c[0] + '</span><b>' + esc(c[1]) + '</b></div>'; }).join('') + '</div>' : '';
    box.innerHTML = '<p class="eyebrow">CONVERSATION FEEDBACK</p><h3>' + T('대화 종합 피드백', 'Conversation feedback') + '</h3>' + ielts +
      sections.map(function (s) { return '<h4>' + esc(s[0]) + '</h4><ul>' + s[1].map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>'; }).join('') +
      '<div class="row" style="justify-content:flex-start"><button type="button" class="btn soft" id="convAiSum">🤖 ' + T('AI 총평 받기', 'Get AI summary') + '</button><button type="button" class="btn primary" id="convReview">' + T('추천 복습 시작', 'Start recommended review') + '</button></div><div id="convAiOut" class="feedback hide" aria-live="polite"></div>';
    var dd = dayRec(); dd.lessons++; E.conv.push({ t: Date.now(), turns: users.length, avg: avg, tips: tips.length }); if (E.conv.length > 50) E.conv = E.conv.slice(-50);
    E.log.push({ t: Date.now(), id: 'conv', s: speechSkill(), ok: 1, rt: 0, k: 'conv' }); saveE(); refreshHome();
    q('#convReview').onclick = function () { startBlock({ go: 'test', skill: weak }); };
    q('#convAiSum').onclick = function () {
      var out = q('#convAiOut'), b = q('#convAiSum'); out.classList.remove('hide');
      if (!navigator.onLine) { out.textContent = OFFLINE; return; }
      b.disabled = true; out.textContent = T('AI가 대화를 검토하고 있어요…', 'The AI is reviewing the conversation…');
      var transcript = hist.slice(-12).map(function (x) { return (x.role === 'user' ? 'Learner: ' : 'Tutor: ') + String(x.text).split('\n')[0]; }).join('\n');
      var msg = EN ? 'FEEDBACK MODE (not role-play). Review the learner\'s turns below and reply in plain text with six short labelled lines: Strengths / Corrections / Vocabulary / Grammar / Pronunciation tips / Recommended review. This is practice feedback, never an official band score.\n' + transcript
        : '피드백 모드(역할극 아님). 아래 대화에서 학습자의 말을 검토하고 한국어로 짧은 여섯 줄만 쓰세요: 잘한 점 / 교정할 점 / 어휘 / 문법 / 발음 팁 / 추천 복습.\n' + transcript;
      aiCall(msg, { scenario: 'feedback', timeout: 20000, retries: 1 })
        .then(function (reply) { out.innerHTML = '<b>🤖 ' + T('AI 총평', 'AI summary') + '</b> <small>' + T('(AI 학습 피드백 · 참고용)', '(AI learning feedback · practice only)') + '</small><div style="white-space:pre-line;margin-top:6px">' + esc(reply) + '</div>'; })
        .catch(function (err) { out.textContent = aiErrorText(err); })
        .finally(function () { b.disabled = false; });
    };
    box.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  var baseInitConv = initConversationUI;
  initConversationUI = function () { baseInitConv(); convControls(); updateTurns(); };

  /* ================= 오프라인 안내 ================= */
  function netNotice() {
    var s = q('#conversationStatus'); if (!s) return;
    if (!navigator.onLine) s.textContent = OFFLINE;
  }
  window.addEventListener('offline', netNotice);
  window.addEventListener('online', function () { var s = q('#conversationStatus'); if (s && s.textContent === OFFLINE) s.textContent = ''; });

  /* ================= 시작 ================= */
  function boot() {
    try { labelLevels(); installShadowing(); engineHome(); engineProgress(); } catch (e) { console.error('[engine] boot', e); }
    var cur = q('.nav.active'); if (cur && cur.dataset.page === 'test') showQuestion();
  }
  if (q('#app') && !q('#app').classList.contains('hide')) setTimeout(boot, 0);
  var app = q('#app');
  if (app) new MutationObserver(function () { if (!app.classList.contains('hide')) setTimeout(boot, 0); }).observe(app, { attributes: true, attributeFilter: ['class'] });
  var lb = q('#levelBar'); if (lb) new MutationObserver(function () { labelLevels(); }).observe(lb, { childList: true });
})();
