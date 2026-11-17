/* ==========================================================================
   HOME PROS ARCADE: everything you are meant to edit lives in this file.

   Prices, the service area, travel fees, Hank's lines, business hours and
   the booking API address. The game (browser) and the booking server
   (worker/) both read this same file, so the price the customer sees is the
   price the server books. Change a number here, rebuild, redeploy both.
   ========================================================================== */
const HP_CONFIG = {

  business: {
    name: 'Home Pros Group',
    tagline: 'Furnace, Duct & Dryer Vent Cleaning',
    phone: '780-932-7337',     // shown on the 'call us' buttons. '' hides them.
    website: 'https://homeprosgroup.com',
    province: 'AB',
    country: 'Canada',
    timeZone: 'America/Edmonton',
  },

  host: {
    name: 'Hank',              // the avatar behind the counter
  },

  /* ------------------------- Back office (Staff Only) ---------------------- */
  // home = their office on the floor plan, seat = their boardroom chair.
  // Offices: gm, acct, mkt (top row), email, cs, cho (bottom row).
  // Seats: seat-head, seat-t1..t3 (far side), seat-b1..b3 (near side).
  owner: { name: 'Keith', title: 'Chief Human Officer', home: 'cho', seat: 'seat-head' },

  // Customer Service reports (booking percentage). One truck works both routes.
  office: {
    daysAhead: 14,
    dayHours: 8,                      // a full day per route: 4 calls x 2 hours
    workDays: [1, 2, 3, 4, 5, 6],
    routes: {                         // ServiceMonster route IDs
      'New Home': '9fb1dbd4-3227-11ed-8205-8d92ba0c912a',
      'Residential': 'ff14fbca-dc45-11e3-b8c3-d9b28ac835cd',
    },
    jaymanRoute: 'New Home',
    // every Jayman account in ServiceMonster (the all-caps one is the live one)
    jaymanAccounts: ['1b833231-89e7-11e7-8c1a-fec578518208', 'b803ae7f-e037-11e3-b8c3-d9b28ac835cd',
      'fbcd4a4f-77fe-11ee-8213-9988e7b79539', 'bffc865a-531e-11ee-820e-bc04de1dccaf', '6bd33c7b-342a-11eb-a7d2-bd12f7e942c9'],
    warrantyWord: 'warr[ae]nt',       // "Warranty" or "Warrenty" in a call = timed warranty call
    base: { lat: 53.53039, lon: -113.99049, name: '53 Umbach Rd, Stony Plain' },   // the truck starts and ends every day here
    roadFactor: 1.3,
  },

  // The board of directors in the boardroom. `id` matches img/dir-<id>.webp.
  directors: [
    {
      id: 'grace', home: 'gm', seat: 'seat-t1', name: 'Grace', title: 'General Manager',
      intro: "Morning, boss. I keep the whole operation pointed in the same direction.",
      duties: ['Daily briefing: today\'s jobs, crews and routes', 'Spots problems early and flags what needs you', 'Keeps the other directors on task'],
    },
    {
      id: 'penny', home: 'acct', seat: 'seat-t2', name: 'Penny', title: 'Accounting',
      intro: "Numbers are my happy place. If money moves, I know about it.",
      duties: ['Nightly brief at 8 PM: jobs done, revenue, billed, paid, GST and km', 'Running list of jobs not paid yet (not Jayman), plus commercial accounts on billing', 'Month to date compared with last month', 'Sorts your receipts into expense categories with you each night'],
    },
    {
      id: 'max', home: 'mkt', seat: 'seat-t3', name: 'Max', title: 'Marketing',
      intro: "Let's get Home Pros in front of every furnace in the Edmonton area!",
      duties: ['Where bookings come from, including this storefront', 'Google reviews and review requests', 'Seasonal promos and website ideas'],
    },
    {
      id: 'eddie', home: 'email', seat: 'seat-b1', name: 'Eddie', title: 'Email Manager',
      intro: "Inbox zero is a lifestyle. I sort it so you don't have to.",
      duties: ['Every morning: goes through the last 24 hours of email', 'Writes reply drafts for anything that needs an answer (you approve and send)', 'Moves clear spam to the Spam folder and lists what you should check over', 'Makes sure mail reaches the right person and label, and goes out signed and formatted properly'],
    },
    {
      id: 'hank', home: 'shop', seat: 'seat-b3', name: 'Hank', title: 'Purchasing',
      intro: "Need something for the van or the shop? Tell me and it goes on the list. I'll remember where we buy it.",
      duties: ['Keeps the purchase list: add things whenever you think of them, and special orders', 'Inventory: the basic products we stock, each with a minimum, counted once a week', 'Anything at or below its minimum goes on the purchase list automatically', 'Learns where each item is ordered from (10 x 10 patches: Ecco Supply) and groups the list by supplier', 'Emails you the list, and sits in on board meetings'],
    },
    {
      id: 'rosa', home: 'cs', seat: 'seat-b2', name: 'Rosa', title: 'Customer Service',
      intro: "Every customer leaves happy. That's my whole job.",
      duties: ['Every morning before 6:30: reads new Jayman purchase orders and prepares them for the New Home route, for your approval', 'Never double-books: checks New Home and Edmonton Residential before proposing a slot', 'Plans the driving: closest Jayman calls back to back (warranty calls keep their time)', 'Turns Jayman warranty calls into work orders', 'Questions, reschedules and cancellations', 'Catches unhappy customers before they post a review'],
    },
  ],

  tax: { rate: 0.05, label: 'GST' },
  currency: 'CAD',

  /* Booking server. '' = DEMO MODE: the calendar shows sample times and
     "booking" does nothing, so you can play the whole thing safely.
     Set it to your deployed worker, e.g. 'https://book.homeprosgroup.com'. */
  apiBase: '',

  /* --------------------------------- Prices -------------------------------- */
  // All before GST.
  prices: {
    base: 345,          // first furnace: furnace, all ducting, every supply & return register
    extraFurnace: 150,  // each additional furnace, with its ducting and registers
    airConditioner: 60, // per air conditioner
    zone: 60,           // zone system (one furnace, more than one thermostat)
    dryerVent: 60,      // dryer vent, side wall only, with a furnace cleaning ($150 + GST on its own; the arcade only quotes it with a furnace cleaning)
  },
  maxFurnaces: 5,       // more than this: "give us a call"

  // Hours each job blocks on the ServiceMonster schedule.
  hours: { base: 2.5, extraFurnace: 1, zone: 0, dryerVent: 0.5 },

  /* ------------------------------ Service area ----------------------------- */
  /* Inside these towns there is no travel fee. Outside, we include the first
     `includedKm` of driving (round trip, measured from the edge of the
     nearest town below) and charge `perKm` for every kilometre after that.
     radiusKm is roughly how far the town's edge is from its centre.        */
  travel: {
    includedKm: 30,
    perKm: 1.5,
    roundTrip: true,
    roadFactor: 1.25,   // roads are longer than a straight line
    serviceArea: [
      { name: 'Edmonton',          lat: 53.5461, lon: -113.4938, radiusKm: 15 },
      { name: 'St. Albert',        lat: 53.6305, lon: -113.6256, radiusKm: 5, aliases: ['saint albert', 'st albert'] },
      { name: 'Sherwood Park',     lat: 53.5413, lon: -113.2958, radiusKm: 6 },
      { name: 'Spruce Grove',      lat: 53.5450, lon: -113.9008, radiusKm: 4 },
      { name: 'Stony Plain',       lat: 53.5263, lon: -114.0050, radiusKm: 4, aliases: ['stony'] },
      { name: 'Leduc',             lat: 53.2594, lon: -113.5492, radiusKm: 4 },
      { name: 'Fort Saskatchewan', lat: 53.7128, lon: -113.2134, radiusKm: 4, aliases: ['fort sask', 'ft saskatchewan', 'ft. saskatchewan'] },
    ],
  },

  /* ---------------- Scheduling (used by the booking server) --------------- */
  schedule: {
    daysAhead: 21,             // how far out the calendar goes
    minLeadHours: 18,          // no bookings sooner than this
    workDays: [1, 2, 3, 4, 5, 6], // 0 = Sunday ... 6 = Saturday
    // Arrival windows offered to customers. start is the job start time.
    slots: [
      { start: '08:00', label: '8:00 - 9:00 AM' },
      { start: '10:30', label: '10:30 - 11:30 AM' },
      { start: '13:00', label: '1:00 - 2:00 PM' },
      { start: '15:30', label: '3:30 - 4:30 PM' },
    ],
    dayEnd: '19:00',           // a job may not run past this
  },

  /* ------------------------------- Menu board ------------------------------ */
  // What is painted on the wall. Prices come from `prices` above.
  menuBoard: [
    { key: 'base',           name: 'Furnace & Duct Cleaning', note: '1 furnace, all ducts, every register' },
    { key: 'airConditioner', name: 'Air Conditioner',  plus: true, note: 'each' },
    { key: 'zone',           name: 'Zone System',      plus: true },
    { key: 'extraFurnace',   name: 'Extra Furnace',    plus: true, note: 'each, with its ducts & registers' },
    { key: 'dryerVent',      name: 'Dryer Vent',       plus: true, note: 'side wall only · $150 on its own' },
  ],

  /* ------------------------------ Host lines ------------------------------- */
  lines: {
    greet: [
      "Hey, welcome in! I'm {host}. Home Pros, flat rates, no surprises.",
      'Want your price on a furnace and duct cleaning? Takes about a minute.',
    ],
    browse: "Take your time. Everything on the board is flat rate, plus GST. Doesn't matter how many vents you've got.",
    town: "First things first: where's the house?",
    townOther: "No problem. Type the town, or the full address, and I'll check the travel.",
    inArea: "Perfect, that's right in our area. No travel fee.",
    outArea: "That's about {km} km of driving past the free {included}. Travel adds {fee}.",
    unknownTown: "Hmm, I can't place that one. We'll confirm any travel fee with you before we come out.",
    oneFurnace: 'Do you have just one furnace?',
    furnaceCount: 'How many furnaces do you have in total?',
    ac: 'Do you have air conditioning?',
    acCount: 'How many air conditioners do you have?',
    zone: 'Do you have a zone system?',
    zoneExplain: 'Easy way to tell: do you have just one furnace, but more than one thermostat in the house?',
    dryer: 'Want me to add a dryer vent cleaning while we are there?',
    dryerWhere: 'Where does the dryer vent come out: the side of the house, or the roof?',
    roof: "Ah, sorry. We're not allowed up on residential roofs, so we'll have to skip that dryer vent. One tip: roof vents often have a screen over them, and it has to come off before the vent can be cleaned. Everything else is good to go.",
    tooMany: "That's a big setup! Give us a call and we'll price it out for you.",
    quote: "Alright, here's your number. Flat rate, plus GST, no per-vent nonsense:",
    details: "Great. I just need to know who you are and where the truck is headed.",
    travelChanged: 'Heads up: with that address, travel comes to {fee}. Your total is now {total}.',
    travelFree: "Good news: that address is in our area, so there's no travel fee. Your total is now {total}.",
    calendar: 'Pick a day, then a time that works. These are real openings on our schedule.',
    confirm: 'Last look. Everything right?',
    booking: 'Hang on, calling it in to dispatch...',
    booked: "You're booked! A confirmation is on its way to {email}. See you then.",
    decline: "No problem at all. The prices aren't going anywhere. Come back anytime.",
    error: "Ah, the line to dispatch dropped. Nothing was booked. Try again, or give us a call.",
    slotTaken: 'Shoot, someone just grabbed that time. Pick another one?',
    staffDoor: 'Oh, hey boss! Go on back.',
    login: 'Staff only. Password, please.',
    loginDemo: 'Demo mode: any password opens the door. On the live site this checks your real password.',
    loginWrong: "That's not it. Try again.",
    welcome: "Welcome back, {owner}. Everyone's at work. Click anyone on the floor to talk to them, or call a board meeting.",
    meetingCall: 'Board meeting! Everybody to the boardroom.',
    meetingOpen: "Everyone's seated. You have the floor, {owner}.",
    meetingEnd: 'Meeting adjourned. Back to work, everyone.',
    howTo: "Here's exactly how we clean your ducts, start to finish. Seven steps, and nothing gets stirred up into your home. Tap any step to jump to it.",
    csDesk: "Customer Service desk. What do you want to see, boss?",
    csOver: "Heads up: we're over 100% on {days}. I've already passed it to Grace.",
    csFine: 'Every day is at or under 100%. No overbooking.',
    graceFlag: "Rosa just dropped off the booking report. We're overbooked on {days}. I'll keep an eye on it.",
    snapshotNote: 'Snapshot from ServiceMonster taken {when}. It goes live once the booking server is running.',
    itsYou: "That's you, boss. Corner office, best chair in the building.",
    notConnected: "I'm not hooked up to the real data yet. Once ServiceMonster and your email are connected, this is where I'll report in.",
  },
};

if (typeof globalThis !== 'undefined') globalThis.HP_CONFIG = HP_CONFIG;
