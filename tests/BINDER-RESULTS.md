# Class binder test results

Run: 2026-11-27T11:37:49.534Z (UTC)  
Command: `node tests/run-binder-tests.js`  
**162 passed, 0 failed** (162 checks)

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
| print pack | pack = cover + schedule + one sheet per period + end-of-day note + emergency sheet | PASS | 7 |
| print pack | order: cover, schedule, periods, end-of-day note, emergency | PASS |  |
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
| quick-win fields | new fields exist on an empty binder | PASS |  |
| quick-win fields | they are optional (not in the gap check) | PASS |  |
| quick-win fields | export -> import keeps them | PASS |  |
| quick-win fields | printed on the schedule page when filled in | PASS |  |
| quick-win fields | not printed at all when blank (no "Not provided" noise) | PASS |  |
| quick-win fields | phone policy and rules go to the one-day tool as routines | PASS |  |
| quick-win fields | pronunciation names join the names hidden from the AI | PASS | Jaylen Noah Ava T. Maya L. Will R. Grace S. Siobhan Nguyen |
| seating chart | each period starts with an empty 5 x 6 chart | PASS |  |
| seating chart | rows/cols clamped to 1-10 | PASS |  |
| seating chart | bad, duplicate, blank and off-grid seats dropped | PASS | ["A","NNNNN"] |
| seating chart | name/say/note trimmed to 40/60/120, no newlines | PASS |  |
| seating chart | seat count capped at 100 | PASS |  |
| seating chart | export -> import keeps the chart | PASS |  |
| seating chart | save -> reload keeps the chart | PASS |  |
| seating chart | chart page follows its period page | PASS |  |
| seating chart | only periods with seats get a chart page | PASS |  |
| seating chart | grid is rows x cols (4 x 5 = 20 cells) | PASS |  |
| seating chart | front of the room marked at the top | PASS |  |
| seating chart | name, how to say it and note printed in the right cell | PASS |  |
| seating chart | chart names escaped | PASS |  |
| seating chart | chart names from every period join the names hidden from the AI | PASS | Jaylen Noah Ava T. Maya L. Will R. Grace S. Siobhan <b>X</b> |
| seating chart | that name is not in the student list (chart only) | PASS |  |
| seating chart | chart-only name never reaches the AI prompt (gap + script prompts) | PASS | You are helping a teacher prepare plans for a substitute teacher who has never been in this classroom and cannot ask que |
| end-of-day note | printed form is in every pack, before the emergency sheet | PASS |  |
| end-of-day note | form lists each period in the pack with a rating | PASS |  |
| end-of-day note | form has what got done / didn’t / anything to know | PASS |  |
| end-of-day note | no contact -> no QR code | PASS |  |
| end-of-day note | mailto: to the teacher’s own address | PASS |  |
| end-of-day note | sms: to the teacher’s own number (digits only) | PASS |  |
| end-of-day note | prefilled body is a blank form with room and date | PASS | End-of-day note, Room 214, Tuesday, December 2 How it went: Done: Not done: Anything I should know: From: |
| end-of-day note | links stay short enough for a small printed QR (< 300 chars) | PASS | 263/176 |
| end-of-day note | subject has room and date only | PASS |  |
| end-of-day note | privacy: no student name or binder notes in either link | PASS |  |
| end-of-day note | two QR codes, drawn locally, each encoding exactly its link | PASS |  |
| end-of-day note | says nothing is sent until the sub presses send | PASS |  |
| end-of-day note | QR codes are inline SVG (no image request) | PASS |  |
| end-of-day note | email rejected: query injection | PASS |  |
| end-of-day note | email rejected: header injection | PASS |  |
| end-of-day note | email rejected: plain text | PASS |  |
| end-of-day note | email rejected: no TLD | PASS |  |
| end-of-day note | email rejected: brackets | PASS |  |
| end-of-day note | email rejected: comma list | PASS |  |
| end-of-day note | phone: formatting stripped, +country kept | PASS |  |
| end-of-day note | phone rejected: letters / too short / injection | PASS |  |
| end-of-day note | bad contact -> no QR, flagged in the gap check | PASS |  |
| end-of-day note | emergency mode note has a write-in date | PASS |  |
| school file | lesson bank: duplicates and empty plans dropped | PASS |  |
| school file | envelope: app/kind/version | PASS |  |
| school file | has bells, procedures, contacts by role and lessons | PASS |  |
| school file | never includes students, health notes, pronunciations, charts, periods or the teacher’s own contact | PASS | students,students |
| school file | a procedure line that names a student is dropped and reported | PASS |  |
| school file | parse: round trip | PASS |  |
| school file | parse: a class binder file is refused with a clear message | PASS |  |
| school file | parse: other JSON / empty / not JSON / newer version refused | PASS |  |
| school file | merge: fills blank fields | PASS |  |
| school file | merge: never overwrites the teacher’s own text | PASS |  |
| school file | merge: contacts matched by role (case-insensitive), blanks filled, new roles added | PASS |  |
| school file | merge: lessons added to the bank | PASS |  |
| school file | merge: importing the same file twice changes nothing | PASS |  |
| school file | merge: periods and student data untouched | PASS |  |
| school file | bell schedule prints on the schedule page | PASS |  |
| school file | lesson bank capped at 30 | PASS |  |
| school file | school file behind the same gate as the binder (lives on binder.html only) | PASS |  |
| story activity | saved: export -> import keeps the story settings | PASS |  |
| story activity | minutes per turn: junk cleared | PASS |  |
| story activity | storyOn only accepts yes | PASS |  |
| story activity | adds two sheets (sub instructions + story page) only for that period | PASS | 9 |
| story activity | story sheets follow their period | PASS |  |
| story activity | groups, timed turns and pass-the-page steps | PASS |  |
| story activity | timing guide uses the minutes per turn | PASS |  |
| story activity | blank starter uses a ready-made one | PASS |  |
| story activity | teacher’s own starter printed (escaped) | PASS |  |
| story activity | paper only: no devices, accounts, links or QR | PASS |  |
| story activity | brand-free: no other brand on the story sheets | PASS |  |
| story activity | reminds students not to use classmates’ real names | PASS |  |
| story activity | story page has 8 turn boxes | PASS |  |
| story activity | off by default: base pack unchanged | PASS |  |
| pages | no Rerum or Rerum product names in site files | PASS |  |
| pages | no analytics or tracking scripts | PASS |  |
| pages | binder code makes no network calls | PASS |  |
| pages | compare page: 6 rows (Sub-Ready + 5 tools) | PASS | 6 |
| pages | compare page: every other tool has a source link and as-of date | PASS |  |
| pages | compare page: no repeated customer counts or testimonials | PASS |  |
| pages | landing: plans labeled coming soon, no fake urgency | PASS |  |
| pages | landing: no old "$9 one-time" offer | PASS |  |
