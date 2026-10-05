"use client";

import { useId, useState, type FormEvent } from "react";
import { useSignIn } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check } from "lucide-react";

import { Button, ButtonLink, Field, Icon, Input, PasswordInput, buttonClass } from "@/components/r1";
import { AUTH_BODY, AuthFrame } from "@/app/auth/_components/AuthFrame";
import { AuthAlert, ButtonSpinner, PasswordStrength } from "@/app/auth/_components/AuthParts";
import { clerkField, clerkLongMessage, clerkMessage, emailProblem, maskEmail, passwordStrength } from "@/app/auth/_components/authLogic";

/**
 * Forgot password (board: SignIn, "Forgot" steps 1 and 2, then "Password
 * changed"). /reset-password redirects here.
 *
 * The same Clerk reset as before: signIn.create with reset_password_email_code
 * sends the 6-digit code (and sends it again), attemptFirstFactor takes the
 * code and the new password, setActive signs the person in, and two seconds
 * later they are taken to /dashboard.
 *
 * One field fewer than the old page: no "confirm new password". The board
 * gives the new-password field its own eye instead, so a typo can be seen
 * rather than guarded against twice.
 */
export default function ForgotPasswordPage() {
    const router = useRouter();
    const { signIn, setActive, isLoaded } = useSignIn();

    const [step, setStep] = useState<"email" | "code">("email");
    const [email, setEmail] = useState("");
    const [code, setCode] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [loading, setLoading] = useState(false);
    // A Clerk message about no one field (too many tries, a lost connection…).
    const [error, setError] = useState<string | null>(null);
    // Messages under the fields: the board's own checks, or Clerk's message
    // when Clerk names the field it is about.
    const [emailError, setEmailError] = useState<string>();
    const [codeError, setCodeError] = useState<string>();
    const [passwordError, setPasswordError] = useState<string>();
    const [resending, setResending] = useState(false);
    const [resent, setResent] = useState(false);
    const [success, setSuccess] = useState(false);

    const passwordId = useId();
    const strength = passwordStrength(newPassword);

    /** Put Clerk's message under the field it names, or in the box at the top. */
    const showClerkError = (err: unknown, fallback: string) => {
        const message = clerkMessage(err, fallback);
        const field = clerkField(err);
        if (step === "email" && (field === "identifier" || field === "email_address")) setEmailError(message);
        else if (step === "code" && field === "code") setCodeError(message);
        else if (step === "code" && field === "password") setPasswordError(message);
        else setError(message);
    };

    const handleSendCode = async (e: FormEvent) => {
        e.preventDefault();
        // The old button stayed disabled until something was typed; the board
        // leaves it pressable and says what is wrong under the field.
        const emailIssue = emailProblem(email);
        if (emailIssue) {
            setEmailError(emailIssue);
            setError(null);
            return;
        }
        if (!isLoaded || !signIn) return;
        setError(null);
        setEmailError(undefined);
        setLoading(true);

        try {
            await signIn.create({
                strategy: "reset_password_email_code",
                identifier: email,
            });
            setCode("");
            setNewPassword("");
            setCodeError(undefined);
            setPasswordError(undefined);
            setResent(false);
            setStep("code");
        } catch (err) {
            showClerkError(err, "Failed to send reset code");
        } finally {
            setLoading(false);
        }
    };

    const handleResetPassword = async (e: FormEvent) => {
        e.preventDefault();
        // The old page kept the button disabled until the code had six digits
        // and the password eight characters; the board leaves it pressable and
        // says what is missing under the field instead.
        const codeIssue = !code ? "Enter the code from the email." : !/^\d{6}$/.test(code) ? "The code has 6 digits." : "";
        const passwordIssue = !newPassword ? "Choose a new password." : newPassword.length < 8 ? "Use at least 8 characters." : "";
        if (codeIssue || passwordIssue) {
            setCodeError(codeIssue || undefined);
            setPasswordError(passwordIssue || undefined);
            setError(null);
            return;
        }
        if (!isLoaded || !signIn) return;
        setError(null);
        setCodeError(undefined);
        setPasswordError(undefined);
        setLoading(true);

        try {
            const result = await signIn.attemptFirstFactor({
                strategy: "reset_password_email_code",
                code,
                password: newPassword,
            });

            if (result.status === "complete" && result.createdSessionId) {
                await setActive({ session: result.createdSessionId });
                setSuccess(true);
                setTimeout(() => router.push("/dashboard"), 2000);
            }
        } catch (err) {
            showClerkError(err, "Failed to reset password");
        } finally {
            setLoading(false);
        }
    };

    const handleResendCode = async () => {
        if (!isLoaded || !signIn) return;
        setError(null);
        setResent(false);
        setResending(true);
        try {
            await signIn.create({
                strategy: "reset_password_email_code",
                identifier: email,
            });
            setCodeError(undefined);
            setResent(true);
        } catch (err) {
            setError(clerkLongMessage(err) || "Failed to resend code");
        } finally {
            setResending(false);
        }
    };

    const changeEmail = () => {
        setStep("email");
        setError(null);
        setEmailError(undefined);
        setResent(false);
    };

    if (success) {
        return (
            <AuthFrame title="Password changed" sub="You are signed in with your new password.">
                <div className="flex flex-col items-center gap-4 px-6 py-10 text-center sm:px-8">
                    <span className="flex size-12 items-center justify-center rounded-full border-[1.5px] border-r1-ink text-r1-ink">
                        <Icon icon={Check} size={20} />
                    </span>
                    <p className="t-body">Use it next time you sign in.</p>
                    {/* A full load, not a client transition: the session was set a
                        moment ago, and only a fresh page is sure to see it (see
                        the note in app/login/page.tsx). The timer above still
                        takes them there on its own. */}
                    <a href="/dashboard" className={buttonClass({ variant: "primary", size: "lg", block: true })}>
                        Go to Home
                    </a>
                </div>
            </AuthFrame>
        );
    }

    if (step === "email") {
        return (
            <AuthFrame title="Reset your password" sub="We will email you a 6-digit code.">
                {/* Keyed per step, so step 2 mounts fresh fields (and its
                    autoFocus runs) instead of reusing step 1's inputs. */}
                <form key="email" onSubmit={handleSendCode} noValidate className={AUTH_BODY}>
                    <ButtonLink href="/login" variant="ghost" size="sm" className="-ml-2 self-start">
                        <Icon icon={ArrowLeft} />
                        Back to sign in
                    </ButtonLink>
                    {error && <AuthAlert>{error}</AuthAlert>}

                    <Field label="Email" error={emailError}>
                        <Input
                            type="email"
                            autoComplete="email"
                            placeholder="you@gmail.com"
                            value={email}
                            onChange={(e) => {
                                setEmail(e.target.value);
                                setEmailError(undefined);
                            }}
                            disabled={loading}
                            required
                        />
                    </Field>

                    <Button type="submit" variant="primary" size="lg" block disabled={loading}>
                        {loading ? (
                            <>
                                <ButtonSpinner />
                                Sending…
                            </>
                        ) : (
                            "Send code"
                        )}
                    </Button>
                </form>
            </AuthFrame>
        );
    }

    return (
        <AuthFrame title="Check your email" sub={`We sent a 6-digit code to ${maskEmail(email)}.`}>
            <form key="code" onSubmit={handleResetPassword} noValidate className={AUTH_BODY}>
                <Button variant="ghost" size="sm" className="-ml-2 self-start" onClick={changeEmail}>
                    <Icon icon={ArrowLeft} />
                    Use a different email
                </Button>
                {error && <AuthAlert>{error}</AuthAlert>}

                <Field label="6-digit code" help="Numbers only, from the email we just sent." error={codeError}>
                    <Input
                        type="text"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        placeholder="000000"
                        value={code}
                        // Digits only, and at most six, kept here rather than with
                        // maxLength: a pasted "123 456" would otherwise be cut to
                        // "123 45" before the space could be dropped.
                        onChange={(e) => {
                            setCode(e.target.value.replace(/\D/g, "").slice(0, 6));
                            setCodeError(undefined);
                        }}
                        disabled={loading}
                        required
                        // The code is the next thing to type, so the keyboard
                        // comes up with this step.
                        autoFocus
                        className="h-12 pl-5 text-center font-r1-mono text-[22px] tracking-[0.5em]"
                    />
                </Field>

                {/* Built by hand rather than with <Field>: the meter and an error
                    can show together, where <Field> lets an error replace its
                    help. */}
                <div className="t-field">
                    <label className="t-field-label" htmlFor={passwordId}>
                        New password
                    </label>
                    <PasswordInput
                        id={passwordId}
                        aria-describedby={`${passwordId}-help`}
                        aria-invalid={passwordError ? true : undefined}
                        autoComplete="new-password"
                        placeholder="At least 8 characters"
                        value={newPassword}
                        onChange={(e) => {
                            setNewPassword(e.target.value);
                            setPasswordError(undefined);
                        }}
                        disabled={loading}
                        required
                    />
                    <div id={`${passwordId}-help`} className="flex flex-col gap-1.5">
                        <PasswordStrength strength={strength} />
                        {passwordError && <p className="t-error">{passwordError}</p>}
                        {strength.level === 0 && !passwordError && <p className="t-help">At least 8 characters. Tap the eye to check what you typed.</p>}
                    </div>
                </div>

                <Button type="submit" variant="primary" size="lg" block disabled={loading}>
                    {loading ? (
                        <>
                            <ButtonSpinner />
                            Saving…
                        </>
                    ) : (
                        "Save new password"
                    )}
                </Button>

                <div className="flex flex-col items-center gap-1">
                    <div className="flex flex-wrap items-center justify-center gap-1">
                        <span className="t-meta">No email?</span>
                        <Button variant="ghost" size="sm" onClick={handleResendCode} disabled={resending || loading}>
                            Send a new code
                        </Button>
                    </div>
                    {/* Always in the page, so the line is announced when it fills. */}
                    <p className="t-meta text-center" role="status">
                        {resent ? "New code sent. Check spam if it is not there in a minute." : ""}
                    </p>
                </div>
            </form>
        </AuthFrame>
    );
}
