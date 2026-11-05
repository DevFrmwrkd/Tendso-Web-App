import type { KnowledgeGuide } from './types';

export const fieldAgentGuides: KnowledgeGuide[] = [
    // Sources: apps/mobile/components/field-agent/FieldAgentMap.tsx;
    // apps/mobile/components/field-agent/CommunityFinds.tsx;
    // apps/mobile/services/fieldAgentFinds.ts; apps/mobile/app/(app)/leads/spot.tsx.
    {
        slug: 'field-agent-map-and-community-finds',
        title: 'Using Map, Community finds and Spot a shop',
        summary: 'Find shops in the visible map area, adjust Near me, and distinguish a shared find from a website submission.',
        paragraphs: [
            'Map shows shops in the area currently in view. Pan or zoom to change that area, then let the results refresh. Zooming out can show more shops, subject to the results limit. Needs website and Yours narrow the visible results. Distances use your current location or selected work area; check the area label before comparing them.',
            'Drag the Shops in view handle up for the full nearby list or down to minimize it. Tap a shop or map pin for details. Route opens directions in a mapping app; it is not turn-by-turn navigation inside Tendso. See list opens Community finds.',
            'In Finds, use Near me and choose a search range of 1, 3, 5, 10 or 25 km. Near me needs shop coordinates and either your location or a saved work area. All finds can also include shops without coordinates. Search and category filters can further narrow the results.',
            'Spot a shop creates a shared community find, not a completed website submission. Add a clear shop photo, name, kind and exact map pin, then tap Save find. You can tap or drag the map pin, or use your location while at the shop. A find helps the team discover a business; use Start interview when available to begin the separate capture flow.',
        ],
        keywords: ['map', 'shops in view', 'zoom', 'near me', 'range', 'radius', 'community finds', 'spot a shop', 'map pin', 'route'],
        audiences: ['field_agent'], visibility: 'internal', workspace: 'wiki',
        categorySlug: 'prospecting', categoryTitle: 'Prospecting & Leads',
    },

    // Sources: apps/mobile/app/(app)/submit/index.tsx;
    // apps/mobile/services/captureResume.ts; apps/mobile/services/captureSession.ts;
    // apps/mobile/app/(app)/submit/info.tsx; apps/mobile/app/(app)/submit/review.tsx.
    {
        slug: 'field-agent-resume-saved-capture',
        title: 'Continue a saved shop capture',
        summary: 'Resume your own unfinished capture on the same phone without creating a second submission.',
        paragraphs: [
            'Reopen Submit with the same field-agent account on the same phone. The app checks your saved capture and opens the step that needs attention. Depending on what is saved, that may be shop details, photos, interview, design or the final review. Unsaved photo or interview changes and a required photo review can take priority over the last screen you visited.',
            'The capture cache belongs to your account. Local photos, recordings and pending changes are saved on this phone; do not assume an unfinished field-agent capture will resume on another device. Wait for media to finish saving or uploading before leaving a step.',
            'If the app asks about an unfinished interview for another business, continue that work or deliberately choose the offered discard option. Do not start a second capture just to get past a loading or upload error. When a saved capture cannot open, try again or open View submissions to check the existing record.',
            'When offline, available local draft steps can be saved. If final review offers Save and queue, it queues the capture to send after reconnecting; it is not confirmation that the team has received it. Reconnect and check the submission status. A record already sent for review cannot be reopened as an editable draft unless it is rejected.',
        ],
        keywords: ['saved capture', 'resume draft', 'continue submission', 'closed app', 'offline', 'save and queue', 'unfinished interview', 'same phone'],
        audiences: ['field_agent'], visibility: 'internal', workspace: 'wiki',
        categorySlug: 'field-troubleshooting', categoryTitle: 'Troubleshooting',
    },

    // Sources: apps/mobile/app/(app)/submit/info.tsx;
    // apps/mobile/app/(app)/submit/photos.tsx; apps/mobile/services/capturePhotoReview.ts;
    // apps/mobile/services/captureDesign.ts; apps/mobile/app/(app)/submit/design.tsx;
    // apps/mobile/app/(app)/submit/review.tsx.
    {
        slug: 'field-agent-change-business-type',
        title: 'Changing business type after taking photos',
        summary: 'Keep suitable media, review the new shot suggestions, and choose a design for the corrected business type.',
        paragraphs: [
            'Correct Business type in the shop details when the selected category is wrong. Changing it does not automatically delete the saved photos or interview. If photos are already attached, the app records that they need another review for the corrected business type.',
            'Open Photos and read the Review photos banner. Shot suggestions change with the business type. Keep photos that really show this business, add missing views, and retake, replace or remove unsuitable images. A photo from the earlier category can still be useful if it genuinely belongs to this shop.',
            'Check I reviewed these photos for the current business type, then save the reviewed photos. This confirmation is required before sending. Changing the type again requires another review; closing and reopening the app does not skip it.',
            'Review Website design as well. The picker recommends designs for the current business type, and a saved design for another trade must be replaced before sending. Keep an interview that still describes the correct business; use Edit interview if the recording itself is wrong. A category change does not rewrite the owner’s words.',
        ],
        keywords: ['business type', 'wrong category', 'law office', 'auto shop', 'photo review', 'reviewed photos', 'wrong design', 'change design', 'keep interview'],
        audiences: ['field_agent'], visibility: 'internal', workspace: 'wiki',
        categorySlug: 'interview-capture', categoryTitle: 'Interview & Capture',
    },

    // Corrects the legacy fixed-count title without changing its saved slug.
    // Sources: apps/mobile/lib/v2/captureContent.ts;
    // apps/mobile/app/(app)/submit/photos.tsx;
    // apps/mobile/components/field-agent/CapturePhotoGrid.tsx;
    // apps/mobile/components/field-agent/CapturePhotoPager.tsx.
    {
        slug: 'the-12-shot-list',
        title: 'Choose and manage your shop photos',
        summary: 'Use business-specific suggestions, descriptive labels and the photo viewer to keep 3–10 useful images.',
        paragraphs: [
            'The current field-agent capture accepts 3–10 photos, not a mandatory 12-shot set. Suggestions depend on the business type and are optional. Choose clear, well-lit images that show the real shop, its owner, work, products or services. Suggested shots and extra photos share the same 10-photo limit.',
            'Your photos shows a label for each image. Use its options menu and Edit label to describe what it actually shows; the label does not have to be a generic Photo 1 name. Labels help identify the image you want to change, especially after correcting the business type.',
            'Tap a thumbnail to open the full-screen viewer. Swipe left or right, or use Previous photo and Next photo. Retake uses the camera to replace the selected image; Replace chooses an image from the phone’s library. These actions also remain available from the photo’s options menu.',
            'To remove several images, tap Select, mark the photos or choose Select all, then use the remove action and confirm. Removal applies to this capture. Keep at least three usable images before continuing. If a saved image is unavailable, retake, replace or remove it before moving on; reopening its preview cannot restore a missing local file.',
        ],
        keywords: ['photo checklist', 'shot list', '3 photos', '10 photos', 'labels', 'edit label', 'select photos', 'remove photos', 'swipe', 'retake', 'replace'],
        audiences: ['field_agent'], visibility: 'internal', workspace: 'wiki',
        categorySlug: 'interview-capture', categoryTitle: 'Interview & Capture',
    },

    // Expands the existing role guide rather than creating a second resend article.
    // Sources: apps/mobile/app/(app)/submissions/[id].tsx;
    // apps/mobile/services/captureEdit.ts; apps/mobile/services/captureResume.ts;
    // apps/mobile/app/(app)/submit/review.tsx; apps/mobile/app/(app)/submit/info.tsx;
    // apps/mobile/app/(app)/submit/photos.tsx; apps/mobile/app/(app)/submit/interview.tsx.
    {
        slug: 'field-agent-review-and-resend',
        title: 'Fix and resend a rejected shop submission',
        summary: 'Repair the existing capture using its review note, keeping the correct details and media.',
        paragraphs: [
            'Open the rejected record in your submissions and choose Edit and resend. This reopens the same shop capture for correction; do not create a new submission for the same rejected work. Only your own draft or rejected capture is editable in this flow.',
            'Read What needs fixing on the Fix it, then resend screen. Use the relevant edit action for shop details, photos, interview or website design. Saved content is kept, so change only what the review note requires. A business-type correction also requires reviewing the retained photos and choosing a matching design.',
            'Save each correction and return to the final review. Confirm the owner contact, photos, interview, design, website address and price, then choose Resend for review and confirm. Editing alone does not resend the record; it remains rejected until the resend succeeds. If sending fails, the app keeps the capture so you can retry.',
            'A rejected shop submission is different from rejection of your field-agent profile. For an account name, phone or photo correction, use the profile review screen. A saved certification quiz pass is retained; the separate certification guide explains that process.',
        ],
        keywords: ['rejected shop', 'rejected submission', 'edit and resend', 'resend for review', 'review note', 'fix capture', 'keep photos', 'profile rejection'],
        audiences: ['field_agent'], visibility: 'authenticated', workspace: 'help',
        categorySlug: 'field-agent-help', categoryTitle: 'Field Agent Help',
    },

    // Makes certification guidance readable before the certified-only wiki gate.
    // Sources: apps/mobile/app/(app)/training.tsx;
    // apps/mobile/app/(app)/training-lessons.tsx;
    // apps/mobile/app/(app)/certification-quiz.tsx;
    // apps/mobile/app/(app)/verification-rejected.tsx;
    // apps/mobile/app/(app)/edit-profile.tsx; apps/mobile/services/fieldAgentFinds.ts.
    {
        slug: 'certification-quiz',
        title: 'Training, certification and profile corrections',
        summary: 'Complete the lessons, pass the quiz and keep that pass when your profile needs a correction.',
        paragraphs: [
            'Start from Training. There are five lessons; tap a lesson to open it, or use the main button to continue the next unfinished lesson. After completing the lessons, take the five-question certification quiz. Four correct answers are needed to pass. If you do not pass, review the lessons and try the quiz again.',
            'After passing, choose Submit for review. A quiz pass is not the same as team approval. Your profile waits for review, and the certificate is available after approval. Map, Finds and shop capture require the approved field-agent account; the app routes incomplete or pending accounts to their next setup step.',
            'If the team rejects your profile, read the review note and choose Edit profile or the relevant Edit action. Correct the name, mobile number or photo as requested, then choose Resubmit for review. When a quiz pass is already saved, it is kept and you do not need to repeat training for a profile correction.',
            'An older rejected account without a recorded quiz pass may instead show Finish certification. Follow that option to complete the missing training and quiz. Profile review and shop submission review are separate: fixing one does not replace the other.',
        ],
        keywords: ['training', 'lessons', 'certification', 'quiz', '4 of 5', 'pending approval', 'rejected profile', 'saved quiz pass', 'resubmit profile'],
        audiences: ['field_agent'], visibility: 'authenticated', workspace: 'help',
        categorySlug: 'field-agent-help', categoryTitle: 'Field Agent Help',
    },

    // Sources: apps/mobile/app/(app)/(tabs)/wallet.tsx;
    // apps/mobile/components/wallet/WalletActivity.tsx.
    // Complements how-wise-payouts-work; does not replace its corrected request flow.
    {
        slug: 'field-agent-earn-chart-and-history',
        title: 'Read your Earn chart and activity details',
        summary: 'Distinguish available money, credited monthly earnings and the status of a cash-out request.',
        paragraphs: [
            'Earn separates Available to cash out, Total earned and Withdrawn. Available is the current balance you can request, not a projection from shops still in review. A missing balance is shown as unavailable rather than being a confirmed zero.',
            'The chart covers the latest six months. Tap a month’s bar to show its earned total; tap the current month to return to its total. It counts credited Available and Withdrawn earnings and excludes Pending earnings. If none of those months has credited earnings, there may be no bars to tap. Selecting an older month does not change your available cash-out balance.',
            'Use See all beside Recent earnings or Cash outs, or the history icon, to open the activity history. The All, Earned and Cashed out filters separate the records. Tap an earning or cash-out entry for full details, including the recorded amount, date and status, plus shop, recipient, reference or failure information when available.',
            'Cash-out statuses are Pending, Processing, Completed and Failed. Read the selected record for its current state; a submitted request is not yet a completed transfer. For the Wise setup and confirmation steps, use How Wise payouts work. Reconnect when the app asks before requesting money or refreshing unavailable records.',
        ],
        keywords: ['earn', 'earnings chart', 'month', 'bars', 'available balance', 'pending earnings', 'cash-out history', 'payout status', 'activity details', 'withdrawn'],
        audiences: ['field_agent'], visibility: 'internal', workspace: 'wiki',
        categorySlug: 'payouts-earnings', categoryTitle: 'Payouts & Earnings',
    },

    // Sources: apps/mobile/app/(app)/submit/info.tsx;
    // apps/mobile/app/(app)/submit/photos.tsx; apps/mobile/app/(app)/submit/interview.tsx;
    // apps/mobile/components/field-agent/CaptureDesignGallery.tsx;
    // apps/mobile/app/(app)/submit/review.tsx.
    // Removes the obsolete claim that approval alone locks in an earning.
    {
        slug: 'submitting-in-the-app',
        title: 'Check and send a shop capture for review',
        summary: 'Follow the five capture steps, review the saved content, and confirm before sending.',
        paragraphs: [
            'The field-agent capture has five steps: shop details, photos, interview, website design and final review. Shop details require the business name and type, owner name, phone and valid email, address and city. Confirm these with the owner rather than treating incomplete community-find details as a finished submission.',
            'Add 3–10 usable photos, save the owner’s interview, and choose a website design for the business type. The design preview is a sample of the chosen layout; the shop’s own photos and interview are used for its website. If you correct the business type, finish the required photo review and choose a matching design before sending.',
            'On Check it, then send, review the shop card, photos, interview playback, design, website address and price. Use the edit actions to correct a section. A Tendso address is included. Add custom lets you check a requested domain; if it is unavailable, choose an offered available alternative or use the included address. The confirmed quote is shown before sending.',
            'Choose Send for review and confirm the price and commission message. Offline captures may instead offer Save and queue. Check the resulting status to know whether the team has received the submission. Sending or approval alone does not guarantee credited earnings; commission depends on the shop’s payment and the actual earnings record in Earn.',
        ],
        keywords: ['submit', 'five steps', 'shop details', 'required email', 'interview', 'pick design', 'check it then send', 'custom address', 'send for review', 'save and queue'],
        audiences: ['field_agent'], visibility: 'internal', workspace: 'wiki',
        categorySlug: 'interview-capture', categoryTitle: 'Interview & Capture',
    },

    // Sources: apps/mobile/app/(app)/submit/interview.tsx;
    // apps/mobile/lib/v2/captureContent.ts;
    // apps/mobile/app/(app)/submit/photos.tsx;
    // apps/mobile/app/(app)/submit/review.tsx.
    // Retains the useful preparation advice; removes fixed-duration and 12-shot claims.
    {
        slug: 'running-the-interview',
        title: 'Run the owner’s recorded interview',
        summary: 'Prepare a clear recording, ask one question at a time, and capture the business in the owner’s words.',
        paragraphs: [
            'A good interview feels like a friendly conversation. Confirm a suitable time and that the owner or decision-maker will be available. Charge your phone, make space for photos and recordings, and review what you already know about the business before visiting.',
            'Open Interview and preview the guided questions in English or Tagalog. They cover the shop name and location, products or services, what customers love, the business story, prices, hours, contact details and anything else the owner wants to add. Ask one question at a time and let the owner answer in their own words.',
            'Use the app’s continuous recording for the conversation. Record in a quieter spot and keep the phone close enough for clear speech. When you finish, save or continue from the recorded-interview screen. Play the saved recording from final review to check that the owner can be heard. If a take stops early, listen back and keep it only if the needed answers are present, or record another take.',
            'Take the shop images in Photos using the suggestions for the selected business type, rather than following an old fixed 12-shot list. Natural light, a steady phone and clear views of the real shop, owner and work are more useful than filters. Review the saved photos and interview together before sending the capture.',
        ],
        keywords: ['interview', 'recording', 'questions', 'English', 'Tagalog', 'owner story', 'audio', 'continuous recording', 'prepare visit', 'photo suggestions'],
        audiences: ['field_agent'], visibility: 'internal', workspace: 'wiki',
        categorySlug: 'interview-capture', categoryTitle: 'Interview & Capture',
    },

    // Sources: apps/mobile/app/(app)/submit/photos.tsx;
    // apps/mobile/app/(app)/submit/interview.tsx;
    // apps/mobile/app/(app)/submit/review.tsx;
    // apps/mobile/services/capturePhotoFiles.ts; apps/mobile/services/captureRecordingFiles.ts.
    // Replaces the blanket instruction to submit despite any upload/transcript failure.
    {
        slug: 'fixing-failed-uploads',
        title: 'Fix missing photos, recording uploads or transcript problems',
        summary: 'Distinguish missing media from a missing transcript, and retry the saved capture without starting again.',
        paragraphs: [
            'Keep the existing capture open or reopen it with the same field-agent account on the same phone. Reconnect to a stable network and retry the saving or upload step. A retry can use the saved photo or recording; do not create another shop submission to work around an upload error.',
            'If Photos marks a local image Unavailable, retake, replace or remove it and keep at least three usable images. If Interview says a recording did not save on the phone, keep that screen open and try Continue again. If it says the recording is no longer on this device, record another take. A new take does not replace the saved interview until the replacement is ready.',
            'An upload failure and an absent transcript are different. Final review requires attached interview media and saved photo/interview changes. Do not treat an unuploaded recording, unavailable photo or Interview needed message as finished work. Resolve the displayed error before sending, or use Save and queue when that offline option is offered.',
            'If the interview is attached, playback is clear and the other review checks pass, the current review screen can allow sending even when transcript text has not appeared. An absent transcript does not prove that the media failed, but it also does not prove transcription succeeded. Ask Tendso or support about a reported transcription error, with the business name and the exact error; there is no need to record the owner again solely because text is still missing.',
        ],
        keywords: ['failed upload', 'missing photos', 'unavailable image', 'recording not saved', 'retry upload', 'transcript missing', 'transcription failed', 'save and queue'],
        audiences: ['field_agent'], visibility: 'internal', workspace: 'wiki',
        categorySlug: 'field-troubleshooting', categoryTitle: 'Troubleshooting',
    },
];
