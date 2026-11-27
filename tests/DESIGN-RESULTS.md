# Design test results

Command: `node tests/run-design-tests.js`  
**37 passed, 0 failed**

| Group | Check | Result |
|---|---|---|
| contrast | backdrop gradient found (6 colours) | PASS |
| contrast | ink text on glass panels >= 4.5:1 (worst 15.27) | PASS |
| contrast | ink text straight on the page backdrop >= 4.5:1 (worst 13.06) | PASS |
| contrast | muted text on glass panels >= 4.5:1 (worst 7.98) | PASS |
| contrast | muted text straight on the page backdrop >= 4.5:1 (worst 6.83) | PASS |
| contrast | link text on glass panels >= 4.5:1 (worst 6.30) | PASS |
| contrast | link text straight on the page backdrop >= 4.5:1 (worst 5.39) | PASS |
| contrast | accent-d text on glass panels >= 4.5:1 (worst 7.29) | PASS |
| contrast | accent-d text straight on the page backdrop >= 4.5:1 (worst 6.24) | PASS |
| contrast | button text: white on accent >= 4.5:1 (5.57) | PASS |
| contrast | button hover: white on accent-d >= 4.5:1 | PASS |
| contrast | badge: green on green-bg >= 4.5:1 (5.67) | PASS |
| contrast | "Not provided": ph on ph-bg >= 4.5:1 (6.47) | PASS |
| contrast | disabled button text >= 4.5:1 | PASS |
| glass | translucent panels with backdrop-filter blur + saturate (and -webkit-) | PASS |
| glass | solid fallback when backdrop-filter is unsupported | PASS |
| glass | solid fallback for prefers-reduced-transparency | PASS |
| glass | prefers-reduced-motion turns transitions off | PASS |
| glass | system font stack (SF first), no web fonts | PASS |
| glass | soft layered gradients behind everything | PASS |
| glass | rounded corners and subtle highlight | PASS |
| glass | mobile layout rules present | PASS |
| print | print is plain: no blur, shadows or gradient backdrop | PASS |
| print | print is black on white | PASS |
| print | the What’s new box never prints | PASS |
| fast | no outside stylesheets, scripts, fonts or CDNs | PASS |
| fast | each page has a viewport meta and theme colour | PASS |
| fast | stylesheet stays small (< 40 KB) | PASS |
| whats new | landing page says it is actively being built | PASS |
| whats new | the app (binder) says it too | PASS |
| whats new | the one-day tool links to what’s new | PASS |
| whats new | index.html: lists real recent additions (6) | PASS |
| whats new | index.html: no dates, user counts or testimonials | PASS |
| whats new | binder.html: lists real recent additions (6) | PASS |
| whats new | binder.html: no dates, user counts or testimonials | PASS |
| whats new | plans still "coming soon", nothing for sale | PASS |
| whats new | no fake urgency anywhere | PASS |
