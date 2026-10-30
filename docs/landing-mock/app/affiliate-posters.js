'use strict';

(() => {
  const dialog = document.getElementById('poster-dialog');
  const title = document.getElementById('poster-dialog-title');
  const image = document.getElementById('poster-dialog-image');
  const fullImage = document.getElementById('poster-dialog-full-image');
  const body = dialog.querySelector('.poster-dialog-body');
  const posters = {
    offer: { name: 'Bold offer', image: '../assets/posters/offer-first.png' },
    creator: { name: 'Creator introduction', image: '../assets/posters/creator-first.png' },
    ink: { name: 'Ink saver', image: '../assets/posters/ink-saver.png' },
  };
  let opener = null;

  document.querySelectorAll('[data-poster]').forEach(button => {
    button.addEventListener('click', () => {
      const poster = posters[button.dataset.poster];
      if (!poster) return;
      if (typeof dialog.showModal !== 'function') {
        window.open(poster.image, '_blank', 'noopener');
        return;
      }
      opener = button;
      title.textContent = `${poster.name} · A4 draft`;
      image.src = poster.image;
      image.alt = `${poster.name} poster draft for Mika Santos, website price ₱3,499, creator code MIKA30, with a QR to the sample affiliate page.`;
      fullImage.href = poster.image;
      dialog.showModal();
      body.scrollTop = 0;
    });
  });

  // Escape and the explicit Close button use the dialog's native dismissal and focus handling.
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const bounds = dialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
  });
  dialog.addEventListener('close', () => {
    if (opener?.isConnected) opener.focus({ preventScroll: true });
    opener = null;
  });
})();
