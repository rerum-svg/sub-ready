"""Browser end-to-end check + screenshots. Usage: python3 tests/e2e_screens.py [base_url]
Starts a local static server if no URL is given. Saves PNGs to screens/."""
import json, subprocess, sys, time, os, pathlib
from playwright.sync_api import sync_playwright

root = pathlib.Path(__file__).resolve().parent.parent
screens = root / 'screens'; screens.mkdir(exist_ok=True)
samples = json.loads(subprocess.check_output(['node', '-e', "process.stdout.write(JSON.stringify(require('./tests/samples.js')))"], cwd=root))
base = sys.argv[1] if len(sys.argv) > 1 else None
prefix = sys.argv[2] if len(sys.argv) > 2 else ''
srv = None
if not base:
    srv = subprocess.Popen([sys.executable, '-m', 'http.server', '8765', '--bind', '127.0.0.1'], cwd=root, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(1); base = 'http://127.0.0.1:8765/'

report = []
def ok(name, cond, detail=''):
    report.append((name, bool(cond), detail)); print(('PASS ' if cond else 'FAIL ') + name, detail)

with sync_playwright() as p:
    b = p.chromium.launch()
    errors = []
    pg = b.new_page(viewport={'width': 1280, 'height': 900})
    pg.on('pageerror', lambda e: errors.append(str(e)))
    pg.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
    r = pg.goto(base, wait_until='networkidle')
    ok('page loads (HTTP %s)' % r.status, r.status == 200)
    pg.screenshot(path=str(screens / (prefix + 'landing-desktop.png')), full_page=False)
    pg.screenshot(path=str(screens / (prefix + 'landing-full.png')), full_page=True)
    ok('device AI status shown', pg.text_content('#deviceStatus') not in ('', 'checking…'), pg.text_content('#deviceStatus'))
    pro = pg.text_content('#proBtn')
    ok('Pro button shows coming-soon state, no link', 'coming soon' in pro.lower() and pg.get_attribute('#proBtn', 'href') is None, pro)
    # Empty input validation
    pg.click('#findGaps')
    ok('empty input shows error', pg.is_visible('#inputError'), pg.text_content('#inputError'))

    def run_sample(s, shot):
        pg.goto(base, wait_until='networkidle')
        pg.check('input[name=mode][value=copy]')
        pg.fill('#plan', s['plan'])
        for k, v in s['info'].items(): pg.fill('#' + k, v)
        pg.fill('#names', s['names']); pg.fill('#roster', s['roster'])
        if s['roster']: pg.click('#detect')
        pg.click('#findGaps')
        prompt = pg.input_value('#gapPrompt')
        leaked = [n for n in s['expect']['names'] if n in prompt]
        ok(s['id'] + ': gap prompt has no student names', not leaked, ','.join(leaked))
        pg.fill('#gapReply', s['gapReply']); pg.click('#readGaps')
        n = pg.locator('#questions textarea').count()
        ok(s['id'] + ': 5-8 questions in UI', 5 <= n <= 8, str(n))
        for i in range(n): pg.fill('#a%d' % i, s['answers'][i] if i < len(s['answers']) else '')
        pg.click('#writeScript')
        sp = pg.input_value('#scriptPrompt')
        leaked = [x for x in s['expect']['names'] if x in sp]
        ok(s['id'] + ': script prompt has no student names', not leaked, ','.join(leaked))
        pg.fill('#scriptReply', s['scriptReply']); pg.click('#readScript')
        pg.wait_for_selector('.script')
        txt = pg.text_content('#output')
        ok(s['id'] + ': names restored in output', all(x in txt for x in s['expect']['names'] if x in s['plan'] + s['info'].get('helpers', '')), '')
        ok(s['id'] + ': no tokens left', 'STUDENT_' not in txt)
        flat = ' '.join(txt.split())
        for a in s['expect'].get('assoc', []):
            ok(s['id'] + ': right name in right place: ' + a, a in flat)
        if shot:
            pg.locator('#output').screenshot(path=str(screens / (prefix + 'output-' + s['id'] + '.png')))
        return txt

    for i, s in enumerate(samples):
        run_sample(s, True)
    # Step screenshot (gaps UI) for sample 1
    s = samples[0]
    pg.goto(base, wait_until='networkidle'); pg.check('input[name=mode][value=copy]')
    pg.fill('#plan', s['plan']); pg.fill('#names', s['names']); pg.click('#findGaps')
    pg.fill('#gapReply', s['gapReply']); pg.click('#readGaps')
    pg.locator('#step-gaps').screenshot(path=str(screens / (prefix + 'step2-questions.png')))
    # Malformed reply shows friendly error
    pg.fill('#gapReply', 'Sorry, I cannot do that.'); pg.click('#readGaps')
    ok('malformed AI reply shows friendly error', pg.is_visible('#gapError'), pg.text_content('#gapError'))
    # No-AI mode end to end
    pg.goto(base, wait_until='networkidle'); pg.check('input[name=mode][value=none]')
    pg.fill('#plan', samples[3]['plan']); pg.click('#findGaps')
    pg.click('#writeScript'); pg.wait_for_selector('.script')
    ok('no-AI mode produces a script', 'Schedule' in pg.text_content('#output'))
    # Print rendering of sample 2 output
    run_sample(samples[1], False)
    pg.emulate_media(media='print')
    pg.screenshot(path=str(screens / (prefix + 'print-ms-math.png')), full_page=True)
    pg.pdf(path=str(screens / (prefix + 'print-ms-math.pdf')), format='Letter') if hasattr(pg, 'pdf') else None
    pg.emulate_media(media='screen')
    # Mobile
    m = b.new_page(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True)
    m.goto(base, wait_until='networkidle')
    m.screenshot(path=str(screens / (prefix + 'landing-mobile.png')))
    ok('no JS errors', not errors, ' | '.join(errors[:5]))
    b.close()
if srv: srv.terminate()
fails = [r for r in report if not r[1]]
print('%d passed, %d failed' % (len(report) - len(fails), len(fails)))
(root / 'tests' / ((prefix or 'local-') + 'e2e-results.txt')).write_text('\n'.join(('PASS ' if r[1] else 'FAIL ') + r[0] + (' -- ' + r[2] if r[2] else '') for r in report) + '\n')
sys.exit(1 if fails else 0)
