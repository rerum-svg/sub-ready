/* Sub-Ready: optional "Student writing activity (Scripto)" block. Pure logic, no DOM, no network.
   Only used when SUB_READY_CONFIG.SCRIPTO_ACTIVITY is true. Sub-Ready never loads Scripto code, never calls
   its servers and never embeds it: it only prints a link (and a QR code drawn on this device) that the sub
   opens in a new tab. The link is rebuilt from the session token alone, so no student name, roster or
   binder data can ever ride along in it. */
(function (root, factory) {
  var Q = (typeof module === 'object' && module.exports) ? require('./vendor/qrcode.js') : root.qrcode;
  var api = factory(Q);
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.SubReadyScripto = api;
})(typeof self !== 'undefined' ? self : this, function (qrcode) {
  'use strict';
  var PREFIX = 'https://scriptorerum.com/school/s/';
  var REF = 'ref=subready';
  // Copy from the Scripto School spec v2, section 4.3 (and section 8 for the label).
  var COPY = {
    label: 'Student writing activity (Scripto)',
    linkLabel: 'Scripto session link',
    timeLabel: 'Time slot',
    notesLabel: 'Notes for the sub',
    card: 'Add a student writing activity: Scripto writing sessions run from your sub plan. Prepare one at scriptorerum.com/school.',
    cardUrl: 'https://scriptorerum.com/school',
    privacy: 'Sub-Ready itself still uploads nothing. If you add a Scripto writing activity, that part runs on scriptorerum.com under Scripto\u2019s School privacy terms.',
    steps: ['Open this link on the teacher computer.', 'Press Start.', 'Put the code on the board. Students go to scriptorerum.com/join.'],
    title: 'Student writing activity (Scripto)'
  };
  var TOKEN_RE = /^[A-Za-z0-9_-]{6,128}$/;

  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function firstNames(list) {
    // Student first names (and any word of 3+ letters in each listed name) the link must never contain.
    var out = [];
    String(list || '').split(/[\n,;]+/).forEach(function (n) {
      n.split(/[\s.]+/).forEach(function (w) { w = w.trim(); if (/^[A-Za-z\u00c0-\u024f'-]{3,}$/.test(w)) out.push(w.toLowerCase()); });
    });
    return out;
  }

  // Returns { ok, url, token, error }. url is the ONLY thing Sub-Ready will ever print, link or encode.
  // opts.students: the binder's student-name list, so a token that spells a student name is refused.
  function validateLink(raw, opts) {
    opts = opts || {};
    var s = String(raw == null ? '' : raw).trim();
    if (!s) return { ok: false, empty: true, error: '' };
    if (s.indexOf(PREFIX) !== 0) return { ok: false, error: 'Paste the session link from Scripto. It starts with ' + PREFIX };
    var rest = s.slice(PREFIX.length);
    var token = rest.split(/[?#]/)[0].replace(/\/+$/, '');
    if (!TOKEN_RE.test(token)) return { ok: false, error: 'That doesn\u2019t look like a complete session link. Copy it again from Scripto.' };
    var low = token.toLowerCase();
    var hit = firstNames(opts.students).filter(function (n) { return low.indexOf(n) > -1; })[0];
    if (hit) return { ok: false, error: 'That link seems to contain a student name. Use the link exactly as Scripto made it.' };
    return { ok: true, token: token, url: PREFIX + token + '?' + REF, error: '' };
  }

  // QR code as inline SVG, drawn here. Encodes exactly the validated url and nothing else.
  function qrSVG(text) {
    var q = qrcode(0, 'M');
    q.addData(String(text));
    q.make();
    var n = q.getModuleCount(), m = 4, size = n + m * 2, d = '';
    for (var r = 0; r < n; r++) for (var c = 0; c < n; c++) if (q.isDark(r, c)) d += 'M' + (c + m) + ',' + (r + m) + 'h1v1h-1z';
    return '<svg class="qr" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + size + ' ' + size + '" role="img" aria-label="QR code for the session link" shape-rendering="crispEdges"><rect width="' + size + '" height="' + size + '" fill="#fff"/><path d="' + d + '" fill="#000"/></svg>';
  }

  // activity: { link, time, notes }; returns '' when there is no valid link.
  function renderBlock(activity, opts) {
    activity = activity || {};
    var v = validateLink(activity.link, opts);
    if (!v.ok) return '';
    var h = '<div class="pk-row writing-activity" data-url="' + esc(v.url) + '"><h4>' + esc(COPY.title) + '</h4>';
    if (String(activity.time || '').trim()) h += '<p class="wa-time"><strong>' + esc(COPY.timeLabel) + ':</strong> ' + esc(activity.time) + '</p>';
    h += '<div class="wa-body"><ol class="wa-steps">' + COPY.steps.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ol>';
    h += '<p class="wa-link"><a href="' + esc(v.url) + '" target="_blank" rel="noopener noreferrer">' + esc(v.url) + '</a></p>';
    h += '<div class="wa-qr">' + qrSVG(v.url) + '</div></div>';
    if (String(activity.notes || '').trim()) h += '<p class="wa-notes"><strong>' + esc(COPY.notesLabel) + ':</strong> ' + esc(activity.notes) + '</p>';
    h += '<p class="wa-privacy">' + esc(COPY.privacy) + '</p></div>';
    return h;
  }

  return { PREFIX: PREFIX, COPY: COPY, validateLink: validateLink, qrSVG: qrSVG, renderBlock: renderBlock };
});
