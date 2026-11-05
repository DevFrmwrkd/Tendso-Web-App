"use client"

import { useId } from "react"

import { Checkbox, Field, Select } from "@/components/r1"
import { KNOWLEDGE_AUDIENCES, KNOWLEDGE_VISIBILITIES, type KnowledgeVisibility } from "@/packages/shared/knowledge"

import { ACCESS_LABEL, AUDIENCE_LABEL, toggleAudience, type KnowledgeAccess } from "../_lib/access"

/** The same controls are used for existing content, training and draft review. */
export default function AudienceAccessFields({ value, onChange, disabled = false }: {
    value: KnowledgeAccess
    onChange: (value: KnowledgeAccess) => void
    disabled?: boolean
}) {
    const helpId = useId()
    return (
        <div className="flex flex-col gap-3 rounded-r1 border border-r1-line p-3.5">
            <fieldset aria-describedby={helpId} disabled={disabled} className="flex flex-col gap-2">
                <legend className="t-field-label mb-2">Audience</legend>
                <div className="flex flex-wrap gap-x-5 gap-y-3">
                    {KNOWLEDGE_AUDIENCES.map((audience) => (
                        <Checkbox
                            key={audience}
                            label={AUDIENCE_LABEL[audience]}
                            checked={value.audiences.includes(audience)}
                            onChange={() => onChange({ ...value, audiences: toggleAudience(value.audiences, audience) })}
                        />
                    ))}
                </div>
                <p id={helpId} className="t-help">Who this content helps. Choose one or more account types, or Everyone.</p>
            </fieldset>
            <Field label="Access" help={
                value.visibility === "public"
                    ? "Anyone can read public content. Audience tags guide relevant answers; they do not make it private."
                    : value.visibility === "authenticated"
                      ? "Only signed-in accounts in the selected audiences can read it."
                      : "Only certified field agents and admins in the selected audiences can read it. Owners and affiliates cannot read internal content."
            }>
                <Select
                    value={value.visibility}
                    disabled={disabled}
                    onChange={(e) => onChange({ ...value, visibility: e.target.value as KnowledgeVisibility })}
                >
                    {KNOWLEDGE_VISIBILITIES.map((visibility) => (
                        <option key={visibility} value={visibility}>{ACCESS_LABEL[visibility]}</option>
                    ))}
                </Select>
            </Field>
            {value.visibility === "internal" && !value.audiences.includes("everyone") && !value.audiences.includes("field_agent")
                && value.audiences.some((audience) => audience === "owner" || audience === "affiliate") && (
                <p className="t-help" role="note">This selection allows only admins to read it. Choose Signed-in accounts to share with owners or affiliates.</p>
            )}
        </div>
    )
}
