import { loginReturnPath } from "@/app/auth/_components/loginReturnPath";

import SSOCallback from "./SSOCallback";

export default async function SSOCallbackPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
    const params = await searchParams;
    return <SSOCallback returnTo={loginReturnPath(params.return_to)} />;
}
