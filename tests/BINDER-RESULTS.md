# Class binder test results

Run: 2026-11-26T16:17:09.524Z (UTC)  
Command: `node tests/run-binder-tests.js`  
**85 passed, 0 failed** (85 checks)

Rendered packs: `tests/out/pack-emergency.html`, `tests/out/pack-day.html`

| Group | Check | Result | Detail |
|---|---|---|---|
| profile | empty binder has every shared field | PASS |  |
| profile | empty binder has one period with an id | PASS |  |
| profile | unknown keys are dropped | PASS |  |
| profile | fixture survives normalize unchanged | PASS |  |
| profile | non-object input rejected | PASS |  |
| profile | periods capped at 12 | PASS |  |
| profile | contacts capped at 20 | PASS |  |
| profile | long fields are trimmed | PASS |  |
| profile | duplicate ids get fresh ids | PASS |  |
| profile | blank period label becomes "Period n" | PASS |  |
| profile | no periods -> one blank period | PASS |  |
| profile | non-string values coerced safely | PASS |  |
| profile | empty contact rows dropped | PASS |  |
| save & reload | nothing saved yet -> load returns null | PASS |  |
| save & reload | save then reload returns the same binder | PASS |  |
| save & reload | stored under subready.binder.v1 only | PASS |  |
| save & reload | edit, save, reload keeps the edit | PASS |  |
| save & reload | corrupted save -> load returns null (no crash) | PASS |  |
| save & reload | delete removes it | PASS |  |
| export & import | export has app/kind/version envelope | PASS |  |
| export & import | export warns to keep the file private | PASS |  |
| export & import | export -> import round trip is identical | PASS |  |
| export & import | double round trip is stable | PASS |  |
| export & import | BOM at start of file is tolerated | PASS |  |
| export & import | bare binder object (classes array) accepted | PASS |  |
| export & import | empty file rejected with a clear message | PASS |  |
| export & import | non-JSON rejected with a clear message | PASS |  |
| export & import | other JSON rejected | PASS |  |
| export & import | wrong Sub-Ready kind rejected | PASS |  |
| export & import | newer version rejected | PASS |  |
| export & import | huge file rejected | PASS |  |
| export & import | array JSON rejected | PASS |  |
| early-access flag | shipped config: PRO_URL is empty | PASS |  |
| early-access flag | shipped config: EARLY_ACCESS is on | PASS |  |
| early-access flag | early access -> enabled, labeled free, not paid | PASS |  |
| early-access flag | flag off, no PRO_URL -> locked, "Coming soon", no link | PASS |  |
| early-access flag | flag off, PRO_URL set, not unlocked -> locked with checkout link | PASS |  |
| early-access flag | flag off, PRO_URL set, unlocked -> enabled as Teacher plan | PASS |  |
| early-access flag | unlock alone without PRO_URL does not enable | PASS |  |
| times | "8:00"-"8:50" | PASS |  |
| times | "12:50"-"1:40" crosses noon | PASS |  |
| times | "1:05 PM"-"1:55 PM" | PASS |  |
| times | range typed in start box | PASS |  |
| times | unreadable time -> null | PASS |  |
| gap check | empty binder flags shared fields and contacts | PASS |  |
| gap check | filled binder has no gaps | PASS | [] |
| gap check | vague any-day plan is flagged ("the usual", "the bin") | PASS | Any-day plan, "Do the usual warm-up": "the usual" assumes the sub already knows your routine. / Any-day plan, "Worksheet |
| gap check | overlapping periods flagged | PASS |  |
| gap check | unreadable time flagged | PASS |  |
| gap check | end before start flagged | PASS |  |
| print pack | emergency plan covers every period | PASS |  |
| print pack | periods sorted by time (P1, P3, P5) | PASS |  |
| print pack | emergency plan uses any-day plans | PASS |  |
| print pack | day plan covers only the chosen periods | PASS |  |
| print pack | today’s lesson overrides the any-day plan | PASS |  |
| print pack | blank lesson falls back to the any-day plan | PASS |  |
| print pack | period with no plan is marked missing | PASS |  |
| print pack | untimed period goes last | PASS |  |
| print pack | pack = cover + schedule + one sheet per period + emergency sheet | PASS | 6 |
| print pack | order: cover, schedule, periods, emergency | PASS |  |
| print pack | student names printed as typed (local only) | PASS |  |
| print pack | contacts printed by role | PASS |  |
| print pack | blank date prints a write-in line | PASS |  |
| print pack | emergency sheet has the procedures | PASS |  |
| print pack | blank fields print "Not provided — ask the office" | PASS |  |
| print pack | HTML in fields is escaped | PASS |  |
| print pack | missing items limited to chosen periods | PASS |  |
| print css | each sheet starts a new printed page | PASS |  |
| print css | last sheet adds no blank page | PASS |  |
| print css | site header, footer and editor are hidden in print | PASS |  |
| print css | rows do not split across pages | PASS |  |
| hand-off | uses the any-day plan when no lesson typed | PASS |  |
| hand-off | carries the period time as a bell entry | PASS |  |
| hand-off | carries emergency info and contacts | PASS |  |
| hand-off | today’s lesson wins when typed | PASS |  |
| hand-off | names to hide = listed names + helpers | PASS | Jaylen Noah Ava T. Maya L. Will R. Grace S. |
| hand-off | unknown period -> null | PASS |  |
| pages | no Rerum or Rerum product names in site files | PASS |  |
| pages | no analytics or tracking scripts | PASS |  |
| pages | binder code makes no network calls | PASS |  |
| pages | compare page: 6 rows (Sub-Ready + 5 tools) | PASS | 6 |
| pages | compare page: every other tool has a source link and as-of date | PASS |  |
| pages | compare page: no repeated customer counts or testimonials | PASS |  |
| pages | landing: plans labeled coming soon, no fake urgency | PASS |  |
| pages | landing: no old "$9 one-time" offer | PASS |  |
