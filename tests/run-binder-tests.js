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


// ---------- optional writing activity (Scripto), behind SCRIPTO_ACTIVITY ----------
g = 'writing activity';
const S = require('../js/scripto.js');
const sbx2 = { window: {} }; vm.runInNewContext(fs.readFileSync(path.join(root, 'js/config.js'), 'utf8'), sbx2);
check(g, 'shipped config: SCRIPTO_ACTIVITY is off', sbx2.window.SUB_READY_CONFIG.SCRIPTO_ACTIVITY === false);
const TOK = 'h7Kq2xW9pL';
const GOOD = 'https://scriptorerum.com/school/s/' + TOK;
const WANT = 'https://www.scriptorerum.com/school/s/' + TOK + '?ref=subready';
check(g, 'label is "Student writing activity (Scripto)"', S.COPY.label === 'Student writing activity (Scripto)');
check(g, 'www session link accepted as-is', S.validateLink('https://www.scriptorerum.com/school/s/' + TOK).url === WANT);
check(g, 'bare-domain link accepted and normalized to the www form', S.validateLink(GOOD).url === WANT && /^https:\/\/www\./.test(S.validateLink(GOOD).url));
check(g, 'valid session link accepted, ?ref=subready added', S.validateLink(GOOD).ok && S.validateLink(GOOD).url === WANT);
check(g, 'surrounding spaces and trailing slash tolerated', S.validateLink('  ' + GOOD + '/ ').url === WANT);
[['http://scriptorerum.com/school/s/' + TOK, 'http'], ['https://WWW.scriptorerum.com/school/s/' + TOK, 'upper-case host'], ['https://m.scriptorerum.com/school/s/' + TOK, 'other subdomain'], ['https://www.scriptorerum.com.evil.example/school/s/' + TOK, 'www look-alike'], ['https://wwwscriptorerum.com/school/s/' + TOK, 'wwwscriptorerum'], ['https://scriptorerum.com.evil.example/school/s/' + TOK, 'look-alike host'],
 ['https://evil.example/?u=https://scriptorerum.com/school/s/' + TOK, 'prefix not at start'], ['https://scriptorerum.com/join/' + TOK, '/join link'], ['https://scriptorerum.com/school/try', '/try demo'],
 ['https://scriptorerum.com/school/s/', 'no token'], ['https://scriptorerum.com/school/s/abc', 'token too short'], ['https://scriptorerum.com/school/s/ab cd ef gh', 'spaces'],
 ['https://scriptorerum.com/school/s/' + TOK + '/../../x', 'path tricks'], ['javascript:alert(1)//https://scriptorerum.com/school/s/' + TOK, 'javascript:'], ['https://scriptorerum.com/school/s/%3Cscript%3E', 'encoded junk']
].forEach(([u, why]) => check(g, 'rejected: ' + why, !S.validateLink(u).ok && S.validateLink(u).error, u));
check(g, 'empty link is just "not set", no error', S.validateLink('').empty && !S.validateLink('').error);
const withQ = S.validateLink(GOOD + '?student=Maya&room=214#Jaylen');
check(g, 'query and fragment are dropped (only the token is kept)', withQ.ok && withQ.url === WANT, withQ.url);
check(g, 'token that spells a student name is refused', !S.validateLink('https://scriptorerum.com/school/s/jaylen-p3-math', { students: FIX.students }).ok);

const W1 = clone(FIX);
Object.assign(W1.classes[0], { writingLink: GOOD + '?name=Maya%20L.', writingTime: 'Last 20 minutes', writingNotes: 'Groups are already set in the session.' });
const wRe = B.importJSON(B.exportJSON(W1));
check(g, 'fields saved: export -> import keeps link, time slot and notes', wRe.classes[0].writingLink === W1.classes[0].writingLink && wRe.classes[0].writingTime === 'Last 20 minutes' && /Groups/.test(wRe.classes[0].writingNotes));
const wst = memStore(); B.save(wst, W1);
check(g, 'fields saved: save -> reload keeps them', B.load(wst).classes[0].writingNotes === W1.classes[0].writingNotes);
check(g, 'not part of the gap check (optional)', B.readiness(W1).length === 0 && !B.readiness(B.emptyBinder()).some(i => /writing|story/i.test(i.field)));

const offHtml = B.renderPackHTML(B.buildPack(W1, { mode: 'emergency' }));
check(g, 'flag off: saved link never prints', !/scripto|writing-activity|<svg/i.test(offHtml));
const onModel = B.buildPack(W1, { mode: 'emergency', writing: { module: S } });
const onHtml = B.renderPackHTML(onModel, { writingModule: S });
const blocks = onHtml.match(/<div class="pk-row writing-activity"[\s\S]*?<p class="wa-privacy">[^<]*<\/p><\/div>/g) || [];
check(g, 'flag on: print block appears once, on that period\u2019s sheet', blocks.length === 1 && /sheet period[^]*?Period 3 - Math 7[^]*?writing-activity/.test(onHtml.split('sheet emergency')[0]) && !/writing-activity/.test(onHtml.split('Period 1 - Math 6</h2>')[1].split('</section>')[0]));
const bl = blocks[0] || '';
check(g, 'print block: title', /<h4>Student writing activity \(Scripto\)<\/h4>/.test(bl));
const steps = (bl.match(/<li>([^<]*)<\/li>/g) || []).map(x => x.replace(/<\/?li>/g, ''));
check(g, 'print block: the three numbered steps from spec 4.3', steps.length === 3 && steps[0] === 'Open this link on the teacher computer.' && steps[1] === 'Press Start.' && steps[2] === 'Put the code on the board. Students go to scriptorerum.com/join.', JSON.stringify(steps));
check(g, 'print block: link as text', bl.indexOf('>' + WANT + '</a>') > -1);
check(g, 'print block: opens in a new tab with rel=noopener', /<a href="[^"]+" target="_blank" rel="noopener[^"]*">/.test(bl));
check(g, 'print block: QR code drawn locally as inline SVG', /<svg class="qr"[^>]*>[\s\S]*<path d="M/.test(bl) && !/<img|src=/.test(bl));
check(g, 'print block: QR encodes exactly the cleaned link (deterministic redraw matches)', bl.indexOf(S.qrSVG(WANT)) > -1);
check(g, 'print block: privacy line word for word', bl.indexOf('Sub-Ready itself still uploads nothing. If you add a Scripto writing activity, that part runs on scriptorerum.com under Scripto&#39;s School privacy terms.') > -1 || bl.indexOf('Sub-Ready itself still uploads nothing. If you add a Scripto writing activity, that part runs on scriptorerum.com under Scripto\u2019s School privacy terms.') > -1);
check(g, 'print block: time slot and notes for the sub', /Time slot:<\/strong> Last 20 minutes/.test(bl) && /Notes for the sub:<\/strong> Groups are already set/.test(bl));

// Privacy: nothing from the binder ever reaches the link or the QR code.
const urls = (onHtml.match(/(?:href|data-url)="([^"]*scriptorerum[^"]*)"/g) || []).map(x => x.replace(/^[^"]*"|"$/g, '').replace(/&amp;/g, '&'));
const secrets = C.parseNameList(FIX.students).concat(['Rivera', '214', 'Lincoln', 'Maya', 'Jaylen', 'Door 6', 'ext 210', 'EpiPen', 'Math']);
check(g, 'privacy: every link in the pack is exactly prefix + token + ?ref=subready', urls.length === 2 && urls.every(u => u === WANT), urls.join(' '));
check(g, 'privacy: no student name, roster or binder text in any link', urls.every(u => secrets.every(x => u.toLowerCase().indexOf(String(x).toLowerCase()) < 0)));
check(g, 'privacy: a name pasted into the link\u2019s query is stripped', W1.classes[0].writingLink.indexOf('Maya') > -1 && urls.every(u => !/maya/i.test(u)));
const fakeQR = []; const S2 = Object.assign({}, S, { renderBlock: (a, o) => { const v = S.validateLink(a.link, o); fakeQR.push(v.url); return S.renderBlock(a, o); } });
B.renderPackHTML(B.buildPack(W1, { mode: 'day', periods: ['p3', 'p1', 'p5'], writing: { module: S2 } }), { writingModule: S2 });
check(g, 'privacy: the only text handed to the QR/link builder is the cleaned link', fakeQR.length === 1 && fakeQR[0] === WANT);

const dayW = B.buildPack(W1, { mode: 'day', periods: ['p3', 'p1'], writing: { module: S, today: { p1: { link: 'https://scriptorerum.com/school/s/TodayOnly42', time: '8:30', notes: 'Use the projector.' } } } });
const dayWHtml = B.renderPackHTML(dayW, { writingModule: S });
check(g, 'day-plan field: today\u2019s link prints for that period', /TodayOnly42\?ref=subready/.test(dayWHtml) && /Use the projector/.test(dayWHtml));
check(g, 'day-plan field: saved binder link still prints for the other period', dayWHtml.indexOf(WANT) > -1);
const badW = clone(W1); badW.classes[1].writingLink = 'https://example.com/school/s/abcdef123';
const badM = B.buildPack(badW, { mode: 'emergency', writing: { module: S } });
check(g, 'invalid link: left out of the print and reported before printing', badM.writingErrors.length === 1 && /Period 1/.test(badM.writingErrors[0]) && !/example\.com/.test(B.renderPackHTML(badM, { writingModule: S })));
const xw = clone(W1); xw.classes[0].writingNotes = '<img src=x onerror=alert(1)>'; xw.classes[0].writingTime = '<script>x</script>';
const xwh = B.renderPackHTML(B.buildPack(xw, { writing: { module: S } }), { writingModule: S });
check(g, 'notes and time slot are escaped', !/<img src=x|<script>x/.test(xwh) && /&lt;img/.test(xwh));
const copyAll = JSON.stringify(S.COPY) + bl;
check(g, 'brand: never called a "game"', !/\bgames?\b|in-game|gameplay/i.test(copyAll + fs.readFileSync(path.join(root, 'js/scripto.js'), 'utf8')));
check(g, 'brand: no prices or upsells in the writing activity copy', !/\$\s?\d|price|upgrade|buy|subscribe|premium|\bpro\b/i.test(copyAll));
check(g, 'card copy from spec 4.3, linking out to scriptorerum.com/school', S.COPY.card === 'Add a student writing activity: Scripto writing sessions run from your sub plan. Prepare one at scriptorerum.com/school.' && S.COPY.cardUrl === 'https://scriptorerum.com/school');
fs.writeFileSync(path.join(outDir, 'pack-writing.html'), '<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="../../styles.css"><body class="binder-page"><main class="wrap">' + dayWHtml + '</main>');

// ---------- paper pass-the-page story activity (brand-free) ----------
g = 'story activity';
const ST = clone(FIX); Object.assign(ST.classes[0], { storyOn: 'yes', storyPrompt: '', storyMinutes: '4' });
const stRe = B.importJSON(B.exportJSON(ST));
check(g, 'saved: export -> import keeps the story settings', stRe.classes[0].storyOn === 'yes' && stRe.classes[0].storyMinutes === '4');
check(g, 'minutes per turn: junk cleared', B.normalizeBinder({ classes: [{ storyMinutes: '99' }, { storyMinutes: 'abc' }, { storyMinutes: '0' }] }).classes.every(c => c.storyMinutes === ''));
check(g, 'storyOn only accepts yes', B.normalizeBinder({ classes: [{ storyOn: 'maybe' }] }).classes[0].storyOn === '');
const stHtml = B.renderPackHTML(B.buildPack(ST, { mode: 'emergency' }));
const stSheets = (stHtml.match(/<section class="sheet/g) || []).length;
check(g, 'adds two sheets (sub instructions + story page) only for that period', stSheets === 6 + 2, String(stSheets));
check(g, 'story sheets follow their period', /Period 3 - Math 7<\/h2>[\s\S]*?<\/section><section class="sheet story">[\s\S]*?<section class="sheet story-page">/.test(stHtml));
check(g, 'groups, timed turns and pass-the-page steps', /groups of 3 or 4/i.test(stHtml) && /Every 4 minutes, say \u201cPass the page.\u201d/.test(stHtml) && /Write the ending/.test(stHtml));
check(g, 'timing guide uses the minutes per turn', /8 turns \u00d7 4 min = about 32 min/.test(stHtml));
check(g, 'blank starter uses a ready-made one', B.STORY_STARTERS.some(x => stHtml.indexOf(x) > -1));
const ST2 = clone(ST); ST2.classes[0].storyPrompt = 'The <b>lights</b> went out.';
check(g, 'teacher\u2019s own starter printed (escaped)', /The &lt;b&gt;lights&lt;\/b&gt; went out\./.test(B.renderPackHTML(B.buildPack(ST2))));
check(g, 'paper only: no devices, accounts, links or QR', /no devices or accounts/.test(stHtml) && !/<a |<svg|http/.test(stHtml.split('sheet story')[1]));
check(g, 'brand-free: no Scripto or other brand on the story sheets', !/scripto|rerum/i.test(stHtml));
check(g, 'reminds students not to use classmates\u2019 real names', /classmates\u2019 real names/.test(stHtml));
check(g, 'story page has 8 turn boxes', (stHtml.match(/class="turn"/g) || []).length === 8);
check(g, 'off by default: base pack unchanged', !/sheet story/.test(B.renderPackHTML(B.buildPack(FIX))));
fs.writeFileSync(path.join(outDir, 'pack-story.html'), '<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="../../styles.css"><body class="binder-page"><main class="wrap">' + stHtml + '</main>');

// ---------- pages: honesty & privacy ----------
g = 'pages';
const files = ['index.html', 'binder.html', 'compare.html', 'js/app.js', 'js/core.js', 'js/binder.js', 'js/binder-core.js', 'js/config.js', 'js/scripto.js', 'styles.css', 'README.md'];
const all = files.map(f => fs.readFileSync(path.join(root, f), 'utf8')).join('\n');
check(g, 'no other Rerum brand names anywhere in site files', !/phenomenon|preacheritage|\bbless\b|nail salon|fed tzuu|rerum solutions/i.test(all + fs.readFileSync(path.join(root, 'js/scripto.js'), 'utf8')));
// Scripto is the single approved exception, and it is fenced into the optional module + its wiring.
const SCRIPTO_OK = ['js/scripto.js', 'js/config.js', 'js/binder.js', 'binder.html', 'README.md'];
const leaky = files.filter(f => SCRIPTO_OK.indexOf(f) < 0 && /scripto|rerum/i.test(fs.readFileSync(path.join(root, f), 'utf8')));
check(g, 'Scripto named only in the optional module and its wiring', !leaky.length, leaky.join(', '));
check(g, 'landing, compare, one-day tool, core and pack code are Scripto-free', !/scripto|rerum/i.test(['index.html', 'compare.html', 'js/app.js', 'js/core.js', 'js/binder-core.js', 'styles.css'].map(f => fs.readFileSync(path.join(root, f), 'utf8')).join('\n')));
check(g, 'no analytics or tracking scripts', !/google-analytics|gtag\(|googletagmanager|plausible|mixpanel|segment\.com|hotjar|clarity\.ms/i.test(all));
const binderJs = fs.readFileSync(path.join(root, 'js/binder.js'), 'utf8') + fs.readFileSync(path.join(root, 'js/binder-core.js'), 'utf8');
check(g, 'binder code makes no network calls', !/fetch\(|XMLHttpRequest|sendBeacon|WebSocket|navigator\.sendBeacon/.test(binderJs));
const wsJs = fs.readFileSync(path.join(root, 'js/scripto.js'), 'utf8') + fs.readFileSync(path.join(root, 'js/vendor/qrcode.js'), 'utf8');
check(g, 'writing-session module and QR library make no network calls', !/fetch\(|XMLHttpRequest|sendBeacon|WebSocket|EventSource|import\(/.test(wsJs));
check(g, 'no iframe or embed anywhere', !/<iframe|<embed|<object|createElement\(['"]iframe/i.test(all + wsJs));
check(g, 'QR library is the MIT one, license kept', /Licensed under the MIT license/.test(wsJs) && fs.existsSync(path.join(root, 'js/vendor/LICENSE-qrcode-generator.txt')));
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
