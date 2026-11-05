/* Creator pages: one script for creator-program.html, creator-signup.html, creator-portal.html, a-shop.html,
   a-earn.html. Each page calls its own CP.<page>(). Sample data comes from ../app/creator-links-screens.js (window.CL)
   so the web pages and the app screens agree. Numbers follow docs/CREATOR-PROGRAM.md:
   code price ₱3,499 (30% off ₱4,999) → creator keeps ₱1,750; override 5% (₱150 on a ₱2,999 sale) for 12 months,
   one level, paid once the shop has paid in full. */
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const peso = (n) => '₱' + Math.round(n).toLocaleString('en-US');
  const A = '../assets/';

  const ICON = {
    apple: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16.37 12.6c-.02-2.3 1.88-3.4 1.96-3.46-1.07-1.56-2.73-1.78-3.32-1.8-1.41-.14-2.76.83-3.47.83-.72 0-1.82-.81-2.99-.79-1.54.02-2.96.9-3.75 2.27-1.6 2.78-.41 6.89 1.15 9.14.76 1.1 1.67 2.34 2.86 2.3 1.15-.05 1.58-.74 2.97-.74 1.38 0 1.77.74 2.98.72 1.23-.02 2.01-1.12 2.76-2.23.87-1.28 1.23-2.52 1.25-2.58-.03-.01-2.39-.92-2.4-3.66ZM14.1 5.86c.63-.77 1.06-1.83.94-2.89-.91.04-2.01.61-2.66 1.37-.58.67-1.1 1.76-.96 2.8 1.01.08 2.05-.52 2.68-1.28Z"/></svg>',
    play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.6 2.3 13.4 11 4.6 19.7c-.36-.2-.6-.6-.6-1.07V3.37c0-.47.24-.87.6-1.07Z"/><path d="m14.5 12.1 2.5 2.5-10.6 6.1 8.1-8.6Z" opacity=".8"/><path d="m14.5 9.9-8.1-8.6L17 7.4l-2.5 2.5Z" opacity=".8"/><path d="m18.3 8.2 2.6 1.5c.85.5.85 1.7 0 2.2l-2.6 1.5-2.7-2.7 2.7-2.5Z" opacity=".6"/></svg>',
    plus: '<svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M7 2v10M2 7h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
    copy: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
    share: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="m16 6-4-4-4 4"/><path d="M12 2v13"/></svg>',
    back: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>',
    clock: '<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    coach: '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3 2 8l10 5 10-5-10-5Z"/><path d="M6 10.5V16c0 1.5 2.7 3 6 3s6-1.5 6-3v-5.5"/></svg>',
    chat: '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
    fast: '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/></svg>',
    kit: '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>',
  };

  // ---------- shared helpers ----------
  const faceEl = (k, size, name) => {
    if (CL.faceStyle(k)) return `<span class="cp-g-face" style="--sz:${size}px;${CL.faceStyle(k)}" role="img" aria-label="${name || ''}"></span>`;
    const ini = (name || '?').split(' ').map((w) => w[0]).join('').slice(0, 2);
    return `<span class="cp-g-face cp-initials" style="--sz:${size}px" aria-hidden="true">${ini}</span>`;
  };
  function faces(root = document) {
    $$('[data-face]', root).forEach((el) => { el.setAttribute('style', (el.getAttribute('style') || '') + ';' + CL.faceStyle(el.dataset.face)); });
  }
  function stores(root = document) {
    const L = (window.TD && TD.links) || { appStore: '#app-store', googlePlay: '#google-play' };
    $$('[data-stores]', root).forEach((el) => {
      el.innerHTML = `<a class="store" href="${L.appStore}">${ICON.apple}<span><small>Download on the</small><b>App Store</b></span></a>
        <a class="store" href="${L.googlePlay}">${ICON.play}<span><small>Get it on</small><b>Google Play</b></span></a>`;
    });
  }
  // copy buttons: data-copy="text"; mock feedback only
  function copies(root = document) {
    $$('[data-copy]', root).forEach((b) => b.addEventListener('click', () => {
      try { navigator.clipboard?.writeText(b.dataset.copy); } catch (e) { /* mock */ }
      const was = b.innerHTML; b.classList.add('is-done'); b.textContent = 'Copied';
      setTimeout(() => { b.classList.remove('is-done'); b.innerHTML = was; }, 1400);
    }));
  }
  function faq(list) {
    const root = $('#faq-list'); if (!root) return;
    root.innerHTML = list.map(([q, a]) => `<details class="ag-qa"><summary>${q}<span class="ag-qa-plus">${ICON.plus}</span></summary><div class="ag-qa-a"><p>${a}</p></div></details>`).join('');
  }
  // a phone showing a site screenshot (no URL bar)
  function sitePhone(src, alt) {
    const ph = T.phone({ size: 'md', cls: 'is-site' });
    ph.screen.innerHTML = `<img src="${src}" alt="${alt}" draggable="false">`;
    return ph.el;
  }

  // ================= /creators =================
  function program() {
    faces();
    $$('.cp-months-row').forEach((r) => { r.innerHTML = '<i></i>'.repeat(12); });

    // hero phone: the creator's home in the app
    const host = $('#hero-phone');
    if (host) { const ph = T.phone({ size: 'md' }); ph.screen.innerHTML = CL.shell(CL.screens.home()); host.appendChild(ph.el); T.fitPhones(host); }
    const paid = $('#hero-paid');
    if (paid) setTimeout(() => paid.classList.add('is-in'), T.reduced ? 0 : 700);

    // calculator
    const BUSY = {
      slow:   { share: 0.25, sales: 2, label: 'Slow' },
      steady: { share: 0.5,  sales: 4, label: 'Steady' },
      strong: { share: 0.8,  sales: 8, label: 'Strong' },
    };
    let busy = 'steady';
    const shops = $('#cp-shops'), agents = $('#cp-agents');
    const paint = (inp) => inp.style.setProperty('--p', ((inp.value - inp.min) / (inp.max - inp.min)) * 100 + '%');
    function calc() {
      const s = +shops.value, a = +agents.value, b = BUSY[busy];
      const active = Math.round(a * b.share), sales = active * b.sales;
      const now = s * 1750, monthly = sales * 150;
      $('#cp-shops-out').textContent = s; $('#cp-agents-out').textContent = a;
      shops.setAttribute('aria-valuetext', `${s} shops`); agents.setAttribute('aria-valuetext', `${a} agents`);
      $('#cp-assume').innerHTML = `<b>${active} of ${a} active</b> · ${b.sales} sales each a month`;
      $('#cp-now').textContent = peso(now);
      $('#cp-now-how').textContent = `${s} ${s === 1 ? 'shop' : 'shops'} × ₱1,750`;
      $('#cp-monthly').textContent = peso(monthly);
      $('#cp-monthly-how').textContent = `${sales} ${sales === 1 ? 'sale' : 'sales'} by your agents × ₱150`;
      $('#cp-total').textContent = peso(now + monthly);
      paint(shops); paint(agents);
    }
    if (shops && agents) {
      shops.addEventListener('input', calc); agents.addEventListener('input', calc);
      $$('.cp-seg button').forEach((btn) => btn.addEventListener('click', () => {
        busy = btn.dataset.busy;
        $$('.cp-seg button').forEach((x) => { x.classList.toggle('is-on', x === btn); x.setAttribute('aria-checked', x === btn); });
        calc();
      }));
      calc();
    }

    faq([
      ['Do I need to visit shops?', 'No. Field agents visit shops. You share your link and code online, where people already follow you.'],
      ['How much do I get when a shop uses my code?', 'With the usual 30% off, the shop pays ₱3,499 and you keep ₱1,750. You can give a bigger discount, down to ₱999. You always keep half of what the shop pays.'],
      ['How does the monthly money work?', 'When someone joins as a field agent through your link, you get 5% of every sale they make for 12 months from the day they join. On a ₱2,999 sale that is ₱150. It never comes out of the agent’s half.'],
      ['When do I get paid?', 'Your shop money after the shop pays. Your 5% after the shop has paid in full. You send it to your Wise account from your portal.'],
      ['Do I earn when people sign up?', 'No. Only real, paid sales count. No sale, no payout.'],
      ['Is this a pyramid scheme?', 'No. It is free to join, nothing is paid for sign-ups, and there is one level only: you never earn on the people your agents bring in.'],
      ['Can I use my code for my own shop?', 'No. You never earn on your own shop.'],
      ['What if someone forgets my code?', 'On iPhone the app asks once: “Did Mika send you?”. There is also a “Who sent you?” box at sign-up and at checkout.'],
    ]);
  }

  // ================= sign-up =================
  function signup() {
    faces();
    const steps = $$('.su-step'), n = steps.length;
    const q = new URLSearchParams(location.search);
    let cur = Math.min(n, Math.max(1, +q.get('step') || 1));
    const backBtn = $('#su-back'), prog = $('#su-prog');
    const mock = $('#su-mock');
    mock.innerHTML = '<span>Mock: jump to step</span>' + steps.map((_, i) => `<button type="button" data-go="${i + 1}">${i + 1}</button>`).join('');
    function show(i) {
      cur = i;
      steps.forEach((s, k) => s.classList.toggle('is-on', k === i - 1));
      backBtn.disabled = i === 1 || i === n;
      prog.style.setProperty('--p', (i / n) * 100 + '%');
      $$('button', mock).forEach((b) => b.classList.toggle('is-on', +b.dataset.go === i));
      const h = steps[i - 1].querySelector('.su-h');
      if (h && document.activeElement && document.activeElement !== document.body) h.setAttribute('tabindex', '-1'), h.focus({ preventScroll: true });
    }
    $$('[data-next]').forEach((b) => b.addEventListener('click', (e) => { e.preventDefault(); show(Math.min(n, cur + 1)); }));
    backBtn.addEventListener('click', () => show(Math.max(1, cur - 1)));
    $$('button', mock).forEach((b) => b.addEventListener('click', () => show(+b.dataset.go)));
    // toggles
    $$('.su-plat button').forEach((b) => b.addEventListener('click', () => { b.classList.toggle('is-on'); b.setAttribute('aria-pressed', b.classList.contains('is-on')); }));
    $$('.su-sizes button').forEach((b) => b.addEventListener('click', () => $$('.su-sizes button').forEach((x) => { x.classList.toggle('is-on', x === b); x.setAttribute('aria-checked', x === b); })));
    // handle → live preview
    const handle = $('#su-handle');
    handle?.addEventListener('input', () => {
      const h = handle.value.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 16) || 'mika';
      $('#su-pv-shop').textContent = `tendso.com/a/${h}`;
      $('#su-pv-earn').textContent = `tendso.com/a/${h}/earn`;
      $('#su-pv-code').textContent = h.toUpperCase();
    });
    show(cur);
  }

  // ================= portal =================
  function portal() {
    faces();
    const AG = CL.AGENTS;
    const active = AG.filter((a) => a.sales > 0);
    const sales = active.reduce((t, a) => t + a.sales, 0);
    const nextEnd = [...AG].sort((x, y) => x.joined.localeCompare(y.joined))[0];
    const SHOPS = [
      ['photos/showcase/tailor-owner.jpg', 'Lito’s Tailoring', 'Tailor', 'Marikina', '19 Oct'],
      ['photos/showcase/vulca-owner.jpg', 'Vulca Garage', 'Auto repair', 'Cebu City', '17 Oct'],
      ['photos/hela-owner.jpg', 'Héla Hair Studio', 'Hair salon', 'Makati', '15 Oct'],
      ['photos/showcase/bike-owner.jpg', 'Pedal Pinoy', 'Bike repair', 'Pasig', '12 Oct'],
      ['photos/showcase/print-owner.jpg', 'Tinta Print Shop', 'Printing', 'Quezon City', '9 Oct'],
      ['photos/showcase/petgroom-owner.jpg', 'Ate Grace Pet Grooming', 'Pet grooming', 'Taguig', '6 Oct'],
      ['photos/showcase/phonefix-owner.jpg', 'Kuya Ben Phone Fix', 'Phone repair', 'Manila', '2 Oct'],
    ];
    const months = (iso) => { const m = CL.monthsLeft(iso); return `<span class="m" aria-hidden="true">${Array.from({ length: 12 }, (_, i) => `<i${i < m ? ' class="on"' : ''}></i>`).join('')}</span>`; };
    const left = (iso) => { const m = CL.monthsLeft(iso); return m === 1 ? '1 month left' : `${m} months left`; };
    const ends = (iso) => CL.fmtDate(CL.endOf(iso));
    const joined = (iso) => CL.fmtDate(new Date(iso + 'T12:00:00'));

    // income
    $('#pt-inc').innerHTML = `
      <article class="pt-incc pt-incc--now">
        <div class="pt-incc-top"><span class="cp-pill">Money now</span><span>From shops using MIKA</span></div>
        <p class="pt-num">${peso(CL.MONTH.now)}</p>
        <p class="pt-sub">7 shops this month · ₱1,750 each</p>
        <div class="pt-incc-list">${SHOPS.slice(0, 3).map(([img, name, , , d]) => `<div><img class="pt-shopimg" style="width:32px;height:32px;border-radius:10px" src="${A + img}" alt=""><b>${name}</b><span class="r">₱1,750<small>${d}</small></span></div>`).join('')}</div>
      </article>
      <article class="pt-incc pt-incc--monthly">
        <div class="pt-incc-top"><span class="cp-pill">Monthly money</span><span>From your field agents</span></div>
        <p class="pt-num">${peso(CL.MONTH.monthly)}</p>
        <p class="pt-sub">${active.length} agents active · ${sales} sales · next ends ${ends(nextEnd.joined)}</p>
        <div class="pt-incc-list">${active.slice(0, 3).map((a) => `<div>${faceEl(a.k, 32, a.name)}<b>${a.name}</b><span class="r">${a.sales} sales<small>ends ${ends(a.joined)}</small></span></div>`).join('')}</div>
      </article>`;

    // links + code
    $('#pt-links').innerHTML = `
      <div class="pt-h"><h2>Your links and code</h2><span>Share these anywhere</span></div>
      <div class="pt-links">
        <div class="pt-link"><span class="l">For shops</span><span class="v">${CL.ME.shopLink}</span><div class="acts"><button class="pt-btn" data-copy="https://${CL.ME.shopLink}">${ICON.copy}Copy</button><button class="pt-btn pt-btn--accent">${ICON.share}Share</button></div></div>
        <div class="pt-link"><span class="l">For field agents</span><span class="v">${CL.ME.agentLink}</span><div class="acts"><button class="pt-btn" data-copy="https://${CL.ME.agentLink}">${ICON.copy}Copy</button><button class="pt-btn">${ICON.share}Share</button></div></div>
        <div class="pt-link"><span class="l">Your code · 30% off</span><span class="v pt-code">MIKA</span><div class="acts"><button class="pt-btn" data-copy="MIKA">${ICON.copy}Copy</button></div></div>
      </div>
      <p class="pt-codenote">Shops pay ₱3,499 and you keep ₱1,750. <a href="#discount">Change the discount</a></p>`;

    // funnel
    const F = {
      shop: [['Clicks', 2480], ['Downloads', 412], ['Sign-ups', 63], ['Sales', 7]],
      agent: [['Clicks', 1130], ['Downloads', 188], ['Sign-ups', 5], ['Approved', 3]],
    };
    const funnel = (k) => {
      const d = F[k], max = d[0][1];
      $('#pt-funnel-body').innerHTML = d.map(([n, v], i) => `<div class="pt-fstep"><span class="n">${n}</span><span class="bar"><i style="--w:${Math.sqrt(v / max) * 100}%"></i></span><span class="v">${v.toLocaleString('en-US')}${i ? `<small>${((v / d[i - 1][1]) * 100).toFixed(v / d[i - 1][1] < 0.1 ? 1 : 0)}% of ${d[i - 1][0].toLowerCase()}</small>` : '<small>this month</small>'}</span></div>`).join('');
    };
    $('#pt-funnel').innerHTML = `
      <div class="pt-h"><h2>From click to sale</h2><div class="pt-tabs" role="tablist"><button role="tab" aria-selected="true" class="is-on" data-f="shop">Shop link</button><button role="tab" aria-selected="false" data-f="agent">Agent link</button></div></div>
      <div class="pt-funnel" id="pt-funnel-body"></div>`;
    $$('#pt-funnel .pt-tabs button').forEach((b) => b.addEventListener('click', () => {
      $$('#pt-funnel .pt-tabs button').forEach((x) => { x.classList.toggle('is-on', x === b); x.setAttribute('aria-selected', x === b); });
      funnel(b.dataset.f);
    }));
    funnel('shop');

    // recruited agents
    const quiet = AG.filter((a) => !a.sales);
    const agentRow = (a) => `<tr class="${a.sales ? '' : 'is-quiet'}"><td><div class="pt-who">${faceEl(a.k, 40, a.name)}<div><b>${a.name}</b><span>${a.city}</span></div></div></td>
      <td>${joined(a.joined)}</td><td class="num">${a.sales || '—'}</td><td class="num"><b>${a.cut ? peso(a.cut) : '—'}</b></td><td>${ends(a.joined)}</td>
      <td><div class="pt-left">${months(a.joined)}<span>${CL.monthsLeft(a.joined)} mo</span></div></td></tr>`;
    const agentCard = (a) => `<div class="pt-c${a.sales ? '' : ' is-quiet'}"><div class="pt-who">${faceEl(a.k, 40, a.name)}<div><b>${a.name}</b><span>${a.city}</span></div></div>
      <div class="r">${a.cut ? peso(a.cut) : '—'}<small>${a.sales ? a.sales + (a.sales === 1 ? ' sale' : ' sales') : 'No sale yet'}</small></div>
      <div class="meta"><span>Joined ${joined(a.joined)}</span><span>${left(a.joined)}</span></div></div>`;
    $('#pt-agents').innerHTML = `
      <div class="pt-h"><h2>Your field agents</h2><span>${AG.length} joined through your link · ${active.length} made a sale this month</span></div>
      <div class="pt-tablewrap"><table class="pt-table"><thead><tr><th>Agent</th><th>Joined</th><th class="num">Sales this month</th><th class="num">Your 5%</th><th>Ends</th><th style="text-align:right">Months left</th></tr></thead>
        <tbody>${active.map(agentRow).join('')}${quiet.map(agentRow).join('')}</tbody></table></div>
      <div class="pt-cards">${active.map(agentCard).join('')}</div>
      <p class="pt-more pt-cards-more">${quiet.length} more agents with no sale this month. You earn when they sell.</p>`;
    // on desktop the quiet rows are in the table; the line is only for phones
    $('.pt-cards-more').classList.add('pt-cards');

    // shops
    const shopRow = ([img, name, kind, city, d]) => `<tr><td><div class="pt-who"><img class="pt-shopimg" src="${A + img}" alt=""><div><b>${name}</b><span>${kind} · ${city}</span></div></div></td>
      <td>${d}</td><td class="num"><s style="color:var(--muted)">₱4,999</s> ₱3,499</td><td class="num"><b>₱1,750</b></td><td><span class="pt-st pt-st--ok">Paid</span></td></tr>`;
    const shopCard = ([img, name, kind, city, d]) => `<div class="pt-c"><div class="pt-who"><img class="pt-shopimg" src="${A + img}" alt=""><div><b>${name}</b><span>${kind} · ${city}</span></div></div>
      <div class="r">₱1,750<small>Paid ₱3,499</small></div></div>`;
    $('#pt-shops').innerHTML = `
      <div class="pt-h"><h2>Shops that used your code</h2><span>October · 7 shops</span></div>
      <div class="pt-tablewrap"><table class="pt-table"><thead><tr><th>Shop</th><th>Date</th><th class="num">Paid</th><th class="num">You keep</th><th>Status</th></tr></thead><tbody>${SHOPS.map(shopRow).join('')}</tbody></table></div>
      <div class="pt-cards">${SHOPS.map(shopCard).join('')}</div>`;

    // payouts
    const HIST = [['30 Sep 2026', 14350], ['31 Aug 2026', 11900], ['31 Jul 2026', 8750], ['30 Jun 2026', 4200]];
    $('#pt-pay').innerHTML = `
      <div class="pt-h"><h2>Payouts</h2><span>To your Wise account</span></div>
      <div class="pt-pay">
        <div class="pt-bal">
          <span class="l">Ready to send</span>
          <span class="big">₱16,000</span>
          <span class="to">To Wise · <b>${CL.ME.email}</b></span>
          <div class="pt-wait"><b>₱600 waiting</b><span>3 shops are still paying. Your 5% comes when they finish.</span></div>
          <a class="btn btn--accent" href="#send">Send ₱16,000 to Wise</a>
        </div>
        <div class="pt-hist">${HIST.map(([d, a]) => `<div><span class="d"><b>Sent to Wise</b><span>${d}</span></span><span class="pt-st pt-st--ok">Done</span><span class="a">${peso(a)}</span></div>`).join('')}</div>
      </div>`;

    // tips
    $('#pt-tips').innerHTML = `<p class="pt-tips-l">Tips that work</p>
      <div class="pt-tip"><i>1</i>Pin your shop link in your bio.</div>
      <div class="pt-tip"><i>2</i>Show a real shop’s before and after. It gets the most clicks.</div>
      <div class="pt-tip"><i>3</i>Share your agent link when you talk about side income.</div>`;

    copies();
  }

  // ================= /a/<handle> (shop) and /a/<handle>/earn =================
  function linkPage() {
    faces(); stores(); copies();
    $$('[data-site]').forEach((el) => { el.prepend(sitePhone(A + 'sites/' + el.dataset.site + '-m.jpg', el.dataset.alt || '')); });
    T.fitPhones();
  }

  window.CP = { program, signup, portal, shop: linkPage, earn: linkPage, faces, stores };
})();
