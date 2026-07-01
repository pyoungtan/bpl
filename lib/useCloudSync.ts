"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import { useAppStore, dataSignature, LOCAL_UPDATED_KEY, type Store } from "./store";
import type { AppData } from "./types";

export type SyncStatus = "idle" | "syncing" | "synced" | "error";

export interface SyncSummary {
  updatedAt: string | null;
  gearCount: number;
  tripCount: number;
}
/** Raised on login when local data has its own edits AND differs from the
 *  cloud copy — the user picks which side to keep. */
export interface SyncConflict {
  local: SyncSummary;
  cloud: SyncSummary;
}

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
  conflict: SyncConflict | null;
  resolveConflict: (choice: "local" | "cloud") => void;
  signIn: (email: string) => Promise<{ error: string | null }>;
  verifyCode: (email: string, token: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

function readLocalUpdatedAt(): string | null {
  try {
    return localStorage.getItem(LOCAL_UPDATED_KEY);
  } catch {
    return null;
  }
}

export function useCloudSync(): CloudState {
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<SyncStatus>("idle");
  const [conflict, setConflict] = useState<SyncConflict | null>(null);
  const lastPushed = useRef<string>("");
  const lastSyncedAt = useRef<string>("");
  const pendingLocal = useRef(false);
  const pushTimer = useRef<number | undefined>(undefined);
  const ready = useRef(false);
  // While a conflict awaits the user's choice, remote data is held here and
  // realtime/push are suspended so nothing clobbers the pending decision.
  const conflictActive = useRef(false);
  const pendingRemote = useRef<{
    remote: AppData;
    remoteJson: string;
    remoteAt: string;
  } | null>(null);
  const userIdRef = useRef<string | undefined>(undefined);

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
  userIdRef.current = userId;

  // On login: pull remote (or seed remote from local), then subscribe to realtime.
  useEffect(() => {
    ready.current = false;
    conflictActive.current = false;
    pendingRemote.current = null;
    setConflict(null);
    const sb = supabase;
    if (!sb || !userId) return;
    let cancelled = false;
    setStatus("syncing");

    (async () => {
      const { data, error } = await sb
        .from("user_data")
        .select("data, updated_at")
        .eq("user_id", userId)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        setStatus("error");
        return;
      }
      if (data?.data) {
        const remote = data.data as AppData;
        const remoteAt = (data.updated_at as string) ?? "";
        const remoteJson = JSON.stringify(remote);
        const local = pickData(useAppStore.getState());
        const localAt = readLocalUpdatedAt();
        const differs = dataSignature(local) !== dataSignature(remote);

        // Local has its own edits AND diverges from the cloud copy → ask the
        // user which to keep instead of silently overwriting either side.
        if (differs && localAt) {
          pendingRemote.current = { remote, remoteJson, remoteAt };
          conflictActive.current = true;
          setConflict({
            local: {
              updatedAt: localAt,
              gearCount: Object.keys(local.gear ?? {}).length,
              tripCount: Object.keys(local.trips ?? {}).length,
            },
            cloud: {
              updatedAt: remoteAt || null,
              gearCount: Object.keys(remote.gear ?? {}).length,
              tripCount: Object.keys(remote.trips ?? {}).length,
            },
          });
          return; // resolveConflict() completes setup once the user chooses
        }

        lastPushed.current = remoteJson;
        lastSyncedAt.current = remoteAt;
        useAppStore.getState().replaceAll(remote);
      } else {
        const local = pickData(useAppStore.getState());
        const now = new Date().toISOString();
        lastPushed.current = JSON.stringify(local);
        lastSyncedAt.current = now;
        await sb
          .from("user_data")
          .upsert({ user_id: userId, data: local, updated_at: now });
      }
      pendingLocal.current = false;
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
          if (conflictActive.current) return; // hold until the user chooses
          const row = payload.new as { data?: AppData; updated_at?: string };
          const remote = row?.data;
          if (!remote) return;
          const json = JSON.stringify(remote);
          if (json === lastPushed.current) return; // ignore our own echo
          // Never let an older row overwrite what we already have, and never
          // clobber unsaved local edits that are about to be pushed.
          const remoteAt = row.updated_at ?? "";
          if (remoteAt && lastSyncedAt.current && remoteAt <= lastSyncedAt.current) return;
          if (pendingLocal.current) return;
          lastPushed.current = json;
          lastSyncedAt.current = remoteAt || lastSyncedAt.current;
          useAppStore.getState().replaceAll(remote);
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      conflictActive.current = false;
      pendingRemote.current = null;
      sb.removeChannel(channel);
    };
  }, [userId]);

  // Finish login once the user resolves a local↔cloud conflict.
  const resolveConflict = useCallback((choice: "local" | "cloud") => {
    const pending = pendingRemote.current;
    conflictActive.current = false;
    pendingRemote.current = null;
    setConflict(null);
    if (!pending) return;

    if (choice === "cloud") {
      lastPushed.current = pending.remoteJson;
      lastSyncedAt.current = pending.remoteAt;
      useAppStore.getState().replaceAll(pending.remote);
      pendingLocal.current = false;
      ready.current = true;
      setStatus("synced");
      return;
    }

    // Keep local → overwrite the cloud copy with it.
    const sb = supabase;
    const uid = userIdRef.current;
    const local = pickData(useAppStore.getState());
    const json = JSON.stringify(local);
    const now = new Date().toISOString();
    lastPushed.current = json;
    lastSyncedAt.current = now;
    pendingLocal.current = false;
    ready.current = true;
    if (sb && uid) {
      setStatus("syncing");
      sb.from("user_data")
        .upsert({ user_id: uid, data: local, updated_at: now })
        .then(({ error }) => setStatus(error ? "error" : "synced"));
    } else {
      setStatus("synced");
    }
  }, []);

  // Push local changes (debounced) once initial sync is done.
  useEffect(() => {
    const sb = supabase;
    if (!sb || !userId) return;
    const unsub = useAppStore.subscribe((state) => {
      if (!ready.current) return;
      const data = pickData(state);
      const json = JSON.stringify(data);
      if (json === lastPushed.current) return;
      pendingLocal.current = true; // protect this edit from realtime clobbering
      if (pushTimer.current !== undefined) clearTimeout(pushTimer.current);
      pushTimer.current = window.setTimeout(async () => {
        const now = new Date().toISOString();
        lastPushed.current = json;
        lastSyncedAt.current = now;
        setStatus("syncing");
        const { error } = await sb
          .from("user_data")
          .upsert({ user_id: userId, data, updated_at: now });
        pendingLocal.current = false;
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
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: window.location.origin },
      });
      return { error: error?.message ?? null };
    } catch (e) {
      return {
        error: e instanceof Error ? e.message : "로그인 요청에 실패했어요.",
      };
    }
  }, []);

  // Verify the 6-digit code from the email — works regardless of which browser
  // opened the link, so it's the reliable fallback for phone + PWA logins.
  const verifyCode = useCallback(async (email: string, token: string) => {
    if (!supabase) return { error: "클라우드가 설정되지 않았습니다." };
    try {
      const { error } = await supabase.auth.verifyOtp({
        email,
        token: token.trim(),
        type: "email",
      });
      return { error: error?.message ?? null };
    } catch (e) {
      return {
        error: e instanceof Error ? e.message : "코드 확인에 실패했어요.",
      };
    }
  }, []);

  const signOut = useCallback(async () => {
    if (supabase) await supabase.auth.signOut();
  }, []);

  return {
    enabled: Boolean(supabase),
    session,
    status,
    conflict,
    resolveConflict,
    signIn,
    verifyCode,
    signOut,
  };
}
