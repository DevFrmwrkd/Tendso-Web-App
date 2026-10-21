"use client";

/**
 * /v2/start: start your website (pages/start.html), one step per screen.
 *
 * TWO WAYS IN.
 *  1. The app (the primary path). The first screen sends owners to "Download the
 *     app", carrying a creator code when one is in the link (?code=) or the cookie.
 *  2. "Do it on the web instead": the EXISTING owner intake. It collects the same
 *     fields /start collects today and ends in the same `ownerIntake.submitOwnerIntake`
 *     call, so nothing on the backend changes: the shop basics, the eight canonical
 *     interview answers (INTAKE_QUESTIONS), the named photo slots uploaded to R2 the
 *     moment they are picked, the campaign / affiliate / giveaway hints, and the draft
 *     kept in localStorage (the same draft as /start, so a refresh loses nothing and
 *     either page can pick it up).
 *
 * Campaign visitors (Off the Record, a field agent's or creator's link, the giveaway)
 * skip the first screen: the app cannot carry their offer, the web form can.
 */

import { useAction, useConvex, useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties, type FormEvent, type ReactNode } from "react";

import {
    clearDraft,
    emptyDraft,
    loadDraft,
    rememberSubmitted,
    resolveIntakeDraft,
    saveDraft,
    hasDraftProgress,
    type StartBasics,
    type StartDraft,
} from "@/app/start/draft";
import { buildPhotoArray, validatePhotoFile, visibleSlots, type PhotoSlot } from "@/app/start/photoSlots";
import { quoteFor } from "@/app/start/quote";
import { Button } from "@/components/v2";
import { api } from "@/convex/_generated/api";
import { creatorPlatform, creatorStoreButtons, type CreatorPlatform } from "@/lib/affiliateLanding";
import { clearCampaign, intakeCampaignForPage, rememberCampaign } from "@/lib/campaign";
import { GIVEAWAY_CLOSED } from "@/lib/giveaway";
import { INTAKE_QUESTIONS, meetsAnswerMinimum, type IntakeQuestionKey } from "@/lib/narrativeFromQa";
import { campaignListPrice, domainAddOnFor, formatPHP, normalizeCampaign, ownerChargeFor } from "@/lib/pricing";
import { BUSINESS_TYPES } from "@/lib/prospectPrefill";

import { PbBrand, SitePhone, usePbToast, CheckIcon } from "./shared";
import { VoiceMic } from "./VoiceMic";

/* ---- constants ------------------------------------------------------------- */

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const STAGES = ["Your shop", "Questions", "Photos", "Last look"] as const;
const SITE_HOST = "sites.tendso.com";

/** What each business type is called on a chip, and which sample design stands in for it. */
const KIND: Record<string, { label: string; site: string; design: string }> = {
    "Barber/Salon": { label: "Barber or salon", site: "forge", design: "Barbershop" },
    "Auto Shop": { label: "Auto shop", site: "vulca", design: "Auto repair" },
    "Spa/Massage": { label: "Spa or massage", site: "hela", design: "Hair and spa studio" },
    Restaurant: { label: "Restaurant", site: "domingo", design: "Hardware store" },
    Clinic: { label: "Clinic", site: "kalasag", design: "Gym" },
    "Law Office": { label: "Law office", site: "kalasag", design: "Gym" },
    "Craft/Producer": { label: "Craft or producer", site: "domingo", design: "Hardware store" },
    Other: { label: "Something else", site: "labana", design: "Laundry" },
};
const DEFAULT_SITE = { site: "forge", design: "Barbershop" };

type ScreenId = "choose" | "name" | "reach" | "where" | `q${number}` | "products" | "photos" | "poster" | "review" | "done";

function stageOf(id: ScreenId): number {
    if (id === "choose") return -1;
    if (id === "name" || id === "reach" || id === "where") return 0;
    if (id.startsWith("q")) return 1;
    if (id === "products" || id === "photos" || id === "poster") return 2;
    if (id === "review") return 3;
    return 4;
}

const slugify = (s: string) =>
    s
        .toLowerCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 26) || "your-shop";

const spacedPhone = (d: string) => d.replace(/^(\d{3})(\d{0,3})(\d{0,4}).*/, (_m, a: string, b: string, c: string) => [a, b, c].filter(Boolean).join(" "));

function messageFor(error: unknown): string {
    if (error instanceof ConvexError && typeof error.data === "string") return error.data;
    return "Something went wrong on our side. Nothing you typed was lost. Please try again in a moment.";
}

/* ---- creator code carried to the app ------------------------------------------------ */

const CODE_COOKIE = "tendso_code";
const CODE_PATTERN = /^[A-Za-z0-9_-]{2,32}$/;

/**
 * The creator code in the link (?code=), or the one remembered in the cookie. A link wins and is
 * remembered for 30 days. Offer codes the web form already understands (OTR30 and friends) are
 * campaigns, not creator codes, and are left to that path.
 */
export function readCreatorCode(): string | null {
    try {
        const fromUrl = new URLSearchParams(window.location.search).get("code")?.trim() ?? "";
        if (fromUrl && CODE_PATTERN.test(fromUrl) && !normalizeCampaign(fromUrl) && fromUrl.toLowerCase() !== "giveaway") {
            document.cookie = `${CODE_COOKIE}=${encodeURIComponent(fromUrl)}; max-age=${30 * 24 * 3600}; path=/; SameSite=Lax`;
            return fromUrl;
        }
        const m = document.cookie.match(new RegExp(`(?:^|; )${CODE_COOKIE}=([^;]*)`));
        const fromCookie = m ? decodeURIComponent(m[1]) : "";
        return CODE_PATTERN.test(fromCookie) ? fromCookie : null;
    } catch {
        return null;
    }
}

/** Play carries a referrer through the install, so the code survives into the app. */
function withPlayReferrer(url: string, code: string | null): string {
    if (!code) return url;
    try {
        const parsed = new URL(url);
        if (!parsed.hostname.endsWith("play.google.com")) return url;
        parsed.searchParams.set("referrer", `utm_source=tendso&utm_medium=web&utm_campaign=${encodeURIComponent(code)}`);
        return parsed.toString();
    } catch {
        return url;
    }
}

const subscribe = () => () => {};
const serverPlatform = (): CreatorPlatform => "other";
const browserPlatform = (): CreatorPlatform =>
    creatorPlatform(navigator.userAgent, /macintosh/i.test(navigator.userAgent) && "ontouchend" in document);

/* ---- the draft's screen, remembered next to it --------------------------------------- */

const AT_KEY = "tendso:v2start:screen:v1";
function saveScreen(id: ScreenId) {
    try {
        window.localStorage.setItem(AT_KEY, JSON.stringify({ id, at: Date.now() }));
    } catch {
        /* storage off: the form still works */
    }
}
function loadScreen(): ScreenId | null {
    try {
        const raw = window.localStorage.getItem(AT_KEY);
        if (!raw) return null;
        const v = JSON.parse(raw) as { id?: unknown; at?: unknown };
        if (typeof v.id !== "string" || typeof v.at !== "number" || Date.now() - v.at > 7 * 24 * 3600 * 1000) return null;
        return v.id as ScreenId;
    } catch {
        return null;
    }
}

/* ---- the flow -------------------------------------------------------------------------- */

export function StartFlow() {
    const convex = useConvex();
    const submitOwnerIntake = useMutation(api.ownerIntake.submitOwnerIntake);
    const generateUploadUrl = useAction(api.r2.generateUploadUrl);
    const giveawayStatus = useQuery(api.giveaway.giveawayStatus);
    const playUrl = useQuery(api.settings.get, { key: "play_store_url" }) as string | null | undefined;
    const iosUrl = useQuery(api.settings.get, { key: "app_store_url" }) as string | null | undefined;
    const platform = useSyncExternalStore(subscribe, browserPlatform, serverPlatform);
    const { node: toast, show } = usePbToast();

    // The campaign this owner arrived under. Read on mount: it touches the URL and localStorage.
    const [campaign, setCampaign] = useState<string | null>(null);
    const [affiliateHandle, setAffiliateHandle] = useState<string | null>(null);
    const [source, setSource] = useState<string | null>(null);
    const affiliateOffer = useQuery(api.affiliates.publicPage, affiliateHandle !== null ? { handle: affiliateHandle } : "skip");
    const affiliatePrice = affiliateHandle === null ? undefined : (affiliateOffer?.price ?? null);
    const [arrival, setArrival] = useState<{ offer: ReturnType<typeof intakeCampaignForPage>; saved: StartDraft; code: string | null; web: boolean; screen: ScreenId | null } | null>(null);
    const [draft, setDraft] = useState<StartDraft | null>(null);
    const [screen, setScreen] = useState<ScreenId>("name");
    const [dir, setDir] = useState<1 | -1>(1);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [uploading, setUploading] = useState<number | "poster" | null>(null);
    const [photoErr, setPhotoErr] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [giveawayClosed, setGiveawayClosed] = useState(false);
    const [voiceBusy, setVoiceBusy] = useState(false);
    const [doneEmail, setDoneEmail] = useState("");
    const [codeEntry, setCodeEntry] = useState("");
    const [codeRejected, setCodeRejected] = useState(false);
    const [savedTick, setSavedTick] = useState(0);
    /** True once the first screen (download the app) was offered, so Back can return to it. */
    const [chooseShown, setChooseShown] = useState(false);
    const submittedRef = useRef(false);
    const firstPlaced = useRef(false);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        setArrival({
            offer: intakeCampaignForPage(),
            saved: loadDraft(),
            code: readCreatorCode(),
            web: params.get("mode") === "web",
            screen: loadScreen(),
        });
    }, []);

    useEffect(() => {
        if (!arrival || draft) return;
        const { offer, saved } = arrival;
        if (offer.giveaway && !offer.fullPrice && giveawayStatus === undefined) return;
        const next = resolveIntakeDraft(saved, offer, giveawayStatus?.open === true);
        setDraft(next);
        setCampaign(next.giveawayApplication || offer.fullPrice || offer.giveaway ? null : offer.campaign);
        setAffiliateHandle(next.giveawayApplication || offer.fullPrice || offer.giveaway ? null : (offer.affiliateHandle ?? null));
        setSource(next.giveawayApplication ? next.giveawaySource : offer.fullPrice ? null : offer.source);
        if (offer.giveaway && !giveawayStatus?.open && !next.giveawayApplication) clearCampaign();
    }, [arrival, draft, giveawayStatus]);

    useEffect(() => {
        if (draft) saveDraft(draft);
    }, [draft]);

    const giveaway = draft?.giveawayApplication === true;
    const hasOffer = !!arrival && (arrival.offer.giveaway || arrival.offer.campaign !== null || arrival.offer.affiliateHandle !== undefined || arrival.offer.fullPrice === true);
    const progressed = draft ? hasDraftProgress(draft) : false;
    /** The first screen (download the app) is for owners with nothing in progress and no offer the app cannot carry. */
    const offerChoose = !!arrival && !arrival.web && !hasOffer && !progressed;

    const screens: ScreenId[] = useMemo(
        () => [
            ...(chooseShown ? (["choose"] as ScreenId[]) : []),
            "name",
            "reach",
            "where",
            ...INTAKE_QUESTIONS.map((_, i) => `q${i}` as ScreenId),
            "products",
            "photos",
            ...(giveaway ? (["poster"] as ScreenId[]) : []),
            "review",
            "done",
        ],
        [chooseShown, giveaway],
    );
    const at = Math.max(0, screens.indexOf(screen));

    // Place the owner on their first screen once, after the arrival is known.
    useEffect(() => {
        if (!arrival || !draft || firstPlaced.current) return;
        firstPlaced.current = true;
        if (offerChoose) {
            setChooseShown(true);
            setScreen("choose");
            return;
        }
        const remembered = arrival.screen;
        const valid = remembered && remembered !== "choose" && remembered !== "done" && (remembered !== "poster" || draft.giveawayApplication);
        setScreen(valid && progressed ? remembered : "name");
    }, [arrival, draft, offerChoose, progressed]);

    useEffect(() => {
        if (firstPlaced.current && screen !== "choose" && screen !== "done") saveScreen(screen);
    }, [screen]);

    const patch = useCallback((update: (previous: StartDraft) => StartDraft) => {
        setDraft((previous) => (previous ? update(previous) : previous));
        setSavedTick((n) => n + 1);
    }, []);
    const setBasic = useCallback(
        (key: keyof StartBasics, value: string) => {
            patch((p) => ({ ...p, basics: { ...p.basics, [key]: value } }));
            setErrors((e) => (e[key] ? { ...e, [key]: "" } : e));
        },
        [patch],
    );
    const setAnswer = useCallback(
        (key: IntakeQuestionKey, value: string) => {
            patch((p) => ({ ...p, answers: { ...p.answers, [key]: value } }));
            setErrors((e) => (e[key] ? { ...e, [key]: "" } : e));
        },
        [patch],
    );
    const appendAnswer = useCallback(
        (key: IntakeQuestionKey, text: string) =>
            patch((p) => {
                const existing = (p.answers[key] ?? "").trim();
                return { ...p, answers: { ...p.answers, [key]: existing ? `${existing} ${text}` : text } };
            }),
        [patch],
    );

    // scroll to the top whenever the screen changes
    useEffect(() => {
        window.scrollTo({ top: 0, behavior: "auto" });
    }, [screen]);

    const quote = quoteFor(campaign, false, giveaway, affiliatePrice);
    const basics = draft?.basics ?? emptyDraft().basics;
    const kind = KIND[basics.businessType] ?? DEFAULT_SITE;
    const address = `${slugify(basics.businessName || "Forge Barbers")}.${SITE_HOST}`;

    /* ---- uploads ---- */
    const upload = useCallback(
        async (file: File): Promise<string> => {
            const { uploadUrl, publicUrl } = await generateUploadUrl({ fileName: file.name, fileType: file.type, mediaType: "photo" });
            const response = await fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
            if (!response.ok) throw new Error(`R2 responded ${response.status}`);
            return publicUrl;
        },
        [generateUploadUrl],
    );

    const pickPhoto = useCallback(
        async (slot: PhotoSlot, file: File) => {
            const problem = validatePhotoFile(file);
            if (problem) {
                setPhotoErr(problem);
                return;
            }
            setPhotoErr(null);
            setUploading(slot.index);
            try {
                const url = await upload(file);
                patch((p) => ({ ...p, photos: { ...p.photos, [slot.index]: url } }));
            } catch {
                setPhotoErr(`"${slot.label}" didn't upload. Check your signal and try that one again.`);
            } finally {
                setUploading(null);
            }
        },
        [patch, upload],
    );

    const removePhoto = useCallback(
        (slot: PhotoSlot) =>
            patch((p) => {
                const photos = { ...p.photos };
                delete photos[slot.index];
                return { ...p, photos };
            }),
        [patch],
    );

    const pickPoster = useCallback(
        async (file: File) => {
            const problem = validatePhotoFile(file);
            if (problem) {
                setPhotoErr(problem);
                return;
            }
            setPhotoErr(null);
            setUploading("poster");
            try {
                const url = await upload(file);
                patch((p) => ({ ...p, giveawayPosterPhoto: url }));
            } catch {
                setPhotoErr("Your poster photo didn't upload. Check your signal and try again.");
            } finally {
                setUploading(null);
            }
        },
        [patch, upload],
    );

    /* ---- validation ---- */
    function validate(id: ScreenId): boolean {
        if (!draft) return false;
        const next: Record<string, string> = {};
        const b = draft.basics;
        if (id === "name") {
            if (!b.businessName.trim()) next.businessName = "We need the name on your sign.";
            if (!b.businessType) next.businessType = "Pick the closest one.";
        } else if (id === "reach") {
            if (!b.ownerName.trim()) next.ownerName = "Who should we talk to?";
            if (b.ownerPhone.length !== 10) next.ownerPhone = "Ten digits after +63, like 917 123 4567.";
            if (!b.ownerEmail.trim()) next.ownerEmail = giveaway ? "We need an email to update you about your application." : "We send your site here.";
            else if (!EMAIL_PATTERN.test(b.ownerEmail.trim())) next.ownerEmail = "That address doesn't look right.";
        } else if (id === "where") {
            if (!b.address.trim()) next.address = "Your street, so people can find you.";
            if (!b.city.trim()) next.city = "Your city or town.";
        } else if (id.startsWith("q")) {
            const question = INTAKE_QUESTIONS[Number(id.slice(1))];
            const a = draft.answers[question.key] ?? "";
            if (!meetsAnswerMinimum(question, a)) {
                next[question.key] = question.minChars && a.trim().length > 0 ? "Tell us a little more. Two sentences is plenty." : "Tell us a little. We build your site from this.";
            }
        } else if (id === "products") {
            if (draft.hasProducts === null) next.hasProducts = "Pick one.";
        } else if (id === "photos") {
            const missing = visibleSlots(!!draft.hasProducts).filter((s) => !s.optional && !draft.photos[s.index]);
            if (missing.length) next.photos = `Add ${missing.map((m) => m.label.toLowerCase()).join(" and ")}.`;
            if (uploading !== null) next.photos = "One photo is still uploading.";
        } else if (id === "poster") {
            if (!draft.giveawayPosterPhoto) next.poster = "Add the photo of the poster.";
        }
        setErrors(next);
        return Object.keys(next).length === 0;
    }

    const goTo = (id: ScreenId, direction: 1 | -1) => {
        setDir(direction);
        setScreen(id);
        setErrors({});
        setSubmitError(null);
    };

    /* ---- submit ---- */
    const handleSubmit = useCallback(async () => {
        if (!draft || submittedRef.current || (affiliateHandle !== null && affiliateOffer === undefined)) return;
        if (draft.giveawayApplication && giveawayStatus?.open === false) {
            setGiveawayClosed(true);
            setSubmitError("The giveaway is closed. Your draft is saved on this device.");
            return;
        }
        if (draft.giveawayApplication && !draft.giveawayPosterPhoto) {
            goTo("poster", -1);
            return;
        }
        submittedRef.current = true;
        setSubmitting(true);
        setSubmitError(null);
        const b = draft.basics;
        const trimmedOrUndefined = (v: string) => (v.trim() ? v.trim() : undefined);
        try {
            const submissionId = await submitOwnerIntake({
                businessName: b.businessName.trim(),
                businessType: b.businessType,
                ownerName: b.ownerName.trim(),
                ownerPhone: b.ownerPhone,
                ownerEmail: b.ownerEmail.trim(),
                address: b.address.trim(),
                city: b.city.trim(),
                province: trimmedOrUndefined(b.province),
                barangay: trimmedOrUndefined(b.barangay),
                postalCode: trimmedOrUndefined(b.postalCode),
                coordinates: draft.coordinates ?? undefined,
                // Canonical display text from INTAKE_QUESTIONS: the mutation matches on it. Blank answers are left out.
                qa: INTAKE_QUESTIONS.map((question) => ({ q: question.q, a: (draft.answers[question.key] ?? "").trim() })).filter((pair) => pair.a.length > 0),
                photos: buildPhotoArray(draft.photos, !!draft.hasProducts),
                hasProducts: !!draft.hasProducts,
                submissionType: "standard",
                campaign: draft.giveawayApplication ? undefined : (campaign ?? undefined),
                affiliateHandle: draft.giveawayApplication ? undefined : (affiliateHandle ?? undefined),
                source: draft.giveawayApplication ? (draft.giveawaySource ?? undefined) : (source ?? undefined),
                giveawayApplication: draft.giveawayApplication ? true : undefined,
                giveawayPosterPhoto: draft.giveawayApplication ? (draft.giveawayPosterPhoto ?? undefined) : undefined,
            });
            const submitted = await convex.query(api.submissions.getById, { id: submissionId }).catch(() => null);
            const quoted = quoteFor(campaign, false, draft.giveawayApplication, affiliatePrice);
            const amount = submitted ? ownerChargeFor(submitted) : affiliateHandle !== null ? null : quoted.total;
            rememberSubmitted({
                email: b.ownerEmail.trim(),
                amount,
                businessName: b.businessName.trim(),
                city: b.city.trim(),
                campaign: submitted ? (submitted.campaign ?? null) : draft.giveawayApplication ? null : normalizeCampaign(campaign),
                customDomain: submitted ? submitted.submissionType === "with_custom_domain" : false,
                giveawayApplication: draft.giveawayApplication,
                ...(amount !== null
                    ? {
                          websitePrice: submitted ? amount - domainAddOnFor(submitted.submissionType ?? "standard", submitted.domainCostPHP, submitted.domainChargedPHP) : quoted.sellPrice,
                          websiteListPrice: submitted ? (submitted.websiteListPrice ?? campaignListPrice(submitted.campaign)) : quoted.listPrice,
                      }
                    : {}),
            });
            clearDraft();
            try {
                window.localStorage.removeItem(AT_KEY);
            } catch {
                /* ignore */
            }
            setDoneEmail(b.ownerEmail.trim());
            setSubmitting(false);
            goTo("done", 1);
            show(draft.giveawayApplication ? "Application sent" : "Sent. We're building your site");
        } catch (error) {
            // A Convex mutation that throws wrote nothing, so releasing the guard is safe.
            submittedRef.current = false;
            setSubmitting(false);
            const message = messageFor(error);
            if (draft.giveawayApplication && message === "The free website giveaway is closed. You can still apply for a website at the regular price.") {
                setGiveawayClosed(true);
                setSubmitError("The giveaway is closed. Your draft is saved on this device.");
            } else setSubmitError(message);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [affiliateHandle, affiliateOffer, affiliatePrice, campaign, convex, draft, giveawayStatus?.open, source, submitOwnerIntake]);

    const onSubmit = (e: FormEvent) => {
        e.preventDefault();
        if (!draft || submitting) return;
        if (screen === "choose" || screen === "done") return;
        if (!validate(screen)) {
            window.requestAnimationFrame(() => document.querySelector<HTMLElement>('[aria-invalid="true"], .is-missing')?.scrollIntoView({ block: "center", behavior: "smooth" }));
            return;
        }
        if (screen === "review") {
            void handleSubmit();
            return;
        }
        goTo(screens[Math.min(at + 1, screens.length - 1)], 1);
    };

    const applyCode = () => {
        const resolved = normalizeCampaign(codeEntry);
        if (!resolved) {
            setCodeRejected(true);
            return;
        }
        rememberCampaign(resolved, source);
        setCampaign(resolved);
        setAffiliateHandle(null);
        setCodeRejected(false);
    };

    /* ---- header: where you are ---- */
    const stage = stageOf(screen);
    const stageProgress = (i: number) => {
        if (stage > i) return 1;
        if (stage < i) return 0;
        const inStage = screens.filter((s) => stageOf(s) === i);
        return (inStage.indexOf(screen) + 1) / inStage.length;
    };
    const flowScreens: ScreenId[] = screens.filter((s) => s !== "choose" && s !== "done");
    const mobileProgress = stage > 3 ? 100 : ((flowScreens.indexOf(screen) + 1) / flowScreens.length) * 100;

    if (!draft || !arrival) {
        return (
            <div className="pb-st" data-scr="loading">
                <header className="pb-st-bar">
                    <div className="v2-wrap pb-st-bar-in">
                        <PbBrand />
                    </div>
                </header>
                <main className="pb-st-main">
                    <div className="v2-wrap pb-st-grid">
                        <div className="pb-st-form" aria-busy="true" aria-label="Loading your form">
                            <div className="pb-st-skel pb-st-skel--h" />
                            <div className="pb-st-skel" />
                        </div>
                    </div>
                </main>
            </div>
        );
    }

    return (
        <div className="pb-st" data-scr={screen}>
            <header className="pb-st-bar" id="nav">
                {(
                    <div className="v2-wrap pb-st-bar-in">
                        <PbBrand />
                        {stage >= 0 && (
                            <ol className="pb-st-prog" aria-label="Your progress">
                                {STAGES.map((t, i) => (
                                    <li key={t} className={stage === i ? "is-on" : stage > i ? "is-done" : ""} style={{ "--p": stageProgress(i) } as CSSProperties}>
                                        <span className="pb-st-pbar">
                                            <i />
                                        </span>
                                        <span className="pb-st-pt">{t}</span>
                                    </li>
                                ))}
                            </ol>
                        )}
                        <div className="pb-st-bar-end">
                            <span key={savedTick} className={`pb-st-saved ${savedTick > 0 ? "is-on" : ""}`} aria-live="polite">
                                {savedTick > 0 ? "Saved" : ""}
                            </span>
                            <Button href={giveaway ? "/v2/giveaway" : "/"} variant="ghost" size="sm" className="pb-st-exit">
                                Save and exit
                            </Button>
                        </div>
                    </div>
                )}
                {stage >= 0 && stage < 4 && (
                    <div className="pb-st-prog-m" aria-hidden="true">
                        <span>
                            Step {Math.min(stage, 3) + 1} of 4 · {STAGES[Math.min(stage, 3)]}
                        </span>
                        <i>
                            <b style={{ width: `${mobileProgress}%` }} />
                        </i>
                    </div>
                )}
            </header>

            <main className="pb-st-main">
                <div className={`v2-wrap pb-st-grid ${screen === "choose" ? "pb-st-grid--choose" : ""}`}>
                    <form className="pb-st-form" onSubmit={onSubmit} noValidate>
                        {giveaway && (
                            <div className="pb-st-camp">
                                <i />
                                Off the Record giveaway · free website
                            </div>
                        )}
                        {!giveaway && campaign === "otr" && (
                            <div className="pb-st-camp">
                                <i />
                                Off the Record viewers · 30% off
                            </div>
                        )}
                        {giveawayClosed && (
                            <div className="pb-st-closed" role="alert">
                                <b>{GIVEAWAY_CLOSED.heading}</b>
                                <p>Your draft is saved on this device. You can still get a website at the regular price.</p>
                                <Button href="/v2/giveaway" variant="dark" size="sm">
                                    See your options
                                </Button>
                            </div>
                        )}

                        <div className={`pb-st-scr ${dir > 0 ? "is-in" : "is-in-back"}`} key={screen}>
                            {renderScreen()}
                        </div>

                        {screen !== "done" && screen !== "choose" && (
                            <div className="pb-st-actions">
                                {at > 0 && (
                                    <button type="button" className="pb-st-back" aria-label="Back" disabled={submitting} onClick={() => goTo(screens[Math.max(0, at - 1)], -1)}>
                                        <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
                                            <path d="M20 12H5m6-6-6 6 6 6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                                        </svg>
                                    </button>
                                )}
                                <button type="submit" className="v2-btn v2-btn--primary pb-st-next" disabled={submitting || (screen !== "review" && uploading !== null && screen === "photos")}>
                                    {submitting ? "Sending…" : screen === "review" ? (giveaway ? "Send my application" : "Send it in") : "Continue"}
                                </button>
                            </div>
                        )}
                    </form>

                    {(
                        <aside className="pb-st-side" aria-label="What your site will look like">
                            <div className="pb-st-stage">
                                <span className="pb-sample-tag pb-st-tag">Sample design · {kind.design}</span>
                                <div className="pb-st-phone">
                                    <SitePhone key={kind.site} src={`/v2/pages-b/${kind.site}-m-long.jpg`} url={address} alt="A sample Tendso site on a phone" />
                                </div>
                            </div>
                            <div className="pb-st-price">
                                {giveaway ? (
                                    <>
                                        <p className="pb-st-price-k">Off the Record giveaway</p>
                                        <p className="pb-st-price-v">
                                            <b>Free.</b> Nothing to pay, no account.
                                        </p>
                                    </>
                                ) : (
                                    <>
                                        <p className="pb-st-price-k">Nothing to pay now</p>
                                        <p className="pb-st-price-v">
                                            {quote.struckTotal !== null && <s>{formatPHP(quote.struckTotal)}</s>} <b>{formatPHP(quote.total)}</b> once, after you see your site.
                                        </p>
                                    </>
                                )}
                            </div>
                        </aside>
                    )}
                </div>
            </main>
            {toast}
        </div>
    );

    /* ---- the screens ---- */
    function renderScreen() {
        const b = draft!.basics;
        if (screen === "choose") return ChooseScreen();
        if (screen === "name")
            return (
                <>
                    <h1 className="pb-st-q">What&apos;s your shop called?</h1>
                    <p className="pb-st-hint">The name on your sign.</p>
                    <label className="sr-only" htmlFor="f-name">
                        Shop name
                    </label>
                    <input
                        className="pb-st-big"
                        id="f-name"
                        name="businessName"
                        type="text"
                        autoComplete="organization"
                        placeholder="Forge Barbers"
                        value={b.businessName}
                        onChange={(e) => setBasic("businessName", e.target.value)}
                        aria-invalid={!!errors.businessName}
                        enterKeyHint="next"
                    />
                    <p className="pb-st-err" aria-live="polite">
                        {errors.businessName}
                    </p>
                    <p className="pb-st-addr">
                        <span>Your web address</span>
                        <b>{address}</b>
                    </p>
                    <p className="pb-st-sub" id="kind-k">
                        What kind of shop?
                    </p>
                    <div className="pb-st-chips" role="radiogroup" aria-labelledby="kind-k">
                        {BUSINESS_TYPES.map((t) => (
                            <button key={t} type="button" role="radio" aria-checked={b.businessType === t} className="pb-st-chip" onClick={() => setBasic("businessType", t)}>
                                {KIND[t]?.label ?? t}
                            </button>
                        ))}
                    </div>
                    <p className="pb-st-err" aria-live="polite">
                        {errors.businessType}
                    </p>
                    <p className="pb-st-price-m">
                        {giveaway ? (
                            <>
                                <b>Free.</b> A gift from Off the Record.
                            </>
                        ) : (
                            <>
                                <b>Nothing to pay now.</b> {formatPHP(quote.total)} once, after you see your site.
                            </>
                        )}
                    </p>
                </>
            );
        if (screen === "reach")
            return (
                <>
                    <h1 className="pb-st-q">How can we reach you?</h1>
                    <p className="pb-st-hint">We send your site here.</p>
                    <div className="pb-st-fields">
                        <Field id="f-owner" label="Your name" error={errors.ownerName}>
                            <input className="pb-st-in" id="f-owner" name="ownerName" type="text" autoComplete="name" placeholder="Juan Dela Cruz" value={b.ownerName} onChange={(e) => setBasic("ownerName", e.target.value)} aria-invalid={!!errors.ownerName} />
                        </Field>
                        <Field id="f-phone" label="Mobile number" error={errors.ownerPhone}>
                            <div className="pb-st-tel">
                                <span>+63</span>
                                <input
                                    className="pb-st-in"
                                    id="f-phone"
                                    name="ownerPhone"
                                    type="tel"
                                    inputMode="numeric"
                                    autoComplete="tel-national"
                                    placeholder="917 123 4567"
                                    value={spacedPhone(b.ownerPhone)}
                                    onChange={(e) => setBasic("ownerPhone", e.target.value.replace(/\D/g, "").replace(/^63/, "").replace(/^0/, "").slice(0, 10))}
                                    aria-invalid={!!errors.ownerPhone}
                                />
                            </div>
                        </Field>
                        <Field id="f-email" label="Email" error={errors.ownerEmail}>
                            <input className="pb-st-in" id="f-email" name="ownerEmail" type="email" autoComplete="email" placeholder="juan@gmail.com" value={b.ownerEmail} onChange={(e) => setBasic("ownerEmail", e.target.value)} aria-invalid={!!errors.ownerEmail} />
                        </Field>
                    </div>
                </>
            );
        if (screen === "where")
            return (
                <>
                    <h1 className="pb-st-q">Where is your shop?</h1>
                    <p className="pb-st-hint">So customers can find you.</p>
                    <div className="pb-st-fields">
                        <Field id="f-street" label="Street" error={errors.address}>
                            <input className="pb-st-in" id="f-street" name="address" type="text" autoComplete="address-line1" placeholder="123 J.P. Rizal St." value={b.address} onChange={(e) => setBasic("address", e.target.value)} aria-invalid={!!errors.address} />
                        </Field>
                        <Field id="f-city" label="City or town" error={errors.city}>
                            <input className="pb-st-in" id="f-city" name="city" type="text" autoComplete="address-level2" placeholder="Marikina" value={b.city} onChange={(e) => setBasic("city", e.target.value)} aria-invalid={!!errors.city} />
                        </Field>
                    </div>
                </>
            );
        if (screen.startsWith("q")) {
            const qi = Number(screen.slice(1));
            const question = INTAKE_QUESTIONS[qi];
            const value = draft!.answers[question.key] ?? "";
            const short = question.key === "year_opened";
            return (
                <>
                    <p className="pb-st-qn">
                        Question {qi + 1} of {INTAKE_QUESTIONS.length}
                    </p>
                    <h1 className="pb-st-q">{question.q}</h1>
                    <p className="pb-st-hint">{question.hint}</p>
                    <label className="sr-only" htmlFor={`f-q${qi}`}>
                        Your answer
                    </label>
                    {short ? (
                        <input className="pb-st-big pb-st-big--short" id={`f-q${qi}`} type="text" inputMode="numeric" placeholder="2014" value={value} onChange={(e) => setAnswer(question.key, e.target.value)} aria-invalid={!!errors[question.key]} />
                    ) : (
                        <textarea className="pb-st-ta" id={`f-q${qi}`} rows={4} placeholder="Type it the way you'd say it." value={value} onChange={(e) => setAnswer(question.key, e.target.value)} aria-invalid={!!errors[question.key]} />
                    )}
                    <p className="pb-st-err" aria-live="polite">
                        {errors[question.key]}
                    </p>
                    <div className="pb-st-voice">
                        {!short && <VoiceMic hasText={value.trim().length > 0} blocked={false} onBusyChange={setVoiceBusy} onText={(text) => appendAnswer(question.key, text)} />}
                        {question.optional && (
                            <button type="button" className="pb-st-skip" disabled={voiceBusy} onClick={() => goTo(screens[at + 1], 1)}>
                                Skip this one
                            </button>
                        )}
                    </div>
                </>
            );
        }
        if (screen === "products")
            return (
                <>
                    <h1 className="pb-st-q">Do you sell things people can see?</h1>
                    <p className="pb-st-hint">Like products on a shelf. We ask for two more photos if you do.</p>
                    <div className="pb-st-chips pb-st-chips--big" role="radiogroup" aria-label="Do you sell things people can see?">
                        <button type="button" role="radio" aria-checked={draft!.hasProducts === true} className="pb-st-chip" onClick={() => patch((p) => ({ ...p, hasProducts: true }))}>
                            Yes
                        </button>
                        <button type="button" role="radio" aria-checked={draft!.hasProducts === false} className="pb-st-chip" onClick={() => patch((p) => ({ ...p, hasProducts: false }))}>
                            No, I do a service
                        </button>
                    </div>
                    <p className="pb-st-err" aria-live="polite">
                        {errors.hasProducts}
                    </p>
                </>
            );
        if (screen === "photos") {
            const slots = visibleSlots(!!draft!.hasProducts);
            return (
                <>
                    <h1 className="pb-st-q">Now show us the place.</h1>
                    <p className="pb-st-hint">Straight from your phone is fine. We make them look professional.</p>
                    <div className="pb-st-slots">
                        {slots.map((slot) => {
                            const url = draft!.photos[slot.index];
                            const missing = !!errors.photos && !slot.optional && !url;
                            return (
                                <div key={slot.index} className={`pb-st-slot ${url ? "has-photo" : ""} ${missing ? "is-missing" : ""}`}>
                                    <label className="pb-st-slot-pick">
                                        <input
                                            type="file"
                                            accept="image/jpeg,image/png"
                                            className="sr-only"
                                            disabled={uploading !== null}
                                            onChange={(e) => {
                                                const file = e.target.files?.[0];
                                                e.target.value = "";
                                                if (file) void pickPhoto(slot, file);
                                            }}
                                        />
                                        <span className="pb-st-slot-empty">
                                            <span className="pb-st-slot-plus">
                                                <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
                                                    <path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                                                </svg>
                                            </span>
                                            <span className="pb-st-slot-l">{slot.label}</span>
                                            <span className="pb-st-slot-h">{uploading === slot.index ? "Uploading…" : slot.optional ? "Optional" : "Needed"}</span>
                                        </span>
                                        {url && (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img src={url} alt={slot.label} />
                                        )}
                                    </label>
                                    {url && (
                                        <button type="button" className="pb-st-slot-x" aria-label={`Remove photo: ${slot.label}`} onClick={() => removePhoto(slot)}>
                                            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
                                                <path d="m3 3 8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                                            </svg>
                                        </button>
                                    )}
                                    <span className="sr-only">{slot.hint}</span>
                                </div>
                            );
                        })}
                    </div>
                    <p className="pb-st-err" aria-live="polite">
                        {photoErr ?? errors.photos}
                    </p>
                </>
            );
        }
        if (screen === "poster")
            return (
                <>
                    <p className="pb-st-qn">One more photo</p>
                    <h1 className="pb-st-q">Show the poster in your shop.</h1>
                    <p className="pb-st-hint">Your sign or shop front in the same photo.</p>
                    <div className="pb-st-slots pb-st-slots--one">
                        <div className={`pb-st-slot ${draft!.giveawayPosterPhoto ? "has-photo" : ""} ${errors.poster ? "is-missing" : ""}`}>
                            <label className="pb-st-slot-pick">
                                <input
                                    type="file"
                                    accept="image/jpeg,image/png"
                                    className="sr-only"
                                    disabled={uploading !== null}
                                    onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        e.target.value = "";
                                        if (file) void pickPoster(file);
                                    }}
                                />
                                <span className="pb-st-slot-empty">
                                    <span className="pb-st-slot-plus">
                                        <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
                                            <path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                                        </svg>
                                    </span>
                                    <span className="pb-st-slot-l">Poster photo</span>
                                    <span className="pb-st-slot-h">{uploading === "poster" ? "Uploading…" : "Needed"}</span>
                                </span>
                                {draft!.giveawayPosterPhoto && (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={draft!.giveawayPosterPhoto} alt="Poster photo" />
                                )}
                            </label>
                            {draft!.giveawayPosterPhoto && (
                                <button type="button" className="pb-st-slot-x" aria-label="Remove poster photo" onClick={() => patch((p) => ({ ...p, giveawayPosterPhoto: null }))}>
                                    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
                                        <path d="m3 3 8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                                    </svg>
                                </button>
                            )}
                        </div>
                    </div>
                    <p className="pb-st-err" aria-live="polite">
                        {photoErr ?? errors.poster}
                    </p>
                </>
            );
        if (screen === "review") return ReviewScreen();
        return DoneScreen();
    }

    function ReviewScreen() {
        const b = draft!.basics;
        const answered = INTAKE_QUESTIONS.filter((q) => (draft!.answers[q.key] ?? "").trim()).length;
        const slots = visibleSlots(!!draft!.hasProducts).filter((s) => draft!.photos[s.index]);
        const rows: [string, string][] = [
            ["Shop", b.businessName],
            ["Kind", KIND[b.businessType]?.label ?? b.businessType],
            ["You", b.ownerName],
            ["Mobile", b.ownerPhone ? `+63 ${spacedPhone(b.ownerPhone)}` : ""],
            ["Email", b.ownerEmail],
            ["Address", [b.address, b.city].filter(Boolean).join(", ")],
        ];
        return (
            <>
                <h1 className="pb-st-q">Does this look right?</h1>
                <div className="pb-st-cards">
                    <section className="pb-st-card">
                        <header>
                            <h2>Your shop</h2>
                            <button type="button" className="pb-st-edit" onClick={() => goTo("name", -1)}>
                                Edit
                            </button>
                        </header>
                        <dl>
                            {rows.map(([k, v]) => (
                                <div key={k}>
                                    <dt>{k}</dt>
                                    <dd>{v || "—"}</dd>
                                </div>
                            ))}
                        </dl>
                    </section>
                    <section className="pb-st-card">
                        <header>
                            <h2>Your answers</h2>
                            <button type="button" className="pb-st-edit" onClick={() => goTo("q0", -1)}>
                                Edit
                            </button>
                        </header>
                        <p className="pb-st-count">
                            <b>{answered}</b> of {INTAKE_QUESTIONS.length} answered
                        </p>
                    </section>
                    <section className="pb-st-card">
                        <header>
                            <h2>Photos</h2>
                            <button type="button" className="pb-st-edit" onClick={() => goTo("photos", -1)}>
                                Edit
                            </button>
                        </header>
                        <div className="pb-st-strip">
                            {slots.length === 0 && !draft!.giveawayPosterPhoto && <span className="pb-st-none">No photos yet</span>}
                            {slots.map((s) => (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img key={s.index} src={draft!.photos[s.index]} alt={s.label} />
                            ))}
                            {giveaway && draft!.giveawayPosterPhoto && (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={draft!.giveawayPosterPhoto} alt="Poster photo" />
                            )}
                        </div>
                    </section>
                    <section className="pb-st-card pb-st-card--price">
                        {giveaway ? (
                            <>
                                <p className="pb-st-pay-k">
                                    <i />
                                    Free website
                                </p>
                                <p className="pb-st-pay-v">A gift from Off the Record, built by Tendso.</p>
                            </>
                        ) : (
                            <>
                                <p className="pb-st-pay-k">
                                    <i />
                                    Nothing to pay now
                                </p>
                                <p className="pb-st-pay-v">
                                    <b>{formatPHP(quote.total)}</b> once{quote.discounted && quote.percentOff ? ` (${quote.percentOff}% off ${formatPHP(quote.listPrice)})` : ""}. See it first. Pay once to publish.
                                </p>
                                {affiliateHandle === null && (
                                    <details className="pb-st-code">
                                        <summary>Have a discount code?</summary>
                                        <div className="pb-st-code-in">
                                            <label className="sr-only" htmlFor="f-code">
                                                Discount code
                                            </label>
                                            <input
                                                className="pb-st-in"
                                                id="f-code"
                                                type="text"
                                                placeholder="Your code"
                                                value={codeEntry}
                                                onChange={(e) => {
                                                    setCodeEntry(e.target.value);
                                                    setCodeRejected(false);
                                                }}
                                                onBlur={() => codeEntry.trim() && applyCode()}
                                                onKeyDown={(e) => {
                                                    if (e.key === "Enter") {
                                                        e.preventDefault();
                                                        applyCode();
                                                    }
                                                }}
                                                autoCapitalize="characters"
                                                aria-invalid={codeRejected}
                                            />
                                            <p className={codeRejected ? "pb-st-err" : "pb-st-help"}>{codeRejected ? "We don't know that code." : quote.code ? `Code ${quote.code} applied.` : "We apply it before you pay."}</p>
                                        </div>
                                    </details>
                                )}
                            </>
                        )}
                        <p className="pb-st-addr pb-st-addr--card">
                            <span>Your web address</span>
                            <b>{address}</b>
                        </p>
                    </section>
                </div>
                {submitError && (
                    <p className="pb-st-err pb-st-err--block" role="alert">
                        {submitError}
                    </p>
                )}
            </>
        );
    }

    function DoneScreen() {
        return (
            <>
                <div className="pb-st-done-mark">
                    <CheckIcon size={34} />
                </div>
                <h1 className="pb-st-q pb-st-q--done">Got it.</h1>
                <p className="pb-st-done-p">
                    {giveaway
                        ? "Off the Record checks your poster photo. If you qualify, we build your free site and email the link to "
                        : "We build your site in about 20 minutes and email the link to "}
                    <b>{doneEmail}</b>.{giveaway ? "" : " Ask for changes, or say it looks good."}
                </p>
                {!giveaway && (
                    <div className="pb-price-pills pb-st-done-pills">
                        <span>See it first</span>
                        <span>Pay once to publish</span>
                    </div>
                )}
                <div className="pb-st-done-cta">
                    <Button href="/" variant="dark">
                        Back to Tendso
                    </Button>
                    <Button href="/v2/help" variant="ghost">
                        Questions? Help
                    </Button>
                </div>
            </>
        );
    }

    function ChooseScreen() {
        const stores = creatorStoreButtons(platform, playUrl, iosUrl).map((s) => ({ ...s, href: withPlayReferrer(s.href, arrival!.code) }));
        return (
            <>
                <h1 className="pb-st-q">Start your website.</h1>
                <p className="pb-st-hint">About 20 minutes. See it first. Pay once to publish.</p>
                {arrival!.code && (
                    <p className="pb-st-code-pill">
                        <i />
                        Code <b>{arrival!.code}</b> goes with you
                    </p>
                )}
                <div className="pb-st-choose">
                    {stores.map((s, i) => (
                        <Button key={s.href} href={s.href} variant={i === 0 ? "primary" : "ghost"} size="lg" block rel={s.href.startsWith("https://") ? "noopener noreferrer" : undefined}>
                            {i === 0 && stores.length === 1 ? "Download the app" : s.label}
                        </Button>
                    ))}
                    <Button variant="ghost" size="lg" block onClick={() => goTo("name", 1)}>
                        Do it on the web instead
                    </Button>
                </div>
                <p className="pb-st-help">The web way takes about 10 minutes: your shop, a few questions, a few photos.</p>
                <p className="pb-st-help">
                    Questions? <Link href="/v2/help">Help</Link>
                </p>
            </>
        );
    }
}

function Field({ id, label, error, children }: { id: string; label: string; error?: string; children: ReactNode }) {
    return (
        <div className="pb-st-field">
            <label className="pb-st-field-k" htmlFor={id}>
                {label}
            </label>
            {children}
            <p className="pb-st-err" aria-live="polite">
                {error}
            </p>
        </div>
    );
}

