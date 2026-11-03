import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useAuth } from '@clerk/clerk-expo';
import { useLocalSearchParams } from 'expo-router';
import { useMutation } from 'convex/react';
import { api } from '@tendso/convex-client';
import { Ionicons } from '@expo/vector-icons';
import { Banner, Button, Card, EmptyState, Loading, ScreenShell, Text } from '../../../components/v2';
import { ownerDeviceToken } from '../../../components/v2/owner/OwnerNotificationBridge';
import { useGuardedRouter } from '../../../hooks/useGuardedRouter';
import { useOwnerInbox, useOwnerInboxActions, type OwnerMessage } from '../../../lib/v2/ownerInbox';
import { ownerIntake } from '../../../lib/v2/ownerIntake';
import { ownerSiteRoute } from '../../../lib/v2/ownerNavigation';
import { outstandingPayment, STEP_ROUTE } from '../../../lib/v2/ownerFlow';
import { useOwnerSite } from '../../../lib/v2/useOwnerSite';
import { colors, radius, space } from '../../../theme/v2';

export default function Inbox() {
  const {userId,sessionId}=useAuth(); const {me}=useOwnerSite();
  return <OwnerInbox key={`${userId}:${sessionId}:${me?.owner._id}`} />;
}
function OwnerInbox() {
  const {userId}=useAuth(); const {me}=useOwnerSite(); const router=useGuardedRouter();
  const params=useLocalSearchParams<{eventKey?:string}>();
  const inbox=useOwnerInbox(me?.owner._id); const {markRead,markAllRead}=useOwnerInboxActions();
  const register=useMutation(api.ownerInbox.registerPushToken);
  const [selected,setSelected]=useState<OwnerMessage|null>(null); const [error,setError]=useState('');
  const [marking,setMarking]=useState(false); const [enabling,setEnabling]=useState(false); const [pushStatus,setPushStatus]=useState('');
  const mounted=useRef(true); const live=useRef({userId,ownerId:me?.owner._id,me});
  useLayoutEffect(()=>{live.current={userId,ownerId:me?.owner._id,me};},[userId,me]);
  const pending=useRef(new Set<string>()); const opened=useRef<string|null>(null);
  const ownerId=me?.owner._id;
  const current=useCallback(()=>mounted.current&&live.current.userId===userId&&live.current.ownerId===ownerId,[userId,ownerId]);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
  const read=useCallback((item:OwnerMessage)=>{
    if(!current()||item.read||pending.current.has(item.key))return;
    pending.current.add(item.key); setError('');
    void markRead(item.key).catch(()=>{if(current())setError('Could not save read status. Try again when connected.');}).finally(()=>pending.current.delete(item.key));
  },[current,markRead]);
  const open=useCallback((item:OwnerMessage)=>{if(!current())return;setSelected(item);read(item);},[current,read]);
  useEffect(()=>{
    const key=typeof params.eventKey==='string'?params.eventKey:null;
    if(!key||opened.current===key||!inbox)return;
    const item=inbox.items.find(row=>row.key===key); if(!item)return;
    opened.current=key;open(item);
  },[params.eventKey,inbox,open]); // The verified inbox row authorizes a push tap.
  const all=async()=>{if(!current()||marking||!inbox?.unreadCount)return;setMarking(true);setError('');try{await markAllRead();}catch{if(current())setError('Could not mark updates read. Try again when connected.');}finally{if(current())setMarking(false);}};
  const enable=async()=>{
    if(!current()||!userId||enabling)return;setEnabling(true);setPushStatus('');
    try{const token=await ownerDeviceToken(true,current);if(!current())return;
      if(!token){setPushStatus('Allow notifications in your phone settings to receive updates outside the app.');return;}
      await register({token,platform:Platform.OS as 'ios'|'android',clerkId:userId});if(current())setPushStatus('Notifications enabled on this device.');
    }catch{if(current())setPushStatus('Could not enable notifications. Your updates are still available here.');}
    finally{if(current())setEnabling(false);}
  };
  const action=()=>{
    if(!selected||!current())return;
    if(selected.visitRequestId){setSelected(null);router.push({pathname:'/(owner)/agents/[visitId]',params:{visitId:selected.visitRequestId}} as never);return;}
    const site=live.current.me?.sites.find(row=>row.submissionId===selected.submissionId);if(!site)return;
    ownerIntake.selectBusiness(site.submissionId);setSelected(null);router.push((site.phase==='live'&&outstandingPayment(site)?STEP_ROUTE.pay:ownerSiteRoute(site)) as never);
  };
  return <ScreenShell title="Notifications" subtitle="Your visits and website updates" onBack={()=>router.back()}
    headerRight={inbox?.unreadCount?<Pressable accessibilityRole="button" accessibilityLabel="Mark all owner notifications read" disabled={marking} onPress={()=>void all()} style={styles.markAll}><Text variant="label" weight="bold">{marking?'Saving…':'Mark all read'}</Text></Pressable>:undefined}>
    {error?<Banner tone="warn" body={error}/>:null}
    {Platform.OS!=='web'?<Card style={styles.enable}><View style={styles.row}><Ionicons name="notifications-outline" size={25} color={colors.ink}/><View style={styles.flex}><Text weight="bold">Keep up with your visits</Text><Text variant="label" tone="muted">Get notified when an agent accepts and when your website is ready.</Text></View></View><Button title="Enable notifications" variant="ghost" loading={enabling} onPress={()=>void enable()}/>{pushStatus?<Text variant="label" tone="muted">{pushStatus}</Text>:null}</Card>:null}
    {!inbox?<Loading/>:!inbox.items.length?<EmptyState icon="mail-open-outline" title="You’re all caught up" body="Visit requests and website updates will appear here."/>:<View style={styles.list}>
      <Text variant="label" tone="muted">{inbox.unreadCount?`${inbox.unreadCount} unread`:'All updates read'}</Text>
      {inbox.items.map(item=><Pressable key={item.key} accessibilityRole="button" accessibilityLabel={`${item.read?'Read':'Unread'}: ${item.title}`} accessibilityHint="Opens the full notification" onPress={()=>open(item)} style={[styles.message,!item.read&&styles.unread]}>
        <View style={styles.icon}><Ionicons name={item.visitRequestId?'calendar-outline':item.type==='website_live'?'globe-outline':'mail-outline'} size={22} color={colors.ink}/></View>
        <View style={styles.flex}><Text weight="bold">{item.title}</Text><Text tone="muted" numberOfLines={2}>{item.body}</Text><Text variant="label" tone="muted">{new Date(item.createdAt).toLocaleString('en-PH',{timeZone:'Asia/Manila',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})}</Text></View>
        {!item.read?<View style={styles.dot}/>:null}
      </Pressable>)}
    </View>}
    <Modal visible={!!selected} transparent animationType="fade" presentationStyle="overFullScreen" onRequestClose={()=>setSelected(null)}>
      <View style={styles.scrim}><Card style={styles.dialog} accessibilityViewIsModal><View style={styles.dialogHead}><Text variant="heading" style={styles.flex}>Update details</Text><Pressable accessibilityRole="button" accessibilityLabel="Close owner notification" onPress={()=>setSelected(null)} style={styles.close}><Ionicons name="close" size={24} color={colors.ink}/></Pressable></View>
        <ScrollView contentContainerStyle={styles.dialogBody}><Text variant="label" tone="muted">{selected?new Date(selected.createdAt).toLocaleString('en-PH',{timeZone:'Asia/Manila'}):''}</Text><Text variant="heading" selectable>{selected?.title}</Text><Text variant="bodyLg" selectable testID="owner-notification-full-body">{selected?.body}</Text>{error?<><Text tone="danger">{error}</Text><Button title="Retry read status" variant="ghost" onPress={()=>selected&&read(selected)}/></>:null}</ScrollView>
        <View style={styles.dialogFoot}>{selected?.visitRequestId||selected?.submissionId?<Button title={selected.visitRequestId?'View visit request':'Open business'} onPress={action}/>:null}<Button title="Close" variant="ghost" onPress={()=>setSelected(null)}/></View>
      </Card></View>
    </Modal>
  </ScreenShell>;
}
const styles=StyleSheet.create({flex:{flex:1,minWidth:0,gap:5},list:{gap:space.md},row:{flexDirection:'row',alignItems:'center',gap:space.md},enable:{gap:space.md,marginBottom:space.lg},markAll:{minHeight:44,padding:space.sm,justifyContent:'center'},message:{flexDirection:'row',alignItems:'flex-start',gap:space.md,padding:space.md,borderRadius:radius.card,backgroundColor:colors.bg2},unread:{backgroundColor:colors.card,borderWidth:1,borderColor:colors.rule},icon:{width:42,height:42,borderRadius:15,backgroundColor:colors.accentSoft,alignItems:'center',justifyContent:'center'},dot:{width:8,height:8,borderRadius:4,backgroundColor:colors.ink,marginTop:8},scrim:{flex:1,backgroundColor:colors.scrim,justifyContent:'center',padding:space.lg},dialog:{maxHeight:'85%',padding:0,overflow:'hidden'},dialogHead:{flexDirection:'row',alignItems:'center',gap:space.md,padding:space.md},close:{width:44,height:44,alignItems:'center',justifyContent:'center'},dialogBody:{padding:space.lg,gap:space.lg},dialogFoot:{padding:space.lg,gap:space.sm}});
