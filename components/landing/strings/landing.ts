import type { Strings } from "./types";

/**
 * Round 1 strings for the landing page (/), and for the floating chat, which
 * the landing and /for-creators both carry. English and Tagalog; the Tagalog
 * needs a native read.
 *
 * Money is never a literal here: the price card puts the figure in from
 * lib/pricing.ts (see BusinessPricingSection), so changing the price there is
 * all it takes.
 */
export const strings: Strings = {
    en: {
        // Hero
        "r1.landing.hero.title1": "Tendso builds your website.",
        "r1.landing.hero.title2": "Pay only when it's live.",
        "r1.landing.hero.lede":
            "A trained Tendso creator visits your shop, asks a few questions, and photographs your work. We turn it into a real, coded website — live in 48–72 hours. You pay once, only after it's up and you're happy.",
        "r1.landing.cta": "Get a website",
        "r1.landing.hero.seeSites": "See real sites",
        "r1.landing.hero.proofLabel": "What you can count on",
        "r1.landing.hero.proof1": "Pay only when it's live",
        "r1.landing.hero.proof2": "Live in 48–72 hours",
        "r1.landing.hero.proof3": "A real coded site — no template",
        "r1.landing.hero.caption": "A real site we built — {name}, {city}",
        "r1.landing.earnLead": "Want to earn instead?",
        "r1.landing.earnLink": "Become a Tendso creator",

        // Real sites
        "r1.landing.sites.title": "Real businesses. Real live sites.",
        "r1.landing.sites.sub":
            "Every site below was built for a real Filipino business by a Tendso creator. These are not mockups.",
        "r1.landing.sites.newTab": "opens the live site in a new tab",

        // How it works
        "r1.landing.how.title": "You keep working. We build the page.",
        "r1.landing.how.sub": "About half an hour of your time, all together. Live in 48–72 hours from start to finish.",
        "r1.landing.how.step": "Step {n}",
        "r1.landing.how.s1.meta": "No prep",
        "r1.landing.how.s1.title": "A creator visits your shop",
        "r1.landing.how.s1.body": "Someone from Tendso comes to you. You don't need to prepare anything or tidy up.",
        "r1.landing.how.s2.meta": "About 30 min",
        "r1.landing.how.s2.title": "A short interview and photos",
        "r1.landing.how.s2.body":
            "Simple questions while you keep working — the things you'd tell a customer who walked in. They photograph your work, your place and you.",
        "r1.landing.how.s3.meta": "48–72 hours",
        "r1.landing.how.s3.title": "We build your website",
        "r1.landing.how.s3.body":
            "Your photos and answers become your own coded website. You don't design anything or pick from a list of layouts.",
        "r1.landing.how.s4.meta": "One look",
        "r1.landing.how.s4.title": "You review it, then pay",
        "r1.landing.how.s4.body":
            "We show it to you first. Change something, or leave it as it is. It goes live, and only then do you pay.",

        // Price
        "r1.landing.price.title": "One price. Paid once, when it's live.",
        "r1.landing.price.sub":
            "One-time payment. No monthly fees. No contracts. You only pay once your website is live and you've approved it.",
        "r1.landing.price.included": "What's included",
        "r1.landing.price.inc1": "A real coded website — not a fill-in template",
        "r1.landing.price.inc2": "Your own live web address",
        "r1.landing.price.inc3": "Built from your photos and your words",
        "r1.landing.price.inc4": "Mobile-first — customers find you on their phones",
        "r1.landing.price.inc5": "Hosted with SSL, kept online",
        "r1.landing.price.inc6": "Free edits for the first year — ask us, we make the change",
        "r1.landing.price.footnote": "No card on file. No fine print. No charges later.",
        "r1.landing.price.tier": "Standard website",
        "r1.landing.price.once": "One-time · pay only when it's live",
        "r1.landing.price.domainAddon":
            "Optional add-on: prefer your own custom .com? We can register and set one up when your site goes live — just ask.",
        "r1.landing.price.domain":
            "Optional add-on: prefer your own custom .com? We can register and set one up when your site goes live — just ask.",

        // FAQ
        "r1.landing.faq.title": "Questions, answered.",
        "r1.landing.faq.sub": "Still unsure? Ask in the chat, or call us on {phone}.",
        "r1.landing.faq.helpCenter": "Help Center",
        "r1.landing.faq.q1": "Will I need to learn design?",
        "r1.landing.faq.a1":
            "No. You won't choose a template, pick a font, or stare at a blank page. A creator visits, asks a few questions, takes photos, and your site forms from that.",
        "r1.landing.faq.q2": "How long does it take?",
        "r1.landing.faq.a2":
            "Live in 48–72 hours from the interview. The interview itself is around 30 minutes — at your shop, while you keep working.",
        "r1.landing.faq.q3": "What if I don't like it?",
        "r1.landing.faq.a3":
            "You don't pay until the site is live and you've approved it. If you reject the draft, we revise it once for free.",
        "r1.landing.faq.q4": "Can I update it later?",
        "r1.landing.faq.a4":
            "Yes — you tell us what to change and we make the edit for you. Edits are free for the first year. Message us through the {help}.",
        "r1.landing.faq.q5": "Who owns the website?",
        "r1.landing.faq.a5":
            "You do. The domain, the photos, the copy — all yours. You can take it elsewhere any time, no penalty.",

        // Closing
        "r1.landing.close.title": "Your work deserves a page.",
        "r1.landing.close.sub": "Most sites live within 48–72 hours. Pay only when you're happy with it.",

        // The floating chat (components/landing/ChatBot.tsx)
        "r1.chat.open": "Ask a question",
        "r1.chat.close": "Close",
        "r1.chat.closeLabel": "Close chat",
        "r1.chat.title": "Ask Tendso",
        "r1.chat.sub": "Answers come from our Help Center",
        "r1.chat.hello": "Hi — I'm trained on the Tendso knowledge base. Ask me anything.",
        "r1.chat.try": "Try one of these",
        "r1.chat.q1": "How much does a site cost?",
        "r1.chat.q2": "How fast can I get one?",
        "r1.chat.q3": "What if I don't like it?",
        "r1.chat.pending": "Looking in the Help Center",
        "r1.chat.label": "Your question",
        "r1.chat.placeholder": "Type your question",
        "r1.chat.send": "Send",
        "r1.chat.source": "Source",
        "r1.chat.sources": "Sources",
        "r1.chat.error":
            "I couldn't reach the knowledge base just now — try again in a moment, or grab the app to ask in-app.",
    },
    tl: {
        // Hero
        "r1.landing.hero.title1": "Ginagawa ng Tendso ang website mo.",
        "r1.landing.hero.title2": "Bayad lang kapag live na.",
        "r1.landing.hero.lede":
            "May sanay na Tendso creator na bibisita sa tindahan mo, magtatanong ng ilang bagay, at kukunan ng litrato ang trabaho mo. Gagawin naming totoong website — live sa loob ng 48–72 oras. Magbabayad ka nang isang beses, kapag nakalive na at kuntento ka na.",
        "r1.landing.cta": "Kumuha ng website",
        "r1.landing.hero.seeSites": "Tingnan ang totoong mga site",
        "r1.landing.hero.proofLabel": "Ang maaasahan mo",
        "r1.landing.hero.proof1": "Bayad lang kapag live na",
        "r1.landing.hero.proof2": "Live sa 48–72 oras",
        "r1.landing.hero.proof3": "Totoong coded na site — walang template",
        "r1.landing.hero.caption": "Totoong site na ginawa namin — {name}, {city}",
        "r1.landing.earnLead": "Gusto mo bang kumita?",
        "r1.landing.earnLink": "Maging Tendso creator",

        // Real sites
        "r1.landing.sites.title": "Totoong negosyo. Totoong live na site.",
        "r1.landing.sites.sub":
            "Bawat site sa ibaba ay ginawa para sa totoong negosyong Pilipino ng isang Tendso creator. Hindi ito mockup.",
        "r1.landing.sites.newTab": "bubuksan ang live na site sa bagong tab",

        // How it works
        "r1.landing.how.title": "Ituloy mo lang ang trabaho. Kami ang gagawa ng page.",
        "r1.landing.how.sub": "Mga kalahating oras lang ng oras mo, lahat-lahat. Live sa loob ng 48–72 oras mula simula hanggang tapos.",
        "r1.landing.how.step": "Hakbang {n}",
        "r1.landing.how.s1.meta": "Walang paghahanda",
        "r1.landing.how.s1.title": "Bibisita ang creator sa tindahan mo",
        "r1.landing.how.s1.body": "May pupunta mula sa Tendso sa'yo. Hindi mo kailangang maghanda o maglinis.",
        "r1.landing.how.s2.meta": "Mga 30 min",
        "r1.landing.how.s2.title": "Maikling interview at mga litrato",
        "r1.landing.how.s2.body":
            "Simpleng tanong habang nagtatrabaho ka — ang mga sasabihin mo rin sa customer na pumasok. Kukunan nila ng litrato ang trabaho mo, ang lugar mo, at ikaw.",
        "r1.landing.how.s3.meta": "48–72 oras",
        "r1.landing.how.s3.title": "Kami ang gagawa ng website mo",
        "r1.landing.how.s3.body":
            "Magiging sarili mong coded na website ang mga litrato at sagot mo. Wala kang idi-disenyo at hindi ka pipili mula sa listahan ng layout.",
        "r1.landing.how.s4.meta": "Isang tingin",
        "r1.landing.how.s4.title": "I-review mo, tapos saka magbayad",
        "r1.landing.how.s4.body":
            "Ipapakita muna namin sa'yo. Magpalit ng kahit ano, o hayaan lang kung ano. Mao-online ito, at saka ka lang magbabayad.",

        // Price
        "r1.landing.price.title": "Isang presyo. Isang bayad, kapag live na.",
        "r1.landing.price.sub":
            "Isang bayad lang. Walang buwanang bayad. Walang kontrata. Magbabayad ka lang kapag live na ang website mo at na-approve mo na.",
        "r1.landing.price.included": "Kasama rito",
        "r1.landing.price.inc1": "Totoong coded na website — hindi fill-in na template",
        "r1.landing.price.inc2": "Sarili mong live na web address",
        "r1.landing.price.inc3": "Ginawa mula sa litrato at salita mo",
        "r1.landing.price.inc4": "Mobile-first — mahahanap ka ng customer sa phone nila",
        "r1.landing.price.inc5": "Naka-host na may SSL, pinapanatiling online",
        "r1.landing.price.inc6": "Libreng edits sa loob ng unang taon — sabihin mo lang, kami na ang magpapalit",
        "r1.landing.price.footnote": "Walang card na nakatago. Walang maliit na letra. Walang sorpresang singil.",
        "r1.landing.price.tier": "Standard na website",
        "r1.landing.price.once": "Isang beses · bayad lang kapag live na",
        "r1.landing.price.domainAddon":
            "Optional add-on: gusto ng sariling custom na .com? Pwede naming i-register at i-set up kapag live na ang site — sabihin mo lang.",
        "r1.landing.price.domain":
            "Optional add-on: gusto ng sariling custom na .com? Pwede naming i-register at i-set up kapag live na ang site — sabihin mo lang.",

        // FAQ
        "r1.landing.faq.title": "Mga tanong, nasagot na.",
        "r1.landing.faq.sub": "Hindi pa rin sigurado? Magtanong sa chat, o tawagan kami sa {phone}.",
        "r1.landing.faq.helpCenter": "Help Center",
        "r1.landing.faq.q1": "Kailangan ko bang matuto ng design?",
        "r1.landing.faq.a1":
            "Hindi. Wala kang pipiliing template, font, o titigan na blankong page. May creator na bibisita, magtatanong, kukuha ng litrato, at doon mabubuo ang site mo.",
        "r1.landing.faq.q2": "Gaano katagal?",
        "r1.landing.faq.a2":
            "Live sa loob ng 48–72 oras mula sa interview. Ang interview mismo ay mga 30 minuto — sa tindahan mo, habang nagtatrabaho ka.",
        "r1.landing.faq.q3": "Paano kung hindi ko gusto?",
        "r1.landing.faq.a3":
            "Hindi ka magbabayad hangga't hindi live at na-approve mo ang site. Kung tatanggihan mo ang draft, ire-revise namin ito nang isang beses, libre.",
        "r1.landing.faq.q4": "Pwede ko bang i-update mamaya?",
        "r1.landing.faq.a4":
            "Oo — sabihin mo lang kung ano ang papalitan, kami na ang magpapalit para sa'yo. Libreng edits sa loob ng unang taon. Mag-message sa amin sa {help}.",
        "r1.landing.faq.q5": "Sino ang may-ari ng website?",
        "r1.landing.faq.a5":
            "Ikaw. Ang domain, ang litrato, ang mga salita — sa'yo lahat. Pwede mong dalhin kahit saan anumang oras, walang penalty.",

        // Closing
        "r1.landing.close.title": "Deserve ng trabaho mo ang sariling page.",
        "r1.landing.close.sub": "Karamihan ay live sa loob ng 48–72 oras. Magbayad lang kapag masaya ka na dito.",

        // The floating chat
        "r1.chat.open": "Magtanong",
        "r1.chat.close": "Isara",
        "r1.chat.closeLabel": "Isara ang chat",
        "r1.chat.title": "Magtanong sa Tendso",
        "r1.chat.sub": "Galing sa Help Center namin ang mga sagot",
        "r1.chat.hello": "Hi — trained ako sa Tendso knowledge base. Itanong mo kahit ano.",
        "r1.chat.try": "Subukan ang isa sa mga ito",
        "r1.chat.q1": "Magkano ang isang site?",
        "r1.chat.q2": "Gaano kabilis ako magkakaroon?",
        "r1.chat.q3": "Paano kung hindi ko gusto?",
        "r1.chat.pending": "Hinahanap sa Help Center",
        "r1.chat.label": "Ang tanong mo",
        "r1.chat.placeholder": "I-type ang tanong mo",
        "r1.chat.send": "Ipadala",
        "r1.chat.source": "Source",
        "r1.chat.sources": "Mga source",
        "r1.chat.error":
            "Hindi ko maabot ang knowledge base ngayon — subukan ulit mamaya, o i-download ang app para magtanong doon.",
    },
};
