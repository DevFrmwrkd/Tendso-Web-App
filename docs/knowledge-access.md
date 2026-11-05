# Shared knowledge and Ask Tendso

Tendso uses one knowledge base for public visitors, owners, affiliate creators,
field agents and admins. It does not maintain a separate copy per account type.

Each article, category and FAQ has two independent properties:

| Property | Values | Meaning |
| --- | --- | --- |
| Audience | Everyone, Owner, Creator/affiliate, Field agent, Admin | Who the advice is for. Ask Tendso uses the verified account role to select relevant sources. |
| Access | Public | Anyone can read it, including direct links. Audience is relevance, not secrecy. |
| Access | Signed in | An active signed-in account must match the audience. Admins can review it. |
| Access | Internal | Matching certified field agents and admins only. Select Admin for team-only information. |

The Wiki collection retains its certification/admin gate even if an editor
selects a looser access level. Category restrictions apply to child articles;
an FAQ cannot expose a linked article that the reader cannot access. Missing
legacy metadata means public/everyone for Help and internal/field-agent+admin
for Wiki. Suspended and deleted accounts cannot read private content.

`convex/lib/knowledgeAccess.ts` resolves the caller from Convex authentication.
Clients cannot select a role to gain access. Browse queries, direct articles,
feedback, assistant retrieval, vector hit resolution, citations and public
sitemap reads apply the same policy. The external Field Coach mirror is
public-only when it has no verified account identity.

## Asking for help

Web accounts use **Ask Tendso** at `/help#ask`. Mobile uses the shared native
`/(knowledge)/ask` route, available from owner Me, creator Help & account,
field-agent Learn & help, and the admin account card. Source articles open in
the shared authorized article reader.

`knowledgeAI.ask` accepts an optional Help/Wiki collection for older clients.
Omitting it selects all relevant sources the authenticated caller may read.
It never accepts a role. Personal balance, approval and business-status questions
read only the caller's current records through `knowledgeAccount.answer`.
No account IDs or emails in chat select someone else's records. The assistant
does not move money, approve accounts or change a website.

Pricing and commission policy comes from `packages/shared/pricing.ts`. General
article text and client-provided conversation history cannot override those
values or serve as evidence of an actual payment or balance. Financial answers
fail closed when the current facts are unavailable.

Web and native chat state resets when actor, session or verified role changes.
Paired viewer/content responses prevent a previous account's private query
cache from rendering during a switch. Public article HTML is read anonymously
per request. Private article bodies, titles and metadata are not embedded in
public cached HTML.

## Admin review

**Admin → Train AI → Knowledge library** reviews all articles, FAQs and
categories, including handwritten material. Access-only edits preserve rich
article blocks. AI-generated training and captured team replies become drafts;
an admin must review and explicitly publish them. Scoped training may only use
sources permitted for every intended audience at the selected access level.
Personal account answers are never training sources.

Draft escalation notifications contain a generic review notice, without the
captured answer or an article URL. Published answers link only after checking
the recipient's access. Owner notifications use the same authorized inbox on
web and mobile.

`knowledgeRoleGuides.curate` is an explicit, admin-authorized, one-time content
migration. Dry-run with `{ apply: false }`, inspect the report, then apply on the
intended deployment. It corrects reviewed stale pricing/payout material, tags
legacy content, quarantines captured Q&A for review and adds current role guides.
The marker prevents reruns from overwriting later editorial decisions. It does
not send messages, publish team chat or schedule paid AI generation. It was
applied to development only; production deployment/data changes remain separate.

Human team messaging is a separate feature. Team conversations do not
automatically become shared knowledge.

See [Current app-flow knowledge](knowledge-content-updates.md) for the reviewed
owner, creator, field-agent and admin content catalogue and its guarded publisher.
