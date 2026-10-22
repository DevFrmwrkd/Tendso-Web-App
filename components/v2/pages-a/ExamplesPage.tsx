import type { CSSProperties } from "react";

import type { FeaturedSite } from "@/components/landing/featuredSites";
import { Button, Label } from "@/components/v2";

import { ExamplesGrid } from "./ExamplesGrid";
import { PageShell } from "./PageShell";
import { PaTile } from "./PaTile";
import { RealSites } from "./RealSites";
import { Stores } from "./Stores";

const rev = (i: number): CSSProperties => ({ ["--i" as string]: i });

export function ExamplesPage({ featuredSites }: { featuredSites?: FeaturedSite[] | null }) {
    return (
        <PageShell page="examples">
            <div className="pg">
                <section className="v2-wrap" aria-labelledby="ex-h">
                    <div className="ex-top">
                        <div>
                            <Label data-reveal="hero">Examples</Label>
                            <h1 className="ex-h" id="ex-h" data-reveal="hero" style={rev(1)}>
                                Pick a look.
                            </h1>
                            <p className="ex-sub" data-reveal="hero" style={rev(2)}>
                                Browse designs. No sign-up.
                            </p>
                        </div>
                        <span className="sample-tag" data-reveal="hero" style={rev(3)}>
                            Sample sites · the businesses are examples
                        </span>
                    </div>
                </section>

                <ExamplesGrid />

                <section className="v2-wrap sec ex-real" aria-labelledby="real-h">
                    <div className="sec-head">
                        <div>
                            <Label data-reveal="">Real Tendso sites</Label>
                            <h2 className="sec-h" id="real-h" data-reveal="" style={rev(1)}>
                                Live now, for real shops.
                            </h2>
                        </div>
                    </div>
                    <RealSites initialSites={featuredSites} />
                </section>

                <section className="v2-wrap band" id="download" aria-labelledby="band-h">
                    <PaTile tone="quiet" className="band-in" data-reveal="">
                        <h2 className="band-h" id="band-h">
                            Like one? Start in the app.
                        </h2>
                        <div className="band-cta">
                            <Stores />
                            <Button variant="ghost" href="/v2#hire">
                                Or hire an agent
                            </Button>
                        </div>
                    </PaTile>
                </section>
            </div>
        </PageShell>
    );
}
