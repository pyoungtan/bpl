import { cn } from "@/lib/cn";

/** Small "TBD" pill for trips whose plan isn't settled yet. */
export function TbdTag({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-[18px] shrink-0 items-center rounded-full bg-fill px-[7px] text-[10.5px] font-bold tracking-[0.06em] text-secondary",
        className,
      )}
    >
      TBD
    </span>
  );
}
