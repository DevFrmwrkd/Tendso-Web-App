/* Creator app board — account, money, link, learning (agent C3b, kit v3 / Round 2 language).
   Round 2 layouts (R2-F3 Earn, R2-F4 Link, R2-F1 tab bar, R2-O6 list/check patterns) redrawn in the new brand:
   Onest only, bold rounded headlines, pills, soft white cards, ONE accent (#E4F222) as a fill with ink text.
   Each screen keeps the purpose and data meaning of its real apps/mobile screen (source path under the phone).
   Money follows production (packages/shared/pricing.ts, 2026-10-06): price per sale ₱999–₱4,999 set by the
   creator from the first site, creator keeps 50% (rounded), payouts to the creator's Wise email. Pay once.
   SAMPLE DATA: creator Mika Santos, shops from TD.sites. */
(function () {
  const I = (name, cls = '') => `<i data-lucide="${name}"${cls ? ` class="${cls}"` : ''}></i>`;
  const A = '../assets/';
  const MARK = A + 'brand/mark-ink-256.png';
  const S = Object.fromEntries(TD.sites.map((s) => [s.id, { ...s, hero: '../' + s.hero, shot: `${A}sites/${s.id}-m.jpg` }]));

  // ---------- shared pieces ----------
  const door = (label, v = '') => `<div class="door${v ? ' door--' + v : ''}">${label}</div>`;
  const back = `<span class="cm-round">${I('arrow-left')}</span>`;
  const topBar = (title = '', right = '<span class="sp"></span>') => `<div class="cm-top-bar">${back}<span class="t">${title}</span>${right}</div>`;
  const fl = (label, inner, right = '') => `<div class="cm-fl"><div class="row"><span class="a-label">${label}</span>${right}</div>${inner}</div>`;
  const field = (icon, value, { ph = false, dots = false, right = '', focus = false } = {}) =>
    `<div class="a-field${focus ? ' is-focus' : ''}">${icon ? I(icon) : ''}<span class="${dots ? 'cm-dots' : ph ? 'ph' : ''}">${value}</span>${right}</div>`;
  const st = (k, label) => `<span class="cm-st cm-st--${k}">${k === 'live' ? '<i></i>' : ''}${label}</span>`;
  const mark = `<span class="a-bubble-mark"><img src="${MARK}" alt=""></span>`;
  const av = (sz, ring = false) => `<span class="cm-av${ring ? ' cm-av--ring' : ''}" style="--sz:${sz}px" role="img" aria-label="Mika Santos"></span>`;

  // creator tab bar (Round 2 F1): Map · Finds · SUBMIT · Earn · Me
  const tabbar = (on) => {
    const t = (k, label, icon) => `<div class="a-tab${on === k ? ' is-on' : ''}">${I(icon)}<span>${label}</span></div>`;
    return `<nav class="a-tabbar">${t('map', 'Map', 'map')}${t('finds', 'Finds', 'layout-grid')}
      <div class="a-tab a-tab--main">${I('plus')}<span>Submit</span></div>
      ${t('earn', 'Earn', 'wallet')}${t('me', 'Me', 'user')}</nav>`;
  };

  const APPLE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701"/></svg>';
  const GOOGLE = '<svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/><path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"/><path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"/><path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"/></svg>';

  // ---------- sample data ----------
  const ME = { first: 'Mika', last: 'Santos', email: 'mika.santos@gmail.com', code: 'MIKA8K2Q', link: 'tendso.com/a/mika' };
  const keep = (p) => Math.round(p * 0.5);
  const peso = (n) => '₱' + n.toLocaleString('en-US');
  const PRICE = 2999;   // Mika's current price → shop saves ₱2,000, she keeps ₱1,500

  // ================= ROW 1 · SIGN IN =================
  const login = () => `
    <div class="cm-body cm-auth">
      ${mark}
      <h1 class="a-display a-display--lg">Welcome back</h1>
      <p class="cm-sub" style="margin-bottom:26px">Sign in to see your sites and what you earned.</p>
      <div class="cm-col" style="gap:14px">
        ${fl('Email', field('mail', ME.email))}
        ${fl('Password', field('lock', '••••••••••', { dots: true, right: I('eye-off', 'cm-ink3') }), '<span class="cm-link" style="font-size:12px">Forgot?</span>')}
      </div>
      <div style="margin-top:24px">${door('Sign in', 'accent')}</div>
      <div class="cm-or">or</div>
      <div class="cm-col" style="gap:10px">
        <div class="cm-sso cm-sso--apple">${APPLE}<span>Continue with Apple</span></div>
        <div class="cm-sso cm-sso--google">${GOOGLE}<span>Continue with Google</span></div>
      </div>
      <p class="cm-alt" style="margin-top:26px">New to Tendso? <span class="cm-link">Make an account</span></p>
    </div>`;

  const signup = () => `
    ${topBar('')}
    <div class="cm-body cm-auth" style="top:106px;padding-top:6px">
      <h1 class="a-display a-display--lg">Make your account</h1>
      <p class="cm-sub" style="margin-bottom:18px">Choose how you'll earn after verifying your email.</p>
      <div class="cm-col" style="gap:12px">
        <div class="cm-split">${fl('First name', field('', ME.first))}${fl('Last name (optional)', field('', ME.last))}</div>
        ${fl('Email', field('mail', ME.email))}
        ${fl('Mobile', `<div style="display:flex;gap:8px"><span class="cm-cc">+63</span><div class="a-field" style="flex:1">${I('phone')}<span>917 482 3310</span></div></div>`, '<span class="a-label">Optional</span>')}
        ${fl('Password', field('lock', 'At least 8 characters', { ph: true, focus: true, right: I('eye-off', 'cm-ink3') }))}
      </div>
      <div style="margin-top:20px">${door('Make my account', 'accent')}</div>
    </div>`;

  const forgot = () => `
    ${topBar('')}
    <div class="cm-body cm-auth" style="top:106px;padding-top:10px">
      <h1 class="a-display a-display--lg">Forgot your password?</h1>
      <p class="cm-sub" style="margin-bottom:26px">Type your email. We'll send a 6-digit code to get you back in.</p>
      ${fl('Email', field('mail', ME.email, { focus: true }))}
      <div style="margin-top:22px">${door('Send code', 'accent')}</div>
      <p class="cm-alt" style="margin-top:22px">Remembered it? <span class="cm-link">Sign in</span></p>
      <div class="cm-col" style="gap:10px;margin-top:42px;opacity:.5">
        <span class="a-sec" style="text-align:left">Next: type the code</span>
        <div class="cm-code6"><span>4</span><span>8</span><span class="is-cur"></span><span></span><span></span><span></span></div>
      </div>
    </div>`;

  // ================= ROW 2 · EARN (Round 2 F3) =================
  const BARS = [['May', 38], ['Jun', 52], ['Jul', 44], ['Aug', 61], ['Sep', 76], ['Oct', 100]];
  const LATEST = [
    [S.kalan.hero, 'Kalan', 2999, 'Oct 18'],
    [S.hela.hero, 'Héla Hair Studio', 4999, 'Oct 12'],
    [A + 'photos/kalan-pandesal.jpg', 'Panaderya Dela Cruz', 3999, 'Oct 9'],
  ];
  const sale = ([img, name, price, date]) => `<div class="cm-sale"><img src="${img}" alt="">
    <div class="m"><b>${name}</b><span>Paid ${peso(price)} · ${date}</span></div><span class="cm-amt">+${peso(keep(price))}</span></div>`;

  const earnBody = () => `
    <div class="cm-body cm-body--tabs">
      <div class="cm-earnhead">
        <div class="top"><span class="k">You earned in October</span><span class="cm-round" style="width:36px;height:36px">${I('history')}</span></div>
        <div class="cm-big">₱12,400</div>
        <div class="d">6 sites · ₱3,000 more than September</div>
        <div class="cm-bars">${BARS.map(([m, h], i) => `<div class="${i === BARS.length - 1 ? 'is-on' : ''}"><i style="height:${h * 0.56}px"></i><b>${m}</b></div>`).join('')}</div>
      </div>
      <div class="cm-pad cm-col" style="gap:14px">
        <div class="a-card cm-price">
          <div class="h"><b>Your price</b><span class="cm-small">Lower price = easier yes</span></div>
          <div class="cm-chips5">${[999, 1999, 2999, 3999, 4999].map((p) => `<span class="${p === PRICE ? 'is-on' : ''}">${p.toLocaleString('en-US')}</span>`).join('')}</div>
          <div class="cm-two">
            <div class="is-keep"><strong>${peso(keep(PRICE))}</strong><span>you keep per site</span></div>
            <div><strong>${peso(4999 - PRICE)}</strong><span>the shop saves</span></div>
          </div>
        </div>
        <div class="cm-h2" style="font-size:16px;margin-top:2px">Latest</div>
        ${LATEST.map(sale).join('')}
      </div>
    </div>`;
  const earnHome = () => `${earnBody()}<div class="cm-cta">${door('Cash out ₱3,750 to Wise', 'accent')}</div>${tabbar('earn')}`;

  const cashOut = () => `${earnBody()}${tabbar('earn')}<div class="cm-scrim"></div>
    <div class="cm-sheet">
      <span class="cm-grab"></span>
      <div class="cm-col" style="gap:4px"><h2 class="a-display a-display--md">Cash out to Wise</h2><span class="cm-sub">₱3,750 ready to cash out</span></div>
      <div class="a-card cm-amount">
        <span class="a-label">Amount</span>
        <div class="v">₱3,750<span class="cm-caret"></span></div>
        <div class="cm-pills"><span class="a-pill">₱1,000</span><span class="a-pill">₱2,000</span><span class="a-pill is-on">All · ₱3,750</span></div>
      </div>
      ${fl('Your Wise email', field('mail', ME.email, { right: I('circle-check', 'cm-ink') }), '<span class="cm-link" style="font-size:12px">Change</span>')}
      <div class="cm-note-row">${I('bell')}<span>We send it to your Wise account and tell you when Wise completes it.</span></div>
      <div class="cm-col" style="gap:10px;margin-top:2px">${door('Send ₱3,750 to Wise', 'accent')}${door('Not now', 'ghost')}</div>
    </div>`;

  const payRow = (amt, date, status) => `<div class="cm-sale"><span class="cm-icwrap cm-icwrap--ink">${I('send')}</span>
    <div class="m"><b>To Wise · ${date}</b><span>${ME.email}</span></div>
    <div class="cm-r"><span class="cm-amt cm-amt--out">−${peso(amt)}</span>${status}</div></div>`;
  const payouts = () => `
    ${topBar('Payouts')}
    <div class="cm-body" style="top:106px">
      <div class="cm-pad cm-col" style="gap:14px;padding-top:8px">
        <div class="a-card cm-sum">
          <div><strong>₱41,500</strong><span>Earned</span></div>
          <div><strong>₱37,750</strong><span>Cashed out</span></div>
          <div><strong>₱3,750</strong><span>Ready</span></div>
        </div>
        <div class="cm-pills"><span class="a-pill a-pill--ink">All</span><span class="a-pill">Earned</span><span class="a-pill">Cashed out</span></div>
        <span class="a-sec" style="text-align:left;margin-top:4px">October</span>
        <div class="a-card cm-listcard">
          ${payRow(5000, 'Oct 20', st('proc', 'Processing'))}
          ${sale(LATEST[0])}
          ${sale(LATEST[1])}
          ${sale(LATEST[2])}
        </div>
        <span class="a-sec" style="text-align:left;margin-top:4px">September</span>
        <div class="a-card cm-listcard">
          ${payRow(8750, 'Sep 28', st('paid', 'Completed'))}
          ${sale([S.labana.hero, 'Labaná Laundry', 3999, 'Sep 24'])}
          ${sale([S.vulca.hero, 'Vulca Garage', 4999, 'Sep 16'])}
        </div>
      </div>
    </div>`;

  // ================= ROW 3 · YOUR LINK (Round 2 F4 + PageEditor) =================
  const tg = (lead, title, sub, on = true) => `<div class="cm-tg">${lead}<div class="m"><b>${title}</b><span>${sub}</span></div><span class="cm-sw${on ? ' is-on' : ''}"></span></div>`;
  const linkEditor = () => `
    ${topBar('Your link', `<span class="cm-round">${I('eye')}</span>`)}
    <div class="cm-body" style="top:106px">
      <div class="cm-pad cm-col" style="gap:14px;padding-top:8px">
        <div class="a-card cm-linkcard" style="flex-direction:column;align-items:stretch;gap:12px"><div class="m"><span class="a-label">Your page</span><b>${ME.link}</b></div>
          <div style="display:flex;gap:8px"><span class="cm-mini" style="flex:1;justify-content:center">${I('copy')}Copy link</span><span class="cm-mini cm-mini--ink" style="flex:1;justify-content:center">${I('share-2')}Share</span></div></div>
        <span class="a-sec" style="text-align:left">What shows on your page</span>
        <div class="a-card cm-cardgrp">
          ${tg(av(44), 'Photo', 'Tap to change', true)}
          ${tg(`<span class="cm-icwrap">${I('tag')}</span>`, 'Price with your code', `${peso(PRICE)} · code MIKA · shop saves ${peso(4999 - PRICE)}`, true)}
          ${tg(`<span class="cm-icwrap">${I('layout-grid')}</span>`, 'Sites I built and rating', '23 sites · 4.9 stars', true)}
          ${tg(`<span class="cm-icwrap">${I('message-circle')}</span>`, 'Messenger button', 'm.me/mikasantos.ph', false)}
        </div>
        <span class="a-sec" style="text-align:left">Your intro</span>
        <div class="a-card cm-intro"><p>Kumusta! I build websites for shops in Marikina. I visit, take the photos and you see your site before you pay.</p>
          <div class="f"><span>Short message</span><span>112 / 200</span></div></div>
      </div>
      <div class="a-footer" style="border-top:0;padding-top:12px">${door('Save my page', 'accent')}</div>
    </div>`;

  const webTop = (inner, y = 0) => `<div class="cm-web"><div class="cm-webin" style="transform:translateY(${-y}px)">${inner}</div></div>
    <div class="cm-addr"><span>${I('lock')}${ME.link}</span></div>`;
  const publicPage = () => `
    <div class="cm-lp-top">
      <div class="cm-lp-bar"><b>tendso</b><span class="cm-small">${ME.link}</span></div>
      <div style="margin-top:6px">${av(96, true)}</div>
      <div class="cm-lp-name">Mika Santos</div>
      <div class="cm-lp-meta">${I('star')}4.9 · 23 sites built · Creator in Marikina</div>
      <div class="a-card cm-offer">
        <h2>Mika saved you ₱2,000</h2>
        <span class="cm-applied">${I('check')}Code MIKA applied</span>
        <div class="cm-pricebig"><s>₱4,999</s><strong>${peso(PRICE)}</strong><span>once</span></div>
        <p class="cm-small" style="font-size:13px;margin-top:-4px">Pay once, after your website is live. Nothing to pay today.</p>
        ${door('Get my website', 'accent')}
        ${door('Book Mika for a free visit', 'ghost')}
      </div>
    </div>
    <div class="cm-lp-sec">
      <h3>Sites Mika built</h3>
      <div class="cm-sites">${['kalan', 'hela', 'labana', 'vulca'].map((id) => `<figure><img src="${S[id].shot}" alt=""><figcaption>${S[id].name}<span>${S[id].city}</span></figcaption></figure>`).join('')}</div>
    </div>
    <div class="cm-lp-sec" style="padding-top:30px">
      <h3>How it works</h3>
      <div class="cm-how">
        <div><span class="ic">${I('camera')}</span>Mika takes photos</div>
        <div><span class="ic">${I('layout-grid')}</span>You pick a design</div>
        <div><span class="ic ic--on">${I('check')}</span>Site built</div>
      </div>
      <div class="cm-strip-note">Free address: yourshop.tendso.site<br>Your own .com +₱500</div>
    </div>
    <div class="cm-lp-sec" style="padding-top:28px;padding-bottom:30px">
      <h3>Referrals</h3>
      <div class="cm-earnwith"><span class="cm-sub" style="font-size:14px;line-height:20px">Want to build sites too? Get the Tendso app and enter Mika's code.</span>
        <div class="code"><b>${ME.code}</b><span class="cm-mini">${I('copy')}Copy</span></div></div>
    </div>`;
  const linkPublic = () => webTop(publicPage(), 0);
  const linkPublicScrolled = () => webTop(publicPage(), 740);

  const person = (ini, name, when, s) => `<div class="cm-person"><span class="cm-ini">${ini}</span>
    <div class="cm-sale" style="flex:1;min-width:0"><div class="m"><b>${name}</b><span>Joined ${when}</span></div></div>${s}</div>`;
  const referrals = () => `
    ${topBar('Invite creators')}
    <div class="cm-body" style="top:106px">
      <div class="cm-pad cm-col" style="gap:14px;padding-top:8px">
        <h1 class="a-display a-display--md">Bring a friend to Tendso</h1>
        <p class="cm-sub" style="margin-top:-6px">They sign up with your code, get certified, and build their first site.</p>
        <div class="a-card cm-codecard">
          <div class="c"><span class="a-label">Your code</span><strong>${ME.code}</strong></div>
          <div class="cm-col" style="gap:8px">${door('Share my code', 'accent')}${door('Copy code', 'ghost')}</div>
        </div>
        <div class="cm-stats">
          <div class="a-card"><strong>3</strong><span>Invited</span></div>
          <div class="a-card"><strong>2</strong><span>Qualified</span></div>
          <div class="a-card"><strong>1</strong><span>Rewarded</span></div>
        </div>
        <span class="a-sec" style="text-align:left">People you invited</span>
        <div class="a-card cm-listcard">
          ${person('R', 'Rhea Manalo', 'Oct 18', st('draft', 'Signed up'))}
          ${person('C', 'Carlo Bautista', 'Oct 12', st('ready', 'Qualified'))}
          ${person('J', 'Joy Dizon', 'Sep 30', st('paid', 'Rewarded'))}
        </div>
      </div>
    </div>`;

  // ================= ROW 4 · SUBMISSIONS =================
  const SUBS = [
    ['kalan', 'live', 'Live', 'Oct 18'],
    ['hela', 'paid', 'Paid', 'Oct 12'],
    ['vulca', 'ready', 'Website ready', 'Oct 10'],
    ['labana', 'review', 'In review', 'Oct 19'],
    ['domingo', 'draft', 'Draft', 'Oct 20'],
    ['kalasag', 'rejected', 'Rejected', 'Oct 2'],
  ];
  const subsList = () => `
    ${topBar('', `<span class="cm-round">${I('search')}</span>`)}
    <div class="cm-body" style="top:106px">
      <div class="cm-hd"><h1 class="a-display a-display--lg">Your submissions</h1><span class="cm-small" style="font-size:13px">23 shops · 1 needs a fix</span></div>
      <div class="cm-filt"><span class="a-pill a-pill--ink">All</span><span class="a-pill">Live</span><span class="a-pill">In review</span><span class="a-pill">Drafts</span></div>
      <div class="cm-subs">${SUBS.map(([id, k, label, date]) => {
        const s = S[id];
        return `<div class="a-card cm-subcard"><img src="${s.hero}" alt=""><div class="m"><b>${s.name}</b><span>${s.kind} · ${s.city}</span></div>
          <div class="cm-r">${st(k, label)}<span class="d">${date}</span></div></div>`;
      }).join('')}</div>
    </div>
    <div class="a-footer" style="border-top:0;background:transparent;padding-bottom:30px">${door('Submit a new shop', 'accent')}</div>`;

  const tlRow = (title, sub, done = true) => `<div class="a-check${done ? ' is-done' : ''}"><i class="c">${done ? I('check') : ''}</i><span>${title}<small>${sub}</small></span></div>`;
  const subDetail = () => `
    ${topBar('Kalan', `<span class="cm-round">${I('ellipsis')}</span>`)}
    <div class="cm-body" style="top:106px">
      <div class="cm-heroimg" style="margin-top:6px;height:140px"><img src="${S.kalan.hero}" alt="">${st('live', 'Live')}</div>
      <div class="cm-pad cm-col" style="gap:12px;padding-top:14px">
        <div class="a-card cm-linkcard"><div class="m"><span class="a-label">Website</span><b>${S.kalan.url}</b></div><span class="cm-mini cm-mini--accent">${I('external-link')}Open</span></div>
        <div class="a-card cm-tg" style="padding:12px 14px"><span class="cm-ini">T</span><div class="m"><b>Teresa Dela Paz</b><span>Owner · 0917 482 3310 · Marikina</span></div><span class="cm-round" style="width:36px;height:36px;box-shadow:none;background:var(--a-bg2)">${I('phone')}</span></div>
        <span class="a-sec" style="text-align:left;margin-top:2px">Status</span>
        <div class="cm-tl">
          ${tlRow('Submitted', 'Oct 14 · 8 photos, video interview')}
          ${tlRow('Approved', 'Oct 15 · by the Tendso team')}
          ${tlRow('Website ready', 'Oct 16 · Teresa saw it before paying')}
          ${tlRow('Paid ₱2,999', 'Oct 18 · you kept ₱1,500')}
          ${tlRow('Live', 'Oct 18 · kalan.tendso.site')}
        </div>
        <span class="a-sec" style="text-align:left;margin-top:2px">Photos · 8</span>
        <div class="cm-photos"><img src="${A}photos/kalan-hero.jpg" alt=""><img src="${A}photos/kalan-cook.jpg" alt=""><img src="${A}photos/kalan-pandesal.jpg" alt=""><img src="${A}photos/after-kalan.jpg" alt=""></div>
      </div>
    </div>`;

  // ================= ROW 5 · LEARN =================
  const TOPICS = [
    ['flag', 'Getting started', 'Certification, first week'],
    ['camera', 'Interview & photos', 'The visit, step by step'],
    ['wallet', 'Price & payouts', 'Your price, Wise'],
    ['map-pin', 'Finding shops', 'Map, finds, leads'],
    ['link', 'Your link', 'Page, code, sharing'],
    ['wrench', 'Fixing problems', 'Uploads, transcripts'],
  ];
  const learnHome = () => `
    <div class="cm-body cm-body--tabs">
      <div class="cm-pad cm-col" style="gap:14px;padding-top:12px">
        <h1 class="a-display a-display--lg">How can we help?</h1>
        <div class="cm-seg"><span>Help center</span><span class="is-on">Field wiki</span></div>
        <div class="cm-search">${I('search')}<span>Search the wiki</span></div>
        <div class="cm-ask">${mark}<div class="m"><b>Ask Tendso</b><span>Answers from the wiki, with sources</span></div><span class="go">${I('arrow-right')}</span></div>
        <span class="a-sec" style="text-align:left;margin-top:2px">Topics</span>
        <div class="cm-topics">${TOPICS.map(([ic, t, d]) => `<div class="a-card cm-topic"><span class="ic">${I(ic)}</span><b>${t}</b><span>${d}</span></div>`).join('')}</div>
      </div>
    </div>${tabbar('me')}`;

  const article = () => `
    ${topBar('', `<span class="cm-round">${I('bookmark')}</span>`)}
    <div class="cm-body cm-body--tabs" style="top:106px">
      <div class="cm-pad cm-col cm-art" style="gap:14px;padding-top:6px">
        <span class="cm-tag">${I('camera')}Interview &amp; photos</span>
        <h1 class="a-display a-display--md">Running the <span style="white-space:nowrap">30-minute</span> interview</h1>
        <span class="cm-small" style="margin-top:-6px">Field wiki · 6 min read</span>
        <img class="cm-artimg" src="${A}people/15-carinderia.jpg" alt="">
        <p>A good interview feels like a chat, not a survey. Leave with the shop's story in the owner's own words, and the photos to match.</p>
        <h3>Before you arrive</h3>
        <div class="cm-col" style="gap:8px">
          <div class="a-check"><i class="c"></i><span>Confirm the owner will be there</span></div>
          <div class="a-check"><i class="c"></i><span>Charge your phone, clear space for video</span></div>
          <div class="a-check"><i class="c"></i><span>Know the shop's name, city and what it sells</span></div>
        </div>
        <h3>The questions that build the page</h3>
      </div>
    </div>${tabbar('me')}`;

  const ask = () => `
    ${topBar('Ask Tendso', `<span class="cm-round">${I('book-open')}</span>`)}
    <div class="cm-chat">
      <div class="cm-me">How much do I keep per site?</div>
      <div class="a-bubble">${mark}<div class="a-bubble-text">
        <span>You keep half of the price you set. You choose it for each sale, from ₱999 to ₱4,999, starting with your first site. At ₱2,999 you keep ₱1,500.</span>
        <div class="cm-srcs"><span>Sources</span><div class="s">${I('file-text')}Your price: ₱999 to ₱4,999</div><div class="s">${I('file-text')}How you get paid</div></div>
      </div></div>
      <div class="cm-me">When does it reach my Wise?</div>
      <div class="a-bubble">${mark}<div class="a-bubble-text">
        <span>Your half lands in your wallet when the shop pays. Cash out from Earn and it goes to your Wise email.</span>
        <div class="cm-srcs"><span>Sources</span><div class="s">${I('file-text')}How you get paid</div></div>
      </div></div>
      <div class="cm-sugg"><span class="a-pill">Can I change my price?</span><span class="a-pill">What's a referral?</span></div>
    </div>
    <div class="cm-askbar"><span>Ask about the field, money, the app…</span><span class="cm-send">${I('arrow-up')}</span></div>`;

  // ================= ROW 6 · ME =================
  const mr = (icon, label, right = '') => `<div class="cm-mr"><span class="ic">${I(icon)}</span><span>${label}</span>${right ? `<em>${right}</em>` : ''}${I('chevron-right')}</div>`;
  const profile = () => `
    <div class="cm-body cm-body--tabs">
      <div class="cm-pad cm-col" style="gap:14px;padding-top:14px">
        <div class="cm-prof">${av(64)}<div class="m"><b>Mika Santos</b><span>Creator · Marikina</span><span class="cm-tag" style="margin-top:4px">${I('link')}${ME.link}</span></div></div>
        <div class="cm-stats">
          <div class="a-card"><strong>23</strong><span>Sites built</span></div>
          <div class="a-card"><strong>4.9</strong><span>Rating</span></div>
          <div class="a-card"><strong>₱41.5k</strong><span>Earned</span></div>
        </div>
        <div class="a-card cm-menu">
          ${mr('store', 'Your submissions', '23')}
          ${mr('link', 'Your link')}
          ${mr('users', 'Invite creators', '3')}
          ${mr('book-open', 'Learn & help')}
        </div>
        <span class="a-sec" style="text-align:left">Settings</span>
        <div class="a-card cm-menu">
          ${mr('user-pen', 'Edit profile')}
          ${mr('bell', 'Notifications')}
          ${mr('lock', 'Change password')}
        </div>
        <p class="cm-alt" style="color:var(--a-ink3);font-size:13px"><span class="cm-link" style="color:inherit">Terms</span> · <span class="cm-link" style="color:inherit">Privacy</span> · <span class="cm-link" style="color:inherit">Sign out</span></p>
      </div>
    </div>${tabbar('me')}`;

  const editProfile = () => `
    ${topBar('Edit profile')}
    <div class="cm-body" style="top:106px">
      <div class="cm-pad cm-col" style="gap:13px;padding-top:6px">
        <div class="cm-avedit">${av(96)}<span class="cm-cam">${I('camera')}</span></div>
        <span class="cm-small" style="text-align:center;margin:-4px 0 4px">Tap the photo to change it</span>
        <div class="cm-split">${fl('First name', field('', ME.first))}${fl('Last name', field('', ME.last))}</div>
        ${fl('Mobile', field('phone', '0917 482 3310'))}
        ${fl('Email', field('mail', ME.email, { right: I('lock', 'cm-lock') }), '<span class="a-label">Can\'t change</span>')}
        ${fl('Wise email for payouts', field('send', ME.email, { right: I('circle-check', 'cm-ink') }))}
        <div style="margin-top:8px">${door('Save changes', 'accent')}</div>
        <p class="cm-danger" style="margin-top:8px">Delete my account</p>
      </div>
    </div>`;

  const acc = (q, a = '', icon = '') => `<div class="a-card cm-acc${a ? ' is-open' : ''}"><div class="q">${icon ? `<span class="cm-icwrap" style="width:36px;height:36px;border-radius:12px">${I(icon)}</span>` : ''}<span>${q}</span>${I(a ? 'chevron-up' : 'chevron-down')}</div>${a ? `<div class="a">${a}</div>` : ''}</div>`;
  const faq = () => `
    ${topBar('Help & FAQ')}
    <div class="cm-body" style="top:106px">
      <div class="cm-pad cm-col" style="gap:12px;padding-top:6px">
        <h1 class="a-display a-display--md">Questions</h1>
        <div class="cm-filt" style="padding:0"><span class="a-pill">Start</span><span class="a-pill">Submissions</span><span class="a-pill a-pill--ink">Money</span><span class="a-pill">Account</span></div>
        ${acc('How much do I earn per site?', `<p>You keep half of every sale. You set the price for each site, from ₱999 to ₱4,999, starting with your first site.</p>
          <div class="cm-keep"><div><b>₱500</b><span>at ₱999</span></div><div class="is-mid"><b>₱1,500</b><span>at ₱2,999</span></div><div><b>₱2,500</b><span>at ₱4,999</span></div></div>
          <p>Video or audio interview, the pay is the same.</p>`, 'wallet')}
        ${acc('When and how do I get paid?', '', 'send')}
        ${acc('How do referrals work?', '', 'users')}
        ${acc('Can I change my price later?', '', 'tag')}
        ${acc('What if a submission is rejected?', '', 'circle-alert')}
      </div>
    </div>`;

  const terms = () => `
    ${topBar('Terms of Service')}
    <div class="cm-body" style="top:106px">
      <div class="cm-pad cm-col" style="gap:12px;padding-top:6px">
        <h1 class="a-display a-display--md">Terms of Service</h1>
        <span class="cm-small" style="margin-top:-6px">Last updated February 2026</span>
        <p class="cm-sub" style="font-size:14px;line-height:20px">Please read these terms. By using Tendso, you agree to them.</p>
        ${acc('1. Acceptance of Terms', `<div class="cm-doc">By downloading, installing, or using the Tendso mobile application ("App"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree to these Terms, do not use the App.

These Terms are a legally binding agreement between you and Tendso ("we," "us," or "our"). We may update these Terms at any time. Using the App after changes means you accept the updated Terms.</div>`)}
        ${acc('2. Account Registration')}
        ${acc('3. Creator Certification')}
        ${acc('4. Submissions & Content')}
        ${acc('5. Pricing & Payouts')}
      </div>
    </div>`;

  // ---------- board ----------
  const P = 'apps/mobile/app/(app)/';
  const ROWS = [
    { name: 'Sign in', screens: [
      [login, 'Sign in', 'apps/mobile/app/(auth)/login.tsx', 'Email first, then Apple and Google as a matched pill pair.'],
      [signup, 'Sign up', 'apps/mobile/app/(auth)/signup.tsx', 'One identity form. Choose Field agent or Creator once in account setup after verification.'],
      [forgot, 'Forgot password', 'apps/mobile/app/(auth)/forgot-password.tsx', 'Email step; the 6-digit code step follows (shown faded).'],
    ] },
    { name: 'Earn', screens: [
      [earnHome, 'Earn home', P + '(tabs)/wallet.tsx · R2-F3', 'Month total and bars, your price ₱999–₱4,999 with what you keep vs what the shop saves, latest paid sites, one accent cash-out.'],
      [cashOut, 'Cash out', P + '(tabs)/wallet.tsx (withdraw modal)', 'Amount with quick picks, the saved Wise email, confirm. Nothing else on screen.'],
      [payouts, 'Payout history', P + '(tabs)/wallet.tsx (history)', 'Earned, cashed out, ready; Wise transfers with status mixed into the month’s sales.'],
    ] },
    { name: 'Your link', screens: [
      [linkEditor, 'Link page editor', 'apps/mobile/components/affiliate/PageEditor.tsx', 'What shows on your page as toggles; intro; copy and share the link.'],
      [linkPublic, 'Public page · top', 'app/a/[handle]/_components/AffiliateLanding.tsx · R2-F4', 'What a shop owner sees: code applied ₱4,999 → ₱2,999 once, get my website, book a free visit.'],
      [linkPublicScrolled, 'Public page · scrolled', 'app/a/[handle] · R2-F4', 'Sites Mika built, how it works, and Referrals (code only, no peso figure).'],
      [referrals, 'Invite creators', P + 'referrals.tsx', 'Code with share and copy; counts and status per person. No bonus figure.'],
    ] },
    { name: 'Submissions', screens: [
      [subsList, 'Submissions', P + 'submissions/index.tsx', 'Every status as a pill: Live, Paid, Website ready, In review, Draft, Rejected.'],
      [subDetail, 'One submission', P + 'submissions/[id].tsx', 'Site link, owner, the status as a done checklist, photos.'],
    ] },
    { name: 'Learn', screens: [
      [learnHome, 'Knowledge home', P + '(tabs)/knowledge/index.tsx', 'Help center / Field wiki, search, Ask Tendso, topics as cards. Reached from Me.'],
      [article, 'Article', P + '(tabs)/knowledge/article/[slug].tsx', 'Topic tag, title, photo, body with checklist blocks.'],
      [ask, 'Ask Tendso', P + '(tabs)/knowledge/ask.tsx', 'Answered chat with sources under each reply; follows the 2026-10-06 price rule.'],
    ] },
    { name: 'Me', screens: [
      [profile, 'Profile', P + '(tabs)/profile.tsx', 'Photo, link, three stats (no levels), shortcuts, settings rows.'],
      [editProfile, 'Edit profile', P + 'edit-profile.tsx', 'Photo, name, mobile; email locked; Wise email for payouts.'],
      [faq, 'Help & FAQ', P + 'help-faq.tsx', 'Money tab, one answer open, rewritten to the 2026-10-06 rule (no 5-site lock).'],
      [terms, 'Terms', P + 'terms-of-service.tsx', 'Top of the terms, section 1 open.'],
    ] },
  ];

  const root = document.getElementById('cm-rows');
  ROWS.forEach((row, ri) => {
    const sec = document.createElement('section');
    sec.className = 'cm-row';
    const no = String(ri + 1).padStart(2, '0');
    sec.innerHTML = `<div class="cm-rowhead"><b>${no} ${row.name}</b><span>${row.screens.length} screens</span></div><div class="cm-strip"></div>`;
    const strip = sec.querySelector('.cm-strip');
    row.screens.forEach(([render, label, path, note], si) => {
      const cell = document.createElement('figure');
      cell.className = 'cm-cell';
      const ph = T.phone({ size: 'md' });
      ph.screen.innerHTML = `<div class="app cm-screen">${T.statusBar(false)}${render()}<div class="a-home"></div></div>`;
      cell.appendChild(ph.el);
      const cap = document.createElement('figcaption');
      cap.className = 'cm-cap';
      cap.innerHTML = `<div class="cm-step"><i>${no}.${si + 1}</i>${label}</div><div class="cm-src">${path.replace(/\//g, '/<wbr>')}</div><p class="cm-note">${note}</p>`;
      cell.appendChild(cap);
      strip.appendChild(cell);
    });
    root.appendChild(sec);
  });

  T.fitPhones();
  if (window.lucide) lucide.createIcons({ attrs: { 'stroke-width': 1.8 } });
})();
