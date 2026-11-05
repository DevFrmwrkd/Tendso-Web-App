/* Six steps, one pinned phone (Klarna / Agentcard pattern).
   Scroll drives a 0..5 position. Each step's screen slides up from below over the previous one,
   which scales down and dims behind it. The active heading turns ink and opens one line. */
(function () {
  const STEPS = [
    { t: 'Download the app', d: 'Free on iPhone and Android.', screen: 'welcome', dark: true },
    { t: 'Choose a design', d: 'Pick a look made for your kind of business.', screen: 'design-picker' },
    { t: 'Get interviewed', d: '10 simple questions, one at a time. Your words become the pages.', screen: 'interview-cam', alt: 'interview-rec', opts: { video: 'assets/video/interview-2.mp4', poster: 'assets/video/interview-2.jpg', lang: 'en' } },
    { t: 'Take the photos', d: '10 guided shots for your kind of business, plus any you want to add.', screen: 'shot-guide', alt: 'photos', opts: { type: 'barber' } },
    { t: 'We build it', d: 'Our AI writes your pages, polishes your photos and builds the site. About 20 minutes. Ask for changes, or say it looks good.', screen: 'site-building' },
    { t: 'Your website is ready', d: 'The same day. See it first, pay once to publish.', screen: 'site-ready' },
  ];
  const S = { layers: [], ctrls: [], active: -1 };

  function render() {
    const sec = document.getElementById('how');
    sec.innerHTML = `
      <div class="wrap st-head" data-reveal>
        <span class="label">How it works</span>
        <h2 class="st-h2">Six steps.<br>One phone.</h2>
      </div>
      <div class="st-track" style="--n:${STEPS.length}">
        <div class="st-pin">
          <div class="wrap st-grid">
            <div class="st-rail" aria-hidden="true">${STEPS.map(() => '<i></i>').join('')}</div>
            <div class="st-phone"></div>
            <ol class="st-list">${STEPS.map((s, i) => `
              <li class="st-item" data-i="${i}">
                <button type="button" class="st-btn"><span class="st-n">${String(i + 1).padStart(2, '0')}</span><span class="st-t">${s.t}</span></button>
                <div class="st-d"><p>${s.d}</p></div>
              </li>`).join('')}
            </ol>
          </div>
        </div>
      </div>`;
    const ph = T.phone({ size: 'lg', cls: 'st-device' });
    sec.querySelector('.st-phone').appendChild(ph.el);
    // replace the single screen-root with one layer per step
    const host = ph.el.querySelector('.phone-screen');
    host.querySelector('.screen-root').remove();
    STEPS.forEach((s, i) => {
      const layer = document.createElement('div');
      layer.className = 'st-layer';
      layer.innerHTML = '<div class="screen-root"></div>';
      host.insertBefore(layer, host.querySelector('.phone-island'));
      S.layers.push(layer);
      const root = layer.firstChild;
      let c = null;
      if (window.TendsoScreens) { try { const name = (TendsoScreens.names || []).includes(s.screen) ? s.screen : (s.alt || s.screen); c = TendsoScreens.mount(root, name, { owner: true, ...(s.opts || {}) }); } catch (e) { console.error(e); } }
      else root.innerHTML = `<img src="assets/sites/showcase/forge-m.jpg" alt="" style="width:390px;height:844px;object-fit:cover">`;
      S.ctrls.push(c);
    });
    S.sec = sec; S.track = sec.querySelector('.st-track');
    S.items = [...sec.querySelectorAll('.st-item')];
    S.dots = [...sec.querySelectorAll('.st-rail i')];
    S.items.forEach((li, i) => li.querySelector('.st-btn').addEventListener('click', () => goTo(i)));
  }

  function goTo(i) {
    const top = S.track.getBoundingClientRect().top + T.scrollY;
    const span = S.track.offsetHeight - innerHeight;
    T.scrollTo(top + span * ((i + 0.5) / STEPS.length));
  }

  function update() {
    const r = S.track.getBoundingClientRect();
    const span = S.track.offsetHeight - innerHeight;
    const pos = T.clamp(-r.top / span, 0, 0.9999) * STEPS.length;      // 0..5
    const idx = Math.floor(pos);
    const local = pos - idx;
    // the next card starts entering in the last 35% of each step
    const enter = T.ease.out(T.prog(local, 0.65, 1));
    S.layers.forEach((L, i) => {
      let y = 0, sc = 1, dim = 0, vis = true;
      if (i < idx) { sc = 0.9; dim = 0.55; vis = i >= idx - 1; }
      else if (i === idx) { sc = T.lerp(1, 0.9, enter); dim = T.lerp(0, 0.55, enter); }
      else if (i === idx + 1) { y = T.lerp(100, 0, enter); }
      else { y = 100; vis = false; }
      L.style.transform = `translate3d(0, ${y.toFixed(2)}%, 0) scale(${sc.toFixed(4)})`;
      L.style.setProperty('--dim', dim.toFixed(3));
      L.style.visibility = vis ? 'visible' : 'hidden';
    });
    const a = local > 0.82 && idx < STEPS.length - 1 ? idx + 1 : idx;
    if (a !== S.active) {
      S.active = a;
      S.items.forEach((li, i) => li.classList.toggle('is-on', i === a));
      S.dots.forEach((d, i) => d.classList.toggle('is-on', i === a));
      S.ctrls.forEach((c, i) => { if (!c) return; if (i === a) { c.reset?.(); c.play?.(); } else c.pause?.(); });
    }
  }

  window.TendsoSteps = {
    init: render,
    ready() {
      T.fitPhones(S.sec);
      T.onScroll(update);
      addEventListener('resize', update);
      update();
    },
  };
})();
