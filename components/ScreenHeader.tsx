"use client";

/** iOS large title. The floating glass bar sits above it (AppShell pads the
 *  content so the title starts below the bar and scrolls underneath it). */
export function ScreenHeader({
  title,
  subtitle,
  trailing,
}: {
  title: string;
  subtitle?: React.ReactNode;
  trailing?: React.ReactNode;
}) {
  return (
    <header className="px-4 pb-1">
      <div className="mt-2 flex min-h-[41px] items-end justify-between gap-2">
        <h1 className="min-w-0 flex-1 truncate text-[34px] font-bold leading-[1.1] tracking-[-0.025em] text-label">
          {title}
        </h1>
        {trailing && (
          <div className="flex shrink-0 items-center gap-0.5 pb-1">{trailing}</div>
        )}
      </div>
      {subtitle && <div className="mt-1 text-[15px] text-secondary">{subtitle}</div>}
    </header>
  );
}
