"use client";

import { useUser } from "@clerk/nextjs";
import { useConvex, useMutation, useQuery } from "convex/react";
import { ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";

import { FootActions, FunnelFrame, StepBody, StepCard } from "@/app/training/_funnel/FunnelFrame";
import { Button, Field, Icon, Input, PhoneInput } from "@/components/r1";
import { api } from "@/convex/_generated/api";

/**
 * Onboarding profile (board Certification, stage 1 "Your profile"): the
 * creators row is made here, then training starts.
 *
 * The same mutation and fields as before (api.creators.create with first,
 * middle and last name, the Clerk email, an optional phone and a generated
 * referral code), plus the board's optional "Referral code" field, which
 * create() already takes as referredByCode.
 */

function generateReferralCode(firstName: string, lastName: string): string {
    const namePrefix = (firstName.substring(0, 2) + lastName.substring(0, 1)).toUpperCase();
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `${namePrefix}${random}`;
}

export default function OnboardingPage() {
    const router = useRouter();
    const { user, isLoaded, isSignedIn } = useUser();
    const existingCreator = useQuery(api.creators.getByClerkId, user ? { clerkId: user.id } : "skip");

    useEffect(() => {
        if (isLoaded && !isSignedIn) {
            router.push("/login");
        }
    }, [isLoaded, isSignedIn, router]);

    useEffect(() => {
        if (isLoaded && isSignedIn && existingCreator) {
            router.push("/dashboard");
        }
    }, [isLoaded, isSignedIn, existingCreator, router]);

    // Suppress the form UI while ANY of the following is true:
    //   - Clerk is still hydrating (isLoaded === false)
    //   - User is not signed in (about to redirect to /login)
    //   - Convex query for the creator profile is still in flight (existingCreator === undefined)
    //   - A creator profile already exists (about to redirect to /dashboard)
    //
    // Without this guard, returning users coming through Google OAuth see the
    // onboarding form for ~200ms before the dashboard-redirect useEffect fires,
    // which is the "flash of old onboarding page" we're fixing. (Nor do they
    // see the certification frame: the page stays blank until it knows.)
    const isRedirecting = !isLoaded || !isSignedIn || existingCreator === undefined || existingCreator !== null;

    if (isRedirecting || !user) {
        return (
            <div className="r1 min-h-dvh" aria-busy="true">
                <span className="sr-only" role="status">
                    Loading
                </span>
            </div>
        );
    }

    return (
        <FunnelFrame view={1} creator={null}>
            <ProfileStep
                clerkId={user.id}
                email={user.primaryEmailAddress?.emailAddress}
                firstName={user.firstName ?? ""}
                lastName={user.lastName ?? ""}
            />
        </FunnelFrame>
    );
}

type Errors = { first?: string; last?: string; phone?: string; ref?: string };

// The old check, unchanged: an 11-digit 09… number, the 10-digit 9… form the
// old field took, or +63. The field only lets digits through.
const PHONE_RE = /^(\+63|0)?9\d{9}$/;

/** Mounted once the account is known, so the Clerk name fills the fields from the first paint. */
function ProfileStep({ clerkId, email, firstName, lastName }: { clerkId: string; email?: string; firstName: string; lastName: string }) {
    const router = useRouter();
    const convex = useConvex();
    const createCreator = useMutation(api.creators.create);

    const [first, setFirst] = useState(firstName);
    const [middle, setMiddle] = useState("");
    const [last, setLast] = useState(lastName);
    const [phone, setPhone] = useState("");
    const [refCode, setRefCode] = useState("");
    const [errors, setErrors] = useState<Errors>({});
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const firstRef = useRef<HTMLInputElement>(null);
    const lastRef = useRef<HTMLInputElement>(null);
    const phoneRef = useRef<HTMLInputElement>(null);
    const refRef = useRef<HTMLInputElement>(null);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (loading) return;
        setError(null);

        const next: Errors = {};
        if (!first.trim()) next.first = "Enter your first name.";
        if (!last.trim()) next.last = "Enter your last name.";
        if (phone && !PHONE_RE.test(phone.replace(/\s/g, ""))) next.phone = "Use 11 digits starting with 09, like 09171234567.";
        setErrors(next);
        if (next.first || next.last || next.phone) {
            (next.first ? firstRef : next.last ? lastRef : phoneRef).current?.focus();
            return;
        }

        setLoading(true);
        try {
            // create() keeps whatever code it is given, even one that matches
            // nobody, and a creator can apply a code only once. So a typo here
            // would block the right code later: look it up first.
            const code = refCode.trim().toUpperCase();
            if (code) {
                let referrer: unknown;
                try {
                    referrer = await convex.query(api.creators.getByReferralCode, { referralCode: code });
                } catch {
                    setErrors({ ref: "We could not check that code. Try again, or leave it empty." });
                    refRef.current?.focus();
                    return;
                }
                if (!referrer) {
                    setErrors({ ref: "No creator has that code. Check it with the person who invited you, or leave it empty." });
                    refRef.current?.focus();
                    return;
                }
            }

            const referralCode = generateReferralCode(first, last);
            await createCreator({
                clerkId,
                firstName: first.trim(),
                middleName: middle.trim() || undefined,
                lastName: last.trim(),
                email,
                phone: phone.trim() || undefined,
                referralCode,
                referredByCode: code || undefined,
            });

            router.push("/training");
        } catch (err) {
            console.error("Failed to create profile:", err);
            setError(err instanceof Error && err.message ? err.message : "Your profile was not saved. Try again.");
        } finally {
            setLoading(false);
        }
    };

    const optional = <span className="font-normal text-r1-ink-3">(optional)</span>;

    return (
        <form onSubmit={handleSubmit} noValidate>
            <StepCard
                title="Your profile"
                intro="Tell us who you are. This is the name that goes on your certificate."
                foot={
                    <>
                        <span className="t-meta">Your own referral code is made for you when you save.</span>
                        <FootActions>
                            <Button variant="primary" type="submit" disabled={loading} aria-busy={loading}>
                                {loading ? (
                                    "Saving…"
                                ) : (
                                    <>
                                        Save and continue
                                        <Icon icon={ArrowRight} />
                                    </>
                                )}
                            </Button>
                        </FootActions>
                    </>
                }
            >
                <StepBody>
                    <div className="grid grid-cols-1 gap-x-4 gap-y-5 sm:grid-cols-2">
                        <Field label="First name" required error={errors.first}>
                            <Input
                                ref={firstRef}
                                placeholder="Juan"
                                autoComplete="given-name"
                                value={first}
                                disabled={loading}
                                onChange={(e) => {
                                    setFirst(e.target.value);
                                    setErrors((x) => ({ ...x, first: undefined }));
                                }}
                            />
                        </Field>
                        <Field label={<>Middle name {optional}</>}>
                            <Input
                                placeholder="Santos"
                                autoComplete="additional-name"
                                value={middle}
                                disabled={loading}
                                onChange={(e) => setMiddle(e.target.value)}
                            />
                        </Field>
                        <Field label="Last name" required error={errors.last} className="sm:col-span-2">
                            <Input
                                ref={lastRef}
                                placeholder="Dela Cruz"
                                autoComplete="family-name"
                                value={last}
                                disabled={loading}
                                onChange={(e) => {
                                    setLast(e.target.value);
                                    setErrors((x) => ({ ...x, last: undefined }));
                                }}
                            />
                        </Field>
                        <Field
                            label={<>Mobile number {optional}</>}
                            error={errors.phone}
                            help={phone ? `Digits only, starting with 0. ${phone.length} of 11 digits.` : "Digits only, starting with 0. 11 digits."}
                        >
                            <PhoneInput
                                ref={phoneRef}
                                placeholder="09171234567"
                                autoComplete="tel-national"
                                value={phone}
                                disabled={loading}
                                onValueChange={(digits) => {
                                    setPhone(digits);
                                    setErrors((x) => ({ ...x, phone: undefined }));
                                }}
                            />
                        </Field>
                        <Field label={<>Referral code {optional}</>} error={errors.ref} help="From the creator who invited you.">
                            <Input
                                ref={refRef}
                                placeholder="e.g. JUD8A3BK"
                                autoComplete="off"
                                autoCapitalize="characters"
                                spellCheck={false}
                                value={refCode}
                                disabled={loading}
                                onChange={(e) => {
                                    // Upper case and no spaces, nothing more: codes are made from
                                    // name letters (see generateReferralCode), so a "." or an "Ñ"
                                    // can be part of a real one.
                                    setRefCode(e.target.value.toUpperCase().replace(/\s+/g, "").slice(0, 16));
                                    setErrors((x) => ({ ...x, ref: undefined }));
                                }}
                            />
                        </Field>
                    </div>
                    {error && (
                        <p className="t-error" role="alert">
                            {error}
                        </p>
                    )}
                </StepBody>
            </StepCard>
        </form>
    );
}
