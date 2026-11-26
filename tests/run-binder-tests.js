// Class binder tests: node tests/run-binder-tests.js  (writes tests/BINDER-RESULTS.md and tests/out/pack-*.html)
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const C = require('../js/core.js');
const B = require('../js/binder-core.js');
const FIX = require('./binder-fixture.js');
const root = path.join(__dirname, '..');
const results = []; let pass = 0, fail = 0;
function check(group, name, cond, detail) {
  results.push({ group, name, ok: !!cond, detail: detail || '' });
  if (cond) pass++; else { fail++; console.log('FAIL', group, '-', name, detail || ''); }
}
function throws(fn, re) { try { fn(); return false; } catch (e) { return re ? re.test(e.message) : true; } }
function memStore() { const m = {}; return { getItem: k => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, removeItem: k => { delete m[k]; }, _m: m }; }
const clone = (o) => JSON.parse(JSON.stringify(o));
const outDir = path.join(__dirname, 'out'); fs.mkdirSync(outDir, { recursive: true });

// ---------- shape & validation ----------
let g = 'profile';
const e = B.emptyBinder();
check(g, 'empty binder has every shared field', B.SHARED_FIELDS.every(f => e[f[0]] === ''));
check(g, 'empty binder has one period with an id', e.classes.length === 1 && /^c/.test(e.classes[0].id));
const n = B.normalizeBinder(Object.assign(clone(FIX), { evil: 'x', classes: FIX.classes.map(c => Object.assign({}, c, { extra: 1 })) }));
check(g, 'unknown keys are dropped', !('evil' in n) && !('extra' in n.classes[0]));
check(g, 'fixture survives normalize unchanged', JSON.stringify(n.classes.map(c => c.anyDay)) === JSON.stringify(FIX.classes.map(c => c.anyDay)) && n.contacts.length === 3);
check(g, 'non-object input rejected', throws(() => B.normalizeBinder(null)) && throws(() => B.normalizeBinder([])) && throws(() => B.normalizeBinder('x')));
const big = B.normalizeBinder({ classes: Array.from({ length: 30 }, (_, i) => ({ label: 'P' + i, anyDay: 'x'.repeat(10000) })), contacts: Array.from({ length: 40 }, () => ({ role: 'r', contact: 'c' })) });
check(g, 'periods capped at ' + B.MAX_CLASSES, big.classes.length === B.MAX_CLASSES);
check(g, 'contacts capped at ' + B.MAX_CONTACTS, big.contacts.length === B.MAX_CONTACTS);
check(g, 'long fields are trimmed', big.classes[0].anyDay.length === 4000);
const dup = B.normalizeBinder({ classes: [{ id: 'a', label: 'A' }, { id: 'a', label: 'B' }, { label: '' }] });
check(g, 'duplicate ids get fresh ids', dup.classes[0].id !== dup.classes[1].id);
check(g, 'blank period label becomes "Period n"', dup.classes[2].label === 'Period 3');
check(g, 'no periods -> one blank period', B.normalizeBinder({ classes: [] }).classes.length === 1);
check(g, 'non-string values coerced safely', B.normalizeBinder({ teacher: { x: 1 }, room: 214, classes: [{ label: ['x'] }] }).room === '214');
check(g, 'empty contact rows dropped', B.normalizeBinder({ contacts: [{ role: '', contact: '' }, { role: 'Office', contact: '' }], classes: [] }).contacts.length === 1);

// ---------- save / reload ----------
g = 'save & reload';
const st = memStore();
check(g, 'nothing saved yet -> load returns null', B.load(st) === null);
B.save(st, FIX);
const re1 = B.load(st);
check(g, 'save then reload returns the same binder', JSON.stringify(re1) === JSON.stringify(B.normalizeBinder(FIX)));
check(g, 'stored under ' + B.STORAGE_KEY + ' only', Object.keys(st._m).length === 1 && st._m[B.STORAGE_KEY]);
const edited = clone(re1); edited.classes[0].anyDay = 'Changed plan'; B.save(st, edited);
check(g, 'edit, save, reload keeps the edit', B.load(st).classes[0].anyDay === 'Changed plan');
st.setItem(B.STORAGE_KEY, '{broken');
check(g, 'corrupted save -> load returns null (no crash)', B.load(st) === null);
B.save(st, FIX); B.clear(st);
check(g, 'delete removes it', B.load(st) === null);

// ---------- export / import ----------
g = 'export & import';
const json = B.exportJSON(FIX, new Date('2026-11-26T16:00:00Z'));
const env = JSON.parse(json);
check(g, 'export has app/kind/version envelope', env.app === 'sub-ready' && env.kind === 'class-binder' && env.version === 1 && env.exportedAt === '2026-11-26T16:00:00.000Z');
check(g, 'export warns to keep the file private', /private/i.test(env.note));
const back = B.importJSON(json);
check(g, 'export -> import round trip is identical', JSON.stringify(back) === JSON.stringify(B.normalizeBinder(FIX)));
check(g, 'double round trip is stable', B.exportJSON(B.importJSON(json), new Date('2026-11-26T16:00:00Z')) === json);
check(g, 'BOM at start of file is tolerated', JSON.stringify(B.importJSON('\uFEFF' + json)) === JSON.stringify(back));
check(g, 'bare binder object (classes array) accepted', B.importJSON(JSON.stringify(FIX)).classes.length === 3);
check(g, 'empty file rejected with a clear message', throws(() => B.importJSON(''), /empty/));
check(g, 'non-JSON rejected with a clear message', throws(() => B.importJSON('hello'), /valid JSON/));
check(g, 'other JSON rejected', throws(() => B.importJSON('{"foo":1}'), /doesn.t contain/));
check(g, 'wrong Sub-Ready kind rejected', throws(() => B.importJSON('{"app":"sub-ready","kind":"other","binder":{}}'), /isn.t a class binder/));
check(g, 'newer version rejected', throws(() => B.importJSON('{"app":"sub-ready","kind":"class-binder","version":99,"binder":{"classes":[]}}'), /newer version/));
check(g, 'huge file rejected', throws(() => B.importJSON('{"classes":[],"x":"' + 'a'.repeat(2100000) + '"}'), /too large/));
check(g, 'array JSON rejected', throws(() => B.importJSON('[1,2]')));

// ---------- access flag ----------
g = 'early-access flag';
const cfgSrc = fs.readFileSync(path.join(root, 'js/config.js'), 'utf8');
const sandbox = { window: {} }; vm.runInNewContext(cfgSrc, sandbox);
const CFG = sandbox.window.SUB_READY_CONFIG;
check(g, 'shipped config: PRO_URL is empty', CFG.PRO_URL === '');
check(g, 'shipped config: EARLY_ACCESS is on', CFG.EARLY_ACCESS === true);
const a1 = B.access(CFG, false);
check(g, 'early access -> enabled, labeled free, not paid', a1.enabled && a1.label === 'Free early access' && !a1.paid);
const a2 = B.access({ PRO_URL: '', EARLY_ACCESS: false }, false);
check(g, 'flag off, no PRO_URL -> locked, "Coming soon", no link', !a2.enabled && a2.label === 'Coming soon' && a2.url === '');
const a3 = B.access({ PRO_URL: 'https://example.com/buy', EARLY_ACCESS: false }, false);
check(g, 'flag off, PRO_URL set, not unlocked -> locked with checkout link', !a3.enabled && a3.url === 'https://example.com/buy' && /\$5\/month/.test(a3.label));
const a4 = B.access({ PRO_URL: 'https://example.com/buy', EARLY_ACCESS: false }, true);
check(g, 'flag off, PRO_URL set, unlocked -> enabled as Teacher plan', a4.enabled && a4.paid);
check(g, 'unlock alone without PRO_URL does not enable', !B.access({ PRO_URL: '', EARLY_ACCESS: false }, true).enabled);

// ---------- times ----------
g = 'times';
const t = (s, e2) => B.classTimes({ start: s, end: e2 });
check(g, '"8:00"-"8:50"', t('8:00', '8:50').start === 480 && t('8:00', '8:50').end === 530);
check(g, '"12:50"-"1:40" crosses noon', t('12:50', '1:40').start === 770 && t('12:50', '1:40').end === 820);
check(g, '"1:05 PM"-"1:55 PM"', t('1:05 PM', '1:55 PM').start === 785);
check(g, 'range typed in start box', t('10:40-11:30', '').end === 690);
check(g, 'unreadable time -> null', t('after lunch', '').start === null);

// ---------- gap check (readiness) ----------
g = 'gap check';
const rEmpty = B.readiness(B.emptyBinder());
check(g, 'empty binder flags shared fields and contacts', rEmpty.some(i => i.field === 'emergency') && rEmpty.some(i => i.field === 'contacts') && rEmpty.some(i => i.field === 'anyDay'));
const rFull = B.readiness(FIX);
check(g, 'filled binder has no gaps', rFull.length === 0, JSON.stringify(rFull));
const vague = clone(FIX); vague.classes[0].anyDay = 'Do the usual warm-up\nWorksheets from the bin';
const rV = B.readiness(vague);
check(g, 'vague any-day plan is flagged ("the usual", "the bin")', rV.some(i => /usual/.test(i.issue)) && rV.some(i => /bin/.test(i.issue)), rV.map(i => i.issue).join(' / '));
const ov = clone(FIX); ov.classes[1].end = '10:50';
check(g, 'overlapping periods flagged', B.readiness(ov).some(i => /Overlaps/.test(i.issue)));
const bad = clone(FIX); bad.classes[0].start = 'after lunch';
check(g, 'unreadable time flagged', B.readiness(bad).some(i => /isn.t a time/.test(i.issue)));
const rev = clone(FIX); rev.classes[0].start = '11:30'; rev.classes[0].end = '10:40';
check(g, 'end before start flagged', B.readiness(rev).some(i => /Ends before/.test(i.issue)));

// ---------- emergency plan & multi-period day plan ----------
g = 'print pack';
const em = B.buildPack(FIX, { mode: 'emergency' });
check(g, 'emergency plan covers every period', em.periods.length === 3 && em.mode === 'emergency');
check(g, 'periods sorted by time (P1, P3, P5)', em.periods.map(p => p.id).join() === 'p1,p3,p5');
check(g, 'emergency plan uses any-day plans', em.periods.every(p => p.source === 'any-day'));
const day = B.buildPack(FIX, { mode: 'day', date: 'Tuesday, December 2', periods: ['p3', 'p5'], lessons: { p3: 'Lesson 4.2 notes, then textbook p. 88 #1-10.' } });
check(g, 'day plan covers only the chosen periods', day.periods.map(p => p.id).join() === 'p3,p5');
check(g, 'today\u2019s lesson overrides the any-day plan', day.periods[0].source === 'today' && /Lesson 4.2/.test(day.periods[0].plan));
check(g, 'blank lesson falls back to the any-day plan', day.periods[1].source === 'any-day');
const noAny = clone(FIX); noAny.classes[1].anyDay = '';
check(g, 'period with no plan is marked missing', B.buildPack(noAny, { mode: 'emergency' }).periods[0].source === 'missing');
const untimed = clone(FIX); untimed.classes[0].start = ''; untimed.classes[0].end = '';
check(g, 'untimed period goes last', B.buildPack(untimed).periods.slice(-1)[0].id === 'p3');
const html = B.renderPackHTML(em);
const sheets = (html.match(/<section class="sheet/g) || []).length;
check(g, 'pack = cover + schedule + one sheet per period + emergency sheet', sheets === 3 + 3, String(sheets));
check(g, 'order: cover, schedule, periods, emergency', /sheet cover[\s\S]*sheet schedule[\s\S]*sheet period[\s\S]*sheet emergency/.test(html));
check(g, 'student names printed as typed (local only)', /Maya L\./.test(html) && /Ava T\./.test(html));
check(g, 'contacts printed by role', /Front office<\/th><td>ext 100/.test(html));
check(g, 'blank date prints a write-in line', /Date: _+/.test(html));
check(g, 'emergency sheet has the procedures', /Door 6/.test(html.split('sheet emergency')[1]));
const emptyHtml = B.renderPackHTML(B.buildPack(B.emptyBinder()));
check(g, 'blank fields print "Not provided — ask the office"', (emptyHtml.match(/Not provided/g) || []).length >= 8);
const xss = clone(FIX); xss.teacher = '<img src=x onerror=alert(1)>'; xss.classes[0].anyDay = '<script>alert(1)</script>';
const xh = B.renderPackHTML(B.buildPack(xss));
check(g, 'HTML in fields is escaped', !/<script>|<img/.test(xh) && /&lt;script&gt;/.test(xh));
check(g, 'missing items limited to chosen periods', B.buildPack(noAny, { mode: 'day', periods: ['p3'] }).missing.length === 0 && B.buildPack(noAny, { mode: 'day', periods: ['p1'] }).missing.length === 1);
fs.writeFileSync(path.join(outDir, 'pack-emergency.html'), '<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="../../styles.css"><body class="binder-page"><main class="wrap">' + html + '</main>');
fs.writeFileSync(path.join(outDir, 'pack-day.html'), '<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="../../styles.css"><body class="binder-page"><main class="wrap">' + B.renderPackHTML(day) + '</main>');

// ---------- print CSS ----------
g = 'print css';
const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
const pblock = css.slice(css.lastIndexOf('@media print'));
check(g, 'each sheet starts a new printed page', /\.pack \.sheet\{[^}]*break-after:page/.test(pblock));
check(g, 'last sheet adds no blank page', /\.sheet:last-child\{[^}]*break-after:auto/.test(pblock));
check(g, 'site header, footer and editor are hidden in print', /header\.site[^{]*footer[^{]*\.no-print\{display:none/.test(pblock));
check(g, 'rows do not split across pages', /break-inside:avoid/.test(pblock));

// ---------- hand-off to the one-day tool ----------
g = 'hand-off';
const h = B.toToolHandoff(FIX, 'p5', '');
check(g, 'uses the any-day plan when no lesson typed', /Silent reading/.test(h.plan));
check(g, 'carries the period time as a bell entry', /12:50 PM-1:40 PM/.test(h.periods) && C.parsePeriods(h.periods).length === 1);
check(g, 'carries emergency info and contacts', /Door 6/.test(h.emergency) && /Nurse: ext 210/.test(h.emergency));
check(g, 'today\u2019s lesson wins when typed', /Lesson/.test(B.toToolHandoff(FIX, 'p3', 'Lesson 4.2').plan));
check(g, 'names to hide = listed names + helpers', ['Jaylen', 'Ava T.', 'Grace S.'].every(x => h.names.split('\n').includes(x)) && !/Reading|Seating/.test(h.names), h.names);
check(g, 'unknown period -> null', B.toToolHandoff(FIX, 'nope') === null);

// ---------- pages: honesty & privacy ----------
g = 'pages';
const files = ['index.html', 'binder.html', 'compare.html', 'js/app.js', 'js/core.js', 'js/binder.js', 'js/binder-core.js', 'js/config.js', 'styles.css', 'README.md'];
const all = files.map(f => fs.readFileSync(path.join(root, f), 'utf8')).join('\n');
check(g, 'no Rerum or Rerum product names in site files', !/rerum|scripto|phenomenon|preacheritage|\bbless\b|nail salon|fed tzuu/i.test(all));
check(g, 'no analytics or tracking scripts', !/google-analytics|gtag\(|googletagmanager|plausible|mixpanel|segment\.com|hotjar|clarity\.ms/i.test(all));
const binderJs = fs.readFileSync(path.join(root, 'js/binder.js'), 'utf8') + fs.readFileSync(path.join(root, 'js/binder-core.js'), 'utf8');
check(g, 'binder code makes no network calls', !/fetch\(|XMLHttpRequest|sendBeacon|WebSocket|navigator\.sendBeacon/.test(binderJs));
const cmp = fs.readFileSync(path.join(root, 'compare.html'), 'utf8');
const rows = cmp.split('<tbody>')[1].split('<tr><th>').slice(1);
check(g, 'compare page: 6 rows (Sub-Ready + 5 tools)', rows.length === 6, String(rows.length));
check(g, 'compare page: every other tool has a source link and as-of date', rows.slice(1).every(r => /href="https:\/\//.test(r) && /Nov 26, 2026/.test(r)));
check(g, 'compare page: no repeated customer counts or testimonials', !/214|testimonial|trusted by|\d+ schools use/i.test(cmp));
const idx = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
check(g, 'landing: plans labeled coming soon, no fake urgency', /coming soon/i.test(idx) && !/limited time|only \d+ left|hurry|act now/i.test(idx + cmp + fs.readFileSync(path.join(root, 'binder.html'), 'utf8')));
check(g, 'landing: no old "$9 one-time" offer', !/\$9 one-time/.test(idx));

// ---------- write results ----------
let md = '# Class binder test results\n\nRun: ' + new Date().toISOString() + ' (UTC)  \nCommand: `node tests/run-binder-tests.js`  \n**' + pass + ' passed, ' + fail + ' failed** (' + (pass + fail) + ' checks)\n\nRendered packs: `tests/out/pack-emergency.html`, `tests/out/pack-day.html`\n\n| Group | Check | Result | Detail |\n|---|---|---|---|\n';
results.forEach(r => { md += '| ' + r.group + ' | ' + r.name.replace(/\|/g, '/') + ' | ' + (r.ok ? 'PASS' : '**FAIL**') + ' | ' + String(r.detail).replace(/\|/g, '/').replace(/\n/g, ' ').slice(0, 120) + ' |\n'; });
fs.writeFileSync(path.join(__dirname, 'BINDER-RESULTS.md'), md);
console.log(pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
