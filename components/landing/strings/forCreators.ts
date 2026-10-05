import type { Strings } from "./types";

/**
 * Round 1 strings for /for-creators. English and Tagalog; the Tagalog needs a
 * native read.
 *
 * MONEY. /for-creators says three things about money and no more: the website
 * price ({c}), how low a creator may discount it ({b}), and their half. No peso
 * earnings are quoted, on purpose: what that half comes to depends on the price
 * they sell at, and a figure on a recruiting page reads as a promise of it. No
 * per-site amount, no referral bonus figure, no calculator. Both amounts are put
 * in from lib/pricing.ts by the component (PRICE_CEILING and BASE_PRICE), never
 * written here.
 *
 * {operator} is the registered company (lib/contact OPERATOR).
 */
export const strings: Strings = {
    en: {
        // "On this page"
        "r1.forCreators.jump.label": "On this page",
        "r1.forCreators.jump.earn": "What you earn",
        "r1.forCreators.jump.how": "How it works",
        "r1.forCreators.jump.need": "What you need",
        "r1.forCreators.jump.sites": "Real sites",
        "r1.forCreators.jump.app": "The app",
        "r1.forCreators.jump.faq": "Questions",

        // Hero
        "r1.forCreators.hero.title": "Get paid to put local shops online.",
        "r1.forCreators.hero.lede":
            "You visit a shop and interview the owner, we build the website, and you keep half of what the owner pays.",
        "r1.forCreators.start": "Start as a creator",
        "r1.forCreators.call": "Book a 10-minute call",
        "r1.forCreators.hero.factsLabel": "The basics",
        "r1.forCreators.hero.fact1": "Free to apply",
        "r1.forCreators.hero.fact2": "No experience needed",
        "r1.forCreators.hero.fact3": "No quota, keep your day job",
        "r1.forCreators.hero.earnLabel": "What you earn",
        "r1.forCreators.hero.earnBody": "of every sale you make. You keep half of what the owner pays.",
        "r1.forCreators.hero.earnNote":
            "A website is {c}. You can discount your offer to as low as {b}. Your share is paid to your Wise email once the owner pays for the live site.",

        // What you earn
        "r1.forCreators.earn.title": "What you earn",
        "r1.forCreators.earn.sub": "One price, your discount, your half. No salary, no projections.",
        "r1.forCreators.earn.shareTitle": "Your share of every sale",
        "r1.forCreators.earn.shareBody": "You keep half of what the owner pays, on every site you bring in.",
        "r1.forCreators.earn.priceTitle": "The website price",
        "r1.forCreators.earn.priceBody": "Paid once by the owner, only after their site is live.",
        "r1.forCreators.earn.discountTitle": "Your discount",
        "r1.forCreators.earn.discountBody": "You can put a discount on your offer to a shop. You decide how much.",
        "r1.forCreators.earn.asLowAs": "as low as",
        "r1.forCreators.earn.paidTitle": "When you get paid",
        "r1.forCreators.earn.paidBody":
            "You earn when an owner pays for a live site. Your half is added to your Wallet, and you withdraw it to your Wise email.",
        "r1.forCreators.earn.referral": "You can also refer other creators from Referrals in the app.",

        // How it works
        "r1.forCreators.how.title": "How it works",
        "r1.forCreators.how.sub": "Five steps. You do the visit; we do the build.",
        "r1.forCreators.how.s1.title": "Sign up",
        "r1.forCreators.how.s1.body": "Create a free account. Nothing to pay, now or later.",
        "r1.forCreators.how.s2.title": "Learn and pass the quiz",
        "r1.forCreators.how.s2.body": "5 short lessons, then 5 questions — get 4 right. We approve your account.",
        "r1.forCreators.how.s2.time": "About 20 minutes",
        "r1.forCreators.how.s3.title": "Find a shop",
        "r1.forCreators.how.s3.body":
            "A barber, carinderia, salon or print shop that is open but not online. The app lists leads near you.",
        "r1.forCreators.how.s4.title": "Interview and take photos",
        "r1.forCreators.how.s4.body":
            "Record the owner while they work, photograph the shop, submit. We build the site in 48–72 hours.",
        "r1.forCreators.how.s4.time": "About 30 minutes on site",
        "r1.forCreators.how.s5.title": "Get paid when the owner pays",
        "r1.forCreators.how.s5.body":
            "The owner pays once, only after the site is live. Your half goes to your Wallet; withdraw to Wise.",

        // What you need
        "r1.forCreators.need.title": "What you need",
        "r1.forCreators.need.sub": "No laptop, no camera, no design skills.",
        "r1.forCreators.need.phone.title": "A phone",
        "r1.forCreators.need.phone.body":
            "iPhone or Android with the Tendso app. The interview questions are in the app, so your phone is the only camera you need.",
        "r1.forCreators.need.time.title": "A few hours",
        "r1.forCreators.need.time.body":
            "About 20 minutes to get certified, then about 30 minutes per shop visit. No quota and no minimum — you pick the pace.",
        "r1.forCreators.need.wise.title": "An email for Wise",
        "r1.forCreators.need.wise.body":
            "We pay through Wise to your email. You don't need a Wise account first — Wise emails you a link to claim it.",

        // Real sites
        "r1.forCreators.sites.title": "Real shops, live now",
        "r1.forCreators.sites.sub": "This is what the owner gets from your visit.",
        "r1.forCreators.sites.more": "See more sites",

        // The app and the Discord
        "r1.forCreators.app.title": "Get the Tendso app",
        "r1.forCreators.app.body":
            "Lessons, leads, submissions and your wallet, all on your phone. Free on both stores, or use it in your browser at {login}.",
        "r1.forCreators.app.scan": "Scan to install on Android",
        "r1.forCreators.discord.title": "Join the creator Discord",
        "r1.forCreators.discord.body":
            "Ask other creators and the team. Type /ask and Tendso AI answers from the field-agent wiki.",
        "r1.forCreators.discord.open": "Open Discord",

        // Questions
        "r1.forCreators.faq.title": "Questions creators ask",
        "r1.forCreators.faq.sub": "Straight answers, from the same answers our help AI gives.",
        "r1.forCreators.faq.more": "Something else? Search the {help} or {call}.",
        "r1.forCreators.faq.helpLink": "Help Center",
        "r1.forCreators.faq.callLink": "book a 10-minute call",
        "r1.forCreators.faq.q1": "Is this a scam?",
        "r1.forCreators.faq.a1":
            "No. Tendso is legit: real businesses pay for real websites, and you earn a real, Wise-paid commission for bringing them in. Tendso is run by {operator}, a registered Philippine company, and never asks you for money — not to sign up, not to submit, not on Discord.",
        "r1.forCreators.faq.q2": "Do I collect the money from the owner?",
        "r1.forCreators.faq.a2":
            "No. The owner pays Tendso directly, once, after their site is live — through a Wise payment link we email them. You never handle the money. Your 50% is added to your Wallet when their payment is confirmed.",
        "r1.forCreators.faq.q3": "Do I need a Wise account?",
        "r1.forCreators.faq.a3":
            "No. We pay through Wise's send-to-email: you request a payout from your Wallet with your email address, and Wise emails you a claim link. Use it within 7 days to receive the money.",
        "r1.forCreators.faq.q4": "Can I do it online instead of visiting the shop?",
        "r1.forCreators.faq.a4":
            "You can message a shop online to set up a visit, but the submission itself is done on site: the photos and the owner interview are taken in person.",
        "r1.forCreators.faq.q5": "The shop already has a Facebook page. Does it still count?",
        "r1.forCreators.faq.a5": "Yes. A business with a Facebook page or Instagram account still qualifies for a submission.",

        // Closing
        "r1.forCreators.end.title": "Start with one shop near you.",
        "r1.forCreators.end.sub": "Sign up and take the lessons today, or talk to us first.",

        // Footer
        "r1.forCreators.foot.owners": "For business owners",
        "r1.forCreators.foot.otr": "OTR",
        "r1.forCreators.foot.legal": "Privacy and terms",

        // The chat's starter questions on this page
        "r1.forCreators.chat.q1": "Do I need experience?",
        "r1.forCreators.chat.q2": "Where do payouts go?",
        "r1.forCreators.chat.q3": "Do I need a Wise account?",
    },
    tl: {
        // "On this page"
        "r1.forCreators.jump.label": "Sa page na ito",
        "r1.forCreators.jump.earn": "Ang kikitain mo",
        "r1.forCreators.jump.how": "Paano gumagana",
        "r1.forCreators.jump.need": "Ang kailangan mo",
        "r1.forCreators.jump.sites": "Totoong sites",
        "r1.forCreators.jump.app": "Ang app",
        "r1.forCreators.jump.faq": "Mga tanong",

        // Hero
        "r1.forCreators.hero.title": "Kumita sa pagdadala ng mga lokal na tindahan online.",
        "r1.forCreators.hero.lede":
            "Bibisita ka sa tindahan at iinterbyuhin ang may-ari, kami ang gagawa ng website, at sa'yo ang kalahati ng ibabayad ng may-ari.",
        "r1.forCreators.start": "Magsimula bilang creator",
        "r1.forCreators.call": "Mag-book ng 10-minutong tawag",
        "r1.forCreators.hero.factsLabel": "Ang mga basic",
        "r1.forCreators.hero.fact1": "Libreng mag-apply",
        "r1.forCreators.hero.fact2": "Walang kailangang karanasan",
        "r1.forCreators.hero.fact3": "Walang quota, tuloy ang day job mo",
        "r1.forCreators.hero.earnLabel": "Ang kikitain mo",
        "r1.forCreators.hero.earnBody": "ng bawat benta mo. Sa'yo ang kalahati ng ibabayad ng may-ari.",
        "r1.forCreators.hero.earnNote":
            "{c} ang isang website. Pwede mong i-discount ang alok mo hanggang {b}. Ipapadala ang share mo sa Wise email mo kapag nabayaran na ng may-ari ang live na site.",

        // What you earn
        "r1.forCreators.earn.title": "Ang kikitain mo",
        "r1.forCreators.earn.sub": "Isang presyo, ang discount mo, ang kalahati mo. Walang sweldo, walang projection.",
        "r1.forCreators.earn.shareTitle": "Ang share mo sa bawat benta",
        "r1.forCreators.earn.shareBody": "Sa'yo ang kalahati ng ibabayad ng may-ari, sa bawat site na madala mo.",
        "r1.forCreators.earn.priceTitle": "Ang presyo ng website",
        "r1.forCreators.earn.priceBody": "Isang beses lang babayaran ng may-ari, at kapag live na ang site nila.",
        "r1.forCreators.earn.discountTitle": "Ang discount mo",
        "r1.forCreators.earn.discountBody":
            "Pwede kang magbigay ng discount sa alok mo sa tindahan. Ikaw ang magpapasya kung magkano.",
        "r1.forCreators.earn.asLowAs": "hanggang",
        "r1.forCreators.earn.paidTitle": "Kailan ka babayaran",
        "r1.forCreators.earn.paidBody":
            "Kumikita ka kapag nagbayad ang may-ari para sa live na site. Idadagdag ang kalahati mo sa Wallet mo, at ito-withdraw mo sa Wise email mo.",
        "r1.forCreators.earn.referral": "Pwede ka ring mag-refer ng ibang creator mula sa Referrals sa app.",

        // How it works
        "r1.forCreators.how.title": "Paano gumagana",
        "r1.forCreators.how.sub": "Limang hakbang. Ikaw ang bibisita; kami ang gagawa.",
        "r1.forCreators.how.s1.title": "Mag-sign up",
        "r1.forCreators.how.s1.body": "Gumawa ng libreng account. Walang babayaran, ngayon o mamaya.",
        "r1.forCreators.how.s2.title": "Mag-aral at ipasa ang quiz",
        "r1.forCreators.how.s2.body": "5 maikling lesson, tapos 5 tanong — kailangan ng 4 na tama. Kami ang mag-a-approve ng account mo.",
        "r1.forCreators.how.s2.time": "Mga 20 minuto",
        "r1.forCreators.how.s3.title": "Maghanap ng tindahan",
        "r1.forCreators.how.s3.body":
            "Barbero, carinderia, salon o print shop na bukas pero wala pang online. May listahan ng mga lead malapit sa'yo sa app.",
        "r1.forCreators.how.s4.title": "Mag-interview at kumuha ng litrato",
        "r1.forCreators.how.s4.body":
            "I-record ang may-ari habang nagtatrabaho, kunan ng litrato ang tindahan, at i-submit. Gagawin namin ang site sa loob ng 48–72 oras.",
        "r1.forCreators.how.s4.time": "Mga 30 minuto sa lugar",
        "r1.forCreators.how.s5.title": "Bayad ka kapag nagbayad ang may-ari",
        "r1.forCreators.how.s5.body":
            "Isang beses magbabayad ang may-ari, kapag live na ang site. Mapupunta ang kalahati mo sa Wallet mo; i-withdraw sa Wise.",

        // What you need
        "r1.forCreators.need.title": "Ang kailangan mo",
        "r1.forCreators.need.sub": "Walang laptop, walang camera, walang design skills.",
        "r1.forCreators.need.phone.title": "Isang phone",
        "r1.forCreators.need.phone.body":
            "iPhone o Android na may Tendso app. Nasa app ang mga tanong sa interview, kaya phone mo lang ang camera na kailangan mo.",
        "r1.forCreators.need.time.title": "Ilang oras",
        "r1.forCreators.need.time.body":
            "Mga 20 minuto para ma-certify, tapos mga 30 minuto kada bisita sa tindahan. Walang quota at walang minimum — ikaw ang bahala sa bilis.",
        "r1.forCreators.need.wise.title": "Isang email para sa Wise",
        "r1.forCreators.need.wise.body":
            "Nagbabayad kami sa Wise papunta sa email mo. Hindi mo kailangan ng Wise account muna — magpapadala ang Wise ng link sa email mo para ma-claim ito.",

        // Real sites
        "r1.forCreators.sites.title": "Totoong tindahan, live na ngayon",
        "r1.forCreators.sites.sub": "Ito ang makukuha ng may-ari mula sa bisita mo.",
        "r1.forCreators.sites.more": "Tingnan ang iba pang site",

        // The app and the Discord
        "r1.forCreators.app.title": "Kunin ang Tendso app",
        "r1.forCreators.app.body":
            "Lessons, leads, submissions at ang wallet mo, lahat nasa phone mo. Libre sa parehong store, o gamitin sa browser sa {login}.",
        "r1.forCreators.app.scan": "I-scan para i-install sa Android",
        "r1.forCreators.discord.title": "Sumali sa creator Discord",
        "r1.forCreators.discord.body":
            "Magtanong sa ibang creator at sa team. I-type ang /ask at sasagot ang Tendso AI mula sa field-agent wiki.",
        "r1.forCreators.discord.open": "Buksan ang Discord",

        // Questions
        "r1.forCreators.faq.title": "Mga tanong ng creators",
        "r1.forCreators.faq.sub": "Diretsong sagot, pareho sa mga sagot ng help AI namin.",
        "r1.forCreators.faq.more": "May iba pa? Hanapin sa {help} o {call}.",
        "r1.forCreators.faq.helpLink": "Help Center",
        "r1.forCreators.faq.callLink": "mag-book ng 10-minutong tawag",
        "r1.forCreators.faq.q1": "Scam ba ito?",
        "r1.forCreators.faq.a1":
            "Hindi. Legit ang Tendso: totoong negosyo ang nagbabayad para sa totoong website, at kumikita ka ng totoong commission, bayad sa Wise, sa pagdadala sa kanila. Pinapatakbo ang Tendso ng {operator}, isang rehistradong kompanya sa Pilipinas, at hindi ka kailanman hihingan ng pera — hindi sa pag-sign up, hindi sa pag-submit, hindi sa Discord.",
        "r1.forCreators.faq.q2": "Ako ba ang maniningil sa may-ari?",
        "r1.forCreators.faq.a2":
            "Hindi. Direkta sa Tendso magbabayad ang may-ari, isang beses, kapag live na ang site nila — sa Wise payment link na ini-email namin sa kanila. Hindi mo hahawakan ang pera. Idadagdag ang 50% mo sa Wallet mo kapag na-confirm na ang bayad nila.",
        "r1.forCreators.faq.q3": "Kailangan ko ba ng Wise account?",
        "r1.forCreators.faq.a3":
            "Hindi. Nagbabayad kami gamit ang send-to-email ng Wise: magre-request ka ng payout mula sa Wallet mo gamit ang email address mo, at magpapadala ang Wise ng claim link sa email mo. Gamitin ito sa loob ng 7 araw para matanggap ang pera.",
        "r1.forCreators.faq.q4": "Pwede ko bang gawin online imbes na bumisita sa tindahan?",
        "r1.forCreators.faq.a4":
            "Pwede kang mag-message sa tindahan online para mag-set ng bisita, pero sa mismong lugar ginagawa ang submission: personal na kinukuha ang mga litrato at ang interview sa may-ari.",
        "r1.forCreators.faq.q5": "May Facebook page na ang tindahan. Pasok pa rin ba?",
        "r1.forCreators.faq.a5": "Oo. Pasok pa rin sa submission ang negosyong may Facebook page o Instagram account.",

        // Closing
        "r1.forCreators.end.title": "Magsimula sa isang tindahan malapit sa'yo.",
        "r1.forCreators.end.sub": "Mag-sign up at simulan ang lessons ngayon, o kausapin muna kami.",

        // Footer
        "r1.forCreators.foot.owners": "Para sa may-ari ng negosyo",
        "r1.forCreators.foot.otr": "OTR",
        "r1.forCreators.foot.legal": "Privacy at terms",

        // The chat's starter questions on this page
        "r1.forCreators.chat.q1": "Kailangan ba ng karanasan?",
        "r1.forCreators.chat.q2": "Saan napupunta ang bayad?",
        "r1.forCreators.chat.q3": "Kailangan ko ba ng Wise account?",
    },
};
