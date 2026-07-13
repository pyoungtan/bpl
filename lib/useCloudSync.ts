"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import { useAppStore, dataSignature, LOCAL_UPDATED_KEY, type Store } from "./store";
import { createSampleData } from "./sample";
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

/** Turn a Supabase AuthError / thrown value into a human-readable string that
 *  includes the status code and name — so an empty `.message` (which otherwise
 *  renders as "{}") still tells us what actually failed. Also logs the raw
 *  error so it can be inspected from the friend's device console. */
function describeAuthError(e: unknown, fallback: string): string {
  if (typeof console !== "undefined") console.error("[cloud auth]", e);
  if (!e) return fallback;
  if (typeof e === "string") return e || fallback;
  const o = e as {
    message?: string;
    error_description?: string;
    msg?: string;
    status?: number;
    code?: number | string;
    name?: string;
  };
  const raw = (o.message || o.error_description || o.msg || "").trim();
  const status = o.status ?? o.code;
  // A blank or "{}" message means the server returned an empty error body;
  // surface the status/name instead so it isn't a mystery.
  const base = raw && raw !== "{}" ? raw : o.name || fallback;
  return status != null ? `${base} (${status})` : base;
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
    let retryTimer: number | undefined;
    setStatus("syncing");

    // Initial pull, with a hard timeout and automatic retry — a request that
    // hangs (laptop sleep, network drop) must not leave the status stuck on
    // "동기화 중" forever with nothing ever pushed.
    const pullOnce = async () => {
      try {
        const ctrl = new AbortController();
        const timeout = window.setTimeout(() => ctrl.abort(), 15_000);
        const { data, error } = await sb
          .from("user_data")
          .select("data, updated_at")
          .eq("user_id", userId)
          .abortSignal(ctrl.signal)
          .maybeSingle();
        window.clearTimeout(timeout);
        if (cancelled) return;
        if (error) throw error;

        if (data?.data) {
          const remote = data.data as AppData;
          const remoteAt = (data.updated_at as string) ?? "";
          const remoteJson = JSON.stringify(remote);
          const local = pickData(useAppStore.getState());
          const localAt = readLocalUpdatedAt();
          const differs = dataSignature(local) !== dataSignature(remote);
          // "Pristine" local = the untouched first-run sample → adopt the
          // cloud copy silently. Anything else that diverges gets the
          // which-side-to-keep dialog, even without an edit timestamp, so a
          // stale cloud row can never silently clobber real local work.
          const pristine =
            dataSignature({ ...createSampleData() }) === dataSignature(local);

          if (differs && !pristine) {
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
          if (differs) useAppStore.getState().replaceAll(remote);
        } else {
          const local = pickData(useAppStore.getState());
          const now = new Date().toISOString();
          const { error: seedError } = await sb
            .from("user_data")
            .upsert({ user_id: userId, data: local, updated_at: now });
          if (seedError) throw seedError;
          lastPushed.current = JSON.stringify(local);
          lastSyncedAt.current = now;
        }
        pendingLocal.current = false;
        ready.current = true;
        setStatus("synced");
      } catch {
        if (cancelled) return;
        setStatus("error");
        retryTimer = window.setTimeout(pullOnce, 6_000);
      }
    };
    pullOnce();

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
      if (retryTimer !== undefined) clearTimeout(retryTimer);
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

  // Push local changes (debounced) once initial sync is done. lastPushed is
  // only advanced AFTER a successful upsert — a failed push must stay "unsent"
  // so it retries; pendingLocal stays true meanwhile so realtime can't clobber
  // the unsaved edits. Every attempt has a hard timeout (no infinite
  // "동기화 중"), and failures auto-retry.
  useEffect(() => {
    const sb = supabase;
    if (!sb || !userId) return;
    let disposed = false;

    const pushNow = async () => {
      const data = pickData(useAppStore.getState());
      const json = JSON.stringify(data);
      if (json === lastPushed.current) {
        pendingLocal.current = false;
        setStatus("synced");
        return;
      }
      const now = new Date().toISOString();
      setStatus("syncing");
      try {
        const ctrl = new AbortController();
        const timeout = window.setTimeout(() => ctrl.abort(), 15_000);
        const { error } = await sb
          .from("user_data")
          .upsert({ user_id: userId, data, updated_at: now })
          .abortSignal(ctrl.signal);
        window.clearTimeout(timeout);
        if (disposed) return;
        if (error) throw error;
        lastPushed.current = json;
        lastSyncedAt.current = now;
        pendingLocal.current = false;
        setStatus("synced");
      } catch {
        if (disposed) return;
        setStatus("error");
        if (pushTimer.current !== undefined) clearTimeout(pushTimer.current);
        pushTimer.current = window.setTimeout(pushNow, 5_000);
      }
    };

    const unsub = useAppStore.subscribe((state) => {
      if (!ready.current) return;
      const json = JSON.stringify(pickData(state));
      if (json === lastPushed.current) return;
      pendingLocal.current = true; // protect this edit from realtime clobbering
      if (pushTimer.current !== undefined) clearTimeout(pushTimer.current);
      pushTimer.current = window.setTimeout(pushNow, 800);
    });
    return () => {
      disposed = true;
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
      return { error: error ? describeAuthError(error, "로그인 요청 실패") : null };
    } catch (e) {
      return { error: describeAuthError(e, "로그인 요청에 실패했어요.") };
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
      return { error: error ? describeAuthError(error, "코드 확인 실패") : null };
    } catch (e) {
      return { error: describeAuthError(e, "코드 확인에 실패했어요.") };
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
