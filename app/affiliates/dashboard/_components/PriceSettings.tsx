"use client";

import { useMutation } from "convex/react";
import { ConvexError } from "convex/values";
import { useId, useRef, useState, type FormEvent } from "react";

import { AuthAlert } from "@/app/auth/_components/AuthParts";
import { Button, Field, Input } from "@/components/r1";
import { api } from "@/convex/_generated/api";
import { affiliatePriceError } from "@/lib/affiliates";
import { BASE_PRICE, COMMISSION_RATE, PRICE_CEILING, WEBSITE_PRICE, clampSellPrice, commissionFor, creatorDiscount, formatPHP } from "@/lib/pricing";

export function PriceSettings({ value, previewPrice, dirty, disabled, preview = false, onChange, onSaved }: {
    value: string;
    previewPrice: number;
    dirty: boolean;
    disabled: boolean;
    preview?: boolean;
    onChange: (value: string) => void;
    onSaved: (price: number) => void;
}) {
    const updatePage = useMutation(api.affiliates.updatePage);
    const rangeId = useId();
    const priceRef = useRef<HTMLInputElement>(null);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string>();
    const [inputError, setInputError] = useState<string>();
    const [saved, setSaved] = useState(false);
    const discount = creatorDiscount(previewPrice, WEBSITE_PRICE);

    function change(next: string) {
        onChange(next);
        setSaved(false);
        setError(undefined);
        setInputError(undefined);
    }

    function normalize() {
        if (value.trim() && !affiliatePriceError(Number(value))) onChange(String(clampSellPrice(Number(value))));
    }

    async function save(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (disabled || saving || !dirty) return;
        const problem = value.trim() ? affiliatePriceError(Number(value)) : "Enter your website price.";
        if (problem) { setInputError(problem); priceRef.current?.focus(); return; }
        const price = clampSellPrice(Number(value));
        if (preview) {
            setError(undefined);
            onSaved(price);
            setSaved(true);
            return;
        }
        setSaving(true);
        setError(undefined);
        try {
            await updatePage({ price });
            onSaved(price);
            setSaved(true);
        } catch (saveError) {
            setError(saveError instanceof ConvexError && typeof saveError.data === "string" ? saveError.data : "Your price was not saved. Please try again.");
        } finally {
            setSaving(false);
        }
    }

    return (
        <section id="price-settings" className="t-card t-card-pad flex min-w-0 flex-col gap-5" aria-labelledby="price-settings-title">
            <div className="flex flex-col gap-1">
                <h2 id="price-settings-title" className="t-h2">Your price</h2>
                <p className="t-meta">Choose {formatPHP(BASE_PRICE)}–{formatPHP(PRICE_CEILING)}. Your new price applies to future orders.</p>
            </div>
            <form onSubmit={save} noValidate className="flex flex-col gap-4">
                {error && <AuthAlert>{error}</AuthAlert>}
                <Field label="Website price (PHP)" required help="Whole pesos only. Prices are rounded and kept within the range." error={inputError}>
                    <Input ref={priceRef} type="number" inputMode="numeric" min={BASE_PRICE} max={PRICE_CEILING} step={1} value={value} disabled={disabled || saving} onChange={(event) => change(event.target.value)} onBlur={normalize} />
                </Field>
                <div className="flex flex-col gap-2">
                    <label htmlFor={rangeId} className="t-field-label">Adjust your price</label>
                    <input id={rangeId} type="range" min={BASE_PRICE} max={PRICE_CEILING} step={1} value={previewPrice} disabled={disabled || saving} onChange={(event) => change(event.target.value)} aria-valuetext={formatPHP(previewPrice)} className="h-8 w-full accent-r1-ink disabled:opacity-45" />
                    <div className="flex justify-between t-help"><span>{formatPHP(BASE_PRICE)}</span><span>{formatPHP(PRICE_CEILING)}</span></div>
                </div>
                <div className="flex flex-col gap-2 rounded-r1 bg-r1-fill-2 p-4" aria-live="polite">
                    <p className="t-label">Shop owners see</p>
                    <p className="flex flex-wrap items-baseline gap-2">
                        {discount && <del className="t-meta">{formatPHP(discount.listPrice)}</del>}
                        <strong className="text-xl text-r1-ink t-num">{formatPHP(previewPrice)}</strong>
                        {discount && <span className="t-meta">{discount.percentOff}% off</span>}
                    </p>
                    <p className="t-body">Your commission: <strong>{formatPHP(commissionFor(previewPrice))}</strong> ({Math.round(COMMISSION_RATE * 100)}% of the website price).</p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    <Button type="submit" disabled={disabled || saving || !dirty} aria-busy={saving}>{saving ? "Saving…" : "Save price"}</Button>
                    <p className="t-meta" role="status" aria-live="polite">{saved && !dirty ? preview ? "Price saved in this preview." : "Price saved." : dirty ? "Unsaved price change" : ""}</p>
                </div>
            </form>
        </section>
    );
}
