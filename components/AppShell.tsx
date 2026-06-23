"use client";

import { useEffect, useState } from "react";
import { useAppStore, useHydrated } from "@/lib/store";
import { useCloudSync } from "@/lib/useCloudSync";
import { NavIsland, type TabKey } from "./NavIsland";
import { GearShelf } from "./gear/GearShelf";
import { TripsTab } from "./trips/TripsTab";
import { SettingsSheet } from "./SettingsSheet";

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
    </div>
  );
}
