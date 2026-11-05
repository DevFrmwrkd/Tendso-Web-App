/* Giveaway (pages/giveaway.html) = production /100-pages-giveaway (also reached by /libre and the poster QR).
   Off the Record gives 100 walk-in shops a free Tendso website. The count is live in production (Convex
   giveaway.giveawayStatus); here it is a SAMPLE (37 left). Add #closed to the URL to see the closed state. */
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const Sub = window.TendsoSub;
  const LEFT = 37;
  const closed = location.hash === '#closed';

  function state() {
    document.querySelectorAll('[data-open-text]').forEach((e) => (e.hidden = closed));
    document.querySelectorAll('[data-closed-text]').forEach((e) => (e.hidden = !closed));
    document.querySelectorAll('[data-open]').forEach((e) => (e.hidden = closed));
    document.querySelectorAll('[data-closed]').forEach((e) => (e.hidden = !closed));
    const left = closed ? 0 : LEFT;
    $('#gw-left').textContent = left;
    const st = $('#gw-stamp');
    st.innerHTML = closed ? '<i></i>Closed' : '<i></i>Open';
    st.classList.toggle('is-closed', closed);
  }

  // 100 cells: given = ink, still free = accent. They fill in, one by one, the first time they're seen.
  function slots() {
    const left = closed ? 0 : LEFT;
    const root = $('#gw-slots');
    root.innerHTML = Array.from({ length: 100 }, (_, i) => `<i class="${i < 100 - left ? 'is-given' : 'is-open'}" style="--d:${i * 9}ms"></i>`).join('');
    if (T.reduced) { root.classList.add('is-run'); return; }
    T.inView(root, (on) => on && root.classList.add('is-run'), { threshold: 0.4 });
  }

  // a drawn QR-like pattern for the poster (placeholder; the printed poster carries the real code)
  function qr() {
    const n = 21, cells = [];
    const finder = (x, y) => [[0, 0], [n - 7, 0], [0, n - 7]].some(([a, b]) => x >= a && x < a + 7 && y >= b && y < b + 7);
    const ring = (x, y) => [[0, 0], [n - 7, 0], [0, n - 7]].some(([a, b]) => {
      const dx = x - a, dy = y - b; if (dx < 0 || dy < 0 || dx > 6 || dy > 6) return false;
      return dx === 0 || dy === 0 || dx === 6 || dy === 6 || (dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4);
    });
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const on = finder(x, y) ? ring(x, y) : ((x * 7 + y * 13 + x * y) % 5) < 2;
      if (on) cells.push(`<rect x="${x}" y="${y}" width="1" height="1"/>`);
    }
    document.querySelectorAll('.qr').forEach((q) => (q.innerHTML = `<svg viewBox="0 0 ${n} ${n}" shape-rendering="crispEdges">${cells.join('')}</svg>`));
  }

  function phone() {
    const ph = Sub.sitePhone({ src: '../assets/sites/showcase/forge-m-long.jpg', url: 'forge.tendso.site', auto: true, alt: "Forge Barbers' website on a phone" });
    $('#gw-phone').appendChild(ph.el);
  }

  addEventListener('hashchange', () => location.reload());
  Sub.boot([state, slots, qr, phone]);
})();
