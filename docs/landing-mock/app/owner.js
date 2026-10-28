/* Owner app board (agent C1b). Renders every owner screen into a phone, row by row, in the Round 2
   language (kit v3, css/app-kit.css). Screens that exist in js/screens.js are mounted through
   window.TendsoScreens; the rest are drawn here. Owner: Ben Reyes, Forge Barbers (Marikina). Agent: Mika Santos. */
(function () {
  const TD = window.TD;
  const A = (p) => '../' + p;                       // TD paths are relative to the landing root
  const I = (name, cls = '') => `<i data-lucide="${name}"${cls ? ` class="${cls}"` : ''}></i>`;
  const HOME = '<div class="a-home"></div>';
  const SB = (dark) => T.statusBar(dark);
  const kalan = TD.sites.find((s) => s.id === 'forge');   // the example shop: Forge Barbers (variable name kept)
  const mika = TD.agents[0];
  const MARK = A('assets/brand/mark-ink-256.png');
  // Mika's face: same placeholder photo and crop as agents-near in js/screens.js, so she reads as one person
  const mikaFace = (() => { const f = { src: 'assets/people/17-mika.jpg', ar: 0.8, fx: 0.51, fy: 0.21, z: 3.6 }; const w = f.z * 100;
    return `<span class="a-avatar ow-face"><img src="${A(f.src)}" alt="${mika.name}" style="width:${w}%;left:${50 - f.fx * w}%;top:${50 - (f.fy * w) / f.ar}%"></span>`; })();

  // ---------- shared bits ----------
  const back = `<span class="a-back">${I('arrow-left')}</span>`;
  const stepBar = (n, of = 4) => `<div class="ow-top a-step">${back}<div class="a-progress"><i style="width:${(n / of) * 100}%"></i></div><b>${n} / ${of}</b></div>`;
  const titleBar = (title, right = '<span style="width:40px"></span>') => `<div class="ow-top ow-bar">${back}<b>${title}</b>${right}</div>`;
  const bubble = (q, sub) => `<div class="a-bubble"><span class="a-bubble-mark"><img src="${MARK}" alt="Tendso"></span>
    <div class="a-bubble-text"><b>${q}</b>${sub ? `<span>${sub}</span>` : ''}</div></div>`;
  const pill = (label, variant = 'accent') => `<div class="door door--${variant}">${label}</div>`;
  const tick = `<span class="a-tick">${I('check')}</span>`;
  const okDot = `<span class="ow-dot ow-dot--ok">${I('check')}</span>`;
  const app = (inner, { proposed = false, dark = false, white = false } = {}) =>
    `<div class="app${dark ? ' app--dark' : ''}${white ? ' ow-white' : ''}"${proposed ? ' data-proposed="true"' : ''}>${inner}${HOME}</div>`;

  // ================= ROW 1 · START =================
  // Sign up (real: (auth)/signup.tsx, simplified for owners)
  const signup = () => app(`${SB()}<div class="ow-top">${back}</div>
    <div class="ow-main" style="top:126px;gap:18px">
      <h2 class="ow-h1 ow-h1--lg">Make your account</h2><p class="ow-sub">We email you a code. No password.</p>
      <div class="ow-fld"><span class="a-label">Your name</span><div class="a-field">${I('user')}<b>Ben Reyes</b></div></div>
      <div class="ow-fld"><span class="a-label">Email</span><div class="a-field">${I('mail')}<b>ben@example.com</b></div></div>
    </div><div class="ow-foot">${pill('Send my code')}<p class="ow-small">By continuing you agree to our Terms and Privacy Policy.</p></div>`);
  // Q1 What does your shop sell? (real fields from submit/info.tsx, asked one at a time)
  const kinds = [
    ['Food & carinderia', 'assets/photos/kalan-cook.jpg'],
    ['Bakery & café', 'assets/photos/kalan-pandesal.jpg'],
    ['Beauty & salon', 'assets/photos/hela-hero.jpg'],
    ['Barbershop', 'assets/people/03-barber.jpg', true],
    ['Sari-sari & retail', 'assets/people/01-sarisari.jpg'],
    ['Repair & services', 'assets/photos/vulca-hero.jpg'],
  ];
  const q1 = () => app(`${SB()}${stepBar(1, 3)}
    <div class="ow-main">
      ${bubble('What does your shop sell?', 'We\'ll only show designs that fit your shop.')}
      <div style="display:flex;flex-direction:column;gap:10px;margin-top:8px">
        ${kinds.map(([t, src, on]) => `<div class="a-opt${on ? ' is-on' : ''}"><img src="${A(src)}" alt=""><span>${t}</span>${on ? tick : ''}</div>`).join('')}
      </div>
    </div>
    <div class="ow-foot">${pill('Continue')}</div>`);

  // Q2 name + where, with a map pin
  const mapSvg = `<svg class="ow-map-svg" viewBox="0 0 350 210" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <path d="M58 -10 C 70 50, 40 90, 66 140 S 70 200, 52 230" fill="none" stroke="#D9DEDF" stroke-width="22"/>
    <g fill="none" stroke="#FFFFFF" stroke-linecap="round">
      <path d="M-10 118 L 360 92" stroke-width="11"/>
      <path d="M196 -10 L 172 230" stroke-width="11"/>
      <path d="M-10 40 L 360 30" stroke-width="5"/><path d="M-10 182 L 360 166" stroke-width="5"/>
      <path d="M118 -10 L 104 230" stroke-width="5"/><path d="M268 -10 L 254 230" stroke-width="5"/>
      <path d="M318 -10 L 300 230" stroke-width="4"/>
    </g>
    <g fill="#E2E2DB"><rect x="210" y="40" width="40" height="44" rx="5"/><rect x="128" y="126" width="38" height="34" rx="5"/><rect x="270" y="106" width="26" height="52" rx="5"/><rect x="214" y="122" width="34" height="38" rx="5"/></g>
    <text x="214" y="86" font-family="Onest, sans-serif" font-size="9" font-weight="600" fill="#9A998F" transform="rotate(-4 214 86)">J.P. Rizal St</text>
  </svg>`;
  const q2 = () => app(`${SB()}${stepBar(2, 3)}
    <div class="ow-main" style="gap:12px">
      ${bubble('What\'s your shop called, and where is it?', 'Customers will find you by these two.')}
      <div class="ow-fld" style="margin-top:8px"><span class="a-label">Shop name</span>
        <div class="a-field">${I('store')}<b>${kalan.name}</b></div></div>
      <div class="ow-fld"><span class="a-label">Address</span>
        <div class="a-field is-focus">${I('map-pin')}<b>12 J.P. Rizal St, Concepcion Uno<span class="ow-caret"></span></b></div></div>
      <div class="ow-map">${mapSvg}
        <span class="ow-map-chip">${I('map-pin')}${kalan.city}</span>
        <span class="ow-map-pin"><span>${I('store')}</span></span>
        <span class="ow-map-use">${I('locate-fixed')}Use my location</span>
      </div>
    </div>
    <div class="ow-foot">${pill('Continue')}</div>`);

  // Q3 how do you want to do this? (proposed)
  const q3 = () => app(`${SB()}${stepBar(3, 3)}
    <div class="ow-main" style="gap:12px">
      ${bubble('Who holds the phone?', 'Film yourself, or ask a friend to help.')}
      <div class="ow-way is-on" style="margin-top:6px">
        <div class="ow-way-img"><img src="${A('assets/photos/forge/phone-headshot.jpg')}" alt=""></div>${tick}
        <div class="ow-way-t"><b>By myself</b><span class="ow-way-m">${I('smartphone')}You film yourself</span></div>
      </div>
      <div class="ow-way">
        <div class="ow-way-img"><img src="${A('assets/people/15-carinderia.jpg')}" alt=""></div>
        <div class="ow-way-t"><b>With a friend</b><span class="ow-way-m">${I('users')}A friend films you</span></div>
      </div>
    </div>
    <div class="ow-foot">${pill('Continue')}<p class="ow-small"><b>Send someone to my shop</b></p></div>`);

  // ================= ROW 2 · TALK =================
  // interview-list + interview-cam come from js/screens.js (guided capture, proposed 2026-10-21)
  const bars = [5, 9, 14, 8, 18, 22, 12, 16, 24, 11, 7, 15, 20, 13, 9, 17, 23, 10, 6, 14, 19, 12, 8, 16, 11, 7];
  const interviewDone = () => app(`${SB()}${stepBar(1)}
    <div class="ow-main" style="gap:0">
      <div class="ow-center" style="margin-top:8px">
        <span class="ow-okc">${I('check')}</span>
        <h2 class="ow-h1 ow-h1--lg ow-gap14">Got it, Ben.</h2>
        <p class="ow-sub ow-gap4">10 answers + 1 extra · 5 min 52 s</p>
      </div>
      <div class="a-card a-card--lg" style="margin-top:22px">
        <div class="ow-qhead"><span class="a-label">In your own words</span><span class="a-chip a-chip--ok">${I('check')}Transcribed</span></div>
        <p class="ow-quote">“${TD.words.transcript}”</p>
        <div class="ow-audio"><span class="ow-play">${I('play')}</span>
          <span class="ow-wave">${bars.map((h, i) => `<i class="${i < 7 ? 'on' : ''}" style="height:${h}px"></i>`).join('')}</span><b>5:52</b></div>
      </div>
    </div>
    <div class="ow-foot"><p class="ow-small">Something off? <b>Redo an answer</b></p>${pill('Next: photos')}</div>`);

  // ================= ROW 3 · PHOTOS =================
  const pair = TD.pairs[0];
  const thumbs = [
    { src: pair.after, on: true, up: true }, { src: 'assets/photos/forge/pro2-headshot.jpg', up: true }, { src: 'assets/photos/forge/pro2-mirror.jpg', up: true },
    { src: 'assets/photos/forge/pro2-clippers.jpg', up: true }, { src: 'assets/photos/forge/phone-prices.jpg', up: false }, { src: 'assets/photos/forge/pro2-outside.jpg', up: true },
  ];
  const photoUpgrade = () => app(`${SB()}${stepBar(2)}
    <div class="ow-main" style="gap:14px"><h2 class="ow-h1">Your photos</h2><p class="ow-sub">Tap a photo to view it. Retake any suggestion.</p>
      <div class="ow-thumbs" style="flex-wrap:wrap">${thumbs.map(t => `<span class="ow-thumb"><img src="${A(t.src)}" alt="Sample shop photo"></span>`).join('')}</div>
      <div class="a-card"><b>10 photo ideas</b><p class="ow-sub">Owner, outside, inside, work, tools and prices.</p></div>
    </div><div class="ow-foot">${pill('Next: pick a design')}${pill('Add from my phone', 'ghost')}</div>`);
  // Kept as a future concept: the owner API does not expose upgrade choices yet.
  const photoEnhancementConcept = () => app(`${SB()}${stepBar(2)}
    <div class="ow-main" style="gap:14px"><h2 class="ow-h1">Photo upgrade review</h2>
      <p class="ow-sub">Future concept · compare the original and upgraded photo.</p>
      <div class="ow-cmp" data-cmp><img src="${A(pair.after)}" alt="Upgrade concept">
        <div class="ow-cmp-before"><img src="${A(pair.before)}" alt="Original phone photo"></div>
        <span class="ow-cmp-tag ow-cmp-tag--l">Phone photo</span><span class="ow-cmp-tag ow-cmp-tag--r">Upgrade concept</span>
        <div class="ow-cmp-line"><span class="ow-cmp-knob">${I('chevrons-left-right')}</span></div>
      </div>
    </div><div class="ow-foot"><p class="ow-small">Not available in the app yet.</p></div>`, { proposed: true });

  // ================= ROW 4 · DESIGN =================
  const mixing = () => app(`${SB()}${titleBar('Forge')}
    <div class="ow-main" style="top:118px;gap:12px"><p class="ow-sub">Sample website · Scroll to explore</p>
      <div style="height:450px;overflow:auto;border-radius:22px"><img src="${A('assets/sites/designs/barber-f-m-long.jpg')}" alt="Sample Forge design" style="width:100%"></div>
    </div><div class="ow-foot">${pill('Use this design')}</div>`);
  const stage = (state, label, meta, extra = '') => `<div class="ow-st is-${state}">${
    state === 'done' ? okDot : state === 'run' ? '<span class="ow-dot ow-dot--run"></span>' : '<span class="ow-dot ow-dot--wait"></span>'
  }<div class="ow-st-l">${label}${extra}</div><em>${meta}</em></div>`;
  const building = () => app(`${SB()}
    <div class="ow-main" style="top:84px;gap:12px">
      <h2 class="ow-h1 ow-h1--lg">We're building<br>Forge's site</h2>
      <p class="ow-sub" style="margin-top:-4px">Ready in about 20 minutes. Check progress here.</p>
      <div class="a-card ow-stages" style="margin-top:8px" data-build>
        ${stage('done', 'Interview transcribed', 'Done')}
        ${stage('done', 'Photos prepared', 'Done')}
        ${stage('run', 'Writing your pages', 'Now', '<span class="a-progress"><i style="width:40%"></i></span>')}
        ${stage('wait', 'Design and build', 'Next')}
        ${stage('wait', 'Review', 'Last')}
      </div>
      <div class="a-sec" style="margin-top:6px">What happens next</div>
      <div class="a-card ow-next">
        <div><span class="a-ic">${I('clock')}</span>Open Today to see progress</div>
        <div><span class="a-ic">${I('pencil')}</span>You look it over and change anything</div>
        <div><span class="a-ic">${I('wallet')}</span>You see it first. Then you pay once.</div>
      </div>
    </div>
    <div class="ow-foot">${pill('Back to home', 'ghost')}</div>`, { proposed: true });

  // ================= ROW 5 · LIVE =================
  const notif = () => app(`<img class="ow-lock-bg" src="${A(kalan.hero)}" alt=""><span class="ow-lock-shade"></span>${SB(true)}
    <div class="ow-lock-top">${I('lock')}<span class="ow-lock-date">Friday, 23 October</span><span class="ow-lock-time">9:41</span></div>
    <div class="ow-notif">
      <div class="ow-notif-h"><img src="${A('assets/brand/app-icon-256.png')}" alt="">Tendso<em>now</em></div>
      <b>Your site is ready to see</b>
      <p>Forge is built. Look it over, change anything, then go live.</p>
    </div>
    <span class="ow-lock-btn" style="left:46px">${I('flashlight')}</span>
    <span class="ow-lock-btn" style="right:46px">${I('camera')}</span>`, { proposed: true, dark: true });

  const siteEdit = () => app(`${SB()}${titleBar('Ask for a change')}
    <div class="ow-main" style="top:126px;gap:18px"><h2 class="ow-h1">What should we change?</h2><p class="ow-sub">Tell the team in your own words.</p>
      <div class="a-card"><span class="a-label">Your request</span><div class="ow-ta">Please update our opening hours to 9 AM – 7 PM.</div></div>
    </div><div class="ow-foot">${pill('Send request')}</div>`);
  const pay = () => app(`${SB()}${titleBar('Pay once', `<span class="a-back">${I('lock', 'ow-s16')}</span>`)}
    <div class="ow-main" style="top:118px;gap:10px">
      <div class="a-card ow-sum">
        <div class="ow-sum-top">
          <span class="ow-sum-thumb"><img src="${A('assets/sites/showcase/forge-m.jpg')}" alt=""></span>
          <span class="ow-sum-t"><b>${kalan.name} website</b><span>${kalan.url}</span><span>Private preview approved by you</span></span>
          <span class="ow-price">₱4,999<small>once</small></span>
        </div>
        <div class="ow-incl">${['Your site, hosted', 'Free web address', 'No monthly fees'].map((t) => `<span>${I('check')}${t}</span>`).join('')}</div>
      </div>
      <div class="ow-dom">${I('globe')}<span class="ow-dom-t"><b>Want forgebarbers.com?</b><span>Optional · add it now or later</span></span>${I('chevron-right')}</div>
      <div class="ow-sec-l">Pay with</div>
      <div class="ow-pm">
        <div class="a-opt is-on"><span class="a-ic">${I('smartphone')}</span><span class="ow-pm-t">GCash<small>0917 ••• 1063</small></span>${tick}</div>
        <div class="a-opt"><span class="a-ic">${I('wallet')}</span><span class="ow-pm-t">Maya<small>Pay from your Maya wallet</small></span><i class="ow-radio"></i></div>
        <div class="a-opt"><span class="a-ic">${I('credit-card')}</span><span class="ow-pm-t">Card<small>Visa or Mastercard · not saved</small></span><i class="ow-radio"></i></div>
      </div>
    </div>
    <div class="ow-foot">${pill('Pay ₱4,999')}<p class="ow-small">One payment · No monthly fees</p></div>`, { proposed: true });

  function qr(seed = 7, n = 25) {
    let s = seed; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    const on = (x, y) => {
      const f = (fx, fy) => { const dx = x - fx, dy = y - fy; if (dx < -1 || dy < -1 || dx > 7 || dy > 7) return null;
        if (dx === -1 || dy === -1 || dx === 7 || dy === 7) return false;
        const r = Math.max(Math.abs(dx - 3), Math.abs(dy - 3)); return r !== 2; };
      for (const [fx, fy] of [[0, 0], [n - 7, 0], [0, n - 7]]) { const v = f(fx, fy); if (v !== null) return v; }
      if (y === 6) return x % 2 === 0; if (x === 6) return y % 2 === 0;
      if (x >= 16 && x <= 20 && y >= 16 && y <= 20) { const r = Math.max(Math.abs(x - 18), Math.abs(y - 18)); return r !== 1; }
      return rnd() > 0.52;
    };
    let d = '';
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (on(x, y)) d += `M${x} ${y}h1v1h-1z`;
    return `<svg class="ow-qr-code" viewBox="0 0 ${n} ${n}" shape-rendering="crispEdges" aria-label="QR code for ${kalan.url}"><path d="${d}" fill="#0C0A08"/></svg>`;
  }
  const live = () => app(`${SB()}
    <div class="ow-main" style="top:92px;gap:12px">
      <div class="ow-center">
        <span class="ow-livepill"><span class="a-live" style="--c:var(--a-accent)"></span>Live now</span>
        <h2 class="ow-h1 ow-h1--lg ow-gap14">Forge is online!</h2>
        <p class="ow-sub ow-gap4">Share it anywhere.</p>
      </div>
      <div class="a-card ow-urlcard" style="margin-top:8px">
        <span class="a-label">Your web address</span>
        <div class="ow-urlrow ow-gap4"><span class="ow-url">${kalan.url}</span>${I('external-link')}</div>
        <div class="ow-acts"><span class="a-pill">${I('copy')}Copy</span><span class="a-pill a-pill--ink">${I('share-2')}Share</span></div>
      </div>
      <div class="a-card ow-qr">${qr()}
        <div><b>For your counter</b><p>Customers scan it to open your site.</p><span class="a-pill">${I('download')}Save QR</span></div>
      </div>
    </div>
    <div class="ow-foot">${pill('Go to my home')}</div>`, { proposed: true });

  // ================= ROW 6 · AFTER =================
  const tab = (icon, label, on) => `<span class="a-tab${on ? ' is-on' : ''}">${I(icon)}<span>${label}</span></span>`;
  const home = () => app(`${SB()}
    <div class="ow-main" style="top:66px;gap:12px">
      <div class="ow-hello"><h2 class="ow-h1">Morning, Ben</h2><span class="ow-bell">${I('bell')}</span></div>
      <div class="a-card ow-site" style="position:relative;margin-top:2px">
        <img src="${A('assets/sites/showcase/forge-m.jpg')}" alt="Forge website">
        <div class="ow-site-in">
          <span class="ow-live"><i></i>Live</span>
          <b>${kalan.name}</b><span>${kalan.url}</span>
          <div class="ow-stats"><div><b>Live</b><span>your website</span></div><div><b>Paid</b><span>in full</span></div></div>
        </div>
        <span class="a-chip a-chip--muted ow-sample">Sample</span>
      </div>
      <div class="a-sec" style="margin-top:6px">Make it better</div>
      <div class="a-check is-done"><i class="c"></i><span>Publish your site</span></div>
      <div class="a-check"><i class="c"></i><span>Ask for a change</span></div>
      <div class="a-check"><i class="c"></i><span>Share your site and QR</span></div>
      <div class="a-check"><i class="c"></i><span>Get forgebarbers.com</span><em>Optional</em></div>
      <div class="a-sec" style="margin-top:6px">Your plan</div>
      <div class="a-card ow-next" style="padding:14px 16px">
        <div><span class="a-ic">${I('pencil')}</span><span style="flex:1">View your site</span>${I('chevron-right', 'ow-s16')}</div>
      </div>
    </div>
    <nav class="a-tabbar ow-tabs">${tab('house', 'Today', true)}${tab('smartphone', 'My site')}${tab('users', 'Agents')}${tab('circle-user', 'Me')}</nav>`, { proposed: true });

  const days = [['Today', '21'], ['Thu', '22', true], ['Fri', '23'], ['Sat', '24'], ['Mon', '26']];
  const slots = [['9:00 AM'], ['10:30 AM', 'on'], ['1:00 PM'], ['2:30 PM', 'off'], ['4:00 PM'], ['5:30 PM']];
  const book = () => app(`${SB()}${titleBar('Request a visit')}
    <div class="ow-main" style="top:118px;gap:18px"><h2 class="ow-h1">When works for you?</h2>
      <div class="ow-days">${['Today', 'Tomorrow', 'This week'].map((day, i) => `<span class="ow-slot${i === 1 ? ' is-on' : ''}">${day}</span>`).join('')}</div>
      <div class="ow-fld"><span class="a-label">Your mobile number</span><div class="a-field">${I('phone')}<b>0917 482 1063</b></div></div>
      <div class="a-card ow-next"><div>${I('clock')}About 30 minutes at your shop</div><div>${I('phone')}The team confirms your agent and time</div></div>
    </div><div class="ow-foot">${pill('Send request')}</div>`);
  const booked = () => app(`${SB()}
    <div class="ow-main" style="top:118px;gap:18px"><div class="ow-center"><span class="ow-okc">${I('check')}</span>
      <h2 class="ow-h1 ow-h1--lg ow-gap14">Your request is sent</h2><p class="ow-sub">The team calls to confirm an agent and time.</p></div>
      <div class="a-card ow-kv"><div><span>Shop</span><span>Forge</span></div><div><span>Preferred</span><span>Tomorrow</span></div>
      <div><span>Call</span><span>0917 482 1063</span></div></div>
    </div><div class="ow-foot">${pill('Back to home')}</div>`);
  // ---------- TendsoScreens slots ----------
  const placeholder = (name) => app(`${SB()}
    <div class="ow-ph"><span class="a-label">TendsoScreens · ${name}</span><b>Loads from<br>js/screens.js</b><p>Not available yet.</p></div>`);

  // ---------- board config ----------
  const ROWS = [
    { title: 'Start', note: 'Account, then three quick questions. One question per screen.', steps: [
      { ts: 'welcome', kind: 'real', source: 'app/index.tsx', name: 'Welcome', note: 'One app. "I have a business" starts the owner flow.' },
      { render: signup, kind: 'real', source: '(auth)/owner.tsx', name: 'Sign up', note: 'Name and email, then an email code. No password or SMS.' },
      { render: q1, kind: 'real', source: '(owner)/start/sell.tsx', name: 'What do you sell?', note: 'Business type, asked as one question with photo rows.' },
      { render: q2, kind: 'real', source: '(owner)/start/place.tsx', name: 'Name and place', note: 'Name and address with a map pin to confirm.' },
      { render: q3, kind: 'real', source: '(owner)/start/how.tsx', name: 'How to do it', note: 'Film yourself or have a friend hold the phone. A separate action requests a field-agent visit.' },
    ] },
    { title: 'Talk', note: 'Ten simple questions on camera, one at a time, then anything else. The app writes it down.', steps: [
      { ts: 'interview-list', kind: 'real', source: '(owner)/talk/index.tsx', name: '10 questions', note: 'Ten bilingual questions with actual saved-answer completion. Start video or voice only.', opts: { owner: true, step: 1 } },
      { ts: 'interview-cam', kind: 'real', source: '(owner)/talk/record.tsx', name: 'Recording', note: 'Per-answer recordings, framing feedback and individual answer redo.', opts: { owner: true, video: 'assets/video/interview-2.mp4', type: 'barber' } },
      { render: interviewDone, kind: 'real', source: '(owner)/talk/done.tsx', name: 'Got it', note: 'Real saved answers, playback and individual redo. Text appears only when available.' },
    ] },
    { title: 'Photos', note: 'Ten photo tasks picked for the kind of shop, then any extras. Phone photos in, site photos out.', steps: [
      { ts: 'shot-list', kind: 'real', source: '(owner)/photos/index.tsx', name: 'Photo tasks', note: 'Ten suggestions for the shop category, captured thumbnails and library extras.', opts: { type: 'barber', step: 2 } },
      { ts: 'shot-guide', kind: 'real', source: '(owner)/photos/shoot.tsx', name: 'Guided camera', note: 'One task at a time, with level feedback and targeted retakes.', opts: { type: 'barber' } },
      { render: photoUpgrade, kind: 'real', source: '(owner)/photos/done.tsx', name: 'Your photos', note: 'Review originals, view full photos and retake a slot. Before/after enhancement selection is a future owner API capability.' },
      { render: photoEnhancementConcept, kind: 'proposed', source: 'Future: enhancement choices', name: 'Photo upgrade concept', note: 'Original future design retained separately. Requires owner-scoped before/after results and a saved choice; current mobile shows original photos.' },
    ] },
    { title: 'Design', note: 'Choose one sample design, preview the whole site, then build with your words and photos.', steps: [
      { ts: 'design-picker', kind: 'real', source: '(owner)/design.tsx', name: 'Choose a design', note: 'One design for the shop category. Samples are labelled; offline and loading failures stay readable.' },
      { render: mixing, kind: 'real', source: 'OwnerDesignGallery.tsx', name: 'Full sample preview', note: 'Scroll a sample website and close to keep the selection. Mixing was dropped by the accepted defaults.' },
      { render: building, kind: 'real', source: '(owner)/building.tsx', name: 'Building', note: 'Real backend build stages, about 20 minutes. Owner push delivery is a separate backend capability.' },
    ] },
    { title: 'Live', note: 'We build it in about 20 minutes. Check it, ask for a change or say it looks good, pay once.', steps: [
      { render: notif, kind: 'proposed', source: 'Future: owner push', name: 'Notification', note: 'Future push concept: owner push tokens/delivery are not implemented. Current Inbox opens owned site status.' },
      { ts: 'site-building', kind: 'real', source: '(owner)/building.tsx', name: 'We build it', note: 'About 20 minutes: reading, writing, polishing photos and building. Check progress from Today.', opts: { done: 2 } },
      { ts: 'site-building', kind: 'real', source: '(owner)/check.tsx', name: 'Ready to check', note: 'Ask for a change, or say it looks good.', opts: { review: true } },
      { ts: 'site-ready', kind: 'real', source: '(owner)/pay/index.tsx', name: 'Site ready', note: 'The finished private site, before paying. Deposits are not a fixed monthly subscription.', via: 'about 20 minutes later' },
      { render: siteEdit, kind: 'real', source: '(owner)/change.tsx', name: 'Ask for a change', note: 'A real free-text request goes to the team. Direct block editing is a later phase.' },
      { render: pay, kind: 'real', source: '(owner)/pay/index.tsx', name: 'Pay once', note: 'Server price, optional creator code, full or down payment; Xendit methods only when enabled, or Wise.' },
      { render: live, kind: 'real', source: '(owner)/live.tsx', name: 'Live', note: 'Actual public address, copy/share and a real counter QR with save/share actions.' },
    ] },
    { title: 'After', note: 'Owner home and a field-agent visit request assigned by the team.', steps: [
      { render: home, kind: 'real', source: '(owner)/(tabs)/today.tsx', name: 'Home', note: 'Actual site and payment status, a real checklist, sharing, change requests and Inbox. No invented analytics.' },
      { ts: 'agents-near', kind: 'proposed', source: 'Future: agent directory', name: 'Nearby-agent map concept', note: 'Live mode requests a team-assigned visit. This map is a labelled concept until consented nearby-agent data exists.', via: 'Agents tab' },
      { render: book, kind: 'real', source: '(owner)/agents/book.tsx', name: 'Request a visit', note: 'Send a preferred day and contact number. The team confirms the agent and time.' },
      { render: booked, kind: 'real', source: '(owner)/agents/book.tsx', name: 'Request sent', note: 'Confirms the request only; no fixed appointment, WhatsApp promise or calendar booking.' },
    ] },
  ];

  const arrow = (label) => `<div class="ow-arrow" aria-hidden="true">${label ? `<span>${label}</span>` : ''}
    <svg viewBox="0 0 44 10"><path d="M0 5h42M37 1l5 4-5 4" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg></div>`;

  const mounted = [];
  function mountTS(screen, s) {
    const TS = window.TendsoScreens;
    if (!TS || typeof TS.mount !== 'function') { screen.innerHTML = placeholder(s.ts); return; }
    try {
      const m = TS.mount(screen, s.ts, s.opts || {});
      const root = screen.firstElementChild;
      if (root && s.kind === 'proposed') root.setAttribute('data-proposed', 'true');
      else if (root) root.removeAttribute('data-proposed');
      if (s.ts === 'site-ready') {
        const terms = screen.querySelector('.sr-when');
        if (terms) terms.textContent = 'Pay once, or start with a down payment';
      }
      mounted.push(m);
    } catch (err) {
      console.warn('[owner] TendsoScreens.mount failed for', s.ts, err);
      screen.innerHTML = placeholder(s.ts);
    }
  }

  function render() {
    const board = document.getElementById('ow-board');
    let n = 0, proposed = 0;
    ROWS.forEach((row, ri) => {
      const sec = document.createElement('section');
      sec.className = 'ow-row';
      sec.innerHTML = `<div class="ow-row-head"><span class="ow-row-n">${ri + 1}</span>
        <h2 class="ow-row-title">${row.title}</h2><p class="ow-row-note">${row.note}</p></div><div class="ow-track"></div>`;
      const track = sec.querySelector('.ow-track');
      row.steps.forEach((s, si) => {
        n += 1; if (s.kind === 'proposed') proposed += 1;
        if (si > 0) track.insertAdjacentHTML('beforeend', arrow(s.via));
        const step = document.createElement('article');
        step.className = `ow-step${s.kind === 'proposed' ? ' is-proposed' : ''}`;
        step.innerHTML = `<div class="ow-step-top"><span class="ow-num">${String(n).padStart(2, '0')}</span>
          <span class="ow-tag ow-tag--${s.kind}">${s.kind === 'proposed' ? 'Proposed' : 'Real'}</span>${s.source ? `<span class="ow-src">${s.source}</span>` : ''}</div>`;
        const { el, screen } = T.phone({ size: 'md', theme: s.theme || 'light' });
        step.appendChild(el);
        if (s.ts) mountTS(screen, s); else screen.innerHTML = s.render();
        step.insertAdjacentHTML('beforeend', `<div class="ow-cap"><b>${s.name}</b><p>${s.note}</p></div>`);
        track.appendChild(step);
      });
      board.appendChild(sec);
    });
    document.getElementById('ow-count').textContent = `${n} screens · ${proposed} proposed`;
  }

  // ---------- interactions ----------
  function compare() {
    document.querySelectorAll('[data-cmp]').forEach((c) => {
      const set = (x) => c.style.setProperty('--x', `${T.clamp(x, 4, 96).toFixed(2)}%`);
      let drag = false, intro = null;
      const at = (e) => { const r = c.getBoundingClientRect(); set(((e.clientX - r.left) / r.width) * 100); };
      c.addEventListener('pointerdown', (e) => { drag = true; if (intro) { intro(); intro = null; } c.setPointerCapture(e.pointerId); at(e); });
      c.addEventListener('pointermove', (e) => { if (drag) at(e); });
      c.addEventListener('pointerup', () => { drag = false; });
      c.addEventListener('pointercancel', () => { drag = false; });
      if (T.reduced) return;
      // one calm sweep when first seen, so the board shows it is draggable
      const stop = T.inView(c, (inView) => {
        if (!inView) return; stop();
        const t0 = performance.now(), keys = [50, 22, 78, 50], seg = 1300;
        intro = T.onFrame((now) => {
          const t = (now - t0) / seg, i = Math.floor(t);
          if (i >= keys.length - 1) { set(50); if (intro) { intro(); intro = null; } return; }
          set(T.lerp(keys[i], keys[i + 1], T.ease.inout(t - i)));
        });
      });
    });
  }

  function buildLoop() {
    const bar = document.querySelector('[data-build] .is-run .a-progress > i'); if (!bar) return;
    const steps = [40, 55, 70, 85];
    let i = 0;
    if (T.reduced) return;
    const tick = () => { i = (i + 1) % steps.length; bar.style.width = `${steps[i]}%`; setTimeout(tick, i === steps.length - 1 ? 3200 : 1800); };
    setTimeout(tick, 1800);
  }

  function toggle() {
    const b = document.getElementById('ow-toggle');
    b.addEventListener('click', () => {
      const on = b.getAttribute('aria-pressed') !== 'true';
      b.setAttribute('aria-pressed', String(on));
      document.body.classList.toggle('ow-focus', on);
    });
  }

  // ---------- boot ----------
  render();
  T.init();
  T.fitPhones();
  if (window.lucide) lucide.createIcons({ attrs: { 'stroke-width': 1.8 } });
  compare();
  buildLoop();
  toggle();
  mounted.forEach((m) => { try { m && m.play && m.play(); } catch (e) { console.warn('[owner] play failed', e); } });
})();
