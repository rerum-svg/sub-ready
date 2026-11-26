// Sub-Ready test harness: node tests/run-tests.js
// Runs the full pipeline on 5 messy samples with canned AI replies, plus edge cases.
// Writes tests/RESULTS.md and tests/out/*.html (rendered scripts).
'use strict';
const fs = require('fs');
const path = require('path');
const C = require('../js/core.js');
const samples = require('./samples.js');

const results = []; let pass = 0, fail = 0;
function check(group, name, cond, detail) {
  results.push({ group, name, ok: !!cond, detail: detail || '' });
  if (cond) pass++; else { fail++; console.log('FAIL', group, '-', name, detail || ''); }
}
const outDir = path.join(__dirname, 'out'); fs.mkdirSync(outDir, { recursive: true });

function pipeline(s) {
  const names = C.parseNameList(s.names).concat(C.detectRosterNames(s.roster));
  const nameMap = C.buildNameMap(names);
  const mask = (t) => C.maskNames(t, nameMap).text;
  const mInfo = {}; Object.keys(s.info).forEach(k => mInfo[k] = mask(s.info[k]));
  const mPlan = mask(s.plan);
  const lint = C.lintPlan(mPlan, mInfo);
  const gapPrompt = C.buildGapPrompt(mPlan, mInfo);
  let gapsObj, gapErr = null;
  try { gapsObj = C.normalizeGaps(C.extractJSON(s.gapReply)); } catch (e) { gapErr = e; gapsObj = { flags: [], questions: [] }; }
  const questions = C.finalizeQuestions(gapsObj.questions, lint.questions, 5, 8);
  const qa = questions.map((q, i) => ({ question: q.question, section: q.section, answer: mask(s.answers[i] || '') }));
  const scriptPrompt = C.buildScriptPrompt(mPlan, mInfo, qa);
  const raw = C.extractJSON(s.scriptReply);
  const model = C.unmaskDeep(C.normalizeScript(raw, { plan: mPlan, classInfo: mInfo, qa }), nameMap);
  const html = C.renderScriptHTML(model, { date: 'Test day' });
  const basic = C.unmaskDeep(C.normalizeScript(C.scriptWithoutAI(mPlan, mInfo, qa), { plan: mPlan, classInfo: mInfo, qa }), nameMap);
  const basicHtml = C.renderScriptHTML(basic, {});
  return { names, nameMap, mPlan, mInfo, lint, gapPrompt, gapsObj, gapErr, questions, qa, scriptPrompt, model, html, basic, basicHtml };
}

// ---------------- 5 samples ----------------
const sampleSummaries = [];
samples.forEach(s => {
  const g = s.id;
  let r;
  try { r = pipeline(s); } catch (e) { check(g, 'pipeline runs without throwing', false, e.stack); return; }
  check(g, 'pipeline runs without throwing', true);
  // Privacy: no raw student name may reach either prompt.
  const leaks = s.expect.names.filter(n => {
    const re = new RegExp('(^|[^A-Za-z])' + n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?![A-Za-z])');
    return re.test(r.gapPrompt) || re.test(r.scriptPrompt);
  });
  check(g, 'no student names in AI prompts', leaks.length === 0, leaks.join(', '));
  check(g, 'all expected names detected/listed', s.expect.names.every(n => r.names.map(x => x.toLowerCase()).includes(n.toLowerCase())), r.names.join(', '));
  check(g, 'gap reply parsed (or partial reply recovered)', !r.gapErr, r.gapErr && r.gapErr.message);
  check(g, '5-8 questions produced', r.questions.length >= 5 && r.questions.length <= 8, String(r.questions.length));
  check(g, 'lint flagged at least one gap on its own', r.lint.flags.length + r.lint.questions.length > 0);
  check(g, 'schedule has expected blocks', r.model.schedule.length >= s.expect.minBlocks, String(r.model.schedule.length));
  const text = r.html.replace(/<[^>]+>/g, ' ').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&');
  s.expect.mustContain.forEach(m => check(g, 'output contains "' + m + '"', text.includes(m)));
  (s.expect.assoc || []).forEach(a => check(g, 'right name in right place: "' + a + '"', text.replace(/\s+/g, ' ').includes(a)));
  check(g, 'no [STUDENT_n] tokens left in output', !/STUDENT[\s_-]?\d/i.test(text));
  check(g, 'all 6 sections rendered', ['Schedule', 'Where things are', 'Routines', 'Students who can help', 'Emergency', 'Before you leave'].every(h => r.html.includes(h)));
  const unv = (r.html.match(/class="unv"/g) || []).length;
  check(g, 'grounding check flags invented lines (>= ' + s.expect.unverifiedMin + ')', unv >= s.expect.unverifiedMin, String(unv));
  const timed = r.model.schedule.filter(b => b.start != null).map(b => b.start);
  check(g, 'timed blocks are in chronological order', timed.every((t, i) => i === 0 || t >= timed[i - 1]));
  if (s.expect.bellFill) check(g, 'missing times filled from bell schedule', r.model.schedule.some(b => b.timeSource === 'bell schedule'));
  if (s.expect.sortedFirst) check(g, 'out-of-order blocks re-sorted', r.model.schedule[0].block === s.expect.sortedFirst, r.model.schedule[0].block);
  if (s.expect.warnEndBefore) check(g, 'end-before-start detected', r.model.warnings.some(w => /end time is before/.test(w)));
  check(g, 'no-AI basic fallback also renders', r.basicHtml.includes('Schedule') && !/STUDENT[\s_-]?\d/i.test(r.basicHtml.replace(/<[^>]+>/g, ' ')));
  fs.writeFileSync(path.join(outDir, g + '.html'), page(s.name, r.html));
  fs.writeFileSync(path.join(outDir, g + '-basic.html'), page(s.name + ' (no-AI version)', r.basicHtml));
  sampleSummaries.push({
    id: g, name: s.name, names: r.names, questions: r.questions.map(q => (q.source === 'ai' ? '[AI] ' : '[checklist] ') + C.unmaskNames(q.question, r.nameMap)),
    lintFlags: r.lint.flags.map(f => f.issue), blocks: r.model.schedule.map(b => (b.start != null ? C.fmtTime(b.start) + (b.end != null ? '–' + C.fmtTime(b.end) : '') + (b.timeSource === 'bell schedule' ? ' (bell)' : '') : '[no time]') + ' ' + b.block),
    warnings: r.model.warnings, missing: r.model.missing, unverified: unv
  });
});

// ---------------- edge cases ----------------
const E = 'edge';
check(E, 'empty input rejected', !!C.validateInput(''));
check(E, 'whitespace-only input rejected', !!C.validateInput('   \n\t  '));
check(E, 'too-short input rejected', !!C.validateInput('p2 ws'));
check(E, 'huge input rejected', !!C.validateInput('x'.repeat(13000)));
check(E, 'normal input accepted', C.validateInput('8:15 morning work then reading groups') === null);
check(E, 'lint on empty plan does not crash', Array.isArray(C.lintPlan('', {}).flags));
function throws(fn) { try { fn(); return false; } catch (e) { return e.message; } }
check(E, 'empty AI reply -> friendly error', /empty/i.test(throws(() => C.extractJSON('')) || ''));
check(E, 'prose-only AI reply -> friendly error', /JSON/.test(throws(() => C.extractJSON('Sorry, I cannot help with that.')) || ''));
check(E, 'garbage AI reply -> friendly error', !!throws(() => C.extractJSON('```json\n{{{ not json ]]\n```')));
const variants = {
  'trailing commas': '{"flags":[],"questions":[{"question":"Where is the bin?","section":"where"},],}',
  'smart quotes': '{\u201cflags\u201d:[],\u201cquestions\u201d:[{\u201cquestion\u201d:\u201cWhere is the bin?\u201d,\u201csection\u201d:\u201cwhere\u201d}]}',
  'unquoted keys + single quotes': "{flags: [], questions: [{question: 'Where is the bin?', section: 'where'}]}",
  'prose before and after fence': 'Here you go!\n```json\n{"flags":[],"questions":[{"question":"Where is the bin?","section":"where"}]}\n```\nHope that helps.',
  'unterminated fence': '```json\n{"flags":[],"questions":[{"question":"Where is the bin?","section":"where"}]}',
  'truncated mid-array': '```json\n{"flags":[],"questions":[{"question":"Where is the bin?","section":"where"},{"question":"Wha',
  'comments inside': '{\n// gaps\n"flags":[],"questions":[{"question":"Where is the bin?","section":"where"}]}',
  'Python-style None/True': '{"flags":None,"questions":[{"question":"Where is the bin?","section":"where","ok":True}]}'
};
Object.keys(variants).forEach(k => {
  let ok = false, d = '';
  try { const g = C.normalizeGaps(C.extractJSON(variants[k])); ok = g.questions.length >= 1 && /bin/.test(g.questions[0].question); } catch (e) { d = e.message; }
  check(E, 'malformed JSON recovered: ' + k, ok, d);
});
// Wrong shapes from the model
const odd = C.normalizeScript({ schedule: ['Morning work', { title: 'Math', instructions: 'pg 5' }], routines: 'Clap twice', emergency: null, where_things_are: ['Bin: under window'] }, { plan: 'morning work math pg 5 clap twice bin under window', classInfo: {}, qa: [] });
check(E, 'string/odd-shaped fields normalized', odd.schedule.length === 2 && odd.routines[0].text === 'Clap twice' && odd.where[0].location === 'under window');
check(E, 'empty sections become visible placeholders', odd.emergency[0].placeholder && odd.helpers[0].placeholder && odd.leave_done[0].placeholder);
check(E, 'untimed blocks show time placeholder', C.renderScriptHTML(odd).includes(C.TIME_PLACEHOLDER));
const emptyModel = C.normalizeScript({}, {});
check(E, 'completely empty AI object still renders', C.renderScriptHTML(emptyModel).includes('Not provided'));
// Missing periods / times
const noP = C.lintPlan('reading\nmath\nlunch\nscience', {});
check(E, 'no times + no bell schedule -> asks for times', noP.questions.some(q => /time/i.test(q.question)));
const withP = C.normalizeScript({ schedule: [{ block: 'Period 4', steps: ['Do notes'] }, { block: '6th period', steps: ['Do notes'] }, { block: 'Lunch', steps: ['Eat'] }] },
  { plan: 'do notes eat', classInfo: { periods: 'P4 10:40-11:30\nLunch 11:30-12:05\n6th period 1:10-2:00' }, qa: [] });
check(E, 'Period 4 / 6th period / Lunch matched to bell schedule', withP.schedule.every(b => b.timeSource === 'bell schedule'), withP.schedule.map(b => b.block + ':' + b.start).join(' '));
const missP = C.normalizeScript({ schedule: [{ block: 'Period 9', steps: ['Do notes'] }] }, { plan: 'do notes', classInfo: { periods: 'P4 10:40-11:30' }, qa: [] });
check(E, 'period not in bell schedule -> time placeholder, no guess', missP.schedule[0].start == null);
// Time parsing
const tp = [['8:15', 495], ['815', 495], ['8.15', 495], ['1:05', 785], ['1:05 pm', 785], ['12:40', 760], ['12:00am', 0], ['7:45 a.m.', 465], ['25:00', null], ['8:75', null], ['abc', null]];
tp.forEach(([a, b]) => check(E, 'parseTime("' + a + '") = ' + b, C.parseTime(a) === b, String(C.parseTime(a))));
check(E, '"pages 3-5" is not read as a time', C.findTimes('read pages 3-5') === null);
check(E, '"11:30-1:05" crosses noon correctly', JSON.stringify(C.findTimes('lunch 11:30-1:05')) === JSON.stringify({ start: 690, end: 785 }));
check(E, 'en-dash range "9:50–10:40"', JSON.stringify(C.findTimes('3rd 9:50–10:40')) === JSON.stringify({ start: 590, end: 640 }));
const ov = C.normalizeScript({ schedule: [{ start: '9:00', end: '9:45', block: 'A', steps: ['x a'] }, { start: '9:30', end: '10:00', block: 'B', steps: ['x b'] }] }, { plan: 'x a b', classInfo: {}, qa: [] });
check(E, 'overlapping blocks warned', ov.warnings.some(w => /overlaps/.test(w)));
const inf = C.normalizeScript({ schedule: [{ start: '9:00', block: 'A', steps: ['x'] }, { start: '9:40', block: 'B', steps: ['x'] }] }, { plan: 'x', classInfo: {}, qa: [] });
check(E, 'missing end time inferred from next block', inf.schedule[0].end === 580 && inf.schedule[0].minutes === 40);
// Names colliding with common words
const nm = C.buildNameMap(['Will', 'May', 'Art', 'Grace', 'Hunter J.', 'Reading']);
const mk = (t) => C.maskNames(t, nm).text;
check(E, '"Will you collect…" keeps the verb', mk('Will you collect the ws?') === 'Will you collect the ws?');
check(E, '"Art & Will can\'t sit together" hides both', !/\bArt\b|\bWill\b/.test(mk("Art & Will can't sit together")));
check(E, '"Art class at 1" keeps the subject', mk('Art class at 1:10') === 'Art class at 1:10');
check(E, 'lowercase "art"/"will"/"may" untouched', mk('art w/ Mrs K, they will go, may finish') === 'art w/ Mrs K, they will go, may finish');
check(E, '"May 5 assembly" keeps the month', mk('May 5 assembly') === 'May 5 assembly');
check(E, '"May sits by the door" hides the name', !/\bMay\b/.test(mk('May sits by the door')));
check(E, '"Reading groups" keeps the subject', mk('Reading groups at 9') === 'Reading groups at 9');
check(E, '"ask Grace" hides the name', !/Grace/.test(mk('ask Grace for the key')));
check(E, '"Hunter J." and bare "Hunter" both hidden', !/Hunter/.test(mk('Hunter J. helps; Hunter knows the laptop')));
check(E, 'common-word names produce a warning', C.maskNames('Will helps', nm).warnings.length > 0);
check(E, 'possessive "Will\'s group" hidden', !/Will/.test(mk("Will's group goes first")));
check(E, 'name inside another word not touched (Mayor, Willow)', mk('the Mayor visits Willow Room') === 'the Mayor visits Willow Room');
// Token restoration tolerance
check(E, 'restores [STUDENT_1], STUDENT 2, student_3, [ STUDENT_4 ]', C.unmaskNames('[STUDENT_1] STUDENT 2 student_3 [ STUDENT_4 ]', C.buildNameMap(['Aa Bb', 'Cc', 'Dd', 'Ee'])).indexOf('STUDENT') === -1);
check(E, 'unknown token number left visible (not mis-assigned)', C.unmaskNames('[STUDENT_9]', C.buildNameMap(['Ana'])) === '[STUDENT_9]');
// Duplicate first names: bare first name must not be guessed
const dup = C.buildNameMap(['Liam K.', 'Liam P.']);
check(E, 'two students named Liam: bare "Liam" not auto-assigned', C.maskNames('Liam K. and Liam P. and Liam', dup).text.endsWith('and Liam'));
// HTML escaping (XSS from pasted reply)
const x = C.renderScriptHTML(C.normalizeScript({ title: '<img src=x onerror=alert(1)>', schedule: [{ block: '<script>alert(1)</script>', steps: ['<b>hi</b>'] }] }, {}));
check(E, 'AI text is HTML-escaped (no script injection)', !/<script>|<img src=x/.test(x));
// Roster detection
const rd = C.detectRosterNames('1. Maya L. - line leader\n- Will R. (allergy)\nJaylen, Sofia M., Period 3: Noah\nSeat 4 notes\nthe kids');
check(E, 'roster detection finds names, skips non-names', ['Maya L.', 'Will R.', 'Jaylen', 'Sofia M.', 'Noah'].every(n => rd.includes(n)) && !rd.some(n => /Seat|Period|the/i.test(n)), rd.join(', '));
// Question limits
check(E, '>8 AI questions capped at 8', C.finalizeQuestions(['Where is the green bin?', 'What does DOL mean?', 'When is lunch?', 'Who walks kids to art?', 'How do stations rotate?', 'Which laptop login works?', 'What are early finishers doing?', 'Where are calculators kept?', 'Who handles recess duty?', 'Can students use notes?', 'Is attendance on paper?', 'What happens during fire drills?'].map(q => ({ question: q })), [], 5, 8).length === 8);
check(E, '0 AI questions padded to 5', C.finalizeQuestions([], [], 5, 8).length === 5);
check(E, 'duplicate questions deduped', C.finalizeQuestions([{ question: 'Where is the green bin located?' }, { question: 'Where is the green bin located exactly?' }], [], 1, 8).length === 1);

// ---------------- write results ----------------
const ts = new Date().toISOString();
let md = '# Sub-Ready test results\n\nRun: ' + ts + ' (UTC)  \nCommand: `node tests/run-tests.js`  \n**' + pass + ' passed, ' + fail + ' failed** (' + (pass + fail) + ' checks)\n\n';
md += 'Canned AI replies imitate real chatbot output: prose around fences, trailing commas, unquoted keys, single quotes, a truncated reply, altered name tokens, out-of-order and end-before-start times, and one invented line ("pizza party") that the grounding check should flag.\n\n';
md += '## Samples\n\n';
sampleSummaries.forEach(s => {
  md += '### ' + s.name + ' (`' + s.id + '`)\n\n';
  md += '- Names hidden: ' + s.names.join(', ') + '\n';
  md += '- Checklist (no-AI) flags: ' + (s.lintFlags.length ? s.lintFlags.map(f => '"' + f + '"').join('; ') : 'none') + '\n';
  md += '- Questions asked (' + s.questions.length + '):\n' + s.questions.map(q => '  - ' + q).join('\n') + '\n';
  md += '- Schedule: ' + s.blocks.join(' | ') + '\n';
  md += '- Warnings: ' + (s.warnings.length ? s.warnings.join(' / ') : 'none') + '\n';
  md += '- Missing (shown as "ask the office"): ' + (s.missing.length ? s.missing.join(' / ') : 'none') + '\n';
  md += '- Lines marked Check (not found in teacher\'s notes): ' + s.unverified + '\n';
  md += '- Rendered: `tests/out/' + s.id + '.html`, no-AI version `tests/out/' + s.id + '-basic.html`\n\n';
});
md += '## All checks\n\n| Group | Check | Result | Detail |\n|---|---|---|---|\n';
results.forEach(r => { md += '| ' + r.group + ' | ' + r.name.replace(/\|/g, '/') + ' | ' + (r.ok ? 'PASS' : '**FAIL**') + ' | ' + String(r.detail).replace(/\|/g, '/').replace(/\n/g, ' ').slice(0, 120) + ' |\n'; });
fs.writeFileSync(path.join(__dirname, 'RESULTS.md'), md);
console.log(pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);

function page(title, body) {
  return '<!doctype html><html><head><meta charset="utf-8"><title>' + C.esc(title) + '</title><link rel="stylesheet" href="../../styles.css"></head><body><main class="wrap tool">' + body + '</main></body></html>';
}
