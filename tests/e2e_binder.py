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
    ok('day 0: labeled "Free trial \u00b7 14 days left"', pg.text_content('#accessLabel') == 'Free trial \u00b7 14 days left', pg.text_content('#accessLabel'))
    ok('day 0: trial start saved in this browser', pg.evaluate("localStorage.getItem('subready.trialStart')") is not None)
    ok('says it is saved only in this browser', 'only in this browser' in pg.text_content('.privacy-note'))
    tn = pg.text_content('#trialNote')
    ok('trial note: 14 days, nothing deleted, export always works, $5/month', pg.is_visible('#trialNote') and '14-day free trial' in tn and 'always export' in tn and '$5/month' in tn, tn)
    ok('day 0: subscribe offered but PayPal not loaded', pg.locator('#gatePlans [data-subscribe=teacher]').count() == 1 and pg.locator('script[src*="paypal.com"]').count() == 0)
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
    ok('print PDF: pack ends with "Made with Sub-Ready (free)" + pack URL', 'Made with Sub-Ready (free)' in pg_texts[6] and 'rerum-svg.github.io/sub-ready/?src=pack' in pg_texts[6].replace(' ', ''))
    ok('print PDF: end-of-day note has the footer too', 'Made with Sub-Ready (free)' in pg_texts[5])
    if cv2 is not None:
        big_css = pg.add_style_tag(content='.made-with svg{width:420px !important;height:420px !important}')
        pg.emulate_media(media='screen')
        qp = tempfile.mktemp(suffix='.png'); pg.locator('#pack .sheet.emergency .made-with svg').screenshot(path=qp)
        big_css.evaluate('e => e.remove()')
        img = cv2.imread(qp); img = cv2.copyMakeBorder(img, 20, 20, 20, 20, cv2.BORDER_CONSTANT, value=(255, 255, 255))
        data = cv2.QRCodeDetector().detectAndDecode(img)[0] or cv2.QRCodeDetectorAruco().detectAndDecode(img)[0]
        ok('print footer QR scans to https://rerum-svg.github.io/sub-ready/?src=pack', data == 'https://rerum-svg.github.io/sub-ready/?src=pack', data)
        pg.emulate_media(media='print')
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

    # ---------- Landing pricing ----------
    ok('landing: binder labeled 14-day free trial', '14-day free trial' in pg.text_content('#pro'))
    ok('landing: honest pricing, cancel anytime in PayPal', all(x in pg.text_content('#pro') for x in ['$5/month per teacher', '$49/month per school', 'Cancel anytime in PayPal']))
    ok('landing: privacy says checkout runs on PayPal with no class or student data', 'checkout runs on PayPal' in pg.text_content('#privacy') and 'no class or student data' in pg.text_content('#privacy') and 'no analytics' in pg.text_content('#privacy'))

    # ---------- Plans: trial clock, lock, unlock, restore. PayPal loads only after a Subscribe click ----------
    DAYMS = 86400000
    CLIENT = 'AY5HQPWM12-j5wkw9D6iiTnOuNShiZi9H8WAhLbmHXaZ8EnEQkS5Oy7bW-cGRyJy6XBeayZ8jClFmNyI'
    FAKE_SDK = """window.paypal={Buttons:function(o){return{render:function(el){var b=document.createElement('button');b.type='button';b.textContent='Fake PayPal';b.className='fake-pp';
      b.onclick=function(){Promise.resolve(o.createSubscription({},{subscription:{create:function(x){window.__ppCreate=x;return Promise.resolve('I-FAKE');}}})).then(function(){o.onApprove({subscriptionID:window.__ppSubId||'I-TESTSUB12345'},{});});};
      (typeof el==='string'?document.querySelector(el):el).appendChild(b);return Promise.resolve();}};}};"""
    def plan_ctx(days_ago, stub=True, seed=True, cfg=None):
        c = b.new_context(viewport={'width': 1280, 'height': 900}, accept_downloads=True)
        reqs = []
        if stub:
            c.route('https://www.paypal.com/sdk/js**', lambda route: route.fulfill(status=200, content_type='application/javascript', body=FAKE_SDK))
        if cfg:
            c.route('**/js/config.js', lambda route: route.fulfill(status=200, content_type='application/javascript', body=cfg))
        p_ = c.new_page(); p_.on('dialog', lambda d: d.accept()); p_.on('pageerror', lambda e: errors.append(str(e)))
        p_.on('request', lambda r: reqs.append(r.url))
        p_.goto(base + 'binder.html', wait_until='networkidle')
        if seed:
            p_.evaluate("([fix, start]) => { localStorage.setItem('subready.binder.v1', JSON.stringify(fix)); localStorage.setItem('subready.trialStart', String(start)); }", [FIX, int(time.time() * 1000) - days_ago])
            p_.reload(wait_until='networkidle')
        return c, p_, reqs
    def pp_reqs(reqs): return [u for u in reqs if 'paypal.com' in u or 'paypalobjects.com' in u]

    # Day 13: still in the trial
    c13, p13, r13 = plan_ctx(13 * DAYMS + 3600000)
    ok('day 13: "1 day left", binder editable', p13.text_content('#accessLabel') == 'Free trial \u00b7 1 day left' and p13.locator('#app section.card[inert]').count() == 0, p13.text_content('#accessLabel'))
    p13.fill('[data-shared=room]', '215'); p13.wait_for_function("document.getElementById('saveStatus').textContent.indexOf('Saved') === 0")
    ok('day 13: edits still save', '"room":"215"' in p13.evaluate("localStorage.getItem('subready.binder.v1')"))
    c13.close()

    # Day 15: locked, nothing lost, export works
    c15, p15, r15 = plan_ctx(15 * DAYMS)
    stored15 = p15.evaluate("localStorage.getItem('subready.binder.v1')")
    ok('day 15: labeled "Trial ended", gate says so', p15.text_content('#accessLabel') == 'Trial ended' and p15.is_visible('#gate') and 'free trial has ended' in p15.text_content('#gateTitle'))
    ok('day 15: lock note says nothing was deleted and export works', p15.is_visible('#lockNote') and 'Nothing has been deleted' in p15.text_content('#lockNote') and 'Export' in p15.text_content('#lockNote'))
    ok('day 15: saved data still shown in full', p15.input_value('[data-shared=emergency]') == FIX['emergency'] and p15.locator('.period-card').count() == 3)
    ok('day 15: editing locked (sections inert, import and delete disabled)', p15.locator('#app section.card[inert]').count() >= 5 and p15.is_disabled('#importFile') and p15.is_disabled('#clearBtn'))
    p15.evaluate("""() => { const el = document.querySelector('[data-shared=emergency]'); el.value = 'CHANGED'; el.dispatchEvent(new Event('input', { bubbles: true })); document.getElementById('emergencyBtn').click(); document.getElementById('dayBtn').click(); }""")
    p15.wait_for_timeout(600)
    ok('day 15: scripted edits are not saved and no print pack opens', p15.evaluate("localStorage.getItem('subready.binder.v1')") == stored15 and p15.is_hidden('#packWrap'))
    p15.reload(wait_until='networkidle')
    with p15.expect_download() as dl15:
        p15.click('#exportBtn')
    ep = pathlib.Path(tempfile.mkdtemp()) / 'locked.json'; dl15.value.save_as(str(ep))
    ej = json.loads(ep.read_text())
    ok('day 15: Export still works and holds the whole binder', ej.get('kind') == 'class-binder' and len(ej['binder']['classes']) == 3 and ej['binder']['emergency'] == FIX['emergency'])
    ok('day 15: no data lost (storage unchanged)', p15.evaluate("localStorage.getItem('subready.binder.v1')") == stored15)
    ok('day 15: PayPal not loaded before a Subscribe click', not pp_reqs(r15) and p15.locator('script[src*="paypal.com"]').count() == 0)
    shot_l = p15.add_style_tag(content='header.site{position:static !important}')
    p15.evaluate('window.scrollTo(0, 0)')
    p15.screenshot(path=str(screens / (prefix + 'binder-locked.png')), full_page=False)
    shot_l.evaluate('e => e.remove()')
    # Unlock through (stubbed) PayPal checkout
    p15.click('#gatePlans [data-subscribe=teacher]')
    p15.wait_for_selector('#gatePlans .fake-pp')
    sdk = [u for u in pp_reqs(r15) if '/sdk/js' in u]
    ok('subscribe click: SDK requested with the Sub-Ready client id, vault and subscription intent', len(sdk) == 1 and ('client-id=' + CLIENT) in sdk[0] and 'vault=true' in sdk[0] and 'intent=subscription' in sdk[0], sdk[:1])
    p15.click('#gatePlans .fake-pp')
    p15.wait_for_selector('#gatePlans [data-thanks]:not([hidden])')
    ok('approval: only the Teacher plan id is sent to PayPal', p15.evaluate('window.__ppCreate') == {'plan_id': 'P-4HY43543H4125745JNMEW6UY'}, p15.evaluate('window.__ppCreate'))
    th = p15.text_content('#gatePlans [data-thanks]')
    ok('approval: thank-you panel shows the subscription id and how to cancel', 'Thank you' in th and 'I-TESTSUB12345' in th and 'Manage automatic payments' in th, th[:120])
    ok('approval: unlocked flag and id saved locally', p15.evaluate("[localStorage.getItem('subready.unlocked'), localStorage.getItem('subready.subscriptionId')]") == ['1', 'I-TESTSUB12345'])
    ok('approval: binder unlocked in place', p15.locator('#app section.card[inert]').count() == 0 and p15.is_hidden('#lockNote') and p15.text_content('#accessLabel') == 'Teacher plan')
    ok('approval: nothing lost', p15.evaluate("localStorage.getItem('subready.binder.v1')") == stored15)
    p15.evaluate('window.scrollTo(0, 0)')
    p15.locator('#gate').screenshot(path=str(screens / (prefix + 'binder-thanks.png')))
    p15.reload(wait_until='networkidle')
    ok('approval: still unlocked after reload, edits save again', p15.text_content('#accessLabel') == 'Teacher plan' and p15.is_enabled('[data-shared=room]'))
    c15.close()

    # Building plan subscription unlocks too, and says to share the school file
    cb, pb_, rb = plan_ctx(20 * DAYMS)
    pb_.evaluate("window.__ppSubId = 'I-BUILDING12345'")
    pb_.click('#gatePlans [data-subscribe=building]'); pb_.wait_for_selector('#gatePlans .fake-pp'); pb_.click('#gatePlans .fake-pp')
    pb_.wait_for_selector('#gatePlans [data-thanks]:not([hidden])')
    ok('building: only the Building plan id is sent to PayPal', pb_.evaluate('window.__ppCreate') == {'plan_id': 'P-1TV20312FM9343509NMEXBEQ'})
    tb = pb_.text_content('#gatePlans [data-thanks]')
    ok('building: thank-you says to share the school file with staff', 'Building plan' in tb and 'share the school file with your staff' in tb and 'I-BUILDING12345' in tb)
    ok('building: binder unlocked, labeled Building plan', pb_.text_content('#accessLabel') == 'Building plan' and pb_.locator('#app section.card[inert]').count() == 0)
    cb.close()

    # Restore on another device
    cr, pr, rr = plan_ctx(30 * DAYMS)
    pr.click('#gatePlans [data-restore] summary')
    ok('restore: copy is honest (no server check)', 'doesn\u2019t check the ID with PayPal' in pr.text_content('#gatePlans [data-restore]'))
    pr.fill('#gatePlans [data-restore-input]', 'not-an-id'); pr.click('#gatePlans [data-restore-btn]')
    ok('restore: bad id refused, still locked', 'starts with I-' in pr.text_content('#gatePlans [data-restore-msg]') and pr.text_content('#accessLabel') == 'Trial ended')
    pr.fill('#gatePlans [data-restore-input]', ' i-restore12345 '); pr.click('#gatePlans [data-restore-btn]')
    ok('restore: pasted id unlocks this browser', pr.text_content('#accessLabel') == 'Teacher plan' and pr.evaluate("localStorage.getItem('subready.subscriptionId')") == 'I-RESTORE12345' and pr.locator('#app section.card[inert]').count() == 0)
    ok('restore: no PayPal request at all', not pp_reqs(rr))
    ok('restore: data intact', pr.input_value('[data-shared=emergency]') == FIX['emergency'])
    cr.close()

    # Building plan hidden while its id is empty
    cfg_nob = "window.SUB_READY_CONFIG={PAYPAL_CLIENT_ID:'" + CLIENT + "',TEACHER_PLAN_ID:'P-4HY43543H4125745JNMEW6UY',BUILDING_PLAN_ID:'',TRIAL_ON:true,TRIAL_DAYS:14};"
    cn = b.new_context(viewport={'width': 1280, 'height': 900})
    cn.route('**/js/config.js', lambda route: route.fulfill(status=200, content_type='application/javascript', body=cfg_nob))
    pn = cn.new_page(); pn.goto(base, wait_until='networkidle')
    ok('empty Building id: no Building subscribe button, shows "Coming soon"', pn.locator('#plans [data-subscribe=building]').count() == 0 and 'Coming soon' in pn.text_content('#plans [data-plan-card=building]') and pn.locator('#plans [data-subscribe=teacher]').count() == 1)
    cn.close()

    # Real PayPal SDK on the landing page (renders the buttons; no payment is made)
    cl = b.new_context(viewport={'width': 1280, 'height': 900})
    rl = []
    pl = cl.new_page(); pl.on('request', lambda r: rl.append(r.url)); pl.on('pageerror', lambda e: errors.append(str(e)))
    rsp = pl.goto(base + '?src=pack', wait_until='networkidle')
    ok('?src=pack: landing loads normally (HTTP %s)' % rsp.status, rsp.status == 200 and pl.locator('#tool').count() == 1 and pl.is_visible('#heroFind'))
    ok('?src=pack: no outside request before Subscribe', not [u for u in rl if not u.startswith(base) and not u.startswith('data:') and not u.startswith('blob:')])
    pl.goto(base + 'binder.html?src=pack', wait_until='networkidle')
    ok('?src=pack: binder loads normally', pl.is_visible('#app') and 'Free trial' in pl.text_content('#accessLabel'))
    pl.goto(base + '#pricing', wait_until='networkidle')
    before = [u for u in rl if 'paypal.com' in u]
    pl.click('#plans [data-subscribe=teacher]')
    try:
        pl.wait_for_selector('#plans [data-pp-slot=teacher] iframe', timeout=25000); t_ok = True
    except Exception:
        t_ok = False
    ok('real PayPal: Teacher button renders with the Sub-Ready client id', t_ok and not before, pl.text_content('[data-pay-msg]'))
    pl.click('#plans [data-subscribe=building]')
    try:
        pl.wait_for_selector('#plans [data-pp-slot=building] iframe', timeout=25000); b_ok = True
    except Exception:
        b_ok = False
    ok('real PayPal: Building button renders too (same SDK, loaded once)', b_ok and pl.locator('script[src*="paypal.com/sdk"]').count() == 1)
    pl.wait_for_timeout(2500)
    hosts = sorted(set(u.split('/')[2] for u in rl if not u.startswith(base) and not u.startswith('data:') and not u.startswith('blob:')))
    ok('real PayPal: outside requests only to PayPal after the click', hosts and all(h.endswith('paypal.com') or h.endswith('paypalobjects.com') for h in hosts), ' '.join(hosts))
    ok('real PayPal: no error message shown', pl.is_hidden('[data-pay-msg]'))
    shot_p = pl.add_style_tag(content='header.site{position:static !important}')
    pl.locator('#pro').screenshot(path=str(screens / (prefix + 'pricing-paypal.png')))
    shot_p.evaluate('e => e.remove()')
    cl.close()
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
    ok('note: two QR codes (email + text)', note.locator('.qr-row svg.qr').count() == 2)
    hrefs = note.locator('figure').evaluate_all('els => els.map(e => e.getAttribute("data-href"))')
    ok('note: links go to the teacher\u2019s own address and number', hrefs[0].startswith('mailto:ms.rivera@lincoln.example.org?subject=') and hrefs[1].startswith('sms:5552014477?&body='), hrefs)
    from urllib.parse import unquote
    secrets5 = ['Jaylen', 'Noah', 'Ava', 'Maya', 'Will R', 'Grace', 'Siobhan', 'Nguyen', 'EpiPen', 'Door 6']
    ok('note: no student name or binder notes in the links', all(not any(x.lower() in unquote(h).lower() for x in secrets5) for h in hrefs))
    if cv2 is not None:
        for i, kind in enumerate(['email', 'text']):
            big_css = pg5.add_style_tag(content='.qr-fig svg{width:420px !important;height:420px !important}')
            qp = tempfile.mktemp(suffix='.png'); note.locator('.qr-row svg.qr').nth(i).screenshot(path=qp)
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
