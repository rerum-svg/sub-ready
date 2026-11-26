// Five realistic, messy teacher notes plus canned AI replies (as a chatbot would paste them).
// Names are fictional.
module.exports = [
{
  id: 'elem-2nd',
  name: '2nd grade, self-contained (elementary)',
  plan: `morning wrk 8:15 - the usual, theyll know
Maya L. passes out folders
DOL on board then calendar
reading grps - Will R. grp first, use the green bin
snack ~10
math: pg 112 #1-15 odd. if time stations
lunch 11:30-12:05
art w/ Mrs K (they walk themselves??)
read aloud chap 6
pack up, leave WS in the tray`,
  info: { className: '2nd grade, Room 14', periods: '', routines: 'clap twice = attention', locations: '', helpers: 'Maya L. - line leader, v reliable\nWill R. - knows where everything is', emergency: '' },
  names: 'Maya L.\nWill R.\nJaylen',
  roster: '',
  gapReply: `Sure! Here are the gaps I found:

\`\`\`json
{
  "flags": [
    {"line": "morning wrk 8:15 - the usual, theyll know", "issue": "A sub won't know what the usual morning work is."},
    {"line": "DOL on board then calendar", "issue": "DOL is an unexplained abbreviation; calendar routine isn't described."},
    {"line": "reading grps - [STUDENT_2] grp first, use the green bin", "issue": "Where is the green bin and what does each group do?"},
  ],
  "questions": [
    {"question": "What exactly is the morning work and where is it?", "section": "schedule"},
    {"question": "What does DOL stand for and how should the sub run it?", "section": "routines"},
    {"question": "Where is the green bin, and what does each reading group do?", "section": "where"},
    {"question": "What should stations look like if there is time?", "section": "schedule"},
    {"question": "Who walks the class to art with Mrs K, and when do they come back?", "section": "routines"},
  ]
}
\`\`\`
Let me know if you need anything else!`,
  answers: [
    'Morning work packet is on each desk already. Quiet work 15 min.',
    'DOL = daily oral language. Two sentences are on the board; kids fix them on whiteboards.',
    'Green bin is on the shelf under the window. Group 1 reads pages 4-9 with the sub; others read to self.',
    '',
    'The sub walks them to art at 12:10 and picks them up at 12:55.',
    'Early finishers can read a book from their book box.',
    'Leave the WS tray on my desk with a note.',
    ''
  ],
  scriptReply: `\`\`\`json
{"title":"2nd grade, Room 14","schedule":[
 {"start":"8:15","end":"8:30","block":"Morning work","steps":["Students do the morning work packet on their desks quietly for 15 minutes."]},
 {"start":"","end":"","block":"Daily oral language and calendar","steps":["Two sentences are on the board; students fix them on whiteboards.","Do calendar."]},
 {"start":"","end":"","block":"Reading groups","steps":["[STUDENT_2]'s group goes first.","Get the green bin from the shelf under the window.","Group 1 reads pages 4-9 with you; others read to self."]},
 {"start":"10:00","end":"","block":"Snack","steps":["Snack time."]},
 {"start":"","end":"","block":"Math","steps":["Page 112, problems 1-15 odd.","If there is time, run stations."]},
 {"start":"11:30","end":"12:05","block":"Lunch","steps":["Lunch."]},
 {"start":"12:10","end":"12:55","block":"Art with Mrs K","steps":["Walk the class to art at 12:10 and pick them up at 12:55."]},
 {"start":"","end":"","block":"Read aloud","steps":["Read chapter 6 aloud."]},
 {"start":"","end":"","block":"Pack up","steps":["Students pack up.","Leave the worksheets in the tray."]}
],
"where_things_are":[{"item":"Green bin","location":"shelf under the window"},{"item":"Worksheet tray","location":""}],
"routines":["Clap twice for attention.","Early finishers read a book from their book box."],
"helpers":[{"student":"[STUDENT_1]","how":"Line leader, very reliable; passes out folders."},{"student":"STUDENT 2","how":"Knows where everything is."}],
"emergency":[],
"leave_done":["Leave the worksheet tray on my desk with a note."],
"missing":["Stations instructions were not provided."]}
\`\`\``,
  expect: { assoc: ['Will R.\'s group goes first', 'Maya L.: Line leader', 'Will R.: Knows where everything is'], names: ['Maya L.', 'Will R.'], minBlocks: 9, mustContain: ['Maya L.', 'Will R.', 'Not provided'], unverifiedMin: 0 }
},
{
  id: 'ms-math',
  name: '7th grade math, 3 periods (middle school)',
  plan: `P2, P4, P6 all same - 7th math
- warm up on slide 1 (projector, laptop pw on sticky??)
- go over HW 4.3 answers key in red folder
- notes 4.4 two-step eq, guided notes copies on cart
- IXL M.7 for rest of class, chromebooks in cart B
- exit tix, collect
p4 is chatty - Grace S sits up front
5th = lunch duty?? not sure, check w office`,
  info: { className: '7th grade math', periods: 'P2 8:55-9:45\nP4 10:40-11:30\nLunch 11:30-12:05\nP6 1:10-2:00', routines: '', locations: 'red folder - top of filing cabinet', helpers: 'Grace S - front row\nDestiny M can pass out chromebooks', emergency: 'Lockdown: lights off, lock door, corner by sink. Office x2100' },
  names: 'Grace S, Destiny M',
  roster: '',
  gapReply: `{flags: [{line: 'warm up on slide 1 (projector, laptop pw on sticky??)', issue: 'Login is unclear and passwords should not be on the plan'}],
 questions: [{question: 'How does the sub log in to the laptop/projector without a password on the plan?', section: 'routines'},
 {question: 'Where exactly is cart B and how are chromebooks numbered?', section: 'where'},
 {question: 'What is the procedure for the 5th period lunch duty?', section: 'emergency'},
 {question: 'What should students do if they finish IXL M.7 early?', section: 'routines'}]}`,
  answers: ['The office has a sub login card; ask for it at check-in.', 'Cart B is by the back door. Kids take their numbered chromebook.', 'Ask the office about lunch duty.', 'Finish IXL then read silently.', 'Take attendance in the first 5 minutes on the paper roster in the sub folder.', 'Leave exit tickets in the red folder.', '', ''],
  scriptReply: `Here's the script:
\`\`\`json
{
  "title": "7th grade math – Periods 2, 4, 6",
  "schedule": [
    {"start": "", "end": "", "block": "Period 2", "steps": ["Warm up on slide 1 using the sub login card from the office.", "Go over homework 4.3 using the answer key in the red folder.", "Notes 4.4 two-step equations; guided notes copies are on the cart.", "IXL M.7 for the rest of class; chromebooks are in cart B by the back door.", "Collect exit tickets."]},
    {"start": "", "end": "", "block": "Period 4", "steps": ["Same as Period 2.", "This class is chatty; [STUDENT_1] sits up front."]},
    {"start": "", "end": "", "block": "Lunch", "steps": ["Lunch duty: ask the office."]},
    {"start": "", "end": "", "block": "Period 6", "steps": ["Same as Period 2."]}
  ],
  "where_things_are": [{"item": "Red folder", "location": "top of filing cabinet"}, {"item": "Chromebooks", "location": "cart B by the back door"}],
  "routines": ["Take attendance in the first 5 minutes on the paper roster in the sub folder.", "Early finishers: finish IXL then read silently.", "Reward the class with a pizza party if they behave."],
  "helpers": [{"student": "[STUDENT_2]", "how": "Can pass out chromebooks."}],
  "emergency": ["Lockdown: lights off, lock door, corner by sink. Office x2100."],
  "leave_done": ["Leave exit tickets in the red folder."],
  "missing": ["Lunch duty details"]
}
\`\`\``,
  expect: { assoc: ['chatty; Grace S sits up front', 'Destiny M: Can pass out chromebooks'], names: ['Grace S', 'Destiny M'], minBlocks: 4, bellFill: true, mustContain: ['8:55 AM', '1:10 PM', 'Grace S', 'Destiny M', 'Check'], unverifiedMin: 1 }
},
{
  id: 'hs-english',
  name: '10th grade English (high school)',
  plan: `Eng 10 - blk 1 & 3 (90 min)
bellringer journal prompt in google classroom
Act 3 Macbeth, they read aloud parts (cast list on my desk somewhere)
SSR if done early
discussion qs pg 4 of packet - small groups, May B. leads grp 2
DON'T let them use phones, phone caddy rule as always
turn in packets to the basket`,
  info: { className: 'English 10', periods: 'Block 1: 7:45-9:15\nBlock 3: 11:10-12:40', routines: 'Phones go in the caddy at the door. Bathroom pass on hook, one at a time.', locations: '', helpers: 'May B. - group 2 leader\nHunter J. - tech help', emergency: '' },
  names: 'May B.\nHunter J.\nMay',
  roster: '',
  gapReply: `\`\`\`
{"flags":[{"line":"bellringer journal prompt in google classroom","issue":"Sub may not have Google Classroom access"},{"line":"cast list on my desk somewhere","issue":"Location is vague"}],
"questions":[{"question":"How can the sub show the journal prompt without Google Classroom access?","section":"routines"},
{"question":"Where exactly is the cast list for Act 3?","section":"where"},
{"question":"What does SSR mean and where do students get books?","section":"routines"},
{"question":"What are the discussion groups and how long should discussion last?","section":"schedule"},
{"question":"What should the sub do if a student refuses to put a phone away?","section":"routines"},
{"question":"Where is the basket for packets?","section":"where"}]}
\`\`\``,
  answers: ['Prompt is also written on the whiteboard.', 'Cast list is in the blue folder in my top drawer.', 'SSR = silent reading, students use their own books.', 'Groups are posted on the board. 20 minutes.', 'Send them to the office with the pass.', 'Basket is on the front table.', 'Fire drill: exit left, Door 6, line up on the field.', ''],
  scriptReply: `\`\`\`json
{
  "title": "English 10 \u2014 Blocks 1 and 3",
  "schedule": [
    {"start": "7:45", "end": "9:15", "block": "Block 1", "steps": ["Journal prompt: show it on the whiteboard (it is also in Google Classroom).", "Act 3 of Macbeth: students read parts aloud. The cast list is in the blue folder in the top drawer.", "Small-group discussion questions on page 4 of the packet for 20 minutes; groups are posted on the board; [STUDENT_1] leads group 2.", "Collect packets in the basket on the front table."]},
    {"start": "11:10", "end": "12:40", "block": "Block 3", "steps": ["Same as Block 1."]}
  ],
  "where_things_are": [{"item": "Cast list", "location": "blue folder in the top drawer"}, {"item": "Packet basket", "location": "front table"}],
  "routines": ["Phones go in the caddy at the door.", "Bathroom pass on hook, one at a time.", "Silent reading with their own books if done early.", "If a student refuses to put a phone away, send them to the office with the pass."],
  "helpers": [{"student": "[student_1]", "how": "Group 2 leader."}, {"student": "[STUDENT_2]", "how": "Tech help."}],
  "emergency": ["Fire drill: exit left, Door 6, line up on the field."],
  "leave_done": ["Packets in the basket."],
  "missing": []
}`,
  expect: { assoc: ['May B. leads group 2', 'May B.: Group 2 leader', 'Hunter J.: Tech help'], names: ['May B.', 'Hunter J.'], minBlocks: 2, mustContain: ['7:45 AM', '12:40 PM', 'May B.', 'Hunter J.', '(90 min)'], unverifiedMin: 0 }
},
{
  id: 'k-halfday',
  name: 'Kindergarten, rushed phone notes (no times at all)',
  plan: `sorry typing from phone!! 
circle time, do calendar + weather song (on the ipad)
centers like normal
Jaylen needs to sit by u at carpet
recess - kids know the bell
snack, then letter Bb worksheet
dismissal - bus kids first, car riders w Ms. P`,
  info: { className: 'Kindergarten', periods: '', routines: '', locations: '', helpers: '', emergency: '' },
  names: '',
  roster: 'Jaylen - sits by teacher\nAva T. (EpiPen in nurse office)\nPeriod 3 helpers: Noah',
  gapReply: `I found these issues.
\`\`\`json
{"flags":[{"line":"centers like normal","issue":"No description of centers"}],"questions":[{"question":"What are the centers and how do kids rotate?","section":"schedule"},{"question":"What times are circle, recess, snack and dismissal?","section":"schedule"},{"question":"How does the sub unlock the iPad for the weather song?","section":"routines"}`,
  answers: ['4 centers, rotate when I ring the chime, 12 min each. Center cards on the wall.', 'Circle 8:30, recess 10:15, snack 10:40, dismissal 11:45.', 'iPad has no passcode, song is on the home screen.', 'Bus list is clipped by the door.', '', '', '', ''],
  scriptReply: `{"title":"Kindergarten half day","schedule":[{"start":"8:30","block":"Circle time","steps":["Calendar and weather song on the iPad (no passcode; song is on the home screen).","[STUDENT_1] sits next to you at the carpet."]},{"block":"Centers","steps":["4 centers, 12 minutes each. Ring the chime to rotate. Center cards are on the wall."]},{"start":"10:15","block":"Recess","steps":["Kids know the bell."]},{"start":"10:40","block":"Snack and letter Bb","steps":["Snack, then the letter Bb worksheet."]},{"start":"11:45","block":"Dismissal","steps":["Bus kids first using the bus list clipped by the door.","Car riders go with Ms. P."]}],"where_things_are":[],"routines":[],"helpers":[],"emergency":["[STUDENT_2] has an EpiPen in the nurse office."],"leave_done":[],"missing":["Emergency procedures"]}`,
  expect: { assoc: ['Jaylen sits next to you', 'Ava T. has an EpiPen'], names: ['Jaylen', 'Ava T.', 'Noah'], minBlocks: 5, mustContain: ['Jaylen', 'Ava T.', '8:30 AM', 'Not provided'], unverifiedMin: 0, gapTruncated: true }
},
{
  id: 'hs-chem-split',
  name: 'Chemistry, mixed format + overlapping times',
  plan: `CHEM - 3rd & 7th
3rd 9:50–10:40 / 7th 1:55-2:45
NO LAB. Lab safety vid (link in sub tub), then ws 5.2 mole conversions
calculators: the box by sink, count them back in!!!
if fire drill - goggles off, out door B, line up by flagpole
Art & Will in 7th can't sit together
leave ws stack + any notes on my desk`,
  info: { className: 'Chemistry', periods: '3rd 9:50-10:40\n7th 1:55-2:45', routines: 'No food near sinks. Attendance on paper roster in sub tub.', locations: 'sub tub - grey tub on my desk', helpers: '', emergency: 'Eyewash station left of sink.' },
  names: 'Art\nWill',
  roster: '',
  gapReply: `\`\`\`json
{"flags":[], "questions":[{"question":"Is the safety video link on a laptop or printed?","section":"routines"},{"question":"How many calculators are in the box?","section":"where"},{"question":"Where are the ws 5.2 copies?","section":"where"},{"question":"Can 7th period use notes on ws 5.2?","section":"schedule"},{"question":"Who can help with the projector?","section":"helpers"},{"question":"Should the sub collect the worksheets or let kids finish at home?","section":"leave_done"},{"question":"Extra question 7?","section":"schedule"},{"question":"Extra question 8?","section":"schedule"},{"question":"Extra question 9 should be dropped","section":"schedule"}]}
\`\`\``,
  answers: ['Printed QR code in the sub tub; play it on the teacher laptop.', '30 calculators.', 'Copies are in the sub tub.', 'Yes, notes are ok.', '', 'Collect them.', '', ''],
  scriptReply: `\`\`\`json
{"title":"Chemistry","schedule":[
{"start":"1:55","end":"2:45","block":"7th period","steps":["Same as 3rd period.","[STUDENT_1] and [STUDENT_2] cannot sit together."]},
{"start":"9:50","end":"10:40","block":"3rd period","steps":["No lab today.","Play the lab safety video using the printed QR code in the sub tub on the teacher laptop.","Worksheet 5.2 mole conversions; copies are in the sub tub; notes are ok.","Calculators are in the box by the sink (30). Count them back in."]},
{"start":"10:30","end":"10:20","block":"Bad block","steps":["Test end-before-start."]}
],
"where_things_are":[{"item":"Sub tub","location":"grey tub on my desk"},{"item":"Calculators","location":"box by sink"}],
"routines":["No food near sinks.","Attendance on the paper roster in the sub tub."],
"helpers":[],
"emergency":["Fire drill: goggles off, out door B, line up by the flagpole.","Eyewash station is left of the sink."],
"leave_done":["Collect the worksheets.","Leave the worksheet stack and any notes on my desk."],
"missing":[]}
\`\`\``,
  expect: { assoc: ['Art and Will cannot sit together'], names: ['Art', 'Will'], minBlocks: 3, mustContain: ['9:50 AM', '1:55 PM', 'Art', 'Will'], sortedFirst: '3rd period', warnEndBefore: true, unverifiedMin: 0 }
}
];
