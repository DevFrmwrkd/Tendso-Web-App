/* Creator links — app screens shared by app/creator-links.html (board) and pages/creator-program.html (hero phone).
   window.CL: screen renderers (HTML strings authored at 390×844 inside .app) + face crops + sample data.
   Rule #1 (never overwhelm): one thing per screen, ≤ 20 words, ≤ 3 taps, nothing under 16px.
   SAMPLE DATA: creator Mika Santos (handle mika, code MIKA). People photos are generated placeholders.
   Both pages/ and app/ sit one folder below the mock root, so assets resolve as ../assets/. */
(function () {
  const A = '../assets/';

  // face crops from the placeholder photos: fx/fy = face centre (0..1), ar = width/height, z = zoom
  const FACES = {
    mika:  { src: 'people/17-mika.jpg',   ar: 0.8, fx: 0.51, fy: 0.19, z: 3.3 },
    paolo: { src: 'people/06-agent.jpg',  ar: 0.8, fx: 0.55, fy: 0.18, z: 3.4 },
    joy:   { src: 'people/12-salon.jpg',  ar: 0.8, fx: 0.69, fy: 0.30, z: 3.9 },
    carlo: { src: 'people/16-baguio.jpg', ar: 0.8, fx: 0.31, fy: 0.15, z: 3.9 },
    rina:  { src: 'people/09-cafe.jpg',   ar: 0.8, fx: 0.27, fy: 0.25, z: 3.9 },
  };
  function faceStyle(k) {
    const f = FACES[k]; if (!f) return '';
    const z = f.z, zy = f.z / f.ar;
    const px = ((0.5 - f.fx * z) / (1 - z)) * 100, py = ((0.5 - f.fy * zy) / (1 - zy)) * 100;
    return `background-image:url(${A}${f.src});background-size:${(z * 100).toFixed(0)}% auto;background-position:${px.toFixed(1)}% ${py.toFixed(1)}%`;
  }
  // round face (photo crop, or initials when there is no photo)
  const face = (k, size = 48, name = '') => FACES[k]
    ? `<span class="cl-face" style="--sz:${size}px;${faceStyle(k)}" role="img" aria-label="${name || k}"></span>`
    : `<span class="cl-face cl-face--txt" style="--sz:${size}px" aria-hidden="true">${(name || k).split(' ').map((w) => w[0]).join('').slice(0, 2)}</span>`;

  // tiny inline icons (Lucide shapes) so the screens need no icon script
  const svg = (d, w = 22) => `<svg width="${w}" height="${w}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  const IC = {
    back: svg('<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>', 20),
    check: svg('<path d="M20 6 9 17l-5-5"/>', 18),
    home: svg('<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>'),
    users: svg('<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>'),
    wallet: svg('<path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/>'),
    store: svg('<path d="m2 7 4.4-4.4A2 2 0 0 1 7.8 2h8.4a2 2 0 0 1 1.4.6L22 7"/><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M2 7h20v3a3 3 0 0 1-5 2 3 3 0 0 1-5 0 3 3 0 0 1-5 0 3 3 0 0 1-5-2z"/>'),
    calendar: svg('<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>'),
    link: svg('<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>', 20),
  };

  // sample data (kept in one place so the portal page and the app agree)
  const ME = { name: 'Mika Santos', first: 'Mika', handle: 'mika', code: 'MIKA', shopLink: 'tendso.com/a/mika', agentLink: 'tendso.com/a/mika/earn', email: 'mika.santos@gmail.com' };
  const MONTH = { now: 12250, monthly: 4350 };
  // recruited field agents: joined date, sales this month, Mika's 5% this month
  const AGENTS = [
    { k: 'paolo', name: 'Paolo Reyes',      city: 'Marikina',    joined: '2026-02-03', sales: 6, cut: 900 },
    { k: 'joy',   name: 'Joy Dizon',        city: 'Pasig',       joined: '2026-03-18', sales: 5, cut: 825 },
    { k: 'rina',  name: 'Rina Villanueva',  city: 'Cebu City',   joined: '2026-06-21', sales: 4, cut: 650 },
    { k: 'carlo', name: 'Carlo Bautista',   city: 'Quezon City', joined: '2026-05-02', sales: 4, cut: 600 },
    { k: '',      name: 'Mark Aquino',      city: 'Antipolo',    joined: '2026-07-09', sales: 3, cut: 450 },
    { k: '',      name: 'Liza Mendoza',     city: 'Davao City',  joined: '2026-07-30', sales: 3, cut: 400 },
    { k: '',      name: 'Jun Castillo',     city: 'Marikina',    joined: '2026-08-14', sales: 2, cut: 300 },
    { k: '',      name: 'Ana Ramos',        city: 'Taguig',      joined: '2026-09-02', sales: 1, cut: 150 },
    { k: '',      name: 'Bea Navarro',      city: 'Makati',      joined: '2026-09-26', sales: 1, cut: 75 },
    { k: '',      name: 'Tess Garcia',      city: 'Bulacan',     joined: '2026-04-10', sales: 0, cut: 0 },
    { k: '',      name: 'Noel Fernandez',   city: 'Laguna',      joined: '2026-08-12', sales: 0, cut: 0 },
    { k: '',      name: 'Kim Torres',       city: 'Manila',      joined: '2026-10-08', sales: 0, cut: 0 },
    { k: '',      name: 'Jessa Lim',        city: 'Iloilo City', joined: '2026-10-15', sales: 0, cut: 0 },
    { k: '',      name: 'Ramon Cruz',       city: 'Batangas',    joined: '2026-10-19', sales: 0, cut: 0 },
  ];
  const TODAY = new Date('2026-10-21T12:00:00');
  const endOf = (iso) => { const d = new Date(iso + 'T12:00:00'); d.setFullYear(d.getFullYear() + 1); return d; };
  const monthsLeft = (iso) => { const e = endOf(iso); return Math.max(0, (e.getFullYear() - TODAY.getFullYear()) * 12 + e.getMonth() - TODAY.getMonth() - (e.getDate() < TODAY.getDate() ? 1 : 0)); };
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const fmtDate = (d) => `${d.getDate()} ${MON[d.getMonth()]} ${d.getFullYear()}`;
  const peso = (n) => '₱' + n.toLocaleString('en-US');

  // ---------- screen parts ----------
  const back = `<span class="a-back cl-back">${IC.back}</span>`;
  const foot = (...doors) => `<div class="cl-foot">${doors.join('')}</div>`;
  const door = (label, v = 'accent') => `<div class="door door--${v}">${label}</div>`;
  const tabs = (on) => {
    const t = (k, label, icon) => `<div class="a-tab${on === k ? ' is-on' : ''}">${icon}<span>${label}</span></div>`;
    return `<nav class="a-tabbar cl-tabs">${t('home', 'Home', IC.home)}${t('agents', 'Agents', IC.users)}${t('money', 'Money', IC.wallet)}</nav>`;
  };

  // (a) first open on iOS: we matched a recent click from the same network, the person confirms once
  const firstOpen = () => `
    <div class="cl-main cl-main--center">
      <div class="cl-hero-face">${face('mika', 216, 'Mika Santos')}</div>
      <p class="cl-name">Mika Santos</p>
      <h1 class="cl-h cl-h--xl">Did Mika send you?</h1>
    </div>
    ${foot(door('Yes'), door('No', 'ghost'))}`;

  // (b) field-agent sign-up: who sent you (pre-filled when known)
  const whoSent = () => `
    <div class="cl-main">
      <div class="cl-top">${back}<span class="cl-bar" style="--p:72%"><i></i></span></div>
      <h1 class="cl-h" style="margin-top:34px">Who sent you?</h1>
      <div class="cl-code">MIKA<span class="a-tick">${IC.check}</span></div>
      <div class="cl-person">${face('mika', 56, 'Mika Santos')}<b>Mika Santos</b></div>
    </div>
    ${foot(door('Next'))}`;

  // (c) owner checkout: the code is already applied, still editable
  const checkout = () => `
    <div class="cl-main">
      <div class="cl-top">${back}</div>
      <h1 class="cl-h" style="margin-top:14px">Pay once to publish.</h1>
      <div class="cl-site"><img src="${A}sites/forge-m.jpg" alt="The Forge Barbers website"></div>
      <div class="cl-codecard">${face('mika', 52, 'Mika Santos')}
        <div class="m"><b>Mika's code</b><span>You save ₱1,500</span></div>
        <a class="cl-link" href="#change">Change</a>
      </div>
      <div class="cl-price"><s>₱4,999</s><strong>₱3,499</strong></div>
    </div>
    ${foot(door('Pay ₱3,499'))}`;

  // (d) creator home in the app: the two incomes + share
  const home = () => `
    <div class="cl-main cl-main--tabs">
      <div class="cl-hi">${face('mika', 52, 'Mika Santos')}<h1 class="cl-h cl-h--md">Hi, Mika</h1></div>
      <p class="cl-p cl-muted" style="margin-top:22px">October</p>
      <div class="cl-two">
        <div class="cl-inc"><span class="cl-ic cl-ic--accent">${IC.store}</span><span class="l">Money now</span><strong>${peso(MONTH.now)}</strong></div>
        <div class="cl-inc"><span class="cl-ic cl-ic--ink">${IC.calendar}</span><span class="l">Monthly money</span><strong>${peso(MONTH.monthly)}</strong></div>
      </div>
      <div class="cl-linkrow">${IC.link}<b>${ME.shopLink}</b></div>
    </div>
    <div class="cl-foot cl-foot--tabs">${door('Share my link')}</div>
    ${tabs('home')}`;

  // (e) my agents: four rows, money this month; the bar shows months left of 12
  const agents = () => `
    <div class="cl-main cl-main--tabs">
      <h1 class="cl-h" style="margin-top:14px">My agents</h1>
      <p class="cl-p cl-muted" style="margin-top:4px">This month</p>
      <div class="cl-list">
        ${AGENTS.slice(0, 4).map((a) => `<div class="cl-row">${face(a.k, 52, a.name)}
          <div class="m"><b>${a.name}</b><span class="cl-months" aria-hidden="true">${Array.from({ length: 12 }, (_, i) => `<i${i < monthsLeft(a.joined) ? ' class="on"' : ''}></i>`).join('')}</span></div>
          <strong>${peso(a.cut)}</strong></div>`).join('')}
      </div>
    </div>
    ${tabs('agents')}`;

  // wrap a screen in the app shell (status bar + home indicator)
  const shell = (inner) => `<div class="app cl-screen" data-proposed="true">${window.T ? T.statusBar(false) : ''}${inner}<div class="a-home"></div></div>`;

  window.CL = { A, ME, MONTH, AGENTS, TODAY, face, faceStyle, endOf, monthsLeft, fmtDate, peso, shell, screens: { firstOpen, whoSent, checkout, home, agents } };
})();
