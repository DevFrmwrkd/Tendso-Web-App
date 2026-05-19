"use client";

import { useState, useEffect } from "react";
import { useSignIn, useSignUp, useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { Eye, EyeOff, Loader2, Mail, Lock, ArrowLeft, ArrowRight } from "lucide-react";
import Logo from "@/public/logo.png";

export default function LoginPage() {
    const router = useRouter();
    const { isSignedIn } = useAuth();
    const { signIn, setActive, isLoaded } = useSignIn();
    const { signUp } = useSignUp();

    useEffect(() => {
        if (isSignedIn) {
            router.replace("/dashboard");
        }
    }, [isSignedIn, router]);

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [oauthLoading, setOauthLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!isLoaded || !signIn) return;
        setError(null);
        setLoading(true);

        try {
            const result = await signIn.create({
                identifier: email,
                password,
            });

            if (result.status === "complete" && result.createdSessionId) {
                await setActive({ session: result.createdSessionId });
                router.push("/dashboard");
            }
        } catch (err: any) {
            setError(err.errors?.[0]?.longMessage || err.message || "Invalid email or password");
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleOAuth = async () => {
        if (!isLoaded || !signIn || !signUp) return;
        setOauthLoading(true);
        setError(null);

        try {
            const result = await signIn.create({
                strategy: "oauth_google",
                redirectUrl: window.location.origin + "/auth/sso-callback",
                actionCompleteRedirectUrl: "/dashboard",
            });

            const url = result.firstFactorVerification.externalVerificationRedirectURL;
            if (url) {
                window.location.href = url.toString();
                return;
            }
        } catch (err: any) {
            try {
                const result = await signUp.create({
                    strategy: "oauth_google",
                    redirectUrl: window.location.origin + "/auth/sso-callback",
                    actionCompleteRedirectUrl: "/dashboard",
                });

                const url = result.verifications?.externalAccount?.externalVerificationRedirectURL;
                if (url) {
                    window.location.href = url.toString();
                    return;
                }
            } catch (signUpErr: any) {
                setError(signUpErr.errors?.[0]?.longMessage || err.errors?.[0]?.longMessage || "Google sign-in failed");
            }
        }
        setOauthLoading(false);
    };

    return (
        <div
            className="min-h-screen w-full overflow-hidden relative flex items-center justify-center px-6 py-12"
            style={{ background: "var(--khaki)", color: "var(--ink)" }}
        >
            {/* Paper grain */}
            <div
                className="absolute inset-0 opacity-[0.04] pointer-events-none mix-blend-multiply"
                style={{
                    backgroundImage:
                        "radial-gradient(circle at 25% 25%, var(--ink) 0.5px, transparent 1px), radial-gradient(circle at 75% 75%, var(--ink) 0.5px, transparent 1px)",
                    backgroundSize: "4px 4px, 6px 6px",
                }}
            />
            {/* Soft green halos */}
            <div className="absolute -top-32 -right-20 w-[480px] h-[480px] bg-[var(--rust)]/8 rounded-full filter blur-[120px] pointer-events-none" />
            <div className="absolute -bottom-40 -left-32 w-[520px] h-[520px] bg-[var(--rust-soft)]/12 rounded-full filter blur-[140px] pointer-events-none" />

            {/* BACK TO HOME */}
            <Link
                href="/"
                className="absolute top-6 left-6 md:top-10 md:left-10 flex items-center gap-2.5 text-[var(--ink)]/70 hover:text-[var(--rust)] transition-colors group z-20"
            >
                <span className="w-9 h-9 rounded-full border border-[var(--ink)]/15 bg-[var(--khaki-deep)] flex items-center justify-center shadow-sm group-hover:border-[var(--rust)]/50 transition-colors">
                    <ArrowLeft className="w-4 h-4" />
                </span>
                <span className="font-semibold tracking-wide text-sm">Back home</span>
            </Link>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="w-full max-w-md relative z-10"
            >
                {/* Section marker */}
                <div className="flex items-center gap-3 mb-8 justify-center">
                    <span className="h-px w-10 bg-[var(--rust)]/40" />
                    <p
                        className="text-[10px] uppercase tracking-[0.4em] font-medium text-[var(--rust)]"
                        style={{ fontFamily: "var(--font-mono)" }}
                    >
                        § ACCESS — RETURNING
                    </p>
                    <span className="h-px w-10 bg-[var(--rust)]/40" />
                </div>

                <div className="flex flex-col items-center mb-8">
                    <div className="w-16 h-16 rounded-2xl overflow-hidden border border-[var(--ink)]/15 bg-[var(--khaki-deep)] p-1 flex items-center justify-center mb-5 shadow-md shadow-[var(--rust)]/15">
                        <Image src={Logo} alt="" width={56} height={56} className="rounded-xl" />
                    </div>
                    <h1
                        style={{
                            fontFamily: "var(--font-playfair)",
                            fontSize: "clamp(2.25rem, 5vw, 3rem)",
                        }}
                        className="font-bold tracking-[-0.01em] text-center text-[var(--ink)] mb-2 leading-[1.05]"
                    >
                        Welcome back, <span className="italic" style={{ color: "var(--rust)" }}>creator.</span>
                    </h1>
                    <p
                        className="text-[var(--ink)]/60 text-center italic max-w-xs leading-relaxed"
                        style={{
                            fontFamily: "var(--font-playfair)",
                            fontSize: "1.05rem",
                        }}
                    >
                        Continue your work digitizing local Filipino businesses.
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

                    <form onSubmit={handleSubmit} className="space-y-5">
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

                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between px-1">
                                <label
                                    htmlFor="password"
                                    className="text-[10px] uppercase tracking-[0.3em] font-bold text-[var(--ink)]/70"
                                    style={{ fontFamily: "var(--font-mono)" }}
                                >
                                    Password
                                </label>
                                <Link
                                    href="/forgot-password"
                                    className="text-xs italic text-[var(--rust)] hover:text-[var(--ink)] transition-colors"
                                    style={{ fontFamily: "var(--font-playfair)" }}
                                >
                                    Forgot password?
                                </Link>
                            </div>
                            <div className="relative group">
                                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                    <Lock className="w-4 h-4 text-[var(--ink)]/40 group-focus-within:text-[var(--rust)] transition-colors" />
                                </span>
                                <input
                                    id="password"
                                    type={showPassword ? "text" : "password"}
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    disabled={loading}
                                    autoComplete="current-password"
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
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full h-12 bg-[var(--ink)] hover:bg-[var(--rust)] disabled:opacity-60 text-[var(--khaki)] rounded-xl font-semibold text-base transition-colors flex items-center justify-center gap-2 mt-2 shadow-md shadow-[var(--ink)]/20"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="animate-spin h-5 w-5" /> Signing in…
                                </>
                            ) : (
                                <>
                                    Log in <ArrowRight className="w-4 h-4" />
                                </>
                            )}
                        </button>
                    </form>

                    <div className="mt-6 mb-5 relative flex items-center justify-center">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-[var(--ink)]/15" />
                        </div>
                        <div
                            className="relative bg-[var(--khaki-deep)] px-3 text-[10px] font-medium uppercase tracking-[0.3em] text-[var(--ink)]/50"
                            style={{ fontFamily: "var(--font-mono)" }}
                        >
                            or
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={handleGoogleOAuth}
                        disabled={oauthLoading || loading}
                        className="w-full h-12 bg-[var(--khaki)] border border-[var(--ink)]/15 hover:border-[var(--rust)]/50 hover:bg-[var(--khaki-deep)] text-[var(--ink)] rounded-xl font-semibold text-sm transition-colors flex items-center justify-center gap-2.5 disabled:opacity-60"
                    >
                        {oauthLoading ? (
                            <Loader2 className="animate-spin h-5 w-5 text-[var(--ink)]/40" />
                        ) : (
                            <>
                                <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden>
                                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                                </svg>
                                Continue with Google
                            </>
                        )}
                    </button>
                </div>

                <p
                    className="text-center mt-7 text-sm text-[var(--ink)]/65"
                    style={{ fontFamily: "var(--font-playfair)" }}
                >
                    New here?{" "}
                    <Link
                        href="/signup"
                        className="font-semibold italic text-[var(--rust)] hover:text-[var(--ink)] transition-colors underline decoration-[var(--rust)]/40 underline-offset-4"
                    >
                        Create your creator account
                    </Link>
                </p>
            </motion.div>
        </div>
    );
}
