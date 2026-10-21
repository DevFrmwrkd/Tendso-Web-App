/* Off the Record offer (pages/otr.html) = production /otr, where the TV QR code lands.
   30% off the ₱4,999 website = ₱3,499 (packages/shared/pricing.ts: otr 0.3, code OTR30).
   Production remembers the campaign for 30 days, so the code is a fallback only. The "earn with Tendso"
   button production also shows is left to the creators page (another owner). */
(function () {
  const $ = (s) => document.querySelector(s);
  const Sub = window.TendsoSub;
  function phone() {
    const ph = Sub.sitePhone({ src: '../assets/sites/hela-m-long.jpg', url: 'hela.tendso.site', auto: true, alt: "Héla Hair Studio's website on a phone" });
    $('#ot-phone').appendChild(ph.el);
  }
  let t;
  function copy() {
    $('#ot-copy').addEventListener('click', async () => {
      const toast = $('#ot-toast');
      try { await navigator.clipboard.writeText('OTR30'); toast.textContent = 'Code OTR30 copied'; } catch { toast.textContent = 'Your code is OTR30'; }
      toast.classList.add('is-on'); clearTimeout(t); t = setTimeout(() => toast.classList.remove('is-on'), 2200);
    });
  }
  Sub.boot([phone, copy]);
})();
