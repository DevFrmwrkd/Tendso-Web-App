/**
 * Carry the curated samples' phone fixes with the native app while hosted previews
 * catch up. Keep these rules identical to their authoring/public HTML (tested).
 * They apply to sample documents only, never generated or live owner websites.
 */
const CAPTURE_PREVIEW_CSS: Readonly<Record<string, string>> = {
  'barbershop:I': `
@media (max-width:520px){
  .about-media .stamp{width:96px;height:96px;right:-8px;bottom:-14px;}
  .about-media .stamp .y{font-size:26px;}
}
@media(max-width:760px){
  .heroM{padding-top:116px;}
  .heroM-title{font-size:clamp(52px,15vw,120px);}
  .h-sect,.cta-band .h-sect{font-size:clamp(34px,8.5vw,60px);}
}
@media(max-width:520px){
  .heroM{padding-top:104px;}
  .heroM-title{font-size:clamp(36px,12vw,56px);}
  .heroM-eyebrow{font-size:clamp(18px,5vw,24px);}
  .h-sect,.cta-band .h-sect{font-size:clamp(30px,9vw,44px);}
}`,
  'salonspa:L': `
@media(max-width:520px){.cred-grid{grid-template-columns:minmax(0,1fr)}.cred-card{min-width:0}}`,
  'salonspa:N': `
@media(max-width:520px){
  .wrap{padding-inline:18px}
  .nav{height:auto;min-height:74px;gap:12px;flex-wrap:wrap;padding-block:12px}
  .logo{font-size:26px;gap:6px}
  .logo i{font-size:8px;letter-spacing:.12em;padding:4px 5px}
  .navtail{min-width:0}
  .navtail .btn{font-size:12px;padding-inline:18px;white-space:normal;text-align:center;justify-content:center;min-height:44px}
}
@media(max-width:760px){.bignum .grid{grid-template-columns:repeat(2,minmax(0,1fr))}.bignum .cell{min-width:0;padding:28px 18px;overflow-wrap:anywhere}.bignum .cell b{font-size:clamp(34px,7vw,52px)}.bignum .cell:nth-child(3){border-left:none}}`,
  'generic:C': `
@media(max-width:760px){
  .wrap{padding-inline:20px;}
  .sec{padding:66px 0;}
  .sec h2{font-size:clamp(30px,8vw,56px);}
  .trust-row{grid-template-columns:minmax(0,1fr);gap:14px;}
  .tblock{padding:22px;display:flex;align-items:baseline;gap:16px;}
  .tblock .num{font-size:44px;}
  .tblock .lbl{margin-top:0;}
  .about-stats{gap:28px;margin-top:26px;}
  .about-stats .s .n{font-size:40px;}
  .brow .bt{white-space:normal;}
  .foot-grid{grid-template-columns:minmax(0,1fr);gap:30px;}
}
@media(max-width:520px){
  .wrap{padding-inline:16px;}
  .sec{padding:52px 0;}
  .sec h2{font-size:clamp(26px,8.6vw,42px);}
  .nav-in{height:auto;min-height:76px;flex-wrap:wrap;gap:12px;padding-block:12px;}
  .hero .hero-in{padding:0 16px 44px;}
  .hero h1{font-size:clamp(33px,12vw,60px);}
  .hero-cta{flex-direction:column;align-items:stretch;}
  .hero-cta .btn{width:100%;justify-content:center;}
  .about-stats{flex-wrap:wrap;gap:22px 30px;}
  .area-cols{columns:1;}
  .cred-grid{grid-template-columns:minmax(0,1fr);}
  .cta-band h2{font-size:clamp(30px,11vw,54px);}
  .cta-band .btn{width:100%;justify-content:center;}
}`,
};

/** Only explicitly supported canonical codes receive sample-specific overrides. */
export function capturePreviewCss(code: unknown): string {
  return typeof code === 'string' && Object.prototype.hasOwnProperty.call(CAPTURE_PREVIEW_CSS, code)
    ? CAPTURE_PREVIEW_CSS[code] : '';
}
