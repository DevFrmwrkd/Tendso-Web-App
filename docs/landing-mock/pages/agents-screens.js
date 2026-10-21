/* Field agents page: the creator-app map screen drawn for this page (window.AgentScreens.map).
   Redrawn from a REAL app screen in the app's own kit (css/app-kit.css), with craft shops only:
     map → apps/mobile/app/(app)/leads/discover.tsx (a shop selected on the map), as app/creator-core 3.2
   SAMPLE DATA (Mika Santos, Marikina).
   Styles: pages/agents-app.css (ag-s-*). */
(function () {
  const A = '../assets/';

  // Lucide icons, scoped to one screen (same approach as js/screens.js)
  const ic = (name, size = 22) => `<i data-lucide="${name}" data-size="${size}"></i>`;
  function hydrate(root) {
    const L = window.lucide;
    if (!L || !L.icons || !L.createElement) return;
    root.querySelectorAll('i[data-lucide]').forEach((i) => {
      const key = i.getAttribute('data-lucide').replace(/(^|-)([a-z0-9])/g, (m, a, c) => c.toUpperCase());
      const node = L.icons[key];
      if (!node) return;
      const svg = L.createElement(node);
      const s = i.dataset.size || 22;
      svg.setAttribute('width', s); svg.setAttribute('height', s);
      svg.setAttribute('stroke-width', 1.9); svg.setAttribute('aria-hidden', 'true');
      i.replaceWith(svg);
    });
  }

  const tabbar = (on) => {
    const t = (k, icon, label) => `<div class="a-tab${on === k ? ' is-on' : ''}">${ic(icon)}${label}</div>`;
    return `<div class="a-tabbar">${t('map', 'map', 'Map')}${t('finds', 'layout-grid', 'Finds')}
      <div class="a-tab a-tab--main">${ic('plus', 24)}Submit</div>${t('earn', 'wallet', 'Earn')}${t('me', 'user', 'Me')}</div>`;
  };

  // ---- quiet vector street map (Marikina), no tiles ----
  function mapSVG() {
    const W = 390, H = 844;
    let s = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" aria-hidden="true">`;
    s += `<rect width="${W}" height="${H}" fill="#E9E9E3"/>`;
    s += `<rect x="268" y="360" width="100" height="74" rx="10" fill="#DCE3D3"/>`;
    s += `<rect x="16" y="300" width="74" height="60" rx="10" fill="#DCE3D3"/>`;
    s += `<path d="M-20 ${H - 330} C 80 ${H - 370}, 160 ${H - 290}, 240 ${H - 320} S 360 ${H - 390}, 420 ${H - 370}" stroke="#D3DCE3" stroke-width="34" fill="none"/>`;
    s += '<g stroke="#FFFFFF" stroke-linecap="round" fill="none">';
    [36, 96, 168, 226, 286, 340, 380].forEach((x, i) => { s += `<path d="M${x} -5 L${x + (i % 2 ? 8 : -6)} ${H + 5}" stroke-width="6"/>`; });
    [70, 132, 250, 318, 392, 470, 560].forEach((y, i) => { s += `<path d="M-5 ${y} L${W + 5} ${y + (i % 2 ? -6 : 5)}" stroke-width="6"/>`; });
    s += `<path d="M128 -5 L120 ${H + 5}" stroke-width="13"/>`;
    s += `<path d="M-5 200 L${W + 5} 190" stroke-width="13"/>`;
    s += `<path d="M-5 40 L${W + 5} 420" stroke-width="10"/>`;
    s += '</g>';
    s += '<g font-family="Onest, sans-serif" font-size="9" font-weight="600" fill="#A3A29A">';
    s += '<text x="214" y="186">J.P. Rizal St</text>';
    s += '<text transform="translate(262 300) rotate(44)">Sumulong Hwy</text>';
    s += `<text x="252" y="${H - 352}" fill="#97A6B3">Marikina River</text>`;
    s += '</g></svg>';
    return s;
  }

  const SHOPS = {
    forge: A + 'photos/forge/phone-outside.jpg',
    vulca: A + 'photos/vulca-garage.jpg',
    hela: A + 'photos/hela-hero.jpg',
    labana: A + 'photos/labana-press.jpg',
    domingo: A + 'photos/domingo-aisle.jpg',
  };
  const pin = (k, x, y, kind, i) => `<div class="ag-s-pin ag-s-pin--${kind}" style="left:${x}px;top:${y}px;--k:${i}">
      <img src="${SHOPS[k]}" alt=""></div>`;

  // Rule #1 (SIMPLE-FLOWS / tools/simple-lint.mjs): ≤20 words, ≤3 controls, nothing under 16px per screen.
  function map(root) {
    root.innerHTML = `
      <div class="app ag-s ag-s-map">
        <div class="ag-s-mapbg" aria-hidden="true">${mapSVG()}
          ${pin('vulca', 66, 150, 'need', 1)}${pin('labana', 318, 136, 'yours', 2)}
          ${pin('domingo', 60, 312, 'need', 3)}${pin('hela', 322, 296, 'yours', 4)}
          ${pin('forge', 196, 196, 'sel', 0)}
          <i class="ag-s-me" style="left:150px;top:356px"></i>
        </div>
        ${window.T ? T.statusBar(false) : ''}
        <div class="ag-s-mapbar">
          <span class="ag-s-face" style="background-image:url(${A}people/17-mika.jpg)"></span>
          <span class="ag-s-float ag-s-legend is-on"><i class="ag-s-ring"></i>Needs a site · 14</span>
        </div>
        <div class="ag-s-sheet">
          <span class="ag-s-grab"></span>
          <div class="ag-s-shop">
            <div class="ag-s-shop-ph"><img src="${A}photos/forge/phone-outside.jpg" alt=""></div>
            <div class="ag-s-shop-m">
              <b>Forge Barbers</b>
              <span>350 m · No website yet</span>
              <div class="ag-s-earn">${ic('coins', 22)}<b>Earn up to ₱2,500</b></div>
            </div>
          </div>
          <div class="ag-s-acts"><div class="door door--accent">I'm visiting</div><div class="door door--ghost ag-s-route">Route</div></div>
        </div>
        ${tabbar('map')}
      </div>`;
    hydrate(root);
    const el = root.firstElementChild;
    return {
      el,
      play() { if (window.T && T.reduced) return; el.classList.remove('is-run'); void el.offsetWidth; el.classList.add('is-run'); },
      pause() {},
    };
  }

  window.AgentScreens = { map };
})();
