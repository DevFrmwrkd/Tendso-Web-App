(function () {
  'use strict';
  const A = '../assets/field-agent-review/';
  const PHOTO = '../assets/photos/kalan-hero.jpg';
  const designs = [
    { name: 'Tindahan', file: 'bb' },
    { name: 'Domingo', file: 'ao' },
    { name: 'Labaná', file: 'as' },
    { name: 'Ironwood', file: 'a' },
    { name: 'Cedar & Stone', file: 'c' },
  ];
  const AREA = {
    access: 'Join & training',
    discovery: 'Map & Finds',
    capture: 'Capture & review',
    money: 'Earn',
    account: 'Me & messages',
  };
  const STATUS = {
    'in-code': 'In code',
    device: 'Device check',
    polish: 'Polish review',
    gap: 'Missing interaction',
    decision: 'Decision needed',
  };
  const DISCOVERY = [
    {
      id: 'map',
      title: 'Map · shops in view',
      area: 'discovery',
      status: 'device',
      priority: 'P1',
      summary: 'The two reported layout fixes are in code. Confirm the corrected result on a phone.',
      implemented: [
        'Viewport-based shop search, a three-position sheet and independent list scrolling.',
        'Cards keep their natural height while the sheet grows.',
        'Six local category illustrations have explicit native image bounds. Route opens the device’s directions app.',
      ],
      checks: [
        'Drag up slowly, pause halfway, then expand and minimize. Cards must not stretch.',
        'Check every placeholder in pins, wide cards and the full list; no oversized 480px crop.',
        'Pan or zoom out, wait for the new search, and compare the shops in view.',
      ],
      sources: [
        { path: 'apps/mobile/components/field-agent/FieldAgentMap.tsx', line: 64 },
        { path: 'apps/mobile/components/ShopImage.tsx', line: 32 },
      ],
    },
    {
      id: 'finds',
      title: 'Community finds',
      area: 'discovery',
      status: 'device',
      summary:
        'Search, filters and adjustable nearby range are implemented. Review long labels and photo states.',
      implemented: [
        'All finds / Near me / Needs website and shop-type filters.',
        'Nearby ranges: 1, 3, 5, 10 or 25 km; distances name the saved area.',
        'Masonry cards show the spotter, actual photo or category placeholder, and website status.',
      ],
      checks: [
        'Check “Check website” pills with narrow cards and large text.',
        'Compare real, missing and failed photos; open a card and return to the same list.',
        'Increase the range and confirm an empty result can recover without losing the search.',
      ],
      sources: [{ path: 'apps/mobile/components/field-agent/CommunityFinds.tsx', line: 16 }],
    },
    {
      id: 'shop',
      title: 'Shop details',
      area: 'discovery',
      status: 'polish',
      summary:
        'Shared shops now show automatic interview progress and a published website, with capture originals kept private.',
      implemented: [
        'Discovery photo or category placeholder stays on the shared shop; submitted capture photos do not replace it.',
        'Submitted and Live are automatic; field agents cannot manually change shared-shop progress.',
        'Interview attribution comes from the linked submitted capture. Original assets require capture-owner or reviewer permission.',
        'A verified published site appears inline; draft, build and unpublished URLs do not.',
        'Back returns to the originating screen, with Finds as the fallback.',
      ],
      checks: [
        'Verify the one- or two-word status badges fit narrow cards and large text.',
        'Review missing address/contact fields and long email wrapping.',
        'Compare a spotter, another agent, the submitting agent and an admin: originals stay private and shared progress is read-only.',
        'Publish, unpublish and reconnect: show only the live site; verify preview error and retry.',
      ],
      sources: [
        { path: 'apps/mobile/app/(app)/leads/[leadId].tsx', line: 520 },
        { path: 'apps/mobile/components/field-agent/PublishedShopWebsite.tsx', line: 20 },
        { path: 'convex/leads.ts', line: 399 },
      ],
    },
    {
      id: 'spot',
      title: 'Spot a shop',
      area: 'discovery',
      status: 'device',
      summary:
        'A small discovery form shares a shop with the team; owner contact is gathered during capture.',
      implemented: [
        'Shop photo, name, kind, Needs website toggle and a map pin.',
        'Tap or drag the pin; manual pin changes do not reset the zoom.',
        'Address and city remain editable; Save find is guarded by required data and connection state.',
      ],
      checks: [
        'Place a pin while zoomed in, drag it and confirm the camera stays put.',
        'Deny photo/location access, retry, and confirm the draft survives.',
        'Save once, then find the new card in Finds with its location and image.',
      ],
      sources: [{ path: 'apps/mobile/app/(app)/leads/spot.tsx', line: 134 }],
    },
    {
      id: 'heard',
      title: 'How did you hear about us?',
      area: 'access',
      status: 'device',
      summary: 'Discovery source comes first; the optional referrer code is collected on this same step.',
      implemented: [
        'Friend or another agent, Facebook, TikTok, a shop’s Tendso site, or a job post.',
        'A valid referrer can be previewed; the save mutation decides whether it can be attached.',
        'The saved discovery source determines whether this step is already complete.',
      ],
      checks: [
        'Try a valid, invalid, own and already-attached referral code.',
        'Confirm the selected source remains after returning from the work-area step.',
        'Check offline errors and the code field with the keyboard open.',
      ],
      sources: [{ path: 'apps/mobile/app/(app)/agent-onboarding.tsx', line: 205 }],
    },
    {
      id: 'work',
      title: 'Where do you work?',
      area: 'access',
      status: 'device',
      summary:
        'Work city or device location is the second onboarding step and anchors nearby-shop distances.',
      implemented: [
        'Choose a city, enter another city, or request the current location.',
        'A location timeout/denial can recover through a manual city choice.',
        'Saving the work area precedes the field-agent training flow.',
      ],
      checks: [
        'Deny location, choose a city manually, and continue.',
        'Confirm the map names the saved work area rather than implying live GPS.',
        'Return to discovery without losing a saved referral or source.',
      ],
      sources: [{ path: 'apps/mobile/app/(app)/agent-onboarding.tsx', line: 214 }],
    },
    {
      id: 'training',
      title: 'Training overview',
      area: 'access',
      status: 'device',
      summary:
        'Five lessons and a five-question quiz are implemented. The lesson Back behavior was corrected.',
      implemented: [
        'Good lighting, Clear audio, Photos that sell, Get the owner talking, The shots we need.',
        'Back from any lesson returns to the overview; completion is saved per account.',
        'Quiz pass requires four correct answers.',
      ],
      checks: [
        'Open Clear audio or the last lesson, then Back; confirm the overview opens.',
        'Check every lesson photo crop and recording-phone image.',
        'Read the Do / Don’t rows at large text sizes, including their status icons.',
      ],
      sources: [
        { path: 'apps/mobile/app/(app)/training-lessons.tsx', line: 34 },
        { path: 'apps/mobile/lib/trainingLessons.ts', line: 39 },
      ],
    },
    {
      id: 'pending',
      title: 'Waiting for approval',
      area: 'access',
      status: 'polish',
      summary: 'The waiting screen and live account-status routing exist. Review its timing promises.',
      implemented: [
        'Profile sent, Training and quiz, Team checks your details, then Start finding shops.',
        'Approval leads into the field-agent app; rejection has a dedicated correction path.',
        'The screen currently says “It takes less than a day” and “Usually within 24 hours.”',
      ],
      checks: [
        'Agree on review-time wording that matches the team’s actual service level.',
        'Approve and reject a test account while this screen is open; verify the destination.',
        'Check real notification delivery separately, including app closed and permissions denied.',
      ],
      sources: [{ path: 'apps/mobile/app/(app)/pending-review.tsx', line: 130 }],
    },
    {
      id: 'rejected',
      title: 'Profile correction',
      area: 'access',
      status: 'device',
      summary:
        'Account rejection and submission rejection are different flows. Profile correction preserves a passed quiz.',
      implemented: [
        'Warning card with the team’s reason, targeted name/mobile Edit actions and a saved quiz pass.',
        'Fix and resend opens Fix your profile; resubmission returns to review.',
        'Legacy records without a quiz pass explicitly finish certification instead.',
      ],
      checks: [
        'Reject for name only; Edit should focus the name without resetting training.',
        'Compare warning prominence and matching circle/check sizes.',
        'Open the keyboard, edit the last field, and reach Resubmit for review.',
      ],
      sources: [
        { path: 'apps/mobile/app/(app)/verification-rejected.tsx', line: 48 },
        { path: 'apps/mobile/app/(app)/edit-profile.tsx', line: 320 },
      ],
    },
  ];
  const screens = [
    ...DISCOVERY,
    ...(window.FIELD_AGENT_REVIEW_CAPTURE || []),
    ...(window.FIELD_AGENT_REVIEW_ACCOUNT || []),
  ];
  const ids = new Set(screens.map((s) => s.id));
  const byId = Object.fromEntries(screens.map((s) => [s.id, s]));
  const STORAGE = 'tendso.field-agent-review.v1';
  let notes = {};
  try {
    notes = JSON.parse(localStorage.getItem(STORAGE) || '{}') || {};
  } catch {}
  let current = ids.has(location.hash.slice(1)) ? location.hash.slice(1) : 'map';
  let areaFilter = 'all',
    statusFilter = 'all',
    large = false;
  const phoneCache = new Map();
  const demo = {
    shopStage: 'submitted',
    sheet: 'preview',
    selectedShop: false,
    visiting: false,
    findFilter: 'All finds',
    range: '5',
    photoOpen: false,
    language: 'EN',
    design: 0,
    price: 999,
    earnMonth: 5,
    cashAmount: '3750',
    message: false,
    read: false,
    history: 'All',
    profileReview: false,
    repair: false,
    resubmitted: false,
  };
  let toastTimer;
  const escape = (value) =>
    String(value ?? '').replace(
      /[&<>"']/g,
      (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
    );
  const peso = (n) => '₱' + Math.round(n).toLocaleString('en-PH');
  const earnMonths = [
    { name: 'June', short: 'Jun', total: 1200 },
    { name: 'July', short: 'Jul', total: 1800 },
    { name: 'August', short: 'Aug', total: 2400 },
    { name: 'September', short: 'Sep', total: 3200 },
    { name: 'October', short: 'Oct', total: 4800 },
    { name: 'November', short: 'Nov', total: 6000 },
  ];
  const cashPeso = (n) =>
    '₱' +
    Number(n).toLocaleString('en-PH', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 });
  const paths = {
    arrow: '<path d="m14 6-6 6 6 6m-6-6h13"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    close: '<path d="m6 6 12 12M18 6 6 18"/>',
    chevron: '<path d="m9 5 7 7-7 7"/>',
    bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9m-7 12h2"/>',
    pin: '<path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2"/>',
    map: '<path d="m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2Zm6-2v16m6-14v16"/>',
    grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    plus: '<path d="M12 4v16M4 12h16"/>',
    wallet: '<path d="M3 6h17v14H3Zm0 0V3h14v3m-1 5h6v5h-6Z"/>',
    user: '<circle cx="12" cy="7" r="4"/><path d="M4 21v-3a8 8 0 0 1 16 0v3Z"/>',
    camera: '<path d="M3 7h5l2-3h4l2 3h5v14H3Z"/><circle cx="12" cy="13" r="4"/>',
    play: '<path d="m8 4 12 8-12 8Z"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 6 9 7 9-7"/>',
    phone: '<path d="m4 3 4 1 2 5-3 2a15 15 0 0 0 6 6l2-3 5 2 1 4c-9 4-22-9-17-17Z"/>',
    warning: '<path d="m12 3 10 18H2Zm0 6v5m0 3v1"/>',
    book: '<path d="M3 4h8l1 2 1-2h8v16h-8l-1 1-1-1H3Zm9 2v15"/>',
    edit: '<path d="m15 3 6 6-11 11-7 1 1-7Zm-2 2 6 6"/>',
    shop: '<path d="M4 10v11h16V10M2 10l3-7h14l3 7M2 10c0 4 5 4 5 0 0 4 5 4 5 0 0 4 5 4 5 0 0 4 5 4 5 0M9 21v-7h6v7"/>',
    send: '<path d="m3 3 19 9-19 9 4-9Zm4 9h15"/>',
    lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V6a4 4 0 0 1 8 0v4"/>',
    search: '<circle cx="10" cy="10" r="7"/><path d="m16 16 5 5"/>',
    logout: '<path d="M9 3H3v18h6m6-5 5-4-5-4m-7 4h12"/>',
    gift: '<path d="M3 8h18v4H3Zm2 4v9h14v-9M12 8v13M12 8C0 9 7-3 12 8c5-11 12 1 0 0Z"/>',
    money: '<rect x="2" y="5" width="20" height="14" rx="2"/><circle cx="12" cy="12" r="3"/>',
  };
  const icon = (name) =>
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.grid}</svg>`;
  const btn = (label, go, variant = '', extra = '') =>
    `<button type="button" class="fa-btn ${variant}" ${go ? `data-go="${go}"` : extra.includes('data-action') ? '' : 'data-demo="Preview only — no account changes are made."'} ${extra}>${label}</button>`;
  const link = (label, go) => `<button type="button" class="fa-link" data-go="${go}">${label}</button>`;
  const field = (label, value, options = '') =>
    `<label class="fa-field"><span>${label}</span><input value="${escape(value)}" ${options}></label>`;
  const chip = (text, on = false, attrs = '') =>
    `<button type="button" class="fa-chip ${on ? 'on' : ''}" ${attrs}>${text}</button>`;
  const pic = (type = 'shop', height = 100, label = '', real = false, extra = '') =>
    `<div class="fa-photo ${real ? '' : 'placeholder'}" style="height:${height}px;${extra}"><img src="${real ? PHOTO : A + type + '.png'}" alt="${real ? 'Sample food shop photo' : type + ' shop placeholder'}">${label ? `<span>${label}</span>` : ''}</div>`;
  const avatar = (big = false) =>
    `<div class="fa-avatar ${big ? 'big' : ''}" aria-label="Mika Santos">M</div>`;
  const row = (title, sub = '', ico = 'chevron', go = '', right = '') =>
    `<button type="button" class="fa-menu" ${go ? `data-go="${go}"` : 'data-demo="This opens the corresponding tool in the mobile app."'}><div class="fa-menu-icon">${icon(ico)}</div><span><b>${title}</b>${sub ? `<small>${sub}</small>` : ''}</span>${right || icon('chevron')}</button>`;
  const badge = (status) => `<span class="fa-badge ${status}">${STATUS[status]}</span>`;
  const section = (name, content) =>
    `<div class="fa-col"><span class="fa-label">${name}</span><div class="fa-card fa-inset-list">${content}</div></div>`;
  const step = (n) =>
    `<div class="fa-between"><div class="fa-steps fa-grow">${Array.from({ length: 5 }, (_, i) => `<i class="${i < n ? 'on' : ''}"></i>`).join('')}</div><span class="fa-small fa-muted">${n} / 5</span></div>`;
  const statusBar = '<div class="fa-status"><span>9:41</span><span>▮▮▮　⌁　▰</span></div>';
  const nav = (active) =>
    `<nav class="fa-nav" aria-label="Sample app navigation">${[
      ['map', 'map', 'Map'],
      ['finds', 'grid', 'Finds'],
      ['info', 'plus', 'Submit'],
      ['earn', 'wallet', 'Earn'],
      ['me', 'user', 'Me'],
    ]
      .map(
        ([id, ico, label]) =>
          `<button type="button" data-go="${id}" class="${id === active ? 'on' : ''} ${id === 'info' ? 'submit' : ''}">${icon(ico)}<span>${label}</span></button>`,
      )
      .join('')}</nav>`;
  function app(body, options = {}) {
    return `<div class="fa-app ${options.nav ? 'has-nav' : ''} ${options.footer ? 'has-footer' : ''} ${options.noHead ? 'no-head' : ''} ${large ? 'large' : ''}">${statusBar}${options.noHead ? '' : `<header class="fa-phone-head"><button type="button" class="fa-round" data-go="${options.back || 'map'}" aria-label="Back">${icon('arrow')}</button><strong>${options.title || ''}</strong><span></span></header>`}<div class="fa-scroll">${body}</div>${options.footer ? `<div class="fa-footer">${options.footer}</div>` : ''}${options.nav ? nav(options.nav) : ''}<div class="fa-home-line"></div></div>`;
  }
  const shops = [
    { name: 'Ramon’s Barber', type: 'barber', distance: '350 m', status: 'Check website' },
    { name: 'Lilu Resto', type: 'food', distance: '600 m', status: 'Needs website' },
    { name: 'Nena’s Sari-Sari', type: 'sari-sari', distance: '800 m', status: 'Needs website' },
    { name: 'Héla Salon', type: 'beauty', distance: '1.2 km', status: 'Live' },
    { name: 'Vulca Garage', type: 'repair', distance: '1.6 km', status: 'Yours' },
  ];
  function mapScreen(interactive) {
    const mode = interactive ? demo.sheet : 'preview';
    const selected = interactive && demo.selectedShop;
    return `<div class="fa-app has-nav">${statusBar}<div class="fa-map"><div class="fa-map-grid"></div><div class="fa-map-river"></div></div><div class="fa-map-chrome"><div class="fa-row"><button type="button" data-go="me" style="background:none;padding:0">${avatar()}</button><button type="button" class="fa-map-money" data-go="earn">₱6,000 <span>this month</span></button><button type="button" class="fa-round" data-go="notifications" aria-label="Notifications">${icon('bell')}</button></div><div class="fa-chip-row">${chip('◌ Needs website · 2', false, 'data-action="map-filter"')}${chip('● Yours · 1', false, 'data-action="map-filter"')}</div><button type="button" class="fa-map-area" data-demo="In the app, choose your saved work area or current location.">${icon('pin')} Distances from Marikina</button></div>${shops
      .slice(0, 4)
      .map(
        (s, i) =>
          `<button type="button" class="fa-pin" style="left:${[72, 216, 152, 289][i]}px;top:${[286, 250, 375, 333][i]}px" data-action="select-map-shop" aria-label="${s.name}"><img src="${A + s.type}.png" alt=""></button>`,
      )
      .join(
        '',
      )}<section class="fa-map-sheet ${mode}" aria-label="Nearby shops"><button type="button" class="fa-grab" data-action="sheet" aria-label="Change nearby shops panel height"><i></i></button><div class="fa-sheet-head"><strong>${selected ? 'Shop details' : 'Shops in view'}</strong>${selected ? '<button type="button" class="fa-link" data-action="close-map-shop">Close</button>' : link('See list', 'finds')}</div>${selected ? `<div class="fa-map-detail"><div class="fa-row">${pic('barber', 140, '', false, 'width:110px')}<div class="fa-col"><h3>Ramon’s Barber</h3><span class="fa-muted">350 m from Marikina</span><b>Check website</b><span class="fa-small fa-muted">From the shop directory</span></div></div><div class="fa-row">${icon('pin')}10 Main Street, Marikina</div><div class="fa-card"><b>Earn up to ₱2,500</b><p class="fa-small fa-muted">Set the price, ₱999–₱4,999. You keep half when the owner pays.</p></div><div class="fa-row">${demo.visiting ? btn('Start interview', 'info') : btn('I’m visiting', '', '', 'data-action="visit"')}${btn('Route', '', 'ghost', 'data-route-preview')}</div></div>` : `<div class="fa-map-cards">${shops.map((s) => `<button type="button" class="fa-map-card" data-action="select-map-shop">${pic(s.type)}<b>${s.name}</b><small>${s.distance} from Marikina</small><em>${s.status}</em></button>`).join('')}</div>`}</section>${nav('map')}<div class="fa-home-line"></div></div>`;
  }
  function screenMarkup(id, interactive = true) {
    const price = interactive ? demo.price : 999;
    switch (id) {
      case 'map':
        return mapScreen(interactive);
      case 'finds':
        return app(
          `<div class="fa-between"><div><h2>Community finds</h2><p class="fa-small fa-muted">17 shops shared by the team</p></div><button type="button" class="fa-round" data-demo="More find tools: Open map or Team CRM & search.">•••</button></div><label class="fa-field"><span>Search shops or agents</span><input placeholder="Search shops or agents" aria-label="Search sample finds"></label><div class="fa-chip-row">${['All finds', 'Near me', 'Needs website', 'Food', 'Beauty'].map((f) => chip(f, (interactive ? demo.findFilter : 'All finds') === f, `data-find-filter="${f}"`)).join('')}</div>${interactive && demo.findFilter === 'Near me' ? `<span class="fa-label">Within ${demo.range} km of Marikina</span><div class="fa-chip-row">${[1, 3, 5, 10, 25].map((km) => chip(`${km} km`, demo.range === String(km), `data-range="${km}"`)).join('')}</div>` : ''}<div class="fa-photo-grid">${shops
            .filter((s) => !interactive || demo.findFilter !== 'Food' || s.type === 'food')
            .map(
              (s, i) =>
                `<button type="button" style="padding:0;background:none;text-align:left;display:grid;gap:7px" data-go="shop">${pic(s.type, i % 2 ? 170 : 214, s.status)}<b>${s.name}</b><span class="fa-small fa-muted">Mika S. · ${s.distance}</span></button>`,
            )
            .join('')}</div><div style="height:60px"></div>`,
          { nav: 'finds', noHead: true },
        ).replace(
          '<div class="fa-home-line">',
          '<button type="button" class="fa-fab" data-go="spot">' +
            icon('camera') +
            'Spot a shop</button><div class="fa-home-line">',
        );
      case 'shop': {
        const stage = interactive ? demo.shopStage : 'submitted';
        const label = stage === 'live' ? 'Live' : stage === 'submitted' ? 'Submitted' : 'Needs website';
        return app(
          `${pic('barber', 196, label)}<div><h2>Ramon’s Barber</h2><p class="fa-muted">350 m · 10 Main Street, Marikina</p></div><span class="fa-label">Notes (0)</span><label class="fa-field"><span>Add a note</span><textarea placeholder="Best time to visit, who to ask for" aria-label="Sample shop note"></textarea></label><p class="fa-small fa-muted">No notes yet.</p><div class="fa-card"><div class="fa-between"><b>Shop progress</b><span class="fa-flag">${label}</span></div><p class="fa-small fa-muted">${stage === 'live' ? 'This shop’s website is live. Progress updates automatically.' : stage === 'submitted' ? 'An interview has been submitted for this shop. Progress updates automatically.' : 'Progress updates automatically when an interview is submitted and the website goes live.'}</p></div>${stage === 'live' ? '<div class="fa-card"><b>Published website</b><p class="fa-small fa-muted">The live site made for this shop. Scroll inside to explore it.</p><iframe class="fa-sample-frame" title="Published barber website example" src="/template-previews/f.html" sandbox="allow-same-origin" style="height:420px;width:100%;border:0;border-radius:18px"></iframe><button type="button" class="fa-btn ghost" data-demo="The app opens this shop’s verified published URL in its in-app browser.">View website</button></div>' : ''}<div class="fa-card"><b>Interviewed by</b><p class="fa-small fa-muted">Recorded automatically from submitted interviews.</p>${stage === 'new' ? '<p class="fa-small fa-muted">No one has interviewed this shop yet.</p>' : '<div class="fa-row">' + avatar() + '<div><b>Mika Santos</b><p class="fa-small fa-muted">Just now</p></div><span class="fa-flag">In review</span></div>'}</div>`,
          { back: 'finds', footer: stage === 'new' ? btn('Start the capture', 'info') : '' },
        );
      }
      case 'spot':
        return app(
          `<p class="fa-muted">Take a photo and share it with the team.</p><button type="button" class="fa-card fa-center" style="min-height:150px;align-items:center;justify-content:center" data-demo="The mobile app requests camera/photo-library access here.">${icon('camera')}<b>Add a shop photo</b></button>${field('Shop name', 'Nena’s Sari-Sari')}<span class="fa-label">Kind of shop</span><div class="fa-chip-row">${['Food', 'Sari-sari', 'Beauty', 'Repair', 'Other'].map((k) => chip(k, k === 'Sari-sari', 'data-action="kind"')).join('')}</div><div class="fa-card fa-between"><b>Needs website</b><input type="checkbox" checked aria-label="Sample shop needs a site"></div><span class="fa-label">Pin the shop</span><p class="fa-small fa-muted">Tap the map at the shop, or use your location while standing there.</p><div class="fa-mini-map"><button type="button" data-demo="Drag or tap a pin in the mobile app; the chosen zoom should stay." aria-label="Sample shop location"></button></div>${field('Address (optional)', '12 Main Street')}${field('City (optional)', 'Marikina')}`,
          { title: 'Spot a shop', back: 'finds', footer: btn('Save find', 'finds', '', 'disabled') },
        );
      case 'heard':
        return app(
          `<span class="fa-label">1 / 2</span><h2>How did you hear about us?</h2><p class="fa-muted">Just so we know who to thank.</p>${['A friend or another agent', 'Facebook', 'TikTok', 'A shop’s Tendso site', 'A job post'].map((t, i) => `<button type="button" class="fa-card fa-between" data-action="source"><b>${t}</b>${i === 0 ? '<span class="fa-dot done">' + icon('check') + '</span>' : ''}</button>`).join('')}${field('Who sent you? (optional)', 'JOYD4K2')}<div class="fa-card fa-row" style="flex-direction:row">${avatar()}<div><b>Joy Dizon</b><p class="fa-small fa-muted">Referrer preview</p></div></div>`,
          { footer: btn('Continue', 'work') },
        );
      case 'work':
        return app(
          `<span class="fa-label">2 / 2</span><h2>Where do you work?</h2><p class="fa-muted">We’ll show you shops near you first.</p><div class="fa-chip-row">${['Marikina', 'Quezon City', 'Pasig', 'Manila', 'Antipolo', 'Makati', 'Taguig', 'Cebu City', 'Davao', 'Iloilo', 'Baguio', 'Other city'].map((t, i) => chip(t, i === 0, 'data-action="city"')).join('')}</div>${btn('Use my location', '', 'ghost')}<p class="fa-small fa-muted">Or choose your work city manually.</p>`,
          { back: 'heard', footer: btn('Continue', 'training') },
        );
      case 'training':
        return app(
          `<div class="fa-wide-pic"><img src="${A}overview.jpg" alt="Agent training overview"></div><div class="fa-card"><div class="fa-between"><h3>Become a certified agent</h3><b>5 of 5</b></div><div class="fa-progress"><i style="width:100%"></i></div><p class="fa-small fa-muted">Then a 5-question quiz. Pass with 4.</p></div>${['Good lighting', 'Clear audio', 'Photos that sell', 'Get the owner talking', 'The shots we need'].map((t, i) => `<button type="button" class="fa-card fa-check-item" style="flex-direction:row;text-align:left" data-demo="In the app this opens ${t}. Lesson Back returns to this overview."><span class="fa-dot done">${icon('check')}</span><span class="fa-grow"><b>${t}</b><p class="fa-small fa-muted">${[3, 2, 4, 3, 3][i]} min · Completed</p></span>${icon('chevron')}</button>`).join('')}`,
          { title: 'Training', footer: btn('Take the quiz', '', '', 'data-quiz-preview') },
        );
      case 'pending':
        return app(
          `${avatar(true)}<h2 class="fa-center">We’re checking your details</h2><p class="fa-center fa-muted">Hi Mika. It takes less than a day.</p>${[
            ['Profile sent', ''],
            ['Training and quiz', 'Passed just now'],
            ['Team checks your details', 'Usually within 24 hours'],
            ['Start finding shops', 'Your map opens'],
          ]
            .map(
              ([t, s], i) =>
                `<div class="fa-card fa-check-item" style="flex-direction:row"><span class="fa-dot ${i < 2 ? 'done' : ''}">${i < 2 ? icon('check') : i === 2 ? '●' : ''}</span><div><b>${t}</b>${s ? `<p class="fa-small fa-muted">${s}</p>` : ''}</div></div>`,
            )
            .join('')}`,
          {
            footer:
              '<div class="fa-banner">' +
              icon('bell') +
              'You can close the app. We’ll send a notification when you’re in.</div>',
          },
        );
      case 'rejected':
        return app(
          `<h2>Almost there, Mika</h2><div class="fa-banner danger">${icon('warning')}<div><b>Your profile needs attention</b><p class="fa-small">Please use your full name.</p></div></div><div class="fa-card fa-check-item" style="flex-direction:row"><span class="fa-dot"></span><div class="fa-grow"><b>Full name</b><p class="fa-small fa-muted">Mika S.</p></div>${link('Edit', 'profile')}</div><div class="fa-card fa-check-item" style="flex-direction:row"><span class="fa-dot"></span><div class="fa-grow"><b>Mobile</b><p class="fa-small fa-muted">0917 000 0000</p></div>${link('Edit', 'profile')}</div><div class="fa-card fa-check-item" style="flex-direction:row"><span class="fa-dot done">${icon('check')}</span><div><b>Certification quiz</b><p class="fa-small fa-muted">Passed. You don’t need to take it again.</p></div></div>`,
          { footer: btn('Fix and resend', 'profile') + btn('Ask the team', '', 'ghost') },
        );
      case 'info':
        return app(
          `${step(1)}<h2>About the shop</h2>${field('Shop name', 'Nena’s Sari-Sari')}<span class="fa-label">Kind of business</span><div class="fa-chip-row">${chip('Other', true)}${chip('Restaurant')}${chip('Barber/Salon')}</div>${field('Owner’s name', 'Nena Reyes')}${field('Mobile', '+63 917 000 0000', 'type="tel"')}${field('Email', 'owner@example.com', 'type="email"')}<p class="fa-small fa-muted">Required so the owner can access their website.</p>${field('Address', '12 Main Street')}${field('City', 'Marikina')}${btn('Choose on map', '', 'ghost')}<div class="fa-mini-map"><button type="button" aria-label="Shop pin" data-demo="The app opens its capture map picker here."></button></div>`,
          {
            footer:
              interactive && demo.repair
                ? btn('Save changes', 'review')
                : btn('Continue to photos', 'photos'),
          },
        );
      case 'photos':
        return app(
          `${step(2)}<h2>Show us the shop</h2><p class="fa-muted">Ten suggestions. Add 3–10 photos in total.</p><div class="fa-card"><b>Suggestions</b><div class="fa-photo-grid">${['Shop front', 'Inside the shop', 'Products', 'Owner at work'].map((label, i) => `<button type="button" style="padding:0;background:none;text-align:left" data-demo="Suggestion tiles open or retake a shot in the native camera.">${pic(['sari-sari', 'shop', 'food', 'barber'][i], 100)}<span class="fa-small">${label}</span></button>`).join('')}</div></div><span class="fa-label">Your photos · 4 / 10</span><div class="fa-photo-grid">${[0, 1, 2, 3].map((i) => `<button type="button" style="padding:0;background:none" data-go="photo-preview" aria-label="Open photo ${i + 1}">${pic('food', 138, '', true)}</button>`).join('')}</div>${btn('Add from library', '', 'ghost')}`,
          {
            footer:
              interactive && demo.repair
                ? btn('Save changes', 'review')
                : btn('Continue to interview', 'interview'),
          },
        );
      case 'photo-preview':
        return app(`<h2>Your photos</h2>`, { back: 'photos' }).replace(
          '<div class="fa-home-line">',
          `<div class="fa-full-photo"><p>Photo 1 of 4</p><button type="button" class="fa-round" data-go="photos" aria-label="Close photo">${icon('close')}</button><img src="${PHOTO}" alt="Full sample shop photo"></div><div class="fa-home-line">`,
        );
      case 'interview':
        return app(
          interactive && demo.repair
            ? `${step(3)}<h2>Now ask the owner.</h2><div class="fa-banner danger"><b>What needs fixing</b><p class="fa-small">Please replace the blurry shop-front photo.</p></div><div class="fa-card"><b>Saved interview</b><p class="fa-small fa-muted">Your existing recording is kept.</p><button type="button" class="fa-btn ghost" data-demo="The app plays the saved interview here.">Play interview</button><button type="button" class="fa-btn ghost" data-demo="The app requests recording access only when you choose to replace the take.">Record again</button></div>`
            : `${step(3)}<h2>Now ask the owner.</h2><p class="fa-muted">10 short questions. About 5 minutes.</p><div class="fa-chip-row">${chip('EN', demo.language === 'EN', 'data-language="EN"')}${chip('TL', demo.language === 'TL', 'data-language="TL"')}</div><div class="fa-card"><b>1</b><h3>${demo.language === 'TL' ? 'Ano ang pangalan ng tindahan mo?' : 'What’s your shop called?'}</h3></div><div class="fa-between"><button type="button" class="fa-round" disabled aria-label="Previous question">${icon('arrow')}</button><span class="fa-label">Question 1 of 10</span><button type="button" class="fa-round" data-demo="The app previews all ten prompts plus optional Anything else." aria-label="Next question">${icon('chevron')}</button></div><p>Ask one question at a time. Let the owner answer in their own words.</p><p class="fa-muted">One recording, from the first question to “Anything else?”.</p>`,
          {
            footer:
              interactive && demo.repair
                ? btn('Save changes', 'review')
                : btn('Start', '', '', 'data-camera-preview') + btn('Voice only, no video', '', 'ghost'),
          },
        );
      case 'design': {
        const index = interactive ? Math.max(0, demo.design) : 0,
          design = designs[index];
        return app(
          `${step(4)}<h2>Choose your design</h2><p class="fa-muted">Example photos and text. This shop’s content is added after review.</p><button type="button" class="fa-design" data-action="full-design" aria-label="${design.name} design. Preview sample website." style="padding:0;height:350px;overflow:hidden">${interactive ? '<iframe class="fa-sample-frame fa-sample-inert" title="' + design.name + ' design sample" src="/template-previews/' + design.file + '.html" sandbox="allow-same-origin" tabindex="-1" referrerpolicy="no-referrer"></iframe>' : '<img style="height:350px" src="../assets/sites/showcase/sarisari-m.jpg" alt="Tindahan sample">'}</button><div class="fa-between"><h3>${design.name}</h3><span class="fa-muted">${index + 1} of 5</span></div><div class="fa-between"><button type="button" class="fa-round" data-design-move="-1" aria-label="Previous design" ${index === 0 ? 'disabled' : ''}>${icon('arrow')}</button><p class="fa-small fa-muted" style="text-align:center">Swipe designs. Tap one to see the whole sample.</p><button type="button" class="fa-round" data-design-move="1" aria-label="Next design" ${index === 4 ? 'disabled' : ''}>${icon('chevron')}</button></div>`,
          { footer: btn('Use this design', 'review') },
        );
      }
      case 'review':
        return app(
          `${step(5)}${interactive && demo.repair ? '<h2>Fix it, then resend</h2><div class="fa-banner danger"><b>What needs fixing</b><p class="fa-small">Please replace the blurry shop-front photo.</p></div><p class="fa-muted">Your saved capture is here. Edit only what needs fixing.</p>' : '<h2>Check it, then send</h2>'}<div class="fa-card"><div class="fa-row">${pic('sari-sari', 64, '', false, 'width:64px')}<div class="fa-grow"><b>Nena’s Sari-Sari</b><p class="fa-small fa-muted">Other</p></div>${link('Edit', 'info')}</div><p class="fa-small">Nena Reyes · 0917 000 0000<br>owner@example.com</p><p class="fa-small fa-muted">12 Main Street, Marikina</p></div><div class="fa-card"><div class="fa-between"><b>4 photos</b>${link('Edit photos', 'photos')}</div><div class="fa-photo-grid">${pic('food', 80, '', true)}${pic('food', 80, '', true)}</div></div><div class="fa-card"><div class="fa-between"><b>Interview ready</b><button type="button" class="fa-link" data-demo="The app plays the saved video or audio here.">Play interview</button></div><p class="fa-small fa-muted">The owner’s words and your photos help us build their site.</p>${link('Edit interview', 'interview')}</div><div class="fa-card fa-between"><div><b>Website design</b><p class="fa-small fa-muted">${interactive && demo.design === -1 ? 'No design selected' : designs[Math.max(0, demo.design)].name}</p></div>${link('Change', 'design')}</div><div class="fa-card fa-between"><div><b>Website address</b><p class="fa-small fa-muted">A Tendso address is included.</p></div><button type="button" class="fa-link" data-demo="The app checks and quotes an optional custom domain before it is added.">Add custom</button></div><div class="fa-card"><div class="fa-between"><b>Your price</b><span class="fa-small fa-muted">Lower price, easier yes</span></div><span class="fa-label">Set your price</span><div class="fa-amount" data-price-label>${peso(price)}</div><label class="sr-only" for="fa-price-${interactive ? 'live' : 'mini'}">Sample site price</label><input id="fa-price-${interactive ? 'live' : 'mini'}" class="fa-range" type="range" min="999" max="4999" step="500" value="${price}" data-price><div class="fa-between fa-small fa-muted"><span>₱999</span><span>₱4,999</span></div><div class="fa-metrics"><div class="fa-card" style="background:#f6f9c4"><b data-keep>${peso(price / 2)}</b><span class="fa-small">You keep after payment</span></div><div class="fa-card" style="background:#efefea"><b data-save>${peso(4999 - price)}</b><span class="fa-small">The shop saves</span></div></div></div>`,
          {
            footer: btn(
              interactive && demo.repair ? 'Resend for review' : 'Send for review',
              '',
              '',
              'data-action="confirm-send"',
            ),
          },
        );
      case 'sent':
      case 'queued': {
        const queued = id === 'queued';
        return app(
          `<div class="fa-hero-check">${icon(queued ? 'send' : 'check')}</div><h2 class="fa-center">${queued ? 'Saved on this phone' : 'Sent! We’ll build Nena’s Sari-Sari’s site.'}</h2><p class="fa-center fa-muted">${queued ? 'Your capture is queued. Keep Tendso open and connect to upload it.' : 'Your photos and the owner’s words are saved. Follow the progress from your dashboard.'}</p><span class="fa-label">What happens next</span>${[
            [
              queued ? 'Upload your capture' : 'Sent for review',
              queued ? 'Waiting for a connection' : 'Shop details, photos and interview',
            ],
            ['We review and build the site', 'From the owner’s words and your photos'],
            ['The owner reviews and pays', 'They review their website before paying'],
            ['Your commission: ₱500', 'Commission becomes eligible after the owner pays'],
          ]
            .map(
              ([t, s], i) =>
                `<div class="fa-card fa-check-item" style="flex-direction:row"><span class="fa-dot ${i === 0 && !queued ? 'done' : ''}">${i === 0 && !queued ? icon('check') : ''}</span><div><b>${t}</b><p class="fa-small fa-muted">${s}</p></div></div>`,
            )
            .join('')}`,
          { footer: btn('Back to the map', 'map') + btn('Spot another shop', 'spot', 'ghost') },
        );
      }
      case 'submission': {
        const resent = interactive && demo.resubmitted;
        return app(
          `<div class="fa-between"><h2>Nena’s Sari-Sari</h2><span class="fa-flag ${resent ? '' : 'danger'}">${resent ? 'In review' : 'Rejected'}</span></div>${resent ? '<div class="fa-card"><b>Resent for review</b><p class="fa-small fa-muted">Your corrections are saved on the same submission.</p></div>' : '<div class="fa-banner danger">' + icon('warning') + '<div><b>Review feedback</b><p class="fa-small">Please replace the blurry shop-front photo.</p></div></div><div class="fa-card"><b>Keep what’s correct</b><p class="fa-small fa-muted">Your saved details, photos and interview are ready to edit. Fix the review feedback and resend this same submission.</p></div>'}${pic('sari-sari', 160)}<div class="fa-card"><b>Submission details</b><p class="fa-small fa-muted">4 photos · Interview saved · Tindahan · ₱999</p><p class="fa-small fa-muted">Photos, interview and the review reason stay with this capture.</p></div>`,
          {
            title: 'Submission',
            back: 'me',
            footer: resent ? '' : btn('Edit and resend', '', '', 'data-action="edit-rejected"'),
          },
        );
      }
      case 'earn': {
        const selected = interactive ? demo.earnMonth : 5,
          month = earnMonths[selected];
        return app(
          `<div class="fa-card"><div class="fa-between"><span class="fa-label">Available to cash out</span><button type="button" class="fa-link" data-go="history" aria-label="Open payout history">${icon('clock')}</button></div><div class="fa-amount">₱3,750</div></div><div class="fa-metrics"><div class="fa-card"><b>₱19,400</b><span class="fa-label">Total earned</span></div><div class="fa-card"><b>₱15,650</b><span class="fa-label">Withdrawn</span></div></div><div class="fa-card"><div class="fa-between" aria-live="polite"><span class="fa-label" data-earned-month>Earned in ${month.name}</span><b data-earned-total>${peso(month.total)}</b></div><div class="fa-chart" role="group" aria-label="Monthly credited earnings">${earnMonths.map((m, i) => `<button type="button" class="fa-bar" data-earn-month="${i}" aria-pressed="${i === selected}" aria-label="${m.name} 2026, ${peso(m.total)} earned"><i aria-hidden="true" style="height:${(m.total / 6000) * 36}px"></i><span>${m.short}</span></button>`).join('')}</div></div><div class="fa-between"><b>Recent earnings</b>${link('See all', 'history')}</div><div class="fa-card">${row('Kalan', 'Earnings · Nov 1 · +₱2,000', 'shop', 'history')}</div><div class="fa-between"><b>Cash outs</b>${link('See all', 'history')}</div><div class="fa-card">${row('To Wise', 'Processing · Oct 30 · −₱1,000', 'send', 'history')}</div><div class="fa-card">${row('Invite field agents', 'Share your code with a friend', 'gift', 'me')}</div>`,
          { nav: 'earn', noHead: true, footer: btn('Cash out to Wise', 'cashout') },
        );
      }
      case 'history':
        return app(
          `<div class="fa-card"><div class="fa-between"><div><b>₱19,400</b><p class="fa-small fa-muted">Earned</p></div><div><b>₱15,650</b><p class="fa-small fa-muted">Cashed out</p></div><div><b>₱3,750</b><p class="fa-small fa-muted">Ready</p></div></div></div><div class="fa-chip-row">${['All', 'Earned', 'Cashed out'].map((f) => chip(f, demo.history === f, `data-history="${f}"`)).join('')}</div><span class="fa-label">November</span>${demo.history !== 'Cashed out' ? '<div class="fa-card"><b>Kalan <span style="float:right">+₱2,000</span></b><p class="fa-small fa-muted">Paid Nov 1</p></div>' : ''}${demo.history !== 'Earned' ? '<span class="fa-label">October</span><div class="fa-card"><div class="fa-between"><b>To Wise</b><b>−₱1,000</b></div><p class="fa-small fa-muted">Oct 30 · mika@example.com</p><span class="fa-flag">Processing</span><p class="fa-small fa-muted">Reference: SAMPLE-1030</p></div>' : ''}${demo.history !== 'Earned' ? '<span class="fa-label">Earlier</span><div class="fa-card"><b>To Wise</b><span class="fa-flag warn">Failed</span><p class="fa-small fa-muted">Read the reason and verify your Wise details before retrying.</p></div>' : ''}`,
          { title: 'Payouts', back: 'earn' },
        );
      case 'cashout':
        return app(
          `<h2>Cash out to Wise</h2><p class="fa-muted">₱3,750 ready to cash out</p><div class="fa-card fa-center"><span class="fa-label">Amount</span><label class="fa-field"><span class="sr-only">Sample cashout amount</span><input type="number" value="${escape(demo.cashAmount)}" style="font-size:40px;text-align:center" aria-label="Sample cashout amount" data-cash-amount></label><div class="fa-chip-row" style="justify-content:center">${['₱1,000', '₱2,000', 'All · ₱3,750'].map((t, i) => chip(t, i === 2, 'data-action="cash-pick"')).join('')}</div></div><div class="fa-between"><span class="fa-label">Your Wise email</span><button type="button" class="fa-link" data-demo="In the app this opens Set up Wise or the Wise email editor.">Change</button></div>${field('Wise email', 'mika@example.com', 'type="email"')}<div class="fa-banner">${icon('bell')}We send it to your Wise account and tell you when Wise completes it.</div>`,
          {
            title: '',
            back: 'earn',
            footer:
              btn(
                'Send ' + cashPeso(Number(demo.cashAmount)) + ' to Wise',
                '',
                '',
                'data-action="sample-cashout"',
              ) + btn('Not now', 'earn', 'ghost'),
          },
        );
      case 'me':
        return app(
          `<div class="fa-card"><div class="fa-row">${avatar()}<div><h3>Mika Santos</h3><p class="fa-muted">Field agent</p><span class="fa-flag lime">Certified</span></div></div><div class="fa-between"><span class="fa-label">Your code</span><b>MIKA8K2Q</b></div></div><div class="fa-card"><div class="fa-between fa-center"><div><b>12</b><p class="fa-small fa-muted">Submitted</p></div><div><b>₱3,750</b><p class="fa-small fa-muted">Balance</p></div><div><b>₱19,400</b><p class="fa-small fa-muted">Earned</p></div></div></div>${section('Your work', row('Show my certificate', 'View and share it', 'check') + row('Dashboard', 'Your sites and recent activity', 'grid') + row('Your submissions', 'Includes drafts', 'shop') + row('Invite field agents', '', 'gift'))}${section('Settings', row('Edit profile', '', 'edit', 'profile') + row('Notifications', 'See your latest updates', 'bell', 'notifications') + row('Change password', '', 'lock'))}${section('Help', row('Learn & help', '', 'book', 'training') + row('Help & FAQ', '', 'book'))}${section('Legal', row('Terms of Service', '', 'book') + row('Privacy Policy', '', 'lock'))}${btn('Sign out', '', 'danger')}`,
          { nav: 'me', noHead: true },
        );
      case 'profile':
        return app(
          `${interactive && demo.profileReview ? '<div class="fa-banner danger"><b>What needs fixing · Please use your full name.</b></div>' : ''}${avatar(true)}<button type="button" class="fa-link fa-center" style="align-self:center" data-demo="The app requests photo-library/camera access.">Tap the photo to change it</button><div class="fa-row">${field('First name', 'Mika')}${field('Last name', 'Santos')}</div>${field('Mobile', '0917 000 0000', 'type="tel"')}${field('Email', 'mika@example.com', 'disabled')}<p class="fa-small fa-muted">Can’t change</p><div style="height:40px"></div>${btn('Delete my account', '', 'danger')}`,
          {
            title: interactive && demo.profileReview ? 'Fix your profile' : 'Edit profile',
            back: interactive && demo.profileReview ? 'rejected' : 'me',
            footer:
              interactive && demo.profileReview
                ? btn('Resubmit for review', 'pending')
                : btn('Save changes', 'me'),
          },
        );
      case 'notifications': {
        const body = app(
          `<div class="fa-between"><h2>Notifications</h2><button type="button" class="fa-link" data-action="mark-all">Mark all read</button></div><span class="fa-label">Today</span><button type="button" class="fa-card" style="text-align:left" data-action="message"><div class="fa-row">${demo.read ? '' : '<span class="fa-unread"></span>'}<div><b>Your shop is ready to review</b><p class="fa-small fa-muted">Nena’s Sari-Sari · Just now</p></div></div><p class="fa-small fa-muted">Open to read the full message.</p></button><span class="fa-label">This week</span><div class="fa-card"><b>Welcome, field agent</b><p class="fa-small fa-muted">Your training progress is saved.</p></div>`,
          { title: '', back: 'me' },
        );
        return interactive && demo.message
          ? body.replace(
              '<div class="fa-home-line">',
              `<div class="fa-overlay"><div class="fa-modal" role="dialog" aria-modal="true" aria-label="Notification details"><div class="fa-between"><h3>Notification</h3><button type="button" class="fa-round" data-action="close-message" aria-label="Close notification">${icon('close')}</button></div><b>Your shop is ready to review</b><p>The website is ready for the owner to review. Commission becomes eligible after the owner completes payment.</p>${btn('View submission', 'submission')}</div></div><div class="fa-home-line">`,
            )
          : body;
      }
      default:
        return app('<h2>Screen reference</h2>');
    }
  }
  function phone(id, interactive) {
    const key = interactive ? 'live' : id;
    if (!interactive && phoneCache.has(key)) return phoneCache.get(key).el;
    const { el, screen } = phoneCache.get(key) || T.phone({ size: 'lg' });
    phoneCache.set(key, { el, screen });
    screen.innerHTML = screenMarkup(id, interactive);
    if (!interactive) {
      el.setAttribute('aria-hidden', 'true');
      el.inert = true;
    }
    return el;
  }
  function save() {
    try {
      localStorage.setItem(STORAGE, JSON.stringify(notes));
    } catch {
      toast('Browser storage is unavailable. Export your notes before closing.');
    }
  }
  function toast(message) {
    const el = document.getElementById('fa-toast');
    el.textContent = message;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      el.hidden = true;
    }, 4200);
  }
  function reviewNotes(id) {
    const saved = notes[id] || { checks: [], note: '', verdict: 'unreviewed' };
    return {
      ...saved,
      checks: saved.checkRevision === byId[id].checkRevision ? saved.checks : [],
      checkRevision: byId[id].checkRevision,
    };
  }
  function renderReview() {
    const s = byId[current],
      saved = reviewNotes(current);
    document.getElementById('fa-review').innerHTML =
      `<div>${badge(s.status)} ${s.priority ? `<span class="fa-badge">${s.priority}</span>` : ''}</div><h3>${escape(s.title)}</h3><p>${escape(s.summary)}</p><div><h4>Present in the app</h4><ul>${s.implemented.map((t) => `<li>${escape(t)}</li>`).join('')}</ul></div><div><h4>${s.status === 'gap' ? 'Before calling it complete' : s.status === 'decision' ? 'Decision to make' : 'Check next'}</h4>${s.checks.map((t, i) => `<label class="fa-review-check"><input type="checkbox" data-check="${i}" ${saved.checks.includes(i) ? 'checked' : ''}><span>${escape(t)}</span></label>`).join('')}</div><div class="fa-source"><h4>Source evidence</h4>${s.sources.map((src) => `<code>${escape(src.path)}:${src.line}</code>`).join('')}<small>Current source references · initial baseline 69dddc04. Implementation evidence does not mean device approval.</small></div><div class="fa-note"><label for="fa-verdict">Your device review</label><select id="fa-verdict"><option value="unreviewed">Not checked on device</option><option value="polish">Needs polish</option><option value="verified">Checked on device — looks good</option></select><label for="fa-note-input">Review notes</label><textarea id="fa-note-input" placeholder="Device, screen, what happened, what to change…">${escape(saved.note)}</textarea><small>Saved in this browser only. This does not change implementation status or submit feedback to the team.</small></div>`;
    document.getElementById('fa-verdict').value = saved.verdict;
  }
  function renderLive() {
    const node = document.getElementById('fa-live-phone');
    node.replaceChildren(phone(current, true));
    T.fitPhones(node);
  }
  function closeOverlay(overlay) {
    if (overlay.querySelector('[data-action="close-message"]')) {
      demo.message = false;
      renderLive();
      document.querySelector('#fa-live-phone [data-action="message"]')?.focus();
      return;
    }
    overlay.remove();
    document
      .querySelector('#fa-live-phone [data-action="confirm-send"],#fa-live-phone [data-action="full-design"]')
      ?.focus();
  }
  function select(id, scroll = false) {
    if (!ids.has(id)) return;
    if (id !== 'notifications') demo.message = false;
    current = id;
    document.getElementById('fa-picker').value = id;
    history.replaceState(null, '', '#' + id);
    renderLive();
    renderReview();
    document.getElementById('fa-design-state').hidden = id !== 'review';
    document.getElementById('fa-shop-state').hidden = id !== 'shop';
    if (scroll)
      document.getElementById('inspect').scrollIntoView({
        behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      });
  }
  function renderGallery() {
    const visible = screens.filter((s) => {
      const areaMatches = areaFilter === 'all' || s.area === areaFilter;
      const statusMatches =
        statusFilter === 'all' ||
        (statusFilter === 'work'
          ? ['gap', 'polish', 'decision'].includes(s.status)
          : s.status === statusFilter);
      return areaMatches && statusMatches;
    });
    const gallery = document.getElementById('fa-gallery');
    gallery.replaceChildren();
    for (const s of visible) {
      const article = document.createElement('article');
      article.className = 'fa-panel';
      article.dataset.screen = s.id;
      article.innerHTML = `<div class="fa-panel-top"><span class="fa-panel-num">${AREA[s.area]}</span>${badge(s.status)}</div><div class="fa-mini-stage"></div><div class="fa-panel-copy"><h3>${escape(s.title)}</h3><p>${escape(s.summary)}</p><button type="button" data-select="${s.id}">Inspect screen & checks ↗</button></div>`;
      article.querySelector('.fa-mini-stage').append(phone(s.id, false));
      gallery.append(article);
    }
    document.getElementById('fa-results').textContent =
      `${visible.length} of ${screens.length} panels · In code means implemented in source. Device checks remain open until you record a phone review.`;
    document.getElementById('fa-no-results').hidden = visible.length !== 0;
    T.fitPhones(gallery);
  }
  function renderStats() {
    const work = screens.filter((s) => ['gap', 'polish', 'decision'].includes(s.status)).length,
      device = screens.filter((s) => s.status === 'device').length;
    document.getElementById('fa-stats').innerHTML = [
      [screens.length, 'screens in this review'],
      [work, 'gaps, decisions or polish items'],
      [device, 'screens with device checks'],
      [Object.values(notes).filter((n) => n.verdict === 'verified').length, 'marked checked by you'],
    ]
      .map(([n, label]) => `<div class="fa-stat"><b>${n}</b><span>${label}</span></div>`)
      .join('');
  }
  function setup() {
    document.getElementById('fa-picker').innerHTML = screens
      .map(
        (s, i) =>
          `<option value="${s.id}">${String(i + 1).padStart(2, '0')} · ${AREA[s.area]} / ${s.title}</option>`,
      )
      .join('');
    document.getElementById('fa-area-filters').innerHTML = [['all', 'All flows'], ...Object.entries(AREA)]
      .map(
        ([id, label]) =>
          `<button type="button" data-area="${id}" aria-pressed="${id === 'all'}">${label}</button>`,
      )
      .join('');
    document.getElementById('fa-status-filters').innerHTML = [
      ['all', 'All statuses'],
      ['work', 'Needs work'],
      ['device', 'Device checks'],
      ['in-code', 'In code'],
    ]
      .map(
        ([id, label]) =>
          `<button type="button" data-status="${id}" aria-pressed="${id === 'all'}">${label}</button>`,
      )
      .join('');
    document.getElementById('fa-queue').innerHTML = [
      [
        'pending',
        'P2 · Copy review',
        'Confirm the approval timing promise',
        'The waiting screen promises a review within 24 hours. Check that this matches the team’s review coverage.',
      ],
      [
        'review',
        'Decision · Capture gate',
        'Can a capture send with no design?',
        'Current review can send when no design is selected. Decide whether that is intentional or needs a required-choice gate.',
      ],
    ]
      .map(
        ([id, label, title, text]) =>
          `<article><span class="fa-badge ${byId[id].status}">${label}</span><h3>${title}</h3><p>${text}</p><button type="button" data-select="${id}">Open the screen & evidence ↗</button></article>`,
      )
      .join('');
    renderStats();
    renderGallery();
    select(current);
  }
  document.addEventListener('click', (event) => {
    const el = event.target.closest('button,a');
    if (!el) return;
    if (el.hasAttribute('data-quiz-preview')) {
      toast(
        'The app opens the five-question certification quiz here. Passing and submitting the profile come before review.',
      );
      return;
    }
    if (el.dataset.designMove) {
      demo.design = Math.max(0, Math.min(4, Math.max(0, demo.design) + Number(el.dataset.designMove)));
      renderLive();
      return;
    }
    if (el.dataset.go) {
      if (el.dataset.go === 'profile') demo.profileReview = current === 'rejected';
      select(el.dataset.go);
      return;
    }
    if (el.dataset.select) {
      demo.profileReview = false;
      demo.repair = false;
      demo.resubmitted = false;
      select(el.dataset.select, true);
      return;
    }
    if (el.hasAttribute('data-route-preview')) {
      toast('Route opens the device’s directions app. In-app route preview is still deferred.');
      return;
    }
    if (el.dataset.demo) {
      toast(el.dataset.demo);
      return;
    }
    if (el.dataset.area) {
      areaFilter = el.dataset.area;
      document
        .querySelectorAll('[data-area]')
        .forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.area === areaFilter)));
      renderGallery();
      return;
    }
    if (el.dataset.status) {
      statusFilter = el.dataset.status;
      document
        .querySelectorAll('[data-status]')
        .forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.status === statusFilter)));
      renderGallery();
      return;
    }
    if (el.dataset.findFilter) {
      demo.findFilter = el.dataset.findFilter;
      renderLive();
      return;
    }
    if (el.dataset.range) {
      demo.range = el.dataset.range;
      renderLive();
      return;
    }
    if (el.dataset.language) {
      demo.language = el.dataset.language;
      renderLive();
      return;
    }
    if (el.dataset.design) {
      demo.design = Number(el.dataset.design);
      renderLive();
      return;
    }
    if (el.dataset.history) {
      demo.history = el.dataset.history;
      renderLive();
      return;
    }
    if (el.hasAttribute('data-earn-month') && el.closest('#fa-live-phone')) {
      const index = Number(el.dataset.earnMonth),
        month = earnMonths[index],
        card = el.closest('.fa-card');
      if (!month || !card) return;
      demo.earnMonth = index;
      card.querySelector('[data-earned-month]').textContent = 'Earned in ' + month.name;
      card.querySelector('[data-earned-total]').textContent = peso(month.total);
      card.querySelectorAll('[data-earn-month]').forEach((bar) => {
        bar.setAttribute('aria-pressed', String(Number(bar.dataset.earnMonth) === index));
      });
      return;
    }
    const action = el.dataset.action;
    if (action === 'edit-rejected') {
      demo.repair = true;
      select('review', true);
    } else if (action === 'resend-sample') {
      demo.repair = false;
      demo.resubmitted = true;
      select('submission', true);
      toast('Sample resent with the same saved submission. No backend action was performed.');
    } else if (action === 'sheet') {
      demo.sheet =
        demo.sheet === 'preview' ? 'expanded' : demo.sheet === 'expanded' ? 'collapsed' : 'preview';
      renderLive();
    } else if (action === 'select-map-shop') {
      demo.selectedShop = true;
      demo.sheet = 'expanded';
      renderLive();
    } else if (action === 'close-map-shop') {
      demo.selectedShop = false;
      renderLive();
    } else if (action === 'visit') {
      demo.visiting = true;
      renderLive();
    } else if (action === 'map-filter')
      toast('The native map filters real results within the current viewport.');
    else if (action === 'message') {
      demo.message = true;
      demo.read = true;
      renderLive();
      document.querySelector('#fa-live-phone [data-action="close-message"]')?.focus();
    } else if (action === 'close-message') {
      closeOverlay(el.closest('.fa-overlay'));
    } else if (action === 'mark-all') {
      demo.read = true;
      renderLive();
      toast('Sample inbox marked read. The app requires this explicit action.');
    } else if (action === 'kind') {
      el.closest('.fa-chip-row')
        .querySelectorAll('button')
        .forEach((b) => b.classList.toggle('on', b === el));
    } else if (action === 'city') {
      el.closest('.fa-chip-row')
        .querySelectorAll('button')
        .forEach((b) => b.classList.toggle('on', b === el));
    } else if (action === 'source') {
      el.closest('.fa-scroll')
        .querySelectorAll('[data-action="source"]')
        .forEach((b) => {
          b.querySelector('.fa-dot')?.remove();
        });
      el.insertAdjacentHTML('beforeend', '<span class="fa-dot done">' + icon('check') + '</span>');
    } else if (action === 'cash-pick') {
      const value = el.textContent.includes('1,000')
        ? '1000'
        : el.textContent.includes('2,000')
          ? '2000'
          : '3750';
      demo.cashAmount = value;
      renderLive();
    } else if (action === 'sample-cashout') toast('Preview only. No transfer has been created or sent.');
    else if (action === 'confirm-send') {
      const root = document.querySelector('#fa-live-phone .fa-app');
      const modal = document.createElement('div');
      modal.className = 'fa-overlay';
      modal.innerHTML = `<div class="fa-modal" role="dialog" aria-modal="true" aria-label="Sample send confirmation"><h3>${demo.repair ? 'Resend for review?' : 'Send for review?'}</h3><p>Your ${peso(demo.price / 2)} commission depends on the shop completing payment.</p>${demo.repair ? btn('Resend sample capture', '', '', 'data-action="resend-sample"') : btn('Send sample capture', 'sent')}${btn('Preview offline queue', 'queued', 'ghost')}<button type="button" class="fa-btn ghost" data-action="close-modal">Keep editing</button></div>`;
      root.append(modal);
      modal.querySelector('button').focus();
    } else if (action === 'full-design') {
      const design = designs[Math.max(0, demo.design)],
        root = document.querySelector('#fa-live-phone .fa-app'),
        overlay = document.createElement('div');
      overlay.className = 'fa-overlay';
      overlay.innerHTML =
        '<div class="fa-modal fa-design-modal" role="dialog" aria-modal="true" aria-label="Full design preview">' +
        statusBar +
        '<div class="fa-between"><h3>' +
        design.name +
        '</h3><button type="button" class="fa-round" data-action="close-modal" aria-label="Close design preview">' +
        icon('close') +
        '</button></div><iframe class="fa-sample-frame" title="Full ' +
        design.name +
        ' sample" src="/template-previews/' +
        design.file +
        '.html" sandbox="allow-same-origin" referrerpolicy="no-referrer"></iframe></div>';
      root.append(overlay);
      overlay.querySelector('button').focus();
    } else if (action === 'close-modal') {
      closeOverlay(el.closest('.fa-overlay'));
    }
  });
  document.addEventListener('input', (event) => {
    if (event.target.matches('[data-cash-amount]')) {
      demo.cashAmount = event.target.value;
      const n = Number(demo.cashAmount),
        button = document.querySelector('#fa-live-phone [data-action="sample-cashout"]');
      button.disabled = !Number.isFinite(n) || n <= 0 || n > 3750;
      button.textContent = button.disabled ? 'Enter an available amount' : 'Send ' + cashPeso(n) + ' to Wise';
    }

    if (event.target.matches('[data-price]')) {
      demo.price = Number(event.target.value);
      const root = event.target.closest('.fa-app');
      root.querySelector('[data-price-label]').textContent = peso(demo.price);
      root.querySelector('[data-keep]').textContent = peso(demo.price / 2);
      root.querySelector('[data-save]').textContent = peso(4999 - demo.price);
    }
    if (event.target.id === 'fa-note-input') {
      notes[current] = { ...reviewNotes(current), note: event.target.value };
      save();
    }
  });
  document.addEventListener('change', (event) => {
    if (event.target.matches('[data-check]')) {
      const saved = reviewNotes(current),
        index = Number(event.target.dataset.check);
      notes[current] = {
        ...saved,
        checks: event.target.checked
          ? [...new Set([...saved.checks, index])]
          : saved.checks.filter((i) => i !== index),
      };
      save();
    }
    if (event.target.id === 'fa-verdict') {
      notes[current] = { ...reviewNotes(current), verdict: event.target.value };
      save();
      renderStats();
    }
  });
  document.getElementById('fa-picker').addEventListener('change', (e) => {
    demo.repair = false;
    demo.resubmitted = false;
    select(e.target.value);
  });
  document
    .getElementById('fa-prev')
    .addEventListener('click', () =>
      select(screens[(screens.findIndex((s) => s.id === current) - 1 + screens.length) % screens.length].id),
    );
  document
    .getElementById('fa-next')
    .addEventListener('click', () =>
      select(screens[(screens.findIndex((s) => s.id === current) + 1) % screens.length].id),
    );
  document.getElementById('fa-large').addEventListener('click', (e) => {
    large = !large;
    e.currentTarget.setAttribute('aria-pressed', String(large));
    renderLive();
  });
  document.getElementById('fa-design-state').addEventListener('click', (e) => {
    demo.design = demo.design === -1 ? 0 : -1;
    e.currentTarget.setAttribute('aria-pressed', String(demo.design === -1));
    e.currentTarget.textContent = demo.design === -1 ? 'Show saved design' : 'Preview with no design';
    renderLive();
  });
  document.getElementById('fa-shop-state').addEventListener('click', (e) => {
    const stages = ['new', 'submitted', 'live'];
    demo.shopStage = stages[(stages.indexOf(demo.shopStage) + 1) % stages.length];
    e.currentTarget.textContent =
      'Shop example: ' + { new: 'Needs website', submitted: 'Submitted', live: 'Live' }[demo.shopStage];
    renderLive();
  });
  document.getElementById('fa-reset').addEventListener('click', () => {
    if (!window.confirm('Clear only this board’s saved browser notes and checkboxes?')) return;
    notes = {};
    save();
    renderStats();
    renderReview();
    toast('Board notes reset.');
  });
  document.getElementById('fa-export').addEventListener('click', () => {
    const blob = new Blob(
      [
        JSON.stringify(
          {
            board: 'field-agent-review',
            source: '69dddc04',
            exportedAt: new Date().toISOString(),
            reviews: Object.fromEntries(
              Object.keys(notes).map((id) => [id, byId[id] ? reviewNotes(id) : notes[id]]),
            ),
          },
          null,
          2,
        ),
      ],
      { type: 'application/json' },
    );
    const url = URL.createObjectURL(blob),
      a = document.createElement('a');
    a.href = url;
    a.download = 'tendso-field-agent-review.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  document.addEventListener('pointerdown', (event) => {
    const grab = event.target.closest('#fa-live-phone .fa-grab');
    if (!grab) return;
    const sheet = grab.closest('.fa-map-sheet'),
      scale = sheet.getBoundingClientRect().height / sheet.offsetHeight,
      start = event.clientY,
      height = sheet.offsetHeight;
    let moved = false;
    grab.setPointerCapture(event.pointerId);
    const move = (e) => {
      const delta = (e.clientY - start) / scale;
      if (Math.abs(delta) > 4) moved = true;
      sheet.style.height = Math.max(56, Math.min(620, height - delta)) + 'px';
    };
    const end = () => {
      grab.removeEventListener('pointermove', move);
      grab.removeEventListener('pointerup', end);
      grab.removeEventListener('pointercancel', end);
      if (moved) {
        const h = sheet.offsetHeight;
        demo.sheet = h < 160 ? 'collapsed' : h > 485 ? 'expanded' : 'preview';
        renderLive();
        document.querySelector('#fa-live-phone .fa-grab')?.focus();
      } else sheet.style.height = '';
    };
    grab.addEventListener('pointermove', move);
    grab.addEventListener('pointerup', end);
    grab.addEventListener('pointercancel', end);
  });
  document.addEventListener(
    'load',
    (event) => {
      const frame = event.target;
      if (!frame.matches?.('.fa-sample-frame')) return;
      try {
        frame.contentDocument.addEventListener(
          'click',
          (e) => {
            const target = e.target.closest('a,button,input,form');
            if (target && !(target.tagName === 'A' && target.getAttribute('href')?.startsWith('#')))
              e.preventDefault();
          },
          true,
        );
        frame.contentDocument.addEventListener('submit', (e) => e.preventDefault());
        frame.contentDocument.addEventListener('keydown', (e) => {
          if (e.key === 'Escape' && frame.closest('.fa-overlay')) {
            e.preventDefault();
            closeOverlay(frame.closest('.fa-overlay'));
          }
        });
      } catch {}
    },
    true,
  );
  document.addEventListener('keydown', (event) => {
    const overlay = event.target.closest?.('.fa-overlay');
    if (!overlay) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      closeOverlay(overlay);
      return;
    }
    if (event.key === 'Tab') {
      const items = [...overlay.querySelectorAll('button:not(:disabled),iframe')];
      if (!items.length) return;
      const first = items[0],
        last = items[items.length - 1];
      if (event.shiftKey && event.target === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && event.target === last) {
        event.preventDefault();
        first.focus();
      }
    }
  });
  setup();
})();
