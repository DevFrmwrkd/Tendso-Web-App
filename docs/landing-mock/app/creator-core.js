/* Creator app · core flows board (agent C2b) — Round 2 language (APP-SYSTEM.md v3, kit v3 in css/app-kit.css).
   Each screen keeps the purpose, fields and copy meaning of its apps/mobile source, laid out the Round 2 way:
   one question per screen, pills, soft white cards, a map + finds feed as the field agent's home.
   Sample agent: Mika Santos, Marikina. Sample capture: Kalan (owner Teresita Bautista).
   Money (packages/shared/pricing.ts): the agent picks a price per sale, ₱999–₱4,999, keeps 50% (rounded), paid to Wise. */
(function () {
  'use strict';

  // ---------- helpers ----------
  const PH = '../assets/photos/';
  const PE = '../assets/people/';
  const MARK = '../assets/brand/mark-ink-256.png';
  const ic = (n, s = 18) => `<i data-lucide="${n}" width="${s}" height="${s}"></i>`;
  const app = (inner, cls = '') => `<div class="app cc-s ${cls}">${T.statusBar()}${inner}<div class="a-home"></div></div>`;
  const back = (icon = 'chevron-left') => `<span class="a-back">${ic(icon, 20)}</span>`;
  const step = (n, of) => `<div class="a-step">${back()}<div class="a-progress"><i style="width:${Math.round((n / of) * 100)}%"></i></div><b>${n} / ${of}</b></div>`;
  const bubble = (q, sub) => `<div class="a-bubble"><span class="a-bubble-mark"><img src="${MARK}" alt="Tendso"></span>
    <div class="a-bubble-text"><b>${q}</b>${sub ? `<span>${sub}</span>` : ''}</div></div>`;
  const door = (label, v = 'accent') => `<div class="door door--${v}">${label}</div>`;
  const fld = (label, val, o = {}) => `<div class="cc-field ${o.focus ? 'is-focus' : ''}">${o.icon ? ic(o.icon, 20) : ''}<div><small>${label}</small>
    <b class="${val ? '' : 'ph'}">${val || o.ph || ''}${o.focus ? '<i class="cc-caret"></i>' : ''}</b></div>${o.right || ''}</div>`;
  const tick = () => `<span class="a-tick">${ic('check', 14)}</span>`;
  const chk = (title, sub, state = '', right = '') => {
    const mark = state === 'is-done' || state === 'is-ok' ? ic('check', 13) : state === 'is-bad' ? ic('x', 13) : '';
    return `<div class="a-check ${state === 'is-ok' ? 'cc-ok' : state}"><i class="c">${mark}</i><div class="cc-ctext"><span>${title}</span>${sub ? `<small>${sub}</small>` : ''}</div>${right ? `<em>${right}</em>` : ''}</div>`;
  };

  // face crops from the people/owner photos: fx/fy = face centre (0..1), z = zoom, ar = image w/h
  const IMG = {
    mika: [PE + '17-mika.jpg', 0.51, 0.21, 3.6, 0.8],
    nena: [PE + '01-sarisari.jpg', 0.79, 0.41, 3.6, 0.8],
    jun: [PE + '06-agent.jpg', 0.53, 0.16, 4.2, 0.8],
    carlo: [PE + '10-scooter.jpg', 0.38, 0.24, 4.4, 1.49],
    bea: [PE + '12-salon.jpg', 0.68, 0.24, 4.0, 0.8],
    joy: [PE + '16-baguio.jpg', 0.66, 0.25, 4.0, 0.8],
    teresita: [PH + 'kalan-cook.jpg', 0.33, 0.16, 3.8, 0.8],
  };
  function face(who, size = 32, cls = '') {
    const [src, fx, fy, z, ar] = IMG[who];
    const H = z / ar;
    const px = Math.max(0, Math.min(100, ((fx * z - 0.5) / (z - 1)) * 100));
    const py = Math.max(0, Math.min(100, ((fy * H - 0.5) / (H - 1)) * 100));
    return `<span class="cc-face ${cls}" style="width:${size}px;height:${size}px;background-image:url('${src}');background-size:${z * 100}% auto;background-position:${px.toFixed(1)}% ${py.toFixed(1)}%"></span>`;
  }

  // shops (Filipino sample content; Live ones are TD.sites)
  const SITE = (id) => ((window.TD && TD.sites) || []).find((s) => s.id === id) || {};
  const SHOP = {
    nena: { name: "Aling Nena's Sari-Sari", short: "Aling Nena's", img: PE + '01-sarisari.jpg', pos: '78% 40%', dist: '350 m', by: 'jun', byName: 'Jun', when: '2d ago', kind: 'Sari-sari' },
    ramon: { name: 'Ka Ramon Vulcanizing', short: 'Ka Ramon', img: PE + '14-garage.jpg', pos: '30% 30%', dist: '600 m', by: 'carlo', byName: 'Carlo', when: '1d ago', kind: 'Repair' },
    lorna: { name: "Tita Lorna's Carinderia", short: "Tita Lorna's", img: PE + '15-carinderia.jpg', pos: '30% 40%', dist: '800 m', by: 'bea', byName: 'Bea', when: '3d ago', kind: 'Food' },
    ben: { name: "Kuya Ben's Barbershop", short: "Kuya Ben's", img: PE + '03-barber.jpg', pos: '40% 30%', dist: '1.1 km', by: 'joy', byName: 'Joy', when: '4d ago', kind: 'Beauty' },
    oca: { name: "Mang Oca's Panaderya", short: "Mang Oca's", img: PE + '02-panaderya.jpg', pos: '70% 30%', dist: '120 m', kind: 'Food' },
    kalan: { name: SITE('kalan').name || 'Kalan', short: 'Kalan', img: PH + 'kalan-hero.jpg', pos: '50% 50%', dist: '450 m', by: 'mika', byName: 'Mika', when: 'Live', kind: 'Food' },
    hela: { name: SITE('hela').name || 'Héla Hair Studio', short: 'Héla', img: PH + 'hela-hero.jpg', pos: '50% 30%', dist: '1.2 km', by: 'bea', byName: 'Bea', kind: 'Beauty' },
    domingo: { name: SITE('domingo').name || 'Domingo Hardware', short: 'Domingo', img: PH + 'domingo-aisle.jpg', pos: '50% 40%', dist: '2 km', by: 'mika', byName: 'Mika', kind: 'Repair' },
    vulca: { name: SITE('vulca').name || 'Vulca Garage', short: 'Vulca', img: PH + 'vulca-hero.jpg', pos: '50% 40%', dist: '1.6 km', by: 'carlo', byName: 'Carlo', kind: 'Repair' },
  };
  const shopImg = (k, st = '') => `<img src="${SHOP[k].img}" alt="${SHOP[k].name}" style="object-position:${SHOP[k].pos};${st}">`;

  // ---------- tab bar: Map · Finds · Submit · Earn · Me ----------
  function tabbar(on) {
    const t = (k, i, l) => `<div class="a-tab ${on === k ? 'is-on' : ''}">${ic(i, 22)}${l}</div>`;
    return `<div class="a-tabbar">${t('map', 'map', 'Map')}${t('finds', 'layout-grid', 'Finds')}
      <div class="a-tab a-tab--main">${ic('plus', 24)}Submit</div>${t('earn', 'wallet', 'Earn')}${t('me', 'user', 'Me')}</div>`;
  }

  // ---------- quiet vector street map (Marikina, no tiles) ----------
  function mapSVG() {
    const W = 390, h = 844;
    const minorV = [36, 96, 168, 226, 286, 340, 380];
    const minorH = [70, 132, 250, 318, 392, 470, 560, 640, 720, 800];
    let s = `<svg viewBox="0 0 ${W} ${h}" preserveAspectRatio="xMidYMid slice" aria-hidden="true">`;
    s += `<rect width="${W}" height="${h}" fill="#E9E9E3"/>`;
    s += `<path d="M262 380 h104 v70 h-104z" fill="#DCE3D3" rx="8"/>`;
    s += `<path d="M14 520 h70 v58 h-70z" fill="#DCE3D3"/>`;
    s += `<path d="M-20 ${h - 150} C 80 ${h - 190}, 160 ${h - 110}, 240 ${h - 140} S 360 ${h - 210}, 420 ${h - 190}" stroke="#D3DCE3" stroke-width="34" fill="none"/>`;
    s += '<g stroke="#FFFFFF" stroke-linecap="round" fill="none">';
    minorV.forEach((x, i) => { s += `<path d="M${x} -5 L${x + (i % 2 ? 8 : -6)} ${h + 5}" stroke-width="6"/>`; });
    minorH.forEach((y, i) => { s += `<path d="M-5 ${y} L${W + 5} ${y + (i % 2 ? -6 : 5)}" stroke-width="6"/>`; });
    s += `<path d="M128 -5 L120 ${h + 5}" stroke-width="13"/>`;
    s += `<path d="M-5 200 L${W + 5} 190" stroke-width="13"/>`;
    s += `<path d="M-5 40 L${W + 5} 420" stroke-width="10"/>`;
    s += '</g>';
    s += '<g font-family="Onest, sans-serif" font-size="9" font-weight="600" fill="#A3A29A">';
    s += '<text x="214" y="186">J.P. Rizal St</text>';
    s += '<text x="0" y="0" transform="translate(268 296) rotate(44)">Sumulong Hwy</text>';
    s += '<text x="0" y="0" transform="translate(133 640) rotate(-89)">Gil Fernando Ave</text>';
    s += `<text x="250" y="${h - 176}" fill="#97A6B3">Marikina River</text>`;
    s += '</g></svg>';
    return s;
  }
  const pin = (k, x, y, kind, label) => `<div class="cc-pin cc-pin--${kind}" style="left:${x}px;top:${y}px">${shopImg(k)}<div class="cc-pin-l">${label || SHOP[k].short}</div></div>`;
  const mapTop = () => `<div class="cc-mapbar">${face('mika', 46, 'cc-face--ring')}
      <div class="cc-float cc-money">₱7,500 <span>this month</span></div><div class="cc-grow"></div>
      <span class="cc-float cc-roundbtn">${ic('bell', 20)}<i class="dot"></i></span></div>
    <div class="cc-legend"><span class="a-pill is-on"><i class="cc-ring"></i>Needs a site · 14</span><span class="a-pill"><i class="cc-dotfill"></i>Yours · 6</span></div>`;

  // ======================= 1 · JOIN =======================
  function welcome() {
    const im = (src, l, t, w, h, z = 1, pos = '50% 50%') => `<img src="${src}" alt="" style="left:${l}px;top:${t}px;width:${w}px;height:${h}px;z-index:${z};object-position:${pos}">`;
    return app(`<div class="cc-collage">
        ${im(PE + '02-panaderya.jpg', -24, 60, 170, 214, 1, '70% 50%')}
        ${im(PH + 'hela-hero.jpg', 160, 58, 140, 150)}
        ${im(PE + '15-carinderia.jpg', 314, 74, 128, 172, 1, '30% 50%')}
        ${im(PE + '03-barber.jpg', 10, 292, 128, 136, 1, '40% 50%')}
        ${im(PH + 'kalan-hero.jpg', 152, 214, 168, 210, 2)}
        ${im(PE + '14-garage.jpg', 300, 262, 118, 160, 1, '30% 50%')}
      </div>
      <div class="cc-center" style="position:absolute;left:24px;right:24px;top:430px;gap:14px">
        <span class="a-bubble-mark" style="width:64px;height:64px"><img src="${MARK}" alt="Tendso" style="width:42px;height:42px"></span>
        <h2 class="cc-h cc-h--lg">Your shop online.<br>Pay once, own it.</h2>
        <p class="cc-sub">Or help shops near you get online, and earn for every site.</p>
      </div>
      <div class="cc-foot">${door('I have a business', 'ghost')}${door('I want to earn as a field agent')}
        <p class="cc-sm" style="text-align:center;font-size:13px">Already have an account? <span class="cc-link">Log in</span></p></div>`, 'is-white');
  }

  function qCity() {
    const cities = ['Marikina', 'Quezon City', 'Pasig', 'Manila', 'Antipolo', 'Makati', 'Taguig', 'Cebu City', 'Davao', 'Iloilo', 'Baguio'];
    return app(`<div class="cc-main">${step(2, 2)}
        <div style="padding-top:6px">${bubble('Where do you work?', 'We’ll show you shops near you first.')}</div>
        <div class="cc-chips" style="padding-top:4px">${cities.map((c) => `<span class="cc-chip ${c === 'Marikina' ? 'is-on' : ''}">${c === 'Marikina' ? `<i class="cc-chk">${ic('check', 12)}</i>` : ''}${c}</span>`).join('')}
          <span class="cc-chip cc-chip--ghost">${ic('plus', 16)}Other city</span></div>
        <div class="cc-card cc-row2" style="margin-top:2px">${ic('locate-fixed', 20)}<div class="cc-grow"><div class="cc-t" style="font-size:15px">Use my location</div><div class="cc-sm">Concepcion Uno, Marikina</div></div>${ic('chevron-right', 18)}</div>
      </div>
      <div class="cc-foot">${door('Continue')}</div>`);
  }

  function qHeard() {
    const opts = [
      ['users', 'A friend or another agent', true],
      ['facebook', 'Facebook'],
      ['music-2', 'TikTok'],
      ['globe', 'A shop’s Tendso site'],
      ['briefcase', 'A job post'],
    ];
    return app(`<div class="cc-main">${step(1, 2)}
        <div style="padding-top:6px">${bubble('How did you hear about us?', 'Just so we know who to thank.')}</div>
        <div class="cc-col" style="gap:10px">${opts.map(([i, t, on]) => `<div class="a-opt ${on ? 'is-on' : ''}"><span class="cc-ic">${ic(i, 20)}</span><span class="cc-grow">${t}</span>${on ? tick() : ''}</div>`).join('')}</div>
        ${fld('Who sent you? (optional)', 'Joy Dizon · JOYD4K2', { icon: 'gift' })}
      </div>
      <div class="cc-foot">${door('Continue')}</div>`);
  }

  function profile() {
    return app(`<div class="cc-main" style="gap:16px">${step(3, 3)}
        <div><h2 class="cc-h">Your agent profile</h2><p class="cc-sub" style="margin-top:6px">Shops see this when you visit.</p></div>
        <div class="cc-center" style="gap:8px;padding:2px 0 4px"><div style="position:relative">${face('mika', 104, 'cc-face--ring')}
          <span class="cc-ic cc-ic--round cc-ic--ink" style="position:absolute;right:-4px;bottom:0;width:36px;height:36px;box-shadow:0 0 0 3px var(--a-bg)">${ic('camera', 17)}</span></div>
          <span class="cc-sm" style="color:var(--a-ink);font-size:13px">Change photo</span></div>
        ${fld('Full name', 'Mika Santos', { icon: 'user' })}
        ${fld('Mobile', '+63 917 555 0142', { icon: 'phone' })}
        <div>${fld('Wise email for payouts', 'mika.santos@gmail', { icon: 'mail', focus: true })}
          <p class="cc-help">We send your earnings here through Wise. No Wise yet? You can add it later.</p></div>
      </div>
      <div class="cc-foot">${door('Send for review')}</div>`);
  }

  function pending() {
    return app(`<div class="cc-main" style="gap:20px">
        <div class="cc-between" style="height:44px"><span></span><span class="a-pill" style="background:#fff;box-shadow:var(--a-shadow)">${ic('log-out', 15)}Sign out</span></div>
        <div class="cc-center" style="gap:14px">
          <div style="position:relative">${face('mika', 112, 'cc-face--ring')}
            <span class="cc-ic cc-ic--round cc-ic--accent" style="position:absolute;right:-6px;bottom:2px;width:40px;height:40px;box-shadow:inset 0 0 0 2px var(--a-ink),0 0 0 3px var(--a-bg)">${ic('hourglass', 19)}</span></div>
          <h2 class="cc-h">We’re checking<br>your details</h2>
          <p class="cc-sub" style="padding:0 10px">Hi Mika. Someone from the team looks at every new agent. It takes less than a day.</p>
        </div>
        <div class="cc-col" style="gap:8px">
          ${chk('Profile sent', 'Just now', 'is-done')}
          ${chk('Team checks your photo and number', 'Usually within 24 hours', 'is-now', 'Now')}
          ${chk('Training and a short quiz', '5 lessons · 15 minutes')}
          ${chk('Start finding shops', 'Your map opens')}
        </div>
      </div>
      <div class="cc-foot"><div class="cc-card cc-card--flat cc-row2" style="border-radius:18px;padding:12px 14px">${ic('bell', 18)}<p class="cc-sm" style="color:var(--a-ink2);font-size:13px;line-height:18px">You can close the app. We’ll send a notification when you’re in.</p></div></div>`);
  }

  function rejected() {
    return app(`<div class="cc-main" style="gap:18px">
        <div class="cc-between" style="height:44px"><span></span><span class="a-pill" style="background:#fff;box-shadow:var(--a-shadow)">${ic('log-out', 15)}Sign out</span></div>
        <div><h2 class="cc-h">Almost there, Mika</h2><p class="cc-sub" style="margin-top:6px">We couldn’t approve your profile yet. One thing to fix:</p></div>
        <div class="cc-card" style="padding:14px;display:flex;gap:14px;align-items:center">
          <div style="position:relative">${face('mika', 64)}<span class="cc-ic cc-ic--round" style="position:absolute;right:-4px;bottom:-2px;width:26px;height:26px;background:var(--a-danger);color:#fff;box-shadow:0 0 0 2px #fff">${ic('x', 14)}</span></div>
          <div class="cc-grow"><div class="cc-t" style="font-size:15px">Your face isn’t clear in the photo</div>
            <p class="cc-sm" style="margin-top:3px;font-weight:500;color:var(--a-ink2);font-size:13px;line-height:18px">Take a new one facing a window, without sunglasses. Reviewed 3h ago.</p></div>
        </div>
        <div class="cc-col" style="gap:8px">
          ${chk('Full name', 'Mika Santos', 'is-ok')}
          ${chk('Mobile', '+63 917 555 0142', 'is-ok')}
          ${chk('Wise email', 'mika.santos@gmail.com', 'is-ok')}
          ${chk('Profile photo', 'Needs a new photo', 'is-bad', 'Fix')}
        </div>
      </div>
      <div class="cc-foot">${door('Fix and resend')}${door('Ask the team', 'ghost')}</div>`);
  }

  // ======================= 2 · LEARN =======================
  function lessons() {
    return app(`<div class="cc-main" style="gap:16px">
        <div class="cc-row2" style="height:44px">${back()}<span class="cc-t" style="font-size:17px">Training</span></div>
        <div class="cc-card" style="padding:0;overflow:hidden">
          <div style="height:128px;position:relative"><img src="${PE}11-workshop.jpg" alt="Field agent training" style="width:100%;height:100%;object-fit:cover;object-position:50% 40%;display:block"></div>
          <div style="padding:14px 16px 16px">
            <div class="cc-between"><span class="cc-t">Become a certified agent</span><span class="cc-t" style="font-size:14px">3 of 5</span></div>
            <div class="a-progress" style="margin-top:10px"><i style="width:60%"></i></div>
            <p class="cc-sm" style="margin-top:8px">Then a 5-question quiz. Pass with 4.</p>
          </div>
        </div>
        <div class="cc-col" style="gap:8px">
          ${chk('Light the shop', '3 min', 'is-done')}
          ${chk('Clear audio', '2 min', 'is-done')}
          ${chk('Photos that sell', '4 min', 'is-done')}
          ${chk('Get the owner talking', '3 min · next', 'is-now', ic('chevron-right', 18))}
          ${chk('The shots we need', '3 min')}
        </div>
      </div>
      <div class="cc-foot">${door('Continue lesson 4')}</div>`);
  }

  function lesson() {
    const tips = [
      ['smile', 'Start easy: “How did you start the shop?”'],
      ['hash', 'Ask for real things: prices, years, best sellers.'],
      ['ear', 'Let them talk. Don’t fill the pauses.'],
      ['map-pin', 'End with hours, address and a landmark.'],
    ];
    return app(`<div class="cc-main" style="gap:16px">${step(4, 5)}
        <div style="height:190px;border-radius:24px;overflow:hidden;flex:none"><img src="${PE}09-cafe.jpg" alt="An agent interviews a café owner" style="width:100%;height:100%;object-fit:cover;object-position:50% 30%;display:block"></div>
        <div><span class="cc-sm">Lesson 4 · 3 min</span><h2 class="cc-h" style="margin-top:4px">Get the owner talking</h2>
          <p class="cc-sub" style="margin-top:6px;color:var(--a-ink2)">Their own words become the site. The best lines come after a pause.</p></div>
        <div class="cc-col" style="gap:8px">${tips.map(([i, t]) => `<div class="a-check"><span class="cc-ic" style="width:36px;height:36px;border-radius:12px">${ic(i, 17)}</span><span style="font-size:14.5px;line-height:19px">${t}</span></div>`).join('')}</div>
      </div>
      <div class="cc-foot">${door('Got it · next lesson')}</div>`);
  }

  function quiz() {
    const opts = [
      ['A', 'Start recording right away'],
      ['B', 'Record a 10-second test and play it back', true],
      ['C', 'Ask the owner to speak loudly'],
      ['D', 'Move outside for natural sound'],
    ];
    return app(`<div class="cc-main">${step(2, 5)}
        <div style="padding-top:6px">${bubble('Before the real interview, what do you always do first?', 'Question 2 of 5 · Audio')}</div>
        <div class="cc-col" style="gap:10px;padding-top:2px">${opts.map(([l, t, on]) => `<div class="a-opt ${on ? 'is-on' : ''}"><span class="cc-letter">${l}</span><span class="cc-grow" style="font-size:15px;line-height:20px">${t}</span>${on ? tick() : ''}</div>`).join('')}</div>
        <p class="cc-sm" style="text-align:center">Pass with 4 of 5. You can retake it.</p>
      </div>
      <div class="cc-foot">${door('Next question')}</div>`);
  }

  // ======================= 3 · FIND SHOPS =======================
  function mapHome() {
    const card = (k, tag, live) => `<div class="cc-scard"><div class="ph">${shopImg(k)}<span class="cc-tag ${live ? 'cc-tag--live' : ''}">${tag}</span></div>
      <div class="cc-t cc-ellip">${SHOP[k].name}</div><div class="cc-sm">${SHOP[k].dist} · ${live ? 'Yours' : 'No website yet'}</div></div>`;
    return app(`<div class="cc-map">${mapSVG()}
        ${pin('ramon', 70, 196, 'need')}${pin('kalan', 292, 176, 'yours')}${pin('lorna', 64, 360, 'need')}
        ${pin('nena', 190, 290, 'need')}${pin('ben', 318, 318, 'need')}${pin('hela', 250, 430, 'yours')}
        <i class="cc-me" style="left:168px;top:410px"></i>
      </div>
      ${mapTop()}
      <div class="cc-sheet" style="top:518px;bottom:0">
        <div class="cc-grab"></div>
        <div class="cc-between" style="padding:12px 20px 12px"><span class="cc-t" style="font-size:17px">Shops near you</span><span class="cc-sm" style="font-size:13px;color:var(--a-ink)">See list</span></div>
        <div class="cc-cards">${card('nena', 'Needs a site')}${card('ramon', 'Needs a site')}${card('kalan', 'Live', true)}</div>
      </div>
      ${tabbar('map')}`);
  }

  function shopSheet() {
    return app(`<div class="cc-map">${mapSVG()}
        ${pin('ramon', 64, 172, 'need')}${pin('kalan', 306, 172, 'yours')}${pin('lorna', 60, 306, 'need')}${pin('ben', 322, 276, 'need')}
        ${pin('nena', 194, 228, 'sel', 'Aling Nena’s · 350 m')}
        <i class="cc-me" style="left:150px;top:350px"></i>
      </div>
      ${mapTop()}
      <div class="cc-sheet" style="top:398px;bottom:0;padding:0 16px">
        <div class="cc-grab"></div>
        <div style="display:flex;gap:14px;padding-top:14px">
          <div style="position:relative;width:118px;height:156px;border-radius:20px;overflow:hidden;flex:none">${shopImg('nena', 'width:100%;height:100%;object-fit:cover')}<span class="cc-tag">Needs a site</span></div>
          <div class="cc-col cc-grow" style="gap:7px;padding-top:2px">
            <div class="cc-h cc-h--sm">Aling Nena’s Sari-Sari</div>
            <div class="cc-sm" style="font-size:13px">350 m · No website yet</div>
            <div class="cc-row2 cc-sm" style="gap:7px;font-size:13px">${face('jun', 22)}Spotted by Jun · 2d ago</div>
            <div class="cc-row2 cc-sm" style="gap:7px;font-size:13px">${ic('clock', 15)}Open now · till 10 pm</div>
          </div>
        </div>
        <div class="cc-card cc-row2" style="margin-top:14px;padding:12px 14px;gap:12px">
          <span class="cc-ic cc-ic--round" style="width:40px;height:40px">${ic('coins', 19)}</span>
          <div class="cc-grow"><div class="cc-t">Earn up to ₱2,500</div><div class="cc-sm" style="margin-top:2px">You set the price, ₱999–₱4,999. You keep half.</div></div>
        </div>
        <div class="cc-row2" style="margin-top:14px;gap:8px">
          <div class="door door--accent" style="flex:1">I’m visiting</div>
          <div class="door door--ghost" style="width:auto;padding-left:22px;padding-right:22px;display:flex;gap:6px">Route</div>
        </div>
      </div>
      `);
  }

  function finds() {
    const item = (k, h, live) => `<div class="cc-item"><div class="pic" style="height:${h}px">${shopImg(k)}<span class="cc-tag ${live ? 'cc-tag--live' : ''}">${live ? 'Live' : 'Needs a site'}</span></div>
      <div class="cc-t">${SHOP[k].name}</div><div class="cc-by">${face(SHOP[k].by, 20)}${SHOP[k].byName} · ${SHOP[k].dist}</div></div>`;
    const pills = ['Near me', 'Needs a site', 'Food', 'Beauty', 'Repair'];
    return app(`<div class="cc-main" style="gap:14px;padding:6px 0 0">
        <div style="padding:0 20px"><h2 class="cc-h">Community finds</h2><p class="cc-sub" style="margin-top:4px;font-size:14px">142 shops spotted by agents this week</p></div>
        <div class="cc-pills" style="padding:0 20px">${pills.map((p, i) => `<span class="a-pill ${i === 0 ? 'is-on' : ''}">${p}</span>`).join('')}</div>
        <div class="cc-masonry" style="padding:0 16px">
          <div>${item('nena', 214)}${item('hela', 170, true)}${item('domingo', 190, true)}</div>
          <div>${item('ramon', 160)}${item('lorna', 222)}${item('kalan', 170, true)}</div>
        </div>
      </div>
      <div class="cc-fab">${ic('camera', 20)}Spot a shop</div>
      ${tabbar('finds')}`);
  }

  function spot() {
    const kinds = ['Food', 'Sari-sari', 'Beauty', 'Repair', 'Other'];
    return app(`<div class="cc-main" style="gap:14px">
        <div class="cc-row2" style="height:44px">${back('x')}<span class="cc-t" style="font-size:17px">Spot a shop</span></div>
        <div style="position:relative;height:200px;border-radius:24px;overflow:hidden;flex:none">${shopImg('oca', 'width:100%;height:100%;object-fit:cover')}
          <span class="cc-tag cc-tag--ink" style="left:auto;right:10px;top:auto;bottom:10px;display:flex;gap:5px;align-items:center">${ic('rotate-ccw', 12)}Retake</span></div>
        ${fld('Shop name', 'Mang Oca’s Panaderya', { icon: 'store', focus: true })}
        <div class="cc-chips">${kinds.map((k, i) => `<span class="cc-chip cc-chip--sm ${i === 0 ? 'is-on' : ''}">${i === 0 ? `<i class="cc-chk">${ic('check', 11)}</i>` : ''}${k}</span>`).join('')}</div>
        <div class="a-opt is-on" style="padding:12px 14px"><span class="cc-ic" style="width:40px;height:40px">${ic('globe', 19)}</span><div class="cc-grow"><div style="font-size:15px">Needs a site</div><div class="cc-sm" style="font-weight:500">No website, only a Facebook page</div></div>${tick()}</div>
        <div class="cc-row2 cc-sm" style="font-size:13px;padding:0 4px">${ic('map-pin', 16)}J.P. Rizal St, Concepcion Uno · pinned here</div>
      </div>
      <div class="cc-foot">${door('Save find')}</div>`);
  }

  function leadDetail() {
    const st = ['New', 'Contacted', 'Visiting', 'Live'];
    return app(`<div class="cc-main" style="gap:14px">
        <div class="cc-between" style="height:44px">${back()}<span class="cc-float cc-roundbtn" style="box-shadow:var(--a-shadow)">${ic('ellipsis', 20)}</span></div>
        <div style="position:relative;height:196px;border-radius:24px;overflow:hidden;flex:none">${shopImg('nena', 'width:100%;height:100%;object-fit:cover;object-position:60% 35%')}<span class="cc-tag">Needs a site</span></div>
        <div><h2 class="cc-h cc-h--sm">Aling Nena’s Sari-Sari</h2><p class="cc-sm" style="margin-top:4px;font-size:13px">350 m · J.P. Rizal St, Concepcion Uno, Marikina</p></div>
        <div class="cc-card cc-row2" style="gap:12px">${face('nena', 46)}
          <div class="cc-grow"><div class="cc-t" style="font-size:15px">Nena Cruz</div><div class="cc-sm" style="margin-top:2px;font-size:13px">Owner · 0917 482 1190</div></div>
          <span class="cc-ic cc-ic--round" style="width:40px;height:40px">${ic('message-circle', 18)}</span><span class="cc-ic cc-ic--round cc-ic--ink" style="width:40px;height:40px">${ic('phone', 18)}</span>
        </div>
        <div class="cc-card">
          <div class="cc-between"><span class="cc-sm">Notes</span><span class="cc-row2 cc-xs" style="gap:5px">${face('jun', 18)}Jun · 2d ago</span></div>
          <p style="font:500 14px/20px var(--a-sans);color:var(--a-ink2);margin-top:6px">Open 6 am to 10 pm. Busy after lunch. Her daughter runs the Facebook page. Best time: Thursday morning.</p>
        </div>
        <div><div class="cc-sm" style="margin:0 2px 8px">Status</div>
          <div class="cc-pills">${st.map((s) => `<span class="a-pill ${s === 'Visiting' ? 'is-on' : ''}" style="${s === 'Visiting' ? '' : 'background:#fff;box-shadow:var(--a-shadow)'}">${s}</span>`).join('')}</div></div>
      </div>
      <div class="cc-foot">${door('Start the capture')}</div>`);
  }

  // ======================= 4 · CAPTURE =======================
  function info() {
    const types = ['Restaurant', 'Barber/Salon', 'Auto Shop', 'Spa/Massage', 'Other'];
    return app(`<div class="cc-main" style="gap:14px">${step(1, 4)}
        <div><h2 class="cc-h">About the shop</h2><p class="cc-sub" style="margin-top:6px">The basics first. Photos and the interview come next.</p></div>
        ${fld('Business name', 'Kalan', { icon: 'store' })}
        <div class="cc-chips">${types.map((t) => `<span class="cc-chip cc-chip--sm ${t === 'Restaurant' ? 'is-on' : ''}">${t === 'Restaurant' ? `<i class="cc-chk">${ic('check', 11)}</i>` : ''}${t}</span>`).join('')}</div>
        ${fld('Owner’s full name', 'Teresita Bautista', { icon: 'user', focus: true })}
        ${fld('Owner’s mobile', '+63 917 555 0199', { icon: 'phone' })}
        ${fld('Address', 'Gil Fernando Ave, Marikina', { icon: 'map-pin', right: `<span class="cc-sm" style="color:var(--a-ink)">Map</span>` })}
      </div>
      <div class="cc-foot">${door('Continue to photos')}</div>`);
  }

  function review() {
    const shots = ['kalan-hero', 'kalan-cook', 'kalan-pandesal', 'after-kalan', 'after-kalan-alt'];
    return app(`<div class="cc-main" style="gap:11px">${step(4, 4)}
        <h2 class="cc-h cc-h--sm" style="margin:0 2px">Check it, then send</h2>
        <div class="cc-card cc-row2" style="gap:12px;padding:10px 14px 10px 10px">
          <img src="${PH}kalan-hero.jpg" alt="" style="width:52px;height:52px;border-radius:14px;object-fit:cover">
          <div class="cc-grow"><div class="cc-t" style="font-size:15px">Kalan · Restaurant</div><div class="cc-sm">Teresita Bautista · Marikina</div></div><span class="cc-sm" style="color:var(--a-ink)">Edit</span></div>
        <div class="cc-card" style="padding:10px">
          <div class="cc-between" style="padding:0 4px 8px"><span class="cc-sm">5 photos</span><span class="cc-sm" style="color:var(--a-ink)">Edit</span></div>
          <div class="cc-strip">${shots.map((s) => `<span><img src="${PH}${s}.jpg" alt=""></span>`).join('')}</div></div>
        <div class="cc-card" style="padding:12px 14px">
          <div class="cc-between"><span class="cc-row2 cc-sm" style="gap:6px">${ic('video', 14)}Interview · 4:12</span><span class="cc-sm" style="color:var(--a-ink)">Play</span></div>
          <p class="cc-quote" style="margin-top:6px">“We cook slow, the way my lola did. Tapa, garlic rice, barako in the pot.”</p></div>
        <div class="cc-card cc-row2" style="gap:10px;padding:11px 14px">${ic('globe', 18)}<div class="cc-grow"><div class="cc-t" style="font-size:14px">kalan.tendso.site</div><div class="cc-xs">Free address · custom domain optional</div></div><span class="cc-sm" style="color:var(--a-ink)">Add</span></div>
        <div class="cc-card" style="padding:12px 14px">
          <div class="cc-between"><span class="cc-t">Your price</span><span class="cc-sm">Lower price = easier yes</span></div>
          <div class="cc-between" style="margin-top:6px"><span class="cc-h cc-h--sm" style="font-size:24px">₱4,999</span></div>
          <div class="cc-slider"><i class="tr"></i><i class="fl" style="width:100%"></i><i class="th" style="left:100%"></i></div>
          <div class="cc-between cc-xs"><span>₱999</span><span>₱4,999</span></div>
          <div class="cc-row2" style="gap:8px;margin-top:8px"><div class="cc-stat cc-grow" style="background:var(--a-accent-soft)"><b>₱2,500</b><span>you keep</span></div><div class="cc-stat cc-grow" style="background:var(--a-bg2)"><b>₱0</b><span>the shop saves</span></div></div>
        </div>
      </div>
      <div class="cc-foot">${door('Send for review')}</div>`);
  }

  function sent() {
    return app(`<div class="cc-main" style="gap:20px">
        <div style="height:44px"></div>
        <div class="cc-center" style="gap:14px">
          <span class="cc-bigcheck">${ic('check', 46)}</span>
          <h2 class="cc-h cc-h--lg">Sent! We’ll build<br>Kalan’s site.</h2>
          <p class="cc-sub">Ready in about 30 minutes. We’ll tell you and Teresita.</p>
        </div>
        <div class="a-sec">What happens next</div>
        <div class="cc-col" style="gap:8px;margin-top:-10px">
          ${chk('Sent for review', 'Just now', 'is-done')}
          ${chk('We build the site', 'From her words and your photos', 'is-now')}
          ${chk('Teresita sees it live', 'She sees it first, then pays once')}
          ${chk('You get ₱2,500', 'Paid to your Wise')}
        </div>
      </div>
      <div class="cc-foot">${door('Back to the map')}${door('Spot another shop', 'ghost')}</div>`);
  }

  // ======================= 5 · HOME EXTRAS =======================
  function notifications() {
    const row = (lead, title, body, when, unread, old) => `<div class="cc-ntf ${old ? 'is-old' : ''}">${lead}
      <div class="cc-grow"><div class="cc-between" style="align-items:flex-start"><span class="cc-t">${title}</span><span class="when">${unread ? '<i class="cc-unread"></i>' : ''}${when}</span></div><p>${body}</p></div></div>`;
    const thumb = (src, pos = '50% 50%') => `<img src="${src}" alt="" style="object-position:${pos}">`;
    const ici = (i, cls = '') => `<span class="cc-ic ${cls}">${ic(i, 20)}</span>`;
    return app(`<div class="cc-main" style="gap:12px">
        <div class="cc-between" style="height:44px">${back()}<span class="cc-sm" style="color:var(--a-ink);font-size:13px">Mark all read</span></div>
        <h2 class="cc-h" style="margin:0 2px">Notifications</h2>
        <div class="a-sec" style="text-align:left;padding:0 4px">Today</div>
        ${row(thumb(PH + 'kalan-hero.jpg'), 'Kalan is live', 'Teresita can see her site now. You’re paid when she pays.', '12m', true)}
        ${row(ici('coins', 'cc-ic--accent'), 'You earned ₱2,500', 'Vulca Garage paid ₱4,999. On its way to your Wise.', '3h', true)}
        ${row(thumb(SHOP.ramon.img, SHOP.ramon.pos), 'New find 600 m away', 'Carlo spotted Ka Ramon Vulcanizing. No website yet.', '5h', true)}
        <div class="a-sec" style="text-align:left;padding:4px 4px 0">This week</div>
        ${row(ici('triangle-alert', 'cc-ic--warn'), 'Labaná Laundry needs a fix', 'Photos are too dark. Retake 3 photos and resend.', '2d', false, true)}
        ${row(ici('banknote'), 'Paid to Wise', '₱4,500 sent to mika.santos@gmail.com.', '3d', false, true)}
        ${row(ici('badge-check'), 'You’re approved', 'Welcome, Mika. Your map is open.', '6d', false, true)}
      </div>`);
  }

  // ---------- shared screens (agent A's window.TendsoScreens) ----------
  function shared(name, fallback, opts = {}) {
    return (screen) => {
      if (window.TendsoScreens && typeof window.TendsoScreens.mount === 'function') {
        try {
          const h = window.TendsoScreens.mount(screen, name, opts);
          if (h && typeof h.play === 'function' && !T.reduced) h.play();
          return;
        } catch (e) { console.warn('TendsoScreens.mount failed for', name, e); }
      }
      screen.innerHTML = fallback();
    };
  }
  // local fallbacks in the same language, used only if TendsoScreens is missing
  function photosLocal() {
    const shots = ['kalan-hero', 'kalan-cook', 'kalan-pandesal', 'after-kalan', 'after-kalan-alt'];
    return app(`<div class="cc-main">${step(2, 4)}
        <div><h2 class="cc-h">Show us the shop</h2><p class="cc-sub" style="margin-top:6px">Three to ten photos: front, inside, food, the owner.</p></div>
        <div class="cc-strip" style="grid-template-columns:repeat(3,1fr);gap:8px">${shots.map((s) => `<span><img src="${PH}${s}.jpg" alt=""></span>`).join('')}<span class="cc-card cc-center" style="justify-content:center;box-shadow:none;background:var(--a-bg2)">${ic('camera', 22)}</span></div>
      </div><div class="cc-foot">${door('Continue to interview')}</div>`);
  }
  function interviewRecLocal() {
    return app(`<div class="cc-main">${step(3, 4)}<h2 class="cc-h">Talk to the owner.</h2>
        <div class="cc-card cc-center" style="gap:6px;padding:24px"><span class="cc-h cc-h--lg">2:47</span><span class="cc-sm">Recording</span></div>
        ${bubble('What’s the name of your shop, where are you, and what do you do?', 'Question 1 of 5')}
      </div>`);
  }

  // ---------- board ----------
  const P = 'apps/mobile/app/(app)/';
  const NEW = 'new';
  const ROWS = [
    { n: '01', title: 'Join', note: 'Choose, two questions, profile, review', steps: [
      ['1.1', P + 'account-setup.tsx', 'Welcome choice. The field-agent pill is the creator account type; the business path goes to the owner app.', welcome],
      ['1.2', P + 'agent-onboarding.tsx · discovery', 'Step 1 of 2. Save how they heard about Tendso and enter an optional referral code here once. Existing link attribution stays attached.', qHeard],
      ['1.3', P + 'agent-onboarding.tsx · city', 'Step 2 of 2. City chips or optional GPS set the work area the map shows first. Saved for new field agents.', qCity],
      ['1.4', P + 'complete-profile.tsx', 'Photo, name, mobile and the Wise email we pay to. Step 3 of 3.', profile],
      ['1.5', P + 'pending-review.tsx', 'A person checks every new agent within 24 hours. Sign out is the only exit.', pending],
      ['1.6', P + 'verification-rejected.tsx', 'Kind and specific: what to fix, then one accent action to resend.', rejected],
    ] },
    { n: '02', title: 'Learn', note: 'Five lessons, then the quiz', steps: [
      ['2.1', P + 'training.tsx + training-lessons.tsx', 'Lessons as a checklist with progress, 3 of 5 done. The next lesson is outlined.', lessons],
      ['2.2', P + 'training-lessons.tsx · open', 'One short lesson: a photo, one line, four tips.', lesson],
      ['2.3', P + 'certification-quiz.tsx', 'Tendso asks one question; answer B is picked. Pass with 4 of 5.', quiz],
    ] },
    { n: '03', title: 'Find shops', note: 'The map and the finds feed are home', steps: [
      ['3.1', P + 'leads/nearby.tsx + leads/discover.tsx', 'Home. Dashed ring = needs a site, accent ring = yours. This month’s earnings sit on the map.', mapHome],
      ['3.2', P + 'leads/discover.tsx · selected', 'Tap a pin: who spotted it, what it can earn, then I’m visiting or Route.', shopSheet],
      ['3.3', P + 'leads/index.tsx', 'Every shop the team has spotted, as photos. Spot a shop is always one tap away.', finds],
      ['3.4', NEW, 'Spot a shop in ten seconds: photo, name, kind, needs a site.', spot],
      ['3.5', P + 'leads/[leadId].tsx', 'One lead: owner, phone, notes, and the status New → Contacted → Visiting → Live.', leadDetail],
    ] },
    { n: '04', title: 'Capture', note: 'Info, 10 photo tasks, 10 questions on camera, review, sent', steps: [
      ['4.1', P + 'submit/info.tsx', 'Step 1 of 4: business, type, owner, mobile, address.', info],
      ['4.2', NEW, 'Replaces photos.tsx. Ten photo tasks suggested for the kind of shop (here a barbershop), then the owner’s own extras.', shared('shot-list', photosLocal, { type: 'barber', step: 2 })],
      ['4.3', NEW, 'Guided camera: one task at a time a faint outline while it checks the shot, then only a level; the ten tasks as a strip.', shared('shot-guide', photosLocal, { type: 'barber' })],
      ['4.4', NEW, 'Replaces the interview intro. Ten super-simple questions, English and Tagalog, plus “anything else”.', shared('interview-list', interviewRecLocal, { step: 3 })],
      ['4.5', NEW, 'Replaces the recording screen. The question sits low like a subtitle; framing is checked once, then only a level stays; Next is the biggest button.', shared('interview-cam', interviewRecLocal, { video: 'assets/video/interview-2.mp4', poster: 'assets/video/interview-2.jpg', type: 'barber' })],
      ['4.6', P + 'submit/review.tsx', 'Everything on one screen. The agent sets the price, ₱999–₱4,999, and keeps half.', review],
      ['4.7', P + 'submit/success.tsx', 'Sent; what happens next, ending with the payout.', sent],
    ] },
    { n: '05', title: 'Home extras', note: 'Notifications', steps: [
      ['5.1', P + 'notifications.tsx', 'Unread on white cards with an ink dot; older ones sit flat.', notifications],
    ] },
  ];

  const ARROW = '<svg viewBox="0 0 30 10" fill="none" stroke="currentColor" stroke-width="1.2"><path d="M0 5h28M24 1l4 4-4 4"/></svg>';

  function build() {
    const board = document.getElementById('cc-board');
    ROWS.forEach((r) => {
      const row = document.createElement('section');
      row.className = 'cc-row';
      row.innerHTML = `<div class="cc-row-label"><b>${r.n}</b><b>${r.title}</b><span>${r.note}</span><span>${r.steps.length} screen${r.steps.length > 1 ? 's' : ''}</span></div><div class="cc-track"></div>`;
      const track = row.querySelector('.cc-track');
      r.steps.forEach(([num, src, note, render], i) => {
        if (i) { const a = document.createElement('div'); a.className = 'cc-arrow'; a.innerHTML = ARROW; track.appendChild(a); }
        const fig = document.createElement('figure');
        fig.className = 'cc-step';
        const isNew = src === NEW;
        if (isNew) fig.dataset.proposed = 'true';
        const { el, screen } = T.phone({ size: 'md' });
        fig.appendChild(el);
        const out = render(screen);
        if (typeof out === 'string') screen.innerHTML = out;
        const cap = document.createElement('figcaption');
        cap.className = 'cc-cap';
        cap.innerHTML = `<div class="cc-capline"><span class="cc-num">${num}</span>${isNew ? '<span class="cc-new">Proposed</span><span class="cc-src">No screen in apps/mobile yet</span>' : `<span class="cc-src">${src}</span>`}</div><p class="cc-note">${note}</p>`;
        fig.appendChild(cap);
        track.appendChild(fig);
      });
      board.appendChild(row);
    });
    if (window.lucide) lucide.createIcons({ attrs: { 'stroke-width': 1.9 } });
    T.fitPhones();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build);
  else build();
})();
