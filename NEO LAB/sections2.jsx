// sections2.jsx — How It Works, Directory, Referral, Earnings, Business, FAQ, Final CTA, Footer.
const { useState: useStateB, useEffect: useEffectB } = React;

// ── How It Works ─────────────────────────────────────────────────────────────
function HowItWorks({ door }) {
  const business = [
    "Download the app — no signup until you're ready.",
    "Pick a creator nearby. Or let one find you.",
    "Sit for a short interview. 30 minutes, your shop.",
    "Approve your site. Pay only when it's live.",
  ];
  const creator = [
    "Download the app and verify your phone.",
    "Get certified — free, fast, in 20 minutes.",
    "Visit local businesses with guided capture.",
    "Earn ₱500 per site · ₱500 per friend referred.",
  ];
  const businessFirst = door !== "creator";

  return (
    <section style={{ background: "var(--paper-2)" }}>
      <div className="container-wide">
        <div className="sect-h">
          <div className="eyebrow">§ 03 — How It Works</div>
          <div>
            <h2 className="display-2">
              Two flows. <em style={{ color: "var(--creator)", fontStyle: "italic" }}>Side by side.</em>
            </h2>
            <p className="lede" style={{ marginTop: 12 }}>
              Pick yours. The other one is for someone else. That's the entire point of this page.
            </p>
          </div>
        </div>

        <div style={{
          display: "grid", gridTemplateColumns: "1fr 1fr",
          gap: 16,
        }}>
          <Track
            label={businessFirst ? "For business owners" : "For creators"}
            steps={businessFirst ? business : creator}
            kind={businessFirst ? "business" : "creator"}
          />
          <Track
            label={businessFirst ? "For creators" : "For business owners"}
            steps={businessFirst ? creator : business}
            kind={businessFirst ? "creator" : "business"}
          />
        </div>

        <div style={{ marginTop: 32, display: "flex", justifyContent: "center", gap: 16 }}>
          <button className="door door-ghost" style={{ padding: "14px 22px" }}>
            See full process · ↘
          </button>
        </div>
      </div>
    </section>
  );
}

function Track({ label, steps, kind }) {
  const bg = kind === "creator" ? "var(--creator-bg)" : "var(--business-bg)";
  const ink = kind === "creator" ? "var(--creator-ink)" : "var(--business-ink)";
  return (
    <div className="card" style={{ background: "var(--paper-3)", padding: "40px 32px 32px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 32 }}>
        <span style={{
          padding: "4px 10px", background: bg, color: ink,
          fontFamily: "var(--mono)", fontSize: 10, letterSpacing: ".12em", textTransform: "uppercase",
        }}>{label}</span>
      </div>
      <ol style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 1 }}>
        {steps.map((s, i) => (
          <li key={i} style={{
            display: "grid", gridTemplateColumns: "44px 1fr",
            alignItems: "baseline", padding: "20px 0",
            borderTop: i === 0 ? "1px solid var(--rule)" : "1px solid var(--rule)",
          }}>
            <span style={{
              fontFamily: "var(--mono)", fontSize: 12,
              color: ink, letterSpacing: ".05em",
            }}>0{i+1}</span>
            <span style={{
              fontFamily: "var(--serif)", fontSize: 24, lineHeight: 1.2,
              letterSpacing: "-.01em",
            }}>
              {s}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

// ── Directory ────────────────────────────────────────────────────────────────
function Directory({ counters, T, onSelectCreator, onSelectBusiness }) {
  const [filter, setFilter] = useStateB("All");
  const [creatorsAll, setCreatorsAll] = useStateB(false);
  const [businessesAll, setBusinessesAll] = useStateB(false);

  const filteredBusinesses = filter === "All" ? window.BUSINESSES : window.BUSINESSES.filter(b => b.category === filter);

  const counterCells = [
    { k: "creators",   label: T.counter_creators,   v: counters.creators },
    { k: "businesses", label: T.counter_businesses, v: counters.businesses },
    { k: "cities",     label: T.counter_cities,     v: counters.cities },
    { k: "countries",  label: T.counter_countries,  v: counters.countries },
  ];
  // Suppress countries if < 2
  if (counters.countries < 2) counterCells.splice(3, 1);

  return (
    <section>
      <div className="container-wide">
        <div className="sect-h">
          <div className="eyebrow">§ 04 — Directory</div>
          <div>
            <h2 className="display-2">Proof, <em style={{ fontStyle: "italic" }}>at scale</em>.</h2>
            <p className="lede" style={{ marginTop: 12 }}>
              Every name and every site below is real. Every number is pulled from the database, not from a deck.
            </p>
          </div>
        </div>

        {/* Counter band */}
        <div className="surface" style={{
          display: "grid", gridTemplateColumns: `repeat(${counterCells.length}, 1fr)`,
          marginBottom: 48,
        }}>
          {counterCells.map((c, i) => (
            <BigCounter key={c.k} value={c.v} label={c.label} last={i === counterCells.length - 1} />
          ))}
        </div>

        {counters.monthEarnings && (
          <div style={{
            display: "flex", alignItems: "baseline", gap: 18,
            padding: "20px 24px", marginBottom: 48,
            background: "var(--ink)", color: "var(--paper)",
            borderRadius: "var(--r-lg)",
          }}>
            <span className="label" style={{ color: "var(--live-soft)" }}>
              <span className="live-dot" style={{ marginRight: 6 }}></span>
              This month
            </span>
            <span className="counter-num" style={{ fontSize: 32 }}>
              ₱{window.fmt(counters.monthEarnings)}
            </span>
            <span style={{ color: "oklch(80% 0.008 85)", fontSize: 14 }}>
              paid out to creators · payouts continue daily
            </span>
          </div>
        )}

        {/* Creator rail */}
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 16 }}>
          <h3 className="display-3">Creators on the platform</h3>
          <button onClick={()=>setCreatorsAll(v => !v)} className="pill" style={{ padding: "8px 16px", fontSize: 12 }}>
            {creatorsAll ? "Show fewer ←" : `See all ${window.CREATORS.length} creators →`}
          </button>
        </div>
        {creatorsAll ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 16 }}>
            {window.CREATORS.map(c => (
              <CreatorCard key={c.id} c={c} onClick={()=>onSelectCreator(c)} />
            ))}
          </div>
        ) : (
          <div className="rail">
            {window.CREATORS.map(c => (
              <CreatorCard key={c.id} c={c} onClick={()=>onSelectCreator(c)} />
            ))}
          </div>
        )}

        {/* Business rail */}
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginTop: 48, marginBottom: 16 }}>
          <h3 className="display-3">Businesses we've built</h3>
          <button onClick={()=>setBusinessesAll(v => !v)} className="pill" style={{ padding: "8px 16px", fontSize: 12 }}>
            {businessesAll ? "Show fewer ←" : `See all ${filteredBusinesses.length} sites →`}
          </button>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 20 }}>
          {window.CATEGORIES.map(c => (
            <window.Pill key={c} active={filter===c} onClick={()=>setFilter(c)}>{c}</window.Pill>
          ))}
        </div>
        {businessesAll ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16 }}>
            {filteredBusinesses.map(b => (
              <BusinessCard key={b.id} b={b} onClick={()=>onSelectBusiness(b)} />
            ))}
          </div>
        ) : (
          <div className="rail">
            {filteredBusinesses.map(b => (
              <BusinessCard key={b.id} b={b} onClick={()=>onSelectBusiness(b)} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function BigCounter({ value, label, last }) {
  const v = window.useTickUp(value);
  return (
    <div style={{
      padding: "32px 28px",
      borderRight: last ? "none" : "1px solid var(--rule)",
    }}>
      <div className="label" style={{ marginBottom: 12 }}>
        <span className="live-dot" style={{ marginRight: 6 }}></span>{label}
      </div>
      <div className="counter-num" style={{ fontSize: 72 }}>{window.fmt(v)}</div>
    </div>
  );
}

function CreatorCard({ c, onClick }) {
  return (
    <button onClick={onClick} className="lift" style={{
      width: 240, padding: 0,
      border: "1px solid var(--rule)", background: "var(--paper-3)",
      cursor: "default", textAlign: "left",
      borderRadius: "var(--r-lg)",
      overflow: "hidden",
    }}>
      <div style={{ padding: 18, borderBottom: "1px solid var(--rule)", display: "flex", alignItems: "center", gap: 14 }}>
        <window.Avatar name={c.name} hue={c.hue} size={48} />
        <div>
          <div style={{ fontWeight: 500, fontSize: 16 }}>{c.name}</div>
          <div className="label" style={{ marginTop: 2 }}>{c.city}</div>
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", padding: 14, alignItems: "baseline" }}>
        <div>
          <div className="counter-num" style={{ fontSize: 28 }}>{c.sites}</div>
          <div className="label" style={{ marginTop: 2 }}>sites delivered</div>
        </div>
        <span className="tag tag-live" style={{ alignSelf: "center" }}>
          <span className="live-dot" style={{ marginRight: 6 }}></span>Hire ↗
        </span>
      </div>
    </button>
  );
}

function BusinessCard({ b, onClick }) {
  const creator = window.CREATORS.find(c => c.id === b.creator);
  return (
    <button onClick={onClick} className="lift" style={{
      width: 280, padding: 0,
      border: "1px solid var(--rule)", background: "var(--paper-3)",
      cursor: "default", textAlign: "left",
      borderRadius: "var(--r-lg)",
      overflow: "hidden",
    }}>
      <div className="stripes ar-4x3" style={{
        position: "relative", borderBottom: "1px solid var(--rule)",
      }}>
        <div style={{
          position: "absolute", top: 10, right: 10,
          padding: "4px 8px", background: "var(--paper-3)",
          border: "1px solid var(--rule)",
          fontFamily: "var(--mono)", fontSize: 9, letterSpacing: ".1em", textTransform: "uppercase",
        }}>Live ↗</div>
        <div style={{
          position: "absolute", bottom: 10, left: 10,
          fontFamily: "var(--mono)", fontSize: 9, color: "var(--ink-3)",
        }}>{b.name} screenshot</div>
      </div>
      <div style={{ padding: "14px 16px" }}>
        <div style={{ fontWeight: 500, fontSize: 15 }}>{b.name}</div>
        <div className="label" style={{ marginTop: 4 }}>
          {b.category} · {b.city}
        </div>
        <div style={{
          display: "flex", justifyContent: "space-between", marginTop: 12,
          paddingTop: 12, borderTop: "1px solid var(--rule)",
        }}>
          <span style={{ fontSize: 12, color: "var(--ink-3)" }}>by <strong style={{ color: "var(--ink)" }}>{creator?.name}</strong></span>
          <span className="label">Visit →</span>
        </div>
      </div>
    </button>
  );
}

// ── Referral Explainer ───────────────────────────────────────────────────────
function ReferralSection({ refName }) {
  return (
    <section style={{ background: "var(--ink)", color: "var(--paper)" }}>
      <div className="container-wide">
        <div className="sect-h">
          <div className="eyebrow" style={{ color: "oklch(58% 0.16 35)" }}>§ 05 — Referrals</div>
          <div>
            <h2 className="display-2" style={{ color: "var(--paper)" }}>
              Bring a friend.<br/><em style={{ fontStyle: "italic", color: "oklch(58% 0.16 35)" }}>Earn for years.</em>
            </h2>
            <p className="lede" style={{ marginTop: 12, color: "oklch(80% 0.008 85)", maxWidth: "62ch" }}>
              The platform pays creators for the work they ship. It also pays them for the creators and businesses they bring along. Plain numbers, no fine print.
            </p>
          </div>
        </div>

        {/* Two example flows */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32 }}>
          <ReferFlow
            title="Creator refers a friend (new creator)"
            from={{ label: "You", role: "Certified creator" }}
            to={{ label: "Friend", role: "New creator" }}
            payout="₱250 per first site"
            kicker="You both earn the day your friend's first site goes live."
          />
          <ReferFlow
            title="Creator refers a friend who lands a business"
            from={{ label: "You", role: "Certified creator" }}
            to={{ label: "Friend", role: "Lands their first shop" }}
            payout="₱500 bonus"
            kicker="Cash bonus the day that friend's first business goes live — on top of your normal earnings."
            alt
          />
        </div>

        {/* Payout table */}
        <div style={{ marginTop: 48, border: "1px solid oklch(40% 0.015 260)", borderRadius: "var(--r-lg)", overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", borderBottom: "1px solid oklch(40% 0.015 260)" }}>
            <PayoutCell label="Per site delivered" v="₱500" caption="half of ₱1,000 site fee" />
            <PayoutCell label="Friend lands a business" v="₱500" caption="per friend, no cap" />
            <PayoutCell label="Friend's first site" v="₱250" caption="shared with your friend" />
            <PayoutCell label="Attribution window" v="30d" caption="from referral tap" last />
          </div>
          <div style={{ padding: "14px 24px", fontSize: 13, color: "oklch(72% 0.008 85)" }}>
            All figures in PHP. Pricing matches PH in other regions until local launch. Payouts via GCash, Maya, or direct bank transfer — within 48 hours.
          </div>
        </div>

        {/* Get app CTA */}
        <div style={{ marginTop: 40, padding: "32px 0", borderTop: "1px solid oklch(40% 0.015 260)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
          <div className="display-3" style={{ color: "var(--paper)", maxWidth: "32ch" }}>
            Your referral link lives in the app. {refName && <span style={{ color: "oklch(58% 0.16 35)" }}>{refName} is already invited.</span>}
          </div>
          <button className="door door-creator" style={{ padding: "20px 28px" }}>
            <span>Get the app to claim your link</span>
            <span className="arrow">↗</span>
          </button>
        </div>
      </div>
    </section>
  );
}

function ReferFlow({ title, from, to, payout, kicker, alt }) {
  return (
    <div style={{
      padding: 28,
      border: "1px solid oklch(40% 0.015 260)",
    }}>
      <div className="label" style={{ color: "oklch(72% 0.008 85)", marginBottom: 20 }}>{title}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
        <Bubble label={from.label} role={from.role} alt={alt} />
        <Arrow />
        <Bubble label={to.label} role={to.role} alt={!alt} />
      </div>
      <div style={{ borderTop: "1px solid oklch(40% 0.015 260)", paddingTop: 16 }}>
        <div className="counter-num" style={{ fontSize: 36, color: alt ? "oklch(58% 0.16 35)" : "oklch(68% 0.20 145)" }}>{payout}</div>
        <div style={{ fontSize: 13, color: "oklch(72% 0.008 85)", marginTop: 8 }}>{kicker}</div>
      </div>
    </div>
  );
}
function Bubble({ label, role, alt }) {
  return (
    <div style={{
      flex: 1, padding: "16px",
      background: alt ? "oklch(58% 0.16 35 / .15)" : "oklch(34% 0.10 245 / .25)",
      border: "1px solid " + (alt ? "oklch(58% 0.16 35 / .4)" : "oklch(60% 0.10 245 / .4)"),
    }}>
      <div style={{ fontFamily: "var(--serif)", fontSize: 22, lineHeight: 1.0 }}>{label}</div>
      <div className="label" style={{ marginTop: 8, color: "oklch(72% 0.008 85)" }}>{role}</div>
    </div>
  );
}
function Arrow() {
  return (
    <svg width="28" height="14" viewBox="0 0 28 14" fill="none" style={{ flexShrink: 0 }}>
      <path d="M0 7 H26 M20 1 L26 7 L20 13" stroke="currentColor" strokeWidth="1.4" opacity=".5"/>
    </svg>
  );
}
function PayoutCell({ label, v, caption, last }) {
  return (
    <div style={{
      padding: "22px 24px",
      borderRight: last ? "none" : "1px solid oklch(40% 0.015 260)",
    }}>
      <div className="label" style={{ color: "oklch(72% 0.008 85)", marginBottom: 12 }}>{label}</div>
      <div className="counter-num" style={{ fontSize: 36 }}>{v}</div>
      <div style={{ fontSize: 12, color: "oklch(60% 0.010 85)", marginTop: 6 }}>{caption}</div>
    </div>
  );
}

// ── Earnings Reality ────────────────────────────────────────────────────────
function Earnings({ country }) {
  const symbol = country === "PH" ? "₱" : country === "MX" ? "$" : "₱";
  return (
    <section>
      <div className="container-wide">
        <div className="sect-h">
          <div className="eyebrow">§ 06 — Earnings</div>
          <div>
            <h2 className="display-2">
              Conservative <em>by design</em>.
            </h2>
            <p className="lede" style={{ marginTop: 12 }}>
              Below is what an active creator actually earns. We round down, we show the floor, we let testimonials speak for the ceiling.
            </p>
          </div>
        </div>

        <div style={{
          display: "grid", gridTemplateColumns: "1fr 1fr 1fr",
          gap: 16,
          marginBottom: 56,
        }}>
          <EarnCell label="Per week, part-time" range={`${symbol}1,500 – ${symbol}3,500`} note="3–7 sites per week" />
          <EarnCell label="Per week, full-time" range={`${symbol}5,000 – ${symbol}12,000`} note="10+ sites + referral bonuses" />
          <EarnCell label="Top decile, month 6+" range={`${symbol}24,000 +`} note="Active referral tree, multi-city" highlight />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 24 }}>
          {window.TESTIMONIALS.map((t, i) => (
            <div key={i} className="card lift" style={{ padding: 28, display: "flex", flexDirection: "column", gap: 16 }}>
              <p className="pull-quote" style={{ fontSize: 22, lineHeight: 1.25 }}>
                <em>"</em>{t.claim}<em>"</em>
              </p>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: "auto", paddingTop: 16, borderTop: "1px solid var(--rule)" }}>
                <window.Avatar name={t.name} hue={t.hue} size={36} />
                <div>
                  <div style={{ fontWeight: 500, fontSize: 14 }}>{t.name}</div>
                  <div className="label" style={{ marginTop: 2 }}>{t.city} · verified</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function EarnCell({ label, range, note, highlight }) {
  return (
    <div className="card" style={{
      padding: "32px 28px",
      background: highlight ? "var(--ink)" : "var(--paper-3)",
      color: highlight ? "var(--paper)" : "var(--ink)",
      border: highlight ? "1px solid var(--ink)" : undefined,
    }}>
      <div className="label" style={{ marginBottom: 14, color: highlight ? "oklch(72% 0.008 85)" : undefined }}>{label}</div>
      <div className="counter-num" style={{ fontSize: 40, marginBottom: 12, lineHeight: 1.0 }}>{range}</div>
      <div style={{ fontSize: 13, color: highlight ? "oklch(80% 0.008 85)" : "var(--ink-3)" }}>{note}</div>
    </div>
  );
}

// ── What Business Owners Get ────────────────────────────────────────────────
function BusinessGet({ country, onFindCreator }) {
  const pricing = window.PRICING[country] || window.PRICING.PH;
  const price = `${pricing.currency}${pricing.site_total.toLocaleString()}`;
  const examples = window.BUSINESSES.slice(0, 3);
  return (
    <section style={{ background: "var(--paper-2)" }}>
      <div className="container-wide">
        <div className="sect-h">
          <div className="eyebrow">§ 07 — Business</div>
          <div>
            <h2 className="display-2">
              You get the site. <em>You own everything.</em>
            </h2>
            <p className="lede" style={{ marginTop: 12 }}>
              The creator brings the camera, the questions, and the patience. You drink coffee and tell stories. The site goes live before the weekend.
            </p>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 56 }}>
          {examples.map(b => (
            <div key={b.id} className="lift" style={{ background: "var(--paper-3)", border: "1px solid var(--rule)" }}>
              <div className="stripes ar-16x9" style={{ borderBottom: "1px solid var(--rule)", position: "relative" }}>
                <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink-3)", letterSpacing: ".08em", textTransform: "uppercase" }}>
                  {b.name.toLowerCase().replace(/[^a-z]/g, "")}.ph
                </div>
              </div>
              <div style={{ padding: 20 }}>
                <div style={{ fontWeight: 500 }}>{b.name}</div>
                <div className="label" style={{ marginTop: 4 }}>{b.category} · {b.city}</div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 56, alignItems: "start" }}>
          <div>
            <div className="label" style={{ marginBottom: 16 }}>What's in the price</div>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
              {[
                "A live website on your own domain",
                "World-class photography of your shop and products",
                "Written copy — your story, told properly",
                "Hosting + SSL — first year, fully included",
                "Small edits for a year, included",
                "You own everything — domain, photos, copy. Take it anywhere.",
              ].map((s, i) => (
                <li key={i} className="card-sm" style={{
                  background: "var(--paper-3)",
                  border: "1px solid var(--rule)",
                  padding: "16px 20px",
                  display: "flex", alignItems: "baseline", gap: 16,
                }}>
                  <span className="mono" style={{ fontSize: 11, color: "var(--ink-3)" }}>0{i+1}</span>
                  <span style={{ fontSize: 15 }}>{s}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="card" style={{
            padding: 32,
            position: "sticky", top: 80,
          }}>
            <div className="label" style={{ marginBottom: 12 }}>The whole thing</div>
            <div className="counter-num" style={{ fontSize: 64, marginBottom: 4, lineHeight: 1 }}>{price}</div>
            <div style={{ fontSize: 13, color: "var(--ink-3)", marginBottom: 16 }}>
              One-time. Includes the year of hosting. No subscriptions, no surprise renewals.
            </div>
            {country !== "PH" && (
              <div style={{ fontSize: 13, color: "var(--ink-3)", marginBottom: 16, padding: 12, background: "var(--paper-2)", borderRadius: "var(--r-sm)" }}>
                We launched in the Philippines. Other markets show PH pricing until we go live there.
              </div>
            )}
            <div style={{ fontSize: 13, color: "var(--ink-3)", lineHeight: 1.6, marginBottom: 24 }}>
              You pay only after the site is live and you've approved it. No card on file. No fine print. No charges later.
            </div>
            <button onClick={onFindCreator} className="door door-business" style={{ width: "100%", display: "flex", justifyContent: "space-between" }}>
              <span>Find a creator near me</span><span className="arrow">↗</span>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── FAQ ──────────────────────────────────────────────────────────────────────
function FAQ() {
  const [tab, setTab] = useStateB("creators");
  const [open, setOpen] = useStateB(0);
  const list = tab === "creators" ? window.FAQ_CREATOR : window.FAQ_BUSINESS;

  useEffectB(() => { setOpen(0); }, [tab]);

  return (
    <section>
      <div className="container-wide">
        <div className="sect-h">
          <div className="eyebrow">§ 08 — Questions</div>
          <div>
            <h2 className="display-2">
              Questions <em>worth asking.</em>
            </h2>
            <div style={{ display: "flex", gap: 8, marginTop: 24 }}>
              <button className="pill" aria-pressed={tab==="creators"} onClick={()=>setTab("creators")} style={{ padding: "8px 16px", fontSize: 13 }}>
                For creators
              </button>
              <button className="pill" aria-pressed={tab==="business"} onClick={()=>setTab("business")} style={{ padding: "8px 16px", fontSize: 13 }}>
                For business owners
              </button>
            </div>
          </div>
        </div>

        <div style={{ maxWidth: 880, margin: "0 auto", borderTop: "1px solid var(--rule-strong)" }}>
          {list.map((qa, i) => (
            <div key={i} style={{ borderBottom: "1px solid var(--rule)" }}>
              <button
                onClick={()=>setOpen(open === i ? -1 : i)}
                style={{
                  width: "100%", textAlign: "left", padding: "24px 0",
                  display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 24,
                  border: 0, background: "transparent", color: "var(--ink)",
                  cursor: "default",
                }}
              >
                <span style={{ fontFamily: "var(--serif)", fontSize: 26, lineHeight: 1.25, letterSpacing: "-.01em" }}>
                  {qa.q}
                </span>
                <span style={{
                  fontFamily: "var(--mono)", fontSize: 16, transform: open===i ? "rotate(45deg)" : "rotate(0deg)",
                  transition: "transform .2s ease", color: "var(--ink-3)",
                }}>+</span>
              </button>
              {open === i && (
                <p style={{
                  margin: 0, paddingBottom: 24, paddingRight: 60,
                  fontSize: 16, color: "var(--ink-2)", lineHeight: 1.6,
                }}>{qa.a}</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Final CTA ───────────────────────────────────────────────────────────────
function FinalCTA({ onPickDoor }) {
  return (
    <section style={{ background: "var(--ink)", color: "var(--paper)", padding: "140px 0 120px" }}>
      <div className="container-wide">
        <div style={{ textAlign: "center", marginBottom: 64 }}>
          <div className="eyebrow" style={{ marginBottom: 24, color: "var(--creator)" }}>§ 10 — The vision</div>
          <h2 className="display" style={{ fontSize: "clamp(56px, 8.5vw, 140px)", color: "var(--paper)" }}>
            A website<br/>for <em style={{ fontStyle: "italic", color: "var(--creator)" }}>every shop</em><br/>on Earth.
          </h2>
          <p className="lede" style={{ marginTop: 32, color: "oklch(80% 0.008 85)", maxWidth: "50ch", margin: "32px auto 0", textAlign: "center", fontSize: 18 }}>
            Pick the door that’s yours. The app does the rest.
          </p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, maxWidth: 1080, margin: "0 auto" }}>
          <a href="For Business.html" onClick={()=>onPickDoor("business")} className="door door-business" style={{ padding: "40px 32px", flexDirection: "column", alignItems: "flex-start", gap: 0, textDecoration: "none" }}>
            <span className="meta" style={{ marginBottom: 24 }}>For business owners ↗</span>
            <span style={{ fontFamily: "var(--serif)", fontSize: 48, lineHeight: 0.95, letterSpacing: "-.02em" }}>I own a business.</span>
            <span style={{ fontSize: 13, opacity: .8, marginTop: 20 }}>See what we deliver, find a creator near you, get your shop online.</span>
          </a>
          <a href="For Creators.html" onClick={()=>onPickDoor("creator")} className="door door-creator" style={{ padding: "40px 32px", flexDirection: "column", alignItems: "flex-start", gap: 0, textDecoration: "none" }}>
            <span className="meta" style={{ marginBottom: 24 }}>For creators ↗</span>
            <span style={{ fontFamily: "var(--serif)", fontSize: 48, lineHeight: 0.95, letterSpacing: "-.02em" }}>I want to earn.</span>
            <span style={{ fontSize: 13, opacity: .8, marginTop: 20 }}>See real earnings, the referral loop, and how to apply this week.</span>
          </a>
        </div>
      </div>
    </section>
  );
}

function Manifesto() {
  return (
    <section style={{ background: "var(--paper-2)", padding: "120px 0" }}>
      <div className="container-wide">
        <div style={{ display: "grid", gridTemplateColumns: "minmax(160px, 1fr) 4fr", gap: 48 }}>
          <div className="eyebrow">Manifesto</div>
          <div>
            <p className="display-2" style={{ fontSize: "clamp(36px, 4.4vw, 64px)", lineHeight: 1.08, letterSpacing: "-.02em" }}>
              The internet was built for the <em style={{ fontStyle: "italic" }}>top one percent</em> of businesses.
              <br/>
              <span style={{ color: "var(--creator)" }}>We’re building it for the other ninety-nine.</span>
            </p>
            <div style={{ marginTop: 48, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 32, paddingTop: 32, borderTop: "1px solid var(--rule)" }}>
              <ManifestoBeat label="Who we serve" big="The 99%" sub="Sari-sari stores. Salons. Barangay clinics. The shops nobody else builds for." />
              <ManifestoBeat label="How fast" big="72 hours" sub="From the day a creator walks into your shop to the day your site is live and indexed." />
              <ManifestoBeat label="What it takes" big="Zero skill" sub="You don’t open a laptop. You don’t pick a template. You answer questions about your business." />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function ManifestoBeat({ label, big, sub }) {
  return (
    <div>
      <div className="label" style={{ marginBottom: 12 }}>{label}</div>
      <div className="counter-num" style={{ fontSize: 48, lineHeight: 1.0, marginBottom: 12 }}>{big}</div>
      <div style={{ fontSize: 14, color: "var(--ink-2)", lineHeight: 1.55 }}>{sub}</div>
    </div>
  );
}

// ── Sticky bottom CTA bar ───────────────────────────────────────────────────
function StickyCTA({ visible, onPickDoor, door }) {
  useEffectB(() => {
    document.body.classList.toggle("sticky-cta-visible", !!visible);
    return () => document.body.classList.remove("sticky-cta-visible");
  }, [visible]);
  return (
    <div className={`sticky-cta ${visible ? "visible" : ""}`}>
      <div className="container-wide" style={{ padding: "14px 28px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <window.Logo />
          {door && (
            <span className="label" style={{ color: "var(--ink-3)" }}>
              You picked the <strong style={{ color: door==="creator" ? "var(--creator)" : "var(--business)" }}>{door}</strong> door.
            </span>
          )}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <a href="For Business.html" onClick={()=>onPickDoor("business")} className="door door-business" style={{ padding: "12px 18px", fontSize: 14, textDecoration: "none" }}>I own a business <span className="arrow">↗</span></a>
          <a href="For Creators.html" onClick={()=>onPickDoor("creator")} className="door door-creator" style={{ padding: "12px 18px", fontSize: 14, textDecoration: "none" }}>I want to earn <span className="arrow">↗</span></a>
        </div>
      </div>
    </div>
  );
}

// ── Footer ──────────────────────────────────────────────────────────────────
function Footer({ lang, country, onLangChange, onCountryChange }) {
  return (
    <footer>
      <div className="container-wide">
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: 48, alignItems: "start" }}>
          <div>
            <div style={{ marginBottom: 24 }}>
              <span style={{ fontFamily: "var(--serif)", fontStyle: "italic", fontSize: 36, letterSpacing: "-.02em" }}>Negosyo</span>{" "}
              <span className="mono" style={{ letterSpacing: ".18em", textTransform: "uppercase", fontSize: 13, color: "oklch(70% 0.010 85)" }}>Digital</span>
            </div>
            <p style={{ maxWidth: "44ch", color: "oklch(72% 0.010 85)", lineHeight: 1.5 }}>
              A platform for the people who build for everyone else. Two doors, one map, one app — and a competitive moat the size of a country.
            </p>
          </div>
          <FootCol title="Get the app">
            <a href="#">iOS · App Store</a>
            <a href="#">Android · Play Store</a>
            <a href="Knowledge.html">Knowledge base</a>
            <a href="#">Press kit</a>
          </FootCol>
          <FootCol title="Legal">
            <a href="#">Privacy</a>
            <a href="#">Terms</a>
            <a href="#">Contact</a>
          </FootCol>
          <FootCol title="Region">
            <select value={country} onChange={(e)=>onCountryChange(e.target.value)} style={footSel()}>
              <option value="PH">🇵🇭 Philippines</option>
              <option value="ID">🇮🇩 Indonesia</option>
              <option value="MX">🇲🇽 Mexico</option>
              <option value="VN">🇻🇳 Vietnam</option>
            </select>
            <select value={lang} onChange={(e)=>onLangChange(e.target.value)} style={footSel()}>
              <option value="en">English</option>
              <option value="tl">Tagalog</option>
            </select>
          </FootCol>
        </div>
        <div style={{ marginTop: 48, paddingTop: 24, borderTop: "1px solid oklch(40% 0.015 260)", display: "flex", justifyContent: "space-between", fontSize: 12, color: "oklch(60% 0.010 85)" }}>
          <span className="label">© Negosyo Digital · MMXXVI</span>
          <span className="label">Map data: OpenStreetMap · CARTO</span>
        </div>
      </div>
    </footer>
  );
}

function FootCol({ title, children }) {
  return (
    <div>
      <div className="label" style={{ marginBottom: 16 }}>{title}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 14 }}>
        {children}
      </div>
    </div>
  );
}
function footSel() {
  return {
    appearance: "none", border: "1px solid oklch(40% 0.015 260)",
    background: "transparent", color: "oklch(85% 0.008 85)",
    padding: "10px 12px", fontFamily: "var(--mono)", fontSize: 11,
    letterSpacing: ".08em", textTransform: "uppercase", cursor: "default",
    width: "100%",
  };
}

Object.assign(window, {
  HowItWorks, Directory, ReferralSection, Earnings, BusinessGet, FAQ,
  FinalCTA, StickyCTA, Footer, Manifesto,
});
