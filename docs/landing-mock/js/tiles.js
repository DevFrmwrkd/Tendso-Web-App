/* The grid: what goes into a homepage. One living thing per tile, each showing the app on a phone.
   Hover reveals one line; click opens the step large. The first cell (#slot-stage) receives the hero stage. */
(function () {
  const ctrls = [];
  const P = () => TD.price;
  const peso = (n) => P().currency + Math.round(n).toLocaleString('en-US');

  // the guided-capture screens replace the older ones when they exist (interview-cam, shot-guide)
  const UPGRADE = {
    'interview-rec': ['interview-cam', { video: 'assets/video/interview-2.mp4', poster: 'assets/video/interview-2.jpg', lang: 'en' }],
    photos: ['shot-guide', { type: 'barber' }],
  };
  function mountScreen(phone, name, opts = {}) {
    if (window.TendsoScreens) {
      const up = UPGRADE[name];
      if (up && (TendsoScreens.names || []).includes(up[0])) { name = up[0]; opts = { ...up[1], ...opts }; }
      try { return TendsoScreens.mount(phone.screen, name, opts); } catch (e) { console.error(e); }
    }
    phone.screen.innerHTML = `<img src="assets/sites/showcase/forge-m.jpg" alt="" style="width:390px;height:844px;object-fit:cover">`;
    return null;
  }

  // ---------- Words: voice → transcript → site copy ----------
  function words(el) {
    el.innerHTML = `
      <header class="tl-head"><h3 class="tl-title">10 simple questions. Your words become the site.</h3></header>
      <div class="tl-phone tl-phone--words"></div>
      <div class="wd-flow">
        <div class="wd-wave" aria-hidden="true">${'<i></i>'.repeat(28)}</div>
        <p class="wd-quote"><q class="wd-type"></q></p>
        <div class="wd-arrow" aria-hidden="true"><svg viewBox="0 0 24 24" width="18" height="18"><path d="M12 4v16m0 0-6-6m6 6 6-6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
        <div class="wd-site"><img src="assets/photos/forge/pro2-headshot.jpg" alt=""><div class="wd-site-copy">${TD.words.copy.map((l) => `<span>${l}</span>`).join('')}</div></div>
      </div>
      <p class="tl-more">The interview is transcribed, then written into your pages. In your words, not ours.</p>`;
    const ph = T.phone({ size: 'sm' }); el.querySelector('.tl-phone').appendChild(ph.el);
    const scr = mountScreen(ph, 'interview-rec', { owner: true });
    const bars = [...el.querySelectorAll('.wd-wave i')];
    const type = el.querySelector('.wd-type');
    const site = el.querySelector('.wd-site');
    const text = TD.words.transcript;
    let t0 = 0, running = false;
    const LOOP = 11000;
    const tick = (now) => {
      if (!running) return;
      const t = (now - t0) % LOOP;
      const speaking = t < 5200;
      bars.forEach((b, i) => {
        const v = speaking ? 0.25 + 0.75 * Math.abs(Math.sin(now / 170 + i * 0.7) * Math.sin(now / 410 + i * 0.31)) : 0.12;
        b.style.transform = `scaleY(${v.toFixed(3)})`;
      });
      const chars = Math.floor(T.prog(t, 500, 5200) * text.length);
      if (type.dataset.n !== String(chars)) { type.textContent = text.slice(0, chars); type.dataset.n = chars; }
      site.classList.toggle('is-on', t > 5800 && t < LOOP - 600);
    };
    const stopFrame = T.onFrame(tick);
    return {
      play() { if (running) return; running = true; t0 = performance.now(); scr?.play?.(); if (T.reduced) { type.textContent = text; site.classList.add('is-on'); running = false; } },
      pause() { running = false; scr?.pause?.(); },
      destroy: stopFrame,
    };
  }

  // ---------- Images: six of the shop's photos, each turning from the phone shot into the Tendso one ----------
  // Theo 2026-10-21: show more than one image. A 3 × 2 grid; one tile at a time wipes phone → Tendso, then all reset.
  // new photographs of the same man in the same shop (pro3-*, made with his face + the shop as references)
  const IMG_SET = [
    ['phone-headshot', 'pro3-headshot', 'Owner'],
    ['phone-outside', 'pro3-outside', 'Shop front'],
    ['phone-tools', 'pro3-tools', 'Tools'],
    ['phone-finished', 'pro3-finished', 'Finished cut'],
    ['phone-haircut', 'pro3-detail', 'Detail'],
  ];
  function images(el) {
    const F = 'assets/photos/forge/';
    el.innerHTML = `
      <header class="tl-head"><h3 class="tl-title">10 guided photos. Shot like a campaign.</h3></header>
      <div class="im-key" aria-hidden="true"><span class="im-key-a">Phone</span><i></i><span class="im-key-b">Tendso</span></div>
      <div class="im-grid">${IMG_SET.map(([a, b2, t]) => `
        <figure class="im-cell"><img class="im-a" src="${F}${a}.jpg" alt="${t}, phone photo"><img class="im-b" src="${F}${b2}.jpg" alt="${t}, by Tendso"><figcaption>${t}</figcaption></figure>`).join('')}
        <div class="im-more"><b>+5</b><span>more shots, one at a time in the app</span></div></div>
      <p class="tl-more">Same man, same shop. Every photo shot again, properly. The app asks for each of the 10 shots, one at a time.</p>`;
    const cells = [...el.querySelectorAll('.im-cell')];
    let running = false, t0 = 0;
    const STEP = 850, HOLD = 2600, LOOP = cells.length * STEP + HOLD;
    T.onFrame((now) => {
      if (!running) return;
      const t = (now - t0) % LOOP;
      cells.forEach((c, i) => c.classList.toggle('is-pro', t >= 400 + i * STEP && t < LOOP - 300));
    });
    return { play() { running = true; t0 = performance.now(); if (T.reduced) { cells.forEach((c) => c.classList.add('is-pro')); running = false; } }, pause() { running = false; } };
  }

  // ---------- Cost: they charge every month, Tendso once ----------
  // Three rows over one year. Each block is one payment: 12 for the agency and for Wix/Webflow, one for Tendso.
  // The months fill quickly and the yearly totals count up; Tendso's single payment is there from the start.
  function cost(el) {
    const once = P().once, rows = P().compare;
    el.innerHTML = `
      <header class="tl-head"><h3 class="tl-title">Pay once. Not every month.</h3></header>
      <div class="cs">
        <span class="cs-cap">One year of having a website</span>
        ${rows.map((r, i) => `
          <div class="cs-row" data-row="${i}">
            <div class="cs-k"><b>${r.name}</b><span class="cs-v"><b class="cs-total">${peso(0)}</b><i>${peso(r.monthly)} every month</i></span></div>
            <div class="cs-ticks">${'<i></i>'.repeat(12)}</div>
          </div>`).join('')}
        <div class="cs-row cs-row--once">
          <div class="cs-k"><b>Tendso</b><span class="cs-v"><b>${peso(once)}</b><i>once, or ${peso(P().instalment.monthly)} a month for ${P().instalment.months} months</i></span></div>
          <div class="cs-ticks cs-ticks--once"><i></i>${'<i class="is-free"></i>'.repeat(11)}</div>
        </div>
      </div>
      <div class="tl-phone tl-phone--cost"></div>
      <p class="tl-more">See your finished site first, then pay once to publish. Hosting included. No monthly fees.</p>`;
    const ph = T.phone({ size: 'sm' }); el.querySelector('.tl-phone').appendChild(ph.el);
    const scr = mountScreen(ph, 'site-ready');
    const R = rows.map((r, i) => ({ r, ticks: [...el.querySelectorAll(`[data-row="${i}"] .cs-ticks i`)], tot: el.querySelector(`[data-row="${i}"] .cs-total`) }));
    let running = false, t0 = 0;
    const STEP = 160, HOLD = 4200, LOOP = 12 * STEP + HOLD;
    function show(n) {
      R.forEach(({ r, ticks, tot }) => { ticks.forEach((t, i) => t.classList.toggle('is-on', i < n)); tot.textContent = peso(n * r.monthly); });
    }
    T.onFrame((now) => {
      if (!running) return;
      show(Math.min(12, Math.floor(((now - t0) % LOOP) / STEP) + 1));
    });
    return {
      play() { running = true; t0 = performance.now(); el.classList.add('is-live'); scr?.play?.(); if (T.reduced) { running = false; show(12); } },
      pause() { running = false; scr?.pause?.(); },
    };
  }

  // ---------- Humans: field agents near you ----------
  function humans(el) {
    el.innerHTML = `
      <header class="tl-head"><h3 class="tl-title">Rather not do it yourself? Someone comes over.</h3></header>
      <div class="hm-map">${mapSVG()}
        <div class="hm-shop"><i></i><span class="label">Your shop</span></div>
        ${TD.agents.map((a, i) => `<div class="hm-pin" style="--i:${i}" data-i="${i}"><b>${a.initial}</b></div>`).join('')}
      </div>
      <figure class="hm-agent"><img src="assets/people/17-mika.jpg" alt="Mika, a Tendso field agent"><figcaption><b>${TD.agents[0].name}</b><span>${TD.agents[0].dist} away · ${TD.agents[0].note}</span></figcaption></figure>
      <div class="tl-phone tl-phone--humans"></div>
      <p class="tl-more">A local field agent visits with the same app. About 30 minutes at your shop.</p>`;
    const ph = T.phone({ size: 'sm' }); el.querySelector('.tl-phone').appendChild(ph.el);
    const scr = mountScreen(ph, 'agents-near');
    return { play() { el.classList.add('is-live'); scr?.play?.(); }, pause() { scr?.pause?.(); } };
  }

  // quiet vector town (no map tiles): blocks, streets, a river
  function mapSVG() {
    return `<svg class="hm-svg" viewBox="0 0 800 460" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <rect width="800" height="460" class="m-ground"/>
      <path class="m-river" d="M-20 380 C 120 330, 220 420, 360 370 S 620 300, 820 340 L 820 470 L -20 470 Z"/>
      <g class="m-blocks">
        <rect x="40" y="40" width="150" height="90" rx="6"/><rect x="220" y="40" width="120" height="90" rx="6"/><rect x="370" y="40" width="180" height="90" rx="6"/><rect x="580" y="40" width="180" height="90" rx="6"/>
        <rect x="40" y="160" width="90" height="120" rx="6"/><rect x="160" y="160" width="180" height="120" rx="6"/><rect x="370" y="160" width="100" height="120" rx="6"/><rect x="500" y="160" width="260" height="120" rx="6"/>
        <rect x="40" y="306" width="230" height="40" rx="6"/><rect x="300" y="306" width="160" height="34" rx="6"/><rect x="490" y="296" width="140" height="30" rx="6"/>
      </g>
      <g class="m-roads"><path d="M0 145 H800"/><path d="M0 293 H800"/><path d="M205 0 V300"/><path d="M355 0 V300"/><path d="M565 0 V290"/><path d="M145 150 V300"/><path d="M485 150 V300"/></g>
      <path class="m-route" d="M250 222 C 300 222, 330 150, 420 146 S 520 150, 560 110"/>
    </svg>`;
  }

  // ---------- detail sheet (click a tile) ----------
  const DETAIL = {
    words: { screen: 'interview-rec', opts: { video: 'assets/video/interview-2.mp4', poster: 'assets/video/interview-2.jpg' }, title: '10 simple questions.', lines: ['One question at a time, out loud, on camera. Then anything else you want to say.', 'The recording is transcribed and written into your pages.', 'Your words, your city, your products. Good for Google too.'] },
    images: { screen: 'photos', title: '10 guided photos.', lines: ['The app asks for each shot your kind of business needs: owner, outside, inside, equipment, best sellers.', 'A framing guide shows what to fit in the picture. Add any extra photos you like.', 'Each one comes back like a campaign shot: same subject, same place.'] },
    cost: { screen: 'site-ready', title: 'Pay once. Not every month.', lines: ['Agencies and website builders charge you every month. Tendso is one payment, or ₱500 a month for 10 months.', 'You see your finished site first. Then you pay once to publish it.', `One payment of ${peso(4999)} in the Philippines, or as low as ${peso(999)} when a Tendso creator signs you up.`, 'Hosting and your own web address are included.'] },
    humans: { screen: 'agents-near', title: 'Someone comes over.', lines: ['A local field agent (a Tendso creator) visits your shop with the same app.', 'About 30 minutes with you. Your site is ready about 20 minutes later.', 'Book in the app, or send a request on this page.'] },
  };
  function openDetail(key) {
    const d = DETAIL[key]; if (!d) return;
    const sheet = document.getElementById('tile-detail');
    sheet.querySelector('.td-title').textContent = d.title;
    sheet.querySelector('.td-lines').innerHTML = d.lines.map((l, i) => `<li style="--i:${i}">${l}</li>`).join('');
    const slot = sheet.querySelector('.td-phone'); slot.innerHTML = '';
    const ph = T.phone({ size: 'lg' }); slot.appendChild(ph.el); T.fitPhones(slot);
    const c = mountScreen(ph, d.screen, { owner: true, ...(d.opts || {}) }); c?.play?.();
    window.lucide?.createIcons({ attrs: { 'stroke-width': 1.8 } });
    sheet.hidden = false; requestAnimationFrame(() => sheet.classList.add('is-open'));
    sheet.querySelector('.td-close').focus();
    T.stop();
  }
  function closeDetail() {
    const sheet = document.getElementById('tile-detail');
    sheet.classList.remove('is-open'); T.start();
    setTimeout(() => { sheet.hidden = true; sheet.querySelector('.td-phone').innerHTML = ''; }, 500);
  }

  // ---------- the first tile: once the hero has shrunk into it, a gallery of the best Tendso sites ----------
  // Three columns drifting at different speeds (the middle one the other way). Only clean, finished captures:
  // no food, nothing cut off, no browser chrome or addresses (Theo 2026-10-21).
  // 22 different sites, alternating looks so no column shows two similar ones in a row
  const BEST = ['bike', 'surf', 'dental', 'florist', 'phonefix', 'tattoo', 'forge', 'petgroom', 'dive', 'carpenter', 'sarisari',
    'photo', 'print', 'baker', 'halohalo', 'tutor', 'vulca', 'hela', 'tailor', 'labana', 'ceramics', 'domingo'];
  function gallery(slot) {
    if (!slot) return;
    const cols = [0, 1, 2].map((c) => BEST.filter((_, i) => i % 3 === c));
    const col = (list, k) => `<div class="gal-col gal-col--${k}"><div class="gal-track">${[...list, ...list].map((id) => `<a class="gal-card" href="showcase/${id}.html" target="_blank" rel="noopener" aria-label="Open the ${id} example site"><img src="assets/sites/showcase/${id}-d.jpg" alt="" loading="lazy" decoding="async"></a>`).join('')}</div></div>`;
    slot.insertAdjacentHTML('afterbegin', `<div class="gal" aria-label="Sites made with the Tendso app">${cols.map(col).join('')}</div>`);
  }

  window.TendsoTiles = {
    init() {
      const sec = document.getElementById('grid');
      sec.innerHTML = `
        <div class="wrap grid">
          <div class="tile tile--slot" id="slot-stage" aria-label="Sites made with the Tendso app"></div>
          <article class="tile tl tl--words" data-tile="words" data-reveal style="--i:1" tabindex="0"></article>
          <article class="tile tl tl--images" data-tile="images" data-reveal tabindex="0"></article>
          <article class="tile tl tl--cost" data-tile="cost" data-reveal style="--i:1" tabindex="0"></article>
          <div class="tile tile--quiet moment" data-reveal>
            <h2 class="moment-t">See it first.<br>Pay once.</h2>
            
          </div>
          <article class="tile tl tl--humans" data-tile="humans" data-reveal tabindex="0"></article>
        </div>
        <div class="td" id="tile-detail" hidden role="dialog" aria-modal="true" aria-labelledby="td-title">
          <div class="td-scrim" data-close></div>
          <div class="td-card">
            <button class="td-close" type="button" data-close aria-label="Close"><svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 3l10 10M13 3 3 13" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg></button>
            <div class="td-phone"></div>
            <div class="td-copy"><span class="label">In the app</span><h3 class="td-title" id="td-title"></h3><ul class="td-lines"></ul>
              <div class="td-cta"><a class="btn btn--accent" href="#download" data-close>Download the app</a><a class="btn btn--line" href="#hire" data-close>Hire an agent</a></div></div>
          </div>
        </div>`;
      document.body.appendChild(document.getElementById('tile-detail')); // above every section's stacking layer
      gallery(document.getElementById('slot-stage'));
      const make = { words, images, cost, humans };
      sec.querySelectorAll('.tl').forEach((el) => {
        const key = el.dataset.tile;
        const c = make[key](el);
        ctrls.push({ el, c });
        el.addEventListener('click', (e) => { if (!e.target.closest('button, .ba')) openDetail(key); });
        el.addEventListener('keydown', (e) => { if (e.key === 'Enter') openDetail(key); });
      });
      document.getElementById('tile-detail').addEventListener('click', (e) => { if (e.target.closest('[data-close]')) closeDetail(); });
      addEventListener('keydown', (e) => { if (e.key === 'Escape' && !document.getElementById('tile-detail').hidden) closeDetail(); });
    },
    ready() {
      T.fitPhones(document.getElementById('grid'));
      ctrls.forEach(({ el, c }) => T.inView(el, (on) => (on ? c.play() : c.pause?.()), { threshold: 0.25 }));
    },
  };
})();
