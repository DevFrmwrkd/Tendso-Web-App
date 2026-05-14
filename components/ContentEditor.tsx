import { useState, useMemo } from 'react'
import {
    Palette,
    Type,
    Layers,
    Box,
    ChevronDown,
    ChevronUp,
    Save,
    Layout,
    Monitor,
    Smartphone,
    Check,
    Sparkles
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

/**
 * CATEGORY_STYLES — themed style families with per-section variants.
 * Each category has 5 sections (hero/about/services/gallery/contact),
 * each section has up to 5 variants. Variant 1 ships now; 2-5 ship in future turns.
 *
 * Style key format: `${categoryLetter}${variantNumber}` (e.g., "K1", "K2", ... "K5")
 */
type SectionId = 'hero' | 'about' | 'services' | 'gallery' | 'contact'

type Variant = { key: string; label: string; description: string; status?: 'available' | 'coming-soon' }

type Category = {
    key: string // K, L, M, N, O
    emoji: string
    label: string
    tagline: string
    palette: { bg: string; primary: string; accent: string; text: string }
    sections: Record<SectionId, Variant[]>
}

const CATEGORY_STYLES: Category[] = [
    {
        key: 'K',
        emoji: '💈',
        label: 'Barber Shop',
        tagline: 'Vintage masculine, heritage feel',
        palette: { bg: '#f5e9d3', primary: '#7a1a2c', accent: '#c9a961', text: '#1a0c10' },
        sections: {
            hero: [
                { key: 'K1', label: 'Heritage Master', description: 'Asymmetric split with rotating barber pole stripe', status: 'available' },
                { key: 'K2', label: 'Storefront Window', description: 'Full-bleed shop view, window-pane grid, swinging OPEN sign', status: 'available' },
                { key: 'K3', label: 'Vintage Poster', description: 'Typographic only — Victorian ornate borders, est. stamp', status: 'available' },
                { key: 'K4', label: 'Open Chair', description: 'Centered chair under spotlight, "Reserved" tag hangs', status: 'available' },
                { key: 'K5', label: 'Old School', description: 'Newspaper classified — masthead, 3-col layout, masthead', status: 'available' },
            ],
            about: [
                { key: 'K1', label: 'Family Legacy', description: 'Portrait frame with chapter heading', status: 'available' },
                { key: 'K2', label: 'Three Generations', description: 'Timeline of 3 generations with vintage portraits', status: 'available' },
                { key: 'K3', label: 'Master Letter', description: 'Handwritten letter from the master barber + wax seal', status: 'available' },
                { key: 'K4', label: 'Chair Stories', description: 'Central chair photo with 4 customer-quote cards', status: 'available' },
                { key: 'K5', label: 'Apprentice Path', description: 'Vertical stepped timeline: apprentice → master', status: 'available' },
            ],
            services: [
                { key: 'K1', label: 'Menu Card', description: 'Dotted-leader pricing on cream paper', status: 'available' },
                { key: 'K2', label: 'Chalkboard', description: 'White chalk on green chalkboard surface', status: 'available' },
                { key: 'K3', label: 'Service Stations', description: 'Numbered "stations" with brass-framed icons', status: 'available' },
                { key: 'K4', label: 'Numbered Tiers', description: '3-up packaged pricing tiers (Essential/Classic/Master)', status: 'available' },
                { key: 'K5', label: 'Picture Menu', description: 'Photo cards with price tag overlays', status: 'available' },
            ],
            gallery: [
                { key: 'K1', label: 'Polaroid Wall', description: 'Tilted snapshots with tape strips', status: 'available' },
                { key: 'K2', label: 'Before & After', description: 'Side-by-side transformation pairs', status: 'available' },
                { key: 'K3', label: 'Hall of Fame', description: 'Ornate brass-framed portraits of regulars', status: 'available' },
                { key: 'K4', label: 'Cut Catalog', description: 'Categorized by style (Classic/Modern/Fade/Beard)', status: 'available' },
                { key: 'K5', label: 'Daily Specials', description: '7-day grid, today highlighted', status: 'available' },
            ],
            contact: [
                { key: 'K1', label: 'Vintage Storefront', description: 'Brass-framed hours + sign', status: 'available' },
                { key: 'K2', label: 'Walk-In Queue', description: 'Big hours block, "no appointment" vibe', status: 'available' },
                { key: 'K3', label: 'Reservation Card', description: 'Wallet-card style with wax seal & perforations', status: 'available' },
                { key: 'K4', label: 'Old Postcard', description: 'Vintage postcard with stamp & address lines', status: 'available' },
                { key: 'K5', label: 'Window Notice', description: 'Printed shop sign with tape strips', status: 'available' },
            ],
        },
    },
    {
        key: 'L',
        emoji: '🚗',
        label: 'Auto Shop',
        tagline: 'Industrial, technical, rugged',
        palette: { bg: '#1a1d22', primary: '#f5c842', accent: '#4a6b8a', text: '#e8eaed' },
        sections: {
            hero: [
                { key: 'L1', label: 'Industrial Diagnostic', description: 'Blueprint grid + diagnostic readout', status: 'available' },
                { key: 'L2', label: 'Garage Floor', description: 'Hazard-tape borders + bay number frame', status: 'available' },
                { key: 'L3', label: 'Lifted Truck', description: 'Full-bleed cinematic image + tire-tread divider', status: 'available' },
                { key: 'L4', label: 'Tool Wall', description: 'Pegboard layout with framed tool tiles', status: 'available' },
                { key: 'L5', label: 'Spec Sheet', description: 'Two-column technical data sheet with QR stamp', status: 'available' },
            ],
            about: [
                { key: 'L1', label: 'Workshop Floor', description: 'Stat counters + bay credentials', status: 'available' },
                { key: 'L2', label: 'Mechanics Crew', description: 'Lead mechanic feature + ID-badge crew cards', status: 'available' },
                { key: 'L3', label: 'Certifications', description: 'ASE/OEM cert wall with stamped tiles', status: 'available' },
                { key: 'L4', label: 'Years on the Job', description: 'Vertical timeline of milestone years', status: 'available' },
                { key: 'L5', label: 'Customer Cars', description: 'Polaroid mosaic of cars serviced', status: 'available' },
            ],
            services: [
                { key: 'L1', label: 'Service Bay Grid', description: 'Technical cards with 6 SVG icons', status: 'available' },
                { key: 'L2', label: 'Package Pricing', description: 'Three-tier basic/standard/premium with featured center', status: 'available' },
                { key: 'L3', label: 'Diagnostic Tree', description: 'Symptom → fix flowchart with branching nodes', status: 'available' },
                { key: 'L4', label: 'Quick Quote', description: 'Estimate-sheet checklist with prices and time', status: 'available' },
                { key: 'L5', label: 'Specialty List', description: 'Big numbered list of signature services', status: 'available' },
            ],
            gallery: [
                { key: 'L1', label: 'Case Files', description: 'Folder cards with completion stamps', status: 'available' },
                { key: 'L2', label: 'Before/After Slider', description: 'Paired before/after with banner labels', status: 'available' },
                { key: 'L3', label: 'Project Index', description: 'Tabular index of jobs by number + vehicle', status: 'available' },
                { key: 'L4', label: 'Restoration Log', description: 'Dossier entries with date stamps and notes', status: 'available' },
                { key: 'L5', label: 'Custom Builds', description: 'Magazine-style feature build + side gallery', status: 'available' },
            ],
            contact: [
                { key: 'L1', label: 'Operations Desk', description: 'Safety stripes + per-day hours', status: 'available' },
                { key: 'L2', label: 'Service Bay Map', description: 'Bay-status grid with live wait times', status: 'available' },
                { key: 'L3', label: 'Quote Request', description: 'Quote-card with labeled field placeholders', status: 'available' },
                { key: 'L4', label: 'Workshop Hours', description: 'Big hours-board with today highlighted', status: 'available' },
                { key: 'L5', label: 'Tow Service', description: '24/7 emergency beacon with big call line', status: 'available' },
            ],
        },
    },
    {
        key: 'M',
        emoji: '💅',
        label: 'Salon / Spa',
        tagline: 'Luxe ethereal, soft & feminine',
        palette: { bg: '#faf3ef', primary: '#b87b6c', accent: '#9caf88', text: '#3d2e2a' },
        sections: {
            hero: [
                { key: 'M1', label: 'Sanctuary Calm', description: 'Floating petals + oval-curved image', status: 'available' },
                { key: 'M2', label: 'Bridal Promise', description: 'Invitation-card with wax seal and lace divider', status: 'available' },
                { key: 'M3', label: 'Garden Bath', description: 'Botanical SVG flourishes + asymmetric image', status: 'available' },
                { key: 'M4', label: 'Velvet Curtain', description: 'Theatrical curtain reveal with center portrait', status: 'available' },
                { key: 'M5', label: 'Morning Light', description: 'Sunrise gradient + sunbeam rays + horizon image', status: 'available' },
            ],
            about: [
                { key: 'M1', label: 'Personal Touch', description: 'Circular portrait with sage orbit ring', status: 'available' },
                { key: 'M2', label: 'Founder Note', description: 'Letter-style card with portrait and signature', status: 'available' },
                { key: 'M3', label: 'Our Practice', description: 'Editorial drop-cap with pulled quote and collage', status: 'available' },
                { key: 'M4', label: 'Wellness Pillars', description: 'Four-pillar philosophy cards with icons', status: 'available' },
                { key: 'M5', label: 'Studio Tour', description: 'Numbered walkthrough of each room', status: 'available' },
            ],
            services: [
                { key: 'M1', label: 'Treatment Menu', description: 'Soft cards with duration + price', status: 'available' },
                { key: 'M2', label: 'Wellness Packages', description: 'Three curated journey tiers, featured middle', status: 'available' },
                { key: 'M3', label: 'Half-Day Spa', description: 'Hour-by-hour itinerary timeline', status: 'available' },
                { key: 'M4', label: 'Bridal Bundles', description: 'Trial / day-of / wedding party packages', status: 'available' },
                { key: 'M5', label: 'Membership', description: 'Three monthly membership tiers', status: 'available' },
            ],
            gallery: [
                { key: 'M1', label: 'Soft Showcase', description: 'Asymmetric masonry with petal hover', status: 'available' },
                { key: 'M2', label: 'Before & After', description: 'Curved-frame paired treatment results', status: 'available' },
                { key: 'M3', label: 'Treatment Rooms', description: 'Tour of each studio room with mood detail', status: 'available' },
                { key: 'M4', label: 'Bridal Lookbook', description: 'Cover-look hero + side lookbook grid', status: 'available' },
                { key: 'M5', label: 'Editorial', description: 'Magazine-spread layout with cover hero', status: 'available' },
            ],
            contact: [
                { key: 'M1', label: 'Booking Sanctuary', description: 'Rounded card + pill hour entries', status: 'available' },
                { key: 'M2', label: 'Reservation Note', description: 'Handwritten letter-style reservation card', status: 'available' },
                { key: 'M3', label: 'Instagram Direct', description: 'Phone mockup with DM bubbles + IG handle', status: 'available' },
                { key: 'M4', label: 'Walk-In Welcome', description: 'Day-pill hours with today highlighted', status: 'available' },
                { key: 'M5', label: 'Concierge', description: 'Dark luxe panel with portrait + direct line', status: 'available' },
            ],
        },
    },
    {
        key: 'N',
        emoji: '🍽️',
        label: 'Restaurant',
        tagline: 'Warm, appetizing, hospitable',
        palette: { bg: '#faf2e3', primary: '#c45a3a', accent: '#6b6f47', text: '#2a1f1c' },
        sections: {
            hero: [
                { key: 'N1', label: 'Warm Table', description: 'Rising steam + plate-frame image', status: 'available' },
                { key: 'N2', label: 'Chef Special', description: 'Chalkboard special + circular plate frame', status: 'available' },
                { key: 'N3', label: 'Reservation Desk', description: 'Hostess-station card with seating details', status: 'available' },
                { key: 'N4', label: 'Dinner Service', description: 'Full-bleed dark dining image with candle glow', status: 'available' },
                { key: 'N5', label: 'Bistro Window', description: 'Window-frame quadrant layout with open sign', status: 'available' },
            ],
            about: [
                { key: 'N1', label: 'The Kitchen Story', description: 'Ingredient ticker + recipe stamp', status: 'available' },
                { key: 'N2', label: 'Family Recipes', description: 'Cookbook-spread with ingredients and method', status: 'available' },
                { key: 'N3', label: 'Chef Profile', description: 'Portrait + bio + career timeline', status: 'available' },
                { key: 'N4', label: 'Sourcing Story', description: 'Supplier list with provenance per ingredient', status: 'available' },
                { key: 'N5', label: 'Heritage Plate', description: 'Signature dish history with generational timeline', status: 'available' },
            ],
            services: [
                { key: 'N1', label: 'The Menu', description: 'Sectioned menu card with dotted leaders', status: 'available' },
                { key: 'N2', label: 'Prix Fixe', description: 'Three-course set menu with total price', status: 'available' },
                { key: 'N3', label: 'Wine Pairing', description: 'Dish + paired wine + tasting notes', status: 'available' },
                { key: 'N4', label: 'Tasting Course', description: 'Seven-course progression on a timeline', status: 'available' },
                { key: 'N5', label: 'Family Style', description: 'Sharing platters priced per table', status: 'available' },
            ],
            gallery: [
                { key: 'N1', label: 'The Table', description: 'Mixed-shape food grid with hover', status: 'available' },
                { key: 'N2', label: 'Plate Carousel', description: 'Horizontal scrolling circular plate row', status: 'available' },
                { key: 'N3', label: 'Behind the Pass', description: 'Documentary kitchen photos with time stamps', status: 'available' },
                { key: 'N4', label: 'Daily Specials', description: 'Day-of-week special cards with today highlighted', status: 'available' },
                { key: 'N5', label: 'Seasonal', description: 'Four-season menu progression', status: 'available' },
            ],
            contact: [
                { key: 'N1', label: 'Reservation Desk', description: 'Dark card with brass corners', status: 'available' },
                { key: 'N2', label: 'Walk-In Sign', description: 'Tilted sidewalk sign with chalkboard frame', status: 'available' },
                { key: 'N3', label: "Tonight's Booking", description: 'Party-size + time-slot picker for tonight', status: 'available' },
                { key: 'N4', label: 'Catering Inquiry', description: 'Event-type and guest-count selector', status: 'available' },
                { key: 'N5', label: 'Private Events', description: 'Luxe buyout panel with venue photo', status: 'available' },
            ],
        },
    },
    {
        key: 'O',
        emoji: '🏥',
        label: 'Clinic',
        tagline: 'Clean, trustworthy, professional',
        palette: { bg: '#ffffff', primary: '#2563a8', accent: '#5e8c7c', text: '#1f2937' },
        sections: {
            hero: [
                { key: 'O1', label: 'Medical Practice', description: 'EKG pulse line + appointment cards', status: 'available' },
                { key: 'O2', label: 'Patient Welcome', description: 'Trust signal row + next-available appointment card', status: 'available' },
                { key: 'O3', label: 'Specialty Focus', description: 'Credential bar + portrait + CV stats overlay', status: 'available' },
                { key: 'O4', label: 'Wellness Center', description: 'Centered narrative + 4-pillar care row', status: 'available' },
                { key: 'O5', label: 'Family Care', description: 'Family photo + 5 age-group cards', status: 'available' },
            ],
            about: [
                { key: 'O1', label: 'Our Practice', description: 'Doctor portrait + 4-stat trust row', status: 'available' },
                { key: 'O2', label: 'Provider Bios', description: 'Team grid with role + credential badge', status: 'available' },
                { key: 'O3', label: 'Mission Statement', description: 'Mission card + 3 numbered principles', status: 'available' },
                { key: 'O4', label: 'Insurance Network', description: 'Accepted plans grid + FAQ section', status: 'available' },
                { key: 'O5', label: 'Patient Outcomes', description: '4 metric cards + patient testimonials', status: 'available' },
            ],
            services: [
                { key: 'O1', label: 'Treatments & Services', description: '6 medical SVG icons, insurance badge', status: 'available' },
                { key: 'O2', label: 'Service Lines', description: 'Department-grouped services with sub-items', status: 'available' },
                { key: 'O3', label: 'Diagnostic Menu', description: 'Lab/imaging table with prep + turnaround', status: 'available' },
                { key: 'O4', label: 'Specialist Referral', description: 'Referral pathway + specialist cards', status: 'available' },
                { key: 'O5', label: 'Preventive Plans', description: '3 membership tiers (essential/family/senior)', status: 'available' },
            ],
            gallery: [
                { key: 'O1', label: 'Inside the Clinic', description: 'Bento grid: facility, equipment, team', status: 'available' },
                { key: 'O2', label: 'Team Portraits', description: 'Clean grid of medical team with credentials', status: 'available' },
                { key: 'O3', label: 'Equipment Showcase', description: 'Equipment cards with model + capability', status: 'available' },
                { key: 'O4', label: 'Patient Stories', description: 'Patient testimonials with outcome metrics', status: 'available' },
                { key: 'O5', label: 'Virtual Tour', description: 'Numbered walkthrough of clinic spaces', status: 'available' },
            ],
            contact: [
                { key: 'O1', label: 'Book Appointment', description: 'Blue card + today-highlighted hours', status: 'available' },
                { key: 'O2', label: 'Patient Portal', description: 'Sign-in / sign-up + portal feature grid', status: 'available' },
                { key: 'O3', label: 'After Hours', description: 'Emergency/urgent/non-urgent triage tree', status: 'available' },
                { key: 'O4', label: 'Insurance Verify', description: 'Verification form preview + how-it-works', status: 'available' },
                { key: 'O5', label: 'Telehealth', description: 'Video-visit mockup + use cases + device requirements', status: 'available' },
            ],
        },
    },
]

// Section ID → editor field name on EditorCustomizations
const SECTION_FIELD_MAP: Record<SectionId, keyof EditorCustomizations> = {
    hero: 'heroStyle',
    about: 'aboutStyle',
    services: 'servicesStyle',
    gallery: 'galleryStyle',
    contact: 'contactStyle',
}

const SECTION_LABELS: Record<SectionId, { label: string; sub: string }> = {
    hero: { label: 'Hero Section', sub: 'Top Banner' },
    about: { label: 'About Section', sub: 'Story & Mission' },
    services: { label: 'Services Section', sub: 'What We Do' },
    gallery: { label: 'Gallery Section', sub: 'Visual Portfolio' },
    contact: { label: 'Contact Section', sub: 'Conversion Point' },
}

/**
 * VariantPreview — mini schematic preview for each [section, variant] combo.
 * Renders a small layout suggestion using the category's palette so users
 * can visually identify the variant. ~80px tall, full-width.
 */
function VariantPreview({ sectionId, variantKey, palette }: {
    sectionId: SectionId
    variantKey: string
    palette: { bg: string; primary: string; accent: string; text: string }
}) {
    const variantNum = parseInt(variantKey.replace(/^[A-Z]+/, '')) || 1
    const bgStyle = { backgroundColor: palette.bg }
    const darkStyle = { backgroundColor: palette.text }

    // HERO ===========================================================
    if (sectionId === 'hero') {
        if (variantNum === 1) {
            // Split 2-col: text left, image right
            return (
                <div className="relative w-full h-20 overflow-hidden flex" style={bgStyle}>
                    <div className="w-3/5 p-2 flex flex-col gap-1 justify-center">
                        <div className="h-1 w-1/3 rounded-full" style={{ backgroundColor: palette.primary }} />
                        <div className="h-2 w-4/5 rounded-sm mt-1" style={{ backgroundColor: palette.text }} />
                        <div className="h-1 w-3/5 rounded-full opacity-40" style={{ backgroundColor: palette.text }} />
                        <div className="h-1.5 w-1/4 rounded-sm mt-1" style={{ backgroundColor: palette.primary }} />
                    </div>
                    <div className="relative w-2/5 m-1.5" style={darkStyle}>
                        <div className="absolute top-1 right-1 w-2 h-2 border-t border-r" style={{ borderColor: palette.accent }} />
                        <div className="absolute bottom-1 left-1 w-2 h-2 border-b border-l" style={{ borderColor: palette.accent }} />
                    </div>
                </div>
            )
        }
        if (variantNum === 2) {
            // Full-bleed with window grid + sign
            return (
                <div className="relative w-full h-20 overflow-hidden" style={darkStyle}>
                    <div className="absolute inset-0 grid grid-cols-3" style={{ gap: '1px', backgroundColor: palette.accent }}>
                        <div style={darkStyle} /><div style={darkStyle} /><div style={darkStyle} />
                    </div>
                    <div className="absolute top-1 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded-sm" style={{ backgroundColor: palette.primary, color: palette.bg }}>
                        <span className="text-[6px] font-bold uppercase tracking-widest">OPEN</span>
                    </div>
                    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex flex-col gap-0.5 items-center">
                        <div className="h-1 w-12 rounded-full" style={{ backgroundColor: palette.bg }} />
                        <div className="h-0.5 w-8 rounded-full opacity-50" style={{ backgroundColor: palette.bg }} />
                    </div>
                </div>
            )
        }
        if (variantNum === 3) {
            // Centered poster — ornate frame, all-text
            return (
                <div className="relative w-full h-20 overflow-hidden flex items-center justify-center" style={bgStyle}>
                    <div className="absolute inset-1.5 border-2" style={{ borderColor: palette.primary }} />
                    <div className="absolute inset-2.5 border" style={{ borderColor: palette.accent, opacity: 0.6 }} />
                    <div className="flex flex-col gap-0.5 items-center relative z-10">
                        <div className="h-0.5 w-8 rounded-full" style={{ backgroundColor: palette.accent }} />
                        <div className="h-2 w-12 rounded-sm" style={{ backgroundColor: palette.text }} />
                        <div className="h-0.5 w-10 rounded-full opacity-50" style={{ backgroundColor: palette.primary }} />
                    </div>
                </div>
            )
        }
        if (variantNum === 4) {
            // Open Chair — centered narrow image + spotlight
            return (
                <div className="relative w-full h-20 overflow-hidden flex items-center justify-center" style={darkStyle}>
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-20 h-12 rounded-full blur-md opacity-30" style={{ backgroundColor: palette.accent }} />
                    <div className="flex items-center gap-2 relative z-10">
                        <div className="flex flex-col gap-0.5">
                            <div className="h-1 w-6 rounded-full opacity-50" style={{ backgroundColor: palette.bg }} />
                            <div className="h-1 w-4 rounded-full opacity-30" style={{ backgroundColor: palette.bg }} />
                        </div>
                        <div className="w-7 h-14 border" style={{ backgroundColor: palette.bg, borderColor: palette.accent }} />
                        <div className="flex flex-col gap-0.5">
                            <div className="h-2 w-6 rounded-sm" style={{ backgroundColor: palette.accent }} />
                            <div className="h-1 w-4 rounded-full opacity-40" style={{ backgroundColor: palette.bg }} />
                        </div>
                    </div>
                </div>
            )
        }
        // variantNum === 5: Newspaper 3-col
        return (
            <div className="relative w-full h-20 overflow-hidden p-1" style={bgStyle}>
                <div className="border-t-2 border-b-2 border-double pb-0.5 mb-1" style={{ borderColor: palette.text }}>
                    <div className="h-1.5 w-2/3 mx-auto rounded-sm" style={{ backgroundColor: palette.text }} />
                </div>
                <div className="flex gap-1 h-10">
                    <div className="flex-1 flex flex-col gap-0.5">
                        <div className="h-0.5 w-full rounded-full opacity-40" style={{ backgroundColor: palette.text }} />
                        <div className="h-0.5 w-3/4 rounded-full opacity-40" style={{ backgroundColor: palette.text }} />
                        <div className="h-0.5 w-5/6 rounded-full opacity-40" style={{ backgroundColor: palette.text }} />
                    </div>
                    <div className="w-px" style={{ backgroundColor: palette.primary, opacity: 0.3 }} />
                    <div className="flex-[1.4] flex flex-col gap-0.5 items-center">
                        <div className="h-1 w-2/3 rounded-sm" style={{ backgroundColor: palette.primary }} />
                        <div className="h-0.5 w-full rounded-full opacity-40" style={{ backgroundColor: palette.text }} />
                        <div className="h-0.5 w-5/6 rounded-full opacity-40" style={{ backgroundColor: palette.text }} />
                    </div>
                    <div className="w-px" style={{ backgroundColor: palette.primary, opacity: 0.3 }} />
                    <div className="flex-1 flex flex-col gap-0.5">
                        <div className="aspect-square w-full" style={{ backgroundColor: palette.text }} />
                    </div>
                </div>
            </div>
        )
    }

    // ABOUT ==========================================================
    if (sectionId === 'about') {
        if (variantNum === 1) {
            // Family Legacy — portrait + text split
            return (
                <div className="relative w-full h-20 overflow-hidden flex items-center gap-2 p-2" style={bgStyle}>
                    <div className="w-12 h-14 rounded-full border-2" style={{ backgroundColor: palette.text, borderColor: palette.accent }} />
                    <div className="flex-1 flex flex-col gap-1">
                        <div className="h-0.5 w-1/3 rounded-full" style={{ backgroundColor: palette.primary }} />
                        <div className="h-1.5 w-4/5 rounded-sm" style={{ backgroundColor: palette.text }} />
                        <div className="h-0.5 w-full rounded-full opacity-40" style={{ backgroundColor: palette.text }} />
                        <div className="h-0.5 w-2/3 rounded-full opacity-40" style={{ backgroundColor: palette.text }} />
                    </div>
                </div>
            )
        }
        if (variantNum === 2) {
            // Three Generations — 3 portraits in a row
            return (
                <div className="relative w-full h-20 overflow-hidden p-2" style={bgStyle}>
                    <div className="flex justify-center gap-3 mt-1">
                        {[0, 1, 2].map((i) => (
                            <div key={i} className="flex flex-col items-center gap-0.5">
                                <div className="w-1 h-0.5 rounded-sm" style={{ backgroundColor: palette.primary }} />
                                <div className="w-8 h-8 rounded-full border" style={{ backgroundColor: palette.text, borderColor: palette.accent }} />
                                <div className="w-6 h-0.5 rounded-full opacity-40" style={{ backgroundColor: palette.text }} />
                            </div>
                        ))}
                    </div>
                    <div className="absolute top-6 left-6 right-6 h-px" style={{ backgroundColor: palette.accent, opacity: 0.4 }} />
                </div>
            )
        }
        if (variantNum === 3) {
            // Master Letter — centered card on dark bg
            return (
                <div className="relative w-full h-20 overflow-hidden flex items-center justify-center" style={darkStyle}>
                    <div className="w-3/4 h-14 p-1.5 shadow-lg" style={{ backgroundColor: palette.bg }}>
                        <div className="h-0.5 w-2/3 rounded-full" style={{ backgroundColor: palette.primary }} />
                        <div className="h-0.5 w-full rounded-full opacity-30 mt-1" style={{ backgroundColor: palette.text }} />
                        <div className="h-0.5 w-5/6 rounded-full opacity-30 mt-0.5" style={{ backgroundColor: palette.text }} />
                        <div className="h-1 w-1/3 rounded-sm mt-1" style={{ backgroundColor: palette.primary }} />
                    </div>
                    <div className="absolute right-3 bottom-2 w-3 h-3 rounded-full" style={{ backgroundColor: palette.primary }} />
                </div>
            )
        }
        if (variantNum === 4) {
            // Chair Stories — hub + spoke
            return (
                <div className="relative w-full h-20 overflow-hidden flex items-center gap-1 p-2" style={bgStyle}>
                    <div className="flex flex-col gap-0.5 w-1/4">
                        <div className="h-3 w-full rounded-sm" style={{ backgroundColor: palette.bg, border: `1px solid ${palette.primary}` }} />
                        <div className="h-3 w-full rounded-sm" style={{ backgroundColor: palette.bg, border: `1px solid ${palette.primary}` }} />
                    </div>
                    <div className="w-10 h-14 mx-1" style={{ backgroundColor: palette.text }} />
                    <div className="flex flex-col gap-0.5 w-1/4">
                        <div className="h-3 w-full rounded-sm" style={{ backgroundColor: palette.bg, border: `1px solid ${palette.primary}` }} />
                        <div className="h-3 w-full rounded-sm" style={{ backgroundColor: palette.bg, border: `1px solid ${palette.primary}` }} />
                    </div>
                </div>
            )
        }
        // variantNum === 5: Apprentice Path — vertical timeline
        return (
            <div className="relative w-full h-20 overflow-hidden flex gap-2 p-2" style={darkStyle}>
                <div className="w-10 h-full" style={{ backgroundColor: palette.bg }} />
                <div className="flex-1 relative">
                    <div className="absolute left-2 top-1 bottom-1 w-px" style={{ backgroundColor: palette.accent, opacity: 0.4 }} />
                    {[0, 1, 2, 3].map((i) => (
                        <div key={i} className="flex items-center gap-1.5" style={{ marginTop: i === 0 ? '0' : '4px' }}>
                            <div className="w-4 h-4 rounded-full border" style={{ backgroundColor: palette.primary, borderColor: palette.accent }} />
                            <div className="h-0.5 w-12 rounded-full opacity-50" style={{ backgroundColor: palette.bg }} />
                        </div>
                    ))}
                </div>
            </div>
        )
    }

    // SERVICES =======================================================
    if (sectionId === 'services') {
        if (variantNum === 1) {
            // Menu Card — list with dotted leaders
            return (
                <div className="relative w-full h-20 overflow-hidden flex items-center justify-center p-2" style={darkStyle}>
                    <div className="w-5/6 h-16 p-2 flex flex-col gap-1.5" style={{ backgroundColor: palette.bg, border: `1px solid ${palette.primary}` }}>
                        {[0, 1, 2].map((i) => (
                            <div key={i} className="flex items-center gap-1">
                                <div className="h-1 w-8 rounded-sm" style={{ backgroundColor: palette.text }} />
                                <div className="flex-1 border-b border-dotted" style={{ borderColor: palette.primary, opacity: 0.5 }} />
                                <div className="h-1 w-4 rounded-sm" style={{ backgroundColor: palette.primary }} />
                            </div>
                        ))}
                    </div>
                </div>
            )
        }
        if (variantNum === 2) {
            // Chalkboard — dark green surface
            return (
                <div className="relative w-full h-20 overflow-hidden p-1.5" style={{ backgroundColor: '#0d2a22' }}>
                    <div className="absolute inset-1 border-4" style={{ borderColor: '#3a2517' }} />
                    <div className="relative p-2 flex flex-col gap-1.5">
                        <div className="h-0.5 w-1/2 mx-auto rounded-full" style={{ backgroundColor: palette.bg }} />
                        {[0, 1, 2].map((i) => (
                            <div key={i} className="flex items-center gap-1">
                                <div className="h-0.5 w-8 rounded-full" style={{ backgroundColor: palette.bg, opacity: 0.9 - i * 0.1 }} />
                                <div className="flex-1 border-b border-dashed opacity-40" style={{ borderColor: palette.bg }} />
                                <div className="h-0.5 w-3 rounded-full" style={{ backgroundColor: palette.accent }} />
                            </div>
                        ))}
                    </div>
                    <div className="absolute bottom-1 right-2 w-2.5 h-1 rounded-sm rotate-12" style={{ backgroundColor: palette.bg }} />
                </div>
            )
        }
        if (variantNum === 3) {
            // Service Stations — 3-up cards
            return (
                <div className="relative w-full h-20 overflow-hidden p-2" style={bgStyle}>
                    <div className="grid grid-cols-3 gap-1 h-full">
                        {[0, 1, 2].map((i) => (
                            <div key={i} className="flex flex-col items-center justify-center gap-1 border" style={{ backgroundColor: palette.text, borderColor: palette.primary, opacity: 0.95 }}>
                                <div className="w-4 h-4 rounded-full border" style={{ backgroundColor: palette.accent, borderColor: palette.accent }} />
                                <div className="h-0.5 w-3/4 rounded-full" style={{ backgroundColor: palette.bg }} />
                            </div>
                        ))}
                    </div>
                </div>
            )
        }
        if (variantNum === 4) {
            // Numbered Tiers — 3-up pricing with middle elevated
            return (
                <div className="relative w-full h-20 overflow-hidden flex items-end justify-center gap-1 p-1.5" style={darkStyle}>
                    <div className="w-1/4 h-12 flex flex-col items-center justify-center gap-0.5" style={{ backgroundColor: palette.bg }}>
                        <div className="h-0.5 w-3 rounded-full" style={{ backgroundColor: palette.primary }} />
                        <div className="h-1.5 w-4 rounded-sm" style={{ backgroundColor: palette.text }} />
                    </div>
                    <div className="w-1/4 h-16 flex flex-col items-center justify-center gap-0.5 border-2" style={{ backgroundColor: palette.primary, borderColor: palette.accent }}>
                        <div className="h-0.5 w-3 rounded-full" style={{ backgroundColor: palette.accent }} />
                        <div className="h-2 w-5 rounded-sm" style={{ backgroundColor: palette.bg }} />
                    </div>
                    <div className="w-1/4 h-12 flex flex-col items-center justify-center gap-0.5" style={{ backgroundColor: palette.bg }}>
                        <div className="h-0.5 w-3 rounded-full" style={{ backgroundColor: palette.primary }} />
                        <div className="h-1.5 w-4 rounded-sm" style={{ backgroundColor: palette.text }} />
                    </div>
                </div>
            )
        }
        // variantNum === 5: Picture Menu
        return (
            <div className="relative w-full h-20 overflow-hidden p-1.5" style={bgStyle}>
                <div className="grid grid-cols-3 gap-1 h-full">
                    {[0, 1, 2].map((i) => (
                        <div key={i} className="flex flex-col" style={{ backgroundColor: palette.bg, border: `1px solid ${palette.primary}`, opacity: 0.9 }}>
                            <div className="h-3/5 w-full" style={{ backgroundColor: palette.text }} />
                            <div className="flex-1 p-0.5 flex flex-col gap-0.5 justify-center">
                                <div className="h-0.5 w-3/4 rounded-full" style={{ backgroundColor: palette.primary }} />
                                <div className="h-0.5 w-1/2 rounded-full opacity-50" style={{ backgroundColor: palette.text }} />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        )
    }

    // GALLERY ========================================================
    if (sectionId === 'gallery') {
        if (variantNum === 1) {
            // Polaroid Wall — tilted photos
            return (
                <div className="relative w-full h-20 overflow-hidden flex items-center justify-center gap-1.5" style={bgStyle}>
                    {[0, 1, 2, 3].map((i) => {
                        const rots = [-3, 2, -2, 3]
                        return (
                            <div key={i} className="w-8 h-12 p-0.5 shadow-md" style={{ backgroundColor: palette.bg, border: `1px solid ${palette.primary}`, transform: `rotate(${rots[i]}deg)` }}>
                                <div className="w-full h-8" style={{ backgroundColor: palette.text }} />
                                <div className="h-0.5 w-3/4 mx-auto rounded-full mt-1" style={{ backgroundColor: palette.primary }} />
                            </div>
                        )
                    })}
                </div>
            )
        }
        if (variantNum === 2) {
            // Before/After — paired
            return (
                <div className="relative w-full h-20 overflow-hidden p-1.5 flex flex-col gap-1" style={darkStyle}>
                    {[0, 1].map((row) => (
                        <div key={row} className="flex gap-1 h-1/2">
                            <div className="flex-1 relative" style={{ backgroundColor: palette.text, filter: 'grayscale(0.5)' }}>
                                <div className="absolute top-0.5 left-0.5 px-1 text-[5px] font-bold uppercase" style={{ backgroundColor: palette.bg, color: palette.primary }}>B</div>
                            </div>
                            <div className="flex-1 relative" style={{ backgroundColor: palette.text }}>
                                <div className="absolute top-0.5 left-0.5 px-1 text-[5px] font-bold uppercase" style={{ backgroundColor: palette.accent, color: palette.text }}>A</div>
                            </div>
                        </div>
                    ))}
                </div>
            )
        }
        if (variantNum === 3) {
            // Hall of Fame — 4-up framed
            return (
                <div className="relative w-full h-20 overflow-hidden grid grid-cols-4 gap-1 p-1.5" style={bgStyle}>
                    {[0, 1, 2, 3].map((i) => (
                        <div key={i} className="relative">
                            <div className="absolute inset-0 border-2 -translate-x-px -translate-y-px" style={{ borderColor: palette.accent }} />
                            <div className="w-full h-10" style={{ backgroundColor: palette.text }} />
                            <div className="h-0.5 w-3/4 mx-auto mt-1 rounded-full" style={{ backgroundColor: palette.primary }} />
                            <div className="h-0.5 w-1/2 mx-auto mt-0.5 rounded-full opacity-50" style={{ backgroundColor: palette.text }} />
                        </div>
                    ))}
                </div>
            )
        }
        if (variantNum === 4) {
            // Cut Catalog — stacked rows with category bands
            return (
                <div className="relative w-full h-20 overflow-hidden p-1.5 flex flex-col gap-1.5" style={darkStyle}>
                    {[0, 1].map((row) => (
                        <div key={row} className="flex flex-col gap-0.5 flex-1">
                            <div className="flex items-center gap-1 px-1">
                                <div className="h-px flex-1" style={{ backgroundColor: palette.primary }} />
                                <div className="h-0.5 w-6 rounded-full" style={{ backgroundColor: palette.bg }} />
                                <div className="h-px flex-1" style={{ backgroundColor: palette.primary }} />
                            </div>
                            <div className="flex gap-0.5 flex-1">
                                <div className="flex-1" style={{ backgroundColor: palette.bg, opacity: 0.8 }} />
                                <div className="flex-1" style={{ backgroundColor: palette.bg, opacity: 0.8 }} />
                                <div className="flex-1" style={{ backgroundColor: palette.bg, opacity: 0.8 }} />
                            </div>
                        </div>
                    ))}
                </div>
            )
        }
        // variantNum === 5: Daily Specials — week strip
        return (
            <div className="relative w-full h-20 overflow-hidden p-1 grid grid-cols-7 gap-px" style={bgStyle}>
                {[0, 1, 2, 3, 4, 5, 6].map((i) => {
                    const isToday = i === 2
                    return (
                        <div key={i} className={`flex flex-col`} style={{ outline: isToday ? `2px solid ${palette.primary}` : 'none' }}>
                            <div className="h-1 w-full" style={{ backgroundColor: isToday ? palette.primary : palette.text, opacity: isToday ? 1 : 0.8 }} />
                            <div className="flex-1" style={{ backgroundColor: palette.text }} />
                        </div>
                    )
                })}
            </div>
        )
    }

    // CONTACT ========================================================
    if (sectionId === 'contact') {
        if (variantNum === 1) {
            // Vintage Storefront — dark with corner ornaments + 3 cols
            return (
                <div className="relative w-full h-20 overflow-hidden p-2" style={darkStyle}>
                    <div className="absolute inset-1.5 border" style={{ borderColor: palette.accent, opacity: 0.5 }} />
                    <div className="grid grid-cols-3 gap-2 h-full relative">
                        {[0, 1, 2].map((i) => (
                            <div key={i} className="flex flex-col items-center justify-center gap-0.5">
                                <div className="w-3 h-3 rounded-full border" style={{ borderColor: palette.accent }} />
                                <div className="h-0.5 w-4 rounded-full" style={{ backgroundColor: palette.accent }} />
                                <div className="h-0.5 w-6 rounded-full opacity-50" style={{ backgroundColor: palette.bg }} />
                            </div>
                        ))}
                    </div>
                </div>
            )
        }
        if (variantNum === 2) {
            // Walk-In Queue — big centered phone
            return (
                <div className="relative w-full h-20 overflow-hidden flex flex-col items-center justify-center gap-1 p-2" style={bgStyle}>
                    <div className="px-2 py-0.5 text-[6px] font-bold uppercase tracking-widest rounded-sm" style={{ backgroundColor: palette.accent, color: palette.text }}>WALK-IN</div>
                    <div className="h-2.5 w-20 rounded-sm" style={{ backgroundColor: palette.text }} />
                    <div className="h-0.5 w-14 rounded-full opacity-40" style={{ backgroundColor: palette.text }} />
                </div>
            )
        }
        if (variantNum === 3) {
            // Reservation Card — wallet card with perforations
            return (
                <div className="relative w-full h-20 overflow-hidden flex items-center justify-center p-2" style={darkStyle}>
                    <div className="w-4/5 h-14 p-1.5 relative" style={{ backgroundColor: palette.bg }}>
                        <div className="absolute -top-px inset-x-1 h-px" style={{ backgroundImage: `radial-gradient(circle at 1px 50%, ${palette.text} 0 1px, transparent 1.5px)`, backgroundSize: '4px 100%' }} />
                        <div className="absolute -bottom-px inset-x-1 h-px" style={{ backgroundImage: `radial-gradient(circle at 1px 50%, ${palette.text} 0 1px, transparent 1.5px)`, backgroundSize: '4px 100%' }} />
                        <div className="h-0.5 w-1/3 mx-auto rounded-full" style={{ backgroundColor: palette.primary }} />
                        <div className="h-1.5 w-2/3 mx-auto rounded-sm mt-1" style={{ backgroundColor: palette.text }} />
                        <div className="h-0.5 w-full mt-1 rounded-full opacity-40" style={{ backgroundColor: palette.text }} />
                    </div>
                    <div className="absolute right-2 bottom-2 w-4 h-4 rounded-full" style={{ backgroundColor: palette.primary }} />
                </div>
            )
        }
        if (variantNum === 4) {
            // Old Postcard — 2-col with stamp
            return (
                <div className="relative w-full h-20 overflow-hidden flex items-center justify-center p-1.5" style={{ backgroundColor: palette.text, opacity: 0.92 }}>
                    <div className="w-5/6 h-14 flex relative" style={{ backgroundColor: palette.bg }}>
                        <div className="w-1/2 m-1" style={{ backgroundColor: palette.text }} />
                        <div className="w-1/2 flex flex-col gap-0.5 p-1 justify-center">
                            <div className="h-0.5 w-full rounded-full opacity-50" style={{ backgroundColor: palette.text }} />
                            <div className="h-0.5 w-3/4 rounded-full opacity-50" style={{ backgroundColor: palette.text }} />
                            <div className="h-0.5 w-full rounded-full opacity-50" style={{ backgroundColor: palette.text }} />
                        </div>
                        <div className="absolute top-1 right-1 w-3 h-4 border" style={{ backgroundColor: palette.primary, borderColor: palette.accent }} />
                    </div>
                </div>
            )
        }
        // variantNum === 5: Window Notice — bordered notice
        return (
            <div className="relative w-full h-20 overflow-hidden flex items-center justify-center p-1.5" style={bgStyle}>
                <div className="w-4/5 h-full border-4 p-1.5 flex flex-col gap-1 items-center justify-center relative" style={{ backgroundColor: palette.bg, borderColor: palette.text }}>
                    <div className="absolute -top-1 left-2 w-4 h-1 rotate-[-4deg]" style={{ backgroundColor: palette.accent, opacity: 0.5 }} />
                    <div className="absolute -top-1 right-2 w-4 h-1 rotate-[4deg]" style={{ backgroundColor: palette.accent, opacity: 0.5 }} />
                    <div className="h-0.5 w-1/3 rounded-full" style={{ backgroundColor: palette.primary }} />
                    <div className="h-1.5 w-3/4 rounded-sm" style={{ backgroundColor: palette.text }} />
                    <div className="h-0.5 w-1/2 rounded-full opacity-40" style={{ backgroundColor: palette.text }} />
                </div>
            </div>
        )
    }

    // Fallback
    return <div className="w-full h-20" style={bgStyle} />
}

export interface EditorCustomizations {
    heroStyle: string
    aboutStyle: string
    servicesStyle: string
    galleryStyle: string
    contactStyle: string
    colorScheme: string
    colorSchemeId: string
    fontPairing: string
    fontPairingId: string
    // Legacy fields kept for backward compat
    navbarStyle?: string
    featuredStyle?: string
    footerStyle?: string
}

const STYLE_METADATA: Record<string, Record<string, { label: string, description: string, previewUrl?: string }>> = {
    heroStyle: {
        'A': { label: 'Split Modern', description: 'Dynamic split with text left and visual focus right.' },
        'B': { label: 'Fullscreen', description: 'Immersive background with elegant centered typography.' },
        'C': { label: 'Carousel', description: 'Narrative-driven slides with intuitive navigation.' },
        'D': { label: 'Agency Dark', description: 'Bold services-first list with a sophisticated dark theme.' },
        'E': { label: 'Visual Narrative', description: 'Modern, layered composition with floating elements.' },
        'F': { label: 'Luxury Elegant', description: 'Minimalist high-end layout with refined spacing.' },
        'G': { label: 'First Class', description: 'Cinematic luxury with ornate gold accents and motion.' },
        'H': { label: 'Nexus Forge', description: 'Deep cinematic impact with high-contrast typography.' },
        'I': { label: 'Meridian Strategy', description: 'Refined editorial luxury with warm tones.' },
        'J': { label: 'Atelier Creative', description: 'Immersive cinematic studio aesthetic with bold focus.' }
    },
    aboutStyle: {
        'A': { label: 'Gallery Split', description: 'Balanced layout with integrated mini-gallery.' },
        'B': { label: 'Minimal Italic', description: 'Typographic focus with decorative serif accents.' },
        'C': { label: 'Tags Card', description: 'Structured information cards for quick readability.' },
        'D': { label: 'Corporate Quote', description: 'Trust-focused layout with brand carousel.' },
        'E': { label: 'Immersive DNA', description: 'Deep storytelling with parallax backgrounds.' },
        'F': { label: 'Luxury Story', description: 'Magazine-style layout with elegant editorial feel.' },
        'G': { label: 'Michelin Star', description: 'Asymmetric luxury with executive chef signatures.' },
        'H': { label: 'Nexus Forge', description: 'Deep cinematic impact with high-contrast typography.' },
        'I': { label: 'Meridian Strategic', description: 'Refined editorial luxury with warm tones.' },
        'J': { label: 'Atelier Identities', description: 'Immersive cinematic studio aesthetic with bold focus.' }
    },
    servicesStyle: {
        'A': { label: 'Accordion', description: 'Interactive expandable lists with contextual imagery.' },
        'B': { label: 'Numbered Grid', description: 'Sequential minimal grid for process-driven services.' },
        'C': { label: 'Action Cards', description: 'Clickable feature cards with subtle hover effects.' },
        'D': { label: 'Stats Focus', description: 'Data-driven layout with social proof integration.' },
        'E': { label: 'Capabilities Mosaic', description: 'Asymmetric grid for a creative, modern display.' },
        'F': { label: 'Luxury Mosaic', description: 'Refined grid with premium hover states and spacing.' },
        'G': { label: 'Curated Menu', description: 'Sophisticated dark menu with numbered experiences.' },
        'H': { label: 'Nexus Forge', description: 'Deep cinematic impact with high-contrast typography.' },
        'I': { label: 'Meridian Specialties', description: 'Refined editorial luxury with warm tones.' },
        'J': { label: 'Atelier Mastercraft', description: 'Immersive cinematic studio aesthetic with bold focus.' }
    },
    galleryStyle: {
        'A': { label: 'Scroll Reveal', description: 'Smooth entrance animations on scroll.' },
        'B': { label: 'Stack Deck', description: 'Layered horizontal scroll for compact navigation.' },
        'C': { label: 'Fixed Grid', description: 'Standard high-visibility image grid.' },
        'D': { label: 'Staggered Masonry', description: 'Creative vertical flow for diverse asset sizes.' },
        'E': { label: 'Fluid Mosaic', description: 'Edge-to-edge immersive experience.' },
        'F': { label: 'Luxury Showcase', description: 'Premium focus on single items with elegant framing.' },
        'G': { label: 'Epicurean Tour', description: 'High-contrast immersion with immersive vignettes.' },
        'H': { label: 'Nexus Forge', description: 'Deep cinematic impact with high-contrast typography.' },
        'I': { label: 'Meridian Portfolio', description: 'Refined editorial luxury with warm tones.' },
        'J': { label: 'Atelier Work', description: 'Immersive cinematic studio aesthetic with bold focus.' }
    },
    contactStyle: {
        'A': { label: 'Grid Dark', description: 'High-contrast footer with structured contact info.' },
        'B': { label: 'Artisan Light', description: 'Clean, airy layout with soft shadows and focus.' },
        'C': { label: 'Bold CTA', description: 'Loud, center-aligned call to action section.' },
        'D': { label: 'Marquee Rows', description: 'Dynamic moving visuals with overlayed info.' },
        'E': { label: 'Glass Tiles', description: 'Premium interactive tiles with blur effects.' },
        'F': { label: 'Luxury Concierge', description: 'The peak of refined contact experiences.' },
        'G': { label: 'Reserve Elite', description: 'Prestigious brand sign-off with gold brand detailing.' },
        'H': { label: 'Nexus Forge', description: 'Deep cinematic impact with high-contrast typography.' },
        'I': { label: 'Meridian Concierge', description: 'Refined editorial luxury with warm tones.' },
        'J': { label: 'Atelier Studio', description: 'Immersive cinematic studio aesthetic with bold focus.' }
    }
}

const StylePreviewBadge = ({ style, type, colorScheme = 'blue' }: { style: string, type: string, colorScheme?: string }) => {
    // Dynamic colors based on scheme
    const themeColors: Record<string, string> = {
        'blue': 'bg-blue-600',
        'green': 'bg-emerald-600',
        'purple': 'bg-indigo-600',
        'orange': 'bg-orange-600',
        'dark': 'bg-gray-900',
        'pink': 'bg-pink-600',
        'brown': 'bg-amber-800',
        'red': 'bg-red-600',
        'yellow': 'bg-yellow-500',
        'maroon': 'bg-rose-900',
        'black': 'bg-black',
        'gold': 'bg-amber-600',
        'auto': 'bg-blue-600'
    }
    const color = themeColors[colorScheme] || themeColors.blue

    // Generate a mini-schematic based on the style
    const renderSchematic = () => {
        switch (style) {
            case 'A': // Split / Grid
                return (
                    <div className="flex gap-1.5 h-full w-full">
                        <div className="w-1/2 bg-gray-50 rounded p-1 space-y-1 overflow-hidden">
                            <div className={`h-1.5 w-full ${color} opacity-40 rounded-full`} />
                            <div className="h-1 w-3/4 bg-gray-200 rounded-full" />
                            <div className="h-1 w-2/3 bg-gray-100 rounded-full" />
                            <div className={`h-2 w-1/2 ${color} opacity-80 rounded-sm mt-1`} />
                        </div>
                        <div className="w-1/2 bg-gray-100/50 rounded flex items-center justify-center p-1">
                            <Box className="w-4 h-4 text-gray-300" strokeWidth={1} />
                        </div>
                    </div>
                )
            case 'B': // Full / Minimal
                return (
                    <div className="relative h-full w-full bg-gray-50 rounded overflow-hidden flex items-center justify-center">
                        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-gray-900 via-gray-400 to-transparent" />
                        <div className="z-10 flex flex-col items-center gap-1 w-full p-2">
                            <div className={`h-1.5 w-1/2 ${color} opacity-90 rounded-full`} />
                            <div className="h-1 w-2/3 bg-gray-300 rounded-full" />
                            <div className={`h-2.5 w-1/3 ${color} rounded-sm mt-1`} />
                        </div>
                    </div>
                )
            case 'C': // Carousel / Cards
                return (
                    <div className="h-full w-full flex flex-col gap-1.5 p-1 bg-gray-50 rounded">
                        <div className="flex gap-1 flex-1">
                            <div className="w-1/3 bg-gray-100 rounded-sm" />
                            <div className={`w-1/3 ${color} opacity-20 border border-gray-200 rounded-sm`} />
                            <div className="w-1/3 bg-gray-100 rounded-sm" />
                        </div>
                        <div className="flex justify-center gap-1 pb-0.5">
                            <div className={`w-1.5 h-1.5 rounded-full ${color}`} />
                            <div className="w-1.5 h-1.5 rounded-full bg-gray-200" />
                            <div className="w-1.5 h-1.5 rounded-full bg-gray-200" />
                        </div>
                    </div>
                )
            case 'D': // Dark / List
                return (
                    <div className="h-full w-full bg-gray-900 rounded p-2 flex flex-col gap-1.5">
                        <div className={`h-1.5 w-1/2 ${color} opacity-50 rounded-full`} />
                        <div className="flex gap-2 items-center">
                           <div className="w-2 h-2 rounded-full border border-gray-700 shrink-0" />
                           <div className="h-1 w-full bg-gray-700 rounded-full" />
                        </div>
                        <div className="flex gap-2 items-center">
                           <div className={`w-2 h-2 rounded-full border ${color} opacity-40 shrink-0`} />
                           <div className="h-1 w-3/4 bg-gray-700 rounded-full" />
                        </div>
                    </div>
                )
            case 'E': // Mosaic / Fluid
                return (
                    <div className="grid grid-cols-3 grid-rows-2 gap-1 h-full w-full p-1 bg-gray-50 rounded">
                        <div className={`col-span-2 bg-gray-100 rounded-sm border border-gray-100`} />
                        <div className={`${color} opacity-40 rounded-sm`} />
                        <div className="bg-gray-100 rounded-sm" />
                        <div className={`col-span-2 ${color} opacity-10 border border-gray-200 rounded-sm`} />
                    </div>
                )
            case 'G': // First Class / Fine Dining
                return (
                    <div className="h-full w-full bg-[#050505] rounded overflow-hidden flex flex-col items-center justify-center p-2 relative border border-amber-900/40">
                        <div className="absolute top-1 left-1 w-2 h-2 border-t border-l border-amber-500/50" />
                        <div className="absolute top-1 right-1 w-2 h-2 border-t border-r border-amber-500/50" />
                        <div className="absolute bottom-1 left-1 w-2 h-2 border-b border-l border-amber-500/50" />
                        <div className="absolute bottom-1 right-1 w-2 h-2 border-b border-r border-amber-500/50" />
                        <div className="z-10 flex flex-col items-center gap-1.5 w-full">
                            <div className="w-6 h-[0.5px] bg-amber-500/30" />
                            <div className={`h-1 w-3/4 bg-white opacity-90 rounded-full`} />
                            <div className="h-0.5 w-1/2 bg-white/30 rounded-full" />
                            <div className={`h-1.5 w-1/3 bg-amber-500/80 rounded-sm mt-0.5`} />
                            <div className="w-6 h-[0.5px] bg-amber-500/30" />
                        </div>
                    </div>
                )
            case 'I': // Meridian Strategy / Warm editorial
                return (
                    <div className="h-full w-full bg-[#f2ede4] rounded overflow-hidden flex flex-col gap-1 p-2 relative">
                        <div className="w-1/2 h-full bg-[#d9d4cc] rounded-lg p-1.5 space-y-1">
                            <div className="h-1 w-full bg-[#e38c6d] opacity-80 rounded-full" />
                            <div className="h-2 w-full bg-black opacity-10 rounded-sm" />
                            <div className="h-1.5 w-3/4 bg-black opacity-5 rounded-full" />
                        </div>
                        <div className="absolute right-2 bottom-2 w-1/3 h-2/3 bg-[#d9d4cc] rounded border-2 border-[#f2ede4] shadow-sm" />
                    </div>
                )
            case 'J': // Atelier Creative / Studio dark
                return (
                    <div className="h-full w-full bg-gray-900 rounded overflow-hidden flex flex-col items-center justify-center p-2 relative border border-gray-800">
                        <div className="absolute inset-0 bg-gradient-to-t from-black to-transparent opacity-60" />
                        <div className="z-10 flex flex-col items-center gap-1 w-full scale-90">
                           <div className="h-0.5 w-4 bg-white/20 rounded-full" />
                           <div className="h-3 w-1/2 bg-white opacity-90 rounded-sm" />
                           <div className="h-1.5 w-3/4 bg-white/30 rounded-full mt-1" />
                           <div className={`h-2.5 w-1/3 border border-white/40 rounded-full mt-1.5`} />
                        </div>
                    </div>
                )
            default: return <div className="bg-gray-50 h-full w-full rounded" />
        }
    }

    return (
        <div className="w-full h-24 mb-1.5 bg-white border border-gray-100 rounded-lg p-1.5 shadow-sm group-hover:border-blue-200 group-hover:shadow transition-all group-hover:scale-[1.02] duration-200 overflow-hidden ring-offset-2 group-active:scale-[0.98]">
            {renderSchematic()}
        </div>
    )
}

interface ContentEditorProps {
    initialCustomizations?: Partial<EditorCustomizations>
    onUpdate: (customizations: EditorCustomizations) => void
    disabled?: boolean
}

export default function ContentEditor({ initialCustomizations, onUpdate, disabled }: ContentEditorProps) {
    const [customizations, setCustomizations] = useState<EditorCustomizations>({
        heroStyle: initialCustomizations?.heroStyle || 'A',
        aboutStyle: initialCustomizations?.aboutStyle || 'A',
        servicesStyle: initialCustomizations?.servicesStyle || 'A',
        galleryStyle: initialCustomizations?.galleryStyle || initialCustomizations?.featuredStyle || 'A',
        contactStyle: initialCustomizations?.contactStyle || initialCustomizations?.footerStyle || 'A',
        colorScheme: initialCustomizations?.colorSchemeId || 'auto',
        colorSchemeId: initialCustomizations?.colorSchemeId || 'auto',
        fontPairing: initialCustomizations?.fontPairingId || 'modern',
        fontPairingId: initialCustomizations?.fontPairingId || 'modern'
    })

    const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['category', 'layout']))
    const [hasChanges, setHasChanges] = useState(false)

    const updateField = (field: keyof EditorCustomizations, value: string) => {
        setCustomizations(prev => {
            const next = { ...prev, [field]: value }
            // Sync IDs
            if (field === 'colorScheme') next.colorSchemeId = value
            if (field === 'fontPairing') next.fontPairingId = value
            return next
        })
        setHasChanges(true)
    }

    /**
     * Set a SINGLE section to a specific variant.
     * Used by individual variant cards inside an expanded category panel.
     */
    const setSectionVariant = (sectionId: SectionId, variantKey: string) => {
        const field = SECTION_FIELD_MAP[sectionId]
        updateField(field, variantKey)
    }

    /**
     * Detect which category any given section is currently using.
     * Returns first letter if section uses a category style (e.g. "K1" → "K"), else null.
     */
    const getCategoryFromStyle = (styleKey: string): string | null => {
        if (!styleKey) return null
        const first = styleKey.charAt(0)
        return ['K', 'L', 'M', 'N', 'O'].includes(first) ? first : null
    }

    /**
     * Detect which category is "dominantly" selected — if all 5 sections
     * use the same category letter, return that. Otherwise null.
     */
    const activeCategoryKey = useMemo(() => {
        const cats = [
            getCategoryFromStyle(customizations.heroStyle),
            getCategoryFromStyle(customizations.aboutStyle),
            getCategoryFromStyle(customizations.servicesStyle),
            getCategoryFromStyle(customizations.galleryStyle),
            getCategoryFromStyle(customizations.contactStyle),
        ]
        const allSame = cats.every(c => c === cats[0]) && cats[0] !== null
        return allSame ? cats[0] : null
    }, [customizations])

    const handleSave = () => {
        onUpdate(customizations)
        setHasChanges(false)
    }

    const toggleSection = (section: string) => {
        setExpandedSections(prev => {
            const newSet = new Set(prev)
            if (newSet.has(section)) {
                newSet.delete(section)
            } else {
                newSet.add(section)
            }
            return newSet
        })
    }

    return (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden h-full flex flex-col">
            <div className="p-4 border-b border-gray-200 bg-gray-50">
                <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                    <Box className="w-4 h-4" />
                    Content Editor
                </h3>
            </div>

            <div className="overflow-y-auto flex-1 p-4 space-y-4">
                {/* Category panels — each at top level, peer of Default Styles */}
                {CATEGORY_STYLES.map((cat) => {
                    const isActiveCat = activeCategoryKey === cat.key
                    const sectionKey = `cat-${cat.key}`
                    const isExpanded = expandedSections.has(sectionKey)
                    return (
                        <div
                            key={cat.key}
                            className={`border rounded-lg overflow-hidden transition-colors ${
                                isActiveCat ? 'border-emerald-400' : 'border-gray-200'
                            }`}
                        >
                            {/* Category header */}
                            <button
                                type="button"
                                onClick={() => toggleSection(sectionKey)}
                                className={`w-full flex items-center gap-3 p-3 text-left transition-colors ${
                                    isActiveCat ? 'bg-emerald-50' : 'bg-gray-50 hover:bg-gray-100'
                                }`}
                            >
                                <span className="text-xl shrink-0 leading-none">{cat.emoji}</span>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className="font-medium text-gray-900">{cat.label}</span>
                                        {isActiveCat && (
                                            <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-100 rounded-full px-1.5 py-0.5">
                                                Active
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-[11px] text-gray-500 truncate">{cat.tagline}</p>
                                </div>
                                {/* Mini palette swatches */}
                                <div className="flex gap-1 shrink-0">
                                    <span className="w-2.5 h-2.5 rounded-full border border-black/5" style={{ backgroundColor: cat.palette.bg }} />
                                    <span className="w-2.5 h-2.5 rounded-full border border-black/5" style={{ backgroundColor: cat.palette.primary }} />
                                    <span className="w-2.5 h-2.5 rounded-full border border-black/5" style={{ backgroundColor: cat.palette.accent }} />
                                    <span className="w-2.5 h-2.5 rounded-full border border-black/5" style={{ backgroundColor: cat.palette.text }} />
                                </div>
                                {isExpanded
                                    ? <ChevronUp className="w-4 h-4 text-gray-400 shrink-0" />
                                    : <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
                                }
                            </button>

                            {/* Expanded — 5 section variant pickers */}
                            {isExpanded && (
                                <div className="p-4 bg-white space-y-6">
                                    {(Object.keys(cat.sections) as SectionId[]).map((sectionId) => {
                                        const variants = cat.sections[sectionId]
                                        const currentValue = customizations[SECTION_FIELD_MAP[sectionId]]
                                        const sectionMeta = SECTION_LABELS[sectionId]
                                        return (
                                            <div key={sectionId} className="space-y-3">
                                                <div className="flex items-center justify-between">
                                                    <label className="text-xs font-black text-gray-400 uppercase tracking-[0.15em]">
                                                        {sectionMeta.label}
                                                    </label>
                                                    <span className="text-[10px] font-bold text-gray-300 uppercase tracking-tighter">
                                                        {sectionMeta.sub}
                                                    </span>
                                                </div>

                                                {/* 2-col grid of variant cards — matches Default Styles density */}
                                                <div className="grid grid-cols-2 gap-3">
                                                    {variants.map((v) => {
                                                        const isSelected = currentValue === v.key
                                                        const isAvailable = v.status === 'available'
                                                        return (
                                                            <button
                                                                key={v.key}
                                                                type="button"
                                                                disabled={!isAvailable}
                                                                onClick={() => isAvailable && setSectionVariant(sectionId, v.key)}
                                                                className={`
                                                                    group relative flex flex-col p-2.5 rounded-2xl border transition-all text-left
                                                                    ${isSelected
                                                                        ? 'bg-emerald-50/50 border-emerald-300 ring-2 ring-emerald-50 ring-offset-0'
                                                                        : isAvailable
                                                                            ? 'bg-white border-gray-100 hover:border-gray-300 hover:bg-gray-50 hover:shadow-md'
                                                                            : 'bg-gray-50 border-gray-100 opacity-60 cursor-not-allowed'}
                                                                `}
                                                            >
                                                                {/* Mini schematic preview */}
                                                                <div className="w-full mb-1.5 rounded-lg overflow-hidden border border-gray-100 shadow-sm bg-white">
                                                                    <VariantPreview sectionId={sectionId} variantKey={v.key} palette={cat.palette} />
                                                                </div>

                                                                {/* Label */}
                                                                <div className="flex-1 min-w-0 px-0.5">
                                                                    <div className="flex items-center gap-1.5">
                                                                        <span className={`text-[10px] font-black uppercase tracking-tight truncate ${
                                                                            isSelected ? 'text-emerald-700' : isAvailable ? 'text-gray-900' : 'text-gray-400'
                                                                        }`}>
                                                                            {v.label}
                                                                        </span>
                                                                        {isSelected && (
                                                                            <div className="w-3 h-3 bg-emerald-500 rounded-full flex items-center justify-center shrink-0">
                                                                                <Check size={7} className="text-white" strokeWidth={4} />
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                    <div className="flex items-center gap-1.5 mt-0.5">
                                                                        <p className="text-[9px] text-gray-400 font-bold leading-tight uppercase">
                                                                            Style {v.key}
                                                                        </p>
                                                                        {!isAvailable && (
                                                                            <span className="text-[7px] font-bold uppercase tracking-widest text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-1.5 py-0">
                                                                                Soon
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                </div>

                                                                {/* Active border overlay */}
                                                                {isSelected && (
                                                                    <motion.div
                                                                        layoutId={`variant-selected-${sectionId}`}
                                                                        className="absolute inset-0 border-2 border-emerald-500 rounded-2xl pointer-events-none z-20"
                                                                        transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                                                                    />
                                                                )}
                                                            </button>
                                                        )
                                                    })}
                                                </div>

                                                <div className="h-px bg-gray-50 !mt-5" />
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                    )
                })}

                {/* Default Styles — per-section A-J picker */}
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <button
                        onClick={() => toggleSection('layout')}
                        className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
                    >
                        <div className="flex items-center gap-2 font-medium text-gray-700">
                            <Layers className="w-4 h-4" />
                            <span>Default Styles</span>
                        </div>
                        {expandedSections.has('layout') ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>

                    {expandedSections.has('layout') && (
                        <div className="p-4 space-y-6 bg-white">
                            {[
                                { id: 'heroStyle', label: 'Hero Section', sub: 'Top Banner' },
                                { id: 'aboutStyle', label: 'About Section', sub: 'Story & Mission' },
                                { id: 'servicesStyle', label: 'Services Section', sub: 'What We Do' },
                                { id: 'galleryStyle', label: 'Gallery Section', sub: 'Visual Portfolio' },
                                { id: 'contactStyle', label: 'Contact Section', sub: 'Conversion Point' },
                            ].map((section) => (
                                <div key={section.id} className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <label className="text-xs font-black text-gray-400 uppercase tracking-[0.15em]">
                                            {section.label}
                                        </label>
                                        <span className="text-[10px] font-bold text-gray-300 uppercase tracking-tighter">
                                            {section.sub}
                                        </span>
                                    </div>
                                    
                                    <div className="grid grid-cols-2 gap-3">
                                        {(Object.entries(STYLE_METADATA[section.id])).map(([key, meta]) => (
                                            <button
                                                key={key}
                                                onClick={() => updateField(section.id as any, key)}
                                                className={`
                                                    group relative flex flex-col p-2.5 rounded-2xl border transition-all text-left
                                                    ${customizations[section.id as keyof EditorCustomizations] === key 
                                                        ? 'bg-blue-50/50 border-blue-200 ring-2 ring-blue-50 ring-offset-0' 
                                                        : 'bg-white border-gray-100 hover:border-gray-300 hover:bg-gray-50 hover:shadow-md'}
                                                `}
                                            >
                                                <StylePreviewBadge style={key} type={section.id} colorScheme={customizations.colorSchemeId} />
                                                <div className="flex-1 min-w-0 px-0.5">
                                                    <div className="flex items-center gap-1.5">
                                                        <span className={`text-[10px] font-black uppercase tracking-tight ${customizations[section.id as keyof EditorCustomizations] === key ? 'text-blue-700' : 'text-gray-900'}`}>
                                                            {meta.label}
                                                        </span>
                                                        {customizations[section.id as keyof EditorCustomizations] === key && (
                                                            <div className="w-3 h-3 bg-blue-500 rounded-full flex items-center justify-center shrink-0">
                                                                <Check size={7} className="text-white" strokeWidth={4} />
                                                            </div>
                                                        )}
                                                    </div>
                                                    <p className="text-[9px] text-gray-400 font-bold leading-tight mt-0.5 line-clamp-1 uppercase">
                                                        Style {key}
                                                    </p>
                                                </div>
                                                
                                                {/* Selection Overlay */}
                                                {customizations[section.id as keyof EditorCustomizations] === key && (
                                                    <motion.div 
                                                        layoutId={`selected-${section.id}`}
                                                        className="absolute inset-0 border-2 border-blue-500 rounded-2xl pointer-events-none z-20"
                                                        transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                                                    />
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                    
                                    <div className="h-px bg-gray-50 !mt-6" />
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Appearance Section */}
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <button
                        onClick={() => toggleSection('appearance')}
                        className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
                    >
                        <div className="flex items-center gap-2 font-medium text-gray-700">
                            <Palette className="w-4 h-4" />
                            <span>Appearance</span>
                        </div>
                        {expandedSections.has('appearance') ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>

                    {expandedSections.has('appearance') && (
                        <div className="p-4 space-y-4 bg-white">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                                    <Palette className="w-4 h-4" />
                                    Color Scheme
                                </label>
                                <select
                                    value={customizations.colorSchemeId}
                                    onChange={(e) => updateField('colorScheme', e.target.value)}
                                    disabled={disabled}
                                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm py-2 px-3"
                                >
                                    <option value="auto">Auto (from photos)</option>
                                    <option value="blue">Blue Professional</option>
                                    <option value="green">Green Fresh</option>
                                    <option value="purple">Purple Creative</option>
                                    <option value="orange">Orange Energetic</option>
                                    <option value="dark">Dark Elegant</option>
                                    <option value="pink">Pink Vibrant</option>
                                    <option value="brown">Brown Natural</option>
                                    <option value="red">Red Intense</option>
                                    <option value="yellow">Yellow Bright</option>
                                    <option value="maroon">Maroon Rich</option>
                                    <option value="black">Black Monochrome</option>
                                    <option value="gold">Gold Premium</option>
                                </select>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                                    <Type className="w-4 h-4" />
                                    Typography
                                </label>
                                <select
                                    value={customizations.fontPairingId}
                                    onChange={(e) => updateField('fontPairing', e.target.value)}
                                    disabled={disabled}
                                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm py-2 px-3"
                                >
                                    <option value="modern">Modern (Default)</option>
                                    <option value="classic">Classic Serif</option>
                                    <option value="elegant">Elegant Display</option>
                                    <option value="bold">Bold & Loud</option>
                                    <option value="minimal">Minimal Sans</option>
                                    <option value="professional">Professional Sans</option>
                                    <option value="creative">Creative Bold</option>
                                    <option value="tech">Tech Mono</option>
                                    <option value="friendly">Friendly Rounded</option>
                                    <option value="luxury">Luxury Serif</option>
                                    <option value="gourmet">Gourmet Elegant</option>
                                </select>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div className="p-4 bg-gray-50 border-t border-gray-200">
                <button
                    onClick={handleSave}
                    disabled={disabled || !hasChanges}
                    className={`w-full flex items-center justify-center gap-2 py-2 px-4 rounded-md font-medium text-white transition-colors
                        ${disabled || !hasChanges
                            ? 'bg-gray-400 cursor-not-allowed'
                            : 'bg-[#1F2933] hover:bg-gray-800'
                        }`}
                >
                    <Save className="w-4 h-4" />
                    Save Changes
                </button>
            </div>
        </div>
    )
}
