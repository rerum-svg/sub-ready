"""Browser tests for the class binder, emergency plan, multi-period plan, print pack and compare page.
Usage: python3 tests/e2e_binder.py [base_url] [prefix]   (no URL = local server on 127.0.0.1:8766)"""
import json, subprocess, sys, time, pathlib, tempfile, re
from playwright.sync_api import sync_playwright

root = pathlib.Path(__file__).resolve().parent.parent
screens = root / 'screens'; screens.mkdir(exist_ok=True)
FIX = json.loads(subprocess.check_output(['node', '-e', "process.stdout.write(JSON.stringify(require('./tests/binder-fixture.js')))"], cwd=root))
base = sys.argv[1] if len(sys.argv) > 1 else None
prefix = sys.argv[2] if len(sys.argv) > 2 else ''
srv = None
if not base:
    srv = subprocess.Popen([sys.executable, '-m', 'http.server', '8766', '--bind', '127.0.0.1'], cwd=root, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(1); base = 'http://127.0.0.1:8766/'
if not base.endswith('/'): base += '/'
report = []
def ok(name, cond, detail=''):
    report.append((name, bool(cond), str(detail)[:200])); print(('PASS ' if cond else 'FAIL ') + name, str(detail)[:200])

def fill_binder(pg):
    for k in ['teacher', 'room', 'school', 'arrival', 'bathroom', 'emergency', 'health', 'dismissal', 'leave', 'students']:
        pg.fill('[data-shared=%s]' % k, FIX[k])
    rows = pg.locator('.contact-row')
    for i, c in enumerate(FIX['contacts']):
        if i >= rows.count(): pg.click('#addContact')
        pg.locator('.contact-row').nth(i).locator('[data-c=role]').fill(c['role'])
        pg.locator('.contact-row').nth(i).locator('[data-c=contact]').fill(c['contact'])
    for i, c in enumerate(FIX['classes']):
        if i >= pg.locator('.period-card').count(): pg.click('#addClass')
        card = pg.locator('.period-card').nth(i)
        if card.get_attribute('open') is None: card.locator('summary').click()
        for k in ['label', 'start', 'end', 'location', 'routines', 'seating', 'helpers', 'supplies', 'anyDay']:
            card.locator('[data-k=%s]' % k).fill(c[k])
    pg.wait_for_function("document.getElementById('saveStatus').textContent.indexOf('Saved') === 0")

with sync_playwright() as p:
    b = p.chromium.launch()
    errors = []
    ctx = b.new_context(viewport={'width': 1280, 'height': 900}, accept_downloads=True)
    pg = ctx.new_page()
    pg.on('pageerror', lambda e: errors.append(str(e)))
    pg.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
    pg.on('dialog', lambda d: d.accept())
    requests = []
    pg.on('request', lambda r: requests.append(r.url))

    r = pg.goto(base + 'binder.html', wait_until='networkidle')
    ok('binder page loads (HTTP %s)' % r.status, r.status == 200)
    ok('labeled "Free early access"', pg.text_content('#accessLabel') == 'Free early access')
    ok('says it is saved only in this browser', 'only in this browser' in pg.text_content('.privacy-note'))
    ok('plans described as not on sale yet', 'aren\u2019t on sale yet' in pg.text_content('#earlyNote'))
    ok('default contact roles offered', pg.locator('.contact-row').count() == 3)

    # 1. Saved class profile: fill, save, reload
    fill_binder(pg)
    pg.evaluate('window.scrollTo(0, 0)')
    pg.screenshot(path=str(screens / (prefix + 'binder-editor.png')), full_page=True)
    pg.reload(wait_until='networkidle')
    ok('after reload: status says loaded', 'Loaded' in pg.text_content('#saveStatus'), pg.text_content('#saveStatus'))
    ok('after reload: shared fields kept', pg.input_value('[data-shared=emergency]') == FIX['emergency'])
    ok('after reload: 3 periods kept', pg.locator('.period-card').count() == 3)
    ok('after reload: period fields kept', pg.locator('.period-card').nth(2).locator('[data-k=anyDay]').input_value() == FIX['classes'][2]['anyDay'])
    ok('after reload: contacts kept', pg.locator('.contact-row').nth(1).locator('[data-c=contact]').input_value() == FIX['contacts'][1]['contact'])
    stored = pg.evaluate("localStorage.getItem('subready.binder.v1')")
    ok('saved in localStorage under subready.binder.v1', stored and 'Door 6' in stored)

    # Gap check
    pg.click('#checkBtn')
    ok('gap check: complete binder shows nothing missing', 'Nothing obvious is missing' in pg.text_content('#readiness'), pg.text_content('#readiness'))
    card = pg.locator('.period-card').nth(0)
    card.locator('[data-k=anyDay]').fill('Do the usual warm-up\nWorksheets from the bin')
    pg.click('#checkBtn')
    rt = pg.text_content('#readiness')
    ok('gap check: vague any-day plan flagged', 'usual' in rt and 'the bin' in rt, rt)
    card.locator('[data-k=anyDay]').fill(FIX['classes'][0]['anyDay'])

    # 2. Emergency plan + 4. print pack
    pg.click('#emergencyBtn')
    pg.wait_for_selector('#pack .sheet')
    ok('emergency plan: 6 sheets (cover, schedule, 3 periods, emergency)', pg.locator('#pack .sheet').count() == 6, pg.locator('#pack .sheet').count())
    order = pg.eval_on_selector_all('#pack .sheet.period h2', 'els => els.map(e => e.textContent)')
    ok('emergency plan: periods in time order', order == ['Period 1 - Math 6', 'Period 3 - Math 7', 'Period 5 - Advisory'], order)
    ok('emergency plan: no "before you print" warning when complete', pg.is_hidden('#packWarn'))
    shot_css = pg.add_style_tag(content='header.site{position:static !important}')
    pg.locator('#packWrap').screenshot(path=str(screens / (prefix + 'binder-emergency-pack.png')))
    shot_css.evaluate('e => e.remove()')
    pg.emulate_media(media='print')
    ok('print: editor hidden', pg.is_hidden('#app') or not pg.locator('#app').is_visible())
    ok('print: site header hidden', not pg.locator('header.site').is_visible())
    ok('print: pack visible', pg.locator('#pack').is_visible())
    ok('print: each sheet breaks to a new page', pg.eval_on_selector('#pack .sheet.cover', "e => getComputedStyle(e).breakAfter") == 'page')
    ok('print: last sheet adds no blank page', pg.eval_on_selector('#pack .sheet.emergency', "e => getComputedStyle(e).breakAfter") == 'auto')
    pdf = screens / (prefix + 'binder-emergency-pack.pdf')
    pg.pdf(path=str(pdf), format='Letter', margin={'top': '14mm', 'bottom': '14mm', 'left': '14mm', 'right': '14mm'})
    pages = int(re.search(r'Pages:\s+(\d+)', subprocess.check_output(['pdfinfo', str(pdf)], text=True)).group(1))
    ok('print PDF: one page per sheet (6 pages)', pages == 6, pages)
    txt = subprocess.check_output(['pdftotext', '-layout', str(pdf), '-'], text=True)
    pg_texts = txt.split('\f')
    ok('print PDF: page 1 is the cover', 'Emergency sub plan' in pg_texts[0] and 'Front office' in pg_texts[0])
    ok('print PDF: page 2 is the schedule', 'Schedule' in pg_texts[1] and '8:00 AM' in pg_texts[1])
    ok('print PDF: last page is the emergency sheet', 'Emergency sheet' in pg_texts[5] and 'Door 6' in pg_texts[5])
    ok('print PDF: no editor text leaked', 'Delete from this browser' not in txt and 'Check my binder' not in txt)
    pg.emulate_media(media='screen')

    # 3. Multi-period day plan
    pg.uncheck('[data-day-check=%s]' % pg.locator('.day-row').nth(1).get_attribute('data-id'))
    pg.locator('[data-day-lesson]').nth(0).fill('Lesson 4.2 notes, then textbook p. 88 #1-10.')
    pg.fill('#dayDate', 'Tuesday, December 2')
    pg.click('#dayBtn')
    pg.wait_for_selector('#pack .sheet')
    ok('day plan: unticked period left out (5 sheets)', pg.locator('#pack .sheet').count() == 5, pg.locator('#pack .sheet').count())
    ptxt = pg.text_content('#pack')
    ok('day plan: today\u2019s lesson used', 'Lesson 4.2 notes' in ptxt and 'Today\u2019s lesson' in ptxt)
    ok('day plan: other period falls back to any-day plan', 'Silent reading for 30 minutes' in ptxt)
    ok('day plan: date on the cover', 'Tuesday, December 2' in pg.text_content('#pack .cover'))
    pg.emulate_media(media='print')
    pg.screenshot(path=str(screens / (prefix + 'binder-day-pack-print.png')), full_page=True)
    pg.emulate_media(media='screen')

    # Export / import round trip into a fresh browser profile
    with pg.expect_download() as dl:
        pg.click('#exportBtn')
    d = dl.value
    tmp = pathlib.Path(tempfile.mkdtemp()) / 'sub-ready-binder.json'
    d.save_as(str(tmp))
    exported = json.loads(tmp.read_text())
    ok('export: file named sub-ready-binder.json', d.suggested_filename == 'sub-ready-binder.json')
    ok('export: file has the binder', exported.get('app') == 'sub-ready' and len(exported['binder']['classes']) == 3)
    ctx2 = b.new_context(viewport={'width': 1280, 'height': 900})
    pg2 = ctx2.new_page(); pg2.on('dialog', lambda d: d.accept())
    pg2.on('pageerror', lambda e: errors.append(str(e)))
    pg2.goto(base + 'binder.html', wait_until='networkidle')
    ok('fresh browser starts empty', pg2.input_value('[data-shared=teacher]') == '')
    pg2.set_input_files('#importFile', str(tmp))
    pg2.wait_for_function("document.getElementById('ioMsg').textContent.indexOf('Imported') === 0")
    after = pg2.evaluate('window.__subReadyBinder.binder')
    ok('import: round trip identical to exported binder', json.dumps(after, sort_keys=True) == json.dumps(exported['binder'], sort_keys=True))
    ok('import: fields shown in the form', pg2.input_value('[data-shared=room]') == FIX['room'] and pg2.locator('.period-card').count() == 3)
    pg2.reload(wait_until='networkidle')
    ok('import: saved, survives reload', pg2.locator('.period-card').nth(1).locator('[data-k=label]').input_value() == FIX['classes'][1]['label'])
    bad = tmp.parent / 'not-a-binder.json'; bad.write_text('{"hello": 1}')
    pg2.set_input_files('#importFile', str(bad))
    pg2.wait_for_selector('#ioMsg.error')
    ok('import: wrong file shows a clear error', 'doesn\u2019t contain a Sub-Ready binder' in pg2.text_content('#ioMsg'))
    ok('import: wrong file leaves binder untouched', pg2.input_value('[data-shared=room]') == FIX['room'])
    # Delete
    pg2.click('#clearBtn')
    ok('delete: status says deleted', 'Deleted' in pg2.text_content('#saveStatus'))
    pg2.reload(wait_until='networkidle')
    ok('delete: gone after reload', pg2.input_value('[data-shared=teacher]') == '' and pg2.evaluate("localStorage.getItem('subready.binder.v1')") is None)
    ctx2.close()

    # Hand-off to the one-day gap checker
    pid = pg.locator('.day-row').nth(2).get_attribute('data-id')
    pg.click('[data-gap=%s]' % pid)
    pg.wait_for_url(re.compile(r'index\.html'))
    pg.wait_for_load_state('networkidle')
    ok('hand-off: one-day tool opens with the plan filled in', 'Silent reading' in pg.input_value('#plan'))
    ok('hand-off: note shown', pg.is_visible('#handoffNote'))
    ok('hand-off: emergency info carried', 'Door 6' in pg.input_value('#emergency'))
    nm = pg.input_value('#names')
    ok('hand-off: listed names carried for masking', all(x in nm for x in ['Grace S.', 'Jaylen', 'Ava T.']) and 'Reading' not in nm, nm)
    pg.check('input[name=mode][value=copy]'); pg.click('#findGaps')
    gp = pg.input_value('#gapPrompt')
    ok('hand-off: no listed student name reaches the AI prompt', not [x for x in ['Grace S.', 'Jaylen', 'Ava T.', 'Maya L.'] if x in gp])
    pg.reload(wait_until='networkidle')
    ok('hand-off: used once (cleared after reload)', pg.input_value('#plan') == '')

    # Landing page pro section
    ok('landing: binder labeled free early access', 'Free early access' in pg.text_content('#pro'))
    ok('landing: plans coming soon, button has no link', 'coming soon' in pg.text_content('#proBtn').lower() and pg.get_attribute('#proBtn', 'href') is None)

    # Gate: flag off with no PRO_URL -> locked, no link
    ctx3 = b.new_context(viewport={'width': 1280, 'height': 900})
    ctx3.route('**/js/config.js', lambda route: route.fulfill(status=200, content_type='application/javascript', body="window.SUB_READY_CONFIG={PRO_URL:'',EARLY_ACCESS:false};"))
    pg3 = ctx3.new_page(); pg3.goto(base + 'binder.html', wait_until='networkidle')
    ok('flag off: binder locked behind the plan', pg3.is_visible('#gate') and not pg3.is_visible('#app'))
    ok('flag off, no PRO_URL: "Coming soon", no link', pg3.text_content('#gateBtn') == 'Coming soon' and pg3.get_attribute('#gateBtn', 'href') is None)
    ctx3.close()

    # Compare page
    r = pg.goto(base + 'compare.html', wait_until='networkidle')
    ok('compare page loads (HTTP %s)' % r.status, r.status == 200)
    ok('compare page: 6 rows', pg.locator('.compare-table tbody tr').count() == 6)
    ok('compare page: 5 source links', pg.locator('.compare-table tbody a[href^="https://"]').count() == 5)
    pg.screenshot(path=str(screens / (prefix + 'compare.png')), full_page=True)

    # Mobile
    m = b.new_page(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True)
    m.on('pageerror', lambda e: errors.append(str(e)))
    m.goto(base + 'binder.html', wait_until='networkidle')
    m.screenshot(path=str(screens / (prefix + 'binder-mobile.png')))
    ok('mobile: no horizontal overflow', m.evaluate('document.documentElement.scrollWidth <= window.innerWidth + 1'))

    own = [u for u in requests if not u.startswith(base) and not u.startswith('data:') and not u.startswith('blob:')]
    ok('no requests to any other server', not own, ' '.join(own[:5]))
    ok('no JS errors', not errors, ' | '.join(errors[:5]))
    b.close()
if srv: srv.terminate()
fails = [r for r in report if not r[1]]
print('%d passed, %d failed' % (len(report) - len(fails), len(fails)))
(root / 'tests' / ((prefix or 'local-') + 'binder-e2e-results.txt')).write_text('\n'.join(('PASS ' if r[1] else 'FAIL ') + r[0] + (' -- ' + r[2] if r[2] else '') for r in report) + '\n')
sys.exit(1 if fails else 0)
