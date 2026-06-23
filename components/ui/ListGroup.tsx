"use client";

import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";

export function ListSection({
  header,
  headerRight,
  footer,
  children,
  className,
}: {
  header?: React.ReactNode;
  headerRight?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("px-4", className)}>
      {(header || headerRight) && (
        <div className="mb-1.5 flex items-end justify-between px-4">
          <h2 className="text-[13px] font-medium uppercase tracking-wide text-secondary">
            {header}
          </h2>
          {headerRight}
        </div>
      )}
      <div className="overflow-hidden rounded-[10px] bg-card">
        <div className="divide-y divide-separator">{children}</div>
      </div>
      {footer && (
        <p className="mt-1.5 px-4 text-[13px] leading-snug text-secondary">
          {footer}
        </p>
      )}
    </section>
  );
}

export function ListRow({
  leading,
  trailing,
  chevron,
  onClick,
  className,
  children,
}: {
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  chevron?: boolean;
  onClick?: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  const Comp: React.ElementType = onClick ? "button" : "div";
  return (
    <Comp
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 px-4 py-2.5 text-left",
        onClick && "transition active:bg-fill",
        className,
      )}
    >
      {leading}
      <div className="min-w-0 flex-1">{children}</div>
      {trailing}
      {chevron && (
        <ChevronRight size={17} strokeWidth={2.5} className="-mr-1 shrink-0 text-tertiary" />
      )}
    </Comp>
  );
}
