// A realistic, filled-in binder used by the binder unit tests and the browser tests.
module.exports = {
  teacher: 'Ms. Rivera', room: '214', school: 'Lincoln Middle School',
  arrival: 'Sign in at the front office and pick up the room key.\nThis binder is in the top drawer of my desk.',
  bathroom: 'One student at a time with the orange pass by the door. Not in the first or last 10 minutes.',
  emergency: 'Fire: out the door, turn left, exit at Door 6, line up at the fence.\nLockdown: lock the door, lights off, students in the back corner away from the window.\nRed emergency folder hangs on the hook by the door.',
  health: 'Allergy list is in the red folder. Ava T. has an EpiPen in the nurse office. Call the nurse (ext 210) for anything medical.',
  dismissal: 'Students stay seated until the bell. Leave the room locked.',
  leave: 'Stack collected work in the tray on my desk with a short note about how each period went.',
  students: 'Jaylen\nNoah\nAva T.\nMaya L.\nWill R.\nGrace S.',
  contacts: [{ role: 'Front office', contact: 'ext 100' }, { role: 'Neighbor teacher', contact: 'Mr. Okafor, room 216' }, { role: 'Nurse', contact: 'ext 210' }],
  classes: [
    { id: 'p3', label: 'Period 3 - Math 7', start: '10:40', end: '11:30', location: '',
      routines: 'Clap twice for attention. Attendance on the clipboard by the door. Early finishers read silently.',
      seating: 'Seating chart is on the clipboard by the door. Jaylen sits up front.',
      helpers: 'Maya L. - knows where everything is', supplies: 'Textbooks: shelf under the window. Pencils: blue cup on my desk.',
      anyDay: 'Warm-up: 5 problems from the board prompt.\nWorksheet from the green any-day folder in the top drawer, problems 1-12.\nCollect worksheets in the tray.' },
    { id: 'p1', label: 'Period 1 - Math 6', start: '8:00', end: '8:50', location: '',
      routines: 'Same attention signal. Attendance on the clipboard. Early finishers do the puzzle sheet.',
      seating: 'Seating chart on the clipboard. Noah sits by the window.',
      helpers: 'Will R. - reliable, can pass out papers', supplies: 'Calculators: numbered caddy on the back counter.',
      anyDay: 'Fraction review packet from the green folder, pages 1-2.\nCheck answers with a partner for the last 10 minutes.' },
    { id: 'p5', label: 'Period 5 - Advisory', start: '12:50', end: '1:40', location: 'Library',
      routines: 'Quiet reading, then the advisory question on the board.', seating: 'Students choose seats.',
      helpers: 'Grace S.', supplies: 'Reading books are in the bins under the library windows.',
      anyDay: 'Silent reading for 30 minutes.\nWrite a 3-sentence reflection on an index card from the box by the door.' }
  ]
};
