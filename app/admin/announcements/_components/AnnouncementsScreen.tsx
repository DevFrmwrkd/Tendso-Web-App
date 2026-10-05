"use client"

import { useAction, useQueries, useQuery } from "convex/react"
import { Send, X } from "lucide-react"
import { useId, useMemo, useState, type ReactNode } from "react"
import { toast } from "sonner"

import {
    Avatar,
    Button,
    cx,
    Dialog,
    Field,
    Icon,
    Input,
    Loading,
    RadioCards,
    Skeleton,
    SkeletonCard,
    Textarea,
    type RadioCardOption,
} from "@/components/r1"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { AUDIENCES, type AudienceKey } from "@/lib/announcements/audience"

import { BODY_MAX, DEFAULT_AUDIENCE, errorText, fmt, noun, recipientsText, sampleText, TITLE_MAX, type Target } from "../_lib/announce"
import MessagePreview from "./MessagePreview"
import PanelBoundary from "./PanelBoundary"
import RecentAnnouncements from "./RecentAnnouncements"

type Person = { _id: Id<"creators">; name: string; email: string }
type AudiencePreview = { count: number; sample: { name: string; email: string }[] }
type FieldErrors = { title?: boolean; body?: boolean; pick?: boolean; nobody?: boolean }

const PICK_DESCRIPTION = "Choose one creator or several, by name or email. Same message, only these recipients."

/**
 * The composer, the audience, the preview and the history (board
 * Announcements). The only admin screen whose primary button cannot be
 * undone, so the whole layout answers "who exactly is about to receive
 * this?" before the send is reachable:
 *
 *   * every recipient count comes from previewAudience, which runs the SAME
 *     selection rule the sender uses (lib/announcements/audience.ts), not a
 *     second implementation
 *   * a sample of real names sits under each count, because a bare number
 *     hides a wrong filter
 *   * "Send a test to me" is offered first, and costs one email
 *   * the send itself is two-step: a dialog restates the count, the audience
 *     and the subject before anything leaves
 */
export default function AnnouncementsScreen({ adminId }: { adminId: string }) {
    const [title, setTitle] = useState("")
    const [body, setBody] = useState("")
    const [audience, setAudience] = useState<AudienceKey>(DEFAULT_AUDIENCE)
    // Targeting one creator is a separate mode rather than a fifth AudienceKey:
    // it is not a rule over the creator list, it is a bypass of one.
    const [pickMode, setPickMode] = useState(false)
    const [picked, setPicked] = useState<Person[]>([])
    const [q, setQ] = useState("")
    const [errors, setErrors] = useState<FieldErrors>({})
    // What the send action said when it refused; cleared by the next edit.
    const [sendError, setSendError] = useState<string | null>(null)
    // The exact title and body last sent as a test: a test of an older draft
    // is not a test of this one.
    const [tested, setTested] = useState<{ title: string; body: string } | null>(null)
    const [confirming, setConfirming] = useState(false)
    const [busy, setBusy] = useState<null | "test" | "send">(null)

    // Presence of the array selects picked-mode, so an empty selection sends to
    // nobody rather than falling back to the audience.
    const targetIds = pickMode ? picked.map((x) => x._id) : undefined
    const target: Target = pickMode ? "pick" : audience

    // The selection the send button and the confirm dialog describe.
    const preview = useQuery(api.announcements.previewAudience, {
        adminId,
        audience,
        ...(targetIds ? { creatorIds: targetIds } : {}),
    })
    // One live count per audience card, from the same query with each rule.
    // The card that is selected shares its subscription with `preview` above
    // (same function, same arguments), so it is never fetched twice.
    const audienceRequests = useMemo(
        () => Object.fromEntries(AUDIENCES.map((a) => [a.key, { query: api.announcements.previewAudience, args: { adminId, audience: a.key } }])),
        [adminId],
    )
    const audienceResults = useQueries(audienceRequests)
    const matches = useQuery(api.announcements.searchRecipients, pickMode && q.trim().length >= 2 ? { adminId, q } : "skip")
    const send = useAction(api.announcements.send)

    const pickedIds = new Set(picked.map((x) => x._id))
    const count = preview?.count
    const testedThis = tested !== null && tested.title === title && tested.body === body

    // Any edit clears what the last attempt said: an error or a refusal from
    // the send must never describe a different message than the one on screen.
    function cleared(field: keyof FieldErrors | null) {
        setSendError(null)
        if (field) setErrors((e) => ({ ...e, [field]: false }))
    }

    function chooseTarget(next: Target) {
        setSendError(null)
        setErrors((e) => ({ ...e, pick: false, nobody: false }))
        if (next === "pick") {
            setPickMode(true)
            return
        }
        setPickMode(false)
        setPicked([])
        setAudience(next)
    }

    function togglePick(m: Person) {
        cleared("pick")
        setPicked((cur) => (cur.some((x) => x._id === m._id) ? cur.filter((x) => x._id !== m._id) : [...cur, m]))
    }

    async function sendTest() {
        const missing = { title: !title.trim(), body: !body.trim() }
        if (missing.title || missing.body) {
            setErrors(missing)
            return
        }
        setErrors({})
        setSendError(null)
        setBusy("test")
        try {
            await send({ adminId, title, body, audience, testOnly: true, ...(targetIds ? { creatorIds: targetIds } : {}) })
            setTested({ title, body })
            toast("Test sent to your inbox. Nobody else got it.")
        } catch (e) {
            const text = errorText(e)
            setSendError(text)
            toast.error(text)
        } finally {
            setBusy(null)
        }
    }

    function askSend() {
        const missing: FieldErrors = { title: !title.trim(), body: !body.trim(), pick: pickMode && picked.length === 0 }
        if (missing.title || missing.body || missing.pick) {
            setErrors(missing)
            return
        }
        if (count === 0) {
            setErrors({ nobody: true })
            return
        }
        setErrors({})
        setSendError(null)
        setConfirming(true)
    }

    async function confirmSend() {
        setBusy("send")
        try {
            const r = await send({ adminId, title, body, audience, testOnly: false, ...(targetIds ? { creatorIds: targetIds } : {}) })
            toast.success(`Sent to ${fmt(r.sent)} ${noun(target, r.sent)} by email and in-app.`)
            setTitle("")
            setBody("")
            setTested(null)
        } catch (e) {
            const text = errorText(e)
            setSendError(text)
            toast.error(text)
        } finally {
            setBusy(null)
            setConfirming(false)
        }
    }

    const formError = errors.title && errors.body
        ? "Add a title and a message first."
        : errors.title
          ? "Add a title first."
          : errors.body
            ? "Write the message first."
            : errors.pick
              ? "Pick at least one person first."
              : errors.nobody
                ? pickMode
                    ? "None of the people you picked can be emailed, so nothing would send."
                    : "Nobody is in that audience right now, so nothing would send."
                : sendError

    const sendLabel = count === undefined ? "Counting recipients…" : `Send to ${fmt(count)} ${noun(target, count)}`

    // ── Audience cards ───────────────────────────────────────────────────
    const options: RadioCardOption<Target>[] = [
        ...AUDIENCES.map((a): RadioCardOption<Target> => {
            const p = readPreview(audienceResults[a.key])
            return {
                value: a.key,
                title: <AudienceTitle label={a.label} isDefault={a.key === DEFAULT_AUDIENCE} count={p?.count} />,
                meta: (
                    <AudienceMeta
                        description={a.description}
                        sample={p ? sampleText(p.sample.map((s) => s.name), p.count) : undefined}
                    />
                ),
            }
        }),
        {
            value: "pick",
            title: <AudienceTitle label="Pick people" count={pickMode ? count : 0} />,
            meta: (
                <AudienceMeta
                    description={PICK_DESCRIPTION}
                    sample={
                        !pickMode || picked.length === 0
                            ? "Nobody picked yet"
                            : preview
                              ? sampleText(preview.sample.map((s) => s.name), preview.count)
                              : undefined
                    }
                />
            ),
        },
    ]

    // ── Preview: whose eyes, out of how many ─────────────────────────────
    const first = preview?.sample[0] ?? null
    const previewFor =
        preview === undefined
            ? "Counting recipients…"
            : first
              ? preview.count === 1
                  ? `As ${first.name} will see it.`
                  : `As ${first.name} will see it — one of ${fmt(preview.count)} ${noun(target, preview.count)}.`
              : pickMode
                ? "Pick someone to see it as they will."
                : "Nobody is in this audience right now."

    const targetLabel = pickMode ? "Picked people" : (AUDIENCES.find((a) => a.key === audience)?.label ?? audience)

    return (
        <>
            <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
                {/* Composer */}
                <section className="t-card flex min-w-0 flex-col" aria-label="Compose announcement">
                    <div className="flex flex-col gap-5 p-5 sm:p-6">
                        <CountedField
                            label="Title"
                            length={title.length}
                            max={TITLE_MAX}
                            help="Becomes the email subject and the notification headline."
                            error={errors.title && "Add a title. It becomes the email subject and the notification headline."}
                        >
                            {(wired) => (
                                <Input
                                    {...wired}
                                    type="text"
                                    autoComplete="off"
                                    value={title}
                                    maxLength={TITLE_MAX}
                                    placeholder="New: give a free website to someone you know"
                                    onChange={(e) => {
                                        setTitle(e.target.value)
                                        cleared("title")
                                    }}
                                />
                            )}
                        </CountedField>

                        <CountedField
                            label="Message"
                            length={body.length}
                            max={BODY_MAX}
                            help="Plain text only. A blank line starts a new paragraph."
                            error={errors.body && "Write the message. Creators get it in full by email."}
                        >
                            {(wired) => (
                                <Textarea
                                    {...wired}
                                    className="min-h-[220px]"
                                    value={body}
                                    maxLength={BODY_MAX}
                                    placeholder={"Write it the way you’d say it.\n\nLeave a blank line between paragraphs."}
                                    onChange={(e) => {
                                        setBody(e.target.value)
                                        cleared("body")
                                    }}
                                />
                            )}
                        </CountedField>
                    </div>

                    <hr className="t-divider" />

                    <div className="flex flex-col gap-4 p-5 sm:p-6">
                        <RadioCards
                            name="announcement-audience"
                            legend={
                                <>
                                    <h2 className="t-h2">Who receives it</h2>
                                    <span className="t-meta mb-2 mt-1 block font-normal">
                                        Counts are live and use the same rule as the send, so the number you see is the number that goes out.
                                    </span>
                                </>
                            }
                            value={target}
                            onChange={chooseTarget}
                            options={options}
                            // Full-width cards, one per row (the kit's grid is two-up from 640px),
                            // with the text column stretched so the count can sit on the right.
                            className="[&_.t-radio-grid]:grid-cols-1 [&_.t-radio-grid]:gap-2 [&_.t-radio-text]:flex-1 [&_.t-radio]:px-4 [&_.t-radio]:py-3.5"
                        />

                        {pickMode && (
                            <div className="flex flex-col gap-3 rounded-r1 border border-r1-line bg-r1-fill-2 p-4">
                                {picked.length > 0 && (
                                    <div className="flex flex-wrap gap-2" role="group" aria-label="Picked people">
                                        {picked.map((p) => (
                                            <button key={p._id} type="button" className="t-chip" aria-label={`Remove ${p.name}`} onClick={() => togglePick(p)}>
                                                {p.name}
                                                <Icon icon={X} size={14} />
                                            </button>
                                        ))}
                                    </div>
                                )}

                                <Field label="Find a creator" help="Type at least 2 letters of a name or email.">
                                    <Input
                                        type="search"
                                        autoComplete="off"
                                        value={q}
                                        placeholder={picked.length ? "Add another person" : "Search by name or email"}
                                        onChange={(e) => setQ(e.target.value)}
                                    />
                                </Field>

                                {q.trim().length >= 2 &&
                                    (matches === undefined ? (
                                        <p className="t-meta" role="status">
                                            Searching…
                                        </p>
                                    ) : matches.length === 0 ? (
                                        <p className="t-meta">Nobody matches that.</p>
                                    ) : (
                                        <div className="flex flex-col overflow-hidden rounded-r1 border border-r1-line bg-r1-paper">
                                            {matches.map((m) => {
                                                const on = pickedIds.has(m._id)
                                                return (
                                                    <button
                                                        key={m._id}
                                                        type="button"
                                                        aria-pressed={on}
                                                        onClick={() => togglePick(m)}
                                                        className="flex min-h-12 w-full items-center gap-3 border-b border-r1-line-3 bg-r1-paper px-3 py-2 text-left last:border-b-0 hover:bg-r1-fill-row aria-pressed:bg-r1-fill"
                                                    >
                                                        <Avatar name={m.name} />
                                                        <span className="flex min-w-0 flex-1 flex-col">
                                                            <span className="truncate text-sm font-medium text-r1-ink">{m.name}</span>
                                                            <span className="t-meta truncate">{m.email}</span>
                                                        </span>
                                                        <span className={cx("whitespace-nowrap text-[13px]", on ? "font-medium text-r1-ink" : "text-r1-ink-3")}>
                                                            {on ? "Picked" : "Add"}
                                                        </span>
                                                    </button>
                                                )
                                            })}
                                        </div>
                                    ))}

                                {picked.length === 0 &&
                                    (errors.pick ? (
                                        <p className="t-error">Pick at least one person. Nobody is picked, so nothing would send.</p>
                                    ) : (
                                        <p className="t-meta">Nobody picked yet — nothing will send.</p>
                                    ))}
                            </div>
                        )}
                    </div>

                    <hr className="t-divider" />

                    <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                        <div className="flex min-w-0 flex-col gap-1">
                            {formError && (
                                <p className="t-error" role="alert">
                                    {formError}
                                </p>
                            )}
                            <p className="t-meta">
                                {testedThis
                                    ? "Test sent to your inbox just now. Nobody else received it."
                                    : "This can’t be undone. Send a test to yourself first — it costs one email."}
                            </p>
                        </div>
                        <div className="flex flex-col gap-2 sm:flex-none sm:flex-row">
                            <Button onClick={sendTest} disabled={busy !== null} aria-busy={busy === "test"}>
                                {busy === "test" ? "Sending test…" : "Send a test to me"}
                            </Button>
                            <Button variant="primary" onClick={askSend} disabled={busy !== null || count === undefined}>
                                <Icon icon={Send} />
                                {sendLabel}
                            </Button>
                        </div>
                    </div>
                </section>

                {/* Preview and history */}
                <div className="flex min-w-0 flex-col gap-8">
                    <MessagePreview
                        title={title}
                        body={body}
                        recipient={first}
                        previewFor={previewFor}
                        nobodyLine={pickMode ? "Nobody picked yet" : "Nobody yet"}
                    />
                    <PanelBoundary what="Recent announcements">
                        <RecentAnnouncements adminId={adminId} />
                    </PanelBoundary>
                </div>
            </div>

            <Dialog
                open={confirming}
                // Mid-send the dialog stays: closing it would hide the one place
                // that says the send is still going.
                onClose={() => {
                    if (busy !== "send") setConfirming(false)
                }}
                title={`Send to ${fmt(count ?? 0)} ${noun(target, count ?? 0)} by email and in-app?`}
                footer={
                    <>
                        <Button onClick={() => setConfirming(false)} disabled={busy === "send"}>
                            Cancel
                        </Button>
                        <Button variant="primary" onClick={confirmSend} disabled={busy === "send"} aria-busy={busy === "send"}>
                            <Icon icon={Send} />
                            {busy === "send" ? "Sending…" : sendLabel}
                        </Button>
                    </>
                }
            >
                <p>Each recipient gets one email and one in-app notification. Once it leaves, it can’t be taken back.</p>
                <dl className="grid grid-cols-[72px_minmax(0,1fr)] items-baseline gap-x-3 gap-y-2.5 rounded-r1 border border-r1-line bg-r1-fill-2 px-4 py-3.5">
                    <dt className="t-label">Audience</dt>
                    <dd className="t-body [overflow-wrap:anywhere]">{targetLabel}</dd>
                    <dt className="t-label">Includes</dt>
                    <dd className="t-body [overflow-wrap:anywhere]">
                        {preview ? sampleText(preview.sample.map((s) => s.name), preview.count) : "…"}
                    </dd>
                    <dt className="t-label">Subject</dt>
                    <dd className="t-body font-medium text-r1-ink [overflow-wrap:anywhere]">{title.trim()}</dd>
                </dl>
                {!testedThis && <p className="t-meta">You haven’t sent yourself a test of this message yet.</p>}
            </Dialog>
        </>
    )
}

/**
 * useQueries hands back an Error instead of throwing it. Rethrow, so a count
 * that failed lands in the page's error boundary like every other query.
 */
function readPreview(value: unknown): AudiencePreview | undefined {
    if (value instanceof Error) throw value
    return value as AudiencePreview | undefined
}

function AudienceTitle({ label, isDefault = false, count }: { label: string; isDefault?: boolean; count: number | undefined }) {
    return (
        <span className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="font-semibold">{label}</span>
            {isDefault && <span className="t-meta">Default</span>}
            <span className="t-num ml-auto whitespace-nowrap font-medium">
                {count === undefined ? (
                    <>
                        <Skeleton width={88} height={12} className="inline-block align-middle" />
                        <span className="sr-only">Counting</span>
                    </>
                ) : (
                    recipientsText(count)
                )}
            </span>
        </span>
    )
}

function AudienceMeta({ description, sample }: { description: string; sample: string | undefined }) {
    return (
        <span className="mt-1 flex flex-col gap-1">
            <span>{description}</span>
            {sample === undefined ? <Skeleton width="50%" height={10} /> : sample && <span className="text-r1-ink-2">{sample}</span>}
        </span>
    )
}

/**
 * A required field whose label row carries a live character count on the
 * right ("0 / 120"), which turns gold near the limit and red at it. <Field>
 * owns its label row, so the ids are wired here by hand instead.
 */
function CountedField({
    label,
    length,
    max,
    help,
    error,
    children,
}: {
    label: string
    length: number
    max: number
    help: string
    /** When set, replaces the help line and marks the control invalid. */
    error?: string | false
    children: (wired: { id: string; "aria-describedby": string; "aria-invalid": boolean; required: boolean }) => ReactNode
}) {
    const id = useId()
    const msgId = `${id}-msg`
    const tone = length >= max ? "text-r1-red" : length >= max * 0.9 ? "text-r1-gold-ink" : undefined
    return (
        <div className="t-field">
            <div className="flex items-baseline justify-between gap-3">
                <label className="t-field-label" htmlFor={id}>
                    {label}
                    <span className="t-req" aria-hidden="true">
                        *
                    </span>
                </label>
                <span className={cx("t-count", tone)}>
                    {fmt(length)} / {fmt(max)}
                </span>
            </div>
            {children({ id, "aria-describedby": msgId, "aria-invalid": Boolean(error), required: true })}
            <p className={error ? "t-error" : "t-help"} id={msgId}>
                {error || help}
            </p>
        </div>
    )
}

/** The page body's shape while Clerk and the role load. */
export function AnnouncementsSkeleton() {
    return (
        <Loading label="Loading announcements">
            <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_360px]" aria-hidden="true">
                <div className="t-card flex flex-col gap-5 p-5 sm:p-6">
                    <Skeleton width="18%" height={12} />
                    <Skeleton height={40} />
                    <Skeleton width="22%" height={12} />
                    <Skeleton height={220} />
                    <Skeleton width="30%" height={14} />
                    {Array.from({ length: 4 }, (_, i) => (
                        <Skeleton key={i} height={72} />
                    ))}
                </div>
                <div className="flex flex-col gap-3">
                    <Skeleton width="45%" height={16} />
                    <SkeletonCard />
                </div>
            </div>
        </Loading>
    )
}
