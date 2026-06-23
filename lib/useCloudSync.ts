"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import { useAppStore, type Store } from "./store";
import type { AppData } from "./types";

export type SyncStatus = "idle" | "syncing" | "synced" | "error";

function pickData(s: Store): AppData {
  return {
    gear: s.gear,
    gearOrder: s.gearOrder,
    categories: s.categories,
    presets: s.presets,
    trips: s.trips,
    tripOrder: s.tripOrder,
    displayUnit: s.displayUnit,
    currency: s.currency,
    theme: s.theme,
  };
}

export interface CloudState {
  enabled: boolean;
  session: Session | null;
  status: SyncStatus;
  signIn: (email: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

export function useCloudSync(): CloudState {
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<SyncStatus>("idle");
  const lastPushed = useRef<string>("");
  const pushTimer = useRef<number | undefined>(undefined);
  const ready = useRef(false);

  // Track the auth session.
  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const userId = session?.user?.id;

  // On login: pull remote (or seed remote from local), then subscribe to realtime.
  useEffect(() => {
    ready.current = false;
    const sb = supabase;
    if (!sb || !userId) return;
    let cancelled = false;
    setStatus("syncing");

    (async () => {
      const { data, error } = await sb
        .from("user_data")
        .select("data")
        .eq("user_id", userId)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        setStatus("error");
        return;
      }
      if (data?.data) {
        lastPushed.current = JSON.stringify(data.data);
        useAppStore.getState().replaceAll(data.data as AppData);
      } else {
        const local = pickData(useAppStore.getState());
        lastPushed.current = JSON.stringify(local);
        await sb
          .from("user_data")
          .upsert({ user_id: userId, data: local, updated_at: new Date().toISOString() });
      }
      ready.current = true;
      setStatus("synced");
    })();

    const channel = sb
      .channel(`user_data_${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "user_data",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const remote = (payload.new as { data?: AppData })?.data;
          if (!remote) return;
          const json = JSON.stringify(remote);
          if (json === lastPushed.current) return; // ignore our own echo
          lastPushed.current = json;
          useAppStore.getState().replaceAll(remote);
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      sb.removeChannel(channel);
    };
  }, [userId]);

  // Push local changes (debounced) once initial sync is done.
  useEffect(() => {
    const sb = supabase;
    if (!sb || !userId) return;
    const unsub = useAppStore.subscribe((state) => {
      if (!ready.current) return;
      const data = pickData(state);
      const json = JSON.stringify(data);
      if (json === lastPushed.current) return;
      if (pushTimer.current !== undefined) clearTimeout(pushTimer.current);
      pushTimer.current = window.setTimeout(async () => {
        lastPushed.current = json;
        setStatus("syncing");
        const { error } = await sb
          .from("user_data")
          .upsert({ user_id: userId, data, updated_at: new Date().toISOString() });
        setStatus(error ? "error" : "synced");
      }, 800);
    });
    return () => {
      unsub();
      if (pushTimer.current !== undefined) clearTimeout(pushTimer.current);
    };
  }, [userId]);

  const signIn = useCallback(async (email: string) => {
    if (!supabase) return { error: "클라우드가 설정되지 않았습니다." };
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    });
    return { error: error?.message ?? null };
  }, []);

  const signOut = useCallback(async () => {
    if (supabase) await supabase.auth.signOut();
  }, []);

  return { enabled: Boolean(supabase), session, status, signIn, signOut };
}
