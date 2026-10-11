"use client";

import { Utensils } from "lucide-react";

/** Rounded, chubby tee (lucide's Shirt is angular). */
function RoundShirt({ size = 14 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={2.1}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M8.6 4.6c.7 1.3 1.9 2 3.4 2s2.7-.7 3.4-2l3.5 1.5c1 .4 1.5 1.5 1.1 2.5l-.5 1.3c-.3.8-1.2 1.2-2 .9l-1-.4V17a3 3 0 0 1-3 3h-3a3 3 0 0 1-3-3v-6.6l-1 .4c-.8.3-1.7-.1-2-.9l-.5-1.3c-.4-1 .1-2.1 1.1-2.5z" />
    </svg>
  );
}

/** Monochrome 착용 (worn) / 소모 (consumable) markers for list rows. */
export function GearFlags({ worn, consumable }: { worn?: boolean; consumable?: boolean }) {
  if (!worn && !consumable) return null;
  return (
    <span className="flex shrink-0 items-center gap-1 text-secondary">
      {worn && (
        <span role="img" aria-label="착용" title="착용">
          <RoundShirt size={15} />
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
