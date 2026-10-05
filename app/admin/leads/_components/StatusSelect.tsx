"use client";

import { ChevronDown } from "lucide-react";
import { useId } from "react";

import { Dot, Icon, leadStatus } from "@/components/r1";

import { isLeadStatus, LEAD_STATUSES, type LeadStatusValue } from "./leadUtils";

/**
 * The drawer's status control (ComponentKit "Select", used on AdminLeads). A
 * native select, so a phone gets its own picker, with the status dot inside
 * the box: the board draws the current status as dot plus word, and a
 * status is never the word alone.
 */
export function StatusSelect({
    label,
    value,
    help,
    onChange,
}: {
    label: string;
    value: string;
    help?: string;
    onChange: (next: LeadStatusValue) => void;
}) {
    const id = useId();
    const helpId = `${id}-help`;
    const current = leadStatus(value);
    return (
        <div className="t-field">
            <label className="t-field-label" htmlFor={id}>
                {label}
            </label>
            <div className="t-input-wrap">
                <span className="t-ico-l">
                    <span className="flex h-4 w-4 items-center justify-center">
                        <Dot tone={current.tone} />
                    </span>
                </span>
                <select
                    id={id}
                    className="t-input"
                    value={value}
                    aria-describedby={help ? helpId : undefined}
                    onChange={(e) => {
                        if (isLeadStatus(e.target.value)) onChange(e.target.value);
                    }}
                >
                    {/* A value the pipeline does not know still shows as itself instead of reading as "New". */}
                    {!isLeadStatus(value) && (
                        <option value={value} disabled>
                            {current.word}
                        </option>
                    )}
                    {LEAD_STATUSES.map((s) => (
                        <option key={s} value={s}>
                            {leadStatus(s).word}
                        </option>
                    ))}
                </select>
                <span className="t-ico-r">
                    <Icon icon={ChevronDown} />
                </span>
            </div>
            {help && (
                <p className="t-help" id={helpId}>
                    {help}
                </p>
            )}
        </div>
    );
}
