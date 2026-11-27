/* Sub-Ready class binder: pure logic (no DOM, no network).
   Saved class profiles, multiple periods, the reusable emergency plan and the front-office print pack.
   Everything here runs on the teacher's device. Nothing is sent anywhere. */
(function (root, factory) {
  var node = typeof module === 'object' && module.exports;
  var C = node ? require('./core.js') : root.SubReadyCore;
  var Q = node ? require('./vendor/qrcode.js') : root.qrcode;   // MIT QR generator, runs on this device
  var api = factory(C, Q);
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.SubReadyBinder = api;
})(typeof self !== 'undefined' ? self : this, function (C, qrcode) {
  'use strict';
  var VERSION = 1;
  var STORAGE_KEY = 'subready.binder.v1';
  var MAX_CLASSES = 12, MAX_CONTACTS = 20, MAX_FIELD = 4000;
  var NP = C.PLACEHOLDER;               // "Not provided — ask the office or a neighboring teacher"
  var esc = C.esc;

  // Shared (whole-room) fields and per-period fields, with labels used in the UI, print pack and gap check.
  var SHARED_FIELDS = [
    ['teacher', 'Teacher name', false], ['room', 'Room', false], ['school', 'School', false],
    ['arrival', 'When the sub arrives (keys, sign-in, where to find this binder)', true],
    ['bathroom', 'Bathroom / hall pass procedure', true],
    ['emergency', 'Emergency procedures (fire, lockdown, shelter; where the emergency folder is)', true],
    ['health', 'Health & allergy notes (where the list is kept; who to call)', true],
    ['dismissal', 'Dismissal / end of day', true],
    ['leave', 'What to leave done before going home', true],
    ['students', 'Student first names used in these notes', false],
    // Quick-win extras (optional; printed only when filled in).
    ['pronounce', 'Name pronunciation (one per line: name - how to say it)', false],
    ['tellYou', 'Things students may tell you (that aren\u2019t true)', false],
    ['phones', 'Phone policy', false],
    ['goTo', 'Go-to adult nearby (name and room)', false],
    ['rules', 'Must-follow rules', false],
    // The sub's end-of-day note comes back to the teacher's OWN address or number. Only printed, never sent by Sub-Ready.
    ['noteEmail', 'Your email for the sub\u2019s end-of-day note', false],
    ['notePhone', 'Or a mobile number to text it to', false],
    // Filled in by a school file (or typed): the building's bell schedule.
    ['bells', 'School bell schedule', false]
  ];
  var SHORT_SHARED = { teacher: 120, room: 120, school: 120, noteEmail: 120, notePhone: 40, phones: 1000, goTo: 300 };
  var CHART_MAX = 10, MAX_SEATS = 100, MAX_LESSONS = 30;
  var CLASS_FIELDS = [
    ['label', 'Period / section name', true], ['start', 'Start time', true], ['end', 'End time', true],
    ['location', 'Room (if different)', false],
    ['routines', 'Routines (attention signal, attendance, early finishers)', true],
    ['seating', 'Seating & help notes', true],
    ['helpers', 'Students who can help', true],
    ['supplies', 'Where supplies and materials are', true],
    ['anyDay', 'Any-day plan (no-prep work for a surprise absence)', true]
  ];
  // Optional per-period extras (never required, never in the gap check).
  //   story*:   the paper pass-the-page story activity (no accounts, no devices).
  var EXTRA_FIELDS = [
    ['storyOn', 'Add the pass-the-page story activity', 5], ['storyPrompt', 'Story starter', 400], ['storyMinutes', 'Minutes per turn', 3]
  ];
  var STORY_STARTERS = [
    'The classroom door opened by itself, and on the floor was a map nobody had seen before.',
    'Our class pet escaped at lunch, and it left a trail of tiny footprints that led somewhere surprising.',
    'Every clock in the school stopped at 10:14, except one.'
  ];

  function str(v, max) {
    if (v == null) return '';
    if (typeof v !== 'string') v = (typeof v === 'number' || typeof v === 'boolean') ? String(v) : '';
    v = v.replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');
    return v.slice(0, max || MAX_FIELD);
  }
  function blank(v) { return !v || !String(v).trim(); }
  var idSeq = 0;
  function newId() { idSeq++; return 'c' + Date.now().toString(36) + idSeq.toString(36) + Math.floor(Math.random() * 1e4).toString(36); }

  function emptyClass(label) {
    var c = { id: newId() };
    CLASS_FIELDS.forEach(function (f) { c[f[0]] = ''; });
    EXTRA_FIELDS.forEach(function (f) { c[f[0]] = ''; });
    c.chart = normChart(null);
    c.label = label || '';
    return c;
  }
  function emptyBinder() {
    var b = { version: VERSION, contacts: [], lessonBank: [], classes: [emptyClass('Period 1')] };
    SHARED_FIELDS.forEach(function (f) { b[f[0]] = ''; });
    return b;
  }

  function clampInt(v, lo, hi, dflt) { v = parseInt(v, 10); return isNaN(v) ? dflt : Math.max(lo, Math.min(hi, v)); }
  // Seating chart: a rows x cols grid; each placed seat has a first name, how to say it, and a short note.
  function normChart(x) {
    x = x && typeof x === 'object' && !Array.isArray(x) ? x : {};
    var ch = { rows: clampInt(x.rows, 1, CHART_MAX, 5), cols: clampInt(x.cols, 1, CHART_MAX, 6), seats: [] };
    var taken = {};
    (Array.isArray(x.seats) ? x.seats : []).slice(0, MAX_SEATS * 2).forEach(function (st) {
      if (!st || typeof st !== 'object') return;
      var r = parseInt(st.r, 10), c = parseInt(st.c, 10);
      if (isNaN(r) || isNaN(c) || r < 0 || c < 0 || r >= ch.rows || c >= ch.cols) return;
      var name = str(st.name, 40).replace(/\n/g, ' ').trim();
      if (!name || taken[r + ',' + c] || ch.seats.length >= MAX_SEATS) return;
      taken[r + ',' + c] = 1;
      ch.seats.push({ r: r, c: c, name: name, say: str(st.say, 60).replace(/\n/g, ' '), note: str(st.note, 120).replace(/\n/g, ' ') });
    });
    ch.seats.sort(function (a, b) { return a.r - b.r || a.c - b.c; });
    return ch;
  }
  function normLessons(list) {
    var seen = {};
    return (Array.isArray(list) ? list : []).filter(function (x) { return x && typeof x === 'object'; }).map(function (x) {
      return { title: str(x.title, 120).replace(/\n/g, ' ').trim(), plan: str(x.plan, MAX_FIELD) };
    }).filter(function (x) {
      var k = (x.title + '\u0000' + x.plan).toLowerCase();
      if (blank(x.plan) || seen[k]) return false; seen[k] = 1; return true;
    }).slice(0, MAX_LESSONS);
  }
  // Every name the teacher has typed anywhere in the binder: student list, pronunciation lines, seating charts, helpers.
  function pronounceNames(text) {
    return String(text || '').split('\n').map(function (l) { return l.split(/\s+[-\u2013\u2014:=]\s+|\s*[:=]\s*|\s+\(/)[0].trim(); })
      .filter(function (n) { return n && n.length <= 40 && /^[A-Za-z\u00c0-\u024f][A-Za-z\u00c0-\u024f.' -]*$/.test(n); });
  }
  function allNames(b) {
    var list = C.parseNameList(b.students).concat(pronounceNames(b.pronounce));
    b.classes.forEach(function (c) { (c.chart ? c.chart.seats : []).forEach(function (st) { list.push(st.name); }); list = list.concat(C.detectRosterNames(c.helpers)); });
    var seen = {}, out = [];
    list.forEach(function (n) { n = String(n || '').trim(); var k = n.toLowerCase(); if (n && !seen[k]) { seen[k] = 1; out.push(n); } });
    return out;
  }

  // ---------- QR code (drawn on this device as inline SVG; no image service) ----------
  function qrSVG(text, label) {
    var q = qrcode(0, 'M');
    q.addData(String(text));
    q.make();
    var n = q.getModuleCount(), m = 4, size = n + m * 2, d = '';
    for (var r = 0; r < n; r++) for (var c = 0; c < n; c++) if (q.isDark(r, c)) d += 'M' + (c + m) + ',' + (r + m) + 'h1v1h-1z';
    return '<svg class="qr" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + size + ' ' + size + '" role="img" aria-label="' + esc(label || 'QR code') + '" shape-rendering="crispEdges"><rect width="' + size + '" height="' + size + '" fill="#fff"/><path d="' + d + '" fill="#000"/></svg>';
  }

  // ---------- end-of-day note: prefilled mailto:/sms: to the teacher's own address or number ----------
  var EMAIL_RE = /^[^\s@<>"'(),;:\\\[\]]+@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)*\.[A-Za-z]{2,}$/;
  function cleanEmail(v) { v = String(v || '').trim(); return EMAIL_RE.test(v) && v.length <= 120 ? v : ''; }
  function cleanPhone(v) { v = String(v || '').trim(); if (!v) return ''; var d = v.replace(/[\s().-]/g, ''); return /^\+?\d{7,15}$/.test(d) ? d : ''; }
  function noteBody(b, date) {
    var room = b.room ? 'Room ' + b.room.replace(/^room\s*/i, '') : '';
    // Kept short so the QR code stays small enough to scan from paper.
    return ['End-of-day note' + (room ? ', ' + room : '') + (date ? ', ' + date : ''), 'How it went:', 'Done:', 'Not done:', 'Anything I should know:', 'From:'].join('\n');
  }
  // Only the teacher's own contact, room and date go into the link. No student names, ever.
  function noteLinks(b, date) {
    var email = cleanEmail(b.noteEmail), phone = cleanPhone(b.notePhone);
    var room = b.room ? 'Room ' + b.room.replace(/^room\s*/i, '') : '';
    var subject = 'Sub note' + (room ? ': ' + room : '') + (date ? ', ' + date : '');
    var body = noteBody(b, date);
    return {
      email: email, phone: phone,
      emailBad: !blank(b.noteEmail) && !email, phoneBad: !blank(b.notePhone) && !phone,
      mailto: email ? 'mailto:' + email + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body) : '',
      sms: phone ? 'sms:' + phone + '?&body=' + encodeURIComponent(body) : ''
    };
  }

  // ---------- shared school file (Building plan): export / import / merge, no live sync ----------
  var SCHOOL_PROC = ['arrival', 'bathroom', 'emergency', 'dismissal', 'phones', 'rules', 'leave'];
  // Builds a school-wide file from this binder. Never includes students, health notes, pronunciations, seating,
  // periods or the teacher's own contact. Any line that mentions a name from this binder is dropped and reported.
  function buildSchoolFile(binder, now) {
    var b = normalizeBinder(binder);
    var names = allNames(b), removed = [];
    function scrub(text, where) {
      return String(text || '').split('\n').filter(function (line) {
        var hit = names.filter(function (n) { return new RegExp('(^|[^A-Za-z])' + n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?![A-Za-z])', 'i').test(line); })[0];
        if (hit) removed.push(where + ': a line mentioning ' + hit);
        return !hit;
      }).join('\n').trim();
    }
    var procedures = {};
    SCHOOL_PROC.forEach(function (k) { procedures[k] = scrub(b[k], k); });
    var file = {
      app: 'sub-ready', kind: 'school-file', version: 1, exportedAt: (now || new Date()).toISOString(),
      note: 'School-wide procedures for Sub-Ready binders. Contains no student information.',
      school: {
        name: b.school, bells: scrub(b.bells, 'bells'), procedures: procedures,
        contacts: b.contacts.filter(function (x) { return !blank(x.role); }).map(function (x) { return { role: x.role, contact: scrub(x.contact, 'contact ' + x.role) }; }),
        lessons: b.lessonBank.map(function (l) { return { title: scrub(l.title, 'lesson title'), plan: scrub(l.plan, 'lesson ' + (l.title || '')) }; }).filter(function (l) { return !blank(l.plan); })
      }
    };
    return { json: JSON.stringify(file, null, 2), file: file, removed: removed };
  }
  function normSchool(x) {
    x = x && typeof x === 'object' && !Array.isArray(x) ? x : {};
    var pr = x.procedures && typeof x.procedures === 'object' ? x.procedures : {};
    var out = { name: str(x.name, 120), bells: str(x.bells), procedures: {}, contacts: [], lessons: normLessons(x.lessons) };
    SCHOOL_PROC.forEach(function (k) { out.procedures[k] = str(pr[k]); });
    out.contacts = (Array.isArray(x.contacts) ? x.contacts : []).filter(function (c) { return c && typeof c === 'object'; }).slice(0, MAX_CONTACTS)
      .map(function (c) { return { role: str(c.role, 80), contact: str(c.contact, 200) }; }).filter(function (c) { return !blank(c.role); });
    return out;
  }
  function parseSchoolFile(text) {
    var raw = String(text == null ? '' : text).replace(/^\uFEFF/, '').trim();
    if (!raw) throw new Error('That file is empty.');
    if (raw.length > 2000000) throw new Error('That file is too large to be a school file.');
    var d; try { d = JSON.parse(raw); } catch (e) { throw new Error('That file isn\u2019t a school file (it isn\u2019t valid JSON).'); }
    if (!d || d.app !== 'sub-ready' || d.kind !== 'school-file') {
      if (d && d.app === 'sub-ready' && d.kind === 'class-binder') throw new Error('That\u2019s a class binder, not a school file. Use Import at the top of the page for binders.');
      throw new Error('That file isn\u2019t a Sub-Ready school file.');
    }
    if (typeof d.version === 'number' && d.version > 1) throw new Error('That school file was made by a newer version of Sub-Ready. Reload the page and try again.');
    return normSchool(d.school);
  }
  // Fills only what's blank in the teacher's binder; never overwrites their own text.
  function mergeSchoolFile(binder, school) {
    var b = normalizeBinder(binder), sc = normSchool(school);
    var rep = { filled: [], kept: [], contactsAdded: 0, contactsFilled: 0, lessonsAdded: 0 };
    function fill(key, val, label) {
      if (blank(val)) return;
      if (blank(b[key])) { b[key] = val; rep.filled.push(label); }
      else if (b[key].trim() !== val.trim()) rep.kept.push(label);
    }
    fill('school', sc.name, 'School name');
    fill('bells', sc.bells, 'Bell schedule');
    var labels = { arrival: 'When the sub arrives', bathroom: 'Bathroom / hall pass', emergency: 'Emergency procedures', dismissal: 'Dismissal', phones: 'Phone policy', rules: 'Must-follow rules', leave: 'Before you leave' };
    SCHOOL_PROC.forEach(function (k) { fill(k, sc.procedures[k], labels[k]); });
    sc.contacts.forEach(function (c) {
      var mine = b.contacts.filter(function (x) { return x.role.trim().toLowerCase() === c.role.trim().toLowerCase(); })[0];
      if (!mine) { if (b.contacts.length < MAX_CONTACTS) { b.contacts.push({ role: c.role, contact: c.contact }); rep.contactsAdded++; } }
      else if (blank(mine.contact) && !blank(c.contact)) { mine.contact = c.contact; rep.contactsFilled++; }
    });
    var before = b.lessonBank.length;
    b.lessonBank = normLessons(b.lessonBank.concat(sc.lessons));
    rep.lessonsAdded = b.lessonBank.length - before;
    return { binder: b, report: rep };
  }

  // Validate anything (old saves, imported files, hand-edited JSON) into a clean binder. Drops unknown keys.
  function normalizeBinder(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('That file doesn\u2019t contain a Sub-Ready binder.');
    var b = { version: VERSION };
    SHARED_FIELDS.forEach(function (f) { b[f[0]] = str(input[f[0]], SHORT_SHARED[f[0]] || MAX_FIELD); });
    b.lessonBank = normLessons(input.lessonBank);
    var contacts = Array.isArray(input.contacts) ? input.contacts : [];
    b.contacts = contacts.filter(function (x) { return x && typeof x === 'object'; }).slice(0, MAX_CONTACTS).map(function (x) {
      return { role: str(x.role, 80), contact: str(x.contact, 200) };
    }).filter(function (x) { return !blank(x.role) || !blank(x.contact); });
    var classes = Array.isArray(input.classes) ? input.classes : [];
    var seen = {};
    b.classes = classes.filter(function (x) { return x && typeof x === 'object'; }).slice(0, MAX_CLASSES).map(function (x, i) {
      var c = {};
      var id = str(x.id, 60).replace(/[^\w-]/g, '');
      if (!id || seen[id]) id = newId();
      seen[id] = 1; c.id = id;
      CLASS_FIELDS.forEach(function (f) { c[f[0]] = str(x[f[0]], f[0] === 'label' || f[0] === 'location' ? 80 : (f[0] === 'start' || f[0] === 'end' ? 20 : MAX_FIELD)); });
      if (blank(c.label)) c.label = 'Period ' + (i + 1);
      EXTRA_FIELDS.forEach(function (f) { c[f[0]] = str(x[f[0]], f[2]); });
      c.storyOn = (c.storyOn === 'yes' || x.storyOn === true) ? 'yes' : '';
      c.chart = normChart(x.chart);
      c.storyMinutes = /^\d{1,2}$/.test(c.storyMinutes.trim()) && +c.storyMinutes >= 1 && +c.storyMinutes <= 15 ? String(+c.storyMinutes) : '';
      return c;
    });
    if (!b.classes.length) b.classes = [emptyClass('Period 1')];
    return b;
  }

  // ---------- export / import ----------
  function exportJSON(binder, now) {
    return JSON.stringify({
      app: 'sub-ready', kind: 'class-binder', version: VERSION,
      exportedAt: (now || new Date()).toISOString(),
      note: 'Contains your class notes (and any student first names you typed). Keep this file private.',
      binder: normalizeBinder(binder)
    }, null, 2);
  }
  function importJSON(text) {
    var raw = String(text == null ? '' : text).replace(/^\uFEFF/, '').trim();
    if (!raw) throw new Error('That file is empty.');
    if (raw.length > 2000000) throw new Error('That file is too large to be a Sub-Ready binder.');
    var data;
    try { data = JSON.parse(raw); } catch (e) { throw new Error('That file isn\u2019t a Sub-Ready binder (it isn\u2019t valid JSON).'); }
    if (data && data.app === 'sub-ready') {
      if (data.kind !== 'class-binder') throw new Error('That Sub-Ready file isn\u2019t a class binder.');
      if (typeof data.version === 'number' && data.version > VERSION) throw new Error('That binder was saved by a newer version of Sub-Ready. Reload the page and try again.');
      return normalizeBinder(data.binder);
    }
    // Accept a bare binder object too (e.g. hand-made), but require the classes array.
    if (data && Array.isArray(data.classes)) return normalizeBinder(data);
    throw new Error('That file doesn\u2019t contain a Sub-Ready binder.');
  }

  // ---------- storage (works with localStorage or any object with getItem/setItem/removeItem) ----------
  function save(storage, binder) {
    var b = normalizeBinder(binder);
    storage.setItem(STORAGE_KEY, JSON.stringify({ savedAt: new Date().toISOString(), binder: b }));
    return b;
  }
  function load(storage) {
    var raw = storage.getItem(STORAGE_KEY);
    if (!raw) return null;
    try { var d = JSON.parse(raw); return normalizeBinder(d && d.binder ? d.binder : d); }
    catch (e) { return null; }
  }
  function clear(storage) { storage.removeItem(STORAGE_KEY); }

  // ---------- access gate (single flag) ----------
  // EARLY_ACCESS true  -> every binder feature is free and labeled "Free early access".
  // EARLY_ACCESS false -> features need the paid plan: PRO_URL must be set, and the browser must hold an unlock.
  function access(cfg, unlocked) {
    cfg = cfg || {};
    if (cfg.EARLY_ACCESS) return { enabled: true, label: 'Free early access', paid: false };
    if (cfg.PRO_URL && unlocked) return { enabled: true, label: 'Teacher plan', paid: true };
    return { enabled: false, label: cfg.PRO_URL ? 'Teacher plan ($5/month)' : 'Coming soon', paid: false, url: cfg.PRO_URL || '' };
  }

  // ---------- times ----------
  function classTimes(c) {
    var s = C.parseTime(c.start), e = C.parseTime(c.end);
    if (s == null && c.start) { var t = C.findTimes(c.start); if (t) { s = t.start; if (t.end != null && e == null) e = t.end; } }
    // "12:50"-"1:40": an afternoon end typed without PM. Only shift ends before 7:00, so "11:30"-"10:40" stays an error.
    if (s != null && e != null && e < s && e < 7 * 60 && e + 720 > s) e += 720;
    return { start: s, end: e };
  }
  function timeLabel(t) {
    if (t.start == null) return '';
    return C.fmtTime(t.start) + (t.end != null ? '\u2013' + C.fmtTime(t.end) : '');
  }

  // ---------- gap check on the saved profile ----------
  // Lists what a stranger would still need, per field, plus the same line-level checks the main tool runs.
  function readiness(binder) {
    var b = normalizeBinder(binder);
    var items = [];
    SHARED_FIELDS.forEach(function (f) { if (f[2] && blank(b[f[0]])) items.push({ scope: 'Whole room', field: f[0], issue: f[1] + ': not filled in yet.' }); });
    if (!b.contacts.length) items.push({ scope: 'Whole room', field: 'contacts', issue: 'Contacts by role (office, neighbor teacher, nurse): none yet.' });
    if (!blank(b.noteEmail) && !cleanEmail(b.noteEmail)) items.push({ scope: 'Whole room', field: 'noteEmail', issue: 'End-of-day note email "' + b.noteEmail + '" doesn\u2019t look like an email address, so no QR code will print.' });
    if (!blank(b.notePhone) && !cleanPhone(b.notePhone)) items.push({ scope: 'Whole room', field: 'notePhone', issue: 'End-of-day note number "' + b.notePhone + '" doesn\u2019t look like a phone number, so no QR code will print.' });
    b.classes.forEach(function (c) {
      var t = classTimes(c);
      CLASS_FIELDS.forEach(function (f) {
        if (!f[2] || f[0] === 'label') return;
        if ((f[0] === 'start' || f[0] === 'end') && !blank(c[f[0]]) && t[f[0]] == null) { items.push({ scope: c.label, classId: c.id, field: f[0], issue: f[1] + ' "' + c[f[0]] + '" isn\u2019t a time I can read (try 8:15 or 1:05 PM).' }); return; }
        if (blank(c[f[0]])) items.push({ scope: c.label, classId: c.id, field: f[0], issue: f[1] + ': not filled in yet.' });
      });
      if (t.start != null && t.end != null && t.end <= t.start) items.push({ scope: c.label, classId: c.id, field: 'end', issue: 'Ends before it starts.' });
      if (!blank(c.anyDay)) {
        var context = [c.supplies, c.seating, c.routines, b.arrival, b.leave, b.emergency].join('\n');
        C.lintPlan(c.anyDay, { routines: c.routines, locations: c.supplies, helpers: c.helpers, emergency: b.emergency, periods: '' }).flags.forEach(function (fl) {
          if (fl.line === '(whole plan)') return;
          if (containerExplained(fl, context)) return;
          items.push({ scope: c.label, classId: c.id, field: 'anyDay', issue: 'Any-day plan, "' + fl.line + '": ' + fl.issue });
        });
      }
    });
    var timed = b.classes.map(function (c) { return { c: c, t: classTimes(c) }; }).filter(function (x) { return x.t.start != null && x.t.end != null; })
      .sort(function (x, y) { return x.t.start - y.t.start; });
    for (var i = 1; i < timed.length; i++) {
      if (timed[i].t.start < timed[i - 1].t.end) items.push({ scope: timed[i].c.label, classId: timed[i].c.id, field: 'start', issue: 'Overlaps with ' + timed[i - 1].c.label + '.' });
    }
    return items;
  }

  // A "where is the bin?" flag is not a gap when the line or the rest of the binder already says where it is.
  var LOC = '(?:on|in|inside|under|by|next to|behind|beside|near|above|below|at)';
  function containerExplained(flag, context) {
    var m = /^"([^"]+)": a stranger/.exec(flag.issue);
    if (!m) return false;
    var phrase = m[1].replace(/^(the|my|our)\s+/i, '');
    var noun = phrase.split(/\s+/).pop();
    var nounRe = noun.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    var phraseRe = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (new RegExp('\\b' + LOC + '\\s+(?:the|my|our)?\\s*' + phraseRe, 'i').test(flag.line)) return true;   // "in the top drawer"
    var near = new RegExp('\\b' + nounRe + 's?\\b[^.\\n]{0,40}\\b' + LOC + '\\b', 'i');                       // "box by the door", "tray on my desk"
    return near.test(flag.line) || near.test(context);
  }

  // ---------- print pack ----------
  // opts: { mode: 'emergency' | 'day', date: 'text', periods: [classId], lessons: { classId: text } }
  function buildPack(binder, opts) {
    var b = normalizeBinder(binder);
    opts = opts || {};
    var mode = opts.mode === 'day' ? 'day' : 'emergency';
    var chosen = Array.isArray(opts.periods) && opts.periods.length
      ? b.classes.filter(function (c) { return opts.periods.indexOf(c.id) > -1; })
      : b.classes.slice();
    var lessons = opts.lessons || {};
    var periods = chosen.map(function (c, idx) {
      var t = classTimes(c);
      var today = mode === 'day' ? str(lessons[c.id]) : '';
      var plan, source;
      if (!blank(today)) { plan = today; source = 'today'; }
      else if (!blank(c.anyDay)) { plan = c.anyDay; source = 'any-day'; }
      else { plan = ''; source = 'missing'; }
      var p = { id: c.id, order: idx, label: c.label, location: c.location || b.room, start: t.start, end: t.end, time: timeLabel(t),
        plan: plan, source: source, routines: c.routines, seating: c.seating, helpers: c.helpers, supplies: c.supplies,
        story: c.storyOn === 'yes' ? { prompt: c.storyPrompt, minutes: +c.storyMinutes || 3 } : null,
        chart: c.chart && c.chart.seats.length ? c.chart : null };
      return p;
    });
    // Stable sort by start time; untimed periods keep their order at the end.
    periods.sort(function (x, y) {
      if (x.start == null && y.start == null) return x.order - y.order;
      if (x.start == null) return 1; if (y.start == null) return -1;
      return x.start - y.start || x.order - y.order;
    });
    var missing = readiness(b).filter(function (it) {
      return !it.classId || chosen.some(function (c) { return c.id === it.classId; });
    });
    return {
      mode: mode, date: str(opts.date, 80),
      title: mode === 'emergency' ? 'Emergency sub plan' : 'Sub plan',
      teacher: b.teacher, room: b.room, school: b.school,
      arrival: b.arrival, bathroom: b.bathroom, emergency: b.emergency, health: b.health,
      dismissal: b.dismissal, leave: b.leave, contacts: b.contacts,
      periods: periods, missing: missing,
      pronounce: b.pronounce, tellYou: b.tellYou, phones: b.phones, goTo: b.goTo, rules: b.rules, bells: b.bells,
      note: noteLinks(b, str(opts.date, 80))
    };
  }

  function para(text) {
    if (blank(text)) return '<p class="ph">' + esc(NP) + '</p>';
    var lines = String(text).split('\n').map(function (l) { return l.trim(); }).filter(Boolean);
    if (lines.length === 1) return '<p>' + esc(lines[0]) + '</p>';
    return '<ul>' + lines.map(function (l) { return '<li>' + esc(l.replace(/^[-*\u2022]\s*/, '')) + '</li>'; }).join('') + '</ul>';
  }
  function row(label, text) { return '<div class="pk-row"><h4>' + esc(label) + '</h4>' + para(text) + '</div>'; }
  function contactsHTML(list) {
    if (!list.length) return '<p class="ph">' + esc(NP) + '</p>';
    return '<table class="pk-contacts"><tbody>' + list.map(function (c) {
      return '<tr><th>' + esc(c.role || 'Contact') + '</th><td>' + (blank(c.contact) ? '<span class="ph">' + esc(NP) + '</span>' : esc(c.contact)) + '</td></tr>';
    }).join('') + '</tbody></table>';
  }

  // Paper pass-the-page story activity: one instruction sheet for the sub + one story page to copy per group. Brand-free.
  function storySheetsHTML(p, seq) {
    var min = p.story.minutes || 3;
    var starter = blank(p.story.prompt) ? STORY_STARTERS[seq % STORY_STARTERS.length] : p.story.prompt;
    var h = '<section class="sheet story"><p class="pk-kicker">' + esc(p.label) + (p.time ? ' \u00b7 ' + esc(p.time) : '') + ' \u00b7 paper only, no devices or accounts</p><h2>Pass-the-page story</h2>';
    h += '<p>Small groups write one story together. Each student writes for ' + min + ' minute' + (min === 1 ? '' : 's') + ', then the page moves on. About ' + (6 * min) + '\u2013' + (8 * min) + ' minutes, plus time to read aloud.</p>';
    h += '<div class="pk-row"><h4>Story starter (write it on the board)</h4><p class="starter">\u201c' + esc(starter) + '\u201d</p></div>';
    h += '<div class="pk-row"><h4>How to run it</h4><ol class="story-steps">' + [
      'Make groups of 3 or 4. Give each group one copy of the story page.',
      'Each student writes their first name or initials on the back of the page, so the teacher knows who was in the group.',
      'The first writer copies the starter and keeps going. Everyone else in the group reads along quietly.',
      'Every ' + min + ' minute' + (min === 1 ? '' : 's') + ', say \u201cPass the page.\u201d The page goes to the next person, who reads the last few lines and continues the story.',
      'Keep going until everyone has had two turns. On the last turn, say \u201cWrite the ending.\u201d',
      'Each group picks a reader and reads its story aloud (or swaps with another group to read).',
      'Collect the pages in the tray with the rest of the work.'
    ].map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ol></div>';
    h += '<div class="pk-row"><h4>Rules to say out loud</h4><ul><li>Keep it school-appropriate.</li><li>Don\u2019t use classmates\u2019 real names in the story.</li><li>Build on what the last writer wrote \u2014 no erasing it.</li></ul></div>';
    h += '<div class="pk-row"><h4>Timing guide</h4><table class="pk-sched story-timing"><tbody>' +
      '<tr><th>Groups of 3</th><td>6 turns \u00d7 ' + min + ' min = about ' + (6 * min) + ' min, plus reading aloud</td></tr>' +
      '<tr><th>Groups of 4</th><td>8 turns \u00d7 ' + min + ' min = about ' + (8 * min) + ' min, plus reading aloud</td></tr>' +
      '</tbody></table><p class="hint">Short on time? Stop after one turn each and go straight to \u201cWrite the ending.\u201d</p></div>';
    h += '</section>';
    h += '<section class="sheet story-page"><p class="pk-kicker">Copy one per group</p><h2>Our story</h2><p class="starter">Starter: \u201c' + esc(starter) + '\u201d</p>';
    for (var i = 1; i <= 8; i++) h += '<div class="turn"><span class="turn-n">Turn ' + i + '</span><div class="lines"></div></div>';
    h += '</section>';
    return h;
  }

  // One printed page per period chart. Front of the room is at the top.
  function chartSheetHTML(p) {
    var ch = p.chart, grid = {};
    ch.seats.forEach(function (st) { grid[st.r + ',' + st.c] = st; });
    var h = '<section class="sheet seating"><p class="pk-kicker">' + esc(p.label) + (p.time ? ' \u00b7 ' + esc(p.time) : '') + '</p><h2>Seating chart</h2>';
    h += '<p class="chart-front">Front of the room (board)</p><table class="pk-chart" data-rows="' + ch.rows + '" data-cols="' + ch.cols + '"><tbody>';
    for (var r = 0; r < ch.rows; r++) {
      h += '<tr>';
      for (var c = 0; c < ch.cols; c++) {
        var st = grid[r + ',' + c];
        h += st ? '<td class="seat"><div class="seat-in"><strong>' + esc(st.name) + '</strong>' + (blank(st.say) ? '' : '<span class="say">say \u201c' + esc(st.say) + '\u201d</span>') + (blank(st.note) ? '' : '<span class="snote">' + esc(st.note) + '</span>') + '</div></td>' : '<td class="seat empty"><div class="seat-in"></div></td>';
      }
      h += '</tr>';
    }
    h += '</tbody></table><p class="hint">Names as the teacher typed them. Kept only on the teacher\u2019s device and on this paper.</p></section>';
    return h;
  }
  function noteSheetHTML(m) {
    var n = m.note || {};
    var h = '<section class="sheet daynote"><p class="pk-kicker">Please leave this on my desk, or send it from your phone</p><h2>End-of-day note' + (blank(m.teacher) ? '' : ' for ' + esc(m.teacher)) + '</h2>';
    h += '<table class="pk-form who"><tbody><tr><th>Date</th><td>' + (blank(m.date) ? '' : esc(m.date)) + '</td><th>Your name</th><td></td></tr></tbody></table>';
    h += '<div class="pk-row"><h4>How each period went</h4><table class="pk-form periods"><tbody>' + m.periods.map(function (p) {
      return '<tr><th>' + esc(p.label) + '</th><td class="ticks"><span class="tick">\u2610 Great</span> <span class="tick">\u2610 OK</span> <span class="tick">\u2610 Rough</span></td><td class="line-cell"></td></tr>';
    }).join('') + '</tbody></table></div>';
    h += '<div class="note-grid">';
    ['What got done', 'What didn\u2019t get done', 'Absent, left early or came late', 'Where you left collected work'].forEach(function (lbl) {
      h += '<div class="pk-row notes"><h4>' + esc(lbl) + '</h4><div class="lines short"></div></div>';
    });
    h += '</div><div class="pk-row notes"><h4>Anything I should know (behavior, visitors, problems)</h4><div class="lines short"></div></div>';
    if (n.mailto || n.sms) {
      h += '<div class="pk-row send-note"><h4>Prefer your phone?</h4><p>Scan a code to open a blank copy of this note in your own email or text app, addressed to me. Nothing is sent until you press send. Please don\u2019t include students\u2019 last names.</p><div class="qr-row">';
      if (n.mailto) h += '<figure class="qr-fig" data-href="' + esc(n.mailto) + '">' + qrSVG(n.mailto, 'QR code: email the note') + '<figcaption>Email: ' + esc(n.email) + '</figcaption></figure>';
      if (n.sms) h += '<figure class="qr-fig" data-href="' + esc(n.sms) + '">' + qrSVG(n.sms, 'QR code: text the note') + '<figcaption>Text: ' + esc(n.phone) + '</figcaption></figure>';
      h += '</div></div>';
    }
    h += '</section>';
    return h;
  }
  function rowIf(label, text) { return blank(text) ? '' : row(label, text); }

  function renderPackHTML(m) {
    var who = [m.teacher, m.room ? 'Room ' + m.room.replace(/^room\s*/i, '') : '', m.school].filter(function (x) { return !blank(x); }).join(' \u00b7 ');
    var h = [];
    h.push('<div class="pack" data-mode="' + esc(m.mode) + '">');
    // 1. Cover sheet
    h.push('<section class="sheet cover"><p class="pk-kicker">' + esc(m.mode === 'emergency' ? 'Front office copy \u00b7 for any surprise absence' : 'Front office copy') + '</p>');
    h.push('<h2>' + esc(m.title) + '</h2>');
    h.push('<p class="pk-who">' + (who ? esc(who) : '<span class="ph">' + esc(NP) + '</span>') + '</p>');
    h.push('<p class="pk-date">' + (blank(m.date) ? 'Date: ____________________' : esc(m.date)) + '</p>');
    h.push('<p class="pk-welcome">Welcome, and thank you for covering this class. This pack has the schedule, a plan for each period, and an emergency sheet. Anything marked \u201cNot provided\u201d wasn\u2019t in my notes \u2014 please ask the office.</p>');
    h.push('<h3>In this pack</h3><ol class="pk-toc"><li>Schedule</li>' + m.periods.map(function (p) { return '<li>' + esc(p.label) + (p.story ? ' (+ pass-the-page story sheets)' : '') + '</li>'; }).join('') + '<li>End-of-day note</li><li>Emergency sheet</li></ol>');
    h.push(row('When you arrive', m.arrival));
    h.push('<div class="pk-row"><h4>Who to contact</h4>' + contactsHTML(m.contacts) + '</div>');
    h.push('</section>');
    // 2. Schedule
    h.push('<section class="sheet schedule"><h2>Schedule</h2><table class="pk-sched"><thead><tr><th>Time</th><th>Period</th><th>Room</th><th>Plan</th></tr></thead><tbody>');
    m.periods.forEach(function (p) {
      h.push('<tr><td>' + (p.time ? esc(p.time) : '<span class="ph">' + esc(C.TIME_PLACEHOLDER) + '</span>') + '</td><td>' + esc(p.label) + '</td><td>' + (blank(p.location) ? '\u2014' : esc(p.location)) + '</td><td>' +
        (p.source === 'today' ? 'Today\u2019s lesson' : p.source === 'any-day' ? 'Any-day plan' : '<span class="ph">Not provided</span>') + '</td></tr>');
    });
    h.push('</tbody></table>');
    h.push(row('Bathroom / hall pass', m.bathroom));
    h.push(row('Dismissal / end of day', m.dismissal));
    h.push(row('Before you leave', m.leave));
    h.push(rowIf('Must-follow rules', m.rules));
    h.push(rowIf('Phone policy', m.phones));
    h.push(rowIf('Things students may tell you (that aren\u2019t true)', m.tellYou));
    h.push(rowIf('Go-to adult nearby', m.goTo));
    h.push(rowIf('How to say names', m.pronounce));
    h.push(rowIf('School bell schedule', m.bells));
    h.push('</section>');
    // 3. Per-period plans
    var storySeq = 0;
    m.periods.forEach(function (p) {
      h.push('<section class="sheet period"><p class="pk-kicker">' + esc(p.time || 'Time not provided') + (blank(p.location) ? '' : ' \u00b7 ' + esc(p.location)) + '</p><h2>' + esc(p.label) + '</h2>');
      h.push('<div class="pk-row"><h4>' + (p.source === 'today' ? 'Today\u2019s lesson' : 'Plan (any-day, no prep needed)') + '</h4>' + para(p.plan) + '</div>');
      h.push(row('Routines', p.routines));
      h.push(row('Seating & help notes', p.seating));
      h.push(row('Students who can help', p.helpers));
      h.push(row('Where things are', p.supplies));
      if (p.chart) h.push('<div class="pk-row"><h4>Seating chart</h4><p>See the seating chart page right after this one (' + p.chart.seats.length + ' seat' + (p.chart.seats.length === 1 ? '' : 's') + ', with how to say each name).</p></div>');
      if (p.story) h.push('<div class="pk-row"><h4>Pass-the-page story</h4><p>Paper writing activity for this period: see the \u201cPass-the-page story\u201d sheet right after this one.</p></div>');
      h.push('<div class="pk-row notes"><h4>Notes for me</h4><div class="lines"></div></div>');
      h.push('</section>');
      if (p.chart) h.push(chartSheetHTML(p));
      if (p.story) h.push(storySheetsHTML(p, storySeq++));
    });
    // 4. End-of-day note back to the teacher
    h.push(noteSheetHTML(m));
    // 5. Emergency sheet
    h.push('<section class="sheet emergency"><h2>Emergency sheet</h2>');
    h.push(row('Emergency procedures', m.emergency));
    h.push(row('Health & allergy notes', m.health));
    h.push('<div class="pk-row"><h4>Who to contact</h4>' + contactsHTML(m.contacts) + '</div>');
    h.push('</section>');
    h.push('</div>');
    return h.join('');
  }

  // Hand-off into the main tool (gap check + script) for one period: maps profile fields onto the tool's fields.
  function toToolHandoff(binder, classId, lesson) {
    var b = normalizeBinder(binder);
    var c = b.classes.filter(function (x) { return x.id === classId; })[0];
    if (!c) return null;
    var t = classTimes(c);
    return {
      plan: str(lesson) || c.anyDay,
      title: [c.label, b.room ? 'Room ' + b.room.replace(/^room\s*/i, '') : ''].filter(Boolean).join(', '),
      periods: t.start != null ? c.label + ' ' + C.fmtTime(t.start) + (t.end != null ? '-' + C.fmtTime(t.end) : '') : '',
      routines: [c.routines, b.bathroom ? 'Bathroom: ' + b.bathroom : '', b.dismissal ? 'Dismissal: ' + b.dismissal : '', b.phones ? 'Phones: ' + b.phones : '', b.rules ? 'Must-follow rules: ' + b.rules : ''].filter(function (x) { return !blank(x); }).join('\n'),
      locations: [c.supplies, c.seating].filter(function (x) { return !blank(x); }).join('\n'),
      helpers: c.helpers,
      // Every name typed anywhere in the binder (list, pronunciations, every seating chart, helpers) is hidden before any AI step.
      names: allNames(b).join('\n'),
      emergency: [b.emergency, b.health, b.contacts.map(function (x) { return x.role + ': ' + x.contact; }).join('\n')].filter(function (x) { return !blank(x); }).join('\n')
    };
  }

  return {
    VERSION: VERSION, STORAGE_KEY: STORAGE_KEY, MAX_CLASSES: MAX_CLASSES, MAX_CONTACTS: MAX_CONTACTS,
    SHARED_FIELDS: SHARED_FIELDS, CLASS_FIELDS: CLASS_FIELDS, EXTRA_FIELDS: EXTRA_FIELDS, STORY_STARTERS: STORY_STARTERS,
    CHART_MAX: CHART_MAX, MAX_SEATS: MAX_SEATS, normChart: normChart, allNames: allNames, qrSVG: qrSVG, noteLinks: noteLinks,
    cleanEmail: cleanEmail, cleanPhone: cleanPhone,
    buildSchoolFile: buildSchoolFile, parseSchoolFile: parseSchoolFile, mergeSchoolFile: mergeSchoolFile,
    emptyBinder: emptyBinder, emptyClass: emptyClass, normalizeBinder: normalizeBinder,
    exportJSON: exportJSON, importJSON: importJSON, save: save, load: load, clear: clear,
    access: access, classTimes: classTimes, readiness: readiness,
    buildPack: buildPack, renderPackHTML: renderPackHTML, toToolHandoff: toToolHandoff
  };
});
