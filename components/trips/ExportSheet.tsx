"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, Maximize2, Share } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { buildExportData, renderMobileImage, renderPcImage } from "@/lib/exportImage";
import { Sheet } from "../ui/Sheet";
import { Segmented } from "../ui/Segmented";
import { InkButton } from "../ui/Glass";
import { ImageViewer } from "./ImageViewer";

type Kind = "pc" | "mobile";

const ids = new WeakMap<object, string>();
let nextId = 0;
/** Stable id per render-input object (identity, not content). */
function keyId(k: object): string {
  let id = ids.get(k);
  if (!id) {
    id = String(++nextId);
    ids.set(k, id);
  }
  return id;
}
const KIND_KEY = "bpl-export-kind";

/** 내보내기: renders the trip's pack list as a PC (1920×1080) or Mobile
 *  (iPhone-width, @3x) image and hands it to the share sheet or a download. */
export function ExportSheet({
  open,
  onClose,
  tripId,
}: {
  open: boolean;
  onClose: () => void;
  tripId: string;
}) {
  const trip = useAppStore((s) => s.trips[tripId]);
  const gear = useAppStore((s) => s.gear);
  const gearOrder = useAppStore((s) => s.gearOrder);
  const categories = useAppStore((s) => s.categories);
  const unit = useAppStore((s) => s.displayUnit);

  const [kind, setKind] = useState<Kind>(() => {
    if (typeof window === "undefined") return "mobile";
    try {
      return localStorage.getItem(KIND_KEY) === "pc" ? "pc" : "mobile";
    } catch {
      return "mobile";
    }
  });
  // Each result is tagged with what it was rendered for, so a stale one is
  // simply not shown (no reset needed when the inputs change).
  const [result, setResult] = useState<
    { key: string; blob?: Blob; url?: string; failed?: boolean } | null
  >(null);

  const data = useMemo(
    () => (trip ? buildExportData(trip, gear, gearOrder, categories) : null),
    [trip, gear, gearOrder, categories],
  );

  // Render whenever the sheet opens or the layout changes, so the share tap
  // can hand over a ready file (iOS needs share() inside the tap itself).
  const renderKey = useMemo(() => ({ data, kind, unit }), [data, kind, unit]);
  useEffect(() => {
    if (!open || !renderKey.data) return;
    const key = renderKey;
    let cancelled = false;
    let url: string | null = null;
    (key.kind === "pc" ? renderPcImage(key.data!, key.unit) : renderMobileImage(key.data!, key.unit))
      .then((blob) => {
        if (cancelled) return;
        url = URL.createObjectURL(blob);
        setResult({ key: keyId(key), blob, url });
      })
      .catch(() => {
        if (!cancelled) setResult({ key: keyId(key), failed: true });
      });
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [open, renderKey]);
  const current = result && result.key === keyId(renderKey) ? result : null;
  const image = current?.blob && current.url ? { blob: current.blob, url: current.url } : null;
  const error = Boolean(current?.failed);

  function pick(k: Kind) {
    setKind(k);
    try {
      localStorage.setItem(KIND_KEY, k);
    } catch {
      /* ignore */
    }
  }

  const fileName = `${(trip?.name || "trip").replace(/[\\/:*?"<>|]+/g, "").trim() || "trip"}-${kind}.png`;

  function download() {
    if (!image) return;
    const a = document.createElement("a");
    a.href = image.url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  async function share() {
    if (!image) return;
    const file = new File([image.blob], fileName, { type: "image/png" });
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file] });
      } catch (e) {
        if ((e as DOMException)?.name !== "AbortError") download();
      }
      return;
    }
    download();
  }

  const empty = data !== null && data.itemCount === 0;
  const [viewing, setViewing] = useState(false);

  return (
    <>
      <Sheet open={open} onClose={onClose} title="내보내기">
        <div className="flex flex-col gap-4 px-4 pb-2">
          <Segmented
            value={kind}
            onChange={pick}
            options={[
              { value: "mobile", label: "Mobile" },
              { value: "pc", label: "PC" },
            ]}
            className="w-full"
          />
          <p className="-mt-1 px-1 text-[13px] text-secondary">
            {kind === "pc"
              ? "1920×1080 가로 이미지 · 웹에 게시하기 좋은 크기"
              : "아이폰 세로 이미지 · 장비가 많으면 아래로 길어져요"}
          </p>

          <div className="grid min-h-[200px] place-items-center overflow-hidden rounded-[18px] bg-fill">
            {empty ? (
              <p className="px-6 py-12 text-center text-[15px] text-secondary">
                챙긴 장비가 없어요. 장비를 추가한 뒤 내보내 주세요.
              </p>
            ) : error ? (
              <p className="px-6 py-12 text-center text-[15px] text-secondary">
                이미지를 만들지 못했어요. 다시 시도해 주세요.
              </p>
            ) : image ? (
              <button
                type="button"
                aria-label="크게 보기"
                onClick={() => setViewing(true)}
                className={
                  kind === "pc"
                    ? "relative block w-full cursor-zoom-in active:opacity-80"
                    : "relative block max-w-full cursor-zoom-in active:opacity-80"
                }
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={image.url}
                  alt="내보내기 미리보기"
                  className={
                    kind === "pc"
                      ? "block h-auto w-full"
                      : "block max-h-[52dvh] w-auto max-w-full shadow-[0_1px_6px_rgba(0,0,0,0.08)]"
                  }
                />
                <span className="absolute bottom-2 right-2 grid h-8 w-8 place-items-center rounded-full bg-black/45 text-white backdrop-blur-md">
                  <Maximize2 size={15} strokeWidth={2.2} />
                </span>
              </button>
            ) : (
              <p className="py-12 text-[14px] text-secondary">이미지를 만드는 중…</p>
            )}
          </div>

          <InkButton size="lg" onClick={share} disabled={!image || empty} className="w-full">
            <Share size={20} strokeWidth={2.2} /> 공유
          </InkButton>
          <button
            type="button"
            onClick={download}
            disabled={!image || empty}
            className="flex h-11 items-center justify-center gap-1.5 text-[15px] font-medium text-secondary active:opacity-60 disabled:opacity-40"
          >
            <Download size={17} /> 이미지 저장
          </button>
        </div>
      </Sheet>
      <ImageViewer
        open={open && viewing}
        src={image?.url ?? null}
        tall={kind === "mobile"}
        onClose={() => setViewing(false)}
      />
    </>
  );
}
