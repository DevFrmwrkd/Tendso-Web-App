// sections.jsx — page sections (Hero, Map, How It Works, Directory, etc.)
const { useState: useStateS, useEffect: useEffectS, useRef: useRefS } = React;

// ── Small helper: animated counter ───────────────────────────────────────────
function useTickUp(target, duration = 1200) {
  const [v, setV] = useStateS(0);
  useEffectS(() => {
    if (target == null) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setV(target); return; }
    let raf, t0;
    const step = (t) => {
      if (!t0) t0 = t;
      const p = Math.min(1, (t - t0) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setV(Math.floor(target * eased));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return v;
}

function fmt(n) {
  if (n == null) return "—";
  if (n >= 1000) return n.toLocaleString();
  return n.toString();
}

// ── Top bar (no menu, per brief — logo + one CTA) ───────────────────────────
function TopBar({ lang, country, onLangChange, onCountryChange }) {
  const T = window.STRINGS[lang];
  return (
    <div className="topbar">
      <div className="container-wide" style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "14px 48px",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <Logo />
          <div className="label" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span className="live-dot"></span>
            Live in Philippines · expanding
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <select
            value={lang} onChange={(e)=>onLangChange(e.target.value)}
            style={selectStyle()} aria-label="Language"
          >
            <option value="en">EN</option>
            <option value="tl">Tagalog</option>
          </select>
          <select
            value={country} onChange={(e)=>onCountryChange(e.target.value)}
            style={selectStyle()} aria-label="Country"
          >
            <option value="PH">🇵🇭 Philippines</option>
            <option value="ID">🇮🇩 Indonesia</option>
            <option value="MX">🇲🇽 Mexico</option>
            <option value="VN">🇻🇳 Vietnam</option>
          </select>
          <button className="store-btn">{T.get_app}<span style={{ opacity: .6 }}>↗</span></button>
        </div>
      </div>
    </div>
  );
}

function selectStyle() {
  return {
    appearance: "none", border: "1px solid var(--rule)",
    background: "var(--paper-3)", color: "var(--ink)",
    padding: "8px 12px", fontFamily: "var(--mono)", fontSize: 11,
    letterSpacing: ".08em", textTransform: "uppercase", cursor: "default",
  };
}

function Logo() {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
      <span style={{
        fontFamily: "var(--serif)", fontStyle: "italic",
        fontSize: 22, letterSpacing: "-.02em",
      }}>Negosyo</span>
      <span style={{
        fontFamily: "var(--mono)", fontSize: 11,
        letterSpacing: ".18em", textTransform: "uppercase", color: "var(--ink-3)",
      }}>Digital</span>
    </div>
  );
}

// ── Referral arrival banner ──────────────────────────────────────────────────
function ReferralBanner({ refName, refCity, onDismiss }) {
  return (
    <div style={{
      background: "var(--creator-bg)", borderBottom: "1px solid var(--rule)",
      padding: "10px 0",
    }}>
      <div className="container-wide" style={{ padding: "0 48px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 14 }}>
          <span className="tag" style={{ background: "var(--paper-3)" }}>Invited</span>
          <span>
            You were invited by{" "}
            <strong style={{ fontFamily: "var(--serif)", fontStyle: "italic", fontWeight: 400, fontSize: 18 }}>{refName}</strong>{" "}
            from <strong>{refCity}</strong>.
            <span style={{ color: "var(--ink-3)", marginLeft: 8 }}>Their credit is attached for the next 30 days.</span>
          </span>
        </div>
        <button onClick={onDismiss} aria-label="Dismiss" style={{
          border: 0, background: "transparent", cursor: "default",
          fontSize: 18, color: "var(--ink-3)", padding: 4,
        }}>×</button>
      </div>
    </div>
  );
}

// ── Hero ─────────────────────────────────────────────────────────────────────
function Hero({ T, counters, onPickDoor }) {
  const creators   = useTickUp(counters.creators);
  const businesses = useTickUp(counters.businesses);
  const cities     = useTickUp(counters.cities);
  const countries  = useTickUp(counters.countries);
  const hm = T.hero_main;

  return (
    <section style={{ paddingTop: 56, paddingBottom: 48 }}>
      <div className="container-wide">
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.55fr) minmax(280px, 1fr)", gap: 56, alignItems: "end", marginBottom: 48 }}>
          <div>
            <div className="eyebrow" style={{ marginBottom: 24, display: "inline-flex", alignItems: "center", gap: 10, padding: "6px 14px", border: "1px solid var(--rule)", borderRadius: "var(--r-pill)", background: "var(--paper-3)" }}>
              <span className="live-dot"></span>
              Issue No. 01 · {new Date().toLocaleString("en-US",{month:"long",year:"numeric"})}
            </div>
            <h1 className="display">
              {hm[0]}
              <br />
              {hm[1]}<em>{hm[2]}</em>{hm[3]}
            </h1>
            <div className="serif" style={{ fontSize: "clamp(20px, 1.8vw, 28px)", fontStyle: "italic", color: "var(--ink-2)", marginTop: 18, letterSpacing: "-.01em" }}>
              {T.hero_main_em}
            </div>
            <p className="lede" style={{ marginTop: 28, fontSize: 18, maxWidth: "58ch" }}>
              {T.hero_lede}
            </p>
            {/* The promise pills */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 28 }}>
              {[
                "Real photographer",
                "Written copy",
                "Hosting + domain",
                "You don’t lift a finger",
                "Live in 72 hours",
              ].map((p, i) => (
                <span key={i} className="tag" style={{ padding: "6px 14px", fontSize: 11, background: "var(--paper-3)", color: "var(--ink-2)" }}>{p}</span>
              ))}
            </div>
          </div>
          <div className="surface">
            <div style={{
              padding: "14px 18px",
              borderBottom: "1px solid var(--rule)",
              display: "flex", justifyContent: "space-between", alignItems: "center",
            }}>
              <span className="label"><span className="live-dot" style={{ marginRight: 6 }}></span>Live · {new Date().toLocaleTimeString("en-US",{hour:"2-digit",minute:"2-digit"})} PHT</span>
              <span className="label" style={{ color: "var(--live)" }}>↑ updating</span>
            </div>
            <CounterRow value={creators}   label={T.counter_creators} />
            <CounterRow value={businesses} label={T.counter_businesses} />
            <CounterRow value={cities}     label={T.counter_cities} />
            <CounterRow value={countries}  label={T.counter_countries} last />
          </div>
        </div>

        {/* Two doors */}
        <div style={{ paddingTop: 32, borderTop: "1px solid var(--rule-strong)" }}>
          <div className="label" style={{ marginBottom: 16 }}>Pick a door</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <DoorButton
              kind="business"
              href="For Business.html"
              onClick={()=>onPickDoor("business")}
              sub={T.door_business_sub}
              title={T.door_business}
              note="See exactly what we deliver — photos, copy, domain, hosting — and find a creator within 10 km of your shop."
            />
            <DoorButton
              kind="creator"
              href="For Creators.html"
              onClick={()=>onPickDoor("creator")}
              sub={T.door_creator_sub}
              title={T.door_creator}
              note="See how much creators actually earn, how referrals stack up, and how to get certified this week."
            />
          </div>
          <div style={{ marginTop: 24, display: "flex", alignItems: "center", gap: 12, color: "var(--ink-3)", fontSize: 13 }}>
            <ArrowDown />
            <span>Or scroll — find creators near you on the map below.</span>
          </div>
        </div>
      </div>
    </section>
  );
}

function CounterRow({ value, label, last }) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "baseline",
      padding: "16px 18px",
      borderBottom: last ? "none" : "1px solid var(--rule)",
    }}>
      <span className="counter-num" style={{ fontSize: 36 }}>{fmt(value)}</span>
      <span className="label">{label}</span>
    </div>
  );
}

function DoorButton({ kind, title, sub, note, onClick, href }) {
  const cls = kind === "creator" ? "door-creator" : "door-business";
  const Tag = href ? "a" : "button";
  return (
    <Tag
      className={`door ${cls}`}
      onClick={onClick}
      href={href}
      style={{
        flexDirection: "column", alignItems: "flex-start",
        padding: "24px 24px 22px",
        gap: 0,
        textDecoration: "none",
      }}
    >
      <span className="meta" style={{ fontFamily: "var(--mono)", fontSize: 10, letterSpacing: ".12em", textTransform: "uppercase", opacity: .65, marginBottom: 16 }}>
        {sub} &nbsp;&nbsp; →
      </span>
      <span style={{ fontFamily: "var(--serif)", fontSize: 36, lineHeight: 1.0, letterSpacing: "-.02em" }}>
        {title}
      </span>
      <span style={{ fontSize: 13, opacity: .8, marginTop: 14, fontWeight: 400 }}>{note}</span>
    </Tag>
  );
}

function ArrowDown() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M7 1 V13 M3 9 L7 13 L11 9" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

// ── Region search with live counts ───────────────────────────────────────────
function RegionSearch({ onSelectRegion, onEmpty }) {
  const [q, setQ] = useStateS("");
  const [open, setOpen] = useStateS(false);
  const inputRef = useRefS(null);
  const filtered = window.REGIONS.filter(r =>
    !q || r.label.toLowerCase().includes(q.toLowerCase())
  );

  const countNear = (region) => {
    if (region.id === "all") return { creators: window.CREATORS.length, businesses: window.BUSINESSES.length };
    const [lat, lng] = region.center;
    const within = (it, km) => {
      const dx = (it.lat - lat) * 111;
      const dy = (it.lng - lng) * 111 * Math.cos(lat * Math.PI/180);
      return Math.sqrt(dx*dx + dy*dy) < km;
    };
    return {
      creators:   window.CREATORS.filter(c => within(c, 80)).length,
      businesses: window.BUSINESSES.filter(b => within(b, 80)).length,
    };
  };

  // close on outside click
  useEffectS(() => {
    const h = (e) => {
      if (!inputRef.current) return;
      if (inputRef.current.contains(e.target)) return;
      setOpen(false);
    };
    window.addEventListener("mousedown", h);
    return () => window.removeEventListener("mousedown", h);
  }, []);

  const doSearch = () => {
    const exact = window.REGIONS.find(r => r.label.toLowerCase() === q.toLowerCase());
    const first = exact || filtered[1] || filtered[0];
    if (!first) { onEmpty(q || "your area"); return; }
    const c = countNear(first);
    if (c.creators === 0 && first.id !== "all") onEmpty(first.label);
    else { onSelectRegion(first); setOpen(false); }
  };

  return (
    <div ref={inputRef} style={{ position: "relative", maxWidth: 760, margin: "0 auto 32px" }}>
      <div className="surface" style={{
        padding: "6px 6px 6px 24px",
        display: "flex", alignItems: "center", gap: 12,
        borderRadius: "var(--r-pill)",
        boxShadow: "var(--shadow-1)",
      }}>
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" style={{ flexShrink: 0, color: "var(--ink-3)" }}>
          <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.4"/>
          <path d="M13 13 L17 17" stroke="currentColor" strokeWidth="1.4"/>
        </svg>
        <input
          value={q}
          onChange={(e)=>{ setQ(e.target.value); setOpen(true); }}
          onFocus={()=>setOpen(true)}
          onKeyDown={(e)=>{ if (e.key === "Enter") doSearch(); }}
          placeholder="Search your city or region… e.g. Cebu, Davao, Tagaytay"
          type="search"
          name="nd-region-q-2026"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          data-1p-ignore="true"
          data-lpignore="true"
          data-form-type="other"
          style={{
            flex: 1, border: 0, background: "transparent", color: "var(--ink)",
            fontFamily: "var(--sans)", fontSize: 16, padding: "14px 0", outline: "none",
            borderRadius: 0,
          }}
        />
        <button
          onClick={doSearch}
          className="door"
          style={{ borderRadius: "var(--r-pill)", padding: "12px 22px", fontSize: 14 }}
        >Search <span className="arrow">→</span></button>
      </div>

      {open && (
        <div className="surface" style={{
          position: "absolute", top: "calc(100% + 8px)", left: 0, right: 0, zIndex: 20,
          maxHeight: 360, overflowY: "auto", padding: 8,
          boxShadow: "var(--shadow-2)",
        }}>
          {filtered.length === 0 ? (
            <div style={{ padding: "24px 16px", textAlign: "center" }}>
              <div className="label" style={{ marginBottom: 12 }}>Nothing here yet</div>
              <button onClick={()=>{ onEmpty(q); setOpen(false); }} className="door door-creator" style={{ padding: "10px 18px", fontSize: 14 }}>
                Be the first in {q} →
              </button>
            </div>
          ) : filtered.map(r => {
            const c = countNear(r);
            const empty = c.creators === 0 && r.id !== "all";
            return (
              <button key={r.id}
                onClick={()=>{
                  if (empty) onEmpty(r.label);
                  else onSelectRegion(r);
                  setOpen(false); setQ(r.label);
                }}
                style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  width: "100%", textAlign: "left",
                  padding: "12px 16px", border: 0, background: "transparent",
                  borderRadius: "var(--r-sm)", cursor: "default",
                }}
                onMouseEnter={(e)=>e.currentTarget.style.background = "var(--paper-2)"}
                onMouseLeave={(e)=>e.currentTarget.style.background = "transparent"}
              >
                <span style={{ fontFamily: "var(--serif)", fontSize: 22 }}>{r.label}</span>
                <span className="label" style={{ color: empty ? "var(--creator)" : "var(--ink-3)" }}>
                  {empty ? "— be the first" : (
                    <>
                      <span style={{ color: "var(--ink)", fontFamily: "var(--mono)" }}>{c.creators}</span> creators ·{" "}
                      <span style={{ color: "var(--ink)", fontFamily: "var(--mono)" }}>{c.businesses}</span> sites
                    </>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Map section ──────────────────────────────────────────────────────────────
function MapSection({ T, filter, setFilter, category, setCategory, mapView, setMapView, listMode, setListMode, search, setSearch, onSelectCreator, onSelectBusiness, theme, onBeFirst }) {
  return (
    <section style={{ padding: "32px 0 56px" }}>
      <div className="container-wide">
        <div className="sect-h" style={{ marginBottom: 24 }}>
          <div className="eyebrow">§ 02 — The Spine</div>
          <div>
            <h2 className="display-2">{T.map_title}</h2>
            <p className="lede" style={{ marginTop: 12, maxWidth: "60ch" }}>{T.map_sub}</p>
          </div>
        </div>

        {/* Region search bar */}
        <RegionSearch
          onSelectRegion={(r)=>{
            if (window.LiveMap?.flyTo) window.LiveMap.flyTo(r.center, r.zoom);
            setListMode(false);
          }}
          onEmpty={onBeFirst}
        />

        {/* Filter bar */}
        <div style={{
          display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center",
          padding: "12px 4px",
          marginBottom: 12,
        }}>
          <div style={{ display: "flex", gap: 6, marginRight: 12 }}>
            <Pill active={filter==="all"} onClick={()=>setFilter("all")}>Both</Pill>
            <Pill active={filter==="creators"} onClick={()=>setFilter("creators")}>
              <Dot color="var(--creator)" />Creators
            </Pill>
            <Pill active={filter==="businesses"} onClick={()=>setFilter("businesses")}>
              <Square color="var(--business)" />Businesses
            </Pill>
          </div>
          <div style={{ width: 1, height: 20, background: "var(--rule)" }}></div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {window.CATEGORIES.map(c => (
              <Pill key={c} active={category===c} onClick={()=>setCategory(c)}>{c}</Pill>
            ))}
          </div>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            <input
              placeholder="Find creators near…"
              value={search} onChange={(e)=>setSearch(e.target.value)}
              style={{
                border: "1px solid var(--rule)", padding: "8px 12px",
                background: "var(--paper-3)", color: "var(--ink)",
                fontFamily: "var(--sans)", fontSize: 13, width: 220,
                borderRadius: 999,
              }}
            />
            <div style={{ display: "flex", border: "1px solid var(--rule)", borderRadius: 999, overflow: "hidden" }}>
              <button onClick={()=>setListMode(false)} className="label" style={tabBtn(!listMode)}>Map</button>
              <button onClick={()=>setListMode(true)} className="label" style={tabBtn(listMode)}>List</button>
            </div>
          </div>
        </div>

        {/* The map itself */}
        <div className="map-frame" style={{
          position: "relative",
          height: 640,
          border: "1px solid var(--rule)",
          background: "var(--paper-2)",
        }}>
          {!listMode && (
            <window.LiveMap
              filter={filter} category={category}
              theme={theme} initialView={mapView}
              searchQuery={search}
              onSelectCreator={onSelectCreator}
              onSelectBusiness={onSelectBusiness}
            />
          )}
          {listMode && <MapList onSelectCreator={onSelectCreator} onSelectBusiness={onSelectBusiness} filter={filter} category={category} search={search} />}

          {/* Legend */}
          {!listMode && (
            <div style={{
              position: "absolute", left: 16, bottom: 16, zIndex: 500,
              background: "var(--paper-3)", border: "1px solid var(--rule)",
              padding: "12px 14px", display: "flex", flexDirection: "column", gap: 8,
              fontSize: 12, fontFamily: "var(--sans)",
            }}>
              <div className="label" style={{ marginBottom: 2 }}>Legend</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Dot color="var(--creator)" />
                <span>Creator</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Square color="var(--business)" />
                <span>Business · live site</span>
              </div>
            </div>
          )}

          {/* View toggle */}
          {!listMode && (
            <div style={{
              position: "absolute", right: 16, bottom: 16, zIndex: 500,
              display: "flex", gap: 6,
            }}>
              <button className="label" style={miniBtn()} onClick={()=>window.LiveMap.fitPhilippines()}>
                ⌂ Philippines
              </button>
              <button className="label" style={miniBtn()} onClick={()=>window.LiveMap.fitGlobe()}>
                ⊕ Globe
              </button>
            </div>
          )}
        </div>

        {/* footnote */}
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 16, fontSize: 12, color: "var(--ink-3)" }}>
          <span className="label">Showing {filter==="businesses" ? window.BUSINESSES.length : window.CREATORS.length} pins · first 50 always load first</span>
          <span className="label">No creators in your area? <a style={{ color: "var(--creator)", borderBottom: "1px solid currentColor" }}>Be the first →</a></span>
        </div>
      </div>
    </section>
  );
}

function tabBtn(active) {
  return {
    padding: "8px 14px", border: 0, cursor: "default",
    background: active ? "var(--ink)" : "transparent",
    color: active ? "var(--paper)" : "var(--ink-2)",
  };
}
function miniBtn() {
  return {
    padding: "8px 12px", border: "1px solid var(--rule)",
    background: "var(--paper-3)", color: "var(--ink-2)",
    cursor: "default",
  };
}
function Pill({ active, onClick, children }) {
  return <button className="pill" aria-pressed={!!active} onClick={onClick}>{children}</button>;
}
function Dot({ color }) {
  return <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, display: "inline-block" }}></span>;
}
function Square({ color }) {
  return <span style={{ width: 8, height: 8, background: color, display: "inline-block", transform: "rotate(45deg)" }}></span>;
}

function MapList({ filter, category, search, onSelectCreator, onSelectBusiness }) {
  const items = [];
  if (filter !== "businesses") {
    window.CREATORS.forEach(c => {
      if (search && !c.name.toLowerCase().includes(search.toLowerCase()) && !c.city.toLowerCase().includes(search.toLowerCase())) return;
      items.push({ kind: "creator", data: c });
    });
  }
  if (filter !== "creators") {
    window.BUSINESSES.forEach(b => {
      if (category !== "All" && b.category !== category) return;
      if (search && !b.name.toLowerCase().includes(search.toLowerCase()) && !b.city.toLowerCase().includes(search.toLowerCase())) return;
      items.push({ kind: "business", data: b });
    });
  }
  return (
    <div style={{ height: "100%", overflowY: "auto", padding: 24 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 1, background: "var(--rule)" }}>
        {items.map((it, i) => it.kind === "creator" ? (
          <button key={"l-"+i} onClick={()=>onSelectCreator(it.data)} style={listCardStyle()}>
            <window.Avatar name={it.data.name} hue={it.data.hue} size={44} />
            <div style={{ textAlign: "left", marginLeft: 12, flex: 1 }}>
              <div style={{ fontWeight: 500 }}>{it.data.name}</div>
              <div className="label" style={{ marginTop: 2 }}>{it.data.city} · {it.data.sites} sites</div>
            </div>
            <Dot color="var(--creator)" />
          </button>
        ) : (
          <button key={"l-"+i} onClick={()=>onSelectBusiness(it.data)} style={listCardStyle()}>
            <div className="stripes" style={{ width: 44, height: 44, border: "1px solid var(--rule)" }}></div>
            <div style={{ textAlign: "left", marginLeft: 12, flex: 1 }}>
              <div style={{ fontWeight: 500 }}>{it.data.data?.name || it.data.name}</div>
              <div className="label" style={{ marginTop: 2 }}>{it.data.category} · {it.data.city}</div>
            </div>
            <Square color="var(--business)" />
          </button>
        ))}
      </div>
    </div>
  );
}
function listCardStyle() {
  return {
    display: "flex", alignItems: "center", gap: 4,
    padding: 14, background: "var(--paper-3)",
    border: 0, cursor: "default", width: "100%",
  };
}

Object.assign(window, { TopBar, ReferralBanner, Hero, MapSection, Logo, useTickUp, fmt, Pill, Dot, Square, RegionSearch });
