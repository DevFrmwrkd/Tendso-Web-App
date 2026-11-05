import React from 'react';
import { Banner } from './v2';
import { useNetwork } from '../providers/NetworkProvider';

export function OfflineBanner() {
  const { isConnected } = useNetwork();

  // null = still determining network state, don't flash the banner
  if (isConnected !== false) return null;

  return <Banner tone="warn" icon="cloud-offline-outline" body="You're offline. Some things won't work." />;
}
