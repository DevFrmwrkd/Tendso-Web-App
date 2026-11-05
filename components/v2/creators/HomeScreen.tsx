import type { CSSProperties } from "react";

import { PhoneStatusBar } from "../PhoneFrame";

import { CalendarIcon, HomeTabIcon, LinkIcon, StoreIcon, UsersTabIcon, WalletTabIcon } from "./icons";
import { SAMPLE_PORTAL } from "@/lib/v2/creatorSample";
import { peso, shopLinkFor } from "@/lib/v2/creatorProgram";

/**
 * The creator's home in the app, drawn at 390 x 844 for the hero phone (mock: CL.screens.home).
 * Sample data: it shows what the app looks like, it is not anyone's account.
 */
export function HomeScreen() {
    const d = SAMPLE_PORTAL;
    return (
        <div className="app cl-screen">
            <PhoneStatusBar />
            <div className="cl-main cl-main--tabs">
                <div className="cl-hi">
                    <span className="cl-face" style={{ "--sz": "52px", backgroundImage: "url(/v2/creators/faces/mika.jpg)" } as CSSProperties} role="img" aria-label="Mika Santos" />
                    <h1 className="cl-h cl-h--md">Hi, Mika</h1>
                </div>
                <p className="cl-p cl-muted" style={{ marginTop: 22 }}>
                    October
                </p>
                <div className="cl-two">
                    <div className="cl-inc">
                        <span className="cl-ic cl-ic--accent">
                            <StoreIcon />
                        </span>
                        <span className="l">Money now</span>
                        <strong>{peso(d.now.thisMonth)}</strong>
                    </div>
                    <div className="cl-inc">
                        <span className="cl-ic cl-ic--ink">
                            <CalendarIcon />
                        </span>
                        <span className="l">Monthly money</span>
                        <strong>{peso(d.monthly.thisMonth)}</strong>
                    </div>
                </div>
                <div className="cl-linkrow">
                    <LinkIcon />
                    <b>{shopLinkFor(d.creator.handle)}</b>
                </div>
            </div>
            <div className="cl-foot cl-foot--tabs">
                <div className="door door--accent">Share my link</div>
            </div>
            <nav className="a-tabbar cl-tabs" aria-hidden="true">
                <div className="a-tab is-on">
                    <HomeTabIcon />
                    <span>Home</span>
                </div>
                <div className="a-tab">
                    <UsersTabIcon />
                    <span>Agents</span>
                </div>
                <div className="a-tab">
                    <WalletTabIcon />
                    <span>Money</span>
                </div>
            </nav>
            <div className="a-home" />
        </div>
    );
}
