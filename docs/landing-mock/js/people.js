/* People: a photo cloud in depth (ramp.design "Beyond the work"). Agent B.
   A tall section with a sticky stage. Each photo has a gathered position around the headline and a speed:
   front (layer 0) faster and sharp, back (layer 1) slower, smaller, blurred and faded. Transforms only. */
(function () {
  // natural aspect (w/h) of each file, so sizes are known before images load
  const ASPECT = { '01': .8, '02': .753, '03': 1.25, '04': 1.488, '05': .8, '06': .8, '07': 1.25, '08': 1.488,
    '09': .8, '10': 1.488, '11': 1.488, '12': .8, '13': .8, '14': 1.25, '15': 1.488, '16': .8 };

  // Gathered positions (the moment the cloud sits around the headline).
  // x: fraction of stage width from centre; y: fraction of viewport height from centre; w: px at 1440×900.
  // Keyed by index in TD.people. sp = scroll speed multiplier, r = rotation (deg), dx = x drift per viewport scrolled.
  const DESK = [
    { i: 0,  x: -0.37, y: -0.27, w: 214, sp: 1.32, r: -1.6, dx: -0.010 },
    { i: 1,  x:  0.31, y: -0.33, w: 262, sp: 1.42, r:  1.2, dx:  0.012 },
    { i: 2,  x: -0.19, y:  0.31, w: 236, sp: 1.25, r:  1.4, dx:  0.008 },
    { i: 3,  x:  0.39, y:  0.20, w: 196, sp: 1.36, r: -1.8, dx: -0.012 },
    { i: 4,  x: -0.06, y: -0.58, w: 176, sp: 1.48, r:  0.8, dx:  0.006 },
    { i: 5,  x:  0.14, y:  0.55, w: 192, sp: 1.30, r: -1.0, dx: -0.008 },
    { i: 7,  x: -0.41, y:  0.62, w: 182, sp: 1.40, r:  1.9, dx:  0.010 },
    { i: 12, x:  0.43, y: -0.78, w: 170, sp: 1.52, r: -1.2, dx: -0.010 },
    { i: 6,  x: -0.16, y: -0.20, w: 150, sp: 0.66, r: -1.4, dx:  0.006 },
    { i: 8,  x:  0.19, y: -0.12, w: 176, sp: 0.72, r:  1.6, dx: -0.006 },
    { i: 9,  x: -0.30, y:  0.04, w: 184, sp: 0.62, r: -0.8, dx:  0.008 },
    { i: 10, x:  0.29, y:  0.38, w: 170, sp: 0.70, r:  1.0, dx: -0.004 },
    { i: 11, x:  0.04, y:  0.22, w: 160, sp: 0.64, r: -1.2, dx:  0.004 },
    { i: 13, x: -0.43, y: -0.62, w: 150, sp: 0.78, r:  1.4, dx:  0.006 },
    { i: 14, x:  0.46, y: -0.06, w: 156, sp: 0.68, r: -1.8, dx: -0.006 },
    { i: 15, x: -0.03, y:  0.78, w: 132, sp: 0.74, r:  1.8, dx:  0.004 },
  ];
  // phone: ten photos, still two layers. w is px at 390 wide.
  const MOB = [
    { i: 0,  x: -0.27, y: -0.30, w: 128, sp: 1.32, r: -1.6, dx: -0.02 },
    { i: 1,  x:  0.24, y: -0.42, w: 150, sp: 1.44, r:  1.4, dx:  0.02 },
    { i: 2,  x:  0.22, y:  0.28, w: 140, sp: 1.26, r:  1.2, dx: -0.02 },
    { i: 3,  x: -0.25, y:  0.46, w: 118, sp: 1.38, r: -1.8, dx:  0.02 },
    { i: 5,  x:  0.20, y:  0.76, w: 112, sp: 1.30, r: -1.0, dx: -0.01 },
    { i: 12, x: -0.18, y: -0.74, w: 110, sp: 1.50, r:  1.0, dx:  0.01 },
    { i: 6,  x:  0.30, y: -0.08, w: 92,  sp: 0.66, r: -1.4, dx:  0.01 },
    { i: 9,  x: -0.30, y:  0.10, w: 112, sp: 0.62, r:  1.0, dx: -0.01 },
    { i: 11, x:  0.02, y:  0.52, w: 104, sp: 0.70, r: -1.2, dx:  0.01 },
    { i: 13, x:  0.10, y: -0.60, w: 100, sp: 0.74, r:  1.6, dx: -0.01 },
  ];

  let root, stage, items = [], secTop = 0, secH = 0, vw = 0, vh = 0, mobile = false;
  let lastY = -1, dirty = true;

  function build() {
    const people = window.TD.people;
    mobile = innerWidth < 760;
    const set = mobile ? MOB : DESK;
    stage.querySelectorAll('.pc').forEach((n) => n.remove());
    items = set.map((s) => {
      const p = people[s.i];
      const key = p.src.match(/\/(\d\d)-/)[1];
      const layer = p.layer;
      const el = document.createElement(p.work ? 'button' : 'figure');
      el.className = `pc pc--l${layer}${p.work ? ' pc--link' : ''}`;
      if (p.work) {
        el.type = 'button';
        el.dataset.work = p.work;
        el.setAttribute('aria-label', `${p.alt}. See the site`);
      }
      el.innerHTML = `<img src="${p.src}" alt="${p.work ? '' : p.alt}" loading="lazy" decoding="async" draggable="false">`;
      stage.appendChild(el);
      return { el, s, aspect: ASPECT[key] || 1, layer, w: 0, h: 0 };
    });
    measure();
  }

  function measure() {
    vw = stage.clientWidth || innerWidth;
    vh = T.vh || innerHeight;
    const r = root.getBoundingClientRect();
    secTop = r.top + window.scrollY;
    secH = root.offsetHeight;
    const k = mobile ? T.clamp(vw / 390, 0.82, 1.3) : T.clamp(Math.min(vw / 1440, vh / 900), 0.62, 1.25);
    items.forEach((it) => {
      it.w = Math.round(it.s.w * k);
      it.h = Math.round(it.w / it.aspect);
      it.el.style.width = it.w + 'px';
      it.el.style.height = it.h + 'px';
      it.el.style.marginLeft = -it.w / 2 + 'px';
      it.el.style.marginTop = -it.h / 2 + 'px';
    });
    dirty = true;
  }

  // s = px scrolled past the section top. Gathered at the middle of the pinned stretch.
  function place(y) {
    const pinLen = Math.max(1, secH - vh);
    const s = y - secTop;
    if (s < -vh * 1.1 || s > secH + vh * 0.1) return; // offscreen: skip writes
    const mid = pinLen * 0.5;
    const d = T.reduced ? 0 : (s - mid);            // px away from the gathered moment
    const ySpread = T.reduced ? (mobile ? 0.62 : 0.66) : 1;
    for (let n = 0; n < items.length; n++) {
      const it = items[n], c = it.s;
      const tx = c.x * vw + (d / vh) * c.dx * vw;
      const ty = c.y * vh * ySpread - d * c.sp;
      const rot = c.r + (d / vh) * c.r * 0.35;
      it.el.style.transform = `translate3d(${tx.toFixed(1)}px, ${ty.toFixed(1)}px, 0) rotate(${rot.toFixed(2)}deg)`;
    }
  }

  function onClick(e) {
    const b = e.target.closest('.pc--link');
    if (!b) return;
    window.TendsoWork?.open(b.dataset.work);
  }

  window.TendsoPeople = {
    init() {
      root = document.getElementById('people');
      if (!root) return;
      root.innerHTML = `
        <div class="people-stage">
          <div class="people-copy">
            <h2 class="people-h">The people behind the sites.</h2>
            <p class="people-sub">Field agents, creators and the team. Filipino first, local everywhere.</p>
          </div>
        </div>`;
      stage = root.querySelector('.people-stage');
      if (T.reduced) root.classList.add('is-static');
      build();
      stage.addEventListener('click', onClick);
    },
    ready() {
      if (!root) return;
      measure();
      T.onScroll((y) => { if (y !== lastY) { lastY = y; dirty = true; } });
      T.onFrame(() => { if (!dirty) return; dirty = false; place(T.scrollY); });
      let t;
      addEventListener('resize', () => {
        clearTimeout(t);
        t = setTimeout(() => { if ((innerWidth < 760) !== mobile) build(); else measure(); }, 120);
      });
      // other sections (images, pinned stretches) can change the page height above us
      new ResizeObserver(() => measure()).observe(document.body);
    },
  };
})();
