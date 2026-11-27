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
check(g, 'pack = cover + schedule + one sheet per period + end-of-day note + emergency sheet', sheets === 3 + 4, String(sheets));
check(g, 'order: cover, schedule, periods, end-of-day note, emergency', /sheet cover[\s\S]*sheet schedule[\s\S]*sheet period[\s\S]*sheet daynote[\s\S]*sheet emergency/.test(html));
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


// ---------- quick-win binder fields ----------
g = 'quick-win fields';
const QW = Object.assign(clone(FIX), { rules: 'No one leaves without a pass.', phones: 'Phones in the caddy by the door.', tellYou: '"We always get free time on Fridays." We don\u2019t.', goTo: 'Mr. Okafor, room 216', pronounce: 'Siobhan - shi-VAWN\nNguyen - nwin' });
check(g, 'new fields exist on an empty binder', ['rules', 'phones', 'tellYou', 'goTo', 'pronounce', 'noteEmail', 'notePhone', 'bells'].every(k => B.emptyBinder()[k] === ''));
check(g, 'they are optional (not in the gap check)', B.readiness(FIX).length === 0);
const qwRe = B.importJSON(B.exportJSON(QW));
check(g, 'export -> import keeps them', qwRe.rules === QW.rules && qwRe.pronounce === QW.pronounce && qwRe.goTo === QW.goTo);
const qwHtml = B.renderPackHTML(B.buildPack(QW));
const qwSched = qwHtml.split('sheet schedule')[1].split('</section>')[0];
check(g, 'printed on the schedule page when filled in', ['Must-follow rules', 'Phone policy', 'Things students may tell you', 'Go-to adult nearby', 'How to say names'].every(x => qwSched.indexOf(x) > -1) && /shi-VAWN/.test(qwSched));
check(g, 'not printed at all when blank (no "Not provided" noise)', !/Must-follow rules|Phone policy|Go-to adult/.test(B.renderPackHTML(B.buildPack(FIX)).split('sheet schedule')[1].split('</section>')[0]));
const qwH = B.toToolHandoff(QW, 'p3', '');
check(g, 'phone policy and rules go to the one-day tool as routines', /Phones: Phones in the caddy/.test(qwH.routines) && /Must-follow rules: No one leaves/.test(qwH.routines));
check(g, 'pronunciation names join the names hidden from the AI', ['Siobhan', 'Nguyen'].every(n => qwH.names.split('\n').includes(n)), qwH.names);

// ---------- seating chart ----------
g = 'seating chart';
const e0 = B.emptyBinder().classes[0].chart;
check(g, 'each period starts with an empty 5 x 6 chart', e0.rows === 5 && e0.cols === 6 && e0.seats.length === 0);
const nc = B.normChart({ rows: 99, cols: 0, seats: [{ r: 0, c: 0, name: 'A' }, { r: 0, c: 0, name: 'Dup' }, { r: 20, c: 0, name: 'Off' }, { r: 1, c: 0, name: '   ' }, { r: 'x', c: 1, name: 'Bad' }, null, { r: 2, c: 0, name: 'N'.repeat(90), say: 'S'.repeat(200), note: 'x\ny' }] });
check(g, 'rows/cols clamped to 1-10', nc.rows === 10 && nc.cols === 1);
check(g, 'bad, duplicate, blank and off-grid seats dropped', nc.seats.length === 2 && nc.seats[0].name === 'A', JSON.stringify(nc.seats.map(x => x.name.slice(0, 5))));
check(g, 'name/say/note trimmed to 40/60/120, no newlines', nc.seats[1].name.length === 40 && nc.seats[1].say.length === 60 && nc.seats[1].note === 'x y');
check(g, 'seat count capped at ' + B.MAX_SEATS, B.normChart({ rows: 10, cols: 10, seats: Array.from({ length: 150 }, (_, i) => ({ r: Math.floor(i / 10) % 10, c: i % 10, name: 'S' + i })) }).seats.length === 100);
const CH = clone(FIX);
CH.classes[0].chart = { rows: 4, cols: 5, seats: [{ r: 0, c: 0, name: 'Jaylen', say: 'JAY-len', note: 'front row for the board' }, { r: 1, c: 2, name: 'Siobhan', say: 'shi-VAWN', note: '' }, { r: 3, c: 4, name: '<b>X</b>', say: '', note: '' }] };
const chRe = B.importJSON(B.exportJSON(CH));
check(g, 'export -> import keeps the chart', JSON.stringify(chRe.classes[0].chart) === JSON.stringify(B.normChart(CH.classes[0].chart)));
const chst = memStore(); B.save(chst, CH);
check(g, 'save -> reload keeps the chart', B.load(chst).classes[0].chart.seats.length === 3);
const chHtml = B.renderPackHTML(B.buildPack(CH, { mode: 'emergency' }));
check(g, 'chart page follows its period page', /Period 3 - Math 7<\/h2>[\s\S]*?<\/section><section class="sheet seating">/.test(chHtml));
check(g, 'only periods with seats get a chart page', (chHtml.match(/sheet seating/g) || []).length === 1);
const grid = chHtml.split('sheet seating')[1].split('</table>')[0];
check(g, 'grid is rows x cols (4 x 5 = 20 cells)', (grid.match(/<td/g) || []).length === 20 && (grid.match(/<tr>/g) || []).length === 4);
check(g, 'front of the room marked at the top', /Front of the room/.test(chHtml.split('sheet seating')[1].split('<table')[0]));
check(g, 'name, how to say it and note printed in the right cell', /<tr><td class="seat"><div class="seat-in"><strong>Jaylen<\/strong><span class="say">say \u201cJAY-len\u201d<\/span><span class="snote">front row for the board<\/span>/.test(grid));
check(g, 'chart names escaped', /&lt;b&gt;X&lt;\/b&gt;/.test(grid) && !/<b>X<\/b>/.test(grid));
const chH = B.toToolHandoff(CH, 'p5', '');
check(g, 'chart names from every period join the names hidden from the AI', ['Siobhan', 'Jaylen'].every(n => chH.names.split('\n').includes(n)), chH.names);
// Masking end to end: a name that exists ONLY on a seating chart must never reach the AI prompt.
const CH2 = clone(CH); CH2.classes[0].seating = 'Siobhan sits by the door and helps with the projector.'; CH2.classes[0].helpers = 'Ask Siobhan first.';
const h2 = B.toToolHandoff(CH2, 'p3', 'Lesson: Siobhan hands out the worksheets.');
check(g, 'that name is not in the student list (chart only)', !/Siobhan/.test(CH2.students));
const nm2 = C.buildNameMap(C.parseNameList(h2.names));
const mk = (t) => C.maskNames(t, nm2).text;
const info2 = { className: h2.title, periods: h2.periods, routines: mk(h2.routines), locations: mk(h2.locations), helpers: mk(h2.helpers), emergency: mk(h2.emergency) };
const prompt2 = C.buildGapPrompt(mk(h2.plan), info2) + C.buildScriptPrompt(mk(h2.plan), info2, []);
check(g, 'chart-only name never reaches the AI prompt (gap + script prompts)', !/Siobhan/i.test(prompt2) && /\[STUDENT_\d+\]/.test(prompt2), prompt2.slice(0, 200));

// ---------- end-of-day note ----------
g = 'end-of-day note';
const noNote = B.renderPackHTML(B.buildPack(FIX, { mode: 'emergency' }));
const ns = noNote.split('sheet daynote')[1].split('</section>')[0];
check(g, 'printed form is in every pack, before the emergency sheet', /sheet daynote[\s\S]*sheet emergency/.test(noNote) && /End-of-day note for Ms\. Rivera/.test(ns));
check(g, 'form lists each period in the pack with a rating', ['Period 1 - Math 6', 'Period 3 - Math 7', 'Period 5 - Advisory'].every(x => ns.indexOf(x) > -1) && /Great[\s\S]*OK[\s\S]*Rough/.test(ns));
check(g, 'form has what got done / didn\u2019t / anything to know', /What got done/.test(ns) && /What didn\u2019t get done/.test(ns) && /Anything I should know/.test(ns));
check(g, 'no contact -> no QR code', !/<svg/.test(ns));
const NT = Object.assign(clone(FIX), { noteEmail: 'ms.rivera@lincoln.example.org', notePhone: '(555) 201-4477' });
const ntm = B.buildPack(NT, { mode: 'day', date: 'Tuesday, December 2', periods: ['p3'] });
const nth = B.renderPackHTML(ntm);
const nsh = nth.split('sheet daynote')[1].split('</section>')[0];
check(g, 'mailto: to the teacher\u2019s own address', ntm.note.mailto.indexOf('mailto:ms.rivera@lincoln.example.org?subject=') === 0);
check(g, 'sms: to the teacher\u2019s own number (digits only)', ntm.note.sms.indexOf('sms:5552014477?&body=') === 0);
const body = decodeURIComponent(ntm.note.mailto.split('&body=')[1]);
check(g, 'prefilled body is a blank form with room and date', /^End-of-day note, Room 214, Tuesday, December 2\n/.test(body) && /How it went:/.test(body) && /\nFrom:$/.test(body), body);
check(g, 'links stay short enough for a small printed QR (< 300 chars)', ntm.note.mailto.length < 300 && ntm.note.sms.length < 220, ntm.note.mailto.length + '/' + ntm.note.sms.length);
check(g, 'subject has room and date only', decodeURIComponent(ntm.note.mailto.split('subject=')[1].split('&')[0]) === 'Sub note: Room 214, Tuesday, December 2');
const noteSecrets = C.parseNameList(FIX.students).concat(['Jaylen', 'Maya', 'Ava', 'EpiPen', 'Door 6', 'Okafor', 'Lincoln Middle']);
check(g, 'privacy: no student name or binder notes in either link', [ntm.note.mailto, ntm.note.sms].every(u => noteSecrets.every(x => decodeURIComponent(u).toLowerCase().indexOf(x.toLowerCase()) < 0)));
check(g, 'two QR codes, drawn locally, each encoding exactly its link', (nsh.match(/<svg class="qr"/g) || []).length === 2 && nsh.indexOf(B.qrSVG(ntm.note.mailto, 'QR code: email the note')) > -1 && nsh.indexOf(B.qrSVG(ntm.note.sms, 'QR code: text the note')) > -1);
check(g, 'says nothing is sent until the sub presses send', /Nothing is sent until you press send/.test(nsh));
check(g, 'QR codes are inline SVG (no image request)', !/<img|src=/.test(nsh));
[['a@b.com?bcc=x@y.com', 'query injection'], ['a@b.com\nBcc: x@y.com', 'header injection'], ['not an email', 'plain text'], ['a@b', 'no TLD'], ['<a@b.com>', 'brackets'], ['a,b@c.com', 'comma list']].forEach(([v, why]) => check(g, 'email rejected: ' + why, B.cleanEmail(v) === ''));
check(g, 'phone: formatting stripped, +country kept', B.cleanPhone('+1 (555) 201-4477') === '+15552014477' && B.cleanPhone('555.201.4477') === '5552014477');
check(g, 'phone rejected: letters / too short / injection', B.cleanPhone('call me') === '' && B.cleanPhone('123') === '' && B.cleanPhone('5552014477?body=hi') === '');
const badN = Object.assign(clone(FIX), { noteEmail: 'oops', notePhone: 'abc' });
check(g, 'bad contact -> no QR, flagged in the gap check', !/<svg/.test(B.renderPackHTML(B.buildPack(badN))) && B.readiness(badN).filter(i => /noteEmail|notePhone/.test(i.field)).length === 2);
check(g, 'emergency mode note has a write-in date', /<th>Date<\/th><td><\/td>/.test(ns));
fs.writeFileSync(path.join(outDir, 'pack-note.html'), '<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="../../styles.css"><body class="binder-page"><main class="wrap">' + nth + '</main>');

// ---------- shared school file (Building plan) ----------
g = 'school file';
const SCB = Object.assign(clone(FIX), { bells: 'P1 8:00-8:50\nP3 10:40-11:30', phones: 'Phones away in class.', rules: 'Walk in the halls.\nJaylen may leave 5 minutes early for the bus.', pronounce: 'Siobhan - shi-VAWN', noteEmail: 'ms.rivera@lincoln.example.org',
  lessonBank: [{ title: 'Reading response', plan: 'Read 20 minutes.\nWrite 5 sentences.' }, { title: 'Reading response', plan: 'Read 20 minutes.\nWrite 5 sentences.' }, { title: 'Math review', plan: '' }] });
SCB.classes[0].chart = { rows: 2, cols: 2, seats: [{ r: 0, c: 0, name: 'Siobhan' }] };
check(g, 'lesson bank: duplicates and empty plans dropped', B.normalizeBinder(SCB).lessonBank.length === 1);
const sf = B.buildSchoolFile(SCB, new Date('2026-11-27T12:00:00Z'));
const sfj = JSON.parse(sf.json);
check(g, 'envelope: app/kind/version', sfj.app === 'sub-ready' && sfj.kind === 'school-file' && sfj.version === 1 && sfj.exportedAt === '2026-11-27T12:00:00.000Z');
check(g, 'has bells, procedures, contacts by role and lessons', /P1 8:00/.test(sfj.school.bells) && /Door 6/.test(sfj.school.procedures.emergency) && sfj.school.contacts.length === 3 && sfj.school.lessons.length === 1 && sfj.school.name === 'Lincoln Middle School');
const sfText = sf.json.toLowerCase();
check(g, 'never includes students, health notes, pronunciations, charts, periods or the teacher\u2019s own contact', !/epipen|ava t|maya|will r\.|grace|noah|siobhan|shi-vawn|ms\.rivera@|seating|any-day folder|"classes"|"students"|"health"/.test(sfText), (sfText.match(/epipen|maya|siobhan|classes|students|health/g) || []).join(','));
check(g, 'a procedure line that names a student is dropped and reported', /Walk in the halls/.test(sfj.school.procedures.rules) && !/Jaylen/.test(sf.json) && sf.removed.some(r => /rules/.test(r) && /Jaylen/.test(r)));
check(g, 'parse: round trip', JSON.stringify(B.parseSchoolFile(sf.json).procedures) === JSON.stringify(sfj.school.procedures));
check(g, 'parse: a class binder file is refused with a clear message', throws(() => B.parseSchoolFile(B.exportJSON(FIX)), /class binder, not a school file/));
check(g, 'parse: other JSON / empty / not JSON / newer version refused', throws(() => B.parseSchoolFile('{"a":1}'), /isn.t a Sub-Ready school file/) && throws(() => B.parseSchoolFile(''), /empty/) && throws(() => B.parseSchoolFile('nope'), /valid JSON/) && throws(() => B.parseSchoolFile('{"app":"sub-ready","kind":"school-file","version":9,"school":{}}'), /newer version/));
const fresh = B.emptyBinder(); fresh.teacher = 'Mr. Lee'; fresh.bathroom = 'Mr. Lee\u2019s own pass rule.'; fresh.contacts = [{ role: 'front office', contact: '' }, { role: 'Coach', contact: 'gym' }];
const mg = B.mergeSchoolFile(fresh, B.parseSchoolFile(sf.json));
check(g, 'merge: fills blank fields', mg.binder.school === 'Lincoln Middle School' && /Door 6/.test(mg.binder.emergency) && /P1 8:00/.test(mg.binder.bells) && mg.report.filled.indexOf('Emergency procedures') > -1);
check(g, 'merge: never overwrites the teacher\u2019s own text', mg.binder.bathroom === 'Mr. Lee\u2019s own pass rule.' && mg.report.kept.indexOf('Bathroom / hall pass') > -1 && mg.binder.teacher === 'Mr. Lee');
check(g, 'merge: contacts matched by role (case-insensitive), blanks filled, new roles added', mg.binder.contacts.length === 4 && mg.binder.contacts[0].contact === 'ext 100' && mg.binder.contacts[1].contact === 'gym' && mg.report.contactsAdded === 2 && mg.report.contactsFilled === 1);
check(g, 'merge: lessons added to the bank', mg.binder.lessonBank.length === 1 && mg.report.lessonsAdded === 1);
const mg2 = B.mergeSchoolFile(mg.binder, B.parseSchoolFile(sf.json));
check(g, 'merge: importing the same file twice changes nothing', JSON.stringify(mg2.binder) === JSON.stringify(mg.binder) && mg2.report.filled.length === 0 && mg2.report.lessonsAdded === 0 && mg2.report.contactsAdded === 0);
check(g, 'merge: periods and student data untouched', JSON.stringify(B.mergeSchoolFile(FIX, B.parseSchoolFile(sf.json)).binder.classes) === JSON.stringify(B.normalizeBinder(FIX).classes));
check(g, 'bell schedule prints on the schedule page', /School bell schedule/.test(B.renderPackHTML(B.buildPack(mg.binder)).split('sheet schedule')[1].split('</section>')[0]));
check(g, 'lesson bank capped at 30', B.normalizeBinder({ lessonBank: Array.from({ length: 50 }, (_, i) => ({ title: 'L' + i, plan: 'p' + i })), classes: [] }).lessonBank.length === 30);
check(g, 'school file behind the same gate as the binder (lives on binder.html only)', /id="schoolSection"/.test(fs.readFileSync(path.join(root, 'binder.html'), 'utf8')) && !/schoolFile|schoolExport/.test(fs.readFileSync(path.join(root, 'index.html'), 'utf8')));

// ---------- paper pass-the-page story activity (brand-free) ----------
g = 'story activity';
const ST = clone(FIX); Object.assign(ST.classes[0], { storyOn: 'yes', storyPrompt: '', storyMinutes: '4' });
const stRe = B.importJSON(B.exportJSON(ST));
check(g, 'saved: export -> import keeps the story settings', stRe.classes[0].storyOn === 'yes' && stRe.classes[0].storyMinutes === '4');
check(g, 'minutes per turn: junk cleared', B.normalizeBinder({ classes: [{ storyMinutes: '99' }, { storyMinutes: 'abc' }, { storyMinutes: '0' }] }).classes.every(c => c.storyMinutes === ''));
check(g, 'storyOn only accepts yes', B.normalizeBinder({ classes: [{ storyOn: 'maybe' }] }).classes[0].storyOn === '');
const stHtml = B.renderPackHTML(B.buildPack(ST, { mode: 'emergency' }));
const stSheets = (stHtml.match(/<section class="sheet/g) || []).length;
check(g, 'adds two sheets (sub instructions + story page) only for that period', stSheets === 7 + 2, String(stSheets));
check(g, 'story sheets follow their period', /Period 3 - Math 7<\/h2>[\s\S]*?<\/section><section class="sheet story">[\s\S]*?<section class="sheet story-page">/.test(stHtml));
check(g, 'groups, timed turns and pass-the-page steps', /groups of 3 or 4/i.test(stHtml) && /Every 4 minutes, say \u201cPass the page.\u201d/.test(stHtml) && /Write the ending/.test(stHtml));
check(g, 'timing guide uses the minutes per turn', /8 turns \u00d7 4 min = about 32 min/.test(stHtml));
check(g, 'blank starter uses a ready-made one', B.STORY_STARTERS.some(x => stHtml.indexOf(x) > -1));
const ST2 = clone(ST); ST2.classes[0].storyPrompt = 'The <b>lights</b> went out.';
check(g, 'teacher\u2019s own starter printed (escaped)', /The &lt;b&gt;lights&lt;\/b&gt; went out\./.test(B.renderPackHTML(B.buildPack(ST2))));
const storyPart = stHtml.split('<section class="sheet story">')[1].split('<section class="sheet daynote')[0];
check(g, 'paper only: no devices, accounts, links or QR', /no devices or accounts/.test(stHtml) && !/<a |<svg|http/.test(storyPart));
check(g, 'brand-free: no other brand on the story sheets', !/scripto|rerum/i.test(stHtml));
check(g, 'reminds students not to use classmates\u2019 real names', /classmates\u2019 real names/.test(stHtml));
check(g, 'story page has 8 turn boxes', (stHtml.match(/class="turn"/g) || []).length === 8);
check(g, 'off by default: base pack unchanged', !/sheet story/.test(B.renderPackHTML(B.buildPack(FIX))));
fs.writeFileSync(path.join(outDir, 'pack-story.html'), '<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="../../styles.css"><body class="binder-page"><main class="wrap">' + stHtml + '</main>');
const ALL = Object.assign(clone(QW), { noteEmail: 'ms.rivera@lincoln.example.org', bells: 'P1 8:00-8:50' }); ALL.classes[0].chart = CH.classes[0].chart; Object.assign(ALL.classes[0], { storyOn: 'yes' });
fs.writeFileSync(path.join(outDir, 'pack-all.html'), '<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="../../styles.css"><body class="binder-page"><main class="wrap">' + B.renderPackHTML(B.buildPack(ALL)) + '</main>');

// ---------- pages: honesty & privacy ----------
g = 'pages';
const files = ['index.html', 'binder.html', 'compare.html', 'js/app.js', 'js/core.js', 'js/binder.js', 'js/binder-core.js', 'js/config.js', 'js/vendor/qrcode.js', 'styles.css', 'README.md'];
const all = files.map(f => fs.readFileSync(path.join(root, f), 'utf8')).join('\n');
check(g, 'no Rerum or Rerum product names in site files', !/rerum|\bscripto|phenomenon|preacheritage|\bbless\b|nail salon|fed tzuu/i.test(all));
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
