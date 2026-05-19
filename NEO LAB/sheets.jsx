// sheets.jsx — Creator detail panel + Business detail panel.
// Desktop-led: right-side modal. Tablet/mobile: full-width bottom sheet.
const { useEffect: useEffect_s, useState: useState_s } = React;

function Avatar({ name, hue = 35, size = 56, initial }) {
  const ch = initial || (name || "?")[0];
  return (
    <div
      className="avatar"
      style={{
        width: size, height: size,
        fontSize: size * 0.42,
        background: `oklch(58% 0.14 ${hue})`,
        color: "white",
      }}
    >{ch}</div>
  );
}

function CreatorSheet({ creator, onClose }) {
  // hooks must be unconditional; useEffect handles null creator internally
  useEffect_s(() => {
    if (!creator) return;
    const k = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [creator, onClose]);

  const open = !!creator;
  const C = creator || {};

  return (
    <>
      <div className={`sheet-backdrop ${open ? "open" : ""}`} onClick={onClose}></div>
      <aside className={`sheet sheet-desktop ${open ? "open" : ""}`}>
        <div style={{ padding: 32, height: "100%", overflowY: "auto", display: "flex", flexDirection: "column" }}>
          {/* Close */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 }}>
            <span className="label">Creator profile</span>
            <button
              onClick={onClose}
              aria-label="Close"
              style={{
                width: 32, height: 32, border: "1px solid var(--rule)",
                background: "var(--paper-3)", color: "var(--ink)",
                cursor: "default", fontSize: 14,
              }}
            >×</button>
          </div>

          {/* Identity */}
          <div style={{ display: "flex", gap: 20, alignItems: "center", marginBottom: 32 }}>
            <Avatar name={C.name} hue={C.hue} size={72} />
            <div>
              <div className="display-3" style={{ marginBottom: 4 }}>
                {C.name}<span style={{ color: "var(--ink-3)" }}>, {C.city}</span>
              </div>
              <div className="label" style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                <span className="live-dot"></span>
                {C.response}
              </div>
            </div>
          </div>

          {/* Stats strip */}
          <div style={{
            display: "grid", gridTemplateColumns: "1fr 1fr 1fr",
            border: "1px solid var(--rule)",
            marginBottom: 32,
          }}>
            <Stat label="Sites delivered" value={C.sites} />
            <Stat label="Languages" value={(C.langs || []).join(" · ")} small />
            <Stat label="Distance" value={["~", Math.floor(Math.random()*8) + 2, " km"].join("")} />
          </div>

          {/* Sample work */}
          <div className="label" style={{ marginBottom: 12 }}>Recent work</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 1, marginBottom: 32, background: "var(--rule)" }}>
            {(C.samples || []).map((s, i) => (
              <div key={i} style={{
                background: "var(--paper-3)", padding: "14px 16px",
                display: "flex", justifyContent: "space-between", alignItems: "center",
              }}>
                <div>
                  <div style={{ fontWeight: 500 }}>{s}</div>
                  <div className="label" style={{ marginTop: 2 }}>Live · {2024 + (i % 2)}.{["09","11","02"][i] || "08"}</div>
                </div>
                <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink-3)" }}>→</div>
              </div>
            ))}
          </div>

          {/* Languages bullet */}
          <div style={{
            padding: "16px 0", borderTop: "1px solid var(--rule)", borderBottom: "1px solid var(--rule)",
            marginBottom: 32, fontSize: 14, color: "var(--ink-2)", lineHeight: 1.6,
          }}>
            <strong style={{ color: "var(--ink)" }}>{C.name}</strong> interviews in {(C.langs || []).join(", ")},
            shoots on a recent phone, and ships sites that work on a 3G connection. No call center vibes.
          </div>

          {/* CTA */}
          <div style={{ marginTop: "auto", paddingTop: 16 }}>
            <button className="door door-creator" style={{ width: "100%", display: "flex", justifyContent: "space-between" }}>
              <span>
                <span className="meta">Highest-intent path</span>
                Get the app to hire {C.name}
              </span>
              <span className="arrow">↗</span>
            </button>
            <p className="label" style={{ marginTop: 12, textAlign: "center" }}>
              Booking opens inside the app · {C.name}'s ID is pre-attached
            </p>
          </div>
        </div>
      </aside>
    </>
  );
}

function Stat({ label, value, small }) {
  return (
    <div style={{ padding: "16px 18px", borderRight: "1px solid var(--rule)" }}>
      <div className="label" style={{ marginBottom: 8 }}>{label}</div>
      <div className="serif" style={{
        fontSize: small ? 16 : 28, lineHeight: 1.0,
        letterSpacing: "-.01em",
      }}>{value}</div>
    </div>
  );
}

function BusinessSheet({ business, onClose }) {
  useEffect_s(() => {
    if (!business) return;
    const k = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [business, onClose]);

  const open = !!business;
  const B = business || {};
  const creator = open && window.CREATORS.find(c => c.id === B.creator);

  return (
    <>
      <div className={`sheet-backdrop ${open ? "open" : ""}`} onClick={onClose}></div>
      <aside className={`sheet sheet-desktop ${open ? "open" : ""}`}>
        <div style={{ padding: 32, height: "100%", overflowY: "auto", display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 }}>
            <span className="label">Business · live site</span>
            <button
              onClick={onClose} aria-label="Close"
              style={{
                width: 32, height: 32, border: "1px solid var(--rule)",
                background: "var(--paper-3)", color: "var(--ink)",
                cursor: "default", fontSize: 14,
              }}
            >×</button>
          </div>

          {/* Site thumbnail placeholder */}
          <div className="stripes ar-16x9" style={{
            border: "1px solid var(--rule)", marginBottom: 20, position: "relative",
            display: "flex", alignItems: "flex-end",
          }}>
            <div style={{
              position: "absolute", top: 12, left: 12,
              fontFamily: "var(--mono)", fontSize: 10, color: "var(--ink-3)",
              padding: "4px 8px", background: "var(--paper-3)",
              border: "1px solid var(--rule)",
            }}>screenshot — {B.name}</div>
            <div style={{
              margin: 12, padding: "6px 10px",
              background: "var(--ink)", color: "var(--paper)",
              fontFamily: "var(--mono)", fontSize: 10, letterSpacing: ".08em", textTransform: "uppercase",
            }}>
              <span className="live-dot" style={{ marginRight: 6 }}></span>
              Live since {B.builtOn}
            </div>
          </div>

          <div className="display-3" style={{ marginBottom: 6 }}>{B.name}</div>
          <div style={{ color: "var(--ink-3)", marginBottom: 24, fontSize: 14 }}>
            <span className="tag" style={{ marginRight: 8 }}>{B.category}</span>
            {B.city}
          </div>

          <div style={{
            padding: "16px 0", borderTop: "1px solid var(--rule)", borderBottom: "1px solid var(--rule)",
            marginBottom: 24,
          }}>
            <div className="label" style={{ marginBottom: 12 }}>Built by</div>
            {creator && (
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <Avatar name={creator.name} hue={creator.hue} size={40} />
                <div>
                  <div style={{ fontWeight: 500 }}>{creator.name}</div>
                  <div className="label" style={{ marginTop: 2 }}>{creator.city} · {creator.sites} sites delivered</div>
                </div>
              </div>
            )}
          </div>

          <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 10 }}>
            <button className="door" style={{ display: "flex", justifyContent: "space-between" }}>
              <span><span className="meta">Strongest possible proof</span>Visit live site</span>
              <span className="arrow">↗</span>
            </button>
            <button className="door door-business" style={{ display: "flex", justifyContent: "space-between" }}>
              <span><span className="meta">Want one of these?</span>Get the app to find a creator</span>
              <span className="arrow">↗</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}

Object.assign(window, { CreatorSheet, BusinessSheet, Avatar });
