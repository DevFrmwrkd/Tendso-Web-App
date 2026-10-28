/* Creator links board: rows of phones (same board layout as creator-more.html). Screens come from
   creator-links-screens.js (window.CL). Captions point to the implemented mobile screens. */
(function () {
  const S = CL.screens;
  const ROWS = [
    { name: 'Who sent you', screens: [
      [S.firstOpen, 'First open', 'apps/mobile/components/CreatorAttributionGate.tsx', 'A recent creator-link match asks once. Yes saves consent, then confirms after sign-in on the chosen owner/agent path. No clears it. A missing or failed match never blocks opening the app.'],
      [S.whoSent, 'Agent sign-up · who sent you', 'apps/mobile/app/(app)/agent-onboarding.tsx', 'The optional code stays in How did you hear about us. A matching public creator name/photo confirms the lookup; existing field-agent referral codes also work. Saved attribution is never overwritten.'],
      [S.checkout, 'Owner checkout', 'apps/mobile/app/(owner)/pay/index.tsx', 'The saved creator offer sets the real order total. Change applies another active code or removes it before payment starts. Existing payment requests lock the quote; self-referrals are rejected.'],
    ] },
    { name: 'Creator in the app', screens: [
      [S.home, 'Creator home', 'apps/mobile/components/affiliate/Home.tsx', 'Credited link sales and team commission side by side for the same Manila calendar month. One Share button; My page, Sales and Me stay reachable. Money contains the available balance and payouts.'],
      [S.agents, 'My agents', 'apps/mobile/components/affiliate/Agents.tsx', 'Four agents per page with this month’s actual credited 5% share and a twelve-segment time-left bar. Invite tools and earlier one-time bonuses remain available below.'],
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
      cap.innerHTML = `<div class="cm-step"><i>${no}.${si + 1}</i>${label}</div><div class="cm-src">${src}</div><p class="cm-note">${note}</p>`;
      cell.appendChild(cap);
      strip.appendChild(cell);
    });
    root.appendChild(sec);
  });
  T.fitPhones();
})();
