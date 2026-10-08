"use client";

import { SignUp, useUser } from "@clerk/nextjs";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";

import { AUTH_BODY, AuthFrame } from "@/app/auth/_components/AuthFrame";
import { AuthAlert } from "@/app/auth/_components/AuthParts";
import { Button, Field, Icon, Input, Loading, PhoneInput, Skeleton } from "@/components/r1";
import { api } from "@/convex/_generated/api";
import { AFFILIATE_HANDLE_MAX_LENGTH, AFFILIATE_HANDLE_MIN_LENGTH, affiliateHandleError, affiliatePhoneError } from "@/lib/affiliates";

import { AffiliateAccountLoading, DifferentAccount } from "../_components/AccountState";

export default function AffiliateJoinPage() {
    const router = useRouter();
    const { user, isLoaded, isSignedIn } = useUser();
    const { isAuthenticated } = useConvexAuth();
    const account = useQuery(api.creators.getByClerkId, user && isAuthenticated ? { clerkId: user.id } : "skip");
    const owner = useQuery(api.businessOwners.me, user && isAuthenticated ? {} : "skip");

    useEffect(() => {
        if (account?.role === "affiliate") router.replace("/affiliates/dashboard");
    }, [account?.role, router]);

    if (!isLoaded || (isSignedIn && (!isAuthenticated || account === undefined || (account === null && owner === undefined) || account?.role === "affiliate"))) {
        return <AffiliateAccountLoading />;
    }

    if (!isSignedIn || !user) {
        return (
            <AuthFrame title="Create an affiliate account" sub="First, create your login. Then choose your page handle.">
                <div className={AUTH_BODY}>
                    <SignUp
                        routing="hash"
                        forceRedirectUrl="/affiliates/join"
                        signInUrl="/login"
                        appearance={{
                            layout: { logoPlacement: "none" },
                            elements: {
                                rootBox: { width: "100%" },
                                cardBox: { width: "100%", maxWidth: "none", border: "none", borderRadius: "0", boxShadow: "none" },
                                card: { width: "100%", padding: "0", gap: "16px", border: "none", borderRadius: "0", boxShadow: "none", backgroundColor: "transparent" },
                                headerTitle: { display: "none" },
                                headerSubtitle: { display: "none" },
                                socialButtonsBlockButton__tiktok: { display: "none" },
                                socialButtonsIconButton__tiktok: { display: "none" },
                            },
                        }}
                        fallback={
                            <Loading label="Loading the sign-up form">
                                <div className="flex flex-col gap-4">
                                    <Skeleton height={40} />
                                    <Skeleton height={40} />
                                    <Skeleton height={48} />
                                </div>
                            </Loading>
                        }
                    />
                    <p className="t-meta text-center">
                        By creating an account you agree to the <Link href="/terms-of-service" className="t-link">Terms</Link> and <Link href="/privacy-policy" className="t-link">Privacy Policy</Link>.
                    </p>
                    <p className="t-meta text-center">Already a creator? Use a different email for your affiliate account.</p>
                </div>
            </AuthFrame>
        );
    }

    if (account) return <DifferentAccount role={account.role} />;
    if (owner) return <DifferentAccount role="owner" />;

    return <AffiliateProfile name={user.fullName ?? ""} email={user.primaryEmailAddress?.emailAddress} />;
}

type FieldErrors = { name?: string; phone?: string; handle?: string };

function AffiliateProfile({ name: initialName, email }: { name: string; email?: string }) {
    const router = useRouter();
    const createAffiliate = useMutation(api.affiliates.create);
    const [name, setName] = useState(initialName);
    const [phone, setPhone] = useState("");
    const [handle, setHandle] = useState("");
    const [errors, setErrors] = useState<FieldErrors>({});
    const [error, setError] = useState<string>();
    const [saving, setSaving] = useState(false);
    const nameRef = useRef<HTMLInputElement>(null);
    const phoneRef = useRef<HTMLInputElement>(null);
    const handleRef = useRef<HTMLInputElement>(null);

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (saving) return;
        setError(undefined);

        const next: FieldErrors = {
            name: !name.trim() ? "Enter your name." : name.trim().length > 100 ? "Use a name of 100 characters or fewer." : undefined,
            phone: affiliatePhoneError(phone) ?? undefined,
            handle: affiliateHandleError(handle) ?? undefined,
        };
        setErrors(next);
        if (next.name || next.phone || next.handle) {
            (next.name ? nameRef : next.phone ? phoneRef : handleRef).current?.focus();
            return;
        }
        if (!email) {
            setError("Add an email address to your login before creating your affiliate account.");
            return;
        }

        setSaving(true);
        try {
            await createAffiliate({ email, firstName: name.trim(), phone, handle });
            router.replace("/affiliates/dashboard");
        } catch (err) {
            setError(err instanceof ConvexError && typeof err.data === "string" ? err.data : "Your account was not saved. Please try again.");
            setSaving(false);
        }
    }

    return (
        <AuthFrame title="Your affiliate profile" sub="Choose the handle for your page. Your account is active when you save.">
            <form className={AUTH_BODY} onSubmit={handleSubmit} noValidate>
                {error && <AuthAlert>{error}</AuthAlert>}
                <Field label="Name" required error={errors.name}>
                    <Input ref={nameRef} value={name} autoComplete="name" maxLength={100} disabled={saving} onChange={(event) => {
                        setName(event.target.value);
                        setErrors((current) => ({ ...current, name: undefined }));
                    }} />
                </Field>
                <Field label="Mobile number" required help="11 digits starting with 09, like 09171234567." error={errors.phone}>
                    <PhoneInput ref={phoneRef} value={phone} placeholder="09171234567" disabled={saving} onValueChange={(value) => {
                        setPhone(value);
                        setErrors((current) => ({ ...current, phone: undefined }));
                    }} />
                </Field>
                <Field label="Page handle" required help={`${AFFILIATE_HANDLE_MIN_LENGTH}–${AFFILIATE_HANDLE_MAX_LENGTH} lowercase letters or numbers, with hyphens between words. Some names are reserved.`} error={errors.handle}>
                    <Input ref={handleRef} value={handle} placeholder="your-name" autoComplete="off" autoCapitalize="none" spellCheck={false} maxLength={AFFILIATE_HANDLE_MAX_LENGTH} disabled={saving} onChange={(event) => {
                        setHandle(event.target.value.toLowerCase());
                        setErrors((current) => ({ ...current, handle: undefined }));
                    }} />
                </Field>
                <p className="t-meta">Your own creator referral code is made for you when you save.</p>
                <Button variant="primary" size="lg" block type="submit" disabled={saving} aria-busy={saving}>
                    {saving ? "Saving…" : <>Create affiliate account <Icon icon={ArrowRight} /></>}
                </Button>
            </form>
        </AuthFrame>
    );
}
