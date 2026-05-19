// data.jsx — fake corpus for the landing page mock.
// Coordinates are real lat/lng so the map looks real.

const CREATORS = [
  { id: "c-mark",     name: "Mark",     city: "Cebu City",    lat: 10.3157, lng: 123.8854, sites: 12, langs: ["EN","TL","CEB"], hue: 35,  response: "Replies in 2h",     samples: ["Sari-sari Marivic","Barangay Tindahan","Café Maya"] },
  { id: "c-janelle",  name: "Janelle",  city: "Cebu City",    lat: 10.3270, lng: 123.9015, sites: 12, langs: ["EN","TL","CEB"], hue: 18,  response: "Replies in 1h",     samples: ["Janet's Salon","La Cocina Cebu","Bukid Coffee"] },
  { id: "c-pao",      name: "Paolo",    city: "Quezon City",  lat: 14.6760, lng: 121.0437, sites: 9,  langs: ["EN","TL"],       hue: 50,  response: "Replies in 4h",     samples: ["Tatay's Lechon","K-9 Grooming","Pao Optical"] },
  { id: "c-aira",     name: "Aira",     city: "Makati",       lat: 14.5547, lng: 121.0244, sites: 18, langs: ["EN","TL"],       hue: 5,   response: "Replies in 30m",    samples: ["Manila Made","Studio Aira","Frame & Foil"] },
  { id: "c-rodel",    name: "Rodel",    city: "Davao City",   lat: 7.1907,  lng: 125.4553, sites: 7,  langs: ["EN","TL","CEB"], hue: 65,  response: "Replies in 3h",     samples: ["Davao Durian Co","R&K Auto","Bahay Bukid"] },
  { id: "c-leah",     name: "Leah",     city: "Iloilo City",  lat: 10.7202, lng: 122.5621, sites: 14, langs: ["EN","TL","HIL"], hue: 28,  response: "Replies in 1h",     samples: ["Tita Lou's Bakery","Iloilo Tours","La Paz Batchoy"] },
  { id: "c-ben",      name: "Ben",      city: "Bacolod",      lat: 10.6713, lng: 122.9511, sites: 6,  langs: ["EN","TL","HIL"], hue: 40,  response: "Replies in 5h",     samples: ["Sweet City","B&S Print","Negros Brew"] },
  { id: "c-mai",      name: "Mai",      city: "Cagayan de Oro",lat: 8.4542, lng: 124.6319, sites: 10, langs: ["EN","TL","CEB"], hue: 22,  response: "Replies in 2h",     samples: ["CDO Streetwear","Mai Florals","Bukidnon Coffee"] },
  { id: "c-jeff",     name: "Jeff",     city: "Pasig",        lat: 14.5764, lng: 121.0851, sites: 21, langs: ["EN","TL"],       hue: 12,  response: "Replies in 20m",    samples: ["Pasig Optical","M&M Lights","Studio Riverside"] },
  { id: "c-cha",      name: "Cha",      city: "Taguig",       lat: 14.5176, lng: 121.0509, sites: 8,  langs: ["EN","TL"],       hue: 55,  response: "Replies in 2h",     samples: ["BGC Florist","Cha Studio","Olive & Vine"] },
  { id: "c-tonio",    name: "Tonio",    city: "Baguio",       lat: 16.4023, lng: 120.5960, sites: 11, langs: ["EN","TL","ILO"], hue: 70,  response: "Replies in 1h",     samples: ["Baguio Brew","Cordillera Trails","Tonio Print"] },
  { id: "c-mira",     name: "Mira",     city: "Manila",       lat: 14.5995, lng: 120.9842, sites: 15, langs: ["EN","TL"],       hue: 8,   response: "Replies in 1h",     samples: ["Intramuros Tours","Mira Studio","Roxas Books"] },
  { id: "c-rafa",     name: "Rafa",     city: "Iligan",       lat: 8.2280,  lng: 124.2452, sites: 5,  langs: ["EN","TL","CEB"], hue: 48,  response: "Replies in 6h",     samples: ["Falls Café","Rafa Auto","Steel City Press"] },
  { id: "c-nica",     name: "Nica",     city: "Tagaytay",     lat: 14.1124, lng: 120.9627, sites: 13, langs: ["EN","TL"],       hue: 32,  response: "Replies in 90m",    samples: ["Ridge Roastery","Nica Florals","Tagaytay Coop"] },
  { id: "c-tim",      name: "Tim",      city: "Zamboanga",    lat: 6.9214,  lng: 122.0790, sites: 8,  langs: ["EN","TL"],       hue: 60,  response: "Replies in 4h",     samples: ["Curacha Co","Tim Optical","Pink Beach Tours"] },
  { id: "c-sol",      name: "Sol",      city: "Dumaguete",    lat: 9.3068,  lng: 123.3054, sites: 17, langs: ["EN","TL","CEB"], hue: 20,  response: "Replies in 45m",    samples: ["Dumaguete Dive","Sol Studio","Silliman Books"] },
];

const BUSINESSES = [
  { id: "b-marivic",  name: "Sari-sari Marivic",   category: "Retail",    city: "Cebu City",   creator: "c-mark",    lat: 10.3107, lng: 123.8924, builtOn: "2025-08-14", liveUrl: "#" },
  { id: "b-tatay",    name: "Tatay's Lechon",      category: "Food",      city: "Quezon City", creator: "c-pao",     lat: 14.6700, lng: 121.0380, builtOn: "2025-09-02", liveUrl: "#" },
  { id: "b-janets",   name: "Janet's Salon",       category: "Beauty",    city: "Cebu City",   creator: "c-janelle", lat: 10.3210, lng: 123.9100, builtOn: "2025-09-21", liveUrl: "#" },
  { id: "b-manila",   name: "Manila Made",         category: "Apparel",   city: "Makati",      creator: "c-aira",    lat: 14.5530, lng: 121.0280, builtOn: "2025-10-04", liveUrl: "#" },
  { id: "b-durian",   name: "Davao Durian Co.",    category: "Food",      city: "Davao City",  creator: "c-rodel",   lat: 7.1850,  lng: 125.4600, builtOn: "2025-10-12", liveUrl: "#" },
  { id: "b-tita",     name: "Tita Lou's Bakery",   category: "Food",      city: "Iloilo City", creator: "c-leah",    lat: 10.7180, lng: 122.5650, builtOn: "2025-11-01", liveUrl: "#" },
  { id: "b-brew",     name: "Negros Brew",         category: "Café",      city: "Bacolod",     creator: "c-ben",     lat: 10.6700, lng: 122.9560, builtOn: "2025-11-10", liveUrl: "#" },
  { id: "b-streetw",  name: "CDO Streetwear",      category: "Apparel",   city: "Cagayan de Oro", creator: "c-mai",  lat: 8.4500,  lng: 124.6360, builtOn: "2025-11-18", liveUrl: "#" },
  { id: "b-pasig",    name: "Pasig Optical",       category: "Health",    city: "Pasig",       creator: "c-jeff",    lat: 14.5710, lng: 121.0810, builtOn: "2025-11-22", liveUrl: "#" },
  { id: "b-bgc",      name: "BGC Florist",         category: "Retail",    city: "Taguig",      creator: "c-cha",     lat: 14.5180, lng: 121.0560, builtOn: "2025-12-01", liveUrl: "#" },
  { id: "b-baguio",   name: "Baguio Brew Roastery",category: "Café",      city: "Baguio",      creator: "c-tonio",   lat: 16.4080, lng: 120.5990, builtOn: "2026-01-04", liveUrl: "#" },
  { id: "b-intra",    name: "Intramuros Tours",    category: "Tourism",   city: "Manila",      creator: "c-mira",    lat: 14.5910, lng: 120.9755, builtOn: "2026-01-11", liveUrl: "#" },
  { id: "b-ridge",    name: "Ridge Roastery",      category: "Café",      city: "Tagaytay",    creator: "c-nica",    lat: 14.1100, lng: 120.9650, builtOn: "2026-02-02", liveUrl: "#" },
  { id: "b-dive",     name: "Dumaguete Dive Co.",  category: "Tourism",   city: "Dumaguete",   creator: "c-sol",     lat: 9.3110,  lng: 123.3120, builtOn: "2026-02-18", liveUrl: "#" },
  { id: "b-curacha",  name: "Curacha Co.",         category: "Food",      city: "Zamboanga",   creator: "c-tim",     lat: 6.9200,  lng: 122.0760, builtOn: "2026-03-04", liveUrl: "#" },
  { id: "b-bukid",    name: "Bukid Coffee",        category: "Café",      city: "Cebu City",   creator: "c-janelle", lat: 10.3300, lng: 123.8960, builtOn: "2026-03-12", liveUrl: "#" },
  { id: "b-bahay",    name: "Bahay Bukid Hostel",  category: "Tourism",   city: "Davao City",  creator: "c-rodel",   lat: 7.2000,  lng: 125.4480, builtOn: "2026-04-02", liveUrl: "#" },
  { id: "b-frame",    name: "Frame & Foil",        category: "Retail",    city: "Makati",      creator: "c-aira",    lat: 14.5580, lng: 121.0190, builtOn: "2026-04-15", liveUrl: "#" },
];

// Counter sets — keyed by 'scale' tweak
const COUNTERS = {
  early: {
    creators: 18, businesses: 47, cities: 6,  countries: 1,
    monthEarnings: null, // suppressed
  },
  growth: {
    creators: 1247, businesses: 3812, cities: 38, countries: 4,
    monthEarnings: 142000, // PHP this month
  },
};

// Testimonials
const TESTIMONIALS = [
  { name: "Janelle", city: "Cebu", claim: "12 sites in 6 weeks. I quit my call-center job in March.", initial: "J", hue: 18 },
  { name: "Mark",    city: "Cebu", claim: "My referral cut paid more than my first three sites combined.", initial: "M", hue: 35 },
  { name: "Aira",    city: "Makati", claim: "I work from cafés. The app tells me which shops need me next.", initial: "A", hue: 5 },
];

// FAQ
const FAQ_CREATOR = [
  { q: "How do I get paid?",            a: "Direct deposit to GCash, Maya, or any local bank. The app handles invoices, taxes, and receipts. You don't touch a spreadsheet." },
  { q: "When do I get paid?",           a: "Within 48 hours of the business owner approving their site. Faster on weekends — we don't sit on your money." },
  { q: "Do I need experience?",         a: "No. The guided capture inside the app walks you through every interview, every photo, every step. If you can use TikTok, you can use this." },
  { q: "What if my English isn't strong?", a: "The app speaks Tagalog, Cebuano, Hiligaynon, and Ilocano. Interview prompts come pre-translated. Your customers stay in their language." },
  { q: "Do I need a smartphone?",       a: "Yes — anything from the last four years works. iOS 15+ or Android 10+." },
  { q: "Can I work part-time?",         a: "Most creators start that way. You pick the jobs, you set the pace. There's no minimum." },
];

const FAQ_BUSINESS = [
  { q: "How long does it take?",        a: "Most sites are live within 72 hours of your interview. The interview itself is around 30 minutes — over coffee, at your shop." },
  { q: "Do I have to prepare anything?", a: "No. The creator brings everything. You just answer questions about your business while they photograph what matters." },
  { q: "What if I don't like it?",       a: "You don't pay until the site is live and you've approved it. If you reject the draft, the creator revises it once for free." },
  { q: "Can I update it later?",         a: "Yes — message your creator through the app. Small edits are included for the first year. After that, a flat fee per change." },
  { q: "Who owns the website?",          a: "You do. The domain, the photos, the copy — all yours. You can take it elsewhere any time, no penalty." },
  { q: "How much does it cost?",         a: "₱2,000 for the website, plus ₱150/month for hosting. International pricing varies — see the section above." },
];

// Categories for filter chips
const CATEGORIES = ["All", "Café", "Food", "Retail", "Beauty", "Apparel", "Health", "Tourism"];
const REGIONS    = [
  { id: "all",     label: "All Philippines", center: [12.5, 122.5], zoom: 6  },
  { id: "mm",      label: "Metro Manila",    center: [14.5995, 120.9842], zoom: 11 },
  { id: "cebu",    label: "Cebu",            center: [10.3157, 123.8854], zoom: 11 },
  { id: "davao",   label: "Davao",           center: [7.1907, 125.4553],  zoom: 11 },
  { id: "iloilo",  label: "Iloilo",          center: [10.7202, 122.5621], zoom: 11 },
  { id: "bacolod", label: "Bacolod",         center: [10.6713, 122.9511], zoom: 11 },
  { id: "baguio",  label: "Baguio",          center: [16.4023, 120.5960], zoom: 11 },
  { id: "cdo",     label: "Cagayan de Oro",  center: [8.4542, 124.6319],  zoom: 11 },
  { id: "zambo",   label: "Zamboanga",       center: [6.9214, 122.0790],  zoom: 11 },
  { id: "duma",    label: "Dumaguete",       center: [9.3068, 123.3054],  zoom: 11 },
  { id: "tacloban",label: "Tacloban",        center: [11.2421, 125.0048], zoom: 11 },
  { id: "laoag",   label: "Laoag",           center: [18.1979, 120.5937], zoom: 11 },
  { id: "surigao", label: "Surigao",         center: [9.7841, 125.4920],  zoom: 11 },
  { id: "general", label: "General Santos",  center: [6.1164, 125.1716],  zoom: 11 },
];

// Localized strings — EN + TL
const STRINGS = {
  en: {
    hero_pre: "Negosyo Digital",
    hero_main: ["No business", "left ", "offline", "."],
    hero_main_em: "Real shops. Real websites. Real fast.",
    hero_lede: "A trained creator visits your shop, shoots world-class photos, writes your story, and ships a fully functional website — hosting, domain, copy, everything — before the weekend. You don’t touch a keyboard once.",
    door_business: "I own a business",
    door_business_sub: "Find a creator near me",
    door_creator: "I want to earn",
    door_creator_sub: "Become a certified creator",
    counter_creators: "creators",
    counter_businesses: "live sites",
    counter_cities: "cities",
    counter_countries: "countries",
    map_title: "On the ground, right now.",
    map_sub: "Every pin is a real person or a real business with a real website. Pan, zoom, tap. The directory below is the same data — list view for anyone who'd rather read.",
    hire_cta: "Get the app to hire",
    visit_site: "Visit live site",
    get_app: "Get the app",
  },
  tl: {
    hero_pre: "Negosyo Digital",
    hero_main: ["Walang negosyo", "na ", "offline", "."],
    hero_main_em: "Tunay na tindahan. Tunay na website. Tunay na bilis.",
    hero_lede: "Pupuntahan ka ng creator, kukuha ng world-class na litrato, isusulat ang istorya mo, at ilalabas ang kumpletong website mo — hosting, domain, copy, lahat — bago mag-Linggo. Hindi mo kailangan hipuin ang keyboard.",
    door_business: "May-ari ako ng negosyo",
    door_business_sub: "Hanap ng creator sa malapit",
    door_creator: "Gusto kong kumita",
    door_creator_sub: "Maging certified creator",
    counter_creators: "creator",
    counter_businesses: "live na site",
    counter_cities: "lungsod",
    counter_countries: "bansa",
    map_title: "Sa lupa, ngayon mismo.",
    map_sub: "Bawat pin ay tunay na tao o tunay na negosyo. Pan, zoom, tap. Ang direktoryo sa baba ay parehong datos.",
    hire_cta: "I-download para mag-hire",
    visit_site: "Bisitahin ang site",
    get_app: "Kunin ang app",
  }
};

// Pricing — single source of truth (referenced everywhere)
const PRICING = {
  PH: {
    currency: "₱",
    site_total: 1000,        // total business pays for a site
    creator_cut: 500,        // creator earns per delivered site
    referral_business: 500,  // creator earns per friend who lands their first business
    referral_creator: 250,   // creator earns per new creator's first delivered site
    hosting_monthly: 0,      // first year hosting included
  },
  // International — unconfirmed; show PH price + soft "coming soon"
  ID: { currency: "₱", site_total: 1000, creator_cut: 500, referral_business: 500, referral_creator: 250, hosting_monthly: 0, soon: true },
  MX: { currency: "₱", site_total: 1000, creator_cut: 500, referral_business: 500, referral_creator: 250, hosting_monthly: 0, soon: true },
  VN: { currency: "₱", site_total: 1000, creator_cut: 500, referral_business: 500, referral_creator: 250, hosting_monthly: 0, soon: true },
};

// Knowledge base seed (CMS-ready)
const KNOWLEDGE_BASE = [
  { id: "kb-1", category: "Getting started", title: "What happens in the 30-minute interview?",     read: "3 min", excerpt: "A creator visits your shop with a phone and a checklist. You answer questions about your story. They photograph what matters. That’s the whole thing." },
  { id: "kb-2", category: "For creators",    title: "Your first week as a certified creator",       read: "6 min", excerpt: "Day-by-day map of what to expect: certification, your first match, your first interview, your first payout." },
  { id: "kb-3", category: "Payouts",         title: "How GCash, Maya, and bank payouts work",       read: "4 min", excerpt: "Pick a payout rail in the app. Funds land within 48 hours of a site going live. No paperwork." },
  { id: "kb-4", category: "Photography",     title: "Shooting a small shop — the 12-shot list",      read: "5 min", excerpt: "Front, side, sign, hands at work, hero product, two close-ups, two wide, three portraits. The app prompts you, in order." },
  { id: "kb-5", category: "For businesses",  title: "What happens if you don’t like the result?",   read: "2 min", excerpt: "You don’t pay until you approve. If you reject the draft, the creator revises once — free. Then it’s yours or it’s nothing." },
  { id: "kb-6", category: "Referrals",       title: "How the ₱500 friend bonus actually works",      read: "3 min", excerpt: "Share your link. The friend signs up and lands their first business. You earn ₱500 the day that business’s site goes live." },
];

Object.assign(window, { CREATORS, BUSINESSES, COUNTERS, TESTIMONIALS, FAQ_CREATOR, FAQ_BUSINESS, CATEGORIES, REGIONS, STRINGS, PRICING, KNOWLEDGE_BASE });
