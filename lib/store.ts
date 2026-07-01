"use client";

import { useEffect, useState } from "react";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type {
  AppData,
  GearItem,
  PackedEntry,
  ThemePref,
  Trip,
  WeightUnit,
} from "./types";
import { createSampleData } from "./sample";

function uid(prefix: string): string {
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);
  return `${prefix}-${rand}`;
}

interface Actions {
  // gear
  addGear: (partial?: Partial<GearItem>) => string;
  updateGear: (id: string, patch: Partial<GearItem>) => void;
  deleteGear: (id: string) => void;
  reorderGear: (major: string, orderedGroupIds: string[]) => void;
  /** Move a gear next to another (drag reorder); adopts the target's category. */
  moveGear: (activeId: string, overId: string) => void;
  setGearHidden: (id: string, hidden: boolean) => void;
  /**
   * Import gear from a LighterPack list; returns items added. When `replace`
   * is true the existing gear catalog (gear/order/categories) is cleared first.
   */
  importLighterpack: (
    cats: {
      category: string;
      items: { name: string; brand?: string; weightG: number; quantity: number }[];
    }[],
    replace?: boolean,
  ) => number;

  // categories (대분류)
  addCategory: (name: string) => void;
  renameCategoryAt: (index: number, name: string) => void;
  moveCategory: (from: number, to: number) => void;
  deleteCategoryAt: (index: number) => void;

  // presets
  addPreset: (name: string, gearIds: string[]) => string;
  deletePreset: (id: string) => void;

  // add-ons
  addAddOnByName: (parentId: string, name: string) => string;
  linkAddOn: (parentId: string, gearId: string) => void;
  unlinkAddOn: (parentId: string, gearId: string) => void;

  // trips
  createTrip: (name?: string) => string;
  updateTrip: (id: string, patch: Partial<Omit<Trip, "id">>) => void;
  deleteTrip: (id: string) => void;
  addEntriesToTrip: (tripId: string, entries: PackedEntry[]) => void;
  setEntryQuantity: (tripId: string, gearId: string, quantity: number) => void;
  removeEntryFromTrip: (tripId: string, gearId: string) => void;
  toggleTripChecked: (tripId: string, gearId: string) => void;

  // settings
  setDisplayUnit: (u: WeightUnit) => void;
  setCurrency: (c: string) => void;
  setTheme: (t: ThemePref) => void;
  resetToSample: () => void;
  replaceAll: (data: AppData) => void;
}

export type Store = AppData & Actions;

export const useAppStore = create<Store>()(
  persist(
    (set, get) => ({
      ...createSampleData(),

      addGear: (partial) => {
        const id = uid("g");
        const gear: GearItem = {
          id,
          name: partial?.name ?? "새 장비",
          brand: partial?.brand,
          majorCategory: partial?.majorCategory?.trim() || "기타",
          minorCategory: partial?.minorCategory,
          weightG: partial?.weightG ?? 0,
          quantity: partial?.quantity ?? 1,
          price: partial?.price,
          worn: partial?.worn,
          consumable: partial?.consumable,
          url: partial?.url,
          note: partial?.note,
          addOnIds: partial?.addOnIds ?? [],
        };
        set((s) => ({
          gear: { ...s.gear, [id]: gear },
          gearOrder: [...s.gearOrder, id],
          categories: s.categories.includes(gear.majorCategory)
            ? s.categories
            : [...s.categories, gear.majorCategory],
        }));
        return id;
      },

      updateGear: (id, patch) =>
        set((s) => {
          const g = s.gear[id];
          if (!g) return s;
          const next = { ...g, ...patch };
          if (patch.majorCategory !== undefined) {
            next.majorCategory = patch.majorCategory.trim() || "기타";
          }
          const categories = s.categories.includes(next.majorCategory)
            ? s.categories
            : [...s.categories, next.majorCategory];
          return { gear: { ...s.gear, [id]: next }, categories };
        }),

      deleteGear: (id) =>
        set((s) => {
          const gear = { ...s.gear };
          delete gear[id];
          for (const gid of Object.keys(gear)) {
            if (gear[gid].addOnIds.includes(id)) {
              gear[gid] = {
                ...gear[gid],
                addOnIds: gear[gid].addOnIds.filter((x) => x !== id),
              };
            }
          }
          const trips = { ...s.trips };
          for (const tid of Object.keys(trips)) {
            const t = trips[tid];
            if (t.packed.some((p) => p.gearId === id)) {
              trips[tid] = { ...t, packed: t.packed.filter((p) => p.gearId !== id) };
            }
          }
          return {
            gear,
            gearOrder: s.gearOrder.filter((x) => x !== id),
            trips,
          };
        }),

      reorderGear: (major, orderedGroupIds) =>
        set((s) => {
          const positions: number[] = [];
          s.gearOrder.forEach((id, idx) => {
            if (s.gear[id]?.majorCategory === major) positions.push(idx);
          });
          const next = [...s.gearOrder];
          positions.forEach((pos, i) => {
            if (orderedGroupIds[i] != null) next[pos] = orderedGroupIds[i];
          });
          return { gearOrder: next };
        }),

      moveGear: (activeId, overId) =>
        set((s) => {
          const active = s.gear[activeId];
          const over = s.gear[overId];
          if (!active || !over || activeId === overId) return s;
          const from = s.gearOrder.indexOf(activeId);
          const to = s.gearOrder.indexOf(overId);
          if (from < 0 || to < 0) return s;
          const gearOrder = s.gearOrder.slice();
          gearOrder.splice(to, 0, gearOrder.splice(from, 1)[0]);
          // Dropping into another category adopts that category immediately.
          const gear =
            active.majorCategory === over.majorCategory
              ? s.gear
              : {
                  ...s.gear,
                  [activeId]: { ...active, majorCategory: over.majorCategory },
                };
          const categories = s.categories.includes(over.majorCategory)
            ? s.categories
            : [...s.categories, over.majorCategory];
          return { gear, gearOrder, categories };
        }),

      setGearHidden: (id, hidden) =>
        set((s) => {
          const g = s.gear[id];
          if (!g) return s;
          return { gear: { ...s.gear, [id]: { ...g, hidden } } };
        }),

      importLighterpack: (cats, replace) => {
        const rows = cats.flatMap((c) =>
          c.items.map((it) => ({
            ...it,
            category: (c.category || "").trim() || "가져온 목록",
          })),
        );
        set((s) => {
          const gear = replace ? {} : { ...s.gear };
          const gearOrder = replace ? [] : [...s.gearOrder];
          const categories = replace ? [] : [...s.categories];
          for (const it of rows) {
            if (!categories.includes(it.category)) categories.push(it.category);
            const id = uid("g");
            gear[id] = {
              id,
              name: it.name || "장비",
              brand: it.brand,
              majorCategory: it.category,
              weightG: Math.max(0, Math.round(it.weightG || 0)),
              quantity: Math.max(1, Math.round(it.quantity || 1)),
              addOnIds: [],
            };
            gearOrder.push(id);
          }
          return { gear, gearOrder, categories };
        });
        return rows.length;
      },

      addCategory: (name) =>
        set((s) => {
          const n = name.trim();
          if (!n || s.categories.includes(n)) return s;
          return { categories: [...s.categories, n] };
        }),

      renameCategoryAt: (index, name) =>
        set((s) => {
          const old = s.categories[index];
          if (old === undefined) return s;
          const categories = [...s.categories];
          categories[index] = name;
          const gear = { ...s.gear };
          for (const id of Object.keys(gear)) {
            if (gear[id].majorCategory === old) {
              gear[id] = { ...gear[id], majorCategory: name };
            }
          }
          return { categories, gear };
        }),

      moveCategory: (from, to) =>
        set((s) => {
          if (to < 0 || to >= s.categories.length || from === to) return s;
          const categories = [...s.categories];
          const [moved] = categories.splice(from, 1);
          categories.splice(to, 0, moved);
          return { categories };
        }),

      deleteCategoryAt: (index) =>
        set((s) => {
          if (s.categories[index] === undefined) return s;
          return { categories: s.categories.filter((_, i) => i !== index) };
        }),

      addPreset: (name, gearIds) => {
        const id = uid("ps");
        set((s) => ({
          presets: [
            ...s.presets,
            { id, name: name.trim() || "프리셋", gearIds: [...gearIds] },
          ],
        }));
        return id;
      },

      deletePreset: (id) =>
        set((s) => ({ presets: s.presets.filter((p) => p.id !== id) })),

      addAddOnByName: (parentId, name) => {
        const id = uid("g");
        set((s) => {
          const parent = s.gear[parentId];
          const item: GearItem = {
            id,
            name: name.trim() || "애드온",
            majorCategory: parent?.majorCategory ?? "기타",
            minorCategory: "애드온",
            weightG: 0,
            quantity: 1,
            addOnIds: [],
          };
          const gear = { ...s.gear, [id]: item };
          if (parent) {
            gear[parentId] = { ...parent, addOnIds: [...parent.addOnIds, id] };
          }
          return { gear, gearOrder: [...s.gearOrder, id] };
        });
        return id;
      },

      linkAddOn: (parentId, gearId) =>
        set((s) => {
          const parent = s.gear[parentId];
          if (!parent || parent.addOnIds.includes(gearId) || parentId === gearId)
            return s;
          return {
            gear: {
              ...s.gear,
              [parentId]: { ...parent, addOnIds: [...parent.addOnIds, gearId] },
            },
          };
        }),

      unlinkAddOn: (parentId, gearId) =>
        set((s) => {
          const parent = s.gear[parentId];
          if (!parent) return s;
          return {
            gear: {
              ...s.gear,
              [parentId]: {
                ...parent,
                addOnIds: parent.addOnIds.filter((x) => x !== gearId),
              },
            },
          };
        }),

      createTrip: (name) => {
        const id = uid("t");
        const createdAt = Date.now();
        set((s) => ({
          trips: {
            ...s.trips,
            [id]: {
              id,
              name: name ?? "새 트립",
              memo: "",
              packed: [],
              checked: [],
              createdAt,
            },
          },
          tripOrder: [id, ...s.tripOrder],
        }));
        return id;
      },

      updateTrip: (id, patch) =>
        set((s) => {
          const t = s.trips[id];
          if (!t) return s;
          return { trips: { ...s.trips, [id]: { ...t, ...patch } } };
        }),

      deleteTrip: (id) =>
        set((s) => {
          const trips = { ...s.trips };
          delete trips[id];
          return { trips, tripOrder: s.tripOrder.filter((x) => x !== id) };
        }),

      addEntriesToTrip: (tripId, entries) =>
        set((s) => {
          const t = s.trips[tripId];
          if (!t) return s;
          const map = new Map(t.packed.map((p) => [p.gearId, p.quantity]));
          for (const e of entries) {
            map.set(e.gearId, (map.get(e.gearId) ?? 0) + e.quantity);
          }
          const packed = [...map.entries()].map(([gearId, quantity]) => ({
            gearId,
            quantity,
          }));
          return { trips: { ...s.trips, [tripId]: { ...t, packed } } };
        }),

      setEntryQuantity: (tripId, gearId, quantity) =>
        set((s) => {
          const t = s.trips[tripId];
          if (!t) return s;
          const packed = t.packed.map((p) =>
            p.gearId === gearId ? { ...p, quantity: Math.max(1, quantity) } : p,
          );
          return { trips: { ...s.trips, [tripId]: { ...t, packed } } };
        }),

      removeEntryFromTrip: (tripId, gearId) =>
        set((s) => {
          const t = s.trips[tripId];
          if (!t) return s;
          return {
            trips: {
              ...s.trips,
              [tripId]: {
                ...t,
                packed: t.packed.filter((p) => p.gearId !== gearId),
                checked: (t.checked ?? []).filter((x) => x !== gearId),
              },
            },
          };
        }),

      toggleTripChecked: (tripId, gearId) =>
        set((s) => {
          const t = s.trips[tripId];
          if (!t) return s;
          const checked = t.checked ?? [];
          const next = checked.includes(gearId)
            ? checked.filter((x) => x !== gearId)
            : [...checked, gearId];
          return { trips: { ...s.trips, [tripId]: { ...t, checked: next } } };
        }),

      setDisplayUnit: (u) => set({ displayUnit: u }),
      setCurrency: (c) => set({ currency: c }),
      setTheme: (t) => set({ theme: t }),
      resetToSample: () => set({ ...createSampleData() }),
      replaceAll: (data) => set({ ...data }),
    }),
    {
      name: "bpl-v5",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      migrate: (persisted: any) => {
        if (persisted && !Array.isArray(persisted.categories)) {
          const cats: string[] = [];
          const seen = new Set<string>();
          for (const id of persisted.gearOrder ?? []) {
            const g = persisted.gear?.[id];
            if (g && !seen.has(g.majorCategory)) {
              seen.add(g.majorCategory);
              cats.push(g.majorCategory);
            }
          }
          persisted.categories = cats;
        }
        return persisted;
      },
      partialize: (s) => ({
        gear: s.gear,
        gearOrder: s.gearOrder,
        categories: s.categories,
        presets: s.presets,
        trips: s.trips,
        tripOrder: s.tripOrder,
        displayUnit: s.displayUnit,
        currency: s.currency,
        theme: s.theme,
      }),
    },
  ),
);

/** True once the persisted store has rehydrated on the client. */
export function useHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    if (useAppStore.persist.hasHydrated()) {
      setHydrated(true);
      return;
    }
    const unsub = useAppStore.persist.onFinishHydration(() => setHydrated(true));
    return unsub;
  }, []);
  return hydrated;
}
