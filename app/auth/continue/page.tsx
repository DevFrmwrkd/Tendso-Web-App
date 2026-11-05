import type { Metadata } from "next";
import { loginReturnPath } from "@/app/auth/_components/loginReturnPath";
import { SignInContinue } from "./SignInContinue";

export const metadata: Metadata = { title: "Opening your account — Tendso", robots: { index: false, follow: false } };

export default async function SignInContinuePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
    const params = await searchParams;
    return <SignInContinue returnTo={loginReturnPath(params.returnTo)} />;
}
