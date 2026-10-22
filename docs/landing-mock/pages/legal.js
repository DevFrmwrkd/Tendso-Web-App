/* Legal (pages/legal.html): production /privacy-policy and /terms-of-service as one page with a switch.
   #privacy (default) or #terms picks the document; #privacy-<section> / #terms-<section> jumps to a section.
   THE TEXT IS PRODUCTION LEGAL COPY, VERBATIM (app/privacy-policy/page.tsx, app/terms-of-service/page.tsx).
   Only the layout is new. Change words only on purpose, with the "Last updated" date. */
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const Sub = window.TendsoSub;
  const MAIL = 'frmwrkd.media@gmail.com';
  const mail = (label) => `<p><a class="lg-mail" href="mailto:${MAIL}">${label || MAIL}</a></p>`;
  const ul = (items) => `<ul>${items.map((i) => `<li>${i}</li>`).join('')}</ul>`;

  const DOCS = {
    privacy: {
      title: 'Privacy policy',
      intro: 'Your privacy matters to us. How Tendso collects, uses, and protects your personal information.',
      meta: 'Last updated February 2026',
      ask: 'Questions about your data?',
      sections: [
        ['information-we-collect', 'Information We Collect',
          '<p>We collect information that you provide directly to us when using the Tendso app.</p>' + ul([
            '<b>Account Information:</b> Name, email address, phone number, password, profile photo, and referral codes provided during registration.',
            '<b>Submission Content:</b> Business photos, video/audio recordings, interview transcriptions, business owner details (name, phone, email), and business information (name, type, address, city).',
            '<b>Device &amp; Usage Data:</b> Device type, operating system, push notification tokens, network connectivity status, and app usage patterns.'])],
        ['how-we-use-your-data', 'How We Use Your Data',
          '<p>We use the information we collect to provide, maintain, and improve our services. Specifically, we use your data to:</p>' + ul([
            'Process and manage business submissions', 'Generate AI-enhanced websites for digitized businesses', 'Process creator payouts via Wise bank transfers',
            'Send push notifications about submission status updates', 'Transcribe video and audio interviews using AI', 'Track referrals and calculate referral bonuses',
            'Provide customer support and respond to inquiries', 'Monitor app performance and usage analytics'])],
        ['data-storage-and-security', 'Data Storage & Security',
          '<p>We implement industry-standard security measures to protect your personal information:</p>' + ul([
            'Authentication tokens stored securely via Expo SecureStore', 'Encrypted data transmission for all API communications', 'Secure file uploads via presigned URLs',
            'Server-side data validation and sanitization', 'Role-based access controls for administrative functions', 'Regular security audits and vulnerability assessments'])],
        ['business-owner-data', 'Business Owner Data',
          '<p>When creators submit business information, they collect data about business owners including name, phone number, optional email, business name, type, address, and city. This data is used to generate a professional website for the business and create lead records. Business owners are contacted via the information provided to verify and manage their generated websites. Photos, videos, and audio recordings of the business are stored securely and processed through our AI content pipeline.</p>'],
        ['push-notifications', 'Push Notifications',
          '<p>We use Expo Push Notifications to keep you informed about important updates. You may receive notifications for: submission status changes (approved, rejected, deployed), payout confirmations and withdrawal updates, new lead alerts from generated websites, and system announcements.</p><p>You can manage notification preferences through your device settings. Push notification tokens are stored securely and deactivated when invalid.</p>'],
        ['data-retention', 'Data Retention',
          '<p>We retain your data according to the following policies:</p>' + ul([
            'Active account data is retained for the lifetime of your account', 'Submission content is retained indefinitely to maintain generated websites',
            'Local form draft caches expire after 7 days automatically', 'Financial records (earnings, withdrawals) are retained as required by Philippine tax law',
            'Deleted accounts: personal data removed within 30 days; anonymized analytics retained'])],
        ['your-rights', 'Your Rights',
          '<p>Under the Philippine Data Privacy Act of 2012 (RA 10173), you have the following rights:</p>' + ul([
            'Right to be informed about how your data is collected and processed', 'Right to access your personal data held by us', 'Right to object to data processing activities',
            'Right to erasure or blocking of personal data', 'Right to rectify inaccurate or incomplete data', 'Right to data portability in a structured, machine-readable format'])],
        ['philippine-dpa-compliance', 'Philippine DPA Compliance',
          '<p>Tendso is committed to complying with Republic Act No. 10173 (Data Privacy Act of 2012) and its Implementing Rules and Regulations. We process personal data based on legitimate interest and consent, maintain appropriate organizational and technical security measures, and have designated a Data Protection Officer to oversee compliance. We ensure all data processing activities are conducted in accordance with the principles of transparency, legitimate purpose, and proportionality as mandated by the National Privacy Commission.</p>'],
        ['open-platform-for-all-ages', 'Open Platform for All Ages',
          '<p>Tendso is open to users of all ages — including students, young entrepreneurs, and anyone who wants to help digitize local businesses and earn from it. There are no age restrictions to use the platform or register as a Creator. We believe in empowering the next generation of Filipino digital entrepreneurs.</p>'],
        ['policy-updates', 'Policy Updates',
          '<p>We may update this Privacy Policy from time to time to reflect changes in our practices, technology, or legal requirements. When we make significant changes, we will notify you through the app via push notification and update the "Last updated" date at the top of this page. We encourage you to review this policy periodically. Continued use of the app after changes constitutes acceptance of the updated policy.</p>'],
        ['contact-us', 'Contact Us',
          '<p>If you have any questions about this Privacy Policy or our data practices, reach out directly.</p>' + mail()],
      ],
    },
    terms: {
      title: 'Terms of service',
      intro: 'The operational guidelines governing your use of the Tendso Creator Network.',
      meta: '',   // production carries no date for the terms; none is invented here
      ask: 'Questions about these terms?',
      sections: [
        ['acceptance-of-terms', 'Acceptance of Terms',
          '<p>By accessing or using the Tendso platform (including our mobile app and web portal), you agree to be strictly bound by these Terms of Service. Users of all ages are welcome, including students and young entrepreneurs.</p>'],
        ['creator-certification', 'Creator Certification',
          '<p>To maintain quality across the platform, Creators must complete the in-app training program and pass the certification quiz with a minimum score of 80% (4 out of 5 correct) before submitting live MSME data to the network.</p>'],
        ['submissions-and-media', 'Submissions & Media',
          '<p>All data submitted must be authentic and collected with the explicit consent of the business owner. Submissions require a minimum of 3 photos (portrait, location, product) and a valid audio/video interview. Fraudulent data will result in immediate termination.</p>'],
        ['payouts-and-economics', 'Payouts & Economics',
          '<p>Creators earn 50% of the website sale price (₱500 at the ₱999 minimum price, up to ₱2,500 at the ₱4,999 maximum). Referral bonuses of PHP 1,000 are credited when a referred Creator completes their first paid submission. The minimum withdrawal threshold is PHP 100, processed securely via Wise API direct to local Philippine bank accounts.</p>'],
        ['your-website-edits-and-hosting', 'Your Website, Edits & Hosting',
          '<p>Your one-time payment covers building your website and putting it live. For one year from the day your site goes live, edits are free — you contact Tendso through the Contact page, tell us what you want changed, and we make the change for you. There is no editor for you to learn and nothing to install. After that first year, edits are no longer included; nothing is charged automatically for the website, as we keep no card on file and the website carries no recurring fee. If you bought a custom domain, its first year of registration is included in what you paid and Tendso buys it for you; that registration is held on Tendso\'s own registrar account, under Tendso\'s registrant, administrative, billing and technical contact details, not in your name. Auto-renew is switched off deliberately, so the domain is not extended automatically and no renewal is ever charged to you. Around 30 days before it expires we email you a reminder, and if it is not renewed the registration lapses and your site stops being reachable at that address. You can reply to that reminder and ask us to renew it for you, or ask us to help move the domain into a registrar account of your own — both are handled by our team over email; there is no automated transfer. Hosting with SSL is included at no monthly cost, though we cannot guarantee uninterrupted availability.</p>'],
        ['intellectual-property', 'Intellectual Property',
          '<p>By uploading media to Tendso, you grant us a worldwide, non-exclusive license to use, display, transcribe (via AI), and deploy the content to generate websites for the respective businesses.</p>'],
        ['prohibited-conduct-and-law', 'Prohibited Conduct & Law',
          '<p>Manipulating the referral system, uploading AI-generated fake stores, or harassing business owners is strictly prohibited. These Terms are governed by the laws of the Republic of the Philippines. Any disputes will be resolved in Philippine jurisdictions.</p>'],
        ['legal-inquiries', 'Legal Inquiries',
          '<p>Reach out for clarifications on payout structures, intellectual property, or terms.</p>' + mail('Contact Legal HQ')],
      ],
    },
  };

  let doc = 'privacy', spyOff = null;

  function render(which, jump) {
    doc = which;
    const D = DOCS[which];
    document.title = `Tendso ${D.title}`;
    $('#lg-h').textContent = D.title + '.';
    $('#lg-intro').textContent = D.intro;
    $('#lg-meta').textContent = D.meta;
    $('#lg-meta').hidden = !D.meta;
    $('#lg-ask-q').textContent = D.ask;
    $('#lg-toc-list').innerHTML = D.sections.map(([id, t], i) => `<li><a href="#${which}-${id}" data-sec="${which}-${id}"><span>${String(i + 1).padStart(2, '0')}</span>${t}</a></li>`).join('');
    $('#lg-body').innerHTML = D.sections.map(([id, t, body], i) => `
      <section class="lg-sec" id="${which}-${id}" aria-labelledby="${which}-${id}-h">
        <span class="lg-n">${String(i + 1).padStart(2, '0')}</span>
        <div class="lg-sec-in"><h2 class="lg-sec-h" id="${which}-${id}-h">${t}</h2><div class="lg-prose">${body}</div></div>
      </section>`).join('');
    // switch
    const seg = $('#lg-seg');
    seg.querySelectorAll('button').forEach((b) => { const on = b.dataset.doc === which; b.setAttribute('aria-pressed', on); b.setAttribute('aria-selected', on); });
    moveThumb();
    spy();
    if (jump) requestAnimationFrame(() => T.scrollTo('#' + jump, { offset: -100, immediate: true }));
  }
  function moveThumb() {
    const seg = $('#lg-seg'), on = seg.querySelector('[aria-pressed="true"]'), th = seg.querySelector('.seg-thumb');
    if (!on) return;
    th.style.width = on.offsetWidth + 'px';
    th.style.transform = `translateX(${on.offsetLeft - 4}px)`;
  }

  // "On this page": the section at the top third of the screen is the current one
  function spy() {
    spyOff?.();
    const secs = [...document.querySelectorAll('.lg-sec')];
    const links = [...document.querySelectorAll('#lg-toc-list a')];
    let cur = '';
    spyOff = T.onScroll(() => {
      const line = innerHeight * 0.32;
      let id = secs[0]?.id;
      secs.forEach((s) => { if (s.getBoundingClientRect().top < line) id = s.id; });
      if (id === cur) return; cur = id;
      links.forEach((a) => a.classList.toggle('is-on', a.dataset.sec === id));
    });
  }

  function fromHash() {
    const h = location.hash.slice(1);
    if (!h) return render('privacy');
    const which = h.startsWith('terms') ? 'terms' : 'privacy';
    render(which, h.includes('-') ? h : null);
  }

  function wire() {
    $('#lg-seg').addEventListener('click', (e) => {
      const b = e.target.closest('[data-doc]'); if (!b || b.dataset.doc === doc) return;
      const body = $('#lg-body'), title = $('#lg-title');
      const swap = () => { render(b.dataset.doc); history.replaceState(null, '', '#' + b.dataset.doc); body.classList.remove('is-swap'); title.classList.remove('is-swap'); };
      if (T.reduced) return swap();
      body.classList.add('is-swap'); title.classList.add('is-swap');
      T.scrollTo(0, { duration: 0.9 });
      setTimeout(swap, 240);
    });
    // toc: on a phone the fold closes after a jump
    $('#lg-toc-list').addEventListener('click', (e) => {
      const a = e.target.closest('a'); if (!a) return;
      history.replaceState(null, '', a.getAttribute('href'));
      if (matchMedia('(max-width: 900px)').matches) $('#lg-toc').open = false;
    });
    addEventListener('hashchange', fromHash);
    addEventListener('resize', moveThumb);
    document.fonts?.ready.then(moveThumb);
    if (matchMedia('(max-width: 900px)').matches) $('#lg-toc').open = false;
  }

  Sub.boot([fromHash, wire]);
})();
