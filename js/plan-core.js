/* Sub-Ready plans: trial clock, local unlock, restore. Pure logic, no network. Works in the browser and in Node tests.
   Honor-based: there is no server, so nothing here verifies a subscription with PayPal. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SubReadyPlans = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var DAY = 86400000;
  var KEYS = { trialStart: 'subready.trialStart', unlocked: 'subready.unlocked', subId: 'subready.subscriptionId', plan: 'subready.plan', unlockedAt: 'subready.unlockedAt' };
  var PLANS = {
    teacher: { key: 'teacher', name: 'Teacher', price: '$5', per: 'per teacher, per month', cfg: 'TEACHER_PLAN_ID' },
    building: { key: 'building', name: 'Building', price: '$49', per: 'per school, per month', cfg: 'BUILDING_PLAN_ID' }
  };

  function get(st, k) { try { return st.getItem(k); } catch (e) { return null; } }
  function set(st, k, v) { try { st.setItem(k, String(v)); return true; } catch (e) { return false; } }
  function trialDays(cfg) { var d = parseInt(cfg && cfg.TRIAL_DAYS, 10); return d > 0 && d < 366 ? d : 14; }
  function planId(cfg, key) { var p = PLANS[key]; var id = p && cfg && cfg[p.cfg]; return typeof id === 'string' && /^P-[A-Z0-9]{10,40}$/.test(id.trim()) ? id.trim() : ''; }
  // Plans that can be bought right now (their id is filled in). Others show "coming soon".
  function offers(cfg) { return Object.keys(PLANS).map(function (k) { return { key: k, name: PLANS[k].name, price: PLANS[k].price, per: PLANS[k].per, planId: planId(cfg, k), forSale: !!planId(cfg, k) }; }); }

  function readState(st) {
    var ts = parseInt(get(st, KEYS.trialStart), 10);
    return { trialStart: isFinite(ts) && ts > 0 ? ts : null, unlocked: get(st, KEYS.unlocked) === '1', subscriptionId: get(st, KEYS.subId) || '', plan: get(st, KEYS.plan) || '' };
  }
  // Starts the trial on first use in this browser. Never moves an existing start date.
  function ensureTrialStart(st, now) {
    var s = readState(st);
    if (s.trialStart) return s.trialStart;
    var t = typeof now === 'number' ? now : Date.now();
    set(st, KEYS.trialStart, t);
    return t;
  }
  // Whole days since the trial started (0 on the first day). A clock set back before the start counts as day 0.
  function trialDay(start, now) { if (!start) return 0; return Math.max(0, Math.floor((now - start) / DAY)); }

  // mode: 'free' (switch off or nothing for sale) | 'paid' | 'trial' | 'locked'
  function access(cfg, state, now) {
    cfg = cfg || {}; state = state || {};
    now = typeof now === 'number' ? now : Date.now();
    var days = trialDays(cfg);
    if (!cfg.TRIAL_ON) return { enabled: true, mode: 'free', label: 'Free early access' };
    if (state.unlocked) return { enabled: true, mode: 'paid', label: state.plan === 'building' ? 'Building plan' : 'Teacher plan' };
    if (!planId(cfg, 'teacher')) return { enabled: true, mode: 'free', label: 'Free early access' };
    var day = trialDay(state.trialStart, now);
    var left = state.trialStart ? days - day : days;
    if (left > 0) return { enabled: true, mode: 'trial', day: day, daysLeft: left, trialDays: days, label: 'Free trial \u00b7 ' + left + (left === 1 ? ' day' : ' days') + ' left', endsAt: (state.trialStart || now) + days * DAY };
    return { enabled: false, mode: 'locked', day: day, daysLeft: 0, trialDays: days, label: 'Trial ended', endsAt: state.trialStart + days * DAY };
  }

  // PayPal subscription ids look like I-BW452GLLEP1G.
  function cleanSubscriptionId(s) {
    var v = String(s == null ? '' : s).trim().toUpperCase().replace(/\s+/g, '');
    return /^I-[A-Z0-9]{6,30}$/.test(v) ? v : '';
  }
  // Saves the unlock locally. Touches only the plan keys, never the binder.
  function unlock(st, subscriptionId, plan, now) {
    var id = cleanSubscriptionId(subscriptionId);
    if (!id) return { ok: false, error: 'That doesn\u2019t look like a PayPal subscription ID. It starts with I- (for example I-AB12CD34EF56).' };
    var ok = set(st, KEYS.unlocked, '1') && set(st, KEYS.subId, id);
    set(st, KEYS.plan, PLANS[plan] ? plan : 'teacher');
    set(st, KEYS.unlockedAt, typeof now === 'number' ? now : Date.now());
    return ok ? { ok: true, subscriptionId: id } : { ok: false, error: 'This browser blocks saving, so the unlock can\u2019t be kept here.' };
  }
  function sdkUrl(cfg) {
    var id = cfg && cfg.PAYPAL_CLIENT_ID;
    if (!id || !/^[A-Za-z0-9_-]{20,120}$/.test(id)) return '';
    return 'https://www.paypal.com/sdk/js?client-id=' + encodeURIComponent(id) + '&vault=true&intent=subscription';
  }
  return { DAY: DAY, KEYS: KEYS, PLANS: PLANS, trialDays: trialDays, planId: planId, offers: offers, readState: readState, ensureTrialStart: ensureTrialStart, trialDay: trialDay, access: access, cleanSubscriptionId: cleanSubscriptionId, unlock: unlock, sdkUrl: sdkUrl };
});
