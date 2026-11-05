/* For field agents page (pages/creators.html).
   Hero phone + paid card, the visit stepper (one phone, four screens), the earnings block
   (price slider + shops per week → you keep per site, example per month), FAQ, nav.

   Money (packages/shared/pricing.ts): website ₱4,999; the agent picks any price from ₱999 (BASE_PRICE) to
   ₱4,999 (₱100 steps in apps/mobile PriceSlider; this page snaps to ₱500); the agent keeps Math.round(price × 0.5).
   Theo 2026-10-21: show how agents earn, WITH calculators; every result is labelled "Example".
   A month = shops a week × 4 weeks. */
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const FLOOR = 999, CEIL = 4999, STEP = 500, RATE = 0.5, WEEKS = 4;   // the web slider snaps to ₱500 (Theo); the app allows ₱100 steps
  const keep = (p) => Math.round(p * RATE);
  const peso = (n) => '₱' + Math.round(n).toLocaleString('en-US');
  const VIDEO = { video: 'assets/video/interview-2.mp4', poster: 'assets/video/interview-2.jpg', lang: 'en' };   // same as js/steps.js

  // count a number in an element from its current value to `to` (calm, ease-out)
  const tweens = new WeakMap();
  function countTo(el, to, ms = 520) {
    if (!el) return;
    const from = tweens.get(el)?.value ?? to;
    const prev = tweens.get(el); if (prev) cancelAnimationFrame(prev.raf);
    const st = { value: from, raf: 0 };
    tweens.set(el, st);
    if (T.reduced || from === to) { st.value = to; el.textContent = peso(to); return; }
    const t0 = performance.now();
    const tick = (now) => {
      const k = Math.min(1, (now - t0) / ms);
      st.value = from + (to - from) * T.ease.out(k);
      el.textContent = peso(st.value);
      if (k < 1) st.raf = requestAnimationFrame(tick); else st.value = to;
    };
    st.raf = requestAnimationFrame(tick);
  }

  // ---------------------------------------------------------------- hero
  function hero() {
    const slot = $('#hero-phone');
    const { el, screen } = T.phone({ size: 'md', theme: 'dark' });
    slot.appendChild(el);
    let ctl = null;
    try { ctl = TendsoScreens.mount(screen, 'interview-cam', VIDEO); } catch (e) { console.error('interview-cam', e); }
    if (ctl && !T.reduced) T.inView(slot, (on) => (on ? ctl.play() : ctl.pause()), { threshold: 0.2 });
    else ctl?.play();

    // the paid card arrives after the phone, its number counts up once
    const card = $('#hero-paid');
    const num = card.querySelector('[data-count]');
    const go = () => {
      card.classList.add('is-in');
      if (!T.reduced) { tweens.set(num, { value: 0, raf: 0 }); num.textContent = peso(0); setTimeout(() => countTo(num, 1500, 1300), 260); }
    };
    T.reduced ? go() : setTimeout(go, 1100);
  }

  // ---------------------------------------------------------------- visit stepper
  const STEPS = [
    { cap: 'Your map: shops with no website yet', make: (layer) => AgentScreens.map(layer) },
    { cap: 'The owner talks, the app asks', screen: 'interview-cam', opts: VIDEO },
    { cap: 'The app shows each shot', screen: 'shot-guide', opts: { type: 'barber' } },
    { cap: 'What the owner sees, the same day', screen: 'site-ready', opts: {} },
  ];
  function visit() {
    const host = $('#visit-phone');
    const cap = $('#visit-cap');
    const items = $$('#visit-steps .ag-step');
    const { el, screen } = T.phone({ size: 'md' });
    host.appendChild(el);
    const ctls = STEPS.map((s, i) => {
      const layer = document.createElement('div');
      layer.className = 'ag-layer' + (i === 0 ? ' is-on' : '');
      layer.setAttribute('aria-hidden', i !== 0);
      screen.appendChild(layer);
      try { return s.make ? s.make(layer) : TendsoScreens.mount(layer, s.screen, s.opts); }
      catch (e) { console.error('visit screen', s.screen, e); return null; }
    });
    const layers = $$('.ag-layer', screen);
    layers.forEach((l, k) => { l.hidden = k !== 0; });   // after mounting, so screens measure while visible

    let cur = 0, timer = 0, visible = false;
    const AUTO = 6500, AFTER_CLICK = 12000;
    function show(i, { manual = false } = {}) {
      cur = i;
      items.forEach((li, k) => {
        const on = k === i;
        li.classList.toggle('is-on', on);
        li.classList.remove('is-timing');
        li.querySelector('.ag-step-btn').setAttribute('aria-expanded', on);
      });
      layers.forEach((l, k) => {
        const on = k === i;
        l.setAttribute('aria-hidden', !on);
        clearTimeout(l._hide);
        if (on) { l.hidden = false; void l.offsetWidth; l.classList.add('is-on'); }
        else if (l.classList.contains('is-on')) { l.classList.remove('is-on'); l._hide = setTimeout(() => { if (!l.classList.contains('is-on')) l.hidden = true; }, 560); }
        else l.hidden = true;
      });
      ctls.forEach((c, k) => { try { if (!c) return; k === i && visible ? c.play?.() : c.pause?.(); } catch (e) { /* screen owns its loop */ } });
      if (cap.textContent !== STEPS[i].cap) {
        cap.classList.add('is-swap');
        setTimeout(() => { cap.textContent = STEPS[i].cap; cap.classList.remove('is-swap'); }, 200);
      }
      schedule(manual ? AFTER_CLICK : AUTO);
    }
    function schedule(ms) {
      clearTimeout(timer);
      if (T.reduced || !visible) return;
      const li = items[cur];
      li.style.setProperty('--ag-dur', ms + 'ms');
      void li.offsetWidth;
      li.classList.add('is-timing');
      timer = setTimeout(() => show((cur + 1) % STEPS.length), ms);
    }
    items.forEach((li, i) => li.querySelector('.ag-step-btn').addEventListener('click', () => show(i, { manual: true })));
    T.inView($('#visit'), (on) => {
      visible = on;
      if (on) show(cur);
      else { clearTimeout(timer); items[cur].classList.remove('is-timing'); ctls.forEach((c) => c?.pause?.()); }
    }, { threshold: 0.35 });
    if (T.reduced) ctls[0]?.play?.();
  }

  // ---------------------------------------------------------------- calculator (one block)
  function earn() {
    const input = $('#calc-price');
    const out = $('#calc-price-out');
    const shopsEl = $('#calc-shops');
    const less = $('#calc-less'), more = $('#calc-more');
    const keepEl = $('#calc-keep'), monthEl = $('#calc-month'), keepInline = $('#calc-keep-inline');
    let price = +input.value, shops = +shopsEl.textContent;
    const MIN_SHOPS = 1, MAX_SHOPS = 10;
    [keepEl, monthEl].forEach((e) => tweens.set(e, { value: 0, raf: 0 }));

    function render({ instant = false } = {}) {
      const k = keep(price);
      input.style.setProperty('--p', ((price - FLOOR) / (CEIL - FLOOR)) * 100 + '%');
      input.setAttribute('aria-valuetext', peso(price));
      out.textContent = peso(price);
      const ms = instant ? 0 : 520;
      countTo(keepEl, k, ms); countTo(monthEl, k * shops * WEEKS, ms);
      if (keepInline) keepInline.textContent = peso(k);
      shopsEl.textContent = shops;
      less.disabled = shops <= MIN_SHOPS; more.disabled = shops >= MAX_SHOPS;
    }
    const snap = (v) => Math.max(FLOOR, Math.min(CEIL, FLOOR + Math.round((v - FLOOR) / STEP) * STEP));
    input.addEventListener('input', () => { price = snap(+input.value); render(); });
    less.addEventListener('click', () => { shops = Math.max(MIN_SHOPS, shops - 1); render(); });
    more.addEventListener('click', () => { shops = Math.min(MAX_SHOPS, shops + 1); render(); });
    render({ instant: true });

    // for checks: window.AgentCalc.state()
    window.AgentCalc = {
      state: () => ({ price, shops, keep: keep(price), month: keep(price) * shops * WEEKS }),
      set: (p, n) => { if (p != null) { price = snap(p); input.value = price; } if (n != null) shops = Math.max(MIN_SHOPS, Math.min(MAX_SHOPS, n)); render({ instant: true }); },
    };
  }

  // ---------------------------------------------------------------- FAQ
  const FAQ = [
    ['Do I need experience?', 'No. The training takes about 20 minutes, and the app guides you through every visit.'],
    ['What do I need?', 'A phone (iPhone or Android) with the Tendso app, and an email for your Wise payouts.'],
    ['Do I collect money from the shop?', 'No. The shop pays Tendso directly. Your half lands in your wallet when their payment is confirmed.'],
    ['How do I get paid?', "To your Wise email. Cash out any amount. You don't need a Wise account first: Wise emails you a link. Use it within 7 days."],
    ['Can I choose the price?', 'Yes. Any price from ₱999 to ₱4,999, for each shop, from your first site.'],
    ['The shop has a Facebook page. Does it count?', 'Yes. A shop with a Facebook or Instagram page can still get a website.'],
  ];
  const PLUS = '<svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M7 2v10M2 7h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';
  function faq() {
    const root = $('#faq-list');
    root.innerHTML = FAQ.map(([q, a]) => `<details class="ag-qa"><summary>${q}<span class="ag-qa-plus">${PLUS}</span></summary><div class="ag-qa-a"><p>${a}</p></div></details>`).join('');
    $$('.ag-qa', root).forEach((d) => {
      const sum = d.querySelector('summary'), body = d.querySelector('.ag-qa-a');
      sum.addEventListener('click', (e) => {
        if (T.reduced) return;
        e.preventDefault();
        if (d.dataset.busy) return;
        d.dataset.busy = '1';
        const opening = !d.open;
        if (opening) d.open = true;
        const h = body.scrollHeight;
        const a = body.animate(
          opening
            ? [{ height: '0px', opacity: 0, filter: 'blur(6px)' }, { height: h + 'px', opacity: 1, filter: 'blur(0)' }]
            : [{ height: h + 'px', opacity: 1, filter: 'blur(0)' }, { height: '0px', opacity: 0, filter: 'blur(6px)' }],
          { duration: opening ? 520 : 360, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' });
        a.onfinish = () => { if (!opening) d.open = false; delete d.dataset.busy; };
      });
    });
  }

  // ---------------------------------------------------------------- shell
  function review() {
    const rs = $('#review-switch');
    if (!rs) return;
    const set = (on) => { document.documentElement.classList.toggle('review', on); rs.setAttribute('aria-pressed', on); };
    rs.addEventListener('click', () => set(!document.documentElement.classList.contains('review')));
    addEventListener('keydown', (e) => { if (e.key === 'r' && !/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) set(!document.documentElement.classList.contains('review')); });
  }
  function shell() {
    const nav = $('#nav');
    T.onScroll((y) => nav?.classList.toggle('is-tight', y > 24));
    // footer links were written for the landing: send the ones this page lacks back to it
    $$('#foot a[href^="#"]').forEach((a) => {
      const id = a.getAttribute('href');
      if (id.length > 1 && !document.querySelector(id)) a.setAttribute('href', '../index.html' + id);
    });
    document.addEventListener('click', (e) => {
      const a = e.target.closest('a[href^="#"]');
      if (!a) return;
      const id = a.getAttribute('href');
      if (id.length < 2 || !document.querySelector(id)) return;
      e.preventDefault(); T.scrollTo(id, { offset: -72 });
    });
  }

  const run = (fn, name) => { try { fn(); } catch (e) { console.error('Agents', name, e); } };
  window.TendsoCreators = {
    init() { run(hero, 'hero'); run(visit, 'visit'); run(earn, 'earn'); run(faq, 'faq'); run(review, 'review'); },
    ready() { run(shell, 'shell'); },
  };
})();
