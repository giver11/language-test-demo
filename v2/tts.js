/* ScoreStep V2 shared text-to-speech.
   One voice per language (IELTS en-US, TOPIK ko-KR, HSK zh-CN); no male/female switching.
   Voice choice: exact locale -> same language -> browser default for that lang.
   Handles: voices loading late (Android Chrome), speak() ignored right after cancel(),
   Chrome's ~15s cut-off on long utterances, garbage-collected utterances,
   iOS needing a first user gesture, and tab hide/resume. */
(function(){
  'use strict';
  var synth = ('speechSynthesis' in window) ? window.speechSynthesis : null;
  var Utter = window.SpeechSynthesisUtterance;
  var voices = [], voiceListeners = [], eventListeners = [];
  var seq = 0, live = [], fallbackAudio = null, unlocked = false;

  function norm(lang){ return String(lang || '').replace(/_/g, '-').toLowerCase(); }
  function baseOf(lang){ return norm(lang).split('-')[0]; }
  function emit(type, detail){ eventListeners.forEach(function(f){ try{ f(type, detail || {}); }catch(e){ console.error('[TTS] listener', e); } }); }

  function readVoices(){ if (!synth) return; try { voices = synth.getVoices() || []; } catch(e) { voices = []; } }
  function loadVoices(){
    if (!synth) return;
    var had = voices.length;
    readVoices();
    if (!voices.length && !had) return;
    voiceListeners.forEach(function(f){ try{ f(voices); }catch(e){ console.error('[TTS] voices listener', e); } });
  }
  if (synth) {
    loadVoices();
    if (synth.addEventListener) synth.addEventListener('voiceschanged', loadVoices);
    else synth.onvoiceschanged = loadVoices;
    [300, 1000, 2500, 5000].forEach(function(t){ setTimeout(loadVoices, t); });
  }

  /* Prefer on-device voices (start instantly, work offline), then the platform default. */
  function rank(v){ return (v.localService === false ? 2 : 0) + (v.default ? 0 : 1); }
  function getBestVoice(lang){
    if (!voices.length) readVoices();   /* never notify listeners from here (they call getBestVoice) */
    var want = norm(lang), base = baseOf(lang);
    var exact = voices.filter(function(v){ return norm(v.lang) === want; });
    var same = exact.length ? exact : voices.filter(function(v){ return baseOf(v.lang) === base; });
    return same.slice().sort(function(a, b){ return rank(a) - rank(b); })[0] || null;
  }

  /* Only the target-language text is spoken: 💡 feedback, IELTS feedback lines,
     and (for Chinese) Pinyin/Hangul are removed so zh is never read by another language. */
  function clean(text, lang){
    var lines = String(text || '').split('\n').map(function(l){ return l.trim(); })
      .filter(function(l){ return l && l.indexOf('💡') !== 0 && !/^Estimated practice feedback/i.test(l); })
      .map(function(l){ return l.replace(/💡.*$/, '').trim(); });
    var t;
    if (baseOf(lang) === 'zh') {
      var han = lines.filter(function(l){ return /[一-鿿]/.test(l); });
      t = (han.length ? han : lines).join('，')
        .replace(/[가-힯㄰-㆏]+/g, ' ')
        .replace(/[A-Za-zÀ-ɏ̀-ͯ]+/g, ' ');
    } else {
      t = lines.join(' ');
    }
    return t.replace(/\(\s*\)|_{2,}/g, ' ').replace(/\s+/g, ' ').replace(/^[，,\s]+|[，,\s]+$/g, '').trim();
  }

  function chunks(t){
    var parts = t.match(/[^.!?。！？]+[.!?。！？]*/g) || [t], out = [];
    parts.forEach(function(p){
      p = p.trim(); if (!p) return;
      var last = out[out.length - 1];
      if (last && (last + ' ' + p).length <= 160) out[out.length - 1] = last + ' ' + p;
      else while (p.length) { out.push(p.slice(0, 180)); p = p.slice(180); }
    });
    return out;
  }

  function stopAudio(){ if (fallbackAudio) { try{ fallbackAudio.pause(); }catch(e){} fallbackAudio = null; } }

  /* Last resort when the device has no engine or reports a hard failure. */
  function onlineSpeak(t, lang, opt, my){
    var tl = baseOf(lang) === 'zh' ? 'zh-CN' : baseOf(lang), parts = chunks(t), i = 0;
    function next(){
      if (my !== seq || i >= parts.length) { fallbackAudio = null; if (my === seq) emit('end', {}); return; }
      var a = new Audio('https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=' + tl + '&q=' + encodeURIComponent(parts[i++]));
      a.playbackRate = opt.slow ? 0.75 : 1; fallbackAudio = a;
      a.onended = next;
      a.onerror = function(){ console.error('[TTS] online audio failed'); emit('error', { error: 'online-audio-failed' }); };
      a.play().then(function(){ if (i === 1) emit('start', { online: true, lang: lang }); })
        .catch(function(err){ console.error('[TTS] online audio blocked', err); emit('error', { error: 'autoplay-blocked' }); });
    }
    next();
  }

  function speak(text, opt){
    opt = opt || {};
    var lang = opt.lang || 'en-US', t = clean(text, lang);
    if (!t) return false;
    var my = ++seq;
    stopAudio();
    if (!synth || typeof Utter !== 'function') { onlineSpeak(t, lang, opt, my); return true; }
    var busy = synth.speaking || synth.pending;
    synth.cancel();
    function go(){
      if (my !== seq) return;
      try { synth.resume(); } catch(e) {}
      var v = getBestVoice(lang), parts = chunks(t), started = false;
      live = parts.map(function(p, i){
        var u = new Utter(p);
        u.lang = lang;             /* always the app language, so the browser default is correct even without a voice */
        if (v) u.voice = v;
        u.rate = opt.slow ? 0.7 : (opt.rate || 0.9);
        u.pitch = 1; u.volume = 1;
        u.onstart = function(){ if (!started) { started = true; emit('start', { voice: v ? v.name : '', lang: lang }); } };
        u.onend = function(){ if (i === parts.length - 1 && my === seq) { live = []; emit('end', {}); } };
        u.onerror = function(e){
          var err = e && e.error;
          if (err === 'interrupted' || err === 'canceled') return;
          console.error('[TTS] speech error:', err, lang, v ? v.name : '(default voice)');
          emit('error', { error: err });
          if (my === seq && !started && i === 0) onlineSpeak(t, lang, opt, my);
        };
        return u;
      });
      live.forEach(function(u){ synth.speak(u); });
    }
    /* Android Chrome ignores speak() issued in the same tick as cancel() while audio was playing. */
    if (busy) setTimeout(go, 90); else go();
    return true;
  }

  function stop(){ seq++; stopAudio(); live = []; if (synth) { try{ synth.cancel(); }catch(e){} } }

  /* iOS/Safari: allow later (non-gesture) speech, e.g. AI replies, after the first tap. */
  var appleTouch = /iP(hone|ad|od)/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && 'ontouchend' in document);
  function unlock(){
    if (unlocked || !synth || !appleTouch) return; unlocked = true;
    try { var u = new Utter(' '); u.volume = 0; synth.speak(u); } catch(e) {}
  }
  ['touchend', 'pointerdown'].forEach(function(t){ document.addEventListener(t, unlock, { capture: true, passive: true }); });

  document.addEventListener('visibilitychange', function(){
    if (!synth) return;
    if (document.hidden) stop(); else { try{ synth.resume(); }catch(e){} loadVoices(); }
  });
  window.addEventListener('pagehide', stop);

  window.TTS = {
    speak: speak,
    stop: stop,
    clean: clean,
    getBestVoice: getBestVoice,
    voices: function(){ return voices.slice(); },
    supported: !!synth,
    onVoices: function(f){ voiceListeners.push(f); if (voices.length) f(voices); },
    on: function(f){ eventListeners.push(f); }
  };
})();
