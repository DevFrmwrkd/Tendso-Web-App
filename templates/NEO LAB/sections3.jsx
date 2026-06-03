// sections3.jsx — How to Apply (creator onboarding), Knowledge Base, Be-the-first modal, Chatbot.
const { useState: useStateC, useEffect: useEffectC, useRef: useRefC } = React;

// ── How to Apply (creator onboarding journey) ───────────────────────────────
function HowToApply({ onPickDoor }) {
  const steps = [
    {
      n: "01",
      h: "Tap “I want to earn”",
      sub: "Open the app store from this page. No form on the web.",
      meta: "30 seconds",
    },
    {
      n: "02",
      h: "Verify your phone & ID",
      sub: "GCash-grade KYC inside the app. Selfie + a valid ID. We hold your data for payouts only.",
      meta: "5 minutes",
    },
    {
      n: "03",
      h: "Take the certification",
      sub: "Twelve short videos. A photo quiz. An interview rehearsal with a fake shop owner. You can retry as many times as you need.",
      meta: "20 minutes",
    },
    {
      n: "04",
      h: "Pin yourself on the map",
      sub: "You show up here, on this page, in front of every business owner in your area looking for a creator.",
      meta: "instant",
    },
    {
      n: "05",
      h: "Accept your first booking",
      sub: "Either a business taps you, or you pick one from your queue. Bring a phone, bring patience. The app guides every step.",
      meta: "same day",
    },
    {
      n: "06",
      h: "Deliver. Get paid.",
      sub: "₱500 lands in your GCash within 48 hours of the business approving the site. Refer a friend, earn another ₱500 when their first business goes live.",
      meta: "48 hours",
    },
  ];

  return (
    <section style={{ background: "var(--paper-2)" }}>
      <div className="container-wide">
        <div className="sect-h">
          <div className="eyebrow">§ 06 — How to Apply</div>
          <div>
            <h2 className="display-2">
              From this page <em>to your first payout</em>.
            </h2>
            <p className="lede" style={{ marginTop: 12 }}>
              The whole apply-and-certify flow lives inside the app. Here's what it looks like, in order, with the time each step actually takes.
            </p>
          </div>
        </div>

        <div className="surface" style={{ padding: 0 }}>
          {steps.map((s, i) => (
            <div key={s.n} style={{
              display: "grid",
              gridTemplateColumns: "80px 1fr 1fr 200px",
              gap: 32,
              padding: "32px 36px",
              borderTop: i === 0 ? "none" : "1px solid var(--rule)",
              alignItems: "baseline",
            }}>
              <div className="counter-num" style={{ fontSize: 36, color: "var(--creator)" }}>{s.n}</div>
              <div className="serif" style={{ fontSize: 28, lineHeight: 1.15, letterSpacing: "-.015em" }}>
                {s.h}
              </div>
              <div style={{ fontSize: 14, color: "var(--ink-2)", lineHeight: 1.55, maxWidth: "44ch" }}>
                {s.sub}
              </div>
              <div style={{ textAlign: "right" }}>
                <span className="tag" style={{ background: "var(--paper-3)" }}>{s.meta}</span>
              </div>
            </div>
          ))}
        </div>

        <div style={{
          marginTop: 32,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 16,
          flexWrap: "wrap",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span className="tag" style={{ background: "var(--paper-3)" }}>Free to apply</span>
            <span className="tag" style={{ background: "var(--paper-3)" }}>No experience required</span>
            <span className="tag" style={{ background: "var(--paper-3)" }}>Keep your day job</span>
          </div>
          <button onClick={()=>onPickDoor("creator")} className="door door-creator" style={{ padding: "16px 24px" }}>
            <span>Start the certification</span>
            <span className="arrow">↗</span>
          </button>
        </div>
      </div>
    </section>
  );
}

// ── Knowledge Base (CMS-ready) ──────────────────────────────────────────────
function KnowledgeBase() {
  const [activeCat, setActiveCat] = useStateC("All");
  const [open, setOpen] = useStateC(null);
  const cats = ["All", ...Array.from(new Set(window.KNOWLEDGE_BASE.map(k => k.category)))];
  const items = activeCat === "All" ? window.KNOWLEDGE_BASE : window.KNOWLEDGE_BASE.filter(k => k.category === activeCat);

  return (
    <section>
      <div className="container-wide">
        <div className="sect-h">
          <div className="eyebrow">§ 09 — Knowledge</div>
          <div>
            <h2 className="display-2">
              The <em>knowledge base</em>.
            </h2>
            <p className="lede" style={{ marginTop: 12 }}>
              A living collection of guides, interviews, and answers. New entries added weekly by the team and by creators. The chat bot in the corner is trained on it.
            </p>
          </div>
        </div>

        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 24 }}>
          {cats.map(c => (
            <window.Pill key={c} active={activeCat === c} onClick={()=>setActiveCat(c)}>{c}</window.Pill>
          ))}
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
            <span className="label">{window.KNOWLEDGE_BASE.length} entries</span>
            <span className="tag tag-live">
              <span className="live-dot" style={{ marginRight: 6 }}></span>
              Updated weekly
            </span>
          </div>
        </div>

        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
          gap: 16,
        }}>
          {items.map(it => (
            <button
              key={it.id}
              onClick={()=>setOpen(open === it.id ? null : it.id)}
              className="lift card"
              style={{
                padding: 24,
                textAlign: "left",
                cursor: "default",
                display: "flex", flexDirection: "column", gap: 12,
                background: "var(--paper-3)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span className="tag" style={{ background: "var(--paper-2)" }}>{it.category}</span>
                <span className="label">{it.read}</span>
              </div>
              <div className="serif" style={{ fontSize: 22, lineHeight: 1.2, letterSpacing: "-.01em" }}>
                {it.title}
              </div>
              <p style={{
                margin: 0,
                fontSize: 14, color: "var(--ink-2)", lineHeight: 1.55,
              }}>
                {open === it.id ? it.excerpt : it.excerpt.slice(0, 100) + "…"}
              </p>
              <div style={{ marginTop: "auto", paddingTop: 4, color: "var(--ink-3)", fontSize: 12, display: "flex", justifyContent: "space-between" }}>
                <span>Read full →</span>
                <span className="label">Auto-translated</span>
              </div>
            </button>
          ))}
        </div>

        <div style={{
          marginTop: 32,
          padding: "20px 28px",
          background: "var(--paper-2)",
          border: "1px dashed var(--rule-strong)",
          borderRadius: "var(--r-lg)",
          display: "flex", justifyContent: "space-between", alignItems: "center",
          gap: 16, flexWrap: "wrap",
        }}>
          <div>
            <div className="label" style={{ marginBottom: 4 }}>CMS collection</div>
            <div style={{ fontSize: 14, color: "var(--ink-2)" }}>
              Editors add new entries from the admin. Each entry is automatically indexed for the chat bot and translated into the app's supported locales.
            </div>
          </div>
          <button className="door door-ghost" style={{ padding: "12px 18px", fontSize: 14 }}>
            See all entries →
          </button>
        </div>
      </div>
    </section>
  );
}

// ── Be-the-first Modal ──────────────────────────────────────────────────────
function BeTheFirstModal({ city, onClose, onPickDoor }) {
  useEffectC(() => {
    if (!city) return;
    const k = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [city, onClose]);

  const open = !!city;
  return (
    <div className={`modal-backdrop ${open ? "open" : ""}`} onClick={onClose}>
      <div className="modal-card" onClick={(e)=>e.stopPropagation()}>
        <div style={{
          padding: "32px 36px",
          background: "var(--creator-bg)",
          borderBottom: "1px solid var(--rule)",
          position: "relative",
        }}>
          <button
            onClick={onClose} aria-label="Close"
            style={{
              position: "absolute", top: 16, right: 16,
              width: 32, height: 32, borderRadius: "50%",
              border: "1px solid var(--rule)", background: "var(--paper-3)", color: "var(--ink)",
              cursor: "default", fontSize: 14,
            }}
          >×</button>
          <div className="eyebrow" style={{ marginBottom: 12, color: "var(--creator-ink)" }}>
            Empty region
          </div>
          <div className="display-2" style={{ fontSize: 44, lineHeight: 1.05 }}>
            No creators in <em style={{ color: "var(--creator)" }}>{city}</em> yet.
          </div>
          <p style={{ marginTop: 16, color: "var(--ink-2)", lineHeight: 1.55, fontSize: 15 }}>
            That's the opportunity. Be the first certified creator in {city} and own the whole region for the next year — every business looking here sees you first.
          </p>
        </div>
        <div style={{ padding: "24px 36px 32px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 1, background: "var(--rule)", border: "1px solid var(--rule)", borderRadius: "var(--r-md)", overflow: "hidden", marginBottom: 24 }}>
            <ModalStat v="₱500" l="per site you deliver" />
            <ModalStat v="₱500" l="per friend you refer" />
            <ModalStat v="Free" l="certification + tools" />
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={()=>{ onPickDoor("creator"); onClose(); }} className="door door-creator" style={{ flex: 1, justifyContent: "space-between" }}>
              <span>Apply as a creator in {city}</span>
              <span className="arrow">↗</span>
            </button>
          </div>
          <p className="label" style={{ marginTop: 14, textAlign: "center" }}>
            Or — <a style={{ color: "var(--ink)", borderBottom: "1px solid currentColor" }} onClick={onClose}>browse other regions on the map</a>
          </p>
        </div>
      </div>
    </div>
  );
}

function ModalStat({ v, l }) {
  return (
    <div style={{ background: "var(--paper-3)", padding: "16px 14px", textAlign: "center" }}>
      <div className="counter-num" style={{ fontSize: 28 }}>{v}</div>
      <div className="label" style={{ marginTop: 6 }}>{l}</div>
    </div>
  );
}

// ── Chat Bot ────────────────────────────────────────────────────────────────
function ChatBot() {
  const [open, setOpen] = useStateC(false);
  const [messages, setMessages] = useStateC([
    { role: "bot", text: "Hi — I'm trained on the Negosyo knowledge base. Ask me anything." },
    { role: "bot", text: "Try: \"How much do I earn?\" or \"How long does a website take?\"" },
  ]);
  const [input, setInput] = useStateC("");
  const [busy, setBusy] = useStateC(false);
  const scrollRef = useRefC(null);

  useEffectC(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, open]);

  const ask = async () => {
    const q = input.trim();
    if (!q || busy) return;
    setInput("");
    setMessages(m => [...m, { role: "user", text: q }]);
    setBusy(true);

    // Build context from KB
    const kb = window.KNOWLEDGE_BASE.map(k => `- [${k.category}] ${k.title}: ${k.excerpt}`).join("\n");
    const system = `You are Negosyo Digital's friendly support bot. Be very brief (max 3 short sentences). Sound human, not corporate. The platform: a Filipino creator visits a business owner's shop and ships them a real website for ₱1,000 total — the creator earns ₱500. Creators also earn ₱500 for every friend they refer who lands their first business. Use the knowledge base below to answer. If you don't know, suggest they get the app.

Knowledge base:
${kb}`;

    try {
      const reply = await window.claude.complete({
        messages: [
          { role: "user", content: `${system}\n\nQuestion: ${q}` },
        ],
      });
      setMessages(m => [...m, { role: "bot", text: reply }]);
    } catch (e) {
      setMessages(m => [...m, { role: "bot", text: "Hmm, I'm having trouble right now. Try the knowledge base above, or grab the app — the in-app help is fully staffed." }]);
    } finally {
      setBusy(false);
    }
  };

  const suggestions = [
    "How much does a site cost?",
    "How fast can I get one?",
    "Where do payouts go?",
    "Do I need experience?",
  ];

  return (
    <>
      {open && (
        <div className="chatbot-window" role="dialog" aria-label="Chat with us">
          <div style={{
            padding: "16px 20px",
            borderBottom: "1px solid var(--rule)",
            display: "flex", justifyContent: "space-between", alignItems: "center",
            background: "var(--paper)",
          }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span className="live-dot"></span>
                <span style={{ fontFamily: "var(--serif)", fontSize: 22, fontStyle: "italic", letterSpacing: "-.01em" }}>Ask Negosyo</span>
              </div>
              <div className="label" style={{ marginTop: 4 }}>Powered by our knowledge base</div>
            </div>
            <button onClick={()=>setOpen(false)} aria-label="Close chat" style={{
              width: 30, height: 30, borderRadius: "50%",
              border: "1px solid var(--rule)", background: "var(--paper-3)", color: "var(--ink)",
              cursor: "default", fontSize: 14,
            }}>×</button>
          </div>

          <div ref={scrollRef} style={{
            flex: 1, padding: 16,
            display: "flex", flexDirection: "column", gap: 10,
            overflowY: "auto", maxHeight: 320,
          }}>
            {messages.map((m, i) => (
              <div key={i} style={{
                alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                background: m.role === "user" ? "var(--ink)" : "var(--paper-2)",
                color: m.role === "user" ? "var(--paper)" : "var(--ink)",
                padding: "10px 14px",
                borderRadius: m.role === "user" ? "var(--r-md) var(--r-md) 4px var(--r-md)" : "var(--r-md) var(--r-md) var(--r-md) 4px",
                fontSize: 14, lineHeight: 1.45,
                maxWidth: "85%",
              }}>{m.text}</div>
            ))}
            {busy && (
              <div style={{ alignSelf: "flex-start", color: "var(--ink-3)", fontSize: 13, padding: "8px 12px" }}>
                <span className="live-dot" style={{ marginRight: 6 }}></span>typing…
              </div>
            )}
          </div>

          <div style={{
            padding: "10px 16px",
            display: "flex", flexWrap: "wrap", gap: 6,
            borderTop: "1px solid var(--rule)",
          }}>
            {suggestions.map(s => (
              <button key={s} onClick={()=>{ setInput(s); }} className="tag" style={{ cursor: "default" }}>
                {s}
              </button>
            ))}
          </div>

          <div style={{
            padding: 12,
            display: "flex", gap: 8,
            borderTop: "1px solid var(--rule)",
            background: "var(--paper)",
          }}>
            <input
              value={input}
              onChange={(e)=>setInput(e.target.value)}
              onKeyDown={(e)=>{ if (e.key === "Enter") ask(); }}
              placeholder="Type a question…"
              style={{
                flex: 1, border: "1px solid var(--rule)",
                background: "var(--paper-3)", color: "var(--ink)",
                padding: "10px 14px", borderRadius: "var(--r-pill)",
                fontFamily: "var(--sans)", fontSize: 14, outline: "none",
              }}
            />
            <button
              onClick={ask}
              disabled={!input.trim() || busy}
              style={{
                width: 40, height: 40, borderRadius: "50%",
                border: 0, background: "var(--ink)", color: "var(--paper)",
                cursor: "default", fontSize: 16,
                opacity: !input.trim() || busy ? .4 : 1,
              }}
              aria-label="Send"
            >↑</button>
          </div>
        </div>
      )}

      <button
        className="chatbot-fab"
        onClick={()=>setOpen(o => !o)}
        aria-label={open ? "Close chat" : "Open chat"}
      >
        {open ? (
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
            <path d="M5 5 L17 17 M17 5 L5 17" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
          </svg>
        ) : (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M4 6 C4 4.9 4.9 4 6 4 H18 C19.1 4 20 4.9 20 6 V14 C20 15.1 19.1 16 18 16 H10 L6 20 V16 H6 C4.9 16 4 15.1 4 14 V6 Z"
              stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/>
            <circle cx="9" cy="10" r="1" fill="currentColor"/>
            <circle cx="12" cy="10" r="1" fill="currentColor"/>
            <circle cx="15" cy="10" r="1" fill="currentColor"/>
          </svg>
        )}
      </button>
    </>
  );
}

// ── The Process (main page) ──────────────────────────────────────────────
function TheProcess() {
  const steps = [
    { k: "01", h: "Creator visits the shop", sub: "A trained Negosyo creator walks in with a phone and a checklist. 30 minutes of questions, coffee on you." },
    { k: "02", h: "Photos get processed", sub: "Their shots go through our auto-grading pipeline. Color, crop, exposure — levelled to a national standard." },
    { k: "03", h: "Copy gets written", sub: "Your story, in your voice, shaped by our editors. Translated automatically into every locale you serve." },
    { k: "04", h: "Your Online Kit ships", sub: "Website. Domain. Hosting. SEO. Social-ready assets. Auto-generated menu and price list. Not a homepage — a full kit." },
  ];
  return (
    <section style={{ padding: "96px 0" }}>
      <div className="container-wide">
        <div className="sect-h">
          <div className="eyebrow">§ Process</div>
          <div>
            <h2 className="display-2">
              We don’t ship websites. <em style={{ fontStyle: "italic" }}>We ship Online Kits.</em>
            </h2>
            <p className="lede" style={{ marginTop: 12 }}>
              Four moves, one outcome. The business owner answers questions. Everything else happens off-stage.
            </p>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, alignItems: "stretch" }}>
          {steps.map((s, i) => (
            <ProcessCard key={s.k} step={s} index={i} />
          ))}
        </div>

        <div style={{ marginTop: 32, padding: "20px 28px", border: "1px dashed var(--rule-strong)", borderRadius: "var(--r-lg)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span className="label">An Online Kit includes</span>
            <span className="tag">Website</span>
            <span className="tag">Domain</span>
            <span className="tag">Hosting</span>
            <span className="tag">SEO</span>
            <span className="tag">Social assets</span>
            <span className="tag">Menu / pricelist</span>
            <span className="tag">Open-graph card</span>
          </div>
          <span className="label" style={{ color: "var(--creator)" }}>72 hours, end to end ↗</span>
        </div>
      </div>
    </section>
  );
}

function ProcessCard({ step, index }) {
  // Tiny editorial icons drawn inline; no external assets.
  const icons = {
    "01": (
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
        <path d="M24 6 C16 6 10 12 10 20 C10 30 24 42 24 42 C24 42 38 30 38 20 C38 12 32 6 24 6 Z" stroke="currentColor" strokeWidth="1.5"/>
        <circle cx="24" cy="20" r="4" fill="currentColor"/>
      </svg>
    ),
    "02": (
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
        <rect x="8" y="14" width="32" height="24" rx="3" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M16 14 L18 10 L30 10 L32 14" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
        <circle cx="24" cy="26" r="6" stroke="currentColor" strokeWidth="1.5"/>
        <circle cx="24" cy="26" r="2" fill="currentColor"/>
      </svg>
    ),
    "03": (
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
        <path d="M10 12 H38" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M10 20 H32" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M10 28 H36" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M10 36 H22" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M28 32 L36 40" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
    "04": (
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
        <rect x="8" y="8" width="32" height="32" rx="2" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M8 16 H40" stroke="currentColor" strokeWidth="1.5"/>
        <circle cx="13" cy="12" r="1" fill="currentColor"/>
        <circle cx="17" cy="12" r="1" fill="currentColor"/>
        <path d="M14 24 H28" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M14 30 H34" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M14 36 H24" stroke="currentColor" strokeWidth="1.5"/>
      </svg>
    ),
  };
  return (
    <div className="card" style={{
      padding: 24,
      display: "flex", flexDirection: "column", gap: 16,
      background: index === 3 ? "var(--ink)" : "var(--paper-3)",
      color: index === 3 ? "var(--paper)" : "var(--ink)",
      borderColor: index === 3 ? "var(--ink)" : "var(--rule)",
      position: "relative",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span className="counter-num" style={{ fontSize: 28, color: index === 3 ? "var(--creator)" : "var(--ink-3)" }}>{step.k}</span>
        <span style={{ color: index === 3 ? "oklch(72% 0.008 85)" : "var(--ink-3)" }}>{icons[step.k]}</span>
      </div>
      <div className="serif" style={{ fontSize: 26, lineHeight: 1.15, letterSpacing: "-.015em" }}>{step.h}</div>
      <div style={{ fontSize: 13, color: index === 3 ? "oklch(80% 0.008 85)" : "var(--ink-2)", lineHeight: 1.55, marginTop: "auto" }}>
        {step.sub}
      </div>
      {index < 3 && (
        <div style={{
          position: "absolute",
          right: -10, top: "calc(50% - 8px)",
          width: 20, height: 16,
          display: "none",
        }}>→</div>
      )}
    </div>
  );
}

// ── BUSINESS · Online Kit list (used on business sub-page) ────────────────────────
Object.assign(window, { HowToApply, KnowledgeBase, BeTheFirstModal, ChatBot, TheProcess });
