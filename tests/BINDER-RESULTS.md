# Class binder test results

Run: 2026-11-26T22:56:43.448Z (UTC)  
Command: `node tests/run-binder-tests.js`  
**147 passed, 0 failed** (147 checks)

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
| writing activity | shipped config: SCRIPTO_ACTIVITY is off | PASS |  |
| writing activity | label is "Student writing activity (Scripto)" | PASS |  |
| writing activity | valid session link accepted, ?ref=subready added | PASS |  |
| writing activity | surrounding spaces and trailing slash tolerated | PASS |  |
| writing activity | rejected: http | PASS | http://scriptorerum.com/school/s/h7Kq2xW9pL |
| writing activity | rejected: www host | PASS | https://www.scriptorerum.com/school/s/h7Kq2xW9pL |
| writing activity | rejected: look-alike host | PASS | https://scriptorerum.com.evil.example/school/s/h7Kq2xW9pL |
| writing activity | rejected: prefix not at start | PASS | https://evil.example/?u=https://scriptorerum.com/school/s/h7Kq2xW9pL |
| writing activity | rejected: /join link | PASS | https://scriptorerum.com/join/h7Kq2xW9pL |
| writing activity | rejected: /try demo | PASS | https://scriptorerum.com/school/try |
| writing activity | rejected: no token | PASS | https://scriptorerum.com/school/s/ |
| writing activity | rejected: token too short | PASS | https://scriptorerum.com/school/s/abc |
| writing activity | rejected: spaces | PASS | https://scriptorerum.com/school/s/ab cd ef gh |
| writing activity | rejected: path tricks | PASS | https://scriptorerum.com/school/s/h7Kq2xW9pL/../../x |
| writing activity | rejected: javascript: | PASS | javascript:alert(1)//https://scriptorerum.com/school/s/h7Kq2xW9pL |
| writing activity | rejected: encoded junk | PASS | https://scriptorerum.com/school/s/%3Cscript%3E |
| writing activity | empty link is just "not set", no error | PASS |  |
| writing activity | query and fragment are dropped (only the token is kept) | PASS | https://scriptorerum.com/school/s/h7Kq2xW9pL?ref=subready |
| writing activity | token that spells a student name is refused | PASS |  |
| writing activity | fields saved: export -> import keeps link, time slot and notes | PASS |  |
| writing activity | fields saved: save -> reload keeps them | PASS |  |
| writing activity | not part of the gap check (optional) | PASS |  |
| writing activity | flag off: saved link never prints | PASS |  |
| writing activity | flag on: print block appears once, on that period’s sheet | PASS |  |
| writing activity | print block: title | PASS |  |
| writing activity | print block: the three numbered steps from spec 4.3 | PASS | ["Open this link on the teacher computer.","Press Start.","Put the code on the board. Students go to scriptorerum.com/jo |
| writing activity | print block: link as text | PASS |  |
| writing activity | print block: opens in a new tab with rel=noopener | PASS |  |
| writing activity | print block: QR code drawn locally as inline SVG | PASS |  |
| writing activity | print block: QR encodes exactly the cleaned link (deterministic redraw matches) | PASS |  |
| writing activity | print block: privacy line word for word | PASS |  |
| writing activity | print block: time slot and notes for the sub | PASS |  |
| writing activity | privacy: every link in the pack is exactly prefix + token + ?ref=subready | PASS | https://scriptorerum.com/school/s/h7Kq2xW9pL?ref=subready https://scriptorerum.com/school/s/h7Kq2xW9pL?ref=subready |
| writing activity | privacy: no student name, roster or binder text in any link | PASS |  |
| writing activity | privacy: a name pasted into the link’s query is stripped | PASS |  |
| writing activity | privacy: the only text handed to the QR/link builder is the cleaned link | PASS |  |
| writing activity | day-plan field: today’s link prints for that period | PASS |  |
| writing activity | day-plan field: saved binder link still prints for the other period | PASS |  |
| writing activity | invalid link: left out of the print and reported before printing | PASS |  |
| writing activity | notes and time slot are escaped | PASS |  |
| writing activity | brand: never called a "game" | PASS |  |
| writing activity | brand: no prices or upsells in the writing activity copy | PASS |  |
| writing activity | card copy from spec 4.3, linking out to scriptorerum.com/school | PASS |  |
| story activity | saved: export -> import keeps the story settings | PASS |  |
| story activity | minutes per turn: junk cleared | PASS |  |
| story activity | storyOn only accepts yes | PASS |  |
| story activity | adds two sheets (sub instructions + story page) only for that period | PASS | 8 |
| story activity | story sheets follow their period | PASS |  |
| story activity | groups, timed turns and pass-the-page steps | PASS |  |
| story activity | timing guide uses the minutes per turn | PASS |  |
| story activity | blank starter uses a ready-made one | PASS |  |
| story activity | teacher’s own starter printed (escaped) | PASS |  |
| story activity | paper only: no devices, accounts, links or QR | PASS |  |
| story activity | brand-free: no Scripto or other brand on the story sheets | PASS |  |
| story activity | reminds students not to use classmates’ real names | PASS |  |
| story activity | story page has 8 turn boxes | PASS |  |
| story activity | off by default: base pack unchanged | PASS |  |
| pages | no other Rerum brand names anywhere in site files | PASS |  |
| pages | Scripto named only in the optional module and its wiring | PASS |  |
| pages | landing, compare, one-day tool, core and pack code are Scripto-free | PASS |  |
| pages | no analytics or tracking scripts | PASS |  |
| pages | binder code makes no network calls | PASS |  |
| pages | writing-session module and QR library make no network calls | PASS |  |
| pages | no iframe or embed anywhere | PASS |  |
| pages | QR library is the MIT one, license kept | PASS |  |
| pages | compare page: 6 rows (Sub-Ready + 5 tools) | PASS | 6 |
| pages | compare page: every other tool has a source link and as-of date | PASS |  |
| pages | compare page: no repeated customer counts or testimonials | PASS |  |
| pages | landing: plans labeled coming soon, no fake urgency | PASS |  |
| pages | landing: no old "$9 one-time" offer | PASS |  |
