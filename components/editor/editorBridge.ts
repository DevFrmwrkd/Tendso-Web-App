/**
 * Editor-Bridge — runs INSIDE the iframe's static HTML.
 *
 * Two-way protocol between the static preview iframe and the React editor:
 *
 *   iframe → parent : { type: "ed:click", field: "hero.headline" }
 *     Sent when a user clicks any [data-field] element in the preview.
 *     Parent reacts by scrolling the matching <input data-field="X"> into
 *     view and focusing it.
 *
 *   parent → iframe : { type: "ed:update", field: "hero.headline", value: "…" }
 *     Sent when an input in the sidebar changes. The bridge finds every
 *     [data-field="X"] element and updates its content. No iframe reload.
 *
 *   parent → iframe : { type: "ed:image", field: "hero.image", src: "https://…" }
 *     Sent when an image picker resolves a new URL. The bridge finds the
 *     first <img> inside [data-field="X"] and swaps its src.
 *
 *   parent → iframe : { type: "ed:enable" }
 *     One-shot signal at iframe load. The bridge installs hover outlines +
 *     click handlers. Sent on every iframe `load` event from the parent.
 *
 * The whole script is a single string so it can be injected into the
 * iframe srcDoc via string concatenation in lib/astro-builder or at the
 * VisualEditor srcDoc-render step.
 */
export const EDITOR_BRIDGE_SCRIPT = `
<script>
(function () {
    if (window.__ed_bridge_installed) return;
    window.__ed_bridge_installed = true;

    // ── Editor-mode visual affordances ───────────────────────────────────
    var style = document.createElement('style');
    style.textContent = [
        '[data-field]{position:relative;cursor:text;transition:outline .1s ease;}',
        '[data-field]:hover{outline:2px dashed rgba(59,130,246,.5);outline-offset:2px;}',
        '[data-field].ed-focused{outline:2px solid rgba(59,130,246,.85);outline-offset:2px;}',
        // Hide block markers that the iframe occasionally renders during
        // the very first paint while CSS is still being parsed.
        '.ed-field-tip{position:absolute;top:-22px;left:0;background:#2563eb;color:#fff;font:600 10px/1 ui-sans-serif,system-ui,sans-serif;padding:3px 6px;border-radius:3px;letter-spacing:.04em;text-transform:uppercase;z-index:99999;pointer-events:none;white-space:nowrap;opacity:0;transition:opacity .12s ease;}',
        '[data-field]:hover > .ed-field-tip,[data-field].ed-focused > .ed-field-tip{opacity:1;}'
    ].join('');
    document.head.appendChild(style);

    // ── Click handler: emit { type: ed:click, field } to parent ─────────
    document.addEventListener('click', function (e) {
        var target = e.target;
        if (!target || !target.closest) return;
        var el = target.closest('[data-field]');
        if (!el) return;
        // Stop the click from following any anchor href etc.
        e.preventDefault();
        e.stopPropagation();
        var field = el.getAttribute('data-field');
        // Briefly mark the element so the user sees confirmation.
        document.querySelectorAll('[data-field].ed-focused').forEach(function (n) {
            n.classList.remove('ed-focused');
        });
        el.classList.add('ed-focused');
        try {
            window.parent.postMessage({ type: 'ed:click', field: field }, '*');
        } catch (err) {}
    }, true);

    // ── Receiver: { type: ed:update, field, value } / { ed:image, src } ──
    window.addEventListener('message', function (e) {
        var msg = e && e.data;
        if (!msg || typeof msg !== 'object' || !msg.type) return;

        if (msg.type === 'ed:update') {
            var nodes = document.querySelectorAll('[data-field="' + cssEscape(msg.field) + '"]');
            nodes.forEach(function (n) {
                // Prefer innerHTML so multi-line values keep paragraph breaks.
                // Strip script/style as a safety net (text inputs shouldn't contain them).
                var safe = String(msg.value == null ? '' : msg.value).replace(/<\\/?(script|style)[^>]*>/gi, '');
                n.innerHTML = safe;
            });
            return;
        }

        if (msg.type === 'ed:image') {
            var holders = document.querySelectorAll('[data-field="' + cssEscape(msg.field) + '"]');
            holders.forEach(function (h) {
                var img = h.tagName === 'IMG' ? h : h.querySelector('img');
                if (img) {
                    img.src = msg.src;
                } else if (msg.src) {
                    // Element uses background-image — set inline style.
                    h.style.backgroundImage = 'url(' + msg.src + ')';
                }
            });
            return;
        }
    });

    // Minimal CSS.escape polyfill — required because not every static-HTML
    // output bundle includes it (older Astro builds, Cloudflare Pages).
    function cssEscape(value) {
        if (window.CSS && typeof window.CSS.escape === 'function') {
            return window.CSS.escape(value);
        }
        return String(value).replace(/[^a-zA-Z0-9_-]/g, function (m) {
            return '\\\\' + m;
        });
    }

    // Inform the parent that the bridge is ready (lets parent skip retries).
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
