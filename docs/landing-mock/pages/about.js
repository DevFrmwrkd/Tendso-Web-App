/* About page (pages/about.html). Agent D2. Static markup; this only tightens the nav on scroll
   and gives the brand line a calm scroll-linked settle (off under reduced motion). */
(function () {
  window.TendsoAbout = {
    ready() {
      if (!window.T) return;
      const nav = document.getElementById('nav');
      if (nav) T.onScroll((y) => nav.classList.toggle('is-tight', y > 24));

      // the hero photo opens up from a slightly inset frame as it scrolls into place
      const photo = document.querySelector('.ab-photo');
      if (!photo || T.reduced) return;
      T.onScroll(() => {
        const p = T.ease.out(T.progress(photo, 1, 0.35));
        photo.style.clipPath = `inset(0 ${((1 - p) * 4).toFixed(2)}% round var(--r-tile))`;
      });
    },
  };
})();
