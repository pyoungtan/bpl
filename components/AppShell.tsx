"use client";

import { useEffect, useState } from "react";
import { useAppStore, useHydrated } from "@/lib/store";
import {
  useCloudSync,
  type SyncConflict,
  type SyncSummary,
} from "@/lib/useCloudSync";
import { NavIsland, type TabKey } from "./NavIsland";
import { GearShelf } from "./gear/GearShelf";
import { TripsTab } from "./trips/TripsTab";
import { SettingsSheet } from "./SettingsSheet";
import { PullToRefresh } from "./PullToRefresh";
import { cn } from "@/lib/cn";

export function AppShell() {
  const hydrated = useHydrated();
  const theme = useAppStore((s) => s.theme);
  const [tab, setTab] = useState<TabKey>("shelf");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [tripToOpen, setTripToOpen] = useState<string | null>(null);
  const cloud = useCloudSync();

  useEffect(() => {
    const root = document.documentElement;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const dark = theme === "dark" || (theme === "system" && mq.matches);
      root.classList.toggle("dark", dark);
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
        <div className="mt-6 h-40 animate-pulse rounded-[14px] bg-card" />
        <div className="mt-4 h-40 animate-pulse rounded-[14px] bg-card" />
      </div>
    );
  }

  return (
    <div className="mx-auto min-h-dvh w-full max-w-2xl">
      <PullToRefresh />
      {tab === "shelf" ? (
        <GearShelf
          onOpenSettings={() => setSettingsOpen(true)}
          onOpenTrip={(id) => {
            setTripToOpen(id);
            setTab("trips");
          }}
        />
      ) : (
        <TripsTab
          onOpenSettings={() => setSettingsOpen(true)}
          openTripId={tripToOpen}
          onConsumeOpen={() => setTripToOpen(null)}
        />
      )}
      <NavIsland tab={tab} onChange={setTab} />
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

  const option = (
    choice: "local" | "cloud",
    title: string,
    s: SyncSummary,
    newer: boolean,
  ) => (
    <button
      type="button"
      onClick={() => onChoose(choice)}
      className={cn(
        "w-full rounded-[12px] border p-3.5 text-left transition active:opacity-70",
        newer ? "border-tint bg-tint-soft" : "border-separator-opaque bg-fill",
      )}
    >
      <div className="flex items-center gap-2">
        <span className="text-[15px] font-semibold text-label">{title}</span>
        {newer && (
          <span className="rounded-full bg-tint px-1.5 py-0.5 text-[11px] font-semibold text-white">
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
      <div className="absolute inset-0 bg-black/40" />
      <div className="relative w-full max-w-xs rounded-[16px] bg-card p-5 shadow-2xl">
        <h3 className="text-[17px] font-semibold text-label">동기화 데이터 선택</h3>
        <p className="mt-1.5 text-[14px] leading-relaxed text-secondary">
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
