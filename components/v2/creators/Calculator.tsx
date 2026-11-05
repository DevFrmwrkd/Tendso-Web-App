"use client";

import { useId, useState, type CSSProperties } from "react";

import { BUSY, KEEP_PER_SHOP, OVERRIDE_PER_SALE, exampleMonth, peso, type Busy } from "@/lib/v2/creatorProgram";

const BUSY_KEYS: Busy[] = ["slow", "steady", "strong"];

const fill = (value: number, min: number, max: number) => ({ "--p": `${((value - min) / (max - min)) * 100}%` }) as CSSProperties;

/**
 * "Money now vs Monthly money": two sliders and how busy the recruited agents are. Every result
 * is labelled Example. The maths is lib/v2/creatorProgram.ts (exampleMonth).
 */
export function Calculator() {
    const [shops, setShops] = useState(5);
    const [agents, setAgents] = useState(40);
    const [busy, setBusy] = useState<Busy>("steady");
    const ids = { shops: useId(), agents: useId(), busy: useId() };
    const m = exampleMonth({ shops, agents, busy });
    const b = BUSY[busy];

    return (
        <>
            <div className="cp-calc" data-reveal>
                <div className="cp-calc-in">
                    <div className="cp-field">
                        <div className="cp-field-h">
                            <label className="ag-field-l" htmlFor={ids.shops}>
                                Shops a month using your code
                            </label>
                            <output className="cp-out" htmlFor={ids.shops}>
                                {shops}
                            </output>
                        </div>
                        <div className="ag-range">
                            <input
                                type="range"
                                id={ids.shops}
                                min={0}
                                max={30}
                                step={1}
                                value={shops}
                                style={fill(shops, 0, 30)}
                                aria-valuetext={`${shops} ${shops === 1 ? "shop" : "shops"}`}
                                onChange={(e) => setShops(+e.target.value)}
                            />
                        </div>
                        <div className="ag-range-ends">
                            <span>0</span>
                            <span>30</span>
                        </div>
                    </div>
                    <div className="cp-field">
                        <div className="cp-field-h">
                            <label className="ag-field-l" htmlFor={ids.agents}>
                                Field agents you recruit
                            </label>
                            <output className="cp-out" htmlFor={ids.agents}>
                                {agents}
                            </output>
                        </div>
                        <div className="ag-range">
                            <input
                                type="range"
                                id={ids.agents}
                                min={0}
                                max={100}
                                step={1}
                                value={agents}
                                style={fill(agents, 0, 100)}
                                aria-valuetext={`${agents} ${agents === 1 ? "agent" : "agents"}`}
                                onChange={(e) => setAgents(+e.target.value)}
                            />
                        </div>
                        <div className="ag-range-ends">
                            <span>0</span>
                            <span>100</span>
                        </div>
                    </div>
                    <div className="cp-field cp-field--busy">
                        <span className="ag-field-l" id={ids.busy}>
                            How busy are your agents?
                        </span>
                        <div className="cp-seg" role="radiogroup" aria-labelledby={ids.busy}>
                            {BUSY_KEYS.map((k) => (
                                <button key={k} type="button" role="radio" aria-checked={busy === k} className={busy === k ? "is-on" : undefined} onClick={() => setBusy(k)}>
                                    {BUSY[k].label}
                                </button>
                            ))}
                        </div>
                        <p className="cp-assume" aria-live="polite">
                            <b>
                                {m.active} of {agents} active
                            </b>{" "}
                            · {b.sales} sales each a month
                        </p>
                    </div>
                </div>

                <div className="cp-calc-out" aria-live="polite">
                    <div className="cp-res cp-res--now">
                        <div className="cp-res-top">
                            <span>Money now</span>
                            <em className="ag-tag">Example</em>
                        </div>
                        <p className="cp-res-big">{peso(m.now)}</p>
                        <p className="cp-res-how">
                            {shops} {shops === 1 ? "shop" : "shops"} × {peso(KEEP_PER_SHOP)}
                        </p>
                    </div>
                    <div className="cp-res cp-res--monthly">
                        <div className="cp-res-top">
                            <span>Monthly money</span>
                            <em className="ag-tag ag-tag--ink cp-tag-dark">Example</em>
                        </div>
                        <p className="cp-res-big">{peso(m.monthly)}</p>
                        <p className="cp-res-how">
                            {m.sales} {m.sales === 1 ? "sale" : "sales"} by your agents × {peso(OVERRIDE_PER_SALE)}
                        </p>
                    </div>
                    <div className="cp-total">
                        <span>Example total this month</span>
                        <strong>{peso(m.total)}</strong>
                    </div>
                </div>
            </div>
            <p className="ag-note" data-reveal>
                Examples, not a promise. {peso(OVERRIDE_PER_SALE)} is 5% of a ₱2,999 sale. An agent is active in a month when they make a sale. Monthly money runs 12 months per agent.
            </p>
        </>
    );
}
