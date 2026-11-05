import type { Metadata } from "next";
import { loginReturnPath } from "@/app/auth/_components/loginReturnPath";

import LoginForm from "./LoginForm";

export const metadata: Metadata = {
    title: "Sign in — Tendso",
    alternates: { canonical: "/login" },
    robots: { index: false, follow: false },
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
    const params = await searchParams;
    return <LoginForm returnTo={loginReturnPath(params.redirect_url)} />;
}
