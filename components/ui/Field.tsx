"use client";

import { forwardRef } from "react";
import { cn } from "@/lib/cn";

export function Field({
  label,
  hint,
  children,
  className,
}: {
  label?: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("block", className)}>
      {label && (
        <span className="mb-1.5 block px-1 text-[13px] font-medium text-secondary">
          {label}
        </span>
      )}
      {children}
      {hint && <span className="mt-1.5 block px-1 text-[12px] text-secondary">{hint}</span>}
    </label>
  );
}

const inputBase =
  "w-full h-11 rounded-[10px] border border-separator bg-card px-3.5 text-[17px] text-label placeholder:text-tertiary outline-none transition focus:border-tint focus:ring-2 focus:ring-tint/25";

export const TextField = forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(function TextField({ className, ...props }, ref) {
  return <input ref={ref} className={cn(inputBase, className)} {...props} />;
});

export const NumberField = forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(function NumberField({ className, ...props }, ref) {
  return (
    <input
      ref={ref}
      type="number"
      inputMode="decimal"
      className={cn(inputBase, "tabular", className)}
      {...props}
    />
  );
});

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      className={cn(inputBase, "h-auto min-h-[88px] resize-none py-2.5", className)}
      {...props}
    />
  );
});
