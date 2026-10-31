/* Starting data. Every price is an approximate 2026 CAD estimate for
   planning, not a quote. Everything here is editable in the app.

   qty rules (how the target is worked out from the profile):
     pd    per person per day of the prep target
     pp    per person
     fx    fixed
     lvl   per level of the home (CO / smoke detectors)
     petd  per pet per day
     veh   per vehicle
   when: a profile condition that must hold for the item to apply.
   fam: scenario families it matters for ('*' = all).              */
window.PP = window.PP || {};

PP.STORE_TYPES = {
  grocery: 'Grocery', pharmacy: 'Pharmacy', hardware: 'Hardware', outdoor: 'Outdoor / sporting',
  electronics: 'Electronics / radio', fuel: 'Fuel / propane', farm: 'Farm & ranch', security: 'Security',
  bank: 'Bank / cash', other: 'Other'
};

PP.CATEGORIES = ['Water', 'Food', 'Heat & warmth', 'Power & light', 'Communications', 'Medical', 'Sanitation', 'Fire & CO safety', 'Security', 'Fuel & vehicle', 'Fallout & sealing', 'Documents & cash'];

PP.CATALOG = [
  // Water
  { id: 'water', name: 'Stored drinking water', cat: 'Water', unit: 'L', rule: 'pd', n: 4, pri: 'Critical', cost: 0.5, life: 12, store: 'grocery', fam: ['*'], note: '4 L per person per day: 2 L drinking, 2 L cooking and hygiene. Rotate yearly.' },
  { id: 'jerry-water', name: 'Water containers, 20 L', cat: 'Water', unit: 'each', rule: 'pp', n: 1, pri: 'Important', cost: 25, life: 0, store: 'outdoor', fam: ['*'] },
  { id: 'filter', name: 'Gravity water filter', cat: 'Water', unit: 'each', rule: 'fx', n: 1, pri: 'Important', cost: 120, life: 0, store: 'outdoor', fam: ['grid', 'water', 'econ'] },
  { id: 'bleach', name: 'Unscented bleach (5–6%), 1.9 L', cat: 'Water', unit: 'jugs', rule: 'fx', n: 2, pri: 'Important', cost: 6, life: 12, store: 'grocery', fam: ['*'], note: '2 drops per litre, stand 30 min. Loses strength after a year.' },
  // Food
  { id: 'food', name: 'Shelf-stable food (person-days)', cat: 'Food', unit: 'person-days', rule: 'pd', n: 1, pri: 'Critical', cost: 12, life: 24, store: 'grocery', fam: ['*'], note: 'Food you already eat: canned, dried, no-cook options. About 2,000 kcal per person-day.' },
  { id: 'staples', name: 'Bulk staples (rice, oats, beans, pasta)', cat: 'Food', unit: 'kg', rule: 'pp', n: 10, pri: 'Important', cost: 3, life: 60, store: 'grocery', fam: ['grid', 'econ', 'pandemic', 'nuclear'] },
  { id: 'canopener', name: 'Manual can opener', cat: 'Food', unit: 'each', rule: 'fx', n: 2, pri: 'Critical', cost: 10, life: 0, store: 'grocery', fam: ['*'] },
  { id: 'petfood', name: 'Pet food (pet-days)', cat: 'Food', unit: 'pet-days', rule: 'petd', n: 1, pri: 'Critical', cost: 2, life: 12, store: 'farm', fam: ['*'], when: 'pets' },
  { id: 'stove', name: 'Outdoor camp stove + fuel (outdoor use only)', cat: 'Food', unit: 'kit', rule: 'fx', n: 1, pri: 'Nice-to-have', cost: 90, life: 0, store: 'outdoor', fam: ['grid', 'econ'], note: 'Never indoors or in a garage. CO kills.' },
  // Heat
  { id: 'bags', name: 'Sleeping bag rated -30°C or lower', cat: 'Heat & warmth', unit: 'each', rule: 'pp', n: 1, pri: 'Critical', cost: 180, life: 0, store: 'outdoor', fam: ['grid', 'cold', 'nuclear'] },
  { id: 'blankets', name: 'Wool blankets', cat: 'Heat & warmth', unit: 'each', rule: 'pp', n: 2, pri: 'Important', cost: 40, life: 0, store: 'outdoor', fam: ['grid', 'cold', 'nuclear'] },
  { id: 'base', name: 'Thermal base layers (set)', cat: 'Heat & warmth', unit: 'sets', rule: 'pp', n: 1, pri: 'Important', cost: 60, life: 0, store: 'outdoor', fam: ['grid', 'cold'] },
  { id: 'warmers', name: 'Hand / body warmers', cat: 'Heat & warmth', unit: 'each', rule: 'pp', n: 20, pri: 'Important', cost: 1, life: 48, store: 'outdoor', fam: ['cold', 'grid'] },
  { id: 'heater', name: 'Indoor-rated portable propane heater (CSA)', cat: 'Heat & warmth', unit: 'each', rule: 'fx', n: 1, pri: 'Important', cost: 180, life: 0, store: 'hardware', fam: ['grid', 'cold'], when: 'noBackupHeat', note: 'Only models certified for indoor use, with low-oxygen shutoff, per label ventilation, and a working CO alarm.' },
  { id: 'propane', name: '1 lb propane cylinders', cat: 'Heat & warmth', unit: 'each', rule: 'fx', n: 12, pri: 'Important', cost: 8, life: 0, store: 'hardware', fam: ['grid', 'cold'], when: 'noBackupHeat' },
  { id: 'firewood', name: 'Seasoned firewood', cat: 'Heat & warmth', unit: 'cords', rule: 'fx', n: 1, pri: 'Critical', cost: 400, life: 0, store: 'farm', fam: ['grid', 'cold'], when: 'woodStove' },
  { id: 'plastic-insul', name: 'Window insulation film / blankets for the warm room', cat: 'Heat & warmth', unit: 'kit', rule: 'fx', n: 1, pri: 'Nice-to-have', cost: 30, life: 0, store: 'hardware', fam: ['cold', 'grid'] },
  // Power & light
  { id: 'headlamp', name: 'LED headlamp', cat: 'Power & light', unit: 'each', rule: 'pp', n: 1, pri: 'Critical', cost: 30, life: 0, store: 'outdoor', fam: ['*'] },
  { id: 'lantern', name: 'LED lantern', cat: 'Power & light', unit: 'each', rule: 'fx', n: 2, pri: 'Important', cost: 35, life: 0, store: 'hardware', fam: ['*'] },
  { id: 'batteries', name: 'AA/AAA batteries (24-pack)', cat: 'Power & light', unit: 'packs', rule: 'fx', n: 4, pri: 'Critical', cost: 25, life: 84, store: 'hardware', fam: ['*'] },
  { id: 'powerbank', name: 'Power bank, 20,000 mAh', cat: 'Power & light', unit: 'each', rule: 'pp', n: 1, pri: 'Important', cost: 50, life: 0, store: 'electronics', fam: ['*'] },
  { id: 'station', name: 'Portable power station + solar panel', cat: 'Power & light', unit: 'kit', rule: 'fx', n: 1, pri: 'Nice-to-have', cost: 900, life: 0, store: 'electronics', fam: ['grid', 'cold'] },
  { id: 'blackout', name: 'Blackout covers for windows (light discipline)', cat: 'Power & light', unit: 'kit', rule: 'fx', n: 1, pri: 'Important', cost: 80, life: 0, store: 'hardware', fam: ['grid', 'unrest', 'nuclear'] },
  // Comms
  { id: 'radio', name: 'Hand-crank / battery AM-FM emergency radio', cat: 'Communications', unit: 'each', rule: 'fx', n: 1, pri: 'Critical', cost: 60, life: 0, store: 'electronics', fam: ['*'] },
  { id: 'frs', name: 'FRS/GMRS two-way radios (pair)', cat: 'Communications', unit: 'pairs', rule: 'fx', n: 1, pri: 'Important', cost: 90, life: 0, store: 'electronics', fam: ['*'] },
  { id: 'maps', name: 'Paper maps: Parkland County + Alberta road map', cat: 'Communications', unit: 'set', rule: 'fx', n: 1, pri: 'Important', cost: 20, life: 0, store: 'outdoor', fam: ['*'] },
  // Medical
  { id: 'firstaid', name: 'Comprehensive first-aid kit', cat: 'Medical', unit: 'kit', rule: 'fx', n: 1, pri: 'Critical', cost: 120, life: 36, store: 'pharmacy', fam: ['*'] },
  { id: 'meds', name: 'Prescription reserve (30 days, ask pharmacist)', cat: 'Medical', unit: 'reserve', rule: 'fx', n: 1, pri: 'Critical', cost: 0, life: 12, store: 'pharmacy', fam: ['*'], when: 'medical' },
  { id: 'otc', name: 'OTC kit: pain/fever, anti-diarrheal, electrolytes, allergy', cat: 'Medical', unit: 'kit', rule: 'fx', n: 1, pri: 'Important', cost: 60, life: 24, store: 'pharmacy', fam: ['*'] },
  { id: 'n95', name: 'N95 / KN95 respirators', cat: 'Medical', unit: 'each', rule: 'pp', n: 10, pri: 'Important', cost: 2, life: 60, store: 'hardware', fam: ['nuclear', 'pandemic', 'evac'], note: 'Wildfire smoke, fallout dust, illness.' },
  { id: 'emblanket', name: 'Emergency (mylar) blankets', cat: 'Medical', unit: 'each', rule: 'pp', n: 2, pri: 'Important', cost: 3, life: 0, store: 'outdoor', fam: ['cold', 'grid', 'evac'] },
  { id: 'thermo', name: 'Digital thermometer (low-reading)', cat: 'Medical', unit: 'each', rule: 'fx', n: 1, pri: 'Important', cost: 20, life: 0, store: 'pharmacy', fam: ['*'] },
  // Sanitation
  { id: 'bucket', name: 'Bucket toilet kit (2 buckets, lids, seat)', cat: 'Sanitation', unit: 'kit', rule: 'fx', n: 1, pri: 'Critical', cost: 45, life: 0, store: 'hardware', fam: ['grid', 'nuclear', 'water', 'cold'] },
  { id: 'bags-garbage', name: 'Heavy-duty garbage bags (box)', cat: 'Sanitation', unit: 'boxes', rule: 'fx', n: 3, pri: 'Critical', cost: 15, life: 0, store: 'grocery', fam: ['*'] },
  { id: 'litter', name: 'Kitty litter or sawdust (toilet cover)', cat: 'Sanitation', unit: 'kg', rule: 'fx', n: 20, pri: 'Important', cost: 1, life: 0, store: 'grocery', fam: ['grid', 'nuclear', 'water'] },
  { id: 'tp', name: 'Toilet paper', cat: 'Sanitation', unit: 'rolls', rule: 'pd', n: 0.5, pri: 'Important', cost: 0.8, life: 0, store: 'grocery', fam: ['*'] },
  { id: 'sanitizer', name: 'Hand sanitizer, soap, wet wipes', cat: 'Sanitation', unit: 'kit', rule: 'fx', n: 1, pri: 'Important', cost: 40, life: 24, store: 'pharmacy', fam: ['*'] },
  // Fire & CO
  { id: 'co', name: 'Battery CO detector', cat: 'Fire & CO safety', unit: 'each', rule: 'lvl', n: 1, pri: 'Critical', cost: 40, life: 84, store: 'hardware', fam: ['*'], note: 'One per level and outside sleeping areas. Replace units at end of life (usually 7–10 yrs).' },
  { id: 'smoke', name: 'Smoke alarm (battery)', cat: 'Fire & CO safety', unit: 'each', rule: 'lvl', n: 1, pri: 'Critical', cost: 25, life: 120, store: 'hardware', fam: ['*'] },
  { id: 'extinguisher', name: 'ABC fire extinguisher', cat: 'Fire & CO safety', unit: 'each', rule: 'fx', n: 2, pri: 'Critical', cost: 50, life: 120, store: 'hardware', fam: ['*'] },
  // Security
  { id: 'door', name: 'Door reinforcement (strike plate, 3" screws)', cat: 'Security', unit: 'doors', rule: 'fx', n: 2, pri: 'Important', cost: 50, life: 0, store: 'hardware', fam: ['grid', 'unrest', 'econ'] },
  { id: 'motion', name: 'Battery/solar motion lights or alarms', cat: 'Security', unit: 'each', rule: 'fx', n: 2, pri: 'Important', cost: 40, life: 0, store: 'hardware', fam: ['grid', 'unrest', 'econ'] },
  { id: 'film', name: 'Window security film (ground floor)', cat: 'Security', unit: 'kit', rule: 'fx', n: 1, pri: 'Nice-to-have', cost: 60, life: 0, store: 'hardware', fam: ['unrest'] },
  { id: 'safe', name: 'Fire-resistant safe / lockbox', cat: 'Security', unit: 'each', rule: 'fx', n: 1, pri: 'Important', cost: 120, life: 0, store: 'security', fam: ['*'] },
  // Fuel & vehicle
  { id: 'jerry-gas', name: 'Gasoline cans, 20 L (stabilized fuel)', cat: 'Fuel & vehicle', unit: 'each', rule: 'fx', n: 2, pri: 'Important', cost: 35, life: 0, store: 'hardware', fam: ['grid', 'evac', 'econ'], note: 'Store outside the living space. Stabilize and rotate every 6–12 months.' },
  { id: 'stabil', name: 'Fuel stabilizer', cat: 'Fuel & vehicle', unit: 'bottles', rule: 'fx', n: 1, pri: 'Important', cost: 20, life: 24, store: 'hardware', fam: ['grid', 'evac'] },
  { id: 'genfuel', name: 'Generator fuel (outdoor-only generator)', cat: 'Fuel & vehicle', unit: 'L', rule: 'fx', n: 60, pri: 'Important', cost: 1.6, life: 12, store: 'fuel', fam: ['grid', 'cold'], when: 'generator' },
  { id: 'carkit', name: 'Winter vehicle survival kit', cat: 'Fuel & vehicle', unit: 'kits', rule: 'veh', n: 1, pri: 'Critical', cost: 90, life: 0, store: 'outdoor', fam: ['cold', 'evac', 'grid'] },
  { id: 'gobag', name: '72-hour go-bag', cat: 'Fuel & vehicle', unit: 'bags', rule: 'pp', n: 1, pri: 'Critical', cost: 100, life: 12, store: 'outdoor', fam: ['evac', '*'] },
  // Fallout & sealing
  { id: 'sheeting', name: '6-mil plastic sheeting + duct tape', cat: 'Fallout & sealing', unit: 'kit', rule: 'fx', n: 1, pri: 'Important', cost: 50, life: 0, store: 'hardware', fam: ['nuclear', 'evac'], note: 'Seal a room for chemical shelter-in-place; cover basement windows.' },
  { id: 'dosimeter', name: 'Radiation detector / dosimeter', cat: 'Fallout & sealing', unit: 'each', rule: 'fx', n: 1, pri: 'Nice-to-have', cost: 250, life: 0, store: 'electronics', fam: ['nuclear'] },
  // Documents & cash
  { id: 'docs', name: 'ID, insurance, prescriptions copies in a waterproof pouch', cat: 'Documents & cash', unit: 'set', rule: 'fx', n: 1, pri: 'Critical', cost: 10, life: 0, store: 'other', fam: ['*'] },
  { id: 'cash', name: 'Emergency cash, small bills', cat: 'Documents & cash', unit: 'dollars', rule: 'fx', n: 500, pri: 'Critical', cost: 1, life: 0, store: 'bank', fam: ['*'], note: 'Debit and credit fail when the power or network does.' }
];

/* Suppliers: starter entries by kind of store. Names are generic on
   purpose - fill in the exact store, address, phone and hours you use. */
PP.SEED_SUPPLIERS = [
  { name: 'Grocery store (nearest)', types: ['grocery'], town: 'Stony Plain', address: '', phone: '', hours: '', notes: 'Fill in your usual grocery store.' },
  { name: 'Warehouse club (bulk staples, water)', types: ['grocery', 'outdoor'], town: 'Edmonton area', address: '', phone: '', hours: '', notes: 'Bulk rice, water, batteries.' },
  { name: 'Pharmacy (nearest)', types: ['pharmacy'], town: 'Stony Plain', address: '', phone: '', hours: '', notes: 'Ask about an emergency medication reserve.' },
  { name: 'Hardware / home store', types: ['hardware', 'security'], town: 'Stony Plain / Spruce Grove', address: '', phone: '', hours: '', notes: 'CO detectors, extinguishers, sheeting, door hardware.' },
  { name: 'Automotive / outdoor department store', types: ['outdoor', 'hardware', 'fuel', 'electronics'], town: 'Stony Plain / Spruce Grove', address: '', phone: '', hours: '', notes: 'Sleeping bags, jerry cans, vehicle kits, radios.' },
  { name: 'Farm & ranch supply', types: ['farm', 'fuel'], town: 'Parkland County', address: '', phone: '', hours: '', notes: 'Pet and livestock feed, propane exchange, firewood leads.' },
  { name: 'Electronics / radio shop', types: ['electronics'], town: 'Edmonton area', address: '', phone: '', hours: '', notes: 'GMRS, ham gear, power stations.' },
  { name: 'Propane refill / fuel station', types: ['fuel'], town: 'Stony Plain', address: '', phone: '', hours: '', notes: '' },
  { name: 'Bank or credit union branch', types: ['bank'], town: 'Stony Plain', address: '', phone: '', hours: '', notes: 'Small-bill cash withdrawal.' }
];

/* Official community resources. Phone numbers that are national or
   provincial short codes are reliable; anything else is marked to verify. */
PP.SEED_RESOURCES = [
  { name: 'Emergency services', kind: 'Emergency', contact: '911', url: '', notes: 'Life-threatening emergencies only.' },
  { name: 'Alberta Emergency Alert', kind: 'Alerts', contact: 'App + broadcast', url: 'https://www.emergencyalert.alberta.ca', notes: 'Install the app. Set Parkland County / Stony Plain as locations.' },
  { name: 'Health Link (nurse advice)', kind: 'Health', contact: '811', url: '', notes: '24/7 health advice from Alberta Health Services.' },
  { name: '211 Alberta (community & social services)', kind: 'Community', contact: '211', url: 'https://ab.211.ca', notes: 'Shelter, food, financial help, mental health.' },
  { name: 'Alberta 511 road reports', kind: 'Roads', contact: '511', url: 'https://511.alberta.ca', notes: 'Highway closures and conditions before any trip.' },
  { name: 'Town of Stony Plain emergency management', kind: 'Local government', contact: 'Verify number', url: 'https://www.stonyplain.com', notes: 'Local emergency notices and reception centre announcements.' },
  { name: 'Parkland County emergency management', kind: 'Local government', contact: 'Verify number', url: 'https://www.parklandcounty.com', notes: 'Rural evacuation orders and alerts.' },
  { name: 'Emergency reception centre', kind: 'Reception centre', contact: 'Announced during an event', url: '', notes: 'Locations are announced by the Town/County at the time. Record any pre-published location here.' },
  { name: 'Parkland Food Bank', kind: 'Food', contact: 'Verify number', url: '', notes: 'Serves Spruce Grove, Stony Plain and Parkland County. Confirm address and hours.' },
  { name: 'Alberta Emergency Management Agency', kind: 'Provincial', contact: '', url: 'https://www.alberta.ca/emergency-management', notes: 'Provincial guidance and current emergencies.' },
  { name: 'Get Prepared (Public Safety Canada)', kind: 'Federal', contact: '', url: 'https://www.getprepared.gc.ca', notes: 'Federal preparedness guides.' },
  { name: 'Canadian Red Cross', kind: 'Relief', contact: '', url: 'https://www.redcross.ca', notes: 'Disaster relief and first-aid training.' },
  { name: 'Electricity outage line (your distributor)', kind: 'Utility', contact: 'Verify number', url: '', notes: 'Check your bill for the outage number.' },
  { name: 'Natural gas emergency line (your distributor)', kind: 'Utility', contact: 'Verify number', url: '', notes: 'Smell gas? Leave the house first, then call.' }
];

PP.SEED_CHECKLISTS = [
  { title: 'Go-bag (per person)', items: ['3 days of water and no-cook food', 'Change of clothes, warm layers, toque, gloves', 'Headlamp and spare batteries', 'Medications (7 days) and copies of prescriptions', 'Copies of ID and insurance in a waterproof pouch', 'Cash in small bills', 'Phone charger and power bank', 'Whistle, emergency blanket, small first-aid kit', 'N95 masks', 'Paper map with rally points marked', 'Contact list on paper'] },
  { title: 'Warm room / basement shelter setup', items: ['Pick the room: centre of basement or smallest interior room', 'CO detector in the room, tested', 'Sleeping bags rated -30°C for everyone', 'Blankets or plastic over windows and doorway', 'Water, food, radio, lights stored in or beside the room', 'Bucket toilet set up in an adjacent space', 'Safe heat source identified (never fuel-burning appliances not rated for indoors)', 'Mass stacked against basement windows (fallout)'] },
  { title: 'Home hardening', items: ['Door strike plates with 3" screws on every exterior door', 'Ground-floor window locks checked', 'Motion lights on approaches', 'Blackout covers cut and labelled for every window', 'Supplies split into at least two hidden locations', 'Shut-off locations marked: water, gas, electrical panel', 'Wrench stored at the gas meter', 'Fire extinguishers on each level'] },
  { title: 'Winter vehicle kit', items: ['Shovel, traction aid, booster cables', 'Sleeping bag or blankets', 'Candle in a tin and waterproof matches', 'Hand warmers', 'Water and high-energy food', 'Flashlight, spare batteries', 'Bright cloth for the antenna', 'Tank kept above half full all winter'] },
  { title: 'Communications plan', items: ['Out-of-province contact chosen and agreed', 'Paper contact tree printed for every member', 'Meeting point near home agreed', 'Meeting point outside the neighbourhood agreed', 'FRS/GMRS channel and check-in times agreed', 'AM emergency stations written on the radio', 'Alberta Emergency Alert app installed on every phone'] },
  { title: 'Monthly maintenance', items: ['Test CO and smoke alarms', 'Check the expiry alerts in the purchase tracker', 'Rotate water and food nearing expiry', 'Charge power banks and the power station', 'Run the generator under load (outdoors) if you have one', 'Keep the vehicle above half a tank', 'Review the plan with the household'] },
  { title: 'Drills', items: ['48-hour lights-out basement drill in winter (yearly)', 'Fire escape drill (twice yearly)', 'Go-bag grab-and-go in under 10 minutes', 'Radio check-in with neighbours', 'Drive each bug-out route in daylight (yearly)', 'Shelter-in-place room sealing practice'] }
];
