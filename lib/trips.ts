import type { AppData, GearItem, Trip } from "./types";

/**
 * Companions as a tag list. Tolerates legacy free-text values (a single
 * comma/space-separated string) from before companions became string[].
 */
export function tripCompanions(t: Pick<Trip, "companions">): string[] {
  const c = t.companions as unknown;
  if (Array.isArray(c)) {
    return c.filter((x): x is string => typeof x === "string" && x.trim() !== "");
  }
  if (typeof c === "string") {
    return c.split(/[,\s·]+/).filter(Boolean);
  }
  return [];
}

/** Upgrade older trips from the catalog included in the same saved data. */
export function snapshotTrips(data: AppData): AppData {
  const trips = { ...data.trips };
  for (const trip of Object.values(trips)) {
    if (!trip.packed.some(e => !e.snapshot && data.gear[e.gearId])) continue;
    trips[trip.id] = { ...trip, packed: trip.packed.map(e =>
      e.snapshot || !data.gear[e.gearId] ? e : { ...e, snapshot: data.gear[e.gearId] }
    ) };
  }
  return { ...data, trips };
}

/** Preserve shelf ordering and include archived items after current ones. */
export function tripCatalog(trip: Trip | undefined, catalog: Record<string, GearItem>, order: string[]) {
  const gear = { ...catalog };
  const ids = new Set(order);
  for (const entry of trip?.packed ?? []) {
    if (entry.snapshot) gear[entry.gearId] = entry.snapshot;
    ids.add(entry.gearId);
  }
  return { gear, gearOrder: [...ids] };
}
