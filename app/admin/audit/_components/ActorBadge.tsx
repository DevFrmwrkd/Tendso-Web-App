import { RotateCw, Store, User } from "lucide-react"

import { Avatar, Icon } from "@/components/r1"

import type { Actor } from "./model"

/**
 * Who did it, at a glance: a person's initials; the automations get the
 * board's circular-arrow disc, an owner a shop, and an account the log can no
 * longer name a plain person icon rather than initials that spell "UA".
 */
export function ActorBadge({ actor }: { actor: Actor }) {
    if (actor.kind === "person" && actor.known) return <Avatar name={actor.name} />
    const glyph = actor.kind === "system" ? RotateCw : actor.kind === "owner" ? Store : User
    return (
        <span className="t-avatar" aria-hidden="true">
            <Icon icon={glyph} />
        </span>
    )
}
