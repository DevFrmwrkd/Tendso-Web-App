/* Paths: Download the app · Hire someone · Join our team. Agent B.
   The hire form is a mock: it validates and confirms, nothing is sent. */
(function () {
  const arrow = '<svg class="arr" width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><path d="M4 9h10M10 5l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const apple = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16.37 12.6c-.02-2.3 1.88-3.4 1.96-3.46-1.07-1.56-2.73-1.78-3.32-1.8-1.41-.14-2.76.83-3.47.83-.72 0-1.82-.81-2.99-.79-1.54.02-2.96.9-3.75 2.27-1.6 2.78-.41 6.89 1.15 9.14.76 1.1 1.67 2.34 2.86 2.3 1.15-.05 1.58-.74 2.97-.74 1.38 0 1.77.74 2.98.72 1.23-.02 2.01-1.12 2.76-2.23.87-1.28 1.23-2.52 1.25-2.58-.03-.01-2.39-.92-2.4-3.66ZM14.1 5.86c.63-.77 1.06-1.83.94-2.89-.91.04-2.01.61-2.66 1.37-.58.67-1.1 1.76-.96 2.8 1.01.08 2.05-.52 2.68-1.28Z"/></svg>';
  const play = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.6 2.3 13.4 11 4.6 19.7c-.36-.2-.6-.6-.6-1.07V3.37c0-.47.24-.87.6-1.07Z"/><path d="m14.5 12.1 2.5 2.5-10.6 6.1 8.1-8.6Z" opacity=".8"/><path d="m14.5 9.9-8.1-8.6L17 7.4l-2.5 2.5Z" opacity=".8"/><path d="m18.3 8.2 2.6 1.5c.85.5.85 1.7 0 2.2l-2.6 1.5-2.7-2.7 2.7-2.5Z" opacity=".6"/></svg>';

  // A believable QR: 25×25 modules, three finder squares, timing rows, seeded noise. Placeholder only.
  function qr() {
    const n = 25, cells = [];
    let s = 7;
    const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    const inFinder = (x, y) => (x < 8 && y < 8) || (x > n - 9 && y < 8) || (x < 8 && y > n - 9);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      if (inFinder(x, y)) continue;
      if (x >= 16 && x <= 20 && y >= 16 && y <= 20) continue; // alignment block
      if (y === 6) { if (x % 2 === 0) cells.push([x, y]); continue; }
      if (x === 6) { if (y % 2 === 0) cells.push([x, y]); continue; }
      if (rnd() > 0.52) cells.push([x, y]);
    }
    const finder = (x, y) => `<rect x="${x}" y="${y}" width="7" height="7" rx="1.6"/><rect x="${x + 1}" y="${y + 1}" width="5" height="5" rx="1" fill="#fff"/><rect x="${x + 2}" y="${y + 2}" width="3" height="3" rx=".6"/>`;
    return `<svg viewBox="-2 -2 29 29" role="img" aria-label="QR code to download the app (placeholder)">
      <rect x="-2" y="-2" width="29" height="29" rx="3" fill="#fff"/>
      <g fill="currentColor">
        ${cells.map(([x, y]) => `<rect x="${x}" y="${y}" width="1.02" height="1.02"/>`).join('')}
        ${finder(0, 0)}${finder(n - 7, 0)}${finder(0, n - 7)}
        <rect x="16" y="16" width="5" height="5" rx="1"/><rect x="17" y="17" width="3" height="3" fill="#fff"/><rect x="18" y="18" width="1" height="1"/>
      </g></svg>`;
  }

  const L = () => window.TD.links;

  function downloadTile() {
    return `
    <div class="path-cell" data-reveal style="--i:0">
      <article class="tile path path--download" id="download">
        <h3 class="path-line">Talk, snap, done. On your phone.</h3>
        <div class="path-foot dl">
          <figure class="qr" data-placeholder="true">${qr()}</figure>
          <div class="stores">
            <a class="store" href="${L().appStore}">${apple}<span><small>Download on the</small><b>App Store</b></span></a>
            <a class="store" href="${L().googlePlay}">${play}<span><small>Get it on</small><b>Google Play</b></span></a>
          </div>
        </div>
      </article>
    </div>`;
  }

  function hireTile() {
    const opts = window.TD.businessTypes.map((t) => `<option>${t}</option>`).join('');
    const times = ['Morning', 'Afternoon', 'Evening'];
    return `
    <div class="path-cell" data-reveal style="--i:1">
      <article class="tile path path--hire" id="hire">
        <h3 class="path-line">A field agent visits your shop. About 30 minutes.</h3>
        <form class="hire" novalidate>
          <div class="f" data-f="name">
            <label for="h-name">Shop name</label>
            <input id="h-name" name="name" type="text" autocomplete="organization" placeholder="Kalan">
            <p class="f-err" id="h-name-e" role="alert"></p>
          </div>
          <div class="f-row">
            <div class="f" data-f="city">
              <label for="h-city">Area</label>
              <input id="h-city" name="city" type="text" autocomplete="address-level2" placeholder="Marikina">
              <p class="f-err" id="h-city-e" role="alert"></p>
            </div>
          </div>
          <div class="f" data-f="phone">
            <label for="h-phone">Mobile</label>
            <input id="h-phone" name="phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="0917 123 4567">
            <p class="f-err" id="h-phone-e" role="alert"></p>
          </div>
          <button class="btn btn--ink hire-go" type="submit">Request a visit ${arrow}</button>
          
        </form>
      </article>
    </div>`;
  }

  function joinTile() {
    const row = (name, sub, href) => `
      <a class="join-row" href="${href}">
        <span><b>${name}</b></span>${arrow}
      </a>`;
    return `
    <div class="path-cell" data-reveal style="--i:2">
      <article class="tile tile--quiet path path--join" id="join">
        <h3 class="path-line">Visit local businesses and build their sites with the app.</h3>
        <figure class="join-photo"><img src="assets/people/06-agent.jpg" alt="A field agent outside an auto shop" loading="lazy"></figure>
        <div class="path-foot join">
          ${row('Field agent', 'Visit shops near you', L().joinAgent)}
          ${row('Creator', 'Photos and words for local sites', L().joinCreator)}
        </div>
      </article>
    </div>`;
  }

  const rules = {
    name: (v) => (v.trim().length < 2 ? 'Add your business name.' : ''),
    city: (v) => (v.trim().length < 2 ? 'Add your city or area.' : ''),
    phone: (v) => (v.replace(/[^\d]/g, '').length < 10 ? 'Add a number we can message, like 0917 123 4567.' : ''),
  };

  function wireForm(form) {
    const field = (k) => form.querySelector(`[data-f="${k}"]`);
    const value = (k) => (k === 'time' ? (form.querySelector('input[name="time"]:checked')?.value || '') : form.elements[k].value);
    const setErr = (k, msg) => {
      const f = field(k);
      f.classList.toggle('is-bad', !!msg);
      f.querySelector('.f-err').textContent = msg;
      const ctl = k === 'time' ? null : form.elements[k];
      if (ctl) { ctl.setAttribute('aria-invalid', msg ? 'true' : 'false'); ctl.setAttribute('aria-describedby', `h-${k}-e`); }
    };
    // clear an error as soon as the person fixes it
    form.addEventListener('input', (e) => {
      const k = e.target.name; if (!rules[k]) return;
      if (field(k).classList.contains('is-bad') && !rules[k](value(k))) setErr(k, '');
    });
    form.addEventListener('change', (e) => {
      const k = e.target.name; if (k === 'time' || k === 'type') setErr(k, rules[k](value(k)));
    });
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      let first = null;
      Object.keys(rules).forEach((k) => {
        const msg = rules[k](value(k)); setErr(k, msg);
        if (msg && !first) first = k;
      });
      if (first) {
        (first === 'time' ? form.querySelector('input[name="time"]') : form.elements[first]).focus();
        return;
      }
      confirm(form);
    });
  }

  function confirm(form) {
    const tile = form.closest('.path');
    const h = form.offsetHeight;
    const done = document.createElement('div');
    done.className = 'hire-done';
    done.style.minHeight = h + 'px';
    done.setAttribute('role', 'status');
    done.innerHTML = `
      <span class="done-mark" aria-hidden="true"><svg width="22" height="22" viewBox="0 0 22 22"><path d="M5 11.5l4 4 8-9" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
      <p class="done-h">Request sent.</p>
      <p class="done-p">An agent will message you to pick a time.</p>
      
      <button class="btn btn--line btn--sm done-again" type="button">Send another</button>`;
    form.classList.add('is-leaving');
    setTimeout(() => {
      form.replaceWith(done);
      requestAnimationFrame(() => done.classList.add('is-in'));
      done.querySelector('.done-again').addEventListener('click', () => {
        form.reset(); form.classList.remove('is-leaving');
        form.querySelectorAll('.is-bad').forEach((f) => f.classList.remove('is-bad'));
        done.replaceWith(form);
        form.elements.name.focus();
      });
      done.focus?.();
    }, T.reduced ? 0 : 260);
    tile.classList.add('is-sent');
  }

  window.TendsoPaths = {
    init() {
      const root = document.getElementById('paths');
      if (!root) return;
      root.innerHTML = `
        <div class="wrap">
          <h2 class="paths-h" data-reveal>Pick your way in.</h2>
          <div class="paths-grid">${downloadTile()}${hireTile()}${joinTile()}</div>
        </div>`;
      wireForm(root.querySelector('form.hire'));
    },
    ready() {},
  };
})();
