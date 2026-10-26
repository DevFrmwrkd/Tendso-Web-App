import React, { useEffect, useMemo, useState } from 'react';
import { useUser } from '@clerk/clerk-expo';
import { useQuery } from 'convex/react';
import { api, type Doc } from '@tendso/convex-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FieldAgentWorkspace } from '../../../components/field-agent/FieldAgentWorkspace';
import { FieldAgentMap } from '../../../components/field-agent/FieldAgentMap';
import { Banner } from '../../../components/v2';
import { currentMonthEarnings } from '../../../services/fieldAgentFinds';

export default function FieldAgentMapScreen() {
  return <FieldAgentWorkspace>{(creator) => <MapHome creator={creator} />}</FieldAgentWorkspace>;
}

function MapHome({ creator }: { creator: Doc<'creators'> }) {
  const { user } = useUser();
  const earnings = useQuery(api.earnings.getByCreator, { creatorId: creator._id });
  const unread = useQuery(api.notifications.getUnreadCount, { creatorId: creator._id });
  const monthlyEarnings = useMemo(() => earnings ? currentMonthEarnings(earnings) : undefined, [earnings]);
  const [justCertified, setJustCertified] = useState(false);
  useEffect(() => {
    let mounted = true;
    void AsyncStorage.getItem('ndm_just_certified').then((value) => {
      if (mounted && value === 'true') {
        setJustCertified(true);
        void AsyncStorage.removeItem('ndm_just_certified');
      }
    }).catch(() => {});
    return () => { mounted = false; };
  }, [creator._id]);
  return <FieldAgentMap creator={creator} userImage={user?.imageUrl} monthlyEarnings={monthlyEarnings}
    unreadCount={unread ?? 0}
    topNotice={justCertified ? <Banner tone="ok" title="You are certified" body="Welcome aboard. Find your first shop." /> : undefined} />;
}
