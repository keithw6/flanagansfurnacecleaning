/* Scenario library and the stay-home-by-default rules.
   Families drive the decision matrix and which supplies matter:
     grid     - outages of any length
     cold     - extreme cold, blizzard
     nuclear  - fallout or detonation
     unrest   - civil unrest / conflict
     econ     - economic collapse
     pandemic - quarantine
     evac     - wildfire, derailment, chemical spill: the leave-early exceptions
     water    - municipal water failure
   "long" scenarios get the Collapse Conditions Modifier.             */
window.PP = window.PP || {};

PP.SCENARIOS = [
  {
    id: 'grid-72h', name: 'Grid down: 72 hours', family: ['grid'], long: false,
    duration: '72 hours', probability: 'Likely. Several multi-hour to multi-day outages in central Alberta each decade, usually from storms, ice or equipment failure.',
    summary: 'A regional power outage lasting up to three days. Phones and internet degrade within hours as tower batteries run out. Most gas furnaces stop because the blower and ignition need power.',
    triggers: ['Ice storm or heavy wet snow on lines', 'Summer windstorm or tornado', 'Substation or transmission failure', 'Grid operator rotating outages during extreme cold demand'],
    indicators: ['Alberta Emergency Alert or AESO grid alert', 'Flickering power or brownouts', 'Severe weather warning from Environment Canada', 'Neighbouring areas reporting outages'],
    first60: ['Check everyone is safe and accounted for.', 'Confirm the outage is regional: look outside, check a battery radio (AM 630 CHED / 880 CHQT / CBC 740).', 'Note the time. Start the outage log.', 'Unplug sensitive electronics; leave one lamp switched on to show when power returns.', 'Keep fridge and freezer closed. A full freezer holds about 48 hours, a fridge about 4.', 'Charge phones from power banks only, and switch them to low-power mode.', 'Fill bathtub and pots with water if you are on a well or municipal pressure is failing.', 'Check the CO detectors have working batteries before using any alternative heat or light.', 'Check on elderly or medically dependent neighbours by phone or in person.'],
    phases: null
  },
  {
    id: 'grid-2w', name: 'Grid down: 2 weeks', family: ['grid'], long: true,
    duration: '2 weeks', probability: 'Possible but uncommon. Large ice storms (e.g. Quebec 1998) and major equipment failures have caused outages of this length in Canada.',
    summary: 'Power is out across the region for about two weeks. Fuel stations, debit, grocery restocking and water treatment are all affected. Stores are stripped within days, and roads clog early with people leaving Edmonton.',
    triggers: ['Catastrophic ice storm', 'Multiple transmission line failures', 'Cyber attack on grid control systems', 'Extreme cold collapsing supply'],
    indicators: ['Utility saying "multi-day" or giving no restoration estimate', 'Fuel lineups and card payment failures', 'Cell service failing in town', 'Grocery shelves empty within 24 hours'],
    first60: ['Account for everyone. Recall anyone who is away from home if it is safe for them to travel.', 'Confirm scope by battery radio. Note time in the log.', 'Golden window: decide NOW whether a pre-arranged retreat is in play (see decision matrix). If not, commit to staying.', 'Top up water: fill tubs, pots and containers while pressure lasts.', 'Inventory perishable food; plan to eat fridge food first, freezer second, pantry last.', 'Fuel up the vehicle and jerry cans only if a station is working with no lineup. Do not queue for hours.', 'Withdraw nothing; cash on hand is what you have. Do not advertise it.', 'Close blinds and curtains. Begin light discipline at dusk.', 'Check CO detectors and set up the warm room.'],
    phases: null
  },
  {
    id: 'grid-long', name: 'Grid down: long-term (EMP / major grid failure)', family: ['grid'], long: true,
    duration: '3+ months', probability: 'Low probability, very high impact. Treat as a planning ceiling rather than an expectation.',
    summary: 'A geomagnetic storm, EMP or cascading failure takes the grid down for months. Fuel, medicine, food distribution and communications fail. Social order degrades in phases.',
    triggers: ['Severe geomagnetic storm (Carrington-class)', 'High-altitude EMP', 'Coordinated attack on grid infrastructure', 'Cascade failure with damaged large transformers'],
    indicators: ['NOAA / NRCan space weather G5 warning', 'Simultaneous failure of electronics and vehicles (EMP)', 'No official broadcast after 24 hours', 'No restoration estimate at all'],
    first60: ['Account for everyone. Assume no phones.', 'Check whether vehicles and electronics work (EMP test). Note results.', 'Golden window: if a pre-arranged retreat exists and all GO conditions are met, decide within the hour.', 'Fill every water container while pressure lasts.', 'Secure supplies out of sight. Close blinds.', 'Begin the outage log and rationing plan from hour one.', 'Contact your pre-vetted neighbour group in person.', 'Set up the warm room if it is cold season.', 'Verify CO detectors and fire extinguishers.'],
    phases: null
  },
  {
    id: 'cold-snap', name: 'Extreme cold snap with power loss (-40°C, multi-day)', family: ['cold', 'grid'], long: false,
    duration: '2–7 days', probability: 'Likely in any given decade. Central Alberta sees -40°C most winters; the January 2024 cold snap pushed the grid to emergency alerts.',
    summary: 'Temperatures of -35°C to -45°C with a power outage. An unheated house drops below freezing in 12–36 hours depending on insulation. Pipes freeze, and carbon monoxide from improvised heating becomes the main killer.',
    triggers: ['Arctic air mass', 'Grid emergency from peak demand', 'Gas supply pressure drop', 'Local line failure that crews cannot reach quickly'],
    indicators: ['Environment Canada extreme cold warning', 'AESO grid alert and requests to conserve power', 'Furnace short-cycling or not igniting', 'House temperature falling faster than 1°C per hour'],
    first60: ['Everyone stays indoors. No one travels unless in danger.', 'Check CO detectors on every level have working batteries.', 'Choose the warm room: a small interior room or the centre of the basement.', 'Close off unused rooms; hang blankets over doorways and windows.', 'Dress everyone in layers including hats; keep feet dry.', 'Start safe heat only: a wood stove that is professionally installed, or an indoor-rated propane heater with the window cracked as the label requires. Never a BBQ, camp stove, generator or car.', 'Open taps to a slow drip and open under-sink cabinets to delay frozen pipes.', 'Note the indoor temperature every hour in the log.', 'Prepare to drain the plumbing if the house falls below 5°C and stays there.'],
    phases: 'short'
  },
  {
    id: 'nuke-distant', name: 'Nuclear event: distant strike, fallout arrives', family: ['nuclear'], long: true,
    duration: '2 weeks sheltering, months of disruption', probability: 'Very low. Included because the correct response (get in, stay in) is counter-intuitive and the wrong one is deadly.',
    summary: 'A nuclear detonation hundreds of kilometres away. Fallout may arrive over hours depending on wind. Power, communications and supply chains are disrupted nationally.',
    triggers: ['Strike on a distant military or urban target', 'Wind carrying fallout toward Parkland County'],
    indicators: ['National alerting (Alert Ready) broadcast', 'News of a detonation anywhere in North America', 'Official fallout plume maps', 'Radio stations going off air'],
    first60: ['Get inside. Bring everyone and pets in immediately.', 'Go to the centre of the basement, away from windows and exterior walls.', 'Anyone who was outside: remove outer clothing, bag it, shower or wipe down. Shampoo, no conditioner.', 'Shut off the furnace/HRV fresh-air intake and close windows, doors and fireplace dampers.', 'Fill containers with tap water now if pressure is still on. Covered water is safe from fallout.', 'Bring the shelter kit to the basement: water, food, radio, lights, sanitation, medications.', 'Stack mass (boxes, books, water containers) against basement windows and the walls facing the most exposed side.', 'Tune to the AM emergency broadcast. Do not leave to collect family; they should shelter where they are.', 'Do NOT take potassium iodide unless public health officials tell you to.'],
    phases: null
  },
  {
    id: 'nuke-regional', name: 'Nuclear event: regional detonation', family: ['nuclear'], long: true,
    duration: '2 weeks sheltering, months to years of disruption', probability: 'Extremely low. Edmonton-area targets would put Stony Plain inside the fallout zone depending on wind.',
    summary: 'A detonation in the region (e.g. Edmonton or CFB Edmonton). Flash, blast and fire near the target; heavy fallout downwind within 15–60 minutes. No emergency services for days.',
    triggers: ['Detonation in the Edmonton region'],
    indicators: ['Bright flash; do not look at it', 'Delayed blast wave: stay down and away from windows', 'Mushroom cloud to the east', 'Electronics failing (EMP)'],
    first60: ['If you see a flash: drop, cover your head, stay away from windows until the blast wave passes (it can take up to a minute or more).', 'Get everyone into the centre of the basement within minutes. Fallout can arrive in 15 minutes.', 'If you have no basement and a far better shelter is only a few minutes away on foot, go now; otherwise stay in the most interior room.', 'Decontaminate anyone who was outside: remove and bag outer clothing, shower or wipe down.', 'Shut off fresh-air intakes, close windows, doors and dampers.', 'Fill water containers if pressure remains.', 'Check for fire and injuries; treat with the first-aid kit.', 'Turn on a battery radio for instructions.', 'Do not travel to collect family. Everyone shelters where they are for at least 24–48 hours.'],
    phases: null
  },
  {
    id: 'unrest', name: 'Civil unrest / civil conflict', family: ['unrest', 'grid'], long: true,
    duration: 'Days to months', probability: 'Low in Parkland County. Spillover from Edmonton and disruption of supplies are more likely than direct conflict.',
    summary: 'Protests, riots or conflict disrupt the region. Roads become unsafe, services patchy, and targeted crime rises. The goal is to be unremarkable and stay out of it.',
    triggers: ['Contested political event', 'Supply shortages', 'Prolonged outage with no information'],
    indicators: ['Roadblocks or closures on Hwy 16 / 16A', 'Escalating local social media', 'Police unable to respond to calls', 'Businesses boarding up'],
    first60: ['Bring everyone home if routes are safe; otherwise shelter with trusted people where they are.', 'Lock doors, close blinds, keep lights low.', 'Move vehicles into the garage or out of sight.', 'Check the radio and official sources; ignore rumour.', 'Contact your neighbour group; agree a watch rotation.', 'Keep go-bags by the door in case you have to leave.', 'Stay off social media. Post nothing about your supplies or location.'],
    phases: null
  },
  {
    id: 'econ', name: 'Economic collapse / hyperinflation', family: ['econ'], long: true,
    duration: 'Months to years', probability: 'Low for a full collapse; moderate for severe recession with shortages and high inflation.',
    summary: 'Prices spike, banks restrict withdrawals, supply chains thin out and unemployment rises. The danger is slow: debt, cold, illness and crime over months.',
    triggers: ['Banking crisis', 'Currency crisis', 'Severe supply-chain shock'],
    indicators: ['Bank withdrawal limits', 'Rapidly rising prices for food and fuel', 'Empty shelves on staples', 'Layoffs across sectors'],
    first60: ['Do not panic-buy at inflated prices; use what you have.', 'Review cash on hand, debts and fixed bills.', 'Prioritise heat, housing payments, food and medicine.', 'Refill prescriptions while pharmacies are stocked.', 'Talk with your neighbour group about pooling skills and bulk buying.'],
    phases: null
  },
  {
    id: 'pandemic', name: 'Pandemic / long-term quarantine', family: ['pandemic'], long: true,
    duration: 'Weeks to months', probability: 'Moderate. COVID-19 showed how quickly supply and services can tighten.',
    summary: 'A serious infectious disease spreads. Public health orders restrict movement, hospitals are stretched, and staff shortages hit utilities and stores.',
    triggers: ['Novel pathogen with high spread and severity'],
    indicators: ['Public health emergency declaration', 'School and workplace closures', 'Hospital capacity warnings'],
    first60: ['Follow Alberta Health Services and Health Canada guidance.', 'Check medication supplies; request refills.', 'Set up an isolation room in case someone gets sick.', 'Stock masks, gloves, soap, disinfectant and fever reducers.', 'Plan contact-free resupply with neighbours.'],
    phases: null
  },
  {
    id: 'wildfire', name: 'Wildfire evacuation (Parkland County)', family: ['evac'], long: false,
    duration: 'Hours to weeks away from home', probability: 'Moderate. Parkland County has had wildfire evacuation orders (e.g. 2023).',
    summary: 'A wildfire threatens the area. This is an exception to stay-home-by-default: LEAVE EARLY AND FAST when ordered or when the threat is visible.',
    triggers: ['Dry spring or summer with high winds', 'Lightning or human ignition nearby'],
    indicators: ['Alberta Wildfire hazard rating high/extreme', 'Smoke column or ash fall', 'Evacuation alert (be ready) from Parkland County', 'Fire bans in effect'],
    first60: ['On an evacuation ORDER: leave now by the route officials give. Do not wait to see.', 'On an ALERT: load the go-bags, pets, medications and documents into the vehicle, nose out.', 'Close all windows and doors; leave them unlocked only if officials ask.', 'Shut off propane at the tank if safe; leave lights on so the house is visible in smoke.', 'Move combustibles away from the house only if you have time and no order.', 'Tell your out-of-area contact where you are going.', 'Register with the reception centre or Parkland County once you are safe.'],
    phases: 'short'
  },
  {
    id: 'blizzard', name: 'Severe blizzard: stranded at home or in a vehicle', family: ['cold'], long: false,
    duration: '1–3 days', probability: 'Likely. Highway closures on 16 and 16A happen most winters.',
    summary: 'Heavy snow and wind make roads impassable. At home, prepare for power loss. In a vehicle, staying with the vehicle is almost always safer than walking.',
    triggers: ['Alberta clipper', 'Spring blizzard with wet snow'],
    indicators: ['Environment Canada blizzard or snowfall warning', 'Alberta 511 highway closures', 'Visibility dropping quickly'],
    first60: ['At home: bring everyone in, fill water, charge power banks, ready the warm room.', 'In a vehicle: pull fully off the road if you can, turn on hazard lights.', 'Call 911 if you have signal and give your location.', 'Stay with the vehicle. Do not walk for help in a whiteout.', 'Clear the exhaust pipe of snow before running the engine; run it 10 minutes per hour with a window cracked to avoid CO.', 'Put on all extra clothing; use the winter vehicle kit and candle or heat packs.', 'Tie a bright cloth to the antenna; keep the dome light on when running the engine.'],
    phases: 'short'
  },
  {
    id: 'water', name: 'Water contamination / municipal system failure', family: ['water'], long: false,
    duration: 'Days to weeks', probability: 'Moderate. Boil-water advisories are common in Alberta; regional supply comes from Edmonton via pipeline.',
    summary: 'The municipal water supply is unsafe or stops. Treat all tap water as unsafe until officials say otherwise.',
    triggers: ['Main break', 'Treatment failure', 'Pipeline damage', 'Contamination event'],
    indicators: ['Boil-water advisory', 'Low pressure or discoloured water', 'Town notice'],
    first60: ['Stop drinking tap water. Use stored water.', 'Follow the advisory: boil (rolling boil, 1 minute) or do not use at all if it is a "do not consume" order.', 'Fill containers if the advisory is boil-only and water still flows.', 'Set aside water for infants, the sick and pets first.', 'Use hand sanitizer for hygiene; reserve water for drinking.'],
    phases: 'short'
  },
  {
    id: 'derailment', name: 'Train derailment / chemical spill (CN line)', family: ['evac'], long: false,
    duration: 'Hours to days', probability: 'Low but real. The CN main line carries hazardous goods through Stony Plain.',
    summary: 'A derailment or highway spill releases hazardous material. Authorities will order either evacuation or shelter-in-place. Follow the order exactly.',
    triggers: ['Derailment on the CN line', 'Tanker crash on Hwy 16 / 16A'],
    indicators: ['Alberta Emergency Alert', 'Strong chemical smell, visible cloud', 'Emergency vehicles converging on the rail line'],
    first60: ['If ordered to EVACUATE: leave immediately, upwind and uphill, by the route given.', 'If ordered to SHELTER IN PLACE: get inside, close windows and doors, shut off furnace/HRV/fans, go to an interior room and seal gaps with plastic and tape.', 'If you smell gas or chemicals outside with no order yet: get inside and seal up, then listen for instructions.', 'Do not go near the site to look.', 'Keep the radio on. Do not leave until the all-clear.'],
    phases: 'short'
  }
];

/* Matrix rows. Each row applies to the families listed (or '*').
   verdict: STAY | GO | GO ONLY IF. note() can personalise from profile. */
PP.MATRIX = [
  { fam: ['grid', 'cold', 'unrest', 'econ', 'pandemic', 'water'], cond: 'Home heated or safely heatable, structure sound, water available', verdict: 'STAY', why: 'Staying is the default. Exposure and travel kill more people than staying put.' },
  { fam: ['grid', 'cold'], cond: 'Heat has failed, outside -25°C or colder, no confirmed heated destination', verdict: 'STAY', why: 'Consolidate into one warm room or the basement. A cold house still beats a road or a vehicle.' },
  { fam: ['grid', 'cold'], cond: 'Home cannot be heated at all, confirmed heated destination reachable in ONE daylight leg', verdict: 'GO ONLY IF', why: 'Winter-equipped vehicle, full survival kit, roads open, leave at first light, destination confirmed by radio/phone.', retreat: true },
  { fam: ['nuclear'], cond: 'Fallout warning or first 24–48 hours after detonation', verdict: 'STAY', why: 'Centre of basement. Radiation drops ~90% by 7 hours and ~99% by 48 hours. Travel now is the most dangerous choice.' },
  { fam: ['nuclear'], cond: 'No basement or shelter damaged, better shelter only minutes away on foot', verdict: 'GO ONLY IF', why: 'Only before fallout arrives (roughly first 10–15 minutes) or if fire/structural collapse forces it.' },
  { fam: ['nuclear'], cond: 'After 48 hours, official instruction to evacuate', verdict: 'GO', why: 'Follow the official route. Cover nose and mouth, decontaminate on arrival.' },
  { fam: ['nuclear'], cond: 'After 48 hours, no instruction, shelter adequate', verdict: 'STAY', why: 'Brief essential trips only after the heavy-fallout window. Plan for up to 2 weeks.' },
  { fam: ['evac'], cond: 'Official evacuation ORDER, or fire/plume visible and approaching', verdict: 'GO', why: 'This is the exception: leave early and fast by the designated route.' },
  { fam: ['evac'], cond: 'Official SHELTER-IN-PLACE order (chemical release)', verdict: 'STAY', why: 'Seal an interior room, shut off fans and HRV. Do not leave until the all-clear.' },
  { fam: ['evac'], cond: 'Evacuation ALERT only (be ready)', verdict: 'GO ONLY IF', why: 'Load the vehicle now. Leaving early is fine and avoids traffic; go if conditions worsen or you have vulnerable people.' },
  { fam: ['grid', 'unrest'], cond: 'Golden window (0–24 h), pre-arranged retreat confirmed, roads clear', verdict: 'GO ONLY IF', why: 'Every condition must be true. Leave at first light, one leg, avoid highways and convoys.', retreat: true },
  { fam: ['grid', 'unrest', 'econ'], cond: 'Chaos period (day 2 – week 4): gridlock, roadblocks, desperate people on the roads', verdict: 'STAY', why: 'Go quiet and go low. Light, noise and smell discipline. Reassess at day 3, week 2, week 4 and week 8.' },
  { fam: ['grid', 'unrest', 'econ', 'pandemic'], cond: 'Stabilization (week 8+), roads clearing, destination confirmed', verdict: 'GO ONLY IF', why: 'Only after a reassessment checkpoint shows the route is safe and the destination is better than home.', retreat: true },
  { fam: ['*'], cond: 'House on fire, structure failing, or a threat to life you cannot avoid', verdict: 'GO', why: 'People before property. Go to the rally point or retreat. Stuff can be replaced.' },
  { fam: ['cold'], cond: 'Stranded in a vehicle in a blizzard', verdict: 'STAY', why: 'Stay with the vehicle. Run the engine 10 min/hour with exhaust clear and a window cracked.' },
  { fam: ['*'], cond: 'Medical emergency beyond household ability', verdict: 'GO ONLY IF', why: 'A facility is confirmed operating and the route is safe. Otherwise radio or send for help.' }
];

PP.CHECKPOINTS = ['Day 3', 'Week 2', 'Week 4', 'Week 8'];

/* Live decision check - a small rule engine following the same rules. */
PP.decide = function (c, profile) {
  const out = (verdict, reasons) => ({ verdict, reasons });
  const r = [];
  const cold = Number(c.temp) <= -25;
  const hasBasement = profile && profile.basement && profile.basement !== 'none';

  if (c.structure === 'fire') return out('GO', ['Fire or structural failure: get everyone out now.', c.fallout === 'active' ? 'Move to the nearest intact building and get to its most interior, lowest space.' : 'Go to the rally point. People before property.']);
  if (c.order === 'evacuate') return out('GO', ['An official evacuation order is in effect. Leave now by the designated route.', cold ? 'Take the full winter kit; dress everyone for the outside temperature.' : 'Take go-bags, medications, documents and pets.']);
  if (c.order === 'shelter') return out('STAY', ['An official shelter-in-place order is in effect.', 'Seal an interior room, shut off furnace, HRV and fans, and wait for the all-clear.']);
  if (c.fallout === 'warning' || c.fallout === 'active') {
    if (!hasBasement && c.fallout === 'warning') return out('GO ONLY IF', ['No basement on your profile.', 'Go only if a far better shelter (a large building with a basement) is a few minutes away on foot and fallout has not arrived.', 'Otherwise shelter in the most interior ground-floor room, away from windows.']);
    return out('STAY', ['Fallout window: get in, stay in.', hasBasement ? 'Centre of the basement with as much mass around you as possible.' : 'Most interior room, lowest floor, away from windows.', 'Radiation falls ~90% by 7 hours and ~99% by 48 hours.']);
  }
  if (c.threat === 'imminent') return out('GO', ['A threat to life you cannot avoid or hide from.', 'Leave to the rally point or retreat by the safest route. Do not fight for property.']);

  const destOk = c.dest === 'confirmed';
  const roadsOk = c.roads === 'clear';
  const daylight = c.daylight === 'yes';

  if (c.heat === 'none') {
    if (cold) {
      if (destOk && roadsOk && daylight) return out('GO ONLY IF', ['The home cannot be heated and it is -25°C or colder.', 'You have a confirmed heated destination, the roads are clear and it is daylight.', 'Go only with a winter-equipped vehicle and full survival kit, in one leg. Confirm the destination is expecting you.']);
      r.push('The home cannot be heated, but there is no safe way to move (destination, roads or daylight).');
      r.push('Consolidate everyone into one small room or the basement, seal it, layer up, use -30°C sleeping bags and shared body heat.');
      r.push('CO is the main killer now: no generators, BBQs, camp stoves or vehicles indoors.');
      return out('STAY', r);
    }
    r.push('No heat, but outside is above -25°C. The house is survivable with layers and a warm room.');
  } else if (c.heat === 'failing') {
    r.push('Heat failing: set up the warm room now while the house still holds heat.');
  }

  if (c.phase === 'golden') {
    if (destOk && roadsOk && c.threat !== 'elevated') return out('GO ONLY IF', r.concat(['Golden window with a confirmed retreat and clear roads.', 'Leave at first light in one leg, avoid Hwy 16/16A/60 where possible, use range and township roads.', 'If any condition fails, stay.']));
    r.push('Golden window, but no confirmed destination or the roads are not clear.');
    return out('STAY', r.concat(['Commit to staying: go quiet and go low.']));
  }
  if (c.phase === 'chaos') return out('STAY', r.concat(['Chaos period. Moving is riskier than staying.', 'Light, noise and smell discipline. Reassess at the next checkpoint (day 3, week 2, week 4, week 8).']));
  if (c.phase === 'stabilization') {
    if (destOk && roadsOk) return out('GO ONLY IF', r.concat(['Stabilization phase with a confirmed destination and clear roads.', 'Go only if the destination is genuinely better than home after a checkpoint review.']));
    return out('STAY', r.concat(['Stabilization phase. Keep improving the home position and community ties.']));
  }
  if (c.threat === 'elevated') r.push('Threat elevated: increase OPSEC, watch rotation, keep go-bags ready.');
  return out('STAY', r.concat(['Staying is the default when no trigger for leaving is met.']));
};
