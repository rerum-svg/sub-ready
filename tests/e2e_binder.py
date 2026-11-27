"""Browser tests for the class binder, emergency plan, multi-period plan, print pack and compare page.
Usage: python3 tests/e2e_binder.py [base_url] [prefix]   (no URL = local server on 127.0.0.1:8766)"""
import json, subprocess, sys, time, pathlib, tempfile, re
try:
    import cv2
except ImportError:
    cv2 = None
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
        if card.get_attribute('open') is None: card.locator(':scope > summary').click()
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
    ok('emergency plan: 7 sheets (cover, schedule, 3 periods, end-of-day note, emergency)', pg.locator('#pack .sheet').count() == 7, pg.locator('#pack .sheet').count())
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
    ok('print PDF: one page per sheet (7 pages)', pages == 7, pages)
    txt = subprocess.check_output(['pdftotext', '-layout', str(pdf), '-'], text=True)
    pg_texts = txt.split('\f')
    ok('print PDF: page 1 is the cover', 'Emergency sub plan' in pg_texts[0] and 'Front office' in pg_texts[0])
    ok('print PDF: page 2 is the schedule', 'Schedule' in pg_texts[1] and '8:00 AM' in pg_texts[1])
    ok('print PDF: page 6 is the end-of-day note', 'End-of-day note' in pg_texts[5] and 'What got done' in pg_texts[5])
    ok('print PDF: last page is the emergency sheet', 'Emergency sheet' in pg_texts[6] and 'Door 6' in pg_texts[6])
    ok('print PDF: no editor text leaked', 'Delete from this browser' not in txt and 'Check my binder' not in txt)
    pg.emulate_media(media='screen')

    # 3. Multi-period day plan
    pg.uncheck('[data-day-check=%s]' % pg.locator('.day-row').nth(1).get_attribute('data-id'))
    pg.locator('[data-day-lesson]').nth(0).fill('Lesson 4.2 notes, then textbook p. 88 #1-10.')
    pg.fill('#dayDate', 'Tuesday, December 2')
    pg.click('#dayBtn')
    pg.wait_for_selector('#pack .sheet')
    ok('day plan: unticked period left out (6 sheets)', pg.locator('#pack .sheet').count() == 6, pg.locator('#pack .sheet').count())
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

    # ---------- New: quick-win fields, seating chart, end-of-day note, story, school file ----------
    ctx5 = b.new_context(viewport={'width': 1280, 'height': 900}, accept_downloads=True)
    req5 = []
    pg5 = ctx5.new_page(); pg5.on('dialog', lambda d: d.accept())
    pg5.on('pageerror', lambda e: errors.append(str(e)))
    pg5.on('request', lambda r: req5.append(r.url))
    pg5.goto(base + 'binder.html', wait_until='networkidle')
    bf = pg5.eval_on_selector('.card', "e => getComputedStyle(e).backdropFilter || getComputedStyle(e).webkitBackdropFilter || ''")
    ok('design: cards are frosted glass (backdrop-filter blur)', 'blur' in bf, bf)
    ok('design: system font stack', 'apple-system' in pg5.eval_on_selector('body', "e => getComputedStyle(e).fontFamily").lower() or 'blinkmacsystemfont' in pg5.eval_on_selector('body', "e => getComputedStyle(e).fontFamily").lower())
    ok('app says it is actively being built', 'actively being built' in pg5.text_content('#whatsNew'))
    fill_binder(pg5)
    QW = {'rules': 'No one leaves without a pass.', 'phones': 'Phones in the caddy by the door.', 'tellYou': 'We always get free time on Fridays. We do not.', 'goTo': 'Mr. Okafor, room 216', 'pronounce': 'Nguyen - nwin', 'noteEmail': 'ms.rivera@lincoln.example.org', 'notePhone': '555-201-4477'}
    for k, val in QW.items(): pg5.fill('[data-shared=%s]' % k, val)
    # Seating chart: click to place, drag to place, drag to move, edit pronunciation, type a new name
    c0 = '.period-card >> nth=0'
    pg5.locator(c0).locator('.chart-wrap summary').click()
    pg5.locator(c0).locator('[data-chart-dim=rows]').select_option('4')
    pg5.locator(c0).locator('[data-chart-dim=cols]').select_option('5')
    ok('chart: 4 x 5 grid shown', pg5.locator(c0).locator('[data-seat]').count() == 20)
    pg5.locator(c0).locator('[data-chip="Jaylen"]').click()
    pg5.locator(c0).locator('[data-seat="0,0"]').click()
    seats = lambda: {(x['r'], x['c']): x for x in pg5.evaluate('window.__subReadyBinder.binder.classes[0].chart.seats')}
    ok('chart: click a name, then a seat, places it', seats().get((0, 0), {}).get('name') == 'Jaylen')
    pg5.locator(c0).locator('[data-chip="Noah"]').drag_to(pg5.locator(c0).locator('[data-seat="1,2"]'))
    ok('chart: drag a name onto a seat places it', seats().get((1, 2), {}).get('name') == 'Noah', seats())
    pg5.locator(c0).locator('[data-seat="0,0"]').drag_to(pg5.locator(c0).locator('[data-seat="0,1"]'))
    ok('chart: drag a seated student to move them', seats().get((0, 1), {}).get('name') == 'Jaylen' and (0, 0) not in seats())
    pg5.locator(c0).locator('[data-seat="0,1"]').click()
    pg5.locator(c0).locator('[data-se=say]').fill('JAY-len')
    pg5.locator(c0).locator('[data-se=note]').fill('front row for the board')
    pg5.locator(c0).locator('[data-seat-done]').click()
    pg5.locator(c0).locator('[data-seat="2,3"]').click()
    pg5.locator(c0).locator('[data-se=name]').fill('Siobhan')
    pg5.locator(c0).locator('[data-se=say]').fill('shi-VAWN')
    pg5.locator(c0).locator('[data-seat-done]').click()
    ok('chart: pronunciation and note saved on the seat', seats().get((0, 1), {}).get('say') == 'JAY-len' and seats().get((2, 3), {}).get('name') == 'Siobhan')
    ok('chart: placed names leave the name list', pg5.locator(c0).locator('[data-chip="Jaylen"]').count() == 0 and pg5.locator(c0).locator('[data-chip="Maya L."]').count() == 1)
    pg5.locator('.period-card').nth(1).locator('[data-k=storyOn]').check()
    pg5.fill('#lessonTitle', 'Reading response'); pg5.fill('#lessonPlan', 'Read any book for 20 minutes.\nWrite 5 sentences about it.\nCollect in the tray.')
    pg5.click('#addLesson')
    ok('school: lesson added to the bank', pg5.locator('#lessonBank .lesson').count() == 1)
    pg5.fill('#f-bells', 'P1 8:00-8:50\nP3 10:40-11:30\nP5 12:50-1:40')
    pg5.wait_for_timeout(500)
    pg5.reload(wait_until='networkidle')
    sv5 = pg5.evaluate('window.__subReadyBinder.binder')
    ok('after reload: chart kept (3 seats, 4 x 5)', len(sv5['classes'][0]['chart']['seats']) == 3 and sv5['classes'][0]['chart']['rows'] == 4)
    ok('after reload: quick-win fields kept', sv5['rules'] == QW['rules'] and sv5['noteEmail'] == QW['noteEmail'] and sv5['pronounce'] == QW['pronounce'])
    ok('after reload: story activity and lesson bank kept', sv5['classes'][1]['storyOn'] == 'yes' and len(sv5['lessonBank']) == 1)
    pg5.locator(c0).locator('.chart-wrap summary').click()
    pg5.locator(c0).locator('[data-chip="Maya L."]').click()
    shot5 = pg5.add_style_tag(content='header.site{position:static !important}')
    pg5.locator(c0).locator('.chart-wrap').screenshot(path=str(screens / (prefix + 'seating-chart-builder.png')))
    shot5.evaluate('e => e.remove()')
    pg5.locator(c0).locator('[data-chip="Maya L."]').click()
    # Pack with everything
    pg5.click('#emergencyBtn'); pg5.wait_for_selector('#pack .sheet')
    n5 = pg5.locator('#pack .sheet').count()
    ok('pack: cover, schedule, 3 periods, seating, 2 story sheets, note, emergency (10 sheets)', n5 == 10, n5)
    seat_sheet = pg5.locator('#pack .sheet.seating')
    ok('pack: seating chart page has names and how to say them', seat_sheet.count() == 1 and 'Siobhan' in seat_sheet.text_content() and 'shi-VAWN' in seat_sheet.text_content() and 'Front of the room' in seat_sheet.text_content())
    sched = pg5.text_content('#pack .sheet.schedule')
    ok('pack: quick-win fields printed on the schedule page', all(x in sched for x in ['Must-follow rules', 'Phone policy', 'Go-to adult nearby', 'nwin', 'School bell schedule']))
    note = pg5.locator('#pack .sheet.daynote')
    ok('note: two QR codes (email + text)', note.locator('svg.qr').count() == 2)
    hrefs = note.locator('figure').evaluate_all('els => els.map(e => e.getAttribute("data-href"))')
    ok('note: links go to the teacher\u2019s own address and number', hrefs[0].startswith('mailto:ms.rivera@lincoln.example.org?subject=') and hrefs[1].startswith('sms:5552014477?&body='), hrefs)
    from urllib.parse import unquote
    secrets5 = ['Jaylen', 'Noah', 'Ava', 'Maya', 'Will R', 'Grace', 'Siobhan', 'Nguyen', 'EpiPen', 'Door 6']
    ok('note: no student name or binder notes in the links', all(not any(x.lower() in unquote(h).lower() for x in secrets5) for h in hrefs))
    if cv2 is not None:
        for i, kind in enumerate(['email', 'text']):
            big_css = pg5.add_style_tag(content='.qr-fig svg{width:420px !important;height:420px !important}')
            qp = tempfile.mktemp(suffix='.png'); note.locator('svg.qr').nth(i).screenshot(path=qp)
            big_css.evaluate('e => e.remove()')
            img = cv2.imread(qp); img = cv2.copyMakeBorder(img, 20, 20, 20, 20, cv2.BORDER_CONSTANT, value=(255, 255, 255))
            data = cv2.QRCodeDetector().detectAndDecode(img)[0] or cv2.QRCodeDetectorAruco().detectAndDecode(img)[0]
            ok('note: %s QR scans to exactly its prefilled link' % kind, data == hrefs[i], data[:60])
    shot6 = pg5.add_style_tag(content='header.site{position:static !important}')
    note.screenshot(path=str(screens / (prefix + 'end-of-day-note.png')))
    seat_sheet.screenshot(path=str(screens / (prefix + 'seating-chart-print.png')))
    shot6.evaluate('e => e.remove()')
    pg5.emulate_media(media='print')
    ok('print: frosted glass switched off (no backdrop-filter)', pg5.eval_on_selector('#pack .sheet', "e => (getComputedStyle(e).backdropFilter || 'none')") in ('none', ''))
    ok('print: plain white page', pg5.eval_on_selector('body', "e => getComputedStyle(e).backgroundColor") in ('rgb(255, 255, 255)', 'rgba(0, 0, 0, 0)'))
    pdf5 = screens / (prefix + 'binder-full-pack.pdf')
    pg5.pdf(path=str(pdf5), format='Letter', margin={'top': '14mm', 'bottom': '14mm', 'left': '14mm', 'right': '14mm'})
    pages5 = int(re.search(r'Pages:\s+(\d+)', subprocess.check_output(['pdfinfo', str(pdf5)], text=True)).group(1))
    ok('print PDF: one page per sheet, seating chart on one page (%d)' % n5, pages5 == n5, pages5)
    t5 = subprocess.check_output(['pdftotext', '-layout', str(pdf5), '-'], text=True).split('\f')
    seat_pages = [i for i, t in enumerate(t5) if 'Seating chart' in t and 'front of the room' in t.lower()]
    ok('print PDF: seating chart page shows every seated name', len(seat_pages) == 1 and all(x in t5[seat_pages[0]] for x in ['Jaylen', 'Noah', 'Siobhan']))
    ok('print PDF: end-of-day note page', any('End-of-day note for Ms. Rivera' in t and 'Nothing is sent until you press send' in re.sub(r'\s+', ' ', t) for t in t5))
    ok('print PDF: pass-the-page story sheets', any('Pass-the-page story' in t for t in t5) and any('Our story' in t for t in t5))
    pg5.emulate_media(media='screen')
    # Bigger charts still print on one page: 10 x 10 with long notes
    pg5.click('#closePack')
    big = pg5.evaluate("""() => { const b = window.__subReadyBinder.binder; const seats = []; for (let r = 0; r < 10; r++) for (let c = 0; c < 10; c++) seats.push({ r, c, name: 'Student' + r + c, say: 'STOO-dent', note: 'a fairly long note about where this student works best and who to pair them with' }); b.classes[2].chart = { rows: 10, cols: 10, seats }; window.__subReadyBinder.saveNow(); return seats.length; }""")
    pg5.reload(wait_until='networkidle')
    pg5.uncheck('[data-day-check=%s]' % pg5.locator('.day-row').nth(0).get_attribute('data-id'))
    pg5.uncheck('[data-day-check=%s]' % pg5.locator('.day-row').nth(1).get_attribute('data-id'))
    pg5.click('#dayBtn'); pg5.wait_for_selector('#pack .sheet.seating')
    nbig = pg5.locator('#pack .sheet').count()
    pg5.emulate_media(media='print')
    pdfb = screens / (prefix + 'seating-10x10.pdf')
    pg5.pdf(path=str(pdfb), format='Letter', margin={'top': '14mm', 'bottom': '14mm', 'left': '14mm', 'right': '14mm'})
    pg5.emulate_media(media='screen')
    pb = int(re.search(r'Pages:\s+(\d+)', subprocess.check_output(['pdfinfo', str(pdfb)], text=True)).group(1))
    ok('print PDF: a full 10 x 10 chart with long notes still fits one page', pb == nbig, '%d pages for %d sheets' % (pb, nbig))
    # Chart-only names are hidden from the AI on hand-off
    pg5.locator(c0).locator('[data-k=seating]').fill('Siobhan sits by the door and runs the projector.')
    pg5.wait_for_timeout(500)
    # School file: export from this binder, import into a fresh browser
    with pg5.expect_download() as dl5:
        pg5.click('#schoolExport')
    sfp = pathlib.Path(tempfile.mkdtemp()) / 'sub-ready-school-file.json'
    dl5.value.save_as(str(sfp))
    sfj = json.loads(sfp.read_text())
    ok('school file: downloaded as sub-ready-school-file.json', dl5.value.suggested_filename == 'sub-ready-school-file.json' and sfj.get('kind') == 'school-file')
    low = sfp.read_text().lower()
    ok('school file: no student names, health notes, charts or teacher contact', not any(x.lower() in low for x in ['Jaylen', 'Noah', 'Ava T', 'Maya', 'Siobhan', 'Nguyen', 'EpiPen', 'ms.rivera@', 'Student00', '"classes"', '"students"']))
    ok('school file: has bells, procedures, contacts and the lesson', 'P1 8:00' in sfj['school']['bells'] and 'Door 6' in sfj['school']['procedures']['emergency'] and len(sfj['school']['contacts']) == 3 and len(sfj['school']['lessons']) == 1)
    ctx6 = b.new_context(viewport={'width': 1280, 'height': 900}); req6 = []
    pg6 = ctx6.new_page(); pg6.on('dialog', lambda d: d.accept()); pg6.on('pageerror', lambda e: errors.append(str(e))); pg6.on('request', lambda r: req6.append(r.url))
    pg6.goto(base + 'binder.html', wait_until='networkidle')
    pg6.fill('[data-shared=teacher]', 'Mr. Lee'); pg6.fill('[data-shared=bathroom]', 'My own pass rule.')
    pg6.set_input_files('#schoolFile', str(sfp))
    pg6.wait_for_function("document.getElementById('schoolMsg').textContent.indexOf('Merged') === 0")
    msg6 = pg6.text_content('#schoolMsg')
    ok('school import: merged message lists what was filled and kept', 'Emergency procedures' in msg6 and 'Kept your own text for: Bathroom' in msg6 and 'Nothing syncs live' in msg6, msg6)
    ok('school import: blanks filled, own text kept', 'Door 6' in pg6.input_value('[data-shared=emergency]') and pg6.input_value('[data-shared=bathroom]') == 'My own pass rule.' and pg6.input_value('[data-shared=teacher]') == 'Mr. Lee' and 'P1 8:00' in pg6.input_value('#f-bells'))
    ok('school import: contacts and lesson bank arrived', pg6.locator('.contact-row').count() >= 3 and pg6.locator('#lessonBank .lesson').count() == 1)
    pg6.locator('[data-lesson-use="0"]').click()
    ok('school import: a bank lesson becomes a period\u2019s any-day plan', 'Read any book for 20 minutes' in pg6.locator('.period-card').nth(0).locator('[data-k=anyDay]').input_value())
    bad6 = sfp.parent / 'binder-not-school.json'; bad6.write_text(json.dumps({'app': 'sub-ready', 'kind': 'class-binder', 'version': 1, 'binder': {'classes': []}}))
    pg6.set_input_files('#schoolFile', str(bad6)); pg6.wait_for_selector('#schoolMsg.error')
    ok('school import: a binder file is refused clearly', 'class binder, not a school file' in pg6.text_content('#schoolMsg'))
    own6 = [u for u in req6 if not u.startswith(base) and not u.startswith('data:') and not u.startswith('blob:')]
    ctx6.close()
    pid5 = pg5.locator('.day-row').nth(0).get_attribute('data-id')
    pg5.click('[data-gap=%s]' % pid5)
    pg5.wait_for_url(re.compile(r'index\.html')); pg5.wait_for_load_state('networkidle')
    nm5 = pg5.input_value('#names')
    ok('hand-off: seating-chart and pronunciation names join the hidden list', 'Siobhan' in nm5 and 'Nguyen' in nm5, nm5)
    pg5.check('input[name=mode][value=copy]'); pg5.click('#findGaps')
    gp5 = pg5.input_value('#gapPrompt')
    ok('hand-off: a chart-only name never reaches the AI prompt', 'Siobhan' not in gp5 and 'projector' in gp5)
    own5 = [u for u in req5 if not u.startswith(base) and not u.startswith('data:') and not u.startswith('blob:')]
    ok('new features: no requests to any other server', not own5 and not own6, ' '.join((own5 + own6)[:5]))
    ctx5.close()

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
