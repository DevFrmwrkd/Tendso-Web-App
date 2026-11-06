"use client";

import { useUser } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { OnboardingLoading } from "@/components/field-agent-onboarding/OnboardingShell";
import { api } from "@/convex/_generated/api";
import { isCreatorAccount } from "@/lib/accounts";

import { ApprovedReviewView, PendingReviewView } from "./_components/ReviewViews";

/** Live account guards remain on the route; presentation lives in adjacent components. */
export default function PendingPage() {
  const { user, isLoaded, isSignedIn } = useUser();
  const router = useRouter();
  const creator = useQuery(api.creators.getByClerkId,user?{clerkId:user.id}:"skip");
  const matchingCreator=!!creator&&creator.clerkId===user?.id;
  const pending=isLoaded&&isSignedIn&&matchingCreator&&isCreatorAccount(creator)&&!!creator.quizPassedAt&&!creator.certifiedAt&&!creator.rejectedAt;
  const [waitingCreatorId,setWaitingCreatorId]=useState<string|null>(null);
  if(pending&&creator._id!==waitingCreatorId)setWaitingCreatorId(creator._id);
  const approvedHere=matchingCreator&&waitingCreatorId===creator?._id&&!!creator?.certifiedAt&&isCreatorAccount(creator);
  useEffect(()=>{if(isLoaded&&!isSignedIn)router.replace("/login");},[isLoaded,isSignedIn,router]);
  useEffect(()=>{
    if(!isLoaded||!isSignedIn||!matchingCreator||!creator)return;
    if(creator.role==="affiliate"){router.replace("/affiliates/dashboard");return;}
    if(creator.role==="staff"){router.replace("/admin");return;}
    if(creator.role==="admin"||creator.certifiedAt){if(!approvedHere)router.replace("/dashboard");}
    else if(creator.rejectedAt)router.replace("/verification-rejected");
    else if(!creator.quizPassedAt)router.replace("/training");
  },[creator,router,approvedHere,isLoaded,isSignedIn,matchingCreator]);
  if(!isLoaded||!isSignedIn||!matchingCreator)return <OnboardingLoading stage="review"/>;
  if(approvedHere&&creator?.certifiedAt)return <ApprovedReviewView creator={creator} certifiedAt={creator.certifiedAt}/>;
  if(!isLoaded||!isSignedIn||!creator||!pending)return <OnboardingLoading stage="review" creator={creator}/>;
  return <PendingReviewView creator={creator}/>;
}
