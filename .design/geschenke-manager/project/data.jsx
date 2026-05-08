// data.jsx — Mock data + helpers

const TODAY = new Date('2026-05-08T12:00:00');

const PEOPLE_INIT = [
  { id: 'p_kevin', name: 'Kevin',  birthday: '1996-05-15', email: 'kevin@gmx.de',  color: '#F59E0B' },
  { id: 'p_sara',  name: 'Sara',   birthday: '1995-05-28', email: 'sara@web.de',   color: '#EC4899' },
  { id: 'p_tim',   name: 'Tim',    birthday: '1994-06-03', email: 'tim@gmail.com', color: '#06B6D4' },
  { id: 'p_lena',  name: 'Lena',   birthday: '1997-07-12', email: 'lena@gmx.de',   color: '#8B5CF6' },
  { id: 'p_marc',  name: 'Marc',   birthday: '1993-09-05', email: 'marc@web.de',   color: '#10B981' },
  { id: 'p_anna',  name: 'Anna',   birthday: '1998-11-22', email: 'anna@me.com',   color: '#F97316' },
];

const WISHLISTS_INIT = {
  p_kevin: [
    { id: 'w1', text: 'Bluetooth-Lautsprecher für die Küche', url: 'https://www.idealo.de/jbl', price: 89, by: 'p_kevin', addedAt: '2026-04-12' },
    { id: 'w2', text: 'Espresso-Tamper aus Olivenholz', price: 25, by: 'p_kevin', addedAt: '2026-03-30' },
    { id: 'w3', text: 'Buch: „Project Hail Mary" von Andy Weir', url: 'https://www.thalia.de', by: 'p_kevin', addedAt: '2026-04-22' },
    { id: 'w4', text: 'Wanderkarte Schwarzwald-Hochstraße', by: 'p_kevin', addedAt: '2026-05-01' },
  ],
  p_sara: [
    { id: 'ws1', text: 'Yogamatte (5 mm, dunkelgrün)', price: 60, by: 'p_sara', addedAt: '2026-04-18' },
    { id: 'ws2', text: 'Gutschein für eine 60-min Massage', by: 'p_sara', addedAt: '2026-04-20' },
    { id: 'ws3', text: 'Tee-Sampler-Box', price: 35, by: 'p_sara', addedAt: '2026-04-25' },
  ],
  p_tim: [
    { id: 'wt1', text: 'Vinyl: alles von Khruangbin', by: 'p_tim', addedAt: '2026-03-15' },
    { id: 'wt2', text: 'Gusseiserne Pfanne 28 cm', price: 70, url: 'https://example.com', by: 'p_tim', addedAt: '2026-04-02' },
  ],
  p_lena: [],
  p_marc: [
    { id: 'wm1', text: 'Klettergurt Größe M', price: 80, by: 'p_marc', addedAt: '2026-02-10' },
  ],
  p_anna: [
    { id: 'wa1', text: 'Polaroid-Filme (3er Pack)', price: 45, by: 'p_anna', addedAt: '2026-04-30' },
  ],
};

const STACK_INIT = [
  {
    id: 'g_kevin_2026',
    personId: 'p_kevin',
    year: 2026,
    addedToStack: '2026-04-15',
    budgetPerPerson: 15,
    participants: ['p_tim', 'p_sara', 'p_lena'],
    suggestions: [
      { id: 's1', title: 'Bluetooth-Lautsprecher', url: 'https://www.idealo.de/jbl', price: 89, by: 'p_tim', note: 'Steht auch auf seiner Liste' },
      { id: 's2', title: 'Espresso-Tamper aus Olivenholz', price: 25, by: 'p_sara' },
      { id: 's3', title: 'Wandtafel + Kreide-Set für die Küche', price: 30, by: 'p_lena', note: 'Spontan-Idee, würde zu seiner Wohnung passen' },
    ],
    pollStatus: 'active', // none | active | ended
    votes: { p_tim: 's2', p_sara: 's2' }, // personId -> suggestionId
    status: 'open',
  },
  {
    id: 'g_sara_2026',
    personId: 'p_sara',
    year: 2026,
    addedToStack: '2026-04-28',
    budgetPerPerson: 25,
    participants: ['p_kevin', 'p_tim'],
    suggestions: [
      { id: 'sa1', title: 'Yogamatte dunkelgrün', price: 60, url: 'https://www.lululemon.de', by: 'p_kevin' },
      { id: 'sa2', title: 'Massage-Gutschein 90 min', price: 90, by: 'p_tim' },
    ],
    pollStatus: 'none',
    votes: {},
    status: 'open',
  },
  {
    id: 'g_tim_2026',
    personId: 'p_tim',
    year: 2026,
    addedToStack: '2026-05-05',
    budgetPerPerson: 12,
    participants: ['p_kevin', 'p_sara', 'p_lena', 'p_marc'],
    suggestions: [
      { id: 'st1', title: 'Khruangbin Vinyl „Mordechai"', price: 32, by: 'p_kevin' },
    ],
    pollStatus: 'none',
    votes: {},
    status: 'open',
  },
];

const PAST_GIFTS_INIT = [
  { id: 'pg1', personId: 'p_kevin', year: 2025, title: 'AirFryer mittel', price: 95, status: 'received' },
  { id: 'pg2', personId: 'p_kevin', year: 2024, title: 'Wochenende Berlin', price: 180, status: 'received' },
  { id: 'pg3', personId: 'p_sara', year: 2025, title: 'Cocktail-Set', price: 70, status: 'received' },
  { id: 'pg4', personId: 'p_tim', year: 2025, title: 'Klettergutschein Boulder Lounge', price: 45, status: 'received' },
];

// ── Helpers ────────────────────────────────────────────────
const MONTHS_DE = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
const MONTHS_DE_SHORT = ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'];

function fmtDate(iso) {
  const d = new Date(iso + 'T12:00:00');
  return `${d.getDate()}. ${MONTHS_DE[d.getMonth()]}`;
}
function fmtDateShort(iso) {
  const d = new Date(iso + 'T12:00:00');
  return `${d.getDate()}. ${MONTHS_DE_SHORT[d.getMonth()]}`;
}
function daysUntilBirthday(birthdayISO, today = TODAY) {
  const bd = new Date(birthdayISO + 'T12:00:00');
  const next = new Date(today.getFullYear(), bd.getMonth(), bd.getDate(), 12);
  if (next < today) next.setFullYear(today.getFullYear() + 1);
  const ms = next - today;
  return Math.round(ms / (1000 * 60 * 60 * 24));
}
function ageOnNextBirthday(birthdayISO, today = TODAY) {
  const bd = new Date(birthdayISO + 'T12:00:00');
  const nextYear = today.getFullYear() + (daysUntilBirthday(birthdayISO, today) === 0 ? 0 : 0);
  // returns the age they will turn on their NEXT birthday
  const nextBd = new Date(today.getFullYear(), bd.getMonth(), bd.getDate(), 12);
  const year = nextBd < today ? today.getFullYear() + 1 : today.getFullYear();
  return year - bd.getFullYear();
}
function daysAgo(iso, today = TODAY) {
  const d = new Date(iso + 'T12:00:00');
  return Math.round((today - d) / (1000 * 60 * 60 * 24));
}
function initials(name) {
  return name.split(/\s+/).map(s => s[0]).slice(0, 2).join('').toUpperCase();
}
function uid(prefix = 'id') { return `${prefix}_${Math.random().toString(36).slice(2, 9)}`; }

Object.assign(window, {
  TODAY, PEOPLE_INIT, WISHLISTS_INIT, STACK_INIT, PAST_GIFTS_INIT,
  MONTHS_DE, MONTHS_DE_SHORT,
  fmtDate, fmtDateShort, daysUntilBirthday, ageOnNextBirthday, daysAgo, initials, uid,
});
