#!/usr/bin/env node
/**
 * Build static template previews used by the SandboxEditor Template tab.
 *
 * Reads each source template from `templates/Generic Landing Pages for Local
 * business/` (letters a–e) and `templates/Barbershop/` (letters f–j) and
 * writes a sanitized copy to `public/template-previews/`.
 *
 * Sanitization:
 *  - Strips `<script src="image-slot.js">` (the custom-element host bridge
 *    doesn't exist outside the authoring environment).
 *  - Replaces every `<image-slot id="…" placeholder="…">` with a soft
 *    placeholder `<div>` so the preview still shows the section layout.
 *  - Removes the floating `<nav class="switcher">` (only relevant in the
 *    source-folder browser).
 *
 * Outputs:
 *   public/template-previews/a.html   ← Ironwood Coffee
 *   public/template-previews/b.html   ← Stillwater Studio
 *   public/template-previews/c.html   ← Cedar & Stone
 *   public/template-previews/d.html   ← Northpoint IT
 *   public/template-previews/e.html   ← Wash House
 *   public/template-previews/f.html   ← Forge (barbershop)
 *   public/template-previews/g.html   ← Forge Cinematic
 *   public/template-previews/h.html   ← Forge Kinetic
 *   public/template-previews/i.html   ← Forge Minimal
 *   public/template-previews/j.html   ← Forge Stacked
 *   public/template-previews/k–o.html ← SalonSpa (Atelier…Bloom)
 *   public/template-previews/p–t.html ← Autoshop (Foundry…Maple Street)
 *   public/template-previews/u–y.html ← Restaurant (Harvest…Garden)
 *   public/template-previews/z,aa–ad.html ← Shirtstore (Editorial…Kinetic)
 *
 * Run manually after editing a source template:
 *   node scripts/build-template-previews.mjs
 *
 * Or wire into a top-level build step if previews drift often.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const GENERIC_SOURCE_DIR = path.join(ROOT, 'templates', 'Generic Landing Pages for Local business');
const BARBERSHOP_SOURCE_DIR = path.join(ROOT, 'templates', 'Barbershop');
const SALONSPA_SOURCE_DIR = path.join(ROOT, 'templates', 'SalonSpa');
const AUTOSHOP_SOURCE_DIR = path.join(ROOT, 'templates', 'Autoshop');
const RESTAURANT_SOURCE_DIR = path.join(ROOT, 'templates', 'Restaurant');
const SHIRTSTORE_SOURCE_DIR = path.join(ROOT, 'templates', 'Shirt Store');
const OUT_DIR = path.join(ROOT, 'public', 'template-previews');

const TEMPLATES = [
    { letter: 'a', dir: GENERIC_SOURCE_DIR,    file: '01 Ironwood Coffee.html',   label: 'Ironwood Coffee'   },
    { letter: 'b', dir: GENERIC_SOURCE_DIR,    file: '02 Stillwater Studio.html', label: 'Stillwater Studio' },
    { letter: 'c', dir: GENERIC_SOURCE_DIR,    file: '03 Cedar & Stone.html',     label: 'Cedar & Stone'     },
    { letter: 'd', dir: GENERIC_SOURCE_DIR,    file: '04 Northpoint IT.html',     label: 'Northpoint IT'     },
    { letter: 'e', dir: GENERIC_SOURCE_DIR,    file: '05 Wash House.html',        label: 'Wash House'        },
    { letter: 'f', dir: BARBERSHOP_SOURCE_DIR, file: 'forge-barbershop.html',     label: 'Forge'             },
    { letter: 'g', dir: BARBERSHOP_SOURCE_DIR, file: 'forge-cinematic.html',      label: 'Forge Cinematic'   },
    { letter: 'h', dir: BARBERSHOP_SOURCE_DIR, file: 'forge-kinetic.html',        label: 'Forge Kinetic'     },
    { letter: 'i', dir: BARBERSHOP_SOURCE_DIR, file: 'forge-minimal.html',        label: 'Forge Minimal'     },
    { letter: 'j', dir: BARBERSHOP_SOURCE_DIR, file: 'forge-stacked.html',        label: 'Forge Stacked'     },
    { letter: 'k', dir: SALONSPA_SOURCE_DIR,   file: '01-Atelier.html',           label: 'Atelier'           },
    { letter: 'l', dir: SALONSPA_SOURCE_DIR,   file: '02-Botanica.html',          label: 'Botanica'          },
    { letter: 'm', dir: SALONSPA_SOURCE_DIR,   file: '03-Clinic.html',            label: 'Clinic'            },
    { letter: 'n', dir: SALONSPA_SOURCE_DIR,   file: '04-Vogue.html',             label: 'Vogue'             },
    { letter: 'o', dir: SALONSPA_SOURCE_DIR,   file: '05-Bloom.html',             label: 'Bloom'             },
    { letter: 'p', dir: AUTOSHOP_SOURCE_DIR,   file: '01-foundry.html',           label: 'Foundry'           },
    { letter: 'q', dir: AUTOSHOP_SOURCE_DIR,   file: '02-meridian.html',          label: 'Meridian'          },
    { letter: 'r', dir: AUTOSHOP_SOURCE_DIR,   file: '03-volt.html',              label: 'Volt'              },
    { letter: 's', dir: AUTOSHOP_SOURCE_DIR,   file: '04-redline.html',           label: 'Redline'           },
    { letter: 't', dir: AUTOSHOP_SOURCE_DIR,   file: '05-maple-street.html',      label: 'Maple Street'      },
    { letter: 'u', dir: RESTAURANT_SOURCE_DIR, file: '01 - Harvest (Rustic).html',   label: 'Harvest'        },
    { letter: 'v', dir: RESTAURANT_SOURCE_DIR, file: '02 - Atelier (Minimal).html',  label: 'Atelier'        },
    { letter: 'w', dir: RESTAURANT_SOURCE_DIR, file: '03 - Press (Bold).html',       label: 'Press'          },
    { letter: 'x', dir: RESTAURANT_SOURCE_DIR, file: '04 - Ember (Cinematic).html',  label: 'Ember'          },
    { letter: 'y', dir: RESTAURANT_SOURCE_DIR, file: '05 - Garden (Playful).html',   label: 'Garden'         },
    { letter: 'z',  dir: SHIRTSTORE_SOURCE_DIR, file: '01 Editorial.html',         label: 'Editorial'         },
    { letter: 'aa', dir: SHIRTSTORE_SOURCE_DIR, file: '02 Streetwear.html',        label: 'Streetwear'        },
    { letter: 'ab', dir: SHIRTSTORE_SOURCE_DIR, file: '03 Artisan.html',           label: 'Artisan'           },
    { letter: 'ac', dir: SHIRTSTORE_SOURCE_DIR, file: '04 Modern.html',            label: 'Modern'            },
    { letter: 'ad', dir: SHIRTSTORE_SOURCE_DIR, file: '05 Kinetic.html',           label: 'Kinetic'           },
];

function sanitize(html, label) {
    let out = html;

    // 1. Remove the script tag that loads image-slot.js.
    out = out.replace(/<script\s+src=["']image-slot\.js["'][^>]*><\/script>\s*/gi, '');

    // 2. Replace <image-slot …></image-slot> with a placeholder div that
    //    fills its parent's slot. We preserve the placeholder text so the
    //    admin can still see what was meant to go there.
    out = out.replace(
        /<image-slot\b([^>]*)>\s*<\/image-slot>/gi,
        (_match, attrs) => {
            const phMatch = /placeholder=["']([^"']+)["']/i.exec(attrs);
            const placeholder = phMatch ? phMatch[1] : 'Image';
            return (
                '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;' +
                'background:linear-gradient(135deg,#e2e8f0,#cbd5e1);color:#475569;font-family:ui-monospace,monospace;' +
                'font-size:11px;letter-spacing:.06em;text-transform:uppercase;padding:8px;text-align:center;">' +
                placeholder +
                '</div>'
            );
        },
    );

    // 3. Strip the floating switcher nav.
    out = out.replace(/<nav\s+class=["']switcher["'][\s\S]*?<\/nav>/i, '');

    // 4. Drop the floating CTA so previews aren't littered with absolute UI.
    out = out.replace(/<div\s+class=["']float-cta["'][\s\S]*?<\/div>\s*<\/div>/i, '');

    // 5. Mark the document as a preview so we never accidentally serve it
    //    as a real submission. (Comment only — no behaviour change.)
    out = out.replace('<head>', `<head>\n  <!-- preview: ${label} (autogenerated) -->`);

    return out;
}

async function main() {
    await fs.mkdir(OUT_DIR, { recursive: true });
    let total = 0;
    for (const tpl of TEMPLATES) {
        const src = path.join(tpl.dir, tpl.file);
        const dest = path.join(OUT_DIR, `${tpl.letter}.html`);
        try {
            const html = await fs.readFile(src, 'utf-8');
            const sanitized = sanitize(html, tpl.label);
            await fs.writeFile(dest, sanitized, 'utf-8');
            console.log(`  ✓ ${tpl.letter}.html  (${tpl.label})  ${(sanitized.length / 1024).toFixed(1)} KB`);
            total++;
        } catch (err) {
            console.error(`  ✗ ${tpl.letter}.html — ${err.message}`);
        }
    }
    console.log(`\nWrote ${total}/${TEMPLATES.length} previews to ${path.relative(ROOT, OUT_DIR)}/`);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
