"use client";

import { useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";

const DOW = ["일", "월", "화", "수", "목", "금", "토"];

function toISO(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/**
 * Month-grid range picker: the first tap sets the start date, the second tap
 * sets the end (a tap before the start restarts the range). ISO date strings
 * compare lexicographically, so plain string comparison is safe throughout.
 */
export function RangeCalendar({
  start,
  end,
  onChange,
}: {
  start?: string;
  end?: string;
  onChange: (start?: string, end?: string) => void;
}) {
  const init = start ? new Date(`${start}T00:00:00`) : new Date();
  const [view, setView] = useState({
    y: init.getFullYear(),
    m: init.getMonth(),
  });
  // "months" = quick year/month jump (tap the header to toggle).
  const [mode, setMode] = useState<"days" | "months">("days");

  const firstDow = new Date(view.y, view.m, 1).getDay();
  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();
  const now = new Date();
  const todayISO = toISO(now.getFullYear(), now.getMonth(), now.getDate());

  function tap(iso: string) {
    // No range yet, or a complete range → start over from this day.
    if (!start || end) return onChange(iso, undefined);
    if (iso < start) return onChange(iso, undefined);
    onChange(start, iso); // second tap (same day = single-day trip)
  }

  function moveMonth(delta: number) {
    setView((v) => {
      const d = new Date(v.y, v.m + delta, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });
  }

  const cells: (number | null)[] = [
    ...Array.from({ length: firstDow }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  return (
    <div className="rounded-[24px] bg-card p-3">
      <div className="flex items-center justify-between px-1 pb-2">
        <button
          type="button"
          aria-label={mode === "days" ? "이전 달" : "이전 해"}
          onClick={() =>
            mode === "days"
              ? moveMonth(-1)
              : setView((v) => ({ ...v, y: v.y - 1 }))
          }
          className="grid h-8 w-8 place-items-center rounded-full text-tint active:bg-fill"
        >
          <ChevronLeft size={19} />
        </button>
        <button
          type="button"
          aria-label="연·월 선택"
          onClick={() => setMode((m) => (m === "days" ? "months" : "days"))}
          className="flex items-center gap-1 text-[15px] font-semibold text-label active:opacity-60"
        >
          {mode === "days" ? `${view.y}년 ${view.m + 1}월` : `${view.y}년`}
          <ChevronDown
            size={14}
            className={cn(
              "text-tertiary transition-transform",
              mode === "months" && "rotate-180",
            )}
          />
        </button>
        <button
          type="button"
          aria-label={mode === "days" ? "다음 달" : "다음 해"}
          onClick={() =>
            mode === "days"
              ? moveMonth(1)
              : setView((v) => ({ ...v, y: v.y + 1 }))
          }
          className="grid h-8 w-8 place-items-center rounded-full text-tint active:bg-fill"
        >
          <ChevronRight size={19} />
        </button>
      </div>

      {mode === "months" ? (
        <div className="grid grid-cols-4 gap-1 pb-1">
          {Array.from({ length: 12 }, (_, m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setView((v) => ({ ...v, m }));
                setMode("days");
              }}
              className={cn(
                "h-10 touch-manipulation rounded-full text-[14px] tabular transition active:opacity-70",
                m === view.m
                  ? "bg-tint font-semibold text-on-tint"
                  : "text-label active:bg-fill",
              )}
            >
              {m + 1}월
            </button>
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-7 pb-1">
            {DOW.map((d, i) => (
              <span
                key={d}
                className={cn(
                  "py-0.5 text-center text-[11px] font-medium",
                  i === 0 ? "text-red/70" : "text-tertiary",
                )}
              >
                {d}
              </span>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-y-0.5">
            {cells.map((day, i) => {
              if (day === null) return <span key={`e${i}`} />;
              const iso = toISO(view.y, view.m, day);
              const isStart = iso === start;
              const isEnd = iso === end;
              const inRange = !!start && !!end && iso > start && iso < end;
              const isToday = iso === todayISO;
              return (
                <button
                  key={iso}
                  type="button"
                  onClick={() => tap(iso)}
                  className={cn(
                    "relative mx-auto grid h-9 w-9 touch-manipulation place-items-center rounded-full text-[14px] tabular transition active:opacity-70",
                    isStart || isEnd
                      ? "bg-tint font-semibold text-on-tint"
                      : inRange
                        ? "bg-tint-soft text-tint"
                        : "text-label",
                    isToday && !isStart && !isEnd && "ring-1 ring-inset ring-tint",
                  )}
                >
                  {day}
                </button>
              );
            })}
          </div>
        </>
      )}

      {start && (
        <button
          type="button"
          onClick={() => onChange(undefined, undefined)}
          className="mt-1.5 w-full py-1.5 text-center text-[13px] text-secondary active:opacity-60"
        >
          날짜 지우기
        </button>
      )}
    </div>
  );
}
