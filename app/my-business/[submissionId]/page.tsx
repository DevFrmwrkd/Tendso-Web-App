"use client";

/**
 * Scoped owner editor — content-only, fenced to a website the signed-in owner
 * owns. Reads/writes via ownership-gated Convex functions (getMyWebsiteContent /
 * updateMyWebsiteContent), which re-check websiteOwnerships server-side, so a
 * guessed submissionId in the URL is rejected, not just hidden.
 *
 * Owners edit content fields only (text, services, contact). Templates, domains,
 * status, and the build pipeline are NOT exposed here — by design.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useOwnerAuth } from "@/hooks/useOwnerAuth";
import { Loader2, ArrowLeft, Check } from "lucide-react";

type ContactPatch = { email: string; phone: string; address?: string };

export default function OwnerEditPage() {
    const params = useParams();
    const submissionId = params.submissionId as Id<"submissions">;
    const router = useRouter();
    const { isOwner, isSignedIn, loading } = useOwnerAuth();

    const content = useQuery(
        api.businessOwners.getMyWebsiteContent,
        isOwner ? { submissionId } : "skip",
    );
    const save = useMutation(api.businessOwners.updateMyWebsiteContent);

    // Local form state, seeded from the loaded content once.
    const [form, setForm] = useState<Record<string, string>>({});
    const [contact, setContact] = useState<ContactPatch | null>(null);
    const [seeded, setSeeded] = useState(false);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!loading && isSignedIn === false) router.replace("/login");
    }, [loading, isSignedIn, router]);

    useEffect(() => {
        if (content && !seeded) {
            const c = content as Record<string, unknown>;
            setForm({
                businessName: (c.businessName as string) ?? "",
                tagline: (c.tagline as string) ?? "",
                aboutText: (c.aboutText as string) ?? "",
                heroHeadline: (c.heroHeadline as string) ?? "",
                heroSubheadline: (c.heroSubheadline as string) ?? "",
                aboutHeadline: (c.aboutHeadline as string) ?? "",
                aboutDescription: (c.aboutDescription as string) ?? "",
                servicesHeadline: (c.servicesHeadline as string) ?? "",
            });
            const ct = c.contact as ContactPatch | undefined;
            setContact({ email: ct?.email ?? "", phone: ct?.phone ?? "", address: ct?.address ?? "" });
            setSeeded(true);
        }
    }, [content, seeded]);

    const setField = (k: string, v: string) => {
        setForm((f) => ({ ...f, [k]: v }));
        setSaved(false);
    };

    const handleSave = async () => {
        setSaving(true);
        setError(null);
        try {
            const patch: Record<string, unknown> = { ...form };
            if (contact && (contact.email || contact.phone || contact.address)) {
                patch.contact = { email: contact.email, phone: contact.phone, address: contact.address || undefined };
            }
            await save({ submissionId, patch });
            setSaved(true);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Failed to save changes.");
        } finally {
            setSaving(false);
        }
    };

    if (loading || (isOwner && content === undefined)) {
        return (
            <div className="min-h-screen flex items-center justify-center" style={{ background: "#FBF3E0" }}>
                <Loader2 className="h-8 w-8 animate-spin" style={{ color: "#E4B05E" }} />
            </div>
        );
    }

    // content === null → not owned (gate rejected) or no content row.
    if (content === null) {
        return (
            <div className="min-h-screen flex items-center justify-center px-6" style={{ background: "#FBF3E0", color: "#5C3A0F" }}>
                <div className="max-w-md text-center space-y-3">
                    <h1 className="text-2xl font-bold">Website not available</h1>
                    <p style={{ color: "#C89548" }}>You don&apos;t have access to this website, or its content isn&apos;t ready yet.</p>
                    <Link href="/my-business" className="inline-block hover:underline" style={{ color: "#E4B05E" }}>← Back to my business</Link>
                </div>
            </div>
        );
    }

    const textFields: Array<{ key: string; label: string; multiline?: boolean }> = [
        { key: "businessName", label: "Business name" },
        { key: "tagline", label: "Tagline" },
        { key: "heroHeadline", label: "Hero headline" },
        { key: "heroSubheadline", label: "Hero subheadline" },
        { key: "aboutHeadline", label: "About — headline" },
        { key: "aboutDescription", label: "About — description", multiline: true },
        { key: "aboutText", label: "About — text", multiline: true },
        { key: "servicesHeadline", label: "Services — headline" },
    ];

    return (
        <div className="min-h-screen px-6 py-10" style={{ background: "#FBF3E0", color: "#5C3A0F" }}>
            <div className="max-w-xl mx-auto space-y-6">
                <Link href="/my-business" className="inline-flex items-center gap-1 text-sm hover:underline" style={{ color: "#C89548" }}>
                    <ArrowLeft className="w-4 h-4" /> My business
                </Link>

                <header>
                    <h1 className="text-2xl font-bold">Edit your website</h1>
                    <p className="mt-1 text-sm" style={{ color: "#C89548" }}>Update your text and contact details. Changes save to your live site.</p>
                </header>

                {error && (
                    <div className="p-4 rounded-lg" style={{ background: "#fde2e2", color: "#dc2626" }}>{error}</div>
                )}

                <div className="bg-white rounded-2xl p-6 space-y-4" style={{ border: "1px solid #F5E4C0" }}>
                    {textFields.map((f) => (
                        <div key={f.key}>
                            <label className="text-xs font-medium uppercase tracking-wide" style={{ color: "#71717a" }}>{f.label}</label>
                            {f.multiline ? (
                                <textarea
                                    value={form[f.key] ?? ""}
                                    onChange={(e) => setField(f.key, e.target.value)}
                                    rows={3}
                                    className="mt-1 w-full px-3 py-2 border rounded-lg"
                                    style={{ borderColor: "#F5E4C0" }}
                                />
                            ) : (
                                <input
                                    value={form[f.key] ?? ""}
                                    onChange={(e) => setField(f.key, e.target.value)}
                                    className="mt-1 w-full px-3 py-2 border rounded-lg"
                                    style={{ borderColor: "#F5E4C0" }}
                                />
                            )}
                        </div>
                    ))}

                    <div className="pt-2 border-t" style={{ borderColor: "#F5E4C0" }}>
                        <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: "#71717a" }}>Contact</p>
                        {(["phone", "email", "address"] as const).map((k) => (
                            <div key={k} className="mb-3">
                                <label className="text-xs capitalize" style={{ color: "#71717a" }}>{k}</label>
                                <input
                                    value={contact?.[k] ?? ""}
                                    onChange={(e) => { setContact((c) => ({ ...(c ?? { email: "", phone: "" }), [k]: e.target.value })); setSaved(false); }}
                                    className="mt-1 w-full px-3 py-2 border rounded-lg"
                                    style={{ borderColor: "#F5E4C0" }}
                                />
                            </div>
                        ))}
                    </div>
                </div>

                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="w-full h-12 rounded-xl text-white font-bold inline-flex items-center justify-center gap-2 disabled:opacity-50"
                    style={{ background: "#E4B05E" }}
                >
                    {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : saved ? <><Check className="h-5 w-5" /> Saved</> : "Save changes"}
                </button>
                <p className="text-center text-xs" style={{ color: "#71717a" }}>
                    Need a bigger change, or help? Reply to any Tendso email and our team will assist.
                </p>
            </div>
        </div>
    );
}
