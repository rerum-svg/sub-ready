# Sub-Ready test results

Run: 2026-11-27T12:08:08.827Z (UTC)  
Command: `node tests/run-tests.js`  
**155 passed, 0 failed** (155 checks)

Canned AI replies imitate real chatbot output: prose around fences, trailing commas, unquoted keys, single quotes, a truncated reply, altered name tokens, out-of-order and end-before-start times, and one invented line ("pizza party") that the grounding check should flag.

## Samples

### 2nd grade, self-contained (elementary) (`elem-2nd`)

- Names hidden: Maya L., Will R., Jaylen
- Checklist (no-AI) flags: ""the usual" assumes the sub already knows your routine."; "Abbreviation DOL may mean nothing to a sub."; ""the green bin": a stranger won’t know where this is."; ""if time" assumes the sub already knows your routine."; ""the tray": a stranger won’t know where this is."; "Abbreviation WS may mean nothing to a sub."
- Questions asked (8):
  - [AI] What exactly is the morning work and where is it?
  - [AI] What does DOL stand for and how should the sub run it?
  - [AI] Where is the green bin, and what does each reading group do?
  - [AI] What should stations look like if there is time?
  - [AI] Who walks the class to art with Mrs K, and when do they come back?
  - [checklist] Where exactly is "the tray"? (e.g. "blue tub on the shelf under the window")
  - [checklist] What does WS mean, in plain words a sub would understand?
  - [checklist] Emergency basics: where is the evacuation route / emergency folder, and who should the sub call for help?
- Schedule: 8:15 AM–8:30 AM Morning work | [no time] Daily oral language and calendar | [no time] Reading groups | 10:00 AM Snack | [no time] Math | 11:30 AM–12:05 PM Lunch | 12:10 PM–12:55 PM Art with Mrs K | [no time] Read aloud | [no time] Pack up
- Warnings: none
- Missing (shown as "ask the office"): Stations instructions were not provided. / 5 block(s) have no time — check the bell schedule.
- Lines marked Check (not found in teacher's notes): 0
- Rendered: `tests/out/elem-2nd.html`, no-AI version `tests/out/elem-2nd-basic.html`

### 7th grade math, 3 periods (middle school) (`ms-math`)

- Names hidden: Grace S, Destiny M
- Checklist (no-AI) flags: ""projector" may need a login, device or setup the sub doesn’t have."; "Abbreviation HW may mean nothing to a sub."; ""IXL" may need a login, device or setup the sub doesn’t have."; "Abbreviation IXL may mean nothing to a sub."
- Questions asked (6):
  - [AI] How does the sub log in to the laptop/projector without a password on the plan?
  - [AI] Where exactly is cart B and how are chromebooks numbered?
  - [AI] What is the procedure for the 5th period lunch duty?
  - [AI] What should students do if they finish IXL M.7 early?
  - [checklist] What does HW mean, in plain words a sub would understand?
  - [checklist] How and when should the sub take attendance?
- Schedule: 8:55 AM–9:45 AM (bell) Period 2 | 10:40 AM–11:30 AM (bell) Period 4 | 11:30 AM–12:05 PM (bell) Lunch | 1:10 PM–2:00 PM (bell) Period 6
- Warnings: 1 line(s) use words that aren’t in your notes. They’re marked “Check” — read them before printing.
- Missing (shown as "ask the office"): Lunch duty details
- Lines marked Check (not found in teacher's notes): 1
- Rendered: `tests/out/ms-math.html`, no-AI version `tests/out/ms-math-basic.html`

### 10th grade English (high school) (`hs-english`)

- Names hidden: May B., Hunter J., May
- Checklist (no-AI) flags: ""google classroom" may need a login, device or setup the sub doesn’t have."; "Abbreviation SSR may mean nothing to a sub."; ""as always" assumes the sub already knows your routine."; ""the basket": a stranger won’t know where this is."
- Questions asked (8):
  - [AI] How can the sub show the journal prompt without Google Classroom access?
  - [AI] Where exactly is the cast list for Act 3?
  - [AI] What does SSR mean and where do students get books?
  - [AI] What are the discussion groups and how long should discussion last?
  - [AI] What should the sub do if a student refuses to put a phone away?
  - [AI] Where is the basket for packets?
  - [checklist] For "DON'T let them use phones, phone caddy rule as always": what exactly should the sub say or do, step by step?
  - [checklist] Emergency basics: where is the evacuation route / emergency folder, and who should the sub call for help?
- Schedule: 7:45 AM–9:15 AM Block 1 | 11:10 AM–12:40 PM Block 3
- Warnings: none
- Missing (shown as "ask the office"): none
- Lines marked Check (not found in teacher's notes): 0
- Rendered: `tests/out/hs-english.html`, no-AI version `tests/out/hs-english-basic.html`

### Kindergarten, rushed phone notes (no times at all) (`k-halfday`)

- Names hidden: Jaylen, Ava T., Noah
- Checklist (no-AI) flags: ""ipad" may need a login, device or setup the sub doesn’t have."; ""like normal" assumes the sub already knows your routine."; ""kids know" assumes the sub already knows your routine."; "No times or periods anywhere, so the sub can’t pace the day."
- Questions asked (8):
  - [AI] What are the centers and how do kids rotate?
  - [AI] What times are circle, recess, snack and dismissal?
  - [AI] How does the sub unlock the iPad for the weather song?
  - [checklist] For "centers like normal": what exactly should the sub say or do, step by step?
  - [checklist] For "recess - kids know the bell": what exactly should the sub say or do, step by step?
  - [checklist] Emergency basics: where is the evacuation route / emergency folder, and who should the sub call for help?
  - [checklist] What should students do if they finish early?
  - [checklist] How and when should the sub take attendance?
- Schedule: 8:30 AM Circle time | [no time] Centers | 10:15 AM–10:40 AM Recess | 10:40 AM–11:45 AM Snack and letter Bb | 11:45 AM Dismissal
- Warnings: 2 line(s) use words that aren’t in your notes. They’re marked “Check” — read them before printing.
- Missing (shown as "ask the office"): Emergency procedures / 1 block(s) have no time — check the bell schedule.
- Lines marked Check (not found in teacher's notes): 2
- Rendered: `tests/out/k-halfday.html`, no-AI version `tests/out/k-halfday-basic.html`

### Chemistry, mixed format + overlapping times (`hs-chem-split`)

- Names hidden: Art, Will
- Checklist (no-AI) flags: "Abbreviation CHEM may mean nothing to a sub."; "Abbreviation LAB may mean nothing to a sub."
- Questions asked (8):
  - [AI] Is the safety video link on a laptop or printed?
  - [AI] How many calculators are in the box?
  - [AI] Where are the ws 5.2 copies?
  - [AI] Can 7th period use notes on ws 5.2?
  - [AI] Who can help with the projector?
  - [AI] Should the sub collect the worksheets or let kids finish at home?
  - [AI] Extra question 7?
  - [checklist] What does CHEM mean, in plain words a sub would understand?
- Schedule: 9:50 AM–10:40 AM 3rd period | 10:30 AM Bad block | 1:55 PM–2:45 PM 7th period
- Warnings: "Bad block": end time is before start time. Please check. / "3rd period" overlaps "Bad block" (10:30 AM starts before 10:40 AM).
- Missing (shown as "ask the office"): none
- Lines marked Check (not found in teacher's notes): 0
- Rendered: `tests/out/hs-chem-split.html`, no-AI version `tests/out/hs-chem-split-basic.html`

## All checks

| Group | Check | Result | Detail |
|---|---|---|---|
| elem-2nd | pipeline runs without throwing | PASS |  |
| elem-2nd | no student names in AI prompts | PASS |  |
| elem-2nd | all expected names detected/listed | PASS | Maya L., Will R., Jaylen |
| elem-2nd | gap reply parsed (or partial reply recovered) | PASS |  |
| elem-2nd | 5-8 questions produced | PASS | 8 |
| elem-2nd | lint flagged at least one gap on its own | PASS |  |
| elem-2nd | schedule has expected blocks | PASS | 9 |
| elem-2nd | output contains "Maya L." | PASS |  |
| elem-2nd | output contains "Will R." | PASS |  |
| elem-2nd | output contains "Not provided" | PASS |  |
| elem-2nd | right name in right place: "Will R.'s group goes first" | PASS |  |
| elem-2nd | right name in right place: "Maya L.: Line leader" | PASS |  |
| elem-2nd | right name in right place: "Will R.: Knows where everything is" | PASS |  |
| elem-2nd | no [STUDENT_n] tokens left in output | PASS |  |
| elem-2nd | all 6 sections rendered | PASS |  |
| elem-2nd | grounding check flags invented lines (>= 0) | PASS | 0 |
| elem-2nd | timed blocks are in chronological order | PASS |  |
| elem-2nd | no-AI basic fallback also renders | PASS |  |
| ms-math | pipeline runs without throwing | PASS |  |
| ms-math | no student names in AI prompts | PASS |  |
| ms-math | all expected names detected/listed | PASS | Grace S, Destiny M |
| ms-math | gap reply parsed (or partial reply recovered) | PASS |  |
| ms-math | 5-8 questions produced | PASS | 6 |
| ms-math | lint flagged at least one gap on its own | PASS |  |
| ms-math | schedule has expected blocks | PASS | 4 |
| ms-math | output contains "8:55 AM" | PASS |  |
| ms-math | output contains "1:10 PM" | PASS |  |
| ms-math | output contains "Grace S" | PASS |  |
| ms-math | output contains "Destiny M" | PASS |  |
| ms-math | output contains "Check" | PASS |  |
| ms-math | right name in right place: "chatty; Grace S sits up front" | PASS |  |
| ms-math | right name in right place: "Destiny M: Can pass out chromebooks" | PASS |  |
| ms-math | no [STUDENT_n] tokens left in output | PASS |  |
| ms-math | all 6 sections rendered | PASS |  |
| ms-math | grounding check flags invented lines (>= 1) | PASS | 1 |
| ms-math | timed blocks are in chronological order | PASS |  |
| ms-math | missing times filled from bell schedule | PASS |  |
| ms-math | no-AI basic fallback also renders | PASS |  |
| hs-english | pipeline runs without throwing | PASS |  |
| hs-english | no student names in AI prompts | PASS |  |
| hs-english | all expected names detected/listed | PASS | May B., Hunter J., May |
| hs-english | gap reply parsed (or partial reply recovered) | PASS |  |
| hs-english | 5-8 questions produced | PASS | 8 |
| hs-english | lint flagged at least one gap on its own | PASS |  |
| hs-english | schedule has expected blocks | PASS | 2 |
| hs-english | output contains "7:45 AM" | PASS |  |
| hs-english | output contains "12:40 PM" | PASS |  |
| hs-english | output contains "May B." | PASS |  |
| hs-english | output contains "Hunter J." | PASS |  |
| hs-english | output contains "(90 min)" | PASS |  |
| hs-english | right name in right place: "May B. leads group 2" | PASS |  |
| hs-english | right name in right place: "May B.: Group 2 leader" | PASS |  |
| hs-english | right name in right place: "Hunter J.: Tech help" | PASS |  |
| hs-english | no [STUDENT_n] tokens left in output | PASS |  |
| hs-english | all 6 sections rendered | PASS |  |
| hs-english | grounding check flags invented lines (>= 0) | PASS | 0 |
| hs-english | timed blocks are in chronological order | PASS |  |
| hs-english | no-AI basic fallback also renders | PASS |  |
| k-halfday | pipeline runs without throwing | PASS |  |
| k-halfday | no student names in AI prompts | PASS |  |
| k-halfday | all expected names detected/listed | PASS | Jaylen, Ava T., Noah |
| k-halfday | gap reply parsed (or partial reply recovered) | PASS |  |
| k-halfday | 5-8 questions produced | PASS | 8 |
| k-halfday | lint flagged at least one gap on its own | PASS |  |
| k-halfday | schedule has expected blocks | PASS | 5 |
| k-halfday | output contains "Jaylen" | PASS |  |
| k-halfday | output contains "Ava T." | PASS |  |
| k-halfday | output contains "8:30 AM" | PASS |  |
| k-halfday | output contains "Not provided" | PASS |  |
| k-halfday | right name in right place: "Jaylen sits next to you" | PASS |  |
| k-halfday | right name in right place: "Ava T. has an EpiPen" | PASS |  |
| k-halfday | no [STUDENT_n] tokens left in output | PASS |  |
| k-halfday | all 6 sections rendered | PASS |  |
| k-halfday | grounding check flags invented lines (>= 0) | PASS | 2 |
| k-halfday | timed blocks are in chronological order | PASS |  |
| k-halfday | no-AI basic fallback also renders | PASS |  |
| hs-chem-split | pipeline runs without throwing | PASS |  |
| hs-chem-split | no student names in AI prompts | PASS |  |
| hs-chem-split | all expected names detected/listed | PASS | Art, Will |
| hs-chem-split | gap reply parsed (or partial reply recovered) | PASS |  |
| hs-chem-split | 5-8 questions produced | PASS | 8 |
| hs-chem-split | lint flagged at least one gap on its own | PASS |  |
| hs-chem-split | schedule has expected blocks | PASS | 3 |
| hs-chem-split | output contains "9:50 AM" | PASS |  |
| hs-chem-split | output contains "1:55 PM" | PASS |  |
| hs-chem-split | output contains "Art" | PASS |  |
| hs-chem-split | output contains "Will" | PASS |  |
| hs-chem-split | right name in right place: "Art and Will cannot sit together" | PASS |  |
| hs-chem-split | no [STUDENT_n] tokens left in output | PASS |  |
| hs-chem-split | all 6 sections rendered | PASS |  |
| hs-chem-split | grounding check flags invented lines (>= 0) | PASS | 0 |
| hs-chem-split | timed blocks are in chronological order | PASS |  |
| hs-chem-split | out-of-order blocks re-sorted | PASS | 3rd period |
| hs-chem-split | end-before-start detected | PASS |  |
| hs-chem-split | no-AI basic fallback also renders | PASS |  |
| edge | empty input rejected | PASS |  |
| edge | whitespace-only input rejected | PASS |  |
| edge | too-short input rejected | PASS |  |
| edge | huge input rejected | PASS |  |
| edge | normal input accepted | PASS |  |
| edge | lint on empty plan does not crash | PASS |  |
| edge | empty AI reply -> friendly error | PASS |  |
| edge | prose-only AI reply -> friendly error | PASS |  |
| edge | garbage AI reply -> friendly error | PASS |  |
| edge | malformed JSON recovered: trailing commas | PASS |  |
| edge | malformed JSON recovered: smart quotes | PASS |  |
| edge | malformed JSON recovered: unquoted keys + single quotes | PASS |  |
| edge | malformed JSON recovered: prose before and after fence | PASS |  |
| edge | malformed JSON recovered: unterminated fence | PASS |  |
| edge | malformed JSON recovered: truncated mid-array | PASS |  |
| edge | malformed JSON recovered: comments inside | PASS |  |
| edge | malformed JSON recovered: Python-style None/True | PASS |  |
| edge | string/odd-shaped fields normalized | PASS |  |
| edge | empty sections become visible placeholders | PASS |  |
| edge | untimed blocks show time placeholder | PASS |  |
| edge | completely empty AI object still renders | PASS |  |
| edge | no times + no bell schedule -> asks for times | PASS |  |
| edge | Period 4 / 6th period / Lunch matched to bell schedule | PASS | Period 4:640 Lunch:690 6th period:790 |
| edge | period not in bell schedule -> time placeholder, no guess | PASS |  |
| edge | parseTime("8:15") = 495 | PASS | 495 |
| edge | parseTime("815") = 495 | PASS | 495 |
| edge | parseTime("8.15") = 495 | PASS | 495 |
| edge | parseTime("1:05") = 785 | PASS | 785 |
| edge | parseTime("1:05 pm") = 785 | PASS | 785 |
| edge | parseTime("12:40") = 760 | PASS | 760 |
| edge | parseTime("12:00am") = 0 | PASS | 0 |
| edge | parseTime("7:45 a.m.") = 465 | PASS | 465 |
| edge | parseTime("25:00") = null | PASS | null |
| edge | parseTime("8:75") = null | PASS | null |
| edge | parseTime("abc") = null | PASS | null |
| edge | "pages 3-5" is not read as a time | PASS |  |
| edge | "11:30-1:05" crosses noon correctly | PASS |  |
| edge | en-dash range "9:50–10:40" | PASS |  |
| edge | overlapping blocks warned | PASS |  |
| edge | missing end time inferred from next block | PASS |  |
| edge | "Will you collect…" keeps the verb | PASS |  |
| edge | "Art & Will can't sit together" hides both | PASS |  |
| edge | "Art class at 1" keeps the subject | PASS |  |
| edge | lowercase "art"/"will"/"may" untouched | PASS |  |
| edge | "May 5 assembly" keeps the month | PASS |  |
| edge | "May sits by the door" hides the name | PASS |  |
| edge | "Reading groups" keeps the subject | PASS |  |
| edge | "ask Grace" hides the name | PASS |  |
| edge | "Hunter J." and bare "Hunter" both hidden | PASS |  |
| edge | common-word names produce a warning | PASS |  |
| edge | possessive "Will's group" hidden | PASS |  |
| edge | name inside another word not touched (Mayor, Willow) | PASS |  |
| edge | restores [STUDENT_1], STUDENT 2, student_3, [ STUDENT_4 ] | PASS |  |
| edge | unknown token number left visible (not mis-assigned) | PASS |  |
| edge | two students named Liam: bare "Liam" not auto-assigned | PASS |  |
| edge | AI text is HTML-escaped (no script injection) | PASS |  |
| edge | roster detection finds names, skips non-names | PASS | Maya L., Will R., Jaylen, Sofia M., Noah |
| edge | >8 AI questions capped at 8 | PASS |  |
| edge | 0 AI questions padded to 5 | PASS |  |
| edge | duplicate questions deduped | PASS |  |
