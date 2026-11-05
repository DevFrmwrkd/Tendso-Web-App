/* Examples page (pages/examples.html). Agent D1.
   SAMPLE DESIGNS: the six filled sites from data.js plus captures of other Tendso site templates
   (assets/sites/examples/<id>-d.jpg fold · -d-long.jpg · -m-long.jpg). Businesses are examples, not clients. */
(function () {
  const Sub = window.TendsoSub;
  const $ = (s, r = document) => r.querySelector(s);
  const KINDS = ['Food', 'Beauty', 'Auto', 'Retail', 'Services', 'Fitness', 'Health', 'Education', 'Trades'];

  const filledKind = { kalan: 'Food', hela: 'Beauty', vulca: 'Auto', domingo: 'Retail', labana: 'Services', kalasag: 'Fitness' };
  const filled = (window.TD?.sites || []).map((s) => ({
    id: s.id, name: s.name, kind: s.kind, city: s.city, cat: filledKind[s.id] || 'Services', url: s.url,
    d: `../assets/sites/${s.id}-d.jpg`, dl: `../assets/sites/${s.id}-d-long.jpg`, ml: `../assets/sites/${s.id}-m-long.jpg`,
  }));
  const ex = (id, name, kind, city, cat) => ({
    id, name, kind, city, cat, url: `${id}.tendso.site`,
    d: `../assets/sites/examples/${id}-d.jpg`, dl: `../assets/sites/examples/${id}-d-long.jpg`, ml: `../assets/sites/examples/${id}-m-long.jpg`,
  });
  const more = [
    ex('apoy', 'Apoy at Asin', 'Grill house', 'Marikina', 'Food'),
    ex('batis', 'Batis Dental Studio', 'Dental clinic', 'Iloilo City', 'Health'),
    ex('talino', 'Talíno Learning Studio', 'Tutoring & review', 'Baguio City', 'Education'),
    ex('voltline', 'Volt & Line', 'Electrician', 'Quezon City', 'Trades'),
    ex('bakalbc', 'Bakal Boxing Club', 'Boxing gym', 'Cebu City', 'Fitness'),
    ex('bakalfab', 'Bakal Fabrication', 'Steel & welding', 'Dasmariñas', 'Trades'),
    ex('forge', 'Forge Barber Co.', 'Barbershop', 'Brooklyn', 'Beauty'),
    ex('ironwood', 'Ironwood Coffee', 'Roastery & café', 'San Francisco', 'Food'),
    ex('apex', 'Apex Auto Works', 'Auto repair', 'Portland', 'Auto'),
    ex('lume', 'Lumé Salon & Spa', 'Salon & spa', 'Portland', 'Beauty'),
    ex('mapleiron', 'Maple & Iron', 'Hardware store', 'Portland', 'Retail'),
    ex('northline', 'Northline Tailors', 'Tailoring', 'Edinburgh', 'Services'),
    ex('solferino', 'Solferino Music School', 'Music lessons', 'Dublin', 'Education'),
    ex('atelier', 'Atelier Noir', 'Hair salon', 'Manchester', 'Beauty'),
    ex('meridian', 'Meridian Shirt Co.', 'Shirt store', 'San Francisco', 'Retail'),
    ex('pico', 'Pico & Olive', 'Mediterranean café', 'Brighton', 'Food'),
  ];
  // interleave so the first screen mixes kinds and places, Filipino businesses first
  const ALL = [];
  const a = filled.slice(), b = more.slice();
  while (a.length || b.length) { if (a.length) ALL.push(a.shift()); if (b.length) ALL.push(b.shift()); }
  // card shape: desktop fold or a tall phone crop, for a living masonry
  const shapeOf = (i) => ([1, 4, 6, 9].includes(i % 10) ? 'm' : 'd');

  let filter = 'All';
  let list = ALL;

  // ---------------------------------------------------------------- chips + grid
  function chips() {
    const count = (k) => ALL.filter((s) => s.cat === k).length;
    $('#chips').innerHTML = ['All', ...KINDS].map((k) => {
      const n = k === 'All' ? ALL.length : count(k);
      return `<button type="button" class="fchip" data-k="${k}" aria-pressed="${k === filter}" ${n ? '' : 'disabled'}>${k}<small>${n}</small></button>`;
    }).join('');
    $('#chips').addEventListener('click', (e) => {
      const b = e.target.closest('.fchip');
      if (!b || b.disabled || b.dataset.k === filter) return;
      filter = b.dataset.k;
      $('#chips').querySelectorAll('.fchip').forEach((c) => c.setAttribute('aria-pressed', c === b));
      swap();
    });
  }

  function cardHTML(s, i) {
    const shape = shapeOf(i);
    const src = shape === 'm' ? s.ml : s.d;
    return `
      <button type="button" class="card" data-id="${s.id}" aria-label="Preview ${s.name}">
        <div class="card-img card-img--${shape}"><img src="${src}" alt="" loading="lazy"><span class="card-view">Preview ${Sub.ICON.arrow}</span></div>
        <div class="card-meta"><b>${s.name}</b><span>${s.city}</span></div>
        <span class="card-kind">${s.kind}</span>
      </button>`;
  }

  function render() {
    list = filter === 'All' ? ALL : ALL.filter((s) => s.cat === filter);
    $('#grid').innerHTML = list.length ? list.map(cardHTML).join('') : '<p class="ex-empty">No designs here yet.</p>';
  }

  function swap() {
    const g = $('#grid');
    if (T.reduced) { render(); return; }
    g.classList.add('is-swapping');
    setTimeout(() => {
      render();
      const top = $('#filters').getBoundingClientRect().top;
      if (top < 0 || top > innerHeight * 0.5) T.scrollTo('#filters', { offset: -60, duration: 0.9 });
      requestAnimationFrame(() => requestAnimationFrame(() => g.classList.remove('is-swapping')));
    }, 210);
  }

  // ---------------------------------------------------------------- preview modal
  const pv = $('#pv');
  let cur = -1, view = 'd', lastFocus = null, phone = null;

  function setView(v) {
    view = v;
    pv.querySelectorAll('.seg button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.view === v));
    const on = pv.querySelector(`.seg button[data-view="${v}"]`);
    const th = $('#seg-thumb');
    th.style.width = on.offsetWidth + 'px';
    th.style.transform = `translateX(${on.offsetLeft - 4}px)`;
    $('#pv-d').hidden = v !== 'd';
    $('#pv-m').hidden = v !== 'm';
  }

  function show(i) {
    cur = (i + list.length) % list.length;
    const s = list[cur];
    $('#pv-name').textContent = s.name;
    $('#pv-meta').textContent = `${s.kind} · ${s.city}`;
    $('#pv-url').innerHTML = `${Sub.ICON.lock}${s.url}`;
    const dimg = $('#pv-dimg');
    dimg.src = s.dl; dimg.alt = `${s.name} website, desktop`;
    dimg.parentElement.scrollTop = 0;
    const host = $('#pv-m');
    host.innerHTML = '';
    phone = Sub.sitePhone({ src: s.ml, size: 'lg', scrollable: true, alt: `${s.name} website, mobile` });
    host.appendChild(phone.el);
    try { history.replaceState(null, '', '#' + s.id); } catch (e) {}
  }

  function open(id) {
    const i = list.findIndex((s) => s.id === id);
    if (i < 0) return;
    lastFocus = document.activeElement;
    show(i);
    pv.hidden = false;
    T.stop?.();
    document.documentElement.style.overflow = 'hidden';
    requestAnimationFrame(() => { pv.classList.add('is-open'); setView(innerWidth < 760 ? 'm' : view); pv.focus({ preventScroll: true }); });
  }

  function close() {
    if (pv.hidden) return;
    pv.classList.remove('is-open');
    document.documentElement.style.overflow = '';
    T.start?.();
    try { history.replaceState(null, '', location.pathname); } catch (e) {}
    setTimeout(() => { pv.hidden = true; }, T.reduced ? 0 : 620);
    lastFocus?.focus?.({ preventScroll: true });
  }

  function modal() {
    $('#grid').addEventListener('click', (e) => { const c = e.target.closest('.card'); if (c) open(c.dataset.id); });
    $('#pv-x').addEventListener('click', close);
    $('#pv-prev').addEventListener('click', () => show(cur - 1));
    $('#pv-next').addEventListener('click', () => show(cur + 1));
    pv.querySelectorAll('.seg button').forEach((b) => b.addEventListener('click', () => setView(b.dataset.view)));
    $('#pv-use').addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); close(); setTimeout(() => T.scrollTo('#download', { offset: -70 }), 120); });
    addEventListener('keydown', (e) => {
      if (pv.hidden) return;
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowLeft') show(cur - 1);
      if (e.key === 'ArrowRight') show(cur + 1);
      if (e.key === 'Tab') {   // keep focus inside the dialog
        const f = [...pv.querySelectorAll('button:not([disabled]), a[href], [tabindex="0"]')].filter((x) => x.offsetParent);
        if (!f.length) return;
        if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
      }
    });
    addEventListener('resize', () => { if (!pv.hidden) setView(view); });
  }

  Sub.boot([chips, render, modal, () => Sub.stores($('#stores'))]);

  // deep link from the business page: examples.html#kalan opens that preview
  const h = location.hash.slice(1);
  if (h && ALL.some((s) => s.id === h)) setTimeout(() => open(h), 300);
})();
