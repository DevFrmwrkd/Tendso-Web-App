import { ArrowRight, Download } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";

import {
    Button,
    Card,
    Container,
    Footer,
    Grid,
    Heading,
    Label,
    Nav,
    PhoneFrame,
    PhoneStatusBar,
    Pill,
    Section,
    SiteCard,
    Tile,
    TileHead,
} from "@/components/v2";

import { ChipDemo } from "./ChipDemo";

const SWATCHES: { name: string; token: string; hex: string; note?: string; fill?: boolean }[] = [
    { name: "Canvas", token: "--v2-canvas", hex: "#FFFFFF" },
    { name: "Stage", token: "--v2-stage", hex: "#F2F3F1" },
    { name: "Quiet tile", token: "--v2-tile-quiet", hex: "#F7F7F5" },
    { name: "Line", token: "--v2-line", hex: "#ECECE8" },
    { name: "Ink", token: "--v2-ink", hex: "#0C0A08" },
    { name: "Ink 2", token: "--v2-ink-2", hex: "#4A4943" },
    { name: "Muted", token: "--v2-muted", hex: "#8C8B84", note: "labels only" },
    { name: "Dark", token: "--v2-dark", hex: "#121210" },
    { name: "Accent", token: "--v2-accent", hex: "#E4F222", note: "fill only", fill: true },
    { name: "Accent hover", token: "--v2-accent-hover", hex: "78% + white", note: "fill only", fill: true },
    { name: "Accent soft", token: "--v2-accent-soft", hex: "22% + white", note: "fill only", fill: true },
];

const TYPE: { name: string; token: string; value: string; sample: string; className: string }[] = [
    { name: "Hero", token: "--v2-t-hero", value: "clamp(44px, 6.4vw, 104px)", sample: "The thinking ends here.", className: "text-v2-hero font-medium" },
    { name: "Moment", token: "--v2-t-moment", value: "clamp(64px, 12vw, 210px)", sample: "Live.", className: "text-v2-moment font-medium" },
    { name: "H2", token: "--v2-t-h2", value: "clamp(36px, 5vw, 72px)", sample: "Three ways in.", className: "text-v2-h2 font-medium" },
    { name: "H3 / tile title", token: "--v2-t-h3", value: "clamp(22px, 2vw, 28px)", sample: "Your words, written up for you.", className: "text-v2-h3 font-medium" },
    { name: "Body", token: "--v2-t-body", value: "17px (16px under 760px)", sample: "Kuya Rey talks for two minutes about his barbershop. The page is written from what he said.", className: "text-v2-body text-v2-ink-2" },
];

function Block({ id, title, hint, children }: { id: string; title: string; hint?: string; children: ReactNode }) {
    return (
        <Section id={id} size="sm">
            <div className="mb-8 flex flex-col gap-2 sm:mb-10">
                <Label>{id}</Label>
                <Heading as="h2" size="h3">
                    {title}
                </Heading>
                {hint && <p className="max-w-[60ch] text-v2-ink-2">{hint}</p>}
            </div>
            {children}
        </Section>
    );
}

function Swatch({ s }: { s: (typeof SWATCHES)[number] }) {
    return (
        <div className="min-w-0">
            <div
                className="h-24 rounded-v2-card border border-v2-line"
                style={{ background: `var(${s.token})` } as CSSProperties}
            />
            <p className="mt-2 font-semibold">{s.name}</p>
            <p className="text-v2-ink-2">
                <code className="break-all">{s.token}</code>
            </p>
            <p className="text-v2-ink-2">
                {s.hex}
                {s.note ? ` · ${s.note}` : ""}
            </p>
        </div>
    );
}

export default function V2KitPage() {
    return (
        <>
            <Nav
                secondaryAction={
                    <Button variant="ghost" size="sm" href="#buttons">
                        Hire an agent
                    </Button>
                }
                primaryAction={
                    <Button variant="primary" size="sm" href="#phone">
                        Download the app
                    </Button>
                }
            />

            <main>
                <Section size="flush" className="pt-[calc(84px+clamp(28px,5vw,72px))]">
                    <Label>Design v2 · review kit</Label>
                    <Heading as="h1" size="hero" className="mt-5 max-w-[11ch]">
                        Every token. Every part.
                    </Heading>
                    <p className="mt-6 max-w-[48ch] text-v2-ink-2">
                        Tokens and components from the approved mock, as they ship. Hover the tiles and cards. Resize to 390px to check the phone layout.
                    </p>
                </Section>

                <Block id="colour" title="Colour" hint="One accent. It is a fill: buttons, progress, one marker per view. Text on it is always ink (16:1). It never appears as text or a line on a light background (1.2:1).">
                    <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
                        {SWATCHES.map((s) => (
                            <Swatch key={s.token} s={s} />
                        ))}
                    </div>
                    <div className="mt-10 flex flex-wrap items-center gap-3">
                        <span className="rounded-v2-pill bg-v2-accent px-5 py-3 font-medium text-v2-on-accent">Ink on accent</span>
                        <span className="rounded-v2-pill bg-v2-accent-hover px-5 py-3 font-medium text-v2-on-accent">On accent hover</span>
                        <span className="rounded-v2-pill bg-v2-accent-soft px-5 py-3 font-medium text-v2-ink">On accent soft</span>
                        <span className="rounded-v2-pill bg-v2-dark px-5 py-3 font-medium text-white">White on dark</span>
                    </div>
                </Block>

                <Block id="type" title="Type" hint="Onest only. Display is weight 500 with tight tracking; the mono face appears only in tiny uppercase labels.">
                    <div className="flex flex-col">
                        {TYPE.map((t) => (
                            <div key={t.name} className="grid gap-3 border-t border-v2-line py-6 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-10">
                                <div>
                                    <p className="font-semibold">{t.name}</p>
                                    <p className="text-v2-ink-2">
                                        <code>{t.token}</code>
                                    </p>
                                    <p className="text-v2-ink-2">{t.value}</p>
                                </div>
                                <p className={`${t.className} min-w-0 text-balance`}>{t.sample}</p>
                            </div>
                        ))}
                        <div className="grid gap-3 border-t border-v2-line py-6 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-10">
                            <div>
                                <p className="font-semibold">Label</p>
                                <p className="text-v2-ink-2">
                                    <code>--v2-t-label</code>
                                </p>
                                <p className="text-v2-ink-2">11px mono, 0.08em, caps</p>
                            </div>
                            <p>
                                <Label>Barbershop · Marikina</Label>
                            </p>
                        </div>
                    </div>
                </Block>

                <Block id="shape" title="Radii, shadow, spacing">
                    <div className="grid gap-8 md:grid-cols-2">
                        <div className="flex flex-wrap items-end gap-6">
                            <div className="text-center">
                                <div className="h-28 w-28 rounded-v2-tile border border-v2-line bg-v2-quiet" />
                                <p className="mt-2 font-semibold">Tile</p>
                                <p className="text-v2-ink-2">40px · 28px</p>
                            </div>
                            <div className="text-center">
                                <div className="h-28 w-28 rounded-v2-card border border-v2-line bg-v2-quiet" />
                                <p className="mt-2 font-semibold">Card</p>
                                <p className="text-v2-ink-2">20px</p>
                            </div>
                            <div className="text-center">
                                <div className="h-14 w-28 rounded-v2-pill border border-v2-line bg-v2-quiet" />
                                <p className="mt-2 font-semibold">Pill</p>
                                <p className="text-v2-ink-2">999px</p>
                            </div>
                            <div className="text-center">
                                <div className="h-28 w-28 rounded-v2-card bg-v2-canvas shadow-v2-object" />
                                <p className="mt-2 font-semibold">Object shadow</p>
                                <p className="text-v2-ink-2">phones, cards</p>
                            </div>
                        </div>
                        <div className="flex flex-col gap-4">
                            {[
                                ["--v2-gap", "var(--v2-gap)", "grid gap: clamp(12px, 1.7vw, 24px)"],
                                ["--v2-page-pad", "var(--v2-page-pad)", "page padding: clamp(16px, 3.3vw, 48px)"],
                                ["--v2-sec-sm", "var(--v2-sec-sm)", "section: clamp(40px, 5vw, 72px)"],
                                ["--v2-sec-md", "var(--v2-sec-md)", "section: clamp(80px, 10vw, 160px)"],
                            ].map(([token, w, note]) => (
                                <div key={token}>
                                    <div className="h-3 rounded-v2-pill bg-v2-ink" style={{ width: w }} />
                                    <p className="mt-1 text-v2-ink-2">
                                        <code>{token}</code> · {note}
                                    </p>
                                </div>
                            ))}
                            <p className="text-v2-ink-2">
                                Max page width <code>--v2-max</code> 1440px.
                            </p>
                        </div>
                    </div>
                </Block>

                <Block id="motion" title="Motion" hint="Physical and calm, no bounce. Hover a row to play it.">
                    <div className="grid gap-3">
                        {[
                            ["ease-v2-out", "--v2-ease-out", "cubic-bezier(.22, 1, .36, 1)", "default, almost everything", "duration-[220ms]", "--v2-d-ui 220ms"],
                            ["ease-v2-expo", "--v2-ease-expo", "cubic-bezier(.16, 1, .3, 1)", "reveals, long settles", "duration-[900ms]", "--v2-d-settle 900ms"],
                            ["ease-v2-inout", "--v2-ease-inout", "cubic-bezier(.77, 0, .175, 1)", "moves that start and stop together", "duration-[620ms]", "--v2-d-reveal 620ms"],
                        ].map(([cls, token, curve, use, dur, durLabel]) => (
                            <div key={cls} className="group rounded-v2-card border border-v2-line p-5">
                                <div className="flex flex-wrap items-baseline justify-between gap-x-6">
                                    <p className="font-semibold">
                                        <code>{cls}</code> <span className="font-normal text-v2-ink-2">· {use}</span>
                                    </p>
                                    <p className="text-v2-ink-2">
                                        <code>{token}</code> {curve} · <code>{durLabel}</code>
                                    </p>
                                </div>
                                <div className="mt-4 h-8 rounded-v2-pill bg-v2-quiet [container-type:inline-size]">
                                    <div
                                        className={`h-8 w-8 rounded-v2-pill bg-v2-accent transition-transform ${dur} ${cls} group-hover:translate-x-[calc(100cqw-2rem)]`}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                    <p className="mt-4 text-v2-ink-2">
                        Reveal: opacity 620ms, blur 14px to 0, rise 18px over 900ms, 70ms stagger. Tokens <code>--v2-blur-in</code>, <code>--v2-d-reveal</code>, <code>--v2-d-settle</code>. Reduced motion collapses every transition.
                    </p>
                </Block>

                <Block id="buttons" title="Button" hint="Primary is the accent fill with ink text. Dark and ghost sit beside it. Sizes 38 / 46 / 52.">
                    <div className="grid gap-6">
                        {(["primary", "dark", "ghost"] as const).map((variant) => (
                            <div key={variant} className="flex flex-wrap items-center gap-3">
                                <span className="w-20 font-semibold">{variant}</span>
                                <Button variant={variant} size="sm">
                                    Small
                                </Button>
                                <Button variant={variant}>Download the app</Button>
                                <Button variant={variant} size="lg">
                                    Large <ArrowRight size={18} aria-hidden="true" />
                                </Button>
                                <Button variant={variant} disabled>
                                    Disabled
                                </Button>
                            </div>
                        ))}
                        <div className="flex flex-wrap items-center gap-3">
                            <span className="w-20 font-semibold">link</span>
                            <Button href="#phone">
                                <Download size={18} aria-hidden="true" /> Internal anchor
                            </Button>
                            <Button href="https://tendso.com" target="_blank" rel="noopener noreferrer" variant="ghost">
                                External link
                            </Button>
                        </div>
                        <div className="max-w-sm">
                            <Button block size="lg">
                                Full width
                            </Button>
                        </div>
                    </div>
                </Block>

                <Block id="pills" title="Pill and chip" hint="Pill is a static tag. Chip is a toggle with an optional count; state lives in the parent.">
                    <div className="flex flex-col gap-6">
                        <div className="flex flex-wrap items-center gap-2">
                            <Pill>Barbershop</Pill>
                            <Pill tone="outline">Auto repair</Pill>
                            <Pill tone="accent">Live</Pill>
                            <Pill tone="dark">Hair salon</Pill>
                        </div>
                        <ChipDemo />
                    </div>
                </Block>

                <Block id="cards" title="Card" hint="20px radius.">
                    <Grid>
                        <Card className="col-span-4">
                            <Label>Barber</Label>
                            <p className="mt-3 text-v2-h3 leading-tight font-medium tracking-tight">Kuya Rey gets a page in one afternoon.</p>
                        </Card>
                        <Card tone="quiet" className="col-span-4">
                            <Label>Mechanic</Label>
                            <p className="mt-3 text-v2-h3 leading-tight font-medium tracking-tight">Vulca Garage shows its bays and its prices.</p>
                        </Card>
                        <Card tone="dark" className="col-span-4">
                            <Label className="!text-white/60">Tailor</Label>
                            <p className="mt-3 text-v2-h3 leading-tight font-medium tracking-tight">Aling Dina is found by people on her street.</p>
                        </Card>
                    </Grid>
                </Block>

                <Block id="tiles" title="Tile" hint="40px radius. On hover (or keyboard focus) the tile blurs and one line sits in the middle. No black box. Not shown on touch.">
                    <Grid>
                        <Tile tone="quiet" className="col-span-5 h-[520px]" hoverText="You talk. We write it up.">
                            <TileHead label="Words">What you say becomes your homepage.</TileHead>
                            <div className="absolute bottom-[-150px] left-7 -rotate-3">
                                <PhoneFrame size="sm" image={{ src: "/v2/sites/hela-m.jpg", alt: "Héla Hair Studio website on a phone", bg: "#FAF5EF" }} />
                            </div>
                        </Tile>
                        <Tile className="col-span-7 h-[520px]" hoverText="Your photos, made professional.">
                            <TileHead label="Images">Same shop. A better photo.</TileHead>
                            <div className="absolute inset-x-8 bottom-8 top-36 overflow-hidden rounded-v2-card">
                                <div
                                    className="h-full w-full bg-cover bg-top"
                                    style={{ backgroundImage: "url(/v2/sites/vulca-d.jpg)" }}
                                    role="img"
                                    aria-label="Vulca Garage website"
                                />
                            </div>
                        </Tile>
                        <Tile tone="dark" className="col-span-12 h-[220px]" hoverText="See it first. Pay once to publish.">
                            <TileHead label="Cost">See it first. Pay once to publish.</TileHead>
                        </Tile>
                    </Grid>
                </Block>

                <Block id="phone" title="Phone frame" hint="Web phone mock. Proportions from the mock: 3.1% bezel, 15.5% outer radius, 31% x 3.55% island. Screen content is authored at 390 x 844.">
                    <div className="flex flex-wrap items-end gap-10">
                        <div className="flex flex-col gap-3">
                            <PhoneFrame size="sm" image={{ src: "/v2/sites/vulca-m.jpg", alt: "Vulca Garage mobile site", bg: "#111214", dark: true }} />
                            <Label>sm · 220</Label>
                        </div>
                        <div className="flex flex-col gap-3">
                            <PhoneFrame size="md" image={{ src: "/v2/sites/forge-m-fixed.jpg", alt: "Forge Barbers mobile site", bg: "#16171C", dark: true }} />
                            <Label>md · 300</Label>
                        </div>
                        <div className="flex flex-col gap-3">
                            <PhoneFrame size="md" theme="dark">
                                <div className="relative flex h-full flex-col justify-end gap-6 bg-v2-dark p-8 pb-16 text-white">
                                    <PhoneStatusBar dark />
                                    <p className="text-[44px] leading-[0.95] font-medium tracking-[-0.05em]">Your website, built for you.</p>
                                    <span className="inline-flex h-14 items-center justify-center rounded-v2-pill bg-v2-accent text-[20px] font-medium text-v2-on-accent">Start</span>
                                </div>
                            </PhoneFrame>
                            <Label>children · authored at 390 x 844</Label>
                        </div>
                        <div className="flex flex-col gap-3">
                            <PhoneFrame size="lg" image={{ src: "/v2/sites/hela-m.jpg", alt: "Héla Hair Studio mobile site", bg: "#FAF5EF" }} />
                            <Label>lg · 360</Label>
                        </div>
                    </div>
                </Block>

                <Block id="site-card" title="Site card" hint="A finished site as a browser capture. Opens in a new tab. Sample designs: the businesses are examples.">
                    <div className="grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
                        <SiteCard href="https://tendso.com" host="vulca.tendso.site" name="Vulca Garage" kind="Auto repair" city="Cebu City" image={{ src: "/v2/sites/vulca-d.jpg" }} />
                        <SiteCard href="https://tendso.com" host="hela.tendso.site" name="Héla Hair Studio" kind="Hair salon" city="Makati" image={{ src: "/v2/sites/hela-d.jpg" }} />
                        <SiteCard href="https://tendso.com" host="forge.tendso.site" name="Forge Barbers" kind="Barbershop" city="Marikina" image={{ src: "/v2/sites/forge-d-fixed.jpg" }} />
                    </div>
                </Block>

                <Block id="layout" title="Container, section, grid" hint="Container is max 1440 with 16 to 48px side padding. Section adds the vertical rhythm and an optional tone. Grid is 12 columns with the system gap, one column under 760px.">
                    <Grid>
                        {[7, 5, 5, 7].map((span, i) => (
                            <div
                                key={i}
                                className="flex h-24 items-center justify-center rounded-v2-card bg-v2-stage font-medium"
                                style={{ gridColumn: `span ${span}` }}
                            >
                                span {span}
                            </div>
                        ))}
                    </Grid>
                </Block>

                <Section tone="quiet" size="sm">
                    <Label>Section tone</Label>
                    <p className="mt-3 text-v2-ink-2">A full-bleed band: canvas, stage, quiet or dark.</p>
                </Section>
                <Container className="py-10">
                    <p className="text-v2-ink-2">The nav above is fixed: it tightens to 60px and blurs after 30px of scroll, and becomes a full-screen menu under 900px. The footer below carries the closing line, the wordmark and the five links.</p>
                </Container>
            </main>

            <Footer
                actions={
                    <>
                        <Button size="lg" href="#phone">
                            Download the app
                        </Button>
                        <Button size="lg" variant="ghost" href="#buttons">
                            Hire an agent
                        </Button>
                    </>
                }
            />
        </>
    );
}
