import type { V2Link } from "../links";

/** Nav for the pages in this stream. */
export const PA_NAV_LINKS: readonly V2Link[] = [
    { label: "How it works", href: "/v2/business#how" },
    { label: "For businesses", href: "/v2/business" },
    { label: "Examples", href: "/v2/examples" },
    { label: "For field agents", href: "/v2/field-agents" },
    { label: "About", href: "/v2/about" },
];

/** Footer destinations for the pages in this stream. */
export const PA_FOOTER_LINKS: readonly V2Link[] = [
    { label: "Help", href: "/knowledge" },
    { label: "Contact", href: "/contact" },
    { label: "Field agents", href: "/v2/field-agents" },
    { label: "About", href: "/v2/about" },
    { label: "Privacy", href: "/v2/privacy" },
    { label: "Terms", href: "/v2/terms" },
];

/**
 * Store listings come from env when the apps are listed. Missing URLs render
 * a coming-soon state (add the real URLs in the deploy environment).
 */
export const APP_LINKS = {
    appStore: process.env.NEXT_PUBLIC_APP_STORE_URL,
    googlePlay: process.env.NEXT_PUBLIC_GOOGLE_PLAY_URL,
};

export interface ShowcaseSite {
    id: string;
    name: string;
    kind: string;
    city: string;
    /** Craft filter on /v2/examples. */
    craft: string;
    /** Card shape on the masonry grid: the desktop fold, or a tall phone crop. */
    shape: "d" | "m";
}

/** The 22 showcase sites (public/v2/showcase/<id>), craft first. */
export const SHOWCASE_SITES: readonly ShowcaseSite[] = [
    { id: "forge", name: "Forge Barbers", kind: "Barbershop", city: "Marikina", craft: "Barber & salon", shape: "d" },
    { id: "vulca", name: "Vulca Garage", kind: "Auto repair", city: "Cebu City", craft: "Repair", shape: "m" },
    { id: "tailor", name: "Santos Tailoring", kind: "Tailor", city: "Taytay, Rizal", craft: "Makers", shape: "d" },
    { id: "carpenter", name: "Lakan Woodworks", kind: "Carpenter", city: "Paete, Laguna", craft: "Makers", shape: "d" },
    { id: "hela", name: "Héla Hair Studio", kind: "Hair salon", city: "Makati", craft: "Barber & salon", shape: "m" },
    { id: "bike", name: "Padyak Bike Shop", kind: "Bike repair", city: "Marikina", craft: "Repair", shape: "d" },
    { id: "florist", name: "Liwayway Flowers", kind: "Florist", city: "Quezon City", craft: "Makers", shape: "m" },
    { id: "ceramics", name: "Luwad Studio", kind: "Ceramics", city: "Tagaytay", craft: "Makers", shape: "d" },
    { id: "phonefix", name: "Ayos Phone Fix", kind: "Phone repair", city: "Cubao", craft: "Repair", shape: "d" },
    { id: "tattoo", name: "Tinta Studio", kind: "Fine-line tattoos", city: "Poblacion, Makati", craft: "Barber & salon", shape: "m" },
    { id: "print", name: "Tinta Print Hub", kind: "Print shop", city: "Sampaloc, Manila", craft: "Makers", shape: "d" },
    { id: "domingo", name: "Domingo Hardware", kind: "Hardware store", city: "Lipa City", craft: "Shops", shape: "m" },
    { id: "labana", name: "Labaná Laundry", kind: "Laundry", city: "Pasig", craft: "Shops", shape: "d" },
    { id: "dental", name: "Ngiti Dental", kind: "Dental clinic", city: "Quezon City", craft: "Health & pets", shape: "d" },
    { id: "petgroom", name: "Paws & Ligo", kind: "Pet grooming", city: "Las Piñas", craft: "Health & pets", shape: "m" },
    { id: "photo", name: "Liwanag Photo", kind: "Wedding & portrait photographer", city: "Tagaytay", craft: "Learning & outdoors", shape: "d" },
    { id: "tutor", name: "Talino Tutorial Center", kind: "Tutoring", city: "Davao City", craft: "Learning & outdoors", shape: "m" },
    { id: "sarisari", name: "Tindahan ni Aling Nena", kind: "Sari-sari store", city: "Batangas City", craft: "Shops", shape: "d" },
    { id: "dive", name: "Bughaw Dive Center", kind: "Dive shop", city: "Moalboal, Cebu", craft: "Learning & outdoors", shape: "d" },
    { id: "surf", name: "Alon Surf Camp", kind: "Surf lessons", city: "General Luna, Siargao", craft: "Learning & outdoors", shape: "m" },
    { id: "baker", name: "Rosal Bakeshop", kind: "Bakery", city: "Iloilo City", craft: "Food", shape: "d" },
    { id: "halohalo", name: "Yelo Halo-Halo", kind: "Dessert stall", city: "Pampanga", craft: "Food", shape: "m" },
];

export const CRAFTS = ["Barber & salon", "Repair", "Makers", "Shops", "Health & pets", "Learning & outdoors", "Food"] as const;

export function showcaseById(id: string) {
    return SHOWCASE_SITES.find((s) => s.id === id);
}

export const pesos = (n: number) => "₱" + Math.round(n).toLocaleString("en-US");
