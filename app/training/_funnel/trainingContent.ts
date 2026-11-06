export interface TrainingPoint { title: string; text: string }
export interface TrainingPhoto { src: string; alt: string; position?: string; label?: string }
export interface TrainingLesson {
    id: number;
    title: string;
    minutes: number;
    summary: string;
    photos: TrainingPhoto[];
    dos: TrainingPoint[];
    donts: TrainingPoint[];
}

export const TRAINING_OVERVIEW_PHOTO: TrainingPhoto = {
    src: "/v2/training/overview.jpg",
    alt: "Field agents learning together with an instructor before visiting their first shops.",
    position: "50% 15%",
};

/** Same five concepts, copy and approved photos as the current mobile lessons. */
export const TRAINING_LESSONS: TrainingLesson[] = [
    {
        id: 1, title: "Good lighting", minutes: 3,
        summary: "Face the owner toward a window or open doorway so their face is clearly lit.",
        photos: [{ src: "/v2/training/good-lighting.jpg", position: "50% 15%", alt: "A field agent photographs a salon owner facing a window, with soft daylight lighting the front of the owner’s face." }],
        dos: [
            { title: "Face the window", text: "Have the owner face the window. Stand between them and the light, slightly to one side." },
            { title: "Check before recording", text: "Record a short clip and check that you can see their face clearly." },
        ],
        donts: [
            { title: "Bright light behind them", text: "A bright window behind the owner can make their face look dark." },
            { title: "Harsh direct sun", text: "Use soft window light or open shade so they do not squint." },
        ],
    },
    {
        id: 2, title: "Clear audio", minutes: 2,
        summary: "Bad sound ruins the video. Test it first.",
        photos: [{ src: "/v2/training/clear-audio.jpg", position: "50% 28%", alt: "A field agent recording a mechanic, with a live camera preview and red recording controls visible on the phone." }],
        dos: [
            { title: "Test first", text: "Record a short clip and play it back." },
            { title: "Phone close", text: "Hold it within arm’s length of the speaker." },
        ],
        donts: [{ title: "Background noise", text: "Turn off fans, TVs and radios. Step away from the road." }],
    },
    {
        id: 3, title: "Photos that sell", minutes: 4,
        summary: "Head and shoulders, centered, at eye level.",
        photos: [{ src: "/v2/training/owner-portrait-banner.jpg", position: "50% 27%", alt: "An eye-level portrait of the Forge Barbers owner, centered with his head and shoulders visible." }],
        dos: [
            { title: "Chest up", text: "Keep the head and shoulders in the frame." },
            { title: "Eye level", text: "Hold the phone at the owner’s eye level." },
        ],
        donts: [
            { title: "Shooting up or down", text: "It changes how they look." },
            { title: "Hats or sunglasses", text: "Ask them to take them off." },
        ],
    },
    {
        id: 4, title: "Get the owner talking", minutes: 3,
        summary: "Their own words become the site. Relax them first.",
        photos: [{ src: "/v2/training/owner-interview.jpg", position: "50% 25%", alt: "A barber talking to a field agent, with a live preview and red recording controls visible on the phone." }],
        dos: [
            { title: "Warm up", text: "Chat for 2 minutes before you press record." },
            { title: "Origin story", text: "Ask how and why they started the business." },
            { title: "Slow down", text: "Remind them to speak slowly and clearly." },
        ],
        donts: [],
    },
    {
        id: 5, title: "The shots we need", minutes: 3,
        summary: "Include an owner portrait, the shop front, and a shot of the work they do.",
        photos: [
            { src: "/v2/training/owner-portrait.jpg", alt: "A clear, chest-up portrait of the owner, with the full head and shoulders in frame.", label: "Portrait" },
            { src: "/v2/training/shop-front.jpg", alt: "The Forge Barbers entrance and shop sign, photographed from across the street.", label: "Shop front" },
            { src: "/v2/training/craft.jpg", alt: "The Forge Barbers owner cutting a customer’s hair, with his hands and tools visible.", label: "Craft" },
        ],
        dos: [
            { title: "The portrait", text: "A clear, well-lit headshot of the owner." },
            { title: "The location", text: "A wide shot of the shop front and signage." },
            { title: "The craft", text: "A working shot, like a barber cutting hair." },
        ],
        donts: [{ title: "Blurry photos", text: "Every photo must be sharp and in focus." }],
    },
];

export function lessonIndexFromQuery(value: string | null): number {
    if (!value?.trim()) return -1;
    const lesson = Number(value);
    return Number.isInteger(lesson) && lesson >= 1 && lesson <= TRAINING_LESSONS.length ? lesson - 1 : -1;
}

export function nextIncompleteLesson(done: readonly boolean[], completedIndex: number): number {
    return done.findIndex((isDone, index) => !isDone && index !== completedIndex);
}
