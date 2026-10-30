/* Footer: one line + two buttons, a wordmark that bleeds to the page edges, a quiet bottom row. Agent B.
   Styles live in css/paths.css. */
(function () {
  let mark = null;

  // size the wordmark so its ink spans the viewport edge to edge (measured once per resize)
  function fit() {
    if (!mark) return;
    mark.style.setProperty('--mark-size', '100px');
    const w = mark.querySelector('span').getBoundingClientRect().width;
    if (!w) return;
    const vw = document.documentElement.clientWidth;
    mark.style.setProperty('--mark-size', ((100 * vw) / w * 1.0).toFixed(2) + 'px');
  }

  window.TendsoFoot = {
    init() {
      const root = document.getElementById('foot');
      if (!root) return;
      // on sub-pages (pages/, app/) the landing's anchors live one folder up
      const home = /\/(pages|app)\//.test(location.pathname) ? '../index.html' : '';
      const pg = /\/pages\//.test(location.pathname) ? '' : /\/app\//.test(location.pathname) ? '../pages/' : 'pages/';
      root.innerHTML = `
        <div class="wrap">
          <div class="foot-top" data-reveal>
            <p class="foot-line">The thinking ends here.</p>
            <div class="foot-cta">
              <a class="btn btn--accent" href="${home}#download">Download the app</a>
              <a class="btn btn--line" href="${home}#hire">Hire an agent</a>
            </div>
          </div>
          <p class="foot-mark" aria-hidden="true"><span>tendso</span></p>
          <div class="foot-bottom">
            <span>© 2026 Tendso</span>
            <a href="${pg}help.html">Help</a>
            <a href="${pg}help.html#contact">Contact</a>
            <a href="${pg}creators.html">For field agents</a>
            <a href="${pg}creator-program.html">For creators</a>
            <a href="${pg}legal.html#privacy">Privacy</a>
            <a href="${pg}legal.html#terms">Terms</a>
          </div>
        </div>`;
      if (document.querySelector('.band-h, .cr-end-h')) root.querySelector('.foot-top')?.remove(); // page already closes with its own CTA band
      mark = root.querySelector('.foot-mark');
      fit();
    },
    ready() {
      fit();
      document.fonts?.ready.then(fit);
      let t; addEventListener('resize', () => { clearTimeout(t); t = setTimeout(fit, 120); });
    },
  };
})();
