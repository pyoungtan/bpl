"use client";

import { Shirt, Utensils } from "lucide-react";

/** Monochrome 착용 (worn) / 소모 (consumable) markers for list rows. */
export function GearFlags({ worn, consumable }: { worn?: boolean; consumable?: boolean }) {
  if (!worn && !consumable) return null;
  return (
    <span className="flex shrink-0 items-center gap-1 text-secondary">
      {worn && (
        <span role="img" aria-label="착용" title="착용">
          <Shirt size={14} strokeWidth={2} aria-hidden="true" />
        </span>
      )}
      {consumable && (
        <span role="img" aria-label="소모" title="소모">
          <Utensils size={14} strokeWidth={2} aria-hidden="true" />
        </span>
      )}
    </span>
  );
}
