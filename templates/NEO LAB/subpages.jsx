// subpages.jsx — For Business / For Creators sub-page composition.
const { useState: useStateP, useEffect: useEffectP } = React;

// ── Back top bar (sub-pages) ─────────────────────────────────────────────────
function BackTopBar({ kind, lang, country, onLangChange, onCountryChange }) {
  const label = kind === "business" ? "For business owners" : "For creators";
  const accent = kind === "business" ? "var(--business)" : "var(--creator)";
  return (
    <div className="topbar">
      <div className="container-wide" style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "14px 48px",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <a href="Negosyo Landing.html" style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--ink)", textDecoration: "none" }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M9 1 L3 7 L9 13" stroke="currentColor" strokeWidth="1.4" />
            </svg>
            <window.Logo />
          </a>
          <span style={{ height: 18, width: 1, background: "var(--rule)" }}></span>
          <span className="label" style={{ display: "flex", alignItems: "center", gap: 8, color: accent }}>
            {kind === "business" ? <window.Square color={accent} /> : <window.Dot color={accent} />}
            {label}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <select value={lang} onChange={(e)=>onLangChange(e.target.value)} style={selectStyleP()}>
            <option value="en">EN</option>
            <option value="tl">Tagalog</option>
          </select>
          <select value={country} onChange={(e)=>onCountryChange(e.target.value)} style={selectStyleP()}>
            <option value="PH">🇵🇭 Philippines</option>
            <option value="ID">🇮🇩 Indonesia</option>
            <option value="MX">🇲🇽 Mexico</option>
            <option value="VN">🇻🇳 Vietnam</option>
          </select>
          <button className="store-btn">Get the app <span style={{ opacity: .6 }}>↗</span></button>
        </div>
      </div>
    </div>
  );
}
function selectStyleP() {
  return {
    appearance: "none", border: "1px solid var(--rule)",
    background: "var(--paper-3)", color: "var(--ink)",
    padding: "8px 12px", fontFamily: "var(--mono)", fontSize: 11,
    letterSpacing: ".08em", textTransform: "uppercase", cursor: "default",
    borderRadius: "var(--r-pill)",
  };
}

// ── BUSINESS sub-page hero ──────────────────────────────────────────────────
function BusinessHero() {
  return (
    <section style={{ paddingTop: 80, paddingBottom: 48 }}>
      <div className="container-wide">
        <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 64, alignItems: "end" }}>
          <div>
            <div className="eyebrow" style={{ marginBottom: 24, display: "inline-flex", alignItems: "center", gap: 10, padding: "6px 14px", border: "1px solid var(--rule)", borderRadius: "var(--r-pill)", background: "var(--paper-3)" }}>
              <window.Square color="var(--business)" />
              For business owners
            </div>
            <h1 className="display" style={{ fontSize: "clamp(56px, 7.5vw, 120px)" }}>
              Your shop. <em style={{ fontStyle: "italic" }}>Online by Sunday.</em>
            </h1>
            <p className="lede" style={{ marginTop: 28, fontSize: 19, maxWidth: "56ch" }}>
              A trained creator visits your shop with a phone and a checklist. You answer questions about your business. They shoot, write, build, and publish. You approve. You pay. That's the entire process.
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginTop: 40, maxWidth: 720 }}>
              <PromiseBeat n="01" big="30 min" sub="Interview, in your shop" />
              <PromiseBeat n="02" big="72 hr" sub="From visit to live site" />
              <PromiseBeat n="03" big="0" sub="Times you touch a keyboard" highlight />
            </div>
          </div>

          <div className="surface" style={{ padding: 24 }}>
            <div className="label" style={{ marginBottom: 16 }}>What lands in your hands</div>
            {[
              "A live website on your own domain",
              "World-class photography of your shop",
              "Written copy — your story, told properly",
              "Hosting + SSL — first year included",
              "Small edits free for a year",
              "You own it all. Take it anywhere.",
            ].map((s, i) => (
              <div key={i} style={{
                display: "flex", alignItems: "baseline", gap: 12,
                padding: "10px 0",
                borderTop: i === 0 ? "1px solid var(--rule)" : "1px solid var(--rule)",
                fontSize: 14,
              }}>
                <span className="mono" style={{ fontSize: 10, color: "var(--ink-3)", flexShrink: 0 }}>0{i+1}</span>
                <span>{s}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function PromiseBeat({ n, big, sub, highlight }) {
  return (
    <div style={{
      padding: 20,
      background: highlight ? "var(--ink)" : "var(--paper-3)",
      color: highlight ? "var(--paper)" : "var(--ink)",
      border: "1px solid " + (highlight ? "var(--ink)" : "var(--rule)"),
      borderRadius: "var(--r-md)",
    }}>
      <div className="label" style={{ marginBottom: 8, color: highlight ? "oklch(72% 0.008 85)" : undefined }}>{n}</div>
      <div className="counter-num" style={{ fontSize: 36, lineHeight: 1.0, marginBottom: 8 }}>{big}</div>
      <div style={{ fontSize: 12, color: highlight ? "oklch(80% 0.008 85)" : "var(--ink-3)" }}>{sub}</div>
    </div>
  );
}

// ── BUSINESS · Live examples (3 big sites) ──────────────────────────────────
function BusinessExamples() {
  const picks = window.BUSINESSES.slice(0, 3);
  return (
    <section style={{ background: "var(--paper-2)" }}>
      <div className="container-wide">
        <div className="sect-h">
          <div className="eyebrow">§ Real sites</div>
          <div>
            <h2 className="display-2">Three live sites. <em>Tap any to visit.</em></h2>
            <p className="lede" style={{ marginTop: 12 }}>
              Real Filipino businesses on real domains. Each one was photographed, written, and built by a Negosyo creator. The screenshot is the proof — the live link is the real one.
            </p>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 20 }}>
          {picks.map(b => {
            const c = window.CREATORS.find(c => c.id === b.creator);
            return (
              <a key={b.id} href="#" className="lift card" style={{ background: "var(--paper-3)", padding: 0, textDecoration: "none", color: "inherit", overflow: "hidden" }}>
                <div className="stripes" style={{ aspectRatio: "4/3", position: "relative", borderBottom: "1px solid var(--rule)" }}>
                  <div style={{
                    position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
                    fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink-3)",
                    letterSpacing: ".08em", textTransform: "uppercase",
                  }}>{b.name.toLowerCase().replace(/[^a-z]/g, "")}.ph</div>
                  <div style={{
                    position: "absolute", top: 12, right: 12,
                    padding: "5px 10px",
                    background: "var(--paper-3)", border: "1px solid var(--rule)",
                    borderRadius: "var(--r-pill)",
                    fontFamily: "var(--mono)", fontSize: 10, letterSpacing: ".1em", textTransform: "uppercase",
                  }}>Live ↗</div>
                </div>
                <div style={{ padding: 20 }}>
                  <div style={{ fontFamily: "var(--serif)", fontSize: 24, lineHeight: 1.15 }}>{b.name}</div>
                  <div className="label" style={{ marginTop: 6 }}>{b.category} · {b.city}</div>
                  <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--rule)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 12, color: "var(--ink-3)" }}>built by <strong style={{ color: "var(--ink)" }}>{c?.name}</strong></span>
                    <span className="label" style={{ color: "var(--business)" }}>Visit →</span>
                  </div>
                </div>
              </a>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ── BUSINESS · Pricing card (the one place price lives prominently) ─────────
function BusinessPricing({ country }) {
  const pricing = window.PRICING[country] || window.PRICING.PH;
  return (
    <section>
      <div className="container-wide">
        <div className="sect-h">
          <div className="eyebrow">§ The number</div>
          <div>
            <h2 className="display-2">One price. <em>Then you own it.</em></h2>
            <p className="lede" style={{ marginTop: 12 }}>
              No subscription, no upsell, no fine print. You pay once, when the site goes live. Hosting and small edits for the first year are included.
            </p>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 32 }}>
          <div className="card" style={{ padding: 40, background: "var(--ink)", color: "var(--paper)", border: "1px solid var(--ink)" }}>
            <div className="label" style={{ color: "oklch(72% 0.008 85)", marginBottom: 16 }}>The whole thing</div>
            <div className="counter-num" style={{ fontSize: 120, lineHeight: 0.95, letterSpacing: "-.03em" }}>
              {pricing.currency}{pricing.site_total.toLocaleString()}
            </div>
            <div style={{ marginTop: 16, color: "oklch(80% 0.008 85)", maxWidth: "44ch", fontSize: 15, lineHeight: 1.55 }}>
              One-time. Paid only after the site is live and you've approved it. No card on file before then.
            </div>
            {pricing.soon && (
              <div style={{ marginTop: 24, padding: "12px 16px", background: "oklch(30% 0.015 260)", borderRadius: "var(--r-sm)", fontSize: 13, color: "oklch(80% 0.008 85)" }}>
                We're not live in your country yet. PH pricing shown as reference.
              </div>
            )}
            <div style={{ marginTop: 32, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, paddingTop: 24, borderTop: "1px solid oklch(40% 0.015 260)" }}>
              <PriceLine k="Year 1 hosting" v="Included" />
              <PriceLine k="Domain registration" v="Included" />
              <PriceLine k="Photography session" v="Included" />
              <PriceLine k="Copywriting" v="Included" />
              <PriceLine k="Small edits, first year" v="Free" />
              <PriceLine k="Year 2+ hosting" v="₱150/mo" />
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div className="card" style={{ padding: 24 }}>
              <div className="label" style={{ marginBottom: 8 }}>How payment works</div>
              <p style={{ fontSize: 14, color: "var(--ink-2)", lineHeight: 1.55, margin: 0 }}>
                You see the draft site. You approve it. Then — and only then — we charge. GCash, Maya, or bank transfer.
              </p>
            </div>
            <div className="card" style={{ padding: 24 }}>
              <div className="label" style={{ marginBottom: 8 }}>If you don't like it</div>
              <p style={{ fontSize: 14, color: "var(--ink-2)", lineHeight: 1.55, margin: 0 }}>
                Reject the draft. The creator revises once, free. Then it's yours, or it's nothing. You don't pay for a site you don't keep.
              </p>
            </div>
            <a href="Negosyo Landing.html#map-anchor" className="door door-business" style={{ justifyContent: "space-between", textDecoration: "none" }}>
              <span>Find a creator near me</span>
              <span className="arrow">↗</span>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

function PriceLine({ k, v }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
      <span style={{ fontSize: 13, color: "oklch(72% 0.008 85)" }}>{k}</span>
      <span style={{ fontFamily: "var(--mono)", fontSize: 13, color: "var(--paper)" }}>{v}</span>
    </div>
  );
}

// ── BUSINESS · How it works (vertical) ──────────────────────────────────────
function BusinessSteps() {
  const steps = [
    { n: "01", h: "Download the app", sub: "No form on the web. The app store deep link is one tap from the button below." },
    { n: "02", h: "Pick a creator nearby", sub: "Browse the creators within 10 km of your shop. Or let one find you — they'll reach out from the app." },
    { n: "03", h: "Sit for a 30-minute interview", sub: "Your shop, your coffee. The creator asks, photographs, writes. You don't prepare anything." },
    { n: "04", h: "Approve. Pay. Done.", sub: "You see the draft. You approve it. We charge ₱1,000. The site is live within 24 hours of approval." },
  ];
  return (
    <section style={{ background: "var(--paper-2)" }}>
      <div className="container-wide">
        <div className="sect-h">
          <div className="eyebrow">§ The four steps</div>
          <div>
            <h2 className="display-2">From this page to live. <em>Four steps.</em></h2>
          </div>
        </div>
        <div className="surface">
          {steps.map((s, i) => (
            <div key={s.n} style={{
              display: "grid",
              gridTemplateColumns: "80px 1fr 1fr",
              gap: 32,
              padding: "32px 36px",
              borderTop: i === 0 ? "none" : "1px solid var(--rule)",
              alignItems: "baseline",
            }}>
              <div className="counter-num" style={{ fontSize: 36, color: "var(--business)" }}>{s.n}</div>
              <div className="serif" style={{ fontSize: 28, lineHeight: 1.15, letterSpacing: "-.015em" }}>{s.h}</div>
              <div style={{ fontSize: 14, color: "var(--ink-2)", lineHeight: 1.55 }}>{s.sub}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── BUSINESS FAQ (only business questions) ──────────────────────────────────
function BusinessFAQ() {
  const [open, setOpen] = useStateP(0);
  return (
    <section>
      <div className="container-wide">
        <div className="sect-h">
          <div className="eyebrow">§ Questions</div>
          <div>
            <h2 className="display-2">Things <em>worth asking.</em></h2>
          </div>
        </div>
        <div style={{ maxWidth: 880, margin: "0 auto", borderTop: "1px solid var(--rule-strong)" }}>
          {window.FAQ_BUSINESS.map((qa, i) => (
            <div key={i} style={{ borderBottom: "1px solid var(--rule)" }}>
              <button
                onClick={()=>setOpen(open === i ? -1 : i)}
                style={{
                  width: "100%", textAlign: "left", padding: "24px 0",
                  display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 24,
                  border: 0, background: "transparent", color: "var(--ink)", cursor: "default",
                }}
              >
                <span style={{ fontFamily: "var(--serif)", fontSize: 26, lineHeight: 1.25 }}>{qa.q}</span>
                <span style={{ fontFamily: "var(--mono)", fontSize: 16, transform: open===i ? "rotate(45deg)" : "rotate(0)", transition: "transform .2s ease", color: "var(--ink-3)" }}>+</span>
              </button>
              {open === i && (
                <p style={{ margin: 0, paddingBottom: 24, paddingRight: 60, fontSize: 16, color: "var(--ink-2)", lineHeight: 1.6 }}>{qa.a}</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── BUSINESS final CTA ──────────────────────────────────────────────────────
function BusinessFinal() {
  return (
    <section style={{ background: "var(--business)", color: "var(--paper)", padding: "120px 0" }}>
      <div className="container-wide">
        <div style={{ textAlign: "center" }}>
          <div className="eyebrow" style={{ marginBottom: 24, color: "oklch(90% 0.04 240)" }}>Get the app</div>
          <h2 className="display" style={{ fontSize: "clamp(56px, 8vw, 128px)", color: "var(--paper)" }}>
            Your shop, <em style={{ fontStyle: "italic", color: "oklch(85% 0.10 240)" }}>finally online</em>.
          </h2>
          <p className="lede" style={{ marginTop: 32, color: "oklch(85% 0.04 240)", maxWidth: "50ch", margin: "32px auto 40px", fontSize: 18 }}>
            One tap. The app store opens. A creator near you sees your shop's pin within the hour.
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <button className="door" style={{ background: "var(--paper)", color: "var(--ink)", border: 0, padding: "20px 28px" }}>
              <span>📱</span>
              <span>
                <span className="meta" style={{ opacity: .6 }}>Download on the</span>
                App Store
              </span>
            </button>
            <button className="door" style={{ background: "var(--paper)", color: "var(--ink)", border: 0, padding: "20px 28px" }}>
              <span>▶</span>
              <span>
                <span className="meta" style={{ opacity: .6 }}>Get it on</span>
                Google Play
              </span>
            </button>
          </div>
          <div style={{ marginTop: 32 }}>
            <a href="Negosyo Landing.html" style={{ color: "oklch(85% 0.04 240)", textDecoration: "none", fontSize: 13, borderBottom: "1px solid currentColor", paddingBottom: 2 }}>
              ← Back to the main page
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── BUSINESS app shell ──────────────────────────────────────────────────────
function BusinessApp() {
  const [t, setTweak] = useTweaks({
    "theme": "bright",
    "lang": "en",
    "country": "PH",
  });
  useEffectP(() => { document.documentElement.dataset.theme = t.theme; }, [t.theme]);

  return (
    <>
      <BackTopBar
        kind="business"
        lang={t.lang} country={t.country}
        onLangChange={(v)=>setTweak("lang", v)}
        onCountryChange={(v)=>setTweak("country", v)}
      />
      <BusinessHero />
      <BusinessExamples />
      <BusinessSteps />
      <BusinessPricing country={t.country} />
      <BusinessFAQ />
      <BusinessFinal />
      <window.Footer
        lang={t.lang} country={t.country}
        onLangChange={(v)=>setTweak("lang", v)}
        onCountryChange={(v)=>setTweak("country", v)}
      />
      <window.ChatBot />

      <TweaksPanel title="Tweaks">
        <TweakSection label="Theme" />
        <TweakRadio label="Mode" value={t.theme} options={["bright", "ink"]} onChange={(v)=>setTweak("theme", v)} />
        <TweakSection label="Locale" />
        <TweakRadio label="Language" value={t.lang} options={["en", "tl"]} onChange={(v)=>setTweak("lang", v)} />
        <TweakSelect label="Country" value={t.country} options={["PH", "ID", "MX", "VN"]} onChange={(v)=>setTweak("country", v)} />
      </TweaksPanel>
    </>
  );
}

// ── CREATOR sub-page hero ──────────────────────────────────────────────────
function CreatorHero() {
  return (
    <section style={{ paddingTop: 80, paddingBottom: 48 }}>
      <div className="container-wide">
        <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 64, alignItems: "end" }}>
          <div>
            <div className="eyebrow" style={{ marginBottom: 24, display: "inline-flex", alignItems: "center", gap: 10, padding: "6px 14px", border: "1px solid var(--rule)", borderRadius: "var(--r-pill)", background: "var(--paper-3)" }}>
              <window.Dot color="var(--creator)" />
              For creators
            </div>
            <h1 className="display" style={{ fontSize: "clamp(56px, 7.5vw, 120px)" }}>
              Earn from <em style={{ fontStyle: "italic", color: "var(--creator)" }}>every shop</em> on your block.
            </h1>
            <p className="lede" style={{ marginTop: 28, fontSize: 19, maxWidth: "56ch" }}>
              More than <strong>99%</strong> of businesses in the Philippines aren’t online yet. You walk in with a phone. You leave with ₱500 in your GCash. Refer a friend, earn another ₱500. The app does the rest.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginTop: 40, maxWidth: 720 }}>
              <PromiseBeat n="₱" big="₱500" sub="Per site delivered" />
              <PromiseBeat n="↗" big="₱500" sub="Per friend referred" highlight />
              <PromiseBeat n="⏱" big="48 hr" sub="Payout to GCash" />
            </div>
          </div>

          <div className="surface" style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--rule)" }}>
              <div className="label" style={{ marginBottom: 8 }}>What you need</div>
              <div style={{ fontSize: 14, color: "var(--ink-2)" }}>A recent smartphone, a valid ID, and a willingness to walk into shops.</div>
            </div>
            <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--rule)" }}>
              <div className="label" style={{ marginBottom: 8 }}>What you don't need</div>
              <div style={{ fontSize: 14, color: "var(--ink-2)" }}>Design skill. Code. English fluency. A laptop. A studio. A network.</div>
            </div>
            <div style={{ padding: "20px 24px", background: "var(--creator-bg)", color: "var(--creator-ink)" }}>
              <div className="label" style={{ marginBottom: 8, color: "var(--creator-ink)" }}>Time to first payout</div>
              <div style={{ fontFamily: "var(--serif)", fontSize: 32, lineHeight: 1, letterSpacing: "-.015em" }}>One week, typical.</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── CREATOR final CTA ───────────────────────────────────────────────────────
function CreatorFinal() {
  return (
    <section style={{ background: "var(--creator)", color: "white", padding: "120px 0" }}>
      <div className="container-wide">
        <div style={{ textAlign: "center" }}>
          <div className="eyebrow" style={{ marginBottom: 24, color: "oklch(95% 0.04 35)" }}>Get the app · apply this week</div>
          <h2 className="display" style={{ fontSize: "clamp(56px, 8vw, 128px)", color: "white" }}>
            Start <em style={{ fontStyle: "italic", color: "oklch(95% 0.05 35)" }}>this week</em>.
          </h2>
          <p className="lede" style={{ marginTop: 32, color: "oklch(95% 0.03 35)", maxWidth: "50ch", margin: "32px auto 40px", fontSize: 18 }}>
            Twenty minutes to certified. Same-day first booking. Forty-eight hours to your first payout.
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <button className="door" style={{ background: "var(--ink)", color: "var(--paper)", border: 0, padding: "20px 28px" }}>
              <span>📱</span>
              <span>
                <span className="meta" style={{ opacity: .6 }}>Download on the</span>
                App Store
              </span>
            </button>
            <button className="door" style={{ background: "var(--ink)", color: "var(--paper)", border: 0, padding: "20px 28px" }}>
              <span>▶</span>
              <span>
                <span className="meta" style={{ opacity: .6 }}>Get it on</span>
                Google Play
              </span>
            </button>
          </div>
          <div style={{ marginTop: 32 }}>
            <a href="Negosyo Landing.html" style={{ color: "oklch(95% 0.03 35)", textDecoration: "none", fontSize: 13, borderBottom: "1px solid currentColor", paddingBottom: 2 }}>
              ← Back to the main page
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── CREATOR FAQ ─────────────────────────────────────────────────────────────
function CreatorFAQ() {
  const [open, setOpen] = useStateP(0);
  return (
    <section>
      <div className="container-wide">
        <div className="sect-h">
          <div className="eyebrow">§ Questions</div>
          <div>
            <h2 className="display-2">Things <em>worth asking.</em></h2>
          </div>
        </div>
        <div style={{ maxWidth: 880, margin: "0 auto", borderTop: "1px solid var(--rule-strong)" }}>
          {window.FAQ_CREATOR.map((qa, i) => (
            <div key={i} style={{ borderBottom: "1px solid var(--rule)" }}>
              <button
                onClick={()=>setOpen(open === i ? -1 : i)}
                style={{
                  width: "100%", textAlign: "left", padding: "24px 0",
                  display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 24,
                  border: 0, background: "transparent", color: "var(--ink)", cursor: "default",
                }}
              >
                <span style={{ fontFamily: "var(--serif)", fontSize: 26, lineHeight: 1.25 }}>{qa.q}</span>
                <span style={{ fontFamily: "var(--mono)", fontSize: 16, transform: open===i ? "rotate(45deg)" : "rotate(0)", transition: "transform .2s ease", color: "var(--ink-3)" }}>+</span>
              </button>
              {open === i && (
                <p style={{ margin: 0, paddingBottom: 24, paddingRight: 60, fontSize: 16, color: "var(--ink-2)", lineHeight: 1.6 }}>{qa.a}</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── CREATOR app shell ───────────────────────────────────────────────────────
function CreatorMonth() {
  const rows = [
    { k: "Sites delivered",          n: "× 8", rate: "₱500 each",       total: 4000 },
    { k: "Friends referred (creators)", n: "× 3", rate: "₱250 first site each", total: 750 },
    { k: "Friends referred (businesses)", n: "× 2", rate: "₱500 each",   total: 1000 },
    { k: "Top-tier bonus (month 3+)", n: "+10%", rate: "of ₱4,000 base",   total: 400 },
  ];
  const grand = rows.reduce((a, r) => a + r.total, 0);

  return (
    <section style={{ background: "var(--paper-2)" }}>
      <div className="container-wide">
        <div className="sect-h">
          <div className="eyebrow">§ A real month</div>
          <div>
            <h2 className="display-2">
              Janelle, Cebu. <em style={{ fontStyle: "italic", color: "var(--creator)" }}>Month 3.</em>
            </h2>
            <p className="lede" style={{ marginTop: 12 }}>
              One real creator, one real month. Not the top, not the bottom — the middle. Your numbers will look different on either side of this.
            </p>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 32 }}>
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ padding: "18px 24px", borderBottom: "1px solid var(--rule)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <window.Avatar name="Janelle" hue={18} size={36} />
                <div>
                  <div style={{ fontWeight: 500 }}>Janelle · Cebu City</div>
                  <div className="label" style={{ marginTop: 2 }}>Month 3 · verified statement</div>
                </div>
              </div>
              <span className="tag tag-live">
                <span className="live-dot" style={{ marginRight: 6 }}></span>Active
              </span>
            </div>
            {rows.map((r, i) => (
              <div key={r.k} style={{
                display: "grid", gridTemplateColumns: "1.4fr 80px 1fr 120px",
                alignItems: "baseline", gap: 16,
                padding: "20px 24px",
                borderTop: i === 0 ? "none" : "1px solid var(--rule)",
              }}>
                <div className="serif" style={{ fontSize: 20, lineHeight: 1.25 }}>{r.k}</div>
                <div className="mono" style={{ fontSize: 14, color: "var(--ink-3)" }}>{r.n}</div>
                <div style={{ fontSize: 13, color: "var(--ink-3)" }}>{r.rate}</div>
                <div className="counter-num" style={{ fontSize: 24, textAlign: "right" }}>₱{r.total.toLocaleString()}</div>
              </div>
            ))}
            <div style={{
              display: "flex", justifyContent: "space-between", alignItems: "baseline",
              padding: "22px 24px",
              borderTop: "1px solid var(--rule)",
              background: "var(--ink)", color: "var(--paper)",
            }}>
              <span className="label" style={{ color: "oklch(72% 0.008 85)" }}>March take-home</span>
              <span className="counter-num" style={{ fontSize: 48 }}>₱{grand.toLocaleString()}</span>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div className="card" style={{ padding: 24 }}>
              <div className="label" style={{ marginBottom: 8 }}>How long it took her</div>
              <div className="serif" style={{ fontSize: 24, lineHeight: 1.2 }}>About 24 hours of work — spread across 14 days. Mostly afternoons.</div>
            </div>
            <div className="card" style={{ padding: 24 }}>
              <div className="label" style={{ marginBottom: 8 }}>What she did with it</div>
              <p style={{ fontSize: 14, color: "var(--ink-2)", lineHeight: 1.55, margin: 0 }}>
                "Quit the call-center job. Working from the café below my flat. My mom thinks the app is a scam, but the GCash deposits are real."
              </p>
            </div>
            <div className="card" style={{ padding: 24, background: "var(--creator-bg)", color: "var(--creator-ink)", border: "1px solid oklch(58% 0.16 35 / .3)" }}>
              <div className="label" style={{ marginBottom: 8, color: "var(--creator-ink)" }}>Month 6 projection</div>
              <div className="counter-num" style={{ fontSize: 36 }}>~ ₱9,800/mo</div>
              <div style={{ fontSize: 13, marginTop: 8 }}>If her referral tree keeps compounding at current pace.</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function CreatorsApp() {
  const [t, setTweak] = useTweaks({
    "theme": "bright",
    "lang": "en",
    "country": "PH",
  });
  useEffectP(() => { document.documentElement.dataset.theme = t.theme; }, [t.theme]);

  const pickDoor = () => {};
  return (
    <>
      <BackTopBar
        kind="creator"
        lang={t.lang} country={t.country}
        onLangChange={(v)=>setTweak("lang", v)}
        onCountryChange={(v)=>setTweak("country", v)}
      />
      <CreatorHero />
      <window.Earnings country={t.country} />
      <CreatorMonth />
      <window.HowToApply onPickDoor={pickDoor} />
      <window.ReferralSection refName={null} />
      <CreatorFAQ />
      <CreatorFinal />
      <window.Footer
        lang={t.lang} country={t.country}
        onLangChange={(v)=>setTweak("lang", v)}
        onCountryChange={(v)=>setTweak("country", v)}
      />
      <window.ChatBot />

      <TweaksPanel title="Tweaks">
        <TweakSection label="Theme" />
        <TweakRadio label="Mode" value={t.theme} options={["bright", "ink"]} onChange={(v)=>setTweak("theme", v)} />
        <TweakSection label="Locale" />
        <TweakRadio label="Language" value={t.lang} options={["en", "tl"]} onChange={(v)=>setTweak("lang", v)} />
        <TweakSelect label="Country" value={t.country} options={["PH", "ID", "MX", "VN"]} onChange={(v)=>setTweak("country", v)} />
      </TweaksPanel>
    </>
  );
}

Object.assign(window, { BusinessApp, CreatorsApp, BackTopBar });
