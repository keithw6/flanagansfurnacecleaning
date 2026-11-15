/* ==========================================================================
   HOME PROS ARCADE: everything you are meant to edit lives in this file.

   Prices, questions, the host's lines, business hours and the booking API
   address. The game (browser) and the booking server (worker/) both read this
   same file, so the price the customer sees is the price the server books.
   Change a number here, rebuild, redeploy both. Nothing else to touch.

   ALL PRICES BELOW ARE SAMPLES. Replace them with your real flat rates.
   ========================================================================== */
const HP_CONFIG = {

  business: {
    name: 'Home Pros',
    tagline: 'Furnace, Duct & Dryer Vent Cleaning',
    phone: '',                 // e.g. '403-555-0123'. Leave '' to hide the call button.
    website: 'https://homeprosgroup.com',
    province: 'AB',
    country: 'Canada',
    timeZone: 'America/Edmonton',
    defaultCity: 'Calgary',    // pre-filled on the booking form
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
  // What is painted on the wall. Purely display; the calculator is below.
  menuBoard: [
    { highlight: 'furnace', name: 'Furnace & Duct Cleaning', from: 299, note: 'whole home, flat rate' },
    { highlight: 'dryer', name: 'Dryer Vent Cleaning', from: 149, note: 'or $79 with a duct clean' },
    { highlight: 'sanitize', name: 'System Sanitization', from: 99, note: 'add-on' },
    { highlight: 'furnaces', name: 'Second Furnace', from: 150, note: 'add-on' },
  ],

  /* ------------------------------- Calculator ------------------------------ */
  /* Each service has a base price and a list of questions. Every answer can
     add (or subtract) money and job time. `durationHours` is how long the
     job blocks on the ServiceMonster schedule.                              */
  services: {
    furnace: {
      label: 'Furnace & Duct Cleaning',
      smService: 'Furnace & Duct Cleaning',    // text sent to ServiceMonster
      base: 0,
      durationHours: 2.5,
      questions: [
        {
          id: 'home',
          tag: 'Home',
          say: 'What kind of place are we cleaning?',
          options: [
            { id: 'condo',   label: 'Condo or townhouse', price: 299, hours: 0 },
            { id: 'bung',    label: 'Bungalow',           price: 349, hours: 0 },
            { id: 'two',     label: 'Two-storey',         price: 399, hours: 0.5 },
            { id: 'twobsmt', label: 'Two-storey + developed basement', price: 449, hours: 1 },
          ],
        },
        {
          id: 'furnaces',
          tag: 'Furnaces',
          say: 'How many furnaces in the house?',
          options: [
            { id: '1', label: 'Just one',  price: 0 },
            { id: '2', label: 'Two',       price: 150, hours: 1 },
          ],
        },
        {
          id: 'sanitize',
          tag: 'Sanitization',
          say: 'Want me to add a system sanitization? Kills the funk in the ducts.',
          options: [
            { id: 'no',  label: 'No thanks', price: 0 },
            { id: 'yes', label: 'Yes, add it', price: 99, hours: 0.5 },
          ],
        },
      ],
    },

    dryer: {
      label: 'Dryer Vent Cleaning',
      smService: 'Dryer Vent Cleaning',
      base: 0,
      durationHours: 1,
      questions: [
        {
          id: 'exit',
          tag: 'Vent exit',
          say: 'Where does the dryer vent come out of the house?',
          options: [
            { id: 'ground', label: 'Outside wall, main floor', price: 149 },
            { id: 'upper',  label: 'Outside wall, second floor', price: 179, hours: 0.5 },
            { id: 'roof',   label: 'Through the roof', price: 199, hours: 0.5 },
          ],
        },
      ],
    },
  },

  /* Booked together: the dryer vent drops to this price on top of a duct clean. */
  bundle: {
    dryerWithFurnace: 79,
    extraHours: 0.5,
  },

  /* ------------------------------ Host lines ------------------------------- */
  lines: {
    greet: [
      "Hey, welcome in! I'm {host}. Home Pros, flat rates, no surprises.",
      'What can I clean up for you today?',
    ],
    browse: 'Take your time. Everything on the board is flat rate. The price I quote is the price you pay.',
    quote: "Alright, here's your number. Flat rate, no per-vent nonsense:",
    details: "Great. I just need to know who you are and where the truck is headed.",
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
