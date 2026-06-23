"use client";

import { cn } from "@/lib/cn";

interface Option<T extends string> {
  value: T;
  label: React.ReactNode;
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
}: {
  value: T;
  onChange: (value: T) => void;
  options: Option<T>[];
  className?: string;
}) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-0.5 rounded-[9px] bg-fill p-0.5",
        className,
      )}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={cn(
              "h-8 flex-1 whitespace-nowrap rounded-[7px] px-3 text-[13px] font-medium transition",
              active
                ? "bg-white text-black shadow-sm dark:bg-[#636366] dark:text-white"
                : "text-label active:opacity-50",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
