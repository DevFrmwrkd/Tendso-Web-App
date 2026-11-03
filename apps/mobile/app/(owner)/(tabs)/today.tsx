import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useAuth } from '@clerk/clerk-expo';
import { Ionicons } from '@expo/vector-icons';
import { Button, Card, ListRow, Loading, ScreenShell, Text, formatPeso } from '../../../components/v2';
import { OwnerBusinessSwitcher } from '../../../components/v2/owner/OwnerBusinessSwitcher';
import { OwnerPaymentSimulatorEntry } from '../../../components/v2/owner/OwnerPaymentSimulatorEntry';
import { useGuardedRouter } from '../../../hooks/useGuardedRouter';
import { useOwnerInbox } from '../../../lib/v2/ownerInbox';
import { useOwnerVisitRequests, visitSchedule, visitStatusLabel } from '../../../lib/v2/visitRequests';
import { ownerIntake } from '../../../lib/v2/ownerIntake';
import { ownerSiteRoute } from '../../../lib/v2/ownerNavigation';
import { outstandingPayment, phaseLine, STEP_ROUTE } from '../../../lib/v2/ownerFlow';
import { firstName, greeting, useOwnerSite } from '../../../lib/v2/useOwnerSite';
import type { SiteSummary } from '../../../lib/v2/ownerTypes';
import { colors, space } from '../../../theme/v2';

const liveBalance=(site:SiteSummary)=>site.phase==='live'?outstandingPayment(site):null;
const needsYou=(site:SiteSummary)=>['draft','ready_to_check','awaiting_payment','rejected','offline'].includes(site.phase)||!!liveBalance(site);
const actionLabel=(site:SiteSummary)=>liveBalance(site)?.label??(site.phase==='draft'?'Continue setup':site.phase==='ready_to_check'?'Check preview':site.phase==='awaiting_payment'?'View payment':site.phase==='rejected'||site.phase==='offline'?'View details':'Open business');
const manilaDay=(time:number)=>new Date(time).toLocaleDateString('en-CA',{timeZone:'Asia/Manila'});

/** Today reflects all owned businesses and visits; no invented sales or traffic. */
export default function Today() {
  const {userId,sessionId}=useAuth(); const {me}=useOwnerSite();
  return <OwnerToday key={`${userId}:${sessionId}:${me?.owner._id}`} />;
}
function OwnerToday() {
  const {userId}=useAuth(); const {me,site,id,isNewBusiness}=useOwnerSite(); const router=useGuardedRouter();
  const inbox=useOwnerInbox(me?.owner._id); const visits=useOwnerVisitRequests();
  const [now,setNow]=useState(Date.now); const [showAll,setShowAll]=useState(false);
  const mounted=useRef(true); const live=useRef({userId,me});
  useLayoutEffect(()=>{live.current={userId,me};},[userId,me]);
  useEffect(()=>{mounted.current=true;const timer=setInterval(()=>setNow(Date.now()),60_000);return()=>{mounted.current=false;clearInterval(timer);};},[]);
  const current=()=>mounted.current&&live.current.userId===userId&&live.current.me?.owner._id===me?.owner._id;
  const sites=me?.sites??[]; const attention=sites.filter(needsYou);
  const ready=attention.find(row=>row.phase==='ready_to_check');
  const payment=attention.find(row=>row.phase==='awaiting_payment'||liveBalance(row));
  const primary=ready??payment??attention[0];
  const openSite=(chosen:SiteSummary)=>{
    if(!current())return;const owned=live.current.me?.sites.find(row=>row.submissionId===chosen.submissionId);if(!owned)return;
    ownerIntake.selectBusiness(owned.submissionId);router.push((liveBalance(owned)?STEP_ROUTE.pay:ownerSiteRoute(owned)) as never);
  };
  const activeVisits=(visits??[]).filter(row=>row.status!=='cancelled'&&row.status!=='completed');
  const nextVisit=[...activeVisits].sort((a,b)=>(a.scheduledAt??Number.MAX_SAFE_INTEGER)-(b.scheduledAt??Number.MAX_SAFE_INTEGER)||b.createdAt-a.createdAt)[0];
  const todayVisit=activeVisits.find(row=>row.status==='confirmed'&&row.scheduledAt&&manilaDay(row.scheduledAt)===manilaDay(now));
  const openVisit=(visitId:string)=>{if(current())router.push({pathname:'/(owner)/agents/[visitId]',params:{visitId}} as never);};
  const openInbox=(key?:string)=>{if(current())router.push({pathname:'/(owner)/me/inbox',params:key?{eventKey:key}:{}} as never);};
  const openDrafts=sites.filter(row=>row.phase==='draft'&&row.contentSource==='owner_app').length;
  const add=()=>{if(!current()||openDrafts>=3)return;if(!isNewBusiness)ownerIntake.beginBusiness();router.push('/(owner)/start/sell' as never);};
  const remaining=sites.filter(row=>row.phase==='awaiting_payment'||row.phase==='live').reduce((sum,row)=>sum+(row.paidInFull?0:Math.max(0,row.balanceDue)),0);
  const unread=inbox?.unreadCount??0;
  return <ScreenShell title="Today" subtitle={`${new Date(now).toLocaleDateString('en-PH',{timeZone:'Asia/Manila',weekday:'long',month:'short',day:'numeric'})} · ${greeting()}${firstName(me)?`, ${firstName(me)}`:''}`} insetBottom={false} contentStyle={styles.content}
    headerRight={<Pressable accessibilityRole="button" accessibilityLabel={`Open owner inbox${unread?`, ${unread} unread`:''}`} onPress={()=>openInbox()} style={styles.bell}><Ionicons name="notifications-outline" size={24} color={colors.ink}/>{unread?<View style={styles.badge}><Text variant="label" weight="bold">{unread>99?'99+':unread}</Text></View>:null}</Pressable>}>
    <View style={styles.stats}>
      <Card style={styles.stat}><Text variant="title" tabular>{sites.length}</Text><Text variant="label" tone="muted">Businesses</Text></Card>
      <Card style={styles.stat}><Text variant="title" tabular>{sites.filter(row=>row.phase==='live').length}</Text><Text variant="label" tone="muted">Live websites</Text></Card>
      <Card style={[styles.stat,attention.length?styles.attentionStat:null]}><Text variant="title" tabular>{attention.length}</Text><Text variant="label" tone="muted">Need you</Text></Card>
    </View>
    <Card style={styles.focus}>
      <View style={styles.headingRow}><View style={styles.focusIcon}><Ionicons name={todayVisit?'calendar-outline':primary?'sparkles-outline':'checkmark-outline'} size={25} color={colors.ink}/></View><Text variant="label" weight="bold">{todayVisit?'ON YOUR SCHEDULE':primary?'YOUR NEXT STEP':'LOOKING GOOD'}</Text></View>
      <Text variant="title">{todayVisit?'An agent is visiting today.':primary?primary.phase==='ready_to_check'?'Your preview is ready to check.':primary.phase==='awaiting_payment'||liveBalance(primary)?'Your website has a payment waiting.':primary.phase==='draft'?'Pick up where you left off.':'Your business needs attention.':sites.length?'You’re up to date.':'Let’s bring your business online.'}</Text>
      <Text tone="ink2">{todayVisit?`${todayVisit.shopName} · ${visitSchedule(todayVisit.scheduledAt)}`:primary?`${primary.businessName} · ${phaseLine(primary.phase)}`:sites.length?'Your websites and visit updates are together here. We’ll let you know when something needs you.':'Start a website yourself, or ask a field agent to visit your shop.'}</Text>
      {todayVisit?<Button title="View today’s visit" onPress={()=>openVisit(todayVisit._id)}/>:primary?<Button title={actionLabel(primary)} onPress={()=>openSite(primary)}/>:<Button title={sites.length?'Check notifications':'Add a business'} onPress={()=>sites.length?openInbox():add()}/>}
    </Card>
    {remaining>0?<Card style={styles.balance}><View style={styles.flex}><Text variant="label" tone="muted">Remaining across your websites</Text><Text variant="heading" tabular>{formatPeso(remaining)}</Text></View><Ionicons name="wallet-outline" size={25} color={colors.ink}/></Card>:null}
    <View style={styles.sectionHead}><Text variant="heading">Your visits</Text><Pressable accessibilityRole="button" accessibilityLabel="See all owner visits" onPress={()=>router.push('/(owner)/(tabs)/agents' as never)} style={styles.link}><Text variant="label" weight="bold">See all</Text><Ionicons name="arrow-forward" size={16} color={colors.ink}/></Pressable></View>
    {nextVisit?<Pressable accessibilityRole="button" accessibilityLabel={`Visit for ${nextVisit.shopName}, ${visitStatusLabel(nextVisit.status)}`} onPress={()=>openVisit(nextVisit._id)}><Card style={styles.visit}>
      <View style={styles.headingRow}><View style={styles.calendar}><Ionicons name="calendar-outline" size={23} color={colors.ink}/></View><View style={styles.flex}><Text weight="bold">{nextVisit.shopName}</Text><Text tone="muted">{nextVisit.scheduledAt?visitSchedule(nextVisit.scheduledAt):`Preferred: ${nextVisit.preferredWhen}`}</Text></View><Ionicons name="chevron-forward" size={20} color={colors.ink3}/></View>
      <View style={styles.status}><View style={styles.dot}/><Text variant="label" weight="bold">{visitStatusLabel(nextVisit.status)}</Text></View>
      <Text variant="label" tone="muted">{nextVisit.status==='assigned'?'We’re waiting for your assigned agent to accept.':nextVisit.status==='confirmed'?`${nextVisit.assignedAgent?.name??'Your field agent'} has accepted the visit.`:'The team will assign an agent and confirm a time.'}</Text>
    </Card></Pressable>:visits===undefined?<Loading/>:<Card style={styles.visit}><Text weight="bold">No upcoming visits</Text><Text tone="muted">Need help with photos and your story? Ask an agent to visit.</Text><Button title="Request a shop visit" variant="ghost" onPress={()=>router.push('/(owner)/agents/book' as never)}/></Card>}
    <View style={styles.sectionHead}><Text variant="heading">Your businesses</Text><Text variant="label" tone="muted">{sites.length} total</Text></View>
    <OwnerBusinessSwitcher me={me} site={site} isNewBusiness={isNewBusiness}/>
    {sites.length?<Card style={styles.businesses}>{(showAll?sites:sites.slice(0,3)).map((business,index)=><ListRow key={business.submissionId} title={business.businessName} titleNumberOfLines={2} subtitle={phaseLine(business.phase)} icon={business.phase==='live'?'globe-outline':'storefront-outline'} divider={index<(showAll?sites.length:Math.min(3,sites.length))-1} onPress={()=>openSite(business)}/>)}</Card>:null}
    {sites.length>3?<Button title={showAll?'Show fewer businesses':'Show all businesses'} variant="ghost" onPress={()=>setShowAll(value=>!value)}/>:null}
    <View style={styles.quickActions}><Button title="Add a business" variant="ghost" disabled={openDrafts>=3} onPress={add}/><Button title="Request a visit" variant="ghost" onPress={()=>router.push('/(owner)/agents/book' as never)}/></View>
    {openDrafts>=3?<Text variant="label" tone="muted">Finish one of your three drafts before adding another business.</Text>:null}
    <View style={styles.sectionHead}><Text variant="heading">Recent updates</Text><Pressable accessibilityRole="button" accessibilityLabel="View all owner updates" onPress={()=>openInbox()} style={styles.link}><Text variant="label" weight="bold">View all</Text><Ionicons name="arrow-forward" size={16} color={colors.ink}/></Pressable></View>
    {!inbox?<Loading/>:inbox.items.length?<Card style={styles.businesses}>{inbox.items.slice(0,3).map((item,index)=><ListRow key={item.key} title={item.title} subtitle={item.body} subtitleNumberOfLines={2} icon={item.visitRequestId?'calendar-outline':'mail-outline'} divider={index<Math.min(3,inbox.items.length)-1} onPress={()=>openInbox(item.key)} trailing={!item.read?<View style={styles.dot}/>:undefined}/>)}</Card>:<Card><Text tone="muted">Visit and website updates will appear here.</Text></Card>}
    <OwnerPaymentSimulatorEntry submissionId={id} businessName={site?.businessName??''} ownerId={me?.owner._id}/>
  </ScreenShell>;
}
const styles=StyleSheet.create({content:{gap:space.lg},flex:{flex:1,minWidth:0,gap:4},stats:{flexDirection:'row',gap:space.sm},stat:{flex:1,minWidth:0,padding:space.md,gap:5},attentionStat:{backgroundColor:colors.accentSoft},focus:{gap:space.md,padding:space.lg},headingRow:{flexDirection:'row',alignItems:'center',gap:space.md},focusIcon:{width:46,height:46,borderRadius:16,backgroundColor:colors.accent,alignItems:'center',justifyContent:'center'},balance:{flexDirection:'row',alignItems:'center',gap:space.md},sectionHead:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:space.sm},link:{minHeight:44,flexDirection:'row',alignItems:'center',gap:space.sm},visit:{gap:space.md},calendar:{width:44,height:44,borderRadius:15,backgroundColor:colors.bg2,alignItems:'center',justifyContent:'center'},status:{flexDirection:'row',alignItems:'center',gap:7,alignSelf:'flex-start',borderRadius:999,paddingHorizontal:12,paddingVertical:7,backgroundColor:colors.accentSoft},dot:{width:8,height:8,borderRadius:4,backgroundColor:colors.ink},businesses:{paddingVertical:space.xs},quickActions:{gap:space.sm},bell:{width:48,height:48,borderRadius:24,backgroundColor:colors.card,alignItems:'center',justifyContent:'center'},badge:{position:'absolute',right:-5,top:-4,minWidth:22,height:22,paddingHorizontal:4,borderRadius:11,backgroundColor:colors.accent,alignItems:'center',justifyContent:'center',borderWidth:2,borderColor:colors.bg}});
