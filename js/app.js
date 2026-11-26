/* Sub-Ready UI. All processing happens in this browser tab. */
(function () {
  'use strict';
  var C = window.SubReadyCore;
  var CFG = window.SUB_READY_CONFIG || { PRO_URL: '' };
  var $ = function (id) { return document.getElementById(id); };
  var state = { nameMap: [], masked: null, questions: [], gaps: null, mode: 'copy', session: null };
  var LM_OPTS = { expectedInputs: [{ type: 'text', languages: ['en'] }], expectedOutputs: [{ type: 'text', languages: ['en'] }] };

  // ---------- Pro placeholder ----------
  (function setupPro() {
    var b = $('proBtn');
    if (CFG.PRO_URL) {
      b.href = CFG.PRO_URL; b.textContent = 'Get the Teacher plan ($5/month)'; b.removeAttribute('aria-disabled');
      b.rel = 'noopener'; $('proNote').textContent = '';
    } else {
      b.removeAttribute('href'); b.classList.add('disabled');
      b.addEventListener('click', function (e) { e.preventDefault(); });
    }
  })();

  // ---------- on-device AI detection (Chrome Prompt API) ----------
  function deviceAvailability() {
    if (!('LanguageModel' in self)) return Promise.resolve('unsupported');
    try { return self.LanguageModel.availability(LM_OPTS).catch(function () { return 'unavailable'; }); }
    catch (e) { return Promise.resolve('unavailable'); }
  }
  var deviceState = 'unsupported';
  deviceAvailability().then(function (a) {
    deviceState = a;
    var label = {
      available: 'ready on this device',
      downloadable: 'available (first use downloads the model)',
      downloading: 'model is downloading',
      unavailable: 'not available on this device',
      unsupported: 'not supported in this browser'
    }[a] || a;
    $('deviceStatus').textContent = label;
    var radio = document.querySelector('input[name=mode][value=device]');
    if (a === 'unavailable' || a === 'unsupported') { radio.disabled = true; setMode('copy'); }
    else setMode('device');
  });
  function setMode(m) {
    state.mode = m;
    var r = document.querySelector('input[name=mode][value=' + m + ']'); if (r) r.checked = true;
  }
  Array.prototype.forEach.call(document.querySelectorAll('input[name=mode]'), function (r) {
    r.addEventListener('change', function () { state.mode = r.value; });
  });

  function getSession(statusEl) {
    if (state.session) return Promise.resolve(state.session);
    // create() must run from a user gesture when the model still needs downloading.
    return self.LanguageModel.create(Object.assign({}, LM_OPTS, {
      initialPrompts: [{ role: 'system', content: 'You restructure a teacher\u2019s own notes. Never invent facts. Reply only with JSON.' }],
      monitor: function (m) {
        m.addEventListener('downloadprogress', function (e) {
          show(statusEl, 'Downloading the on-device model (one time): ' + Math.round(e.loaded * 100) + '%');
        });
      }
    })).then(function (s) { state.session = s; return s; });
  }
  function askDevice(prompt, schema, statusEl) {
    show(statusEl, 'Thinking on your device\u2026 (this can take up to a minute)');
    return getSession(statusEl).then(function (s) {
      return s.prompt(prompt, { responseConstraint: schema }).catch(function () { return s.prompt(prompt); });
    });
  }

  // ---------- helpers ----------
  function show(el, text) { el.hidden = false; el.textContent = text; }
  function hide(el) { el.hidden = true; el.textContent = ''; }
  function classInfo() {
    return {
      className: $('className').value, periods: $('periods').value, routines: $('routines').value,
      locations: $('locations').value, helpers: $('helpers').value, emergency: $('emergency').value
    };
  }
  function maskAll() {
    var names = C.parseNameList($('names').value);
    state.nameMap = C.buildNameMap(names);
    var warnings = [];
    function m(t) { var r = C.maskNames(t, state.nameMap); warnings = warnings.concat(r.warnings); return r.text; }
    var info = classInfo(), mi = {};
    Object.keys(info).forEach(function (k) { mi[k] = m(info[k]); });
    state.masked = { plan: m($('plan').value), info: mi, rawPlan: $('plan').value, rawInfo: info };
    state.masked.warnings = warnings.filter(function (w, i) { return warnings.indexOf(w) === i; });
    return state.masked;
  }
  function refreshPreview() {
    var m = maskAll();
    $('maskedPreview').textContent = m.plan + (m.info.helpers ? '\n\n[helpers]\n' + m.info.helpers : '');
    $('maskWarnings').innerHTML = m.warnings.map(function (w) { return '<li>' + C.esc(w) + '</li>'; }).join('');
  }
  ['plan', 'names', 'helpers', 'locations', 'routines'].forEach(function (id) { $(id).addEventListener('input', refreshPreview); });
  $('detect').addEventListener('click', function () {
    var found = C.detectRosterNames($('roster').value);
    var existing = C.parseNameList($('names').value);
    var all = existing.concat(found.filter(function (f) { return existing.map(function (e) { return e.toLowerCase(); }).indexOf(f.toLowerCase()) === -1; }));
    $('names').value = all.join('\n');
    refreshPreview();
  });

  Array.prototype.forEach.call(document.querySelectorAll('[data-copy]'), function (b) {
    b.addEventListener('click', function () {
      var t = $(b.getAttribute('data-copy'));
      t.select();
      var done = function () { b.textContent = 'Copied!'; setTimeout(function () { b.textContent = 'Copy prompt'; }, 1500); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t.value).then(done, function () { document.execCommand('copy'); done(); });
      else { document.execCommand('copy'); done(); }
    });
  });

  // ---------- hand-off from the class binder (same tab, sessionStorage only) ----------
  (function takeHandoff() {
    var raw = null;
    try { raw = sessionStorage.getItem('subready.handoff'); sessionStorage.removeItem('subready.handoff'); } catch (e) { return; }
    if (!raw) return;
    var h; try { h = JSON.parse(raw); } catch (e) { return; }
    if (!h || typeof h !== 'object') return;
    var map = { plan: 'plan', title: 'className', periods: 'periods', routines: 'routines', locations: 'locations', helpers: 'helpers', emergency: 'emergency' };
    Object.keys(map).forEach(function (k) { if (typeof h[k] === 'string' && $(map[k])) $(map[k]).value = h[k]; });
    if (typeof h.names === 'string' && h.names.trim()) $('names').value = h.names;
    refreshPreview();
    var note = $('handoffNote');
    if (note) { note.hidden = false; }
  })();

  // ---------- step 1: find gaps ----------
  $('findGaps').addEventListener('click', function () {
    var err = C.validateInput($('plan').value);
    if (err) { show($('inputError'), err); $('plan').focus(); return; }
    hide($('inputError'));
    var m = maskAll();
    state.lint = C.lintPlan(m.plan, m.info);
    $('step-gaps').hidden = false;
    hide($('gapError'));
    $('copyGaps').hidden = true; $('qaForm').hidden = true;
    var prompt = C.buildGapPrompt(m.plan, m.info);
    if (state.mode === 'device') {
      askDevice(prompt, C.GAP_SCHEMA, $('gapStatus')).then(function (txt) {
        hide($('gapStatus')); acceptGaps(txt);
      }).catch(function (e) {
        hide($('gapStatus'));
        show($('gapError'), 'On-device AI didn\u2019t work here (' + (e && e.message || e) + '). Switched to copy-paste mode.');
        setMode('copy'); showCopyGaps(prompt);
      });
    } else if (state.mode === 'copy') {
      showCopyGaps(prompt);
    } else {
      renderQuestions([], state.lint.flags);
    }
    $('step-gaps').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  function showCopyGaps(prompt) { $('gapPrompt').value = prompt; $('copyGaps').hidden = false; }
  $('readGaps').addEventListener('click', function () { acceptGaps($('gapReply').value); });
  $('skipGapAI').addEventListener('click', function () { hide($('gapError')); renderQuestions([], state.lint.flags); });

  function acceptGaps(text) {
    try {
      var g = C.normalizeGaps(C.unmaskDeep(C.extractJSON(text), [])); // keep tokens in questions
      hide($('gapError'));
      var flags = g.flags.concat(state.lint.flags);
      renderQuestions(g.questions, flags);
    } catch (e) { show($('gapError'), e.message); }
  }
  function renderQuestions(aiQs, flags) {
    state.questions = C.finalizeQuestions(aiQs, state.lint.questions, 5, 8);
    // Group issues by line so each plan line appears once.
    var byLine = [], idx = {};
    flags.forEach(function (f) {
      var k = (f.line || '').toLowerCase().trim();
      if (!(k in idx)) { idx[k] = byLine.length; byLine.push({ line: f.line, issues: [] }); }
      var g = byLine[idx[k]];
      if (f.issue && g.issues.map(function (x) { return x.toLowerCase(); }).indexOf(f.issue.toLowerCase()) === -1) g.issues.push(f.issue);
    });
    var fl = byLine.slice(0, 12);
    $('flagsWrap').hidden = !fl.length;
    $('flags').innerHTML = fl.map(function (f) {
      return '<li>' + (f.line ? '<q>' + C.esc(C.unmaskNames(f.line, state.nameMap)) + '</q> ' : '') +
        f.issues.map(function (i) { return C.esc(C.unmaskNames(i, state.nameMap)); }).join(' ') + '</li>';
    }).join('');
    $('questions').innerHTML = state.questions.map(function (q, i) {
      return '<div class="q"><label for="a' + i + '">' + (i + 1) + '. ' + C.esc(C.unmaskNames(q.question, state.nameMap)) +
        (q.source === 'checklist' ? ' <span class="chip soft">checklist</span>' : '') + '</label>' +
        '<textarea id="a' + i + '" rows="2" placeholder="Your answer (or leave blank)"></textarea></div>';
    }).join('');
    $('qaForm').hidden = false;
  }

  // ---------- step 2: write script ----------
  function collectQA() {
    return state.questions.map(function (q, i) {
      var raw = $('a' + i).value;
      return { question: q.question, section: q.section, answer: C.maskNames(raw, state.nameMap).text, rawAnswer: raw };
    });
  }
  $('writeScript').addEventListener('click', function () {
    state.qa = collectQA();
    var m = state.masked;
    $('step-script').hidden = false;
    hide($('scriptError')); $('copyScript').hidden = true;
    var prompt = C.buildScriptPrompt(m.plan, m.info, state.qa);
    if (state.mode === 'device') {
      askDevice(prompt, C.SCRIPT_SCHEMA, $('scriptStatus')).then(function (txt) {
        hide($('scriptStatus')); acceptScript(txt);
      }).catch(function (e) {
        hide($('scriptStatus'));
        show($('scriptError'), 'On-device AI didn\u2019t finish (' + (e && e.message || e) + '). Use copy-paste below, or build a basic version.');
        $('scriptPrompt').value = prompt; $('copyScript').hidden = false;
      });
    } else if (state.mode === 'copy') {
      $('scriptPrompt').value = prompt; $('copyScript').hidden = false;
    } else {
      buildBasic();
    }
    $('step-script').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  $('readScript').addEventListener('click', function () { acceptScript($('scriptReply').value); });
  $('basicScript').addEventListener('click', buildBasic);
  function buildBasic() {
    var m = state.masked;
    renderModel(C.scriptWithoutAI(m.plan, m.info, state.qa));
  }
  function acceptScript(text) {
    try { renderModel(C.extractJSON(text)); hide($('scriptError')); }
    catch (e) { show($('scriptError'), e.message); }
  }
  function renderModel(obj) {
    var m = state.masked;
    var model = C.normalizeScript(obj, { plan: m.plan, classInfo: m.info, qa: state.qa });
    model = C.unmaskDeep(model, state.nameMap);
    $('output').innerHTML = C.renderScriptHTML(model, { date: new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) });
    $('outputActions').hidden = false;
    $('output').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  $('printBtn').addEventListener('click', function () { window.print(); });
  $('startOver').addEventListener('click', function () {
    if (!confirm('Clear this plan and start over? (Nothing is saved anywhere.)')) return;
    location.hash = 'tool'; location.reload();
  });

  // expose for automated tests
  window.__subReady = { state: state, setMode: setMode };
  refreshPreview();
})();
