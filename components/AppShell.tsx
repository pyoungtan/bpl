"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { useAppStore, useHydrated } from "@/lib/store";
import {
  useCloudSync,
  type SyncConflict,
  type SyncSummary,
} from "@/lib/useCloudSync";
import { TopBarPane, TopBarProvider, type TabKey } from "./TopBar";
import { GearShelf } from "./gear/GearShelf";
import { TripsTab } from "./trips/TripsTab";
import { SettingsSheet } from "./SettingsSheet";
import { PullToRefresh } from "./PullToRefresh";
import { pinPane, unpinPane, useTabSwipe } from "./useTabSwipe";
import { cn } from "@/lib/cn";

export function AppShell() {
  const hydrated = useHydrated();
  const theme = useAppStore((s) => s.theme);
  const [tab, setTab] = useState<TabKey>("shelf");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [tripToOpen, setTripToOpen] = useState<string | null>(null);
  const cloud = useCloudSync();
  // Both tabs stay mounted (switching only toggles visibility, so the long
  // Gear list is never rebuilt mid-transition, and a swipe can show the real
  // neighbouring screen). Each keeps its own scroll offset, like a native tab
  // bar.
  const tabRef = useRef<TabKey>("shelf");
  const tabScroll = useRef<Partial<Record<TabKey, number>>>({});
  const pendingScroll = useRef<number | null>(null);
  // Tapping the segment dissolves: the outgoing screen stays pinned on top
  // at its scroll offset and fades out over the incoming one.
  const pendingDissolve = useRef<{ from: TabKey; scroll: number } | null>(null);
  const dissolving = useRef<{ el: HTMLDivElement; anim: Animation; timer: number } | null>(
    null,
  );
  const rootRef = useRef<HTMLDivElement>(null);
  const paneEls = useRef<Partial<Record<TabKey, HTMLDivElement | null>>>({});

  const switchTab = useCallback(
    (next: TabKey, opts?: { scrollTo?: number; fromScroll?: number; dissolve?: boolean }) => {
      const cur = tabRef.current;
      if (next === cur) return;
      const fromScroll = opts?.fromScroll ?? window.scrollY;
      tabScroll.current[cur] = fromScroll;
      pendingScroll.current = opts?.scrollTo ?? tabScroll.current[next] ?? 0;
      pendingDissolve.current =
        opts?.dissolve === false ? null : { from: cur, scroll: fromScroll };
      tabRef.current = next;
      setTab(next);
    },
    [],
  );
  const openTripFromShelf = useCallback(
    (id: string) => {
      setTripToOpen(id);
      switchTab("trips", { scrollTo: 0 });
    },
    [switchTab],
  );
  const registerPane = useCallback((pane: TabKey, el: HTMLDivElement | null) => {
    paneEls.current[pane] = el;
  }, []);
  useTabSwipe({
    enabled: hydrated,
    rootRef,
    panes: paneEls,
    getTab: () => tabRef.current,
    getScroll: (t) => tabScroll.current[t] ?? 0,
    onCommit: (next, fromScroll) =>
      flushSync(() => switchTab(next, { fromScroll, dissolve: false })),
  });
  const consumeTripToOpen = useCallback(() => setTripToOpen(null), []);
  // Stable elements: a tab switch must not re-render the (hidden or shown)
  // screens — framer layout animations would measure the display:none state.
  const shelfScreen = useMemo(
    () => <GearShelf onOpenTrip={openTripFromShelf} />,
    [openTripFromShelf],
  );
  const tripsScreen = useMemo(
    () => <TripsTab openTripId={tripToOpen} onConsumeOpen={consumeTripToOpen} />,
    [tripToOpen, consumeTripToOpen],
  );

  useLayoutEffect(() => {
    const endDissolve = () => {
      const d = dissolving.current;
      if (!d) return;
      dissolving.current = null;
      window.clearTimeout(d.timer);
      d.anim.cancel();
      unpinPane(d.el);
      d.el.hidden = d.el !== paneEls.current[tabRef.current];
    };
    endDissolve();
    if (pendingScroll.current !== null) {
      window.scrollTo(0, pendingScroll.current);
      pendingScroll.current = null;
    }
    const d = pendingDissolve.current;
    pendingDissolve.current = null;
    const out = d ? paneEls.current[d.from] : null;
    const root = rootRef.current;
    if (!d || !out || !root || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // z 45: above the incoming tab's floating buttons, below the top bar
    pinPane(out, d.scroll, root.getBoundingClientRect(), 45);
    const anim = out.animate([{ opacity: 1 }, { opacity: 0 }], {
      duration: 280,
      easing: "cubic-bezier(0.4, 0, 0.2, 1)",
      fill: "forwards",
    });
    dissolving.current = { el: out, anim, timer: window.setTimeout(endDissolve, 300) };
  }, [tab]);

  // Switching light/dark reloads once: the iOS status bar only picks up the
  // new theme-color on a fresh load. The choice is already persisted
  // (zustand persist writes localStorage synchronously).
  // Only changes after hydration count (the stored value loading in is not
  // a switch), so this can't loop.
  const lastTheme = useRef<typeof theme | null>(null);
  useEffect(() => {
    if (!hydrated) return;
    if (lastTheme.current === null) {
      lastTheme.current = theme;
      return;
    }
    if (lastTheme.current === theme) return;
    lastTheme.current = theme;
    window.location.reload();
  }, [theme, hydrated]);

  useEffect(() => {
    const root = document.documentElement;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const dark = theme === "dark" || (theme === "system" && mq.matches);
      root.classList.toggle("dark", dark);
      // The iOS status bar takes its tint from theme-color; follow the app's
      // own choice, not just the system scheme the media variants encode.
      document
        .querySelectorAll('meta[name="theme-color"]')
        .forEach((m) => m.setAttribute("content", dark ? "#1c1c1e" : "#ffffff"));
    };
    apply();
    if (theme === "system") {
      mq.addEventListener("change", apply);
      return () => mq.removeEventListener("change", apply);
    }
  }, [theme]);

  if (!hydrated) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 pt-12">
        <div className="h-10 w-48 animate-pulse rounded-xl bg-card" />
        <div className="mt-6 h-40 animate-pulse rounded-[22px] bg-card" />
        <div className="mt-4 h-40 animate-pulse rounded-[22px] bg-card" />
      </div>
    );
  }

  return (
    <TopBarProvider
      tab={tab}
      onTabChange={(t) => switchTab(t)}
      onOpenSettings={() => setSettingsOpen(true)}
    >
      <div ref={rootRef} className="mx-auto min-h-dvh w-full max-w-2xl">
        <PullToRefresh />
        <TabPane pane="shelf" active={tab === "shelf"} elRef={registerPane}>
          {shelfScreen}
        </TabPane>
        <TabPane pane="trips" active={tab === "trips"} elRef={registerPane}>
          {tripsScreen}
        </TabPane>
        <SettingsSheet
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          cloud={cloud}
        />
        {cloud.conflict && (
          <SyncConflictDialog
            conflict={cloud.conflict}
            onChoose={cloud.resolveConflict}
          />
        )}
      </div>
    </TopBarProvider>
  );
}

/** A kept-alive tab screen, hidden while inactive. Top padding clears the
 *  floating glass bar; content scrolls underneath. */
function TabPane({
  pane,
  active,
  elRef,
  children,
}: {
  pane: TabKey;
  active: boolean;
  elRef: (pane: TabKey, el: HTMLDivElement | null) => void;
  children: React.ReactNode;
}) {
  return (
    <TopBarPane value={pane}>
      <div
        ref={(el) => {
          elRef(pane, el);
        }}
        hidden={!active}
        data-tab-pane
        className="pt-[calc(var(--bar-top)+60px)]"
      >
        {children}
      </div>
    </TopBarPane>
  );
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "기록 없음";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "알 수 없음";
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function SyncConflictDialog({
  conflict,
  onChoose,
}: {
  conflict: SyncConflict;
  onChoose: (choice: "local" | "cloud") => void;
}) {
  const { local, cloud } = conflict;
  // Compare ISO timestamps directly; a missing timestamp counts as oldest.
  const localNewer = (local.updatedAt ?? "") > (cloud.updatedAt ?? "");
  // Picking the strictly-older side overwrites newer data — confirm once more.
  const [pending, setPending] = useState<"local" | "cloud" | null>(null);
  function isOlder(choice: "local" | "cloud") {
    const mine = (choice === "local" ? local : cloud).updatedAt ?? "";
    const other = (choice === "local" ? cloud : local).updatedAt ?? "";
    return mine < other;
  }
  function pick(choice: "local" | "cloud") {
    if (isOlder(choice)) setPending(choice);
    else onChoose(choice);
  }

  if (pending) {
    const chosen = pending === "local" ? local : cloud;
    return (
      <div className="fixed inset-0 z-[70] flex items-center justify-center p-6">
        <div className="absolute inset-0 bg-black/30" />
        <div className="glass-strong relative w-full max-w-[19rem] rounded-[32px] p-6 text-center">
          <h3 className="text-[17px] font-semibold text-label">
            예전 데이터로 덮어쓸까요?
          </h3>
          <p className="mt-1.5 text-[14px] leading-relaxed text-secondary">
            선택한 {pending === "local" ? "이 기기" : "클라우드"} 데이터(
            {formatDateTime(chosen.updatedAt)})가 더 예전 것입니다. 더 최신인{" "}
            {pending === "local" ? "클라우드" : "이 기기"} 데이터가 삭제되며
            되돌릴 수 없어요.
          </p>
          <div className="mt-5 flex flex-col gap-2">
            <button
              type="button"
              onClick={() => onChoose(pending)}
              className="h-12 rounded-full bg-red text-[16px] font-semibold text-white active:opacity-80"
            >
              예전 데이터 사용
            </button>
            <button
              type="button"
              onClick={() => setPending(null)}
              className="h-12 rounded-full bg-fill text-[16px] font-medium text-label active:opacity-60"
            >
              돌아가기
            </button>
          </div>
        </div>
      </div>
    );
  }

  const option = (
    choice: "local" | "cloud",
    title: string,
    s: SyncSummary,
    newer: boolean,
  ) => (
    <button
      type="button"
      onClick={() => pick(choice)}
      className={cn(
        "w-full rounded-[20px] border p-4 text-left transition active:opacity-70",
        newer ? "border-tint bg-tint-soft" : "border-transparent bg-fill",
      )}
    >
      <div className="flex items-center gap-2">
        <span className="text-[15px] font-semibold text-label">{title}</span>
        {newer && (
          <span className="rounded-full bg-tint px-2 py-0.5 text-[11px] font-semibold text-on-tint">
            최신
          </span>
        )}
      </div>
      <div className="mt-1 text-[13px] text-secondary">
        {formatDateTime(s.updatedAt)}
      </div>
      <div className="mt-0.5 tabular text-[12.5px] text-tertiary">
        장비 {s.gearCount}개 · 트립 {s.tripCount}개
      </div>
    </button>
  );

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-black/30" />
      <div className="glass-strong relative w-full max-w-[19rem] rounded-[32px] p-6">
        <h3 className="text-center text-[17px] font-semibold text-label">동기화 데이터 선택</h3>
        <p className="mt-1.5 text-center text-[14px] leading-relaxed text-secondary">
          이 기기와 클라우드의 데이터가 서로 다릅니다. 어느 쪽 데이터를 사용할까요?
          선택하지 않은 쪽은 덮어써집니다.
        </p>
        <div className="mt-4 flex flex-col gap-2">
          {option("cloud", "클라우드 데이터", cloud, !localNewer)}
          {option("local", "이 기기 데이터", local, localNewer)}
        </div>
      </div>
    </div>
  );
}
