import { useEffect, useLayoutEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useConvex, useMutation } from 'convex/react';
import { api } from '@tendso/convex-client';
import { useGuardedRouter } from '../../../hooks/useGuardedRouter';
import { notificationResponseKey } from '../../../services/notificationOpening';
import { syncOwnerPush } from '../../../services/ownerPushSettings';
export { ownerDeviceToken, unregisterOwnerPush } from '../../../services/ownerPushSettings';

Notifications.setNotificationHandler({handleNotification:async()=>({shouldShowAlert:true,shouldShowBanner:true,shouldShowList:true,shouldPlaySound:true,shouldSetBadge:true})});

/** Native payloads can open only an event verified in the signed-in owner's inbox. */
export function OwnerNotificationBridge({ ownerId, subject }: { ownerId: string; subject: string }) {
  const convex=useConvex(); const router=useGuardedRouter(); const register=useMutation(api.ownerInbox.registerPushToken);
  const actor=`${subject}:${ownerId}`; const live=useRef(actor);
  useLayoutEffect(()=>{live.current=actor;},[actor]);
  const consumed=useRef(new Set<string>());
  useEffect(()=>{
    let mounted=true; let tap=0; const current=()=>mounted&&live.current===actor;
    void syncOwnerPush(register,subject,false,current).catch(()=>{});
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
