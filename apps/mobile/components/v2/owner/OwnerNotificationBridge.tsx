import { useEffect, useLayoutEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { useConvex, useMutation } from 'convex/react';
import { api } from '@tendso/convex-client';
import { useGuardedRouter } from '../../../hooks/useGuardedRouter';
import { notificationResponseKey } from '../../../services/notificationOpening';

Notifications.setNotificationHandler({handleNotification:async()=>({shouldShowAlert:true,shouldShowBanner:true,shouldShowList:true,shouldPlaySound:true,shouldSetBadge:true})});

function projectId() { return Constants.expoConfig?.extra?.eas?.projectId ?? (Constants as { easConfig?: { projectId?: string } }).easConfig?.projectId; }
export async function ownerDeviceToken(prompt: boolean, current: () => boolean): Promise<string | null> {
  if (!Device.isDevice || Platform.OS === 'web' || !current()) return null;
  let permission = await Notifications.getPermissionsAsync();
  if (!current()) return null;
  if (permission.status !== 'granted' && prompt && permission.canAskAgain) permission = await Notifications.requestPermissionsAsync();
  if (!current() || permission.status !== 'granted' || !projectId()) return null;
  if (Platform.OS === 'android') await Notifications.setNotificationChannelAsync('default', { name: 'Updates', importance: Notifications.AndroidImportance.DEFAULT });
  if (!current()) return null;
  const token = await Notifications.getExpoPushTokenAsync({ projectId: projectId() });
  return current() ? token.data : null;
}
export async function unregisterOwnerPush(remove: (args: { token: string; clerkId?: string }) => Promise<unknown>, subject: string | null | undefined, current: () => boolean) {
  if (!subject) return;
  let active=true; let timeout: ReturnType<typeof setTimeout> | undefined;
  const work=async()=>{ try { const token=await ownerDeviceToken(false,()=>active&&current()); if(token&&active&&current()) await remove({token,clerkId:subject}); } catch { /* Sign-out must still work offline. */ } };
  try { await Promise.race([work(),new Promise<void>(resolve=>{timeout=setTimeout(()=>{active=false;resolve();},1500);})]); }
  finally { active=false; if(timeout)clearTimeout(timeout); }
}

/** Native payloads can open only an event verified in the signed-in owner's inbox. */
export function OwnerNotificationBridge({ ownerId, subject }: { ownerId: string; subject: string }) {
  const convex=useConvex(); const router=useGuardedRouter(); const register=useMutation(api.ownerInbox.registerPushToken);
  const actor=`${subject}:${ownerId}`; const live=useRef(actor);
  useLayoutEffect(()=>{live.current=actor;},[actor]);
  const consumed=useRef(new Set<string>());
  useEffect(()=>{
    let mounted=true; let tap=0; const current=()=>mounted&&live.current===actor;
    void ownerDeviceToken(false,current).then(token=>{ if(token&&current()) return register({token,platform:Platform.OS as 'ios'|'android',clerkId:subject}); }).catch(()=>{});
    const receive=(response:Notifications.NotificationResponse|null)=>{
      if(!current()||!response||response.actionIdentifier!==Notifications.DEFAULT_ACTION_IDENTIFIER)return;
      const key=notificationResponseKey(response); const data=response.notification.request.content.data;
      if(!key)return;
      const acknowledge=()=>{
        consumed.current.add(key); if(consumed.current.size>64)consumed.current.delete(consumed.current.values().next().value!);
        try { if(notificationResponseKey(Notifications.getLastNotificationResponse())===key)Notifications.clearLastNotificationResponse(); } catch {}
      };
      if(consumed.current.has(key)){acknowledge();return;}
      const sequence=++tap;
      if(data.ownerId!==ownerId||typeof data.ownerEventKey!=='string'||!data.ownerEventKey||data.ownerEventKey.length>512){acknowledge();return;}
      void convex.query(api.ownerInbox.list,{clerkId:subject}).then(inbox=>{
        if(!current()||sequence!==tap)return;
        if(inbox?.ownerId!==ownerId||inbox.actorClerkId!==subject){acknowledge();return;}
        const item=inbox.items.find(row=>row.key===data.ownerEventKey); if(!item){acknowledge();return;}
        acknowledge();
        router.navigate({pathname:'/(owner)/me/inbox',params:{eventKey:item.key}} as never);
      }).catch(()=>{});
    };
    if(Platform.OS==='web')return()=>{mounted=false;};
    const listener=Notifications.addNotificationResponseReceivedListener(receive);
    try { receive(Notifications.getLastNotificationResponse()); } catch {}
    return()=>{mounted=false;listener.remove();};
  },[actor,ownerId,subject,convex,register,router]);
  return null;
}
