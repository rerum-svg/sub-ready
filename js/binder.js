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
  var unlocked = false;
  try { unlocked = store.getItem('subready.unlocked') === '1'; } catch (e) {}

  // ---------- gate ----------
  var acc = B.access(CFG, unlocked);
  $('accessLabel').textContent = acc.label;
  if (!CFG.EARLY_ACCESS) $('earlyNote').hidden = true;
  if (!acc.enabled) {
    $('app').hidden = true; $('gate').hidden = false;
    if (acc.url) { $('gateBtn').href = acc.url; $('gateBtn').textContent = 'Get the Teacher plan'; $('gateBtn').removeAttribute('aria-disabled'); $('gateText').textContent = 'Unlock the class binder, emergency plan and print pack.'; }
    window.__subReadyBinder = { access: acc };
    return;
  }

  var binder = B.load(store) || B.emptyBinder();
  if (!B.load(store) && !binder.contacts.length) {
    binder.contacts = [{ role: 'Front office', contact: '' }, { role: 'Neighbor teacher', contact: '' }, { role: 'Nurse', contact: '' }];
  }
  var dayState = { checked: {}, lessons: {} };

  function setStatus(t) { $('saveStatus').textContent = t; }
  var saveTimer = null;
  function saveSoon() {
    setStatus('Saving\u2026');
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveNow, 300);
  }
  function saveNow() {
    clearTimeout(saveTimer);
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
  function renderClasses() {
    $('classes').innerHTML = binder.classes.map(function (c, i) {
      var h = '<details class="period-card" data-id="' + esc(c.id) + '"' + (i === 0 || binder.classes.length < 3 ? ' open' : '') + '><summary>' + esc(c.label || ('Period ' + (i + 1))) +
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
      h += '<div class="row-actions"><button class="btn ghost small" type="button" data-dup="' + esc(c.id) + '">Duplicate</button>' +
        (binder.classes.length > 1 ? '<button class="btn ghost small danger" type="button" data-del="' + esc(c.id) + '">Remove period</button>' : '') + '</div></details>';
      return h;
    }).join('');
    $('addClass').disabled = binder.classes.length >= B.MAX_CLASSES;
    renderDay();
  }
  function renderDay() {
    $('dayPeriods').innerHTML = binder.classes.map(function (c) {
      var on = dayState.checked[c.id] !== false;
      return '<div class="day-row" data-id="' + esc(c.id) + '"><label class="check"><input type="checkbox" data-day-check="' + esc(c.id) + '"' + (on ? ' checked' : '') + '> ' + esc(c.label) +
        ' <span class="hint">' + esc([c.start, c.end].filter(Boolean).join('\u2013')) + '</span></label>' +
        '<textarea rows="2" data-day-lesson="' + esc(c.id) + '" aria-label="Today\u2019s lesson for ' + esc(c.label) + '" placeholder="Today\u2019s lesson (leave blank to use the any-day plan)">' + esc(dayState.lessons[c.id] || '') + '</textarea>' +
        '<button class="btn ghost small" type="button" data-gap="' + esc(c.id) + '">Gap-check this period in the one-day tool</button></div>';
    }).join('');
  }
  function renderAll() { renderShared(); renderContacts(); renderClasses(); }

  // ---------- events ----------
  document.addEventListener('input', function (e) {
    var t = e.target;
    if (t.hasAttribute('data-shared')) { binder[t.getAttribute('data-shared')] = t.value; saveSoon(); return; }
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
  });
  document.addEventListener('click', function (e) {
    var t = e.target.closest('button'); if (!t) return;
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
  if (B.load(store)) setStatus('Loaded from this browser');
  window.__subReadyBinder = { get binder() { return binder; }, access: acc, saveNow: saveNow, persistent: persistent };
})();
