/* Sub-Ready plans UI: pricing cards, Subscribe, thank-you panel, restore on another device.
   The PayPal SDK is added to the page ONLY after a Subscribe click. Sub-Ready sends PayPal no class or student data:
   the only thing passed to PayPal is the plan id. */
(function () {
  'use strict';
  var P = window.SubReadyPlans;
  var CFG = window.SUB_READY_CONFIG || {};
  var sdkPromise = null;

  function storage() {
    try { localStorage.setItem('subready.test', '1'); localStorage.removeItem('subready.test'); return localStorage; }
    catch (e) { var m = {}; return { getItem: function (k) { return k in m ? m[k] : null; }, setItem: function (k, v) { m[k] = String(v); }, removeItem: function (k) { delete m[k]; } }; }
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  function loadSdk() {
    if (window.paypal && window.paypal.Buttons) return Promise.resolve(window.paypal);
    if (sdkPromise) return sdkPromise;
    var url = P.sdkUrl(CFG);
    if (!url) return Promise.reject(new Error('PayPal isn\u2019t set up on this page.'));
    sdkPromise = new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = url; s.async = true; s.setAttribute('data-sdk-integration-source', 'button-factory');
      s.onload = function () { window.paypal && window.paypal.Buttons ? resolve(window.paypal) : reject(new Error('PayPal didn\u2019t load.')); };
      s.onerror = function () { sdkPromise = null; s.remove(); reject(new Error('PayPal couldn\u2019t load. Check your connection and try again.')); };
      document.head.appendChild(s);
    });
    return sdkPromise;
  }

  var CANCEL_HELP = 'To cancel, open PayPal and go to Settings, then Payments, then Manage automatic payments. You won\u2019t be charged after you cancel.';

  function planCard(o, uid) {
    var h = '<div class="plan-card" data-plan-card="' + o.key + '"><h3>' + esc(o.name) + '</h3>' +
      '<p class="plan-price"><span class="amt">' + esc(o.price) + '</span><span class="per">/month</span></p>' +
      '<p class="plan-per">' + esc(o.per) + '. Cancel anytime in PayPal.</p>' +
      (o.key === 'teacher'
        ? '<ul class="plan-list"><li>The class binder: saved periods, seating charts, contacts</li><li>Reusable emergency plan and day plans for several periods</li><li>Front-office print pack</li></ul>'
        : '<ul class="plan-list"><li>Everything in the Teacher plan, for the whole school</li><li>A shared school file staff import: bell schedule, procedures, contacts, any-day lesson bank</li></ul>');
    if (o.forSale) {
      h += '<button class="btn" type="button" data-subscribe="' + o.key + '">Subscribe with PayPal</button>' +
        '<div class="pp-slot" id="pp-' + o.key + '-' + uid + '" data-pp-slot="' + o.key + '" hidden></div>';
    } else {
      h += '<p class="badge soon" data-soon="' + o.key + '">Coming soon</p>';
    }
    return h + '</div>';
  }

  function thanksHtml(id, plan) {
    var b = plan === 'building';
    return '<h3>Thank you! Your ' + (b ? 'Building' : 'Teacher') + ' plan is active in this browser.</h3>' +
      '<p>Your PayPal subscription ID is <code class="sub-id" data-sub-id>' + esc(id) + '</code> ' +
      '<button class="btn ghost small" type="button" data-copy-id>Copy</button></p>' +
      '<p>Keep this ID. You can use it to unlock Sub-Ready on another device with &ldquo;Restore on another device&rdquo;. PayPal also emails you a receipt.</p>' +
      (b ? '<p><strong>Next, share the school file with your staff.</strong> In the class binder, fill in section 6 (bell schedule, procedures, contacts and any-day lessons), click &ldquo;Export a school file&rdquo;, and send that file to your teachers. Each teacher imports it into their own binder. It never contains student information.</p>' : '') +
      '<p class="hint">' + CANCEL_HELP + '</p>' +
      '<p><a class="btn" href="binder.html">Open the class binder</a></p>';
  }

  // opts: { onUnlock(state) }
  function render(el, opts) {
    if (!el) return null;
    opts = opts || {};
    var st = storage();
    var uid = Math.random().toString(36).slice(2, 8);
    var offers = P.offers(CFG);
    var state = P.readState(st);
    el.innerHTML =
      '<div class="plans" data-plans>' + offers.map(function (o) { return planCard(o, uid); }).join('') + '</div>' +
      '<p class="hint pay-privacy">Checkout runs on PayPal. The PayPal button loads only after you click Subscribe, and Sub-Ready sends PayPal no class or student data. Prices are in US dollars.</p>' +
      '<p class="pay-msg" role="status" data-pay-msg hidden></p>' +
      '<div class="thanks" data-thanks tabindex="-1" hidden></div>' +
      '<details class="restore" data-restore><summary>Restore on another device</summary>' +
        '<p class="hint">Already subscribed? Paste your PayPal subscription ID (it starts with I-, and it&rsquo;s in your PayPal receipt). This unlocks the class binder in this browser. Sub-Ready doesn&rsquo;t check the ID with PayPal; it trusts you.</p>' +
        '<div class="restore-row"><label class="sr-only" for="restore-' + uid + '">PayPal subscription ID</label>' +
        '<input id="restore-' + uid + '" data-restore-input placeholder="I-AB12CD34EF56" autocomplete="off" spellcheck="false">' +
        '<button class="btn small" type="button" data-restore-btn>Unlock this browser</button></div>' +
        '<p class="status-line" role="status" data-restore-msg hidden></p>' +
      '</details>';
    var q = function (s) { return el.querySelector(s); };
    function msg(t, bad) { var m = q('[data-pay-msg]'); m.textContent = t; m.hidden = !t; m.classList.toggle('error', !!bad); }
    function showThanks(id, plan) {
      var t = q('[data-thanks]'); t.innerHTML = thanksHtml(id, plan); t.hidden = false;
      q('[data-plans]').hidden = true; q('.pay-privacy').hidden = true; msg('');
      t.querySelector('[data-copy-id]').addEventListener('click', function (e) {
        var btn = e.currentTarget;
        var done = function () { btn.textContent = 'Copied'; };
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(id).then(done, function () {});
        else { var r = document.createRange(); r.selectNodeContents(t.querySelector('[data-sub-id]')); var s = getSelection(); s.removeAllRanges(); s.addRange(r); }
      });
      return t;
    }
    function unlocked(id, plan, fresh) {
      var res = P.unlock(st, id, plan);
      if (!res.ok) return res;
      var t = showThanks(res.subscriptionId, plan);
      if (fresh) { try { t.focus(); t.scrollIntoView({ block: 'center' }); } catch (e) {} }
      if (opts.onUnlock) opts.onUnlock(P.readState(st));
      return res;
    }
    if (state.unlocked && state.subscriptionId) {
      showThanks(state.subscriptionId, state.plan);
      q('[data-thanks] h3').textContent = 'Your ' + (state.plan === 'building' ? 'Building' : 'Teacher') + ' plan is active in this browser.';
    }

    Array.prototype.forEach.call(el.querySelectorAll('[data-subscribe]'), function (btn) {
      btn.addEventListener('click', function () {
        var key = btn.getAttribute('data-subscribe');
        var o = offers.filter(function (x) { return x.key === key; })[0];
        if (!o || !o.forSale) return;
        var slot = el.querySelector('[data-pp-slot="' + key + '"]');
        btn.disabled = true; btn.textContent = 'Loading PayPal\u2026'; msg('');
        loadSdk().then(function (paypal) {
          slot.hidden = false; slot.innerHTML = '';
          return paypal.Buttons({
            style: { shape: 'rect', color: 'gold', layout: 'horizontal', label: 'subscribe' },
            createSubscription: function (data, actions) { return actions.subscription.create({ plan_id: o.planId }); },
            onApprove: function (data) {
              var r = unlocked(data && data.subscriptionID, key, true);
              if (!r.ok) msg('PayPal approved the subscription' + (data && data.subscriptionID ? ' (ID ' + data.subscriptionID + ')' : '') + ', but this browser couldn\u2019t save the unlock. Keep the ID and use Restore.', true);
            },
            onCancel: function () { msg('Checkout was closed. Nothing was charged.'); },
            onError: function () { msg('PayPal reported a problem and nothing was charged. Please try again in a minute.', true); }
          }).render(slot).then(function () { btn.hidden = true; });
        }).catch(function (err) {
          btn.disabled = false; btn.textContent = 'Subscribe with PayPal'; slot.hidden = true;
          msg((err && err.message) || 'PayPal couldn\u2019t load.', true);
        });
      });
    });

    q('[data-restore-btn]').addEventListener('click', function () {
      var m = q('[data-restore-msg]');
      var res = unlocked(q('[data-restore-input]').value, P.readState(st).plan || 'teacher', true);
      m.hidden = false; m.textContent = res.ok ? 'Unlocked in this browser.' : res.error;
      m.classList.toggle('error', !res.ok);
    });
    return { storage: st, loadSdk: loadSdk };
  }

  window.SubReadyPay = { render: render, loadSdk: loadSdk, sdkLoaded: function () { return !!document.querySelector('script[src*="paypal.com/sdk"]'); } };
})();
