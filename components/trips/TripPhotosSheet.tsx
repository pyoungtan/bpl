"use client";

import { useEffect, useRef, useState } from "react";
import { Images } from "lucide-react";
import { exifTakenAt } from "@/lib/exifDate";
import { Sheet } from "../ui/Sheet";
import { ImageViewer } from "./ImageViewer";

interface Shot {
  url: string;
  /** "YYYY-MM-DDTHH:MM:SS", the camera's local time. */
  at: string;
}

const DOW = ["일", "월", "화", "수", "목", "금", "토"];
function dayLabel(day: string): string {
  const d = new Date(`${day}T00:00:00`);
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${DOW[d.getDay()]})`;
}

/**
 * "그날의 사진": a look back at what was photographed on the trip. A web app
 * can't search the photo library, so you pick photos from around then (the
 * picker can select many at once) and only the ones taken on the trip's
 * dates are shown, by day and time. Nothing is uploaded or kept — closing
 * the sheet lets them go. Or just jump to the Photos app.
 */
export function TripPhotosSheet({
  open,
  onClose,
  start,
  end,
}: {
  open: boolean;
  onClose: () => void;
  /** Trip dates, "YYYY-MM-DD" (end optional for a day trip). */
  start?: string;
  end?: string;
}) {
  const [shots, setShots] = useState<Shot[] | null>(null);
  const [skipped, setSkipped] = useState({ outside: 0, undated: 0 });
  const [reading, setReading] = useState(false);
  const [viewing, setViewing] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const urls = useRef<string[]>([]);

  const release = () => {
    for (const u of urls.current) URL.revokeObjectURL(u);
    urls.current = [];
  };
  // Closing lets the photos go.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (!open) {
      setShots(null);
      setSkipped({ outside: 0, undated: 0 });
      setViewing(null);
    }
  }
  useEffect(() => {
    if (!open) release();
  }, [open]);
  useEffect(() => release, []);

  const last = end && end > (start ?? "") ? end : start;

  async function pick(files: FileList | null) {
    if (!files?.length || !start || !last) return;
    setReading(true);
    release();
    const kept: Shot[] = [];
    let outside = 0;
    let undated = 0;
    for (const f of Array.from(files)) {
      const at = await exifTakenAt(f).catch(() => null);
      if (!at) {
        undated++;
        continue;
      }
      const day = at.slice(0, 10);
      if (day < start || day > last) {
        outside++;
        continue;
      }
      const url = URL.createObjectURL(f);
      urls.current.push(url);
      kept.push({ url, at });
    }
    kept.sort((a, b) => a.at.localeCompare(b.at));
    setShots(kept);
    setSkipped({ outside, undated });
    setReading(false);
  }

  const days = shots
    ? [...new Set(shots.map((s) => s.at.slice(0, 10)))].map((day) => ({
        day,
        shots: shots.filter((s) => s.at.startsWith(day)),
      }))
    : [];

  return (
    <>
      <Sheet open={open} onClose={onClose} title="그날의 사진">
        <div className="px-5">
          <p className="text-[14px] leading-relaxed text-secondary">
            사진 선택 창에서 그 무렵 사진을 넉넉히 골라 주세요. 트립 날짜에 찍은 사진만 모아
            보여 드려요. 사진은 어디에도 저장되지 않아요.
          </p>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => input.current?.click()}
              disabled={!start || reading}
              className="btn-ink h-11 flex-1 rounded-full text-[15px] font-semibold disabled:opacity-40"
            >
              {reading ? "날짜 확인 중…" : shots ? "다시 고르기" : "사진 고르기"}
            </button>
            {/* iOS: opens the Photos app (unofficial scheme; does nothing elsewhere) */}
            <a
              href="photos-redirect://"
              className="grid h-11 flex-1 place-items-center rounded-full bg-fill text-[15px] font-medium text-label active:opacity-60"
            >
              사진 앱 열기
            </a>
          </div>
          <input
            ref={input}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(e) => {
              void pick(e.target.files);
              e.target.value = "";
            }}
          />
        </div>

        {shots && (
          <div className="mt-5">
            <p className="px-5 text-[13px] text-tertiary">
              {shots.length > 0
                ? `${shots.length}장`
                : "트립 날짜에 찍은 사진이 없어요."}
              {skipped.outside > 0 && ` · 다른 날 ${skipped.outside}장 제외`}
              {skipped.undated > 0 && ` · 날짜 정보 없는 ${skipped.undated}장 제외`}
            </p>
            {days.map(({ day, shots: list }) => (
              <section key={day} className="mt-3">
                {days.length > 1 && (
                  <h3 className="px-5 pb-2 text-[15px] font-bold text-label">{dayLabel(day)}</h3>
                )}
                <div className="grid grid-cols-3 gap-0.5 px-0.5">
                  {list.map((s) => (
                    <button
                      key={s.url}
                      type="button"
                      onClick={() => setViewing(s.url)}
                      className="relative aspect-square overflow-hidden bg-fill active:opacity-80"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element -- local blob URLs */}
                      <img src={s.url} alt="" className="h-full w-full object-cover" />
                      <span className="absolute bottom-1 right-1.5 text-[11px] font-semibold text-white [text-shadow:0_0_3px_rgba(0,0,0,0.6)]">
                        {s.at.slice(11, 16)}
                      </span>
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
        {!shots && !start && (
          <p className="mt-4 flex items-center gap-2 px-5 text-[13px] text-tertiary">
            <Images size={15} /> 트립 날짜를 먼저 정해 주세요.
          </p>
        )}
      </Sheet>
      <ImageViewer
        open={open && viewing !== null}
        src={viewing}
        tall={false}
        onClose={() => setViewing(null)}
      />
    </>
  );
}
