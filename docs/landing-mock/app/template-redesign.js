(function () {
  'use strict';
  const TYPES = ['Barber/Salon', 'Auto Shop', 'Spa/Massage', 'Restaurant', 'Clinic', 'Law Office', 'Craft/Producer', 'Other'];
  const STYLE_ORDER = ['editorial', 'immersive', 'studio'];
  const FALLBACK_DESCRIPTIONS = {
    editorial: 'Considered typography, warm space and a story worth spending time with.',
    immersive: 'A photo-led first impression with a confident, atmospheric composition.',
    studio: 'Bright, precise and easy to explore, with useful details clearly arranged.',
  };
  const grid = document.getElementById('design-grid');
  const selector = document.getElementById('business-type');
  const example = document.getElementById('comparison-title');
  const dialog = document.getElementById('full-preview');
  const fullFrame = document.getElementById('full-frame');
  const fullWindow = dialog.querySelector('.full-window');
  const canvas = dialog.querySelector('.full-canvas');
  const toast = document.getElementById('sample-toast');
  const safeText = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const styleKey = design => String(design.style || design.name || '').toLowerCase();
  const catalog = window.CAPTURE_REDESIGN_CATALOG;
  const validPreview = value => typeof value === 'string' && /^\/capture-redesign\/[a-z0-9/_-]+\.html$/.test(value);
  const designs = Array.isArray(catalog?.designs) ? catalog.designs.filter(design => design && typeof design.id === 'string'
    && TYPES.includes(design.businessType) && STYLE_ORDER.includes(styleKey(design)) && validPreview(design.preview)) : [];
  let selectedType = TYPES[0];
  let activeDesign = null;
  let activeMode = 'phone';
  let opener = null;
  let toastTimer = null;
  let cardObserver = null;

  function notifySample() {
    clearTimeout(toastTimer);
    toast.hidden = false;
    toastTimer = setTimeout(() => { toast.hidden = true; }, 3200);
  }

  // Same-origin samples are readable, but never perform illustrative contact
  // actions. Native internal anchors, menu details and FAQ details still work.
  function guardSample(frame) {
    frame.addEventListener('load', () => {
      try {
        const doc = frame.contentDocument;
        if (!doc) return;
        doc.addEventListener('click', event => {
          const link = event.target.closest?.('a');
          if (!link) return;
          const raw = (link.getAttribute('href') || '').trim();
          if (raw.startsWith('#')) return;
          let target;
          try { target = new URL(raw, frame.src); } catch { target = null; }
          const source = new URL(frame.src, window.location.href);
          if (target && target.origin === source.origin && target.pathname === source.pathname && target.hash) return;
          event.preventDefault(); event.stopImmediatePropagation(); notifySample();
        }, true);
        doc.addEventListener('submit', event => { event.preventDefault(); event.stopImmediatePropagation(); notifySample(); }, true);
      } catch { /* A sample that cannot be read stays isolated by its sandbox. */ }
    });
  }

  function sizeCardFrames() {
    grid.querySelectorAll('.phone-screen').forEach(screen => {
      const frame = screen.querySelector('iframe');
      if (frame) frame.style.transform = `scale(${screen.clientWidth / 390})`;
    });
  }

  function currentChoices() {
    return designs.filter(design => design.businessType === selectedType)
      .sort((left, right) => STYLE_ORDER.indexOf(styleKey(left)) - STYLE_ORDER.indexOf(styleKey(right)));
  }

  function render() {
    cardObserver?.disconnect();
    const choices = currentChoices();
    if (choices.length !== 3) {
      grid.innerHTML = '<p class="catalog-status" role="status">The three finished examples for this business type are being prepared. Refresh when the preview build is ready.</p>';
      grid.setAttribute('aria-busy', 'false');
      example.textContent = selectedType;
      return;
    }
    example.textContent = choices[0].businessName || selectedType;
    grid.innerHTML = choices.map((design, index) => {
      const key = styleKey(design);
      const label = design.name || key.charAt(0).toUpperCase() + key.slice(1);
      return `<article class="design-card" aria-labelledby="heading-${safeText(design.id)}">
        <div class="card-heading"><div><span class="direction-number">DIRECTION ${String(index + 1).padStart(2, '0')}</span><h3 id="heading-${safeText(design.id)}">${safeText(label)}</h3></div><button class="expand-button" type="button" data-open-design="${safeText(design.id)}" aria-label="Open ${safeText(label)} full website">↗</button></div>
        <p class="card-description">${safeText(design.description || FALLBACK_DESCRIPTIONS[key])}</p>
        <div class="preview-topline"><span><i class="preview-dot" aria-hidden="true"></i> PHONE PREVIEW</span><span>390 × 780</span></div>
        <div class="phone-case"><div class="phone-screen"><iframe class="card-frame" title="${safeText(label)} phone sample for ${safeText(design.businessName)}" sandbox="allow-same-origin" referrerpolicy="no-referrer" tabindex="-1" aria-hidden="true" data-preview-src="${safeText(design.preview)}"></iframe></div></div>
        <div class="card-footer"><button class="full-button" type="button" data-open-design="${safeText(design.id)}">Explore ${safeText(label)}<span aria-hidden="true">↗</span></button></div>
      </article>`;
    }).join('');
    grid.querySelectorAll('iframe[data-preview-src]').forEach(frame => { guardSample(frame); frame.src = frame.dataset.previewSrc; });
    sizeCardFrames();
    if (typeof ResizeObserver !== 'undefined') {
      cardObserver = new ResizeObserver(sizeCardFrames);
      grid.querySelectorAll('.phone-screen').forEach(screen => cardObserver.observe(screen));
    }
    grid.setAttribute('aria-busy', 'false');
  }

  function sizeFullPreview() {
    if (!dialog.open) return;
    const width = activeMode === 'desktop' ? 1080 : 390;
    const availableWidth = Math.max(1, fullWindow.clientWidth - 36);
    const availableHeight = Math.max(1, fullWindow.clientHeight - 18);
    const scale = Math.min(1, availableWidth / width);
    const height = Math.max(1, Math.floor(availableHeight / scale));
    canvas.style.width = `${width * scale}px`;
    canvas.style.height = `${height * scale}px`;
    fullFrame.style.width = `${width}px`;
    fullFrame.style.height = `${height}px`;
    fullFrame.style.transform = `scale(${scale})`;
    document.getElementById('viewport-label').textContent = `${width} px${scale < .99 ? ' · scaled to fit' : ''}`;
    dialog.querySelectorAll('[data-preview-mode]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.previewMode === activeMode)));
  }

  function openPreview(id, trigger) {
    const design = designs.find(item => item.id === id && item.businessType === selectedType);
    if (!design) return;
    activeDesign = design; activeMode = 'phone'; opener = trigger;
    document.getElementById('preview-business').textContent = `${design.businessName} · ${design.businessType}`;
    document.getElementById('preview-title').textContent = `${design.name} website`;
    fullFrame.title = `${design.name} full sample website for ${design.businessName}`;
    fullFrame.src = design.preview;
    dialog.showModal();
    document.body.style.overflow = 'hidden';
    sizeFullPreview();
  }

  function closePreview() { dialog.close(); }
  guardSample(fullFrame);
  selector.addEventListener('change', () => { selectedType = selector.value; render(); });
  grid.addEventListener('click', event => {
    const trigger = event.target.closest('[data-open-design]');
    if (trigger) openPreview(trigger.dataset.openDesign, trigger);
  });
  dialog.querySelector('.close-preview').addEventListener('click', closePreview);
  dialog.querySelectorAll('[data-preview-mode]').forEach(button => button.addEventListener('click', () => {
    if (!activeDesign) return;
    activeMode = button.dataset.previewMode;
    sizeFullPreview();
  }));
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closePreview();
  });
  dialog.addEventListener('close', () => {
    document.body.style.overflow = '';
    fullFrame.removeAttribute('src'); activeDesign = null;
    if (opener?.isConnected) opener.focus();
  });
  window.addEventListener('resize', () => { sizeCardFrames(); sizeFullPreview(); });
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(sizeFullPreview).observe(fullWindow);
  const requested = new URLSearchParams(window.location.search).get('type') || window.location.hash.slice(1);
  const requestedDesign = designs.find(design => design.kind === requested || design.businessType === requested);
  if (requestedDesign) selectedType = requestedDesign.businessType;
  selector.value = selectedType;
  if (catalog?.sourceHash) document.getElementById('source-build').textContent = `Actual template build · ${String(catalog.sourceHash).slice(0, 12)}`;
  render();
})();
