"use client";

import { ArrowRight, Bell, Check, CircleHelp, Clock3, Download, Hourglass } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { useCertificateDownload } from "@/components/certificate";
import { OnboardingShell } from "@/components/field-agent-onboarding/OnboardingShell";
import type { Doc } from "@/convex/_generated/dataModel";

import styles from "../pending.module.css";

function TimelineRow({title,description,state}: {title:string;description:string;state:"done"|"current"|"next"}) {
  return <li className={`${styles.timelineRow} ${state==="current"?styles.current:""}`} aria-current={state==="current"?"step":undefined}>
    <span className={`${styles.marker} ${state==="done"?styles.done:""}`} aria-hidden="true">{state==="done"?<Check size={16}/>:state==="current"?<span className={styles.activeDot}/>:null}</span>
    <span><strong>{title}</strong><small>{description}</small></span>{state==="current"&&<span className={styles.now}>Now</span>}
  </li>;
}

export function PendingReviewView({creator}:{creator:Doc<"creators">}) {
  const name=creator.firstName?.trim();
  const passed=creator.quizPassedAt?new Date(creator.quizPassedAt).toLocaleString("en-PH",{timeZone:"Asia/Manila",month:"short",day:"numeric",hour:"numeric",minute:"2-digit"}):"Your pass is saved";
  return <OnboardingShell stage="review" creator={creator} title="We’re checking your details" description={`${name?`Hi ${name}. `:""}You passed the quiz. The Tendso team will check your profile before you start finding shops.`}>
    <section className={styles.waiting} aria-labelledby="review-card-title">
      <span className={styles.waitIcon} aria-hidden="true"><Hourglass size={28}/></span>
      <span className={styles.status}><Clock3 size={14} aria-hidden="true"/> In review</span>
      <h2 id="review-card-title">Your profile is with the team.</h2>
      <p>Usually within 24 hours. Your quiz pass is saved, so there is nothing to repeat while you wait.</p>
    </section>
    <ol className={styles.timeline} aria-label="Application progress">
      <TimelineRow state="done" title="Profile sent" description="Your details are ready for review"/>
      <TimelineRow state="done" title="Training and quiz" description={`Quiz passed · ${passed}`}/>
      <TimelineRow state="current" title="Team checks your details" description="Usually within 24 hours"/>
      <TimelineRow state="next" title="Start finding shops" description="Your field agent dashboard opens after approval"/>
    </ol>
    <div className={styles.notice}><Bell size={21} aria-hidden="true"/><p>You can leave this page. We’ll notify you in Tendso when there is an update. This page also updates automatically when the team reviews your profile.</p></div>
    <Link className={styles.help} href="/knowledge"><CircleHelp size={18} aria-hidden="true"/> Questions about your application?<span>Open Help <ArrowRight size={15} aria-hidden="true"/></span></Link>
  </OnboardingShell>;
}

export function ApprovedReviewView({creator,certifiedAt}:{creator:Doc<"creators">;certifiedAt:number}) {
  const {ref,download,busy}=useCertificateDownload(creator.firstName);
  const name=[creator.firstName,creator.lastName].filter(Boolean).join(" ").trim()||"Field agent";
  const issued=new Date(certifiedAt).toLocaleDateString("en-PH",{timeZone:"Asia/Manila",month:"long",year:"numeric"});
  return <OnboardingShell stage="approved" creator={creator} title="You’re ready for your first shop" description="The Tendso team has approved your profile. You can now visit shops and send their details, photos, and interviews.">
    <div ref={ref} className={styles.certificate} role="img" aria-label={`Tendso field agent certificate for ${name}. Approved ${issued}.`}>
      <div className={styles.certificateBrand}><Image src="/v2/brand/mark-ink-256.png" alt="" width={27} height={27}/><span>tendso</span></div>
      <span className={styles.certificateLabel}>Certificate of completion</span><span className={styles.certIcon} aria-hidden="true"><Check size={28}/></span>
      <h2>Certified field agent</h2><p>This certifies that</p><strong className={styles.certificateName}>{name}</strong>
      <p>Tendso has approved this field agent to capture shop details, photos, and interviews.</p><small>Approved {issued} · Issued by Tendso</small>
    </div>
    <div className={styles.approvedActions}><button type="button" className={styles.download} onClick={download} disabled={busy} aria-busy={busy}><Download size={17} aria-hidden="true"/>{busy?"Saving…":"Download certificate"}</button><Link className={styles.primary} href="/dashboard">Go to my dashboard <ArrowRight size={18} aria-hidden="true"/></Link></div>
  </OnboardingShell>;
}
