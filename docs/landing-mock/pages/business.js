/* For businesses page (pages/business.html). Agent D1.
   Also defines window.TendsoSub: the small shell both sub-pages share (nav state, footer, store buttons,
   in-page jumps). examples.html loads this file first, then examples.js. */
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const up = (p) => (/^(https?:|\.\.\/|\/|data:)/.test(p) ? p : '../' + p);   // data.js paths are root-relative

  const ICON = {
    apple: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16.37 12.6c-.02-2.3 1.88-3.4 1.96-3.46-1.07-1.56-2.73-1.78-3.32-1.8-1.41-.14-2.76.83-3.47.83-.72 0-1.82-.81-2.99-.79-1.54.02-2.96.9-3.75 2.27-1.6 2.78-.41 6.89 1.15 9.14.76 1.1 1.67 2.34 2.86 2.3 1.15-.05 1.58-.74 2.97-.74 1.38 0 1.77.74 2.98.72 1.23-.02 2.01-1.12 2.76-2.23.87-1.28 1.23-2.52 1.25-2.58-.03-.01-2.39-.92-2.4-3.66ZM14.1 5.86c.63-.77 1.06-1.83.94-2.89-.91.04-2.01.61-2.66 1.37-.58.67-1.1 1.76-.96 2.8 1.01.08 2.05-.52 2.68-1.28Z"/></svg>',
    play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.6 2.3 13.4 11 4.6 19.7c-.36-.2-.6-.6-.6-1.07V3.37c0-.47.24-.87.6-1.07Z"/><path d="m14.5 12.1 2.5 2.5-10.6 6.1 8.1-8.6Z" opacity=".8"/><path d="m14.5 9.9-8.1-8.6L17 7.4l-2.5 2.5Z" opacity=".8"/><path d="m18.3 8.2 2.6 1.5c.85.5.85 1.7 0 2.2l-2.6 1.5-2.7-2.7 2.7-2.5Z" opacity=".6"/></svg>',
    arrow: '<svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h15m-6-6 6 6-6 6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    lock: '<svg width="11" height="11" viewBox="0 0 12 12" aria-hidden="true"><rect x="2" y="5.2" width="8" height="5.8" rx="1.4" fill="currentColor"/><path d="M4 5.2V3.8a2 2 0 0 1 4 0v1.4" fill="none" stroke="currentColor" stroke-width="1.3"/></svg>',
    plus: '<svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M7 2v10M2 7h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
  };

  // ---------------------------------------------------------------- shared shell
  const Sub = {
    up, ICON,
    stores(el) {
      if (!el) return;
      const L = (window.TD && TD.links) || {};
      el.innerHTML = `
        <a class="store" href="${L.appStore || '#'}">${ICON.apple}<span><small>Download on the</small><b>App Store</b></span></a>
        <a class="store" href="${L.googlePlay || '#'}">${ICON.play}<span><small>Get it on</small><b>Google Play</b></span></a>`;
    },
    // a phone showing a long site screenshot (inside a .phone from T.phone)
    sitePhone({ src, url, size = 'md', cls = '', auto = false, scrollable = false, alt = '' }) {
      const ph = T.phone({ size, cls: (cls + ' is-site').trim() });
      ph.screen.innerHTML = `${T.statusBar()}<div class="site-scroll" ${scrollable ? 'data-lenis-prevent tabindex="0"' : ''}><img src="${src}" alt="${alt}" draggable="false"></div>${url ? `<div class="url-pill">${ICON.lock}${url}</div>` : ''}`;
      const img = ph.screen.querySelector('img');
      if (auto && !T.reduced) {
        const go = () => { img.style.setProperty('--travel', `-${Math.max(0, img.offsetHeight - 790 + 60)}px`); };
        img.complete ? go() : img.addEventListener('load', go);
        T.inView(ph.el, (on) => img.classList.toggle('is-run', on), { threshold: 0.05 });
      }
      return ph;
    },
    boot(renderFns) {
      renderFns.forEach((fn) => { try { fn(); } catch (e) { console.error(e); } });
      try { window.TendsoFoot?.init(); } catch (e) { console.error('Foot', e); }
      // footer links were written for the landing: point the ones this page lacks back to it
      document.querySelectorAll('#foot a[href^="#"]').forEach((a) => {
        const id = a.getAttribute('href');
        if (id.length > 1 && !document.querySelector(id)) a.setAttribute('href', '../index.html' + id);
      });
      T.init();
      try { window.TendsoFoot?.ready?.(); } catch (e) { console.error('Foot', e); }
      const nav = $('#nav');
      T.onScroll((y) => nav?.classList.toggle('is-tight', y > 30));
      document.addEventListener('click', (e) => {
        const a = e.target.closest('a[href^="#"]');
        if (!a) return;
        const id = a.getAttribute('href');
        if (id.length < 2 || !document.querySelector(id)) return;
        e.preventDefault(); T.scrollTo(id, { offset: -70 });
      });
    },
  };
  window.TendsoSub = Sub;

  if (!document.getElementById('bh-browser')) return;   // not the business page

  // ---------------------------------------------------------------- business sections
  function hero() {
    // phone: Kalan's mobile site, scrolling slowly by itself
    const ph = Sub.sitePhone({ src: '../assets/sites/kalan-m-long.jpg', url: 'kalan.tendso.site', auto: true, alt: "Kalan's website on a phone" });
    $('#bh-phone').appendChild(ph.el);

    // laptop: scroll-linked, the page glides as you scroll past it
    const view = $('#bh-browser .browser-view');
    const img = $('#bh-dimg');
    if (T.reduced) return;
    let travel = 0;
    const measure = () => { travel = Math.max(0, img.offsetHeight - view.offsetHeight); };
    img.complete ? measure() : img.addEventListener('load', measure);
    addEventListener('resize', measure);
    let cur = 0;
    T.onFrame(() => {
      const p = T.progress(view, 0.75, -0.6);
      const target = -T.ease.inout(p) * travel * 0.42;
      cur += (target - cur) * 0.12;
      if (Math.abs(target - cur) > 0.1) img.style.transform = `translate3d(0, ${cur.toFixed(1)}px, 0)`;
    });
  }

  function ways() {
    const host = $('#way-phone');
    const ph = T.phone({ size: 'md' });
    host.appendChild(ph.el);
    if (!window.TendsoScreens) return;
    try {
      const s = TendsoScreens.mount(ph.screen, 'interview-rec', { owner: true });
      T.inView(ph.el, (on) => (on ? s.play() : s.pause()), { threshold: 0.3 });
    } catch (e) { console.error('screen', e); }
  }

  function words() {
    const W = TD.words;
    // a still waveform (deterministic), the transcript, then the copy that came from it
    const wave = $('#wave');
    let h = '';
    for (let i = 0; i < 34; i++) { const v = 0.25 + 0.75 * Math.abs(Math.sin(i * 1.7) * Math.cos(i * 0.43)); h += `<i style="height:${(v * 22).toFixed(1)}px"></i>`; }
    wave.innerHTML = h;
    $('#transcript').textContent = `“${W.transcript}”`;
    $('#copy-out').innerHTML = W.copy.map((l, i) => `<span data-reveal style="--i:${i * 2 + 2}">${l}</span>`).join('');
  }

  function beforeAfter() {
    const P = TD.pairs[0];
    const ba = $('#ba');
    $('#ba-before').src = up(P.before); $('#ba-before').alt = 'Before: phone photo';
    $('#ba-after').src = up(P.after); $('#ba-after').alt = 'After: re-shot by Tendso';
    $('#ba-cap').textContent = P.caption;
    let x = 50, user = false;
    const set = (v) => { x = T.clamp(v, 0, 100); ba.style.setProperty('--x', x + '%'); ba.setAttribute('aria-valuenow', Math.round(x)); };
    const fromEvent = (e) => { const r = ba.getBoundingClientRect(); set(((e.clientX - r.left) / r.width) * 100); };
    let drag = false;
    ba.addEventListener('pointerdown', (e) => { drag = true; user = true; ba.setPointerCapture(e.pointerId); fromEvent(e); });
    ba.addEventListener('pointermove', (e) => drag && fromEvent(e));
    ba.addEventListener('pointerup', () => (drag = false));
    ba.addEventListener('pointercancel', () => (drag = false));
    ba.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') { user = true; set(x - 5); e.preventDefault(); }
      if (e.key === 'ArrowRight') { user = true; set(x + 5); e.preventDefault(); }
    });
    set(50);
    // one calm demonstration sweep the first time it comes into view
    if (T.reduced) return;
    let done = false;
    T.inView(ba, (on) => {
      if (!on || done) return; done = true;
      const t0 = performance.now(), D = 2600;
      const off = T.onFrame((now) => {
        if (user) return off();
        const t = Math.min(1, (now - t0) / D);
        // 50 → 18 → 50
        const k = t < 0.5 ? T.ease.inout(t / 0.5) : 1 - T.ease.inout((t - 0.5) / 0.5);
        set(50 - 32 * k);
        if (t >= 1) off();
      });
    }, { threshold: 0.6 });
  }

  function mobileTile() {
    const ph = Sub.sitePhone({ src: '../assets/sites/hela-m-long.jpg', size: 'sm', auto: true, alt: "Héla Hair Studio's website on a phone" });
    $('#mob-phone').appendChild(ph.el);
  }

  function serp() {
    const el = $('#serp-typed');
    const q = el.textContent;
    if (T.reduced) return;
    el.textContent = '';
    let started = false;
    T.inView(el, (on) => {
      if (!on || started) return; started = true;
      let i = 0;
      const tick = () => { el.textContent = q.slice(0, ++i); if (i < q.length) setTimeout(tick, 60 + Math.random() * 70); };
      setTimeout(tick, 400);
    }, { threshold: 1 });
  }

  function strip() {
    $('#strip').innerHTML = TD.sites.map((s, i) => `
      <a class="card" href="examples.html#${s.id}" data-reveal style="--i:${i % 3}">
        <div class="card-img card-img--d"><img src="../assets/sites/${s.id}-d.jpg" alt="${s.name} website" loading="lazy"><span class="card-view">Preview ${ICON.arrow}</span></div>
        <div class="card-meta"><b>${s.name}</b><span>${s.kind} · ${s.city}</span></div>
      </a>`).join('');
  }

  const FAQ = [
    ['How long does it take?', 'About 20 minutes in the app, or 30 with an agent at your shop. We build your site in about 20 minutes, the same day.'],
    ['Do I need a laptop?', 'No. Everything happens on your phone.'],
    ["What if I don't like it?", 'You see it live before you pay. If something is off, we change it. You only pay once you approve it.'],
    ['Can I change it later?', 'Yes. Edits are free for the first year. Ask us, we make the change.'],
    ['What about my domain?', 'You get your own address, like kalan.tendso.site. Prefer your own .com? We can register and set one up when your site goes live. Just ask.'],
    ['Who are the field agents?', 'Local people we train to interview you, take the photos and set up your site with the same app. They come to your shop.'],
  ];
  function faq() {
    const root = $('#faq');
    root.innerHTML = FAQ.map(([q, a]) => `
      <details class="qa"><summary>${q}<span class="qa-plus">${ICON.plus}</span></summary><div class="qa-a"><p>${a}</p></div></details>`).join('');
    // smooth open/close (height + blur), calm and physical
    root.querySelectorAll('.qa').forEach((d) => {
      const sum = d.querySelector('summary'), body = d.querySelector('.qa-a');
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

  Sub.boot([hero, ways, words, beforeAfter, mobileTile, serp, strip, faq, () => Sub.stores($('#stores'))]);
})();
