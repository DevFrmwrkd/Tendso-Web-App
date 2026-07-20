"use client";

/* Headings are subject + verb on purpose: the old noun phrases ("A photo",
   "A guided page") never said WHO does the step, which is the owner's first
   question. Now every card answers "we" or "you" in its first two words.
   `cost` is what the step takes out of the owner's day — the one fact neither
   HowItWorks above nor the Manifesto below carries. 10 + 20 is the "30 minutes,
   your shop" already promised in HowItWorks.tsx:75; keep the numbers in step if
   either moves. Steps 03 and 04 take no fixed time, so they say so rather than
   inventing a number we'd have to honour. */
const STEPS = [
    {
        k: "01",
        h: "We take the photos",
        cost: "10 min",
        sub: "Someone from Tendso comes to your shop and takes pictures of your work, your place, and you. You don't need to prepare anything or tidy up.",
    },
    {
        k: "02",
        h: "You answer a few questions",
        cost: "20 min",
        sub: "They ask you simple questions while you keep working — the same things you'd tell a customer who walked in. No writing, no computer.",
    },
    {
        k: "03",
        h: "We build your page",
        cost: "none of it yours",
        sub: "We put your photos and your answers together into your own website. You don't design anything, and you don't pick from a list of layouts.",
    },
    {
        k: "04",
        h: "You check it, then it's live",
        cost: "one look",
        sub: "We show it to you first. Change something, or leave it exactly as it is. Then it goes online, and you get back to work.",
    },
];

/* Plain words only. The step copy above promises "no design vocabulary", so the
   list of what you get can't say SEO, hosting, or open-graph card. */
const KIT = [
    "Your own website",
    "Your own web address",
    "We keep it online",
    "Easy to find on Google",
    "Photos you can post",
    "Your menu or price list",
    "Looks right when shared",
];

/* Deliberately plain and literal — a camera means photos, a question mark means
   questions. An earlier pass cut icons for restating their headings; that was a
   designer's objection, not a reader's. These sit small beside the number so
   they support it rather than take over the card. */
const ICONS: Record<string, React.ReactElement> = {
    "01": (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <rect x="2" y="6" width="20" height="14" rx="2.5" stroke="currentColor" strokeWidth="1.5" />
            <path d="M8 6 L9.5 3 L14.5 3 L16 6" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
            <circle cx="12" cy="13" r="4" stroke="currentColor" strokeWidth="1.5" />
        </svg>
    ),
    "02": (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M3 5.5 A2 2 0 0 1 5 3.5 H19 A2 2 0 0 1 21 5.5 V15 A2 2 0 0 1 19 17 H9 L4 21 V17 A2 2 0 0 1 3 15 Z"
                  stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
            <path d="M9.6 8.4 A2.4 2.4 0 1 1 12 11.4 V12.4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <circle cx="12" cy="14.8" r="1" fill="currentColor" />
        </svg>
    ),
    "03": (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <rect x="3" y="3" width="18" height="18" rx="2.5" stroke="currentColor" strokeWidth="1.5" />
            <path d="M3 8 H21" stroke="currentColor" strokeWidth="1.5" />
            <path d="M6.5 12 H14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M6.5 16 H17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
    ),
    "04": (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
            <path d="M3.2 9.5 H20.8 M3.2 14.5 H20.8" stroke="currentColor" strokeWidth="1.5" />
            <path d="M12 3 C9 6.5 9 17.5 12 21 M12 3 C15 6.5 15 17.5 12 21"
                  stroke="currentColor" strokeWidth="1.5" />
        </svg>
    ),
};

export default function ProcessSection() {
    return (
        <section>
            <div className="container-wide">
                <div className="sect-h">
                    <div className="eyebrow">Your part</div>
                    <div>
                        <h2 className="display-2">
                            You keep working. <em style={{ fontStyle: "italic" }}>We build the page.</em>
                        </h2>
                        <p className="lede" style={{ marginTop: 12 }}>
                            Half an hour of your time, all together. We do the rest.
                        </p>
                    </div>
                </div>

                {/* role="list" is explicit: list-style:none strips the list role in
                    Safari/VoiceOver, which would drop the "1 of 4" announcement. */}
                <ol className="process-track" role="list">
                    {STEPS.map((s, i) => (
                        <li
                            key={s.k}
                            className={`process-step${i === STEPS.length - 1 ? " is-final" : ""}`}
                        >
                            <div className="process-card">
                                <div className="process-node-row">
                                    <span className="process-mark">
                                        <span className="process-icon">{ICONS[s.k]}</span>
                                        <span className="process-node">{s.k}</span>
                                    </span>
                                    <span className="process-cost">{s.cost}</span>
                                </div>
                                <h3 className="process-h">{s.h}</h3>
                                <p className="process-sub">{s.sub}</p>
                            </div>
                        </li>
                    ))}
                </ol>

                <div className="process-kit">
                    <div className="process-kit-list">
                        <span className="label">What you get</span>
                        <div className="process-kit-tags">
                            {KIT.map((t) => (
                                <span key={t} className="tag">{t}</span>
                            ))}
                        </div>
                    </div>
                    <div className="process-turnaround">
                        <b>48–72h</b>
                        <span className="label">from start to finish</span>
                    </div>
                </div>
            </div>
        </section>
    );
}
