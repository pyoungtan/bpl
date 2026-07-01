"use client";

import { Backpack, Map } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/cn";

export type TabKey = "shelf" | "trips";

const TABS: { key: TabKey; icon: React.ReactNode; label: string }[] = [
  { key: "shelf", icon: <Backpack size={23} strokeWidth={2} />, label: "Gear Shelf" },
  { key: "trips", icon: <Map size={23} strokeWidth={2} />, label: "Trips" },
];

export function NavIsland({
  tab,
  onChange,
}: {
  tab: TabKey;
  onChange: (t: TabKey) => void;
}) {
  return (
    <nav
      className="fixed left-4 z-40"
      style={{ bottom: "calc(env(safe-area-inset-bottom) + 16px)" }}
    >
      <div className="material shadow-float flex h-14 items-center gap-1 rounded-full border border-[var(--material-border)] px-1.5">
        {TABS.map((t) => {
          const active = t.key === tab;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => onChange(t.key)}
              aria-label={t.label}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative grid h-11 w-11 place-items-center rounded-full transition-colors active:scale-90",
                active ? "text-tint" : "text-secondary",
              )}
            >
              {active && (
                <motion.span
                  layoutId="navPill"
                  className="absolute inset-0 rounded-full bg-tint-soft"
                  transition={{ type: "spring", stiffness: 480, damping: 38 }}
                />
              )}
              <motion.span
                className="relative z-10 grid place-items-center"
                animate={{ scale: active ? 1.06 : 1 }}
                transition={{ type: "spring", stiffness: 480, damping: 30 }}
              >
                {t.icon}
              </motion.span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
