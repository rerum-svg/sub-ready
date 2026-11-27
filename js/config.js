// Sub-Ready configuration. Edit only this file to change what is free or paid.
// PAYPAL_CLIENT_ID: public client id of the Sub-Ready PayPal app (public by design, not a secret). One client id per page, used for both plans.
// TEACHER_PLAN_ID / BUILDING_PLAN_ID: PayPal subscription plan ids. An empty id = that plan isn't for sale and shows "coming soon".
// TRIAL_ON: the single switch for the class binder.
//   true  = the one-day tool stays free; the class binder gets a TRIAL_DAYS free trial that starts on first use in that
//           browser, then asks for the Teacher plan. Saved data is never deleted and export always works.
//   false = the class binder is free for everyone (early access), nothing asks for payment.
// The PayPal SDK is loaded only after a Subscribe click, never on page load.
window.SUB_READY_CONFIG = {
  PAYPAL_CLIENT_ID: 'AY5HQPWM12-j5wkw9D6iiTnOuNShiZi9H8WAhLbmHXaZ8EnEQkS5Oy7bW-cGRyJy6XBeayZ8jClFmNyI',
  TEACHER_PLAN_ID: 'P-4HY43543H4125745JNMEW6UY',
  BUILDING_PLAN_ID: 'P-1TV20312FM9343509NMEXBEQ',
  TRIAL_ON: true,
  TRIAL_DAYS: 14
};
