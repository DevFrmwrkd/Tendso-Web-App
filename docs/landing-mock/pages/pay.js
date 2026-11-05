/* Pay (pages/pay.html) = production /pay/[token], the page every payment email links to.
   Three states: pending (default) · #paid (receipt) · #expired. "I've sent it" walks pending → paid as a demo;
   production flips by itself when the Wise transfer is matched (Convex, no polling).
   Copy: Theo 2026-10-21, "See it first. Pay once to publish." The Wise email is production's fallback value
   (lib/payment/config) and the name is the operator (lib/contact OPERATOR): confirm both before build. */
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const Sub = window.TendsoSub;

  function stage() {
    const ph = Sub.sitePhone({ src: '../assets/sites/showcase/forge-m-long.jpg', url: 'forge.tendso.site', auto: true, alt: "Forge Barbers' website on a phone" });
    $('#py-phone').appendChild(ph.el);
    const img = $('#py-dimg'), view = img.parentElement;
    if (T.reduced) return;
    const go = () => img.style.setProperty('--travel', `-${Math.max(0, img.offsetHeight - view.offsetHeight)}px`);
    img.complete ? go() : img.addEventListener('load', go);
    addEventListener('resize', go);
    T.inView(view, (on) => img.classList.toggle('is-run', on), { threshold: 0.05 });
  }

  let toastT;
  function toast(m) { const t = $('#py-toast'); t.textContent = m; t.classList.add('is-on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('is-on'), 2400); }
  function copy() {
    document.querySelectorAll('[data-copy]').forEach((b) => b.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(b.dataset.copy); toast(b.dataset.done); } catch { toast(b.dataset.copy); }
    }));
  }

  function set(view, scroll) {
    const live = view === 'paid';
    $('#pay').hidden = view !== 'pending';
    $('#paid').hidden = !live;
    $('#expired').hidden = view !== 'expired';
    $('#py-state').textContent = live ? 'Live' : view === 'expired' ? 'Link expired' : 'Ready to publish';
    $('#py-dot').className = 'py-dot' + (live ? ' is-live' : view === 'expired' ? ' is-off' : '');
    $('#py-h').textContent = live ? 'Your site is live.' : 'Your site is ready.';
    $('#py-sub').textContent = live ? 'Paid once. It’s yours.' : view === 'expired' ? 'This payment link expired.' : 'See it first. Then pay once to publish.';
    $('#py-jump').hidden = view !== 'pending';
    $('#py-preview').textContent = live ? 'Live · forge.tendso.site' : 'Preview · not public yet';
    $('#py-preview').classList.toggle('is-live', live);
    if (scroll) T.scrollTo(live ? '#paid' : 0, { offset: -120 });
  }

  function wire() {
    $('#py-sent').addEventListener('click', () => {
      const b = $('#py-sent');
      b.disabled = true; b.textContent = 'Checking…';
      $('#py-wait-h').textContent = 'Looking for your transfer';
      $('#py-wait-p').textContent = 'This takes a moment. You can close this page; we email you when it’s live.';
      setTimeout(() => { set('paid', true); history.replaceState(null, '', '#paid'); }, T.reduced ? 0 : 2200);
    });
    const h = location.hash.slice(1);
    set(h === 'paid' || h === 'expired' ? h : 'pending', false);
  }

  Sub.boot([stage, copy, wire]);
})();
