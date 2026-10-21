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
  const signup = () => app(`${SB()}
    <div class="ow-top">${back}</div>
    <div class="ow-main" style="top:126px;gap:14px">
      <h2 class="ow-h1 ow-h1--lg">Make your account</h2>
      <p class="ow-sub" style="margin-top:-6px">Two minutes. No card needed.</p>
      <div class="ow-fld" style="margin-top:10px"><span class="a-label">Your name</span>
        <div class="a-field is-focus">${I('user')}<b>Ben Reyes<span class="ow-caret"></span></b></div></div>
      <div class="ow-fld"><span class="a-label">Mobile number</span>
        <div class="a-field"><span class="ow-cc">+63</span><b>917 482 1063</b></div></div>
      <div class="ow-fld"><span class="a-label">Password</span>
        <div class="a-field">${I('lock')}<b style="letter-spacing:2px">••••••••••</b>${I('eye-off')}</div></div>
      <p class="ow-small" style="text-align:left;margin-top:2px">We'll text a code to this number to confirm it's you.</p>
    </div>
    <div class="ow-foot">
      <p class="ow-small">By continuing you agree to the <span class="ow-link">Terms</span> and <span class="ow-link">Privacy Policy</span></p>
      ${pill('Create account')}
      <p class="ow-small">Already have an account? <b>Log in</b></p>
    </div>`, { white: true });

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
      ${bubble('How do you want to do this?', 'Same site either way. You see it before you pay.')}
      <div class="ow-way is-on" style="margin-top:6px">
        <div class="ow-way-img"><img src="${A('assets/photos/forge/phone-headshot.jpg')}" alt=""></div>${tick}
        <div class="ow-way-t"><b>I'll do it on my phone</b><span class="ow-way-m">${I('clock')}About 20 min · talk, photos, pick a look</span></div>
      </div>
      <div class="ow-way">
        <div class="ow-way-img"><img src="${A('assets/people/15-carinderia.jpg')}" alt=""></div>
        <div class="ow-way-t"><b>Send someone to my shop</b><span class="ow-way-m">${I('clock')}About 30 min · a Tendso creator near you</span></div>
        <span class="ow-deal">${I('tag', 'ow-s14')}As low as ₱999 when a Tendso creator signs you up</span>
      </div>
    </div>
    <div class="ow-foot">${pill('Continue')}</div>`, { proposed: true });

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
    <div class="ow-main" style="top:120px;gap:12px">
      <div><h2 class="ow-h1">Same chair. Shot properly.</h2>
        <p class="ow-sub ow-gap4">We re-shot the light on 5 of your 6 photos. You choose.</p></div>
      <div class="ow-cmp" data-cmp>
        <img src="${A(pair.after)}" alt="The owner, re-shot">
        <div class="ow-cmp-before"><img src="${A(pair.before)}" alt="The original phone photo"></div>
        <span class="ow-cmp-tag ow-cmp-tag--l">Phone photo</span>
        <span class="ow-cmp-tag ow-cmp-tag--r">For your site</span>
        <div class="ow-cmp-line"><span class="ow-cmp-knob">${I('chevrons-left-right')}</span></div>
      </div>
      <div class="ow-thumbs">${thumbs.map((t) => `<span class="ow-thumb${t.on ? ' is-on' : ''}"><img src="${A(t.src)}" alt=""><span class="ow-thumb-b${t.up ? '' : ' ow-thumb-b--orig'}">${I(t.up ? 'check' : 'minus')}</span></span>`).join('')}</div>
    </div>
    <div class="ow-foot"><div class="ow-foot-row">${pill('Keep originals', 'ghost')}${pill('Use upgrades')}</div></div>`, { proposed: true });

  // ================= ROW 4 · DESIGN =================
  const mixing = () => app(`${SB()}
    <div class="ow-main" style="top:92px;gap:26px">
      <h2 class="ow-h1" style="text-align:center">Mixing your picks…<br>just for Forge</h2>
      <div class="ow-mix">
        <div class="ow-mc ow-mc--cozy"><img src="${A('assets/photos/forge/pro2-inside.jpg')}" alt=""><b>Walk in anytime</b></div>
        <div class="ow-mc ow-mc--bold"><img src="${A(kalan.hero)}" alt=""><span class="ow-mc-shade"></span><b>Sharp<br>cuts.</b></div>
        <div class="ow-mx">
          <div class="ow-mx-hero"><img src="${A(pair.after)}" alt="Preview of the mixed design"><span class="ow-mc-shade" style="background:rgba(12,10,8,.3)"></span><b>Sharp cuts.<br>No waiting.</b></div>
          <div class="ow-mx-in"><b>Forge</b><span>Fades · Scissor cuts · Shaves</span><i>Message us</i></div>
        </div>
      </div>
      <div class="a-card a-card--lg ow-mixcard">
        <div class="ow-ms">${okDot}<span>Big photo + headline from <b>Bold</b></span></div>
        <div class="ow-ms">${okDot}<span>Warm colours + fonts from <b>Cozy</b></span></div>
        <div class="ow-ms is-wait"><span class="ow-dot ow-dot--run"></span><span>Writing your pages…</span></div>
      </div>
    </div>`, { proposed: true });

  const stage = (state, label, meta, extra = '') => `<div class="ow-st is-${state}">${
    state === 'done' ? okDot : state === 'run' ? '<span class="ow-dot ow-dot--run"></span>' : '<span class="ow-dot ow-dot--wait"></span>'
  }<div class="ow-st-l">${label}${extra}</div><em>${meta}</em></div>`;
  const building = () => app(`${SB()}
    <div class="ow-main" style="top:84px;gap:12px">
      <h2 class="ow-h1 ow-h1--lg">We're building<br>Forge's site</h2>
      <p class="ow-sub" style="margin-top:-4px">Ready in about 30 minutes. We'll notify you.</p>
      <div class="a-card ow-stages" style="margin-top:8px" data-build>
        ${stage('done', 'Interview transcribed', 'Done')}
        ${stage('done', 'Photos upgraded', 'Done')}
        ${stage('run', 'Writing your pages', 'Now', '<span class="a-progress"><i style="width:40%"></i></span>')}
        ${stage('wait', 'Design and build', 'Next')}
        ${stage('wait', 'Review', 'Last')}
      </div>
      <div class="a-sec" style="margin-top:6px">What happens next</div>
      <div class="a-card ow-next">
        <div><span class="a-ic">${I('bell')}</span>We send you a notification</div>
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

  const siteEdit = () => app(`${SB()}${titleBar('Edit your site', `<span class="a-pill a-pill--ink" style="height:34px">${I('eye', 'ow-s14')}Preview</span>`)}
    <div class="ow-prev">
      <img src="${A('assets/sites/showcase/forge-m.jpg')}" alt="Forge site preview">
      <span class="ow-eb ow-eb--on" style="left:5%;top:37.5%;width:86%;height:47%"><span class="ow-eb-tag">${I('pencil')}Headline</span></span>
      <span class="ow-eb ow-eb--dash" style="left:5%;top:88%;width:88%;height:30%"></span>
    </div>
    <div class="ow-sheet">
      <div class="ow-grab"></div>
      <div class="ow-sheet-h">Headline<em>3 short lines work best</em></div>
      <div class="ow-ta">${TD.words.copy.join(' ')}<span class="ow-caret"></span></div>
      <div class="ow-src-q"><span class="a-ic">${I('mic')}</span><span>From your interview: <b>“We cook slow, the way my lola did.”</b></span></div>
      <div class="ow-foot-row">${pill('Cancel', 'ghost')}${pill('Save')}</div>
    </div>`, { proposed: true });

  const pay = () => app(`${SB()}${titleBar('Pay once', `<span class="a-back">${I('lock', 'ow-s16')}</span>`)}
    <div class="ow-main" style="top:118px;gap:10px">
      <div class="a-card ow-sum">
        <div class="ow-sum-top">
          <span class="ow-sum-thumb"><img src="${A('assets/sites/showcase/forge-m.jpg')}" alt=""></span>
          <span class="ow-sum-t"><b>${kalan.name} website</b><span>${kalan.url}</span><span>Live and approved by you</span></span>
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
          <div class="ow-stats"><div><b>214</b><span>visits this week</span></div><div><b>18</b><span>Messenger taps</span></div></div>
        </div>
        <span class="a-chip a-chip--muted ow-sample">Sample</span>
      </div>
      <div class="a-sec" style="margin-top:6px">Make it better</div>
      <div class="a-check is-done"><i class="c"></i><span>Publish your site</span></div>
      <div class="a-check"><i class="c"></i><span>Add your prices</span><em>2 min</em></div>
      <div class="a-check"><i class="c"></i><span>Share on Facebook</span><em>1 tap</em></div>
      <div class="a-check"><i class="c"></i><span>Get forgebarbers.com</span><em>Optional</em></div>
      <div class="a-sec" style="margin-top:6px">Your plan</div>
      <div class="a-card ow-next" style="padding:14px 16px">
        <div><span class="a-ic">${I('pencil')}</span><span style="flex:1">Edit your site</span>${I('chevron-right', 'ow-s16')}</div>
      </div>
    </div>
    <nav class="a-tabbar ow-tabs">${tab('house', 'Today', true)}${tab('smartphone', 'My site')}${tab('users', 'Agents')}${tab('circle-user', 'Me')}</nav>`, { proposed: true });

  const days = [['Today', '21'], ['Thu', '22', true], ['Fri', '23'], ['Sat', '24'], ['Mon', '26']];
  const slots = [['9:00 AM'], ['10:30 AM', 'on'], ['1:00 PM'], ['2:30 PM', 'off'], ['4:00 PM'], ['5:30 PM']];
  const book = () => app(`${SB()}${titleBar('Book a visit')}
    <div class="ow-main" style="top:118px;gap:12px">
      <div class="a-card ow-agent">${mikaFace}
        <span class="ow-agent-t"><b>${mika.name}</b><small>Tendso creator · ${mika.dist} away</small></span><span class="a-chip a-chip--ok">Free today</span></div>
      <h2 class="ow-h1" style="margin-top:8px">When should Mika come?</h2>
      <div class="ow-lbl">Day</div>
      <div class="ow-days">${days.map(([d, n, on]) => `<span class="ow-day${on ? ' is-on' : ''}"><small>${d}</small><b>${n}</b></span>`).join('')}</div>
      <div class="ow-lbl">Time</div>
      <div class="ow-slots">${slots.map(([t, s]) => `<span class="ow-slot${s ? ' is-' + s : ''}">${t}</span>`).join('')}</div>
      <div class="a-card ow-facts" style="margin-top:4px">
        <div class="ow-fact"><span class="a-ic">${I('clock')}</span><span><b>About 30 minutes</b> at your shop</span></div>
        <div class="ow-fact"><span class="a-ic">${I('tag')}</span><span><b>As low as ₱999</b> when a Tendso creator signs you up</span></div>
      </div>
    </div>
    <div class="ow-foot">${pill('Book Mika')}</div>`, { proposed: true });

  const booked = () => app(`${SB()}
    <div class="ow-main" style="top:104px;gap:12px">
      <div class="ow-center">
        <span class="ow-av-xl">${mikaFace}${okDot}</span>
        <h2 class="ow-h1 ow-h1--lg" style="margin-top:20px">Mika is coming by</h2>
        <p class="ow-sub ow-gap4">Thursday, 22 October · 10:30 AM</p>
      </div>
      <div class="a-card ow-kv" style="margin-top:12px">
        <div><span>Where</span><span>Forge, 12 J.P. Rizal St</span></div>
        <div><span>How long</span><span>About 30 minutes</span></div>
        <div><span>You pay</span><span>After you see it</span></div>
      </div>
      <div class="ow-wa"><span class="a-ic">${I('message-circle')}</span><span>She'll message you on WhatsApp before she leaves.</span></div>
    </div>
    <div class="ow-foot">${pill('Back to home')}${pill('Add to calendar', 'ghost')}</div>`, { proposed: true });

  // ---------- TendsoScreens slots ----------
  const placeholder = (name) => app(`${SB()}
    <div class="ow-ph"><span class="a-label">TendsoScreens · ${name}</span><b>Loads from<br>js/screens.js</b><p>Not available yet.</p></div>`);

  // ---------- board config ----------
  const ROWS = [
    { title: 'Start', note: 'Account, then three quick questions. One question per screen.', steps: [
      { ts: 'welcome', kind: 'real', name: 'Welcome', note: 'First launch (app/index.tsx). "I have a business" starts this flow.' },
      { render: signup, kind: 'real', name: 'Sign up', note: 'signup.tsx, cut to name, mobile and password.' },
      { render: q1, kind: 'real', name: 'What do you sell?', note: 'Business type from info.tsx, asked as one question with photo rows.' },
      { render: q2, kind: 'real', name: 'Name and place', note: 'Name and address from info.tsx, with a map pin to confirm.' },
      { render: q3, kind: 'proposed', name: 'How to do it', note: 'Do it on the phone, or have a Tendso creator come to the shop.' },
    ] },
    { title: 'Talk', note: 'Ten simple questions on camera, one at a time, then anything else. The app writes it down.', steps: [
      { ts: 'interview-list', kind: 'proposed', name: '10 questions', note: 'New. The ten questions up front, English and Tagalog, ticked as they are answered.', opts: { owner: true, step: 1 } },
      { ts: 'interview-cam', kind: 'proposed', name: 'Recording', note: 'New. The question sits low like a subtitle. Framing is checked once, then only a level stays. Next is the biggest button.', opts: { owner: true, video: 'assets/video/interview-2.mp4', type: 'barber' } },
      { render: interviewDone, kind: 'real', name: 'Got it', note: 'Finished state plus the transcript card from review.tsx.' },
    ] },
    { title: 'Photos', note: 'Ten photo tasks picked for the kind of shop, then any extras. Phone photos in, site photos out.', steps: [
      { ts: 'shot-list', kind: 'proposed', name: 'Photo tasks', note: 'New. Ten shots suggested for a barbershop, plus the owner\'s own photos.', opts: { type: 'barber', step: 2 } },
      { ts: 'shot-guide', kind: 'proposed', name: 'Guided camera', note: 'New. One task at a time, no outlines: a level bar, a hint, "Perfect, hold still", then the next.', opts: { type: 'barber' } },
      { render: photoUpgrade, kind: 'proposed', name: 'Photo upgrade', note: 'Same shop, re-shot. Drag to compare; keep originals if you like.' },
    ] },
    { title: 'Design', note: 'Pick what you like; we blend it and build.', steps: [
      { ts: 'design-picker', kind: 'proposed', name: 'Pick designs', note: 'Designs for barbershops. Pick one to three.' },
      { render: mixing, kind: 'proposed', name: 'Mixing', note: 'The picks blend into one look, said in plain words.' },
      { render: building, kind: 'proposed', name: 'Building', note: 'Real stages. Ready in about 30 minutes; the app notifies the owner.' },
    ] },
    { title: 'Live', note: 'We build it in about 20 minutes. Check it, ask for a change or say it looks good, pay once.', steps: [
      { render: notif, kind: 'proposed', name: 'Notification', note: 'Push on the lock screen opens the finished site.' },
      { ts: 'site-building', kind: 'proposed', name: 'We build it', note: 'New. About 20 minutes: reading the interview, writing, polishing the photos, building. Then Ask for a change or Looks good.', opts: { done: 2 } },
      { ts: 'site-building', kind: 'proposed', name: 'Ready to check', note: 'Ask for a change, or say it looks good.', opts: { review: true } },
      { ts: 'site-ready', kind: 'proposed', name: 'Site ready', note: 'The finished site, before paying.', via: 'about 20 minutes later' },
      { render: siteEdit, kind: 'proposed', name: 'Edit', note: 'Tap a block to change the words. The interview line it came from is shown.' },
      { render: pay, kind: 'proposed', name: 'Pay once', note: 'GCash, Maya or card. ₱4,999 once. Custom .com optional.' },
      { render: live, kind: 'proposed', name: 'Live', note: 'success.tsx structure: copy, share, and a QR for the counter.' },
    ] },
    { title: 'After', note: 'Owner home, and booking a Tendso creator.', steps: [
      { render: home, kind: 'proposed', name: 'Home', note: 'Live site, sample numbers, a short "make it better" list.' },
      { ts: 'agents-near', kind: 'proposed', name: 'Agents', note: 'From the Agents tab, or from "Send someone" at the start.', via: 'Agents tab' },
      { render: book, kind: 'proposed', name: 'Book a visit', note: 'Pick a day and a time. About 30 minutes at the shop.' },
      { render: booked, kind: 'proposed', name: 'Booked', note: 'Confirmation. Mika messages the owner on WhatsApp.' },
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
          <span class="ow-tag ow-tag--${s.kind}">${s.kind === 'proposed' ? 'Proposed' : 'Real'}</span>${s.ts ? '<span class="ow-src">screens.js</span>' : ''}</div>`;
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
