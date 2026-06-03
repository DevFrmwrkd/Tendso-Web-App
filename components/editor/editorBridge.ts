/**
 * Editor-Bridge — runs INSIDE the iframe's static HTML.
 *
 * Two-way protocol between the static preview iframe and the React editor:
 *
 *   iframe → parent : { type: "ed:click", field: "hero.headline" }
 *     Sent when a user clicks any plain `[data-field]` element (text only —
 *     no link / image markers). Parent reacts by focusing the matching
 *     text input in the sidebar Content tab.
 *
 *   iframe → parent : { type: "ed:link-click", field, hrefField, platformField?, text, href, platform? }
 *     Sent when an `<a data-href-field="…">` is clicked. Parent opens a
 *     popover with Text + Link inputs (and a Platform dropdown if
 *     `platformField` is set). Always preventDefault so the link doesn't
 *     navigate inside the iframe.
 *
 *   iframe → parent : { type: "ed:image-click", field }
 *     Sent when an `[data-image-field]` is clicked. Parent opens the
 *     image picker modal which lists originals + AI-enhanced.
 *
 *   parent → iframe : { type: "ed:update", field, value }
 *     Generic text update. Bridge finds every `[data-field="X"]` and
 *     replaces its innerHTML.
 *
 *   parent → iframe : { type: "ed:image", field, src }
 *     Image swap. Bridge finds the `[data-image-field="X"]` element —
 *     if it's an <img>, swaps `src`; otherwise sets `background-image`.
 *
 *   parent → iframe : { type: "ed:link-update", field, hrefField, text?, href?, platformField?, platform? }
 *     Link update from the popover. Updates anchor text (if `text` given)
 *     and `href` (if `href` given). When a platformField is provided,
 *     also patches the visible platform label.
 *
 *   parent → iframe : { type: "ed:ready" }
 *     One-shot signal at iframe load. The bridge installs hover outlines
 *     + click handlers automatically — no enable message is required.
 *
 * The whole script is a single string so it can be injected into the
 * iframe srcDoc via string concatenation at the VisualEditor / preview
 * srcDoc-render step.
 */
export const EDITOR_BRIDGE_SCRIPT = `
<script>
(function () {
    if (window.__ed_bridge_installed) return;
    window.__ed_bridge_installed = true;

    // ── Editor-mode visual affordances ───────────────────────────────────
    var style = document.createElement('style');
    style.textContent = [
        '[data-field],[data-image-field]{position:relative;cursor:text;transition:outline .1s ease;}',
        '[data-image-field]{cursor:zoom-in;}',
        'a[data-href-field]{cursor:pointer;}',
        '[data-field]:hover,[data-image-field]:hover,a[data-href-field]:hover{outline:2px dashed rgba(59,130,246,.55);outline-offset:2px;}',
        '[data-field].ed-focused,[data-image-field].ed-focused,a[data-href-field].ed-focused{outline:2px solid rgba(59,130,246,.85);outline-offset:2px;}'
    ].join('');
    document.head.appendChild(style);

    function clearFocused() {
        document.querySelectorAll('.ed-focused').forEach(function (n) {
            n.classList.remove('ed-focused');
        });
    }
    function focusEl(el) {
        clearFocused();
        if (el) el.classList.add('ed-focused');
    }

    // ── Click handler — disambiguate link / image / text ─────────────────
    document.addEventListener('click', function (e) {
        var target = e.target;
        if (!target || !target.closest) return;

        // 1. Link click — highest priority. <a data-href-field> opens the
        //    link popover regardless of where on the link the user clicked.
        var linkEl = target.closest('a[data-href-field]');
        if (linkEl) {
            e.preventDefault();
            e.stopPropagation();
            focusEl(linkEl);
            try {
                window.parent.postMessage({
                    type: 'ed:link-click',
                    field: linkEl.getAttribute('data-field') || '',
                    hrefField: linkEl.getAttribute('data-href-field') || '',
                    platformField: linkEl.getAttribute('data-platform-field') || '',
                    text: (linkEl.textContent || '').trim(),
                    href: linkEl.getAttribute('href') || '',
                    platform: linkEl.getAttribute('data-platform-field')
                        ? (linkEl.textContent || '').trim()
                        : '',
                }, '*');
            } catch (err) {}
            return;
        }

        // 2. Image click — opens the image picker modal.
        var imgEl = target.closest('[data-image-field]');
        if (imgEl) {
            e.preventDefault();
            e.stopPropagation();
            focusEl(imgEl);
            try {
                window.parent.postMessage({
                    type: 'ed:image-click',
                    field: imgEl.getAttribute('data-image-field') || '',
                }, '*');
            } catch (err) {}
            return;
        }

        // 3. Plain text click — focus matching input.
        var textEl = target.closest('[data-field]');
        if (!textEl) return;
        e.preventDefault();
        e.stopPropagation();
        focusEl(textEl);
        try {
            window.parent.postMessage({
                type: 'ed:click',
                field: textEl.getAttribute('data-field') || '',
            }, '*');
        } catch (err) {}
    }, true);

    // ── Receiver ─────────────────────────────────────────────────────────
    window.addEventListener('message', function (e) {
        var msg = e && e.data;
        if (!msg || typeof msg !== 'object' || !msg.type) return;

        if (msg.type === 'ed:update') {
            var nodes = document.querySelectorAll('[data-field="' + cssEscape(msg.field) + '"]');
            nodes.forEach(function (n) {
                var safe = String(msg.value == null ? '' : msg.value).replace(/<\\/?(script|style)[^>]*>/gi, '');
                n.innerHTML = safe;
            });
            return;
        }

        if (msg.type === 'ed:image') {
            var holders = document.querySelectorAll('[data-image-field="' + cssEscape(msg.field) + '"]');
            holders.forEach(function (h) {
                var img = h.tagName === 'IMG' ? h : h.querySelector('img');
                if (img) {
                    img.src = msg.src;
                } else if (msg.src) {
                    h.style.backgroundImage = "url('" + String(msg.src).replace(/'/g, "%27") + "')";
                }
            });
            return;
        }

        if (msg.type === 'ed:link-update') {
            // Match the anchor by either its data-href-field OR data-field.
            // hrefField is the more reliable key for a link.
            var selector = msg.hrefField
                ? 'a[data-href-field="' + cssEscape(msg.hrefField) + '"]'
                : 'a[data-field="' + cssEscape(msg.field) + '"]';
            var anchors = document.querySelectorAll(selector);
            anchors.forEach(function (a) {
                if (typeof msg.text === 'string') {
                    // For platform links we want the visible label to
                    // mirror the platform name unless an explicit text
                    // override was supplied. We update textContent rather
                    // than innerHTML to preserve any wrapping <svg> icons
                    // already inside, but here the bridge only updates
                    // anchors whose direct text node is editable.
                    if (a.children.length === 0) {
                        a.textContent = msg.text;
                    } else {
                        // Find the first text-bearing node and replace it.
                        var replaced = false;
                        for (var i = 0; i < a.childNodes.length; i++) {
                            var c = a.childNodes[i];
                            if (c.nodeType === 3 && c.textContent.trim()) {
                                c.textContent = msg.text;
                                replaced = true;
                                break;
                            }
                        }
                        if (!replaced) a.textContent = msg.text;
                    }
                }
                if (typeof msg.href === 'string') a.setAttribute('href', msg.href);
            });
            return;
        }
    });

    function cssEscape(value) {
        if (window.CSS && typeof window.CSS.escape === 'function') {
            return window.CSS.escape(value);
        }
        return String(value).replace(/[^a-zA-Z0-9_-]/g, function (m) {
            return '\\\\' + m;
        });
    }

    // ── Selection-to-field highlight ─────────────────────────────────────
    // When the admin SELECTS text inside any [data-field] element (drag a
    // highlight, double-click a word) we tell the parent to highlight the
    // corresponding input in the sidebar Content tab. This is in addition
    // to the existing single-click handler — selection is a softer signal
    // that doesn't switch tabs, just scrolls the matching field into view.
    var lastSelectField = '';
    document.addEventListener('selectionchange', function () {
        var sel = document.getSelection();
        if (!sel || sel.isCollapsed) {
            if (lastSelectField) {
                lastSelectField = '';
                try { window.parent.postMessage({ type: 'ed:select-end' }, '*'); } catch (err) {}
            }
            return;
        }
        var anchor = sel.anchorNode;
        var el = anchor && (anchor.nodeType === 1 ? anchor : anchor.parentElement);
        if (!el || !el.closest) return;
        var field = el.closest('[data-field]');
        if (!field) return;
        var fieldName = field.getAttribute('data-field') || '';
        if (!fieldName || fieldName === lastSelectField) return;
        lastSelectField = fieldName;
        try {
            window.parent.postMessage({
                type: 'ed:select',
                field: fieldName,
                text: sel.toString(),
            }, '*');
        } catch (err) {}
    });

    try { window.parent.postMessage({ type: 'ed:ready' }, '*'); } catch (err) {}
})();
</script>
`;

/**
 * Inject the editor bridge into a full-page HTML string by inserting it
 * before the closing </body> tag. Falls back to appending if </body>
 * isn't present.
 */
export function injectEditorBridge(html: string): string {
    if (!html) return html;
    const idx = html.lastIndexOf('</body>');
    if (idx === -1) return html + EDITOR_BRIDGE_SCRIPT;
    return html.slice(0, idx) + EDITOR_BRIDGE_SCRIPT + html.slice(idx);
}
