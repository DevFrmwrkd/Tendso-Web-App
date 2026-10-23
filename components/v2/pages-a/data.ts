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
