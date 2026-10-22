import { Button, Footer, Nav, V2Root, V2_ROUTES } from "@/components/v2";
import { AskTendsoLauncher } from "@/components/v2/chat/AskTendso";

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

export function Landing() {
    return (
        <V2Root className="lv2">
            <div id="lv2-root">
                <Nav
                    secondaryAction={
                        <Button href={V2_ROUTES.hire} variant="ghost" size="sm">
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
                <AskTendsoLauncher revealAfter={0.6} />
                <Reveals />
            </div>
        </V2Root>
    );
}
