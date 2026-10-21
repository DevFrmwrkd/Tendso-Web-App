/* Tendso landing mock — shared motion core (window.T).
   Smooth scroll (Lenis), one rAF loop, scroll-linked progress, blur-in reveals, phone frames. */
(function () {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // cubic-bezier solver (same curves as the CSS tokens)
  function bezier(x1, y1, x2, y2) {
    const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
    const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
    const sx = (t) => ((ax * t + bx) * t + cx) * t;
    const sy = (t) => ((ay * t + by) * t + cy) * t;
    const dx = (t) => (3 * ax * t + 2 * bx) * t + cx;
    return (x) => {
      if (x <= 0) return 0; if (x >= 1) return 1;
      let t = x;
      for (let i = 0; i < 6; i++) { const e = sx(t) - x; const d = dx(t); if (Math.abs(e) < 1e-5 || !d) break; t -= e / d; }
      return sy(t);
    };
  }
  const ease = {
    out: bezier(0.22, 1, 0.36, 1),
    expo: bezier(0.16, 1, 0.3, 1),
    inout: bezier(0.77, 0, 0.175, 1),
    linear: (t) => t,
  };
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const prog = (v, a, b) => clamp((v - a) / (b - a), 0, 1);
  const mapRange = (v, a, b, c, d) => lerp(c, d, prog(v, a, b));

  // ---- shared loop ---------------------------------------------------------
  const frameFns = new Set();
  const scrollFns = new Set();
  let last = performance.now();
  let lenis = null;
  const T = {
    reduced, ease, clamp, lerp, prog, mapRange,
    scrollY: window.scrollY,
    vh: innerHeight, vw: innerWidth,
    onFrame(fn) { frameFns.add(fn); return () => frameFns.delete(fn); },
    onScroll(fn) { scrollFns.add(fn); fn(T.scrollY); return () => scrollFns.delete(fn); },
  };

  function emitScroll(y) { T.scrollY = y; scrollFns.forEach((fn) => fn(y)); }

  function loop(now) {
    const dt = Math.min(64, now - last); last = now;
    if (lenis) lenis.raf(now);
    frameFns.forEach((fn) => fn(now, dt));
    requestAnimationFrame(loop);
  }

  function initScroll() {
    if (window.Lenis && !reduced) {
      lenis = new window.Lenis({ lerp: 0.085, wheelMultiplier: 0.9, smoothWheel: true, syncTouch: false });
      lenis.on('scroll', (e) => emitScroll(e.scroll));
      T.lenis = lenis;
    } else {
      addEventListener('scroll', () => emitScroll(window.scrollY), { passive: true });
    }
    addEventListener('resize', () => { T.vh = innerHeight; T.vw = innerWidth; emitScroll(T.scrollY); });
    requestAnimationFrame(loop);
  }

  T.scrollTo = (target, opts = {}) => {
    if (lenis) lenis.scrollTo(target, { duration: 1.4, easing: ease.expo, ...opts });
    else (typeof target === 'number' ? window.scrollTo({ top: target, behavior: 'smooth' }) : document.querySelector(target)?.scrollIntoView({ behavior: 'smooth' }));
  };
  T.stop = () => lenis && lenis.stop();
  T.start = () => lenis && lenis.start();

  // 0 when el's top sits at a×vh, 1 when it sits at b×vh
  T.progress = (el, a = 1, b = 0) => {
    const top = el.getBoundingClientRect().top;
    return prog(top, a * T.vh, b * T.vh);
  };

  T.inView = (el, fn, opts = { threshold: 0.15 }) => {
    const io = new IntersectionObserver((entries) => entries.forEach((e) => fn(e.isIntersecting, e)), opts);
    io.observe(el); return () => io.disconnect();
  };

  // ---- reveals: visible at rest; only things below the first screen wait to blur in ----
  T.reveal = (root = document) => {
    const els = root.querySelectorAll('[data-reveal]:not(.is-armed)');
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); } });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    els.forEach((el) => {
      const r = el.getBoundingClientRect();
      if (reduced || r.top < innerHeight * 0.95) { el.classList.add('is-in'); return; }
      el.classList.add('is-armed'); io.observe(el);
    });
  };

  // ---- phones ------------------------------------------------------------------
  const phoneRO = new ResizeObserver((entries) => entries.forEach((e) => {
    const w = e.contentRect.width;
    e.target.style.setProperty('--s', (w / 390).toFixed(5));
  }));
  T.fitPhones = (root = document) => root.querySelectorAll('.phone .phone-screen').forEach((s) => phoneRO.observe(s));

  T.phone = ({ size = 'md', theme = 'light', cls = '' } = {}) => {
    const el = document.createElement('div');
    el.className = `phone phone--${size} ${cls}`.trim();
    el.dataset.theme = theme;
    el.innerHTML = `<div class="phone-body">
      <div class="phone-btn phone-btn--a"></div><div class="phone-btn phone-btn--b"></div><div class="phone-btn phone-btn--c"></div>
      <div class="phone-screen"><div class="screen-root"></div><div class="phone-island"></div></div></div>`;
    const screen = el.querySelector('.screen-root');
    phoneRO.observe(el.querySelector('.phone-screen'));
    return { el, screen };
  };

  // iOS-style status bar for app screens (dark = light glyphs)
  T.statusBar = (dark = false) => `
    <div class="sb ${dark ? 'sb--dark' : ''}">
      <span class="sb-time">9:41</span>
      <span class="sb-icons">
        <svg width="18" height="12" viewBox="0 0 18 12" aria-hidden="true"><rect x="0" y="8" width="3" height="4" rx="1"/><rect x="5" y="5.5" width="3" height="6.5" rx="1"/><rect x="10" y="3" width="3" height="9" rx="1"/><rect x="15" y="0" width="3" height="12" rx="1"/></svg>
        <svg width="16" height="12" viewBox="0 0 16 12" aria-hidden="true"><path d="M8 2.6c2.3 0 4.4.9 6 2.4l1.1-1.2A10.2 10.2 0 0 0 8 1 10.2 10.2 0 0 0 .9 3.8L2 5a8.6 8.6 0 0 1 6-2.4Zm0 3.3c1.4 0 2.7.5 3.7 1.4l1.1-1.2A7 7 0 0 0 8 4.3 7 7 0 0 0 3.2 6.1l1.1 1.2c1-.9 2.3-1.4 3.7-1.4Zm0 3.3c-.6 0-1.1.2-1.5.6L8 11.3l1.5-1.5c-.4-.4-.9-.6-1.5-.6Z"/></svg>
        <svg width="27" height="13" viewBox="0 0 27 13" aria-hidden="true"><rect x=".5" y=".5" width="23" height="12" rx="3.5" fill="none" stroke="currentColor" opacity=".4"/><rect x="2" y="2" width="20" height="9" rx="2"/><path d="M25 4.5v4c.8-.3 1.3-1.1 1.3-2s-.5-1.7-1.3-2Z" opacity=".45"/></svg>
      </span>
    </div>`;

  // mobile menu: the nav links open as a sheet under the bar
  function initMenu() {
    const btn = document.querySelector('.nav-menu');
    if (!btn) return;
    const set = (on) => { document.documentElement.classList.toggle('menu-open', on); btn.setAttribute('aria-expanded', on); on ? T.stop() : T.start(); };
    btn.addEventListener('click', () => set(!document.documentElement.classList.contains('menu-open')));
    document.querySelectorAll('.nav-links a').forEach((a) => a.addEventListener('click', () => set(false)));
    addEventListener('keydown', (e) => e.key === 'Escape' && set(false));
  }
  T.init = () => { initScroll(); T.fitPhones(); T.reveal(); initMenu(); };
  window.T = T;
})();
