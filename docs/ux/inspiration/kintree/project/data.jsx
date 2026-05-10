// Family demo data — sanitized Smith / Anderson generic family.
// Original Kintree prototype shipped with the maintainer's real family;
// names, places, and biographical details have been replaced with
// generic equivalents per ADR 0008 (privacy). Data SHAPE is preserved
// exactly: 4 generations, partner / children / parents arrays, tone
// field, role labels — so this file remains a structural reference
// for the people-table schema and the family-chart input shape.

const FAMILY = {
  // Tree id → person
  people: {
    // Generation 1 — Grandparents (paternal)
    p_george: {
      id: 'p_george', name: 'George Smith', short: 'George',
      gender: 'm', born: 1938, died: 2011, birthplace: 'Boston, MA',
      role: 'Paternal Grandfather', initials: 'GS',
      bio: 'Opened the family hardware store on Main Street in 1962. Loved gardening and reading aloud.',
      partner: 'p_margaret', children: ['p_robert', 'p_catherine'], parents: [],
      tone: 'sage',
    },
    p_margaret: {
      id: 'p_margaret', name: 'Margaret Smith', short: 'Margaret',
      gender: 'f', born: 1942, died: null, birthplace: 'Hartford, CT',
      role: 'Paternal Grandmother', initials: 'MS',
      bio: 'Gentle storyteller, keeper of every recipe in the family. Lives with us in Boston.',
      partner: 'p_george', children: ['p_robert', 'p_catherine'], parents: [],
      tone: 'rose',
    },
    // Generation 1 — Grandparents (maternal)
    p_henry: {
      id: 'p_henry', name: 'Henry Anderson', short: 'Henry',
      gender: 'm', born: 1940, died: 2019, birthplace: 'Springfield, MA',
      role: 'Maternal Grandfather', initials: 'HA',
      bio: 'Civil engineer. Built bridges across New England. Quietly proud of every one.',
      partner: 'p_eleanor', children: ['p_susan', 'p_andrew'], parents: [],
      tone: 'indigo',
    },
    p_eleanor: {
      id: 'p_eleanor', name: 'Eleanor Anderson', short: 'Eleanor',
      gender: 'f', born: 1944, died: null, birthplace: 'Providence, RI',
      role: 'Maternal Grandmother', initials: 'EA',
      bio: 'Schoolteacher for 38 years. Still corrects everyone’s grammar.',
      partner: 'p_henry', children: ['p_susan', 'p_andrew'], parents: [],
      tone: 'amber',
    },

    // Generation 2 — Parents & their siblings
    p_robert: {
      id: 'p_robert', name: 'Robert Smith', short: 'Robert',
      gender: 'm', born: 1968, died: null, birthplace: 'Boston',
      role: 'Father', initials: 'RS',
      bio: 'Took over the shop in 1995. Baseball fanatic, terrible singer.',
      partner: 'p_susan', children: ['p_daniel', 'p_adam', 'p_penny'],
      parents: ['p_george', 'p_margaret'], tone: 'sage',
    },
    p_susan: {
      id: 'p_susan', name: 'Susan Smith', short: 'Susan',
      gender: 'f', born: 1970, died: null, birthplace: 'Boston',
      role: 'Mother', initials: 'SS',
      bio: 'Pediatrician. Holds the family together with weekly Sunday dinners.',
      partner: 'p_robert', children: ['p_daniel', 'p_adam', 'p_penny'],
      parents: ['p_henry', 'p_eleanor'], tone: 'rose',
    },
    p_catherine: {
      id: 'p_catherine', name: 'Catherine Smith', short: 'Aunt Cathy',
      gender: 'f', born: 1972, died: null, birthplace: 'Boston',
      role: 'Paternal Aunt', initials: 'CS',
      bio: 'Lives in Seattle. Architect. Visits every Christmas.',
      partner: null, children: [], parents: ['p_george', 'p_margaret'], tone: 'amber',
    },
    p_andrew: {
      id: 'p_andrew', name: 'Andrew Anderson', short: 'Uncle Drew',
      gender: 'm', born: 1974, died: null, birthplace: 'Springfield',
      role: 'Maternal Uncle', initials: 'AA',
      bio: 'Runs an organic farm outside Burlington.',
      partner: null, children: [], parents: ['p_henry', 'p_eleanor'], tone: 'indigo',
    },

    // Generation 3 — User and siblings
    p_daniel: {
      id: 'p_daniel', name: 'Daniel Smith', short: 'You',
      gender: 'm', born: 1994, died: null, birthplace: 'Boston',
      role: 'You', initials: 'DS', isUser: true,
      bio: 'Started this tree on a quiet Sunday afternoon.',
      partner: 'p_nora', children: ['p_theo'],
      parents: ['p_robert', 'p_susan'], tone: 'green',
    },
    p_nora: {
      id: 'p_nora', name: 'Nora Smith', short: 'Nora',
      gender: 'f', born: 1995, died: null, birthplace: 'Burlington, VT',
      role: 'Spouse', initials: 'NS',
      bio: 'Product designer. Married Daniel in 2021 in a quiet Vermont ceremony.',
      partner: 'p_daniel', children: ['p_theo'],
      parents: [], tone: 'rose',
    },
    p_adam: {
      id: 'p_adam', name: 'Adam Smith', short: 'Adam',
      gender: 'm', born: 1997, died: null, birthplace: 'Boston',
      role: 'Brother', initials: 'AS',
      bio: 'Younger brother. Lives in Chicago, works in finance.',
      partner: null, children: [], parents: ['p_robert', 'p_susan'], tone: 'sage',
    },
    p_penny: {
      id: 'p_penny', name: 'Penny Smith', short: 'Penny',
      gender: 'f', born: 2000, died: null, birthplace: 'Boston',
      role: 'Sister', initials: 'PS',
      bio: 'Youngest. Studying law in Edinburgh.',
      partner: null, children: [], parents: ['p_robert', 'p_susan'], tone: 'amber',
    },

    // Generation 4 — Children
    p_theo: {
      id: 'p_theo', name: 'Theodore Smith', short: 'Theo',
      gender: 'm', born: 2023, died: null, birthplace: 'Boston',
      role: 'Son', initials: 'T',
      bio: 'The newest branch on the tree.',
      partner: null, children: [],
      parents: ['p_daniel', 'p_nora'], tone: 'rose',
    },
  },
  memories: [
    {
      id: 'm1', title: 'Grandfather’s first store',
      year: 1962, person: 'p_george',
      text: 'Grandpa George opened the family’s hardware store on Main Street on a rainy August afternoon. He always said the rain was good luck.',
      tag: 'Heirloom',
    },
    {
      id: 'm2', title: 'Sunday dinner at Grandma’s',
      year: 2008, person: 'p_margaret',
      text: 'Every Sunday, the whole family gathered at Grandma’s. Three generations around one wooden table.',
      tag: 'Tradition',
    },
    {
      id: 'm3', title: 'The Vermont wedding',
      year: 2021, person: 'p_daniel',
      text: 'Daniel and Nora married in a small ceremony at her grandfather’s old farmhouse.',
      tag: 'Milestone',
    },
  ],
  invites: [
    { name: 'Adam Smith', role: 'Contributor', status: 'pending', sent: '2 days ago' },
    { name: 'Penny Smith', role: 'Viewer', status: 'accepted', sent: '5 days ago' },
    { name: 'Aunt Cathy', role: 'Viewer', status: 'pending', sent: 'just now' },
  ],
};

// Tone palette — soft warm hues for avatar tiles & node accents.
const TONES = {
  sage:   { bg: '#E4ECDD', ring: '#A9BC92', ink: '#3D5340' },
  rose:   { bg: '#F1DAD0', ring: '#D49A85', ink: '#7A3F2C' },
  indigo: { bg: '#DDE0EC', ring: '#8E96B8', ink: '#3B4068' },
  amber:  { bg: '#F2E3C5', ring: '#C9A86A', ink: '#6E5224' },
  green:  { bg: '#CFE0CD', ring: '#7DA078', ink: '#2D4A3E' },
};

window.FAMILY = FAMILY;
window.TONES = TONES;
