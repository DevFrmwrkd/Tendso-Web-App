import React, { createContext, useContext, useEffect, useState } from 'react';

interface NetworkContextType {
  isConnected: boolean | null; // null = unknown (still determining)
}

const NetworkContext = createContext<NetworkContextType>({
  isConnected: null,
});

export function useNetwork() {
  return useContext(NetworkContext);
}

// Safely import NetInfo — if native module isn't available, fall back to always-online
let NetInfoModule: any = null;
try {
  NetInfoModule = require('@react-native-community/netinfo').default;
} catch (e) {
  console.warn('[NetworkProvider] NetInfo not available, assuming online:', e);
}

export function NetworkProvider({ children }: { children: React.ReactNode }) {
  const [isConnected, setIsConnected] = useState<boolean | null>(null);

  useEffect(() => {
    if (!NetInfoModule) {
      // No NetInfo available, assume online
      setIsConnected(true);
      return;
    }

    // Fetch initial state immediately so we don't race with routing logic
    NetInfoModule.fetch().then((state: any) => {
      setIsConnected(state.isConnected ?? true);
    }).catch(() => {
      setIsConnected(true);
    });

    try {
      const unsubscribe = NetInfoModule.addEventListener((state: any) => {
        setIsConnected(state.isConnected ?? true);
      });
      return () => unsubscribe();
    } catch (e) {
      console.warn('[NetworkProvider] Failed to subscribe to NetInfo:', e);
      setIsConnected(true);
    }
  }, []);

  return (
    <NetworkContext.Provider value={{ isConnected }}>
      {children}
    </NetworkContext.Provider>
  );
}
