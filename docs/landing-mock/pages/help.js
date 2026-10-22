/* Help Center (pages/help.html). Replaces production /knowledge, /help-faq and /contact in one page:
   search with a live big answer, topics, short answers (accordion), the full answer as a side sheet
   (production /knowledge/[slug]), and "Ask a person". Boots through window.TendsoSub (business.js).
   Facts follow Theo 2026-10-21: same day; Tendso builds the site in about 20 minutes after the interview and photos (Theo update), "See it first. Pay once to publish.", ₱4,999 once. */
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const Sub = window.TendsoSub;
  const ARR = '<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h15m-6-6 6 6-6 6" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const PLUS = '<svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M7 2v10M2 7h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';

  const TOPICS = [
    { id: 'start',  name: 'Getting started', line: 'How a site gets made.' },
    { id: 'price',  name: 'Paying',           line: 'What it costs. When you pay.' },
    { id: 'site',   name: 'Your website',     line: 'Changes, edits, taking it down.' },
    { id: 'domain', name: 'Your own .com',    line: 'Use your own address.' },
    { id: 'trust',  name: 'Trust and help',   line: 'Your data. A real person.' },
  ];

  // blocks: ['p', text] · ['h', text] · ['ol', [...]] · ['ul', [...]] · ['note', text] · ['link', label, href]
  const ART = [
    { id: 'how-it-works', t: 'start', q: 'How does Tendso work?', big: 'Talk. Snap. See it.',
      a: 'Answer 10 simple questions and take 10 guided photos in the Tendso app. Tendso builds your website in about 20 minutes.',
      k: 'how works start begin app steps',
      body: [['h', 'Two ways'], ['ul', ['On your own, in the app. About 20 minutes.', 'With a field agent at your shop. About 30 minutes.']],
        ['h', 'Then'], ['ol', ['We build your site in about 20 minutes.', 'You see it first. Ask for changes, or say it looks good.', 'You pay once to publish. Same day.']]] },
    { id: 'interview', t: 'start', q: 'What happens in the interview?', big: 'You just talk.',
      a: 'The app asks 10 simple questions, one at a time. You answer out loud. Your words become your website.',
      k: 'interview questions record talk voice tagalog english',
      body: [['h', 'What you do'], ['ol', ['Hold the phone straight.', 'Answer each question in your own words.', 'Tap “Next question”. Ten times.']],
        ['note', 'No writing. English or Tagalog, whichever is easier.'],
        ['h', 'Then'], ['p', 'The app guides you through 10 photos made for your kind of shop.']] },
    { id: 'how-fast', t: 'start', q: 'How fast is my site ready?', big: 'Same day.',
      a: 'We build it in about 20 minutes after your interview and photos. You ask for changes or say it looks good.',
      k: 'fast how long time when ready hours today speed',
      body: [['ol', ['Interview and photos: about 20 minutes.', 'We build your site: about 20 minutes.', 'Ask for changes, or say it looks good.', 'See it first. Pay once to publish.']]] },
    { id: 'laptop', t: 'start', q: 'Do I need a laptop?', big: 'No. Just your phone.',
      a: 'Everything happens on your phone.', k: 'laptop computer pc phone need' },

    { id: 'cost', t: 'price', q: 'How much does it cost?', big: '₱4,999. Once.',
      a: 'One payment, or ₱500 a month for 10 months. No monthly fees after that. With a field agent it can be as low as ₱999.',
      k: 'price cost how much fee peso 4999 999 monthly subscription',
      body: [['h', 'What you get'], ['ul', ['Your website, written and designed', 'Your own web address, like forge.tendso.site', 'Hosting with SSL, kept online', 'Free edits for the first year']],
        ['note', 'No monthly fees. No contracts. No card on file.']] },
    { id: 'when-pay', t: 'price', q: 'When do I pay?', big: 'After you see it.',
      a: 'You see your finished site first. Then you pay once to publish.',
      k: 'when pay before after approve publish first',
      body: [['ol', ['Your site is ready.', 'You look it over on your phone.', 'You pay once. It goes live.']]] },
    { id: 'how-pay', t: 'price', q: 'How do I pay?', big: 'One secure link.',
      a: 'We send you a payment link with your own reference code. Pay by Wise and put the code in the note.',
      k: 'pay payment wise link code reference transfer bank',
      body: [['ol', ['Open your payment link.', 'Send the exact amount with Wise.', 'Paste your reference code in the note.']],
        ['note', 'The code is how we know the money is from you. Your site goes live when it arrives.']] },

    { id: 'dont-like', t: 'site', q: 'What if I don’t like it?', big: 'Then don’t publish it.',
      a: 'Tell us what’s off. We change it once, free. Still not right? Don’t publish, and you pay nothing.',
      k: 'dont like change revise redo not happy guarantee refund' },
    { id: 'edits', t: 'site', q: 'Can I change it later?', big: 'Yes. Free for a year.',
      a: 'Edits are free for the first year. Tell us what to change. We do it for you.',
      k: 'change edit update later hours prices photos',
      body: [['h', 'Things people change'], ['ul', ['New hours or prices', 'New photos', 'A new phone number or address']],
        ['note', 'Nothing to install. No editor to learn.'], ['link', 'Ask for a change', '#contact']] },
    { id: 'take-down', t: 'site', q: 'Can I take my site down?', big: 'Yes, any time.',
      a: 'Email us and we unpublish it.', k: 'take down remove delete unpublish offline' },

    { id: 'own-domain', t: 'domain', q: 'Can I use my own .com?', big: 'Yes. Just ask.',
      a: 'Every site gets a free address, like forge.tendso.site. Want forgebarbers.com? We register it and connect it.',
      k: 'domain com custom address url own name',
      body: [['h', 'What it costs'], ['p', 'A small add-on. The first year is included. We tell you the price before you pay.'],
        ['h', 'How it works'], ['ol', ['Tell us the name you want.', 'We check it’s free and register it.', 'We connect it, with the secure lock.']],
        ['note', 'Already own one? We can point it to your site.']] },
    { id: 'domain-year', t: 'domain', q: 'What happens after the first year?', big: 'We remind you.',
      a: 'About 30 days before your .com runs out, we email you. Reply, and we renew it for you. Nothing is charged by itself.',
      k: 'renew expire year domain reminder' },

    { id: 'safe', t: 'trust', q: 'Is my information safe?', big: 'Yes.',
      a: 'Your site uses secure HTTPS. Nothing goes public until you approve it. We never store card numbers.',
      k: 'safe secure privacy data https card',
      body: [['ul', ['Every site uses HTTPS, the lock in the address bar.', 'Your photos and details are used only for your site.', 'Payment links are yours alone and expire.']],
        ['link', 'Read the privacy policy', 'legal.html#privacy']] },
    { id: 'agents', t: 'trust', q: 'Who are the field agents?', big: 'Local people we train.',
      a: 'Certified by Tendso before their first visit. They come to your shop and use the same app.',
      k: 'agent field creator visit who person' },
    { id: 'reach', t: 'trust', q: 'How do I reach a person?', big: 'Email us.',
      a: 'We answer every email, usually within a day.', k: 'contact email person human support call talk discord',
      body: [['link', 'Ask a person', '#contact']] },
  ];
  const byId = Object.fromEntries(ART.map((x) => [x.id, x]));
  const topicName = (t) => TOPICS.find((x) => x.id === t)?.name || '';
  const FEATURED = ['cost', 'how-fast', 'when-pay'];
  const POPULAR = [['How much?', 'cost'], ['How fast?', 'how-fast'], ['When do I pay?', 'when-pay'], ['Change my site', 'edits']];

  // ---------------------------------------------------------------- search
  const norm = (s) => s.toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9₱ ]+/g, ' ');
  function search(q) {
    const words = norm(q).split(/\s+/).filter((w) => w.length > 1);
    if (!words.length) return [];
    return ART.map((x) => {
      const hay = norm(`${x.q} ${x.q} ${x.a} ${x.k}`);
      let s = 0;
      words.forEach((w) => { if (hay.includes(w)) s += norm(x.q).includes(w) ? 3 : 1; });
      return { x, s };
    }).filter((r) => r.s > 0).sort((a, b) => b.s - a.s).slice(0, 5).map((r) => r.x);
  }

  // ---------------------------------------------------------------- hero answer
  let rot = null, rotI = 0, current = FEATURED[0];
  function showAnswer(id, kicker) {
    const x = byId[id]; if (!x) return;
    current = id;
    const box = $('#hc-answer-in');
    const fill = () => {
      $('#hc-answer-k').textContent = kicker;
      $('#hc-answer-q').textContent = x.q;
      $('#hc-answer-big').textContent = x.big;
      $('#hc-answer-a').textContent = x.a;
    };
    if (T.reduced || !box.dataset.ready) { fill(); box.dataset.ready = '1'; return; }
    box.classList.add('is-swap');
    setTimeout(() => { fill(); box.classList.remove('is-swap'); }, 260);
  }
  function dots() {
    $('#hc-dots').innerHTML = FEATURED.map((id, i) => `<i class="${i === rotI ? 'is-on' : ''}"></i>`).join('');
  }
  function startRotation() {
    stopRotation();
    if (T.reduced) return;
    rot = setInterval(() => {
      rotI = (rotI + 1) % FEATURED.length;
      showAnswer(FEATURED[rotI], 'Most asked'); dots();
    }, 5200);
  }
  function stopRotation() { clearInterval(rot); rot = null; }

  function hero() {
    showAnswer(FEATURED[0], 'Most asked'); dots();
    $('#hc-answer-more').addEventListener('click', () => openArticle(current));
    $('#hc-pop').innerHTML = POPULAR.map(([l, id]) => `<button class="hc-chip" type="button" data-art="${id}">${l}</button>`).join('');
    $('#hc-pop').addEventListener('click', (e) => {
      const b = e.target.closest('[data-art]'); if (!b) return;
      stopRotation(); showAnswer(b.dataset.art, 'Answer');
      if (matchMedia('(max-width: 900px)').matches) T.scrollTo('#hc-answer', { offset: -80 });
    });
    T.inView($('#hc-answer'), (on) => (on && !$('#hc-q').value ? startRotation() : stopRotation()), { threshold: 0.4 });

    // search
    const input = $('#hc-q'), list = $('#hc-results'), clear = $('#hc-clear');
    let results = [], active = -1;
    const render = () => {
      const q = input.value.trim();
      clear.hidden = !q;
      $('#hc-answer').classList.toggle('is-search', !!q);
      if (!q) { list.hidden = true; input.setAttribute('aria-expanded', 'false'); showAnswer(FEATURED[rotI], 'Most asked'); startRotation(); return; }
      stopRotation();
      results = search(q); active = results.length ? 0 : -1;
      list.hidden = false; input.setAttribute('aria-expanded', 'true');
      list.innerHTML = results.length
        ? results.map((x, i) => `<button type="button" role="option" class="hc-res${i === active ? ' is-active' : ''}" data-art="${x.id}" aria-selected="${i === active}"><span class="hc-res-q">${x.q}</span><span class="hc-res-t">${topicName(x.t)}</span></button>`).join('')
        : `<div class="hc-none"><b>No answer for that yet.</b><a href="#contact" class="link-arr">Ask a person ${ARR}</a></div>`;
      if (results[0]) showAnswer(results[0].id, 'Best match');
    };
    const mark = () => list.querySelectorAll('.hc-res').forEach((b, i) => { b.classList.toggle('is-active', i === active); b.setAttribute('aria-selected', i === active); });
    input.addEventListener('input', render);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown' && results.length) { active = (active + 1) % results.length; mark(); showAnswer(results[active].id, 'Best match'); e.preventDefault(); }
      if (e.key === 'ArrowUp' && results.length) { active = (active - 1 + results.length) % results.length; mark(); showAnswer(results[active].id, 'Best match'); e.preventDefault(); }
      if (e.key === 'Escape') { input.value = ''; render(); }
    });
    $('#hc-search').addEventListener('submit', (e) => { e.preventDefault(); if (results[active]) openArticle(results[active].id); });
    list.addEventListener('click', (e) => { const b = e.target.closest('[data-art]'); if (b) openArticle(b.dataset.art); });
    clear.addEventListener('click', () => { input.value = ''; render(); input.focus(); });
  }

  // ---------------------------------------------------------------- topics + answers
  let filter = 'all';
  function topics() {
    $('#hc-topics').innerHTML = TOPICS.map((t, i) => {
      const n = ART.filter((x) => x.t === t.id).length;
      return `<button class="tile tile--quiet hc-topic" type="button" data-topic="${t.id}" data-reveal style="--i:${i}">
        <span class="hc-topic-n">0${i + 1}</span>
        <span class="hc-topic-name">${t.name}</span>
        <span class="hc-topic-line">${t.line}</span>
        <span class="hc-topic-count"><span class="hc-topic-cn">${n} answers</span>${ARR}</span>
      </button>`;
    }).join('');
    $('#hc-topics').addEventListener('click', (e) => {
      const b = e.target.closest('[data-topic]'); if (!b) return;
      setFilter(b.dataset.topic); T.scrollTo('#answers', { offset: -90 });
    });
  }
  function setFilter(t) {
    filter = t;
    $('#hc-filter').querySelectorAll('.fchip').forEach((c) => c.setAttribute('aria-pressed', c.dataset.f === t));
    const faq = $('#hc-faq');
    const draw = () => {
      const rows = ART.filter((x) => t === 'all' || x.t === t);
      faq.innerHTML = rows.map((x) => `
        <details class="qa" id="q-${x.id}"><summary>${x.q}<span class="qa-plus">${PLUS}</span></summary>
          <div class="qa-a"><p>${x.a}</p>${x.body ? `<button class="link-arr hc-more" type="button" data-art="${x.id}">Read the full answer ${ARR}</button>` : ''}</div></details>`).join('');
      wireQa(faq);
    };
    if (T.reduced || !faq.dataset.ready) { draw(); faq.dataset.ready = '1'; return; }
    faq.classList.add('is-swap');
    setTimeout(() => { draw(); faq.classList.remove('is-swap'); }, 200);
  }
  function answers() {
    const chips = [['all', 'All']].concat(TOPICS.map((t) => [t.id, t.name]));
    $('#hc-filter').innerHTML = chips.map(([id, l]) => `<button class="fchip" type="button" data-f="${id}" aria-pressed="${id === 'all'}">${l}</button>`).join('');
    $('#hc-filter').addEventListener('click', (e) => { const c = e.target.closest('[data-f]'); if (c) setFilter(c.dataset.f); });
    $('#hc-faq').addEventListener('click', (e) => { const b = e.target.closest('.hc-more'); if (b) openArticle(b.dataset.art); });
    setFilter('all');
  }
  // same calm open/close as the business FAQ (height + blur)
  function wireQa(root) {
    root.querySelectorAll('.qa').forEach((d) => {
      const sum = d.querySelector('summary'), body = d.querySelector('.qa-a');
      sum.addEventListener('click', (e) => {
        if (T.reduced) return;
        e.preventDefault();
        if (d.dataset.busy) return;
        d.dataset.busy = '1';
        const opening = !d.open;
        if (opening) d.open = true;
        const h = body.scrollHeight;
        const a = body.animate(
          opening ? [{ height: '0px', opacity: 0, filter: 'blur(6px)' }, { height: h + 'px', opacity: 1, filter: 'blur(0)' }]
                  : [{ height: h + 'px', opacity: 1, filter: 'blur(0)' }, { height: '0px', opacity: 0, filter: 'blur(6px)' }],
          { duration: opening ? 520 : 360, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' });
        a.onfinish = () => { if (!opening) d.open = false; delete d.dataset.busy; };
      });
    });
  }

  // ---------------------------------------------------------------- full answer sheet
  const sheet = () => $('#hc-sheet');
  let lastFocus = null;
  function block(b) {
    const [k, v, h] = b;
    if (k === 'p') return `<p class="art-p">${v}</p>`;
    if (k === 'h') return `<h2 class="art-h2">${v}</h2>`;
    if (k === 'ol') return `<ol class="art-ol">${v.map((s, i) => `<li><span>${i + 1}</span>${s}</li>`).join('')}</ol>`;
    if (k === 'ul') return `<ul class="art-ul">${v.map((s) => `<li>${s}</li>`).join('')}</ul>`;
    if (k === 'note') return `<p class="art-note"><i></i>${v}</p>`;
    if (k === 'link') return `<a class="btn btn--line art-link" href="${h}" data-close-go>${v} ${ARR}</a>`;
    return '';
  }
  function openArticle(id) {
    const x = byId[id]; if (!x) return;
    const rel = ART.filter((r) => r.t === x.t && r.id !== x.id).slice(0, 2);
    $('#art-topic').textContent = topicName(x.t);
    $('#hc-art').innerHTML = `
      <h1 class="art-h" id="art-h">${x.q}</h1>
      <p class="art-big">${x.big}</p>
      <p class="art-lead">${x.a}</p>
      <div class="art-body">${(x.body || []).map(block).join('')}</div>
      <div class="art-help" id="art-help">
        <span>Did this help?</span>
        <div><button class="btn btn--line btn--sm" type="button" data-fb="yes">Yes</button><button class="btn btn--line btn--sm" type="button" data-fb="no">No</button></div>
      </div>
      ${rel.length ? `<div class="art-rel"><p class="label">More in ${topicName(x.t)}</p>${rel.map((r) => `<button class="art-rel-row" type="button" data-art="${r.id}"><span>${r.q}</span>${ARR}</button>`).join('')}</div>` : ''}`;
    const s = sheet();
    const wasOpen = !s.hidden;
    lastFocus = wasOpen ? lastFocus : document.activeElement;
    s.hidden = false;
    $('.hc-panel', s).scrollTop = 0;
    requestAnimationFrame(() => requestAnimationFrame(() => s.classList.add('is-open')));
    T.stop?.();
    history.replaceState(null, '', '#a-' + id);
    setTimeout(() => $('.hc-panel', s).focus({ preventScroll: true }), 50);
  }
  function closeArticle(go) {
    const s = sheet(); if (s.hidden) return;
    s.classList.remove('is-open');
    T.start?.();
    history.replaceState(null, '', location.pathname + location.search);
    setTimeout(() => { s.hidden = true; if (go) T.scrollTo(go, { offset: -90 }); else lastFocus?.focus?.({ preventScroll: true }); }, T.reduced ? 0 : 420);
  }
  function sheetWire() {
    const s = sheet();
    s.addEventListener('click', (e) => {
      if (e.target.closest('[data-close]')) return closeArticle();
      const go = e.target.closest('[data-close-go]');
      if (go) { const href = go.getAttribute('href'); if (href.startsWith('#')) { e.preventDefault(); e.stopPropagation(); closeArticle(href); } return; }
      const rel = e.target.closest('[data-art]'); if (rel) return openArticle(rel.dataset.art);
      const fb = e.target.closest('[data-fb]');
      if (fb) $('#art-help').innerHTML = fb.dataset.fb === 'yes'
        ? '<span class="art-thanks"><i></i>Thanks. Glad it helped.</span>'
        : '<span class="art-thanks"><i></i>Sorry. <a href="#contact" data-close-go>Ask a person</a> and we’ll help.</span>';
    });
    addEventListener('keydown', (e) => { if (e.key === 'Escape') closeArticle(); });
    const m = location.hash.match(/^#a-([\w-]+)/);
    if (m && byId[m[1]]) setTimeout(() => openArticle(m[1]), 300);
  }

  // ---------------------------------------------------------------- contact: copy
  let toastT;
  function toast(msg) {
    const t = $('#hc-toast'); t.textContent = msg; t.classList.add('is-on');
    clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('is-on'), 2200);
  }
  function contact() {
    document.querySelectorAll('.hc-copy').forEach((b) => b.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(b.dataset.copy); toast(b.dataset.done); }
      catch { toast(b.dataset.copy); }
    }));
  }

  Sub.boot([hero, topics, answers, sheetWire, contact]);
})();
