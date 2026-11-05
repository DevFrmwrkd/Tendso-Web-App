/* Hero v2 (Theo, 2026-10-21): calm and symmetric.
   One phone in the centre. It shows the interview (a real person, one simple question at a time).
   The Tendso buddy pops up and types "Got it. I'll build your website.", a short loading bar runs,
   the phone turns into the finished site and four homepages slide out from behind it into a mirrored
   layout (two left, two right) where they float gently. Loops every ~24 s.
   On scroll the stage shrinks into the first grid tile and hands over to the gallery of real sites there. */
(function () {
  const S = { cards: [] };
  const APPLE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16.4 12.6c0-2.4 2-3.6 2.1-3.7-1.1-1.7-2.9-1.9-3.5-1.9-1.5-.2-2.9.9-3.7.9-.8 0-1.9-.9-3.2-.8-1.6 0-3.1 1-4 2.4-1.7 3-.4 7.3 1.2 9.7.8 1.2 1.8 2.5 3 2.4 1.2 0 1.7-.8 3.1-.8 1.5 0 1.9.8 3.2.8 1.3 0 2.2-1.2 3-2.4.9-1.4 1.3-2.7 1.3-2.8-.1 0-2.5-1-2.5-3.8ZM14 5.4c.7-.8 1.1-1.9 1-3-1 0-2.1.7-2.8 1.5-.6.7-1.2 1.8-1 2.9 1 .1 2.1-.6 2.8-1.4Z"/></svg>';
  const PLAY = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.3 2.3c-.2.2-.3.6-.3 1v17.4c0 .4.1.8.3 1l9.6-9.7-9.6-9.7Zm10.7 10.8 2.9 2.9-11 6.3c-.4.2-.8.3-1.1.1l9.2-9.3Zm0-2.2L5.8 1.6c.3-.2.7-.1 1.1.1l11 6.3-2.9 2.9Zm4.2-1.6 3 1.7c.9.5.9 1.4 0 1.9l-3 1.7-3.1-3 3.1-2.3Z"/></svg>';
  const SAY = "Got it. I'll build your website.";
  // timeline (ms) of one loop
  const TL = { buddy: 2600, type0: 2900, type1: 4200, load0: 4400, load1: 5700, site: 5700, out0: 5800, done: 6500, bubbleOff: 10000, retract: 15000, loop: 16000 };   // Theo 2026-10-21: faster

  // showcase sites (docs/landing-mock/showcase/, captured to assets/sites/showcase/): no address bar text
  function siteCard(id, name) {
    const el = document.createElement('div');
    el.className = 'site-card';
    el.innerHTML = `<div class="site-bar"><i></i><i></i><i></i></div>
      <div class="site-shot"><img src="assets/sites/showcase/${id}-d.jpg" alt="${name}, a site made with the Tendso app" decoding="async"></div>`;
    return { el };
  }

  function layout() {
    const W = S.stageW = innerWidth, H = S.stageH = innerHeight;
    const mobile = S.mobile = W < 760;
    S.world.style.width = W + 'px'; S.world.style.height = H + 'px';
    S.pw = mobile ? Math.round(Math.min(W * 0.46, H * 0.28)) : Math.round(Math.min(280, Math.max(220, H * 0.3)));
    S.phoneEl.style.setProperty('--pw', S.pw + 'px');
    S.ph = S.phoneEl.offsetHeight;
    S.cx = W / 2;
    S.cy = mobile ? H * 0.38 : H * 0.48;
    S.cw = mobile ? Math.round(W * 0.46) : Math.round(Math.min(440, Math.max(280, W * 0.24)));
    S.cards.forEach((c) => { c.el.style.setProperty('--cw', S.cw + 'px'); c.w = c.el.offsetWidth; c.h = c.el.offsetHeight; });
    // mirrored slots: inner pair close and large, outer pair further, smaller and softer
    const inner = S.pw / 2 + S.cw * (mobile ? 0.18 : 0.46);
    const outer = S.pw / 2 + S.cw * (mobile ? 0.62 : 1.18);
    S.slots = [
      { x: -outer, y: mobile ? 34 : 70, s: mobile ? 0.7 : 0.78, ry: 18, blur: 2.5, z: 1 },
      { x: -inner, y: mobile ? -26 : -46, s: mobile ? 0.86 : 1, ry: 12, blur: 0, z: 2 },
      { x: inner, y: mobile ? -26 : -46, s: mobile ? 0.86 : 1, ry: -12, blur: 0, z: 2 },
      { x: outer, y: mobile ? 34 : 70, s: mobile ? 0.7 : 0.78, ry: -18, blur: 2.5, z: 1 },
    ];
    S.buddyEl.style.setProperty('--bs', (mobile ? 72 : 104) + 'px');
    S.buddyEl.style.left = (S.cx + S.pw / 2 - (mobile ? 34 : 30)) + 'px';
    S.buddyEl.style.top = (S.cy + S.ph / 2 - (mobile ? 40 : 160)) + 'px';
  }

  // state of the loop at time t (ms since loop start) → render
  function frame(now) {
    if (S.t0 == null) S.t0 = now;
    const t = T.reduced ? TL.done + 1000 : (now - S.t0) % TL.loop;
    const sec = now / 1000;
    S.mx += (S.tx - S.mx) * 0.045; S.my += (S.ty - S.my) * 0.045;

    // phone: centre, upright, a slow breath
    const bob = T.reduced ? 0 : Math.sin(sec * 0.8) * 6;
    const px = S.cx - S.pw / 2 + S.mx * 10, py = S.cy - S.ph / 2 + bob + S.my * 6;
    S.phoneEl.style.transform = `translate3d(${px.toFixed(1)}px, ${py.toFixed(1)}px, 0) perspective(1400px) rotateY(${(S.mx * 4).toFixed(2)}deg) rotateX(${(-S.my * 3).toFixed(2)}deg)`;

    // phone screen: interview → finished site
    const siteOn = t >= TL.site && t < TL.retract;
    if (siteOn !== S.siteOn) {
      S.siteOn = siteOn; S.phoneEl.classList.toggle('is-site', siteOn);
      if (!siteOn) { S.screenCtl?.reset?.(); S.screenCtl?.play?.(); }
    }

    // buddy + bubble
    S.hero.classList.toggle('buddy-on', t >= TL.buddy && t < TL.bubbleOff);
    const n = Math.round(T.prog(t, TL.type0, TL.type1) * SAY.length);
    if (n !== S.n) { S.n = n; S.say.textContent = SAY.slice(0, n); }
    S.hero.classList.toggle('typing', t >= TL.type0 && t < TL.type1);
    S.bar.style.transform = `scaleX(${T.ease.inout(T.prog(t, TL.load0, TL.load1)).toFixed(3)})`;
    S.hero.classList.toggle('loading', t >= TL.load0 && t < TL.done);
    S.hero.classList.toggle('built', t >= TL.done);

    // homepages: out from behind the phone into mirrored slots, then float; retract at the end of the loop
    S.cards.forEach((c, k) => {
      const slot = S.slots[k];
      const start = TL.out0 + (slot.z === 2 ? 0 : 180);
      let p = T.ease.expo(T.prog(t, start, start + 900));
      if (t >= TL.retract) p = 1 - T.ease.inout(T.prog(t, TL.retract, TL.retract + 800));
      const fl = T.reduced ? 0 : Math.sin(sec * 0.55 + (slot.z === 2 ? 0 : 1.3)) * 7; // same phase per pair → symmetric
      const x = S.cx + slot.x * p - c.w / 2 + S.mx * 18 * slot.s;
      const y = S.cy + slot.y * p - c.h / 2 + fl + S.my * 10 * slot.s;
      const s = T.lerp(0.55, slot.s, p);
      c.el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) scale(${s.toFixed(4)}) perspective(1400px) rotateY(${(slot.ry * p).toFixed(2)}deg)`;
      c.el.style.opacity = T.prog(p, 0.05, 0.5).toFixed(3);
      const blur = Math.round((slot.blur + (1 - p) * 12) * 2) / 2;
      if (blur !== c.blur) { c.el.style.filter = blur ? `blur(${blur}px)` : 'none'; c.blur = blur; }
      c.el.style.zIndex = String(10 + slot.z);
    });
  }

  // ---- collapse into the grid (restored, Theo 2026-10-21) ----
  // The stage shrinks into the first grid tile (#slot-stage). Once it has landed, the gallery of real sites in that
  // tile fades in and the shrunken stage fades out (CSS: .tile--slot:has(.stage.is-docked)).
  function collapse() {
    const slot = document.getElementById('slot-stage');
    if (!slot) return;
    const vh = innerHeight, vw = innerWidth;
    const raw = T.clamp(T.scrollY / (vh * 0.9), 0, 1);
    const p = T.ease.out(raw);
    const c = T.prog(raw, 0, 0.38);
    S.copy.style.opacity = (1 - c).toFixed(3);
    S.copy.style.filter = c > 0.01 ? `blur(${(c * 10).toFixed(1)}px)` : 'none';
    S.copy.style.transform = `translate3d(0, ${(-c * 24).toFixed(1)}px, 0)`;
    S.copy.style.visibility = c >= 1 ? 'hidden' : 'visible';
    slot.style.setProperty('--gal', T.prog(raw, 0.55, 1).toFixed(3));   // gallery fades in while the stage lands
    if (raw >= 1) {
      if (!S.docked) { slot.appendChild(S.stage); S.stage.classList.add('is-docked'); S.stage.style.cssText = ''; S.docked = true; }
      fitWorld(slot.clientWidth, slot.clientHeight, 1);
      return;
    }
    if (S.docked) { S.hero.insertBefore(S.stage, S.hero.firstChild); S.stage.classList.remove('is-docked'); S.docked = false; }
    const r = slot.getBoundingClientRect();
    const rad = T.lerp(0, parseFloat(getComputedStyle(slot).borderRadius) || 40, p);
    const w = T.lerp(vw, r.width, p), h = T.lerp(vh, r.height, p);
    S.stage.style.cssText = `left:${T.lerp(0, r.left, p).toFixed(1)}px;top:${T.lerp(0, r.top, p).toFixed(1)}px;width:${w.toFixed(1)}px;height:${h.toFixed(1)}px;border-radius:${rad.toFixed(1)}px;opacity:${(1 - 0.85 * T.prog(raw, 0.7, 1)).toFixed(3)}`;
    fitWorld(w, h, p);
  }
  // the world keeps its full-screen layout; in the tile it is scaled to fit (contain), centred
  function fitWorld(w, h, p) {
    const s = Math.min(w / S.stageW, h / S.stageH) * T.lerp(1, 1.08, T.clamp(p, 0, 1));
    S.world.style.transform = `translate3d(${((w - S.stageW * s) / 2).toFixed(1)}px, ${((h - S.stageH * s) / 2).toFixed(1)}px, 0) scale(${s.toFixed(4)})`;
  }

  window.TendsoHero = {
    init() {
      const hero = S.hero = document.getElementById('hero');
      hero.innerHTML = `
        <div class="stage" id="stage"><div class="world"><div class="world-in">
          <div class="buddy" aria-hidden="true">
            <div class="buddy-bubble"><span class="buddy-say"></span><i class="buddy-caret"></i>
              <div class="buddy-load"><i></i></div><span class="buddy-done">Done. Here's your site.</span></div>
            <img class="buddy-img" src="assets/brand/buddy.png" alt="">
          </div>
        </div></div></div>
        <div class="hero-copy wrap">
          <div>
                        <h1 class="hero-title">The thinking ends here.</h1>
          </div>
          <div class="hero-ctas">
            <a class="btn btn--accent" href="#download">Download the app</a>
            <span class="hero-stores"><a href="${TD.links.appStore}" aria-label="App Store">${APPLE}</a><a href="${TD.links.googlePlay}" aria-label="Google Play">${PLAY}</a></span>
          </div>
        </div>`;
      S.stage = hero.querySelector('.stage');
      S.world = hero.querySelector('.world');
      S.copy = hero.querySelector('.hero-copy');
      S.buddyEl = hero.querySelector('.buddy');
      S.say = hero.querySelector('.buddy-say');
      S.bar = hero.querySelector('.buddy-load i');
      const inner = hero.querySelector('.world-in');

      [['baker', 'Rosal Bakeshop'], ['florist', 'Liwayway Flowers'], ['carpenter', 'Lakan Woodworks'], ['hela', 'Héla Hair Studio']]
        .forEach(([id, name]) => { const c = siteCard(id, name); S.cards.push(c); inner.appendChild(c.el); });

      // the app, front and centre: interview first, then the finished site
      const ph = T.phone({ size: 'md', cls: 'hero-phone' });
      S.phoneEl = ph.el;
      inner.appendChild(ph.el);
      const screenHost = ph.el.querySelector('.phone-screen');
      const siteLayer = document.createElement('div');
      siteLayer.className = 'hero-site';
      siteLayer.innerHTML = '<img src="assets/sites/showcase/forge-m-long.jpg" alt="">';
      screenHost.insertBefore(siteLayer, screenHost.querySelector('.phone-island'));
      if (window.TendsoScreens) {
        const has = (n) => (TendsoScreens.names || []).includes(n);
        S.screenCtl = has('interview-cam')
          ? TendsoScreens.mount(ph.screen, 'interview-cam', { owner: true, video: 'assets/video/interview-2.mp4', poster: 'assets/video/interview-2.jpg', lang: 'en' })
          : TendsoScreens.mount(ph.screen, 'interview-rec', { owner: true });
      }
      inner.appendChild(S.buddyEl); // buddy above the phone
      S.mx = S.my = S.tx = S.ty = 0;
      addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse') { S.tx = (e.clientX / innerWidth - 0.5) * 2; S.ty = (e.clientY / innerHeight - 0.5) * 2; } }, { passive: true });
    },
    ready() {
      layout();
      addEventListener('resize', () => { layout(); collapse(); });
      T.onFrame(frame);
      T.onScroll(() => { collapse(); document.getElementById('nav')?.classList.toggle('is-tight', T.scrollY > 30); });
      S.screenCtl?.play?.();
    },
    state: S,
  };
})();
