"use client"

import { Bell, Megaphone } from "lucide-react"
import { useState, type ReactNode } from "react"

import { cx, Dot, Icon, Logo, Segmented } from "@/components/r1"
import { NOTIFICATION_PREVIEW_LIMIT, notificationPreview } from "@/lib/notifications/preview"

import { paragraphs, previewGreeting } from "../_lib/announce"

type Channel = "email" | "app"

/**
 * "What creators see": the message as one real recipient will get it, by
 * email or in the app. Built from the same rules the send uses, so it cannot
 * drift into a nicer picture than the real thing:
 *
 *   * the email splits paragraphs the way getAnnouncementEmailHtml does;
 *   * the in-app row shows notificationPreview(), the exact text
 *     insertNotifications stores (a clipped preview that points to the email).
 *
 * The recipient is the first name in the live audience sample; with nobody to
 * show, the To line says so instead of inventing someone.
 */
export default function MessagePreview({
    title,
    body,
    recipient,
    previewFor,
    nobodyLine = "Nobody yet",
}: {
    title: string
    body: string
    /** The first person in the live audience sample, or null when there is nobody. */
    recipient: { name: string; email: string } | null
    /** One line under the heading: whose eyes this is, out of how many. */
    previewFor: string
    /** The To line when there is nobody to show ("Nobody picked yet"). */
    nobodyLine?: string
}) {
    const [channel, setChannel] = useState<Channel>("email")

    const titleTrim = title.trim()
    const shownTitle = titleTrim || "Your title appears here"
    const paras = paragraphs(body)
    const toLine = recipient
        ? recipient.name && recipient.name !== recipient.email
            ? `${recipient.name} <${recipient.email}>`
            : recipient.email
        : nobodyLine

    return (
        <section aria-label="Preview" className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="t-h2">What creators see</h2>
                <Segmented
                    label="Preview channel"
                    value={channel}
                    onChange={setChannel}
                    options={[
                        { value: "email", label: "Email" },
                        { value: "app", label: "In-app" },
                    ]}
                />
            </div>
            <p className="t-meta">{previewFor}</p>

            {channel === "email" ? (
                <div className="t-card overflow-hidden">
                    <div className="flex flex-col gap-1 border-b border-r1-line bg-r1-fill-2 px-4 py-3 text-[13px] leading-[18px] text-r1-ink-2">
                        <MailLine label="From" value="Tendso" />
                        <MailLine label="To" value={toLine} />
                        <MailLine label="Subject" value={shownTitle} placeholder={!titleTrim} />
                    </div>
                    <div className="flex max-h-[470px] flex-col gap-3.5 overflow-auto px-5 pb-4 pt-5">
                        <Logo height={14} className="self-start" />
                        <h3 className={cx("text-xl font-semibold [overflow-wrap:anywhere]", titleTrim ? "text-r1-ink" : "text-r1-ink-4")}>
                            {shownTitle}
                        </h3>
                        <MailParagraph>Hi {previewGreeting(recipient?.name)},</MailParagraph>
                        {paras.length > 0 ? (
                            paras.map((p, i) => <MailParagraph key={i}>{p}</MailParagraph>)
                        ) : (
                            <MailParagraph placeholder>Your message appears here, one paragraph per blank line.</MailParagraph>
                        )}
                        <MailParagraph>Questions? Just reply to this email.</MailParagraph>
                        <hr className="t-divider" />
                        <p className="t-help">© {new Date().getFullYear()} Tendso. All rights reserved.</p>
                    </div>
                </div>
            ) : (
                <>
                    <div className="t-card overflow-hidden">
                        <div className="flex h-12 items-center gap-2 border-b border-r1-line bg-r1-fill-2 px-4 text-r1-ink">
                            <Icon icon={Bell} />
                            <span className="text-sm font-semibold">Notifications</span>
                        </div>
                        <div className="flex items-start gap-3 px-4 py-3.5">
                            <span className="t-avatar">
                                <Icon icon={Megaphone} />
                            </span>
                            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                                <p className={cx("text-sm font-semibold [overflow-wrap:anywhere]", titleTrim ? "text-r1-ink" : "text-r1-ink-4")}>
                                    {shownTitle}
                                </p>
                                <p className="text-[13px] leading-[18px] text-r1-ink-2 [overflow-wrap:anywhere]">{notificationPreview(body)}</p>
                                <p className="t-help">Just now</p>
                            </div>
                            <Dot tone="attn" className="mt-1.5" />
                            <span className="sr-only">Unread</span>
                        </div>
                    </div>
                    <p className="t-help">
                        The notification shows the first {NOTIFICATION_PREVIEW_LIMIT} characters and points to the email. The full message only
                        goes by email.
                    </p>
                </>
            )}
        </section>
    )
}

function MailLine({ label, value, placeholder = false }: { label: string; value: string; placeholder?: boolean }) {
    return (
        <div className="flex min-w-0 gap-2">
            <span className="w-14 flex-none text-r1-ink-3">{label}</span>
            <span className={cx("min-w-0 truncate", placeholder && "text-r1-ink-4")}>{value}</span>
        </div>
    )
}

function MailParagraph({ children, placeholder = false }: { children: ReactNode; placeholder?: boolean }) {
    // pre-line keeps a single line break inside a paragraph, as the email's <br> does.
    return (
        <p className={cx("whitespace-pre-line text-sm leading-[21px] [overflow-wrap:anywhere]", placeholder ? "text-r1-ink-4" : "text-r1-ink-2")}>
            {children}
        </p>
    )
}
