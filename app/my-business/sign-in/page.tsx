'use client';

import { Suspense } from 'react';
import { SignIn, SignUp, useAuth } from '@clerk/nextjs';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { AuthFrame } from '@/app/auth/_components/AuthFrame';
import { ownerReturnPath } from '@/lib/ownerReturnPath';

function OwnerSignIn() {
    const params = useSearchParams();
    const next = ownerReturnPath(params.get('returnTo'));
    const signup = params.get('mode') === 'signup';
    const { isSignedIn } = useAuth();
    const link = (mode: string) => `/my-business/sign-in?mode=${mode}&returnTo=${encodeURIComponent(next)}`;
    return <AuthFrame title={signup ? 'Make your owner account' : 'Your business, your website'}
        sub="Use the email your field agent entered. Verify your email to open your private website preview.">
        {isSignedIn ? <div className="p-6"><Link className="t-link" href={next}>Continue to your website</Link></div>
            : signup ? <SignUp routing="hash" forceRedirectUrl={next} signInUrl={link('signin')} />
                : <SignIn routing="hash" forceRedirectUrl={next} signUpUrl={link('signup')} />}
    </AuthFrame>;
}

export default function OwnerSignInPage() {
    return <Suspense><OwnerSignIn /></Suspense>;
}
