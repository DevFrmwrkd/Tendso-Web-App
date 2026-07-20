"use client";

import { useState } from "react";
import { useSignIn } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { motion } from "framer-motion";
import { ArrowLeft, Loader2, Mail, Lock, Eye, EyeOff, Check, X } from "lucide-react";
import Logo from "@/public/tendso-logo.png";

function getPasswordStrength(pw: string): { level: number; label: string; color: string } {
    if (pw.length < 8) return { level: 1, label: "Weak", color: "bg-red-500" };
    const hasUpper = /[A-Z]/.test(pw);
    const hasLower = /[a-z]/.test(pw);
    const hasNumber = /\d/.test(pw);
    const hasSpecial = /[^A-Za-z0-9]/.test(pw);
    const mixedCase = hasUpper && hasLower;
    if (mixedCase && hasNumber && hasSpecial) return { level: 4, label: "Strong", color: "bg-[var(--rust)]" };
    if ((mixedCase && hasNumber) || (mixedCase && hasSpecial)) return { level: 3, label: "Good", color: "bg-[var(--rust-soft)]" };
    return { level: 2, label: "Fair", color: "bg-amber-500" };
}

const GRAIN_BG =
    "radial-gradient(circle at 25% 25%, var(--ink) 0.5px, transparent 1px), radial-gradient(circle at 75% 75%, var(--ink) 0.5px, transparent 1px)";

export default function ForgotPasswordPage() {
    const router = useRouter();
    const { signIn, setActive, isLoaded } = useSignIn();

    const [step, setStep] = useState<"email" | "code">("email");
    const [email, setEmail] = useState("");
    const [code, setCode] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const strength = getPasswordStrength(newPassword);
    const passwordsMatch = newPassword.length > 0 && confirmPassword.length > 0 && newPassword === confirmPassword;

    const handleSendCode = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!isLoaded || !signIn) return;
        setError(null);
        setLoading(true);

        try {
            await signIn.create({
                strategy: "reset_password_email_code",
                identifier: email,
            });
            setStep("code");
        } catch (err: any) {
            setError(err.errors?.[0]?.longMessage || err.message || "Failed to send reset code");
        } finally {
            setLoading(false);
        }
    };

    const handleResetPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!isLoaded || !signIn) return;
        setError(null);

        if (newPassword.length < 8) {
            setError("Password must be at least 8 characters");
            return;
        }
        if (newPassword !== confirmPassword) {
            setError("Passwords do not match");
            return;
        }

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
        } catch (err: any) {
            setError(err.errors?.[0]?.longMessage || err.message || "Failed to reset password");
        } finally {
            setLoading(false);
        }
    };

    const handleResendCode = async () => {
        if (!isLoaded || !signIn) return;
        setError(null);
        try {
            await signIn.create({
                strategy: "reset_password_email_code",
                identifier: email,
            });
        } catch (err: any) {
            setError(err.errors?.[0]?.longMessage || "Failed to resend code");
        }
    };

    if (success) {
        return (
            <div
                className="min-h-screen flex flex-col items-center justify-center px-6 text-center relative overflow-hidden"
                style={{ background: "var(--khaki)", color: "var(--ink)" }}
            >
                <div
                    className="absolute inset-0 opacity-[0.04] pointer-events-none mix-blend-multiply"
                    style={{ backgroundImage: GRAIN_BG, backgroundSize: "4px 4px, 6px 6px" }}
                />
                <div className="absolute -top-32 -right-20 w-[480px] h-[480px] bg-[var(--rust)]/10 rounded-full filter blur-[120px] pointer-events-none" />
                <motion.div
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: "spring", stiffness: 300, damping: 22 }}
                    className="relative z-10 w-20 h-20 bg-[var(--khaki-deep)] border-2 border-[var(--rust)] rounded-full flex items-center justify-center mb-6 shadow-lg shadow-[var(--rust)]/25"
                >
                    <Check className="w-10 h-10 text-[var(--rust)]" />
                </motion.div>
                <h1
                    className="relative z-10 font-bold tracking-[-0.01em] text-[var(--ink)] mb-3 leading-[1.05]"
                    style={{
                        fontFamily: "var(--font-playfair)",
                        fontSize: "clamp(2.5rem, 5vw, 3.5rem)",
                    }}
                >
                    Password <span className="italic" style={{ color: "var(--rust)" }}>reset.</span>
                </h1>
                <p
                    className="relative z-10 text-[var(--ink)]/60 max-w-sm leading-relaxed italic"
                    style={{
                        fontFamily: "var(--font-playfair)",
                        fontSize: "1.1rem",
                    }}
                >
                    You&apos;re signed in. Redirecting you to your dashboard…
                </p>
            </div>
        );
    }

    return (
        <div
            className="min-h-screen w-full overflow-x-hidden relative flex items-start sm:items-center justify-center px-6 py-12"
            style={{ background: "var(--khaki)", color: "var(--ink)" }}
        >
            <div
                className="absolute inset-0 opacity-[0.04] pointer-events-none mix-blend-multiply"
                style={{ backgroundImage: GRAIN_BG, backgroundSize: "4px 4px, 6px 6px" }}
            />
            <div className="absolute -top-32 -right-20 w-[480px] h-[480px] bg-[var(--rust)]/8 rounded-full filter blur-[120px] pointer-events-none" />
            <div className="absolute -bottom-40 -left-32 w-[520px] h-[520px] bg-[var(--rust-soft)]/12 rounded-full filter blur-[140px] pointer-events-none" />

            {/* BACK NAVIGATION */}
            <button
                onClick={() => (step === "code" ? setStep("email") : router.push("/login"))}
                className="absolute top-6 left-6 md:top-10 md:left-10 flex items-center gap-2.5 text-[var(--ink)]/70 hover:text-[var(--rust)] transition-colors group z-20"
            >
                <span className="w-9 h-9 rounded-full border border-[var(--ink)]/15 bg-[var(--khaki-deep)] flex items-center justify-center shadow-sm group-hover:border-[var(--rust)]/50 transition-colors">
                    <ArrowLeft className="w-4 h-4" />
                </span>
                <span className="font-semibold tracking-wide text-sm">
                    {step === "code" ? "Use a different email" : "Back to login"}
                </span>
            </button>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="w-full max-w-md mt-16 sm:mt-0 relative z-10"
            >
                <div className="flex items-center gap-3 mb-8 justify-center">
                    <span className="h-px w-10 bg-[var(--rust)]/40" />
                    <p
                        className="text-[10px] uppercase tracking-[0.4em] font-medium text-[var(--rust)]"
                        style={{ fontFamily: "var(--font-mono)" }}
                    >
                        ACCESS — RECOVERY
                    </p>
                    <span className="h-px w-10 bg-[var(--rust)]/40" />
                </div>

                <div className="flex flex-col items-center mb-8">
                    <Image src={Logo} alt="Tendso" width={170} height={31} className="mb-6 invert" />
                    <h1
                        style={{
                            fontFamily: "var(--font-playfair)",
                            fontSize: "clamp(2.25rem, 5vw, 3rem)",
                        }}
                        className="font-bold tracking-[-0.01em] text-center text-[var(--ink)] mb-2 leading-[1.05]"
                    >
                        Reset your <span className="italic" style={{ color: "var(--rust)" }}>password.</span>
                    </h1>
                    <p
                        className="text-[var(--ink)]/60 text-center italic max-w-xs leading-relaxed"
                        style={{
                            fontFamily: "var(--font-playfair)",
                            fontSize: "1.05rem",
                        }}
                    >
                        {step === "email"
                            ? "Enter your email and we'll send you a 6-digit code."
                            : `We sent a code to ${email}. Enter it below.`}
                    </p>
                </div>

                <div className="bg-[var(--khaki-deep)] border border-[var(--ink)]/15 p-7 sm:p-8 rounded-3xl shadow-xl shadow-[var(--ink)]/10">
                    {error && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            className="mb-5 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm text-center"
                            role="alert"
                        >
                            {error}
                        </motion.div>
                    )}

                    {step === "email" ? (
                        <form onSubmit={handleSendCode} className="space-y-5">
                            <div className="space-y-1.5">
                                <label
                                    htmlFor="email"
                                    className="text-[10px] uppercase tracking-[0.3em] font-bold text-[var(--ink)]/70 px-1 block"
                                    style={{ fontFamily: "var(--font-mono)" }}
                                >
                                    Email address
                                </label>
                                <div className="relative group">
                                    <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                        <Mail className="w-4 h-4 text-[var(--ink)]/40 group-focus-within:text-[var(--rust)] transition-colors" />
                                    </span>
                                    <input
                                        id="email"
                                        type="email"
                                        placeholder="you@example.com"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        required
                                        disabled={loading}
                                        autoComplete="email"
                                        className="w-full h-12 pl-10 pr-4 bg-[var(--khaki)] border border-[var(--ink)]/15 rounded-xl text-[var(--ink)] placeholder:text-[var(--ink)]/40 focus:outline-none focus:border-[var(--rust)] focus:ring-1 focus:ring-[var(--rust)] transition-colors text-[15px]"
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading || !email}
                                className="w-full h-12 bg-[var(--ink)] hover:bg-[var(--rust)] disabled:opacity-60 text-[var(--khaki)] rounded-xl font-semibold text-base transition-colors flex items-center justify-center gap-2 mt-2 shadow-md shadow-[var(--ink)]/20"
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="animate-spin h-5 w-5" /> Sending…
                                    </>
                                ) : (
                                    "Send reset code"
                                )}
                            </button>
                        </form>
                    ) : (
                        <form onSubmit={handleResetPassword} className="space-y-5">
                            <div className="space-y-1.5">
                                <label
                                    htmlFor="code"
                                    className="text-[10px] uppercase tracking-[0.3em] font-bold text-[var(--ink)]/70 px-1 block"
                                    style={{ fontFamily: "var(--font-mono)" }}
                                >
                                    Verification code
                                </label>
                                <input
                                    id="code"
                                    type="text"
                                    inputMode="numeric"
                                    maxLength={6}
                                    placeholder="······"
                                    value={code}
                                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                                    required
                                    disabled={loading}
                                    autoComplete="one-time-code"
                                    className="w-full h-14 bg-[var(--khaki)] border border-[var(--ink)]/15 rounded-xl text-[var(--ink)] placeholder:text-[var(--ink)]/30 focus:outline-none focus:border-[var(--rust)] focus:ring-1 focus:ring-[var(--rust)] transition-colors text-center text-2xl tracking-[0.6em] font-semibold"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label
                                    htmlFor="newPassword"
                                    className="text-[10px] uppercase tracking-[0.3em] font-bold text-[var(--ink)]/70 px-1 block"
                                    style={{ fontFamily: "var(--font-mono)" }}
                                >
                                    New password
                                </label>
                                <div className="relative group">
                                    <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                        <Lock className="w-4 h-4 text-[var(--ink)]/40 group-focus-within:text-[var(--rust)] transition-colors" />
                                    </span>
                                    <input
                                        id="newPassword"
                                        type={showPassword ? "text" : "password"}
                                        placeholder="At least 8 characters"
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        required
                                        disabled={loading}
                                        autoComplete="new-password"
                                        className="w-full h-12 pl-10 pr-11 bg-[var(--khaki)] border border-[var(--ink)]/15 rounded-xl text-[var(--ink)] placeholder:text-[var(--ink)]/40 focus:outline-none focus:border-[var(--rust)] focus:ring-1 focus:ring-[var(--rust)] transition-colors text-[15px]"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center text-[var(--ink)]/40 hover:text-[var(--ink)] transition-colors"
                                        aria-label={showPassword ? "Hide password" : "Show password"}
                                    >
                                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                                {newPassword.length > 0 && (
                                    <div className="mt-2 px-1 space-y-1.5">
                                        <div className="flex gap-1.5">
                                            {[1, 2, 3, 4].map((i) => (
                                                <div
                                                    key={i}
                                                    className={`h-1.5 flex-1 rounded-full transition-colors ${i <= strength.level ? strength.color : "bg-[var(--ink)]/15"
                                                        }`}
                                                />
                                            ))}
                                        </div>
                                        <p
                                            className="text-[10px] uppercase tracking-[0.3em] font-semibold text-[var(--ink)]/65"
                                            style={{ fontFamily: "var(--font-mono)" }}
                                        >
                                            {strength.label}
                                        </p>
                                    </div>
                                )}
                            </div>

                            <div className="space-y-1.5">
                                <label
                                    htmlFor="confirmPassword"
                                    className="text-[10px] uppercase tracking-[0.3em] font-bold text-[var(--ink)]/70 px-1 block"
                                    style={{ fontFamily: "var(--font-mono)" }}
                                >
                                    Confirm new password
                                </label>
                                <div className="relative group">
                                    <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                        <Lock className="w-4 h-4 text-[var(--ink)]/40 group-focus-within:text-[var(--rust)] transition-colors" />
                                    </span>
                                    <input
                                        id="confirmPassword"
                                        type={showPassword ? "text" : "password"}
                                        placeholder="Re-enter your password"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        required
                                        disabled={loading}
                                        autoComplete="new-password"
                                        className="w-full h-12 pl-10 pr-4 bg-[var(--khaki)] border border-[var(--ink)]/15 rounded-xl text-[var(--ink)] placeholder:text-[var(--ink)]/40 focus:outline-none focus:border-[var(--rust)] focus:ring-1 focus:ring-[var(--rust)] transition-colors text-[15px]"
                                    />
                                </div>
                                {confirmPassword.length > 0 && (
                                    <div className="flex items-center gap-1.5 text-xs font-semibold mt-2 px-1">
                                        {passwordsMatch ? (
                                            <>
                                                <Check className="w-3.5 h-3.5 text-[var(--rust)]" />
                                                <span className="text-[var(--rust)]">Passwords match</span>
                                            </>
                                        ) : (
                                            <>
                                                <X className="w-3.5 h-3.5 text-red-500" />
                                                <span className="text-red-600">Passwords don&apos;t match</span>
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>

                            <button
                                type="submit"
                                disabled={loading || code.length !== 6 || !passwordsMatch}
                                className="w-full h-12 bg-[var(--ink)] hover:bg-[var(--rust)] disabled:opacity-50 text-[var(--khaki)] rounded-xl font-semibold text-base transition-colors flex items-center justify-center gap-2 mt-2 shadow-md shadow-[var(--ink)]/20"
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="animate-spin h-5 w-5" /> Updating…
                                    </>
                                ) : (
                                    "Reset password"
                                )}
                            </button>
                        </form>
                    )}
                </div>

                {step === "code" && (
                    <p
                        className="text-center mt-7 text-sm text-[var(--ink)]/65"
                        style={{ fontFamily: "var(--font-playfair)" }}
                    >
                        Didn&apos;t get the code?{" "}
                        <button
                            onClick={handleResendCode}
                            className="font-semibold italic text-[var(--rust)] hover:text-[var(--ink)] transition-colors underline decoration-[var(--rust)]/40 underline-offset-4"
                        >
                            Resend
                        </button>
                    </p>
                )}
            </motion.div>
        </div>
    );
}
