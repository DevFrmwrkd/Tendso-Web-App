# Current app-flow knowledge

The source-reviewed content in `convex/knowledgeContent/` supplements the shared
KB with current owner, creator, field-agent and admin workflows. Each guide has
source comments pointing to the implemented screens and backend rules.

| Pack | Topics |
| --- | --- |
| Common and team | One app/account roles, sign-in methods, Ask Tendso handoff, interview, preview/change/payment/publication stages, admin visit assignment and Discord draft review |
| Owners | Multiple businesses, shared draft recovery/conflicts, who holds the phone, visit requests and pins, preview/change requests, payment matching/down payments, expired checkout, notifications/settings and creator codes |
| Creators/affiliates | Sales/payment/credit distinctions, agent invitation attribution, commission-window bars, poster/QR exports, cash-out lifecycle and account privacy |
| Field agents | Map/Finds/Spot a shop, same-phone capture drafts, business-type corrections, labeled photos and full-screen replacement, review/resend, certification, upload recovery and earnings history |

The update replaces stale fixed photo-count, turnaround, revision and submission
instructions at their existing slugs. Existing saved links remain useful. The
certification article moves to signed-in field-agent Help so it can be read
before certification. Operational Wiki guides keep the certification gate.

Use the admin-authorized `knowledgeFlowGuides.preview` to review the planned
article and linked-FAQ changes. Pass its complete article revision guards
(`slug`, `updatedAt`) and FAQ guards (`id`, `answer`) to
`knowledgeFlowGuides.publish`. Stale or incomplete guards reject the whole
transaction. A captured Q&A or unpublished draft at a curated slug blocks
publication and requires manual review. Unrelated material is untouched.

The publisher preserves explicit existing access rules and category metadata;
the reviewed certification move is the narrow exception described above. New
role categories inherit the audiences and access of their guides. Linked FAQ
answers are refreshed while their access settings stay intact. Re-running an
unchanged catalogue creates no duplicate articles or extra indexing work.

Changed, published articles schedule the existing embedding job so both keyword
and semantic retrieval can use their current content. Tests leave those jobs
pending and call no AI or messaging service. Publishing these source-reviewed
guides does not approve captured Discord replies or AI training drafts.

Content is served directly from Convex. Updating the development KB appears in
the test website and mobile preview without publishing another app bundle.
Production content remains a separate deployment decision.
