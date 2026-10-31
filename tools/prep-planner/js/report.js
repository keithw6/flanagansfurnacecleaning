/* Scenario report generator. Builds a printable plan from the
   scenario, the household profile and the purchase tracker.     */
window.PP = window.PP || {};

PP.buildReport = function (s, scenarioId) {
  const sc = PP.SCENARIOS.find(x => x.id === scenarioId) || PP.SCENARIOS[0];
  const p = s.profile, e = PP.esc, n = PP.persons(p);
  const has = f => sc.family.includes(f);
  const long = sc.long;
  const basement = p.basement === 'unknown' ? 'concrete' : p.basement;
  const today = new Date().toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' });
  const sum = PP.summary(s);
  const waterT = PP.target(s.items.find(i => i.id === 'water') || { rule: 'pd', n: 4 }, p);
  const ul = a => '<ul>' + a.filter(Boolean).map(x => `<li>${x}</li>`).join('') + '</ul>';
  const ck = a => '<ul class="ck">' + a.filter(Boolean).map(x => `<li><span class="box"></span><span>${x}</span></li>`).join('') + '</ul>';
  const ol = a => '<ol class="ck">' + a.filter(Boolean).map(x => `<li><span class="box"></span><span>${x}</span></li>`).join('') + '</ol>';
  const sections = [];
  const sec = (title, html) => sections.push({ title, html });

  const members = [
    `${p.adults} adult${p.adults == 1 ? '' : 's'}`,
    +p.children ? `${p.children} child${p.children == 1 ? '' : 'ren'}${p.childAges ? ' (' + e(p.childAges) + ')' : ''}` : '',
    +p.seniors ? `${p.seniors} senior${p.seniors == 1 ? '' : 's'}` : '',
    +p.pets ? `${p.pets} pet${p.pets == 1 ? '' : 's'}${p.petNotes ? ' (' + e(p.petNotes) + ')' : ''}` : ''
  ].filter(Boolean).join(', ');

  const heatName = { 'gas-forced': 'natural gas forced-air furnace', 'gas-boiler': 'gas boiler', electric: 'electric heat', wood: 'wood heat', propane: 'propane furnace', other: 'other heat' }[p.heat] || p.heat;
  const backupName = { none: 'no backup heat', wood: 'wood stove', 'indoor-propane': 'indoor-rated propane heater', fireplace: 'gas fireplace (direct vent)', other: 'other backup heat' }[p.backupHeat] || p.backupHeat;

  /* 1 */
  sec('Scenario Summary', `
    <p>${e(sc.summary)}</p>
    <table class="kv"><tr><th>Realistic duration</th><td>${e(sc.duration)}</td></tr>
    <tr><th>Probability (central Alberta)</th><td>${e(sc.probability)}</td></tr>
    <tr><th>Household</th><td>${members}; ${e(p.location)}</td></tr>
    <tr><th>Default strategy</th><td><b>${has('evac') ? 'LEAVE EARLY AND FAST when ordered or when the threat is visible.' : has('nuclear') ? 'GET INSIDE, STAY INSIDE. Centre of the basement.' : 'STAY HOME. Bug-in is the default; leave only when the triggers below are met.'}</b></td></tr></table>
    <h4>Likely triggers</h4>${ul(sc.triggers.map(e))}
    ${long ? `<div class="callout"><b>Collapse Conditions Modifier applies.</b> Assume no police, fire or EMS (911 down or unanswered), no resupply (stores stripped within 24–72 hours), and a sharp rise in theft and opportunistic crime. Social order degrades in phases; see sections 6, 7 and 14.</div>` : ''}`);

  /* 2 */
  sec('Early Warning Indicators', ck(sc.indicators.map(e)) + `<p class="small">Sources to watch: Alberta Emergency Alert, Environment Canada warnings, AM emergency broadcast, Alberta 511, Town of Stony Plain and Parkland County notices.</p>`);

  /* 3 */
  const rows = PP.MATRIX.filter(r => r.fam.includes('*') || r.fam.some(f => sc.family.includes(f)));
  sec('Bug-In vs Bug-Out Decision Matrix', `
    <table class="grid matrix"><thead><tr><th>Conditions</th><th>Verdict</th><th>Why / what to do</th></tr></thead><tbody>
    ${rows.map(r => {
      let why = e(r.why);
      let verdict = r.verdict;
      if (r.retreat && !p.retreatConfirmed) { why += ' <b>Your profile has no confirmed retreat, so this verdict is STAY until one is arranged.</b>'; verdict = 'STAY'; }
      return `<tr><td>${e(r.cond)}</td><td class="v v-${verdict.replace(/\s+/g, '-').toLowerCase()}">${verdict}</td><td>${why}</td></tr>`;
    }).join('')}
    </tbody></table>
    <p><b>Weigh every time:</b> outside temperature and weather; the home's heat, structure, water and security; fallout or contamination status; the phase of the event; road conditions and threats on the route; and whether a confirmed destination can be reached in one leg.</p>
    <p><b>Reassessment checkpoints:</b> ${has('evac') ? 'every hour while an alert is active; again when the order changes.' : PP.CHECKPOINTS.join(' · ') + '. At each one, rerun the decision check on the Command tab.'}</p>`);

  /* 4 */
  sec('First 60 Minutes', ol(sc.first60.map(e)));

  /* 5 */
  const p72 = [
    ['Safety', [`Head count: ${n} people${+p.pets ? ' and ' + p.pets + ' pet(s)' : ''}.`, 'Treat injuries. Check for gas smell, fire and structural damage.', 'Test CO detectors; no fuel-burning appliance indoors unless rated for it.', p.mobility ? 'Mobility needs: ' + e(p.mobility) + '. Set up their space on the level you will shelter on.' : '']],
    ['Warmth & shelter', [has('nuclear') ? 'Stay in the centre of the basement for at least 24–48 hours.' : 'Set up the warm room before the house cools. Close off unused rooms.', `Primary heat: ${heatName}. Backup: ${backupName}.`, p.backupHeat === 'none' && p.heat !== 'wood' ? '<b>No backup heat:</b> rely on layers, sleeping bags rated -30°C, the warm room and body heat.' : '', 'Everyone in layers, hats and dry socks; no cotton next to skin in deep cold.']],
    ['Water', [`Target ${waterT} L stored (4 L/person/day for ${p.prepDays} days). Ration drinking water last.`, p.water === 'well' ? 'Well pump needs power: fill every container in the first hour.' : 'Municipal pressure may fail; fill tubs and pots early.', 'Purify doubtful water: rolling boil 1 minute, or 2 drops unscented 5–6% bleach per litre and wait 30 min.', 'Your hot-water tank holds 150–270 L of usable water: shut the inlet and drain from the bottom valve.']],
    ['Food', ['Eat fridge food first, then freezer, then pantry.', 'Keep freezer closed: full freezer ~48 h, half full ~24 h.', 'No-cook meals first; cook only with safe, ventilated methods.', +p.pets ? 'Pet food and water accounted for.' : '']],
    ['Communications', ['Battery/crank AM radio on the hour for official updates.', 'Text rather than call; texts get through when calls fail.', `Out-of-area contact: ${p.outOfArea ? e(p.outOfArea) : '<i>not set</i>'}.`, 'Agree radio check-in times with neighbours.']],
    ['Security', ['Lock doors, close blinds, keep lights low after dark.', 'Do not advertise supplies, generator or heat.', long ? 'Begin watch rotation with your neighbour group if the outage continues past day 2.' : '']],
    ['Sanitation', ['If water or sewer is down: bucket toilet with bag liner and cover material; double-bag and store waste outside.', 'Hand sanitizer before food and after toilet.', 'Garbage sealed and stored away from the house.']]
  ];
  sec('First 72 Hours', p72.map(([h, a]) => `<h4>${h}</h4>${ul(a)}`).join(''));

  /* 6 */
  if (long) {
    sec('Weeks 1–4: The Chaos Period', `
      <p>The first 30–60 days are the most dangerous. Panic, failed medical care, exposure, unsafe heating, violence and disease drive mortality in the general population. Roads become dangerous within 24–72 hours as people move outward from Edmonton along Hwy 16, 16A and 60.</p>
      <p><b>Strategy: go quiet and go low.</b> Stay low-profile, operate from the basement if needed, keep strict light, noise and smell discipline, and let the initial chaos burn itself out.</p>
      <table class="grid"><thead><tr><th>Phase</th><th>What to expect</th><th>How the plan changes</th></tr></thead><tbody>
      <tr><td>Days 1–3</td><td>Confusion; most people expect a quick fix. Stores emptied. Opportunist theft.</td><td>Stay home. Lock up. Finish water fill. Quiet check-ins with trusted neighbours.</td></tr>
      <tr><td>Days 4–14</td><td>Fuel gone, medications running out, people on the move, scams and people claiming authority.</td><td>Full OPSEC. Watch rotation. Ration. No visible cooking or generator use at night.</td></tr>
      <tr><td>Weeks 3–4</td><td>Organized groups may form. Disease from poor sanitation. Deaths from cold and CO.</td><td>Stay hidden. Strict sanitation. Pool resources with vetted neighbours. Reassess at week 4.</td></tr>
      </tbody></table>
      <h4>Staying healthy</h4>${ul(['Hydration and calorie tracking; nobody skips meals silently.', 'Sanitation discipline prevents diarrheal disease, the classic killer after disasters.', 'Sleep in shifts if on watch; fatigue causes bad decisions.', 'Watch mental health: routines, daylight, tasks for everyone.'])}`);
    sec('Months 1–6+: Long-Term', `
      ${ul(['<b>Stabilization:</b> the population settles; community structures re-form. Re-evaluate bugging out only now (checkpoint week 8).', '<b>Food production:</b> gardens (Alberta last frost around late May), seed saving, preserving, hunting and fishing within legal limits.', '<b>Water:</b> rain and snow collection with filtering and boiling.', '<b>Heat:</b> firewood for next winter needs cutting and seasoning months ahead.', '<b>Community:</b> skills exchange, shared watch, shared medical care, schooling for children.', '<b>Rebuilding:</b> when services return, document everything for insurance, and expect order to be restored with the legal system intact.'])}`);
  } else {
    sec('After the First 72 Hours', ul([has('evac') ? 'Stay registered with the reception centre or Parkland County until return is allowed.' : 'Keep the outage log; report damage to the utility.', 'Check on neighbours, especially elderly and medically dependent people.', 'Inspect the furnace, pipes and appliances before restarting; call a professional if anything is damaged.', 'Throw out food that rose above 4°C for more than 2 hours.', 'Restock what you used, using the shopping list.', 'Debrief: what went wrong? Update the plan and checklists.']));
    sec('Longer-Term Recovery', ul(['Insurance claims with photos and receipts.', 'Mental health check-ins for everyone, especially children.', 'Schedule a drill to test the fixes within three months.']));
  }

  /* 8 */
  sec('Shelter-in-Place Plan', `
    <h4>Basement / shelter room</h4>${ul([
      basement === 'none' ? '<b>No basement.</b> Use the most interior ground-floor room with the fewest windows. Identify a nearby building with a basement for fallout.' : `Basement: ${e(basement)}. Use the centre, away from windows and exterior walls.`,
      has('nuclear') ? 'Fallout: stack mass (water containers, books, soil-filled bins) against basement windows and on the floor above the shelter corner. Plan for up to 2 weeks with only brief trips out after 48 hours.' : '',
      'Store water, food, radio, lights, sanitation and medications in or beside the room.'
    ])}
    <h4>Heat</h4>${ul([
      `Primary: ${heatName}. Most gas furnaces need electricity for the blower and ignition.`,
      `Backup: ${backupName}.`,
      'Warm room: one small space, blankets over doors and windows, everyone in it, sleeping bags rated -30°C or lower.',
      '<b>Professional required:</b> wood stove installs (WETT inspection), generator transfer switches, gas appliance work.'
    ])}
    <h4>Power</h4>${ul([
      p.generator === 'none' ? 'No generator: rely on power banks, batteries and a power station for lights and radio.' : `Generator: ${e(p.generator)}. Run outdoors only, at least 6 m from doors and windows, never in a garage. ${p.transferSwitch ? 'Transfer switch installed.' : '<b>No transfer switch:</b> use extension cords only; never back-feed.'}`,
      p.solar ? 'Solar on site: confirm whether it works during a grid outage (many grid-tied systems shut off without a battery).' : ''
    ])}
    <h4>Water</h4>${ul([`${p.water === 'well' ? 'Well' : 'Municipal'} supply. Stored target ${waterT} L.`, 'Hot-water tank and toilet tanks (not bowls) are reserves.', 'Drain plumbing if the house will drop below freezing for long.'])}
    <h4>Food rationing</h4>${ul(['Plan about 2,000 kcal per adult per day; more in cold.', 'Track food in person-days on the purchase tracker.', 'Eat perishables first.'])}
    <h4>Sanitation without plumbing</h4>${ul(['Two-bucket system: one for urine (dilute and dump away from water sources if allowed), one lined bag for solids with litter/sawdust.', 'Double-bag, seal, store in a covered bin outside.', 'Hand washing station with a jug and soap.'])}
    <h4>Carbon monoxide</h4><div class="callout warn">CO is the #1 killer in cold-weather grid-down. Never run generators, BBQs, camp stoves, propane heaters not rated for indoor use, or vehicles in enclosed spaces. Battery CO detectors on every level are mandatory. ${p.coDetectors === 'every' ? 'Your profile says you have them: test monthly.' : '<b>Your profile does not confirm detectors on every level.</b>'}</div>`);

  /* 9 */
  const retreat = p.retreatName ? `${e(p.retreatName)}${p.retreatKm ? ', ' + e(p.retreatKm) + ' km' : ''}${p.retreatConfirmed ? ' (pre-arranged)' : ' (<b>not confirmed</b>)'}${p.retreatHeated ? ', heated' : ''}` : '<i>none on profile</i>';
  sec('Bug-Out Plan', `
    ${has('nuclear') ? '<div class="callout">During the fallout window, bugging out does not apply. Leave early only if the shelter is inadequate or officials give a specific evacuation order, and only after the heavy-fallout window where possible.</div>' : ''}
    <h4>Triggers to leave</h4>${ul([has('evac') ? 'Official evacuation order, or fire / plume visible and approaching.' : 'Home cannot be heated at all AND confirmed heated destination reachable in one daylight leg.', 'Fire, structural failure, or a threat to life you cannot avoid.', 'Defending the home is no longer worth the risk to people. Stuff can be replaced.'])}
    <h4>Destinations, ranked</h4>${ol(['Pre-arranged rural retreat with trusted people. Yours: ' + retreat, 'Owned rural property or cabin.', has('evac') ? 'Official reception centre.' : 'Family or friends outside the affected area.', 'Never a winter bush camp as the primary option.'])}
    <h4>Routes</h4>${ul([p.retreatRoute ? 'Your route notes: ' + e(p.retreatRoute) : 'Write down primary, secondary and tertiary routes on the profile.', 'Prefer range and township roads; avoid Hwy 16, 16A and 60 choke points and population centres.', 'Leave at first light. Avoid convoys. Check Alberta 511 if it is working.', 'Cache sites: a few days of water, food and warm gear along each route, with permission of the landowner.'])}
    <h4>Vehicle and on-foot</h4>${ul(['Vehicle: full tank, winter kit, go-bags, paper maps, radios, and a printed copy of this plan.', 'On foot (only if the vehicle fails and staying is worse): go-bags, layered clothing, travel in daylight, stay together.', `If separated: meet at ${p.meetNear ? e(p.meetNear) : 'the near meeting point'}; if that is unsafe, ${p.meetFar ? e(p.meetFar) : 'the far meeting point'}. Wait a set time, leave a note, then continue to the destination.`])}`);

  /* 10 */
  const items = sum.rows.filter(r => r.item.fam.includes('*') || r.item.fam.some(f => sc.family.includes(f)));
  sec('Supply List', `
    <p class="small">Quantities are for ${n} people over ${p.prepDays} days. "Have" comes from your purchase tracker. Prices are approximate CAD planning estimates.</p>
    <table class="grid supply"><thead><tr><th>Item</th><th>Qty per person</th><th>Priority</th><th>Target</th><th>Have</th><th>Approx. cost</th><th>Shelf life</th></tr></thead><tbody>
    ${items.sort((a, b) => ({ Critical: 0, Important: 1, 'Nice-to-have': 2 }[a.item.pri] - { Critical: 0, Important: 1, 'Nice-to-have': 2 }[b.item.pri])).map(r => `<tr class="${r.pct >= 1 ? 'done' : ''}"><td>${e(r.item.name)}</td><td>${e(PP.perPersonLabel(r.item, p))}</td><td>${r.item.pri}</td><td>${r.target} ${e(r.item.unit)}</td><td>${r.have}</td><td>${PP.money(r.item.cost)} / ${e(r.item.unit.replace(/s$/, ''))}</td><td>${r.item.life ? (r.item.life >= 12 ? (r.item.life / 12).toFixed(r.item.life % 12 ? 1 : 0) + ' yr' : r.item.life + ' mo') : 'n/a'}</td></tr>`).join('')}
    </tbody></table>
    <p>Still to buy for this scenario: <b>${PP.money(items.reduce((a, r) => a + r.toBuy, 0))}</b>. Critical items first.</p>
    ${has('nuclear') ? '<p><b>Potassium iodide (KI):</b> protects only the thyroid, and only against radioactive iodine. It does not protect against other radiation. Take it only when public health officials tell you to.</p>' : ''}`);

  /* 11 */
  sec('Communications Plan', `
    <table class="kv"><tr><th>Out-of-area contact</th><td>${e(p.outOfArea) || '<i>not set</i>'}</td></tr>
    <tr><th>Meeting point (near home)</th><td>${e(p.meetNear) || '<i>not set</i>'}</td></tr>
    <tr><th>Meeting point (outside neighbourhood)</th><td>${e(p.meetFar) || '<i>not set</i>'}</td></tr></table>
    <h4>Contact tree</h4>${p.contacts ? '<pre class="tree">' + e(p.contacts) + '</pre>' : '<p><i>Add contacts on the profile.</i></p>'}
    <h4>Radios</h4>${ul(['AM emergency broadcast: CHED 630, CBC Radio One 740 (Edmonton). Confirm locally.', 'FRS/GMRS: agree a channel and check-in times (e.g. on the hour, 5 minutes). GMRS needs an ISED-compliant radio; no licence needed in Canada.', 'Amateur (ham) radio needs an ISED Basic Qualification; worth getting for long-term scenarios.'])}
    <h4>Signals between households</h4>${ul(['Agreed window sign (e.g. a coloured cloth) meaning "we are OK" / "need help".', 'Note on the door for family arriving: where you went and when (only if leaving).'])}`);

  /* 12 */
  sec('Medical & Health', `
    ${p.medical ? `<div class="callout">Household medical needs: ${e(p.medical)}${p.fridgeMeds ? ' (includes medication that needs refrigeration; plan a cooler and cold packs, or outdoor cold storage in winter kept above freezing)' : ''}.</div>` : ''}
    <h4>Likely injuries and illnesses</h4>${ul(['Hypothermia and frostbite', 'CO poisoning (headache, nausea, confusion: get to fresh air, call for help)', 'Burns from improvised heat and light', 'Cuts and sprains from cleanup', 'Diarrheal illness from water and sanitation', 'Medication withdrawal or uncontrolled chronic conditions', has('nuclear') ? 'Radiation exposure: decontaminate; nausea within hours suggests a significant dose' : ''])}
    <h4>Hypothermia</h4>${ul(['Signs: shivering, slurred speech, clumsiness, confusion. Shivering stopping is a bad sign.', 'Move to the warm room, remove wet clothing, insulate from the floor, warm the core (chest, neck, groin) first.', 'Warm sweet drinks only if fully alert. No alcohol. Handle gently.'])}
    <h4>Frostbite</h4>${ul(['White or grey, hard, numb skin.', 'Do not rub. Rewarm in warm (not hot) water only if there is no risk of refreezing.', 'Seek medical care when possible.'])}
    <h4>Medication reserve</h4>${ul(['Ask your pharmacist and doctor about a 30-day reserve and early refills.', 'Keep a written list of medications and doses for everyone.', 'Rotate stock; check expiry alerts monthly.'])}
    <h4>First-aid kit additions</h4>${ul(['Israeli bandage / pressure dressings', 'Burn gel and dressings', 'Low-reading thermometer', 'Oral rehydration salts', 'Splints and elastic bandages'])}`);

  /* 13 */
  sec('Cold-Weather Modifier: January at -35°C', ul([
    'Exposure without shelter kills in hours. A cold house is still far safer than a road, vehicle or tent.',
    'Unheated houses drop below freezing in 12–36 hours; plan to drain plumbing if heat cannot be restored.',
    'Basements stay warmer than upper floors because the ground is warmer than the air.',
    'Bug out in extreme cold ONLY if the home cannot be heated at all, AND a heated destination is confirmed, AND it can be reached in daylight in one leg with a winter-equipped vehicle and full survival kit.',
    'Vehicles: tank above half all winter; block heater; winter tyres. ' + (p.winterVehicle ? 'Your profile says your vehicle is winter-equipped.' : '<b>Your profile does not confirm a winter-equipped vehicle.</b>'),
    'Batteries lose capacity in cold; keep them inside the warm room.',
    'Daylight is about 8 hours: do outdoor tasks midday.'
  ]));

  /* 14 */
  sec('Threat Assessment by Phase', `
    <table class="grid"><thead><tr><th>Phase</th><th>Threat</th><th>Response</th></tr></thead><tbody>
    <tr><td>Days 1–3</td><td>Opportunists: theft from vehicles, sheds, unattended homes</td><td>Lock up, lights low, keep supplies out of sight.</td></tr>
    <tr><td>Weeks 2–4</td><td>Organized groups; people claiming authority</td><td>Stay hidden, neighbour watch, verify authority by radio before opening the door.</td></tr>
    <tr><td>Long term</td><td>Desperate locals</td><td>Community structures; controlled, anonymous charity through a group, not from your door.</td></tr>
    </tbody></table>
    <h4>What attracts attention</h4>${ul(['Light at night', 'Generator noise', 'Cooking smells', 'Wood smoke when no one else has heat', 'Visible supplies, deliveries and fuel cans', 'Social media posts'])}`);

  /* 15 */
  sec('OPSEC & Gray Man Plan', ul(['Do not discuss supplies outside the household and the vetted group.', 'Light discipline: blackout covers, red headlamps, no light leaks after dark.', 'Noise: muffled generator in a ventilated enclosure outdoors, short daytime run schedule.', 'Smell: cook in the daytime, simple meals, seal food waste.', 'The home looks as unremarkable as its neighbours: same snow on the drive, same dark windows.', 'Zero social media about the household, location or preparations.']));

  /* 16 */
  sec('Home Hardening & Protection', `
    <h4>Physical security</h4>${ul(['Exterior door strike plates with 3" screws into the framing; deadbolts.', 'Ground-floor window locks and security film.', 'Clear sightlines; trim shrubs near windows.', 'Safe room: an interior room with a solid door and communications.'])}
    <h4>Early warning</h4>${ul(['Dogs are the best alarm.', 'Battery motion sensors and lights on approaches.', 'Watch rotation with neighbours in long scenarios.'])}
    <h4>Caches</h4>${ul(['Split supplies: at least two hidden locations in the home, and one off-site with trusted people.', 'Never one obvious stockpile.'])}
    <h4>Firearms (legal ownership only)</h4>${ul(['Only with a valid PAL, stored unloaded and locked as the law requires, ammunition separate.', p.pal ? 'Profile: PAL holder. Keep training current.' : 'Profile: no PAL. Firearms are not part of this plan.', 'Household safety rules taught to everyone, including children.'])}
    <p class="small">No booby traps or improvised weapons: they are illegal in Canada and injure children, neighbours and first responders.</p>`);

  /* 17 */
  sec('Neighbourhood & Community Defence', ul([p.neighbourGroup ? 'Profile: you have a neighbour group. Agree roles and radio channel.' : 'Vet 2–3 trustworthy neighbours in advance. Start with ordinary favours.', 'Form a mutual aid and watch group; share skills (medical, mechanical, trades).', 'Coordinate access points to the street or cul-de-sac only as a group.', 'Share resources deliberately; help the vulnerable through the group, not as individuals.']));

  /* 18 */
  sec('Confrontation Avoidance & De-escalation', `
    <table class="grid"><thead><tr><th>Situation</th><th>Rule</th></tr></thead><tbody>
    <tr><td>Stranger asking for help</td><td>Talk through a closed door or window. Point to the reception centre, food bank or group help. Give from a separate small cache, never from the main store.</td></tr>
    <tr><td>Approaching group</td><td>Do not engage. Stay out of sight. Alert neighbours by radio. Leave by the back if it escalates.</td></tr>
    <tr><td>Person claiming authority</td><td>Ask for ID and confirm by radio or phone before opening the door. Real officials will wait.</td></tr>
    <tr><td>Threat to life</td><td>Hide or leave. People before property.</td></tr>
    </tbody></table>`);

  /* 19 */
  sec('Legal Reality Check', ul(['The Criminal Code still applies: s.34 (defence of the person) and s.35 (defence of property).', 'Force must be reasonable and proportionate. People come before property.', 'Everything you do will be judged when order returns.', 'Hunting, fishing and firearm laws still apply.']));

  /* 20 */
  sec('Roles & Responsibilities', p.roles ? '<pre class="tree">' + e(p.roles) + '</pre>' : `<table class="grid"><thead><tr><th>Role</th><th>Duties</th><th>Who</th></tr></thead><tbody>
    ${[['Lead', 'Decisions, decision checkpoints, the log'], ['Heat & CO', 'Warm room, safe heat, detector checks'], ['Water & food', 'Rationing, purification, cooking'], ['Communications', 'Radio schedule, contact tree, neighbours'], ['Medical', 'First aid, medications, hygiene'], ['Security', 'Doors, light discipline, watch rota']].map(r => `<tr><td>${r[0]}</td><td>${r[1]}</td><td class="line"></td></tr>`).join('')}
    </tbody></table>`);

  /* 21 */
  sec('Skills & Drills', ck(['48-hour lights-out basement drill in winter (yearly)', 'Fire escape drill (twice yearly)', 'Go-bag grab in under 10 minutes (twice yearly)', 'First-aid / CPR course (every 3 years)', 'Drive each route in daylight (yearly)', 'Radio check with neighbours (monthly)', has('nuclear') ? 'Fallout shelter setup: stack mass, seal intakes (yearly)' : '', has('evac') ? 'Evacuation load-out in 15 minutes (yearly)' : '']));

  /* 22 */
  sec('Local Resources & Where to Buy', `
    <h4>Official community resources</h4>
    <table class="grid"><thead><tr><th>Resource</th><th>Contact</th><th>Notes</th></tr></thead><tbody>
    ${s.resources.map(r => `<tr><td>${e(r.name)}</td><td>${e(r.contact)}${r.url ? '<br><span class="small">' + e(r.url) + '</span>' : ''}</td><td>${e(r.notes)}</td></tr>`).join('')}
    </tbody></table>
    <h4>Local suppliers</h4>
    <table class="grid"><thead><tr><th>Store</th><th>Sells</th><th>Address / phone / hours</th></tr></thead><tbody>
    ${s.suppliers.map(v => `<tr><td>${e(v.name)}</td><td>${(v.types || []).map(t => PP.STORE_TYPES[t] || t).join(', ')}</td><td>${[v.address, v.town, v.phone, v.hours].filter(Boolean).map(e).join(' · ') || '<i>fill in</i>'}</td></tr>`).join('')}
    </tbody></table>`);

  /* 23 */
  const gaps = PP.gaps(s, sc).slice(0, 5);
  sec('Top 5 Gaps', gaps.length ? '<ol class="gaps">' + gaps.map(g => `<li><b>${e(g.text)}</b><br>${e(g.fix)}</li>`).join('') + '</ol>' : '<p>No major gaps found from your profile and tracker. Keep drilling.</p>');

  /* assumptions */
  const miss = PP.missing(p);

  /* quick reference card */
  const qrc = `
    <div class="qrc">
      <div class="qrc-h"><b>${e(sc.name)}</b><span>${e(p.householdName || 'Household')} · ${e(p.location)}</span></div>
      <div class="qrc-verdict">${has('evac') ? 'ORDERED OR THREAT VISIBLE? LEAVE NOW.' : has('nuclear') ? 'GET IN · STAY IN · TUNE IN' : 'DEFAULT: STAY HOME'}</div>
      <div class="qrc-cols">
        <div><h5>First steps</h5><ol>${sc.first60.slice(0, 6).map(x => `<li>${e(x)}</li>`).join('')}</ol></div>
        <div>
          <h5>Contacts</h5>
          <p>Emergency 911 · Health Link 811 · 211 · Roads 511<br>Out-of-area: ${e(p.outOfArea) || '________________'}<br>Meet near: ${e(p.meetNear) || '________________'}<br>Meet far: ${e(p.meetFar) || '________________'}</p>
          <h5>Never</h5><p>Generator, BBQ, camp stove or car running indoors or in the garage. CO kills.</p>
          <h5>Water</h5><p>Boil 1 min, or 2 drops bleach/L, wait 30 min.</p>
          ${has('nuclear') ? '<h5>Fallout</h5><p>Centre of basement 24–48 h minimum. KI only when officials say.</p>' : ''}
          <h5>Radio</h5><p>AM 630 / 740 · FRS/GMRS ch. ____ on the hour</p>
        </div>
      </div>
    </div>`;

  return {
    scenario: sc,
    html: `
    <div class="report-page report-cover">
      <div class="cover-k">Household Emergency Plan</div>
      <h1>${e(sc.name)}</h1>
      <div class="cover-meta">${e(p.householdName || 'Household')} · ${e(p.location)}<br>${today}</div>
      ${miss.length ? `<div class="assume"><b>Assumptions</b> (profile fields not yet filled in):${ul(miss.map(e))}</div>` : ''}
      <p class="small cover-foot">Based on guidance from Public Safety Canada, the Alberta Emergency Management Agency, the Canadian Red Cross, Health Canada and Ready.gov. Follow official instructions when they differ from this plan.</p>
    </div>
    <div class="report-page">
      <h2>Contents</h2>
      <ol class="toc">${sections.map((x, i) => `<li><a href="#rs-${i + 1}">${x.title}</a></li>`).join('')}<li>Quick Reference Card</li></ol>
    </div>
    <div class="report-body">
      ${sections.map((x, i) => `<section class="rsec" id="rs-${i + 1}"><h2><span class="num">${i + 1}</span>${x.title}</h2>${x.html}</section>`).join('')}
    </div>
    <div class="report-page qrc-page">${qrc}</div>`
  };
};
