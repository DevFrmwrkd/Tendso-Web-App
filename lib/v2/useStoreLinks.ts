"use client";

import { useQuery } from "convex/react";

import { api } from "@/convex/_generated/api";

import { APP_STORE_SETTING, DEFAULT_STORE_LINKS, PLAY_STORE_SETTING, safeStoreUrl, type StoreLinks } from "./appLinks";

/** Admin settings first, then deploy env overrides and the released store listings. */
export function useStoreLinks({ skip = false }: { skip?: boolean } = {}): StoreLinks {
    const play = useQuery(api.settings.get, skip ? "skip" : { key: PLAY_STORE_SETTING }) as string | null | undefined;
    const ios = useQuery(api.settings.get, skip ? "skip" : { key: APP_STORE_SETTING }) as string | null | undefined;
    return {
        appStore: safeStoreUrl(ios, DEFAULT_STORE_LINKS.appStore),
        googlePlay: safeStoreUrl(play, DEFAULT_STORE_LINKS.googlePlay),
    };
}
