/* Sub-Ready core: pure logic (no DOM). Runs in the browser and in Node for tests.
   The AI only restructures/asks about the teacher's own text. This file does the
   deterministic work: privacy masking, lint checks, prompt building, JSON parsing,
   time math, validation, grounding checks and HTML rendering. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SubReadyCore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var PLACEHOLDER = 'Not provided \u2014 ask the office or a neighboring teacher';
  var TIME_PLACEHOLDER = 'Time not provided \u2014 check the bell schedule / ask the office';

  // ---------- helpers ----------
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function reEsc(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  function clean(s) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); }
  function isBlank(s) { return clean(s) === ''; }

  // ---------- privacy: student-name masking ----------
  // Names that are also everyday English words. For these we only mask when the
  // word is capitalized AND not at the start of a sentence/line/bullet, unless the
  // teacher wrote it with a last name or initial (e.g. "Will R.").
  var COMMON_WORD_NAMES = ('will may june april august grace hope joy faith rose iris lily ivy ' +
    'mark bill art sky summer autumn winter dawn eve chase hunter page reading jack frank ' +
    'sunny star river rain ray hazel amber ruby pearl jade dean drew gene grant hunter ' +
    'max miles rich sage scout taylor walker wade young forrest brook lane bud penny ' +
    'chance destiny harmony honor justice journey mercy noble prince king duke major').split(/\s+/);
  var COMMON_SET = {};
  COMMON_WORD_NAMES.forEach(function (w) { if (w) COMMON_SET[w] = true; });

  // Text right after a common-word name that means it's being used as a word:
  // "Will you…", "May be", "May 5", "Art class", "Reading groups", "Grace period".
  var WORD_USAGE_AFTER = /^(?:\s+(?:you|they|we|i|he|she|it|the|a|an|be|need|needs|have|has|not|there|this|that|students|kids|everyone|all|class|classes|room|teacher|time|block|period|groups?|is at|at\s+\d|w\/|with mr|with mrs|with ms|supplies|project|center|station)\b|\s+\d)/i;
  var NOT_NAMES = {}; // words that start roster lines but are not names
  ('Period Table Row Group Seat Seats Desk Front Back Left Right Allergy Allergies Notes Note ' +
   'Helper Helpers Line Leader Class Students Student Roster Names Name Absent Monday Tuesday ' +
   'Wednesday Thursday Friday The A An And Or If Do Not Please Room Bus Office Nurse Mr Mrs Ms Dr ' +
   'Miss IEP EpiPen Epi Pen Has Needs Sits Goes Can').split(/\s+/).forEach(function (w) { NOT_NAMES[w] = true; });

  // Extract candidate names from a roster box: one student per line or comma-separated.
  // Takes the leading capitalized word(s) (+ optional initial) before a separator.
  function detectRosterNames(rosterText) {
    var out = [];
    if (isBlank(rosterText)) return out;
    var chunks = [];
    String(rosterText).split(/\n|,|;/).forEach(function (c) { c.split(/:\s*/).forEach(function (x) { chunks.push(x); }); });
    chunks.forEach(function (raw) {
      var line = raw.replace(/^\s*[-*\u2022\d.)]+\s*/, '').trim();
      if (!line) return;
      // Stop at separators that usually start a note.
      var head = line.split(/\s[-\u2013\u2014:(]|\s\(|:|\(|\s-\s/)[0].trim();
      var m = head.match(/^([A-Z][a-zA-Z'\u2019-]+)(\s+[A-Z][a-zA-Z'\u2019-]+|\s+[A-Z]\.?)?/);
      if (!m) return;
      var first = m[1];
      if (NOT_NAMES[first]) return;
      var full = (first + (m[2] || '')).trim();
      out.push(full);
    });
    return dedupe(out);
  }

  function parseNameList(text) {
    if (isBlank(text)) return [];
    return dedupe(String(text).split(/\n|,|;/).map(function (s) {
      return s.replace(/^\s*[-*\u2022\d.)]+\s*/, '').trim();
    }).filter(function (s) { return s.length >= 2 && /[A-Za-z]/.test(s); }));
  }

  function dedupe(arr) {
    var seen = {}, out = [];
    arr.forEach(function (x) { var k = x.toLowerCase(); if (!seen[k]) { seen[k] = true; out.push(x); } });
    return out;
  }

  // Build mapping {token -> name}. Full names get one token; their first name
  // alone (e.g. "Maya" from "Maya L.") also maps to the same token.
  function buildNameMap(names) {
    // Tokens are numbered in the order the teacher listed the names (stable, predictable).
    // maskNames() handles longest-first replacement separately.
    var map = [], tokenFor = {}, n = 0;
    names.forEach(function (name) {
      var key = name.toLowerCase();
      if (tokenFor[key]) return;
      n += 1;
      var tok = '[STUDENT_' + n + ']';
      tokenFor[key] = tok;
      map.push({ token: tok, name: name, variants: [name] });
    });
    // Add bare first names as variants when unambiguous (only one student with that first name).
    var firstCount = {};
    map.forEach(function (e) { var f = e.name.split(/\s+/)[0].toLowerCase(); firstCount[f] = (firstCount[f] || 0) + 1; });
    map.forEach(function (e) {
      var parts = e.name.split(/\s+/);
      if (parts.length > 1) {
        var f = parts[0];
        if (firstCount[f.toLowerCase()] === 1 && !tokenFor[f.toLowerCase()]) e.variants.push(f);
      }
    });
    return map;
  }

  // Replace names with tokens. Returns {text, warnings, count}.
  function maskNames(text, nameMap) {
    if (!nameMap || !nameMap.length) return { text: String(text == null ? '' : text), warnings: [], count: 0 };
    var warnings = [], count = 0, out = String(text == null ? '' : text);
    // Longest variants first so "Will R." is handled before "Will".
    var pairs = [];
    nameMap.forEach(function (e) { e.variants.forEach(function (v) { pairs.push({ v: v, tok: e.token }); }); });
    pairs.sort(function (a, b) { return b.v.length - a.v.length; });
    pairs.forEach(function (p) {
      var single = p.v.indexOf(' ') === -1;
      var common = single && COMMON_SET[p.v.toLowerCase()];
      var re = new RegExp('(^|[^A-Za-z\\[_])(' + reEsc(p.v) + ')(?![A-Za-z])', common ? 'g' : 'gi');
      var skipped = 0;
      out = out.replace(re, function (all, pre, word, offset, str) {
        if (common) {
          // Must be capitalized exactly as listed (lowercase "art", "will" stay words).
          if (word[0] !== word[0].toUpperCase()) return all;
          // Privacy first: mask capitalized uses, except clear everyday-word patterns.
          var after = str.slice(offset + all.length);
          if (WORD_USAGE_AFTER.test(after)) { skipped++; return all; }
        }
        count++;
        return pre + p.tok;
      });
      if (common) {
        warnings.push('"' + p.v + '" is also an everyday word. It was hidden wherever it is capitalized' +
          (skipped ? ', except ' + skipped + ' spot(s) that read like the ordinary word (e.g. "' + p.v + ' you\u2026", "' + p.v + ' class"). Check the preview.' : '. Check the preview.'));
      }
    });
    return { text: out, warnings: dedupe(warnings), count: count };
  }

  // Restore tokens -> names. Tolerates models that drop brackets or change case/spacing.
  function unmaskNames(text, nameMap) {
    var byNum = {};
    nameMap.forEach(function (e) { byNum[e.token.replace(/\D/g, '')] = e.name; });
    return String(text == null ? '' : text).replace(/\[?\s*STUDENT[\s_-]?(\d+)\s*\]?/gi, function (all, num) {
      return byNum[num] != null ? byNum[num] : all;
    });
  }
  function unmaskDeep(obj, nameMap) {
    if (typeof obj === 'string') return unmaskNames(obj, nameMap);
    if (Array.isArray(obj)) return obj.map(function (x) { return unmaskDeep(x, nameMap); });
    if (obj && typeof obj === 'object') {
      var o = {}; Object.keys(obj).forEach(function (k) { o[k] = unmaskDeep(obj[k], nameMap); }); return o;
    }
    return obj;
  }

  // ---------- time parsing ----------
  // Returns minutes since midnight or null. School-day heuristic: a bare hour 1-6 is PM.
  function parseTime(s) {
    if (s == null) return null;
    var str = String(s).trim().toLowerCase().replace(/\s+/g, ' ');
    if (!str) return null;
    var m = str.match(/^(\d{1,2})(?:[:.h](\d{2}))?\s*(a\.?m\.?|p\.?m\.?|a|p)?$/) ||
            str.match(/^(\d{1,2})(\d{2})\s*(a\.?m\.?|p\.?m\.?)?$/);
    if (!m) return null;
    var h = parseInt(m[1], 10), min = m[2] ? parseInt(m[2], 10) : 0, ap = m[3] || '';
    if (min > 59 || h > 23) return null;
    if (ap.charAt(0) === 'p' && h < 12) h += 12;
    else if (ap.charAt(0) === 'a' && h === 12) h = 0;
    else if (!ap && h >= 1 && h <= 6) h += 12;
    return h * 60 + min;
  }
  function fmtTime(mins) {
    if (mins == null) return '';
    var h = Math.floor(mins / 60), m = mins % 60, ap = h >= 12 ? 'PM' : 'AM';
    var h12 = h % 12 === 0 ? 12 : h % 12;
    return h12 + ':' + (m < 10 ? '0' : '') + m + ' ' + ap;
  }
  // Finds "8:15-8:40", "8:15 to 9", "1:05pm-1:50pm", "10.30–11" in a line.
  var RANGE_RE = /(\d{1,2}(?:[:.]\d{2})?\s*(?:am|pm|a\.m\.|p\.m\.)?)\s*(?:-|\u2013|\u2014|to|till|until)\s*(\d{1,2}(?:[:.]\d{2})?\s*(?:am|pm|a\.m\.|p\.m\.)?)/i;
  var SINGLE_TIME_RE = /\b(\d{1,2}[:.]\d{2}\s*(?:am|pm)?|\d{1,2}\s*(?:am|pm))\b/i;
  function findTimes(line) {
    var r = String(line).match(RANGE_RE);
    if (r) {
      var a = parseTime(r[1]), b = parseTime(r[2]);
      // Only trust a range when at least one side has a colon/period or am/pm (avoid "pages 3-5").
      if (a != null && b != null && /[:.]|am|pm/i.test(r[0])) {
        // "11:30-1:05" style: if end is before start and a 12-hour shift fixes it, fix.
        if (b < a && b + 720 > a && b + 720 < 24 * 60) b += 720;
        return { start: a, end: b };
      }
    }
    var s = String(line).match(SINGLE_TIME_RE);
    if (s) { var t = parseTime(s[1]); if (t != null) return { start: t, end: null }; }
    return null;
  }

  // Parse class info "period times" box: "P1 8:00-8:50", "Period 2: 8:55-9:45", "Lunch 11:30-12:05".
  function parsePeriods(text) {
    var out = [];
    if (isBlank(text)) return out;
    String(text).split(/\n|;/).forEach(function (line) {
      var t = findTimes(line);
      if (!t) return;
      var label = clean(line.replace(RANGE_RE, '').replace(SINGLE_TIME_RE, '').replace(/[:\-\u2013|,]+\s*$/, '').replace(/^\s*[:\-\u2013|,]+/, ''));
      var pm = line.match(/\b(?:p(?:er(?:iod)?)?\.?\s*(\d{1,2})|(\d{1,2})(?:st|nd|rd|th)\s*(?:period|pd|per))\b/i);
      out.push({ label: label || 'Block', period: pm ? parseInt(pm[1] || pm[2], 10) : null, start: t.start, end: t.end });
    });
    return out;
  }
  function periodRef(text) {
    var m = String(text || '').match(/\b(?:p(?:er(?:iod)?)?\.?\s*(\d{1,2})|(\d{1,2})(?:st|nd|rd|th)\s*(?:period|pd|per|hr|hour))\b/i);
    return m ? parseInt(m[1] || m[2], 10) : null;
  }

  // ---------- deterministic lint ("find gaps" without AI) ----------
  var VAGUE_RE = /\b(the usual|as usual|usual (?:routine|stuff|thing)|like (?:normal|always|usual)|as (?:normal|always)|same as (?:always|usual|yesterday|last (?:time|week)|before)|you know|the thing|the stuff|etc\.?|whatever|wherever|if time|if there'?s time|they know|kids know|they'll know|they will know|ask (?:the )?kids|normal (?:routine|procedure)|w\/e)(?![A-Za-z])/i;
  var CONTAINER_RE = /\bthe\s+(?:[a-z]+\s+){0,2}(bin|folder|cart|shelf|box|tub|drawer|basket|crate|cabinet|closet|tray|pile|stack|bag|binder|caddy|bucket)\b/i;
  var TECH_RE = /\b(canvas|schoology|google classroom|g\.?\s?classroom|ixl|kahoot|quizlet|nearpod|desmos|chromebooks?|ipads?|smart ?board|projector|doc cam|seesaw|clever|raz|lexia|imagine math|zearn|pear ?deck|edpuzzle|blooket|gimkit|brainpop|password|login)\b/i;
  var SHOUT = {}; 'NO NOT DO DONT ALL ONLY NEVER MUST NEED PLS PLEASE STOP OK OKAY YES THE AND AT IN ON IS ARE BE SURE WILL CAN'.split(' ').forEach(function (w) { SHOUT[w] = 1; });
  var KNOWN_CAPS = { AM:1, PM:1, PE:1, OK:1, TV:1, PDF:1, ID:1, USA:1, US:1, I:1, A:1, ELA:1, STUDENT:1, PG:1, PGS:1 };

  function lintPlan(plan, classInfo) {
    var flags = [], questions = [];
    var lines = String(plan || '').split(/\n/).map(function (l) { return l.trim(); }).filter(Boolean);
    var info = classInfo || {};
    var periods = parsePeriods(info.periods);
    var allText = [plan, info.periods, info.routines, info.locations, info.emergency, info.helpers].join('\n');
    var untimed = 0;

    lines.forEach(function (line) {
      var v = line.match(VAGUE_RE);
      if (v) {
        flags.push({ line: line, issue: '"' + v[1] + '" assumes the sub already knows your routine.' });
        questions.push({ question: 'For "' + trimTo(line, 70) + '": what exactly should the sub say or do, step by step?', section: 'schedule', line: line, key: v[1], source: 'checklist' });
      }
      var c = line.match(CONTAINER_RE);
      if (c && !/\b(on|in|under|by|next to|behind|beside|near|top|bottom|left|right|labeled|labelled|marked)\b[^.]*$/i.test(line.slice(line.toLowerCase().indexOf(c[0].toLowerCase()) + c[0].length))) {
        flags.push({ line: line, issue: '"' + c[0] + '": a stranger won\u2019t know where this is.' });
        questions.push({ question: 'Where exactly is "' + c[0] + '"? (e.g. "blue tub on the shelf under the window")', section: 'where', line: line, key: c[0].replace(/^the\s+/i, ''), source: 'checklist' });
      }
      var t = line.match(TECH_RE);
      if (t) {
        flags.push({ line: line, issue: '"' + t[1] + '" may need a login, device or setup the sub doesn\u2019t have.' });
        questions.push({ question: 'For "' + t[1] + '": does the sub need a login, device cart or projector setup? How do they get it (without writing a password on the plan)?', section: 'routines', line: line, key: t[1], source: 'checklist' });
      }
      var caps = (line.match(/\b[A-Z]{2,5}s?\b(?!['\u2019])/g) || []).filter(function (w) {
        return !KNOWN_CAPS[w] && !KNOWN_CAPS[w.replace(/s$/, '')] && !SHOUT[w] && !/^STUDENT/.test(w);
      });
      caps = dedupe(caps);
      if (caps.length) {
        flags.push({ line: line, issue: 'Abbreviation' + (caps.length > 1 ? 's' : '') + ' ' + caps.join(', ') + ' may mean nothing to a sub.' });
        questions.push({ question: 'What ' + (caps.length > 1 ? 'do ' : 'does ') + caps.join(', ') + ' mean, in plain words a sub would understand?', section: 'routines', line: line, key: caps.join(' '), source: 'checklist' });
      }
      if (!findTimes(line) && !periodRef(line)) untimed++;
    });

    if (lines.length && untimed === lines.length && periods.length === 0) {
      flags.push({ line: '(whole plan)', issue: 'No times or periods anywhere, so the sub can\u2019t pace the day.' });
      questions.push({ question: 'What time does each part of the day start and end (or paste your bell schedule)?', section: 'schedule', line: '', key: 'time', source: 'checklist' });
    }
    if (isBlank(info.emergency) && !/\b(fire|lockdown|drill|evacuat|nurse|emergency|epi ?pen|allerg|medical)/i.test(allText)) {
      questions.push({ question: 'Emergency basics: where is the evacuation route / emergency folder, and who should the sub call for help?', section: 'emergency', line: '', source: 'checklist' });
    }
    if (!/\b(early finish|done early|finish(?:ed)? early|if (?:they|students) finish|extra time|fast finish)/i.test(allText)) {
      questions.push({ question: 'What should students do if they finish early?', section: 'routines', line: '', source: 'checklist' });
    }
    if (!/\b(attendance|roll|absent)/i.test(allText)) {
      questions.push({ question: 'How and when should the sub take attendance?', section: 'routines', line: '', source: 'checklist' });
    }
    if (!/\b(leave|collect|turn in|turned in|pile|note for me|notes? (?:for|to) me|leave on my desk|hand in)/i.test(allText)) {
      questions.push({ question: 'At the end of the day, what should the sub collect, and what should they leave on your desk?', section: 'leave_done', line: '', source: 'checklist' });
    }
    if (isBlank(info.helpers) && !/\b(helper|helpful|can help|ask \[STUDENT|reliable|trust)/i.test(allText)) {
      questions.push({ question: 'Which 1\u20132 students can reliably help the sub (use first names; they stay on your device)?', section: 'helpers', line: '', source: 'checklist' });
    }
    return { flags: flags, questions: questions };
  }
  function trimTo(s, n) { s = clean(s); return s.length > n ? s.slice(0, n - 1) + '\u2026' : s; }

  // Merge AI questions with checklist questions; enforce 5-8.
  function finalizeQuestions(aiQuestions, lintQuestions, min, max) {
    min = min || 5; max = max || 8;
    var out = [];
    function similar(a, b) {
      var wa = sigWords(a), wb = sigWords(b);
      if (!wa.length || !wb.length) return false;
      var hit = wa.filter(function (w) { return wb.indexOf(w) > -1; }).length;
      return hit / Math.min(wa.length, wb.length) >= 0.6;
    }
    function add(q, src) {
      if (!q) return;
      var text = clean(typeof q === 'string' ? q : q.question);
      if (text.length < 8) return;
      if (out.some(function (o) { return similar(o.question, text); })) return;
      // Skip a checklist question when an earlier question already covers its key term.
      if (q.key) {
        var keys = String(q.key).toLowerCase().split(/\s+/).filter(function (k) { return k.length > 1; });
        var covered = keys.length && keys.every(function (k) {
          return out.some(function (o) { return o.question.toLowerCase().indexOf(k) > -1; });
        });
        if (covered) return;
      }
      out.push({
        id: 'q' + (out.length + 1), question: text,
        why: clean(q.why || ''), line: clean(q.line || ''), key: q.key || '',
        section: normalizeSection(q.section), source: src
      });
    }
    (aiQuestions || []).forEach(function (q) { if (out.length < max) add(q, 'ai'); });
    (lintQuestions || []).forEach(function (q) { if (out.length < max) add(q, 'checklist'); });
    // Always-useful generic questions if still short.
    var generic = [
      { question: 'What should students do if they finish early?', section: 'routines' },
      { question: 'How and when should the sub take attendance?', section: 'routines' },
      { question: 'At the end of the day, what should the sub collect, and what should they leave on your desk?', section: 'leave_done' },
      { question: 'Which 1\u20132 students can reliably help the sub?', section: 'helpers' },
      { question: 'Emergency basics: where is the evacuation route / emergency folder, and who should the sub call for help?', section: 'emergency' },
      { question: 'What is your attention signal or behavior routine the class responds to?', section: 'routines' }
    ];
    generic.forEach(function (q) { if (out.length < min) add(q, 'checklist'); });
    return out.slice(0, max);
  }
  function normalizeSection(s) {
    s = String(s || '').toLowerCase();
    if (/where|locat|material|supply/.test(s)) return 'where';
    if (/help|student/.test(s)) return 'helpers';
    if (/emerg|procedure|safety|medical|drill/.test(s)) return 'emergency';
    if (/leave|done|end|collect/.test(s)) return 'leave_done';
    if (/routine|behav|attend|signal|rule/.test(s)) return 'routines';
    return 'schedule';
  }

  var STOP = {};
  ('the and for with that this from they them their then than have will your into what when where which while about after before over under each just also only very some more most such these those there here been were being does done dont cant wont should would could need needs make sure use using used page pages class students student sub kids today minutes min mins time').split(' ').forEach(function (w) { STOP[w] = true; });
  function stem(w) { return w.replace(/(ing|ed|es|s)$/, ''); }
  function sigWords(s) {
    return (String(s || '').toLowerCase().match(/[a-z][a-z'']{3,}/g) || [])
      .map(function (w) { return stem(w.replace(/'/g, '')); })
      .filter(function (w) { return w.length >= 3 && !STOP[w]; });
  }

  // ---------- prompts ----------
  var GAP_SCHEMA = {
    type: 'object',
    properties: {
      flags: { type: 'array', items: { type: 'object', properties: { line: { type: 'string' }, issue: { type: 'string' } }, required: ['line', 'issue'] } },
      questions: { type: 'array', items: { type: 'object', properties: {
        question: { type: 'string' }, why: { type: 'string' }, line: { type: 'string' },
        section: { type: 'string', enum: ['schedule', 'where', 'routines', 'helpers', 'emergency', 'leave_done'] } },
        required: ['question', 'section'] } }
    },
    required: ['flags', 'questions']
  };
  var SCRIPT_SCHEMA = {
    type: 'object',
    properties: {
      title: { type: 'string' },
      schedule: { type: 'array', items: { type: 'object', properties: {
        start: { type: 'string' }, end: { type: 'string' }, block: { type: 'string' },
        steps: { type: 'array', items: { type: 'string' } } }, required: ['block', 'steps'] } },
      where_things_are: { type: 'array', items: { type: 'object', properties: { item: { type: 'string' }, location: { type: 'string' } }, required: ['item', 'location'] } },
      routines: { type: 'array', items: { type: 'string' } },
      helpers: { type: 'array', items: { type: 'object', properties: { student: { type: 'string' }, how: { type: 'string' } }, required: ['student', 'how'] } },
      emergency: { type: 'array', items: { type: 'string' } },
      leave_done: { type: 'array', items: { type: 'string' } },
      missing: { type: 'array', items: { type: 'string' } }
    },
    required: ['schedule', 'where_things_are', 'routines', 'helpers', 'emergency', 'leave_done', 'missing']
  };

  function classInfoBlock(info) {
    info = info || {};
    var parts = [];
    if (!isBlank(info.className)) parts.push('Class/grade: ' + info.className);
    if (!isBlank(info.periods)) parts.push('Period times:\n' + info.periods);
    if (!isBlank(info.routines)) parts.push('Routines:\n' + info.routines);
    if (!isBlank(info.locations)) parts.push('Seating / where things are:\n' + info.locations);
    if (!isBlank(info.helpers)) parts.push('Students who help / notes:\n' + info.helpers);
    if (!isBlank(info.emergency)) parts.push('Emergency info:\n' + info.emergency);
    return parts.length ? parts.join('\n\n') : '(none given)';
  }

  var RULES = 'Rules: Use ONLY facts written by the teacher below. Never invent activities, page numbers, materials, times, rules or names. ' +
    'Student names have been replaced with tokens like [STUDENT_1]; keep tokens exactly as written and never guess real names.';

  function buildGapPrompt(maskedPlan, maskedInfo) {
    return [
      'You are helping a teacher prepare plans for a substitute teacher who has never been in this classroom and cannot ask questions.',
      RULES,
      'Task: find every line a stranger could not act on (vague references like "the usual", unexplained abbreviations, unknown locations, missing times, logins, missing procedures). ' +
      'Then write 5 to 8 short, specific questions to the teacher that would fill those gaps. Ask, do not answer.',
      'Reply with ONLY a JSON object in a ```json fenced block, shaped like:',
      '```json\n{"flags":[{"line":"exact line from the plan","issue":"why a stranger cannot act on it"}],' +
      '"questions":[{"question":"...","why":"...","line":"exact line or empty","section":"schedule|where|routines|helpers|emergency|leave_done"}]}\n```',
      '--- TEACHER PLAN ---\n' + maskedPlan,
      '--- CLASS INFO ---\n' + classInfoBlock(maskedInfo)
    ].join('\n\n');
  }

  function buildScriptPrompt(maskedPlan, maskedInfo, qa) {
    var qaText = qa.map(function (x, i) {
      return 'Q' + (i + 1) + ': ' + x.question + '\nA' + (i + 1) + ': ' + (isBlank(x.answer) ? '(no answer)' : x.answer);
    }).join('\n\n');
    return [
      'You are turning a teacher\u2019s own notes into a step-by-step script for a substitute teacher.',
      RULES,
      'Rewrite the plan and the answers into clear, numbered, do-this-then-that steps. Keep every time the teacher gave. ' +
      'If a time is not given, leave start/end as "". If something a sub needs is not provided, do NOT fill it in: add a short note to "missing" instead. ' +
      'Each step must come from the plan, the class info or an answer.',
      'Reply with ONLY a JSON object in a ```json fenced block, shaped like:',
      '```json\n{"title":"","schedule":[{"start":"8:15","end":"8:35","block":"name of block","steps":["step 1","step 2"]}],' +
      '"where_things_are":[{"item":"","location":""}],"routines":[""],"helpers":[{"student":"[STUDENT_1]","how":""}],' +
      '"emergency":[""],"leave_done":[""],"missing":[""]}\n```',
      '--- TEACHER PLAN ---\n' + maskedPlan,
      '--- CLASS INFO ---\n' + classInfoBlock(maskedInfo),
      '--- TEACHER ANSWERS ---\n' + (qaText || '(none)')
    ].join('\n\n');
  }

  // ---------- robust JSON extraction ----------
  function extractJSON(text) {
    if (text == null) throw new Error('No AI response to read.');
    var s = String(text).trim();
    if (!s) throw new Error('The AI response is empty. Paste the whole reply, including the ```json block.');
    var candidates = [];
    var fence = /```(?:json|JSON|javascript|js)?\s*\n?([\s\S]*?)```/g, m;
    while ((m = fence.exec(s))) candidates.push(m[1]);
    // Unterminated fence (chat UIs sometimes cut the closing ```).
    var open = s.match(/```(?:json|JSON)?\s*\n?([\s\S]*)$/);
    if (open && !candidates.length) candidates.push(open[1]);
    var bal = firstBalanced(s);
    if (bal) candidates.push(bal);
    candidates.push(s);
    var lastErr;
    for (var i = 0; i < candidates.length; i++) {
      var c = candidates[i];
      var b = firstBalanced(c) || c;
      var tries = [b, repairJSON(b)];
      for (var j = 0; j < tries.length; j++) {
        try {
          var v = JSON.parse(tries[j]);
          if (v && typeof v === 'object') return v;
        } catch (e) { lastErr = e; }
      }
    }
    throw new Error('Couldn\u2019t find the plan data in that reply. Ask the chatbot: "Please resend only the JSON in a ```json block."');
  }
  function firstBalanced(s) {
    var start = -1, depth = 0, inStr = false, q = '', esc2 = false;
    for (var i = 0; i < s.length; i++) {
      var ch = s[i];
      if (start === -1) { if (ch === '{') { start = i; depth = 1; } continue; }
      if (inStr) {
        if (esc2) esc2 = false; else if (ch === '\\') esc2 = true; else if (ch === q) inStr = false;
        continue;
      }
      if (ch === '"') { inStr = true; q = ch; }
      else if (ch === '{') depth++;
      else if (ch === '}') { depth--; if (depth === 0) return s.slice(start, i + 1); }
    }
    if (start > -1) return closeTruncated(s.slice(start));
    return null;
  }
  // Best-effort close of a truncated object (model ran out of tokens).
  function closeTruncated(s) {
    var stack = [], inStr = false, e = false;
    for (var i = 0; i < s.length; i++) {
      var ch = s[i];
      if (inStr) { if (e) e = false; else if (ch === '\\') e = true; else if (ch === '"') inStr = false; continue; }
      if (ch === '"') inStr = true;
      else if (ch === '{' || ch === '[') stack.push(ch === '{' ? '}' : ']');
      else if (ch === '}' || ch === ']') stack.pop();
    }
    var out = s;
    if (inStr) out += '"';
    out = out.replace(/,\s*$/, '');
    while (stack.length) out += stack.pop();
    return out;
  }
  function repairJSON(s) {
    return String(s)
      .replace(/[\u201C\u201D\u201E\u201F\u2033]/g, '"')
      .replace(/[\u2018\u2019\u201A\u201B\u2032]/g, "'")
      .replace(/^\s*\/\/.*$/gm, '')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/,\s*([}\]])/g, '$1')
      .replace(/([{,]\s*)([A-Za-z_][A-Za-z0-9_]*)\s*:/g, '$1"$2":')
      .replace(/:\s*'([^'\\]*(?:\\.[^'\\]*)*)'/g, function (a, v) { return ': ' + JSON.stringify(v); })
      .replace(/\bNone\b/g, 'null').replace(/\bTrue\b/g, 'true').replace(/\bFalse\b/g, 'false');
  }

  // ---------- validation / normalization ----------
  function asArray(x) {
    if (Array.isArray(x)) return x;
    if (x == null || x === '') return [];
    return [x];
  }
  function asStrings(x) {
    return asArray(x).map(function (v) {
      if (v && typeof v === 'object') return clean(Object.keys(v).map(function (k) { return v[k]; }).join(' \u2014 '));
      return clean(v);
    }).filter(function (v) { return v && !/^(n\/?a|none|null|-|\.\.\.)$/i.test(v); });
  }

  function normalizeGaps(obj) {
    obj = obj || {};
    var flags = asArray(obj.flags || obj.issues || obj.gaps).map(function (f) {
      if (typeof f === 'string') return { line: '', issue: clean(f) };
      return { line: clean(f.line || f.text || ''), issue: clean(f.issue || f.reason || f.problem || '') };
    }).filter(function (f) { return f.issue || f.line; });
    var qs = asArray(obj.questions || obj.question).map(function (q) {
      if (typeof q === 'string') return { question: q, section: 'schedule' };
      return { question: q.question || q.q || q.text || '', why: q.why || '', line: q.line || '', section: q.section || q.category || '' };
    });
    return { flags: flags, questions: qs };
  }

  // Grounding check: flags AI text whose content words aren't in the teacher's material.
  function groundingScore(text, corpusWords) {
    var w = sigWords(text);
    if (w.length < 3) return 1;
    var hit = w.filter(function (x) { return corpusWords[x]; }).length;
    return hit / w.length;
  }
  function corpusIndex(texts) {
    var idx = {};
    texts.forEach(function (t) { sigWords(t).forEach(function (w) { idx[w] = true; }); });
    return idx;
  }

  // Normalize the AI script into a render-ready model with code-computed times.
  function normalizeScript(obj, ctx) {
    obj = obj || {};
    ctx = ctx || {};
    var periods = parsePeriods((ctx.classInfo || {}).periods);
    var corpus = corpusIndex([ctx.plan || '', classInfoBlock(ctx.classInfo || {})].concat((ctx.qa || []).map(function (x) { return x.answer || ''; })));
    var warnings = [];

    var sched = asArray(obj.schedule || obj.blocks || obj.timeline).map(function (b, i) {
      if (typeof b === 'string') b = { block: b, steps: [] };
      var block = clean(b.block || b.title || b.name || b.activity || 'Block ' + (i + 1));
      var steps = asStrings(b.steps || b.instructions || b.details || b.what || []);
      var start = parseTime(b.start), end = parseTime(b.end);
      if (start == null && typeof b.time === 'string') { var ft = findTimes(b.time); if (ft) { start = ft.start; end = ft.end; } }
      if (start == null) { var ft2 = findTimes(block); if (ft2) { start = ft2.start; end = end == null ? ft2.end : end; } }
      var timeSource = start != null ? 'teacher' : null;
      if (start == null) {
        var pr = periodRef(block) || periodRef(steps.join(' '));
        var p = null;
        if (pr != null) p = periods.filter(function (x) { return x.period === pr; })[0];
        if (!p) {
          var bl = block.toLowerCase();
          p = periods.filter(function (x) { return x.label && bl.indexOf(x.label.toLowerCase()) > -1 && x.label.length > 2; })[0] ||
              periods.filter(function (x) { return x.label && x.label.length > 2 && bl.indexOf(x.label.toLowerCase().split(' ')[0]) > -1 && !/^(p|per|period)$/i.test(x.label.split(' ')[0]); })[0];
        }
        if (p) { start = p.start; end = p.end; timeSource = 'bell schedule'; }
      }
      var checked = steps.map(function (s) {
        var g = groundingScore(s, corpus);
        return { text: s, unverified: g < 0.5 };
      });
      return { idx: i, block: block, start: start, end: end, timeSource: timeSource, steps: checked };
    });

    // Stable sort by time, keeping untimed blocks near their original neighbors.
    var timed = sched.filter(function (b) { return b.start != null; }).sort(function (a, b) { return a.start - b.start || a.idx - b.idx; });
    var result = [];
    if (timed.length === sched.length) result = timed;
    else {
      var ti = 0;
      sched.forEach(function (b) {
        if (b.start == null) { result.push(b); return; }
        result.push(timed[ti++]);
      });
    }
    // Fill missing end times from next block's start; compute durations; detect overlaps.
    for (var i = 0; i < result.length; i++) {
      var b = result[i];
      if (b.start != null && b.end == null) {
        var nx = result[i + 1];
        if (nx && nx.start != null && nx.start > b.start) { b.end = nx.start; b.endInferred = true; }
      }
      if (b.start != null && b.end != null && b.end <= b.start) { warnings.push('"' + b.block + '": end time is before start time. Please check.'); b.end = null; }
      b.minutes = b.start != null && b.end != null ? b.end - b.start : null;
      if (i > 0) {
        var prev = result[i - 1];
        if (prev.end != null && b.start != null && b.start < prev.end) warnings.push('"' + prev.block + '" overlaps "' + b.block + '" (' + fmtTime(b.start) + ' starts before ' + fmtTime(prev.end) + ').');
      }
      if (!b.steps.length) b.steps = [{ text: PLACEHOLDER, placeholder: true }];
    }

    function list(x, fallbackNote) {
      var a = asStrings(x).map(function (s) { return { text: s, unverified: groundingScore(s, corpus) < 0.5 }; });
      return a.length ? a : [{ text: fallbackNote || PLACEHOLDER, placeholder: true }];
    }
    var where = asArray(obj.where_things_are || obj.where || obj.locations).map(function (w) {
      if (typeof w === 'string') { var p = w.split(/\s[-\u2013\u2014:]\s|:\s/); return { item: clean(p[0]), location: clean(p.slice(1).join(' ')) }; }
      return { item: clean(w.item || w.thing || w.what), location: clean(w.location || w.where) };
    }).filter(function (w) { return w.item; }).map(function (w) {
      var loc = w.location && !/^(unknown|not (?:given|provided)|\?+|n\/?a)$/i.test(w.location) ? w.location : '';
      return { item: w.item, location: loc || PLACEHOLDER, placeholder: !loc, unverified: loc ? groundingScore(w.item + ' ' + loc, corpus) < 0.5 : false };
    });
    var helpers = asArray(obj.helpers || obj.students_who_help).map(function (h) {
      if (typeof h === 'string') return { student: '', how: clean(h) };
      return { student: clean(h.student || h.name), how: clean(h.how || h.role || h.note) };
    }).filter(function (h) { return h.student || h.how; });

    var model = {
      title: clean(obj.title) || (ctx.classInfo && clean(ctx.classInfo.className)) || 'Substitute plan',
      schedule: result,
      where: where.length ? where : [{ item: 'Materials', location: PLACEHOLDER, placeholder: true }],
      routines: list(obj.routines),
      helpers: helpers.length ? helpers.map(function (h) { return { student: h.student, how: h.how || PLACEHOLDER, unverified: false }; }) : [{ student: '', how: PLACEHOLDER, placeholder: true }],
      emergency: list(obj.emergency || obj.procedures, 'Not provided \u2014 ask the office for the emergency folder and evacuation route'),
      leave_done: list(obj.leave_done || obj.leave || obj.end_of_day),
      missing: asStrings(obj.missing),
      warnings: warnings
    };
    var untimed = result.filter(function (b) { return b.start == null; }).length;
    if (untimed) model.missing.push(untimed + ' block(s) have no time \u2014 check the bell schedule.');
    var unver = countUnverified(model);
    if (unver) model.warnings.push(unver + ' line(s) use words that aren\u2019t in your notes. They\u2019re marked \u201cCheck\u201d \u2014 read them before printing.');
    return model;
  }
  function countUnverified(m) {
    var n = 0;
    m.schedule.forEach(function (b) { b.steps.forEach(function (s) { if (s.unverified) n++; }); });
    ['routines', 'emergency', 'leave_done', 'where'].forEach(function (k) { m[k].forEach(function (s) { if (s.unverified) n++; }); });
    return n;
  }

  // ---------- no-AI fallback: deterministic script from the teacher's own lines ----------
  function scriptWithoutAI(plan, classInfo, qa) {
    var lines = String(plan || '').split(/\n/).map(function (l) { return l.replace(/^\s*[-*\u2022]+\s*/, '').trim(); }).filter(Boolean);
    var schedule = [];
    lines.forEach(function (line) {
      var t = findTimes(line);
      var text = clean(line.replace(RANGE_RE, '').replace(SINGLE_TIME_RE, '').replace(/^[\s:\-\u2013|,]+/, ''));
      var parts = text.split(/\s*(?:->|=>|;|\. (?=[A-Z]))\s*/).filter(Boolean);
      var block = parts.length > 1 ? parts[0] : trimTo(text, 40);
      var steps = parts.length > 1 ? parts.slice(1) : [text];
      schedule.push({ start: t ? fmtTime(t.start) : '', end: t && t.end != null ? fmtTime(t.end) : '', block: block, steps: steps });
    });
    var bySection = { schedule: [], where: [], routines: [], helpers: [], emergency: [], leave_done: [] };
    (qa || []).forEach(function (x) { if (!isBlank(x.answer)) bySection[normalizeSection(x.section)].push(clean(x.answer)); });
    if (bySection.schedule.length) schedule.push({ start: '', end: '', block: 'Extra notes from the teacher', steps: bySection.schedule });
    var info = classInfo || {};
    function linesOf(s) { return String(s || '').split(/\n/).map(clean).filter(Boolean); }
    return {
      title: clean(info.className) || 'Substitute plan',
      schedule: schedule,
      where_things_are: linesOf(info.locations).concat(bySection.where).map(function (l) { var p = l.split(/\s[-\u2013\u2014:]\s|:\s/); return { item: p[0], location: p.slice(1).join(' ') || l }; }),
      routines: linesOf(info.routines).concat(bySection.routines),
      helpers: linesOf(info.helpers).concat(bySection.helpers).map(function (l) { return { student: '', how: l }; }),
      emergency: linesOf(info.emergency).concat(bySection.emergency),
      leave_done: bySection.leave_done,
      missing: []
    };
  }

  // ---------- rendering ----------
  function renderScriptHTML(model, opts) {
    opts = opts || {};
    var h = [];
    function itemHTML(s) {
      var cls = s.placeholder ? ' class="ph"' : (s.unverified ? ' class="unv"' : '');
      var tag = s.unverified ? ' <span class="chip">Check</span>' : '';
      return '<li' + cls + '>' + esc(s.text) + tag + '</li>';
    }
    h.push('<article class="script">');
    h.push('<header class="script-head"><h2>' + esc(model.title) + '</h2>');
    if (opts.date) h.push('<p class="script-date">' + esc(opts.date) + '</p>');
    h.push('<p class="script-note">Welcome, and thank you for covering this class. Follow the steps in order. Anything marked \u201cNot provided\u201d wasn\u2019t in my notes \u2014 please ask the office.</p></header>');
    if (model.warnings && model.warnings.length && !opts.forPrint) {
      h.push('<div class="warn no-print"><strong>Before you print:</strong><ul>' + model.warnings.map(function (w) { return '<li>' + esc(w) + '</li>'; }).join('') + '</ul></div>');
    }
    h.push('<section><h3>Schedule</h3><ol class="timeline">');
    model.schedule.forEach(function (b) {
      var time = b.start != null
        ? esc(fmtTime(b.start)) + (b.end != null ? '\u2013' + esc(fmtTime(b.end)) : '') + (b.minutes ? ' <span class="dur">(' + b.minutes + ' min)</span>' : '')
        : '<span class="ph">' + esc(TIME_PLACEHOLDER) + '</span>';
      var src = b.timeSource === 'bell schedule' ? ' <span class="chip soft">from bell schedule</span>' : '';
      h.push('<li class="block"><div class="when">' + time + src + '</div><div class="what"><h4>' + esc(b.block) + '</h4><ol>' +
        b.steps.map(itemHTML).join('') + '</ol></div></li>');
    });
    h.push('</ol></section>');
    h.push('<section><h3>Where things are</h3><ul class="where">' + model.where.map(function (w) {
      return '<li' + (w.placeholder ? ' class="ph"' : (w.unverified ? ' class="unv"' : '')) + '><strong>' + esc(w.item) + ':</strong> ' + esc(w.location) + (w.unverified ? ' <span class="chip">Check</span>' : '') + '</li>';
    }).join('') + '</ul></section>');
    h.push('<section><h3>Routines</h3><ul>' + model.routines.map(itemHTML).join('') + '</ul></section>');
    h.push('<section><h3>Students who can help</h3><ul>' + model.helpers.map(function (x) {
      return '<li' + (x.placeholder ? ' class="ph"' : '') + '>' + (x.student ? '<strong>' + esc(x.student) + ':</strong> ' : '') + esc(x.how) + '</li>';
    }).join('') + '</ul></section>');
    h.push('<section class="emergency"><h3>Emergency &amp; procedures</h3><ul>' + model.emergency.map(itemHTML).join('') + '</ul></section>');
    h.push('<section><h3>Before you leave</h3><ul class="checks">' + model.leave_done.map(itemHTML).join('') + '</ul></section>');
    if (model.missing && model.missing.length) {
      h.push('<section class="missing"><h3>Not provided \u2014 ask the office</h3><ul>' + model.missing.map(function (m) { return '<li class="ph">' + esc(m) + '</li>'; }).join('') + '</ul></section>');
    }
    h.push('<section class="sub-notes"><h3>Notes for me (optional)</h3><div class="lines"></div></section>');
    h.push('</article>');
    return h.join('');
  }

  // ---------- input validation ----------
  function validateInput(plan) {
    var p = String(plan || '').trim();
    if (!p) return 'Paste your plan first \u2014 even rough notes are fine.';
    if (p.replace(/[^A-Za-z]/g, '').length < 12) return 'That\u2019s very short. Add a few lines about what students should do.';
    if (p.length > 12000) return 'That\u2019s long for one day (over 12,000 characters). Paste one day at a time.';
    return null;
  }

  return {
    PLACEHOLDER: PLACEHOLDER, TIME_PLACEHOLDER: TIME_PLACEHOLDER,
    GAP_SCHEMA: GAP_SCHEMA, SCRIPT_SCHEMA: SCRIPT_SCHEMA,
    esc: esc, detectRosterNames: detectRosterNames, parseNameList: parseNameList,
    buildNameMap: buildNameMap, maskNames: maskNames, unmaskNames: unmaskNames, unmaskDeep: unmaskDeep,
    parseTime: parseTime, fmtTime: fmtTime, findTimes: findTimes, parsePeriods: parsePeriods,
    lintPlan: lintPlan, finalizeQuestions: finalizeQuestions,
    buildGapPrompt: buildGapPrompt, buildScriptPrompt: buildScriptPrompt,
    extractJSON: extractJSON, normalizeGaps: normalizeGaps, normalizeScript: normalizeScript,
    scriptWithoutAI: scriptWithoutAI, renderScriptHTML: renderScriptHTML, validateInput: validateInput,
    sigWords: sigWords
  };
});
