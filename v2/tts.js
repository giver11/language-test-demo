/* ScoreStep V2 shared text-to-speech (browser Web Speech API only).
   IELTS en-US · TOPIK ko-KR · HSK zh-CN. One voice per language, chosen automatically.
   No external/unofficial TTS URLs, no paid TTS APIs, no silent autoplay.
   Developer diagnostics are console-only: run TTS.report() in DevTools. Nothing is shown on screen. */
(function(){
  'use strict';
  var synth = ('speechSynthesis' in window) ? window.speechSynthesis : null;
  var supported = !!synth && ('SpeechSynthesisUtterance' in window);
  var availableVoices = [];
  var currentUtterance = null;           /* keep a reference so Chrome does not garbage-collect it mid-speech */
  var listeners = [];
  var diag = { voicesChangedCount: 0, speakCalls: 0, events: [] };

  function log(kind, msg){
    var line = new Date().toISOString().slice(11, 23) + ' ' + kind + ' ' + msg;
    diag.events.push(line); if (diag.events.length > 60) diag.events.shift();
    if (kind === 'ERROR') console.error('[TTS]', msg); else if (console.debug) console.debug('[TTS]', kind, msg);
  }
  function emit(type, detail){ listeners.forEach(function(f){ try { f(type, detail || {}); } catch(e) { console.error('[TTS] listener', e); } }); }

  function loadVoices(){
    if (!synth) return [];
    try { availableVoices = synth.getVoices() || []; } catch(e) { availableVoices = []; }
    return availableVoices;
  }
  loadVoices();
  if (synth) {
    var onChange = function(){ diag.voicesChangedCount++; loadVoices(); log('EVENT', 'voiceschanged → ' + availableVoices.length + ' voices'); };
    if (synth.addEventListener) synth.addEventListener('voiceschanged', onChange);
    else if ('onvoiceschanged' in synth) synth.onvoiceschanged = onChange;
  }

  function normalizeLang(lang){ return String(lang || 'en-US').replace(/_/g, '-').toLowerCase(); }

  /* exact locale → same language → null (browser default for utterance.lang). No voice names are hard-coded. */
  function findVoice(lang){
    loadVoices();
    var wanted = normalizeLang(lang), base = wanted.split('-')[0];
    var voice = availableVoices.find(function(v){ return normalizeLang(v.lang) === wanted; });
    if (!voice) voice = availableVoices.find(function(v){ return normalizeLang(v.lang).split('-')[0] === base; });
    return voice || null;
  }

  /* Speak only the app language: drop 💡 / IELTS feedback lines; for Chinese keep Hanzi only
     (e.g. "你好 nǐhǎo" → "你好"), so Pinyin/Hangul are never read. The screen text is unchanged. */
  function speechText(text, lang){
    var lines = String(text || '').split('\n').map(function(l){ return l.replace(/💡.*$/, '').trim(); })
      .filter(function(l){ return l && !/^Estimated practice feedback/i.test(l); });
    var t;
    if (normalizeLang(lang).split('-')[0] === 'zh') {
      var han = lines.join(' ').match(/[㐀-鿿豈-﫿0-9，。！？、；：“”‘’（）《》]+/g) || [];
      t = han.join('，').replace(/[（(]\s*[）)]/g, '，');
    } else {
      t = lines.join(' ').replace(/\(\s*\)|_{2,}/g, ' ');
    }
    return t.replace(/\s+/g, ' ').replace(/^[，,\s]+|[，,\s]+$/g, '').trim();
  }

  function speak(text, options){
    options = options || {};
    var lang = options.lang || 'en-US', say = speechText(text, lang);
    if (!say) { log('SKIP', 'empty text for ' + lang); return false; }
    if (!supported) { log('ERROR', 'Web Speech API unsupported'); return false; }
    diag.speakCalls++;
    try { synth.cancel(); } catch(e) {}
    var utterance = new SpeechSynthesisUtterance(say);
    currentUtterance = utterance;
    utterance.lang = lang;
    var voice = findVoice(lang);
    if (voice) utterance.voice = voice;
    utterance.rate = options.slow ? 0.75 : 0.95;
    utterance.pitch = 1;
    utterance.volume = 1;
    utterance.onstart = function(){ document.body && document.body.classList.add('tts-speaking'); log('START', lang + ' · ' + (voice ? voice.name + ' (' + voice.lang + ')' : 'browser default')); emit('start', { lang: lang, voice: voice ? voice.name : '' }); };
    utterance.onend = function(){ document.body && document.body.classList.remove('tts-speaking'); if (currentUtterance === utterance) currentUtterance = null; log('END', lang); emit('end', {}); };
    utterance.onerror = function(event){
      var err = event && event.error;
      document.body && document.body.classList.remove('tts-speaking');
      if (currentUtterance === utterance) currentUtterance = null;
      if (err === 'interrupted' || err === 'canceled') { log('EVENT', 'utterance ' + err + ' (replaced by a newer one)'); return; }
      log('ERROR', 'onerror ' + err + ' · ' + lang);
      emit('error', { error: err, lang: lang });
    };
    /* Android Chrome can ignore speak() issued in the same tick as cancel(). */
    setTimeout(function(){
      if (currentUtterance !== utterance) return;           /* a newer tap replaced this one */
      try {
        synth.resume(); synth.speak(utterance); log('SPEAK', lang + ' "' + say.slice(0, 40) + '"');
        /* Some Android Chrome builds leave the engine paused after speak(). */
        setTimeout(function(){ try { if (synth.paused) { synth.resume(); log('EVENT', 'resumed paused engine'); } } catch(e) {} }, 250);
      }
      catch(error) { log('ERROR', 'speak failed ' + error); emit('error', { error: String(error), lang: lang }); }
    }, 100);
    return true;
  }

  function stop(){ currentUtterance = null; if (!synth) return; try { synth.cancel(); } catch(e) {} }

  /* First touch: wake the engine and refresh voices (no sound is played). */
  document.addEventListener('pointerdown', function(){
    if (!synth) return;
    try { synth.resume(); loadVoices(); } catch(e) {}
  }, { once: true, capture: true });
  window.addEventListener('pagehide', stop);
  document.addEventListener('visibilitychange', function(){ if (document.hidden) stop(); });

  /* Any element with data-speak / data-tts plays its text in data-lang, or the app language. */
  document.addEventListener('click', function(event){
    var el = event.target && event.target.closest && event.target.closest('[data-speak], [data-tts]');
    if (!el) return;
    var text = el.getAttribute('data-speak') || el.getAttribute('data-tts') || el.getAttribute('data-text') || '';
    if (!text) return;
    event.preventDefault();
    speak(text, { lang: el.getAttribute('data-lang') || (window.CONFIG && window.CONFIG.lang) || 'en-US', slow: el.hasAttribute('data-slow') });
  }, true);

  /* ---------- developer diagnostics: console only (TTS.report()) ---------- */
  function report(){
    loadVoices();
    var pick = function(l){ var v = findVoice(l); return v ? v.name + ' (' + v.lang + ')' : '없음 → 브라우저 기본'; };
    var scripts = Array.prototype.map.call(document.scripts, function(s){ return s.src.split('/').pop(); }).filter(Boolean);
    return {
      userAgent: navigator.userAgent,
      speechSynthesis: !!synth,
      SpeechSynthesisUtterance: 'SpeechSynthesisUtterance' in window,
      voices: availableVoices.length,
      voicesChangedEvents: diag.voicesChangedCount,
      'en-US': pick('en-US'), 'ko-KR': pick('ko-KR'), 'zh-CN': pick('zh-CN'),
      speakCalls: diag.speakCalls,
      speaking: synth ? synth.speaking : false, paused: synth ? synth.paused : false,
      scripts: scripts.join(', '),
      events: diag.events.slice(-25)
    };
  }
  window.speakEnglish = function(text){ return speak(text, { lang: 'en-US' }); };
  window.speakKorean = function(text){ return speak(text, { lang: 'ko-KR' }); };
  window.speakChinese = function(text){ return speak(text, { lang: 'zh-CN' }); };
  window.stopSpeech = stop;

  window.TTS = {
    speak: speak,
    stop: stop,
    supported: supported,
    getBestVoice: findVoice,
    speechText: speechText,
    report: report,
    voices: function(){ return loadVoices(); },
    onVoices: function(callback){
      if (typeof callback !== 'function') return;
      var run = function(){ callback(loadVoices()); };
      run();
      if (synth && synth.addEventListener) synth.addEventListener('voiceschanged', run);
    },
    on: function(f){ if (typeof f === 'function') listeners.push(f); }
  };
})();
