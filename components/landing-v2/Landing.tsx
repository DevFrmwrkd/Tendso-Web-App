import { Button, Footer, Nav, V2Root, type V2Link } from "@/components/v2";
import { AskTendsoLauncher } from "@/components/v2/chat/AskTendso";

import { LANDING_LINKS } from "./content";
import { Grid } from "./Grid";
import { Hero } from "./Hero";
import { Paths } from "./Paths";
import { People } from "./People";
import { Reveals } from "./Reveals";
import { Steps } from "./Steps";

import "./landing.css";
import "./screens.css";

/*
 * The v2 landing (design mock docs/landing-mock/index.html, brief §4A).
 * Hero → grid of living tiles → people → six steps → paths → footer.
 * Lives at /v2 until Theo approves the swap for /.
 */

const NAV: V2Link[] = [
    { label: "How it works", href: "#how" },
    { label: "People", href: "#people" },
    { label: "Field agents", href: LANDING_LINKS.fieldAgents },
    { label: "Creators", href: LANDING_LINKS.creators },
    { label: "Help", href: LANDING_LINKS.help },
];

const FOOTER: V2Link[] = [
    { label: "Help", href: LANDING_LINKS.help },
    { label: "Contact", href: LANDING_LINKS.contact },
    { label: "Field agents", href: LANDING_LINKS.fieldAgents },
    { label: "Creators", href: LANDING_LINKS.creators },
    { label: "Privacy", href: LANDING_LINKS.privacy },
    { label: "Terms", href: LANDING_LINKS.terms },
];

export function Landing() {
    return (
        <V2Root className="lv2">
            <div id="lv2-root">
                <Nav
                    links={NAV}
                    homeHref="/v2"
                    secondaryAction={
                        <Button href="#hire" variant="ghost" size="sm">
                            Hire an agent
                        </Button>
                    }
                    primaryAction={
                        <Button href="#download" size="sm">
                            Download the app
                        </Button>
                    }
                />
                <main>
                    <Hero />
                    <Grid />
                    <People />
                    <Steps />
                    <Paths />
                </main>
                <Footer
                    links={FOOTER}
                    actions={
                        <>
                            <Button href="#download">Download the app</Button>
                            <Button href="#hire" variant="ghost">
                                Hire an agent
                            </Button>
                        </>
                    }
                />
                {/* Ask Tendso: the floating help chat (same engine as the Help page). */}
                <AskTendsoLauncher />
                <Reveals />
            </div>
        </V2Root>
    );
}
