"use client";

import { ChevronDown, Eye, EyeOff, Search } from "lucide-react";
import { createContext, useContext, useId, useState, type AriaAttributes, type ComponentPropsWithRef, type ReactNode } from "react";

import { cx } from "./cx";
import { Icon } from "./Icon";

/*
 * Fields: label above, help below, and an error REPLACES the help. A red
 * asterisk means required. <Field> owns the ids; the control inside it picks
 * them up from context, so a page writes
 *
 *   <Field label="Business name" required help="As written on the shop sign." error={err}>
 *     <Input value={name} onChange={…} />
 *   </Field>
 *
 * and gets the label, aria-describedby, aria-invalid and required wired up.
 */

type FieldCtx = { id: string; describedBy?: string; invalid: boolean; required: boolean };
const FieldContext = createContext<FieldCtx | null>(null);

function useFieldProps(props: { id?: string; required?: boolean; "aria-describedby"?: string; "aria-invalid"?: AriaAttributes["aria-invalid"] }) {
    const ctx = useContext(FieldContext);
    return {
        id: props.id ?? ctx?.id,
        required: props.required ?? (ctx?.required || undefined),
        "aria-describedby": props["aria-describedby"] ?? ctx?.describedBy,
        "aria-invalid": props["aria-invalid"] ?? (ctx?.invalid ? true : undefined),
        invalid: ctx?.invalid ?? (props["aria-invalid"] === true || props["aria-invalid"] === "true"),
    };
}

export function Field({
    label,
    required = false,
    help,
    error,
    hideLabel = false,
    className,
    children,
}: {
    label: ReactNode;
    required?: boolean;
    help?: ReactNode;
    /** When set, replaces the help line and marks the control invalid. */
    error?: ReactNode;
    /** Keep the label for screen readers only (a search box, a lone textarea). */
    hideLabel?: boolean;
    className?: string;
    children: ReactNode;
}) {
    const id = useId();
    const msgId = `${id}-msg`;
    const message = error || help;
    return (
        <FieldContext.Provider value={{ id, describedBy: message ? msgId : undefined, invalid: Boolean(error), required }}>
            <div className={cx("t-field", className)}>
                <label className={hideLabel ? "sr-only" : "t-field-label"} htmlFor={id}>
                    {label}
                    {required && (
                        <span className="t-req" aria-hidden="true">
                            *
                        </span>
                    )}
                </label>
                {children}
                {message && (
                    <p className={error ? "t-error" : "t-help"} id={msgId}>
                        {message}
                    </p>
                )}
            </div>
        </FieldContext.Provider>
    );
}

export function Input({ className, ...props }: ComponentPropsWithRef<"input">) {
    const { invalid, ...wired } = useFieldProps(props);
    return <input {...props} {...wired} className={cx("t-input", invalid && "is-invalid", className)} />;
}

export function Textarea({ className, ...props }: ComponentPropsWithRef<"textarea">) {
    const { invalid, ...wired } = useFieldProps(props);
    return <textarea {...props} {...wired} className={cx("t-input", invalid && "is-invalid", className)} />;
}

export function Select({ className, children, ...props }: ComponentPropsWithRef<"select">) {
    const { invalid, ...wired } = useFieldProps(props);
    return (
        <div className="t-input-wrap">
            <select {...props} {...wired} className={cx("t-input", invalid && "is-invalid", className)}>
                {children}
            </select>
            <span className="t-ico-r">
                <Icon icon={ChevronDown} />
            </span>
        </div>
    );
}

/** Search box with the magnifier inside. Pass `label` for screen readers; it is not shown. */
export function SearchInput({ label, className, ...props }: ComponentPropsWithRef<"input"> & { label: string }) {
    const autoId = useId();
    const id = props.id ?? autoId;
    return (
        <div className={cx("t-input-wrap", className)}>
            <label className="sr-only" htmlFor={id}>
                {label}
            </label>
            <span className="t-ico-l">
                <Icon icon={Search} />
            </span>
            <input type="search" {...props} id={id} className="t-input" />
        </div>
    );
}

/** Password with its own eye. Each password field gets one. */
export function PasswordInput({ className, ...props }: Omit<ComponentPropsWithRef<"input">, "type">) {
    const { invalid, ...wired } = useFieldProps(props);
    const [shown, setShown] = useState(false);
    return (
        <div className="t-input-wrap">
            <input {...props} {...wired} type={shown ? "text" : "password"} className={cx("t-input", invalid && "is-invalid", className)} />
            <button
                type="button"
                className="t-btn t-btn-ghost t-btn-icon t-eye"
                aria-label={shown ? "Hide password" : "Show password"}
                aria-pressed={shown}
                aria-controls={wired.id}
                onClick={() => setShown((s) => !s)}
            >
                <Icon icon={shown ? EyeOff : Eye} />
            </button>
        </div>
    );
}

/**
 * Philippine mobile number, digits only. Letters and spaces are dropped as
 * they are typed, and the value stays a STRING so the leading 0 survives.
 */
export function PhoneInput({
    value,
    onValueChange,
    className,
    ...props
}: Omit<ComponentPropsWithRef<"input">, "type" | "value" | "onChange"> & { value: string; onValueChange: (digits: string) => void }) {
    const { invalid, ...wired } = useFieldProps(props);
    return (
        <input
            {...props}
            {...wired}
            type="tel"
            inputMode="numeric"
            autoComplete={props.autoComplete ?? "tel"}
            maxLength={props.maxLength ?? 11}
            value={value}
            onChange={(e) => onValueChange(e.target.value.replace(/\D/g, ""))}
            className={cx("t-input t-num", invalid && "is-invalid", className)}
        />
    );
}

export function Checkbox({ label, className, ...props }: Omit<ComponentPropsWithRef<"input">, "type"> & { label: ReactNode }) {
    return (
        <label className={cx("t-check", className)}>
            <input type="checkbox" {...props} />
            {label}
        </label>
    );
}

export type RadioCardOption<V extends string> = { value: V; title: ReactNode; meta?: ReactNode; disabled?: boolean };

/** Radio cards: the whole card is the target, arrow keys move between options, the chosen one gets an ink border. */
export function RadioCards<V extends string>({
    legend,
    required = false,
    name,
    value,
    onChange,
    options,
    error,
    className,
}: {
    legend: ReactNode;
    required?: boolean;
    name: string;
    value: V | null | undefined;
    onChange: (value: V) => void;
    options: RadioCardOption<V>[];
    error?: ReactNode;
    className?: string;
}) {
    const errId = useId();
    return (
        <fieldset className={cx("t-fieldset", className)} aria-describedby={error ? errId : undefined}>
            <legend className="t-field-label">
                {legend}
                {required && (
                    <span className="t-req" aria-hidden="true">
                        *
                    </span>
                )}
            </legend>
            <div className="t-radio-grid">
                {options.map((o) => (
                    <label key={o.value} className="t-radio">
                        <input
                            type="radio"
                            name={name}
                            value={o.value}
                            checked={value === o.value}
                            disabled={o.disabled}
                            required={required}
                            onChange={() => onChange(o.value)}
                        />
                        <span className="t-radio-text">
                            <span className="t-radio-title">{o.title}</span>
                            {o.meta && <span className="t-meta">{o.meta}</span>}
                        </span>
                    </label>
                ))}
            </div>
            {error && (
                <p className="t-error mt-1.5" id={errId}>
                    {error}
                </p>
            )}
        </fieldset>
    );
}
