/* ==========================================================================
   HOME PROS ARCADE: everything you are meant to edit lives in this file.

   Prices, the service area, travel fees, Hank's lines, business hours and
   the booking API address. The game (browser) and the booking server
   (worker/) both read this same file, so the price the customer sees is the
   price the server books. Change a number here, rebuild, redeploy both.
   ========================================================================== */
const HP_CONFIG = {

  business: {
    name: 'Home Pros',
    tagline: 'Furnace, Duct & Dryer Vent Cleaning',
    phone: '',                 // e.g. '780-555-0123'. Leave '' to hide the call button.
    website: 'https://homeprosgroup.com',
    province: 'AB',
    country: 'Canada',
    timeZone: 'America/Edmonton',
  },

  host: {
    name: 'Hank',              // the avatar behind the counter
  },

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
    dryerVent: 60,      // dryer vent, side wall only, with a furnace cleaning
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
    { key: 'dryerVent',      name: 'Dryer Vent',       plus: true, note: 'side wall only' },
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
    roof: "Ah, sorry. We're not allowed up on roofs, so we'll have to skip that dryer vent. Everything else is good to go.",
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
  },
};

if (typeof globalThis !== 'undefined') globalThis.HP_CONFIG = HP_CONFIG;
