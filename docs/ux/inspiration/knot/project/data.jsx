// Demo family — generic placeholder names (Smith / Doe).
// To personalize for your own family, swap names below or use the Tweaks panel.
// PRIVACY: never commit real names into a public bundle.

const FAMILY = {
  people: {
    // Generation 1 — Grandparents (paternal)
    p_ramesh: {
      id: 'p_ramesh', name: 'Robert Smith', short: 'Robert',
      gender: 'm', born: 1938, died: 2011, birthplace: 'Springfield',
      role: 'Paternal Grandfather', initials: 'RS',
      bio: 'Opened the family bookshop in 1962. Loved poetry and gardening.',
      partner: 'p_kamla', children: ['p_rajesh', 'p_anjali'], parents: [],
      tone: 'sage',
    },
    p_kamla: {
      id: 'p_kamla', name: 'Katherine Smith', short: 'Katherine',
      gender: 'f', born: 1942, died: null, birthplace: 'Riverton',
      role: 'Paternal Grandmother', initials: 'KS',
      bio: 'Gentle storyteller, keeper of every recipe in the family.',
      partner: 'p_ramesh', children: ['p_rajesh', 'p_anjali'], parents: [],
      tone: 'rose',
    },
    p_vijay: {
      id: 'p_vijay', name: 'Victor Doe', short: 'Victor',
      gender: 'm', born: 1940, died: 2019, birthplace: 'Oakhaven',
      role: 'Maternal Grandfather', initials: 'VD',
      bio: 'Civil engineer. Built bridges. Quietly proud of every one.',
      partner: 'p_meena', children: ['p_nandita', 'p_arun'], parents: [],
      tone: 'indigo',
    },
    p_meena: {
      id: 'p_meena', name: 'Mary Doe', short: 'Mary',
      gender: 'f', born: 1944, died: null, birthplace: 'Pinehurst',
      role: 'Maternal Grandmother', initials: 'MD',
      bio: 'Schoolteacher for 38 years. Still corrects everyone\u2019s grammar.',
      partner: 'p_vijay', children: ['p_nandita', 'p_arun'], parents: [],
      tone: 'amber',
    },
    p_rajesh: {
      id: 'p_rajesh', name: 'Richard Smith', short: 'Richard',
      gender: 'm', born: 1968, died: null, birthplace: 'Springfield',
      role: 'Father', initials: 'RS',
      bio: 'Took over the bookshop in 1995. Cricket fanatic, terrible singer.',
      partner: 'p_sunita', children: ['p_sanchit', 'p_amit', 'p_priya'],
      parents: ['p_ramesh', 'p_kamla'], tone: 'sage',
    },
    p_sunita: {
      id: 'p_sunita', name: 'Susan Smith', short: 'Susan',
      gender: 'f', born: 1970, died: null, birthplace: 'Springfield',
      role: 'Mother', initials: 'SS',
      bio: 'Pediatrician. Holds the family together with weekly Sunday lunches.',
      partner: 'p_rajesh', children: ['p_sanchit', 'p_amit', 'p_priya'],
      parents: ['p_vijay', 'p_meena'], tone: 'rose',
    },
    p_anjali: {
      id: 'p_anjali', name: 'Alice Smith', short: 'Aunt Alice',
      gender: 'f', born: 1972, died: null, birthplace: 'Springfield',
      role: 'Paternal Aunt', initials: 'AS',
      bio: 'Architect. Visits every winter holiday.',
      partner: null, children: [], parents: ['p_ramesh', 'p_kamla'], tone: 'amber',
    },
    p_arun: {
      id: 'p_arun', name: 'Andrew Doe', short: 'Uncle Andrew',
      gender: 'm', born: 1974, died: null, birthplace: 'Oakhaven',
      role: 'Maternal Uncle', initials: 'AD',
      bio: 'Runs an organic farm.',
      partner: null, children: [], parents: ['p_vijay', 'p_meena'], tone: 'indigo',
    },
    p_sanchit: {
      id: 'p_sanchit', name: 'Sam Smith', short: 'You',
      gender: 'm', born: 1994, died: null, birthplace: 'Springfield',
      role: 'You', initials: 'SS', isUser: true,
      bio: 'Started this tree on a quiet Sunday afternoon.',
      partner: 'p_nandita', children: ['p_aarav'],
      parents: ['p_rajesh', 'p_sunita'], tone: 'green',
    },
    p_nandita: {
      id: 'p_nandita', name: 'Nora Doe', short: 'Nora',
      gender: 'f', born: 1995, died: null, birthplace: 'Pinehurst',
      role: 'Spouse', initials: 'ND',
      bio: 'Product designer. Married Sam in 2021.',
      partner: 'p_sanchit', children: ['p_aarav'],
      parents: [], tone: 'rose',
    },
    p_amit: {
      id: 'p_amit', name: 'Adam Smith', short: 'Adam',
      gender: 'm', born: 1997, died: null, birthplace: 'Springfield',
      role: 'Brother', initials: 'AS',
      bio: 'Younger brother. Works in finance.',
      partner: null, children: [], parents: ['p_rajesh', 'p_sunita'], tone: 'sage',
    },
    p_priya: {
      id: 'p_priya', name: 'Paige Smith', short: 'Paige',
      gender: 'f', born: 2000, died: null, birthplace: 'Springfield',
      role: 'Sister', initials: 'PS',
      bio: 'Youngest. Studying law abroad.',
      partner: null, children: [], parents: ['p_rajesh', 'p_sunita'], tone: 'amber',
    },
    p_aarav: {
      id: 'p_aarav', name: 'Avery Smith', short: 'Avery',
      gender: 'n', born: 2023, died: null, birthplace: 'Springfield',
      role: 'Child', initials: 'A',
      bio: 'The newest branch on the tree.',
      partner: null, children: [],
      parents: ['p_sanchit', 'p_nandita'], tone: 'rose',
    },
  },
  memories: [
    { id: 'm1', title: 'Grandfather\u2019s first shop', year: 1962, person: 'p_ramesh',
      text: 'Robert opened the family bookshop on a rainy August afternoon. He always said the rain was good luck.', tag: 'Heirloom' },
    { id: 'm2', title: 'Sunday lunches at Grandma\u2019s', year: 2008, person: 'p_kamla',
      text: 'Every Sunday, the whole family gathered at Katherine\u2019s. Three generations around one table.', tag: 'Tradition' },
    { id: 'm3', title: 'The wedding', year: 2021, person: 'p_sanchit',
      text: 'Sam and Nora married in a small ceremony at her grandfather\u2019s old house.', tag: 'Milestone' },
  ],
  invites: [
    { name: 'Adam Smith',  role: 'Contributor', status: 'pending',  sent: '2 days ago' },
    { name: 'Paige Smith', role: 'Viewer',      status: 'accepted', sent: '5 days ago' },
    { name: 'Aunt Alice',  role: 'Viewer',      status: 'pending',  sent: 'just now' },
  ],
};

const TONES = {
  sage:   { bg: '#E4ECDD', ring: '#A9BC92', ink: '#3D5340' },
  rose:   { bg: '#F1DAD0', ring: '#D49A85', ink: '#7A3F2C' },
  indigo: { bg: '#DDE0EC', ring: '#8E96B8', ink: '#3B4068' },
  amber:  { bg: '#F2E3C5', ring: '#C9A86A', ink: '#6E5224' },
  green:  { bg: '#CFE0CD', ring: '#7DA078', ink: '#2D4A3E' },
};

window.FAMILY = FAMILY;
window.TONES = TONES;
