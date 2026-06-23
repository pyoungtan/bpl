"use client";

import { forwardRef } from "react";
import { cn } from "@/lib/cn";

type Variant = "filled" | "tinted" | "gray" | "plain" | "destructive";
type Size = "sm" | "md" | "lg" | "icon";

const variants: Record<Variant, string> = {
  filled: "bg-tint text-white font-semibold",
  tinted: "bg-tint-soft text-tint font-semibold",
  gray: "bg-fill text-label font-medium",
  plain: "text-tint font-normal",
  destructive: "bg-fill text-red font-medium",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-3.5 text-[15px] rounded-xl gap-1.5",
  md: "h-11 px-4 text-[16px] rounded-xl gap-2",
  lg: "h-[50px] px-5 text-[17px] rounded-2xl gap-2",
  icon: "h-9 w-9 rounded-full",
};

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "gray", size = "md", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      className={cn(
        "inline-flex select-none items-center justify-center transition active:opacity-60 disabled:pointer-events-none disabled:opacity-40",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  );
});
