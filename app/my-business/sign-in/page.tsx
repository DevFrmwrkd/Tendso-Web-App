'use client';

import { Suspense } from 'react';
import { SignIn, SignUp, useAuth } from '@clerk/nextjs';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, Check, Mail } from 'lucide-react';
import { AUTH_BODY, AuthFrame } from '@/app/auth/_components/AuthFrame';
import { AUTH_CLERK_APPEARANCE } from '@/app/auth/_components/authAppearance';
import styles from '@/app/auth/_components/AuthFrame.module.css';
import { ownerReturnPath } from '@/lib/ownerReturnPath';

function OwnerSignIn() {
    const params = useSearchParams();
    const next = ownerReturnPath(params.get('returnTo') ?? '/my-business/today');
    const signup = params.get('mode') === 'signup';
    const { isSignedIn } = useAuth();
    const link = (mode: string) => `/my-business/sign-in?mode=${mode}&returnTo=${encodeURIComponent(next)}`;
    return <AuthFrame eyebrow="FOR BUSINESS OWNERS" title={isSignedIn ? 'You’re signed in.' : signup ? 'Your business starts here.' : 'Your business, all together.'}
        sub={isSignedIn ? 'Your website, payments and shop visits are waiting in your workspace.' : 'One place to check your website, keep up with payments and follow your shop visits.'}
        foot={!isSignedIn ? <p className={styles.accountSwitch}>{signup ? 'Already have an account?' : 'First time here?'}{' '}
            <Link href={link(signup ? 'signin' : 'signup')}>{signup ? 'Sign in' : 'Create an owner account'}</Link></p> : undefined}>
        <div className={AUTH_BODY}>
            {isSignedIn ? <div className={styles.signedIn}><span className={styles.signedInIcon}><Check size={26} aria-hidden="true" /></span>
                <h2>Let’s open your workspace.</h2><p>Check what needs you next, or pick up where you left off.</p>
                <Link className="t-btn t-btn-primary" href={next}>Continue <ArrowRight size={18} aria-hidden="true" /></Link></div>
                : <><div className={styles.ownerNote}><Mail size={19} aria-hidden="true" /><p><strong>Use your business email</strong>Use the email you gave Tendso or your field agent. Verify it to open your private website preview.</p></div>
                    {signup ? <SignUp appearance={AUTH_CLERK_APPEARANCE} routing="hash" forceRedirectUrl={next} signInUrl={link('signin')}
                        fallback={<div className={styles.loading} role="status">Loading account setup…</div>} />
                        : <SignIn appearance={AUTH_CLERK_APPEARANCE} routing="hash" forceRedirectUrl={next} signUpUrl={link('signup')}
                            fallback={<div className={styles.loading} role="status">Loading sign-in…</div>} />}</>}
        </div>
    </AuthFrame>;
}

export default function OwnerSignInPage() {
    return <Suspense fallback={<AuthFrame title="Your business, all together."><div className={styles.loading} role="status">Loading sign-in…</div></AuthFrame>}><OwnerSignIn /></Suspense>;
}
