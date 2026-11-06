"use client";

import { useClerk } from "@clerk/nextjs";
import { AlertTriangle, ArrowUpRight, Check, CircleHelp, LogOut } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";

import { v2Fonts } from "@/components/v2/fonts";
import type { Doc } from "@/convex/_generated/dataModel";

import styles from "./onboarding.module.css";

export type OnboardingStage = "learn" | "quiz" | "review" | "approved" | "changes";
type Account = Partial<Doc<"creators">> | null;

/** A shared presentation shell; route guards and account writes stay in each page. */
export function OnboardingShell({ stage, creator, title, description, children }: {
  stage: OnboardingStage; creator?: Account; title: ReactNode; description?: ReactNode; children: ReactNode;
}) {
  const { signOut } = useClerk();
  const router = useRouter();
  const [leaving, setLeaving] = useState(false);
  const [error, setError] = useState("");
  const current = stage === "learn" ? 0 : stage === "quiz" ? 1 : 2;
  const approved = stage === "approved";
  const steps = [
    { title: "Learn the essentials", detail: "Five short lessons" },
    { title: "Take the quiz", detail: creator?.quizPassedAt ? "Your pass is saved" : "Four correct answers to pass" },
    { title: stage === "changes" ? "Fix your details" : "Team review", detail: approved ? "You are approved" : stage === "changes" ? "Update and send again" : "Then start finding shops" },
  ];
  async function leave() {
    if (leaving) return;
    setLeaving(true);setError("");
    try { await signOut();router.replace("/login"); }
    catch {setError("Could not sign out. Please try again.");setLeaving(false);}
  }
  return <div className={`${v2Fonts} v2 ${styles.root}`}>
    <header className={styles.top}>
      <Link href="/" className={styles.logo} aria-label="Tendso home"><Image src="/v2/brand/mark-ink-256.png" alt="" width={28} height={28} priority/><span>tendso</span></Link>
      <div className={styles.topActions}><Link className={styles.helpLink} href="/knowledge"><CircleHelp size={17} aria-hidden="true"/> Help</Link><button className={styles.signOut} type="button" onClick={leave} disabled={leaving}><LogOut size={16} aria-hidden="true"/>{leaving ? "Signing out…" : "Sign out"}</button></div>
    </header>
    <main className={styles.layout}>
      <aside className={styles.rail}>
        <p className={styles.eyebrow}>Field agent setup</p>
        <p className={styles.railTitle}>Ready for your<br/>first shop.</p>
        <nav aria-label="Certification progress"><ol className={styles.steps}>{steps.map((step,index)=>{
          const done=approved || index<current;
          const warning=stage==="changes" && index===current;
          return <li key={index} className={`${styles.step} ${index===current&&!approved?styles.current:""}`} aria-current={index===current&&!approved?"step":undefined}>
            <span className={`${styles.marker} ${done?styles.done:""} ${warning?styles.warning:""}`} aria-hidden="true">{done?<Check size={16}/>:warning?<AlertTriangle size={15}/>:index+1}</span>
            <span><strong>{step.title}</strong><small>{step.detail}</small></span>
          </li>;
        })}</ol></nav>
        <Link className={styles.railHelp} href="/knowledge"><span>Questions along the way?<strong>Ask Tendso</strong></span><ArrowUpRight size={18} aria-hidden="true"/></Link>
      </aside>
      <div className={styles.content}>
        <header className={styles.heading}><p className={styles.eyebrow}>{stage==="changes"?"Action needed":approved?"You are ready":"Field agent certification"}</p><h1>{title}</h1>{description&&<p className={styles.description}>{description}</p>}</header>
        {error&&<p role="alert" className={styles.error}>{error}</p>}
        {children}
      </div>
    </main>
    <footer className={styles.footer}><span>The thinking ends here.</span><span>tendso</span></footer>
  </div>;
}

export function OnboardingLoading({stage,creator}: {stage:OnboardingStage;creator?:Account}) {
  return <OnboardingShell stage={stage} creator={creator} title="Getting your progress…"><div className={styles.loading} role="status" aria-label="Loading your progress" aria-busy="true"><span/><span/><span/></div></OnboardingShell>;
}
