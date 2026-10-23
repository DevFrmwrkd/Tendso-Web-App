/* Shared content for the mock. SAMPLE DATA: businesses are Tendso's own v4 site templates filled with
   generated photography; people photos are generated placeholders to be replaced with real team photos. */
window.TD = {
  sites: [
    { id: 'forge',   name: 'Forge Barbers',    kind: 'Barbershop',              city: 'Marikina',  url: 'forge.tendso.site',   hero: 'assets/photos/forge/pro2-headshot.jpg' },
    { id: 'kalan',   name: 'Kalan',            kind: 'Filipino kitchen & kapé', city: 'Marikina',  url: 'kalan.tendso.site',   hero: 'assets/photos/kalan-hero.jpg' },
    { id: 'hela',    name: 'Héla Hair Studio', kind: 'Hair salon',              city: 'Makati',    url: 'hela.tendso.site',    hero: 'assets/photos/hela-hero.jpg' },
    { id: 'vulca',   name: 'Vulca Garage',     kind: 'Auto repair',             city: 'Cebu City', url: 'vulca.tendso.site',   hero: 'assets/photos/vulca-hero.jpg' },
    { id: 'domingo', name: 'Domingo Hardware', kind: 'Hardware store',          city: 'Lipa',      url: 'domingo.tendso.site', hero: 'assets/photos/domingo-aisle.jpg' },
    { id: 'labana',  name: 'Labaná Laundry',   kind: 'Laundry',                 city: 'Pasig',     url: 'labana.tendso.site',  hero: 'assets/photos/labana-stacks.jpg' },
    { id: 'kalasag', name: 'Kalasag Strength', kind: 'Gym',                     city: 'Davao',     url: 'kalasag.tendso.site', hero: 'assets/photos/kalasag-lift.jpg' },
  ],
  // screenshots: assets/sites/<id>-d.jpg (1440×900 fold), <id>-d-long.jpg (1440×3200),
  //              <id>-m.jpg (390×844 @2x), <id>-m-long.jpg (390×2600 @2x)

  // before/after pairs: same subject, same place, re-shot at commercial level
  pairs: [
    // Theo 2026-10-21: craft first. Forge set: 10 plain phone shots (photos/forge/phone-*) and their re-shoots (pro-*)
    { id: 'headshot', before: 'assets/photos/forge/phone-headshot.jpg', after: 'assets/photos/forge/pro2-headshot.jpg', caption: 'Owner headshot, Forge Barbers' },
    { id: 'outside',  before: 'assets/photos/forge/phone-outside.jpg',  after: 'assets/photos/forge/pro2-outside.jpg',  caption: 'Shop front, Forge Barbers' },
    { id: 'mechanic', before: 'assets/photos/before-mechanic.jpg', after: 'assets/photos/after-mechanic.jpg', caption: 'Owner portrait, Vulca Garage, Cebu' },
    { id: 'kalan',    before: 'assets/photos/before-kalan.jpg',    after: 'assets/photos/after-kalan.jpg',    caption: 'Tapsilog at Kalan, Marikina' },
  ],

  // the owner's words (interview transcript) → the site copy that came from them
  words: {
    question: "What's the full name of your business, what city or area do you serve, and what do you do? Try to mention all three in one sentence.",
    transcript: "Forge, on J.P. Rizal in Marikina. Clean fades, scissor cuts, a hot-towel shave. Walk in, no fuss, no waiting.",
    copy: ['Sharp cuts.', 'No fuss,', 'no waiting.'],
  },

  // pricing (Philippines). monthlyElsewhere is a PLACEHOLDER until Theo confirms the comparison.
  price: { once: 4999, currency: '₱', instalment: { monthly: 500, months: 10 },   // Theo 2026-10-21: or ₱500 a month for 10 months
    monthlyElsewhere: 900, monthlyPlaceholder: true,
    // Cost tile comparison (Theo 2026-10-21: agency vs Wix/Webflow vs Tendso). PLACEHOLDER monthly figures until Theo confirms.
    compare: [
      { name: 'Web agency', monthly: 10000 },
      { name: 'Wix or Webflow', monthly: 1500 },
    ] },

  // field agents shown on the map (sample)
  agents: [
    { name: 'Mika Santos',  initial: 'M', dist: '350 m',  note: 'Available today' },
    { name: 'Paolo Reyes',  initial: 'P', dist: '1.2 km', note: 'Tomorrow, 10:00' },
    { name: 'Joy Dizon',    initial: 'J', dist: '2.4 km', note: 'Available today' },
  ],

  // people cloud (placeholders → replace with real team photos). layer 0 = front/sharp, 1 = back/blurred
  people: [
    { src: 'assets/people/01-sarisari.jpg',   alt: 'A field agent records a sari-sari store owner', layer: 0, work: 'kalan' },
    { src: 'assets/people/15-carinderia.jpg', alt: 'An agent records a carinderia cook in Cebu',    layer: 0, work: 'kalan' },
    { src: 'assets/people/03-barber.jpg',     alt: 'An agent records a barber in Manila',           layer: 0, work: 'vulca' },
    { src: 'assets/people/12-salon.jpg',      alt: 'A salon owner and an agent look at her site',   layer: 0, work: 'hela' },
    { src: 'assets/people/02-panaderya.jpg',  alt: 'An agent photographs a panaderya display',      layer: 0, work: 'kalan' },
    { src: 'assets/people/06-agent.jpg',      alt: 'A field agent outside an auto shop',            layer: 0, work: 'vulca' },
    { src: 'assets/people/09-cafe.jpg',       alt: 'An agent shows a café owner her site',          layer: 1, work: 'kalan' },
    { src: 'assets/people/16-baguio.jpg',     alt: 'A florist in Baguio sees her site',             layer: 0, work: 'labana' },
    { src: 'assets/people/14-garage.jpg',     alt: 'A mechanic talks while an agent records',       layer: 1, work: 'vulca' },
    { src: 'assets/people/11-workshop.jpg',   alt: 'Field agent training workshop',                layer: 1, work: null },
    { src: 'assets/people/04-team.jpg',       alt: 'The Tendso team at work',                       layer: 1, work: null },
    { src: 'assets/people/08-stairs.jpg',     alt: 'The Tendso team',                               layer: 1, work: null },
    { src: 'assets/people/05-creator.jpg',    alt: 'A creator photographs halo-halo',               layer: 0, work: 'kalan' },
    { src: 'assets/people/10-scooter.jpg',    alt: 'A field agent on the way to a visit',           layer: 1, work: null },
    { src: 'assets/people/07-lisbon.jpg',     alt: 'A florist in Lisbon',                           layer: 1, work: null },
    { src: 'assets/people/13-nairobi.jpg',    alt: 'A creator at a flower stall in Nairobi',        layer: 1, work: null },
  ],

  // business types exactly as the app's info screen lists them
  businessTypes: ['Barber/Salon', 'Auto Shop', 'Spa/Massage', 'Restaurant', 'Clinic', 'Law Office', 'Craft/Producer', 'Other'],

  // links (PLACEHOLDERS until real store listings exist)
  links: { appStore: '#app-store', googlePlay: '#google-play', joinAgent: '#join-agent', joinCreator: '#join-creator' },
};

/* ---- Guided capture (Theo, 2026-10-21) -----------------------------------------------------------
   The interview: 10 super-simple questions, one at a time, then an open "anything else".
   The photos: ~10 guided shots chosen for the kind of business (AI-suggested, or simply a fixed list per
   type), one task at a time with a framing guide, then any extra photos the owner thinks are important. */
window.TD.interview = {
  questions: [
    { en: "What's your shop called?",      tl: 'Ano ang pangalan ng tindahan mo?' },
    { en: 'Where are you?',                tl: 'Saan ka matatagpuan?' },
    { en: 'What do you sell?',             tl: 'Ano ang binebenta mo?' },
    { en: 'What do people love most?',     tl: 'Ano ang pinakagusto ng mga tao?' },
    { en: 'How did you start?',            tl: 'Paano ka nagsimula?' },
    { en: 'What makes you special?',       tl: 'Ano ang espesyal sa inyo?' },
    { en: 'What are your prices?',         tl: 'Magkano ang mga presyo mo?' },
    { en: 'When are you open?',            tl: 'Anong oras kayo bukas?' },
    { en: 'How can people reach you?',     tl: 'Paano ka makokontak?' },
    { en: 'What should people know?',      tl: 'Ano ang dapat malaman ng tao?' },
  ],
  extra: { en: 'Anything else?', tl: 'May iba pa?' },
  // framing assistant hints shown over the camera
  framing: ['Face inside the circle', 'Move a bit closer', 'Hold the phone level', 'Good light. Keep going'],
};
window.TD.shots = {
  // each: label shown on the task, hint under it, ghost = outline drawn in the viewfinder
  // order matters: the camera demos loop through the first three, so those are the shots we have real photos for
  barber: [
    { t: 'Owner headshot',        h: 'Face and shoulders, plain background',   ghost: 'head' },
    { t: 'Profile picture',       h: 'Owner at work, half body',              ghost: 'half' },
    { t: 'Haircut in progress',   h: 'Barber and client, side angle',          ghost: 'half' },
    { t: 'Inside',                h: 'Wide, from the door',                    ghost: 'room' },
    { t: 'Chairs and equipment',  h: 'The chairs, mirrors and stations',       ghost: 'room' },
    { t: 'Finished cut',          h: 'Back and side of the client',            ghost: 'head' },
    { t: 'Outside',               h: 'The whole shop front from across',       ghost: 'front' },
    { t: 'Sign',                  h: 'Straight on, fill the frame',            ghost: 'sign' },
    { t: 'Tools',                 h: 'Clippers and scissors, close up',        ghost: 'object' },
    { t: 'Price list',            h: 'Straight on, readable',                  ghost: 'sign' },
  ],
  food: [
    { t: 'Owner headshot',        h: 'Face and shoulders',                     ghost: 'head' },
    { t: 'Owner cooking',         h: 'At the stove or counter',                ghost: 'half' },
    { t: 'Outside',               h: 'The whole front, with the sign',         ghost: 'front' },
    { t: 'Dining area',           h: 'Wide, tables set',                       ghost: 'room' },
    { t: 'Best seller',           h: 'One plate, close, side light',           ghost: 'object' },
    { t: 'Second dish',           h: 'Another favourite',                      ghost: 'object' },
    { t: 'Drinks',                h: 'Coffee, juice or merienda',              ghost: 'object' },
    { t: 'Kitchen',               h: 'Clean, pots and prep',                   ghost: 'room' },
    { t: 'Menu and prices',       h: 'Straight on, readable',                  ghost: 'sign' },
    { t: 'Customers',             h: 'People eating, faces optional',          ghost: 'room' },
  ],
  repair: [
    { t: 'Owner headshot',        h: 'Face and shoulders',                     ghost: 'head' },
    { t: 'Profile picture',       h: 'Owner at the shop, half body',           ghost: 'half' },
    { t: 'Outside',               h: 'The whole shop from across',             ghost: 'front' },
    { t: 'At work',               h: 'Hands on the job',                       ghost: 'half' },
    { t: 'Work bay',              h: 'Wide, a car inside',                     ghost: 'room' },
    { t: 'Wheels and tyres',      h: 'Close, side angle',                      ghost: 'object' },
    { t: 'Sign',                  h: 'Straight on, fill the frame',            ghost: 'sign' },
    { t: 'Tools',                 h: 'The tools you use most',                 ghost: 'object' },
    { t: 'Finished job',          h: 'Clean, close up',                        ghost: 'object' },
    { t: 'Price list',            h: 'Straight on, readable',                  ghost: 'sign' },
  ],
  salon: [
    { t: 'Owner headshot', h: 'Face and shoulders', ghost: 'head' }, { t: 'Profile picture', h: 'Owner at the station', ghost: 'half' },
    { t: 'Outside', h: 'The whole front', ghost: 'front' }, { t: 'Inside', h: 'Wide, from the door', ghost: 'room' },
    { t: 'Stations', h: 'Chairs and mirrors', ghost: 'room' }, { t: 'Products', h: 'Shelf, straight on', ghost: 'object' },
    { t: 'Work in progress', h: 'Stylist and client', ghost: 'half' }, { t: 'Result', h: 'Finished hair, good light', ghost: 'head' },
    { t: 'Detail', h: 'Colour or nails, close up', ghost: 'object' }, { t: 'Price list', h: 'Readable', ghost: 'sign' },
  ],
};
window.TD.shots.default = window.TD.shots.barber;
