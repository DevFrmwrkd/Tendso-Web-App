import { loginReturnPath } from "@/app/auth/_components/loginReturnPath";

import LoginForm from "./LoginForm";

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
    const params = await searchParams;
    return <LoginForm returnTo={loginReturnPath(params.redirect_url)} />;
}
