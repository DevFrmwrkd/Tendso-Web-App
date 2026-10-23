/* Creator links board: rows of phones (same board layout as creator-more.html). Screens come from
   creator-links-screens.js (window.CL). All screens are proposed (not in apps/mobile yet). */
(function () {
  const S = CL.screens;
  const ROWS = [
    { name: 'Who sent you', screens: [
      [S.firstOpen, 'First open (iOS)', 'proposed · after install, when a recent click on tendso.com/a/mika matches', 'Apple passes nothing through the App Store, so we ask once. Yes attributes; No clears it. On Android the Play install referrer fills it in silently.'],
      [S.whoSent, 'Agent sign-up · who sent you', 'proposed · step in the field-agent sign-up', 'Code pre-filled when we already know the creator; empty and typeable when we don’t. Joining through Mika starts her 12 months.'],
      [S.checkout, 'Owner checkout', 'proposed · publish step', 'Code applied automatically: ₱4,999 → ₱3,499. “Change” opens a field to type another code or remove it.'],
    ] },
    { name: 'Creator in the app', screens: [
      [S.home, 'Creator home', 'proposed · affiliate role, Home tab', 'The two incomes side by side for this month, the shop link, one Share button. Details live on the web portal.'],
      [S.agents, 'My agents', 'proposed · affiliate role, Agents tab', 'Four agents per screen, Mika’s 5% this month. The thin bar is months left of 12; no labels.'],
    ] },
  ];

  const root = document.getElementById('cl-rows');
  ROWS.forEach((row, ri) => {
    const sec = document.createElement('section');
    sec.className = 'cm-row';
    const no = String(ri + 1).padStart(2, '0');
    sec.innerHTML = `<div class="cm-rowhead"><b>${no} ${row.name}</b><span>${row.screens.length} screens</span></div><div class="cm-strip"></div>`;
    const strip = sec.querySelector('.cm-strip');
    row.screens.forEach(([render, label, src, note], si) => {
      const cell = document.createElement('figure');
      cell.className = 'cm-cell';
      const ph = T.phone({ size: 'md' });
      ph.screen.innerHTML = CL.shell(render());
      cell.appendChild(ph.el);
      const cap = document.createElement('figcaption');
      cap.className = 'cm-cap';
      cap.innerHTML = `<div class="cm-step"><i>${no}.${si + 1}</i>${label}</div><div class="cm-src cm-src--new">${src}</div><p class="cm-note">${note}</p>`;
      cell.appendChild(cap);
      strip.appendChild(cell);
    });
    root.appendChild(sec);
  });
  T.fitPhones();
})();
