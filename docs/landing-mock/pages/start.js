/* Start your website on the web (pages/start.html) = production /start (owner intake funnel), in the new look.
   One thing per screen: your shop (3 short screens) · 5 questions, one at a time, type or talk · photos ·
   last look · done. ?campaign=giveaway adds the Off the Record poster photo and makes it free.
   Nothing is sent anywhere: this is a mock. Every submit calls preventDefault. Draft text is kept in
   localStorage (wrapped in try/catch) so a refresh loses nothing, as production promises.
   Facts (Theo 2026-10-21): Tendso builds the site in about 20 minutes; ready the same day. "See it first. Pay once to publish." */
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const Sub = window.TendsoSub;
  const giveaway = /[?&]campaign=giveaway\b/.test(location.search);
  const otr = !giveaway && /[?&]campaign=otr\b/.test(location.search);   // Off the Record viewers: 30% off
  const PRICE = otr ? '₱3,499' : '₱4,999';

  const KINDS = [
    { id: 'barber',  name: 'Barber',      label: 'Barbershop',     site: 'forge',   sample: 'Haircuts, fades and a hot-towel shave. Walk in, no waiting.' },
    { id: 'salon',   name: 'Salon',       label: 'Hair salon',     site: 'hela',    sample: 'Haircuts, colour and rebond. Nails on weekends.' },
    { id: 'auto',    name: 'Auto repair', label: 'Auto repair',    site: 'vulca',   sample: 'Change oil, brakes and tune-ups. Tyres too.' },
    { id: 'laundry', name: 'Laundry',     label: 'Laundry',        site: 'labana',  sample: 'Wash, dry and fold. Same day if you drop it before ten.' },
    { id: 'store',   name: 'Store',       label: 'Hardware store', site: 'domingo', sample: 'Nails, paint, pipes and tools. We cut wood to size.' },
    { id: 'other',   name: 'Something else', label: 'Gym',         site: 'kalasag', sample: 'Training for anyone in the barangay. Open early.' },
  ];
  const QUESTIONS = [
    { q: 'What do you sell, or do for people?', h: 'List the main things. Two sentences is plenty.', need: true },
    { q: 'Who are your customers?', h: 'The people who walk in. Neighbours, students, drivers.', sample: 'Neighbours, students and the drivers from the terminal.' },
    { q: 'What makes you different?', h: 'The real reason regulars pick you.', need: true, sample: 'We take our time, and we remember your name.' },
    { q: 'How do people buy from you?', h: 'Walk in, message, call, book ahead.', sample: 'Walk in, or message us on Facebook to book.' },
    { q: 'What year did you open?', h: 'Just the year is fine.', short: true, sample: '2014' },
  ];
  const SLOTS = [
    { id: 'outside', label: 'Your shop from the street', hint: 'Step back so your sign fits.', need: true, sample: 'phone-outside' },
    { id: 'inside',  label: 'Inside your place', hint: 'From the door, lights on.', need: true, sample: 'phone-inside' },
    { id: 'inside2', label: 'Inside, another angle', hint: 'From the other side.', sample: 'phone-chair' },
    { id: 'you',     label: 'You or your staff', hint: 'Optional. People trust a face.', sample: 'phone-headshot' },
    { id: 'work1',   label: 'Your work, close up', hint: 'One thing you make or do.', sample: 'phone-haircut' },
    { id: 'work2',   label: 'One more of your work', hint: 'So the page has variety.', sample: 'phone-finished' },
  ];
  const STAGES = ['Your shop', 'Questions', 'Photos', 'Last look'];

  // screens in order; `stage` drives the progress bar
  const SCREENS = [
    { id: 'name', stage: 0 }, { id: 'reach', stage: 0 }, { id: 'where', stage: 0 },
    ...QUESTIONS.map((_, i) => ({ id: 'q' + i, stage: 1, qi: i })),
    { id: 'photos', stage: 2 },
    ...(giveaway ? [{ id: 'poster', stage: 2 }] : []),
    { id: 'review', stage: 3 },
    { id: 'done', stage: 4 },
  ];

  const S = { name: '', kind: '', owner: '', phone: '', email: '', street: '', city: '', answers: QUESTIONS.map(() => ''), photos: {}, poster: '', code: '' };
  let at = 0;

  // ---------------------------------------------------------------- helpers
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const slug = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 26) || 'your-shop';
  const kindOf = () => KINDS.find((k) => k.id === S.kind) || KINDS[0];
  const spacedPhone = (d) => d.replace(/^(\d{3})(\d{0,3})(\d{0,4}).*/, (m, a, b, c) => [a, b, c].filter(Boolean).join(' '));
  const ICON = {
    mic: '<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    stop: '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><rect x="3" y="3" width="10" height="10" rx="2" fill="currentColor"/></svg>',
    plus: '<svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    x: '<svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="m3 3 8 8M11 3l-8 8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    check: '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="m3 8.5 3 3 7-7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  };
  const field = (id, label, input, help = '') => `
    <div class="st-field"><label class="st-field-k" for="${id}">${label}</label>${input}${help ? `<p class="st-help">${help}</p>` : ''}<p class="st-err" id="err-${id}" aria-live="polite"></p></div>`;

  // ---------------------------------------------------------------- draft (text only, never photos)
  const KEY = 'tendso-start-draft-v1';
  let saveT;
  function save() {
    clearTimeout(saveT);
    saveT = setTimeout(() => {
      try {
        const { photos, poster, ...text } = S;
        localStorage.setItem(KEY, JSON.stringify({ ...text, at }));
        const el = $('#st-saved'); el.textContent = 'Saved'; el.classList.remove('is-on'); void el.offsetWidth; el.classList.add('is-on');
      } catch { /* storage off: the flow still works */ }
    }, 400);
  }
  function restore() {
    try {
      const d = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (!d) return;
      Object.keys(S).forEach((k) => { if (k in d && k !== 'photos' && k !== 'poster') S[k] = d[k]; });
      if (Number.isInteger(d.at) && d.at > 0 && d.at < SCREENS.findIndex((s) => s.id === 'photos')) at = d.at;
    } catch { /* ignore */ }
  }
  function clearDraft() { try { localStorage.removeItem(KEY); } catch { /* ignore */ } }

  // ---------------------------------------------------------------- screens
  function html(sc) {
    if (sc.id === 'name') return `
      <h1 class="st-q">What’s your shop called?</h1>
      <p class="st-hint">The name on your sign.</p>
      <label class="sr-only" for="f-name">Shop name</label>
      <input class="st-big" id="f-name" data-k="name" type="text" autocomplete="organization" placeholder="Forge Barbers" value="${esc(S.name)}" enterkeyhint="next">
      <p class="st-err" id="err-f-name" aria-live="polite"></p>
      <p class="st-addr"><span>Your web address</span><b id="st-addr">${slug(S.name || 'Forge Barbers')}.tendso.site</b></p>
      <p class="st-sub" id="kind-k">What kind of shop?</p>
      <div class="st-chips" role="radiogroup" aria-labelledby="kind-k" id="st-kinds">
        ${KINDS.map((k) => `<button type="button" class="st-chip" role="radio" data-kind="${k.id}" aria-checked="${S.kind === k.id}">${k.name}</button>`).join('')}
      </div>
      <p class="st-err" id="err-kind" aria-live="polite"></p>
      <p class="st-price-m">${giveaway ? '<b>Free.</b> A gift from Off the Record.' : `<b>Nothing to pay now.</b> ${PRICE} once, after you see your site.`}</p>`;
    if (sc.id === 'reach') return `
      <h1 class="st-q">How can we reach you?</h1>
      <p class="st-hint">We send your site here.</p>
      <div class="st-fields">
        ${field('f-owner', 'Your name', `<input class="st-in" id="f-owner" data-k="owner" type="text" autocomplete="name" placeholder="Juan Dela Cruz" value="${esc(S.owner)}">`)}
        ${field('f-phone', 'Mobile number', `<div class="st-tel"><span>+63</span><input class="st-in" id="f-phone" data-k="phone" type="tel" inputmode="numeric" autocomplete="tel-national" placeholder="917 123 4567" value="${esc(spacedPhone(S.phone))}"></div>`)}
        ${field('f-email', 'Email', `<input class="st-in" id="f-email" data-k="email" type="email" autocomplete="email" placeholder="juan@gmail.com" value="${esc(S.email)}">`)}
      </div>`;
    if (sc.id === 'where') return `
      <h1 class="st-q">Where is your shop?</h1>
      <p class="st-hint">So customers can find you.</p>
      <div class="st-fields">
        ${field('f-street', 'Street', `<input class="st-in" id="f-street" data-k="street" type="text" autocomplete="address-line1" placeholder="123 J.P. Rizal St." value="${esc(S.street)}">`)}
        ${field('f-city', 'City or town', `<input class="st-in" id="f-city" data-k="city" type="text" autocomplete="address-level2" placeholder="Marikina" value="${esc(S.city)}">`)}
      </div>`;
    if (sc.qi !== undefined) {
      const Q = QUESTIONS[sc.qi];
      const input = Q.short
        ? `<input class="st-big st-big--short" id="f-q${sc.qi}" data-q="${sc.qi}" type="text" inputmode="numeric" placeholder="2014" value="${esc(S.answers[sc.qi])}">`
        : `<textarea class="st-ta" id="f-q${sc.qi}" data-q="${sc.qi}" rows="4" placeholder="Type it the way you’d say it.">${esc(S.answers[sc.qi])}</textarea>`;
      return `
        <p class="st-qn">Question ${sc.qi + 1} of ${QUESTIONS.length}</p>
        <h1 class="st-q">${Q.q}</h1>
        <p class="st-hint">${Q.h}</p>
        <label class="sr-only" for="f-q${sc.qi}">Your answer</label>
        ${input}
        <p class="st-err" id="err-f-q${sc.qi}" aria-live="polite"></p>
        <div class="st-voice">
          ${Q.short ? '' : `<button type="button" class="st-mic" data-mic="${sc.qi}"><span class="st-mic-i">${ICON.mic}</span><span class="st-mic-t">Say it instead</span><span class="st-wave" aria-hidden="true">${'<i></i>'.repeat(14)}</span><span class="st-time">0:00</span></button>`}
          ${Q.need ? '' : `<button type="button" class="st-skip" data-skip>Skip this one</button>`}
        </div>`;
    }
    if (sc.id === 'photos') return `
      <h1 class="st-q">Now show us the place.</h1>
      <p class="st-hint">Straight from your phone is fine. We make them look professional.</p>
      <div class="st-slots" id="st-slots">${SLOTS.map((s) => slot(s.id, s.label, s.hint, s.need)).join('')}</div>
      <p class="st-err" id="err-photos" aria-live="polite"></p>
      <button type="button" class="st-skip st-sample" id="st-sample">Try it with sample photos</button>`;
    if (sc.id === 'poster') return `
      <p class="st-qn">One more photo</p>
      <h1 class="st-q">Show the poster in your shop.</h1>
      <p class="st-hint">Your sign or shop front in the same photo.</p>
      <div class="st-slots st-slots--one">${slot('poster', 'Poster photo', 'The printed poster, on your wall.', true)}</div>
      <p class="st-err" id="err-photos-poster" aria-live="polite"></p>`;
    if (sc.id === 'review') return `<div id="st-review"></div>`;
    if (sc.id === 'done') return `<div id="st-done"></div>`;
    return '';
  }
  function slot(id, label, hint, need) {
    return `<div class="st-slot" data-slot="${id}">
      <label class="st-slot-pick"><input type="file" accept="image/*" capture="environment" data-file="${id}" class="sr-only">
        <span class="st-slot-empty"><span class="st-slot-plus">${ICON.plus}</span><span class="st-slot-l">${label}</span><span class="st-slot-h">${need ? 'Needed' : 'Optional'}</span></span>
        <img alt="${label}" hidden>
      </label>
      <button type="button" class="st-slot-x" data-remove="${id}" aria-label="Remove photo: ${label}" hidden>${ICON.x}</button>
      <span class="sr-only">${hint}</span>
    </div>`;
  }

  function review() {
    const k = kindOf();
    const answered = S.answers.filter((a) => a.trim()).length;
    const pics = SLOTS.filter((s) => S.photos[s.id]).map((s) => `<img src="${S.photos[s.id]}" alt="${s.label}">`).join('');
    const rows = [['Shop', S.name], ['Kind', k.name], ['You', S.owner], ['Mobile', S.phone ? '+63 ' + spacedPhone(S.phone) : ''], ['Email', S.email], ['Address', [S.street, S.city].filter(Boolean).join(', ')]];
    $('#st-review').innerHTML = `
      <h1 class="st-q">Does this look right?</h1>
      <div class="st-cards">
        <section class="st-card">
          <header><h2>Your shop</h2><button type="button" class="st-edit" data-go="name">Edit</button></header>
          <dl>${rows.map(([a, b]) => `<div><dt>${a}</dt><dd>${esc(b) || '—'}</dd></div>`).join('')}</dl>
        </section>
        <section class="st-card st-card--row">
          <header><h2>Your answers</h2><button type="button" class="st-edit" data-go="q0">Edit</button></header>
          <p class="st-count"><b>${answered}</b> of ${QUESTIONS.length} answered</p>
        </section>
        <section class="st-card">
          <header><h2>Photos</h2><button type="button" class="st-edit" data-go="photos">Edit</button></header>
          <div class="st-strip">${pics || '<span class="st-none">No photos yet</span>'}${giveaway && S.poster ? `<img src="${S.poster}" alt="Poster photo">` : ''}</div>
        </section>
        <section class="st-card st-card--price">
          ${giveaway
            ? `<p class="st-pay-k"><i></i>Free website</p><p class="st-pay-v">A gift from Off the Record, built by Tendso.</p>`
            : `<p class="st-pay-k"><i></i>Nothing to pay now</p><p class="st-pay-v"><b>${PRICE}</b> once${otr ? ' (30% off ₱4,999)' : ''}. See it first, then pay once to publish.</p>
               <details class="st-code"><summary>Have a discount code?</summary>
                 <div class="st-code-in"><label class="sr-only" for="f-code">Discount code</label><input class="st-in" id="f-code" data-k="code" type="text" placeholder="Your code" value="${esc(S.code)}" autocapitalize="characters"><p class="st-help">We apply it before you pay.</p></div>
               </details>`}
          <p class="st-addr st-addr--card"><span>Your web address</span><b>${slug(S.name)}.tendso.site</b></p>
        </section>
      </div>`;
  }
  function done() {
    $('#st-done').innerHTML = `
      <div class="st-done-mark">${ICON.check}</div>
      <h1 class="st-q st-q--done">Got it.</h1>
      <p class="st-done-p">${giveaway
        ? `Off the Record checks your poster photo. If you qualify, we build your free site and email the link to <b>${esc(S.email)}</b>.`
        : `We build your site in about 20 minutes and email the link to <b>${esc(S.email)}</b>. Ask for changes, or say it looks good.`}</p>
      ${giveaway ? '' : '<div class="price-pills st-done-pills"><span>See it first</span><span>Pay once to publish</span></div>'}
      <div class="st-done-cta"><a class="btn btn--ink" href="../index.html">Back to Tendso</a><a class="btn btn--line" href="help.html">Questions? Help</a></div>`;
  }

  // ---------------------------------------------------------------- build + navigation
  function build() {
    $('#st-screens').innerHTML = SCREENS.map((sc, i) => `<section class="st-scr" data-scr="${sc.id}" ${i === at ? '' : 'hidden'} aria-label="${sc.id}">${html(sc)}</section>`).join('');
    $('#st-prog').innerHTML = STAGES.map((t, i) => `<li data-stage="${i}"><span class="st-pbar"><i></i></span><span class="st-pt">${t}</span></li>`).join('');
    if (giveaway) {
      $('#st-camp').hidden = false;
      $('#st-price').innerHTML = '<p class="st-price-k">Off the Record giveaway</p><p class="st-price-v"><b>Free.</b> Nothing to pay, no account.</p>';
    }
    if (otr) {
      $('#st-camp').hidden = false;
      $('#st-camp').innerHTML = '<i></i>Off the Record viewers · 30% off';
      $('#st-price').innerHTML = '<p class="st-price-k">Nothing to pay now</p><p class="st-price-v"><s>₱4,999</s> <b>₱3,499</b> once, after you see your site.</p>';
    }
    sidePhone();
    show(at, 0);
  }

  function progress() {
    const sc = SCREENS[at];
    $$('#st-prog li').forEach((li) => {
      const st = +li.dataset.stage;
      const inStage = SCREENS.filter((s) => s.stage === st);
      const pos = inStage.findIndex((s) => s === sc);
      const p = sc.stage > st ? 1 : sc.stage < st ? 0 : (pos + 1) / inStage.length;
      li.style.setProperty('--p', p);
      li.classList.toggle('is-on', sc.stage === st);
      li.classList.toggle('is-done', sc.stage > st);
    });
    const shown = Math.min(sc.stage, 3);
    $('#st-prog-m-t').textContent = sc.stage > 3 ? 'Sent' : `Step ${shown + 1} of 4 · ${STAGES[shown]}`;
    $('#st-prog-m-b').style.width = (sc.stage > 3 ? 100 : ((at + 1) / (SCREENS.length - 1)) * 100) + '%';
  }

  function show(i, dir) {
    const prev = $$('#st-screens .st-scr').find((s) => !s.hidden);
    const next = $(`#st-screens [data-scr="${SCREENS[i].id}"]`);
    at = i;
    if (SCREENS[i].id === 'review') review();
    if (SCREENS[i].id === 'done') done();
    document.body.dataset.scr = SCREENS[i].id;
    $('#st-back').hidden = i === 0 || SCREENS[i].id === 'done';
    $('#st-actions').hidden = SCREENS[i].id === 'done';
    $('#st-next').textContent = SCREENS[i].id === 'review' ? (giveaway ? 'Send my application' : 'Send it in') : 'Continue';
    progress();
    if (prev && prev !== next && dir && !T.reduced) {
      prev.classList.add(dir > 0 ? 'is-out' : 'is-out-back');
      setTimeout(() => { prev.hidden = true; prev.classList.remove('is-out', 'is-out-back'); }, 220);
      next.hidden = false; next.classList.add(dir > 0 ? 'is-in' : 'is-in-back');
      setTimeout(() => next.classList.remove('is-in', 'is-in-back'), 760);
    } else {
      if (prev && prev !== next) prev.hidden = true;
      next.hidden = false;
    }
    if (dir) T.scrollTo(0, { immediate: true });
    if (dir && matchMedia('(min-width: 901px)').matches) {
      setTimeout(() => next.querySelector('input:not([type=file]), textarea')?.focus({ preventScroll: true }), 260);
    }
    if (dir && SCREENS[i].id !== 'done') save();
  }
  const go = (id) => { const i = SCREENS.findIndex((s) => s.id === id); if (i >= 0) show(i, i < at ? -1 : 1); };

  // ---------------------------------------------------------------- validation
  function err(id, msg) {
    const e = $('#err-' + id); if (e) e.textContent = msg || '';
    const inp = $('#' + id); if (inp) inp.setAttribute('aria-invalid', msg ? 'true' : 'false');
    return !msg;
  }
  function validate() {
    const sc = SCREENS[at];
    if (sc.id === 'name') {
      const a = err('f-name', S.name.trim() ? '' : 'We need the name on your sign.');
      const b = err('kind', S.kind ? '' : 'Pick the closest one.');
      return a && b;
    }
    if (sc.id === 'reach') {
      const a = err('f-owner', S.owner.trim() ? '' : 'Who should we talk to?');
      const b = err('f-phone', S.phone.length === 10 ? '' : 'Ten digits after +63, like 917 123 4567.');
      const c = err('f-email', /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(S.email.trim()) ? '' : 'Check your email. We send your site there.');
      return a && b && c;
    }
    if (sc.id === 'where') {
      const a = err('f-street', S.street.trim() ? '' : 'Your street, so people can find you.');
      const b = err('f-city', S.city.trim() ? '' : 'Your city or town.');
      return a && b;
    }
    if (sc.qi !== undefined && QUESTIONS[sc.qi].need) {
      return err('f-q' + sc.qi, S.answers[sc.qi].trim().length >= 10 ? '' : 'Tell us a little more. A sentence or two.');
    }
    if (sc.id === 'photos') {
      const missing = SLOTS.filter((s) => s.need && !S.photos[s.id]);
      $$('#st-slots .st-slot').forEach((el) => el.classList.toggle('is-missing', missing.some((m) => m.id === el.dataset.slot)));
      const e = $('#err-photos'); e.textContent = missing.length ? `Add ${missing.map((m) => m.label.toLowerCase()).join(' and ')}.` : '';
      return !missing.length;
    }
    if (sc.id === 'poster') {
      const e = $('#err-photos-poster'); e.textContent = S.poster ? '' : 'Add the photo of the poster.';
      $('[data-slot="poster"]').classList.toggle('is-missing', !S.poster);
      return !!S.poster;
    }
    return true;
  }

  // ---------------------------------------------------------------- side phone (sample design + live address)
  let ph = null;
  function sidePhone() {
    const k = kindOf();
    ph = Sub.sitePhone({ src: `../assets/sites/${k.site}-m-long.jpg`, url: `${slug(S.name || 'Forge Barbers')}.tendso.site`, auto: true, alt: 'A sample Tendso site on a phone' });
    $('#st-phone').appendChild(ph.el);
    $('#st-kind-name').textContent = k.label;
    const img = ph.screen.querySelector('img');
    img.addEventListener('load', () => img.style.setProperty('--travel', `-${Math.max(0, img.offsetHeight - 790 + 60)}px`));
  }
  function updatePhone(kindChanged) {
    if (!ph) return;
    const url = `${slug(S.name || 'Forge Barbers')}.tendso.site`;
    const pill = ph.screen.querySelector('.url-pill'); if (pill) pill.innerHTML = Sub.ICON.lock + esc(url);
    const addr = $('#st-addr'); if (addr) addr.textContent = url;
    if (!kindChanged) return;
    const k = kindOf();
    $('#st-kind-name').textContent = k.label;
    const img = ph.screen.querySelector('img');
    const wrap = ph.screen.querySelector('.site-scroll');
    wrap.classList.add('is-swap');
    setTimeout(() => { img.src = `../assets/sites/${k.site}-m-long.jpg`; img.onload = () => wrap.classList.remove('is-swap'); }, 260);
  }

  // ---------------------------------------------------------------- voice (demo: a recording, then its words are added)
  let rec = null;
  function mic(btn) {
    const qi = +btn.dataset.mic;
    if (rec && rec.btn !== btn) return;                      // one microphone at a time
    if (!rec) {
      const t0 = performance.now();
      btn.classList.add('is-rec'); btn.querySelector('.st-mic-t').textContent = 'Listening. Tap to stop';
      btn.querySelector('.st-mic-i').innerHTML = ICON.stop;
      const bars = $$('.st-wave i', btn);
      const off = T.onFrame((now) => {
        const s = Math.floor((now - t0) / 1000);
        btn.querySelector('.st-time').textContent = `0:${String(s).padStart(2, '0')}`;
        bars.forEach((b, i) => { b.style.transform = `scaleY(${(0.2 + Math.abs(Math.sin(now / 170 + i * 0.7) * Math.sin(now / 410 + i * 0.31))).toFixed(3)})`; });
        if (s >= 120) mic(btn);
      });
      rec = { btn, off };
      return;
    }
    rec.off(); rec = null;
    btn.classList.remove('is-rec'); btn.classList.add('is-busy');
    btn.querySelector('.st-mic-t').textContent = 'Typing it out…';
    setTimeout(() => {
      btn.classList.remove('is-busy');
      btn.querySelector('.st-mic-i').innerHTML = ICON.mic;
      btn.querySelector('.st-mic-t').textContent = 'Say more';
      const words = qi === 0 ? kindOf().sample : QUESTIONS[qi].sample;
      const ta = $('#f-q' + qi);
      S.answers[qi] = (S.answers[qi].trim() ? S.answers[qi].trim() + ' ' : '') + words;   // adds, never replaces
      ta.value = S.answers[qi];
      err('f-q' + qi, '');
      save();
    }, 900);
  }

  // ---------------------------------------------------------------- photos
  function setPhoto(id, url) {
    if (id === 'poster') S.poster = url; else if (url) S.photos[id] = url; else delete S.photos[id];
    const el = $(`[data-slot="${id}"]`); if (!el) return;
    const img = $('img', el);
    img.hidden = !url; if (url) img.src = url; else img.removeAttribute('src');
    $('.st-slot-x', el).hidden = !url;
    el.classList.toggle('has-photo', !!url);
    if (url) el.classList.remove('is-missing');
  }

  // ---------------------------------------------------------------- wiring
  let toastT;
  function toast(m) { const t = $('#st-toast'); t.textContent = m; t.classList.add('is-on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('is-on'), 2400); }

  function wire() {
    const form = $('#st-form');
    form.addEventListener('submit', (e) => {
      e.preventDefault();                                     // mock: nothing leaves the page
      if (!validate()) { form.querySelector('[aria-invalid="true"], .is-missing')?.scrollIntoView?.({ block: 'center', behavior: 'smooth' }); return; }
      if (SCREENS[at].id === 'review') { clearDraft(); toast(giveaway ? 'Application sent' : 'Sent. We’re building your site'); }
      show(Math.min(at + 1, SCREENS.length - 1), 1);
    });
    $('#st-back').addEventListener('click', () => show(Math.max(0, at - 1), -1));
    form.addEventListener('input', (e) => {
      const t = e.target;
      if (t.dataset.k === 'phone') {
        const d = t.value.replace(/\D/g, '').replace(/^63/, '').replace(/^0/, '').slice(0, 10);
        S.phone = d; t.value = spacedPhone(d);
      } else if (t.dataset.k) S[t.dataset.k] = t.value;
      if (t.dataset.q !== undefined) S.answers[+t.dataset.q] = t.value;
      if (t.dataset.k === 'name') updatePhone(false);
      if (t.getAttribute('aria-invalid') === 'true') err(t.id, '');
      save();
    });
    form.addEventListener('change', (e) => {
      const f = e.target.closest('[data-file]'); if (!f || !f.files?.[0]) return;
      const file = f.files[0];
      if (!/^image\//.test(file.type)) { toast('That file is not a photo.'); return; }
      setPhoto(f.dataset.file, URL.createObjectURL(file));
    });
    form.addEventListener('click', (e) => {
      const chip = e.target.closest('[data-kind]');
      if (chip) {
        const changed = S.kind !== chip.dataset.kind;
        S.kind = chip.dataset.kind;
        $$('#st-kinds .st-chip').forEach((c) => c.setAttribute('aria-checked', c === chip));
        err('kind', ''); updatePhone(changed); save(); return;
      }
      const m = e.target.closest('[data-mic]'); if (m) return mic(m);
      if (e.target.closest('[data-skip]')) { S.answers[SCREENS[at].qi] = S.answers[SCREENS[at].qi] || ''; show(at + 1, 1); return; }
      const rm = e.target.closest('[data-remove]'); if (rm) { e.preventDefault(); setPhoto(rm.dataset.remove, ''); return; }
      const ed = e.target.closest('[data-go]'); if (ed) { go(ed.dataset.go); return; }
      if (e.target.closest('#st-sample')) {
        SLOTS.forEach((s) => setPhoto(s.id, `../assets/photos/forge/${s.sample}.jpg`));
        $('#err-photos').textContent = '';
      }
    });
    // Enter on a one-line field moves on (textareas keep their newline)
    form.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.target.matches('input.st-in, input.st-big')) {
        const all = $$(`.st-scr[data-scr="${SCREENS[at].id}"] input.st-in, .st-scr[data-scr="${SCREENS[at].id}"] input.st-big`);
        e.preventDefault();
        if (e.target !== all[all.length - 1]) all[all.indexOf(e.target) + 1]?.focus();
        else form.requestSubmit();
      }
    });
    $('#st-exit').addEventListener('click', () => { save(); });
  }

  function init() { restore(); build(); wire(); }
  Sub.boot([init]);
})();
