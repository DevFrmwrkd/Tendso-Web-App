"use client";

import { useState } from "react";
import { useSignIn } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { ArrowLeft, Loader2, Mail, Lock, Eye, EyeOff, Check, X } from "lucide-react";
import Logo from "@/public/logo.png";

function getPasswordStrength(pw: string): { level: number; label: string; color: string } {
    if (pw.length < 8) return { level: 1, label: "Weak", color: "bg-red-500" };
    const hasUpper = /[A-Z]/.test(pw);
    const hasLower = /[a-z]/.test(pw);
    const hasNumber = /\d/.test(pw);
    const hasSpecial = /[^A-Za-z0-9]/.test(pw);
    const mixedCase = hasUpper && hasLower;
    if (mixedCase && hasNumber && hasSpecial) return { level: 4, label: "Strong", color: "bg-emerald-500" };
    if ((mixedCase && hasNumber) || (mixedCase && hasSpecial)) return { level: 3, label: "Good", color: "bg-emerald-400" };
    return { level: 2, label: "Fair", color: "bg-amber-500" };
}

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
            <div className="min-h-screen bg-white text-neutral-900 flex flex-col items-center justify-center px-6 text-center relative overflow-hidden">
                <div className="absolute -top-32 -right-20 w-[480px] h-[480px] bg-emerald-50 rounded-full filter blur-[120px] opacity-80 pointer-events-none" />
                <motion.div
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: "spring", stiffness: 300, damping: 22 }}
                    className="relative z-10 w-20 h-20 bg-emerald-50 border-2 border-emerald-500 rounded-full flex items-center justify-center mb-6 shadow-lg shadow-emerald-500/20"
                >
                    <Check className="w-10 h-10 text-emerald-600" />
                </motion.div>
                <h1
                    style={{ fontFamily: "var(--font-fraunces)" }}
                    className="relative z-10 text-4xl sm:text-5xl font-semibold tracking-tight text-neutral-900 mb-3"
                >
                    Password <span className="italic text-emerald-700">reset.</span>
                </h1>
                <p className="relative z-10 text-neutral-600 text-base sm:text-lg max-w-sm leading-relaxed">
                    You&apos;re signed in. Redirecting you to your dashboard…
                </p>
            </div>
        );
    }

    return (
        <div className="min-h-screen w-full bg-white text-neutral-900 selection:bg-emerald-500 selection:text-white overflow-x-hidden relative flex items-start sm:items-center justify-center px-6 py-12">
            {/* Soft ambient washes */}
            <div className="absolute -top-32 -right-20 w-[480px] h-[480px] bg-emerald-50 rounded-full filter blur-[120px] opacity-80 pointer-events-none" />
            <div className="absolute -bottom-40 -left-32 w-[520px] h-[520px] bg-emerald-100/60 rounded-full filter blur-[140px] opacity-70 pointer-events-none" />

            {/* BACK NAVIGATION */}
            <button
                onClick={() => (step === "code" ? setStep("email") : router.push("/login"))}
                className="absolute top-6 left-6 md:top-10 md:left-10 flex items-center gap-2.5 text-neutral-600 hover:text-emerald-700 transition-colors group"
            >
                <span className="w-9 h-9 rounded-full border border-neutral-200 bg-white flex items-center justify-center shadow-sm group-hover:border-emerald-300 transition-colors">
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
                <div className="flex flex-col items-center mb-8">
                    <div className="w-16 h-16 rounded-2xl overflow-hidden border border-emerald-100 bg-emerald-50 p-1 flex items-center justify-center mb-5 shadow-md shadow-emerald-500/10">
                        <Image src={Logo} alt="" width={56} height={56} className="rounded-xl" />
                    </div>
                    <h1
                        style={{ fontFamily: "var(--font-fraunces)" }}
                        className="text-3xl md:text-4xl font-semibold tracking-tight text-center text-neutral-900 mb-2 leading-tight"
                    >
                        Reset your <span className="italic text-emerald-700">password.</span>
                    </h1>
                    <p className="text-neutral-600 text-center text-[15px] max-w-xs leading-relaxed">
                        {step === "email"
                            ? "Enter your email and we'll send you a 6-digit code."
                            : `We sent a code to ${email}. Enter it below.`}
                    </p>
                </div>

                <div className="bg-white border border-neutral-200 p-7 sm:p-8 rounded-3xl shadow-xl shadow-emerald-900/5">
                    {error && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            className="mb-5 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm text-center"
                            role="alert"
                        >
                            {error}
                        </motion.div>
                    )}

                    {step === "email" ? (
                        <form onSubmit={handleSendCode} className="space-y-5">
                            <div className="space-y-1.5">
                                <label htmlFor="email" className="text-xs font-semibold text-neutral-700 px-1">
                                    Email address
                                </label>
                                <div className="relative group">
                                    <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                        <Mail className="w-4 h-4 text-neutral-400 group-focus-within:text-emerald-600 transition-colors" />
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
                                        className="w-full h-12 pl-10 pr-4 bg-white border border-neutral-200 rounded-xl text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors text-[15px]"
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading || !email}
                                className="w-full h-12 bg-neutral-900 hover:bg-black disabled:opacity-60 text-white rounded-xl font-semibold text-base transition-colors flex items-center justify-center gap-2 mt-2 shadow-md shadow-neutral-900/15"
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
                                <label htmlFor="code" className="text-xs font-semibold text-neutral-700 px-1">
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
                                    className="w-full h-14 bg-white border border-neutral-200 rounded-xl text-neutral-900 placeholder:text-neutral-300 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors text-center text-2xl tracking-[0.6em] font-semibold"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label htmlFor="newPassword" className="text-xs font-semibold text-neutral-700 px-1">
                                    New password
                                </label>
                                <div className="relative group">
                                    <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                        <Lock className="w-4 h-4 text-neutral-400 group-focus-within:text-emerald-600 transition-colors" />
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
                                        className="w-full h-12 pl-10 pr-11 bg-white border border-neutral-200 rounded-xl text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors text-[15px]"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center text-neutral-400 hover:text-neutral-700 transition-colors"
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
                                                    className={`h-1.5 flex-1 rounded-full transition-colors ${
                                                        i <= strength.level ? strength.color : "bg-neutral-200"
                                                    }`}
                                                />
                                            ))}
                                        </div>
                                        <p className="text-[11px] font-semibold text-neutral-600">{strength.label}</p>
                                    </div>
                                )}
                            </div>

                            <div className="space-y-1.5">
                                <label htmlFor="confirmPassword" className="text-xs font-semibold text-neutral-700 px-1">
                                    Confirm new password
                                </label>
                                <div className="relative group">
                                    <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                        <Lock className="w-4 h-4 text-neutral-400 group-focus-within:text-emerald-600 transition-colors" />
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
                                        className="w-full h-12 pl-10 pr-4 bg-white border border-neutral-200 rounded-xl text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors text-[15px]"
                                    />
                                </div>
                                {confirmPassword.length > 0 && (
                                    <div className="flex items-center gap-1.5 text-xs font-semibold mt-2 px-1">
                                        {passwordsMatch ? (
                                            <>
                                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                                                <span className="text-emerald-700">Passwords match</span>
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
                                className="w-full h-12 bg-neutral-900 hover:bg-black disabled:opacity-50 text-white rounded-xl font-semibold text-base transition-colors flex items-center justify-center gap-2 mt-2 shadow-md shadow-neutral-900/15"
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
                    <p className="text-center mt-7 text-sm text-neutral-600">
                        Didn&apos;t get the code?{" "}
                        <button
                            onClick={handleResendCode}
                            className="font-semibold text-emerald-700 hover:text-emerald-900 transition-colors underline decoration-emerald-200 underline-offset-4"
                        >
                            Resend
                        </button>
                    </p>
                )}
            </motion.div>
        </div>
    );
}
