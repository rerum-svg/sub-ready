/* Sub-Ready class binder UI. Saves only to this browser (localStorage). No network calls. */
(function () {
  'use strict';
  var C = window.SubReadyCore, B = window.SubReadyBinder;
  var CFG = window.SUB_READY_CONFIG || {};
  var $ = function (id) { return document.getElementById(id); };
  var esc = C.esc;

  // ---------- storage (falls back to memory if the browser blocks it) ----------
  var store, persistent = true;
  try { localStorage.setItem('subready.test', '1'); localStorage.removeItem('subready.test'); store = localStorage; }
  catch (e) {
    persistent = false;
    var mem = {}; store = { getItem: function (k) { return k in mem ? mem[k] : null; }, setItem: function (k, v) { mem[k] = String(v); }, removeItem: function (k) { delete mem[k]; } };
  }
  // ---------- access: free one-day tool, 14-day binder trial, then the Teacher plan ----------
  // The binder always loads and renders. When the trial has ended it is locked for editing and printing only:
  // nothing is deleted, and Export always works.
  var P = window.SubReadyPlans;
  var pstate = P.readState(store);
  var acc = P.access(CFG, pstate);
  if (acc.mode === 'trial' && !pstate.trialStart) { P.ensureTrialStart(store); pstate = P.readState(store); acc = P.access(CFG, pstate); }
  var locked = !acc.enabled;
  var LOCK_ALLOWED = ['exportBtn'];

  function fmtDate(ms) { try { return new Date(ms).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' }); } catch (e) { return ''; } }
  function showAccess() {
    $('accessLabel').textContent = acc.label;
    $('accessLabel').classList.toggle('soon', acc.mode === 'locked');
    var gate = $('gate'), note = $('trialNote');
    note.hidden = true; gate.hidden = true; gate.classList.remove('locked-gate');
    if (acc.mode === 'trial') {
      note.hidden = false;
      note.textContent = 'Your ' + acc.trialDays + '-day free trial started in this browser and runs until ' + fmtDate(acc.endsAt) + '. After that, everything you saved stays here and you can always export it; editing and printing need the Teacher plan ($5/month). No card is needed for the trial.';
      gate.hidden = false;
      $('gateTitle').textContent = 'Keep the class binder after your trial';
      $('gateText').textContent = 'Subscribe any time. You won\u2019t lose anything you set up during the trial.';
    } else if (acc.mode === 'locked') {
      gate.hidden = false; gate.classList.add('locked-gate');
      $('gateTitle').textContent = 'Your free trial has ended';
      $('gateText').textContent = 'Everything you saved is still here in this browser. Nothing has been deleted, and Export still works. Subscribe to edit and print again.';
    }
  }
  function applyLock() {
    var app = $('app');
    app.classList.toggle('locked', locked);
    Array.prototype.forEach.call(app.querySelectorAll('section.card'), function (sec) { if (locked) sec.setAttribute('inert', ''); else sec.removeAttribute('inert'); });
    ['importFile', 'clearBtn'].forEach(function (id) { var el = $(id); if (el) el.disabled = locked; });
    var imp = $('importFile'); if (imp && imp.parentNode) imp.parentNode.classList.toggle('disabled', locked);
    $('lockNote').hidden = !locked;
    if (locked) { $('packWrap').hidden = true; document.body.classList.remove('has-pack'); }
  }
  // Belt and braces: while locked, block edits, drags and print actions inside the binder, but never Export.
  ['click', 'input', 'change', 'dragstart', 'drop', 'keydown'].forEach(function (type) {
    document.addEventListener(type, function (e) {
      if (!locked) return;
      var t = e.target; if (!t || !t.closest) return;
      if (!t.closest('#app') && !t.closest('#packWrap')) return;
      if (LOCK_ALLOWED.some(function (id) { return t.closest('#' + id); })) return;
      if (type === 'keydown' && (e.key === 'Tab' || e.key === 'Shift')) return;
      e.stopImmediatePropagation(); if (type !== 'keydown' || e.key === 'Enter' || e.key === ' ') e.preventDefault();
    }, true);
  });
  window.SubReadyPay.render($('gatePlans'), {
    onUnlock: function (s) { pstate = s; acc = P.access(CFG, s); locked = !acc.enabled; showAccess(); applyLock(); $('gate').hidden = false; $('gateTitle').textContent = 'Thank you'; $('gateText').textContent = 'The class binder is unlocked in this browser.'; }
  });
  showAccess();

  var binder = B.load(store) || B.emptyBinder();
  if (!B.load(store) && !binder.contacts.length) {
    binder.contacts = [{ role: 'Front office', contact: '' }, { role: 'Neighbor teacher', contact: '' }, { role: 'Nurse', contact: '' }];
  }
  var dayState = { checked: {}, lessons: {} };

  function setStatus(t) { $('saveStatus').textContent = t; }
  var saveTimer = null;
  function saveSoon() {
    if (locked) return;
    setStatus('Saving\u2026');
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveNow, 300);
  }
  function saveNow() {
    clearTimeout(saveTimer);
    if (locked) return;
    try {
      binder = B.save(store, binder);
      var t = new Date();
      setStatus((persistent ? 'Saved in this browser' : 'This browser blocks saving \u2014 export before you close the tab') + ' at ' + C.fmtTime(t.getHours() * 60 + t.getMinutes()));
    } catch (e) { setStatus('Couldn\u2019t save in this browser (' + (e && e.message || e) + '). Use Export to keep a copy.'); }
  }

  // ---------- render ----------
  function renderShared() {
    Array.prototype.forEach.call(document.querySelectorAll('[data-shared]'), function (el) { el.value = binder[el.getAttribute('data-shared')] || ''; });
  }
  function renderContacts() {
    $('contacts').innerHTML = binder.contacts.map(function (c, i) {
      return '<div class="contact-row" data-i="' + i + '"><input aria-label="Role" data-c="role" value="' + esc(c.role) + '" placeholder="Role (e.g. Front office)">' +
        '<input aria-label="How to reach them" data-c="contact" value="' + esc(c.contact) + '" placeholder="ext 100, or room 210">' +
        '<button class="btn ghost small" type="button" data-remove-contact="' + i + '" aria-label="Remove contact">Remove</button></div>';
    }).join('');
    $('addContact').disabled = binder.contacts.length >= B.MAX_CONTACTS;
  }
  var FIELD_UI = {
    label: ['input', 'Period 2 \u2014 Math 7'], start: ['input', '8:55'], end: ['input', '9:45'], location: ['input', 'Room 214'],
    routines: ['textarea', 'Clap twice for attention. Attendance on the clipboard. Early finishers read silently.'],
    seating: ['textarea', 'Seating chart is on the clipboard by the door. Jaylen sits near the front.'],
    helpers: ['textarea', 'Maya L. \u2014 knows where everything is'],
    supplies: ['textarea', 'Textbooks: shelf under the window. Pencils: blue cup on my desk.'],
    anyDay: ['textarea', 'Warm-up: write 3 sentences about the board prompt.\nRead pages from the green any-day folder (top drawer), answer questions 1-5.\nCollect work in the tray.']
  };
  var openCards = {};
  function renderClasses() {
    Array.prototype.forEach.call(document.querySelectorAll('.period-card'), function (d) { openCards[d.getAttribute('data-id')] = d.open; });
    $('classes').innerHTML = binder.classes.map(function (c, i) {
      var isOpen = c.id in openCards ? openCards[c.id] : (i === 0 || binder.classes.length < 3 || i === binder.classes.length - 1);
      var h = '<details class="period-card" data-id="' + esc(c.id) + '"' + (isOpen ? ' open' : '') + '><summary>' + esc(c.label || ('Period ' + (i + 1))) +
        '<span class="sum-time"> ' + esc([c.start, c.end].filter(Boolean).join('\u2013')) + '</span></summary><div class="grid4">';
      ['label', 'start', 'end', 'location'].forEach(function (k) {
        var f = B.CLASS_FIELDS.filter(function (x) { return x[0] === k; })[0];
        h += '<div><label for="' + k + '-' + esc(c.id) + '">' + esc(f[1]) + '</label><input id="' + k + '-' + esc(c.id) + '" data-k="' + k + '" value="' + esc(c[k]) + '" placeholder="' + esc(FIELD_UI[k][1]) + '"></div>';
      });
      h += '</div><div class="grid2">';
      ['routines', 'seating', 'helpers', 'supplies'].forEach(function (k) {
        var f = B.CLASS_FIELDS.filter(function (x) { return x[0] === k; })[0];
        h += '<div><label for="' + k + '-' + esc(c.id) + '">' + esc(f[1]) + '</label><textarea rows="3" id="' + k + '-' + esc(c.id) + '" data-k="' + k + '" placeholder="' + esc(FIELD_UI[k][1]) + '">' + esc(c[k]) + '</textarea></div>';
      });
      h += '</div><label for="anyDay-' + esc(c.id) + '">Any-day plan (no-prep work for a surprise absence)</label><textarea rows="5" id="anyDay-' + esc(c.id) + '" data-k="anyDay" placeholder="' + esc(FIELD_UI.anyDay[1]) + '">' + esc(c.anyDay) + '</textarea>';
      h += chartHTML(c) + storyFieldsHTML(c);
      h += '<div class="row-actions"><button class="btn ghost small" type="button" data-dup="' + esc(c.id) + '">Duplicate</button>' +
        (binder.classes.length > 1 ? '<button class="btn ghost small danger" type="button" data-del="' + esc(c.id) + '">Remove period</button>' : '') + '</div></details>';
      return h;
    }).join('');
    $('addClass').disabled = binder.classes.length >= B.MAX_CLASSES;
    renderDay();
  }
  function storyFieldsHTML(c) {
    var id = esc(c.id);
    return '<fieldset class="extra story-fields"><legend>Paper story activity (optional)</legend>' +
      '<label class="check"><input type="checkbox" id="storyOn-' + id + '" data-k="storyOn"' + (c.storyOn === 'yes' ? ' checked' : '') + '> Add the pass-the-page story activity (paper only: groups, timed turns, no devices or accounts)</label>' +
      '<div class="grid2"><div><label for="storyPrompt-' + id + '">Story starter (optional)</label><input id="storyPrompt-' + id + '" data-k="storyPrompt" value="' + esc(c.storyPrompt) + '" placeholder="Leave blank for a ready-made starter"></div>' +
      '<div><label for="storyMinutes-' + id + '">Minutes per turn</label><input id="storyMinutes-' + id + '" data-k="storyMinutes" inputmode="numeric" value="' + esc(c.storyMinutes) + '" placeholder="3"></div></div></fieldset>';
  }

  // ---------- seating chart builder (click or drag to place; saved only in this browser) ----------
  var chartUI = {};
  function ui(id) { return chartUI[id] || (chartUI[id] = { chip: null, seat: null, open: false }); }
  function seatAt(c, key) { var rc = key.split(','); return c.chart.seats.filter(function (st) { return st.r === +rc[0] && st.c === +rc[1]; })[0] || null; }
  function cellInner(st) { return st ? '<b>' + esc(st.name) + '</b>' + (st.say ? '<small>' + esc(st.say) + '</small>' : '') : '<span class="plus" aria-hidden="true">+</span>'; }
  function cellLabel(r, cc, st) { return 'Row ' + (r + 1) + ', seat ' + (cc + 1) + ': ' + (st ? st.name : 'empty'); }
  function chartHTML(c) {
    var ch = c.chart, u = ui(c.id), id = esc(c.id);
    var placed = {}; ch.seats.forEach(function (st) { placed[st.name.toLowerCase()] = 1; });
    var unplaced = C.parseNameList(binder.students).filter(function (n) { return !placed[n.toLowerCase()]; });
    var opts = function (v) { var o = ''; for (var i = 1; i <= B.CHART_MAX; i++) o += '<option' + (i === v ? ' selected' : '') + '>' + i + '</option>'; return o; };
    var h = '<details class="chart-wrap" data-chart="' + id + '"' + (u.open ? ' open' : '') + '><summary>Seating chart <span class="sum-time">' + ch.seats.length + ' placed</span></summary>';
    h += '<div class="chart-controls"><label>Rows <select data-chart-dim="rows">' + opts(ch.rows) + '</select></label><label>Seats per row <select data-chart-dim="cols">' + opts(ch.cols) + '</select></label></div>';
    h += '<p class="hint">Click a name, then a seat, or drag names onto seats. Click a placed seat to add how to say the name and a short note. Saved only in this browser; prints on one page.</p>';
    h += '<div class="chips" aria-label="Students not seated yet">' + (unplaced.length ? unplaced.map(function (n) {
      return '<button type="button" class="chip-name" draggable="true" data-chip="' + esc(n) + '" aria-pressed="' + (u.chip === n) + '">' + esc(n) + '</button>';
    }).join('') : '<span class="hint">' + (ch.seats.length ? 'Everyone on your list is seated.' : 'Add names under \u201cStudent first names\u201d above, or click an empty seat and type a name.') + '</span>') + '</div>';
    h += '<div class="chart-front">Front of the room</div><div class="chart-scroll"><div class="chart-grid" style="--cols:' + ch.cols + '">';
    for (var r = 0; r < ch.rows; r++) for (var cc = 0; cc < ch.cols; cc++) {
      var key = r + ',' + cc, st = seatAt(c, key);
      h += '<button type="button" class="seat-cell' + (st ? ' filled' : '') + (u.seat === key ? ' selected' : '') + '" data-seat="' + key + '"' + (st ? ' draggable="true"' : '') + ' aria-label="' + esc(cellLabel(r, cc, st)) + '">' + cellInner(st) + '</button>';
    }
    h += '</div></div>';
    if (u.seat) {
      var es = seatAt(c, u.seat) || { name: '', say: '', note: '' }, rc = u.seat.split(',');
      h += '<div class="seat-editor"><h4>Row ' + (+rc[0] + 1) + ', seat ' + (+rc[1] + 1) + '</h4><div class="grid3">' +
        '<div><label for="se-name-' + id + '">First name</label><input id="se-name-' + id + '" data-se="name" value="' + esc(es.name) + '" maxlength="40"></div>' +
        '<div><label for="se-say-' + id + '">How to say it</label><input id="se-say-' + id + '" data-se="say" value="' + esc(es.say) + '" maxlength="60" placeholder="e.g. shi-VAWN"></div>' +
        '<div><label for="se-note-' + id + '">Short note</label><input id="se-note-' + id + '" data-se="note" value="' + esc(es.note) + '" maxlength="120" placeholder="e.g. needs to sit near the front"></div></div>' +
        '<div class="row-actions"><button type="button" class="btn small" data-seat-done>Done</button><button type="button" class="btn ghost small danger" data-seat-clear>Empty this seat</button></div></div>';
    }
    return h + '</details>';
  }
  function chartClass(el) { var w = el.closest('[data-chart]'); if (!w) return null; var id = w.getAttribute('data-chart'); return binder.classes.filter(function (x) { return x.id === id; })[0] || null; }
  function rerenderChart(c, focusSel, keepState) {
    var w = document.querySelector('.chart-wrap[data-chart="' + c.id + '"]'); if (!w) return;
    ui(c.id).open = keepState ? w.open : true;
    w.outerHTML = chartHTML(c);
    if (focusSel) { var f = document.querySelector('.chart-wrap[data-chart="' + c.id + '"] ' + focusSel); if (f) f.focus(); }
    var sum = document.querySelector('.chart-wrap[data-chart="' + c.id + '"] summary .sum-time'); if (sum) sum.textContent = c.chart.seats.length + ' placed';
  }
  function placeName(c, key, name) {
    var rc = key.split(','), target = seatAt(c, key);
    var prev = c.chart.seats.filter(function (st) { return st.name.toLowerCase() === name.toLowerCase(); })[0];
    if (prev && prev === target) return;
    if (prev) { if (target) { target.r = prev.r; target.c = prev.c; } prev.r = +rc[0]; prev.c = +rc[1]; }   // already seated: move, swapping
    else if (target) { target.name = name; target.say = ''; target.note = ''; }                            // replaces whoever sat there
    else c.chart.seats.push({ r: +rc[0], c: +rc[1], name: name, say: '', note: '' });
    c.chart = B.normChart(c.chart);
  }
  function moveSeat(c, from, to) {
    if (from === to) return;
    var a = seatAt(c, from), b2 = seatAt(c, to), tr = to.split(','), fr = from.split(',');
    if (!a) return;
    if (b2) { b2.r = +fr[0]; b2.c = +fr[1]; }
    a.r = +tr[0]; a.c = +tr[1];
    c.chart = B.normChart(c.chart);
  }
  document.addEventListener('toggle', function (e) {
    var t = e.target; if (t.classList && t.classList.contains('chart-wrap')) ui(t.getAttribute('data-chart')).open = t.open;
  }, true);
  document.addEventListener('dragstart', function (e) {
    var t = e.target.closest && e.target.closest('[data-chip],[data-seat]'); if (!t) return;
    e.dataTransfer.setData('text/plain', t.hasAttribute('data-chip') ? 'chip:' + t.getAttribute('data-chip') : 'seat:' + t.getAttribute('data-seat'));
    e.dataTransfer.effectAllowed = 'move';
  });
  document.addEventListener('dragover', function (e) { if (e.target.closest && e.target.closest('[data-seat]')) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; } });
  document.addEventListener('drop', function (e) {
    var cell = e.target.closest && e.target.closest('[data-seat]'); if (!cell) return;
    e.preventDefault();
    var c = chartClass(cell); if (!c) return;
    var d = e.dataTransfer.getData('text/plain') || '';
    if (d.indexOf('chip:') === 0) placeName(c, cell.getAttribute('data-seat'), d.slice(5));
    else if (d.indexOf('seat:') === 0) moveSeat(c, d.slice(5), cell.getAttribute('data-seat'));
    else return;
    ui(c.id).chip = null; rerenderChart(c); saveSoon();
  });
  function chartClick(t) {
    var c = chartClass(t); if (!c) return false;
    var u = ui(c.id);
    if (t.hasAttribute('data-chip')) { var n = t.getAttribute('data-chip'); u.chip = u.chip === n ? null : n; u.seat = null; rerenderChart(c, '[data-chip="' + n.replace(/"/g, '\\"') + '"]'); return true; }
    if (t.hasAttribute('data-seat')) {
      var key = t.getAttribute('data-seat');
      if (u.chip) { placeName(c, key, u.chip); u.chip = null; u.seat = null; rerenderChart(c, '[data-seat="' + key + '"]'); saveSoon(); }
      else { u.seat = u.seat === key ? null : key; rerenderChart(c, u.seat ? '[data-se=' + (seatAt(c, key) ? 'say' : 'name') + ']' : null); }
      return true;
    }
    if (t.hasAttribute('data-seat-done')) { var k2 = u.seat; u.seat = null; rerenderChart(c, k2 ? '[data-seat="' + k2 + '"]' : null); return true; }
    if (t.hasAttribute('data-seat-clear')) { var st = u.seat && seatAt(c, u.seat); if (st) c.chart.seats.splice(c.chart.seats.indexOf(st), 1); u.seat = null; rerenderChart(c); saveSoon(); return true; }
    return false;
  }
  function chartInput(t) {
    var c = chartClass(t); if (!c) return;
    var u = ui(c.id); if (!u.seat) return;
    var st = seatAt(c, u.seat), f = t.getAttribute('data-se');
    if (!st) { if (f !== 'name' || !t.value.trim()) return; var rc = u.seat.split(','); st = { r: +rc[0], c: +rc[1], name: '', say: '', note: '' }; c.chart.seats.push(st); }
    st[f] = t.value.replace(/\n/g, ' ').slice(0, f === 'name' ? 40 : f === 'say' ? 60 : 120);
    if (f === 'name' && !st.name.trim()) c.chart.seats.splice(c.chart.seats.indexOf(st), 1);
    var cell = document.querySelector('.chart-wrap[data-chart="' + c.id + '"] [data-seat="' + u.seat + '"]');
    if (cell) { var live = seatAt(c, u.seat); cell.innerHTML = cellInner(live); cell.classList.toggle('filled', !!live); var rc2 = u.seat.split(','); cell.setAttribute('aria-label', cellLabel(+rc2[0], +rc2[1], live)); }
    var sum = document.querySelector('.chart-wrap[data-chart="' + c.id + '"] summary .sum-time'); if (sum) sum.textContent = c.chart.seats.filter(function (x) { return x.name.trim(); }).length + ' placed';
    saveSoon();
  }
  function rerenderAllCharts() { binder.classes.forEach(function (c) { if (document.querySelector('.chart-wrap[data-chart="' + c.id + '"]')) rerenderChart(c, null, true); }); }

  // ---------- school file (Building plan): lesson bank + import/export ----------
  function renderLessons() {
    var el = $('lessonBank'); if (!el) return;
    var popts = binder.classes.map(function (c) { return '<option value="' + esc(c.id) + '">' + esc(c.label) + '</option>'; }).join('');
    el.innerHTML = binder.lessonBank.length ? binder.lessonBank.map(function (l, i) {
      return '<div class="lesson" data-li="' + i + '"><div><strong>' + esc(l.title || 'Untitled lesson') + '</strong><p class="hint">' + esc(l.plan.split('\n')[0].slice(0, 140)) + '</p></div>' +
        '<div class="lesson-actions"><label class="sr" for="lp-' + i + '">Period</label><select id="lp-' + i + '" data-lesson-period>' + popts + '</select>' +
        '<button type="button" class="btn ghost small" data-lesson-use="' + i + '">Use as any-day plan</button>' +
        '<button type="button" class="btn ghost small danger" data-lesson-del="' + i + '" aria-label="Remove lesson">Remove</button></div></div>';
    }).join('') : '<p class="hint">No lessons yet. Add one below or import a school file.</p>';
  }
  function schoolMsg(t, bad) { var m = $('schoolMsg'); m.hidden = false; m.innerHTML = t; m.className = bad ? 'error' : 'status-line'; }

  function renderDay() {
    $('dayPeriods').innerHTML = binder.classes.map(function (c) {
      var on = dayState.checked[c.id] !== false;
      return '<div class="day-row" data-id="' + esc(c.id) + '"><label class="check"><input type="checkbox" data-day-check="' + esc(c.id) + '"' + (on ? ' checked' : '') + '> ' + esc(c.label) +
        ' <span class="hint">' + esc([c.start, c.end].filter(Boolean).join('\u2013')) + '</span></label>' +
        '<textarea rows="2" data-day-lesson="' + esc(c.id) + '" aria-label="Today\u2019s lesson for ' + esc(c.label) + '" placeholder="Today\u2019s lesson (leave blank to use the any-day plan)">' + esc(dayState.lessons[c.id] || '') + '</textarea>' +
        '<button class="btn ghost small" type="button" data-gap="' + esc(c.id) + '">Gap-check this period in the one-day tool</button></div>';
    }).join('');
  }
  function renderAll() { renderShared(); renderContacts(); renderClasses(); renderLessons(); }

  // ---------- events ----------
  var chipTimer = null;
  document.addEventListener('input', function (e) {
    var t = e.target;
    if (t.hasAttribute('data-shared')) {
      binder[t.getAttribute('data-shared')] = t.value; saveSoon();
      if (t.getAttribute('data-shared') === 'students') { clearTimeout(chipTimer); chipTimer = setTimeout(rerenderAllCharts, 400); }
      return;
    }
    if (t.hasAttribute('data-se')) { chartInput(t); return; }
    if (t.type === 'checkbox' || t.tagName === 'SELECT') return;
    if (t.hasAttribute('data-c')) { var i = +t.closest('.contact-row').getAttribute('data-i'); binder.contacts[i][t.getAttribute('data-c')] = t.value; saveSoon(); return; }
    if (t.hasAttribute('data-k')) {
      var id = t.closest('.period-card').getAttribute('data-id');
      var c = binder.classes.filter(function (x) { return x.id === id; })[0];
      if (c) { c[t.getAttribute('data-k')] = t.value; saveSoon(); }
      if (t.getAttribute('data-k') === 'label' || t.getAttribute('data-k') === 'start' || t.getAttribute('data-k') === 'end') {
        var s = t.closest('.period-card').querySelector('summary');
        s.firstChild.textContent = c.label || 'Period';
        renderDay();
      }
      return;
    }
    if (t.hasAttribute('data-day-lesson')) { dayState.lessons[t.getAttribute('data-day-lesson')] = t.value; }
  });
  document.addEventListener('change', function (e) {
    var t = e.target;
    if (t.hasAttribute('data-day-check')) dayState.checked[t.getAttribute('data-day-check')] = t.checked;
    if (t.getAttribute('data-k') === 'storyOn') {
      var sc = binder.classes.filter(function (x) { return x.id === t.closest('.period-card').getAttribute('data-id'); })[0];
      if (sc) { sc.storyOn = t.checked ? 'yes' : ''; saveSoon(); }
    }
    if (t.hasAttribute('data-chart-dim')) {
      var cc = chartClass(t); if (!cc) return;
      var next = { rows: cc.chart.rows, cols: cc.chart.cols, seats: cc.chart.seats };
      next[t.getAttribute('data-chart-dim')] = +t.value;
      var kept = B.normChart(next);
      if (kept.seats.length < cc.chart.seats.length && !confirm((cc.chart.seats.length - kept.seats.length) + ' seated student(s) are outside the smaller chart and will be removed from it. Continue?')) { t.value = cc.chart[t.getAttribute('data-chart-dim')]; return; }
      cc.chart = kept; ui(cc.id).seat = null; rerenderChart(cc, '[data-chart-dim=' + t.getAttribute('data-chart-dim') + ']'); saveSoon();
    }
  });
  document.addEventListener('click', function (e) {
    var t = e.target.closest('button'); if (!t) return;
    if (chartClick(t)) return;
    if (t.hasAttribute('data-lesson-use')) {
      var l = binder.lessonBank[+t.getAttribute('data-lesson-use')], pid = t.parentNode.querySelector('[data-lesson-period]').value;
      var pc = binder.classes.filter(function (x) { return x.id === pid; })[0];
      if (l && pc && (!pc.anyDay.trim() || confirm('Replace the any-day plan for ' + pc.label + ' with \u201c' + (l.title || 'this lesson') + '\u201d?'))) {
        pc.anyDay = l.plan; renderClasses(); saveSoon(); schoolMsg('Set the any-day plan for ' + esc(pc.label) + ' to \u201c' + esc(l.title || 'lesson') + '\u201d.');
      }
      return;
    }
    if (t.hasAttribute('data-lesson-del')) { binder.lessonBank.splice(+t.getAttribute('data-lesson-del'), 1); renderLessons(); saveSoon(); return; }
    if (t.hasAttribute('data-remove-contact')) { binder.contacts.splice(+t.getAttribute('data-remove-contact'), 1); renderContacts(); saveSoon(); }
    else if (t.hasAttribute('data-dup')) {
      if (binder.classes.length >= B.MAX_CLASSES) return;
      var src = binder.classes.filter(function (x) { return x.id === t.getAttribute('data-dup'); })[0];
      var copy = B.emptyClass(src.label + ' (copy)');
      Object.keys(src).forEach(function (k) { if (k !== 'id' && k !== 'label') copy[k] = src[k]; });
      binder.classes.splice(binder.classes.indexOf(src) + 1, 0, copy); renderClasses(); saveSoon();
    } else if (t.hasAttribute('data-del')) {
      var c = binder.classes.filter(function (x) { return x.id === t.getAttribute('data-del'); })[0];
      if (c && confirm('Remove ' + (c.label || 'this period') + ' from the binder?')) { binder.classes.splice(binder.classes.indexOf(c), 1); renderClasses(); saveSoon(); }
    } else if (t.hasAttribute('data-gap')) { gapCheck(t.getAttribute('data-gap')); }
  });
  $('addContact').addEventListener('click', function () { if (binder.contacts.length < B.MAX_CONTACTS) { binder.contacts.push({ role: '', contact: '' }); renderContacts(); saveSoon(); } });
  $('addClass').addEventListener('click', function () {
    if (binder.classes.length >= B.MAX_CLASSES) return;
    binder.classes.push(B.emptyClass('Period ' + (binder.classes.length + 1))); renderClasses(); saveSoon();
    var cards = document.querySelectorAll('.period-card'); cards[cards.length - 1].open = true;
  });

  // ---------- gap check ----------
  $('checkBtn').addEventListener('click', function () {
    saveNow();
    var items = B.readiness(binder);
    var el = $('readiness'); el.hidden = false;
    if (!items.length) { el.innerHTML = '<p class="status-line">Nothing obvious is missing. A stranger should be able to run this.</p>'; return; }
    var groups = {};
    items.forEach(function (it) { (groups[it.scope] = groups[it.scope] || []).push(it.issue); });
    el.innerHTML = '<p><strong>' + items.length + ' thing' + (items.length === 1 ? '' : 's') + ' a sub would still need.</strong> Blank items print as \u201cNot provided \u2014 ask the office.\u201d</p>' +
      Object.keys(groups).map(function (g) { return '<h4>' + esc(g) + '</h4><ul class="gaps">' + groups[g].map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>'; }).join('');
  });

  // ---------- packs ----------
  function showPack(model) {
    $('pack').innerHTML = B.renderPackHTML(model);
    $('packTitle').textContent = model.mode === 'emergency' ? 'Emergency plan \u2014 print pack' : 'Today\u2019s print pack';
    var miss = model.missing.length;
    $('packWarn').hidden = !miss;
    $('packWarn').innerHTML = miss ? '<strong>Before you print:</strong> ' + miss + ' item' + (miss === 1 ? ' is' : 's are') + ' not filled in, so ' + (miss === 1 ? 'it prints' : 'they print') + ' as \u201cNot provided.\u201d Use <em>Check my binder</em> to see which.' : '';
    $('packWrap').hidden = false;
    document.body.classList.add('has-pack');
    $('packWrap').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  $('emergencyBtn').addEventListener('click', function () { saveNow(); showPack(B.buildPack(binder, { mode: 'emergency' })); });
  $('dayBtn').addEventListener('click', function () {
    saveNow();
    var ids = binder.classes.filter(function (c) { return dayState.checked[c.id] !== false; }).map(function (c) { return c.id; });
    if (!ids.length) { alert('Tick at least one period.'); return; }
    showPack(B.buildPack(binder, { mode: 'day', date: $('dayDate').value, periods: ids, lessons: dayState.lessons }));
  });
  $('printBtn').addEventListener('click', function () { window.print(); });

  $('addLesson').addEventListener('click', function () {
    var title = $('lessonTitle').value.trim(), plan = $('lessonPlan').value.trim();
    if (!plan) { schoolMsg('Type the lesson steps first.', true); return; }
    var before = binder.lessonBank.length;
    binder.lessonBank = B.normalizeBinder(Object.assign({}, binder, { lessonBank: binder.lessonBank.concat([{ title: title, plan: plan }]) })).lessonBank;
    if (binder.lessonBank.length === before) { schoolMsg('That lesson is already in the bank (or the bank is full).', true); return; }
    $('lessonTitle').value = ''; $('lessonPlan').value = ''; renderLessons(); saveSoon(); schoolMsg('Added to the lesson bank.');
  });
  $('schoolExport').addEventListener('click', function () {
    saveNow();
    var out = B.buildSchoolFile(binder);
    var blob = new Blob([out.json], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'sub-ready-school-file.json';
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    schoolMsg('Saved sub-ready-school-file.json. It has no student information' + (out.removed.length ? '; ' + out.removed.length + ' line' + (out.removed.length === 1 ? '' : 's') + ' that mentioned a student name were left out' : '') + '. Share it with teachers in your building; each one imports it.');
  });
  $('schoolFile').addEventListener('change', function (e) {
    var f = e.target.files && e.target.files[0]; if (!f) return;
    var r = new FileReader();
    r.onload = function () {
      try {
        var sc = B.parseSchoolFile(r.result);
        var res = B.mergeSchoolFile(binder, sc);
        binder = res.binder; saveNow(); renderAll();
        var rp = res.report;
        schoolMsg('Merged ' + esc(f.name) + ': filled ' + (rp.filled.length ? esc(rp.filled.join(', ')) : 'no blank fields') +
          (rp.contactsAdded + rp.contactsFilled ? '; ' + (rp.contactsAdded + rp.contactsFilled) + ' contact' + (rp.contactsAdded + rp.contactsFilled === 1 ? '' : 's') : '') +
          (rp.lessonsAdded ? '; ' + rp.lessonsAdded + ' lesson' + (rp.lessonsAdded === 1 ? '' : 's') + ' added to the bank' : '') +
          (rp.kept.length ? '. Kept your own text for: ' + esc(rp.kept.join(', ')) : '') + '. Nothing syncs live; import again when the school updates the file.');
      } catch (err) { schoolMsg(esc(err.message), true); }
      finally { e.target.value = ''; }
    };
    r.readAsText(f);
  });
  $('closePack').addEventListener('click', function () { $('packWrap').hidden = true; document.body.classList.remove('has-pack'); });

  function gapCheck(id) {
    saveNow();
    var h = B.toToolHandoff(binder, id, dayState.lessons[id]);
    if (!h) return;
    try { sessionStorage.setItem('subready.handoff', JSON.stringify(h)); } catch (e) {}
    location.href = 'index.html#tool';
  }

  // ---------- export / import / delete ----------
  function msg(t, bad) { var m = $('ioMsg'); m.hidden = false; m.textContent = t; m.className = bad ? 'error' : 'hint'; }
  $('exportBtn').addEventListener('click', function () {
    saveNow();
    var blob = new Blob([B.exportJSON(binder)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'sub-ready-binder.json';
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    msg('Exported sub-ready-binder.json. It holds your class notes, so keep it private.');
  });
  $('importFile').addEventListener('change', function (e) {
    var f = e.target.files && e.target.files[0]; if (!f) return;
    var r = new FileReader();
    r.onload = function () {
      try {
        var nb = B.importJSON(r.result);
        if (!confirm('Replace the binder in this browser with the one from ' + f.name + '?')) return;
        binder = nb; dayState = { checked: {}, lessons: {} }; saveNow(); renderAll();
        msg('Imported ' + binder.classes.length + ' period' + (binder.classes.length === 1 ? '' : 's') + ' from ' + f.name + '.');
      } catch (err) { msg(err.message, true); }
      finally { e.target.value = ''; }
    };
    r.onerror = function () { msg('Couldn\u2019t read that file.', true); };
    r.readAsText(f);
  });
  $('clearBtn').addEventListener('click', function () {
    if (!confirm('Delete the binder from this browser? Export first if you want to keep a copy.')) return;
    B.clear(store); binder = B.emptyBinder(); dayState = { checked: {}, lessons: {} }; renderAll(); setStatus('Deleted from this browser');
    $('packWrap').hidden = true;
  });

  renderAll();
  if (B.load(store)) setStatus(locked ? 'Loaded from this browser (read-only until you subscribe)' : 'Loaded from this browser');
  applyLock();
  window.__subReadyBinder = { get binder() { return binder; }, get access() { return acc; }, get locked() { return locked; }, saveNow: saveNow, persistent: persistent };
})();
