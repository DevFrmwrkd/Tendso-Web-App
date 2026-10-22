/* Work: full-screen case-study sheet that slides up from the bottom. Agent B.
   window.TendsoWork.open(id?) / close(). Any [data-open-work] element opens it (value = site id, optional). */
(function () {
  let root, sheet, closeBtn, opener = null, isOpen = false, hideTimer = 0;

  const x = '<svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><path d="M4.5 4.5l9 9M13.5 4.5l-9 9" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';

  function pairFor(id) {
    const want = id === 'vulca' ? 'mechanic' : id;
    return window.TD.pairs.find((p) => p.id === want);
  }

  function caseHTML(site, n) {
    const pair = pairFor(site.id);
    const phone = T.phone({ size: 'md', cls: 'case-phone' });
    phone.screen.innerHTML = `${T.statusBar(false)}<img class="case-m" src="assets/sites/${site.id}-m.jpg" alt="${site.name} on a phone" loading="lazy" decoding="async">`;
    const pairHTML = pair ? `
      <div class="case-pair">
        <figure class="case-ph">
          <div class="case-ph-img"><img src="${pair.before}" alt="Phone photo: ${pair.caption}" loading="lazy" decoding="async"></div>
          <figcaption class="label">Phone photo</figcaption>
        </figure>
        <figure class="case-ph">
          <div class="case-ph-img"><img src="${pair.after}" alt="In the site: ${pair.caption}" loading="lazy" decoding="async" data-after></div>
          <figcaption class="label">In the site</figcaption>
        </figure>
        <p class="case-pair-cap">${pair.caption}</p>
      </div>` : '';
    return { html: `
      <article class="case" id="case-${site.id}" data-case="${site.id}">
        <header class="case-head">
          <span class="label case-n">${String(n + 1).padStart(2, '0')}</span>
          <h3 class="case-name">${site.name}</h3>
          <p class="case-kind">${site.kind} · ${site.city}</p>
          <p class="case-url">${site.url}</p>
        </header>
        <div class="case-media">
          <div class="browser">
            <div class="browser-bar"><span class="browser-url">${site.url}</span></div>
            <img src="assets/sites/${site.id}-d.jpg" alt="${site.name} website on a laptop" loading="lazy" decoding="async">
          </div>
          <div class="case-phone-slot"></div>
        </div>
        ${pairHTML}
      </article>`, phone: phone.el };
  }

  function render() {
    const sites = window.TD.sites;
    sheet.innerHTML = `
      <div class="work-bar">
        <div class="wrap work-bar-in">
          <span class="brand-mini">tendso</span>
          <button class="work-close" type="button" aria-label="Close work">${x}</button>
        </div>
      </div>
      <div class="wrap work-in">
        <header class="work-head">
          <h2 class="work-h" id="work-title">Work</h2>
          <p class="work-sub">Real shops, built with the app. Sample data.</p>
          <nav class="work-index" aria-label="Case studies">
            ${sites.map((s) => `<a href="#case-${s.id}" data-jump="${s.id}">${s.name}</a>`).join('')}
          </nav>
        </header>
        <div class="cases"></div>
      </div>`;
    const list = sheet.querySelector('.cases');
    sites.forEach((s, n) => {
      const c = caseHTML(s, n);
      list.insertAdjacentHTML('beforeend', c.html);
      list.lastElementChild.querySelector('.case-phone-slot').appendChild(c.phone);
    });
    T.fitPhones(sheet);
    closeBtn = sheet.querySelector('.work-close');
    closeBtn.addEventListener('click', close);
    sheet.querySelectorAll('[data-jump]').forEach((a) => a.addEventListener('click', (e) => {
      e.preventDefault(); jump(a.dataset.jump, true);
    }));
    // a missing "after" photo shows an honest placeholder instead of a broken image
    sheet.querySelectorAll('img[data-after]').forEach((img) => img.addEventListener('error', () => {
      const box = img.parentElement;
      box.dataset.placeholder = 'true';
      box.innerHTML = '<span class="label">Photo pending</span>';
    }, { once: true }));
  }

  function jump(id, smooth) {
    const el = id && sheet.querySelector(`#case-${id}`);
    if (!el) { sheet.scrollTop = 0; return; }
    const barH = sheet.querySelector('.work-bar').offsetHeight;
    sheet.scrollTo({ top: el.offsetTop - barH - 8, behavior: smooth && !T.reduced ? 'smooth' : 'auto' });
  }

  function open(id) {
    if (!root) return;
    clearTimeout(hideTimer);
    opener = document.activeElement;
    root.hidden = false;
    root.setAttribute('aria-hidden', 'false');
    // layout is live now: jump before the slide so it arrives on the right case
    jump(id, false);
    void root.offsetHeight;
    root.classList.add('is-open');
    isOpen = true;
    T.stop();
    document.documentElement.classList.add('work-open');
    setTimeout(() => closeBtn.focus({ preventScroll: true }), T.reduced ? 0 : 120);
  }

  function close() {
    if (!isOpen) return;
    isOpen = false;
    root.classList.remove('is-open');
    T.start();
    document.documentElement.classList.remove('work-open');
    hideTimer = setTimeout(() => { root.hidden = true; root.setAttribute('aria-hidden', 'true'); }, T.reduced ? 0 : 720);
    if (opener && opener.focus && document.contains(opener)) opener.focus({ preventScroll: true });
    opener = null;
  }

  window.TendsoWork = {
    open, close,
    init() {
      root = document.getElementById('work');
      if (!root) return;
      root.setAttribute('role', 'dialog');
      root.setAttribute('aria-modal', 'true');
      root.setAttribute('aria-labelledby', 'work-title');
      root.innerHTML = '<div class="work-sheet" data-lenis-prevent></div>';
      sheet = root.querySelector('.work-sheet');
      render();

      document.addEventListener('click', (e) => {
        const t = e.target.closest('[data-open-work]');
        if (!t) return;
        e.preventDefault();
        open(t.dataset.openWork || undefined);
      });
      document.addEventListener('keydown', (e) => {
        if (!isOpen) return;
        if (e.key === 'Escape') { e.preventDefault(); close(); }
      });
      // focus trap-lite: focus that escapes the sheet comes back to the close button
      document.addEventListener('focusin', (e) => {
        if (isOpen && !root.contains(e.target)) closeBtn.focus({ preventScroll: true });
      });
    },
    ready() {},
  };
})();
