/**
 * What a creator learns and is tested on before certification (board
 * Certification, steps 2 and 3). The lessons and the questions are the same
 * five topics as before, in the board's wording; question N is about lesson
 * N, which is how the quiz says "From lesson 2: Audio" and how "Review the
 * lessons" opens the first one that was missed.
 *
 * The pass mark and the answers are unchanged: 4 of 5, same correct options.
 */

export type Lesson = {
    title: string;
    /** One line under the title in the list. */
    desc: string;
    tips: string[];
    /** "Before you film": the one thing to do. */
    action: string;
};

export const LESSONS: Lesson[] = [
    {
        title: "Lighting",
        desc: "Face the light source",
        tips: [
            "Turn the owner to face the light. Never film with the light behind them.",
            "Watch for windows and bright backgrounds: they turn people into silhouettes.",
            "Early morning or late afternoon light is the most flattering.",
        ],
        action: "Find the main light first, then turn your subject to face it.",
    },
    {
        title: "Audio",
        desc: "Test your mic first",
        tips: [
            "Test your microphone before the real recording.",
            "Cut background noise: fans and music off, away from the busy street.",
            "Keep the phone within arm’s length of the owner.",
        ],
        action: "Record 10 seconds and play it back before the interview.",
    },
    {
        title: "Portrait",
        desc: "Chest up, eye level",
        tips: [
            "Frame the owner from the chest up: not too close, not too far.",
            "Hold the camera at their eye level.",
            "Keep the face clear: no hat brim over the eyes, nothing in front.",
        ],
        action: "Stand them in good light and frame chest up, at eye level.",
    },
    {
        title: "Interview",
        desc: "Let them tell their story",
        tips: [
            "Chat a little before you press record so they relax.",
            "Open with the origin story: “How did you start this business?”",
            "Speak slowly and give them time to answer. Don’t rush.",
        ],
        action: "Start every interview with how the business began. It is the best story.",
    },
    {
        title: "Requirements",
        desc: "3 required photo types",
        tips: [
            "Portrait of the owner: clear, well lit, chest up, eye level.",
            "The place: storefront, signage, or where the business operates.",
            "The craft: their signature product, a dish, or the service in action.",
        ],
        action: "Every submission needs all 3. Check your photos before you submit.",
    },
];

export type Question = {
    category: string;
    question: string;
    options: string[];
    /** Index into options. */
    correct: number;
};

export const QUIZ: Question[] = [
    {
        category: "Lighting",
        question: "What is the best position for your light source when filming?",
        options: ["Behind the subject", "In front of the subject, facing them", "Directly above", "It doesn’t matter"],
        correct: 1,
    },
    {
        category: "Audio",
        question: "What should you do before starting an interview recording?",
        options: ["Jump right in to save time", "Test your microphone first", "Play background music", "Use the speakerphone"],
        correct: 1,
    },
    {
        category: "Portrait",
        question: "How should you frame the business owner in a portrait shot?",
        options: ["Full body from far away", "Just their face, close up", "Chest up at eye level", "From below, looking up"],
        correct: 2,
    },
    {
        category: "Interview",
        question: "What makes a great opening interview question?",
        options: ["Ask about their revenue", "Ask about their origin story", "Ask yes/no questions only", "Read from a script word for word"],
        correct: 1,
    },
    {
        category: "Requirements",
        question: "Which 3 photo types are required for every submission?",
        options: ["Selfie, food photo, sunset", "Portrait of the owner, business location, craft or product", "Logo, menu, parking lot", "Any 3 photos"],
        correct: 1,
    },
];

/** Right answers needed to pass. Unchanged: 4 of 5. */
export const PASS_MARK = 4;

export const LETTERS = ["A", "B", "C", "D"];
