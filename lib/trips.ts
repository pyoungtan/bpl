import type { Trip } from "./types";

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
