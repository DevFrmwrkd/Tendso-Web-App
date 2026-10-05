"use client";

/**
 * Lightweight EN/Tagalog localization for the public landing page.
 *
 * The landing is static marketing (no per-request data), so a full i18n library
 * is overkill. This is a React context + a `useT()` hook returning `t(key)`.
 * The chosen language persists in localStorage and is read on mount.
 *
 * Adding copy: add the key to BOTH `en` and `tl` below, then call `t("key")`
 * in the component. A missing `tl` value falls back to `en`, so partial
 * translation never shows a blank — it shows English until the Tagalog lands.
 *
 * Tagalog copy here is natural Taglish (how the audience actually speaks);
 * brand terms (Tendso, ₱, Wise, Gemini) stay verbatim. Have a native speaker
 * review before treating it as final marketing copy.
 */

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Lang = "en" | "tl";

type Dict = Record<string, string>;

const EN: Dict = {
    // Navbar
    "nav.live": "Live in Philippines · expanding",
    "nav.getApp": "Get the app",
    "nav.how": "How it works",
    "nav.sites": "Real sites",
    "nav.pricing": "Pricing",
    "nav.creators": "For creators",

    // Hero
    "hero.trustChip": "Operated by VONAS, OPC — a registered PH company",
    "hero.h1a": "Tendso builds your website.",
    "hero.h1b": "Pay only ",
    "hero.h1c": "when it's live.",
    "hero.em": "See your site before you pay a single peso.",
    "hero.lede":
        "A trained Tendso creator visits your shop, asks a few questions, and photographs your work. We turn it into a real, coded website — live in 48–72 hours. You pay ₱999 once, only after it's up and you're happy.",
    "hero.tag1": "Pay only when it's live",
    "hero.tag2": "Live in 48–72 hours",
    "hero.tag3": "₱999 one-time",
    "hero.tag4": "A real coded site — no template",
    "hero.tag5": "A creator comes to you",
    "hero.pickDoor": "Pick a door",
    "hero.doorBusiness": "I own a business",
    "hero.doorBusinessSub": "A real page, built for me",
    "hero.doorBusinessNote":
        "Keep working — a creator handles everything and comes to your shop. You review the site and pay only when it's live.",
    "hero.doorCreator": "I want to earn",
    "hero.doorCreatorSub": "Become a certified creator",
    "hero.doorCreatorNote":
        "Help owners who can't stop working. Keep 50% of every site you sell — from ₱500 up to ₱2,500, plus ₱1,000 per referral. Paid to your Wise wallet.",
    "hero.scroll": "Or scroll — see real sites we've built below.",
    "hero.trustTitle": "Straight answers",
    "hero.trust1": "You pay only after your site is live — ₱999 once, or ₱1,499 with your own domain.",
    "hero.trust2": "Operated by VONAS, OPC — a registered Philippine company.",
    "hero.trust3": "Real, working websites for real local businesses. See them below.",
    "hero.ctaBusiness": "Get a website",
    "hero.ctaProof": "See real sites",
    "hero.previewCaption": "A real site we built",
    "hero.creatorLead": "Want to earn instead?",
    "hero.creatorLink": "Become a Tendso creator →",
    "hero.counterCreators": "creators",
    "hero.counterBusinesses": "live sites",
    "hero.counterCities": "cities",
    "hero.counterCountries": "countries",

    // Real Sites (proof)
    "proof.eyebrow": "Real work",
    "proof.title": "Real businesses. Real live sites.",
    "proof.lede":
        "Every site below was built for a real Filipino business by a Tendso creator. Click any card to open the live site — these aren't mockups.",
    "proof.visit": "Visit site",
    "proof.statSitesLabel": "live sites",
    "proof.statCreatorsLabel": "creators",

    // How it works
    "how.eyebrow": "How it works",
    "how.titleA": "Two paths.",
    "how.titleB": "Pick yours.",
    "how.lede":
        "One's for business owners who want a real site. The other's for creators who want to earn building them.",
    "how.bizLabel": "For business owners",
    "how.biz1": "A trained creator comes to your shop — no app to download, no account to make.",
    "how.biz2": "Answer a few questions while they photograph your work. About 30 minutes.",
    "how.biz3": "We build a real, coded website from it — most go live within 48–72 hours.",
    "how.biz4": "Review it, and pay only once it's live — ₱999, or ₱1,499 with your own domain.",
    "how.bizCta": "Get a website",
    "how.creatorLabel": "For creators",
    "how.creator1": "Download the app and verify your phone.",
    "how.creator2": "Get certified — free, and about 20 minutes.",
    "how.creator3": "Visit local businesses with guided, step-by-step capture.",
    "how.creator4": "Keep 50% of every sale — ₱500 on a ₱999 site, plus ₱1,000 per referral.",
    "how.creatorCta": "Become a creator",

    // Process (your part)
    "process.eyebrow": "Your part",
    "process.titleA": "You keep working.",
    "process.titleB": "We build the page.",
    "process.lede": "Half an hour of your time, all together. We do the rest.",
    "process.s1h": "We take the photos",
    "process.s1cost": "10 min",
    "process.s1sub":
        "Someone from Tendso comes to your shop and takes pictures of your work, your place, and you. You don't need to prepare anything or tidy up.",
    "process.s2h": "You answer a few questions",
    "process.s2cost": "20 min",
    "process.s2sub":
        "They ask you simple questions while you keep working — the same things you'd tell a customer who walked in. No writing, no computer.",
    "process.s3h": "We build your page",
    "process.s3cost": "none of it yours",
    "process.s3sub":
        "We put your photos and your answers together into your own website. You don't design anything, and you don't pick from a list of layouts.",
    "process.s4h": "You check it, then it's live",
    "process.s4cost": "one look",
    "process.s4sub":
        "We show it to you first. Change something, or leave it exactly as it is. Then it goes online, and you get back to work.",
    "process.kitLabel": "What you get",
    "process.kit1": "Your own website",
    "process.kit2": "Your own web address",
    "process.kit3": "We keep it online",
    "process.kit4": "Easy to find on Google",
    "process.kit5": "Photos you can post",
    "process.kit6": "Your menu or price list",
    "process.kit7": "Looks right when shared",
    "process.turnaroundLabel": "from start to finish",

    // Process — creator variant (/for-creators). Same shell as `process.*`
    // above, but every "you" here is the CREATOR doing the visit, not the shop
    // owner receiving the site. Never let these two blocks borrow each other's
    // strings. {b} = lowest price, {c} = website price (interpolated from
    // lib/pricing.ts by ProcessSection — do not hardcode the numbers here).
    "process.creator.eyebrow": "Your part",
    "process.creator.titleA": "You do the visit.",
    "process.creator.titleB": "We do the build.",
    "process.creator.lede":
        "About 30 minutes inside one shop. No design, no writing, no code — the app walks you through all of it.",
    "process.creator.s1h": "You find the shop",
    "process.creator.s1cost": "your pick",
    "process.creator.s1sub":
        "A barbershop, a carinderia, a repair shop — any business near you without a real website. The app lists nearby leads, or you bring your own.",
    "process.creator.s2h": "You shoot and you ask",
    "process.creator.s2cost": "~30 min on site",
    "process.creator.s2sub":
        "Guided step by step: at least 3 photos of the place and the work, then a recorded interview with the owner — video or audio. Your phone is the only gear.",
    "process.creator.s3h": "We build the site",
    "process.creator.s3cost": "none of it yours",
    "process.creator.s3sub":
        "You submit and you’re done. We turn your photos and that interview into a real coded website, usually live in 48–72 hours. You design nothing.",
    "process.creator.s4h": "Owner approves, you get paid",
    "process.creator.s4cost": "50% of the sale",
    "process.creator.s4sub":
        "The website is {c}, and you can discount your offer to as low as {b}. When the owner approves their site, your half reaches your Wise account within 48 hours.",
    "process.creator.kitLabel": "What you keep",
    "process.creator.kit1": "50% of every sale",
    "process.creator.kit2": "Discount as low as {b}",
    "process.creator.kit3": "You set the discount",
    "process.creator.kit4": "Paid through Wise",
    "process.creator.kit5": "Guided in the app",
    "process.creator.kit6": "No quota, no shift",
    "process.creator.statLabel": "of every sale you make",

    // Business pricing
    "price.eyebrow": "The price",
    "price.once": "once.",
    "price.liveForever": "Live forever.",
    "price.lede":
        "One-time payment. No monthly fees. No contracts. You only pay once your website is live and you've approved it.",
    "price.oneTime": "One-time · pay only when live",
    "price.badge": "Most chosen",
    "price.tierStandard": "Standard",
    "price.taglineStandard": "A real website, built around your work.",
    "price.tierDomain": "With custom domain",
    "price.taglineDomain": "Your own .com — fully yours, never tied to us.",
    "price.stdF1": "A real coded website — not a fill-in template",
    "price.stdF2": "Your own live web address",
    "price.stdF3": "Built from your photos and your words",
    "price.stdF4": "Mobile-first — customers find you on their phones",
    "price.stdF5": "Hosted with SSL, kept online",
    "price.stdF6": "Free edits for the first year — ask us, we make the change",
    "price.domF1": "Everything in Standard",
    "price.domF2": "Your own custom domain (.com, .net, .shop…)",
    "price.domF3": "Year 1 of the domain included",
    "price.domF4": "You own the domain — we never auto-renew",
    "price.domF5": "A reminder before it renews",
    "price.domF6": "Same build, same review-before-you-pay",
    "price.domainAddon":
        "Optional add-on: prefer your own custom .com? We can register and set one up when your site goes live — just ask.",
    "price.footnote":
        "No card on file. No fine print. No charges later.",

    // CTA
    "cta.title": "Your work deserves a page.",
    "cta.subtitle": "Most sites live within 48–72 hours. Pay only when you're happy with it.",
    "cta.business": "I own a business",
    "cta.creator": "I want to earn as a creator",

    // FAQ
    "faq.title": "Questions, answered.",
    "faq.eyebrow": "Questions",
    "faq.tabBusiness": "For business owners",
    "faq.tabCreators": "For creators",

    // Manifesto
    "manifesto.eyebrow": "Manifesto",
    "manifesto.line1": "They didn't come here to become designers.",
    "manifesto.line2": "They came to keep the business moving.",
    "manifesto.b1label": "What we respect",
    "manifesto.b1big": "The work",
    "manifesto.b1sub":
        "Sari-sari stores, salons, barangay clinics — the shops where someone is already kneading, cutting, or fixing while you read this.",
    "manifesto.b2label": "How fast",
    "manifesto.b2big": "48–72h",
    "manifesto.b2sub":
        "From the day a creator walks into your shop to the day your page is live. You keep working through all of it.",
    "manifesto.b3label": "What it takes from you",
    "manifesto.b3big": "A photo",
    "manifesto.b3sub": "A few answers. A guided review. That's the whole ask — we built the rest around the work.",

    // App download (the creator app)
    "app.eyebrow": "The creator app",
    "app.titleA": "Take Tendso",
    "app.titleB": "with you.",
    "app.lede":
        "The app our creators use in the field — get certified, capture businesses, and track your earnings, right from your phone.",
    "app.downloadOn": "Download on the",
    "app.getOn": "Get it on",
    "app.scan": "Scan to install on Android",
    "app.status": "Available now on iOS and Android",

    // Creator earnings teaser
    "earn.eyebrow": "For creators",
    "earn.titleA": "Earn by bringing them",
    "earn.titleB": "online.",
    "earn.lede": "Plain numbers, straight from our pricing — no projections, no fine print.",
    "earn.f1label": "of every sale",
    "earn.f1sub": "That's {a} on a {b} site — your half of every website you sell.",
    "earn.f2label": "per referral",
    "earn.f2sub": "When a creator you invite lands their first paid site.",
    "earn.f3label": "straight to your wallet",
    "earn.f3sub": "Paid within 48 hours of the owner approving their site.",
    "earn.cta": "Become a creator",

    // Final CTA
    "cta.eyebrow": "The vision",
    "cta.slogan1": "The Thinking Ends Here.",
    "cta.slogan2": "So the work doesn't.",
    "cta.doorBiz": "For business owners",
    "cta.bizSub": "A page built around your work — a creator visits, you keep going, it goes live.",
    "cta.doorCreator": "For creators",
    "cta.creatorSub": "Help owners who can't stop working. Real earnings, real referrals, paid via Wise.",
    "cta.go": "Enter",
    "cta.altBizLead": "Own a business instead?",

    // Footer
    "footer.blurb":
        "Real websites for Filipino local businesses — built by trained creators who come to you, live in days, and paid for only once it's live.",
    "footer.company": "Operated by VONAS, OPC — a registered Philippine company.",
    "footer.appCol": "Get the app",
    "footer.comingSoon": "Coming soon",
    "footer.kb": "Knowledge base",
    "footer.help": "Help",
    "footer.legal": "Legal",
    "footer.privacy": "Privacy",
    "footer.terms": "Terms",
    "footer.contact": "Contact",
    "footer.language": "Language",

    // For-business + For-creators pages
    "biz.back": "Back to home",
    "biz.seePrice": "See the price",
    "creator.h1a": "Get paid to build websites",
    "creator.h1em": "for shops near you.",
    "creator.lede":
        "Bring a phone and follow the in-app checklist. You visit a local shop, photograph the work, and submit — we do the building, the writing, the deploying. You keep 50% of every site, paid to your Wise wallet.",
    "creator.ctaStart": "Start free certification",
    // /for-creators says three things about money and no more: the website
    // price ({c}), how low a creator may discount it ({b}), and their half.
    // No peso earnings are quoted, on purpose.
    "creator.earn.f1sub": "Your half of every website you sell.",
    "creator.earn.f2label": "the website price",
    "creator.earn.f2sub": "Paid once by the owner, and only after their site is live.",
    "creator.earn.f3label": "the lowest you can offer",
    "creator.earn.f3sub": "You can put a discount on your offer to a shop. You decide how much.",
    "creator.earn.note":
        "Your half goes to your Wise wallet within 48 hours of the owner approving their site. No projections, just your share of what you actually sell.",
    "creator.apply.step4": "Keep 50% of every sale you make.",
    "creator.apply.eyebrow": "How to start",
    "creator.apply.title": "From this page",
    "creator.apply.titleEm": "to your first payout.",
    "creator.apply.lede":
        "The full apply-and-certify flow lives in the app. Here's the shape of it — free to start, no experience needed.",
    "creator.apply.tag1": "Free to apply",
    "creator.apply.tag2": "No experience required",
    "creator.apply.tag3": "Keep your day job",
    "creator.apply.cta": "Start free certification",
};

const TL: Dict = {
    // Navbar
    "nav.live": "Live sa Pilipinas · palawak pa",
    "nav.getApp": "Kunin ang app",
    "nav.how": "Paano gumagana",
    "nav.sites": "Totoong sites",
    "nav.pricing": "Presyo",
    "nav.creators": "Para sa creators",

    // Hero
    "hero.trustChip": "Pinapatakbo ng VONAS, OPC — rehistradong kompanya sa PH",
    "hero.h1a": "Ginagawa ng Tendso ang website mo.",
    "hero.h1b": "Bayad lang ",
    "hero.h1c": "kapag live na.",
    "hero.em": "Makikita mo ang site bago ka magbayad ng kahit piso.",
    "hero.lede":
        "May sanay na Tendso creator na bibisita sa tindahan mo, magtatanong ng ilang bagay, at kukunan ng litrato ang trabaho mo. Gagawin naming totoong website — live sa loob ng 48–72 oras. Magbabayad ka ng ₱999 nang isang beses, kapag nakalive na at kuntento ka na.",
    "hero.tag1": "Bayad lang kapag live na",
    "hero.tag2": "Live sa 48–72 oras",
    "hero.tag3": "₱999 isang beses",
    "hero.tag4": "Totoong coded na site — walang template",
    "hero.tag5": "May creator na pupunta sa'yo",
    "hero.pickDoor": "Pumili ng pinto",
    "hero.doorBusiness": "May negosyo ako",
    "hero.doorBusinessSub": "Totoong page, ginawa para sa akin",
    "hero.doorBusinessNote":
        "Ituloy mo lang ang trabaho — ang creator ang bahala sa lahat at pupunta sa tindahan mo. Ikaw ang magre-review ng site at magbabayad lang kapag live na.",
    "hero.doorCreator": "Gusto kong kumita",
    "hero.doorCreatorSub": "Maging certified creator",
    "hero.doorCreatorNote":
        "Tulungan ang mga may-ari na hindi makatigil sa trabaho. Panatilihin ang 50% ng bawat site na maibenta mo — mula ₱500 hanggang ₱2,500, plus ₱1,000 kada referral. Bayad sa Wise wallet mo.",
    "hero.scroll": "O mag-scroll — tingnan ang totoong mga site na ginawa namin sa ibaba.",
    "hero.trustTitle": "Diretsong sagot",
    "hero.trust1": "Magbabayad ka lang kapag live na ang site — ₱999 isang beses, o ₱1,499 kung may sariling domain.",
    "hero.trust2": "Pinapatakbo ng VONAS, OPC — rehistradong kompanya sa Pilipinas.",
    "hero.trust3": "Totoo at gumaganang website para sa totoong lokal na negosyo. Tingnan sa ibaba.",
    "hero.ctaBusiness": "Kumuha ng website",
    "hero.ctaProof": "Tingnan ang totoong mga site",
    "hero.previewCaption": "Totoong site na ginawa namin",
    "hero.creatorLead": "Gusto mo bang kumita?",
    "hero.creatorLink": "Maging Tendso creator →",
    "hero.counterCreators": "mga creator",
    "hero.counterBusinesses": "live na site",
    "hero.counterCities": "mga lungsod",
    "hero.counterCountries": "mga bansa",

    // Real Sites (proof)
    "proof.eyebrow": "Totoong gawa",
    "proof.title": "Totoong negosyo. Totoong live na site.",
    "proof.lede":
        "Bawat site sa ibaba ay ginawa para sa totoong negosyong Pilipino ng isang Tendso creator. I-click ang kahit alin para buksan ang live na site — hindi ito mockup.",
    "proof.visit": "Bisitahin",
    "proof.statSitesLabel": "live na site",
    "proof.statCreatorsLabel": "mga creator",

    // How it works
    "how.eyebrow": "Paano gumagana",
    "how.titleA": "Dalawang daan.",
    "how.titleB": "Piliin ang sa'yo.",
    "how.lede":
        "Ang isa ay para sa may-ari ng negosyo na gustong magkaroon ng site. Ang isa naman ay para sa creator na gustong kumita sa paggawa nito.",
    "how.bizLabel": "Para sa may-ari ng negosyo",
    "how.biz1": "May sanay na creator na pupunta sa tindahan mo — walang app na ida-download, walang account na gagawin.",
    "how.biz2": "Sagutin ang ilang tanong habang kinukunan nila ng litrato ang trabaho mo. Mga 30 minuto.",
    "how.biz3": "Gagawa kami ng totoong coded na website mula rito — karamihan ay live sa loob ng 48–72 oras.",
    "how.biz4": "I-review ito, at magbayad lang kapag live na — ₱999, o ₱1,499 kung may sariling domain.",
    "how.bizCta": "Kumuha ng website",
    "how.creatorLabel": "Para sa creators",
    "how.creator1": "I-download ang app at i-verify ang numero mo.",
    "how.creator2": "Mag-certified — libre, at mga 20 minuto.",
    "how.creator3": "Bumisita sa mga lokal na negosyo gamit ang guided na capture.",
    "how.creator4": "Panatilihin ang 50% ng bawat benta — ₱500 sa isang ₱999 na site, plus ₱1,000 kada referral.",
    "how.creatorCta": "Maging creator",

    // Process (your part)
    "process.eyebrow": "Ang parte mo",
    "process.titleA": "Ituloy mo lang ang trabaho.",
    "process.titleB": "Kami ang gagawa ng page.",
    "process.lede": "Kalahating oras lang ng oras mo, lahat-lahat. Kami na ang bahala sa iba.",
    "process.s1h": "Kami ang kukuha ng litrato",
    "process.s1cost": "10 min",
    "process.s1sub":
        "May pupunta mula sa Tendso sa tindahan mo at kukunan ng litrato ang trabaho mo, ang lugar mo, at ikaw. Hindi mo kailangang maghanda o maglinis.",
    "process.s2h": "Sasagot ka ng ilang tanong",
    "process.s2cost": "20 min",
    "process.s2sub":
        "Magtatanong sila ng simple habang nagtatrabaho ka — ang mga bagay na sasabihin mo rin sa customer na pumasok. Walang isusulat, walang computer.",
    "process.s3h": "Kami ang gagawa ng page mo",
    "process.s3cost": "wala sa'yo",
    "process.s3sub":
        "Pagsasama-samahin namin ang litrato at sagot mo para gawing sarili mong website. Wala kang idi-disenyo, at hindi ka pipili mula sa listahan ng layout.",
    "process.s4h": "I-check mo, tapos live na",
    "process.s4cost": "isang tingin",
    "process.s4sub":
        "Ipapakita muna namin sa'yo. Magpalit ng kahit ano, o hayaan lang kung ano. Tapos mao-online na ito, at makakabalik ka na sa trabaho.",
    "process.kitLabel": "Ang makukuha mo",
    "process.kit1": "Sarili mong website",
    "process.kit2": "Sarili mong web address",
    "process.kit3": "Pinapanatili naming online",
    "process.kit4": "Madaling mahanap sa Google",
    "process.kit5": "Litrato na pwede mong i-post",
    "process.kit6": "Menu o presyo mo",
    "process.kit7": "Maganda kapag na-share",
    "process.turnaroundLabel": "mula simula hanggang tapos",

    // Process — creator variant (/for-creators). Tingnan ang EN block: ang
    // "ikaw" dito ay ang CREATOR na bibisita, hindi ang may-ari ng tindahan.
    "process.creator.eyebrow": "Ang parte mo",
    "process.creator.titleA": "Ikaw ang bibisita.",
    "process.creator.titleB": "Kami ang gagawa.",
    "process.creator.lede":
        "Mga 30 minuto sa loob ng isang tindahan. Walang idi-disenyo, walang isusulat, walang code — gagabayan ka ng app.",
    "process.creator.s1h": "Ikaw ang pipili ng tindahan",
    "process.creator.s1cost": "ikaw ang pipili",
    "process.creator.s1sub":
        "Barbershop, carinderia, repair shop — kahit anong negosyo malapit sa’yo na walang totoong website. May listahan ng malalapit na lead sa app, o ikaw mismo ang magdala.",
    "process.creator.s2h": "Ikaw ang kukuha at magtatanong",
    "process.creator.s2cost": "~30 min sa lugar",
    "process.creator.s2sub":
        "Gagabayan ka step by step: hindi bababa sa 3 litrato ng lugar at ng trabaho, tapos isang recorded na interview sa may-ari — video o audio. Cellphone mo lang ang kailangan.",
    "process.creator.s3h": "Kami ang gagawa ng site",
    "process.creator.s3cost": "wala sa’yo",
    "process.creator.s3sub":
        "Pagka-submit mo, tapos ka na. Gagawin naming totoong coded na website ang litrato at interview mo — karaniwang live sa loob ng 48–72 oras. Wala kang idi-disenyo.",
    "process.creator.s4h": "Kapag na-approve, bayad ka na",
    "process.creator.s4cost": "50% ng benta",
    "process.creator.s4sub":
        "{c} ang website, at pwede mong i-discount ang alok mo hanggang {b}. Kapag inaprubahan ng may-ari ang site nila, mapupunta ang kalahati mo sa Wise account mo sa loob ng 48 oras.",
    "process.creator.kitLabel": "Ang mapupunta sa’yo",
    "process.creator.kit1": "50% ng bawat benta",
    "process.creator.kit2": "Discount hanggang {b}",
    "process.creator.kit3": "Ikaw ang nagtatakda ng discount",
    "process.creator.kit4": "Bayad sa pamamagitan ng Wise",
    "process.creator.kit5": "May gabay sa app",
    "process.creator.kit6": "Walang quota, walang shift",
    "process.creator.statLabel": "ng bawat benta mo",

    // Business pricing
    "price.eyebrow": "Ang presyo",
    "price.once": "isang beses.",
    "price.liveForever": "Live habambuhay.",
    "price.lede":
        "Isang bayad lang. Walang buwanang bayad. Walang kontrata. Magbabayad ka lang kapag live na ang website mo at na-approve mo na.",
    "price.oneTime": "Isang beses · bayad lang kapag live na",
    "price.badge": "Madalas piliin",
    "price.tierStandard": "Standard",
    "price.taglineStandard": "Totoong website, ginawa base sa trabaho mo.",
    "price.tierDomain": "May sariling domain",
    "price.taglineDomain": "Sarili mong .com — ganap na sa'yo, hindi nakatali sa amin.",
    "price.stdF1": "Totoong coded na website — hindi fill-in na template",
    "price.stdF2": "Sarili mong live na web address",
    "price.stdF3": "Ginawa mula sa litrato at salita mo",
    "price.stdF4": "Mobile-first — mahahanap ka ng customer sa phone nila",
    "price.stdF5": "Naka-host na may SSL, pinapanatiling online",
    "price.stdF6": "Libreng edits sa loob ng unang taon — sabihin mo lang, kami na ang magpapalit",
    "price.domF1": "Lahat ng nasa Standard",
    "price.domF2": "Sarili mong custom domain (.com, .net, .shop…)",
    "price.domF3": "Kasama ang unang taon ng domain",
    "price.domF4": "Sa'yo ang domain — hindi namin auto-nirerenew",
    "price.domF5": "May paalala bago mag-renew",
    "price.domF6": "Parehong build, parehong review bago magbayad",
    "price.domainAddon":
        "Optional add-on: gusto ng sariling custom na .com? Pwede naming i-register at i-set up kapag live na ang site — sabihin mo lang.",
    "price.footnote":
        "Walang card na nakatago. Walang maliit na letra. Walang sorpresang singil.",

    // CTA
    "cta.title": "May karapatan ang trabaho mo sa sariling page.",
    "cta.subtitle": "Karamihan ay live sa loob ng 48–72 oras. Magbayad lang kapag masaya ka na dito.",
    "cta.business": "May negosyo ako",
    "cta.creator": "Gusto kong kumita bilang creator",

    // FAQ
    "faq.title": "Mga tanong, nasagot na.",
    "faq.eyebrow": "Mga tanong",
    "faq.tabBusiness": "Para sa may-ari ng negosyo",
    "faq.tabCreators": "Para sa creators",

    // Manifesto
    "manifesto.eyebrow": "Manifesto",
    "manifesto.line1": "Hindi sila pumunta dito para maging designer.",
    "manifesto.line2": "Pumunta sila para panatilihing gumagana ang negosyo.",
    "manifesto.b1label": "Ang iginagalang namin",
    "manifesto.b1big": "Ang trabaho",
    "manifesto.b1sub":
        "Sari-sari store, salon, barangay clinic — ang mga tindahan kung saan may nagmamasa, gumugupit, o nag-aayos habang binabasa mo ito.",
    "manifesto.b2label": "Gaano kabilis",
    "manifesto.b2big": "48–72h",
    "manifesto.b2sub":
        "Mula sa araw na pumasok ang creator sa tindahan mo hanggang sa araw na live na ang page mo. Patuloy kang nagtatrabaho sa buong proseso.",
    "manifesto.b3label": "Ano ang kailangan sa'yo",
    "manifesto.b3big": "Isang litrato",
    "manifesto.b3sub":
        "Ilang sagot. Isang guided na review. Iyon lang ang hinihingi — ginawa namin ang iba base sa trabaho.",

    // App download (creator app)
    "app.eyebrow": "Ang creator app",
    "app.titleA": "Dalhin ang Tendso",
    "app.titleB": "kasama mo.",
    "app.lede":
        "Ang app na ginagamit ng aming creators sa field — mag-certified, kunin ang mga negosyo, at subaybayan ang kita mo, mula mismo sa phone mo.",
    "app.downloadOn": "I-download sa",
    "app.getOn": "Kunin sa",
    "app.scan": "I-scan para i-install sa Android",
    "app.status": "Available na sa iOS at Android",

    // Creator earnings teaser
    "earn.eyebrow": "Para sa creators",
    "earn.titleA": "Kumita habang dinadala sila",
    "earn.titleB": "online.",
    "earn.lede": "Malinaw na numero, mula mismo sa presyo namin — walang projection, walang maliit na letra.",
    "earn.f1label": "ng bawat benta",
    "earn.f1sub": "{a} iyon sa isang {b} na site — ang kalahati mo sa bawat website na maibenta mo.",
    "earn.f2label": "kada referral",
    "earn.f2sub": "Kapag nakapag-una nang bayad na site ang creator na na-invite mo.",
    "earn.f3label": "diretso sa wallet mo",
    "earn.f3sub": "Bayad sa loob ng 48 oras mula nang aprubahan ng may-ari ang site nila.",
    "earn.cta": "Maging creator",

    // Final CTA
    "cta.eyebrow": "Ang bisyon",
    "cta.slogan1": "Dito Nagtatapos ang Pag-iisip.",
    "cta.slogan2": "Para hindi ang trabaho.",
    "cta.doorBiz": "Para sa may-ari ng negosyo",
    "cta.bizSub": "Isang page na nakabatay sa trabaho mo — may creator na bibisita, tuloy ka lang, mao-online ito.",
    "cta.doorCreator": "Para sa creators",
    "cta.creatorSub": "Tulungan ang mga may-ari na hindi makatigil sa trabaho. Totoong kita, totoong referral, bayad sa Wise.",
    "cta.go": "Pumasok",
    "cta.altBizLead": "May negosyo ka ba?",

    // Footer
    "footer.blurb":
        "Totoong website para sa lokal na negosyong Pilipino — ginawa ng sanay na creators na pupunta sa'yo, live sa loob ng ilang araw, at babayaran lang kapag live na.",
    "footer.company": "Pinapatakbo ng VONAS, OPC — rehistradong kompanya sa Pilipinas.",
    "footer.appCol": "Kunin ang app",
    "footer.comingSoon": "Malapit na",
    "footer.kb": "Knowledge base",
    "footer.help": "Tulong",
    "footer.legal": "Legal",
    "footer.privacy": "Privacy",
    "footer.terms": "Terms",
    "footer.contact": "Contact",
    "footer.language": "Wika",

    // For-business + For-creators pages
    "biz.back": "Balik sa home",
    "biz.seePrice": "Tingnan ang presyo",
    "creator.h1a": "Kumita sa paggawa ng website",
    "creator.h1em": "para sa mga tindahan malapit sa'yo.",
    "creator.lede":
        "Magdala ng phone at sundin ang checklist sa app. Bibisita ka sa lokal na tindahan, kukunan ng litrato ang trabaho, at isu-submit — kami na ang bahala sa build, sulat, at deploy. Panatilihin mo ang 50% ng bawat site, bayad sa Wise wallet mo.",
    "creator.ctaStart": "Simulan ang libreng certification",
    "creator.earn.f1sub": "Ang kalahati mo sa bawat website na maibenta mo.",
    "creator.earn.f2label": "presyo ng website",
    "creator.earn.f2sub": "Isang beses lang babayaran ng may-ari, at kapag live na ang site nila.",
    "creator.earn.f3label": "pinakamababang pwede mong ialok",
    "creator.earn.f3sub": "Pwede kang magbigay ng discount sa alok mo sa tindahan. Ikaw ang magpapasya kung magkano.",
    "creator.earn.note":
        "Mapupunta ang kalahati mo sa Wise wallet mo sa loob ng 48 oras mula nang aprubahan ng may-ari ang site nila. Walang projection, kita mo lang sa aktwal na naibenta mo.",
    "creator.apply.step4": "Sa'yo ang 50% ng bawat benta mo.",
    "creator.apply.eyebrow": "Paano magsimula",
    "creator.apply.title": "Mula sa page na ito",
    "creator.apply.titleEm": "hanggang sa unang bayad mo.",
    "creator.apply.lede":
        "Ang buong apply-at-certify na proseso ay nasa app. Ito ang hugis nito — libreng magsimula, walang kailangang karanasan.",
    "creator.apply.tag1": "Libreng mag-apply",
    "creator.apply.tag2": "Walang kailangang karanasan",
    "creator.apply.tag3": "Panatilihin ang trabaho mo",
    "creator.apply.cta": "Simulan ang libreng certification",
};

const DICTS: Record<Lang, Dict> = { en: EN, tl: TL };

interface LangCtx {
    lang: Lang;
    setLang: (l: Lang) => void;
    t: (key: string) => string;
}

const LanguageContext = createContext<LangCtx | null>(null);

const STORAGE_KEY = "tendso.lang";

export function LanguageProvider({ children }: { children: ReactNode }) {
    const [lang, setLangState] = useState<Lang>("en");

    // Read persisted choice on mount (client-only, avoids SSR mismatch).
    useEffect(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved === "en" || saved === "tl") setLangState(saved);
        } catch {
            /* localStorage unavailable — stay on default */
        }
    }, []);

    const setLang = (l: Lang) => {
        setLangState(l);
        try {
            localStorage.setItem(STORAGE_KEY, l);
        } catch {
            /* ignore */
        }
    };

    const t = (key: string): string => {
        return DICTS[lang][key] ?? EN[key] ?? key; // tl → en → raw key
    };

    return (
        <LanguageContext.Provider value={{ lang, setLang, t }}>
            {children}
        </LanguageContext.Provider>
    );
}

/** Access the active language + translator. Safe outside a provider (defaults to EN). */
export function useT(): LangCtx {
    const ctx = useContext(LanguageContext);
    if (!ctx) {
        // Fallback so a component used outside the provider never crashes.
        return { lang: "en", setLang: () => {}, t: (k) => EN[k] ?? k };
    }
    return ctx;
}
