// Design, readability and honesty checks for the frosted-glass look: node tests/run-design-tests.js
'use strict';
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
let pass = 0, fail = 0; const rows = [];
function check(g, name, cond, detail) { rows.push([g, name, !!cond, detail || '']); if (cond) pass++; else { fail++; console.log('FAIL', g, '-', name, detail || ''); } }
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const css = read('styles.css');
const pages = ['index.html', 'binder.html', 'compare.html'];
const html = Object.fromEntries(pages.map(p => [p, read(p)]));

// ---------- colour contrast (WCAG 2.1) ----------
function hex(h) { h = h.replace('#', ''); if (h.length === 3) h = h.split('').map(x => x + x).join(''); return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)); }
function lum(rgb) { const a = rgb.map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2]; }
function ratio(a, b) { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }
function over(fg, alpha, bg) { return fg.map((v, i) => Math.round(v * alpha + bg[i] * (1 - alpha))); }
const v = {}; (css.match(/--[\w-]+:[^;]+;/g) || []).forEach(d => { const m = /^(--[\w-]+):\s*([^;]+);/.exec(d); if (m && !(m[1] in v)) v[m[1]] = m[2].trim(); });
const glassA = parseFloat(/rgba\(255,255,255,([\d.]+)\)/.exec(v['--glass'])[1]);
// The page backdrop: every gradient stop colour plus the base, i.e. the worst case under any panel.
const stops = (css.split('body::before')[1].split('}')[0].match(/#[0-9a-f]{6}/gi) || []).map(hex);
check('contrast', 'backdrop gradient found (' + stops.length + ' colours)', stops.length >= 5);
const panels = stops.map(s => over([255, 255, 255], glassA, s));
const text = { ink: hex(v['--ink']), muted: hex(v['--muted']), link: hex(v['--link']), 'accent-d': hex(v['--accent-d']) };
Object.keys(text).forEach(k => {
  const onPanel = Math.min.apply(null, panels.map(p => ratio(text[k], p)));
  const onPage = Math.min.apply(null, stops.map(p => ratio(text[k], p)));
  check('contrast', k + ' text on glass panels >= 4.5:1 (worst ' + onPanel.toFixed(2) + ')', onPanel >= 4.5);
  check('contrast', k + ' text straight on the page backdrop >= 4.5:1 (worst ' + onPage.toFixed(2) + ')', onPage >= 4.5);
});
check('contrast', 'button text: white on accent >= 4.5:1 (' + ratio([255, 255, 255], hex(v['--accent'])).toFixed(2) + ')', ratio([255, 255, 255], hex(v['--accent'])) >= 4.5);
check('contrast', 'button hover: white on accent-d >= 4.5:1', ratio([255, 255, 255], hex(v['--accent-d'])) >= 4.5);
check('contrast', 'badge: green on green-bg >= 4.5:1 (' + ratio(hex(v['--green']), hex(v['--green-bg'])).toFixed(2) + ')', ratio(hex(v['--green']), hex(v['--green-bg'])) >= 4.5);
check('contrast', '"Not provided": ph on ph-bg >= 4.5:1 (' + ratio(hex(v['--ph']), hex(v['--ph-bg'])).toFixed(2) + ')', ratio(hex(v['--ph']), hex(v['--ph-bg'])) >= 4.5);
check('contrast', 'disabled button text >= 4.5:1', ratio(hex('#4a4a50'), hex('#e2e3e8')) >= 4.5);

// ---------- glass, fallbacks, motion ----------
check('glass', 'translucent panels with backdrop-filter blur + saturate (and -webkit-)', /--blur:blur\(\d+px\) saturate\(\d+%\)/.test(css) && /-webkit-backdrop-filter:var\(--blur\);backdrop-filter:var\(--blur\)/.test(css));
check('glass', 'solid fallback when backdrop-filter is unsupported', /@supports not \(\(-webkit-backdrop-filter:blur\(1px\)\) or \(backdrop-filter:blur\(1px\)\)\)\{[^@]*background:#fff/.test(css));
check('glass', 'solid fallback for prefers-reduced-transparency', /@media \(prefers-reduced-transparency:reduce\)\{[^@]*backdrop-filter:none/.test(css));
check('glass', 'prefers-reduced-motion turns transitions off', /@media \(prefers-reduced-motion:reduce\)\{[^@]*transition:none !important/.test(css));
check('glass', 'system font stack (SF first), no web fonts', /--font:-apple-system,BlinkMacSystemFont,"SF Pro Text"/.test(css) && !/@font-face|@import/.test(css));
check('glass', 'soft layered gradients behind everything', (css.split('body::before')[1].split('}')[0].match(/radial-gradient/g) || []).length >= 3);
check('glass', 'rounded corners and subtle highlight', /--radius:2\dpx/.test(css) && /--hi:inset 0 1px 0/.test(css));
check('glass', 'mobile layout rules present', /@media \(max-width:720px\)/.test(css));
const pblock = css.slice(css.lastIndexOf('@media print'));
check('print', 'print is plain: no blur, shadows or gradient backdrop', /backdrop-filter:none !important/.test(pblock) && /box-shadow:none !important/.test(pblock) && /body::before\{display:none !important\}/.test(pblock));
check('print', 'print is black on white', /html,body\{background:#fff !important;color:#000 !important\}/.test(pblock) && /\.pack \.sheet\{[^}]*background:#fff/.test(pblock));
check('print', 'the What\u2019s new box never prints', /\.whatsnew\{display:none|,\.whatsnew\{display:none/.test(pblock) || /\.privacy,\.whatsnew\{display:none !important\}/.test(pblock));

// ---------- fast: nothing from outside ----------
const allHtml = pages.map(p => html[p]).join('\n');
check('fast', 'no outside stylesheets, scripts, fonts or CDNs', !/<(link|script)[^>]+(href|src)="(https?:)?\/\//i.test(allHtml) && !/url\(\s*['"]?(https?:)?\/\//i.test(css));
check('fast', 'each page has a viewport meta and theme colour', pages.every(p => /name="viewport"/.test(html[p]) && /name="theme-color"/.test(html[p])));
check('fast', 'stylesheet stays small (< 40 KB)', css.length < 40000, String(css.length));

// ---------- honest "actively being built" note ----------
const lead = 'Sub-Ready is actively being built &mdash; new features land regularly.';
check('whats new', 'landing page says it is actively being built', html['index.html'].indexOf(lead) > -1);
check('whats new', 'the app (binder) says it too', html['binder.html'].indexOf(lead) > -1);
check('whats new', 'the one-day tool links to what\u2019s new', /building-note[^>]*>Sub-Ready is actively being built/.test(html['index.html']));
['index.html', 'binder.html'].forEach(p => {
  const box = html[p].split('class="whatsnew"')[1].split('</aside>')[0];
  const items = box.match(/<li>/g) || [];
  check('whats new', p + ': lists real recent additions (' + items.length + ')', items.length >= 5 && /end-of-day note/.test(box) && /[Ss]eating chart/.test(box) && /school file/.test(box) && /[Pp]ass-the-page/.test(box));
  check('whats new', p + ': no dates, user counts or testimonials', !/\b(19|20)\d\d\b|\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.? \d|\d+\s*(teachers|users|schools)\b|testimonial|loved by|trusted by|\u201d\s*\u2014/i.test(box));
});
check('whats new', 'pricing shown honestly: both plans configured, $5 and $49', /TEACHER_PLAN_ID: 'P-/.test(read('js/config.js')) && /BUILDING_PLAN_ID: 'P-/.test(read('js/config.js')) && /\$5\/month/.test(html['index.html']) && /\$49\/month/.test(html['index.html']));
check('whats new', 'no fake urgency anywhere', !/limited time|only \d+ left|hurry|act now|spots left/i.test(allHtml));

let md = '# Design test results\n\nCommand: `node tests/run-design-tests.js`  \n**' + pass + ' passed, ' + fail + ' failed**\n\n| Group | Check | Result |\n|---|---|---|\n';
rows.forEach(r => { md += '| ' + r[0] + ' | ' + r[1].replace(/\|/g, '/') + ' | ' + (r[2] ? 'PASS' : '**FAIL**') + ' |\n'; });
fs.writeFileSync(path.join(__dirname, 'DESIGN-RESULTS.md'), md);
console.log(pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
