/* Tendso app screens for the landing mock (window.TendsoScreens). Agent A2.
   v3, Round 2 language (APP-SYSTEM.md, last section): Onest only, bold rounded headlines, pill buttons,
   soft white cards, the Tendso ring mark instead of a mascot. Kit: css/app-kit.css (kit v3 classes).
   Real app screens redrawn at 390×844, plus PROPOSED screens flagged data-proposed="true".

   TendsoScreens.mount(screenEl, name, opts) → { el, play(), pause(), reset(), set(key, value), destroy() }
     names: welcome · interview-rec · photos · design-picker* · site-ready* · agents-near* · site-browser
            guided capture*: interview-list · interview-cam · shot-list · shot-guide
     opts.owner: owner-facing copy (interview-rec, photos, interview-*); default is the creator/field-agent copy.
     interview-cam: opts.video ('assets/video/interview-1.mp4'), opts.poster, opts.type ('food'|'barber'|'sari',
       picks the still used until the video exists), opts.lang ('en'|'tl' primary), opts.question (idle frame).
     shot-list / shot-guide: opts.type ('barber'|'food'|'salon'); shot-guide opts.start (0-based task;
       default barber/salon 0, food 4), shot-list opts.done (same default).
     play() is idempotent; pause() stops every loop and timer; reset() returns to the idle frame.
     With prefers-reduced-motion, play() shows the end state and never loops.
   Icons are Lucide (window.lucide), rendered into each screen only (scoped, synchronous). */
(function () {
  // asset base: resolve from this script's own URL so screens work from index.html, app/, pages/ and tools/
  const BASE = (() => {
    try { return new URL('../', document.currentScript.src).href; } catch (e) { return ''; }
  })();
  const asset = (p) => (/^(https?:|file:|data:|\/)/.test(p) ? p : BASE + p);
  const reduced = () => !!(window.T && window.T.reduced);
  const TD = () => window.TD || {};
  const EASE = 'cubic-bezier(.22,1,.36,1)';
  const EASE_INOUT = 'cubic-bezier(.65,0,.35,1)';
  const MARK = () => asset('assets/brand/mark-ink-256.png');

  // ---------- icons (Lucide, scoped to one screen) ----------
  const ic = (name, size = 18, cls = '', sw = 1.8) =>
    `<i data-lucide="${name}" data-size="${size}" data-sw="${sw}" class="${cls}"></i>`;
  function hydrateIcons(root) {
    const L = window.lucide;
    if (!L || !L.icons || !L.createElement) return;
    root.querySelectorAll('i[data-lucide]').forEach((i) => {
      const name = i.getAttribute('data-lucide');
      const key = name.replace(/(^|-)([a-z0-9])/g, (m, a, c) => c.toUpperCase());
      const node = L.icons[key];
      if (!node) return;
      const svg = L.createElement(node);
      const s = i.dataset.size || 24;
      svg.setAttribute('width', s);
      svg.setAttribute('height', s);
      svg.setAttribute('stroke-width', i.dataset.sw || 1.8);
      svg.setAttribute('aria-hidden', 'true');
      svg.setAttribute('class', `lucide lucide-${name} ${i.className}`.trim());
      i.replaceWith(svg);
    });
  }

  // ---------- timers: everything a screen starts goes through here ----------
  function makeRunner() {
    const timers = new Set();
    const offs = new Set();
    return {
      after(ms, fn) {
        const id = setTimeout(() => { timers.delete(id); fn(); }, ms);
        timers.add(id);
        return id;
      },
      frame(fn) {
        if (!window.T || !window.T.onFrame) return () => {};
        const off = window.T.onFrame(fn);
        offs.add(off);
        return () => { off(); offs.delete(off); };
      },
      clear() {
        timers.forEach(clearTimeout); timers.clear();
        offs.forEach((o) => o()); offs.clear();
      },
    };
  }

  const sb = (dark) => (window.T && window.T.statusBar ? window.T.statusBar(dark) : '');
  const reflow = (el) => void el.offsetWidth;
  const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  const site = (id) => (TD().sites || []).find((s) => s.id === id) || { id, url: `${id}.tendso.site` };
  const priceText = () => (TD().price ? `${TD().price.currency}${TD().price.once.toLocaleString('en-US')}` : '₱4,999');

  // Round 2 step header: back · (label) · progress · "n / total"
  const stepHead = (n, total, label = '') => `
    <header class="s-head"><div class="a-step">
      <span class="a-back">${ic('chevron-left', 20, '', 2.4)}</span>
      ${label ? `<span class="s-step-l">${label}</span>` : ''}
      <div class="a-progress"><i style="--p:${Math.round((n / total) * 100)}%"></i></div>
      <b class="s-step-n">${n} / ${total}</b>
    </div></header>`;

  // a face crop from a larger photo: fx/fy = face centre (0..1 of the image), z = zoom (image width ÷ avatar width)
  const face = (p) => {
    const a = p.ar || 1;
    const w = p.z * 100;
    return `<img src="${asset(p.src)}" alt="" style="width:${w}%;left:${50 - p.fx * w}%;top:${50 - (p.fy * w) / a}%">`;
  };

  // =====================================================================================
  // 1. welcome (REAL: app/index.tsx, redrawn as Round 2 O1)
  // =====================================================================================
  const WELCOME_PHOTOS = [
    { src: 'assets/photos/kalan-pandesal.jpg', alt: 'Pandesal at a neighbourhood bakery', s: 'left:-24px;top:64px;width:172px;height:222px' },
    { src: 'assets/photos/hela-hero.jpg', alt: 'A salon stylist at work', s: 'left:160px;top:22px;width:142px;height:170px' },
    { src: 'assets/photos/kalan-hero.jpg', alt: 'Tapsilog at a Filipino kitchen', s: 'left:314px;top:84px;width:130px;height:172px' },
    { src: 'assets/people/03-barber.jpg', alt: 'A barbershop', s: 'left:10px;top:300px;width:130px;height:140px' },
    { src: 'assets/people/16-baguio.jpg', alt: 'A flower shop', s: 'left:154px;top:206px;width:166px;height:224px;z-index:2' },
    { src: 'assets/people/01-sarisari.jpg', alt: 'A sari-sari store', s: 'left:304px;top:270px;width:120px;height:150px' },
  ];
  function welcome(el, opts, run) {
    // Theo 2026-10-21: feel like a real app's first screen — living walls of real shops, the buddy, one line, one button
    const COLS = [
      ['assets/photos/kalan-hero.jpg', 'assets/people/03-barber.jpg', 'assets/photos/hela-hero.jpg', 'assets/people/16-baguio.jpg'],
      ['assets/people/01-sarisari.jpg', 'assets/photos/after-kalan.jpg', 'assets/people/12-salon.jpg', 'assets/photos/kalan-pandesal.jpg'],
      ['assets/photos/after-mechanic.jpg', 'assets/people/15-carinderia.jpg', 'assets/photos/labana-stacks.jpg', 'assets/people/02-panaderya.jpg'],
    ];
    const col = (list, k) => `<div class="w2-col w2-col--${k}"><div class="w2-track">${[...list, ...list].map((src) => `<img src="${asset(src)}" alt="">`).join('')}</div></div>`;
    el.innerHTML = `
      ${sb(false)}
      <div class="w2-wall">${COLS.map(col).join('')}</div>
      <div class="w2-fade"></div>
      <div class="w2-in">
        <img class="w2-buddy" src="${asset('assets/brand/buddy.png')}" alt="">
        <h1 class="w2-h">Your shop online.</h1>
        <p class="w2-sub">Made from your phone.</p>
        <div class="door door--accent w2-go">Get started</div>
        <p class="w2-link">I already have an account</p>
      </div>
      <div class="a-home"></div>`;
    return { reset() {}, end() {}, play() { el.classList.add('is-run'); }, pause() { el.classList.remove('is-run'); }, set() {} };
  }

  // =====================================================================================
  // 2. interview-rec (REAL: app/(app)/submit/interview.tsx, recording in progress)
  // =====================================================================================
  const QUESTIONS = [
    "What's the full name of your business, what city or area do you serve, and what do you do? Try to mention all three in one sentence.",
    'What products or services do you offer, and what are your most popular ones? Use the words customers would type into Google.',
    'Why do customers choose your business over the alternatives nearby? What makes you the best in your area?',
    'Tell us about a recent customer who loved what you did — what did they buy, and where were they from?',
    'Where exactly are you located, what are your opening hours, and how can people reach you? Mention nearby landmarks if it helps people find you.',
  ];
  const WAVE = [6, 10, 16, 9, 22, 30, 18, 12, 26, 34, 20, 14, 28, 22, 12, 18, 30, 24, 10, 16, 26, 14, 8, 12];
  function interview(el, opts, run) {
    const startAt = opts.time != null ? opts.time : 7;
    el.innerHTML = `
      ${sb(false)}
      ${stepHead(1, 5, 'Interview')}
      <div class="s-body">
        <h2 class="a-display a-display--md s-title">${opts.owner ? 'Tell us about your shop.' : 'Talk to the owner.'}</h2>
        <div class="a-bubble i-bubble">
          <span class="a-bubble-mark"><img src="${MARK()}" alt=""></span>
          <div class="a-bubble-text i-bt">
            <span class="i-qn">Question <span class="i-qi">1</span>${opts.owner ? '' : ' · ask the owner'}</span>
            <div class="i-qs">${QUESTIONS.map((q, i) => `<b class="i-qt${i ? '' : ' is-on'}">${q}</b>`).join('')}</div>
          </div>
        </div>
        <div class="i-nav">
          <span class="a-pill i-prev is-off">${ic('chevron-left', 15, '', 2.4)}Prev</span>
          <span class="a-pill a-pill--ink i-next">Next${ic('chevron-right', 15, '', 2.4)}</span>
        </div>
        <div class="a-card a-card--lg i-card">
          <div class="i-panel">
            <span class="i-status"><span class="a-live"></span>Recording</span>
            <div class="i-timer">${fmt(startAt)}</div>
            <div class="i-wave">${WAVE.map((h, i) => `<i style="--h:${h}px;--d:${(i % 7) * -0.17}s"></i>`).join('')}</div>
          </div>
          <p class="i-hint">${opts.owner ? 'Talk the way you would to a customer.' : 'Let the owner talk. You can pause any time.'}</p>
        </div>
      </div>
      <div class="s-foot i-foot">
        <div class="door door--ghost i-pause"><span class="s-ic">${ic('pause', 18, '', 2.2)}</span>Pause</div>
        <div class="door i-stop"><span class="i-sq"></span>Stop</div>
      </div>
      <div class="a-home"></div>`;
    const timer = el.querySelector('.i-timer');
    const counts = [el.querySelector('.s-step-n'), el.querySelector('.i-qi')];
    const bar = el.querySelector('.a-progress i');
    const qs = [...el.querySelectorAll('.i-qt')];
    const prev = el.querySelector('.i-prev');
    const next = el.querySelector('.i-next');
    let secs = startAt;
    let q = 0;
    const setQ = (n) => {
      q = ((n % 5) + 5) % 5;
      qs.forEach((p, i) => p.classList.toggle('is-on', i === q));
      counts[0].textContent = `${q + 1} / 5`;
      counts[1].textContent = `${q + 1}`;
      bar.style.setProperty('--p', `${(q + 1) * 20}%`);
      prev.classList.toggle('is-off', q === 0);
      next.classList.toggle('is-off', q === 4);
    };
    const setT = (s) => { secs = s; timer.textContent = fmt(s); };
    function tick() { run.after(1000, () => { setT(secs + 1); tick(); }); }
    function advance() { run.after(4800, () => { setQ(q + 1); advance(); }); }
    return {
      reset() { setT(startAt); setQ(opts.question ? opts.question - 1 : 0); },
      end() { setT(Math.max(secs, 42)); },
      play() { tick(); advance(); },
      pause() {},
      set(k, v) { if (k === 'question') setQ(v - 1); if (k === 'time') setT(v); },
    };
  }

  // =====================================================================================
  // 3. photos (REAL: app/(app)/submit/photos.tsx)
  // =====================================================================================
  function photos(el, opts, run, icons) {
    const list = (opts.photos || [
      'assets/photos/kalan-hero.jpg', 'assets/photos/kalan-cook.jpg', 'assets/photos/kalan-pandesal.jpg',
      'assets/photos/after-kalan-alt.jpg', 'assets/photos/after-kalan.jpg', 'assets/photos/before-kalan.jpg',
    ]).slice(0, 8).map(asset);
    const SLOTS = 8;
    el.innerHTML = `
      ${sb(false)}
      ${stepHead(2, 4)}
      <div class="s-body">
        <h2 class="a-display a-display--md s-title">${opts.owner ? 'Show us your shop.' : 'Show us the storefront.'}</h2>
        <p class="s-sub">Storefront, inside, your best products. Three to ten photos.</p>
        <div class="p-grid">
          <div class="p-cell p-add"><span class="p-add-ic">${ic('camera', 22, '', 2)}</span><b>Add</b></div>
          ${Array.from({ length: SLOTS }, (_, i) => `<div class="p-cell p-slot" data-i="${i}"></div>`).join('')}
        </div>
        <div class="p-stat">
          <span class="p-count"><b class="p-n">0</b> of 10</span>
          <span class="a-chip p-need">Add 3 more</span>
        </div>
        <div class="p-tips">
          ${[['Storefront from the street', 1], ['Inside and your best products', 2]].map(([t, k]) => `<div class="a-check" data-k="${k}"><i class="c">${ic('check', 13, '', 3)}</i><span>${t}</span></div>`).join('')}
        </div>
      </div>
      <div class="s-foot">
        <div class="door door--accent p-go">${opts.owner ? 'Send my photos' : 'Continue'}</div>
      </div>
      <div class="a-home"></div>`;
    const slots = [...el.querySelectorAll('.p-slot')];
    const nEl = el.querySelector('.p-n');
    const need = el.querySelector('.p-need');
    const go = el.querySelector('.p-go');
    const tips = [...el.querySelectorAll('.p-tips .a-check')];
    let n = 0;
    function status() {
      nEl.textContent = n;
      const ok = n >= 3;
      need.textContent = ok ? 'Looks good' : `Add ${3 - n} more`;
      need.classList.toggle('a-chip--ok', ok);
      need.classList.toggle('a-chip--muted', !ok);
      go.classList.toggle('is-disabled', !ok);
      tips.forEach((t) => t.classList.toggle('is-done', n >= +t.dataset.k * 3 - 2));
    }
    const fill = (i, animate) => {
      const s = slots[i];
      s.innerHTML = `<img src="${list[i]}" alt=""><span class="p-x">${ic('x', 12, '', 2.6)}</span><span class="p-up"><i></i></span>`;
      icons();
      s.classList.add('is-full');
      const up = s.querySelector('.p-up');
      if (!animate) { up.style.opacity = '0'; return; }
      s.classList.add('is-drop'); reflow(s); s.classList.remove('is-drop');
      up.querySelector('i').style.width = '100%';
      run.after(1000, () => { up.style.opacity = '0'; });
    };
    function render(count) {
      n = Math.min(count, list.length);
      slots.forEach((s, i) => { s.className = 'p-cell p-slot'; s.innerHTML = ''; if (i < n) fill(i, false); });
      status();
    }
    function cycle() {
      render(0);
      let i = 0;
      const step = () => {
        if (i >= list.length) {
          run.after(3600, () => {
            slots.forEach((s) => s.classList.add('is-out'));
            run.after(600, cycle);
          });
          return;
        }
        fill(i, true); i += 1; n = i; status();
        run.after(1100, step);
      };
      run.after(700, step);
    }
    return {
      reset() { render(4); },
      end() { render(list.length); },
      play: cycle,
      pause() {},
      set(k, v) { if (k === 'count') render(v); },
    };
  }

  // =====================================================================================
  // 4. design-picker v4 (Theo 2026-10-21): real designs from the template database, already filled with
  //    this shop's photos and words. Thumbnails → tap one → the real site opens and scrolls → "Use this design".
  //    No knobs: Tendso keeps the template and only swaps the content.
  // =====================================================================================
  const DP_DESIGNS = [
    { id: 'f', name: 'Barbershop 1' },
    { id: 'g', name: 'Barbershop 2' },
    { id: 'i', name: 'Barbershop 3' },
    { id: 'j', name: 'Barbershop 4' },
  ];
  function designPicker(el, opts, run, icons) {
    el.dataset.proposed = 'true';
    const thumb = (d) => asset(`assets/sites/designs/barber-${d.id}-m.jpg`);
    const full = (d) => asset(`assets/sites/designs/barber-${d.id}-m-long.jpg`);
    el.innerHTML = `
      ${sb(false)}
      <div class="dp-top">
        <b class="s-step-n">3 / 4</b>
        <h2 class="a-display a-display--md">Choose your design</h2>
      </div>
      <div class="dp-car"><div class="dp-rail">${DP_DESIGNS.map((d) => `
        <div class="dp-card" data-id="${d.id}"><img src="${thumb(d)}" alt="${d.name} design"><span class="dp-check">${ic('check', 16, '', 3)}</span></div>`).join('')}</div></div>
      <div class="dp-meta"><b class="dp-name"></b><span class="dp-dots">${DP_DESIGNS.map(() => '<i></i>').join('')}</span></div>
      <div class="dp-foot"><div class="door door--accent dp-pick">Use this design</div></div>
      <div class="dp-sheet" aria-hidden="true">
        <div class="dp-sheet-top"><span class="dp-back">${ic('chevron-left', 22, '', 2.4)}</span><b class="dp-sheet-t"></b><span class="dp-back dp-back--ghost"></span></div>
        <div class="dp-view"><img class="dp-full" alt=""></div>
        <div class="dp-sheet-foot"><div class="door door--accent dp-use">Use this design</div></div>
      </div>
      <div class="a-home"></div>`;
    const cards = [...el.querySelectorAll('.dp-card')];
    const rail = el.querySelector('.dp-rail'), name = el.querySelector('.dp-name'), dots = [...el.querySelectorAll('.dp-dots i')];
    const sheet = el.querySelector('.dp-sheet'), fullImg = el.querySelector('.dp-full'), title = el.querySelector('.dp-sheet-t'), use = el.querySelector('.dp-use'), pick = el.querySelector('.dp-pick');
    let cur = 0, chosen = -1;
    function go(k) {
      cur = k;
      rail.style.transform = `translateX(${-k * 262}px)`;
      cards.forEach((c, i) => { c.classList.toggle('is-cur', i === k); c.classList.toggle('is-on', i === chosen); });
      dots.forEach((d, i) => d.classList.toggle('is-on', i === k));
      name.textContent = DP_DESIGNS[k].name;
    }
    const tap = (n) => { n.classList.add('is-tap'); run.after(200, () => n.classList.remove('is-tap')); };
    function open(k) {
      const d = DP_DESIGNS[k];
      fullImg.src = full(d); title.textContent = d.name;
      fullImg.style.transition = 'none'; fullImg.style.transform = 'none'; reflow(fullImg);
      tap(cards[k]); el.classList.add('is-open');
    }
    const close = () => el.classList.remove('is-open');
    // demo: swipe 1 → 2 → 3, back to 2, open it, scroll the real site, use it
    function cycle() {
      chosen = -1; close(); go(0);
      run.after(1300, () => go(1));
      run.after(2500, () => go(2));
      run.after(3700, () => go(1));
      run.after(4700, () => open(1));
      run.after(5300, () => { fullImg.style.transition = 'transform 3600ms cubic-bezier(.45,0,.25,1)'; fullImg.style.transform = 'translateY(-60%)'; });
      run.after(9200, () => tap(use));
      run.after(9500, () => { chosen = 1; close(); go(1); });
      run.after(12000, cycle);
    }
    return {
      reset() { chosen = -1; close(); go(opts.design != null ? opts.design : 1); },
      end() { chosen = 1; close(); go(1); },
      play: cycle,
      pause() {},
      set(k, v) { if (k === 'design') go(v); if (k === 'open') open(v); },
    };
  }

  // =====================================================================================
  // 4b. site-building (Theo 2026-10-21): after the interview and photos, Tendso builds the site (~20 min).
  //     The buddy works through four steps; the photo step shows a phone photo turning into the pro one.
  //     Then "Ready to check": Ask for a change, or Looks good.
  // =====================================================================================
  function siteBuilding(el, opts, run) {
    el.dataset.proposed = 'true';
    const rows = [
      { t: 'Reading your interview', ic: 'mic' },
      { t: 'Writing your pages', ic: 'pen-line' },
      { t: 'Polishing your photos', ic: 'image' },
      { t: 'Building your site', ic: 'layout-template' },
    ];
    el.innerHTML = `
      ${sb(false)}
      <div class="sbd-work">
        <img class="sbd-buddy" src="${asset('assets/brand/buddy.png')}" alt="">
        <h2 class="a-display a-display--md sbd-h">Building your site</h2>
        <p class="s-sub sbd-eta">About 20 minutes</p>
        <div class="sbd-bar"><i></i></div>
        <div class="sbd-rows">${rows.map((r) => `
          <div class="sbd-row"><span class="sbd-ic">${ic(r.ic, 18, '', 2.2)}</span><b>${r.t}</b><span class="sbd-st"><i class="sbd-spin"></i><span class="sbd-ok">${ic('check', 16, '', 3)}</span></span></div>`).join('')}</div>
        <div class="sbd-photo"><img class="sbd-ph sbd-ph--a" src="${asset('assets/photos/forge/phone-headshot.jpg')}" alt=""><img class="sbd-ph sbd-ph--b" src="${asset('assets/photos/forge/pro2-headshot.jpg')}" alt=""></div>
      </div>
      <div class="sbd-review">
        <h2 class="a-display a-display--md">Ready to check</h2>
        <div class="sbd-site"><img src="${asset('assets/sites/showcase/forge-m.jpg')}" alt="Your new site"></div>
        <div class="sbd-btns"><div class="door door--ghost sbd-change">Ask for a change</div><div class="door door--accent sbd-good">Looks good</div></div>
      </div>
      <div class="a-home"></div>`;
    const R = [...el.querySelectorAll('.sbd-row')];
    const bar = el.querySelector('.sbd-bar i'), good = el.querySelector('.sbd-good');
    function state(k) { // k = rows done (0..4)
      R.forEach((r, i) => { r.classList.toggle('is-done', i < k); r.classList.toggle('is-now', i === k); });
      bar.style.transform = `scaleX(${(0.06 + 0.94 * k / 4).toFixed(3)})`;
      el.classList.toggle('is-photos', k === 2);
    }
    function cycle() {
      el.classList.remove('is-review'); state(0);
      [1, 2, 3, 4].forEach((k, i) => run.after(1300 + i * 1500 + (k === 3 ? 900 : 0), () => state(k)));
      run.after(8000, () => el.classList.add('is-review'));
      run.after(10200, () => { good.classList.add('is-tap'); run.after(220, () => good.classList.remove('is-tap')); });
      run.after(12000, cycle);
    }
    return {
      reset() { el.classList.remove('is-review'); state(opts.done != null ? opts.done : 2); if (opts.review) el.classList.add('is-review'); },
      end() { state(4); el.classList.add('is-review'); },
      play: cycle,
      pause() {},
      set(k, v) { if (k === 'done') state(v); if (k === 'review') el.classList.toggle('is-review', !!v); },
    };
  }

  // =====================================================================================
  // 5. site-ready (PROPOSED: Round 2 O5, pay once only; the owner sees the site before paying)
  // =====================================================================================
  function siteReady(el, opts, run) {
    el.dataset.proposed = 'true';
    const s = site(opts.site || 'forge');
    const price = priceText();
    const name = s.id;
    el.innerHTML = `
      ${sb(false)}
      ${stepHead(4, 4)}
      <div class="s-body">
        <h2 class="a-display a-display--md s-title">Your site is ready!</h2>
        <div class="sr-row">
          <div class="sr-thumb"><img class="sr-img" src="${asset(sitePath(s.id, 'm-long'))}" alt="${s.name || name} website preview"></div>
          <div class="sr-side">
            <div class="sr-addr"><span class="s-lbl">Free address</span><b>${s.url}</b></div>
            <div class="sr-dom"><b>Want ${name}.com?</b><span>Optional, we set it up</span></div>
            <span class="sr-change">Change anything →</span>
          </div>
        </div>
        <div class="a-card a-card--lg sr-price">
          <div class="sr-amt"><b>${price}</b><span>once</span></div>
          <p class="sr-when">or ₱500 a month for 10 months</p>
          <div class="sr-inc">
            ${['Your web address', 'Hosting', 'Your photos and words'].map((t) => `<div class="sr-li"><span class="sr-ck">${ic('check', 13, '', 3)}</span>${t}<em>Included</em></div>`).join('')}
          </div>
        </div>
      </div>
      <div class="s-foot sr-foot">
        <div class="door door--accent">Publish for ${price}</div>
        <p class="sr-pay">GCash, Maya or card · No monthly fees</p>
      </div>
      <div class="a-home"></div>`;
    const page = el.querySelector('.sr-thumb');
    const img = el.querySelector('.sr-img');
    const maxScroll = () => Math.max(0, page.clientWidth * (2600 / 390) - page.clientHeight);
    const to = (p, ms, ease) => {
      img.style.transition = ms ? `transform ${ms}ms ${ease}` : 'none';
      img.style.transform = `translateY(${-p * maxScroll()}px)`;
    };
    function cycle() {
      to(0, 0); reflow(img);
      run.after(1200, () => {
        to(1, 16000, EASE_INOUT);
        run.after(16000 + 1800, () => {
          to(0, 2400, EASE);
          run.after(2400 + 1400, cycle);
        });
      });
    }
    return {
      reset() { to(0, 0); },
      end() { to(0, 0); },
      play: cycle,
      pause() {
        const m = getComputedStyle(img).transform;
        img.style.transition = 'none';
        img.style.transform = m === 'none' ? '' : m;
      },
      set(k, v) { if (k === 'scroll') to(Math.max(0, Math.min(1, v)), 0); },
    };
  }

  // =====================================================================================
  // 6. agents-near (PROPOSED: Round 2 O7, field agents on a map; pattern from leads/nearby.tsx)
  // =====================================================================================
  const MAP_H = 844;
  function mapSVG() {
    // quiet vector street map, deterministic (no tiles)
    let seed = 7;
    const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
    const xs = [-200]; while (xs[xs.length - 1] < 600) xs.push(xs[xs.length - 1] + 54 + Math.round(rnd() * 26));
    const ys = [-180]; while (ys[ys.length - 1] < MAP_H + 180) ys.push(ys[ys.length - 1] + 44 + Math.round(rnd() * 22));
    const avX = new Set([4, 8]); const avY = new Set([6]);
    let blocks = '';
    for (let i = 0; i < xs.length - 1; i++) {
      for (let j = 0; j < ys.length - 1; j++) {
        const x = xs[i] + 6, y = ys[j] + 6, w = xs[i + 1] - xs[i] - 12, h = ys[j + 1] - ys[j] - 12;
        if (rnd() < 0.18 && w > 40) {
          const s = Math.round(w * (0.4 + rnd() * 0.2));
          blocks += `<rect x="${x}" y="${y}" width="${s - 3}" height="${h}" rx="3"/><rect x="${x + s + 3}" y="${y}" width="${w - s - 3}" height="${h}" rx="3"/>`;
        } else blocks += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3"/>`;
      }
    }
    let streets = '';
    xs.forEach((x, i) => { streets += `<line x1="${x}" y1="-300" x2="${x}" y2="${MAP_H + 300}" stroke-width="${avX.has(i) ? 11 : 6}"/>`; });
    ys.forEach((y, j) => { streets += `<line x1="-300" y1="${y}" x2="700" y2="${y}" stroke-width="${avY.has(j) ? 11 : 6}"/>`; });
    const rot = `rotate(-13 195 ${MAP_H / 2})`;
    const river = `M-20 ${MAP_H - 70} C 60 ${MAP_H - 96}, 110 ${MAP_H - 56}, 180 ${MAP_H - 74} S 300 ${MAP_H - 120}, 410 ${MAP_H - 104}`;
    return `
      <svg class="an-svg" viewBox="0 0 390 ${MAP_H}" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <rect width="390" height="${MAP_H}" class="an-base"/>
        <g transform="${rot}">
          <g class="an-blocks">${blocks}</g>
          <rect x="${xs[6] + 6}" y="${ys[2] + 6}" width="${xs[7] - xs[6] - 12}" height="${ys[4] - ys[2] - 12}" rx="4" class="an-park"/>
        </g>
        <path class="an-river" d="${river}"/>
        <g transform="${rot}"><g class="an-streets">${streets}</g></g>
        <path class="an-river an-river--top" d="${river}"/>
        <g transform="${rot}"><g class="an-streets">
          <line x1="${xs[4]}" y1="-300" x2="${xs[4]}" y2="${MAP_H + 300}" stroke-width="11"/>
          <line x1="${xs[8]}" y1="-300" x2="${xs[8]}" y2="${MAP_H + 300}" stroke-width="11"/>
        </g></g>
      </svg>`;
  }
  // sample agents (placeholder photos cropped to faces); first = the selected agent
  const AGENTS = [
    { name: 'Mika Santos', first: 'Mika', dist: '0.8 km', x: 150, y: 214, sel: true, face: { src: 'assets/people/17-mika.jpg', ar: 0.8, fx: 0.51, fy: 0.21, z: 3.6 } },
    { name: 'Jun', x: 62, y: 152, face: { src: 'assets/people/14-garage.jpg', ar: 1.25, fx: 0.30, fy: 0.25, z: 6 } },
    { name: 'Carlo', x: 304, y: 136, face: { src: 'assets/people/04-team.jpg', ar: 1.49, fx: 0.16, fy: 0.22, z: 7.5 } },
    { name: 'Bea', x: 50, y: 336, face: { src: 'assets/people/12-salon.jpg', ar: 0.8, fx: 0.67, fy: 0.29, z: 5.5 } },
    { name: 'Andrea', x: 314, y: 306, face: { src: 'assets/people/04-team.jpg', ar: 1.49, fx: 0.52, fy: 0.28, z: 7.5 } },
    { name: '', x: 112, y: 404, face: { src: 'assets/people/10-scooter.jpg', ar: 1.49, fx: 0.42, fy: 0.23, z: 7.5 } },
  ];
  const BUILT = [
    { name: 'Forge', src: 'assets/photos/after-barber.jpg' },
    { name: 'Héla Hair', src: 'assets/photos/hela-hero.jpg' },
    { name: 'Labaná', src: 'assets/photos/labana-stacks.jpg' },
  ];
  function agentsNear(el, opts, run) {
    el.dataset.proposed = 'true';
    const agents = AGENTS;
    const m = agents[0];
    el.innerHTML = `
      ${sb(false)}
      <div class="an-map">${mapSVG()}</div>
      <div class="an-top">
        <span class="a-back">${ic('chevron-left', 20, '', 2.4)}</span>
        <span class="an-count">${agents.length} field agents near you</span>
      </div>
      ${agents.map((a, i) => `
        <div class="an-pin${a.sel ? ' is-sel' : ''}" data-i="${i}" style="left:${a.x}px;top:${a.y}px">
          ${a.sel ? '<span class="an-halo"></span>' : ''}
          <span class="an-av">${face(a.face)}</span>
          ${a.sel ? `<span class="an-lbl an-lbl--sel">${a.first} · ${a.dist}</span>` : a.name ? `<span class="an-lbl">${a.name}</span>` : ''}
        </div>`).join('')}
      <div class="an-pin an-shop" style="left:226px;top:338px">
        <span class="an-shop-ph"><img src="${asset('assets/video/interview-2.jpg')}" alt=""></span>
        <span class="an-lbl an-lbl--ink">Your shop</span>
      </div>
      <div class="an-sheet">
        <span class="an-grab"></span>
        <div class="an-who">
          <span class="an-av an-av--lg">${face(m.face)}</span>
          <div class="an-meta">
            <b>${m.name} <span>· ${m.dist}</span></b>
            <span class="an-rate">${ic('star', 14, 's-fill', 0)}4.9 · 23 sites built · Marikina</span>
          </div>
        </div>
        <p class="an-quote">“I'll visit, take your photos, and set up the site with you.”</p>
        <div class="an-built">
          <span class="s-lbl">Sites ${m.first} built</span>
          <div class="an-thumbs">${BUILT.map((b) => `<div><img src="${asset(b.src)}" alt=""><span>${b.name}</span></div>`).join('')}</div>
        </div>
        <div class="an-cta">
          <div class="door door--accent">Book a free visit</div>
          <div class="door door--ghost an-chat">Chat</div>
        </div>
      </div>
      <div class="a-home"></div>`;
    const pins = [...el.querySelectorAll('.an-pin')];
    const sheet = el.querySelector('.an-sheet');
    const setPins = (on, animate) => pins.forEach((p, i) => {
      p.style.transition = animate ? `opacity 600ms ${EASE} ${i * 120}ms, transform 700ms ${EASE} ${i * 120}ms` : 'none';
      p.classList.toggle('is-in', on);
    });
    const setSheet = (on, animate) => {
      sheet.style.transition = animate ? `transform 900ms ${EASE}` : 'none';
      sheet.classList.toggle('is-in', on);
    };
    function cycle() {
      setPins(false, false); setSheet(false, false); reflow(el);
      run.after(400, () => {
        setPins(true, true);
        run.after(120 * pins.length + 500, () => {
          setSheet(true, true);
          run.after(900 + 6200, () => {
            setSheet(false, true);
            run.after(700, () => {
              pins.forEach((p) => { p.style.transition = `opacity 400ms ${EASE}`; p.classList.remove('is-in'); });
              run.after(600, cycle);
            });
          });
        });
      });
    }
    return {
      reset() { setPins(true, false); setSheet(true, false); },
      end() { setPins(true, false); setSheet(true, false); },
      play: cycle,
      pause() {},
      set(k, v) { if (k === 'sheet') setSheet(!!v, false); },
    };
  }

  // =====================================================================================
  // 7. site-browser (the finished website, iOS Safari-like)
  // =====================================================================================
  // finished sites come from the showcase set (bright, built for showing); kalan / kalasag only exist as older captures
  const SHOWCASE = new Set(['forge', 'hela', 'vulca', 'labana', 'domingo', 'florist', 'carpenter', 'baker', 'tailor', 'ceramics']);
  const sitePath = (id, kind) => (SHOWCASE.has(id) ? `assets/sites/showcase/${id}-${kind}.jpg` : `assets/sites/${id}-${kind}.jpg`);
  const SITE_TOP = { forge: '#16171C', kalan: '#FAF6EB', hela: '#FAF5EF', vulca: '#111214', domingo: '#1E4A39', labana: '#F5F8FD', kalasag: '#0C0C0A', florist: '#FFFCF7', baker: '#FFF9ED' };
  const DARK_TOP = new Set(['vulca', 'domingo', 'kalasag']);
  function siteBrowser(el, opts, run) {
    let id = opts.site || 'forge';
    const build = () => {
      const s = site(id);
      el.style.background = SITE_TOP[id] || '#fff';
      el.innerHTML = `
        ${sb(DARK_TOP.has(id))}
        <div class="sb-page"><img class="sb-img" src="${asset(sitePath(id, 'm-long'))}" alt="${s.name || id} website"></div>
        <div class="sb-addr">${ic('lock', 12, '', 2.2)}<span>${s.url}</span></div>
        <div class="a-home sb-home${DARK_TOP.has(id) ? ' is-light' : ''}"></div>`;
    };
    build();
    const els = () => ({ page: el.querySelector('.sb-page'), img: el.querySelector('.sb-img') });
    const maxScroll = () => { const { page } = els(); return Math.max(0, page.clientWidth * (5200 / 780) - page.clientHeight); };
    const to = (p, ms, ease) => {
      const { img } = els();
      img.style.transition = ms ? `transform ${ms}ms ${ease}` : 'none';
      img.style.transform = `translateY(${-p * maxScroll()}px)`;
    };
    function cycle() {
      to(0, 0); reflow(el);
      run.after(1400, () => {
        to(1, 18000, EASE_INOUT);
        run.after(18000 + 2000, () => {
          to(0, 2600, EASE);
          run.after(2600 + 1600, cycle);
        });
      });
    }
    return {
      reset() { to(0, 0); },
      end() { to(0, 0); },
      play: cycle,
      pause() {
        const { img } = els();
        const m = getComputedStyle(img).transform;
        img.style.transition = 'none';
        img.style.transform = m === 'none' ? '' : m;
      },
      set(k, v, api) {
        if (k === 'site' && v !== id) { id = v; build(); api.rehydrate(); if (api.playing) { api.pause(); api.play(); } }
        if (k === 'scroll') to(Math.max(0, Math.min(1, v)), 0);
      },
    };
  }

  // =====================================================================================
  // GUIDED CAPTURE (PROPOSED, Theo 2026-10-21): 10 super-simple questions on camera with a framing
  // assistant, and 10 guided photo tasks per kind of business, then the owner's own extra photos.
  // Data: TD.interview (questions en/tl, extra, framing hints) and TD.shots (barber/food/salon tasks).
  // =====================================================================================
  const IV = () => TD().interview || {
    questions: [{ en: "What's the name of your shop?", tl: 'Ano ang pangalan ng negosyo mo?' }],
    extra: { en: 'Anything else you want to say?', tl: 'May gusto ka pang sabihin?' },
    framing: ['Face inside the circle', 'Move a bit closer', 'Hold the phone level', 'Good light. Keep going'],
  };
  const SHOTS = (type) => { const s = TD().shots || {}; return s[type] || s.default || []; };
  const NOUN = { barber: 'a barbershop', food: 'a restaurant', salon: 'a salon' };

  // ghost outlines, drawn in a 300×360 box (same paths for the big viewfinder guide and the small icons)
  const GHOST = {
    head: 'M72 120a78 98 0 1 0 156 0a78 98 0 1 0-156 0M22 360C30 262 92 226 150 226S270 262 278 360',
    half: 'M114 92a36 44 0 1 0 72 0a36 44 0 1 0-72 0M44 360C48 228 96 160 150 160S252 228 256 360M96 250v110M204 250v110',
    front: 'M24 336V112h252v224ZM24 162h252M74 124h152v26H74ZM124 336V214h52v122M44 196h58v86H44ZM198 196h58v86h-58ZM0 336h300',
    sign: 'M28 108h244v144H28ZM68 158h164M92 202h116',
    room: 'M98 116h104v116H98ZM0 0l98 116M300 0l-98 116M0 360l98-128M300 360l-98-128',
    object: 'M62 180a88 88 0 1 0 176 0a88 88 0 1 0-176 0M30 72V48h24M246 48h24v24M270 288v24h-24M54 312H30v-24M142 180h16M150 172v16',
  };
  const ghostSVG = (g, cls = '') => `<svg class="gh ${cls}" viewBox="0 0 300 360" preserveAspectRatio="xMidYMid meet" aria-hidden="true"><path d="${GHOST[g] || GHOST.object}" vector-effect="non-scaling-stroke"/></svg>`;
  const FIX_HINT = { head: 'Face in the middle', half: 'Step back a little', front: 'Step back a little', sign: 'Hold the phone straight', room: 'Step back a little', object: 'Move a bit closer' };

  // the "live camera" for each task: a real photo, cropped. fx/fy = point of interest (0..1), z = zoom
  const VIEWS = {
    // real, whole photos (no heavy zoom): the camera should look like it is pointed at the thing
    barber: [
      { src: 'assets/photos/forge/phone-headshot.jpg', fx: 0.5, fy: 0.5, z: 1 },
      { src: 'assets/photos/forge/phone-profile.jpg', fx: 0.5, fy: 0.5, z: 1 },
      { src: 'assets/photos/forge/phone-haircut.jpg', fx: 0.5, fy: 0.5, z: 1 },
      { src: 'assets/photos/forge/phone-inside.jpg', fx: 0.5, fy: 0.5, z: 1 },
      { src: 'assets/photos/forge/phone-chair.jpg', fx: 0.5, fy: 0.5, z: 1 },
      { src: 'assets/photos/forge/phone-finished.jpg', fx: 0.5, fy: 0.5, z: 1 },
      { src: 'assets/photos/forge/phone-outside.jpg', fx: 0.5, fy: 0.5, z: 1 },
      { src: 'assets/photos/forge/phone-sign.jpg', fx: 0.5, fy: 0.5, z: 1 },
      { src: 'assets/photos/forge/phone-tools.jpg', fx: 0.5, fy: 0.5, z: 1 },
      { src: 'assets/photos/forge/phone-prices.jpg', fx: 0.5, fy: 0.5, z: 1 },
    ],
    food: [
      { src: 'assets/photos/kalan-cook.jpg', fx: 0.33, fy: 0.27, z: 2.2 },
      { src: 'assets/photos/kalan-cook.jpg', fx: 0.4, fy: 0.5, z: 1 },
      { src: 'assets/people/15-carinderia.jpg', fx: 0.28, fy: 0.5, z: 1 },
      { src: 'assets/photos/kalan-hero.jpg', fx: 0.5, fy: 0.5, z: 1 },
      { src: 'assets/photos/before-kalan.jpg', fx: 0.5, fy: 0.55, z: 1.05 },
      { src: 'assets/photos/kalan-pandesal.jpg', fx: 0.42, fy: 0.5, z: 1 },
      { src: 'assets/photos/after-kalan.jpg', fx: 0.75, fy: 0.18, z: 2.4 },
      { src: 'assets/photos/kalan-cook.jpg', fx: 0.62, fy: 0.62, z: 1.4 },
      { src: 'assets/people/09-cafe.jpg', fx: 0.86, fy: 0.1, z: 2.6 },
      { src: 'assets/people/15-carinderia.jpg', fx: 0.62, fy: 0.42, z: 1 },
    ],
    repair: [
      { src: 'assets/people/14-garage.jpg', fx: 0.3, fy: 0.4, z: 1 },
      { src: 'assets/photos/after-mechanic.jpg', fx: 0.5, fy: 0.5, z: 1 },
      { src: 'assets/photos/before-mechanic.jpg', fx: 0.6, fy: 0.5, z: 1 },
      { src: 'assets/photos/after-mechanic-alt.jpg', fx: 0.35, fy: 0.5, z: 1 },
      { src: 'assets/photos/vulca-garage.jpg', fx: 0.4, fy: 0.5, z: 1 },
      { src: 'assets/photos/vulca-hero.jpg', fx: 0.5, fy: 0.5, z: 1 },
      { src: 'assets/photos/before-mechanic.jpg', fx: 0.3, fy: 0.3, z: 1 },
      { src: 'assets/photos/vulca-garage.jpg', fx: 0.85, fy: 0.5, z: 1 },
      { src: 'assets/photos/after-mechanic-alt.jpg', fx: 0.75, fy: 0.7, z: 1 },
      { src: 'assets/photos/vulca-garage.jpg', fx: 0.85, fy: 0.5, z: 1 },
    ],
    salon: [
      { src: 'assets/photos/hela-owner.jpg', fx: 0.5, fy: 0.2, z: 1.8, tx: 11, ty: 140 },
      { src: 'assets/photos/hela-owner.jpg', fx: 0.5, fy: 0.5, z: 1 },
      { src: 'assets/people/16-baguio.jpg', fx: 0.5, fy: 0.4, z: 1 },
      { src: 'assets/photos/hela-hero.jpg', fx: 0.4, fy: 0.5, z: 1 },
      { src: 'assets/photos/hela-hero.jpg', fx: 0.8, fy: 0.4, z: 1.3 },
      { src: 'assets/photos/domingo-aisle.jpg', fx: 0.5, fy: 0.5, z: 1 },
      { src: 'assets/photos/hela-hero.jpg', fx: 0.45, fy: 0.5, z: 1 },
      { src: 'assets/photos/hela-hero.jpg', fx: 0.7, fy: 0.45, z: 1.6 },
      { src: 'assets/photos/hela-colour.jpg', fx: 0.5, fy: 0.5, z: 1.1 },
      { src: 'assets/people/09-cafe.jpg', fx: 0.86, fy: 0.1, z: 2.6 },
    ],
  };
  const view = (type, i) => (VIEWS[type] || VIEWS.barber)[i] || VIEWS.barber[0];
  // a photo cropped around (fx, fy) at zoom z, as an <img> style (object-fit: cover in a full-size box)
  // tx/ty (px, optional) move the subject under the ghost when zoom alone cannot
  const viewT = (v) => `${v.tx || v.ty ? `translate(${v.tx || 0}px, ${v.ty || 0}px) ` : ''}scale(${v.z})`;
  const thumbStyle = (v) => viewStyle({ ...v, tx: 0, ty: 0 });   // small thumbnails: crop + zoom only
  const viewStyle = (v, extra = '') => `object-position:${v.fx * 100}% ${v.fy * 100}%;transform-origin:${v.fx * 100}% ${v.fy * 100}%;transform:${viewT(v)}${extra}`;

  // stand-in for the interview video while it is not there (or fails to load)
  // pos = object-position that puts the speaker's face in the face guide (videos are 540×960)
  const CAM_FALLBACK = {
    food: { src: 'assets/photos/kalan-cook.jpg', fx: 0.3, fy: 0.22, z: 1.35, pos: '0% 50%' },
    barber: { src: 'assets/video/interview-2.jpg', fx: 0.42, fy: 0.3, z: 1, pos: '20% 50%' },
    sari: { src: 'assets/people/01-sarisari.jpg', fx: 0.78, fy: 0.24, z: 1.5, pos: '100% 50%' },
  };
  const SHOT_START = { barber: 0, food: 4, salon: 0, repair: 2 };   // first task shown: the one the sample photos frame best

  // =====================================================================================
  // 8. interview-list (PROPOSED): the 10 questions before recording, both languages
  // =====================================================================================
  function interviewList(el, opts, run) {
    // Theo 2026-10-21: no list of 10 — a calm stack of question cards, one line, one button
    el.dataset.proposed = 'true';
    const Q = IV().questions;
    const owner = !!opts.owner;
    const tl = opts.lang === 'tl';
    const t = (q) => (tl ? q.tl : q.en);
    el.innerHTML = `
      ${sb(false)}
      ${stepHead(opts.step || (owner ? 1 : 3), opts.of || 4)}
      <div class="s-body il2">
        <h2 class="il2-h">${owner ? 'Now just talk.' : 'Now ask the owner.'}</h2>
        <p class="il2-sub">${Q.length} short questions. About 5 minutes.</p>
        <div class="il2-stack"></div>
      </div>
      <div class="s-foot"><div class="door door--accent">Start</div></div>
      <div class="a-home"></div>`;
    const stack = el.querySelector('.il2-stack');
    let i = 0;
    const draw = () => {
      stack.innerHTML = [0, 1, 2].map((k) => { const n = (i + k) % Q.length; return `<div class="il2-card" style="--k:${k}"><span class="il2-n">${n + 1}</span><b>${t(Q[n])}</b></div>`; }).join('');
    };
    function cycle() {
      run.after(2400, () => {
        const front = stack.firstElementChild;
        if (front) front.classList.add('is-out');
        run.after(420, () => { i = (i + 1) % Q.length; draw(); cycle(); });
      });
    }
    draw();
    return { reset() { i = 0; draw(); }, end() { i = 0; draw(); }, play() { i = 0; draw(); cycle(); }, pause() {}, set() {} };
  }

  // =====================================================================================
  // 9. interview-cam: the recording screen (v4, Theo 2026-10-21)
  //    Full-bleed camera, no outline. Top: close · REC timer · language. A 10-step progress bar.
  //    The app checks the framing once (level bar + a hint chip), then asks: the question sits low
  //    like a subtitle with only a text shadow. Bottom: pause (small) + "Next question" (biggest).
  // =====================================================================================
  function interviewCam(el, opts, run, icons) {
    el.dataset.proposed = 'true';
    el.classList.add('app--dark');
    const iv = IV();
    const Q = iv.questions;
    const N = Q.length;
    const tl = opts.lang === 'tl';
    const vidPath = opts.video || 'assets/video/interview-2.mp4';
    const type = opts.type || (/interview-2/.test(vidPath) ? 'barber' : /interview-3/.test(vidPath) ? 'sari' : 'food');
    const fb = opts.fallback || CAM_FALLBACK[type] || CAM_FALLBACK.food;
    const poster = asset(opts.poster || vidPath.replace(/\.mp4$/, '.jpg'));
    const startQ = opts.start != null ? opts.start - 1 : opts.question != null ? opts.question - 1 : 0;
    const QMS = opts.every || 5200;
    const L = tl
      ? { next: 'Susunod na tanong', done: 'Tapos na', hold: 'Hawakan nang diretso', ok: 'Ayos. Magsalita na', last: 'Huli na' }
      : { next: 'Next question', done: 'Finish', hold: 'Hold the phone straight', ok: 'Good. Start talking', last: 'Last one' };
    const say = (k) => (k >= N ? (tl ? iv.extra.tl : iv.extra.en) : (tl ? Q[k].tl : Q[k].en));
    el.innerHTML = `
      <div class="rv-cam">
        <img class="rv-fb" src="${asset(fb.src)}" alt="" style="${viewStyle(fb)}">
        <img class="rv-poster" src="${poster}" alt="" style="object-position:${fb.pos || '50% 50%'}">
        <video class="rv-vid" muted playsinline loop autoplay preload="auto" src="${asset(vidPath)}" style="object-position:${fb.pos || '50% 50%'}"></video>
      </div>
      <div class="cam-shade"></div>
      ${sb(true)}
      <div class="cam-top">
        <span class="cam-btn" aria-label="Close">${ic('x', 20, '', 2.4)}</span>
        <span class="rv-rec"><i class="rv-dot"></i><b class="rv-time">0:00</b><span class="rv-lvl"><i></i><i></i><i></i><i></i><i></i></span></span>
        <span class="cam-chip" aria-label="Language">${ic('languages', 16, '', 2.2)}<b>${tl ? 'TL' : 'EN'}</b></span>
      </div>
      <div class="cam-segs">${Q.map(() => '<i></i>').join('')}</div>
      <div class="cam-level" aria-hidden="true"><i></i><b></b><i></i></div>
      <div class="cam-hint"><span class="cam-hint-ic">${ic('smartphone', 16, '', 2.2)}</span><span class="cam-hint-ok">${ic('check', 16, '', 3)}</span><span class="cam-hint-t">${L.hold}</span></div>
      <div class="rv-prompt"><span class="rv-n"></span><p class="rv-q"></p></div>
      <div class="rv-ctl">
        <span class="rv-pause" aria-label="Pause"><i>${ic('pause', 22, 's-fill', 0)}</i></span>
        <span class="rv-next" aria-label="${L.next}"><b class="rv-next-t">${L.next}</b><span class="rv-next-a">${ic('arrow-right', 22, '', 2.6)}</span><span class="rv-next-c">${ic('check', 22, '', 3)}</span></span>
      </div>
      <div class="a-home"></div>`;

    const vid = el.querySelector('.rv-vid');
    const post = el.querySelector('.rv-poster');
    post.addEventListener('error', () => post.remove());
    vid.addEventListener('loadeddata', () => el.classList.add('has-video'));
    vid.addEventListener('error', () => { el.classList.remove('has-video'); vid.removeAttribute('src'); vid.remove(); });

    const $ = (q) => el.querySelector(q);
    const time = $('.rv-time'), qEl = $('.rv-q'), nEl = $('.rv-n'), next = $('.rv-next'), nextT = $('.rv-next-t'), hintT = $('.cam-hint-t');
    const segs = [...el.querySelectorAll('.cam-segs i')];
    const lv = [...el.querySelectorAll('.rv-lvl i')];
    let q = startQ, secs = 0;

    const setT = (v) => { secs = v; time.textContent = fmt(v); };
    // the question arrives word by word, like someone saying it
    function showQ(k, animate) {
      q = k;
      const words = say(k).split(' ');
      qEl.innerHTML = words.map((w, wi) => `<span style="--w:${wi}">${w}</span>`).join(' ');
      nEl.textContent = k >= N ? L.last : `${k + 1} / ${N}`;
      el.classList.toggle('is-last', k >= N);
      nextT.textContent = k >= N ? L.done : L.next;
      segs.forEach((sg, j) => { sg.classList.toggle('is-done', j < k); sg.classList.toggle('is-cur', j === k); });
      if (animate) { el.classList.remove('is-in'); reflow(el); }
      el.classList.add('is-in');
    }
    function levels() {
      lv.forEach((b) => { b.style.transform = `scaleY(${(0.25 + Math.random() * 0.75).toFixed(2)})`; });
      run.after(140, levels);
    }
    function tick() { run.after(1000, () => { setT(secs + 1); tick(); }); }
    // the app checks the framing once (level + hint), then starts asking
    function begin(first) {
      el.classList.remove('is-good', 'is-in'); el.classList.add('is-framing'); hintT.textContent = L.hold;
      segs.forEach((sg) => sg.classList.remove('is-done', 'is-cur'));
      run.after(1500, () => { el.classList.add('is-good'); hintT.textContent = L.ok; });
      run.after(2700, () => {
        el.classList.remove('is-framing'); setT(0); showQ(startQ, true);
        if (first) { tick(); levels(); }
        advance();
      });
    }
    function advance() {
      run.after(QMS, () => {
        next.classList.add('is-press'); run.after(200, () => next.classList.remove('is-press'));
        if (q < N) { showQ(q + 1, true); advance(); return; }
        run.after(1600, () => begin(false));
      });
    }
    return {
      reset() { setT(opts.time != null ? opts.time : 72); showQ(startQ, false); el.classList.add('is-good'); },
      end() { setT(72); showQ(startQ, false); el.classList.add('is-good'); },
      play() {
        try { const pr = vid.play && vid.play(); if (pr && pr.catch) pr.catch(() => {}); } catch (e) { /* no video yet */ }
        setT(0); begin(true);
      },
      pause() { try { vid.pause && vid.pause(); } catch (e) { /* ignore */ } },
      set(k, v) { if (k === 'question') showQ(v - 1, false); if (k === 'time') setT(v); },
    };
  }

  // =====================================================================================
  // 10. shot-list (PROPOSED): the 10 photo tasks for this kind of business + the owner's own photos
  // =====================================================================================
  function shotList(el, opts, run, icons) {
    // Theo 2026-10-21: no 10-row list — ten picture tiles (done ones show the photo) and the next task, big
    el.dataset.proposed = 'true';
    const type = opts.type || 'barber';
    const list = SHOTS(type);
    const n = list.length;
    let done = opts.done != null ? opts.done : (SHOT_START[type] || 0);
    el.innerHTML = `
      ${sb(false)}
      ${stepHead(opts.step || 2, opts.of || 4)}
      <div class="s-body sl2">
        <h2 class="sl2-h">${n} photos</h2>
        <p class="sl2-sub">We show you what to take, one by one.</p>
        <div class="sl2-grid"></div>
        <div class="sl2-next"><span class="sl2-next-gh"></span><span class="sl2-next-t"><small>Next</small><b></b></span></div>
        <p class="sl2-own">${ic('plus', 18, '', 2.4)} Add your own photos too</p>
      </div>
      <div class="s-foot"><div class="door door--accent">Start</div></div>
      <div class="a-home"></div>`;
    const grid = el.querySelector('.sl2-grid');
    const draw = (dropAt) => {
      grid.innerHTML = list.map((sh, i) => {
        const v = view(type, i);
        const cls = i < done ? 'is-done' : i === done ? 'is-next' : '';
        return `<span class="sl2-tile ${cls}${i === dropAt ? ' is-drop' : ''}">${i < done ? `<span class="clip"><img src="${asset(v.src)}" alt="" style="${thumbStyle(v)}"></span><i>${ic('check', 11, '', 3.4)}</i>` : ghostSVG(sh.ghost)}</span>`;
      }).join('');
      const nx = list[Math.min(done, n - 1)];
      el.querySelector('.sl2-next-gh').innerHTML = ghostSVG(nx.ghost);
      el.querySelector('.sl2-next-t b').textContent = nx.t;
      if (dropAt != null) { reflow(el); grid.children[dropAt]?.classList.remove('is-drop'); }
      hydrateIcons(el);
    };
    const start = done;
    function cycle() {
      run.after(1800, () => {
        if (done < Math.min(n - 1, start + 4)) { done += 1; draw(done - 1); cycle(); }
        else run.after(2400, () => { done = start; draw(); cycle(); });
      });
    }
    draw();
    return { reset() { done = start; draw(); }, end() { done = start; draw(); }, play() { done = start; draw(); cycle(); }, pause() {}, set(k, v) { if (k === 'done') { done = v; draw(); } } };
  }

  // =====================================================================================
  // 11. shot-guide (PROPOSED): the guided photo camera. One task at a time with a ghost outline,
  //     thirds grid, level and feedback; the 10 tasks as a filmstrip under the shutter.
  // =====================================================================================
  function shotGuide(el, opts, run, icons) {
    el.dataset.proposed = 'true';
    const type = opts.type || 'barber';
    const list = SHOTS(type);
    const n = list.length;
    const S = opts.start != null ? opts.start : (SHOT_START[type] || 0);
    const LOOP = opts.loop || 10;
    const OFF = ' translate(2%, -1.5%) rotate(-1.5deg) scale(1.06)';
    el.innerHTML = `
      <div class="sg-vf">
        <div class="sg-ph"><img class="sg-img is-on" alt=""><img class="sg-img" alt=""></div>
        <div class="sg-grid"><i></i><i></i><i></i><i></i></div>
      </div>
      <div class="sg-scrim"></div>
      ${sb(true)}
      <div class="sg-top">
        <span class="ic-btn" aria-label="Close">${ic('x', 20, '', 2.4)}</span>
        <span class="sg-of">Shot <b class="sg-i">${S + 1}</b> of ${n}</span>
        <span class="ic-btn" aria-label="Flash">${ic('zap-off', 18, '', 2.2)}</span>
      </div>
      <div class="sg-task"><b class="sg-t"></b><span class="sg-h"></span></div>
      <div class="sg-ghost"></div>
      <div class="sg-level"><i></i><i></i></div>
      <div class="cam-level" aria-hidden="true"><i></i><b></b><i></i></div>
      <div class="sg-fb"><span class="sg-fb-ic">${ic('move', 15, '', 2.4)}</span><span class="sg-fb-ok">${ic('check', 15, '', 3)}</span><span class="sg-fb-t"></span></div>
      <div class="sg-flash"></div>
      <div class="sg-sheet">
        <div class="sg-sheet-h"><b>Your shot list</b><span class="sg-done">2 of ${n} done</span></div>
        <div class="sg-strip">${list.map((s, i) => `<span class="sg-slot" data-i="${i}">${ghostSVG(s.ghost)}<span class="clip"><img src="${asset(view(type, i).src)}" alt="" style="${thumbStyle(view(type, i))}"></span><i>${ic('check', 9, '', 3.6)}</i></span>`).join('')}</div>
        <div class="sg-ctl">
          <span class="sg-last"><img alt=""></span>
          <span class="sg-shutter" aria-label="Take photo"><i></i></span>
          <span class="sg-skip">Skip</span>
        </div>
      </div>
      <div class="a-home"></div>`;
    const $ = (s) => el.querySelector(s);
    const imgs = [...el.querySelectorAll('.sg-img')];
    const slots = [...el.querySelectorAll('.sg-slot')];
    const ghost = $('.sg-ghost'), task = $('.sg-task'), tT = $('.sg-t'), tH = $('.sg-h'), iEl = $('.sg-i');
    const fbT = $('.sg-fb-t'), done = $('.sg-done'), last = $('.sg-last img'), flash = $('.sg-flash'), shutter = $('.sg-shutter');
    let front = 0, cur = S;

    const setImg = (img, i, off) => {
      const v = view(type, i);
      img.src = asset(v.src);
      img.setAttribute('style', viewStyle(v, off ? OFF : ''));
    };
    function setStrip(c) {
      slots.forEach((s, i) => { s.className = `sg-slot ${i < c ? 'is-done' : i === c ? 'is-cur' : ''}`; });
      done.textContent = `${c} of ${n} done`;
      const lv = view(type, Math.max(0, c - 1));
      last.src = asset(lv.src); last.setAttribute('style', thumbStyle(lv));
      last.parentElement.classList.toggle('is-empty', c === 0);
    }
    function setTask(i) {
      const s = list[i] || list[0];
      tT.textContent = s.t; tH.textContent = s.h; iEl.textContent = i + 1;
      ghost.innerHTML = ghostSVG(s.ghost);
      fbT.textContent = FIX_HINT[s.ghost] || 'Step back a little';
    }
    function setGood(on) {
      el.classList.toggle('is-good', on);
      if (on) fbT.textContent = 'Perfect, hold still';
    }
    function show(i) {
      cur = i; setTask(i); setStrip(i);
      imgs.forEach((im, k) => im.classList.toggle('is-on', k === front));
      setImg(imgs[front], i, false); setGood(true);
    }
    // one task, quick (Theo 2026-10-21: "photo, photo, photo"): aim → "Perfect" → shutter + flash → into the strip → next.
    // ~1.7 s per photo; the demo runs through all ten so the strip fills up.
    function shoot(i, k) {
      const img = imgs[front];
      el.classList.remove('is-good'); el.classList.add('is-off');
      setTask(i); setStrip(i);
      run.after(250, () => {
        el.classList.remove('is-off');
        img.style.transition = `transform 600ms ${EASE}`;
        img.style.transform = viewT(view(type, i));
      });
      run.after(850, () => setGood(true));
      run.after(1150, () => {
        shutter.classList.add('is-press'); run.after(160, () => shutter.classList.remove('is-press'));
        flash.classList.add('is-on'); run.after(80, () => flash.classList.remove('is-on'));
        fly(i);
      });
      run.after(1600, () => {
        setStrip(i + 1);
        if (k + 1 >= LOOP || i + 1 >= n) {
          run.after(1800, () => { el.classList.add('is-fade'); run.after(420, () => { el.classList.remove('is-fade'); start(); }); });
          return;
        }
        next(i + 1, k + 1);
      });
    }
    function next(i, k) {
      // the next task slides in; the next "live" photo fades in, still misaligned
      task.classList.add('is-out');
      const b = imgs[1 - front];
      b.style.transition = 'none'; setImg(b, i, true); reflow(b); b.style.transition = '';
      imgs[front].classList.remove('is-on'); b.classList.add('is-on'); front = 1 - front;
      run.after(120, () => {
        task.classList.remove('is-out'); task.classList.add('is-in'); reflow(task); task.classList.remove('is-in');
        shoot(i, k);
      });
    }
    function fly(i) {
      const r = el.getBoundingClientRect();
      const k = r.width / 390 || 1;
      const sr = slots[i].getBoundingClientRect();
      const f = document.createElement('img');
      const v = view(type, i);
      f.className = 'sg-fly';
      f.src = asset(v.src);
      f.setAttribute('style', `left:115px;top:190px;width:160px;height:210px;object-position:${v.fx * 100}% ${v.fy * 100}%`);
      el.appendChild(f);
      reflow(f);
      const x = (sr.left - r.left) / k, y = (sr.top - r.top) / k, w = sr.width / k;
      f.style.transform = `translate(${x - 115}px, ${y - 190}px) scale(${w / 160}, ${(sr.height / k) / 210})`;
      f.style.opacity = '0.2';
      run.after(700, () => f.remove());
    }
    function start() {
      el.querySelectorAll('.sg-fly').forEach((f) => f.remove());
      front = 0;
      imgs.forEach((im, k) => { im.style.transition = 'none'; im.classList.toggle('is-on', k === 0); });
      setImg(imgs[0], S, true); reflow(el);
      imgs[0].style.transition = '';
      shoot(S, 0);
    }
    return {
      reset() { el.classList.remove('is-off', 'is-fade'); front = 0; show(S); },
      end() { el.classList.remove('is-off', 'is-fade'); front = 0; show(S); },
      play: start,
      pause() { el.querySelectorAll('.sg-fly').forEach((f) => f.remove()); el.classList.remove('is-fade'); },
      set(k, v) { if (k === 'task') show(Math.max(0, Math.min(n - 1, v - 1))); },
    };
  }

  // =====================================================================================
  const SCREENS = {
    welcome,
    'interview-rec': interview,
    photos,
    'design-picker': designPicker,
    'site-building': siteBuilding,
    'site-ready': siteReady,
    'agents-near': agentsNear,
    'site-browser': siteBrowser,
    'interview-list': interviewList,
    'interview-cam': interviewCam,
    'shot-list': shotList,
    'shot-guide': shotGuide,
  };

  function mount(screenEl, name, opts = {}) {
    const factory = SCREENS[name];
    if (!factory) throw new Error(`TendsoScreens: unknown screen "${name}"`);
    if (screenEl.__tendsoScreen) screenEl.__tendsoScreen.destroy();
    screenEl.innerHTML = '';
    const el = document.createElement('div');
    el.className = `app scr scr-${name}`;
    el.dataset.screen = name;
    screenEl.appendChild(el);
    const run = makeRunner();
    const icons = () => hydrateIcons(el);
    const s = factory(el, opts, run, icons);
    icons();

    const api = {
      el,
      name,
      playing: false,
      play() {
        if (api.playing) return api;
        api.playing = true;
        el.classList.add('is-playing');
        if (reduced()) { s.end(); return api; }
        s.play();
        return api;
      },
      pause() {
        run.clear();
        if (api.playing && s.pause) s.pause();
        api.playing = false;
        el.classList.remove('is-playing');
        return api;
      },
      reset() { api.pause(); s.reset(); return api; },
      set(key, value) { if (s.set) s.set(key, value, api); return api; },
      rehydrate: icons,
      destroy() { api.pause(); el.remove(); if (screenEl.__tendsoScreen === api) screenEl.__tendsoScreen = null; },
    };
    s.reset();
    if (reduced()) s.end();
    screenEl.__tendsoScreen = api;
    return api;
  }

  window.TendsoScreens = { mount, names: Object.keys(SCREENS), questions: QUESTIONS.slice() };
})();
